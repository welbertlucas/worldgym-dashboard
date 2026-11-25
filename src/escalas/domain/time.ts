import type { BreakRule, DayHours, Shift } from './types';

const TIME_RE = /^([01]?\d|2[0-4]):([0-5]\d)$/;

export function isValidTime(value: string | null | undefined): value is string {
  if (!value) return false;
  const m = TIME_RE.exec(value);
  if (!m) return false;
  return !(Number(m[1]) === 24 && Number(m[2]) !== 0);
}

const minutesCache = new Map<string, number>();

/** "HH:MM" -> minutos desde 00:00. */
export function toMinutes(value: string): number {
  const cached = minutesCache.get(value);
  if (cached !== undefined) return cached;
  const m = TIME_RE.exec(value);
  if (!m) throw new Error(`Horário inválido: "${value}"`);
  const r = Number(m[1]) * 60 + Number(m[2]);
  minutesCache.set(value, r);
  return r;
}

export function formatClock(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Duração em minutos -> "7h45" / "40h". */
export function formatDuration(minutes: number): string {
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}h${m ? String(m).padStart(2, '0') : ''}`;
}

/** Versão compacta para células: "05–14" ou "05:30–14". */
export function formatShiftShort(shift: Shift): string {
  const f = (t: string) => {
    const [h, m] = t.split(':');
    return m === '00' ? h : `${h}:${m}`;
  };
  return `${f(shift.start)}–${f(shift.end)}`;
}

export function formatShift(shift: Shift): string {
  const base = `${shift.start}–${shift.end}`;
  if (shift.breakStart && shift.breakEnd) return `${base} (int. ${shift.breakStart}–${shift.breakEnd})`;
  return `${base} (sem intervalo)`;
}

/** Linha do tempo de um turno em minutos relativos ao início do dia; o fim pode passar de 1440. */
export interface ShiftSpan {
  start: number;
  end: number;
  breakStart: number | null;
  breakEnd: number | null;
}

const spanCache = new WeakMap<Shift, { key: string; span: ShiftSpan }>();

export function shiftSpan(shift: Shift): ShiftSpan {
  const key = `${shift.start}|${shift.end}|${shift.breakStart}|${shift.breakEnd}`;
  const hit = spanCache.get(shift);
  if (hit && hit.key === key) return hit.span;
  const span = computeSpan(shift);
  spanCache.set(shift, { key, span });
  return span;
}

function computeSpan(shift: Shift): ShiftSpan {
  const start = toMinutes(shift.start);
  let end = toMinutes(shift.end);
  if (end <= start) end += 1440; // atravessa a meia-noite
  let breakStart: number | null = null;
  let breakEnd: number | null = null;
  if (shift.breakStart && shift.breakEnd) {
    breakStart = toMinutes(shift.breakStart);
    if (breakStart < start) breakStart += 1440;
    breakEnd = toMinutes(shift.breakEnd);
    while (breakEnd <= breakStart) breakEnd += 1440;
  }
  return { start, end, breakStart, breakEnd };
}

export function grossMinutes(shift: Shift): number {
  const s = shiftSpan(shift);
  return s.end - s.start;
}

/** Parte do intervalo que cai dentro da jornada (o intervalo não é tempo trabalhado). */
export function breakMinutes(shift: Shift): number {
  const s = shiftSpan(shift);
  if (s.breakStart === null || s.breakEnd === null) return 0;
  return Math.max(0, Math.min(s.end, s.breakEnd) - Math.max(s.start, s.breakStart));
}

/** Horas efetivas = duração entre entrada e saída − intervalo não trabalhado. */
export function effectiveMinutes(shift: Shift): number {
  return grossMinutes(shift) - breakMinutes(shift);
}

export function requiredBreakMinutes(effective: number, rules: BreakRule[]): number {
  const sorted = [...rules].sort((a, b) => b.aboveHours - a.aboveHours);
  for (const r of sorted) if (effective > r.aboveHours * 60) return r.minBreakMinutes;
  return 0;
}

/** Erros estruturais de um turno (formato, intervalo fora da jornada, etc.). */
export function shiftErrors(shift: Shift, label = 'Turno'): string[] {
  const errors: string[] = [];
  if (!isValidTime(shift.start)) errors.push(`${label}: horário de entrada inválido.`);
  if (!isValidTime(shift.end)) errors.push(`${label}: horário de saída inválido.`);
  const hasBs = !!shift.breakStart;
  const hasBe = !!shift.breakEnd;
  if (hasBs !== hasBe) errors.push(`${label}: informe início e término do intervalo, ou nenhum dos dois.`);
  if (hasBs && !isValidTime(shift.breakStart)) errors.push(`${label}: início do intervalo inválido.`);
  if (hasBe && !isValidTime(shift.breakEnd)) errors.push(`${label}: término do intervalo inválido.`);
  if (errors.length) return errors;
  if (toMinutes(shift.start) % 1440 === toMinutes(shift.end) % 1440)
    errors.push(`${label}: entrada e saída não podem ser iguais.`);
  if (hasBs && hasBe) {
    const s = shiftSpan(shift);
    if (s.breakStart! < s.start || s.breakEnd! > s.end)
      errors.push(`${label}: o intervalo precisa estar dentro da jornada.`);
    if (s.breakStart === s.start || s.breakEnd === s.end)
      errors.push(`${label}: o intervalo não pode coincidir com a entrada ou a saída.`);
  }
  return errors;
}

export interface OperatingSpan {
  start: number;
  end: number;
}

export function operatingSpan(day: DayHours): OperatingSpan | null {
  if (!day.open) return null;
  const start = toMinutes(day.start);
  let end = toMinutes(day.end);
  if (end <= start) end += 1440;
  return { start, end };
}

export function sameShift(a: Shift | null | undefined, b: Shift | null | undefined): boolean {
  if (!a || !b) return a === b;
  return a.start === b.start && a.end === b.end && (a.breakStart ?? null) === (b.breakStart ?? null) && (a.breakEnd ?? null) === (b.breakEnd ?? null);
}

/**
 * Turno dentro da janela [start, end] com no máximo `maxEffective` minutos efetivos: primeiro aumenta o
 * intervalo (até `maxBreak`, padrão 2h da CLT); se ainda passar, encurta a saída.
 */
export function shiftWithin(start: string, end: string, maxEffective: number, rules: BreakRule[], maxBreak = 120): Shift {
  const base = suggestShiftWithBreak(start, end, rules);
  if (effectiveMinutes(base) <= maxEffective) return base;
  const gross = grossMinutes(base);
  const pausa = gross - maxEffective;
  if (pausa <= maxBreak) {
    const s = toMinutes(start);
    const mid = s + Math.round((gross - pausa) / 2 / 15) * 15;
    return { start, end, breakStart: formatClock(mid), breakEnd: formatClock(mid + pausa) };
  }
  const minimo = requiredBreakMinutes(maxEffective, rules);
  return suggestShiftWithBreak(start, formatClock(toMinutes(start) + maxEffective + minimo), rules);
}

/** Sugere o menor intervalo que satisfaz as regras intrajornada, centralizado na jornada. */
export function suggestShiftWithBreak(start: string, end: string, rules: BreakRule[]): Shift {
  const base: Shift = { start, end, breakStart: null, breakEnd: null };
  const gross = grossMinutes(base);
  const candidates = [0, ...rules.map((r) => r.minBreakMinutes)].sort((a, b) => a - b);
  const needed = candidates.find((b) => b < gross && requiredBreakMinutes(gross - b, rules) <= b) ?? 0;
  if (!needed) return base;
  const s = toMinutes(start);
  const mid = s + Math.round((gross - needed) / 2 / 15) * 15;
  return { start, end, breakStart: formatClock(mid), breakEnd: formatClock(mid + needed) };
}
