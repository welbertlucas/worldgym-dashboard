// Escala em planilha (Excel), para folha de pagamento e controle de ponto.
// Aba "Escala": cada pessoa numa linha e cada dia do mês numa coluna (horário, folga, folga de feriado, férias).
// Aba "Horas": horas por semana e no mês, horas adicionais, feriados trabalhados, fins de semana e férias.
// A biblioteca (ExcelJS) é carregada só na hora de exportar.
import type { Analysis } from '../domain/analyze';
import { formatDayMonth, monthLabel, WEEKDAY_SHORT, weekdayOf } from '../domain/calendar';
import { formatShiftShort } from '../domain/time';
import { DEPT_IDS, deptEnabled, deptName, SHIFT_KIND_LABEL, isHourlyDept, teamName, type Schedule } from '../domain/types';
import { UNIDADES } from '../config/unidades';
import { totais, type PendenciaRelatorio, type RelatorioLinha, type SituacaoEscala } from '../domain/relatorio';

const COR = { F: 'FFFFF6DC', FE: 'FFE7F5EE', FR: 'FFEFECFB', COBRE: 'FFFDEEF1', CAB: 'FFF2F3F5', FIM: 'FFFBE9EC' } as const;
const horas = (min: number) => Math.round((min / 60) * 100) / 100;

export function excelFileName(s: Schedule): string {
  const unidade = UNIDADES.find((u) => u.id === s.unitId)?.nome ?? '';
  const slug = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `escala-5x2_${unidade ? `${slug(unidade)}_` : ''}${s.config.team ? `coordenacao-${s.config.team}_` : ''}${s.year}-${String(s.month).padStart(2, '0')}.xlsx`;
}

/** Linhas da escala (uma por pessoa, só departamentos incluídos): usadas pela planilha e pelos testes. */
export function excelRows(schedule: Schedule, analysis: Analysis) {
  const dias = analysis.range.monthDates;
  const linhas: { nome: string; dept: string; turno: string; dias: { texto: string; tipo: 'T' | 'F' | 'FE' | 'FR' | 'COBRE' }[]; trabalhados: number; horasMes: number }[] = [];
  for (const id of DEPT_IDS.filter((d) => deptEnabled(schedule.config, d))) {
    const da = analysis.depts[id];
    da.resolved.ctx.employees.forEach((emp, e) => {
      const stats = da.stats[e];
      const celulas = dias.map((date) => {
        const d = analysis.range.dates.indexOf(date);
        const c = da.resolved.cells[e][d];
        if (c.status === 'T') return { texto: c.shift ? formatShiftShort(c.shift) : 'T', tipo: c.origin === 'substituicao' ? 'COBRE' as const : 'T' as const };
        if (c.status === 'FE') return { texto: 'Folga feriado', tipo: 'FE' as const };
        if (c.status === 'FR') return { texto: 'Férias', tipo: 'FR' as const };
        return { texto: 'Folga', tipo: 'F' as const };
      });
      linhas.push({
        nome: emp.name, dept: deptName(id), turno: isHourlyDept(id) ? 'Horário livre' : SHIFT_KIND_LABEL[emp.kind],
        dias: celulas, trabalhados: stats.workedDays, horasMes: horas(stats.monthMinutes),
      });
    });
  }
  return linhas;
}

