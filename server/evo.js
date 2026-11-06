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
// Caminhos que começam com /api/ (v2, v3...) saem da raiz do host; os demais são relativos a /api/v1.
const urlDe = (path) => (path.startsWith("/api/") ? BASE.replace(/\/api\/v1$/, "") + path : BASE + path);

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
      res = await fetch(urlDe(path), { headers: { Authorization: auth() } });
    } catch (e) {
      // Queda de rede (fetch failed): vale tentar de novo, como 429 e 5xx.
      last = `rede ${e.cause?.code || e.message}`;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
      continue;
    }
    if (res.ok) {
      // A conexão também pode cair no meio da leitura do corpo (ECONNRESET/terminated): tenta de novo.
      try {
        return await res.json();
      } catch (e) {
        last = `rede ao ler resposta ${e.cause?.code || e.message}`;
        await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
        continue;
      }
    }
    last = `${res.status} ${(await res.text()).slice(0, 120)}`;
    // 4xx (credencial, parâmetro inválido) não melhora repetindo: só 429 e 5xx merecem nova tentativa.
    // O EVO às vezes devolve 401 "Timeout expired" quando o backend dele está sobrecarregado: é transitório.
    const transient401 = res.status === 401 && /timeout/i.test(last);
    if (res.status < 500 && res.status !== 429 && !transient401) break;
    await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
  }
  throw new Error(`EVO ${last} em ${path}`);
}

/** GET que devolve o corpo em bytes (relatórios em Excel). `path` começa em /api/... (qualquer versão). */
export async function evoBuffer(path, tries = 5) {
  let last = "";
  for (let i = 0; i < tries; i++) {
    await throttle();
    try {
      const res = await fetch(BASE.replace(/\/api\/v1$/, "") + path, { headers: { Authorization: auth() } });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      last = `${res.status}`;
      if (res.status < 500 && res.status !== 429 && res.status !== 401) break;
    } catch (e) {
      last = `rede ${e.cause?.code || e.message}`;
    }
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

// Hoje no horário de Brasília (AAAA-MM-DD). O Brasil não tem horário de verão desde 2019.
export const hojeBR = (agora = Date.now()) => new Date(agora - 3 * 3600 * 1000).toISOString().slice(0, 10);
const dia = (iso) => String(iso ?? "").slice(0, 10);

export async function unitMonth(idBranch, ym, hoje = hojeBR()) {
  const [a, b] = monthRange(ym);
  const [dueAll, paidAll] = await Promise.all([
    fetchAll(`/receivables?idBranch=${idBranch}&dueDateStart=${a}&dueDateEnd=${b}`),
    fetchAll(`/receivables?idBranch=${idBranch}&chargeDateStart=${a}&chargeDateEnd=${b}`),
  ]);
  const due = dueAll.filter(live);
  const paid = paidAll.filter(live);
  const emAndamento = hoje.slice(0, 7) === ym;
  const soma = (rs) => round2(rs.reduce((s, r) => s + (r.ammount || 0), 0));

  // Faturamento = títulos que JÁ venceram no mês (no mês em andamento, até hoje). O que ainda vai vencer
  // até o fim do mês é a previsão de faturamento. Em mês fechado os dois são iguais.
  const jaVenceu = emAndamento ? due.filter((r) => dia(r.dueDate) <= hoje) : due;

  // Pagantes = pessoas com título já vencido no mês. Inadimplente = quem não tinha pago algum desses títulos
  // no fim do mês (mês fechado) ou ainda não pagou e já passou do vencimento (mês em andamento).
  // Dá para reconstruir o passado porque o EVO guarda a data do pagamento.
  const quem = (r) => r.idMemberPayer || `p${r.idProspectPayer}`;
  const base = emAndamento ? due.filter((r) => dia(r.dueDate) < hoje) : due;
  const naoPago = emAndamento ? (r) => !r.chargeDate : (r) => !r.chargeDate || dia(r.chargeDate) > b;
  const pagantes = new Set(base.map(quem));
  const devendo = new Set(base.filter(naoPago).map(quem));
  const recebimento = round2(paid.reduce((s, r) => s + (r.ammountPaid || 0), 0));
  return {
    faturamento: soma(jaVenceu),
    previsaoFaturamento: soma(due),
    recebimento,
    titulosVencidos: jaVenceu.length,
    titulosPagos: paid.length,
    pagantes: pagantes.size,
    adimplentes: pagantes.size - devendo.size,
    inadimplentes: devendo.size,
    inadimplenciaPerc: pagantes.size ? round2((devendo.size / pagantes.size) * 100) : 0,
    ticketMedio: pagantes.size ? round2(recebimento / pagantes.size) : 0,
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
