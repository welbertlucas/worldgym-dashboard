// Tipos centrais do domínio. Nenhuma dependência de interface aqui.

export type DeptId = 'recepcao' | 'apoio' | 'professores' | 'estagiarios';

/** Departamentos fixos: não podem ser renomeados nem excluídos. */
export const DEPARTMENTS: ReadonlyArray<{ readonly id: DeptId; readonly name: string }> = Object.freeze([
  Object.freeze({ id: 'recepcao' as const, name: 'Recepção' }),
  Object.freeze({ id: 'apoio' as const, name: 'Serviços Gerais' }),
  Object.freeze({ id: 'professores' as const, name: 'Professores' }),
  Object.freeze({ id: 'estagiarios' as const, name: 'Estagiários' }),
]);

export const DEPT_IDS: readonly DeptId[] = ['recepcao', 'apoio', 'professores', 'estagiarios'];

/**
 * Professores e estagiários seguem o 5x2 com horário próprio (um bloco por dia): a cobertura é por
 * mínimo de pessoas presentes (sem troca de turno) e não há carga planejada.
 */
export function isHourlyDept(id: DeptId): boolean {
  return id === 'professores' || id === 'estagiarios';
}

/** Limites da Lei do Estágio (11.788/2008): até 6h por dia e 30h por semana. Null = regra geral. */
export function deptHourLimits(id: DeptId): { daily: number; weekly: number } | null {
  return id === 'estagiarios' ? { daily: 6, weekly: 30 } : null;
}

/** Professores horistas: horas só exibidas, sem limite semanal. */
export function hoursOnlyShown(id: DeptId): boolean {
  return id === 'professores';
}

/** Rótulo de uma pessoa do departamento, no singular. */
export function memberLabel(id: DeptId): string {
  return id === 'professores' ? 'Professor' : id === 'estagiarios' ? 'Estagiário' : 'Colaborador';
}

/** Tamanho mínimo e máximo da equipe de cada departamento. */
export function minTeamSize(id: DeptId): number {
  return id === 'estagiarios' ? 1 : 3;
}
export function maxTeamSize(id: DeptId): number {
  return id === 'professores' ? 12 : id === 'estagiarios' ? 10 : 5;
}

/** Equipes com escalas separadas em cada unidade. */
export type Team = 'administrativa' | 'tecnica';
export const TEAMS: ReadonlyArray<{ id: Team; name: string; depts: DeptId[] }> = [
  { id: 'administrativa', name: 'Coordenação Administrativa', depts: ['recepcao', 'apoio'] },
  { id: 'tecnica', name: 'Coordenação Técnica', depts: ['professores', 'estagiarios'] },
];
export function teamName(team: Team | undefined): string {
  return team ? TEAMS.find((t) => t.id === team)!.name : 'Todas as equipes';
}
/** Departamentos da escala: os da equipe (escalas antigas, sem equipe, mostram todos). */
export function teamDepts(config: { team?: Team }): DeptId[] {
  return config.team ? TEAMS.find((t) => t.id === config.team)!.depts : [...DEPT_IDS];
}

/** Departamento incluído na escala: pertence à equipe e não foi desligado pela unidade. */
export function deptEnabled(config: { team?: Team; departments: Record<DeptId, { enabled?: boolean }> }, id: DeptId): boolean {
  return teamDepts(config).includes(id) && config.departments[id]?.enabled !== false;
}

export function deptName(id: DeptId): string {
  return DEPARTMENTS.find((d) => d.id === id)!.name;
}

export type ShiftKind = 'abertura' | 'intermediario' | 'intermediario_noite' | 'fechamento';

export const SHIFT_KIND_LABEL: Record<ShiftKind, string> = {
  abertura: 'Abertura',
  intermediario: 'Intermediário manhã',
  intermediario_noite: 'Intermediário noite',
  fechamento: 'Fechamento',
};

/** Fora do 5x2: só fim de semana e feriado, ou dias fixos. */
export function outside5x2(emp: { weekendOnly?: boolean; fixedDays?: Weekday[] }): boolean {
  return !!emp.weekendOnly || !!emp.fixedDays?.length;
}

/** Dia da semana em que a pessoa não trabalha por causa do regime (aparece como "—"). */
export function offByRegime(emp: { weekendOnly?: boolean; fixedDays?: Weekday[] }, weekday: Weekday): boolean {
  if (emp.fixedDays?.length) return !emp.fixedDays.includes(weekday);
  return !!emp.weekendOnly && weekday !== 0 && weekday !== 6;
}

/** Intermediário manhã ou noite. */
export function isIntermediate(kind: ShiftKind): boolean {
  return kind === 'intermediario' || kind === 'intermediario_noite';
}

