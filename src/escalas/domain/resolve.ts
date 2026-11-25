// Resolve, para cada dia, o horário efetivo de cada colaborador:
// horário habitual, turno de fim de semana, ajuste manual ou substituição (regra da abertura).

import { buildRange, weekdayOf, type ScheduleRange } from './calendar';
import { effectiveMinutes, operatingSpan, shiftSpan, type OperatingSpan, type ShiftSpan } from './time';
import { deptEnabled, deptHourLimits, hoursOnlyShown, isHourlyDept, isIntermediate, type CellStatus, type DeptConfig, type DeptId, type Employee, type Holiday, type ScheduleConfig, type Shift, type Weekday, type ShiftKind } from './types';

export interface DeptContext {
  config: ScheduleConfig;
  dept: DeptConfig;
  deptId: DeptId;
  employees: Employee[]; // somente ativos, na ordem do cadastro
  range: ScheduleRange;
  dates: string[];
  weekdays: Weekday[];
  /** Horário de funcionamento do dia (null = fechado, inclusive feriado fechado). */
  operating: (OperatingSpan | null)[];
  holidays: (Holiday | null)[];
  /** Quantidade exigida no sábado, domingo ou feriado (null nos dias úteis comuns). */
  requiredStaff: (number | null)[];
  /** Feriado com a academia aberta (horário de feriado). */
  holidayOpen: boolean[];
  maxSimultaneous: number[];
  staffException: boolean[];
  simultaneousException: boolean[];
  unavailable: boolean[][]; // [emp][dia]
  /** Dia de férias do colaborador. */
  vacation: boolean[][]; // [emp][dia]
  /** Dia com folgas bloqueadas pelo gestor (academia aberta): todos trabalham. */
  noOff: boolean[];
}

export function buildDeptContext(config: ScheduleConfig, deptId: DeptId, range = buildRange(config.year, config.month)): DeptContext {
  const dept = config.departments[deptId];
  const employees = deptEnabled(config, deptId) ? dept.employees.filter((e) => e.active) : [];
  const dates = range.dates;
  const holidayMap = new Map(config.holidays.map((h) => [h.date, h]));
  const weekdays = dates.map(weekdayOf);
  const holidays = dates.map((d) => holidayMap.get(d) ?? null);
  const operating = dates.map((_, i) => {
    const h = holidays[i];
    if (h?.closed) return null;
    if (h) return operatingSpan({ open: true, ...config.holidayHours });
    return operatingSpan(config.operatingHours[weekdays[i]]);
  });
  const holidayOpen = dates.map((_, i) => !!holidays[i] && !holidays[i]!.closed);
  const vacation = employees.map((e) => dates.map((d) => (e.vacations ?? []).some((v) => d >= v.start && d <= v.end)));
  const blocked = new Set(config.noOffWeekdays ?? []);
  const noOff = dates.map((_, i) => blocked.has(weekdays[i]) && !!operating[i] && !holidays[i]);
  const exFor = (date: string, kind: 'weekendStaff' | 'maxSimultaneous') =>
    config.exceptions.find((x) => x.dept === deptId && x.date === date && x.kind === kind);
  // Só fim de semana e feriado: dias úteis comuns ficam indisponíveis; sábado, domingo e feriado aberto, liberados.
  const unavailable = employees.map((e) =>
    dates.map((d, i) => (e.fixedDays?.length
      ? !e.fixedDays.includes(weekdays[i])
      : e.weekendOnly
        ? !(weekdays[i] === 0 || weekdays[i] === 6 || holidayOpen[i])
        : !e.availableWeekdays.includes(weekdays[i])) || e.unavailableDates.includes(d)),
  );
  const requiredStaff = dates.map((d, i) => {
    const w = weekdays[i];
    if (w !== 0 && w !== 6 && !holidays[i]) return null;
    if (!operating[i]) return 0;
    const ex = exFor(d, 'weekendStaff');
    if (ex) return ex.value;
    if (noOff[i]) return employees.filter((_, e) => !vacation[e][i] && !unavailable[e][i]).length;
    if (holidayOpen[i]) return dept.holidayRequired;
    return w === 6 ? dept.saturdayRequired : dept.sundayRequired;
  });
  const maxSimultaneous = dates.map((d) => exFor(d, 'maxSimultaneous')?.value ?? dept.maxSimultaneous);
  return {
    config,
    dept,
    deptId,
    employees,
    range,
    dates,
    weekdays,
    operating,
    holidays,
    requiredStaff,
    holidayOpen,
    maxSimultaneous,
    staffException: dates.map((d) => !!exFor(d, 'weekendStaff')),
    simultaneousException: dates.map((d) => !!exFor(d, 'maxSimultaneous')),
    unavailable,
    vacation,
    noOff,
  };
}

