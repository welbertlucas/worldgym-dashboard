// Fila da etapa de alunos (scripts/evo-alunos.mjs): ordem das unidades, poucas lendo ao mesmo tempo e corte por tempo.
// O EVO leva quase o mesmo tempo por linha de membro, seja a página de 100 ou de 1.000 (teste de 18/11/2026), então o ganho vem de
// ler algumas unidades em paralelo, não de página maior. Só lógica de fila: nada aqui lê o EVO nem grava no Blob.

/** Unidades mais antigas primeiro (as nunca lidas vão na frente), para quem ficou de fora numa noite ser a primeira da seguinte. */
export function ordenarPorAntiguidade(entradas, estampaDe) {
  const chave = (e) => {
    const t = Date.parse(estampaDe(e) ?? "");
    return Number.isFinite(t) ? t : -Infinity;
  };
  return entradas
    .map((e, i) => ({ e, i, t: chave(e) }))
    .sort((a, b) => (a.t === b.t ? a.i - b.i : a.t < b.t ? -1 : 1))
    .map((x) => x.e);
}

/**
 * Roda `tarefa` sobre `itens` com no máximo `limite` ao mesmo tempo, na ordem dada.
 * Antes de começar cada item, `podeIniciar()` decide: se disser não, o item e todos os seguintes ficam em `puladas`.
 * Um item que falha vai para `falhas` e não derruba os outros.
 */
export async function executarComLimite(itens, limite, tarefa, { podeIniciar = () => true } = {}) {
  const feitas = [], puladas = [], falhas = [];
  let proximo = 0, parou = false;
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limite, itens.length)) }, async () => {
      while (proximo < itens.length) {
        if (parou || !podeIniciar()) { parou = true; return; }
        const item = itens[proximo++];
        try { await tarefa(item); feitas.push(item); } catch (e) { falhas.push({ item, erro: e }); }
      }
    })
  );
  while (proximo < itens.length) puladas.push(itens[proximo++]);
  return { feitas, puladas, falhas };
}

/** Trava simples: as funções passadas rodam uma de cada vez, na ordem em que chegaram (gravações no Blob e no mapa de bairros). */
export function criarTrava() {
  let fim = Promise.resolve();
  return (fn) => {
    const rodando = fim.then(fn, fn);
    fim = rodando.catch(() => {});
    return rodando;
  };
}