/** 0 = domingo ... 6 = sábado (igual a Date.getUTCDay). */
/** Recepção e Serviços Gerais: 3 a 5. Professores: 3 a 12. */
export type Headcount = number;
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Horários no formato HH:MM. Saída menor ou igual à entrada = atravessa a meia-noite. */
export interface Shift {
  start: string;
  end: string;
  breakStart: string | null;
  breakEnd: string | null;
}

export interface DayHours {
  open: boolean;
  start: string;
  end: string;
}

export interface Employee {
  id: string;
  name: string;
  dept: DeptId;
  kind: ShiftKind;
  shift: Shift;
  weeklyPlannedHours: number;
  weeklyContractedHours: number;
  availableWeekdays: Weekday[];
  preferredOffWeekdays: Weekday[];
  /** Datas ISO (AAAA-MM-DD) em que o colaborador não pode trabalhar. */
  unavailableDates: string[];
  /**
   * Quem cobre as folgas deste colaborador (abertura/fechamento), por ordem de preferência (ids de
   * colegas do mesmo departamento). Vazio = regra automática do departamento.
   */
  coveredBy?: string[];
  /**
   * Trabalha só sábado, domingo e feriado (fora do 5x2): usa os turnos de fim de semana e feriado do
   * departamento e não é escalado nos dias úteis.
   */
  weekendOnly?: boolean;
  /**
   * Dias fixos (fora do 5x2): trabalha exatamente nesses dias da semana, no horário habitual
   * (sábado/domingo usam os turnos de fim de semana). Ex.: professora seg, qua e sex, 2h por dia.
   */
  fixedDays?: Weekday[];
  /** Dias fixos com horário próprio em cada dia (ex.: seg 06–10, sáb 08–12). Sem valor no dia = horário habitual. */
  fixedShifts?: Partial<Record<Weekday, Shift>>;
  /** Períodos de férias (datas ISO, inclusive). */
  vacations?: { start: string; end: string }[];
  restrictionNotes: string;
  active: boolean;
}

export interface DeptConfig {
  id: DeptId;
  /** Professores: a unidade pode tirar o departamento da escala. Ausente = incluído. */
  enabled?: boolean;
  headcount: Headcount;
  /** Professores: mínimo presentes em todo o horário de funcionamento. */
  minPresent?: number;
  /** Máximo de colaboradores presentes ao mesmo tempo, em qualquer horário. */
  maxSimultaneous: number;
  saturdayRequired: number;
  sundayRequired: number;
  saturdayShift: Shift;
  /** Turno do 2º colaborador de sábado (quando há dois no sábado). Sem valor = mesmo turno do primeiro. */
  saturdayShift2?: Shift;
  sundayShift: Shift;
  /** Colaboradores necessários em feriado com a academia aberta. */
  holidayRequired: number;
  /** Turno de quem trabalha no feriado (padrão: horário de feriado da academia). */
  holidayShift: Shift;
  /**
   * Quem cobre a abertura quando o titular folga num dia útil, em ordem de prioridade
   * (ex.: ['intermediario'] ou ['intermediario', 'fechamento']). Vazio = sem cobertura automática.
   */
  openingCoverKinds: ShiftKind[];
  /** Quem cobre o fechamento quando ninguém do fechamento trabalha no dia (vale para qualquer tamanho de equipe). */
  closingCoverKinds: ShiftKind[];
  /** Permite ao gerador conceder folga adicional (menos de 5 dias) para cumprir regras obrigatórias. */
  allowExtraOffDays: boolean;
  employees: Employee[];
}

export interface BreakRule {
  /** Aplica-se quando o tempo efetivo de trabalho excede este número de horas. */
  aboveHours: number;
  minBreakMinutes: number;
}

export interface LaborParams {
  weeklyLimitHours: number;
  dailyLimitHours: number;
  dailyNormalHours: number;
  minInterJourneyRestHours: number;
  breakRules: BreakRule[];
  maxBreakMinutes: number;
  workDaysPerWeek: number;
  restDaysPerWeek: number;
  maxConsecutiveWorkDays: number;
  maxConsecutiveWeekends: number;
  /** Cada colaborador deve ter ao menos um domingo de folga a cada N semanas (0 desativa). */
  sundayOffWithinWeeks: number;
  underloadToleranceHours: number;
  compensationAllowed: boolean;
  /**
   * Trabalho em feriado: 'folga' = o gerador concede folga compensatória na mesma semana;
   * 'pagamento' = sem folga extra (compensação paga conforme lei/convenção).
   */
  holidayWorkCompensation: 'folga' | 'pagamento';
  /**
   * Feriado em dia útil conta como uma das 2 folgas da semana: quem folga no feriado precisa de só mais
   * 1 folga e trabalha os 5 dias de sempre. Ausente = ligado (escalas já geradas antes da regra ficam desligadas).
   */
  holidayCountsAsRest?: boolean;
  hourBankEnabled: boolean;
  effectiveFrom: string;
  normativeReference: string;
  notes: string;
  validatedByLegal: boolean;
}

