import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeSchedule } from '../analyze';
import { buildRange, weekdayOf } from '../calendar';
import { generateSchedule } from '../generator';
import { confirmSchedule, ConfirmationBlockedError, createSchedule, analyze, setCell, applyGeneration, addException, normalizeSchedule } from '../scheduleOps';
import { validateConfig } from '../schema';
import { effectiveMinutes } from '../time';
import type { CellGrid, DeptId, ScheduleConfig, Shift } from '../types';
import { configWith, FIVE, THREE } from './fixtures';

const DEPTS: DeptId[] = ['recepcao', 'apoio'];

/** Grade manual: por padrão todos trabalham nos dias úteis e folgam no fim de semana. */
function manualGrid(config: ScheduleConfig, pick?: (empId: string, date: string) => 'T' | 'F' | undefined): CellGrid {
  const range = buildRange(config.year, config.month);
  const grid: CellGrid = {};
  for (const id of [...DEPTS, 'professores', 'estagiarios'] as DeptId[])
    for (const e of config.departments[id].employees) {
      grid[e.id] = {};
      for (const d of range.dates) {
        const w = weekdayOf(d);
        grid[e.id][d] = { status: pick?.(e.id, d) ?? (w === 0 || w === 6 ? 'F' : 'T') };
      }
    }
  return grid;
}

function workingOn(result: ReturnType<typeof generateSchedule>, dept: DeptId, date: string) {
  const da = result.analysis.depts[dept];
  const d = da.resolved.ctx.dates.indexOf(date);
  return da.resolved.cells.filter((row) => row[d].status === 'T').length;
}

describe('geração com 3 colaboradores por departamento (aceites 1, 4, 5, 6)', () => {
  const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
  const result = generateSchedule(config);

  it('gera uma escala válida, sem conflitos obrigatórios', () => {
    expect(validateConfig(config)).toEqual([]);
    expect(result.feasible).toBe(true);
    expect(result.analysis.counts.critico).toBe(0);
    expect(result.analysis.valid).toBe(true);
  });

  it('gera todos os dias do mês para cada colaborador', () => {
    const range = buildRange(2026, 11);
    for (const id of DEPTS)
      for (const e of config.departments[id].employees)
        for (const d of range.monthDates) expect(result.cells[e.id][d]?.status).toMatch(/^(T|F)$/);
  });

  it('sábado e domingo com exatamente 1 colaborador por departamento', () => {
    const range = buildRange(2026, 11);
    for (const d of range.dates.filter((x) => [0, 6].includes(weekdayOf(x))))
      for (const id of DEPTS) expect(workingOn(result, id, d)).toBe(1);
  });

  it('respeita 5 dias trabalhados e 2 folgas em todas as semanas', () => {
    for (const id of DEPTS) {
      const da = result.analysis.depts[id];
      da.resolved.ctx.employees.forEach((_, e) => {
        for (let w = 0; w < da.resolved.ctx.range.weeks.length; w++) {
          const week = da.resolved.cells[e].slice(w * 7, w * 7 + 7);
          expect(week.filter((c) => c.status === 'T')).toHaveLength(5);
          expect(week.filter((c) => c.status === 'F')).toHaveLength(2);
        }
      });
    }
  });

  it('não deixa abertura nem fechamento descobertos e não excede 2 simultâneos', () => {
    const codes = result.analysis.alerts.map((a) => a.code);
    expect(codes).not.toContain('ABERTURA_DESCOBERTA');
    expect(codes).not.toContain('FECHAMENTO_DESCOBERTO');
    expect(codes).not.toContain('SIMULTANEOS_EXCEDIDO');
  });

  it('distribui as folgas de dias úteis sem concentrar todos no mesmo dia', () => {
    const da = result.analysis.depts.recepcao;
    const { ctx, cells } = da.resolved;
    ctx.dates.forEach((_, d) => {
      if (ctx.weekdays[d] === 0 || ctx.weekdays[d] === 6) return;
      expect(cells.filter((row) => row[d].status === 'F').length).toBeLessThanOrEqual(1);
    });
  });
});

describe('geração com 4 colaboradores (aceite 2)', () => {
  it('gera escala válida com horários que respeitam o limite de simultâneos', () => {
    const config = configWith(2026, 11, { recepcao: ['abertura', 'abertura', 'fechamento', 'fechamento'], apoio: ['abertura', 'intermediario', 'fechamento', 'fechamento'] });
    // Com a jornada de 8h24min, abertura e fechamento se cruzam por 48 minutos: o limite é a equipe toda
    config.departments.apoio.maxSimultaneous = 4;
    const r = generateSchedule(config);
    expect(validateConfig(config)).toEqual([]);
    expect(r.feasible).toBe(true);
    expect(Object.keys(r.cells)).toHaveLength(8);
    for (const d of buildRange(2026, 11).dates.filter((x) => weekdayOf(x) === 6)) {
      expect(workingOn(r, 'recepcao', d)).toBe(1);
      expect(workingOn(r, 'apoio', d)).toBe(1);
    }
  });

  it('com sobreposição de horários e máximo 2, informa que não há solução válida e sugere alterações (aceite 13)', () => {
    const config = configWith(2026, 11, { recepcao: ['abertura', 'intermediario', 'fechamento', 'fechamento'], apoio: THREE });
    config.departments.recepcao.maxSimultaneous = 2;
    const r = generateSchedule(config);
    expect(r.feasible).toBe(false);
    const c = r.conflicts.find((x) => x.code === 'SIMULTANEOS_EXCEDIDO');
    expect(c).toBeDefined();
    expect(c!.dept).toBe('recepcao');
    expect(c!.suggestions.length).toBeGreaterThan(0);
    expect(r.analysis.valid).toBe(false);
  });

  it('com folga adicional permitida, reduz os conflitos e alerta a carga abaixo da planejada', () => {
    const config = configWith(2026, 11, { recepcao: ['abertura', 'intermediario', 'fechamento', 'fechamento'], apoio: THREE });
    config.departments.recepcao.maxSimultaneous = 2;
    // Turnos de 8h que não se cruzam entre abertura e fechamento (só o intermediário passa do limite de 2)
    const h = (start: string, end: string, b: string, e: string): Shift => ({ start, end, breakStart: b, breakEnd: e });
    const turnos = [h('05:00', '14:00', '09:00', '10:00'), h('09:00', '18:00', '13:00', '14:00'), h('14:00', '23:00', '18:00', '19:00'), h('14:00', '23:00', '18:00', '19:00')];
    config.departments.recepcao.employees.forEach((e, i) => { e.shift = turnos[i]; e.weeklyPlannedHours = 40; e.weeklyContractedHours = 40; });
    const count = (r: ReturnType<typeof generateSchedule>) => r.analysis.alerts.filter((a) => a.dept === 'recepcao' && a.code === 'SIMULTANEOS_EXCEDIDO').length;
    const without = count(generateSchedule(config));
    config.departments.recepcao.allowExtraOffDays = true;
    const r = generateSchedule(config);
    expect(count(r)).toBeLessThan(without);
    expect(r.analysis.alerts.some((a) => a.dept === 'recepcao' && a.code === 'CARGA_ABAIXO')).toBe(true);
  });
});

