// Alerta das liberações manuais na catraca que deixaram entrar quem não estava em dia (saldo devedor, aluno inativo
// ou plano sem acesso àquela catraca). Módulo compartilhado: o resumo diário (server/resumo.js) e a tela Alertas do
// painel (src/data/alerts.ts) usam a mesma regra, sempre sobre um mês já fechado.
//
// Pelo total do mês (as unidades têm de 15 a 37 mil entradas; o que muda as liberações é o hábito da recepção, não o tamanho).
// Calibrado com nov/2025–out/2026 (23 unidades): de 1 a 4 alertas por mês na rede.

/** Motivos de bloqueio em que a liberação deixa entrar quem não está em dia com a academia (receita em jogo). */
export const MOTIVOS_DE_RECEITA = ["Saldo devedor", "Aluno inativo", "Catraca fora do plano"];

export const LIMITES_LIBERACOES = {
  /** Nível: liberações de quem não está em dia no mês, a partir disto. */
  minNivel: 120,
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
  const out = [];
  for (const u of mes.units ?? []) {
    const q = liberacoesDeReceita(u);
    if (q === null || (nomes && !nomes.has(u.name))) continue;
    const base = Array.from({ length: L.baseMeses }, (_, i) => liberacoesDeReceita(doMes(meses, anterior(ym, i + 1))?.units?.find((x) => x.name === u.name))).filter((x) => x !== null);
    const media = base.length === L.baseMeses ? base.reduce((s, x) => s + x, 0) / base.length : null;
    const nivel = q >= L.minNivel;
    const alta = media !== null && q >= L.minAlta && q >= L.vezes * Math.max(media, 1);
    if (!nivel && !alta) continue;
    const extra = [`de ${u.liberacoes} liberações manuais no mês`];
    if (alta) extra.push(`${virg1(q / Math.max(media, 1))} vezes a média de ${Math.round(media)} nos ${L.baseMeses} meses anteriores`);
    out.push({
      quem: u.name, gravidade: "atencao", titulo: "Liberações de quem não está em dia",
      fato: `${q} liberações manuais em ${nomeMes(ym)} de quem a catraca tinha barrado por saldo devedor, aluno inativo ou plano sem acesso (${extra.join("; ")}).`,
      acao: "Conferir no EVO (Controle de entradas, ação “Entrada manual”) quem liberou e orientar a recepção a cobrar ou regularizar antes de liberar.",
      quantidade: q, total: u.liberacoes, media, alta, nivel,
    });
  }
  return out;
}
