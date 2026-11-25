// Cadastro da unidade, guardado uma vez e lido por todas as escalas:
// - por equipe (administrativa / técnica): as pessoas de cada departamento e as regras do departamento
//   (sábado, domingo, feriado, turnos de fim de semana, cobertura, simultâneos);
// - por unidade: o horário de funcionamento (e de feriado) e as regras de jornada da rede.
// - por unidade também: os feriados estaduais e municipais (entram sozinhos em cada escala).
// O que é só do mês fica na escala: feriados nacionais e avulsos, dias sem folga, compensação de feriado, datas indisponíveis
// e os "ajustes só deste mês" (overrides).
import {
  DEPARTMENTS, DEPT_IDS, isHourlyDept, teamDepts, type DayHours, type DeptConfig, type DeptId, type Employee, type Headcount, type LaborParams, type LocalHoliday, type ScheduleConfig, type Team,
} from './types';
import { buildRange } from './calendar';
import { DAILY_NORMAL_HOURS } from './defaults';
import { mergeLocalHolidays } from './holidays';

/** Regras do departamento (tudo do departamento menos as pessoas e a inclusão na escala do mês). */
export type DeptRules = Omit<DeptConfig, 'id' | 'enabled' | 'headcount' | 'employees' | 'maxSimultaneous'>;

export interface RosterDept {
  headcount: Headcount;
  employees: Employee[];
  rules?: DeptRules;
}

export interface UnitRoster {
  departments: Partial<Record<DeptId, RosterDept>>;
}

/** Regras de jornada da rede: tudo da jornada menos o que é do gestor no mês. */
/** Limite semanal da rede (fixo). */
export const WEEKLY_LIMIT_HOURS = 42;

/** Regras de jornada da rede: tudo menos o que é do gestor no mês (compensação de feriado, vigência e a confirmação de validação). */
export type UnitLabor = Omit<LaborParams, 'holidayWorkCompensation' | 'holidayCountsAsRest' | 'effectiveFrom' | 'validatedByLegal'>;

export interface UnitSettings {
  operatingHours: DayHours[];
  holidayHours: { start: string; end: string };
  /** Ausente: a unidade ainda não tem regras de jornada definidas pela rede. */
  labor?: UnitLabor | null;
  /** Feriados estaduais e municipais da unidade. */
  localHolidays?: LocalHoliday[];
}

