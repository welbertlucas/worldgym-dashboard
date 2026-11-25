// Quantas pessoas cada departamento deve ter: padrão da rede World Gym.
import type { DeptId, ScheduleConfig } from './types';

/** Quadro padrão da rede por departamento. */
export const QUADRO_PADRAO: Record<DeptId, number> = { recepcao: 4, apoio: 4, professores: 4, estagiarios: 6 };

export interface Staffing {
  /** Pessoas sugeridas (padrão da rede). */
  suggested: number;
  /** Pessoas cadastradas e ativas. */
  current: number;
  /** De onde vem a sugestão, em uma frase. */
  explanation: string;
}

export function suggestHeadcount(config: ScheduleConfig, dept: DeptId): Staffing {
  const current = config.departments[dept].employees.filter((e) => e.active).length;
  const suggested = QUADRO_PADRAO[dept];
  return { suggested, current, explanation: `Padrão da rede: ${suggested} pessoas neste departamento.` };
}
