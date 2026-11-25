import type { Weekday } from './types';

export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;
export const WEEKDAY_LONG = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'] as const;
export const WEEKDAY_LETTER = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const;
export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const;

const pad = (n: number) => String(n).padStart(2, '0');

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function toUtc(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function isValidIsoDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = toUtc(iso);
  return d.toISOString().slice(0, 10) === iso;
}

export function weekdayOf(iso: string): Weekday {
  return toUtc(iso).getUTCDay() as Weekday;
}

export function addDays(iso: string, days: number): string {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthDates(year: number, month: number): string[] {
  return Array.from({ length: daysInMonth(year, month) }, (_, i) => isoDate(year, month, i + 1));
}

export function formatDayMonth(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function formatDateBr(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function isWeekend(iso: string): boolean {
  const w = weekdayOf(iso);
  return w === 0 || w === 6;
}

export interface CalendarWeek {
  index: number; // 1-based
  start: string;
  end: string;
  dates: string[];
  /** A semana começa ou termina fora do mês da escala. */
  partial: boolean;
}

export interface ScheduleRange {
  year: number;
  month: number;
  /** Datas do mês. */
  monthDates: string[];
  /** Todas as datas das semanas completas (segunda a domingo) que cobrem o mês. */
  dates: string[];
  weeks: CalendarWeek[];
  inMonth: (iso: string) => boolean;
}

/** Semanas de segunda a domingo cobrindo todo o mês, incluindo dias dos meses vizinhos. */
export function buildRange(year: number, month: number): ScheduleRange {
  const md = monthDates(year, month);
  const first = md[0];
  const last = md[md.length - 1];
  const startOffset = (weekdayOf(first) + 6) % 7; // dias desde a segunda-feira
  const endOffset = (7 - weekdayOf(last)) % 7; // dias até o domingo
  const start = addDays(first, -startOffset);
  const end = addDays(last, endOffset);
  const dates: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) dates.push(d);
  const prefix = `${year}-${pad(month)}-`;
  const inMonth = (iso: string) => iso.startsWith(prefix);
  const weeks: CalendarWeek[] = [];
  for (let i = 0; i < dates.length; i += 7) {
    const wd = dates.slice(i, i + 7);
    weeks.push({ index: weeks.length + 1, start: wd[0], end: wd[6], dates: wd, partial: !wd.every(inMonth) });
  }
  return { year, month, monthDates: md, dates, weeks, inMonth };
}

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} de ${year}`;
}

export function previousMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}
