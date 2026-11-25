import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configWith, THREE } from '../domain/__tests__/fixtures';
import { generateSchedule } from '../domain/generator';
import { linhasDoRelatorio, pendenciasDoRelatorio } from '../domain/relatorio';
import { applyGeneration, confirmSchedule, createSchedule } from '../domain/scheduleOps';
import { buildRelatorioPdf } from './exportPdf';
import { buildRelatorioXlsx, relatorioFileName } from '../export/exportExcel';

const pdfText = (bytes: ArrayBuffer) => Buffer.from(bytes).toString('latin1').replace(/\\([()])/g, '$1');

describe('relatório para a contabilidade (PDF e Excel)', () => {
  const config = configWith(2026, 12, { recepcao: THREE, apoio: THREE }, true);
  config.team = 'administrativa';
  const gerada = { ...applyGeneration(createSchedule(2026, 12, config), generateSchedule(config), 0), unitId: 'asa-norte' };
  const confirmada = confirmSchedule(gerada);
  const linhas = linhasDoRelatorio([confirmada]);
  const meta = { year: 2026, month: 12, escopo: 'Asa Norte', pendencias: pendenciasDoRelatorio([confirmada], ['asa-norte']) };

  it('PDF com título, escopo, pessoas e totais, sem aviso quando tudo está confirmado', () => {
    const t = pdfText(buildRelatorioPdf(linhas, { ...meta, pendencias: [] }, { font: 'helvetica' }).output('arraybuffer'));
    for (const s of ['Relatório para a contabilidade', 'Asa Norte', 'Rec 1', 'Apoio 3', 'Total geral', 'Horas no mês']) expect(t).toContain(s);
    expect(t).not.toContain('Atenção, ainda não confirmado');
  });

  it('PDF avisa quando há escala não confirmada', () => {
    const l = linhasDoRelatorio([gerada]);
    const m = { ...meta, pendencias: pendenciasDoRelatorio([gerada], ['asa-norte']) };
    const t = pdfText(buildRelatorioPdf(l, m, { font: 'helvetica' }).output('arraybuffer'));
    expect(t).toContain('Atenção, ainda não confirmado');
    expect(t).toContain('rascunho');
    expect(t).toContain('sem escala');
  });

  it('PDF sem escalas fala isso com clareza', () => {
    const t = pdfText(buildRelatorioPdf([], { ...meta, pendencias: [] }, { font: 'helvetica' }).output('arraybuffer'));
    expect(t).toContain('Nenhuma escala gerada neste m');
  });

  it('Excel válido, com nome de arquivo do escopo e do mês', async () => {
    expect(relatorioFileName(meta, 'xlsx')).toBe('relatorio-contabilidade_asa-norte_2026-12.xlsx');
    expect(relatorioFileName({ ...meta, escopo: 'Toda a rede' }, 'pdf')).toBe('relatorio-contabilidade_toda-a-rede_2026-12.pdf');
    const blob = await buildRelatorioXlsx(linhas, meta);
    const bytes = Buffer.from(await blob.arrayBuffer());
    expect(bytes.subarray(0, 2).toString()).toBe('PK');
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes as never);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Pessoas', 'Por unidade']);
    const ws = wb.getWorksheet('Pessoas')!;
    expect(ws.getRow(5).getCell(4).value).toBe('Colaborador');
    expect(ws.getRow(6).getCell(4).value).toBe('Rec 1');
    expect(ws.getRow(6 + linhas.length).getCell(1).value).toBe('Total');
  });
});
