// Ao recalcular um mês (evo-backfill, primeira etapa do evo-sync), a unidade nova só traz faturamento, recebimento e o que sai do cálculo mensal.
// Todo o resto (vendas, entradas, formas de pagamento, cobranças, prospects, alunos...) vem das outras etapas, horas depois. Sem preservar,
// o mês ficava sem esses campos durante a rodada inteira (18/11/2026: as 23 unidades sem detalhe de vendas, e os carimbos "atualizado em" antigos continuavam).
// Regra: a unidade antiga é a base; o que o cálculo novo traz sobrescreve; `antigosVencem` (campos de outra rotina, como a foto de contratos) ficam como estavam.
export function preservarCampos(nova, antiga, antigosVencem = []) {
  if (!antiga) return nova;
  const unida = { ...antiga, ...nova };
  for (const k of antigosVencem) if (antiga[k] !== undefined) unida[k] = antiga[k];
  return unida;
}
