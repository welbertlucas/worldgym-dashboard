// Notas fiscais emitidas pelo EVO (/api/v2/invoices/get-invoices) por unidade e mês, ligadas aos recebimentos.
// A nota nem sempre sai no mês do pagamento (em out/2026, Taguatinga emitiu as notas de setembro junto com as de outubro).
// Por isso, além do que foi emitido no mês, vale a cobertura: do que foi recebido no mês, quanto ganhou nota
// (emitida no próprio mês ou no seguinte). Cada nota aponta para o título que ela cobre (idRecebimento).
import { evoGet, live } from "./evo.js";

const PAGINA = 5000; // a rota aceita páginas grandes (testado até 10.000); menos chamadas por unidade
const round2 = (n) => Math.round(n * 100) / 100;

/** Último dia de um mês AAAA-MM. */
const fimDoMes = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
/** Mês seguinte a AAAA-MM. */
const mesSeguinte = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
};

/** Notas de uma unidade com data de emissão entre `de` e `ate` (todas as situações). */
export async function notasEmitidas(idBranch, de, ate) {
  const out = [];
  for (let skip = 0; skip < 200000; skip += PAGINA) {
    const r = await evoGet(`/api/v2/invoices/get-invoices?idBranch=${idBranch}&issueDateStart=${de}&issueDateEnd=${ate}&take=${PAGINA}&skip=${skip}`);
    out.push(...r);
    if (r.length < PAGINA) break;
  }
  return out;
}

const autorizada = (n) => n.status === "Autorizada";

/**
 * Resumo das notas de um mês:
 *  - emitidas no mês: autorizadas [quantidade, valor], ISS, canceladas e negadas (quantidade);
 *  - outrosMeses: autorizadas no mês que cobrem pagamentos de outros meses (nota atrasada) [quantidade, valor];
 *  - cobertura: [recebido no mês com nota autorizada (no mês ou no seguinte), recebido no mês] em R$.
 * `doMes` e `seguinte` = notas que o filtro de emissão do EVO devolve para o mês e para o mês seguinte
 * (o filtro do EVO é a régua do mês: as datas da própria nota nem sempre caem nele);
 * `titulos` = recebimentos pagos no mês (os mesmos de pagamentos.js).
 */
export function resumirNotas(doMes, seguinte, titulos) {
  const aut = doMes.filter(autorizada);
  const pagos = new Map(titulos.filter((r) => live(r) && r.ammountPaid > 0).map((r) => [r.idReceivable, r.ammountPaid]));
  const comNota = new Set([...doMes, ...seguinte].filter(autorizada).map((n) => n.idRecebimento));
  const outros = aut.filter((n) => !pagos.has(n.idRecebimento));
  let recebido = 0, coberto = 0;
  for (const [id, v] of pagos) { recebido += v; if (comNota.has(id)) coberto += v; }
  return {
    emitidas: [aut.length, round2(aut.reduce((s, n) => s + (n.valorTotal || 0), 0))],
    iss: round2(aut.reduce((s, n) => s + (n.valorIss || 0), 0)),
    canceladas: doMes.filter((n) => /^cancelada$/i.test(n.status ?? "")).length,
    negadas: doMes.filter((n) => /^negada$/i.test(n.status ?? "")).length,
    outrosMeses: [outros.length, round2(outros.reduce((s, n) => s + (n.valorTotal || 0), 0))],
    cobertura: [round2(coberto), round2(recebido)],
  };
}

/** Notas do mês de uma unidade, com a cobertura dos recebimentos pagos no mês (`titulos`, já lidos em pagamentos.js). */
export async function notasDoMes(idBranch, ym, titulos, hoje) {
  const doMes = await notasEmitidas(idBranch, `${ym}-01`, fimDoMes(ym));
  const prox = mesSeguinte(ym);
  const seguinte = `${prox}-01` <= hoje ? await notasEmitidas(idBranch, `${prox}-01`, [fimDoMes(prox), hoje].sort()[0]) : [];
  return resumirNotas(doMes, seguinte, titulos);
}
