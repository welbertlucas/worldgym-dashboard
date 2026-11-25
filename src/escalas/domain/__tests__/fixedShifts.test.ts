import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeSchedule } from '../analyze';
import { weekdayOf } from '../calendar';
import { generateSchedule } from '../generator';
import { validateConfig } from '../schema';
import { configWith, THREE } from './fixtures';

describe('dias fixos com horário por dia', () => {
  it('usa o horário de cada dia marcado (seg 06–10, sáb 08–12)', () => {
    const c = configWith(2026, 11, { recepcao: THREE, apoio: THREE, professores: ['abertura', 'intermediario', 'fechamento'] });
    const prof = c.departments.professores;
    prof.minPresent = 0;
    const p = prof.employees[1];
    p.fixedDays = [1, 6];
    p.fixedShifts = { 1: { start: '06:00', end: '10:00', breakStart: null, breakEnd: null }, 6: { start: '08:00', end: '12:00', breakStart: null, breakEnd: null } };
    expect(validateConfig(c)).toEqual([]);
    const r = generateSchedule(c);
    const a = analyzeSchedule(c, r.cells);
    const row = a.depts.professores.resolved.cells[1];
    const vistos = new Set<string>();
    row.forEach((cell, d) => {
      if (cell.status !== 'T' || cell.origin === 'feriado') return;
      const w = weekdayOf(a.range.dates[d]);
      vistos.add(`${w}:${cell.shift!.start}–${cell.shift!.end}`);
    });
    expect([...vistos].sort()).toEqual(['1:06:00–10:00', '6:08:00–12:00']);
  });

  it('acusa horário inválido em um dos dias', () => {
    const c = configWith(2026, 11, { recepcao: THREE, apoio: THREE, professores: ['abertura', 'intermediario', 'fechamento'] });
    const p = c.departments.professores.employees[0];
    p.fixedDays = [3];
    p.fixedShifts = { 3: { start: '10:00', end: '25:00', breakStart: null, breakEnd: null } };
    expect(validateConfig(c).some((i) => i.employeeId === p.id)).toBe(true);
  });
});
