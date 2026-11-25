// Operações sobre uma escala (imutáveis): criação, geração, edição manual, confirmação.
import { analyzeSchedule, type Analysis } from './analyze';
import { buildRange, formatDayMonth, weekdayOf } from './calendar';
import { defaultHolidays, mergeLocalHolidays } from './holidays';
import { defaultScheduleConfig, newId } from './defaults';
import { conflictsFromAnalysis, generateSchedule, type GenerateResult } from './generator';
import { formatShiftShort } from './time';
import type { Cell, CellGrid, Schedule, ScheduleConfig, Shift, StaffException, Team } from './types';
import { DEPT_IDS } from './types';

const now = () => new Date().toISOString();

export function createSchedule(
  year: number,
  month: number,
  template?: ScheduleConfig | null,
  unitId?: string,
  team?: Team,
): Schedule {
  let config = defaultScheduleConfig(year, month);
  if (template) {
    // Reaproveita equipe e parâmetros da escala anterior da mesma unidade.
    const range = buildRange(year, month);
    const t = structuredClone(template);
    config = {
      ...t,
      year,
      month,
      labor: { ...t.labor, effectiveFrom: t.labor.effectiveFrom > range.monthDates[0] ? range.monthDates[0] : t.labor.effectiveFrom },
      // Mesmo mês: mantém os feriados revisados; outro mês: feriados nacionais do novo período.
      holidays: t.year === year && t.month === month ? t.holidays : mergeLocalHolidays(defaultHolidays(range.dates), t.localHolidays ?? [], range.dates),
      exceptions: [],
    };
    // "Ajustes só deste mês" não passam para outra escala; escala livre também não (cada uma escolhe se é livre).
    delete config.overrides;
    delete config.livre;
    // Escala anterior sem Professores: o departamento entra com a equipe padrão para cadastrar.
    const fresh = defaultScheduleConfig(year, month).departments;
    config.departments = { ...config.departments, professores: config.departments.professores ?? fresh.professores, estagiarios: config.departments.estagiarios ?? fresh.estagiarios };
    for (const id of DEPT_IDS)
      for (const e of config.departments[id].employees) e.unavailableDates = e.unavailableDates.filter((d) => range.dates.includes(d));
    // Modelo de outra equipe: os dias sem folga são regra de cada escala e não vêm junto.
    if (team && t.team !== team) config.noOffWeekdays = [];
  }
  if (team) {
    config.team = team;
    // A escala técnica começa com os professores incluídos.
    if (team === 'tecnica' && config.departments.professores.enabled === false && config.departments.estagiarios.enabled === false)
      config.departments.professores.enabled = true;
  }
  const ts = now();
  return {
    id: newId('esc'),
    ...(unitId ? { unitId } : {}),
    year,
    month,
    config,
    cells: null,
    status: 'rascunho',
    generation: null,
    changeLog: [],
    createdAt: ts,
    updatedAt: ts,
    confirmedAt: null,
    version: 1,
  };
}

/**
 * Atualiza rascunhos salvos por versões anteriores do gerador para o formato atual.
 * Campos ausentes recebem os valores padrão; regras fixas são reaplicadas.
 */
export function normalizeSchedule(schedule: Schedule): Schedule {
  const s = structuredClone(schedule) as Schedule & { unitCode?: string; unitName?: string };
  // Versões antigas usavam um cadastro próprio de unidades (ids 'uni_...'), que não existe mais.
  if (s.unitId?.startsWith('uni_')) delete s.unitId;
  const defaults = defaultScheduleConfig(s.year, s.month);
  const c = s.config as ScheduleConfig & Record<string, unknown>;
  c.holidayHours ??= defaults.holidayHours;
  // Limite semanal fixo da rede (42h) e máximo de dias seguidos do padrão.
  // Escalas já geradas antes da regra "feriado conta como folga" continuam como estavam.
  const antes = c.labor as { holidayCountsAsRest?: boolean } | undefined;
  if (s.cells && antes && antes.holidayCountsAsRest === undefined) antes.holidayCountsAsRest = false;
  c.labor = { ...defaults.labor, ...c.labor, maxConsecutiveWorkDays: defaults.labor.maxConsecutiveWorkDays, weeklyLimitHours: defaults.labor.weeklyLimitHours };
  // Escalas anteriores aos Professores: o departamento entra desligado (a unidade liga na etapa Departamentos).
  if (!c.departments.professores) c.departments.professores = { ...defaults.departments.professores, enabled: false };
  if (!c.departments.estagiarios) c.departments.estagiarios = defaults.departments.estagiarios;
  for (const id of DEPT_IDS) {
    const d = c.departments[id] as typeof c.departments.recepcao & { coverOpeningWithIntermediate?: boolean; coverClosingWithIntermediate?: boolean };
    const def = defaults.departments[id];
    d.holidayRequired ??= def.holidayRequired;
    if (d.saturdayRequired >= 2 && !d.saturdayShift2) d.saturdayShift2 = { ...d.saturdayShift };
    d.holidayShift ??= def.holidayShift;
    if (!d.openingCoverKinds) d.openingCoverKinds = d.coverOpeningWithIntermediate === false ? [] : ['intermediario'];
    if (!d.closingCoverKinds) d.closingCoverKinds = d.coverClosingWithIntermediate ? ['intermediario'] : [];
    // Intermediário passou a ser manhã e noite: a regra antiga vale para os dois.
    if (d.openingCoverKinds.includes('intermediario') && !d.openingCoverKinds.includes('intermediario_noite')) d.openingCoverKinds.push('intermediario_noite');
    if (d.closingCoverKinds.includes('intermediario') && !d.closingCoverKinds.includes('intermediario_noite')) d.closingCoverKinds.unshift('intermediario_noite');
    delete d.coverOpeningWithIntermediate;
    delete d.coverClosingWithIntermediate;
  }
  c.holidays = c.holidays.map((h) => ({ ...h, source: h.source ?? 'manual' }));
  delete s.unitCode;
  delete s.unitName;
  return s;
}