describe('geração com 5 colaboradores', () => {
  it('gera escala válida, com 5x2 e a equipe exigida no fim de semana e feriados', () => {
    const config = configWith(2026, 11, { recepcao: FIVE, apoio: FIVE }, true);
    for (const id of DEPTS) {
      config.departments[id].maxSimultaneous = 5;
      config.departments[id].saturdayRequired = 2;
      config.departments[id].sundayRequired = 1;
    }
    expect(validateConfig(config)).toEqual([]);
    const t0 = Date.now();
    const r = generateSchedule(config);
    expect(Date.now() - t0).toBeLessThan(15000);
    expect(Object.keys(r.cells)).toHaveLength(10);
    expect(r.conflicts.filter((c) => c.code === 'EQUIPE')).toEqual([]);
    for (const d of buildRange(2026, 11).monthDates.filter((x) => weekdayOf(x) === 6)) {
      expect(workingOn(r, 'recepcao', d)).toBe(2);
      expect(workingOn(r, 'apoio', d)).toBe(2);
    }
    expect(r.analysis.alerts.filter((a) => a.code === 'MODELO_5X2')).toEqual([]);
  });

  it('não aceita 6 colaboradores', () => {
    const config = configWith(2026, 11, { recepcao: [...FIVE, 'intermediario'], apoio: THREE });
    expect(validateConfig(config).length).toBeGreaterThan(0);
  });
});

describe('horário de funcionamento configurável (aceite 3)', () => {
  it('usa abertura e fechamento configurados e não escala em dia fechado', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
    for (const w of [1, 2, 3, 4, 5]) config.operatingHours[w] = { open: true, start: '06:00', end: '22:00' };
    config.operatingHours[0] = { open: false, start: '08:00', end: '13:00' };
    for (const id of DEPTS) {
      const [a, i, f] = config.departments[id].employees;
      a.shift = { start: '06:00', end: '14:00', breakStart: '10:00', breakEnd: '11:00' };
      i.shift = { start: '09:00', end: '18:00', breakStart: '13:00', breakEnd: '14:00' };
      f.shift = { start: '14:00', end: '22:00', breakStart: '18:00', breakEnd: '19:00' };
    }
    const r = generateSchedule(config);
    expect(r.feasible).toBe(true);
    for (const d of buildRange(2026, 11).dates.filter((x) => weekdayOf(x) === 0)) expect(workingOn(r, 'recepcao', d)).toBe(0);
    // Ao fechar às 23h com o fechamento saindo às 22h, o sistema acusa fechamento descoberto
    config.operatingHours[3] = { open: true, start: '06:00', end: '23:00' };
    const r2 = generateSchedule(config);
    expect(r2.analysis.alerts.some((a) => a.code === 'FECHAMENTO_DESCOBERTO' && weekdayOf(a.date!) === 3)).toBe(true);
  });
});

describe('regra de cobertura da abertura (aceites 7 e 8)', () => {
  const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
  // O intermediário sai às 18h: na manhã seguinte pode abrir às 5h com as 11h de descanso entre jornadas.
  config.departments.recepcao.employees[1].shift = { start: '09:00', end: '18:00', breakStart: '13:00', breakEnd: '14:00' };
  const wed = '2026-11-04';

  it('transfere o intermediário para a abertura quando o titular folga, e alerta o intermediário descoberto', () => {
    const grid = manualGrid(config, (id, d) => (id === 'recepcao-1' && d === wed ? 'F' : undefined));
    const a = analyzeSchedule(config, grid);
    const da = a.depts.recepcao;
    const d = da.resolved.ctx.dates.indexOf(wed);
    const inter = da.resolved.cells[1][d];
    expect(inter.origin).toBe('substituicao');
    expect(inter.shift).toEqual(config.departments.recepcao.employees[0].shift);
    expect(inter.minutes).toBe(504);
    const codes = a.alerts.filter((x) => x.date === wed && x.dept === 'recepcao').map((x) => x.code);
    expect(codes).toContain('SUBSTITUICAO_TURNO');
    expect(codes).toContain('INTERMEDIARIO_DESCOBERTO');
    expect(codes).not.toContain('ABERTURA_DESCOBERTA');
  });

  it('não substitui quando a troca viola o descanso entre jornadas e apresenta alternativas', () => {
    const grid = manualGrid(config, (id, d) => (id === 'recepcao-1' && d === wed ? 'F' : undefined));
    // Na véspera o intermediário fechou às 23h: abrir às 05h daria só 6h de descanso
    grid['recepcao-2']['2026-11-03'] = { status: 'T', manualShift: { start: '14:00', end: '23:00', breakStart: '18:00', breakEnd: '19:00' } };
    const a = analyzeSchedule(config, grid);
    const d = a.depts.recepcao.resolved.ctx.dates.indexOf(wed);
    expect(a.depts.recepcao.resolved.cells[1][d].origin).toBe('habitual');
    const open = a.alerts.find((x) => x.code === 'ABERTURA_DESCOBERTA' && x.date === wed);
    expect(open?.severity).toBe('critico');
    expect(open?.message).toMatch(/Substituição não aplicada.*descanso/);
    expect(open?.suggestion).toMatch(/Alternativas/);
  });

  it('pode ser desativada por departamento', () => {
    const c2 = structuredClone(config);
    c2.departments.recepcao.openingCoverKinds = [];
    const grid = manualGrid(c2, (id, d) => (id === 'recepcao-1' && d === wed ? 'F' : undefined));
    const a = analyzeSchedule(c2, grid);
    expect(a.alerts.some((x) => x.code === 'ABERTURA_DESCOBERTA' && x.date === wed && x.dept === 'recepcao')).toBe(true);
  });
});

