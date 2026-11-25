// Gerador automático da escala 5x2.
// Para cada departamento e semana (segunda a domingo), enumera as combinações de folgas de cada
// colaborador e pontua cada alternativa com as mesmas regras do validador. Mantém as melhores
// alternativas (busca em feixe) para considerar as dependências entre semanas.

import { analyzeSchedule, type Analysis } from './analyze';
import { buildRange, formatDayMonth } from './calendar';
import { buildDeptContext, resolveDept, type CellInput, type DeptContext, type ResolvedCell } from './resolve';
import { dayAlerts, multiWeekAlerts, restAlerts, weekAlerts, weekTotals, plannedWeekMinutes } from './validate';
import { DEPT_IDS, deptEnabled, outside5x2, type DeptId, deptName, isHourlyDept, maxTeamSize, minTeamSize, type Alert, type Cell, type CellGrid, type Conflict, type ScheduleConfig, type Shift } from './types';

const F = 0;
const T = 1;
const FE = 2;
const FR = 3;
const STATUS = ['F', 'T', 'FE', 'FR'] as const;

const HARD = 1000;
const MAX_EXTRA_PER_WEEK = 1;
/** Até este tamanho de equipe a semana é buscada por completo; acima, por ajuste colaborador a colaborador. */
const FULL_SEARCH_MAX_TEAM = 4;
/** Quantas distribuições de fim de semana são refinadas por estado da busca (equipes maiores). */
const DESCENT_STARTS = 12;
const ATTENTION_WEIGHT: Record<string, number> = {
  LACUNA_COBERTURA: 30,
  INTERMEDIARIO_DESCOBERTO: 4,
  HORAS_ADICIONAIS_DIA: 10,
  HORAS_ADICIONAIS_SEMANA: 10,
  SUBSTITUICAO_TURNO: 3,
  CARGA_ABAIXO: 0, // tratado de forma proporcional abaixo
  HORARIO_DIFERENTE: 0,
  FORA_DO_FUNCIONAMENTO: 0,
};

export interface GenerateOptions {
  seed?: number;
  /** Células da escala do mês anterior (mesma unidade), para os dias de borda da 1ª semana. */
  previous?: CellGrid | null;
  beamWidth?: number;
  /** Gera só estes departamentos; os demais mantêm as células de `keep` (ex.: com ajustes manuais). */
  only?: DeptId[];
  keep?: CellGrid | null;
  /**
   * "Repetir o mês anterior": prefere, semana a semana, as mesmas folgas e fins de semana da escala anterior
   * (as semanas dela se repetem em ordem). Só desempata entre combinações válidas: as regras obrigatórias vencem.
   */
  reference?: { cells: CellGrid; weeks: string[][] } | null;
}

export interface GenerateResult {
  cells: CellGrid;
  feasible: boolean;
  conflicts: Conflict[];
  analysis: Analysis;
  importedPrevious: boolean;
}

interface BeamState {
  st: Uint8Array[];
  manual: (Shift | null)[][];
  locked: boolean[][];
  res: ResolvedCell[][];
  cost: number;
  hard: number;
  weekendDays: number[];
  weekendRun: number[];
  sundayRun: number[];
  holidaysWorked: number[];
}

interface Pattern {
  statuses: number[]; // 7 posições
  extra: boolean;
  offDays: number[];
  holidaysWorked: number;
}

function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function combinations(items: number[], k: number): number[][] {
  const out: number[][] = [];
  const rec = (start: number, acc: number[]) => {
    if (acc.length === k) { out.push([...acc]); return; }
    for (let i = start; i < items.length; i++) { acc.push(items[i]); rec(i + 1, acc); acc.pop(); }
  };
  if (k <= 0) return [[]];
  if (k > items.length) return [items];
  rec(0, []);
  return out;
}

const isWeekdayHol = (ctx: DeptContext, d: number) => !!ctx.holidays[d] && ctx.weekdays[d] !== 0 && ctx.weekdays[d] !== 6;