export function updateConfig(schedule: Schedule, config: ScheduleConfig): Schedule {
  return { ...schedule, config, status: 'rascunho', confirmedAt: null, updatedAt: now() };
}


/** Exceções são registradas depois da geração e não exigem regerar. */
export function configSignature(config: ScheduleConfig): string {
  return JSON.stringify({ ...config, exceptions: [] });
}

/** `keepLog`: geração parcial (só alguns departamentos) mantém o histórico de ajustes dos demais. */
export function applyGeneration(schedule: Schedule, result: Pick<GenerateResult, 'cells' | 'feasible' | 'conflicts'>, seed: number, keepLog = false): Schedule {
  return {
    ...schedule,
    cells: result.cells,
    status: 'rascunho',
    confirmedAt: null,
    generation: { at: now(), seed, feasible: result.feasible, conflicts: result.conflicts, configSignature: configSignature(schedule.config) },
    changeLog: keepLog ? schedule.changeLog : [],
    updatedAt: now(),
    version: schedule.version + 1,
  };
}

export function runGeneration(schedule: Schedule, seed: number, previous?: CellGrid | null): Schedule {
  const r = generateSchedule(schedule.config, { seed, previous });
  return applyGeneration(schedule, r, seed);
}

export function analyze(schedule: Schedule): Analysis | null {
  if (!schedule.cells) return null;
  const previousImported = Object.values(schedule.cells).some((row) => Object.values(row).some((c) => c.locked));
  return analyzeSchedule(schedule.config, schedule.cells, { changeLog: schedule.changeLog, previousImported });
}

export function employeeLabel(schedule: Schedule, empId: string): string {
  for (const id of DEPT_IDS) {
    const e = schedule.config.departments[id].employees.find((x) => x.id === empId);
    if (e) return e.name || 'colaborador';
  }
  return 'colaborador';
}

export interface CellPatch {
  status?: 'T' | 'F';
  manualShift?: Shift | null;
}

/** Alteração manual de um dia. Recalcula tudo a partir das células e registra no histórico. */
export function setCell(schedule: Schedule, empId: string, date: string, patch: CellPatch): Schedule {
  if (!schedule.cells) throw new Error('Gere a escala antes de editar.');
  const current: Cell = schedule.cells[empId]?.[date] ?? { status: 'F' };
  if (current.locked) throw new Error('Este dia pertence à escala do mês anterior e não pode ser alterado aqui.');
  const holiday = schedule.config.holidays.find((h) => h.date === date);
  if (holiday?.closed) throw new Error('Feriado com a academia fechada: altere o feriado na aba Mês.');
  const w = weekdayOf(date);
  const weekdayHoliday = !!holiday && w !== 0 && w !== 6;
  const next: Cell = { ...current, source: 'manual' };
  // Folga em feriado de dia útil é folga de feriado (não conta entre as 2 folgas da semana).
  if (patch.status) next.status = patch.status === 'F' && weekdayHoliday ? 'FE' : patch.status;
  if ('manualShift' in patch) next.manualShift = patch.manualShift ?? null;
  if (next.status !== 'T') next.manualShift = null;
  const parts: string[] = [];
  if (patch.status && patch.status !== current.status) parts.push(patch.status === 'T' ? 'marcado como Trabalha' : 'marcado como Folga');
  if ('manualShift' in patch) parts.push(patch.manualShift ? `horário ajustado para ${formatShiftShort(patch.manualShift)}` : 'horário restaurado ao automático');
  const description = `${employeeLabel(schedule, empId)} em ${formatDayMonth(date)}: ${parts.join(', ') || 'sem mudança'}.`;
  const cells: CellGrid = { ...schedule.cells, [empId]: { ...schedule.cells[empId], [date]: next } };
  return {
    ...schedule,
    cells,
    status: 'rascunho',
    confirmedAt: null,
    changeLog: [...schedule.changeLog, { at: now(), description }],
    updatedAt: now(),
  };
}

