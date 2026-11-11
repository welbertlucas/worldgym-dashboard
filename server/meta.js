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
const maiorDe = (tipos) => (acoes) => Math.max(0, ...(acoes || []).filter((a) => tipos.has(a.action_type)).map((a) => Number(a.value || 0)));
const leadsDe = maiorDe(LEAD);
// Compras marcadas pelo pixel (site/checkout). Mesma ideia: "purchase"/"omni_purchase" já somam os outros tipos.
const COMPRA = new Set(["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase", "onsite_web_purchase"]);
/** Compras pelo pixel (quantidade) e valor delas (R$), a partir de actions e action_values. */
export const comprasDe = (acoes, valores) => ({ compras: maiorDe(COMPRA)(acoes), valorCompras: Math.round(maiorDe(COMPRA)(valores) * 100) / 100 });

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
    frequencia7d: Number(i.frequency || 0), // vezes, em média, que a mesma pessoa viu o anúncio na semana
    leads7d: leadsDe(i.actions),
    conversas7d: soma(i.actions, CONVERSA),
  };
}

const CAMPOS = "name,objective,effective_status,start_time,stop_time,daily_budget,insights.date_preset(last_7d){spend,impressions,clicks,frequency,actions}";

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

/** Anúncio (nível do Graph "ad") -> linha do ranking: gasto e resultados dos últimos 30 dias. Miniatura entra depois. */
export function anuncioDoMeta(i, conta) {
  return {
    id: i.ad_id,
    unidade: conta.unidade,
    conta: conta.conta,
    nome: i.ad_name ?? "",
    campanha: i.campaign_name ?? "",
    gasto30d: Number(i.spend || 0),
    impressoes30d: Number(i.impressions || 0),
    cliques30d: Number(i.clicks || 0),
    leads30d: leadsDe(i.actions),
    conversas30d: soma(i.actions, CONVERSA),
    compras30d: comprasDe(i.actions, i.action_values).compras,
    imagem: null,
  };
}

/**
 * Miniaturas dos criativos, de 50 em 50 anúncios, pela lista de anúncios da conta filtrada pelos ids
 * (a consulta direta "?ids=" deixou de ser aceita pelo Meta). Anúncio apagado só não volta.
 * Sem miniatura o anúncio continua no ranking.
 */
async function miniaturas(ids, token, contaId) {
  const out = {};
  const campos = encodeURIComponent("creative{thumbnail_url,image_url}");
  for (let i = 0; i < ids.length; i += 50) {
    try {
      const filtro = encodeURIComponent(JSON.stringify([{ field: "id", operator: "IN", value: ids.slice(i, i + 50) }]));
      let url = `https://graph.facebook.com/${VERSAO}/act_${contaId}/ads?fields=id,${campos}&filtering=${filtro}&limit=100`;
      for (let p = 0; url && p < 3; p++) {
        const r = await graph(url, token);
        for (const a of r.data ?? []) if (a.creative) out[a.id] = a.creative.image_url || a.creative.thumbnail_url || null;
        url = r.paging?.next ?? null;
      }
    } catch (e) { console.log(`miniaturas indisponíveis (act_${contaId}): ${e.message}`); }
  }
  return out;
}

/** Anúncios que gastaram nos últimos 30 dias numa conta (todas as campanhas, inclusive as já pausadas). */
export async function anunciosDaConta(conta, token, hoje = hojeBrasilia()) {
  const periodo = encodeURIComponent(JSON.stringify({ since: diasAtras(hoje, 29), until: hoje }));
  let url = `https://graph.facebook.com/${VERSAO}/act_${conta.id}/insights?level=ad&fields=ad_id,ad_name,campaign_name,spend,impressions,clicks,actions,action_values&time_range=${periodo}&limit=200`;
  const lista = [];
  for (let pagina = 0; url && pagina < 5; pagina++) {
    const r = await graph(url, token);
    for (const i of r.data ?? []) { const a = anuncioDoMeta(i, conta); if (a.id && a.gasto30d > 0) lista.push(a); }
    url = r.paging?.next ?? null;
  }
  const fotos = await miniaturas(lista.map((a) => a.id), token, conta.id);
  for (const a of lista) a.imagem = fotos[a.id] ?? null;
  return lista;
}

/** Anúncios de todas as contas com token. Conta que falha não derruba as outras. */
export async function anunciosDaRede(tokens, contas = CONTAS, pausaMs = 300, hoje = hojeBrasilia()) {
  const anuncios = [];
  const erros = [];
  for (const conta of contas) {
    const token = tokens[conta.token];
    if (!token) continue; // a falta de token já aparece nos erros das campanhas
    try { anuncios.push(...(await anunciosDaConta(conta, token, hoje))); } catch (e) { erros.push({ conta: conta.conta, erro: e.message }); }
    await new Promise((r) => setTimeout(r, pausaMs));
  }
  return { anuncios, erros };
}

