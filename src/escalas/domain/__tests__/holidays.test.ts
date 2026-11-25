import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeSchedule } from '../analyze';
import { buildRange, weekdayOf } from '../calendar';
import { generateSchedule } from '../generator';
import { defaultScheduleConfig } from '../defaults';
import { easterSunday, holidaysOfYear } from '../holidays';
import { weekendShiftRisks } from '../risks';
import { analyze, applyGeneration, createSchedule, setCell } from '../scheduleOps';
import { breakMinutes, effectiveMinutes } from '../time';
import type { DeptId } from '../types';
import { configWith, THREE } from './fixtures';

const DEPTS: DeptId[] = ['recepcao', 'apoio'];

describe('calendário de feriados', () => {
  it('calcula a Páscoa e os feriados móveis', () => {
    expect(easterSunday(2026)).toBe('2026-04-05');
    expect(easterSunday(2027)).toBe('2027-03-28');
    const h = holidaysOfYear(2026);
    expect(h.find((x) => x.name === 'Sexta-feira da Paixão')?.date).toBe('2026-04-03');
    expect(h.find((x) => x.name === 'Corpus Christi')).toMatchObject({ date: '2026-06-04', source: 'facultativo' });
    expect(h.find((x) => x.name.startsWith('Carnaval (terça'))?.date).toBe('2026-02-17');
    expect(h.filter((x) => x.source === 'nacional')).toHaveLength(10);
  });

  it('inclui automaticamente os feriados nacionais do período, com a academia aberta 08–18', () => {
    const c = defaultScheduleConfig(2026, 11);
    expect(c.holidays.map((h) => h.date)).toEqual(['2026-11-02', '2026-11-15', '2026-11-20']);
    expect(c.holidays.every((h) => !h.closed)).toBe(true);
    expect(c.holidayHours).toEqual({ start: '08:00', end: '18:00' });
    // 08–18 = 10h: o intervalo sobe para 1h36 para a jornada ficar em 8h24min
    const shift = c.departments.recepcao.holidayShift;
    expect(breakMinutes(shift)).toBe(96);
    expect(effectiveMinutes(shift)).toBe(504);
    // Dezembro de 2026 traz o Natal; a semana de borda (até 03/01/2027) traz o Ano-Novo
    expect(defaultScheduleConfig(2026, 12).holidays.map((h) => h.date)).toEqual(['2026-12-25', '2027-01-01']);
  });
});

describe('geração com feriados (novembro de 2026: seg 02, dom 15, sex 20)', () => {
  const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE }, true);
  const r = generateSchedule(config);
  const range = buildRange(2026, 11);
  const idx = (d: string) => range.dates.indexOf(d);

  it('gera uma escala válida', () => {
    expect(r.conflicts).toEqual([]);
    expect(r.analysis.valid).toBe(true);
  });

  it('no feriado trabalha 1 por departamento, das 08 às 18; os demais têm folga de feriado', () => {
    for (const date of ['2026-11-02', '2026-11-20'])
      for (const id of DEPTS) {
        const cells = r.analysis.depts[id].resolved.cells.map((row) => row[idx(date)]);
        const working = cells.filter((c) => c.status === 'T');
        expect(working).toHaveLength(1);
        expect(working[0].origin).toBe('feriado');
        expect(working[0].shift).toMatchObject({ start: '08:00', end: '18:00' });
        expect(cells.filter((c) => c.status === 'FE')).toHaveLength(2);
      }
  });

  it('na semana do feriado, o feriado conta como folga: quem folgou trabalha 5 dias e quem trabalhou no feriado, 4 (folga compensatória)', () => {
    for (const id of DEPTS) {
      const { cells } = r.analysis.depts[id].resolved;
      for (const [w, hol] of [[1, '2026-11-02'], [3, '2026-11-20']] as const)
        for (const row of cells) {
          const dias = row.slice(w * 7, w * 7 + 7).filter((c) => c.status === 'T').length;
          expect(dias).toBe(row[idx(hol)].status === 'T' ? 4 : 5);
        }
    }
  });

  it('feriado no domingo segue a equipe de feriado e o horário de feriado', () => {
    for (const id of DEPTS) {
      const working = r.analysis.depts[id].resolved.cells.map((row) => row[idx('2026-11-15')]).filter((c) => c.status === 'T');
      expect(working).toHaveLength(1);
      expect(working[0].shift?.end).toBe('18:00');
    }
  });

  it('faz rodízio de quem trabalha nos feriados', () => {
    for (const id of DEPTS) {
      const { cells, ctx } = r.analysis.depts[id].resolved;
      const workers = ['2026-11-02', '2026-11-15', '2026-11-20'].map((d) => ctx.employees[cells.findIndex((row) => row[idx(d)].status === 'T')].id);
      expect(new Set(workers).size).toBeGreaterThan(1);
    }
  });

  it('sem folga compensatória (pagamento), quem trabalha no feriado faz 5 dias', () => {
    const c2 = structuredClone(config);
    c2.labor.holidayWorkCompensation = 'pagamento';
    const r2 = generateSchedule(c2);
    expect(r2.analysis.valid).toBe(true);
    const { cells } = r2.analysis.depts.recepcao.resolved;
    const worker = cells.find((row) => row[idx('2026-11-02')].status === 'T')!;
    expect(worker.slice(7, 14).filter((c) => c.status === 'T')).toHaveLength(5);
  });

  it('marcar folga manual em feriado vira folga de feriado; trabalhar sem compensação gera alerta', () => {
    const s = applyGeneration(createSchedule(2026, 11, config), r, 0);
    const da = r.analysis.depts.recepcao.resolved;
    const worker = da.ctx.employees[da.cells.findIndex((row) => row[idx('2026-11-02')].status === 'T')];
    const off = setCell(s, worker.id, '2026-11-02', { status: 'F' });
    expect(off.cells![worker.id]['2026-11-02'].status).toBe('FE');
    const other = da.ctx.employees.find((e) => s.cells![e.id]['2026-11-02'].status === 'FE' && s.cells![e.id]['2026-11-03'].status === 'T')!;
    const extra = setCell(s, other.id, '2026-11-02', { status: 'T' });
    expect(analyze(extra)!.alerts.some((a) => a.code === 'FERIADO_EXCEDIDO')).toBe(true);
  });

  it('feriado com a academia fechada: ninguém trabalha', () => {
    const c3 = structuredClone(config);
    c3.holidays = c3.holidays.map((h) => (h.date === '2026-11-20' ? { ...h, closed: true } : h));
    const r3 = generateSchedule(c3);
    expect(r3.analysis.valid).toBe(true);
    for (const id of DEPTS) expect(r3.analysis.depts[id].dailyCounts[idx('2026-11-20')]).toBe(0);
  });
});