/**
 * Troca de folga entre dois colegas do mesmo departamento: a Pessoa 1 folgava em `dia1` e trabalhava em
 * `dia2`; a Pessoa 2, o contrário. Depois da troca, a Pessoa 1 trabalha em `dia1` e folga em `dia2`, e a
 * Pessoa 2 folga em `dia1` e trabalha em `dia2`. Quem confere 5x2, descanso e cobertura é a análise.
 */
export function swapOffDays(schedule: Schedule, emp1: string, dia1: string, emp2: string, dia2: string): Schedule {
  if (!schedule.cells) throw new Error('Gere a escala antes de trocar folgas.');
  const st = (e: string, d: string) => schedule.cells![e]?.[d]?.status ?? 'F';
  if (emp1 === emp2) throw new Error('Escolha duas pessoas diferentes.');
  if (dia1 === dia2) throw new Error('Escolha dois dias diferentes.');
  if (st(emp1, dia1) !== 'F' || st(emp1, dia2) !== 'T') throw new Error(`${employeeLabel(schedule, emp1)} precisa folgar em ${formatDayMonth(dia1)} e trabalhar em ${formatDayMonth(dia2)}.`);
  if (st(emp2, dia2) !== 'F' || st(emp2, dia1) !== 'T') throw new Error(`${employeeLabel(schedule, emp2)} precisa folgar em ${formatDayMonth(dia2)} e trabalhar em ${formatDayMonth(dia1)}.`);
  let s = setCell(schedule, emp1, dia1, { status: 'T', manualShift: null });
  s = setCell(s, emp1, dia2, { status: 'F' });
  s = setCell(s, emp2, dia2, { status: 'T', manualShift: null });
  s = setCell(s, emp2, dia1, { status: 'F' });
  const description = `Troca de folga: ${employeeLabel(schedule, emp1)} folga em ${formatDayMonth(dia2)} (em vez de ${formatDayMonth(dia1)}) e ${employeeLabel(schedule, emp2)} folga em ${formatDayMonth(dia1)} (em vez de ${formatDayMonth(dia2)}).`;
  return { ...s, changeLog: [...schedule.changeLog, { at: now(), description }] };
}

export function addException(schedule: Schedule, ex: Omit<StaffException, 'id' | 'authorizedAt'>): Schedule {
  const exceptions = schedule.config.exceptions.filter((x) => !(x.date === ex.date && x.dept === ex.dept && x.kind === ex.kind));
  const full: StaffException = { ...ex, id: newId('exc'), authorizedAt: now() };
  return {
    ...schedule,
    config: { ...schedule.config, exceptions: [...exceptions, full] },
    status: 'rascunho',
    confirmedAt: null,
    changeLog: [...schedule.changeLog, { at: now(), description: `Exceção autorizada em ${formatDayMonth(ex.date)}: ${ex.kind === 'weekendStaff' ? 'equipe no fim de semana' : 'máximo de simultâneos'} = ${ex.value}. Motivo: ${ex.reason}` }],
    updatedAt: now(),
  };
}

export function removeException(schedule: Schedule, id: string): Schedule {
  const ex = schedule.config.exceptions.find((x) => x.id === id);
  return {
    ...schedule,
    config: { ...schedule.config, exceptions: schedule.config.exceptions.filter((x) => x.id !== id) },
    status: 'rascunho',
    confirmedAt: null,
    changeLog: ex ? [...schedule.changeLog, { at: now(), description: `Exceção de ${formatDayMonth(ex.date)} removida.` }] : schedule.changeLog,
    updatedAt: now(),
  };
}

export class ConfirmationBlockedError extends Error {}

/** Confirma a versão final. Bloqueado enquanto houver conflitos obrigatórios (alertas críticos). */
export function confirmSchedule(schedule: Schedule): Schedule {
  const a = analyze(schedule);
  if (!a) throw new ConfirmationBlockedError('Gere a escala antes de confirmar.');
  if (!a.valid)
    throw new ConfirmationBlockedError(`A escala possui ${a.counts.critico} conflito(s) obrigatório(s) pendente(s) e não pode ser confirmada.`);
  const ts = now();
  return { ...schedule, status: 'confirmada', confirmedAt: ts, updatedAt: ts, version: schedule.version + 1 };
}

export function currentConflicts(schedule: Schedule) {
  const a = analyze(schedule);
  return a ? conflictsFromAnalysis(a, schedule.config) : [];
}