export type ShiftOrigin = 'habitual' | 'fimDeSemana' | 'feriado' | 'substituicao' | 'manual';

export interface ResolvedCell {
  status: CellStatus;
  shift: Shift | null;
  span: ShiftSpan | null;
  minutes: number;
  origin: ShiftOrigin | null;
  substitutedRole?: ShiftKind;
  locked: boolean;
}

export interface SubstitutionEvent {
  dateIndex: number;
  /** Turno coberto: abertura, fechamento ou intermediário (este só por nome escolhido). */
  role: ShiftKind;
  absentIds: string[];
  outcome: 'aplicada' | 'bloqueada' | 'sem_candidato';
  substituteId?: string;
  newShift: Shift;
  blocked: { empId: string; reasons: string[] }[];
}

export interface CellInput {
  status: CellStatus;
  manualShift?: Shift | null;
  locked?: boolean;
}

export type CellGetter = (empIndex: number, dateIndex: number) => CellInput;

export interface ResolvedDept {
  ctx: DeptContext;
  cells: ResolvedCell[][]; // [emp][dia]
  substitutions: SubstitutionEvent[];
}

const OFF_CELL = (status: CellStatus, locked: boolean): ResolvedCell => ({
  status, shift: null, span: null, minutes: 0, origin: null, locked,
});

function makeCell(shift: Shift, origin: ShiftOrigin, locked: boolean, role?: ShiftKind): ResolvedCell {
  return { status: 'T', shift, span: shiftSpan(shift), minutes: effectiveMinutes(shift), origin, locked, substitutedRole: role };
}

/** Horário que o colaborador cumpre no dia, sem considerar substituições. */
/**
 * Turno do dia sem substituição. `saturdaySlot` = posição do colaborador entre os que trabalham no
 * sábado (0 = primeiro, 1 = segundo): o segundo usa o 2º turno de sábado, quando há dois no sábado.
 */
export function baseShift(ctx: DeptContext, emp: Employee, dateIndex: number, input: CellInput, saturdaySlot = 0): { shift: Shift; origin: ShiftOrigin } {
  if (input.manualShift) return { shift: input.manualShift, origin: 'manual' };
  if (ctx.holidayOpen[dateIndex]) return { shift: ctx.dept.holidayShift, origin: 'feriado' };
  const w = ctx.weekdays[dateIndex];
  // Dias fixos: o horário do dia (se definido) ou o horário da pessoa, inclusive sábado e domingo.
  if (emp.fixedDays?.includes(w)) return { shift: emp.fixedShifts?.[w] ?? emp.shift, origin: 'habitual' };
  if (w === 6) return { shift: saturdaySlot > 0 ? saturdayShiftFor(ctx.dept, saturdaySlot) : ctx.dept.saturdayShift, origin: 'fimDeSemana' };
  if (w === 0) return { shift: ctx.dept.sundayShift, origin: 'fimDeSemana' };
  return { shift: emp.shift, origin: 'habitual' };
}

/** Minutos do funcionamento com menos de `min` pessoas presentes. */
function uncoveredMinutes(spans: ShiftSpan[], op: OperatingSpan, min: number): number {
  if (min <= 0) return 0;
  const points = [...new Set([op.start, op.end, ...spans.flatMap((x) => [x.start, x.end])])].filter((p) => p >= op.start && p <= op.end).sort((a, b) => a - b);
  let total = 0;
  for (let i = 0; i < points.length - 1; i++)
    if (spans.filter((x) => x.start <= points[i] && x.end >= points[i + 1]).length < min) total += points[i + 1] - points[i];
  return total;
}

/** Turno de sábado de cada posição: o 2º colaborador usa o 2º turno, se configurado. */
export function saturdayShiftFor(dept: DeptConfig, slot: number): Shift {
  return slot > 0 && dept.saturdayRequired >= 2 && dept.saturdayShift2 ? dept.saturdayShift2 : dept.saturdayShift;
}

const KIND_RANK: Record<string, number> = { abertura: 0, intermediario: 1, intermediario_noite: 2, fechamento: 3 };

export interface ConcurrencyPeak {
  count: number;
  from: number;
  to: number;
}

