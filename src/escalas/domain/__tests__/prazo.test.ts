import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { diasAtePrazo, prazoDaEscala, textoDias } from '../prazo';

describe('prazo da rede', () => {
  it('é um dia do mês anterior, inclusive na virada do ano', () => {
    expect(prazoDaEscala(2026, 12, 20)).toBe('2026-11-20');
    expect(prazoDaEscala(2027, 1, 20)).toBe('2026-12-20');
    expect(prazoDaEscala(2027, 3, 31)).toBe('2027-02-28');
  });
  it('conta os dias até o prazo', () => {
    const hoje = new Date(2026, 10, 12);
    expect(diasAtePrazo('2026-11-20', hoje)).toBe(8);
    expect(diasAtePrazo('2026-11-12', hoje)).toBe(0);
    expect(diasAtePrazo('2026-11-09', hoje)).toBe(-3);
    expect([8, 1, 0, -1, -3].map(textoDias)).toEqual(['faltam 8 dias', 'falta 1 dia', 'é hoje', 'venceu ontem', 'venceu há 3 dias']);
  });
});
