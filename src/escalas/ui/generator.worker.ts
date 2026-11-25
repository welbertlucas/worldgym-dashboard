import { generateSchedule } from '../domain/generator';
import type { CellGrid, DeptId, ScheduleConfig } from '../domain/types';

self.onmessage = (ev: MessageEvent<{ config: ScheduleConfig; seed: number; previous: CellGrid | null; only?: DeptId[]; keep?: CellGrid | null; reference?: { cells: CellGrid; weeks: string[][] } | null }>) => {
  try {
    const { config, seed, previous, only, keep, reference } = ev.data;
    const r = generateSchedule(config, { seed, previous, only, keep, reference });
    self.postMessage({ ok: true, result: { cells: r.cells, feasible: r.feasible, conflicts: r.conflicts } });
  } catch (e) {
    self.postMessage({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
};