/** Maior número de pessoas presentes ao mesmo tempo (presença da entrada à saída). */
export function peakConcurrency(spans: ShiftSpan[]): ConcurrencyPeak {
  const events: [number, number][] = [];
  for (const s of spans) {
    events.push([s.start, 1], [s.end, -1]);
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0;
  let best: ConcurrencyPeak = { count: 0, from: 0, to: 0 };
  for (let i = 0; i < events.length; i++) {
    cur += events[i][1];
    if (cur > best.count) {
      const next = events.slice(i + 1).find((e) => e[0] > events[i][0]);
      best = { count: cur, from: events[i][0], to: next ? next[0] : events[i][0] };
    }
  }
  return best;
}

export function coversOpening(span: ShiftSpan, op: OperatingSpan): boolean {
  return span.start <= op.start && span.end > op.start;
}

export function coversClosing(span: ShiftSpan, op: OperatingSpan): boolean {
  return span.end >= op.end && span.start < op.end;
}

/** Descanso, em minutos, entre o fim da jornada de um dia e o início da jornada do dia seguinte. */
export function restBetween(prev: ShiftSpan, next: ShiftSpan): number {
  return 1440 + next.start - prev.end;
}

const weekStartIndex = (i: number) => i - (i % 7);

/**
 * Resolve os horários do departamento nas datas [from, to].
 * Os dias anteriores a `from` são lidos de `out` (já resolvidos), o que permite ao gerador
 * reavaliar só a semana corrente.
 */
export function resolveDept(
  ctx: DeptContext,
  get: CellGetter,
  out?: ResolvedCell[][],
  from = 0,
  to = ctx.dates.length - 1,
): ResolvedDept {
  const n = ctx.employees.length;
  const cells: ResolvedCell[][] = out ?? ctx.employees.map(() => new Array<ResolvedCell>(ctx.dates.length));
  const substitutions: SubstitutionEvent[] = [];
  const { labor } = ctx.config;
  const minRest = labor.minInterJourneyRestHours * 60;

  for (let d = from; d <= to; d++) {
    const inputs: CellInput[] = [];
    for (let e = 0; e < n; e++) inputs.push(get(e, d));
    // Sábado com dois colaboradores: o primeiro (abertura → intermediário → fechamento) fica no 1º turno, o outro no 2º.
    const slot = new Array<number>(n).fill(0);
    if (ctx.weekdays[d] === 6 && ctx.dept.saturdayShift2 && !ctx.holidayOpen[d]) {
      const order = inputs.map((_, e) => e).filter((e) => inputs[e].status === 'T' && !inputs[e].manualShift)
        .sort((x, y) => KIND_RANK[ctx.employees[x].kind] - KIND_RANK[ctx.employees[y].kind] || x - y);
      order.forEach((e, i) => { slot[e] = i; });
    }
    for (let e = 0; e < n; e++) {
      const input = inputs[e];
      if (input.status !== 'T') {
        cells[e][d] = OFF_CELL(input.status, !!input.locked);
        continue;
      }
      const b = baseShift(ctx, ctx.employees[e], d, input, slot[e]);
      cells[e][d] = makeCell(b.shift, b.origin, !!input.locked);
    }

    const op = ctx.operating[d];
    const w = ctx.weekdays[d];
    if (!op || w === 0 || w === 6 || ctx.holidays[d]) continue;

    const tryCover = (role: ShiftKind) => {
      // Professores/estagiários e intermediário: só há troca com nomes em "Quem cobre quem" (sem regra automática).
      const hourly = isHourlyDept(ctx.deptId);
      const inter = isIntermediate(role) || hourly;
      const kinds = inter ? [] : role === 'abertura' ? ctx.dept.openingCoverKinds : ctx.dept.closingCoverKinds;
      const covers = role === 'abertura' ? coversOpening : coversClosing;
      const covered = inter
        ? ctx.employees.some((x, i) => x.kind === role && cells[i][d].status === 'T' && cells[i][d].origin !== 'substituicao')
        : cells.some((row) => row[d].span && covers(row[d].span!, op));
      if (covered) return;
      const absent = ctx.employees
        .map((emp, e) => ({ emp, e }))
        .filter(({ emp, e }) => emp.kind === role && cells[e][d].status !== 'T');
      if (!absent.length) return;
      // Nomes escolhidos para cobrir quem folga vêm primeiro; depois, a regra automática do departamento.
      const named = [...new Set(absent.flatMap((a) => a.emp.coveredBy ?? []))];
      if (!named.length && !kinds.length) return;
      const newShift = absent[0].emp.shift;
      const newSpan = shiftSpan(newShift);
      const newMinutes = effectiveMinutes(newShift);
      const event: SubstitutionEvent = {
        dateIndex: d, role, absentIds: absent.map((a) => a.emp.id), outcome: 'sem_candidato', newShift, blocked: [],
      };
      const able = ({ emp, e }: { emp: Employee; e: number }) => emp.kind !== role && cells[e][d].status === 'T' && cells[e][d].origin === 'habitual' && !inputs[e].locked;
      const all = ctx.employees.map((emp, e) => ({ emp, e }));
      const byName = named.map((id) => all.find((x) => x.emp.id === id)).filter((x): x is { emp: Employee; e: number } => !!x && able(x));
      const byRule = all
        .filter((x) => kinds.includes(x.emp.kind) && able(x) && !byName.includes(x))
        .sort((a, b) => kinds.indexOf(a.emp.kind) - kinds.indexOf(b.emp.kind));
      const candidates = [...byName, ...byRule];
      for (const { emp, e } of candidates) {
        const reasons: string[] = [];
        if (d > 0) {
          const prev = cells[e][d - 1];
          if (prev?.span && restBetween(prev.span, newSpan) < minRest)
            reasons.push(`descanso entre jornadas de ${Math.floor(restBetween(prev.span, newSpan) / 60)}h após o dia anterior (mínimo ${labor.minInterJourneyRestHours}h)`);
        }
        if (d + 1 < ctx.dates.length) {
          const nextIn = get(e, d + 1);
          if (nextIn.status === 'T') {
            const nextSpan = shiftSpan(baseShift(ctx, emp, d + 1, nextIn).shift);
            if (restBetween(newSpan, nextSpan) < minRest)
              reasons.push(`descanso de ${Math.floor(restBetween(newSpan, nextSpan) / 60)}h antes da jornada do dia seguinte (mínimo ${labor.minInterJourneyRestHours}h)`);
          }
        }
        const dailyLimit = deptHourLimits(ctx.deptId)?.daily ?? labor.dailyLimitHours;
        const weeklyLimit = hoursOnlyShown(ctx.deptId) ? Infinity : deptHourLimits(ctx.deptId)?.weekly ?? labor.weeklyLimitHours;
        if (newMinutes > dailyLimit * 60) reasons.push(`jornada diária acima de ${dailyLimit}h`);
        const ws = weekStartIndex(d);
        let weekMin = newMinutes;
        for (let k = ws; k < ws + 7; k++) {
          if (k === d) continue;
          if (k < d) weekMin += cells[e][k]?.minutes ?? 0;
          else {
            const ki = get(e, k);
            if (ki.status === 'T') weekMin += effectiveMinutes(baseShift(ctx, emp, k, ki).shift);
          }
        }
        if (weekMin > weeklyLimit * 60) reasons.push(`jornada semanal passaria do limite de ${weeklyLimit}h`);
        const spans = cells.map((row, i) => (i === e ? newSpan : row[d].span)).filter((s): s is ShiftSpan => !!s);
        if (peakConcurrency(spans).count > ctx.maxSimultaneous[d])
          reasons.push(`mais de ${ctx.maxSimultaneous[d]} colaboradores simultâneos`);
        // Quem sai do próprio turno (abertura/fechamento) não pode deixá-lo sem ninguém.
        if (hourly) {
          // Não pode abrir horário abaixo do mínimo de presentes que antes estava coberto.
          const min = ctx.dept.minPresent ?? 1;
          const before = cells.map((row) => row[d].span).filter((x): x is ShiftSpan => !!x);
          if (uncoveredMinutes(spans, op, min) > uncoveredMinutes(before, op, min)) reasons.push(`deixaria horário sem o mínimo de ${min} presente(s)`);
        } else if (!isIntermediate(emp.kind)) {
          const ownCovers = emp.kind === 'abertura' ? coversOpening : coversClosing;
          const stillCovered = cells.some((row, i) => i !== e && row[d].span && ownCovers(row[d].span!, op));
          const ownKinds = emp.kind === 'abertura' ? ctx.dept.openingCoverKinds : ctx.dept.closingCoverKinds;
          const replacement = ctx.employees.some((o, i) => i !== e && ownKinds.includes(o.kind) && o.kind !== emp.kind && cells[i][d].status === 'T' && cells[i][d].origin === 'habitual');
          if (!stillCovered && !replacement) reasons.push(`deixaria ${emp.kind === 'abertura' ? 'a abertura' : 'o fechamento'} sem ninguém`);
        }
        if (!reasons.length) {
          cells[e][d] = makeCell(newShift, 'substituicao', false, role);
          event.outcome = 'aplicada';
          event.substituteId = emp.id;
          break;
        }
        event.blocked.push({ empId: emp.id, reasons });
      }
      if (event.outcome !== 'aplicada' && event.blocked.length) event.outcome = 'bloqueada';
      substitutions.push(event);
    };
    tryCover('abertura');
    tryCover('fechamento');
    // Se quem cobriu o fechamento era da abertura, a abertura pode ter ficado vaga: nova tentativa.
    if (substitutions.some((s) => s.dateIndex === d && s.outcome === 'aplicada')) tryCover('abertura');
    tryCover('intermediario');
    tryCover('intermediario_noite');
  }
  return { ctx, cells, substitutions };
}
