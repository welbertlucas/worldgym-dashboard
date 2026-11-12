// Quanto foi recebido no mês por forma de pagamento (EVO /receivables pela data do pagamento), por unidade.
// Mesma base do recebimento do painel: títulos não cancelados, com aluno ou prospect pagando, valor pago (ammountPaid).
import { evoGet, live } from "./evo.js";

const PAGE = 1000; // a rota aceita páginas de 1.000 (bem menos chamadas que as de 100)

export const NOMES_FORMA = {
  "Credit card": "Cartão de crédito",
  "Debit card": "Cartão de débito",
  Deposit: "Pix e depósito",
  Pix: "Pix e depósito",
  Cash: "Dinheiro",
  "Bank slip": "Boleto",
  Check: "Cheque",
  "Sales credit": "Crédito de venda",
};

const round2 = (n) => Math.round(n * 100) / 100;

/** Soma o valor pago por forma de pagamento (nome em português; formas sem tradução ficam como vieram). */
export function somarFormas(titulos) {
  const out = {};
  for (const r of titulos) {
    if (!live(r) || !(r.ammountPaid > 0)) continue;
    const bruto = r.paymentType?.name ?? "Não informada";
    const nome = NOMES_FORMA[bruto] ?? bruto;
    out[nome] = (out[nome] ?? 0) + r.ammountPaid;
  }
  for (const k of Object.keys(out)) out[k] = round2(out[k]);
  return out;
}

/** Soma o valor pago em cartão (crédito e débito) por bandeira (Visa, Mastercard, Elo...). */
export const somarBandeiras = (titulos) => somarCartaoPor(titulos, "cardFlag");
/** Soma o valor pago em cartão (crédito e débito) por adquirente / gateway (Stone, Rede, Cielo...). */
export const somarGateways = (titulos) => somarCartaoPor(titulos, "cardAcquirer");

function somarCartaoPor(titulos, campo) {
  const out = {};
  for (const r of titulos) {
    if (!live(r) || !(r.ammountPaid > 0) || !/card/i.test(r.paymentType?.name ?? "")) continue;
    const nome = r[campo]?.trim() || "Não informada";
    out[nome] = (out[nome] ?? 0) + r.ammountPaid;
  }
  for (const k of Object.keys(out)) out[k] = round2(out[k]);
  return out;
}

/** Formas de pagamento, bandeiras e gateways do cartão do mês, com uma só leitura dos recebimentos (devolvidos em `titulos`). */
export async function pagamentosDoMes(idBranch, ym) {
  const todos = await titulosDoMes(idBranch, ym);
  return { formas: somarFormas(todos), bandeiras: somarBandeiras(todos), gateways: somarGateways(todos), titulos: todos };
}

export async function formasDoMes(idBranch, ym) {
  return somarFormas(await titulosDoMes(idBranch, ym));
}

async function titulosDoMes(idBranch, ym) {
  const [y, m] = ym.split("-").map(Number);
  const fim = `${ym}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
  const todos = [];
  for (let skip = 0; ; skip += PAGE) {
    const rows = await evoGet(`/receivables?idBranch=${idBranch}&chargeDateStart=${ym}-01&chargeDateEnd=${fim}&take=${PAGE}&skip=${skip}`);
    todos.push(...rows);
    if (rows.length < PAGE) break;
  }
  return todos;
}
