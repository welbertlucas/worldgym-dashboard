import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyRoster, applySettings, autoIncludeDepts, describeDiff, rosterDiff, rosterFromConfig, settingsFromConfig } from '../roster';
import { createSchedule } from '../scheduleOps';

const escala = () => {
  const s = createSchedule(2026, 12, null, 'gama', 'administrativa');
  s.config.departments.recepcao.employees = s.config.departments.recepcao.employees.slice(0, 3);
  s.config.departments.recepcao.headcount = 3;
  s.config.departments.recepcao.employees.forEach((e, i) => { e.name = ['Ana', 'Bruno', 'Carla'][i] ?? `P${i}`; });
  return s.config;
};

describe('cadastro da equipe da unidade', () => {
  it('guarda só os departamentos da equipe e sem as datas do mês', () => {
    const c = escala();
    c.departments.recepcao.employees[0].unavailableDates = ['2026-12-10'];
    const r = rosterFromConfig(c);
    expect(Object.keys(r.departments).sort()).toEqual(['apoio', 'recepcao']);
    expect(r.departments.recepcao!.employees[0].unavailableDates).toEqual([]);
    expect(rosterDiff(c, r)).toBeNull();
  });

  it('aponta quem entrou, saiu e mudou', () => {
    const c = escala();
    const r = rosterFromConfig(c);
    const rec = r.departments.recepcao!;
    rec.employees.splice(1, 1);
    rec.employees[0].vacations = [{ start: '2026-12-01', end: '2026-12-10' }];
    rec.employees.push({ ...structuredClone(rec.employees[1]), id: 'novo', name: 'Diego' });
    const d = rosterDiff(c, r)!;
    expect(d).toEqual({ added: ['Diego'], removed: ['Bruno'], changed: ['Ana'], other: [] });
    expect(describeDiff(d)).toBe('Diego entrou; Bruno saiu; mudanças em Ana');
  });

  it('aplicar o cadastro traz a equipe e mantém as datas do mês de quem continua', () => {
    const c = escala();
    c.departments.recepcao.employees[0].unavailableDates = ['2026-12-10'];
    const r = rosterFromConfig(c);
    r.departments.recepcao!.employees[0].name = 'Ana Paula';
    r.departments.recepcao!.employees.push({ ...structuredClone(r.departments.recepcao!.employees[1]), id: 'novo', name: 'Diego' });
    r.departments.recepcao!.headcount = 4;
    const n = applyRoster(c, r);
    expect(n.departments.recepcao.employees.map((e) => e.name)).toEqual(['Ana Paula', 'Bruno', 'Carla', 'Diego']);
    expect(n.departments.recepcao.headcount).toBe(4);
    expect(n.departments.recepcao.employees[0].unavailableDates).toEqual(['2026-12-10']);
    expect(rosterDiff(n, r)).toBeNull();
    expect(c.departments.recepcao.employees[0].name).toBe('Ana');
  });
});

describe('comparação com o que volta do banco', () => {
  it('ignora a ordem das chaves do JSON', () => {
    const c = escala();
    const r = rosterFromConfig(c);
    const embaralhado = JSON.parse(JSON.stringify(r, (_k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).reverse()) : v)));
    expect(rosterDiff(c, embaralhado)).toBeNull();
  });
});

describe('regras da unidade no cadastro', () => {
  it('regras do departamento vêm do cadastro, salvo ajuste só deste mês', () => {
    const c = escala();
    const r = rosterFromConfig(c);
    r.departments.recepcao!.rules!.saturdayRequired = 2;
    expect(describeDiff(rosterDiff(c, r)!)).toBe('mudou: regras de Recepção');
    expect(applyRoster(c, r).departments.recepcao.saturdayRequired).toBe(2);
    const ajustada = { ...c, overrides: { deptRules: true } };
    expect(rosterDiff(ajustada, r)).toBeNull();
    expect(applyRoster(ajustada, r).departments.recepcao.saturdayRequired).toBe(c.departments.recepcao.saturdayRequired);
  });

  it('horário e jornada vêm da unidade; compensação de feriado continua da escala', () => {
    const c = escala();
    c.labor.holidayWorkCompensation = 'pagamento';
    const u = settingsFromConfig(c);
    u.operatingHours[1] = { open: true, start: '06:00', end: '22:00' };
    u.labor!.weeklyLimitHours = 38;
    expect(rosterDiff(c, null, u)!.other).toEqual(['horário de funcionamento', 'regras de jornada']);
    const n = applySettings(c, u);
    expect(n.operatingHours[1].start).toBe('06:00');
    expect(n.labor.weeklyLimitHours).toBe(38);
    expect(n.labor.holidayWorkCompensation).toBe('pagamento');
    expect(rosterDiff(n, null, u)).toBeNull();
    const ajustada = { ...c, overrides: { hours: true } };
    expect(applySettings(ajustada, u).operatingHours[1].start).toBe(c.operatingHours[1].start);
    expect(rosterDiff(ajustada, null, u)!.other).toEqual(['regras de jornada']);
  });
});

describe('ajustes só deste mês', () => {
  it('não passam para a escala criada a partir dela', () => {
    const s = createSchedule(2026, 11, null, 'gama', 'administrativa');
    s.config.overrides = { hours: true, deptRules: true };
    const n = createSchedule(2026, 12, s.config, 'gama', 'tecnica');
    expect(n.config.overrides).toBeUndefined();
  });
});

describe('quem entra na escala', () => {
  it('Recepção e Apoio sempre; Professores e Estagiários só com alguém com nome', () => {
    const adm = createSchedule(2026, 12, null, 'gama', 'administrativa').config;
    adm.departments.recepcao.enabled = false;
    autoIncludeDepts(adm);
    expect(adm.departments.recepcao.enabled).toBe(true);
    const tec = createSchedule(2026, 12, null, 'gama', 'tecnica').config;
    autoIncludeDepts(tec);
    expect(tec.departments.professores.enabled).toBe(false);
    expect(tec.departments.estagiarios.enabled).toBe(false);
    tec.departments.estagiarios.employees[0].name = 'Laura';
    expect(autoIncludeDepts(tec)).toBe(true);
    expect(tec.departments.estagiarios.enabled).toBe(true);
    expect(autoIncludeDepts(tec)).toBe(false);
  });
});
