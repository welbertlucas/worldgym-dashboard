// Campanhas de anúncio ativas no Meta (Facebook/Instagram), por unidade. Só leitura (permissão ads_read).
// Cada unidade tem a própria conta de anúncio; o nome da unidade vem da conta, não do nome da campanha.
// Tokens (nunca no código): META_TOKEN_DFGO (portfólio World Gym DF&GO) e META_TOKEN_BR01 (portfólio World Gym BR 01).
const VERSAO = process.env.META_API_VERSION || "v24.0";

/** Contas de anúncio -> unidade do painel. `unidade: null` = anúncio da rede toda. */
export const CONTAS = [
  { id: "264340275445545", conta: "WG 1 - Itapoã", unidade: "Itapoã", token: "DFGO" },
  { id: "588370222953971", conta: "WG 2 - Gama", unidade: "Gama", token: "DFGO" },
  { id: "648562409483340", conta: "WG 3 - Asa Norte", unidade: "Asa Norte", token: "DFGO" },
  { id: "468674611432966", conta: "WG 4 - Planaltina", unidade: "Planaltina-GO", token: "DFGO" },
  { id: "530042132213017", conta: "WG 5 - Samambaia", unidade: "Samambaia Norte", token: "DFGO" },
  { id: "271491753491104", conta: "WG 6 - Arniqueiras", unidade: "Arniqueira", token: "DFGO" },
  { id: "127794150418443", conta: "WG 7 - Riacho Fundo II", unidade: "Riacho Fundo II", token: "DFGO" },
  { id: "345445464586947", conta: "WG 8 - São Sebastião", unidade: "São Sebastião", token: "DFGO" },
  { id: "308150702074967", conta: "WG 9 - Ceilândia", unidade: "Ceilândia", token: "DFGO" },
  { id: "807832341176144", conta: "WG 10 - Sobradinho", unidade: "Sobradinho", token: "DFGO" },
  { id: "1586361752143025", conta: "WG 11 - Aguas Claras", unidade: "Águas Claras Pro", token: "DFGO" },
  { id: "787157320245418", conta: "WG 12 - Aguas Lindas", unidade: "Águas Lindas-GO", token: "DFGO" },
  { id: "365301839894540", conta: "WG 13 - Samambaia Sul", unidade: "Samambaia Sul", token: "DFGO" },
  { id: "1490683904963994", conta: "WG 14 - Ponte Alta", unidade: "Ponte Alta", token: "DFGO" },
  { id: "416852984397905", conta: "WG 15 - Goiânia Pro", unidade: "Goiânia Pro-GO", token: "DFGO" },
  { id: "454696550610583", conta: "WG 16 - Planaltina DF", unidade: "Planaltina-DF", token: "DFGO" },
  { id: "632835829720066", conta: "WG 16 - Novo Gama", unidade: "Novo Gama-GO", token: "DFGO" },
  { id: "1328519795654729", conta: "WG - Taguatinga Norte", unidade: "Taguatinga", token: "DFGO" },
  { id: "1478514526365139", conta: "WG 14 - Águas Claras II", unidade: "Águas Claras Metrópole", token: "DFGO" },
  { id: "1330879015199093", conta: "[CA03] WG Santa Maria", unidade: "Santa Maria", token: "DFGO" },
  { id: "911817731179169", conta: "[CA00] Institucional", unidade: null, token: "DFGO" },
];

const LEAD = new Set(["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"]);
const CONVERSA = new Set(["onsite_conversion.messaging_conversation_started_7d"]);
const soma = (acoes, tipos) => (acoes || []).filter((a) => tipos.has(a.action_type)).reduce((s, a) => s + Number(a.value || 0), 0);
// "lead" já é o total de leads; os outros tipos são partes dele. Pega o maior para não contar o mesmo lead duas vezes.
const leadsDe = (acoes) => Math.max(0, ...(acoes || []).filter((a) => LEAD.has(a.action_type)).map((a) => Number(a.value || 0)));

/** Campanha do Graph API -> linha do painel (valores em R$ e contagens dos últimos 7 dias). */
export function campanhaDoMeta(c, conta) {
  const i = c.insights?.data?.[0] ?? {};
  return {
    id: c.id,
    unidade: conta.unidade,
    conta: conta.conta,
    nome: c.name,
    objetivo: c.objective ?? null,
    inicio: c.start_time?.slice(0, 10) ?? null,
    fim: c.stop_time?.slice(0, 10) ?? null,
    orcamentoDiario: c.daily_budget ? Number(c.daily_budget) / 100 : null, // a API manda em centavos
    gasto7d: Number(i.spend || 0),
    impressoes7d: Number(i.impressions || 0),
    cliques7d: Number(i.clicks || 0),
    leads7d: leadsDe(i.actions),
    conversas7d: soma(i.actions, CONVERSA),
  };
}

const CAMPOS = "name,objective,effective_status,start_time,stop_time,daily_budget,insights.date_preset(last_7d){spend,impressions,clicks,actions}";

