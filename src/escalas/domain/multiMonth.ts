// Geração de vários meses em sequência a partir de uma escala pronta.
// Cada mês usa a mesma equipe e parâmetros, os feriados do próprio mês e importa a semana de borda
// do mês anterior — por isso os meses são gerados em ordem.
import { analyze, applyGeneration, createSchedule } from './scheduleOps';
import type { CellGrid, Conflict, Schedule, ScheduleConfig } from './types';

export interface MultiMonthDeps {
  find(year: number, month: number): Promise<Schedule | null>;
  save(schedule: Schedule): Promise<void>;
  generate(config: ScheduleConfig, seed: number, previous: CellGrid | null): Promise<{ cells: CellGrid; feasible: boolean; conflicts: Conflict[] }>;
  onProgress?(done: number, total: number): void;
}

export interface MonthResult {
  year: number;
  month: number;
  schedule: Schedule;
  /** 'existente' = já havia escala gerada para o mês; foi mantida sem alteração. */
  outcome: 'gerada' | 'existente';
  valid: boolean;
  critical: number;
}

export const MAX_FOLLOWING_MONTHS = 11;

export function nextMonth(year: number, month: number) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

export async function generateFollowingMonths(base: Schedule, count: number, deps: MultiMonthDeps): Promise<MonthResult[]> {
  if (!base.cells) throw new Error('Gere a escala deste mês antes de gerar os seguintes.');
  const n = Math.max(1, Math.min(MAX_FOLLOWING_MONTHS, Math.floor(count)));
  const results: MonthResult[] = [];
  let previous: Schedule = base;
  let { year, month } = base;
  for (let i = 0; i < n; i++) {
    ({ year, month } = nextMonth(year, month));
    const existing = await deps.find(year, month);
    let schedule: Schedule;
    let outcome: MonthResult['outcome'];
    if (existing?.cells) {
      schedule = existing;
      outcome = 'existente';
    } else {
      const fresh = existing ?? createSchedule(year, month, base.config, base.unitId);
      const r = await deps.generate(fresh.config, 0, previous.cells);
      schedule = { ...applyGeneration(fresh, r, 0), managerName: base.managerName };
      await deps.save(schedule);
      outcome = 'gerada';
    }
    const a = analyze(schedule)!;
    results.push({ year, month, schedule, outcome, valid: a.valid, critical: a.counts.critico });
    deps.onProgress?.(i + 1, n);
    previous = schedule;
  }
  return results;
}
