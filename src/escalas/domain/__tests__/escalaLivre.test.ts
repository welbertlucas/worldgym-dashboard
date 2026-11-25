import { describe, expect, it } from 'vitest';
import { analyze, applyGeneration, createSchedule, setCell } from '../scheduleOps';
import { gerarLivre, generateSchedule } from '../generator';
import { configWith, THREE } from './fixtures';
import { LIVRE_LIMITE_SEMANAL_HORAS, livreLimiteSemanal } from '../validate';
import { newIntern } from '../defaults';

// Pessoas e horários fictícios. Novembro de 2026: 1º/11 é domingo; as semanas vão de domingo a sábado.
const livre = () => { const c = configWith(2026, 11, { recepcao: THREE, apoio: THREE }); c.livre = true; return c; };
const montar = () => {
  const base = createSchedule(2026, 11, livre());
  base.config.livre = true; // quem cria a escala (Home) liga o modo livre depois de criá-la: ele não vem por herança
  return applyGeneration(base, gerarLivre(base.config), 0);
};
const alertas = (s: ReturnType<typeof montar>, code?: string) => (analyze(s)?.alerts ?? []).filter((a) => !code || a.code === code);

describe('escala livre', () => {
  it('monta a base: todo mundo trabalha de segunda a sexta e folga no fim de semana, sem nenhum conflito', () => {
    const s = montar();
    expect(s.config.livre).toBe(true);
    const grade = s.cells!['recepcao-1'];
    expect(grade['2026-11-02'].status).toBe('T'); // segunda
    expect(grade['2026-11-06'].status).toBe('T'); // sexta
    expect(grade['2026-11-07'].status).toBe('F'); // sábado
    expect(grade['2026-11-08'].status).toBe('F'); // domingo
    expect(analyze(s)!.valid).toBe(true);
    expect(s.generation?.feasible).toBe(true);
  });

  it('o gerador comum não é usado: generateSchedule devolve a base livre', () => {
    const r = generateSchedule(livre());
    expect(r.feasible).toBe(true);
    expect(r.cells['apoio-3']['2026-11-03'].status).toBe('T');
  });

  it('nenhuma regra de folga, cobertura ou descanso gera alerta: 7 dias seguidos, ninguém na unidade num dia e sem folga', () => {
    let s = montar();
    for (const emp of ['recepcao-1', 'recepcao-2', 'recepcao-3', 'apoio-1', 'apoio-2', 'apoio-3'])
      for (const dia of ['2026-11-07', '2026-11-08']) s = setCell(s, emp, dia, { status: 'T' });
    // recepcao-1 também trabalha de domingo a sábado sem folga nenhuma, e o dia 11 fica sem ninguém
    for (const emp of ['recepcao-1', 'recepcao-2', 'recepcao-3', 'apoio-1', 'apoio-2', 'apoio-3']) s = setCell(s, emp, '2026-11-11', { status: 'F' });
    const a = alertas(s).filter((x) => x.severity === 'critico');
    expect(a.filter((x) => x.code !== 'LIMITE_SEMANAL')).toEqual([]);
  });

  it('a única trava: passou de 42 horas na semana é conflito obrigatório e a escala não fica válida', () => {
    let s = montar();
    // semana de 8 a 14/11: 5 dias de 8h24 (42h) + sábado 14/11 = 50h24
    s = setCell(s, 'recepcao-1', '2026-11-14', { status: 'T' });
    s = setCell(s, 'recepcao-1', '2026-11-08', { status: 'T' });
    const a = alertas(s, 'LIMITE_SEMANAL');
    expect(a.length).toBeGreaterThan(0);
    expect(a[0].severity).toBe('critico');
    expect(a[0].message).toContain(`${LIVRE_LIMITE_SEMANAL_HORAS}h`);
    expect(analyze(s)!.valid).toBe(false);
  });

  it('estagiários mantêm o limite de 30 horas por semana (Lei do Estágio); os demais, 42', () => {
    const c = livre();
    c.departments.estagiarios.enabled = true;
    const est = newIntern();
    est.id = 'estagiarios-1';
    est.name = 'Est 1';
    c.departments.estagiarios.employees = [est];
    const base = createSchedule(2026, 11, c);
    base.config.livre = true;
    let s = applyGeneration(base, gerarLivre(base.config), 0);
    // base: segunda a sexta; o estagiário tem turno de 5h por dia = 25h na semana: vale
    expect(alertas(s, 'LIMITE_SEMANAL')).toEqual([]);
    // sexta e sábado de 6h somam mais de 30h na semana de 8 a 14/11 só para ele: precisa estourar os 30h mas ficar abaixo de 42h
    const seis = { start: '08:00', end: '14:15', breakStart: '11:00', breakEnd: '11:15' };
    for (const dia of ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14']) s = setCell(s, 'estagiarios-1', dia, { status: 'T', manualShift: seis });
    const a = alertas(s, 'LIMITE_SEMANAL');
    expect(a.length).toBeGreaterThan(0);
    expect(a[0].message).toContain('limite 30h');
    expect(a[0].message).toContain('Lei do Estágio');
    expect(livreLimiteSemanal('estagiarios')).toBe(30);
    expect(livreLimiteSemanal('recepcao')).toBe(42);
  });

  it('exatamente 42 horas na semana ainda vale', () => {
    const s = montar();
    expect(alertas(s, 'LIMITE_SEMANAL')).toEqual([]);
    expect(analyze(s)!.counts.critico).toBe(0);
  });

  it('não pede validação dos parâmetros nem avisa semana incompleta', () => {
    const s = montar();
    expect(alertas(s, 'PARAMETROS_NAO_VALIDADOS')).toEqual([]);
    expect(alertas(s, 'SEMANA_INCOMPLETA')).toEqual([]);
  });

  it('uma escala nova a partir de uma escala livre não herda o modo livre', () => {
    const base = montar();
    const nova = createSchedule(2026, 12, base.config);
    expect(nova.config.livre).toBeUndefined();
  });

  it('a escala comum continua com todas as regras (a livre não as desliga para as outras)', () => {
    const c = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
    const base = createSchedule(2026, 11, c);
    const s = applyGeneration(base, { cells: Object.fromEntries(Object.entries(gerarLivre({ ...c, livre: true }).cells)), feasible: true, conflicts: [] }, 0);
    // com as regras de verdade, a base "segunda a sexta" deixa a unidade sem cobertura no fim de semana
    expect(analyze(s)!.alerts.some((a) => a.code !== 'LIMITE_SEMANAL' && a.severity === 'critico')).toBe(true);
  });
});
