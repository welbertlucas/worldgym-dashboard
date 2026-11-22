// Leitura dos indicadores direto do EVO (W12). Um token do módulo Administração Geral
// enxerga todas as unidades. Só leitura; guarda apenas totais (nada de dados de alunos).
//
// Regras (decididas com o dono em 03/11/2026):
//  - faturamento = soma de `ammount` dos títulos que VENCEM no mês, sem os cancelados;
//  - recebimento = soma de `ammountPaid` dos títulos efetivamente cobrados no mês (data
//    `chargeDate`, a do pagamento — `receivingDate` é sempre igual ao vencimento), sem cancelados.

import { COORDENADAS_UNIDADES, UNIT_NAMES } from "./units.js";
import { semanasFinanceiro } from "./semanas.js";

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

// Esperas entre tentativas: 1, 2, 4, 8, 16, 32, 64 s e depois 2 min cada (10 tentativas ≈ 8 min no total).
// O EVO às vezes fica alguns minutos fora (500/503) ou recusa o login no próprio banco; esperar mais é o que resolve.
const TENTATIVAS = 10;
const espera = (i) => new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** i, 120_000)));

/**
 * Vale tentar de novo? 429 e 5xx sim. 4xx (parâmetro inválido, credencial errada) não melhora repetindo, com uma exceção:
 * o EVO devolve 401 quando o backend dele está sobrecarregado ("Timeout expired") ou quando o servidor não consegue logar
 * no próprio banco ("A connection was successfully established with the server, but then an error occurred during the
 * login process"). Esses 401 são transitórios: a mesma credencial funciona nas consultas antes e depois.
 */
export function transitorio(status, texto = "") {
  if (status === 429 || status >= 500) return true;
  return status === 401 && /timeout|login process|connection was successfully established/i.test(texto);
}

// Contador de chamadas ao EVO (a API Pro cobra por uso: R$ 250/mês de teto em nov/2026). Conta cada tentativa que saiu daqui,
// inclusive as repetidas por 429/5xx, porque o EVO pode cobrar essas também. Só totais, nada de dado pessoal.
// Ao fim de cada script, no GitHub (ou com CONTAR_EVO=1), uma linha "EVO: N chamadas" vai para o log da execução.
const consumo = { total: 0, rotas: {}, status: {}, ms: 0, comTempo: 0, msMax: 0 };
/** `ms`: quanto a resposta demorou (só o tempo da chamada, sem as esperas entre tentativas). Serve para saber se o EVO está lento ou se o tempo vai em esperas. */
export function registrarChamada(path, status, ms) {
  const rota = String(path).split("?")[0].replace(/\/\d+(?=\/|$)/g, "/:id");
  consumo.total += 1;
  consumo.rotas[rota] = (consumo.rotas[rota] ?? 0) + 1;
  const faixa = typeof status === "number" ? (status >= 500 ? "5xx" : String(status)) : "rede";
  consumo.status[faixa] = (consumo.status[faixa] ?? 0) + 1;
  if (typeof ms === "number" && Number.isFinite(ms)) { consumo.ms += ms; consumo.comTempo += 1; consumo.msMax = Math.max(consumo.msMax, ms); }
}
export const consumoEvo = () => ({ total: consumo.total, rotas: { ...consumo.rotas }, status: { ...consumo.status }, ms: consumo.ms, comTempo: consumo.comTempo, msMax: consumo.msMax });
export function zerarConsumoEvo() { consumo.total = 0; consumo.rotas = {}; consumo.status = {}; consumo.ms = 0; consumo.comTempo = 0; consumo.msMax = 0; }
const textoStatus = (s) => Object.entries(s).map(([k, n]) => `${k}: ${n}`).join(", ");
const textoTempo = (ms, n, max) => (n ? ` | resposta em média ${Math.round(ms / n)} ms${max ? `, a mais lenta ${Math.round(max)} ms` : ""}` : "");
export function linhaDeConsumo(c = consumo) {
  const top = Object.entries(c.rotas).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([r, n]) => `${r} ${n}`).join("; ");
  return `EVO: ${c.total} chamadas (${textoStatus(c.status)}) | ${top}${textoTempo(c.ms, c.comTempo, c.msMax)}`;
}
/** O que aconteceu entre duas fotos do contador (para o log de cada unidade): "12 chamadas (200: 12), resposta em média 340 ms". */
export function consumoEntre(antes, depois = consumoEvo()) {
  const status = {};
  for (const [k, n] of Object.entries(depois.status)) { const d = n - (antes.status[k] ?? 0); if (d) status[k] = d; }
  const total = depois.total - antes.total;
  return `${total} chamadas (${textoStatus(status)})${textoTempo(depois.ms - antes.ms, depois.comTempo - antes.comTempo, 0)}`;
}
if (process.env.GITHUB_ACTIONS || process.env.CONTAR_EVO) {
  process.on("exit", () => { if (consumo.total) console.log(linhaDeConsumo()); });
  // Limite de tempo da etapa ou cancelamento no GitHub: o log mostra o consumo mesmo assim (sem isto a linha só saía no fim normal).
  for (const sinal of ["SIGTERM", "SIGINT"]) process.on(sinal, () => { process.exit(sinal === "SIGINT" ? 130 : 143); });
}