describe('alerta de carga horária ao alterar o horário do domingo', () => {
  it('avisa na configuração quando domingo + 4 dias úteis passa do limite', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
    // Padrão: 8h24min nos dias úteis e no sábado, domingo 08–13 → semanas de no máximo 42h
    expect(weekendShiftRisks(config)).toEqual([]);
    config.departments.recepcao.sundayShift = { start: '08:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00' }; // 9h
    const risks = weekendShiftRisks(config);
    expect(risks.length).toBeGreaterThan(0);
    expect(risks.every((r) => r.dept === 'recepcao')).toBe(true);
    expect(risks[0].message).toMatch(/domingo e 4 dia\(s\) útil\(eis\), a semana somaria 42h36.*limite de 42h.*Rec 1, Rec 2, Rec 3/);
  });

  it('na escala já gerada, recalcula e acusa a semana acima do limite', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
    const s = applyGeneration(createSchedule(2026, 11, config), generateSchedule(config), 0);
    expect(analyze(s)!.alerts.some((a) => a.code === 'LIMITE_SEMANAL')).toBe(false);
    const c2 = structuredClone(s.config);
    c2.departments.recepcao.sundayShift = { start: '08:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00' };
    const a = analyzeSchedule(c2, s.cells!);
    const sundayWorkers = a.depts.recepcao.resolved.cells.filter((row) => row.some((c, d) => weekdayOf(a.range.dates[d]) === 0 && c.status === 'T'));
    expect(sundayWorkers.length).toBeGreaterThan(0);
    expect(a.alerts.some((x) => x.code === 'LIMITE_SEMANAL' && x.dept === 'recepcao')).toBe(true);
    // Com dias de 8h24min e domingo de 9h, toda semana de quem trabalha no domingo passa de 42h:
    // o gerador não esconde isso — informa o conflito e sugere a correção.
    const regenerated = generateSchedule(c2);
    expect(regenerated.feasible).toBe(false);
    const conflict = regenerated.conflicts.find((x) => x.code === 'LIMITE_SEMANAL');
    expect(conflict?.dept).toBe('recepcao');
    expect(conflict?.suggestions.join(' ')).toMatch(/domingo/);
    // Voltando o domingo para 08–14, a escala volta a ser válida
    c2.departments.recepcao.sundayShift = s.config.departments.recepcao.sundayShift;
    expect(generateSchedule(c2).feasible).toBe(true);
  });
});
