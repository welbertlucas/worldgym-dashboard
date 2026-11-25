// Dados de teste (fictícios, usados apenas nos testes automatizados).
import { defaultScheduleConfig, newEmployee } from '../defaults';
import type { DeptId, Headcount, ScheduleConfig, ShiftKind } from '../types';

/** Por padrão sem feriados (para isolar as regras); use `withHolidays` para manter os nacionais. */
/** Sem `professores` nos tipos de turno, o departamento de Professores fica desligado. */
export function configWith(year: number, month: number, kinds: Partial<Record<DeptId, ShiftKind[]>> & { recepcao: ShiftKind[]; apoio: ShiftKind[] }, withHolidays = false): ScheduleConfig {
  const config = defaultScheduleConfig(year, month);
  if (!withHolidays) config.holidays = [];
  if (!kinds.professores) config.departments.professores.enabled = false;
  for (const dept of (['recepcao', 'apoio', 'professores'] as DeptId[]).filter((d) => kinds[d])) {
    config.departments[dept].employees = kinds[dept]!.map((k, i) => {
      const e = newEmployee(dept, k);
      e.id = `${dept}-${i + 1}`;
      e.name = `${dept === 'recepcao' ? 'Rec' : dept === 'apoio' ? 'Apoio' : 'Prof'} ${i + 1}`;
      return e;
    });
    config.departments[dept].headcount = kinds[dept]!.length as Headcount;
    config.departments[dept].maxSimultaneous = Math.max(config.departments[dept].maxSimultaneous, kinds[dept]!.length);
  }
  return config;
}

export const THREE: ShiftKind[] = ['abertura', 'intermediario', 'fechamento'];
export const FIVE: ShiftKind[] = ['abertura', 'intermediario', 'fechamento', 'fechamento', 'abertura'];
