import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRange } from '../calendar';
import { defaultScheduleConfig } from '../defaults';
import { generateSchedule } from '../generator';
import { configWith, THREE } from './fixtures';

/** Quantas células T/F do 2º mês (semanas inteiras dentro dele) repetem o padrão do 1º mês, semana a semana. */
function semelhanca(c1: ReturnType<typeof generateSchedule>['cells'], c2: ReturnType<typeof generateSchedule>['cells'], y1: number, m1: number, y2: number, m2: number, ids: string[]) {
  const w1 = buildRange(y1, m1).weeks.map((w) => w.dates);
  const w2 = buildRange(y2, m2).weeks.map((w) => w.dates);
  let iguais = 0, total = 0;
  for (let w = 1; w < w2.length; w++) {
    const ref = w1[(w - 1) % w1.length];
    for (const id of ids) for (let k = 0; k < 7; k++) {
      const a = c1[id]?.[ref[k]]?.status, b = c2[id]?.[w2[w][k]]?.status;
      if ((a === 'T' || a === 'F') && (b === 'T' || b === 'F')) { total++; if (a === b) iguais++; }
    }
  }
  return iguais / Math.max(1, total);
}

describe('repetir o padrão do mês anterior', () => {
  const ids = ['recepcao-1', 'recepcao-2', 'recepcao-3', 'apoio-1', 'apoio-2', 'apoio-3'];
  const c1 = configWith(2026, 10, { recepcao: THREE, apoio: THREE });
  const c2 = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
  const r1 = generateSchedule(c1);

  it('fica mais parecido com o mês anterior, sem criar conflito obrigatório', () => {
    const sem = generateSchedule(c2, { previous: r1.cells });
    const com = generateSchedule(c2, { previous: r1.cells, reference: { cells: r1.cells, weeks: buildRange(2026, 10).weeks.map((w) => w.dates) } });
    const sSem = semelhanca(r1.cells, sem.cells, 2026, 10, 2026, 11, ids);
    const sCom = semelhanca(r1.cells, com.cells, 2026, 10, 2026, 11, ids);
    expect(sCom).toBeGreaterThan(sSem);
    expect(sCom).toBeGreaterThan(0.8);
    expect(com.analysis.counts.critico).toBeLessThanOrEqual(sem.analysis.counts.critico);
  });

  it('as regras obrigatórias vencem: com férias no meio, continua sem conflito', () => {
    const c = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
    c.departments.recepcao.employees[0].vacations = [{ start: '2026-11-09', end: '2026-11-15' }];
    const com = generateSchedule(c, { previous: r1.cells, reference: { cells: r1.cells, weeks: buildRange(2026, 10).weeks.map((w) => w.dates) } });
    expect(com.analysis.counts.critico).toBe(generateSchedule(c, { previous: r1.cells }).analysis.counts.critico);
  });

  it('pessoa nova (sem histórico) continua sendo escalada normalmente', () => {
    const c = defaultScheduleConfig(2026, 11);
    void c;
    const novo = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
    novo.departments.recepcao.employees[1].id = 'recepcao-novo';
    const r = generateSchedule(novo, { previous: r1.cells, reference: { cells: r1.cells, weeks: buildRange(2026, 10).weeks.map((w) => w.dates) } });
    expect(Object.keys(r.cells)).toContain('recepcao-novo');
  });
});