/**
 * Padrões de folga de um colaborador na semana.
 * Feriado em dia útil: quem não trabalha tem folga de feriado (FE), que não conta entre as 2 folgas;
 * quem trabalha recebe folga compensatória na semana quando a regra é 'folga'.
 */
function weekPatterns(ctx: DeptContext, state: BeamState, e: number, w: number, extra: boolean, holidayRest: boolean): Pattern[] {
  const base = w * 7;
  const fixed: (number | null)[] = [];
  const optionalHol: number[] = [];
  let forcedOff = 0;
  let vacationDays = 0;
  let fixedHolOff = 0;
  for (let k = 0; k < 7; k++) {
    const d = base + k;
    if (state.locked[e][d]) { fixed.push(state.st[e][d]); if (state.st[e][d] === F) forcedOff++; if (state.st[e][d] === FR) vacationDays++; continue; }
    if (ctx.vacation[e][d]) { fixed.push(FR); vacationDays++; continue; }
    if (isWeekdayHol(ctx, d)) {
      if (ctx.holidays[d]!.closed || ctx.unavailable[e][d] || ctx.requiredStaff[d] === 0) { fixed.push(FE); fixedHolOff++; }
      else { fixed.push(FE); optionalHol.push(k); }
      continue;
    }
    if (!ctx.operating[d] || ctx.unavailable[e][d] || ctx.requiredStaff[d] === 0) { fixed.push(F); forcedOff++; continue; }
    fixed.push(null);
  }
  const compensate = ctx.config.labor.holidayWorkCompensation === 'folga';
  const countsAsRest = holidayRest;
  const open = fixed.map((f, k) => (f === null ? k : -1)).filter((k) => k >= 0);
  // Dias com folga bloqueada pelo gestor ficam fora da escolha (se ainda sobrar onde folgar).
  const unblocked = open.filter((k) => !ctx.noOff[base + k]);
  const patterns: Pattern[] = [];
  const holSubsets: number[][] = [[]];
  for (const k of optionalHol) for (const sub of [...holSubsets]) holSubsets.push([...sub, k]);
  for (const worked of holSubsets) {
    // Semana com férias: folga proporcional aos dias fora das férias (ex.: 2 dias fora → 1 folga).
    const rest = vacationDays ? Math.round((ctx.config.labor.restDaysPerWeek * (7 - vacationDays)) / 7) : ctx.config.labor.restDaysPerWeek;
    // Feriado em dia útil folgado conta como uma das folgas da semana (regra da unidade).
    const holOff = countsAsRest ? optionalHol.filter((k) => !worked.includes(k)).length + fixedHolOff : 0;
    const need = Math.max(0, rest + (compensate ? worked.length : 0) - forcedOff - holOff);
    const size = extra ? need + 1 : need;
    const free = unblocked.length >= size ? unblocked : open;
    if (extra && size > free.length) continue;
    // Sem dias livres suficientes (ex.: dias já fixados do mês anterior), folga em todos os que sobram.
    for (const offs of combinations(free, Math.min(size, free.length))) {
      const statuses = fixed.map((f, k) => (worked.includes(k) ? T : f !== null ? f : offs.includes(k) ? F : T));
      patterns.push({ statuses, extra, offDays: statuses.map((x, k) => (x === F ? k : -1)).filter((k) => k >= 0), holidaysWorked: worked.length });
    }
  }
  return patterns;
}

function cloneState(s: BeamState): BeamState {
  return {
    st: s.st.map((a) => a.slice()),
    manual: s.manual,
    locked: s.locked,
    res: s.res.map((r) => r.slice()),
    cost: s.cost,
    hard: s.hard,
    weekendDays: s.weekendDays.slice(),
    weekendRun: s.weekendRun.slice(),
    sundayRun: s.sundayRun.slice(),
    holidaysWorked: s.holidaysWorked.slice(),
  };
}