export async function evoGet(path, tries = TENTATIVAS) {
  let last = "";
  for (let i = 0; i < tries; i++) {
    await throttle();
    let res;
    const inicio = Date.now();
    try {
      res = await fetch(urlDe(path), { headers: { Authorization: auth() } });
      registrarChamada(path, res.status, Date.now() - inicio);
    } catch (e) {
      if (!res) registrarChamada(path, null, Date.now() - inicio);
      // Queda de rede (fetch failed): vale tentar de novo, como 429 e 5xx.
      last = `rede ${e.cause?.code || e.message}`;
      await espera(i);
      continue;
    }
    if (res.ok) {
      // A conexão também pode cair no meio da leitura do corpo (ECONNRESET/terminated): tenta de novo.
      try {
        return await res.json();
      } catch (e) {
        last = `rede ao ler resposta ${e.cause?.code || e.message}`;
        await espera(i);
        continue;
      }
    }
    last = `${res.status} ${(await res.text()).slice(0, 120)}`;
    if (!transitorio(res.status, last)) break;
    await espera(i);
  }
  throw new Error(`EVO ${last} em ${path}`);
}

/** GET que devolve o corpo em bytes (relatórios em Excel). `path` começa em /api/... (qualquer versão). */
export async function evoBuffer(path, tries = TENTATIVAS) {
  let last = "";
  for (let i = 0; i < tries; i++) {
    await throttle();
    const inicio = Date.now();
    try {
      const res = await fetch(BASE.replace(/\/api\/v1$/, "") + path, { headers: { Authorization: auth() } });
      registrarChamada(path, res.status, Date.now() - inicio);
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      last = `${res.status}`;
      if (res.status < 500 && res.status !== 429 && res.status !== 401) break;
    } catch (e) {
      last = `rede ${e.cause?.code || e.message}`;
    }
    await espera(i);
  }
  throw new Error(`EVO ${last} em ${path}`);
}

/** Todas as páginas de uma rota. `take` maior = menos chamadas (só para rotas que aceitam: /receivables aceita 1.000). */
export async function fetchAll(path, take = PAGE) {
  const out = [];
  for (let skip = 0; skip < 100000; skip += take) {
    const rows = await evoGet(`${path}&take=${take}&skip=${skip}`);
    out.push(...rows);
    if (rows.length < take) break;
  }
  return out;
}
/** Títulos: a rota aceita páginas de 1.000 (a carga mensal faz 10x menos chamadas que com 100). */
const PAGINA_TITULOS = 1000;