describe('horas semanais e mensais (aceites 10 e 11)', () => {
  it('soma a semana completa, mesmo atravessando o mês, e o mês só com dias do mês', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
    const a = analyzeSchedule(config, manualGrid(config));
    const s = a.depts.recepcao.stats[0];
    // Semana 1: 26/10 (seg) a 01/11 (dom) — 5 dias úteis em outubro, 8h24min cada
    expect(s.weekMinutes[0]).toBe(42 * 60);
    // Novembro de 2026 tem 21 dias úteis
    expect(s.workedDays).toBe(21);
    expect(s.monthMinutes).toBe(21 * 504);
    expect(a.alerts.some((x) => x.code === 'SEMANA_INCOMPLETA')).toBe(true);
  });

  it('alerta quando a jornada semanal ultrapassa o limite configurado', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
    config.departments.recepcao.employees[0].shift = { start: '05:00', end: '15:00', breakStart: '09:00', breakEnd: '10:00' }; // 9h/dia
    const a = analyzeSchedule(config, manualGrid(config));
    const over = a.alerts.filter((x) => x.code === 'LIMITE_SEMANAL' && x.employeeId === 'recepcao-1');
    expect(over.length).toBeGreaterThan(0);
    expect(over[0].severity).toBe('critico');
    expect(over[0].message).toContain('45h');
    // Com limite de 42h continua acima; com 45h deixa de alertar
    config.labor.weeklyLimitHours = 45;
    expect(analyzeSchedule(config, manualGrid(config)).alerts.some((x) => x.code === 'LIMITE_SEMANAL')).toBe(false);
  });

  it('feriado com a academia fechada não conta como trabalho nem como folga', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
    config.holidays = [{ date: '2026-11-20', name: 'Feriado de teste', closed: true, source: 'manual' }];
    const r = generateSchedule(config);
    expect(r.cells['recepcao-1']['2026-11-20'].status).toBe('FE');
    expect(r.analysis.alerts.some((x) => x.code === 'TRABALHO_DIA_FECHADO')).toBe(false);
    const week = r.analysis.depts.recepcao.resolved.cells[0].slice(21, 28); // 16/11–22/11
    expect(week.filter((c) => c.status === 'T')).toHaveLength(4);
  });
});

describe('outros alertas obrigatórios', () => {
  it('alerta mais de 2 simultâneos, salvo exceção autorizada (aceite 12)', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
    config.departments.recepcao.maxSimultaneous = 2;
    const shift: Shift = { start: '09:00', end: '18:00', breakStart: '13:00', breakEnd: '14:00' };
    const grid = manualGrid(config);
    for (const id of ['recepcao-1', 'recepcao-2', 'recepcao-3']) grid[id]['2026-11-10'] = { status: 'T', manualShift: shift };
    const a = analyzeSchedule(config, grid);
    const sim = a.alerts.find((x) => x.code === 'SIMULTANEOS_EXCEDIDO' && x.date === '2026-11-10');
    expect(sim?.severity).toBe('critico');
    expect(sim?.message).toMatch(/3 colaboradores/);
    config.exceptions = [{ id: 'x', date: '2026-11-10', dept: 'recepcao', kind: 'maxSimultaneous', value: 3, reason: 'Evento', authorizedAt: '' }];
    expect(analyzeSchedule(config, grid).alerts.some((x) => x.code === 'SIMULTANEOS_EXCEDIDO' && x.date === '2026-11-10')).toBe(false);
  });

  it('alerta descanso entre jornadas, dia de fim de semana acima do limite e intervalo insuficiente', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
    const grid = manualGrid(config);
    grid['recepcao-3']['2026-11-07'] = { status: 'T' }; // fechou sexta 23h e abre sábado 08h
    grid['recepcao-1']['2026-11-07'] = { status: 'T' }; // dois no sábado
    grid['recepcao-2']['2026-11-11'] = { status: 'T', manualShift: { start: '09:00', end: '17:00', breakStart: null, breakEnd: null } };
    const a = analyzeSchedule(config, grid);
    const codes = (c: string) => a.alerts.filter((x) => x.code === c);
    expect(codes('DESCANSO_ENTRE_JORNADAS').some((x) => x.employeeId === 'recepcao-3' && x.date === '2026-11-07')).toBe(true);
    expect(codes('FIM_SEMANA_EXCEDIDO').some((x) => x.date === '2026-11-07' && x.dept === 'recepcao')).toBe(true);
    expect(codes('INTERVALO_INSUFICIENTE').some((x) => x.employeeId === 'recepcao-2')).toBe(true);
    expect(codes('FIM_SEMANA_SEM_COBERTURA').some((x) => x.date === '2026-11-08' && x.dept === 'recepcao')).toBe(true);
  });

  it('identifica quando não existe solução com a equipe disponível (aceite 13)', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
    for (const e of config.departments.apoio.employees) e.availableWeekdays = [1, 2, 3, 4, 5, 6]; // ninguém aos domingos
    const r = generateSchedule(config);
    expect(r.feasible).toBe(false);
    const c = r.conflicts.find((x) => x.code === 'FIM_SEMANA_SEM_COBERTURA');
    expect(c?.dept).toBe('apoio');
    expect(c?.dates.every((d) => weekdayOf(d) === 0)).toBe(true);
    expect(c?.suggestions.length).toBeGreaterThan(0);
  });
});