function generateDept(ctx: DeptContext, opts: GenerateOptions): { grid: CellGrid; importedPrevious: boolean } {
  const n = ctx.employees.length;
  const D = ctx.dates.length;
  const { labor } = ctx.config;
  const rand = rng((opts.seed ?? 0) + (ctx.deptId === 'apoio' ? 7919 : 0));
  const beamWidth = opts.beamWidth ?? 8;
  const grid: CellGrid = {};
  if (n === 0) return { grid, importedPrevious: false };

  // Estado inicial: dias de borda importados da escala anterior ficam travados.
  let importedPrevious = false;
  const initial: BeamState = {
    st: ctx.employees.map(() => new Uint8Array(D)),
    manual: ctx.employees.map(() => new Array<Shift | null>(D).fill(null)),
    locked: ctx.employees.map(() => new Array<boolean>(D).fill(false)),
    res: ctx.employees.map(() => new Array<ResolvedCell>(D)),
    cost: 0, hard: 0,
    weekendDays: new Array(n).fill(0),
    weekendRun: new Array(n).fill(0),
    sundayRun: new Array(n).fill(0),
    holidaysWorked: new Array(n).fill(0),
  };
  const firstOfMonth = ctx.range.monthDates[0];
  if (opts.previous) {
    ctx.employees.forEach((emp, e) => {
      ctx.dates.forEach((date, d) => {
        if (date >= firstOfMonth) return;
        const prev = opts.previous![emp.id]?.[date];
        if (!prev) return;
        initial.st[e][d] = prev.status === 'T' ? T : prev.status === 'FE' ? FE : prev.status === 'FR' ? FR : F;
        initial.manual[e][d] = prev.manualShift ?? null;
        initial.locked[e][d] = true;
        importedPrevious = true;
      });
    });
  }

  let beam: BeamState[] = [initial];
  for (let w = 0; w < ctx.range.weeks.length; w++) {
    // strict: exige a quantidade exata no sábado/domingo/feriado. Sem solução exata na semana, roda de
    // novo aceitando menos gente (os dias que faltarem viram conflito) em vez de deixar a semana vazia.
    // Feriado conta como folga (regra da unidade). Se a semana não fecha assim (ex.: equipe grande demais para
    // a quantidade exata do fim de semana), ela volta à regra antiga: feriado além das 2 folgas.
    let holRest = ctx.config.labor.holidayCountsAsRest !== false;
    const run = (extra: boolean, strict = true) => {
      const width = extra ? Math.min(beamWidth, 4) : beamWidth;
      const next: BeamState[] = [];
      for (const state of beam) {
        const patterns = ctx.employees.map((_, e) => {
          const p = weekPatterns(ctx, state, e, w, false, holRest);
          return extra ? [...p, ...weekPatterns(ctx, state, e, w, true, holRest)] : p;
        });
        // Dias com quantidade exata exigida (sábado, domingo, feriado): poda as combinações.
        const reqDays = [0, 1, 2, 3, 4, 5, 6].filter((k) => ctx.requiredStaff[w * 7 + k] !== null);
        const able = reqDays.map((k) => patterns.map((ps) => ps.some((p) => p.statuses[k] === T)));
        const targets = reqDays.map((k, i) => Math.min(ctx.requiredStaff[w * 7 + k] ?? 0, able[i].filter(Boolean).length));
        const remainingAble = able.map((a) => a.map((_, from) => a.slice(from).filter(Boolean).length).concat(0));

        const scratch = cloneState(state);
        const getter = (e: number, d: number): CellInput => ({
          status: STATUS[scratch.st[e][d]], manualShift: scratch.manual[e][d], locked: scratch.locked[e][d],
        });
        const chosen: Pattern[] = new Array(n);

        const evaluate = (): number => {
          for (let e = 0; e < n; e++) for (let k = 0; k < 7; k++) scratch.st[e][w * 7 + k] = chosen[e].statuses[k];
          const res = resolveDept(ctx, getter, scratch.res, w * 7, w * 7 + 6);
          const alerts: Alert[] = [];
          for (let d = w * 7; d < w * 7 + 7; d++) dayAlerts(res, d, alerts);
          restAlerts(res, w * 7, w * 7 + 6, alerts);
          weekAlerts(res, w, alerts);
          const consecutive: Alert[] = [];
          multiWeekAlerts(res, w * 7 + 6, consecutive, false);
          const weekStart = ctx.dates[w * 7];
          for (const a of consecutive) if ((a.date ?? '') >= weekStart) alerts.push(a);

          let hard = 0;
          let soft = 0;
          for (const a of alerts) {
            if (a.severity === 'critico') hard++;
            else if (a.severity === 'atencao') soft += ATTENTION_WEIGHT[a.code] ?? 5;
          }
          const weekendDays = state.weekendDays.slice();
          const weekendRun = state.weekendRun.slice();
          const sundayRun = state.sundayRun.slice();
          const holidaysWorked = state.holidaysWorked.slice();
          let sqBefore = 0;
          let sqAfter = 0;
          for (let e = 0; e < n; e++) {
            const p = chosen[e];
            if (p.holidaysWorked) {
              soft += 12 * ((holidaysWorked[e] + p.holidaysWorked) ** 2 - holidaysWorked[e] ** 2);
              holidaysWorked[e] += p.holidaysWorked;
            }
            const wk = (p.statuses[5] === T ? 1 : 0) + (p.statuses[6] === T ? 1 : 0);
            sqBefore += weekendDays[e] ** 2;
            weekendDays[e] += wk;
            sqAfter += weekendDays[e] ** 2;
            weekendRun[e] = wk ? weekendRun[e] + 1 : 0;
            const weekendOnly = outside5x2(ctx.employees[e]);
            if (wk && weekendRun[e] > 1 && !weekendOnly) soft += 4;
            if (weekendRun[e] > labor.maxConsecutiveWeekends && !weekendOnly) soft += 20;
            sundayRun[e] = p.statuses[6] === T ? sundayRun[e] + 1 : 0;
            if (labor.sundayOffWithinWeeks > 0 && sundayRun[e] >= labor.sundayOffWithinWeeks && !weekendOnly) soft += 30;
            const deficit = Math.max(0, plannedWeekMinutes(res, e, w) - weekTotals(res, e, w).minutes) / 60;
            soft += deficit * deficit * 0.5;
            if (p.extra) soft += 40;
            if (ctx.config.labor.holidayCountsAsRest !== false && !holRest) soft += 4 * p.statuses.filter((x, k) => x === FE && isWeekdayHol(ctx, w * 7 + k)).length;
            const prefs = ctx.employees[e].preferredOffWeekdays;
            if (prefs.length) for (const k of p.offDays) if (!prefs.includes(ctx.weekdays[w * 7 + k])) soft += 2;
            if (p.offDays.length === 2 && p.offDays[1] - p.offDays[0] !== 1) soft += 1;
          }
          soft += (sqAfter - sqBefore) * 3;
          if (opts.reference && opts.reference.weeks.length) {
            const refWeeks = opts.reference.weeks;
            const refWeek = refWeeks[w === 0 ? refWeeks.length - 1 : (w - 1) % refWeeks.length];
            for (let e = 0; e < n; e++) {
              const ref = opts.reference.cells[ctx.employees[e].id];
              if (!ref) continue;
              for (let k = 0; k < 7; k++) {
                const rs = ref[refWeek[k]]?.status;
                const mine = chosen[e].statuses[k];
                if ((rs === 'T' || rs === 'F') && (mine === T || mine === F) && (rs === 'T') !== (mine === T)) soft += REPEAT_WEIGHT;
              }
            }
          }
          for (let k = 0; k < 5; k++) {
            const c = chosen.reduce((acc, p) => acc + (p.statuses[k] === F ? 1 : 0), 0);
            soft += c * (c - 1) * 3;
          }
          soft += rand() * 0.5;
          const cost = state.cost + hard * HARD + soft;
          if (next.length >= width && cost >= next[next.length - 1].cost) return cost;
          const snap = cloneState(scratch);
          snap.cost = cost;
          snap.hard = state.hard + hard;
          snap.weekendDays = weekendDays;
          snap.weekendRun = weekendRun;
          snap.sundayRun = sundayRun;
          snap.holidaysWorked = holidaysWorked;
          next.push(snap);
          next.sort((a, b) => a.cost - b.cost);
          if (next.length > width) next.pop();
          return cost;
        };

        // Limita as folgas adicionais por semana no departamento (mantém a busca tratável).
        const counts = new Array(reqDays.length).fill(0);
        const rec = (e: number, extras: number) => {
          if (e === n) {
            if (!strict || counts.every((c, i) => c === targets[i])) evaluate();
            return;
          }
          for (const p of patterns[e]) {
            if (p.extra && extras >= MAX_EXTRA_PER_WEEK) continue;
            let ok = true;
            for (let i = 0; i < reqDays.length; i++) {
              const c = counts[i] + (p.statuses[reqDays[i]] === T ? 1 : 0);
              if (c > targets[i] || (strict && c + remainingAble[i][e + 1] < targets[i])) { ok = false; break; }
            }
            if (!ok) continue;
            for (let i = 0; i < reqDays.length; i++) if (p.statuses[reqDays[i]] === T) counts[i]++;
            chosen[e] = p;
            rec(e + 1, extras + (p.extra ? 1 : 0));
            for (let i = 0; i < reqDays.length; i++) if (p.statuses[reqDays[i]] === T) counts[i]--;
          }
        };
        // Equipes maiores: em vez de testar todas as combinações, escolhe quem trabalha nos dias com
        // quantidade exata e depois ajusta as folgas dos dias úteis colaborador a colaborador.
        if (n <= FULL_SEARCH_MAX_TEAM) rec(0, 0);
        else {
          const groups = patterns.map((ps) => {
            const m = new Map<string, Pattern[]>();
            for (const p of ps) {
              const key = reqDays.map((k) => (p.statuses[k] === T ? 1 : 0)).join('') + (p.extra ? 'x' : '');
              (m.get(key) ?? m.set(key, []).get(key)!).push(p);
            }
            return [...m.values()];
          });
          const descend = () => {
            const pick = chosen.map((p, e) => groups[e].find((g) => g.includes(p))!);
            for (let pass = 0; pass < 2; pass++)
              for (let e = 0; e < n; e++) {
                let best = chosen[e];
                let bestCost = Infinity;
                for (const p of pick[e]) {
                  chosen[e] = p;
                  const c = evaluate();
                  if (c < bestCost) { bestCost = c; best = p; }
                }
                chosen[e] = best;
              }
          };
          const recGroups = (e: number, extras: number) => {
            if (e === n) {
              if (!strict || counts.every((c, i) => c === targets[i])) starts.push({ pick: chosen.slice(), cost: evaluate() });
              return;
            }
            for (const g of groups[e]) {
              const p = g[0];
              if (p.extra && extras >= MAX_EXTRA_PER_WEEK) continue;
              let ok = true;
              for (let i = 0; i < reqDays.length; i++) {
                const c = counts[i] + (p.statuses[reqDays[i]] === T ? 1 : 0);
                if (c > targets[i] || (strict && c + remainingAble[i][e + 1] < targets[i])) { ok = false; break; }
              }
              if (!ok) continue;
              for (let i = 0; i < reqDays.length; i++) if (p.statuses[reqDays[i]] === T) counts[i]++;
              chosen[e] = p;
              recGroups(e + 1, extras + (p.extra ? 1 : 0));
              for (let i = 0; i < reqDays.length; i++) if (p.statuses[reqDays[i]] === T) counts[i]--;
            }
          };
          const starts: { pick: Pattern[]; cost: number }[] = [];
          recGroups(0, 0);
          starts.sort((x, y) => x.cost - y.cost);
          for (const st of starts.slice(0, DESCENT_STARTS)) {
            st.pick.forEach((p, e) => { chosen[e] = p; });
            descend();
          }
        }
      }
      return next;
    };
    const attempt = (): BeamState[] => {
      let r = run(false);
      const bestHard = r.length ? r[0].hard : Infinity;
      if (ctx.dept.allowExtraOffDays && (bestHard > (beam[0]?.hard ?? 0) || !r.length)) {
        const alt = run(true);
        if (alt.length && (!r.length || alt[0].cost < r[0].cost)) r = alt;
      }
      return r;
    };
    const holidayWeek = [0, 1, 2, 3, 4].some((k) => isWeekdayHol(ctx, w * 7 + k));
    const holRestOn = holRest;
    let next = attempt();
    if (holRestOn && holidayWeek) {
      // Semana de feriado: testa também a regra antiga (feriado além das 2 folgas) e deixa as duas disputarem
      // lugar no feixe; a nova leva uma pequena preferência, mas não quando ela gera conflito obrigatório.
      holRest = false;
      const old = attempt();
      holRest = holRestOn;
      next = [...next, ...old].sort((a, b) => a.cost - b.cost).slice(0, beamWidth);
    } else if (!next.length && holRest) { holRest = false; next = attempt(); }
    if (!next.length) next = run(ctx.dept.allowExtraOffDays, false);
    if (!next.length) break; // não deveria acontecer: sempre há ao menos um padrão
    beam = next;
  }

  const best = beam[0];
  ctx.employees.forEach((emp, e) => {
    const row: Record<string, Cell> = {};
    ctx.dates.forEach((date, d) => {
      const status = STATUS[best.st[e][d]];
      row[date] = best.locked[e][d]
        ? { status, manualShift: best.manual[e][d], locked: true, source: 'anterior' }
        : { status, source: 'auto' };
    });
    grid[emp.id] = row;
  });
  return { grid, importedPrevious };
}

