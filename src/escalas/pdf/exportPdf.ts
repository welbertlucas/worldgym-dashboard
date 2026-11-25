import { jsPDF } from 'jspdf';
import autoTable, { type CellDef, type RowInput } from 'jspdf-autotable';
import type { Analysis } from '../domain/analyze';
import { formatDayMonth, monthLabel, WEEKDAY_LONG, WEEKDAY_SHORT } from '../domain/calendar';
import { formatDuration, formatShiftShort } from '../domain/time';
import { totais, type PendenciaRelatorio, type RelatorioLinha, type SituacaoEscala } from '../domain/relatorio';
import { DEPT_IDS, deptEnabled, deptName, isHourlyDept, offByRegime, teamName, memberLabel, SHIFT_KIND_LABEL, type Alert, type DeptId, type Schedule, type Weekday } from '../domain/types';
import { MONTSERRAT_BOLD, MONTSERRAT_REGULAR } from './fontData';
import { LOGO_PNG, LOGO_RATIO } from './logoData';
import { APP_NAME, DEVELOPED_BY as CREDIT } from '../config/marca';
import { combinedFileName, pdfFileName, unitName, type PdfDepartments, type PdfItem, type PdfLayout } from './names';
export { combinedFileName, individualFileName, pdfFileName, unitName, withLayoutSuffix, type PdfDepartments, type PdfItem, type PdfLayout } from './names';

/** Fonte do documento (definida a cada geração; o código de desenho é síncrono). */
let FONT = 'Montserrat';

function registerFonts(doc: jsPDF) {
  doc.addFileToVFS('Montserrat-Regular.ttf', MONTSERRAT_REGULAR);
  doc.addFont('Montserrat-Regular.ttf', 'Montserrat', 'normal');
  doc.addFileToVFS('Montserrat-Bold.ttf', MONTSERRAT_BOLD);
  doc.addFont('Montserrat-Bold.ttf', 'Montserrat', 'bold');
}

type RGB = [number, number, number];
const RED: RGB = [196, 18, 48];
const DARK: RGB = [26, 26, 26];
const GREY: RGB = [110, 110, 110];
const LINE: RGB = [210, 210, 210];
/** Cores das células — as mesmas do calendário na tela. */
const COLORS = {
  T: { fill: [241, 242, 244] as RGB, text: [31, 35, 41] as RGB },
  S: { fill: [253, 236, 239] as RGB, text: [163, 15, 40] as RGB },
  F: { fill: [255, 244, 214] as RGB, text: [138, 97, 0] as RGB },
  FE: { fill: [228, 243, 236] as RGB, text: [30, 122, 85] as RGB },
  FR: { fill: [235, 231, 250] as RGB, text: [90, 63, 176] as RGB },
};
const HEAD_FILL: RGB = [255, 255, 255];
const HEAD_TEXT: RGB = [70, 70, 70];
const SOFT: RGB = [241, 242, 244];

export const DEVELOPED_BY = `${APP_NAME} · ${CREDIT}`;

export interface PdfOptions {
  generatedAt?: Date;
  includeSignature?: boolean;
  /** Página de pendências e alertas (uso do gestor). Desligada por padrão. */
  includeAlerts?: boolean;
  /** Gestor que elaborou a escala (impresso no cabeçalho; dispensa a assinatura do gestor). */
  managerName?: string;
  /** Compacta o arquivo (padrão nos downloads). */
  compress?: boolean;
  /** 'montserrat' (padrão) ou 'helvetica' (fonte básica do PDF; usada nos testes de conteúdo). */
  font?: 'montserrat' | 'helvetica';
  /** 'mes' (padrão): o mês inteiro em uma página; 'semana': uma página por semana, com quadros maiores. */
  layout?: PdfLayout;
  /**
   * 'ambos' (padrão): os dois departamentos juntos; 'separados': cada departamento em páginas próprias,
   * com as assinaturas da sua equipe; ou só um departamento.
   */
  departments?: PdfDepartments;
}


/** Grupos de departamentos impressos juntos, na ordem (só os incluídos na escala). */
function deptGroups(schedule: Schedule, choice: PdfDepartments = 'ambos'): DeptId[][] {
  const ids = DEPT_IDS.filter((id) => deptEnabled(schedule.config, id));
  if (choice === 'ambos') return [ids];
  if (choice === 'separados') return ids.map((id) => [id]);
  return ids.includes(choice) ? [[choice]] : [];
}


const pad = (n: number) => String(n).padStart(2, '0');
const finalY = (doc: jsPDF) => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
const stamp = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
export function buildSchedulePdf(schedule: Schedule, analysis: Analysis, opts: PdfOptions = {}): jsPDF {
  return buildCombinedPdf([{ schedule, analysis }], opts);
}