describe('edição manual, confirmação e semanas entre meses (aceites 14 e 17)', () => {
  const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
  const base = applyGeneration(createSchedule(2026, 11, config), generateSchedule(config), 0);

  it('recalcula horas e alertas imediatamente após uma alteração manual', () => {
    const date = '2026-11-12';
    const before = analyze(base)!;
    const emp = 'recepcao-3';
    expect(base.cells![emp][date].status).toBe('T');
    const weekBefore = before.depts.recepcao.stats[2].weekMinutes[2];
    const edited = setCell(base, emp, date, { status: 'F' });
    const after = analyze(edited)!;
    expect(after.depts.recepcao.stats[2].weekMinutes[2]).toBe(weekBefore - 504);
    expect(after.alerts.some((a) => a.code === 'FECHAMENTO_DESCOBERTO' && a.date === date)).toBe(true);
    expect(edited.changeLog).toHaveLength(1);
    expect(after.alerts.some((a) => a.code === 'ALTERACAO_GESTOR')).toBe(true);
    // Ajuste de horário também recalcula a jornada
    const shorter = setCell(base, emp, date, { manualShift: { start: '14:00', end: '23:00', breakStart: '18:00', breakEnd: '20:00' } });
    expect(analyze(shorter)!.depts.recepcao.stats[2].weekMinutes[2]).toBe(weekBefore - 84);
  });

  it('não confirma a escala com conflitos obrigatórios pendentes', () => {
    const edited = setCell(base, 'recepcao-3', '2026-11-12', { status: 'F' });
    expect(() => confirmSchedule(edited)).toThrow(ConfirmationBlockedError);
    const ok = confirmSchedule(base);
    expect(ok.status).toBe('confirmada');
    expect(ok.confirmedAt).not.toBeNull();
    // Qualquer alteração depois de confirmar volta para rascunho
    expect(setCell(ok, 'recepcao-1', '2026-11-12', { status: 'T' }).status).toBe('rascunho');
  });

  it('exceção autorizada fica registrada e é considerada na validação', () => {
    const sat = '2026-11-14';
    const twoOnSaturday = setCell(base, base.config.departments.recepcao.employees.find((e) => base.cells![e.id][sat].status === 'F')!.id, sat, { status: 'T' });
    expect(analyze(twoOnSaturday)!.alerts.some((a) => a.code === 'FIM_SEMANA_EXCEDIDO' && a.date === sat)).toBe(true);
    const authorized = addException(twoOnSaturday, { date: sat, dept: 'recepcao', kind: 'weekendStaff', value: 2, reason: 'Evento na unidade' });
    expect(analyze(authorized)!.alerts.some((a) => a.code === 'FIM_SEMANA_EXCEDIDO' && a.date === sat)).toBe(false);
  });

  it('importa os dias de borda da escala do mês anterior e os mantém travados', () => {
    const oct = configWith(2026, 10, { recepcao: THREE, apoio: THREE });
    const octResult = generateSchedule(oct);
    const nov = generateSchedule(config, { previous: octResult.cells });
    expect(nov.importedPrevious).toBe(true);
    for (const d of ['2026-10-26', '2026-10-27', '2026-10-31'])
      for (const id of ['recepcao-1', 'apoio-2']) {
        expect(nov.cells[id][d].status).toBe(octResult.cells[id][d].status);
        expect(nov.cells[id][d].locked).toBe(true);
      }
    expect(() => setCell(applyGeneration(createSchedule(2026, 11, config), nov, 0), 'recepcao-1', '2026-10-26', { status: 'F' })).toThrow();
  });

  it('jornada efetiva do sábado e domingo segue os turnos configurados', () => {
    const da = base.config.departments.recepcao;
    // Padrão: sábado 08–18 com intervalo maior para ficar em 8h24min, e domingo 08–13 (15 min)
    expect(effectiveMinutes(da.saturdayShift)).toBe(504);
    expect(effectiveMinutes(da.sundayShift)).toBe(4 * 60 + 45);
  });
});

describe('dias sem folga bloqueados pelo gestor', () => {
  it('ninguém folga no dia bloqueado e cada um mantém as 2 folgas na semana', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: ['abertura', 'intermediario', 'fechamento', 'fechamento'] });
    config.departments.apoio.maxSimultaneous = 3;
    config.departments.recepcao.maxSimultaneous = 3;
    config.noOffWeekdays = [3, 4]; // quartas e quintas
    expect(validateConfig(config)).toEqual([]);
    const r = generateSchedule(config);
    const blocked = buildRange(2026, 11).dates.filter((d) => [3, 4].includes(weekdayOf(d)));
    for (const d of blocked) {
      for (const id of DEPTS)
        for (const e of config.departments[id].employees) expect(r.cells[e.id][d].status).toBe('T');
    }
    expect(r.analysis.alerts.filter((a) => a.code === 'FOLGA_BLOQUEADA' || a.code === 'MODELO_5X2')).toEqual([]);
  });

  it('alerta quando o gestor marca folga manualmente em dia bloqueado', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
    config.noOffWeekdays = [3];
    const s = applyGeneration(createSchedule(2026, 11, config), generateSchedule(config), 0);
    const emp = config.departments.recepcao.employees[0];
    const edited = setCell(s, emp.id, '2026-11-11', { status: 'F' });
    expect(analyze(edited)!.alerts.some((a) => a.code === 'FOLGA_BLOQUEADA' && a.severity === 'critico')).toBe(true);
  });

  it('bloqueio do sábado escala a equipe toda em todos os sábados', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
    config.noOffWeekdays = [6];
    const r = generateSchedule(config);
    for (const d of buildRange(2026, 11).monthDates.filter((x) => weekdayOf(x) === 6)) {
      expect(workingOn(r, 'recepcao', d)).toBe(3);
      expect(workingOn(r, 'apoio', d)).toBe(3);
    }
  });

  it('não aceita bloquear dias demais para as 2 folgas', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
    config.noOffWeekdays = [1, 2, 3, 4, 5, 6];
    expect(validateConfig(config).some((i) => i.where === 'Dias sem folga')).toBe(true);
  });
});

describe('cobertura do fechamento em equipes de 4 e 5', () => {
  it('com os dois do fechamento de folga no mesmo dia, o intermediário cobre o fechamento', () => {
    const config = configWith(2026, 11, { recepcao: ['abertura', 'intermediario', 'fechamento', 'fechamento'], apoio: THREE });
    config.departments.recepcao.maxSimultaneous = 3;
    config.departments.recepcao.closingCoverKinds = ['intermediario'];
    const wed = '2026-11-06'; // sexta: o intermediário folga no sábado, então pode fechar às 23h
    const grid = manualGrid(config, (id, d) => ((id === 'recepcao-3' || id === 'recepcao-4') && d === wed ? 'F' : undefined));
    const a = analyzeSchedule(config, grid);
    const d = a.depts.recepcao.resolved.ctx.dates.indexOf(wed);
    expect(a.depts.recepcao.resolved.cells[1][d].origin).toBe('substituicao');
    expect(a.alerts.some((x) => x.code === 'FECHAMENTO_DESCOBERTO' && x.date === wed)).toBe(false);
  });

  it('com um dos dois do fechamento de folga, o outro cobre e não há troca', () => {
    const config = configWith(2026, 11, { recepcao: ['abertura', 'intermediario', 'fechamento', 'fechamento'], apoio: THREE });
    config.departments.recepcao.maxSimultaneous = 3;
    const wed = '2026-11-04';
    const grid = manualGrid(config, (id, d) => (id === 'recepcao-3' && d === wed ? 'F' : undefined));
    const a = analyzeSchedule(config, grid);
    const d = a.depts.recepcao.resolved.ctx.dates.indexOf(wed);
    expect(a.depts.recepcao.resolved.cells[1][d].origin).toBe('habitual');
    expect(a.alerts.some((x) => x.code === 'FECHAMENTO_DESCOBERTO' && x.date === wed)).toBe(false);
  });
});