export async function buildScheduleXlsx(schedule: Schedule, analysis: Analysis): Promise<Blob> {
  const mod = await import('exceljs');
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Gerador de Escalas World Gym';
  const unidade = UNIDADES.find((u) => u.id === schedule.unitId)?.nome ?? '';
  const titulo = `Escala de ${monthLabel(schedule.year, schedule.month)}${schedule.config.team ? ` · ${teamName(schedule.config.team)}` : ''}${unidade ? ` · ${unidade}` : ''}`;
  const dias = analysis.range.monthDates;
  const fill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });
  const borda = { style: 'thin' as const, color: { argb: 'FFE0E3E8' } };
  const bordas = { top: borda, left: borda, bottom: borda, right: borda };

  // ===== Aba Escala =====
  const ws = wb.addWorksheet('Escala', { views: [{ state: 'frozen', xSplit: 3, ySplit: 4 }] });
  ws.getCell('A1').value = titulo;
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A2').value = `${schedule.status === 'confirmada' ? 'Versão final confirmada' : 'Rascunho'}${schedule.managerName ? ` · Elaborada por ${schedule.managerName}` : ''} · Gerada em ${new Date().toLocaleString('pt-BR')}`;
  ws.getCell('A2').font = { color: { argb: 'FF5F6570' }, size: 10 };
  const cab = ['Colaborador', 'Departamento', 'Turno', ...dias.map((d) => `${formatDayMonth(d)}\n${WEEKDAY_SHORT[weekdayOf(d)]}`), 'Dias trabalhados', 'Horas no mês'];
  const hr = ws.getRow(4);
  hr.values = cab;
  hr.height = 30;
  hr.eachCell((c, col) => {
    const d = dias[col - 4];
    const fimDeSemana = d && [0, 6].includes(weekdayOf(d));
    const feriado = d && schedule.config.holidays.some((h) => h.date === d);
    c.font = { bold: true, size: 10, color: { argb: feriado || fimDeSemana ? 'FFC41230' : 'FF1D2025' } };
    c.fill = fill(feriado ? COR.FIM : COR.CAB);
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = bordas;
  });
  const linhas = excelRows(schedule, analysis);
  linhas.forEach((l, i) => {
    const row = ws.getRow(5 + i);
    row.values = [l.nome, l.dept, l.turno, ...l.dias.map((d) => d.texto), l.trabalhados, l.horasMes];
    row.eachCell((c, col) => {
      c.border = bordas;
      c.font = { size: 10 };
      if (col > 3 && col <= 3 + dias.length) {
        const tipo = l.dias[col - 4].tipo;
        if (tipo !== 'T') c.fill = fill(COR[tipo]);
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      }
    });
    row.getCell(cab.length).numFmt = '0.00';
  });
  ws.getColumn(1).width = 26;
  ws.getColumn(2).width = 22;
  ws.getColumn(3).width = 18;
  for (let c = 4; c <= 3 + dias.length; c++) ws.getColumn(c).width = 9;
  ws.getColumn(cab.length - 1).width = 11;
  ws.getColumn(cab.length).width = 11;
  const legenda = 6 + linhas.length;
  ws.getCell(`A${legenda}`).value = 'Legenda: horário = trabalha nesse horário · Folga · Folga feriado (folga de feriado) · Férias · fundo rosa = cobrindo outro turno.';
  ws.getCell(`A${legenda}`).font = { size: 9, color: { argb: 'FF5F6570' } };

  // ===== Aba Horas =====
  const hs = wb.addWorksheet('Horas', { views: [{ state: 'frozen', xSplit: 2, ySplit: 4 }] });
  hs.getCell('A1').value = `Horas — ${titulo}`;
  hs.getCell('A1').font = { bold: true, size: 14 };
  hs.getCell('A2').value = 'Horas efetivas (sem intervalos). Semanas de segunda a domingo; semanas que começam ou terminam em outro mês trazem os dias desse mês.';
  hs.getCell('A2').font = { color: { argb: 'FF5F6570' }, size: 10 };
  const semanas = analysis.range.weeks;
  const cabH = ['Colaborador', 'Departamento', 'Contratada (h/semana)', ...semanas.map((w) => `Semana ${w.index}\n${formatDayMonth(w.start)}–${formatDayMonth(w.end)}`),
    'Total no mês (h)', 'Horas adicionais (h)', 'Dias trabalhados', 'Folgas', 'Folgas de feriado', 'Feriados trabalhados', 'Sábados', 'Domingos', 'Férias (dias)', 'Coberturas'];
  const hh = hs.getRow(4);
  hh.values = cabH;
  hh.height = 32;
  hh.eachCell((c) => { c.font = { bold: true, size: 10 }; c.fill = fill(COR.CAB); c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; c.border = bordas; });
  let r = 5;
  for (const id of DEPT_IDS.filter((d) => deptEnabled(schedule.config, d))) {
    const da = analysis.depts[id];
    da.resolved.ctx.employees.forEach((emp, e) => {
      const s = da.stats[e];
      const row = hs.getRow(r++);
      row.values = [emp.name, deptName(id), emp.weeklyContractedHours, ...s.weekMinutes.map(horas), horas(s.monthMinutes), horas(s.weekExtra.reduce((a, b) => a + b, 0)),
        s.workedDays, s.offDays, s.holidayDays, s.holidaysWorked, s.saturdays, s.sundays, s.vacationDays, s.substitutions];
      row.eachCell((c, col) => {
        c.border = bordas;
        c.font = { size: 10 };
        if (col >= 3) { c.alignment = { horizontal: 'center' }; if (col <= 5 + semanas.length) c.numFmt = '0.00'; }
      });
    });
  }
  hs.getColumn(1).width = 26;
  hs.getColumn(2).width = 22;
  for (let c = 3; c <= cabH.length; c++) hs.getColumn(c).width = 13;

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export interface RelatorioMeta {
  year: number;
  month: number;
  /** "Asa Norte", "Toda a rede"… */
  escopo: string;
  pendencias: PendenciaRelatorio[];
}

