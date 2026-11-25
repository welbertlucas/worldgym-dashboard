// Validação dos dados de entrada antes da geração.
import { z } from 'zod';
import { buildRange, isValidIsoDate } from './calendar';
import { isValidTime, shiftErrors } from './time';
import { DEPT_IDS, deptEnabled, isHourlyDept, outside5x2, maxTeamSize, memberLabel, minTeamSize, type DeptId, type Employee, type ScheduleConfig } from './types';

const time = z.string().refine(isValidTime, 'Horário inválido (use HH:MM).');
const shift = z.object({ start: time, end: time, breakStart: time.nullable(), breakEnd: time.nullable() });
const weekday = z.number().int().min(0).max(6);

const employee = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2, 'Falta o nome completo.').max(80, 'Nome muito longo (máx. 80 letras).'),
  dept: z.enum(['recepcao', 'apoio', 'professores', 'estagiarios']),
  kind: z.enum(['abertura', 'intermediario', 'intermediario_noite', 'fechamento']),
  coveredBy: z.array(z.string()).optional(),
  weekendOnly: z.boolean().optional(),
  fixedDays: z.array(weekday).optional(),
  fixedShifts: z.record(z.string(), shift).optional(),
  shift,
  weeklyPlannedHours: z.number().min(1, 'Jornada semanal planejada inválida.').max(60),
  weeklyContractedHours: z.number().min(1, 'Jornada contratada inválida.').max(60),
  availableWeekdays: z.array(weekday),
  preferredOffWeekdays: z.array(weekday),
  unavailableDates: z.array(z.string().refine(isValidIsoDate, 'Data inválida.')),
  vacations: z.array(z.object({ start: z.string().refine(isValidIsoDate, 'Data de início das férias inválida.'), end: z.string().refine(isValidIsoDate, 'Data de fim das férias inválida.') })
    .refine((v) => v.end >= v.start, 'O fim das férias deve ser depois do início.')).optional(),
  restrictionNotes: z.string().max(500),
  active: z.boolean(),
});

const dept = z.object({
  id: z.enum(['recepcao', 'apoio', 'professores', 'estagiarios']),
  enabled: z.boolean().optional(),
  headcount: z.number().int().min(1).max(12),
  minPresent: z.number().int().min(0).max(12).optional(),
  maxSimultaneous: z.number().int().min(1).max(12),
  saturdayRequired: z.number().int().min(0).max(12),
  sundayRequired: z.number().int().min(0).max(12),
  saturdayShift: shift,
  saturdayShift2: shift.optional(),
  sundayShift: shift,
  holidayRequired: z.number().int().min(0).max(12),
  holidayShift: shift,
  openingCoverKinds: z.array(z.enum(['intermediario', 'intermediario_noite', 'fechamento'])),
  closingCoverKinds: z.array(z.enum(['intermediario', 'intermediario_noite', 'abertura'])),
  allowExtraOffDays: z.boolean(),
  employees: z.array(employee),
});

const labor = z.object({
  weeklyLimitHours: z.number().min(1).max(60),
  dailyLimitHours: z.number().min(1).max(24),
  dailyNormalHours: z.number().min(1).max(24),
  minInterJourneyRestHours: z.number().min(0).max(24),
  breakRules: z.array(z.object({ aboveHours: z.number().min(0).max(24), minBreakMinutes: z.number().int().min(0).max(240) })),
  maxBreakMinutes: z.number().int().min(0).max(600),
  workDaysPerWeek: z.literal(5),
  restDaysPerWeek: z.literal(2),
  maxConsecutiveWorkDays: z.number().int().min(1).max(13),
  maxConsecutiveWeekends: z.number().int().min(1).max(10),
  sundayOffWithinWeeks: z.number().int().min(0).max(10),
  underloadToleranceHours: z.number().min(0).max(40),
  compensationAllowed: z.boolean(),
  holidayWorkCompensation: z.enum(['folga', 'pagamento']),
  holidayCountsAsRest: z.boolean().optional(),
  hourBankEnabled: z.boolean(),
  effectiveFrom: z.string().refine(isValidIsoDate, 'Data de vigência inválida.'),
  normativeReference: z.string().max(2000),
  notes: z.string().max(2000),
  validatedByLegal: z.boolean(),
});