export type HolidaySource = 'nacional' | 'facultativo' | 'manual' | 'estadual' | 'municipal';

/** Feriados móveis que alguns estados e cidades adotam por lei. */
export type MovableHoliday = 'carnaval-seg' | 'carnaval-ter' | 'corpus-christi';

/**
 * Feriado estadual ou municipal da unidade: cadastrado uma vez e incluído sozinho em todas as escalas.
 * Data fixa ("MM-DD", todo ano) ou móvel (Carnaval, Corpus Christi).
 */
export interface LocalHoliday {
  id: string;
  name: string;
  scope: 'estadual' | 'municipal';
  /** "MM-DD" para data fixa; ausente quando é móvel. */
  date?: string;
  movable?: MovableHoliday;
  closed: boolean;
}

export interface Holiday {
  date: string;
  name: string;
  /** Academia fechada: ninguém trabalha. Aberta: funciona no horário de feriado. */
  closed: boolean;
  source: HolidaySource;
}

export type ExceptionKind = 'weekendStaff' | 'maxSimultaneous';

export interface StaffException {
  id: string;
  date: string;
  dept: DeptId;
  kind: ExceptionKind;
  value: number;
  reason: string;
  authorizedAt: string;
}

export interface ScheduleConfig {
  /** Equipe desta escala (administrativa ou técnica). Ausente = escala antiga com todos os departamentos. */
  team?: Team;
  year: number;
  month: number; // 1-12
  model: '5x2';
  /** Índice = dia da semana (0 = domingo). */
  operatingHours: DayHours[];
  /** Horário de funcionamento nos feriados em que a academia abre. */
  holidayHours: { start: string; end: string };
  labor: LaborParams;
  departments: Record<DeptId, DeptConfig>;
  holidays: Holiday[];
  /** Feriados estaduais e municipais da unidade (cadastro da unidade); entram em `holidays` sozinhos. */
  localHolidays?: LocalHoliday[];
  /**
   * Dias da semana em que o gestor bloqueou folgas: ninguém folga nesses dias, em todas as semanas
   * (vale para os dois departamentos e segue para os meses seguintes). Feriados seguem a regra própria.
   */
  noOffWeekdays?: Weekday[];
  /**
   * Ajustes só deste mês: com "hours", o horário de funcionamento (e de feriado) desta escala não segue o
   * cadastro da unidade; com "deptRules", as regras dos departamentos também não.
   */
  overrides?: { hours?: boolean; deptRules?: boolean };
  exceptions: StaffException[];
}

/**
 * T = trabalha, F = folga, FE = folga de feriado (não conta como folga da escala 5x2),
 * FR = férias (fora do 5x2; a semana tem folga proporcional aos dias fora das férias).
 */
export type CellStatus = 'T' | 'F' | 'FE' | 'FR';

export interface Cell {
  status: CellStatus;
  /** Horário ajustado manualmente pelo gestor (tem prioridade sobre o automático). */
  manualShift?: Shift | null;
  /** Dia de borda importado da escala do mês anterior: não editável aqui. */
  locked?: boolean;
  source?: 'auto' | 'manual' | 'anterior';
}

export type CellGrid = Record<string, Record<string, Cell>>; // empId -> date -> cell

export type ScheduleStatus = 'rascunho' | 'confirmada';

export interface Conflict {
  dept: DeptId;
  code: string;
  description: string;
  dates: string[];
  suggestions: string[];
}

export interface GenerationInfo {
  at: string;
  seed: number;
  feasible: boolean;
  conflicts: Conflict[];
  /** Assinatura dos parâmetros usados; permite avisar quando foram alterados depois da geração. */
  configSignature?: string;
}

export interface ChangeEntry {
  at: string;
  description: string;
  /** Quem fez a alteração (nome do usuário logado). */
  by?: string;
}

export interface Schedule {
  id: string;
  /** Unidade escolhida na barra lateral (quando a lista de unidades está configurada). */
  unitId?: string;
  /** Gestor que elaborou a escala (obrigatório para gerar o PDF). */
  managerName?: string;
  year: number;
  month: number;
  config: ScheduleConfig;
  cells: CellGrid | null;
  status: ScheduleStatus;
  generation: GenerationInfo | null;
  /** Gerar repetindo o padrão de folgas do mês anterior (quando ele existe). */
  repetirAnterior?: boolean;
  changeLog: ChangeEntry[];
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  version: number;
}

export type Severity = 'critico' | 'atencao' | 'info';

export interface Alert {
  id: string;
  severity: Severity;
  code: string;
  dept?: DeptId;
  employeeId?: string;
  employeeName?: string;
  date?: string;
  title: string;
  message: string;
  suggestion: string;
}
