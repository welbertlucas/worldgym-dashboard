// Avisos imediatos na configuração: combinações de turnos que ultrapassam o limite semanal.
import { effectiveMinutes, formatDuration, shiftErrors } from './time';
import { DEPT_IDS, deptEnabled, deptName, isHourlyDept, type DeptId, type ScheduleConfig, type Shift, type Weekday } from './types';

export interface ShiftRisk {
  dept: DeptId;
  employeeIds: string[];
  employeeNames: string[];
  /** Turno especial que provoca o excesso. */
  trigger: 'sabado' | 'domingo' | 'sabado+domingo';
  minutes: number;
  message: string;
}

const LABEL = { sabado: 'sábado', domingo: 'domingo', 'sabado+domingo': 'sábado e domingo' } as const;

const safeMinutes = (s: Shift) => (shiftErrors(s).length ? 0 : effectiveMinutes(s));

/**
 * Para cada colaborador, a semana mais pesada possível no modelo 5x2 que inclua o turno de sábado
 * e/ou domingo do departamento. Se passar do limite semanal, o gerador terá de evitar esse padrão
 * (ou a escala ficará inválida) — o gestor é avisado já ao editar o horário.
 */
export function weekendShiftRisks(config: ScheduleConfig): ShiftRisk[] {
  const limit = config.labor.weeklyLimitHours * 60;
  const days = config.labor.workDaysPerWeek;
  const risks: ShiftRisk[] = [];
  for (const id of DEPT_IDS) {
    if (isHourlyDept(id) || !deptEnabled(config, id)) continue; // horistas: sem limite semanal
    const dept = config.departments[id];
    const sat = config.operatingHours[6].open && dept.saturdayRequired > 0
      ? Math.max(safeMinutes(dept.saturdayShift), dept.saturdayRequired >= 2 && dept.saturdayShift2 ? safeMinutes(dept.saturdayShift2) : 0)
      : null;
    const sun = config.operatingHours[0].open && dept.sundayRequired > 0 ? safeMinutes(dept.sundayShift) : null;
    for (const emp of dept.employees.filter((e) => e.active)) {
      const can = (w: Weekday) => emp.availableWeekdays.includes(w);
      const weekday = safeMinutes(emp.shift);
      const weekdaysAvail = ([1, 2, 3, 4, 5] as Weekday[]).filter(can).length;
      const options: { trigger: ShiftRisk['trigger']; special: number[] }[] = [];
      if (sat !== null && can(6)) options.push({ trigger: 'sabado', special: [sat] });
      if (sun !== null && can(0)) options.push({ trigger: 'domingo', special: [sun] });
      if (sat !== null && sun !== null && can(6) && can(0)) options.push({ trigger: 'sabado+domingo', special: [sat, sun] });
      for (const o of options) {
        const n = Math.min(days - o.special.length, weekdaysAvail);
        const total = o.special.reduce((a, b) => a + b, 0) + n * weekday;
        if (total <= limit) continue;
        const name = emp.name.trim() || 'colaborador sem nome';
        const same = risks.find((r) => r.dept === id && r.trigger === o.trigger && r.minutes === total);
        if (same) { same.employeeIds.push(emp.id); same.employeeNames.push(name); continue; }
        risks.push({ dept: id, employeeIds: [emp.id], employeeNames: [name], trigger: o.trigger, minutes: total, message: '' });
      }
    }
  }
  for (const r of risks) {
    const n = days - (r.trigger === 'sabado+domingo' ? 2 : 1);
    r.message = `${deptName(r.dept)}: trabalhando ${LABEL[r.trigger]} e ${n} dia(s) útil(eis), a semana somaria ${formatDuration(r.minutes)} — acima do limite de ${formatDuration(limit)} (excesso de ${formatDuration(r.minutes - limit)}). Afeta: ${r.employeeNames.join(', ')}.`;
  }
  return risks;
}