export async function listBranches() {
  const all = await evoGet("/configuration");
  // A posição do EVO erra em várias unidades (até 58 km): vale a do Google Maps quando a unidade está na tabela.
  return all.filter((b) => b.idBranch > 0).map((b) => {
    const [lat, lng] = COORDENADAS_UNIDADES[b.idBranch] ?? [b.latitude, b.longitude];
    return { idBranch: b.idBranch, name: String(b.name).trim(), latitude: lat, longitude: lng };
  });
}

function monthRange(ym) {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [`${ym}-01`, `${ym}-${String(last).padStart(2, "0")}`];
}

const round2 = (n) => Math.round(n * 100) / 100;
// Fora: cancelados e títulos sem aluno/prospect como pagador (transferências entre contas da própria unidade,
// conciliação bancária). Em Salvador/08-2026 eram R$ 666 mil de "Transferência | Pix" que inflavam o mês.
export const live = (r) => !r.cancellationDate && (r.idMemberPayer || r.idProspectPayer);

// Hoje no horário de Brasília (AAAA-MM-DD). O Brasil não tem horário de verão desde 2019.
export const hojeBR = (agora = Date.now()) => new Date(agora - 3 * 3600 * 1000).toISOString().slice(0, 10);
const dia = (iso) => String(iso ?? "").slice(0, 10);

/** Origem do título criado pelo EVO ao converter uma cobrança recusada em saldo devedor. */
export const SALDO_DEVEDOR = "Outstanding balance charge";

export async function unitMonth(idBranch, ym, hoje = hojeBR()) {
  const [a, b] = monthRange(ym);
  const [dueAll, paidAll] = await Promise.all([
    fetchAll(`/receivables?idBranch=${idBranch}&dueDateStart=${a}&dueDateEnd=${b}`, PAGINA_TITULOS),
    fetchAll(`/receivables?idBranch=${idBranch}&chargeDateStart=${a}&chargeDateEnd=${b}`, PAGINA_TITULOS),
  ]);
  const due = dueAll.filter(live);
  const paid = paidAll.filter(live);
  const emAndamento = hoje.slice(0, 7) === ym;
  const soma = (rs) => round2(rs.reduce((s, r) => s + (r.ammount || 0), 0));

  // Faturamento = títulos que JÁ venceram no mês (no mês em andamento, até hoje). O que ainda vai vencer
  // até o fim do mês é a previsão de faturamento. Em mês fechado os dois são iguais.
  const jaVenceu = emAndamento ? due.filter((r) => dia(r.dueDate) <= hoje) : due;
  // Cobrança de saldo devedor (source "Outstanding balance charge") é dívida de antes que o EVO lança de novo no lugar do título
  // recusado: não é venda do mês. Fica fora do faturamento (o EVO não a conta nas vendas) e dentro do card de saldo devedor.
  // Inadimplência, pagantes e recebimento seguem como estavam.
  const fatura = (r) => r.source !== SALDO_DEVEDOR;
  const jaVenceuFat = jaVenceu.filter(fatura);

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
    faturamento: soma(jaVenceuFat),
    previsaoFaturamento: soma(due.filter(fatura)),
    recebimento,
    titulosVencidos: jaVenceuFat.length,
    titulosPagos: paid.length,
    pagantes: pagantes.size,
    adimplentes: pagantes.size - devendo.size,
    inadimplentes: devendo.size,
    inadimplenciaPerc: pagantes.size ? round2((devendo.size / pagantes.size) * 100) : 0,
    ticketMedio: pagantes.size ? round2(recebimento / pagantes.size) : 0,
    // Faturamento e recebimento de cada semana do mês (relatórios semanais); a soma das semanas fecha com o total do mês.
    semanas: semanasFinanceiro(jaVenceuFat, paid, ym),
    // Só para o perfil da inadimplência (server/inadPerfil.js): a rotina tira isto antes de gravar o mês.
    _pagadores: { pagantes: [...pagantes].filter((x) => typeof x === "number"), devendo: [...devendo].filter((x) => typeof x === "number") },
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