async function graph(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const corpo = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Meta ${res.status}: ${corpo.error?.message ?? "erro sem mensagem"}`); // nunca a URL: ela pode levar o token
  return corpo;
}

const diasAtras = (hoje, n) => new Date(Date.parse(`${hoje}T12:00:00Z`) - n * 86400000).toISOString().slice(0, 10);

/**
 * O Meta deixa o status "ativa" em campanhas que já acabaram (conjuntos de anúncios encerrados, data final passada).
 * No ar = não encerrada e com entrega nos últimos 7 dias (gasto ou impressões), ou começou nesta semana.
 */
export function estaNoAr(c, hoje = hojeBrasilia()) {
  if (c.fim && c.fim < hoje) return false;
  return c.gasto7d > 0 || c.impressoes7d > 0 || Boolean(c.inicio && c.inicio >= diasAtras(hoje, 7));
}

/** Campanhas no ar de uma conta de anúncio (segue a paginação). */
export async function campanhasAtivas(conta, token, hoje = hojeBrasilia()) {
  const filtro = encodeURIComponent(JSON.stringify(["ACTIVE"]));
  let url = `https://graph.facebook.com/${VERSAO}/act_${conta.id}/campaigns?fields=${encodeURIComponent(CAMPOS)}&effective_status=${filtro}&limit=100`;
  const saida = [];
  for (let pagina = 0; url && pagina < 10; pagina++) {
    const r = await graph(url, token);
    for (const c of r.data ?? []) { const x = campanhaDoMeta(c, conta); if (estaNoAr(x, hoje)) saida.push(x); }
    url = r.paging?.next ?? null;
  }
  return saida;
}

/** Todas as contas com token disponível. Conta que falha não derruba as outras: vai em `erros`. */
export async function campanhasDaRede(tokens, contas = CONTAS, pausaMs = 300) {
  const campanhas = [];
  const erros = [];
  for (const conta of contas) {
    const token = tokens[conta.token];
    if (!token) { erros.push({ conta: conta.conta, erro: `sem token ${conta.token}` }); continue; }
    try { campanhas.push(...(await campanhasAtivas(conta, token))); } catch (e) { erros.push({ conta: conta.conta, erro: e.message }); }
    await new Promise((r) => setTimeout(r, pausaMs));
  }
  return { campanhas, erros };
}

/** Último dia de um mês "AAAA-MM" (ISO). */
const fimDoMes = (ym) => { const [a, m] = ym.split("-").map(Number); return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10); };
/** Hoje em Brasília (ISO). */
export const hojeBrasilia = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

/** Investimento e resultados de uma conta num mês: todas as campanhas, inclusive as já pausadas ou encerradas. */
export async function mesDaConta(conta, token, ym, hoje = hojeBrasilia()) {
  const fim = fimDoMes(ym);
  const periodo = encodeURIComponent(JSON.stringify({ since: `${ym}-01`, until: fim < hoje ? fim : hoje }));
  const r = await graph(`https://graph.facebook.com/${VERSAO}/act_${conta.id}/insights?level=account&fields=spend,impressions,clicks,actions&time_range=${periodo}`, token);
  const i = r.data?.[0] ?? {};
  return { investimento: Number(i.spend || 0), impressoes: Number(i.impressions || 0), cliques: Number(i.clicks || 0), leads: leadsDe(i.actions), conversas: soma(i.actions, CONVERSA) };
}

const REDE = "Rede";
const CAMPOS_MES = ["investimento", "impressoes", "cliques", "leads", "conversas"];

/**
 * Meses fechados (ou o mês corrente até hoje) da rede: { [AAAA-MM]: { geradoEm, unidades: { [unidade | "Rede"]: {...} }, erros } }.
 * A conta Institucional entra como "Rede". Conta que falha não derruba as outras.
 */
export async function mesesDaRede(tokens, meses, contas = CONTAS, pausaMs = 300, hoje = hojeBrasilia()) {
  const saida = {};
  for (const ym of meses) {
    if (`${ym}-01` > hoje) continue;
    const unidades = {};
    const erros = [];
    for (const conta of contas) {
      const token = tokens[conta.token];
      if (!token) { erros.push({ conta: conta.conta, erro: `sem token ${conta.token}` }); continue; }
      try {
        const r = await mesDaConta(conta, token, ym, hoje);
        const u = (unidades[conta.unidade ?? REDE] ??= Object.fromEntries(CAMPOS_MES.map((k) => [k, 0])));
        for (const k of CAMPOS_MES) u[k] = Math.round((u[k] + r[k]) * 100) / 100;
      } catch (e) { erros.push({ conta: conta.conta, erro: e.message }); }
      await new Promise((r) => setTimeout(r, pausaMs));
    }
    saida[ym] = { geradoEm: new Date().toISOString(), unidades, erros };
  }
  return saida;
}

/** "2025-01..2026-11" ou "2026-10,2026-11" -> lista de meses. */
export function listaDeMeses(texto) {
  const out = [];
  for (const parte of String(texto || "").split(",").map((x) => x.trim()).filter(Boolean)) {
    const [de, ate] = parte.split("..");
    if (!/^\d{4}-\d{2}$/.test(de) || (ate && !/^\d{4}-\d{2}$/.test(ate))) throw new Error(`Mês inválido: ${parte} (use AAAA-MM ou AAAA-MM..AAAA-MM)`);
    let [a, m] = de.split("-").map(Number);
    const fim = ate ?? de;
    for (let ym = de; ym <= fim; ym = `${a}-${String(m).padStart(2, "0")}`) {
      out.push(ym);
      if (m === 12) { a += 1; m = 1; } else m += 1;
    }
  }
  return out;
}

/** Mês anterior e mês corrente, em Brasília: a rotina diária refaz os dois (o anterior fecha com os ajustes do Meta). */
export function mesesDaRotina(hoje = hojeBrasilia()) {
  const [a, m] = hoje.split("-").map(Number);
  const ant = m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
  return [ant, hoje.slice(0, 7)];
}
