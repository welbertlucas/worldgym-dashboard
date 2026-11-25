import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultScheduleConfig } from '../defaults';
import { generateSchedule } from '../generator';
import { linhasDoRelatorio, pendenciasDoRelatorio, totais } from '../relatorio';
import { analyze, applyGeneration, confirmSchedule, createSchedule } from '../scheduleOps';
import { configWith, THREE } from './fixtures';

describe('relatório mensal para a contabilidade', () => {
  const config = configWith(2026, 12, { recepcao: THREE, apoio: THREE }, true);
  config.team = 'administrativa';
  const gerada = { ...applyGeneration(createSchedule(2026, 12, config), generateSchedule(config), 0), unitId: 'asa-norte' };
  const confirmada = confirmSchedule(gerada);

  it('uma linha por pessoa, com os mesmos números da análise da escala', () => {
    const linhas = linhasDoRelatorio([confirmada]);
    expect(linhas).toHaveLength(6);
    const a = analyze(confirmada)!;
    const ana = linhas.find((l) => l.nome === 'Rec 1')!;
    const s = a.depts.recepcao.stats[0];
    expect(ana).toMatchObject({ unidade: 'Asa Norte', departamento: 'Recepção', situacao: 'confirmada', diasTrabalhados: s.workedDays, minutosNoMes: s.monthMinutes, folgas: s.offDays });
    expect(ana.minutosAdicionais).toBe(s.weekExtra.reduce((x, y) => x + y, 0));
    expect(ana.contratada).toBe(42);
  });

  it('escala sem folgas geradas não entra, e rascunho aparece com a situação', () => {
    const vazia = { ...createSchedule(2026, 12, defaultScheduleConfig(2026, 12)), unitId: 'gama' };
    expect(linhasDoRelatorio([vazia])).toHaveLength(0);
    expect(linhasDoRelatorio([gerada])[0].situacao).toBe('rascunho');
  });

  it('totais somam as pessoas', () => {
    const t = totais(linhasDoRelatorio([confirmada]));
    expect(t.pessoas).toBe(6);
    expect(t.minutosNoMes).toBeGreaterThan(6 * 20 * 8 * 60 * 0.9);
  });

  it('pendências: sem escala, em configuração e rascunho', () => {
    const vazia = { ...createSchedule(2026, 12, { ...defaultScheduleConfig(2026, 12), team: 'tecnica' }), unitId: 'asa-norte' };
    const p = pendenciasDoRelatorio([confirmada, vazia], ['asa-norte', 'gama']);
    expect(p).toEqual(expect.arrayContaining([
      { unidade: 'Asa Norte', coordenacao: 'Coordenação Técnica', motivo: 'em-configuracao' },
      { unidade: 'Gama', coordenacao: 'Coordenação Administrativa', motivo: 'sem-escala' },
      { unidade: 'Gama', coordenacao: 'Coordenação Técnica', motivo: 'sem-escala' },
    ]));
    expect(p.some((x) => x.unidade === 'Asa Norte' && x.coordenacao === 'Coordenação Administrativa')).toBe(false);
    expect(pendenciasDoRelatorio([gerada], ['asa-norte'])[0].motivo).toBe('rascunho');
  });
});