export const configSchema = z.object({
  team: z.enum(['administrativa', 'tecnica']).optional(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  model: z.literal('5x2'),
  operatingHours: z.array(z.object({ open: z.boolean(), start: time, end: time })).length(7),
  holidayHours: z.object({ start: time, end: time }),
  labor,
  departments: z.object({ recepcao: dept, apoio: dept, professores: dept, estagiarios: dept }),
  holidays: z.array(z.object({ date: z.string().refine(isValidIsoDate, 'Data inválida.'), name: z.string().trim().min(1, 'Informe o nome do feriado.'), closed: z.boolean(), source: z.enum(['nacional', 'facultativo', 'manual', 'estadual', 'municipal']) })),
  localHolidays: z.array(z.object({ id: z.string(), name: z.string(), scope: z.enum(['estadual', 'municipal']), date: z.string().optional(), movable: z.enum(['carnaval-seg', 'carnaval-ter', 'corpus-christi']).optional(), closed: z.boolean() })).optional(),
  noOffWeekdays: z.array(weekday).optional(),
  exceptions: z.array(z.any()),
});

export interface ConfigIssue {
  section: 'identificacao' | 'funcionamento' | 'departamentos' | 'colaboradores' | 'jornada';
  /** O que corrigir, em uma frase curta. */
  message: string;
  /** Departamento afetado (permite "não gerar este departamento"). */
  dept?: DeptId;
  /** Colaborador afetado (permite ir direto ao cadastro). */
  employeeId?: string;
  /** Onde está o problema, ex.: "Colaborador 2" ou "Ana Souza". */
  where?: string;
}

const PATH_SECTION: Record<string, ConfigIssue['section']> = {
  year: 'identificacao', month: 'identificacao', operatingHours: 'funcionamento', holidayHours: 'funcionamento', holidays: 'funcionamento', noOffWeekdays: 'funcionamento', labor: 'jornada',
};

export function validateConfig(config: ScheduleConfig): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  // Departamento desligado (Professores) não precisa de cadastro completo.
  const departments = Object.fromEntries(DEPT_IDS.map((id) => [id, deptEnabled(config, id) ? config.departments[id] : { ...config.departments[id], employees: [] }]));
  const parsed = configSchema.safeParse({ ...config, departments });
  if (!parsed.success) {
    for (const i of parsed.error.issues) {
      let section = PATH_SECTION[String(i.path[0])] ?? 'departamentos';
      const issue: ConfigIssue = { section, message: i.message };
      if (i.path[0] === 'departments') {
        const d = i.path[1] as DeptId;
        issue.dept = d;
        if (i.path[2] === 'employees') {
          section = 'colaboradores';
          const idx = Number(i.path[3]);
          const emp = config.departments[d].employees[idx];
          issue.employeeId = emp?.id;
          issue.where = whoLabel(d, emp, idx);
        }
      }
      if (i.path[0] === 'operatingHours') issue.where = 'Horário de funcionamento';
      issues.push({ ...issue, section });
    }
    return issues;
  }
  const range = buildRange(config.year, config.month);
  config.operatingHours.forEach((d, w) => {
    if (d.open && d.start === d.end) issues.push({ section: 'funcionamento', where: 'Horário de funcionamento', message: `Abertura e fechamento iguais na ${['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][w]}.` });
  });
  for (const h of config.holidays)
    if (!range.dates.includes(h.date)) issues.push({ section: 'funcionamento', where: 'Feriados', message: `"${h.name}" está fora do período da escala: remova-o.` });
  const freeDays = 7 - new Set(config.noOffWeekdays ?? []).size;
  if (freeDays < config.labor.restDaysPerWeek)
    issues.push({ section: 'funcionamento', where: 'Dias sem folga', message: `Desmarque dias: com ${7 - freeDays} bloqueados não sobram dias para as ${config.labor.restDaysPerWeek} folgas da semana.` });
  if (!DEPT_IDS.some((id) => deptEnabled(config, id)))
    issues.push({ section: 'departamentos', where: 'Departamentos', message: 'Inclua ao menos um departamento na escala.' });
  for (const id of DEPT_IDS) {
    if (!deptEnabled(config, id)) continue;
    const d = config.departments[id];
    const add = (section: ConfigIssue['section'], message: string, extra: Partial<ConfigIssue> = {}) => issues.push({ section, message, dept: id, ...extra });
    if (d.headcount > maxTeamSize(id)) add('departamentos', `Reduza a equipe para no máximo ${maxTeamSize(id)}.`);
    if (isHourlyDept(id) && (d.minPresent ?? 1) > d.headcount)
      add('departamentos', `O mínimo presente (${d.minPresent}) é maior que a equipe (${d.headcount}): reduza o mínimo.`);
    if (d.employees.length < d.headcount)
      add('colaboradores', `Faltam ${d.headcount - d.employees.length} cadastro(s): a equipe é de ${d.headcount}.`);
    if (d.employees.length > d.headcount)
      add('colaboradores', `Há ${d.employees.length} cadastrados para uma equipe de ${d.headcount}: remova ${d.employees.length - d.headcount} ou aumente a equipe.`);
    for (const e of shiftErrors(d.saturdayShift, 'Turno de sábado')) add('departamentos', e);
    if (d.saturdayRequired >= 2 && d.saturdayShift2)
      for (const e of shiftErrors(d.saturdayShift2, 'Turno do 2º colaborador de sábado')) add('departamentos', e);
    for (const e of shiftErrors(d.sundayShift, 'Turno de domingo')) add('departamentos', e);
    if (config.holidays.some((h) => !h.closed))
      for (const e of shiftErrors(d.holidayShift, 'Turno de feriado')) add('departamentos', e);
    d.employees.forEach((emp, i) => {
      const who = { employeeId: emp.id, where: whoLabel(id, emp, i) };
      for (const e of shiftErrors(emp.shift, 'Horário habitual')) add('colaboradores', e, who);
      if (emp.fixedDays?.length && emp.fixedShifts)
        for (const w of emp.fixedDays) {
          const s = emp.fixedShifts[w];
          if (s) for (const e of shiftErrors(s, `Horário de ${['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][w]}`)) add('colaboradores', e, who);
        }
      if (emp.active && emp.fixedDays && !emp.fixedDays.length)
        add('colaboradores', 'Marque ao menos um dia em "Dias em que trabalha".', who);
      if (emp.active && !outside5x2(emp) && emp.availableWeekdays.length < 5)
        add('colaboradores', 'Desmarque dias em "Nunca trabalha em": com mais de 2 dias bloqueados o 5x2 não fecha.', who);
      if (emp.dept !== id) add('colaboradores', 'Departamento inconsistente: use "Substituir" para recadastrar.', who);
    });
    const active = d.employees.filter((e) => e.active).length;
    if (active < minTeamSize(id)) add('colaboradores', `Ative ao menos ${minTeamSize(id)} pessoa(s) (há ${active} ativa(s)).`);
  }
  if (config.holidayHours.start === config.holidayHours.end)
    issues.push({ section: 'funcionamento', where: 'Feriados', message: 'Abertura e fechamento iguais no horário de feriado.' });
  if (config.labor.dailyNormalHours > config.labor.dailyLimitHours)
    issues.push({ section: 'jornada', where: 'Jornada', message: 'A jornada diária normal está maior que o limite diário: ajuste um dos dois.' });
  return issues;
}

/** "Colaborador 2" (sem nome) ou o nome cadastrado. */
function whoLabel(dept: DeptId, emp: Employee | undefined, index: number): string {
  return emp?.name?.trim() || `${memberLabel(dept)} ${index + 1}`;
}
