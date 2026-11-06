// Cobranças com falha por unidade e mês, do relatório de devedores do EVO (/receivables/debtors).
// "Devedor" é um título que não foi pago no vencimento; o status diz se já foi recuperado ou segue em aberto, e o
// EVO guarda o motivo da última recusa do cartão. Aqui o mês é o do vencimento do título.
import { evoGet } from "./evo.js";
import { diaDeCorte } from "./ativos.js";

const PAGINA = 100;

/** Agrupa os textos de recusa do adquirente (português e inglês, com ou sem código) em categorias legíveis. */
export function categoriaRecusa(texto) {
  const t = String(texto ?? "").trim();
  if (!t) return null;
  if (/contato com adquirente/i.test(t)) return "Contatar o adquirente";
  if (/n[ãa]o autorizada|^refused/i.test(t)) return "Não autorizada pelo emissor";
  if (/dados do cart|fraud or security/i.test(t)) return "Dados do cartão ou suspeita de fraude";
  if (/excessive reattempts/i.test(t)) return "Excesso de tentativas";
  if (/credenciais/i.test(t)) return "Credenciais inválidas";
  if (/n[ãa]o cadastrado/i.test(t)) return "Cartão não cadastrado";
  if (/never approve/i.test(t)) return "Emissor nunca aprova";
  if (/tente novamente|policy/i.test(t)) return "Tente novamente mais tarde";
  if (/life cycle/i.test(t)) return "Cartão fora do ciclo de vida";
  if (/central do seu cart|function not supported/i.test(t)) return "Contatar a central do cartão";
  if (/closed account/i.test(t)) return "Conta encerrada";
  return t.replace(/\s*\(Cod\. [^)]*\)\s*/gi, "").trim() || "Outros";
}

const round2 = (n) => Math.round(n * 100) / 100;

/** Resume a lista de devedores de uma unidade/mês. */
export function resumirDevedores(rows) {
  const r = { falhas: 0, recuperadas: 0, abertas: 0, valorAberto: 0, valorRecuperado: 0, motivos: {} };
  for (const d of rows) {
    const status = String(d.debtStatus ?? "").toLowerCase();
    if (status === "canceled") continue; // título cancelado não é cobrança perdida
    r.falhas += 1;
    const valor = d.debtAmount || 0;
    const aberta = status === "open";
    if (aberta) { r.abertas += 1; r.valorAberto += valor; } else { r.recuperadas += 1; r.valorRecuperado += valor; }
    const cat = categoriaRecusa(d.lastAcquirerDeclineReason);
    if (cat) {
      const m = (r.motivos[cat] ??= { n: 0, abertas: 0, valorAberto: 0 });
      m.n += 1;
      if (aberta) { m.abertas += 1; m.valorAberto = round2(m.valorAberto + valor); }
    }
  }
  r.valorAberto = round2(r.valorAberto);
  r.valorRecuperado = round2(r.valorRecuperado);
  return r;
}

export async function devedoresDaUnidade(idBranch, ym, hoje) {
  const ate = diaDeCorte(ym, hoje);
  const rows = [];
  for (let skip = 0; skip < 100000; skip += PAGINA) {
    const j = await evoGet(`/receivables/debtors?idBranch=${idBranch}&dueDateStart=${ym}-01&dueDateEnd=${ate}&take=${PAGINA}&skip=${skip}`);
    const lote = j.results ?? [];
    rows.push(...lote);
    if (lote.length < PAGINA) break;
  }
  return resumirDevedores(rows);
}
