// "Mesmo dia dos meses anteriores": para cada mês fechado, os números que o painel mostraria se o EVO tivesse sido lido
// na madrugada de cada dia daquele mês (inadimplência, recebido sobre o faturado e cartões recusados em aberto).
// Dá para reconstruir porque o EVO guarda a data do pagamento de cada título e a data em que o cartão recusado foi
// recuperado. Um mês fechado não muda mais: calcula uma vez e fica em mesmodia/AAAA-MM.json (só totais, nada de alunos).
// A consolidação diária junta a média dos 3 meses anteriores no mês em andamento (campo `mesmoDia` de cada unidade).
import { evoGet, fetchAll, live } from "./evo.js";
import { lerJson, gravarJson } from "./armazem.js";

const round2 = (n) => Math.round(n * 100) / 100;
const dia = (iso) => String(iso ?? "").slice(0, 10);
const diasNoMes = (ym) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
const dd = (n) => String(n).padStart(2, "0");

/**
 * Série de um mês: para cada dia de leitura D (1..fim do mês), os números como estariam na madrugada de D
 * (os dados vão até a véspera), com as mesmas definições de evo.js (unitMonth) e cobrancas.js.
 * Cuidado do EVO: quando um título é pago com atraso, o vencimento dele passa a ser a data do pagamento. O vencimento original
 * e a data da recuperação (`chargeDate`) só ficam no relatório de devedores, que lista todo título não pago no vencimento.
 * Por isso a dívida de cada dia sai dos devedores: venceu (originalmente) antes de D e não estava recuperada antes de D.
 * `due`: títulos com vencimento no mês; `paid`: títulos pagos no mês; `devedores`: devedores com vencimento do dia 1 até hoje.
 */
export function serieDoMes(ym, { due, paid, devedores }) {
  const ativo = (x) => String(x.debtStatus ?? "").toLowerCase() !== "canceled";
  const original = new Map(devedores.map((x) => [x.receivableId, dia(x.originalDueDate ?? x.dueDate)]));
  const vencOriginal = (r) => original.get(r.idReceivable) ?? dia(r.dueDate);
  const titulos = due.filter(live).filter((r) => vencOriginal(r).slice(0, 7) === ym).map((r) => ({ v: vencOriginal(r), valor: r.ammount || 0, quem: r.idMemberPayer || `p${r.idProspectPayer}` }));
  const doMes = devedores.filter((x) => ativo(x) && dia(x.originalDueDate ?? x.dueDate).slice(0, 7) === ym);
  // Título do mês que foi pago com atraso já no mês seguinte: o vencimento foi para lá; entra pelo relatório de devedores.
  const vistos = new Set(due.map((r) => r.idReceivable));
  for (const x of doMes) if (!vistos.has(x.receivableId)) titulos.push({ v: dia(x.originalDueDate), valor: x.debtAmount || 0, quem: x.memberId });
  const pagos = paid.filter(live);
  const previsao = round2(titulos.reduce((s, t) => s + t.valor, 0));
  const serie = {};
  for (let n = 1; n <= diasNoMes(ym); n++) {
    const hoje = `${ym}-${dd(n)}`;
    // Em aberto na madrugada de D: venceu antes de D (o cartão, até D, como no relatório atual) e não foi recuperado antes de D.
    const emAberto = (x, ate) => dia(x.originalDueDate ?? x.dueDate) <= ate
      && (String(x.debtStatus).toLowerCase() === "open" || !x.chargeDate || dia(x.chargeDate) >= hoje);
    const devendo = new Set(doMes.filter((x) => emAberto(x, diaAnteriorDe(hoje))).map((x) => x.memberId));
    const pagantes = new Set([...titulos.filter((t) => t.v < hoje).map((t) => t.quem), ...devendo]);
    const abertos = doMes.filter((x) => emAberto(x, hoje));
    serie[dd(n)] = {
      faturamento: round2(titulos.filter((t) => t.v <= hoje).reduce((s, t) => s + t.valor, 0)),
      recebimento: round2(pagos.filter((r) => dia(r.chargeDate) < hoje).reduce((s, r) => s + (r.ammountPaid || 0), 0)),
      previsaoFaturamento: previsao,
      pagantes: pagantes.size, inadimplentes: devendo.size,
      inadimplenciaPerc: pagantes.size ? round2((devendo.size / pagantes.size) * 100) : 0,
      cartaoAbertas: abertos.length, cartaoValorAberto: round2(abertos.reduce((s, x) => s + (x.debtAmount || 0), 0)),
    };
  }
  return serie;
}

const diaAnteriorDe = (d) => new Date(Date.parse(`${d}T00:00:00Z`) - 864e5).toISOString().slice(0, 10);

/** Lê do EVO o que a série de uma unidade precisa. `ate`: até quando procurar recuperações (hoje). */
export async function serieDaUnidade(idBranch, ym, ate) {
  const a = `${ym}-01`, b = `${ym}-${dd(diasNoMes(ym))}`;
  const [due, paid] = await Promise.all([
    fetchAll(`/receivables?idBranch=${idBranch}&dueDateStart=${a}&dueDateEnd=${b}`, 1000),
    fetchAll(`/receivables?idBranch=${idBranch}&chargeDateStart=${a}&chargeDateEnd=${b}`, 1000),
  ]);
  // No relatório de devedores, o recuperado ganha como vencimento a data em que foi pago: procura do dia 1 até hoje.
  const devedores = [];
  for (let skip = 0; skip < 100000; skip += 100) {
    const j = await evoGet(`/receivables/debtors?idBranch=${idBranch}&dueDateStart=${a}&dueDateEnd=${ate}&take=100&skip=${skip}`);
    const lote = j.results ?? [];
    devedores.push(...lote);
    if (lote.length < 100) break;
  }
  return serieDoMes(ym, { due, paid, devedores });
}

export const caminhoSerie = (ym) => `mesmodia/${ym}.json`;
export const lerSerie = (ym) => lerJson(caminhoSerie(ym));
export const gravarSerie = (ym, units) => gravarJson(caminhoSerie(ym), { month: ym, geradoEm: new Date().toISOString(), units });

/** Os N meses anteriores a `ym` (o mais recente primeiro). */
export function mesesAnteriores(ym, n = 3) {
  const [y, m] = ym.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => { const d = new Date(Date.UTC(y, m - 2 - i, 1)); return d.toISOString().slice(0, 7); });
}

/**
 * Base do mesmo dia para uma unidade: a média dos meses anteriores no dia de leitura `n` (num mês mais curto, o último dia).
 * Devolve null se nenhum mês tiver a unidade. Percentuais em %, para comparar direto com o mês em andamento.
 */
export function baseDoDia(series, unidade, n) {
  const pts = [];
  for (const s of series) {
    const u = s?.units?.[unidade];
    if (!u) continue;
    const dias = Object.keys(u).sort();
    const p = u[dd(Math.min(n, Number(dias[dias.length - 1])))];
    if (p) pts.push({ mes: s.month, ...p });
  }
  if (!pts.length) return null;
  const media = (f) => round2(pts.reduce((s, p) => s + f(p), 0) / pts.length);
  return {
    dia: n, meses: pts.map((p) => p.mes),
    inadimplenciaPerc: media((p) => p.inadimplenciaPerc),
    recebidoSobreFaturado: media((p) => (p.faturamento ? (p.recebimento / p.faturamento) * 100 : 0)),
    cartaoSobrePrevisao: media((p) => (p.previsaoFaturamento ? (p.cartaoValorAberto / p.previsaoFaturamento) * 100 : 0)),
  };
}