const CONFLICT_SUGGESTIONS: Record<string, string[]> = {
  ABERTURA_DESCOBERTA: [
    'Confirme que há um colaborador de abertura e um intermediário que possa cobri-lo nas folgas.',
    'Ajuste os horários para que a troca respeite o descanso entre jornadas e o limite de simultâneos.',
    'Cadastre mais um colaborador para a abertura.',
  ],
  FECHAMENTO_DESCOBERTO: [
    'Ative a cobertura do fechamento pelo intermediário (regras do departamento), se a operação permitir.',
    'Cadastre mais um colaborador para o fechamento.',
    'Revise a disponibilidade do colaborador de fechamento.',
  ],
  SIMULTANEOS_EXCEDIDO: [
    'Ajuste os horários habituais para reduzir a sobreposição (ex.: dois colaboradores de abertura e dois de fechamento).',
    'Registre uma exceção autorizada para o máximo de simultâneos nos dias necessários.',
    'Permita folga adicional quando necessário (reduz a carga semanal) nas regras do departamento.',
  ],
  FIM_SEMANA_SEM_COBERTURA: [
    'Revise a disponibilidade dos colaboradores aos sábados e domingos.',
    'Revise o horário de sábado/domingo para respeitar o descanso após o fechamento de sexta.',
  ],
  FIM_SEMANA_EXCEDIDO: ['Ajuste a quantidade exigida no fim de semana ou registre uma exceção.'],
  FERIADO_SEM_COBERTURA: [
    'Revise a disponibilidade dos colaboradores no feriado.',
    'Marque o feriado como "academia fechada" se a unidade não abrir.',
  ],
  FERIADO_EXCEDIDO: ['Ajuste a quantidade exigida no feriado ou registre uma exceção.'],
  LIMITE_SEMANAL: [
    'Reduza o horário habitual ou os turnos de sábado, domingo ou feriado (regras do departamento).',
    'Confirme o limite semanal configurado (40h ou 42h) para a unidade.',
  ],
  LIMITE_DIARIO: ['Reduza a jornada diária no cadastro do colaborador ou no turno de fim de semana.'],
  DESCANSO_ENTRE_JORNADAS: ['Ajuste os horários (fechamento seguido de abertura) para garantir o descanso mínimo entre jornadas.'],
  DIAS_CONSECUTIVOS: ['Revise a disponibilidade e as folgas para que ninguém ultrapasse o máximo de dias seguidos.'],
  INTERVALO_INSUFICIENTE: ['Corrija o intervalo no cadastro do colaborador ou no turno de fim de semana.'],
  FOLGA_BLOQUEADA: ['Retire o bloqueio de alguns dias: a semana precisa de dias livres para as 2 folgas de cada colaborador.'],
  PROFESSOR_DESCOBERTO: [
    'Ajuste os horários habituais dos professores para cobrir todo o funcionamento.',
    'Reduza o mínimo de professores presentes nas regras do departamento ou cadastre mais um professor.',
  ],
  TRABALHO_FERIAS: ['Regere a escala para aplicar as férias cadastradas.'],
  INDISPONIVEL: ['Revise as restrições de disponibilidade: a equipe pode não ser suficiente nesses dias.'],
  MODELO_5X2: ['Revise as folgas da semana.'],
  TRABALHO_DIA_FECHADO: ['Revise o horário de funcionamento e os feriados.'],
};

