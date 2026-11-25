import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configWith, FIVE, THREE } from '../domain/__tests__/fixtures';
import { weekdayOf } from '../domain/calendar';
import { generateSchedule } from '../domain/generator';
import { analyze, applyGeneration, confirmSchedule, createSchedule, setCell } from '../domain/scheduleOps';
import { buildSchedulePdf, pdfFileName, withLayoutSuffix } from './exportPdf';

/** Texto do PDF com os parênteses desescapados (no PDF eles aparecem como \\( e \\)). */
function pdfText(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString('latin1').replace(/\\([()])/g, '$1');
}

describe('exportação em PDF (aceite 15)', () => {
  const config = configWith(2026, 12, { recepcao: THREE, apoio: ['abertura', 'abertura', 'fechamento', 'fechamento'] }, true);
  const schedule = confirmSchedule(applyGeneration(createSchedule(2026, 12, config), generateSchedule(config), 0));
  const analysis = analyze(schedule)!;

  it('gera um PDF real, A4 paisagem, com os dois departamentos na mesma página', () => {
    const doc = buildSchedulePdf(schedule, analysis, { generatedAt: new Date(2026, 10, 29, 10, 30), font: 'helvetica', managerName: 'Mariana Costa' });
    const text = pdfText(doc.output('arraybuffer'));
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    const { width, height } = doc.internal.pageSize;
    expect(Math.round(width)).toBe(297);
    expect(Math.round(height)).toBe(210);
    expect(doc.getNumberOfPages()).toBe(1);
    expect(text).toContain('/Subtype /Image'); // logo
    for (const s of [
      'Escala de Trabalho 5x2', 'Dezembro de 2026', 'Desenvolvido por Flag Holding LTDA - WG Master Franchise Brasil', 'RECEPÇÃO', 'SERVIÇOS GERAIS',
      'Rec 1', 'Apoio 4', 'Equipe no dia', 'SUBSTITUIÇÕES DO MÊS', 'Quem cobre', 'No lugar de', 'Feriado (folga)', 'Natal',
      'CIENTE DA ESCALA', 'Escala elaborada por', 'Mariana Costa', 'em 29/11/2026', 'Documento gerado em 29/11/2026 10:30', 'Cobrindo',
    ]) expect(text).toContain(s);
    expect(text).toContain('(31)'); // todos os dias do mês
    // Uma assinatura por colaborador (3 + 4); o gestor já vem identificado no cabeçalho
    expect(text.split('Data: ___').length - 1).toBe(7);
    expect(text).not.toContain('Gestor(a) responsável');
    // Não exibe status, saldo nem pendências para os colaboradores
    for (const s of ['RASCUNHO', 'VERSÃO FINAL', 'saldo', 'Saldo', 'PENDÊNCIAS', 'HORAS TRABALHADAS', 'Total no mês']) expect(text).not.toContain(s);
    // Cada substituição do mês aparece no quadro (dia, quem cobre e no lugar de quem)
    const { resolved } = analysis.depts.recepcao;
    const sub = resolved.substitutions.find((ev) => ev.outcome === 'aplicada' && analysis.range.inMonth(resolved.ctx.dates[ev.dateIndex]));
    expect(sub).toBeDefined();
    const [, mm, dd] = resolved.ctx.dates[sub!.dateIndex].split('-');
    expect(text).toContain(`${dd}/${mm}`);
    expect(text).toContain(resolved.ctx.employees.find((x) => x.id === sub!.substituteId)!.name);
  });

  it('a página de pendências só aparece quando o gestor pede', () => {
    // Fechamento e intermediário de folga no mesmo dia útil: ninguém fecha
    const dia = analysis.range.monthDates.find((d) => ![0, 6].includes(weekdayOf(d)) && schedule.cells!['recepcao-3'][d].status === 'T' && schedule.cells!['recepcao-2'][d].status === 'T')!;
    const invalid = setCell(setCell(schedule, 'recepcao-3', dia, { status: 'F' }), 'recepcao-2', dia, { status: 'F' });
    const a = analyze(invalid)!;
    expect(a.valid).toBe(false);
    expect(pdfText(buildSchedulePdf(invalid, a, { font: 'helvetica' }).output('arraybuffer'))).not.toContain('Fechamento sem cobertura');
    const withAlerts = pdfText(buildSchedulePdf(invalid, a, { includeAlerts: true, font: 'helvetica' }).output('arraybuffer'));
    expect(withAlerts).toContain('PENDÊNCIAS DA ESCALA (USO DO GESTOR)');
    expect(withAlerts).toContain('Fechamento sem cobertura');
  });

  it('usa a fonte Montserrat embutida e continua cabendo em uma folha', () => {
    const doc = buildSchedulePdf(schedule, analysis);
    const raw = Buffer.from(doc.output('arraybuffer')).toString('latin1');
    expect(raw).toContain('/FontFile2');
    expect(raw).toMatch(/\/BaseFont \/\w*Montserrat/);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('mostra a unidade no cabeçalho e no nome do arquivo quando escolhida', () => {
    const withUnit = { ...schedule, unitId: 'asa-norte' };
    const text = pdfText(buildSchedulePdf(withUnit, analysis, { font: 'helvetica', managerName: 'Mariana Costa' }).output('arraybuffer'));
    expect(text).toContain('Unidade Asa Norte · Dezembro de 2026');
    expect(pdfFileName(withUnit)).toBe('escala-5x2_asa-norte_2026-12.pdf');
    expect(pdfFileName({ ...schedule, unitId: 'jardim-inga' })).toBe('escala-5x2_jardim-inga_2026-12.pdf');
  });

  it('nomeia o arquivo só com o mês quando não há unidade', () => {
    expect(pdfFileName(schedule)).toBe('escala-5x2_2026-12.pdf');
  });

  it('com 5 colaboradores em cada departamento, continua em uma página', () => {
    const c5 = configWith(2026, 12, { recepcao: FIVE, apoio: FIVE }, true);
    c5.departments.recepcao.maxSimultaneous = 5;
    c5.departments.apoio.maxSimultaneous = 5;
    const s5 = confirmSchedule(applyGeneration(createSchedule(2026, 12, c5), generateSchedule(c5), 0));
    const doc = buildSchedulePdf(s5, analyze(s5)!, { generatedAt: new Date(2026, 10, 29, 10, 30), font: 'helvetica', managerName: 'Mariana Costa' });
    expect(doc.getNumberOfPages()).toBe(1);
    const text = pdfText(doc.output('arraybuffer'));
    for (const n of ['Rec 5', 'Apoio 5']) expect(text).toContain(n);
  });

  it('formato semanal: uma página por semana, com o horário de cada dia', () => {
    const doc = buildSchedulePdf(schedule, analysis, { generatedAt: new Date(2026, 10, 29, 10, 30), font: 'helvetica', managerName: 'Mariana Costa', layout: 'semana', includeSignature: false });
    const weeks = analysis.range.weeks.length;
    expect(doc.getNumberOfPages()).toBe(weeks);
    const text = pdfText(doc.output('arraybuffer'));
    for (const s of ['Semana 1 (', 'SUBSTITUIÇÕES DA SEMANA', 'Trabalho (com o horário)', 'Natal']) expect(text).toContain(s);
    expect(pdfFileName(schedule).replace('.pdf', '_semanal.pdf')).toBe(withLayoutSuffix(pdfFileName(schedule), 'semana'));
  });

  it('separado por departamento: cada um em sua página, com as assinaturas da própria equipe', () => {
    const doc = buildSchedulePdf(schedule, analysis, { generatedAt: new Date(2026, 10, 29, 10, 30), font: 'helvetica', managerName: 'Mariana Costa', departments: 'separados' });
    expect(doc.getNumberOfPages()).toBe(2);
    const pageText = (n: number) => {
      const d = buildSchedulePdf(schedule, analysis, { generatedAt: new Date(2026, 10, 29, 10, 30), font: 'helvetica', managerName: 'Mariana Costa', departments: n === 1 ? 'recepcao' : 'apoio' });
      expect(d.getNumberOfPages()).toBe(1);
      return pdfText(d.output('arraybuffer'));
    };
    const rec = pageText(1);
    expect(rec).toContain('Recepção · Dezembro de 2026');
    expect(rec).toContain('Rec 1');
    expect(rec).not.toContain('Apoio 1');
    const apo = pageText(2);
    expect(apo).toContain('Apoio 4');
    expect(apo).not.toContain('Rec 1');
    expect(withLayoutSuffix('x.pdf', 'semana', 'recepcao')).toBe('x_recepcao_semanal.pdf');
    expect(withLayoutSuffix('x.pdf', 'mes', 'separados')).toBe('x_por-departamento.pdf');
  });

  it('com Professores: separados em 3 páginas e "Só Professores" com a assinatura dos professores', () => {
    const cp = configWith(2026, 12, { recepcao: THREE, apoio: THREE, professores: THREE }, true);
    const sp = confirmSchedule(applyGeneration(createSchedule(2026, 12, cp), generateSchedule(cp), 0));
    const ap = analyze(sp)!;
    const opts = { generatedAt: new Date(2026, 10, 29, 10, 30), font: 'helvetica' as const, managerName: 'Mariana Costa' };
    expect(buildSchedulePdf(sp, ap, { ...opts, departments: 'separados' }).getNumberOfPages()).toBe(3);
    const only = buildSchedulePdf(sp, ap, { ...opts, departments: 'professores' });
    expect(only.getNumberOfPages()).toBe(1);
    const text = pdfText(only.output('arraybuffer'));
    expect(text).toContain('Professores · Dezembro de 2026');
    expect(text).toContain('Prof 1');
    expect(text).not.toContain('Rec 1');
    expect(text).not.toContain('SUBSTITUIÇÕES');
    // Escala sem professores: a opção "Só Professores" não gera páginas
    expect(() => buildSchedulePdf(schedule, analysis, { ...opts, departments: 'professores' })).toThrow();
  });
});