const MOTIVO: Record<PendenciaRelatorio['motivo'], string> = { 'sem-escala': 'sem escala', 'em-configuracao': 'escala ainda não gerada', rascunho: 'escala em rascunho (não confirmada)' };
export const textoPendencias = (p: PendenciaRelatorio[]) => p.map((x) => `${x.unidade} · ${x.coordenacao} (${MOTIVO[x.motivo]})`).join('; ');
const SITUACAO: Record<SituacaoEscala, string> = { confirmada: 'Confirmada', rascunho: 'Rascunho', 'em-configuracao': 'Em configuração' };

export function relatorioFileName(meta: RelatorioMeta, ext: 'xlsx' | 'pdf'): string {
  const slug = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `relatorio-contabilidade_${slug(meta.escopo)}_${meta.year}-${String(meta.month).padStart(2, '0')}.${ext}`;
}

/** Relatório mensal em planilha: aba "Pessoas" (uma linha por colaborador, com totais) e aba "Por unidade". */
export async function buildRelatorioXlsx(linhas: RelatorioLinha[], meta: RelatorioMeta): Promise<Blob> {
  const mod = await import('exceljs');
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Gerador de Escalas World Gym';
  const fill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });
  const borda = { style: 'thin' as const, color: { argb: 'FFE0E3E8' } };
  const bordas = { top: borda, left: borda, bottom: borda, right: borda };
  const titulo = `Relatório para a contabilidade · ${monthLabel(meta.year, meta.month)} · ${meta.escopo}`;
  const emitido = `Gerado em ${new Date().toLocaleString('pt-BR')}. Horas efetivas, sem intervalos. Horas adicionais: acima da jornada contratada nas semanas do mês (semanas que atravessam o mês entram inteiras).`;
  const cab = (ws: import('exceljs').Worksheet, linha: number, colunas: string[]) => {
    const r = ws.getRow(linha);
    r.values = colunas;
    r.height = 32;
    r.eachCell((c) => { c.font = { bold: true, size: 10 }; c.fill = fill(COR.CAB); c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; c.border = bordas; });
  };
  const topo = (ws: import('exceljs').Worksheet) => {
    ws.getCell('A1').value = titulo;
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.getCell('A2').value = emitido;
    ws.getCell('A2').font = { color: { argb: 'FF5F6570' }, size: 9 };
    if (meta.pendencias.length) {
      ws.getCell('A3').value = `Atenção, ainda não confirmado: ${textoPendencias(meta.pendencias)}. Os números podem mudar até a confirmação.`;
      ws.getCell('A3').font = { color: { argb: 'FFA45904' }, bold: true, size: 9.5 };
    }
  };

  // ===== Pessoas =====
  const ws = wb.addWorksheet('Pessoas', { views: [{ state: 'frozen', xSplit: 4, ySplit: 5 }] });
  topo(ws);
  const colunas = ['Unidade', 'Coordenação', 'Departamento', 'Colaborador', 'Escala', 'Contratada (h/semana)', 'Dias trabalhados', 'Horas no mês (h)', 'Horas adicionais (h)', 'Folgas', 'Folgas de feriado', 'Feriados trabalhados', 'Sábados', 'Domingos', 'Férias (dias)', 'Coberturas'];
  cab(ws, 5, colunas);
  linhas.forEach((l, i) => {
    const r = ws.getRow(6 + i);
    r.values = [l.unidade, l.coordenacao, l.departamento, l.nome, SITUACAO[l.situacao], l.contratada, l.diasTrabalhados, horas(l.minutosNoMes), horas(l.minutosAdicionais), l.folgas, l.folgasFeriado, l.feriadosTrabalhados, l.sabados, l.domingos, l.diasFerias, l.coberturas];
    r.eachCell((c, col) => {
      c.border = bordas;
      c.font = { size: 10, ...(l.situacao !== 'confirmada' && col === 5 ? { color: { argb: 'FFA45904' } } : {}) };
      if (col >= 6) c.alignment = { horizontal: 'center' };
      if (col === 8 || col === 9) c.numFmt = '0.00';
    });
  });
  const t = totais(linhas);
  const rt = ws.getRow(6 + linhas.length);
  rt.values = ['Total', '', '', `${t.pessoas} pessoas`, '', '', t.diasTrabalhados, horas(t.minutosNoMes), horas(t.minutosAdicionais), '', '', t.feriadosTrabalhados, '', '', t.diasFerias, ''];
  rt.eachCell({ includeEmpty: true }, (c, col) => { c.font = { bold: true, size: 10 }; c.fill = fill(COR.CAB); c.border = bordas; if (col >= 6) c.alignment = { horizontal: 'center' }; if (col === 8 || col === 9) c.numFmt = '0.00'; });
  [24, 24, 20, 28, 14, 12, 11, 12, 12, 8, 10, 11, 9, 10, 9, 11].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // ===== Por unidade =====
  const wu = wb.addWorksheet('Por unidade', { views: [{ state: 'frozen', ySplit: 5 }] });
  topo(wu);
  cab(wu, 5, ['Unidade', 'Coordenação', 'Escala', 'Pessoas', 'Dias trabalhados', 'Horas no mês (h)', 'Horas adicionais (h)', 'Feriados trabalhados', 'Férias (dias)']);
  const grupos = new Map<string, RelatorioLinha[]>();
  for (const l of linhas) grupos.set(`${l.unidade}|${l.team}`, [...(grupos.get(`${l.unidade}|${l.team}`) ?? []), l]);
  let k = 0;
  for (const g of grupos.values()) {
    const tg = totais(g);
    const r = wu.getRow(6 + k++);
    r.values = [g[0].unidade, g[0].coordenacao, SITUACAO[g[0].situacao], tg.pessoas, tg.diasTrabalhados, horas(tg.minutosNoMes), horas(tg.minutosAdicionais), tg.feriadosTrabalhados, tg.diasFerias];
    r.eachCell((c, col) => { c.border = bordas; c.font = { size: 10 }; if (col >= 4) c.alignment = { horizontal: 'center' }; if (col === 6 || col === 7) c.numFmt = '0.00'; });
  }
  [26, 26, 16, 10, 12, 14, 14, 12, 10].forEach((w, i) => { wu.getColumn(i + 1).width = w; });

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