export function conflictsFromAnalysis(analysis: Analysis, config: ScheduleConfig): Conflict[] {
  const conflicts: Conflict[] = [];
  for (const id of DEPT_IDS) {
    if (!deptEnabled(config, id)) continue;
    const dept = config.departments[id];
    const active = dept.employees.filter((e) => e.active);
    if (active.length < minTeamSize(id) || active.length > maxTeamSize(id))
      conflicts.push({
        dept: id, code: 'EQUIPE', dates: [],
        description: `${deptName(id)}: ${active.length} colaborador(es) ativo(s); a escala exige de ${minTeamSize(id)} a ${maxTeamSize(id)}.`,
        suggestions: ['Cadastre ou reative colaboradores no departamento.'],
      });
    if (!isHourlyDept(id) && !active.some((e) => e.kind === 'abertura'))
      conflicts.push({ dept: id, code: 'SEM_ABERTURA', dates: [], description: `${deptName(id)}: nenhum colaborador ativo no turno de abertura.`, suggestions: ['Defina o turno principal de um colaborador como Abertura.'] });
    if (!isHourlyDept(id) && !active.some((e) => e.kind === 'fechamento'))
      conflicts.push({ dept: id, code: 'SEM_FECHAMENTO', dates: [], description: `${deptName(id)}: nenhum colaborador ativo no turno de fechamento.`, suggestions: ['Defina o turno principal de um colaborador como Fechamento.'] });
    const byCode = new Map<string, Alert[]>();
    for (const a of analysis.alerts) {
      if (a.dept !== id || a.severity !== 'critico') continue;
      byCode.set(a.code, [...(byCode.get(a.code) ?? []), a]);
    }
    for (const [code, list] of byCode) {
      const dates = [...new Set(list.map((a) => a.date).filter((d): d is string => !!d))].sort();
      conflicts.push({
        dept: id, code, dates,
        description: `${deptName(id)}: ${list[0].title.toLowerCase()} — ${list.length} ocorrência(s)${dates.length ? ` (${dates.slice(0, 6).map(formatDayMonth).join(', ')}${dates.length > 6 ? '…' : ''})` : ''}.`,
        suggestions: CONFLICT_SUGGESTIONS[code] ?? [list[0].suggestion],
      });
    }
  }
  return conflicts;
}

