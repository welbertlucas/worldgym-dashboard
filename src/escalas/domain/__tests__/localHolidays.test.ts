import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localHolidayDate, mergeLocalHolidays } from '../holidays';
import { applySettings, rosterDiff, settingsFromConfig } from '../roster';
import { defaultScheduleConfig } from '../defaults';
import { createSchedule } from '../scheduleOps';
import type { LocalHoliday } from '../types';

const aniversario: LocalHoliday = { id: 'a', name: 'Aniversário da cidade', scope: 'municipal', date: '11-25', closed: false };
const corpus: LocalHoliday = { id: 'c', name: 'Corpus Christi', scope: 'municipal', movable: 'corpus-christi', closed: true };

describe('feriados estaduais e municipais da unidade', () => {
  it('calcula datas fixas e móveis', () => {
    expect(localHolidayDate(aniversario, 2026)).toBe('2026-11-25');
    expect(localHolidayDate(corpus, 2026)).toBe('2026-06-04');
    expect(localHolidayDate({ ...aniversario, date: '02-30' }, 2026)).toBeNull();
  });

  it('entram na escala pelo cadastro da unidade e saem quando removidos', () => {
    const c = defaultScheduleConfig(2026, 11);
    const s = { ...settingsFromConfig(c), localHolidays: [aniversario] };
    const n = applySettings(c, s);
    expect(n.holidays.find((h) => h.date === '2026-11-25')).toMatchObject({ name: 'Aniversário da cidade', source: 'municipal', closed: false });
    expect(n.holidays.filter((h) => h.source === 'nacional').length).toBe(c.holidays.length);
    expect(rosterDiff(c, null, s)?.other).toContain('feriados estaduais e municipais');
    expect(rosterDiff(n, null, s)).toBeNull();
    const sem = applySettings(n, { ...s, localHolidays: [] });
    expect(sem.holidays.some((h) => h.source === 'municipal')).toBe(false);
  });

  it('não substitui feriado nacional e substitui ponto facultativo do mesmo dia', () => {
    const base = [
      { date: '2026-11-15', name: 'Proclamação da República', closed: false, source: 'nacional' as const },
      { date: '2026-06-04', name: 'Corpus Christi', closed: false, source: 'facultativo' as const },
    ];
    const r = mergeLocalHolidays(base, [{ ...aniversario, date: '11-15' }, corpus], ['2026-06-04', '2026-11-15']);
    expect(r).toEqual([{ date: '2026-06-04', name: 'Corpus Christi', closed: true, source: 'municipal' }, base[0]]);
  });

  it('nova escala do mês seguinte já vem com os feriados locais', () => {
    const c = applySettings(defaultScheduleConfig(2026, 10), { ...settingsFromConfig(defaultScheduleConfig(2026, 10)), localHolidays: [aniversario] });
    const nova = createSchedule(2026, 11, c);
    expect(nova.config.holidays.some((h) => h.date === '2026-11-25' && h.source === 'municipal')).toBe(true);
  });
});
