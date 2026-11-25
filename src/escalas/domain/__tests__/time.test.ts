import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRange, monthDates, weekdayOf } from '../calendar';
import {
  breakMinutes, effectiveMinutes, grossMinutes, requiredBreakMinutes, shiftErrors, suggestShiftWithBreak,
} from '../time';
import { DEFAULT_BREAK_RULES } from '../defaults';

const shift = (start: string, end: string, breakStart: string | null = null, breakEnd: string | null = null) => ({ start, end, breakStart, breakEnd });

describe('cálculo de horas efetivas (aceite 9)', () => {
  it('desconta o intervalo da jornada', () => {
    expect(effectiveMinutes(shift('05:00', '14:00', '09:00', '10:00'))).toBe(8 * 60);
    expect(effectiveMinutes(shift('08:00', '13:00', '10:30', '10:45'))).toBe(4 * 60 + 45);
    expect(effectiveMinutes(shift('09:00', '17:00'))).toBe(8 * 60);
  });

  it('trata turnos que atravessam a meia-noite', () => {
    const s = shift('22:00', '06:00', '02:00', '03:00');
    expect(grossMinutes(s)).toBe(8 * 60);
    expect(breakMinutes(s)).toBe(60);
    expect(effectiveMinutes(s)).toBe(7 * 60);
    expect(effectiveMinutes(shift('18:00', '00:00'))).toBe(6 * 60);
  });

  it('valida intervalo fora da jornada e horários inválidos', () => {
    expect(shiftErrors(shift('08:00', '12:00', '13:00', '14:00'))).toHaveLength(1);
    expect(shiftErrors(shift('08:00', '08:00'))).toHaveLength(1);
    expect(shiftErrors(shift('25:00', '08:00'))).not.toHaveLength(0);
    expect(shiftErrors(shift('08:00', '16:00', '12:00', '13:00'))).toHaveLength(0);
  });

  it('calcula o intervalo exigido conforme as regras configuráveis', () => {
    expect(requiredBreakMinutes(7 * 60, DEFAULT_BREAK_RULES)).toBe(60);
    expect(requiredBreakMinutes(5 * 60, DEFAULT_BREAK_RULES)).toBe(15);
    expect(requiredBreakMinutes(4 * 60, DEFAULT_BREAK_RULES)).toBe(0);
    expect(suggestShiftWithBreak('08:00', '16:00', DEFAULT_BREAK_RULES)).toMatchObject({ breakStart: '11:30', breakEnd: '12:30' });
    const sunday = suggestShiftWithBreak('08:00', '13:00', DEFAULT_BREAK_RULES);
    expect(breakMinutes(sunday)).toBe(15);
    expect(effectiveMinutes(sunday)).toBe(285);
  });
});

describe('calendário (aceite 4)', () => {
  it.each([
    [2026, 2, 28], [2028, 2, 29], [2026, 11, 30], [2026, 12, 31], [2027, 1, 31],
  ])('%i-%i tem %i dias com o dia da semana correto', (y, m, n) => {
    const dates = monthDates(y, m);
    expect(dates).toHaveLength(n);
    expect(dates[0]).toBe(`${y}-${String(m).padStart(2, '0')}-01`);
  });

  it('usa o dia da semana real de cada data', () => {
    expect(weekdayOf('2026-11-01')).toBe(0); // domingo
    expect(weekdayOf('2026-10-29')).toBe(4); // quinta
    expect(weekdayOf('2028-02-29')).toBe(2); // terça
  });

  it('monta semanas de segunda a domingo cobrindo o mês, inclusive as que atravessam meses', () => {
    const r = buildRange(2026, 11);
    expect(r.dates[0]).toBe('2026-10-26');
    expect(r.dates[r.dates.length - 1]).toBe('2026-12-06');
    expect(r.weeks).toHaveLength(6);
    expect(r.weeks[0].partial).toBe(true);
    expect(r.weeks[5].partial).toBe(true);
    expect(r.weeks.slice(1, 5).every((w) => !w.partial)).toBe(true);
    expect(r.weeks.every((w) => w.dates.length === 7 && weekdayOf(w.start) === 1)).toBe(true);
    // Fevereiro de 2027 começa numa segunda e termina num domingo: 4 semanas completas
    const f = buildRange(2027, 2);
    expect(f.weeks).toHaveLength(4);
    expect(f.weeks.some((w) => w.partial)).toBe(false);
  });
});
