import { QUADRO_PADRAO } from './staffing';
import { buildRange, isoDate } from './calendar';
import { defaultHolidays } from './holidays';
import { shiftWithin } from './time';
import {
  isHourlyDept,
  type BreakRule, type DayHours, type DeptConfig, type DeptId, type Employee, type LaborParams, type ScheduleConfig, type Shift, type ShiftKind, type Weekday,
} from './types';

export const ALL_WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/** Jornada diária da rede no 5x2: 8h24min (42h em 5 dias), autorizada até 2028. */
export const DAILY_NORMAL_HOURS = 8.4;
export const DAILY_NORMAL_MINUTES = 504;

export const DEFAULT_BREAK_RULES: BreakRule[] = [
  { aboveHours: 6, minBreakMinutes: 60 },
  { aboveHours: 4, minBreakMinutes: 15 },
];

/** Valores iniciais sugeridos: seg–sex 05h–23h, sábado e feriado 08h–18h, domingo 08h–13h. */
export function defaultOperatingHours(): DayHours[] {
  return ALL_WEEKDAYS.map((w) => {
    if (w === 0) return { open: true, start: '08:00', end: '13:00' };
    if (w === 6) return { open: true, start: '08:00', end: '18:00' };
    return { open: true, start: '05:00', end: '23:00' };
  });
}

export function defaultLaborParams(year: number, month: number): LaborParams {
  return {
    weeklyLimitHours: 42,
    dailyLimitHours: 10,
    dailyNormalHours: DAILY_NORMAL_HOURS,
    minInterJourneyRestHours: 11,
    breakRules: DEFAULT_BREAK_RULES.map((r) => ({ ...r })),
    maxBreakMinutes: 120,
    workDaysPerWeek: 5,
    restDaysPerWeek: 2,
    maxConsecutiveWorkDays: 5,
    maxConsecutiveWeekends: 2,
    sundayOffWithinWeeks: 3,
    underloadToleranceHours: 4,
    compensationAllowed: false,
    holidayWorkCompensation: 'folga',
    holidayCountsAsRest: true,
    hourBankEnabled: false,
    effectiveFrom: isoDate(year, month, 1),
    normativeReference:
      'A confirmar pelo sócio-operador da unidade (ex.: CF/88 art. 7º, XIII; CLT arts. 58, 59, 66, 67 e 71; Lei 10.101/2000 art. 6º; convenção coletiva aplicável e eventual emenda constitucional sobre a jornada).',
    notes: '',
    validatedByLegal: false,
  };
}

/**
 * Modelos de horário habitual por turno, usados apenas para pré-preencher o formulário.
 * Baseados nos exemplos do escopo; o gestor deve confirmar os horários reais de cada colaborador.
 */
export const SHIFT_TEMPLATES: Record<ShiftKind, Shift> = {
  abertura: { start: '05:00', end: '14:24', breakStart: '09:00', breakEnd: '10:00' },
  intermediario: { start: '09:00', end: '18:24', breakStart: '13:00', breakEnd: '14:00' },
  intermediario_noite: { start: '12:00', end: '21:24', breakStart: '16:00', breakEnd: '17:00' },
  fechamento: { start: '13:36', end: '23:00', breakStart: '18:00', breakEnd: '19:00' },
};

const KIND_ORDER: ShiftKind[] = ['abertura', 'intermediario', 'fechamento', 'fechamento', 'abertura'];

export function newId(prefix = 'id'): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${rnd}`;
}

export function newEmployee(dept: DeptId, kind: ShiftKind, plannedHours = 42): Employee {
  return {
    id: newId('col'),
    name: '',
    dept,
    kind,
    shift: { ...SHIFT_TEMPLATES[kind] },
    weeklyPlannedHours: plannedHours,
    weeklyContractedHours: plannedHours,
    availableWeekdays: [...ALL_WEEKDAYS],
    preferredOffWeekdays: [],
    unavailableDates: [],
    restrictionNotes: '',
    active: true,
  };
}

export const DEFAULT_HOLIDAY_HOURS = { start: '08:00', end: '18:00' };

/** Turno padrão do estagiário (Lei do Estágio: até 6h por dia). */
export const INTERN_SHIFT: Shift = { start: '08:00', end: '13:15', breakStart: '10:30', breakEnd: '10:45' };

export function defaultDeptConfig(id: DeptId, operating: DayHours[], rules: BreakRule[], holidayHours = DEFAULT_HOLIDAY_HOURS): DeptConfig {
  return {
    id,
    headcount: QUADRO_PADRAO[id],
    // Sem limite de pessoas ao mesmo tempo (o máximo simultâneo saiu do sistema): vale o tamanho da equipe.
    maxSimultaneous: QUADRO_PADRAO[id],
    saturdayRequired: 1,
    sundayRequired: 1,
    saturdayShift: shiftWithin(operating[6].start, operating[6].end, DAILY_NORMAL_MINUTES, rules),
    sundayShift: shiftWithin(operating[0].start, operating[0].end, DAILY_NORMAL_MINUTES, rules),
    holidayRequired: 1,
    holidayShift: shiftWithin(holidayHours.start, holidayHours.end, DAILY_NORMAL_MINUTES, rules),
    openingCoverKinds: ['intermediario', 'intermediario_noite'],
    closingCoverKinds: ['intermediario_noite', 'intermediario'],
    allowExtraOffDays: false,
    employees: Array.from({ length: QUADRO_PADRAO[id] }, (_, i) => newEmployee(id, defaultKindForSlot(i))),
    ...(isHourlyDept(id) ? { enabled: true, minPresent: 1, maxSimultaneous: 3, openingCoverKinds: [], closingCoverKinds: [] } : {}),
    // Estagiários: desligado até a unidade incluir; 6 estagiários com 5h por dia e sábado/domingo em rodízio.
    ...(id === 'estagiarios' ? {
      enabled: false, headcount: QUADRO_PADRAO.estagiarios, minPresent: 0, maxSimultaneous: 10, saturdayRequired: 1, sundayRequired: 1, holidayRequired: 0,
      saturdayShift: { ...INTERN_SHIFT }, sundayShift: { ...INTERN_SHIFT }, holidayShift: { ...INTERN_SHIFT },
      employees: Array.from({ length: QUADRO_PADRAO.estagiarios }, () => newIntern()),
    } : {}),
  };
}

/** Estagiário com 5h efetivas por dia (08:00–13:15, com 15 min de intervalo) e 25h semanais. */
export function newIntern(): Employee {
  return { ...newEmployee('estagiarios', 'abertura', 25), shift: { ...INTERN_SHIFT } };
}

export function defaultKindForSlot(index: number): ShiftKind {
  return KIND_ORDER[Math.min(index, KIND_ORDER.length - 1)];
}

export function defaultScheduleConfig(year: number, month: number): ScheduleConfig {
  const operatingHours = defaultOperatingHours();
  const labor = defaultLaborParams(year, month);
  return {
    year,
    month,
    model: '5x2',
    operatingHours,
    holidayHours: { ...DEFAULT_HOLIDAY_HOURS },
    labor,
    departments: {
      recepcao: defaultDeptConfig('recepcao', operatingHours, labor.breakRules),
      apoio: defaultDeptConfig('apoio', operatingHours, labor.breakRules),
      professores: defaultDeptConfig('professores', operatingHours, labor.breakRules),
      estagiarios: defaultDeptConfig('estagiarios', operatingHours, labor.breakRules),
    },
    holidays: defaultHolidays(buildRange(year, month).dates),
    exceptions: [],
  };
}