/** Um único PDF com uma ou várias escalas (ex.: vários meses). */
export function buildCombinedPdf(items: PdfItem[], opts: PdfOptions = {}): jsPDF {
  if (!items.length) throw new Error('Selecione ao menos uma escala.');
  const generatedAt = opts.generatedAt ?? new Date();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: opts.compress ?? false });
  if (opts.font === 'helvetica') FONT = 'helvetica';
  else {
    registerFonts(doc);
    FONT = 'Montserrat';
  }
  doc.setProperties({
    title: items.length === 1 ? `Escala 5x2 – ${monthLabel(items[0].schedule.year, items[0].schedule.month)}` : `Escalas 5x2 – ${items.length} meses`,
    creator: DEVELOPED_BY,
  });
  let first = true;
  for (const item of items)
    for (const group of deptGroups(item.schedule, opts.departments)) {
      if (!first) doc.addPage();
      first = false;
      renderSchedule(doc, item.schedule, item.analysis, opts, group);
    }
  if (first) throw new Error('O departamento escolhido não está incluído nesta escala.');
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont(FONT, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.text(`${DEVELOPED_BY} · Documento gerado em ${stamp(generatedAt)}`, 8, H - 5);
    doc.text(`Página ${p} de ${total}`, W - 8, H - 5, { align: 'right' });
  }
  return doc;
}

