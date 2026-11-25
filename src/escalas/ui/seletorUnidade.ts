// Quando o seletor de unidade aparece: só com mais de uma unidade para escolher e, no sistema
// com login, só depois de entrar (sem login não há unidades da pessoa para mostrar).
export function mostrarSeletorDeUnidade(opts: { unidades: number; comLogin: boolean; logado: boolean }): boolean {
  if (opts.unidades <= 1) return false;
  return !opts.comLogin || opts.logado;
}