describe('sábado com dois colaboradores em horários diferentes', () => {
  it('o 1º colaborador (ordem do turno) faz o 1º horário e o outro faz o 2º', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
    const dept = config.departments.recepcao;
    dept.saturdayRequired = 2;
    dept.saturdayShift = { start: '08:00', end: '14:00', breakStart: '11:00', breakEnd: '11:15' };
    dept.saturdayShift2 = { start: '11:00', end: '17:00', breakStart: '14:00', breakEnd: '14:15' };
    expect(validateConfig(config)).toEqual([]);
    const sat = '2026-11-07';
    // Sábado: abertura (recepcao-1) e fechamento (recepcao-3) trabalham
    const grid = manualGrid(config, (id, d) => (d === sat ? (id === 'recepcao-2' ? 'F' : id.startsWith('recepcao') ? 'T' : undefined) : undefined));
    const a = analyzeSchedule(config, grid);
    const d = a.depts.recepcao.resolved.ctx.dates.indexOf(sat);
    const cells = a.depts.recepcao.resolved.cells;
    expect(cells[0][d].shift).toEqual(dept.saturdayShift);
    expect(cells[2][d].shift).toEqual(dept.saturdayShift2);
  });

  it('a escala gerada usa os dois horários em todos os sábados', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
    const dept = config.departments.recepcao;
    dept.saturdayRequired = 2;
    dept.saturdayShift2 = { start: '09:00', end: '17:00', breakStart: '12:00', breakEnd: '13:00' };
    const r = generateSchedule(config);
    const da = r.analysis.depts.recepcao;
    for (const sat of buildRange(2026, 11).monthDates.filter((x) => weekdayOf(x) === 6)) {
      const d = da.resolved.ctx.dates.indexOf(sat);
      const starts = da.resolved.cells.filter((row) => row[d].status === 'T').map((row) => row[d].shift!.start).sort();
      expect(starts).toEqual(['08:00', '09:00']);
    }
  });
});

describe('professores (horistas no 5x2)', () => {
  it('gera escala válida com 5x2, mínimo presente e sem limite semanal', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE, professores: ['abertura', 'intermediario', 'fechamento', 'fechamento'] }, true);
    config.departments.professores.maxSimultaneous = 4;
    // Horário longo de um professor: não gera alerta de limite semanal (só exibe as horas)
    config.departments.professores.employees[1].shift = { start: '07:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00' };
    expect(validateConfig(config)).toEqual([]);
    const r = generateSchedule(config);
    const prof = r.analysis.alerts.filter((a) => a.dept === 'professores');
    expect(prof.filter((a) => a.severity === 'critico')).toEqual([]);
    expect(prof.some((a) => ['LIMITE_SEMANAL', 'CARGA_ABAIXO', 'HORAS_ADICIONAIS_SEMANA', 'HORAS_ADICIONAIS_DIA'].includes(a.code))).toBe(false);
    expect(r.analysis.depts.professores.resolved.substitutions.length).toBe(0);
    for (const e of config.departments.professores.employees)
      for (let w = 0; w < r.analysis.range.weeks.length; w++)
        expect(r.analysis.alerts.some((a) => a.code === 'MODELO_5X2' && a.employeeId === e.id)).toBe(false);
  });

  it('aponta os horários sem o mínimo de professores', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE, professores: THREE });
    const ps = config.departments.professores.employees;
    ps[0].shift = { start: '05:00', end: '11:00', breakStart: '08:00', breakEnd: '08:15' };
    ps[1].shift = { start: '05:00', end: '11:00', breakStart: '08:00', breakEnd: '08:15' };
    ps[2].shift = { start: '17:00', end: '23:00', breakStart: '20:00', breakEnd: '20:15' };
    const wed = '2026-11-04';
    const grid = manualGrid(config);
    const a = analyzeSchedule(config, grid);
    const gap = a.alerts.find((x) => x.code === 'PROFESSOR_DESCOBERTO' && x.date === wed);
    expect(gap?.severity).toBe('critico');
    expect(gap?.message).toContain('das 11:00 às 17:00');
  });

  it('escalas antigas, sem professores, continuam válidas com o departamento desligado', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
    const old = createSchedule(2026, 11, config);
    delete (old.config.departments as Partial<typeof old.config.departments>).professores;
    const n = normalizeSchedule(old);
    expect(n.config.departments.professores.enabled).toBe(false);
    expect(validateConfig(n.config)).toEqual([]);
  });

  it('equipe de 8 professores gera em tempo razoável', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE, professores: ['abertura', 'intermediario', 'fechamento', 'abertura', 'intermediario', 'fechamento', 'abertura', 'fechamento'] });
    config.departments.professores.maxSimultaneous = 8;
    config.departments.professores.saturdayRequired = 2;
    const t0 = Date.now();
    const r = generateSchedule(config);
    expect(Date.now() - t0).toBeLessThan(20000);
    expect(r.analysis.alerts.filter((a) => a.dept === 'professores' && a.severity === 'critico')).toEqual([]);
  });
});

describe('férias', () => {
  it('não escala nas férias, dá folga proporcional e mantém o 5x2 (dias descobertos viram conflito)', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: FIVE });
    config.departments.apoio.maxSimultaneous = 3;
    // Férias de quarta 11/11 a domingo 22/11: semana de 09/11 tem 2 dias fora das férias (seg, ter)
    config.departments.apoio.employees[4].vacations = [{ start: '2026-11-11', end: '2026-11-22' }];
    // Recepção (3 pessoas): férias da abertura deixam a cobertura incompleta
    config.departments.recepcao.employees[0].vacations = [{ start: '2026-11-16', end: '2026-11-22' }];
    expect(validateConfig(config)).toEqual([]);
    const r = generateSchedule(config);
    const range = buildRange(2026, 11);
    const vac = config.departments.apoio.employees[4];
    for (const d of range.dates.filter((x) => x >= '2026-11-11' && x <= '2026-11-22')) expect(r.cells[vac.id][d].status).toBe('FR');
    // semana 09–15/11: seg e ter fora das férias → 1 folga proporcional (round(2 × 2/7) = 1)
    const before = ['2026-11-09', '2026-11-10'].map((d) => r.cells[vac.id][d].status);
    expect(before.filter((x) => x === 'F').length).toBe(1);
    // ninguém passa do 5x2
    expect(r.analysis.alerts.some((a) => a.code === 'MODELO_5X2')).toBe(false);
    // Recepção com 2 pessoas na semana de férias: dias descobertos aparecem como conflito
    expect(r.analysis.alerts.some((a) => a.dept === 'recepcao' && a.severity === 'critico' && a.date! >= '2026-11-16' && a.date! <= '2026-11-22')).toBe(true);
    expect(r.analysis.alerts.some((a) => a.code === 'FERIAS' && a.employeeId === vac.id)).toBe(true);
    expect(r.analysis.depts.apoio.stats[4].vacationDays).toBe(12);
  });

  it('alerta quem está escalado durante as férias', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
    config.departments.recepcao.employees[1].vacations = [{ start: '2026-11-04', end: '2026-11-06' }];
    const a = analyzeSchedule(config, manualGrid(config));
    expect(a.alerts.some((x) => x.code === 'TRABALHO_FERIAS' && x.date === '2026-11-05')).toBe(true);
  });
});