function renderSchedule(doc: jsPDF, schedule: Schedule, analysis: Analysis, opts: PdfOptions, depts: DeptId[] = [...DEPT_IDS]): void {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 8;
  const bottom = H - 11;
  const { range } = analysis;
  const idx = new Map(range.dates.map((d, i) => [d, i]));
  const unit = unitName(schedule);
  const title = (unit ? `Unidade ${unit} · ` : '') + (depts.length === 1 ? `${deptName(depts[0])} · ` : schedule.config.team ? `${teamName(schedule.config.team)} · ` : '') + monthLabel(schedule.year, schedule.month);

  const header = (continuation = false, extra = '') => {
    const logoH = 13;
    doc.addImage(LOGO_PNG, 'PNG', M, 5, logoH * LOGO_RATIO, logoH);
    doc.setTextColor(...DARK);
    doc.setFont(FONT, 'bold');
    doc.setFontSize(15);
    doc.text('Escala de Trabalho 5x2', W - M, 10.5, { align: 'right' });
    doc.setFontSize(11);
    doc.setTextColor(...RED);
    doc.text(title + extra + (continuation ? ' (continuação)' : ''), W - M, 16, { align: 'right' });
    if (opts.managerName) {
      const lx = M + logoH * LOGO_RATIO + 6;
      doc.setDrawColor(...LINE);
      doc.line(lx - 3, 7, lx - 3, 17);
      doc.setFont(FONT, 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(...GREY);
      doc.text('Escala elaborada por', lx, 10);
      doc.setFont(FONT, 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...DARK);
      doc.text(opts.managerName, lx, 14);
      doc.setFont(FONT, 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(...GREY);
      doc.text(`em ${stamp(opts.generatedAt ?? new Date()).slice(0, 10)}`, lx, 17.4);
    }
    doc.setDrawColor(...RED);
    doc.setLineWidth(0.6);
    doc.line(M, 19.5, W - M, 19.5);
    doc.setLineWidth(0.2);
    return 23;
  };
  let pageExtra = '';
  const ensure = (y: number, needed: number) => {
    if (y + needed <= bottom) return y;
    doc.addPage();
    return header(true, pageExtra);
  };
  const sectionTitle = (text: string, y: number) => {
    doc.setFont(FONT, 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...DARK);
    doc.text(text, M, y + 3);
  };

  // Equipes maiores (até 5 por departamento): quadros e assinaturas mais baixos para caber na página.
  const teamSize = depts.reduce((acc, id) => acc + analysis.depts[id].resolved.ctx.employees.length, 0);
  const compact = teamSize > 7;
  const weekly = opts.layout === 'semana';
  // Três departamentos juntos: quadros ainda mais baixos para manter o mês em uma página.
  const dense = !weekly && teamSize > 9;

  /** Tabela de um departamento para os dias informados (mês inteiro ou uma semana). */
  const drawDept = (deptId: DeptId, days: string[], y: number): number => {
    const da = analysis.depts[deptId];
    const { ctx, cells } = da.resolved;
    const nameCol = weekly ? 48 : 36;
    const dayCol = (W - 2 * M - nameCol) / days.length;
    const single = depts.length === 1;
    const cellH = weekly ? (compact ? 10.5 : single ? 14 : 12.5) : single ? 10 : dense ? 6.1 : compact ? 7 : 7.6;
    const out = (date: string) => weekly && !range.inMonth(date);
    y = ensure(y, 12 + ctx.employees.length * (cellH + 0.2) + 5);
    sectionTitle(deptName(deptId).toUpperCase(), y);
    const head: RowInput[] = [
      [{ content: 'Colaborador', styles: { valign: 'middle', halign: 'left' } },
        ...days.map((d) => {
          const wd = WEEKDAY_SHORT[ctx.weekdays[idx.get(d)!]].slice(0, 3);
          return { content: weekly ? `${wd} ${formatDayMonth(d)}` : wd };
        })],
    ];
    // Conteúdo de cada quadro: dia do mês, palavra e o horário (no mês, só quando diferente do habitual).
    const marks: ({ day: string; label: string; time: string; text: RGB } | null)[][] = [];
    const body: RowInput[] = ctx.employees.map((emp, e) => {
      marks[e] = [];
      return [
        { content: `${emp.name}\n${isHourlyDept(deptId) ? memberLabel(deptId) : SHIFT_KIND_LABEL[emp.kind]} · ${formatShiftShort(emp.shift)}`, styles: { halign: 'left', fontSize: weekly ? 7.6 : 6.4, fillColor: [255, 255, 255] } },
        ...days.map((date, k): CellDef => {
          if (out(date)) {
            marks[e][k] = null;
            return { content: '', styles: { fillColor: [250, 250, 251] } };
          }
          const c = cells[e][idx.get(date)!];
          const kind = c.status === 'T' ? (c.origin === 'substituicao' ? 'S' : 'T') : c.status;
          const color = COLORS[kind];
          const wd = ctx.weekdays[idx.get(date)!];
          const label = c.status === 'FE' ? 'Feriado' : c.status === 'FR' ? 'Férias' : c.status === 'F' && offByRegime(emp, wd) ? '—' : c.status !== 'T' ? 'Folga' : kind === 'S' ? 'Cobrindo' : 'Trabalho';
          const showTime = c.status === 'T' && (weekly || c.origin !== 'habitual');
          marks[e][k] = { day: weekly ? '' : String(Number(date.slice(8))), label, time: showTime ? formatShiftShort(c.shift!) : '', text: color.text };
          return { content: '', styles: { fillColor: color.fill } };
        }),
      ];
    });
    body.push([
      { content: 'Equipe no dia', styles: { fontStyle: 'bold', halign: 'left', fillColor: [250, 250, 251], minCellHeight: weekly ? 5.5 : dense ? 3.6 : 4.4 } },
      ...days.map((date): CellDef => ({
        content: out(date) ? '' : String(da.dailyCounts[idx.get(date)!]),
        styles: { fontStyle: 'bold', fillColor: [250, 250, 251], textColor: GREY, minCellHeight: weekly ? 5.5 : dense ? 3.6 : 4.4, fontSize: weekly ? 7.5 : undefined },
      })),
    ]);
    autoTable(doc, {
      startY: y + 5,
      margin: { left: M, right: M, bottom: 12, top: 24 },
      head,
      body,
      theme: 'grid',
      styles: { font: FONT, fontSize: days.length > 30 ? 5.4 : 5.8, cellPadding: weekly ? 1 : 0.5, halign: 'center', valign: 'middle', lineColor: [255, 255, 255], lineWidth: weekly ? 0.8 : 0.5, textColor: DARK, minCellHeight: cellH, overflow: 'linebreak' },
      headStyles: { fillColor: HEAD_FILL, textColor: HEAD_TEXT, fontStyle: 'bold', fontSize: weekly ? 8.5 : 5.6, minCellHeight: weekly ? 6 : 3.8 },
      columnStyles: { 0: { cellWidth: nameCol }, ...Object.fromEntries(days.map((_, i) => [i + 1, { cellWidth: dayCol }])) },
      rowPageBreak: 'avoid',
      didDrawCell: (data) => {
        if (data.section !== 'body' || data.column.index === 0) return;
        const m = marks[data.row.index]?.[data.column.index - 1];
        if (!m) return;
        const cx = data.cell.x + data.cell.width / 2;
        doc.setTextColor(...m.text);
        if (weekly) {
          const mid = data.cell.y + data.cell.height / 2;
          doc.setFont(FONT, 'bold');
          doc.setFontSize(compact ? 8.6 : 9.5);
          doc.text(m.label, cx, m.time ? mid - 0.6 : mid + 1.2, { align: 'center' });
          if (m.time) {
            doc.setFont(FONT, m.label === 'Trabalho' ? 'normal' : 'bold');
            doc.setFontSize(compact ? 7.6 : 8.2);
            doc.text(m.time, cx, mid + 3.4, { align: 'center' });
          }
          return;
        }
        const step = dense ? 1.95 : compact ? 2.25 : single ? 2.9 : 2.5;
        const top = data.cell.y + (data.cell.height - (m.time ? step * 1.84 : step)) / 2 + 0.9;
        doc.setFont(FONT, 'bold');
        doc.setFontSize(single ? 8 : dense ? 6.2 : 7);
        doc.text(m.day, cx, top, { align: 'center' });
        doc.setFont(FONT, m.label === 'Trabalho' ? 'normal' : 'bold');
        doc.setFontSize((m.label === 'Trabalho' ? 4.3 : 4.6) + (single ? 0.6 : dense ? -0.4 : 0));
        doc.text(m.label, cx, top + step, { align: 'center' });
        if (m.time) {
          doc.setFont(FONT, 'bold');
          doc.setFontSize(single ? 5 : dense ? 4 : 4.4);
          doc.text(m.time, cx, top + step * 1.84, { align: 'center' });
        }
      },
      didParseCell: (data) => {
        if (data.section === 'head' && data.column.index > 0) {
          const date = days[data.column.index - 1];
          const di = idx.get(date)!;
          const w = ctx.weekdays[di];
          if (out(date)) data.cell.styles.textColor = [185, 185, 185];
          else if (ctx.holidays[di]) {
            data.cell.styles.fillColor = RED;
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.text = [`${data.cell.text[0]}*`];
          } else if (w === 0 || w === 6) data.cell.styles.textColor = RED;
        }
      },
    });
    return finalY(doc) + 4;
  };

  // Quadro de substituições (sem horas trabalhadas: essa informação fica só na tela do gestor)
  const drawSubs = (y: number, days: string[], label: string): number => {
    const inPeriod = new Set(days.filter((d) => range.inMonth(d)));
    // Professores e estagiários entram só se houve troca por nome no período.
    const subDepts = depts.filter((id) => !isHourlyDept(id) || analysis.depts[id].resolved.substitutions.some((ev) => ev.outcome === 'aplicada'));
    if (!subDepts.length) return y;
    const subsByDept = subDepts.map((id) => {
      const { ctx, substitutions } = analysis.depts[id].resolved;
      const name = (empId?: string) => ctx.employees.find((x) => x.id === empId)?.name ?? '–';
      // A mesma cobertura (quem cobre, no lugar de quem e turno) em vários dias vira uma linha só, com as datas.
      const grupos = new Map<string, { dias: string[]; linha: string[] }>();
      substitutions
        .filter((ev) => ev.outcome === 'aplicada' && inPeriod.has(ctx.dates[ev.dateIndex]))
        .sort((a, b) => a.dateIndex - b.dateIndex || a.role.localeCompare(b.role))
        .forEach((ev) => {
          const linha = [name(ev.substituteId), ev.absentIds.map(name).join(', '), `${isHourlyDept(id) ? 'Horário' : SHIFT_KIND_LABEL[ev.role]} ${formatShiftShort(ev.newShift)}`];
          const k = linha.join('|');
          const g = grupos.get(k) ?? { dias: [], linha };
          g.dias.push(`${WEEKDAY_SHORT[ctx.weekdays[ev.dateIndex]]} ${formatDayMonth(ctx.dates[ev.dateIndex])}`);
          grupos.set(k, g);
        });
      return [...grupos.values()].map((g) => [g.dias.length === 1 ? g.dias[0] : g.dias.map((d) => d.replace(/^\S+ /, '')).join(', '), ...g.linha]);
    });
    const subRows = Math.max(1, ...subsByDept.map((r) => r.length));
    y = ensure(y, 14 + subRows * 4.2);
    sectionTitle(`SUBSTITUIÇÕES ${label}`, y);
    const half = (W - 2 * M - 6 * (subDepts.length - 1)) / subDepts.length;
    let tablesEnd = y;
    subDepts.forEach((id, i) => {
      const left = M + i * (half + 6);
      const list = subsByDept[i];
      autoTable(doc, {
        startY: y + 5,
        margin: { left, right: W - left - half, bottom: 12, top: 24 },
        head: [[{ content: deptName(id), colSpan: 4, styles: { halign: 'left', fillColor: [255, 255, 255], textColor: RED, fontSize: 7 } }], ['Dias', 'Quem cobre', 'No lugar de', 'Turno e horário']],
        body: list.length ? list : [[{ content: `Nenhuma substituição prevista ${label === 'DO MÊS' ? 'no mês' : 'na semana'}.`, colSpan: 4, styles: { halign: 'left', textColor: GREY } }]],
        theme: 'striped',
        styles: { font: FONT, fontSize: dense ? 5.8 : 6.3, cellPadding: dense ? 0.45 : 0.7, halign: 'left', valign: 'middle', textColor: DARK },
        headStyles: { fillColor: SOFT, textColor: DARK, fontStyle: 'bold', fontSize: 6.2 },
        alternateRowStyles: { fillColor: [250, 250, 251] },
        columnStyles: { 0: { cellWidth: 38 }, 3: { cellWidth: 32 } },
        rowPageBreak: 'avoid',
      });
      tablesEnd = Math.max(tablesEnd, finalY(doc));
    });
    return tablesEnd + 5;
  };

  // Legenda em cores e observações (feriados, dias sem folga)
  const drawLegend = (y: number): number => {
    y = ensure(y, 12);
    doc.setFont(FONT, 'normal');
    doc.setFontSize(7.2);
    let x = M;
    const swatch = (fill: RGB, label: string) => {
      doc.setFillColor(...fill);
      doc.roundedRect(x, y - 2.6, 4.5, 3.4, 0.6, 0.6, 'F');
      doc.setTextColor(...DARK);
      doc.text(label, x + 6, y);
      x += 6 + doc.getTextWidth(label) + 6;
    };
    swatch(COLORS.T.fill, weekly ? 'Trabalho (com o horário)' : 'Trabalho no horário habitual (horário abaixo quando diferente)');
    swatch(COLORS.S.fill, 'Cobrindo outro turno (com o horário)');
    swatch(COLORS.F.fill, 'Folga');
    swatch(COLORS.FE.fill, 'Feriado (folga)');
    swatch(COLORS.FR.fill, 'Férias');
    swatch(RED, 'Dia de feriado (*)');
    const hol = schedule.config.holidays.filter((h) => range.inMonth(h.date)).sort((a, b) => a.date.localeCompare(b.date));
    doc.setTextColor(...GREY);
    const blocked = [1, 2, 3, 4, 5, 6, 0].filter((w) => schedule.config.noOffWeekdays?.includes(w as Weekday)).map((w) => WEEKDAY_LONG[w].split('-')[0].toLowerCase());
    const first = range.monthDates[0];
    const last = range.monthDates[range.monthDates.length - 1];
    const vac = depts.flatMap((id) => analysis.depts[id].resolved.ctx.employees.flatMap((emp) => (emp.vacations ?? [])
      .filter((v) => v.end >= first && v.start <= last).map((v) => `${emp.name} (${formatDayMonth(v.start)} a ${formatDayMonth(v.end)})`)));
    const notes = doc.splitTextToSize(
      (vac.length ? `Férias: ${vac.join('; ')}. ` : '') + (blocked.length ? `Dias sem folga: ${blocked.join(', ')} (exceto feriados). ` : '') + (hol.length
        ? `Feriados: ${hol.map((h) => `${formatDayMonth(h.date)} ${h.name} (${h.closed ? 'academia fechada' : `${schedule.config.holidayHours.start}–${schedule.config.holidayHours.end}`})`).join('; ')}.`
        : 'Sem feriados no mês.'),
      W - 2 * M,
    );
    doc.text(notes, M, y + 4);
    return y + 4 + notes.length * 3 + 2;
  };

  let y: number;
  if (weekly) {
    // Uma página por semana (segunda a domingo); dias de outro mês aparecem vazios.
    y = 0;
    range.weeks.forEach((wk, i) => {
      const days = range.dates.slice(i * 7, i * 7 + 7);
      pageExtra = ` · Semana ${i + 1} (${formatDayMonth(wk.start)} a ${formatDayMonth(wk.end)})`;
      if (i > 0) doc.addPage();
      y = header(false, pageExtra);
      for (const deptId of depts) y = drawDept(deptId, days, y);
      y = drawSubs(y, days, 'DA SEMANA');
      y = drawLegend(y);
    });
    pageExtra = '';
  } else {
    y = header();
    for (const deptId of depts) y = drawDept(deptId, range.monthDates, y);
    y = drawSubs(y, range.monthDates, 'DO MÊS');
    y = drawLegend(y);
  }
  const rows = depts.flatMap((id) => analysis.depts[id].resolved.ctx.employees.map((emp) => ({ id, emp })));

  if (opts.includeSignature !== false) {
    // Assinatura de cada colaborador (o gestor já está identificado no cabeçalho)
    const people = rows.map((r) => ({ name: r.emp.name, role: deptName(r.id) }));
    const perRow = Math.max(3, Math.ceil(people.length / 2));
    const gap = 10;
    const colW = (W - 2 * M - gap * (perRow - 1)) / perRow;
    const rowH = dense ? 10 : compact ? 11.5 : 14;
    y = ensure(y, 5 + Math.min(2, Math.ceil(people.length / perRow)) * rowH);
    sectionTitle('CIENTE DA ESCALA', y);
    y += 5;
    people.forEach((p, i) => {
      const col = i % perRow;
      if (i > 0 && col === 0) y = ensure(y + rowH, rowH);
      const px = M + col * (colW + gap);
      doc.setDrawColor(...GREY);
      doc.setLineWidth(0.25);
      const lineY = y + rowH - 4.5;
      doc.line(px, lineY, px + colW, lineY);
      doc.setFont(FONT, 'bold');
      doc.setFontSize(7.4);
      doc.setTextColor(...DARK);
      doc.text(p.name, px, lineY + 3.1, { maxWidth: colW });
      doc.setFont(FONT, 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(...GREY);
      doc.text(`${p.role} · Data: ___/___/____`, px, lineY + 5.9, { maxWidth: colW });
    });
  }
  if (opts.includeAlerts) renderAlerts(doc, analysis, header, depts);
}

function renderAlerts(doc: jsPDF, analysis: Analysis, header: (c?: boolean) => number, depts: DeptId[]) {
  const M = 8;
  const pending = analysis.alerts.filter((a) => a.severity !== 'info' && (!a.dept || depts.includes(a.dept)));
  doc.addPage();
  let y = header(true);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...DARK);
  doc.text('PENDÊNCIAS DA ESCALA (USO DO GESTOR)', M, y + 3);
  y += 5;
  if (!pending.length) {
    doc.setFont(FONT, 'normal');
    doc.setFontSize(8);
    doc.text('Nenhuma pendência.', M, y + 4);
    return;
  }
  const sev = (a: Alert) => (a.severity === 'critico' ? 'Crítico' : 'Atenção');
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 12, top: 24 },
    head: [['Nível', 'Departamento', 'Data', 'Colaborador', 'Problema', 'Sugestão de correção']],
    body: pending.map((a) => [
      { content: sev(a), styles: a.severity === 'critico' ? { textColor: RED, fontStyle: 'bold' } : {} },
      a.dept ? deptName(a.dept) : 'Geral',
      a.date ? formatDayMonth(a.date) : '–',
      a.employeeName ?? '–',
      `${a.title}: ${a.message}`,
      a.suggestion || '–',
    ]),
    theme: 'grid',
    styles: { font: FONT, fontSize: 7, cellPadding: 1, valign: 'top', lineColor: LINE, lineWidth: 0.15, textColor: DARK },
    headStyles: { fillColor: SOFT, textColor: DARK },
    columnStyles: { 0: { cellWidth: 15 }, 1: { cellWidth: 30 }, 2: { cellWidth: 12 }, 3: { cellWidth: 30 }, 5: { cellWidth: 75 } },
    didDrawPage: (data) => { if (data.pageNumber > 1) header(true); },
  });
}

