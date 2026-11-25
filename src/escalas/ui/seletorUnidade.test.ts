import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mostrarSeletorDeUnidade } from './seletorUnidade';

describe('seletor de unidade', () => {
  it('some com uma só unidade (Dono, Master ou gestor)', () => {
    expect(mostrarSeletorDeUnidade({ unidades: 1, comLogin: true, logado: true })).toBe(false);
    expect(mostrarSeletorDeUnidade({ unidades: 0, comLogin: true, logado: true })).toBe(false);
  });
  it('some sem login quando o sistema exige login', () => {
    expect(mostrarSeletorDeUnidade({ unidades: 9, comLogin: true, logado: false })).toBe(false);
  });
  it('aparece com várias unidades e login feito', () => {
    expect(mostrarSeletorDeUnidade({ unidades: 9, comLogin: true, logado: true })).toBe(true);
    expect(mostrarSeletorDeUnidade({ unidades: 2, comLogin: true, logado: true })).toBe(true);
  });
  it('no modo sem login (versão local) continua aparecendo com várias unidades', () => {
    expect(mostrarSeletorDeUnidade({ unidades: 9, comLogin: false, logado: false })).toBe(true);
  });
});