describe('dias em que o colaborador nunca trabalha', () => {
  it('o gerador nunca escala o colaborador no dia bloqueado', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: FIVE });
    config.departments.apoio.maxSimultaneous = 5;
    const emp = config.departments.apoio.employees[1];
    emp.availableWeekdays = [0, 1, 3, 4, 5, 6]; // nunca às terças
    const r = generateSchedule(config);
    for (const d of buildRange(2026, 11).dates.filter((x) => weekdayOf(x) === 2)) expect(r.cells[emp.id][d].status).not.toBe('T');
    expect(r.analysis.alerts.filter((a) => a.dept === 'apoio' && a.severity === 'critico')).toEqual([]);
  });
});

describe('estagiários', () => {
  it('gera com 5h por dia, sábado e domingo em rodízio, dentro da Lei do Estágio', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
    const est = config.departments.estagiarios;
    est.enabled = true;
    est.employees = est.employees.slice(0, 2);
    est.headcount = 2;
    est.employees[0].name = 'Laura Matos';
    est.employees[1].name = 'Mateus Costa';
    expect(validateConfig(config)).toEqual([]);
    const r = generateSchedule(config);
    for (const d of buildRange(2026, 11).monthDates.filter((x) => [0, 6].includes(weekdayOf(x)))) expect(workingOn(r, 'estagiarios', d)).toBe(1);
    expect(r.analysis.alerts.filter((a) => a.dept === 'estagiarios' && a.severity === 'critico')).toEqual([]);
    const da = r.analysis.depts.estagiarios;
    for (const s of da.stats) expect(s.weekMinutes.every((m) => m <= 30 * 60)).toBe(true);
    for (const row of da.resolved.cells) for (const c of row) if (c.status === 'T') expect(c.minutes).toBeLessThanOrEqual(6 * 60);
    // os dois fazem fim de semana (rodízio)
    expect(da.stats.every((s) => s.saturdays + s.sundays > 0)).toBe(true);
  });

  it('alerta jornada acima de 6h por dia e 30h por semana', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
    const est = config.departments.estagiarios;
    est.enabled = true;
    est.employees = est.employees.slice(0, 2);
    est.headcount = 2;
    est.employees[0].name = 'Laura Estagiária';
    est.employees[1].name = 'Mateus Costa';
    est.employees[0].shift = { start: '08:00', end: '16:00', breakStart: '12:00', breakEnd: '13:00' }; // 7h
    const a = analyzeSchedule(config, manualGrid(config));
    expect(a.alerts.some((x) => x.dept === 'estagiarios' && x.code === 'LIMITE_DIARIO' && x.message.includes('Lei do Estágio'))).toBe(true);
    expect(a.alerts.some((x) => x.dept === 'estagiarios' && x.code === 'LIMITE_SEMANAL' && x.message.includes('30h'))).toBe(true);
  });
});

describe('não gerar um departamento', () => {
  it('Recepção fora da escala: não exige cadastro e gera só os demais', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
    config.departments.recepcao.enabled = false;
    for (const e of config.departments.recepcao.employees) e.name = '';
    expect(validateConfig(config)).toEqual([]);
    const r = generateSchedule(config);
    expect(r.analysis.depts.recepcao.resolved.ctx.employees).toHaveLength(0);
    expect(r.analysis.alerts.some((a) => a.dept === 'recepcao')).toBe(false);
    expect(r.analysis.alerts.filter((a) => a.dept === 'apoio' && a.severity === 'critico')).toEqual([]);
  });

  it('pendências dizem onde está o problema e de qual departamento', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
    config.departments.apoio.employees[1].name = '';
    const issue = validateConfig(config).find((i) => i.dept === 'apoio');
    expect(issue).toMatchObject({ section: 'colaboradores', where: 'Colaborador 2', message: 'Falta o nome completo.', employeeId: config.departments.apoio.employees[1].id });
  });
});

describe('quem cobre as folgas (por nome) e intermediário manhã/noite', () => {
  it('usa o colega escolhido pelo nome antes da regra do departamento', () => {
    // abertura, intermediário manhã, intermediário noite, fechamento
    const config = configWith(2026, 11, { recepcao: ['abertura', 'intermediario', 'intermediario_noite', 'fechamento'], apoio: THREE });
    const rec = config.departments.recepcao;
    rec.maxSimultaneous = 4;
    rec.employees[2].shift = { start: '12:00', end: '21:00', breakStart: '16:00', breakEnd: '17:00' };
    // A abertura (Rec 1) é coberta pela Rec 3 (intermediário noite), não pela regra (intermediário manhã primeiro)
    rec.employees[0].coveredBy = [rec.employees[2].id];
    expect(validateConfig(config)).toEqual([]);
    const mon = '2026-11-09'; // segunda: o intermediário noite folgou no domingo, então pode abrir às 05h
    const grid = manualGrid(config, (id, d) => (id === 'recepcao-1' && d === mon ? 'F' : undefined));
    const a = analyzeSchedule(config, grid);
    const d = a.depts.recepcao.resolved.ctx.dates.indexOf(mon);
    const cells = a.depts.recepcao.resolved.cells;
    expect(cells[2][d].origin).toBe('substituicao');
    expect(cells[1][d].origin).toBe('habitual');
  });

  it('no fechamento a regra padrão tenta primeiro o intermediário noite', () => {
    const config = configWith(2026, 11, { recepcao: ['abertura', 'intermediario', 'intermediario_noite', 'fechamento'], apoio: THREE });
    const rec = config.departments.recepcao;
    rec.maxSimultaneous = 4;
    rec.employees[2].shift = { start: '12:00', end: '21:00', breakStart: '16:00', breakEnd: '17:00' };
    const fri = '2026-11-06';
    const grid = manualGrid(config, (id, d) => (id === 'recepcao-4' && d === fri ? 'F' : undefined));
    const a = analyzeSchedule(config, grid);
    const d = a.depts.recepcao.resolved.ctx.dates.indexOf(fri);
    expect(a.depts.recepcao.resolved.cells[2][d].origin).toBe('substituicao');
    expect(a.alerts.some((x) => x.code === 'FECHAMENTO_DESCOBERTO' && x.date === fri)).toBe(false);
  });
});