export function downloadSchedulePdf(schedule: Schedule, analysis: Analysis, opts?: PdfOptions): void {
  buildSchedulePdf(schedule, analysis, { compress: true, ...opts }).save(pdfFileName(schedule));
}

export function downloadCombinedPdf(items: PdfItem[], opts?: PdfOptions): void {
  buildCombinedPdf(items, { compress: true, ...opts }).save(combinedFileName(items));
}

export interface IndividualPdfOptions {
  /** Pessoas incluídas (ids). Sem valor: todas as pessoas da escala, uma página para cada. */
  employeeIds?: string[];
  /** Linha de assinatura do colaborador ao pé da página (padrão: sim). */
  includeSignature?: boolean;
  managerName?: string;
  generatedAt?: Date;
  compress?: boolean;
  font?: 'montserrat' | 'helvetica';
}

/** Pessoas da escala, na ordem dos departamentos, com onde estão na análise. */
export function individualPeople(schedule: Schedule, analysis: Analysis) {
  return DEPT_IDS.filter((id) => deptEnabled(schedule.config, id)).flatMap((deptId) =>
    analysis.depts[deptId].resolved.ctx.employees.map((emp, e) => ({ deptId, e, emp })),
  );
}

/**
 * Escala individual: uma página (A4 em pé) por pessoa, com o calendário do mês só com os dias dela,
 * as folgas, as férias e a linha de assinatura. Não traz horas somadas nem saldos.
 */