/**
 * Escala livre: só monta a grade para o gestor editar à mão. Começa com todo mundo trabalhando de segunda a sexta (no turno cadastrado de cada pessoa) e
 * folgando sábado e domingo; nada é redistribuído e nenhuma regra além do limite semanal é conferida.
 */
export function gerarLivre(config: ScheduleConfig): GenerateResult {
  const range = buildRange(config.year, config.month);
  const cells: CellGrid = {};
  for (const id of DEPT_IDS) {
    const ctx = buildDeptContext(config, id, range);
    for (const emp of ctx.employees) {
      const row: Record<string, Cell> = {};
      ctx.dates.forEach((date, d) => { const w = ctx.weekdays[d]; row[date] = { status: w >= 1 && w <= 5 ? 'T' : 'F', source: 'auto' }; });
      cells[emp.id] = row;
    }
  }
  const analysis = analyzeSchedule(config, cells, {});
  const conflicts = conflictsFromAnalysis(analysis, config);
  return { cells, feasible: conflicts.length === 0, conflicts, analysis, importedPrevious: false };
}

export function generateSchedule(config: ScheduleConfig, opts: GenerateOptions = {}): GenerateResult {
  if (config.livre) return gerarLivre(config);
  const range = buildRange(config.year, config.month);
  const cells: CellGrid = {};
  let importedPrevious = false;
  for (const id of DEPT_IDS) {
    const ctx = buildDeptContext(config, id, range);
    if (opts.only && !opts.only.includes(id)) {
      for (const emp of ctx.employees) if (opts.keep?.[emp.id]) cells[emp.id] = opts.keep[emp.id];
      continue;
    }
    const r = generateDept(ctx, opts);
    Object.assign(cells, r.grid);
    importedPrevious ||= r.importedPrevious;
  }
  const analysis = analyzeSchedule(config, cells, { previousImported: importedPrevious });
  const conflicts = conflictsFromAnalysis(analysis, config);
  const result = { cells, feasible: conflicts.length === 0, conflicts, analysis, importedPrevious };
  // Sobrou conflito com a busca padrão: tenta de novo olhando mais combinações por semana
  // (escolhas de uma semana podem "prender" alguém na seguinte). Fica com a melhor das duas.
  // Se ainda sobrar, amplia a busca em etapas (32 e depois 64 combinações por semana) e fica com a melhor.
  if (!result.feasible && opts.beamWidth === undefined) {
    // A regra "feriado conta como folga" não fecha com as demais regras da unidade: antes de ampliar a busca,
    // usa a regra antiga (feriado além das 2 folgas), conferida com as regras de hoje, se ela fechar sem conflitos.
    if (config.labor.holidayCountsAsRest !== false && config.holidays.length) {
      const antiga = generateSchedule({ ...config, labor: { ...config.labor, holidayCountsAsRest: false } }, opts);
      if (antiga.feasible) {
        const analysis = analyzeSchedule(config, antiga.cells, { previousImported: antiga.importedPrevious });
        const conflicts = conflictsFromAnalysis(analysis, config);
        return { ...antiga, analysis, conflicts, feasible: conflicts.length === 0 };
      }
    }
    let melhor = result;
    for (const largura of WIDE_BEAMS) {
      if (melhor.feasible) break;
      const outra = generateSchedule(config, { ...opts, beamWidth: largura });
      if (outra.analysis.counts.critico < melhor.analysis.counts.critico) melhor = outra;
    }
    return melhor;
  }
  return result;
}

/** Buscas mais amplas, usadas só quando a padrão não encontra escala sem conflitos. */
const WIDE_BEAMS = [32, 64];

/** Peso de cada dia diferente do mês anterior ao repetir o padrão (mais que o equilíbrio, menos que uma regra obrigatória). */
const REPEAT_WEIGHT = 7;
