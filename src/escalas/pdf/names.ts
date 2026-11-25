// Nomes de arquivo e tipos do PDF. Separado do gerador para a tela não carregar o jsPDF antes da hora.
import type { Analysis } from '../domain/analyze';
import type { DeptId, Schedule } from '../domain/types';
import { UNIDADES } from '../config/unidades';

export type PdfLayout = 'mes' | 'semana';
export type PdfDepartments = 'ambos' | 'separados' | DeptId;

export interface PdfItem {
  schedule: Schedule;
  analysis: Analysis;
}

const pad = (n: number) => String(n).padStart(2, '0');
const ym = (s: Schedule) => `${s.year}-${pad(s.month)}`;

export function unitName(schedule: Schedule): string | null {
  return UNIDADES.find((u) => u.id === schedule.unitId)?.nome ?? null;
}

const fileSlug = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const unitPart = (s: Schedule) => (unitName(s) ? `${fileSlug(unitName(s)!)}_` : '') + (s.config.team ? `coordenacao-${s.config.team}_` : '');

export function pdfFileName(schedule: Schedule): string {
  return `escala-5x2_${unitPart(schedule)}${ym(schedule)}.pdf`;
}

const DEPT_SLUG: Record<PdfDepartments, string> = { ambos: '', separados: '_por-departamento', recepcao: '_recepcao', apoio: '_apoio', professores: '_professores', estagiarios: '_estagiarios' };

/** Acrescenta ao nome do arquivo o departamento escolhido e "_semanal" quando o PDF é por semana. */
export function withLayoutSuffix(fileName: string, layout?: PdfLayout, departments: PdfDepartments = 'ambos'): string {
  return fileName.replace(/\.pdf$/, `${DEPT_SLUG[departments]}${layout === 'semana' ? '_semanal' : ''}.pdf`);
}

/** Nome do arquivo para um ou vários meses. */
export function combinedFileName(items: PdfItem[]): string {
  const sorted = [...items].sort((a, b) => a.schedule.year * 12 + a.schedule.month - (b.schedule.year * 12 + b.schedule.month));
  const first = sorted[0].schedule;
  const last = sorted[sorted.length - 1].schedule;
  const units = new Set(sorted.map((i) => i.schedule.unitId ?? ''));
  const teams = new Set(sorted.map((i) => i.schedule.config.team ?? ''));
  const prefix = units.size === 1 ? (teams.size === 1 ? unitPart(first) : unitName(first) ? `${fileSlug(unitName(first)!)}_` : '') : '';
  return sorted.length === 1 ? pdfFileName(first) : `escala-5x2_${prefix}${ym(first)}_a_${ym(last)}.pdf`;
}


/** Nome do arquivo da escala individual: de uma pessoa só ou de todas. */
export function individualFileName(schedule: Schedule, pessoa?: string): string {
  return `escala-5x2_${unitPart(schedule)}${ym(schedule)}_${pessoa ? `individual-${fileSlug(pessoa) || 'colaborador'}` : 'individual'}.pdf`;
}
