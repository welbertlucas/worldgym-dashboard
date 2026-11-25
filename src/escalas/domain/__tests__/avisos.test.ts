import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { avisosDasEscalas, carimbarAutor } from '../avisos';
import { generateSchedule } from '../generator';
import { applyGeneration, createSchedule, setCell } from '../scheduleOps';
import { configWith, THREE } from './fixtures';

const hoje = new Date(2026, 10, 16); // 16/11/2026
const nova = () => {
  const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE }, true);
  config.team = 'administrativa';
  return applyGeneration(createSchedule(2026, 11, config), generateSchedule(config), 0);
};

describe('avisos do sino', () => {
  it('escala sem conflito e sem trocas não gera aviso', () => {
    expect(avisosDasEscalas([nova()], { hoje })).toEqual([]);
  });

  it('conflito obrigatório gera aviso fixo com a contagem', () => {
    let s = nova();
    const cells = s.cells!;
    const emp = s.config.departments.recepcao.employees[0].id;
    for (const d of Object.keys(cells[emp])) s = setCell(s, emp, d, { status: 'T' }); // sem folgas: viola o 5x2
    const av = avisosDasEscalas([s], { hoje });
    const c = av.find((a) => a.tipo === 'conflito')!;
    expect(c.titulo).toMatch(/Coordenação Administrativa: a escala de novembro tem \d+ conflitos? obrigatórios?/);
    expect(c.dispensavel).toBe(false);
  });

  it('meses fora de atual/próximo são ignorados', () => {
    expect(avisosDasEscalas([nova()], { hoje: new Date(2027, 5, 1) })).toEqual([]);
  });

  it('troca feita por outra pessoa aparece; a minha e as já lidas não', () => {
    const s = nova();
    s.changeLog = [{ at: '2026-11-10T10:00:00Z', description: 'x', by: 'Ana' }, { at: '2026-11-11T10:00:00Z', description: 'y', by: 'Bia' }, { at: '2026-11-12T10:00:00Z', description: 'z' }];
    const a = avisosDasEscalas([s], { hoje, usuario: 'Bia' });
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ tipo: 'troca', dispensavel: true });
    expect(a[0].titulo).toContain('Ana alterou');
    expect(avisosDasEscalas([s], { hoje, usuario: 'Bia', lidoEm: '2026-11-13T00:00:00Z' })).toEqual([]);
  });

  it('férias que começam em até 7 dias e deixam conflito geram aviso por pessoa; sem conflito ou longe, não', () => {
    const s = nova();
    for (const e of s.config.departments.recepcao.employees) e.vacations = [{ start: '2026-11-18', end: '2026-11-27' }];
    const ferias = avisosDasEscalas([s], { hoje }).filter((a) => a.tipo === 'ferias');
    expect(ferias).toHaveLength(3);
    expect(ferias[0].titulo).toContain('entra de férias em 18/11');
    expect(avisosDasEscalas([s], { hoje: new Date(2026, 10, 1) }).filter((a) => a.tipo === 'ferias')).toHaveLength(0);
    expect(avisosDasEscalas([nova()], { hoje }).filter((a) => a.tipo === 'ferias')).toHaveLength(0);
  });

  it('carimbarAutor só marca entradas novas sem autor', () => {
    const log = [{ at: 'a', description: '1' }, { at: 'b', description: '2', by: 'Zé' }, { at: 'c', description: '3' }];
    expect(carimbarAutor(log, 1, 'Ana').map((e) => e.by)).toEqual([undefined, 'Zé', 'Ana']);
    expect(carimbarAutor(log, 0, undefined)).toBe(log);
  });
});