/**
 * Contatos (leads + conversas) por dia da semana × hora nos últimos 28 dias completos (4 de cada dia da semana),
 * no fuso da conta de anúncio. Vetor de 168 posições: dia da semana × 24 + hora, domingo = 0 (igual ao mapa das entradas).
 */
export async function calorDaConta(conta, token, hoje = hojeBrasilia()) {
  const periodo = encodeURIComponent(JSON.stringify({ since: diasAtras(hoje, 28), until: diasAtras(hoje, 1) }));
  let url = `https://graph.facebook.com/${VERSAO}/act_${conta.id}/insights?level=account&fields=actions&time_range=${periodo}&time_increment=1&breakdowns=hourly_stats_aggregated_by_advertiser_time_zone&limit=500`;
  const calor = Array(168).fill(0);
  for (let pagina = 0; url && pagina < 10; pagina++) {
    const r = await graph(url, token);
    for (const l of r.data ?? []) {
      const h = Number(String(l.hourly_stats_aggregated_by_advertiser_time_zone ?? "").slice(0, 2));
      if (!Number.isInteger(h) || h < 0 || h > 23 || !l.date_start) continue;
      const sem = new Date(`${l.date_start}T12:00:00Z`).getUTCDay();
      calor[sem * 24 + h] += leadsDe(l.actions) + soma(l.actions, CONVERSA);
    }
    url = r.paging?.next ?? null;
  }
  return calor;
}

/** Total de contatos da conta nos mesmos 28 dias, sem separar por hora: mostra quanto do total o Meta informou com horário. */
export async function contatosDoPeriodo(conta, token, hoje = hojeBrasilia()) {
  const periodo = encodeURIComponent(JSON.stringify({ since: diasAtras(hoje, 28), until: diasAtras(hoje, 1) }));
  const r = await graph(`https://graph.facebook.com/${VERSAO}/act_${conta.id}/insights?level=account&fields=actions&time_range=${periodo}`, token);
  const i = r.data?.[0] ?? {};
  return leadsDe(i.actions) + soma(i.actions, CONVERSA);
}

/** Calor de todas as contas, somando as contas da mesma unidade, e o total de contatos do período. A Institucional fica em "Rede". */
export async function calorDaRede(tokens, contas = CONTAS, pausaMs = 300, hoje = hojeBrasilia()) {
  const unidades = {};
  const totais = {};
  const erros = [];
  for (const conta of contas) {
    const token = tokens[conta.token];
    if (!token) continue;
    try {
      const c = await calorDaConta(conta, token, hoje);
      const total = await contatosDoPeriodo(conta, token, hoje);
      const chave = conta.unidade ?? "Rede";
      const alvo = (unidades[chave] ??= Array(168).fill(0));
      c.forEach((n, k) => { alvo[k] += n; });
      totais[chave] = (totais[chave] ?? 0) + total;
    } catch (e) { erros.push({ conta: conta.conta, erro: e.message }); }
    await new Promise((r) => setTimeout(r, pausaMs));
  }
  return { de: diasAtras(hoje, 28), ate: diasAtras(hoje, 1), unidades, totais, erros };
}

/** Último dia de um mês "AAAA-MM" (ISO). */
const fimDoMes = (ym) => { const [a, m] = ym.split("-").map(Number); return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10); };
/** Hoje em Brasília (ISO). */
export const hojeBrasilia = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

/** Investimento e resultados de uma conta num mês: todas as campanhas, inclusive as já pausadas ou encerradas. */
export async function mesDaConta(conta, token, ym, hoje = hojeBrasilia()) {
  const fim = fimDoMes(ym);
  const periodo = encodeURIComponent(JSON.stringify({ since: `${ym}-01`, until: fim < hoje ? fim : hoje }));
  const r = await graph(`https://graph.facebook.com/${VERSAO}/act_${conta.id}/insights?level=account&fields=spend,impressions,reach,clicks,actions,action_values&time_range=${periodo}`, token);
  const i = r.data?.[0] ?? {};
  return { investimento: Number(i.spend || 0), impressoes: Number(i.impressions || 0), alcance: Number(i.reach || 0), cliques: Number(i.clicks || 0), leads: leadsDe(i.actions), conversas: soma(i.actions, CONVERSA), ...comprasDe(i.actions, i.action_values) };
}

const REDE = "Rede";
const CAMPOS_MES = ["investimento", "impressoes", "alcance", "cliques", "leads", "conversas", "compras", "valorCompras"];

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