describe('semana sem solução exata', () => {
  it('não deixa a escala vazia: monta a melhor possível e aponta os conflitos', () => {
    const mk = (y: number, m: number) => {
      const c = configWith(y, m, { recepcao: THREE, apoio: FIVE }, true);
      c.departments.apoio.maxSimultaneous = 3;
      c.noOffWeekdays = [3];
      return c;
    };
    const dec = generateSchedule(mk(2026, 12));
    const jan = mk(2027, 1);
    jan.departments.recepcao.saturdayRequired = 2;
    jan.departments.recepcao.saturdayShift2 = { ...jan.departments.recepcao.saturdayShift };
    const r = generateSchedule(jan, { previous: dec.cells });
    const range = buildRange(2027, 1);
    for (const d of range.monthDates) expect(workingOn(r, 'recepcao', d)).toBeGreaterThan(0);
    for (const d of range.monthDates.filter((x) => weekdayOf(x) === 6)) expect(workingOn(r, 'recepcao', d)).toBe(2);
  });
});

describe('quem cobre a folga do intermediário', () => {
  it('a pessoa escolhida assume o horário do intermediário sem deixar o próprio turno descoberto', () => {
    const config = configWith(2026, 11, { recepcao: ['abertura', 'intermediario', 'fechamento', 'fechamento'], apoio: THREE });
    const rec = config.departments.recepcao;
    rec.maxSimultaneous = 4;
    rec.employees[1].coveredBy = [rec.employees[3].id]; // Rec 4 (fechamento) cobre o intermediário
    const mon = '2026-11-09';
    const grid = manualGrid(config, (id, d) => (id === 'recepcao-2' && d === mon ? 'F' : undefined));
    const a = analyzeSchedule(config, grid);
    const d = a.depts.recepcao.resolved.ctx.dates.indexOf(mon);
    const cells = a.depts.recepcao.resolved.cells;
    expect(cells[3][d].origin).toBe('substituicao');
    expect(cells[3][d].shift).toEqual(rec.employees[1].shift);
    expect(cells[2][d].origin).toBe('habitual'); // Rec 3 continua no fechamento
    expect(a.alerts.some((x) => x.code === 'FECHAMENTO_DESCOBERTO' && x.date === mon)).toBe(false);
    expect(a.alerts.some((x) => x.code === 'SUBSTITUICAO_TURNO' && x.date === mon && x.message.includes('intermediário manhã'))).toBe(true);
  });

  it('sem nome escolhido, a folga do intermediário não gera troca', () => {
    const config = configWith(2026, 11, { recepcao: ['abertura', 'intermediario', 'fechamento', 'fechamento'], apoio: THREE });
    config.departments.recepcao.maxSimultaneous = 4;
    const mon = '2026-11-09';
    const a = analyzeSchedule(config, manualGrid(config, (id, d) => (id === 'recepcao-2' && d === mon ? 'F' : undefined)));
    expect(a.depts.recepcao.resolved.substitutions.filter((s) => s.role === 'intermediario')).toEqual([]);
  });
});

describe('intervalo intrajornada no 2º turno de sábado', () => {
  it('alerta com a regra aplicada e diz onde corrigir; com 15 min de intervalo não alerta', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
    const rec = config.departments.recepcao;
    rec.saturdayRequired = 2;
    rec.saturdayShift2 = { start: '08:00', end: '14:00', breakStart: null, breakEnd: null };
    const r = generateSchedule(config);
    const a = r.analysis.alerts.find((x) => x.code === 'INTERVALO_INSUFICIENTE');
    expect(a?.message).toContain('a regra de jornada pede 15 min');
    expect(a?.suggestion).toContain('no turno de sábado (regras do departamento)');
    rec.saturdayShift2 = { start: '08:00', end: '14:15', breakStart: '11:00', breakEnd: '11:15' };
    expect(generateSchedule(config).analysis.alerts.some((x) => x.code === 'INTERVALO_INSUFICIENTE')).toBe(false);
  });

  it('com a regra de 15 min removida na Jornada, 6h sem intervalo não alertam', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
    config.labor.breakRules = config.labor.breakRules.filter((r) => r.aboveHours !== 4);
    const rec = config.departments.recepcao;
    rec.saturdayRequired = 2;
    rec.saturdayShift2 = { start: '08:00', end: '14:00', breakStart: null, breakEnd: null };
    expect(generateSchedule(config).analysis.alerts.some((x) => x.code === 'INTERVALO_INSUFICIENTE')).toBe(false);
  });
});

describe('quem cobre os professores', () => {
  it('o professor escolhido assume o horário de quem folga, sem abrir horário abaixo do mínimo', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE, professores: ['abertura', 'intermediario', 'fechamento', 'fechamento'] });
    const prof = config.departments.professores;
    prof.maxSimultaneous = 4;
    prof.employees[0].coveredBy = [prof.employees[3].id]; // Prof 4 (2º do fechamento) cobre o Prof 1
    const mon = '2026-11-09';
    const a = analyzeSchedule(config, manualGrid(config, (id, d) => (id === 'professores-1' && d === mon ? 'F' : undefined)));
    const d = a.depts.professores.resolved.ctx.dates.indexOf(mon);
    const cells = a.depts.professores.resolved.cells;
    expect(cells[3][d].origin).toBe('substituicao');
    expect(cells[3][d].shift).toEqual(prof.employees[0].shift);
    expect(a.alerts.some((x) => x.dept === 'professores' && x.code === 'PROFESSOR_DESCOBERTO' && x.date === mon)).toBe(false);
    expect(a.alerts.some((x) => x.dept === 'professores' && x.code === 'SUBSTITUICAO_TURNO' && x.message.includes('cobre o horário'))).toBe(true);
  });

  it('não troca se quem cobriria deixaria o próprio horário sem professor', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE, professores: THREE });
    const prof = config.departments.professores;
    prof.employees[0].coveredBy = [prof.employees[2].id]; // único do fechamento
    const mon = '2026-11-09';
    const a = analyzeSchedule(config, manualGrid(config, (id, d) => (id === 'professores-1' && d === mon ? 'F' : undefined)));
    const d = a.depts.professores.resolved.ctx.dates.indexOf(mon);
    expect(a.depts.professores.resolved.cells[2][d].origin).toBe('habitual');
  });
});

describe('só sábado, domingo e feriado', () => {
  it('não é escalado em dia útil, trabalha os fins de semana e pode cobrir feriado', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE, professores: ['abertura', 'intermediario', 'fechamento', 'abertura'] }, true);
    const prof = config.departments.professores;
    prof.maxSimultaneous = 4;
    const fds = prof.employees[3];
    fds.weekendOnly = true;
    fds.availableWeekdays = [0, 6];
    expect(validateConfig(config)).toEqual([]);
    const r = generateSchedule(config);
    const range = buildRange(2026, 11);
    for (const d of range.monthDates) {
      const w = weekdayOf(d);
      const hol = config.holidays.some((h) => h.date === d);
      if (w !== 0 && w !== 6 && !hol) expect(r.cells[fds.id][d].status).not.toBe('T');
    }
    expect(range.monthDates.filter((d) => [0, 6].includes(weekdayOf(d))).some((d) => r.cells[fds.id][d].status === 'T')).toBe(true);
    expect(r.analysis.alerts.filter((a) => a.employeeId === fds.id && ['MODELO_5X2', 'FINS_SEMANA_CONSECUTIVOS', 'DOMINGO_SEM_FOLGA'].includes(a.code))).toEqual([]);
    expect(r.analysis.alerts.filter((a) => a.dept === 'professores' && a.severity === 'critico')).toEqual([]);
  });
});

