// Executa o gerador em um Web Worker (a interface não trava durante o cálculo).
import { generateSchedule } from '../domain/generator';
import type { CellGrid, Conflict, DeptId, ScheduleConfig } from '../domain/types';

export interface WorkerResult {
  cells: CellGrid;
  feasible: boolean;
  conflicts: Conflict[];
}

export function generateInBackground(config: ScheduleConfig, seed: number, previous: CellGrid | null, part: { only?: DeptId[]; keep?: CellGrid | null; reference?: { cells: CellGrid; weeks: string[][] } | null } = {}): Promise<WorkerResult> {
  if (typeof Worker === 'undefined') {
    const r = generateSchedule(config, { seed, previous, ...part });
    return Promise.resolve({ cells: r.cells, feasible: r.feasible, conflicts: r.conflicts });
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./generator.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev: MessageEvent<{ ok: true; result: WorkerResult } | { ok: false; error: string }>) => {
      worker.terminate();
      if (ev.data.ok) resolve(ev.data.result);
      else reject(new Error(ev.data.error));
    };
    worker.onerror = (ev) => {
      worker.terminate();
      // Ex.: aba aberta antes de uma nova publicação (arquivo do worker mudou de nome). Calcula aqui mesmo.
      ev.preventDefault();
      try {
        const r = generateSchedule(config, { seed, previous, ...part });
        resolve({ cells: r.cells, feasible: r.feasible, conflicts: r.conflicts });
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Falha ao gerar a escala.'));
      }
    };
    worker.postMessage({ config, seed, previous, ...part });
  });
}
