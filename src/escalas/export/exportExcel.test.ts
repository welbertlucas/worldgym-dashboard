import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { configWith, THREE } from '../domain/__tests__/fixtures';
import { generateSchedule } from '../domain/generator';
import { applyGeneration, createSchedule, analyze } from '../domain/scheduleOps';
import { buildScheduleXlsx, excelFileName, excelRows } from './exportExcel';

describe('exportar para Excel', () => {
  const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE }, true);
  const s = { ...applyGeneration(createSchedule(2026, 11, config, 'asa-norte', 'administrativa'), generateSchedule(config), 0), managerName: 'Mariana' };
  const a = analyze(s)!;

  it('uma linha por pessoa e uma coluna por dia do mês', () => {
    const rows = excelRows(s, a);
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.dias.length === 30)).toBe(true);
    expect(rows.flatMap((r) => r.dias.map((d) => d.tipo))).toContain('FE');
    expect(rows[0].horasMes).toBeGreaterThan(100);
  });

  it('gera a planilha com as abas Escala e Horas', async () => {
    const blob = await buildScheduleXlsx(s, a);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Escala', 'Horas']);
    const esc = wb.getWorksheet('Escala')!;
    expect(String(esc.getCell('A1').value)).toContain('Novembro de 2026');
    expect(esc.getCell('A5').value).toBe('Rec 1');
    const horas = wb.getWorksheet('Horas')!;
    expect(horas.getCell('A5').value).toBe('Rec 1');
    expect(excelFileName(s)).toBe('escala-5x2_asa-norte_coordenacao-administrativa_2026-11.xlsx');
  });
});
