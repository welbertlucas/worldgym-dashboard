import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configWith, THREE } from './fixtures';
import { generateSchedule } from '../generator';
import { applyGeneration, createSchedule, swapOffDays } from '../scheduleOps';

describe('troca de folga entre colegas', () => {
  const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
  const s = applyGeneration(createSchedule(2026, 11, config), generateSchedule(config), 0);
  const dias = Object.keys(s.cells!['recepcao-1']).filter((d) => d.startsWith('2026-11')).sort();
  const st = (e: string, d: string) => s.cells![e][d].status;

  it('troca os dias de folga das duas pessoas e registra no histórico', () => {
    let par: [string, string] | null = null;
    for (const a of dias) for (const b of dias)
      if (!par && st('recepcao-1', a) === 'F' && st('recepcao-1', b) === 'T' && st('recepcao-2', b) === 'F' && st('recepcao-2', a) === 'T') par = [a, b];
    expect(par).not.toBeNull();
    const [d1, d2] = par!;
    const n = swapOffDays(s, 'recepcao-1', d1, 'recepcao-2', d2);
    expect([n.cells!['recepcao-1'][d1].status, n.cells!['recepcao-1'][d2].status, n.cells!['recepcao-2'][d1].status, n.cells!['recepcao-2'][d2].status]).toEqual(['T', 'F', 'F', 'T']);
    expect(n.changeLog.at(-1)!.description).toMatch(/^Troca de folga: Rec 1 folga em/);
    expect(n.changeLog.length).toBe(s.changeLog.length + 1);
  });

  it('recusa quando os dias não batem', () => {
    const t = dias.find((d) => st('recepcao-1', d) === 'T')!;
    expect(() => swapOffDays(s, 'recepcao-1', t, 'recepcao-2', t)).toThrow();
  });
});
