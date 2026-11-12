// Alerta das liberações manuais na catraca que deixaram entrar quem não estava em dia (saldo devedor, aluno inativo
// ou plano sem acesso àquela catraca). Módulo compartilhado: o resumo diário (server/resumo.js) e a tela Alertas do
// painel (src/data/alerts.ts) usam a mesma regra, sempre sobre um mês já fechado.
//
// Calibrado com nov/2025–out/2026 (23 unidades): a rede fica entre 0 e 0,4 liberação de receita a cada 100 entradas.

/** Motivos de bloqueio em que a liberação deixa entrar quem não está em dia com a academia (receita em jogo). */
export const MOTIVOS_DE_RECEITA = ["Saldo devedor", "Aluno inativo", "Catraca fora do plano"];

export const LIMITES_LIBERACOES = {
  /** Nível: a cada 100 entradas, a partir disto (com pelo menos `minNivel` liberações no mês). */
  por100: 0.5,
  minNivel: 50,
  /** Alta: o mês com pelo menos `vezes` a média dos `baseMeses` meses anteriores (e pelo menos `minAlta` liberações). */
  vezes: 2,
  baseMeses: 3,
  minAlta: 30,
};

const doMes = (meses, ym) => meses.find((m) => m.month === ym);
/** Liberações de receita de uma unidade no mês (ou null sem o dado). */
export const liberacoesDeReceita = (u) =>
  u?.liberacoes === undefined ? null : (u.liberacoesMotivos ?? []).filter(([m]) => MOTIVOS_DE_RECEITA.includes(m)).reduce((s, [, q]) => s + q, 0);

const virg1 = (n) => (Math.round(n * 10) / 10).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeMes = (ym) => MESES[Number(ym.slice(5)) - 1];
const anterior = (ym, n) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - n, 1));
  return d.toISOString().slice(0, 7);
};

/**
 * Alertas do mês fechado `ym` para as unidades `nomes` (ou todas): { quem, gravidade, titulo, fato, acao }.
 * `meses` = [{ month, units: [{ name, entradas, liberacoes, liberacoesMotivos }] }].
 */
export function alertasLiberacoes(meses, ym, nomes = null, L = LIMITES_LIBERACOES) {
  const mes = doMes(meses, ym);
  if (!mes) return [];
  const todas = (mes.units ?? []).filter((u) => liberacoesDeReceita(u) !== null && u.entradas > 0);
  const redeRec = todas.reduce((s, u) => s + liberacoesDeReceita(u), 0), redeEnt = todas.reduce((s, u) => s + u.entradas, 0);
  const rede = redeEnt ? (redeRec / redeEnt) * 100 : 0;
  const out = [];
  for (const u of todas) {
    if (nomes && !nomes.has(u.name)) continue;
    const q = liberacoesDeReceita(u), taxa = (q / u.entradas) * 100;
    const base = Array.from({ length: L.baseMeses }, (_, i) => liberacoesDeReceita(doMes(meses, anterior(ym, i + 1))?.units?.find((x) => x.name === u.name))).filter((x) => x !== null);
    const media = base.length === L.baseMeses ? base.reduce((s, x) => s + x, 0) / base.length : null;
    const nivel = taxa >= L.por100 && q >= L.minNivel;
    const alta = media !== null && q >= L.minAlta && q >= L.vezes * Math.max(media, 1);
    if (!nivel && !alta) continue;
    const partes = [`${q} liberações manuais em ${nomeMes(ym)} de quem a catraca tinha barrado por saldo devedor, aluno inativo ou plano sem acesso`];
    partes.push(`${virg1(taxa)} a cada 100 entradas, contra ${virg1(rede)} na rede`);
    if (alta) partes.push(`${virg1(q / Math.max(media, 1))} vezes a média de ${Math.round(media)} nos ${L.baseMeses} meses anteriores`);
    out.push({
      quem: u.name, gravidade: "atencao", titulo: "Liberações de quem não está em dia",
      fato: `${partes[0]} (${partes.slice(1).join("; ")}).`,
      acao: "Conferir no EVO (Controle de entradas, ação “Entrada manual”) quem liberou e orientar a recepção a cobrar ou regularizar antes de liberar.",
      taxa, rede, quantidade: q, alta, nivel,
    });
  }
  return out;
}
