import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSchedule } from '../scheduleOps';
import { suggestHeadcount } from '../staffing';

describe('quantas pessoas por departamento', () => {
  it('segue o padrão da rede: 4 recepção, 4 apoio, 4 professores, 6 estagiários', () => {
    const c = createSchedule(2026, 12, null, 'gama', 'administrativa').config;
    expect(suggestHeadcount(c, 'recepcao')).toMatchObject({ suggested: 4, current: 4 });
    expect(suggestHeadcount(c, 'apoio').suggested).toBe(4);
    expect(suggestHeadcount(c, 'professores').suggested).toBe(4);
    expect(suggestHeadcount(c, 'estagiarios').suggested).toBe(6);
  });

  it('conta só as pessoas ativas', () => {
    const c = createSchedule(2026, 12, null, 'gama', 'administrativa').config;
    c.departments.recepcao.employees[0].active = false;
    expect(suggestHeadcount(c, 'recepcao').current).toBe(3);
  });
});

describe('cadastro novo', () => {
  it('começa com o quadro padrão da rede', () => {
    const c = createSchedule(2026, 12, null, 'gama', 'administrativa').config;
    expect(c.departments.recepcao.employees).toHaveLength(4);
    expect(c.departments.apoio.employees).toHaveLength(4);
    expect(c.departments.professores.employees).toHaveLength(4);
    expect(c.departments.estagiarios.employees).toHaveLength(6);
    expect(c.departments.recepcao.employees.map((e) => e.kind)).toEqual(['abertura', 'intermediario', 'fechamento', 'fechamento']);
  });
});
