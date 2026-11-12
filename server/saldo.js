// Saldo devedor em aberto por unidade: títulos "Balance due" do EVO (a parte da venda que ficou para pagar depois).
// O EVO não marca esses títulos como pagos: quando a dívida é quitada (vira outro título) ou perdoada, o título é cancelado,
// com a data. Por isso dá para reconstruir o saldo em aberto em qualquer dia do passado:
// aberto no dia D = lançado até D e não cancelado até D.
import { evoGet } from "./evo.js";

const PAGINA = 1000; // /receivables aceita páginas de 1.000

const dia10 = (x) => (x ? String(x).slice(0, 10) : null);

/** Faixas de atraso (dias desde o vencimento): ainda no prazo, até 30, 31–90, 91–365 e mais de 1 ano. */
export const FAIXAS_ATRASO = ["No prazo", "Até 30 dias", "31 a 90 dias", "91 dias a 1 ano", "Mais de 1 ano"];
export function faixaDeAtraso(vencimento, dia) {
  const d = Math.round((new Date(`${dia}T00:00:00Z`) - new Date(`${vencimento}T00:00:00Z`)) / 86400000);
  return d <= 0 ? 0 : d <= 30 ? 1 : d <= 90 ? 2 : d <= 365 ? 3 : 4;
}

/** Título resumido: [lançamento, vencimento, cancelamento (ou "x" se cancelado sem data), valor, aluno]. */
export const resumoTitulo = (r) => [
  dia10(r.registrationDate) ?? dia10(r.dueDate),
  dia10(r.dueDate),
  dia10(r.cancellationDate) ?? (r.status?.id === 3 || /cancel/i.test(r.status?.name ?? "") ? "x" : null),
  r.ammount || 0,
  r.idMemberPayer ?? (r.idProspectPayer ? `p${r.idProspectPayer}` : null),
];

/** Todos os títulos de saldo devedor de uma unidade (abertos, vencidos e cancelados: os cancelados servem para o histórico). */
export async function titulosDeSaldo(idBranch) {
  const out = [];
  for (let skip = 0; skip < 500000; skip += PAGINA) {
    const r = await evoGet(`/receivables?idBranch=${idBranch}&paymentTypes=0&dueDateStart=2015-01-01&dueDateEnd=2035-12-31&take=${PAGINA}&skip=${skip}`);
    out.push(...r.map(resumoTitulo));
    if (r.length < PAGINA) break;
  }
  return out;
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Saldo devedor em aberto no dia D: valor, títulos, pessoas, por faixa de atraso [valor, pessoas] e quanto disso é de
 * alunos ativos naquele dia [valor, pessoas] (`ativos` = ids dos alunos ativos em D).
 */
export function saldoNoDia(titulos, dia, ativos = null) {
  const pessoas = new Set(), porFaixa = FAIXAS_ATRASO.map(() => [0, new Set()]), ativ = [0, new Set()];
  let valor = 0, n = 0;
  for (const [lanc, venc, cancel, v, quem] of titulos) {
    if (!lanc || lanc > dia || cancel === "x" || (cancel && cancel <= dia) || !(v > 0)) continue;
    n += 1;
    valor += v;
    const f = porFaixa[faixaDeAtraso(venc ?? lanc, dia)];
    f[0] += v;
    if (quem !== null) { pessoas.add(quem); f[1].add(quem); }
    if (ativos && quem !== null && ativos.has(quem)) { ativ[0] += v; ativ[1].add(quem); }
  }
  return {
    valor: round2(valor), titulos: n, pessoas: pessoas.size,
    faixas: porFaixa.map(([v, s]) => [round2(v), s.size]),
    ...(ativos ? { ativos: [round2(ativ[0]), ativ[1].size] } : {}),
  };
}