/** JSON com as chaves em ordem (o banco não guarda a ordem das chaves). */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object')
    return `{${Object.keys(v).filter((k) => (v as Record<string, unknown>)[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
const igualJson = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);

const semDatasDoMes = (e: Employee): Employee => ({ ...structuredClone(e), unavailableDates: [] });

/** Cadastros antigos ainda guardam o máximo simultâneo: ele é ignorado. */
const semMax = (r: DeptRules & { maxSimultaneous?: number }): DeptRules => { const { maxSimultaneous: _m, ...x } = r; return x; };

export function deptRules(d: DeptConfig): DeptRules {
  const { id: _id, enabled: _en, headcount: _hc, employees: _emps, maxSimultaneous: _max, ...rules } = structuredClone(d);
  return rules;
}

function laborDaRede(l: LaborParams): UnitLabor {
  const { holidayWorkCompensation: _h, holidayCountsAsRest: _c, effectiveFrom: _e, validatedByLegal: _v, ...rest } = structuredClone(l);
  return rest;
}

/** Cadastro a partir de uma escala (só os departamentos da equipe da escala). */
export function rosterFromConfig(config: ScheduleConfig): UnitRoster {
  const departments: UnitRoster['departments'] = {};
  for (const id of teamDepts(config)) {
    const d = config.departments[id];
    departments[id] = { headcount: d.headcount, employees: d.employees.map(semDatasDoMes), rules: deptRules(d) };
  }
  return { departments };
}

export function settingsFromConfig(config: ScheduleConfig, withLabor = true): UnitSettings {
  return {
    operatingHours: structuredClone(config.operatingHours),
    holidayHours: { ...config.holidayHours },
    localHolidays: structuredClone(config.localHolidays ?? []),
    ...(withLabor ? { labor: laborDaRede(config.labor) } : {}),
  };
}

/** Coloca o cadastro na escala: pessoas sempre; regras do departamento só sem ajuste do mês. */
export function applyRoster(config: ScheduleConfig, roster: UnitRoster): ScheduleConfig {
  const c = structuredClone(config);
  for (const id of teamDepts(c)) {
    const r = roster.departments[id];
    if (!r) continue;
    const antes = new Map(c.departments[id].employees.map((e) => [e.id, e]));
    if (r.rules && !c.overrides?.deptRules) Object.assign(c.departments[id], semMax(structuredClone(r.rules)));
    c.departments[id].headcount = r.headcount;
    c.departments[id].employees = r.employees.map((e) => ({ ...structuredClone(e), unavailableDates: antes.get(e.id)?.unavailableDates ?? [] }));
  }
  return c;
}

/** Coloca o funcionamento e as regras de jornada da unidade na escala (o horário só sem ajuste do mês). */
export function applySettings(config: ScheduleConfig, s: UnitSettings): ScheduleConfig {
  const c = structuredClone(config);
  if (!c.overrides?.hours) {
    c.operatingHours = structuredClone(s.operatingHours);
    c.holidayHours = { ...s.holidayHours };
  }
  if (s.labor) {
    const { validatedByLegal: _v, ...regras } = structuredClone(s.labor) as UnitLabor & { validatedByLegal?: boolean };
    c.labor = { ...c.labor, ...regras };
  }
  c.localHolidays = structuredClone(s.localHolidays ?? []);
  c.holidays = mergeLocalHolidays(c.holidays, c.localHolidays, buildRange(c.year, c.month).dates);
  return c;
}

export interface RosterDiff {
  added: string[];
  removed: string[];
  changed: string[];
  /** Outras diferenças: horário de funcionamento, regras de jornada, regras de um departamento. */
  other: string[];
}

const nome = (e: Employee) => e.name.trim() || 'sem nome';
const deptNome = (id: DeptId) => DEPARTMENTS.find((x) => x.id === id)?.name ?? id;

/** Diferenças entre a escala e o cadastro da unidade; null quando são iguais. */
export function rosterDiff(config: ScheduleConfig, roster: UnitRoster | null, settings?: UnitSettings | null): RosterDiff | null {
  const diff: RosterDiff = { added: [], removed: [], changed: [], other: [] };
  for (const id of roster ? teamDepts(config) : []) {
    const r = roster!.departments[id];
    if (!r) continue;
    const daEscala = config.departments[id].employees;
    const doCadastro = new Map(r.employees.map((e) => [e.id, e]));
    for (const e of daEscala) {
      const c = doCadastro.get(e.id);
      if (!c) diff.removed.push(nome(e));
      else if (!igualJson(semDatasDoMes(e), semDatasDoMes(c))) diff.changed.push(nome(c));
    }
    const ids = new Set(daEscala.map((e) => e.id));
    for (const e of r.employees) if (!ids.has(e.id)) diff.added.push(nome(e));
    const pessoas = diff.added.length + diff.removed.length + diff.changed.length;
    if (!pessoas && daEscala.map((e) => e.id).join() !== r.employees.map((e) => e.id).join()) diff.other.push(`ordem de ${deptNome(id)}`);
    if (!pessoas && r.headcount !== config.departments[id].headcount) diff.other.push(`quantidade de pessoas em ${deptNome(id)}`);
    if (r.rules && !config.overrides?.deptRules && !igualJson(semMax(r.rules), deptRules(config.departments[id]))) diff.other.push(`regras de ${deptNome(id)}`);
  }
  if (settings) {
    if (!config.overrides?.hours && (!igualJson(settings.operatingHours, config.operatingHours) || !igualJson(settings.holidayHours, config.holidayHours)))
      diff.other.push('horário de funcionamento');
    if (settings.labor) {
      const { validatedByLegal: _v, ...regras } = settings.labor as UnitLabor & { validatedByLegal?: boolean };
      if (!igualJson(regras, laborDaRede(config.labor))) diff.other.push('regras de jornada');
    }
    const locais = settings.localHolidays ?? [];
    if (!igualJson(locais, config.localHolidays ?? []) || !igualJson(mergeLocalHolidays(config.holidays, locais, buildRange(config.year, config.month).dates), config.holidays))
      diff.other.push('feriados estaduais e municipais');
  }
  return diff.added.length || diff.removed.length || diff.changed.length || diff.other.length ? diff : null;
}

/** Frase curta com as diferenças ("Ana entrou; Bruno saiu; mudanças em Carla; horário de funcionamento"). */
export function describeDiff(d: RosterDiff): string {
  const lista = (xs: string[]) => (xs.length <= 3 ? xs.join(', ') : `${xs.slice(0, 3).join(', ')} e mais ${xs.length - 3}`);
  const partes: string[] = [];
  if (d.added.length) partes.push(`${lista(d.added)} ${d.added.length === 1 ? 'entrou' : 'entraram'}`);
  if (d.removed.length) partes.push(`${lista(d.removed)} ${d.removed.length === 1 ? 'saiu' : 'saíram'}`);
  if (d.changed.length) partes.push(`mudanças em ${lista(d.changed)}`);
  if (d.other.length) partes.push(`mudou: ${d.other.join(', ')}`);
  return partes.join('; ');
}

/**
 * Quem entra na escala, sem opção manual: na escala de uma equipe, Recepção e Serviços Gerais sempre entram;
 * Professores e Estagiários entram quando têm ao menos uma pessoa com nome (a unidade sem estagiários
 * simplesmente não os cadastra). Em escalas antigas, sem equipe, vale "tem alguém com nome".
 * Muda a configuração recebida; devolve true se algo mudou.
 */
export function autoIncludeDepts(c: ScheduleConfig): boolean {
  let mudou = false;
  for (const id of teamDepts(c)) {
    const d = c.departments[id];
    const temNome = d.employees.some((e) => e.name.trim().length >= 2);
    const entra = c.team && !isHourlyDept(id) ? true : temNome;
    if ((d.enabled !== false) !== entra) {
      d.enabled = entra;
      mudou = true;
    }
  }
  return mudou;
}

/**
 * Regras automáticas do cadastro: quem entra na escala (autoIncludeDepts) e sem limite de pessoas ao mesmo
 * tempo (o "máximo simultâneo" saiu do sistema: vale o tamanho da equipe). Devolve true se algo mudou.
 */
export function normalizeUnitRules(c: ScheduleConfig): boolean {
  let mudou = autoIncludeDepts(c);
  // Limite semanal fixo da rede.
  if (c.labor.weeklyLimitHours !== WEEKLY_LIMIT_HOURS) {
    c.labor.weeklyLimitHours = WEEKLY_LIMIT_HOURS;
    mudou = true;
  }
  // Jornada diária fixa da rede: 8h24min (42h em 5 dias).
  if (c.labor.dailyNormalHours !== DAILY_NORMAL_HOURS) {
    c.labor.dailyNormalHours = DAILY_NORMAL_HOURS;
    mudou = true;
  }
  for (const id of DEPT_IDS) {
    const d = c.departments[id];
    const semLimite = Math.max(1, d.employees.length);
    if (d.maxSimultaneous !== semLimite) {
      d.maxSimultaneous = semLimite;
      mudou = true;
    }
  }
  return mudou;
}

const TEAMS_IDS: Team[] = ['administrativa', 'tecnica'];

/** Configuração da unidade inteira (os quatro departamentos) a partir dos cadastros das duas equipes. */
export function unitConfig(base: ScheduleConfig, rosters: Partial<Record<Team, UnitRoster | null>>, settings?: UnitSettings | null): ScheduleConfig {
  let c = structuredClone(base);
  delete c.overrides;
  for (const t of TEAMS_IDS) {
    const r = rosters[t];
    if (r) c = applyRoster({ ...c, team: t }, r);
  }
  delete c.team;
  if (settings) c = applySettings(c, settings);
  return c;
}

/** Separa a configuração da unidade inteira nos cadastros de cada equipe. */
export function rostersFromUnitConfig(c: ScheduleConfig): Record<Team, UnitRoster> {
  return {
    administrativa: rosterFromConfig({ ...c, team: 'administrativa' }),
    tecnica: rosterFromConfig({ ...c, team: 'tecnica' }),
  };
}
