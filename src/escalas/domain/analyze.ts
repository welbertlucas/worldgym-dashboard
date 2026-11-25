import { buildRange, formatDateBr, formatDayMonth, type ScheduleRange } from './calendar';
import { buildDeptContext, resolveDept, type ResolvedDept } from './resolve';
import {
  dailyCount, dayAlerts, employeeStats, livreWeekAlerts, monthAlerts, multiWeekAlerts, restAlerts, weekAlerts, type EmployeeStats,
} from './validate';
import { DEPT_IDS, deptName, type Alert, type CellGrid, type DeptId, type ScheduleConfig, type Severity } from './types';

export interface DeptAnalysis {
  deptId: DeptId;
  resolved: ResolvedDept;
  stats: EmployeeStats[];
  dailyCounts: number[];
}

export interface Analysis {
  range: ScheduleRange;
  depts: Record<DeptId, DeptAnalysis>;
  alerts: Alert[];
  counts: Record<Severity, number>;
  /** Escala válida = gerada e sem nenhum alerta crítico pendente. */
  valid: boolean;
}

const SEVERITY_ORDER: Record<Severity, number> = { critico: 0, atencao: 1, info: 2 };

export function analyzeDept(config: ScheduleConfig, deptId: DeptId, cells: CellGrid, range: ScheduleRange): { a: DeptAnalysis; alerts: Alert[] } {
  const ctx = buildDeptContext(config, deptId, range);
  const resolved = resolveDept(ctx, (e, d) => cells[ctx.employees[e].id]?.[ctx.dates[d]] ?? { status: 'F' });
  const alerts: Alert[] = [];
  const last = ctx.dates.length - 1;
  const stats = ctx.employees.map((_, e) => employeeStats(resolved, e));
  if (config.livre) {
    // Escala livre: nenhuma regra de folga, cobertura, turno ou descanso; só o limite semanal.
    ctx.range.weeks.forEach((_, w) => livreWeekAlerts(resolved, w, alerts));
  } else {
    for (let d = 0; d <= last; d++) dayAlerts(resolved, d, alerts);
    restAlerts(resolved, 1, last, alerts);
    ctx.range.weeks.forEach((_, w) => weekAlerts(resolved, w, alerts));
    multiWeekAlerts(resolved, last, alerts);
    monthAlerts(resolved, stats, alerts);
  }
  return { a: { deptId, resolved, stats, dailyCounts: ctx.dates.map((_, d) => dailyCount(resolved, d)) }, alerts };
}

export function analyzeSchedule(
  config: ScheduleConfig,
  cells: CellGrid,
  extra: { changeLog?: { at: string; description: string }[]; previousImported?: boolean } = {},
): Analysis {
  const range = buildRange(config.year, config.month);
  const alerts: Alert[] = [];
  const depts = {} as Record<DeptId, DeptAnalysis>;
  for (const id of DEPT_IDS) {
    const r = analyzeDept(config, id, cells, range);
    depts[id] = r.a;
    alerts.push(...r.alerts);
  }
  // Alertas gerais da escala
  for (const w of config.livre ? [] : range.weeks.filter((x) => x.partial)) {
    const outside = w.dates.filter((d) => !range.inMonth(d));
    const before = outside[0] < range.monthDates[0];
    alerts.push({
      id: `SEMANA_INCOMPLETA|${w.index}`,
      severity: 'atencao',
      code: 'SEMANA_INCOMPLETA',
      date: w.start,
      title: 'Semana incompleta no mês',
      message: `Semana ${w.index} (${formatDayMonth(w.start)}–${formatDayMonth(w.end)}) ${before ? 'começa no mês anterior' : 'termina no mês seguinte'}: os dias ${outside.map(formatDayMonth).join(', ')} entram no cálculo semanal.${before ? (extra.previousImported ? ' Dias importados da escala do mês anterior.' : ' Não há escala anterior salva: esses dias foram planejados aqui e devem ser conferidos com a escala anterior.') : ' Esses dias são uma projeção e serão importados pela escala do mês seguinte.'}`,
      suggestion: 'O total mensal considera apenas os dias do mês; o limite semanal considera a semana completa.',
    });
  }
  if (!config.livre && !config.labor.validatedByLegal)
    alerts.push({
      id: 'PARAMETROS_NAO_VALIDADOS',
      severity: 'atencao',
      code: 'PARAMETROS_NAO_VALIDADOS',
      title: 'Parâmetros de jornada não validados',
      message: `Os limites (${config.labor.weeklyLimitHours}h semanais, ${config.labor.dailyLimitHours}h diárias, ${config.labor.minInterJourneyRestHours}h entre jornadas) ainda não foram validados pelo sócio-operador da unidade.`,
      suggestion: 'Confirme a regra aplicável à unidade (lei, convenção coletiva, vigência) com o Dono ou o Master, nas regras de jornada da unidade.',
    });
  for (const [i, c] of (extra.changeLog ?? []).entries())
    alerts.push({
      id: `ALTERACAO|${i}`,
      severity: 'info',
      code: 'ALTERACAO_GESTOR',
      title: 'Alteração feita pelo gestor',
      message: `${formatDateBr(c.at.slice(0, 10))} ${c.at.slice(11, 16)} — ${c.description}`,
      suggestion: '',
    });
  alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (a.date ?? '').localeCompare(b.date ?? ''));
  const counts: Record<Severity, number> = { critico: 0, atencao: 0, info: 0 };
  for (const a of alerts) counts[a.severity]++;
  return { range, depts, alerts, counts, valid: counts.critico === 0 };
}

export function alertScope(a: Alert): string {
  return a.dept ? deptName(a.dept) : 'Geral';
}
