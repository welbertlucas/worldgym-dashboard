import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultScheduleConfig } from '../defaults';
import { generateSchedule } from '../generator';
import { aplicarModelo, MODELOS } from '../modelos';
import { analyze, applyGeneration, createSchedule } from '../scheduleOps';
import { normalizeUnitRules } from '../roster';
import { validateConfig } from '../schema';
import { teamDepts } from '../types';

const MESES: [number, number][] = [[2026, 11], [2026, 12], [2027, 2], [2027, 6]];

describe('modelos prontos de escala', () => {
  it.each(MODELOS.map((m) => [m.id, m] as const))('%s: configuração válida e escala sem conflitos obrigatórios', (_id, modelo) => {
    for (const [y, mo] of MESES) {
      const base = defaultScheduleConfig(y, mo);
      base.team = modelo.team;
      const config = aplicarModelo(base, modelo);
      normalizeUnitRules(config);
      config.labor.validatedByLegal = true;
      const issues = validateConfig(config);
      expect(issues.map((i) => i.message)).toEqual([]);
      const s = applyGeneration(createSchedule(y, mo, config), generateSchedule(config), 0);
      const a = analyze(s)!;
      const criticos = a.alerts.filter((x) => x.severity === 'critico');
      expect(criticos.map((x) => `${y}-${mo} ${x.code}: ${x.message}`)).toEqual([]);
    }
  }, 120000);

  it('nomes fictícios e lei do estágio', () => {
    for (const m of MODELOS) {
      const c = aplicarModelo({ ...defaultScheduleConfig(2026, 11), team: m.team }, m);
      for (const id of teamDepts(c)) for (const e of c.departments[id].employees) expect(e.name).toMatch(/^(Recepcionista|Serviços Gerais|Professor|Estagiário) \d+$/);
      for (const e of c.departments.estagiarios.employees) expect(e.weeklyContractedHours).toBeLessThanOrEqual(30);
    }
  });
});
