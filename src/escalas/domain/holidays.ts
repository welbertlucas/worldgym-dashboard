// Feriados nacionais (Lei 662/1949, Lei 6.802/1980, Lei 14.759/2023) e pontos facultativos usuais.
// Feriados estaduais e municipais variam por unidade e devem ser incluídos manualmente.
import { addDays, isoDate } from './calendar';
import type { Holiday, HolidaySource, LocalHoliday, MovableHoliday } from './types';

export interface HolidayDef {
  date: string;
  name: string;
  source: Exclude<HolidaySource, 'manual' | 'estadual' | 'municipal'>;
  note?: string;
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return isoDate(year, month, day);
}

export function holidaysOfYear(year: number): HolidayDef[] {
  const easter = easterSunday(year);
  const fixed = (m: number, d: number, name: string): HolidayDef => ({ date: isoDate(year, m, d), name, source: 'nacional' });
  const list: HolidayDef[] = [
    fixed(1, 1, 'Confraternização Universal'),
    { date: addDays(easter, -48), name: 'Carnaval (segunda-feira)', source: 'facultativo', note: 'Ponto facultativo; feriado apenas onde houver lei local.' },
    { date: addDays(easter, -47), name: 'Carnaval (terça-feira)', source: 'facultativo', note: 'Ponto facultativo; feriado apenas onde houver lei local.' },
    { date: addDays(easter, -2), name: 'Sexta-feira da Paixão', source: 'nacional', note: 'Feriado religioso; confirme a lei municipal.' },
    fixed(4, 21, 'Tiradentes'),
    fixed(5, 1, 'Dia do Trabalho'),
    { date: addDays(easter, 60), name: 'Corpus Christi', source: 'facultativo', note: 'Ponto facultativo; feriado apenas onde houver lei local.' },
    fixed(9, 7, 'Independência do Brasil'),
    fixed(10, 12, 'Nossa Senhora Aparecida'),
    fixed(11, 2, 'Finados'),
    fixed(11, 15, 'Proclamação da República'),
    fixed(11, 20, 'Dia Nacional de Zumbi e da Consciência Negra'),
    fixed(12, 25, 'Natal'),
  ];
  return list.sort((x, y) => x.date.localeCompare(y.date));
}

/** Feriados e pontos facultativos que caem nas datas informadas (inclui viradas de ano). */
export function holidaysInDates(dates: string[]): HolidayDef[] {
  if (!dates.length) return [];
  const years = new Set(dates.map((d) => Number(d.slice(0, 4))));
  const set = new Set(dates);
  return [...years].flatMap(holidaysOfYear).filter((h) => set.has(h.date));
}

/** Feriados nacionais incluídos automaticamente (academia aberta no horário de feriado). */
export function defaultHolidays(dates: string[]): Holiday[] {
  return holidaysInDates(dates)
    .filter((h) => h.source === 'nacional')
    .map((h) => ({ date: h.date, name: h.name, closed: false, source: h.source }));
}

export const MOVABLE_LABEL: Record<MovableHoliday, string> = {
  'carnaval-seg': 'Carnaval (segunda-feira)',
  'carnaval-ter': 'Carnaval (terça-feira)',
  'corpus-christi': 'Corpus Christi',
};
const MOVABLE_OFFSET: Record<MovableHoliday, number> = { 'carnaval-seg': -48, 'carnaval-ter': -47, 'corpus-christi': 60 };

/** Data de um feriado local num ano. */
export function localHolidayDate(h: LocalHoliday, year: number): string | null {
  if (h.movable) return addDays(easterSunday(year), MOVABLE_OFFSET[h.movable]);
  if (!h.date || !/^\d{2}-\d{2}$/.test(h.date)) return null;
  const iso = `${year}-${h.date}`;
  const [m, d] = h.date.split('-').map(Number);
  const dt = new Date(Date.UTC(year, m - 1, d));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? iso : null;
}

/** Feriados locais que caem nas datas informadas. */
export function localHolidaysInDates(list: LocalHoliday[], dates: string[]): Holiday[] {
  if (!dates.length) return [];
  const years = [...new Set(dates.map((d) => Number(d.slice(0, 4))))];
  const set = new Set(dates);
  const out: Holiday[] = [];
  for (const h of list)
    for (const y of years) {
      const date = localHolidayDate(h, y);
      if (date && set.has(date) && h.name.trim()) out.push({ date, name: h.name.trim(), closed: h.closed, source: h.scope });
    }
  return out;
}

/**
 * Coloca os feriados locais da unidade na lista de feriados da escala: os locais anteriores saem, os atuais
 * entram (no lugar de um ponto facultativo ou feriado manual do mesmo dia; um feriado nacional fica como está).
 */
export function mergeLocalHolidays(holidays: Holiday[], list: LocalHoliday[], dates: string[]): Holiday[] {
  const base = holidays.filter((h) => h.source !== 'estadual' && h.source !== 'municipal');
  const locais = localHolidaysInDates(list, dates).filter((l) => !base.some((h) => h.date === l.date && h.source === 'nacional'));
  const datas = new Set(locais.map((l) => l.date));
  return [...base.filter((h) => !datas.has(h.date)), ...locais].sort((a, b) => a.date.localeCompare(b.date));
}
