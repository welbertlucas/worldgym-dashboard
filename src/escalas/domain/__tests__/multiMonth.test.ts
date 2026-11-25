import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateSchedule } from '../generator';
import { generateFollowingMonths } from '../multiMonth';
import { analyze, applyGeneration, createSchedule } from '../scheduleOps';
import type { Schedule } from '../types';
import { buildCombinedPdf, combinedFileName } from '../../pdf/exportPdf';
import { configWith, THREE } from './fixtures';

function memoryDeps() {
  const saved = new Map<string, Schedule>();
  const key = (y: number, m: number) => `${y}|${m}`;
  return {
    saved,
    deps: {
      find: async (y: number, m: number) => saved.get(key(y, m)) ?? null,
      save: async (s: Schedule) => { saved.set(key(s.year, s.month), s); },
      generate: async (config: Schedule['config'], seed: number, previous: Schedule['cells']) => generateSchedule(config, { seed, previous }),
    },
  };
}

describe('vários meses em sequência', () => {
  const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE }, true);
  const base = applyGeneration(createSchedule(2026, 11, config), generateSchedule(config), 0);

  it('gera os meses seguintes com a mesma equipe, feriados de cada mês e semana de virada contínua', async () => {
    const { deps, saved } = memoryDeps();
    const results = await generateFollowingMonths(base, 2, deps);
    expect(results.map((r) => `${r.year}-${r.month}`)).toEqual(['2026-12', '2027-1']);
    expect(results.every((r) => r.outcome === 'gerada' && r.valid)).toBe(true);
    expect(saved.size).toBe(2);
    const dec = results[0].schedule;
    expect(dec.config.departments.recepcao.employees.map((e) => e.name)).toEqual(['Rec 1', 'Rec 2', 'Rec 3']);
    expect(dec.config.holidays.map((h) => h.date)).toContain('2026-12-25');
    expect(results[1].schedule.config.holidays.map((h) => h.date)).toContain('2027-01-01');
    // 30/11 a 06/12: dezembro importa de novembro os dias 30/11 (travados), mesmos valores
    expect(dec.cells!['recepcao-1']['2026-11-30']).toMatchObject({ status: base.cells!['recepcao-1']['2026-11-30'].status, locked: true });
  });

  it('mantém meses que já tinham escala gerada', async () => {
    const { deps, saved } = memoryDeps();
    const decConfig = configWith(2026, 12, { recepcao: THREE, apoio: THREE }, true);
    const existing = applyGeneration(createSchedule(2026, 12, decConfig), generateSchedule(decConfig), 0);
    await deps.save(existing);
    const results = await generateFollowingMonths(base, 1, deps);
    expect(results[0].outcome).toBe('existente');
    expect(saved.get('2026|12')!.id).toBe(existing.id);
  });

  it('exporta vários meses em um único PDF', async () => {
    const { deps } = memoryDeps();
    const results = await generateFollowingMonths(base, 1, deps);
    const items = [base, results[0].schedule].map((schedule) => ({ schedule, analysis: analyze(schedule)! }));
    const doc = buildCombinedPdf(items, { font: 'helvetica' });
    const text = Buffer.from(doc.output('arraybuffer')).toString('latin1');
    expect(text).toContain('Novembro de 2026');
    expect(text).toContain('Dezembro de 2026');
    const single = buildCombinedPdf(items.slice(0, 1), { font: 'helvetica' }).getNumberOfPages();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(single * 2 - 1);
    expect(combinedFileName(items)).toBe('escala-5x2_2026-11_a_2026-12.pdf');
  });
});
