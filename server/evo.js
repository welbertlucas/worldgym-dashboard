// Leitura dos indicadores direto do EVO (W12). Um token do módulo Administração Geral
// enxerga todas as unidades. Só leitura; guarda apenas totais (nada de dados de alunos).
//
// Regras (decididas com o dono em 03/11/2026):
//  - faturamento = soma de `ammount` dos títulos que VENCEM no mês, sem os cancelados;
//  - recebimento = soma de `ammountPaid` dos títulos efetivamente cobrados no mês (data
//    `chargeDate`, a do pagamento — `receivingDate` é sempre igual ao vencimento), sem cancelados.

import { UNIT_NAMES } from "./units.js";

const BASE = "https://evo-integracao.w12app.com.br/api/v1";
const PAGE = 100;

function auth() {
  const { EVO_DNS, EVO_TOKEN } = process.env;
  if (!EVO_DNS || !EVO_TOKEN) throw new Error("EVO_DNS / EVO_TOKEN não configurados");
  return "Basic " + Buffer.from(`${EVO_DNS}:${EVO_TOKEN}`).toString("base64");
}

// O EVO limita a 4 req/s por chave e bloqueia a chave por 1h se abusarmos: ritmo global bem abaixo disso.
const GAP_MS = 500;
let nextSlot = 0;
async function throttle() {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + GAP_MS;
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

async function evoGet(path, tries = 7) {
  let last = "";
  for (let i = 0; i < tries; i++) {
    await throttle();
    let res;
    try {
      res = await fetch(BASE + path, { headers: { Authorization: auth() } });
    } catch (e) {
      // Queda de rede (fetch failed): vale tentar de novo, como 429 e 5xx.
      last = `rede ${e.cause?.code || e.message}`;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
      continue;
    }
    if (res.ok) return res.json();
    last = `${res.status} ${(await res.text()).slice(0, 120)}`;
    // 4xx (credencial, parâmetro inválido) não melhora repetindo: só 429 e 5xx merecem nova tentativa.
    // O EVO às vezes devolve 401 "Timeout expired" quando o backend dele está sobrecarregado: é transitório.
    const transient401 = res.status === 401 && /timeout/i.test(last);
    if (res.status < 500 && res.status !== 429 && !transient401) break;
    await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
  }
  throw new Error(`EVO ${last} em ${path}`);
}

export async function fetchAll(path) {
  const out = [];
  for (let skip = 0; skip < 100000; skip += PAGE) {
    const rows = await evoGet(`${path}&take=${PAGE}&skip=${skip}`);
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

export async function listBranches() {
  const all = await evoGet("/configuration");
  return all.filter((b) => b.idBranch > 0).map((b) => ({ idBranch: b.idBranch, name: String(b.name).trim() }));
}

function monthRange(ym) {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [`${ym}-01`, `${ym}-${String(last).padStart(2, "0")}`];
}

const round2 = (n) => Math.round(n * 100) / 100;
// Fora: cancelados e títulos sem aluno/prospect como pagador (transferências entre contas da própria unidade,
// conciliação bancária). Em Salvador/08-2026 eram R$ 666 mil de "Transferência | Pix" que inflavam o mês.
const live = (r) => !r.cancellationDate && (r.idMemberPayer || r.idProspectPayer);

export async function unitMonth(idBranch, ym) {
  const [a, b] = monthRange(ym);
  const [dueAll, paidAll] = await Promise.all([
    fetchAll(`/receivables?idBranch=${idBranch}&dueDateStart=${a}&dueDateEnd=${b}`),
    fetchAll(`/receivables?idBranch=${idBranch}&chargeDateStart=${a}&chargeDateEnd=${b}`),
  ]);
  const due = dueAll.filter(live);
  const paid = paidAll.filter(live);
  return {
    faturamento: round2(due.reduce((s, r) => s + (r.ammount || 0), 0)),
    recebimento: round2(paid.reduce((s, r) => s + (r.ammountPaid || 0), 0)),
    titulosVencidos: due.length,
    titulosPagos: paid.length,
  };
}

// Calcula todas as unidades de um mês (poucas em paralelo pra não estourar o limite do EVO).
export async function computeMonth(ym, { concurrency = 3 } = {}) {
  const branches = (await listBranches()).filter((b) => UNIT_NAMES[b.idBranch]).map((b) => ({ ...b, evoName: b.name, name: UNIT_NAMES[b.idBranch] }));
  const units = new Array(branches.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < branches.length) {
        const i = next++;
        units[i] = { ...branches[i], ...(await unitMonth(branches[i].idBranch, ym)) };
      }
    })
  );
  return { month: ym, generatedAt: new Date().toISOString(), units };
}
