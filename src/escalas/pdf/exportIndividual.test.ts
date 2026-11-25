import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configWith, THREE } from '../domain/__tests__/fixtures';
import { generateSchedule } from '../domain/generator';
import { analyze, applyGeneration, confirmSchedule, createSchedule } from '../domain/scheduleOps';
import { buildIndividualPdf, individualFileName, individualPeople } from './exportPdf';

const pdfText = (bytes: ArrayBuffer) => Buffer.from(bytes).toString('latin1').replace(/\\([()])/g, '$1');

describe('escala individual em PDF', () => {
  const config = configWith(2026, 12, { recepcao: THREE, apoio: ['abertura', 'abertura', 'fechamento', 'fechamento'] }, true);
  const schedule = { ...confirmSchedule(applyGeneration(createSchedule(2026, 12, config), generateSchedule(config), 0)), unitId: 'asa-norte' };
  const analysis = analyze(schedule)!;

  it('uma página por pessoa, só com os dias dela', () => {
    const total = individualPeople(schedule, analysis).length;
    expect(total).toBe(7);
    const doc = buildIndividualPdf(schedule, analysis, { font: 'helvetica', managerName: 'Mariana Costa' });
    expect(doc.getNumberOfPages()).toBe(total);
    const t = pdfText(doc.output('arraybuffer'));
    for (const n of ['Rec 1', 'Rec 3', 'Apoio 4']) expect(t).toContain(n);
    expect(t).toContain('Escala individual');
    expect(t).toContain('Folga');
    expect(t).toContain('Suas folgas');
    expect(t).toContain('Escala elaborada por Mariana Costa');
    expect(t).toContain('Natal');
  });

  it('uma pessoa só gera uma página, sem horas somadas e sem saldos', () => {
    const doc = buildIndividualPdf(schedule, analysis, { font: 'helvetica', employeeIds: ['recepcao-2'] });
    expect(doc.getNumberOfPages()).toBe(1);
    const t = pdfText(doc.output('arraybuffer'));
    expect(t).toContain('Rec 2');
    expect(t).not.toContain('Rec 1');
    for (const s of ['saldo', 'Saldo', 'Horas trabalhadas', 'Total no mês']) expect(t).not.toContain(s);
  });

  it('a assinatura é opcional e a escolha vazia dá erro claro', () => {
    const sem = pdfText(buildIndividualPdf(schedule, analysis, { font: 'helvetica', employeeIds: ['recepcao-1'], includeSignature: false }).output('arraybuffer'));
    expect(sem).not.toContain('Ciente da escala');
    expect(() => buildIndividualPdf(schedule, analysis, { font: 'helvetica', employeeIds: ['nao-existe'] })).toThrow(/ao menos uma pessoa/);
  });

  it('nome do arquivo', () => {
    expect(individualFileName(schedule)).toBe('escala-5x2_asa-norte_2026-12_individual.pdf');
    expect(individualFileName(schedule, 'Ana Souza')).toBe('escala-5x2_asa-norte_2026-12_individual-ana-souza.pdf');
  });

  it('folga de feriado e dia de outro mês não aparecem como trabalho', () => {
    const doc = buildIndividualPdf(schedule, analysis, { font: 'helvetica', employeeIds: ['recepcao-1'] });
    expect(doc.getNumberOfPages()).toBe(1);
  });
});
