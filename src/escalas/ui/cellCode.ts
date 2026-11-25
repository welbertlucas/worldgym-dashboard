// Código exibido na célula do calendário (compartilhado entre tela e PDF).
import type { DeptAnalysis } from '../domain/analyze';
import type { Alert } from '../domain/types';

export interface CellCode {
  letter: 'T' | 'F' | 'S' | 'FE' | 'FR';
  alert: boolean;
  alerts: Alert[];
}

/** Alertas semanais aparecem nos totais da semana, não em um dia específico. */
export const WEEK_CODES = new Set(['LIMITE_SEMANAL', 'MODELO_5X2', 'CARGA_ABAIXO', 'HORAS_ADICIONAIS_SEMANA']);

export function cellAlerts(da: DeptAnalysis, e: number, d: number, alerts: Alert[]): Alert[] {
  const { ctx } = da.resolved;
  const emp = ctx.employees[e];
  const date = ctx.dates[d];
  return alerts.filter(
    (a) => a.severity === 'critico' && !WEEK_CODES.has(a.code) && a.dept === ctx.deptId && a.date === date && (!a.employeeId || a.employeeId === emp.id) &&
      // alertas do dia sem colaborador só marcam quem trabalha naquele dia
      (a.employeeId || da.resolved.cells[e][d].status === 'T'),
  );
}

export function cellCode(da: DeptAnalysis, e: number, d: number, alerts: Alert[]): CellCode {
  const c = da.resolved.cells[e][d];
  const list = cellAlerts(da, e, d, alerts);
  const letter = c.status === 'FE' ? 'FE' : c.status === 'FR' ? 'FR' : c.status === 'F' ? 'F' : c.origin === 'substituicao' ? 'S' : 'T';
  return { letter, alert: list.length > 0, alerts: list };
}
