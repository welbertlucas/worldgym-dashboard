import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRange } from '../calendar';
import { generateSchedule } from '../generator';
import { analyze, applyGeneration, createSchedule } from '../scheduleOps';
import { configWith, THREE } from './fixtures';

const gerar = (conta: boolean) => {
  const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE }, true);
  config.labor.holidayCountsAsRest = conta;
  return applyGeneration(createSchedule(2026, 11, config), generateSchedule(config), 0);
};

/** Para cada pessoa folgando no feriado de 20/11 (sexta): dias de trabalho e folgas "F" na semana. */
function semanaDoFeriado(s: ReturnType<typeof gerar>) {
  const week = buildRange(2026, 11).weeks.find((w) => w.dates.includes('2026-11-20'))!;
  const out: { t: number; f: number }[] = [];
  for (const dept of Object.values(s.config.departments)) {
    for (const e of dept.employees) {
      const row = s.cells![e.id];
      if (!row || row['2026-11-20']?.status !== 'FE') continue;
      const st = week.dates.map((d) => row[d]?.status);
      out.push({ t: st.filter((x) => x === 'T').length, f: st.filter((x) => x === 'F').length });
    }
  }
  return out;
}

describe('feriado conta como folga', () => {
  it('ligado: quem folga no feriado tem só mais 1 folga e trabalha 5 dias, sem conflitos obrigatórios', () => {
    const s = gerar(true);
    const w = semanaDoFeriado(s);
    expect(w.length).toBeGreaterThan(0);
    expect(w.every((x) => x.f === 1 && x.t === 5)).toBe(true);
    expect(analyze(s)!.counts.critico).toBe(0);
  });

  it('desligado: o feriado fica além das 2 folgas (comportamento anterior)', () => {
    const w = semanaDoFeriado(gerar(false));
    expect(w.every((x) => x.f === 2 && x.t === 4)).toBe(true);
  });
});
