// Alerta das liberações manuais na catraca sem pagamento registrado: aluno que não estava em dia (saldo devedor, inativo
// ou plano sem acesso àquela catraca) e visitante sem venda no dia (aula experimental ou acesso sem pagar). Módulo compartilhado: o resumo diário (server/resumo.js) e a tela Alertas do
// painel (src/data/alerts.ts) usam a mesma regra, sempre sobre um mês já fechado.
//
// Pelo total do mês (as unidades têm de 15 a 37 mil entradas; o que muda as liberações é o hábito da recepção, não o tamanho).
// Recalibrado em 13/11/2026 com nov/2025–out/2026 (23 unidades): com 120, as mesmas 4 unidades entravam todo mês
// (Samambaia Norte, Samambaia Sul, Salvador Pro, Riacho Fundo II); com 200, de 1 a 3 alertas por mês somando a alta.

/** Motivos de bloqueio em que a liberação deixa entrar quem não está em dia com a academia (receita em jogo). */
export const MOTIVOS_DE_RECEITA = ["Saldo devedor", "Aluno inativo", "Catraca fora do plano"];

export const LIMITES_LIBERACOES = {
  /** Nível: liberações sem pagamento registrado no mês, a partir disto. */
  minNivel: 200,
  /** Alta: o mês com pelo menos `vezes` a média dos `baseMeses` meses anteriores (e pelo menos `minAlta` liberações). */
  vezes: 2,
  baseMeses: 3,
  minAlta: 30,
};

const doMes = (meses, ym) => meses.find((m) => m.month === ym);
/** Liberações de aluno que não estava em dia (pelo motivo do bloqueio; meses antigos sem os grupos usam só os motivos). */
const deAlunoDevendo = (u) => (u.liberacoesGrupos ? u.liberacoesGrupos[1] : (u.liberacoesMotivos ?? []).filter(([m]) => MOTIVOS_DE_RECEITA.includes(m)).reduce((s, [, q]) => s + q, 0));

/**
 * Liberações sem pagamento registrado de uma unidade no mês (ou null sem o dado): [total, de aluno que não estava em dia,
 * de visitante sem venda no dia]. Meses carregados antes dos grupos não separam visitantes (o terceiro vem 0).
 */
export function liberacoesSemPagamento(u) {
  if (u?.liberacoes === undefined) return null;
  const devendo = deAlunoDevendo(u), visitante = u.liberacoesGrupos?.[3] ?? 0;
  return [devendo + visitante, devendo, visitante];
}
/** Só o total de liberações sem pagamento registrado (ou null). */
export const liberacoesDeReceita = (u) => liberacoesSemPagamento(u)?.[0] ?? null;

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
    const [, devendo, visitante] = liberacoesSemPagamento(u);
    const partes = [`${devendo} de alunos que não estavam em dia (saldo devedor, inativo ou plano sem acesso)`];
    if (u.liberacoesGrupos) partes.push(`${visitante} de visitantes sem venda no dia`);
    const extra = [`de ${u.liberacoes} liberações manuais no mês`];
    if (alta) extra.push(`${virg1(q / Math.max(media, 1))} vezes a média de ${Math.round(media)} nos ${L.baseMeses} meses anteriores`);
    out.push({
      quem: u.name, gravidade: "atencao", titulo: "Liberações sem pagamento registrado",
      fato: `${q} liberações manuais em ${nomeMes(ym)} sem pagamento registrado: ${partes.join(" e ")} (${extra.join("; ")}).`,
      acao: "Conferir no EVO (Controle de entradas, ação “Entrada manual”) quem liberou; orientar a recepção a cobrar ou regularizar o aluno e a só liberar visitante com a venda (diária) ou a aula experimental registrada.",
      quantidade: q, devendo, visitante, total: u.liberacoes, media, alta, nivel,
    });
  }
  return out;
}