export function buildIndividualPdf(schedule: Schedule, analysis: Analysis, opts: IndividualPdfOptions = {}): jsPDF {
  const people = individualPeople(schedule, analysis).filter((p) => !opts.employeeIds || opts.employeeIds.includes(p.emp.id));
  if (!people.length) throw new Error('Escolha ao menos uma pessoa da escala.');
  const generatedAt = opts.generatedAt ?? new Date();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: opts.compress ?? false });
  if (opts.font === 'helvetica') FONT = 'helvetica';
  else {
    registerFonts(doc);
    FONT = 'Montserrat';
  }
  doc.setProperties({ title: `Escala individual – ${monthLabel(schedule.year, schedule.month)}`, creator: DEVELOPED_BY });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;
  const { range } = analysis;
  const idx = new Map(range.dates.map((d, i) => [d, i]));
  const unit = unitName(schedule);
  const sub = [unit ? `Unidade ${unit}` : '', schedule.config.team ? teamName(schedule.config.team) : ''].filter(Boolean).join(' · ');

  people.forEach(({ deptId, e, emp }, page) => {
    if (page > 0) doc.addPage();
    const da = analysis.depts[deptId];
    const { ctx, cells } = da.resolved;

    // Cabeçalho
    const logoH = 13;
    doc.addImage(LOGO_PNG, 'PNG', M, 5, logoH * LOGO_RATIO, logoH);
    doc.setTextColor(...DARK);
    doc.setFont(FONT, 'bold');
    doc.setFontSize(14);
    doc.text('Escala individual', W - M, 10.5, { align: 'right' });
    doc.setFontSize(10.5);
    doc.setTextColor(...RED);
    doc.text(monthLabel(schedule.year, schedule.month), W - M, 16, { align: 'right' });
    doc.setDrawColor(...RED);
    doc.setLineWidth(0.6);
    doc.line(M, 19.5, W - M, 19.5);
    doc.setLineWidth(0.2);

    // Quem é
    doc.setFont(FONT, 'bold');
    doc.setFontSize(17);
    doc.setTextColor(...DARK);
    doc.text(emp.name || 'Colaborador', M, 31);
    doc.setFont(FONT, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    const funcao = isHourlyDept(deptId) ? memberLabel(deptId) : SHIFT_KIND_LABEL[emp.kind];
    const habitual = emp.weekendOnly ? 'Sábado, domingo e feriado' : emp.fixedShifts ? 'Horário por dia' : `Horário habitual ${formatShiftShort(emp.shift)}`;
    doc.text(`${deptName(deptId)} · ${funcao} · ${habitual}`, M, 37);
    if (sub) doc.text(sub, M, 42);

    // Calendário do mês (segunda a domingo)
    const top = 49;
    const colW = (W - 2 * M) / 7;
    const rowH = 28;
    const nomes = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    doc.setFont(FONT, 'bold');
    doc.setFontSize(8);
    nomes.forEach((n, i) => {
      doc.setTextColor(...(i >= 5 ? RED : HEAD_TEXT));
      doc.text(n, M + i * colW + colW / 2, top, { align: 'center' });
    });
    const folgas: string[] = [];
    const ferias: string[] = [];
    const feriados: string[] = [];
    range.weeks.forEach((w, wi) => {
      w.dates.forEach((date, i) => {
        const x = M + i * colW;
        const y = top + 3 + wi * rowH;
        const cw = colW - 1.2;
        const ch = rowH - 1.2;
        if (!range.inMonth(date)) {
          doc.setFillColor(250, 250, 251);
          doc.roundedRect(x, y, cw, ch, 1.6, 1.6, 'F');
          return;
        }
        const di = idx.get(date)!;
        const c = cells[e][di];
        const wd = ctx.weekdays[di];
        const kind = c.status === 'T' ? (c.origin === 'substituicao' ? 'S' : 'T') : c.status;
        const color = COLORS[kind];
        const regime = c.status === 'F' && offByRegime(emp, wd);
        doc.setFillColor(...(regime ? ([250, 250, 251] as RGB) : color.fill));
        doc.roundedRect(x, y, cw, ch, 1.6, 1.6, 'F');
        const hol = ctx.holidays[di];
        if (hol) {
          doc.setDrawColor(...RED);
          doc.setLineWidth(0.5);
          doc.roundedRect(x, y, cw, ch, 1.6, 1.6, 'S');
          doc.setLineWidth(0.2);
          feriados.push(`${formatDayMonth(date)} ${hol.name}${hol.closed ? ' (academia fechada)' : ''}`);
        }
        doc.setFont(FONT, 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...(regime ? GREY : color.text));
        doc.text(String(Number(date.slice(8))), x + 2.2, y + 6.2);
        const cx = x + cw / 2;
        if (c.status === 'T') {
          doc.setFont(FONT, 'bold');
          doc.setFontSize(8.4);
          doc.text(formatShiftShort(c.shift!), cx, y + 15.5, { align: 'center' });
          doc.setFont(FONT, 'normal');
          doc.setFontSize(6);
          doc.text(kind === 'S' ? 'Cobrindo' : 'Trabalho', cx, y + 20, { align: 'center' });
        } else {
          const rotulo = regime ? '—' : c.status === 'FE' ? 'Folga de feriado' : c.status === 'FR' ? 'Férias' : 'Folga';
          doc.setFont(FONT, 'bold');
          doc.setFontSize(c.status === 'FE' ? 6.4 : 8.4);
          doc.text(rotulo, cx, y + 16.5, { align: 'center' });
          const dia = `${WEEKDAY_SHORT[wd].slice(0, 3)} ${formatDayMonth(date)}`;
          if (!regime) (c.status === 'FR' ? ferias : folgas).push(dia);
        }
        if (hol) {
          doc.setFont(FONT, 'bold');
          doc.setFontSize(5.4);
          doc.setTextColor(...RED);
          doc.text('FERIADO', x + cw - 1.8, y + 5, { align: 'right' });
        }
      });
    });
    let y = top + 3 + range.weeks.length * rowH + 4;

    // Folgas, férias e feriados do mês
    const bloco = (titulo: string, itens: string[]) => {
      if (!itens.length) return;
      doc.setFont(FONT, 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...DARK);
      doc.text(titulo, M, y);
      doc.setFont(FONT, 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...GREY);
      const linhas = doc.splitTextToSize(itens.join(' · '), W - 2 * M - 34) as string[];
      doc.text(linhas, M + 34, y);
      y += Math.max(1, linhas.length) * 4.2 + 1.5;
    };
    bloco('Suas folgas', folgas);
    bloco('Férias', ferias);
    bloco('Feriados do mês', feriados);

    // Assinatura
    if (opts.includeSignature !== false) {
      const sy = H - 30;
      doc.setDrawColor(...GREY);
      doc.line(M, sy, M + 90, sy);
      doc.setFont(FONT, 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...DARK);
      doc.text(emp.name || 'Colaborador', M, sy + 4.5);
      doc.setFont(FONT, 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...GREY);
      doc.text('Ciente da escala · Data: ___/___/_____', M, sy + 8.5);
    }
    if (opts.managerName) {
      doc.setFont(FONT, 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...GREY);
      doc.text(`Escala elaborada por ${opts.managerName}`, W - M, H - 21.5, { align: 'right' });
    }
  });

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont(FONT, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.text(`${DEVELOPED_BY} · Documento gerado em ${stamp(generatedAt)}`, M, H - 5);
    doc.text(`Página ${p} de ${total}`, W - M, H - 5, { align: 'right' });
  }
  return doc;
}