describe('gerar só alguns departamentos', () => {
  it('gera Professores e Estagiários incluídos depois e mantém Recepção e Apoio (com ajustes) como estavam', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE });
    let s = applyGeneration(createSchedule(2026, 11, config), generateSchedule(config), 0);
    const ana = config.departments.recepcao.employees[0].id;
    s = setCell(s, ana, '2026-11-04', { status: 'F' });
    const before = JSON.stringify(Object.fromEntries(Object.entries(s.cells!).filter(([id]) => id.startsWith('recepcao') || id.startsWith('apoio'))));
    // Professores e estagiários incluídos depois da geração
    const c2 = structuredClone(s.config);
    c2.departments.professores.enabled = true;
    c2.departments.professores.employees.forEach((e, i) => { e.name = `Prof ${i + 1}`; });
    c2.departments.estagiarios.enabled = true;
    c2.departments.estagiarios.employees.forEach((e, i) => { e.name = `Est ${i + 1}`; });
    s = { ...s, config: c2 };
    const r = generateSchedule(c2, { seed: 1, only: ['professores', 'estagiarios'], keep: s.cells });
    const s2 = applyGeneration(s, r, 1, true);
    const after = JSON.stringify(Object.fromEntries(Object.entries(s2.cells!).filter(([id]) => id.startsWith('recepcao') || id.startsWith('apoio'))));
    expect(after).toBe(before);
    expect(s2.changeLog.length).toBe(s.changeLog.length);
    const prof = c2.departments.professores.employees[0].id;
    expect(Object.values(s2.cells![prof]).some((c) => c.status === 'T')).toBe(true);
  });
});

describe('dias fixos', () => {
  it('professora seg, qua e sex com 2h por dia: gera sem erro e só nesses dias', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE, professores: ['abertura', 'intermediario', 'fechamento', 'intermediario'] }, true);
    const prof = config.departments.professores;
    prof.maxSimultaneous = 4;
    const p = prof.employees[3];
    p.fixedDays = [1, 3, 5];
    p.shift = { start: '18:00', end: '20:00', breakStart: null, breakEnd: null };
    expect(validateConfig(config)).toEqual([]);
    const r = generateSchedule(config);
    const range = buildRange(2026, 11);
    for (const d of range.monthDates) {
      const w = weekdayOf(d);
      const hol = config.holidays.some((h) => h.date === d);
      const st = r.cells[p.id][d].status;
      if (![1, 3, 5].includes(w)) expect(st).not.toBe('T');
      else if (!hol) expect(st).toBe('T');
    }
    expect(r.analysis.alerts.filter((a) => a.employeeId === p.id && a.severity === 'critico')).toEqual([]);
    expect(r.analysis.alerts.filter((a) => a.dept === 'professores' && a.severity === 'critico')).toEqual([]);
  });
});

describe('escalas separadas por equipe', () => {
  it('escala técnica só tem Professores e Estagiários; administrativa só Recepção e Apoio', () => {
    const base = configWith(2026, 11, { recepcao: THREE, apoio: THREE, professores: THREE });
    base.departments.estagiarios.enabled = true;
    base.departments.estagiarios.employees.forEach((e, i) => { e.name = `Est ${i + 1}`; });
    base.noOffWeekdays = [3];
    const tec = createSchedule(2026, 11, base, 'asa-norte', 'tecnica');
    expect(tec.config.team).toBe('tecnica');
    expect(tec.config.noOffWeekdays).toEqual([]); // dias sem folga são regra de cada escala
    expect(validateConfig(tec.config)).toEqual([]);
    const r = generateSchedule(tec.config);
    expect(r.analysis.depts.recepcao.resolved.ctx.employees).toHaveLength(0);
    expect(r.analysis.depts.professores.resolved.ctx.employees.length).toBe(3);
    expect(r.analysis.alerts.some((a) => a.dept === 'recepcao' || a.dept === 'apoio')).toBe(false);
    const adm = createSchedule(2026, 11, base, 'asa-norte', 'administrativa');
    const ra = generateSchedule(adm.config);
    expect(ra.analysis.depts.professores.resolved.ctx.employees).toHaveLength(0);
    expect(ra.analysis.depts.recepcao.resolved.ctx.employees.length).toBe(3);
  });

  it('dia sem folga não cobra quem não trabalha naquele dia (dias fixos)', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE, professores: ['abertura', 'intermediario', 'fechamento', 'intermediario'] });
    config.departments.professores.maxSimultaneous = 4;
    config.noOffWeekdays = [3];
    const p = config.departments.professores.employees[3];
    p.fixedDays = [1, 5];
    p.shift = { start: '18:00', end: '20:00', breakStart: null, breakEnd: null };
    const r = generateSchedule(config);
    expect(r.analysis.alerts.some((a) => a.code === 'FOLGA_BLOQUEADA' && a.employeeId === p.id)).toBe(false);
    expect(r.analysis.alerts.filter((a) => a.dept === 'professores' && a.severity === 'critico')).toEqual([]);
  });
});

describe('dias fixos com sábado e domingo', () => {
  it('usa o horário da própria pessoa também no fim de semana', () => {
    const config = configWith(2026, 11, { recepcao: THREE, apoio: THREE, professores: ['abertura', 'intermediario', 'fechamento', 'intermediario'] });
    const prof = config.departments.professores;
    prof.maxSimultaneous = 4;
    prof.saturdayRequired = 2;
    prof.sundayRequired = 2;
    const p = prof.employees[3];
    p.fixedDays = [6, 0];
    p.shift = { start: '07:00', end: '11:00', breakStart: null, breakEnd: null };
    const r = generateSchedule(config);
    const da = r.analysis.depts.professores;
    const e = da.resolved.ctx.employees.findIndex((x) => x.id === p.id);
    for (const d of buildRange(2026, 11).monthDates.filter((x) => [0, 6].includes(weekdayOf(x)))) {
      const c = da.resolved.cells[e][da.resolved.ctx.dates.indexOf(d)];
      expect(c.status).toBe('T');
      expect(c.shift).toEqual(p.shift);
    }
  });
});