export interface RelatorioPdfMeta {
  year: number;
  month: number;
  escopo: string;
  pendencias: PendenciaRelatorio[];
}

const MOTIVO_PDF: Record<PendenciaRelatorio['motivo'], string> = { 'sem-escala': 'sem escala', 'em-configuracao': 'escala ainda não gerada', rascunho: 'escala em rascunho' };

/**
 * Relatório mensal para a contabilidade (A4 paisagem): uma tabela por unidade, com subtotal, e o total geral.
 * Traz horas e dias de cada pessoa; avisa no alto quando há escala ainda não confirmada.
 */
export function buildRelatorioPdf(linhas: RelatorioLinha[], meta: RelatorioPdfMeta, opts: { font?: 'montserrat' | 'helvetica'; generatedAt?: Date; compress?: boolean } = {}): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: opts.compress ?? false });
  if (opts.font === 'helvetica') FONT = 'helvetica';
  else {
    registerFonts(doc);
    FONT = 'Montserrat';
  }
  doc.setProperties({ title: `Relatório para a contabilidade – ${monthLabel(meta.year, meta.month)} – ${meta.escopo}`, creator: DEVELOPED_BY });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 10;
  const generatedAt = opts.generatedAt ?? new Date();

  const paginaAtual = () => (doc as unknown as { internal: { getCurrentPageInfo: () => { pageNumber: number } } }).internal.getCurrentPageInfo().pageNumber;
  const comCabecalho = new Set<number>();
  const cabecalho = () => {
    if (comCabecalho.has(paginaAtual())) return;
    comCabecalho.add(paginaAtual());
    const logoH = 13;
    doc.addImage(LOGO_PNG, 'PNG', M, 5, logoH * LOGO_RATIO, logoH);
    doc.setFont(FONT, 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...DARK);
    doc.text('Relatório para a contabilidade', W - M, 10.5, { align: 'right' });
    doc.setFontSize(10.5);
    doc.setTextColor(...RED);
    doc.text(`${monthLabel(meta.year, meta.month)} · ${meta.escopo}`, W - M, 16, { align: 'right' });
    doc.setDrawColor(...RED);
    doc.setLineWidth(0.6);
    doc.line(M, 19.5, W - M, 19.5);
    doc.setLineWidth(0.2);
  };
  cabecalho();
  let y = 25;
  doc.setFont(FONT, 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...GREY);
  const nota = doc.splitTextToSize('Horas efetivas, sem intervalos. Horas adicionais: acima da jornada contratada nas semanas do mês (semanas que atravessam o mês entram inteiras).', W - 2 * M) as string[];
  doc.text(nota, M, y);
  y += nota.length * 3.4 + 1;
  if (meta.pendencias.length) {
    doc.setFont(FONT, 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(164, 89, 4);
    const aviso = doc.splitTextToSize(`Atenção, ainda não confirmado: ${meta.pendencias.map((p) => `${p.unidade} · ${p.coordenacao} (${MOTIVO_PDF[p.motivo]})`).join('; ')}. Os números podem mudar até a confirmação.`, W - 2 * M) as string[];
    doc.text(aviso, M, y + 1);
    y += aviso.length * 3.6 + 2;
  }

  const grupos = new Map<string, RelatorioLinha[]>();
  for (const l of linhas) grupos.set(`${l.unidade}|${l.team}`, [...(grupos.get(`${l.unidade}|${l.team}`) ?? []), l]);
  const cab: string[] = ['Departamento', 'Colaborador', 'Dias trab.', 'Horas no mês', 'Horas adic.', 'Folgas', 'Fer. trab.', 'Sáb.', 'Dom.', 'Férias', 'Cob.'];
  const SIT: Record<SituacaoEscala, string> = { confirmada: 'confirmada', rascunho: 'rascunho (não confirmada)', 'em-configuracao': 'em configuração' };
  for (const g of grupos.values()) {
    const tg = totais(g);
    const body: RowInput[] = g.map((l) => [l.departamento, l.nome, l.diasTrabalhados, formatDuration(l.minutosNoMes), l.minutosAdicionais ? formatDuration(l.minutosAdicionais) : '–', l.folgas + (l.folgasFeriado ? ` + ${l.folgasFeriado} fer.` : ''), l.feriadosTrabalhados || '–', l.sabados, l.domingos, l.diasFerias || '–', l.coberturas || '–']);
    body.push([
      { content: `Total · ${tg.pessoas} ${tg.pessoas === 1 ? 'pessoa' : 'pessoas'}`, colSpan: 2, styles: { halign: 'left', fontStyle: 'bold' } },
      { content: String(tg.diasTrabalhados), styles: { fontStyle: 'bold' } },
      { content: formatDuration(tg.minutosNoMes), styles: { fontStyle: 'bold' } },
      { content: tg.minutosAdicionais ? formatDuration(tg.minutosAdicionais) : '–', styles: { fontStyle: 'bold' } },
      '', { content: String(tg.feriadosTrabalhados || '–'), styles: { fontStyle: 'bold' } }, '', '', { content: String(tg.diasFerias || '–'), styles: { fontStyle: 'bold' } }, '',
    ]);
    if (y > H - 45) { doc.addPage(); cabecalho(); y = 25; }
    doc.setFont(FONT, 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...DARK);
    doc.text(`${g[0].unidade} · ${g[0].coordenacao}`, M, y + 3);
    doc.setFont(FONT, 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(...(g[0].situacao === 'confirmada' ? GREY : ([164, 89, 4] as RGB)));
    doc.text(`Escala ${SIT[g[0].situacao]}`, W - M, y + 3, { align: 'right' });
    autoTable(doc, {
      startY: y + 5,
      margin: { left: M, right: M, bottom: 12, top: 24 },
      head: [cab],
      body,
      theme: 'grid',
      styles: { font: FONT, fontSize: 7.4, cellPadding: 1.1, halign: 'center', valign: 'middle', lineColor: [226, 228, 232], lineWidth: 0.15, textColor: DARK },
      headStyles: { fillColor: SOFT, textColor: DARK, fontStyle: 'bold', fontSize: 7 },
      columnStyles: { 0: { halign: 'left', cellWidth: 34 }, 1: { halign: 'left' } },
      didDrawPage: () => cabecalho(),
    });
    y = finalY(doc) + 6;
  }
  if (!grupos.size) {
    doc.setFont(FONT, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...GREY);
    doc.text('Nenhuma escala gerada neste mês para o escopo escolhido.', M, y + 6);
  } else {
    const t = totais(linhas);
    if (y > H - 28) { doc.addPage(); cabecalho(); y = 25; }
    doc.setFont(FONT, 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...DARK);
    doc.text(`Total geral: ${t.pessoas} pessoas · ${formatDuration(t.minutosNoMes)} no mês · ${t.minutosAdicionais ? formatDuration(t.minutosAdicionais) : '0h'} adicionais · ${t.feriadosTrabalhados} feriados trabalhados · ${t.diasFerias} dias de férias`, M, y + 3);
  }

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont(FONT, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.text(`${DEVELOPED_BY} · Documento gerado em ${stamp(generatedAt)}`, M, H - 5);
    doc.text(`Página ${p} de ${total}`, W - M, H - 5, { align: 'right' });
  }
  return doc;
}
