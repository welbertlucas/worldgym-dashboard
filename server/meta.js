// Campanhas de anúncio ativas no Meta (Facebook/Instagram), por unidade. Só leitura (permissão ads_read).
// Cada unidade tem a própria conta de anúncio; o nome da unidade vem da conta, não do nome da campanha.
// Tokens (nunca no código): META_TOKEN_DFGO (portfólio World Gym DF&GO) e META_TOKEN_BR01 (portfólio World Gym BR 01).
const VERSAO = process.env.META_API_VERSION || "v24.0";

/** Contas de anúncio -> unidade do painel. `unidade: null` = anúncio da rede toda. `incerta`: ligação a confirmar com o dono. */
export const CONTAS = [
  { id: "264340275445545", conta: "WG 1 - Itapoã", unidade: "Itapoã", token: "DFGO" },
  { id: "588370222953971", conta: "WG 2 - Gama", unidade: "Gama", token: "DFGO" },
  { id: "648562409483340", conta: "WG 3 - Asa Norte", unidade: "Asa Norte", token: "DFGO" },
  { id: "468674611432966", conta: "WG 4 - Planaltina", unidade: "Planaltina-GO", token: "DFGO", incerta: true },
  { id: "530042132213017", conta: "WG 5 - Samambaia", unidade: "Samambaia Norte", token: "DFGO" },
  { id: "271491753491104", conta: "WG 6 - Arniqueiras", unidade: "Arniqueira", token: "DFGO" },
  { id: "127794150418443", conta: "WG 7 - Riacho Fundo II", unidade: "Riacho Fundo II", token: "DFGO" },
  { id: "345445464586947", conta: "WG 8 - São Sebastião", unidade: "São Sebastião", token: "DFGO" },
  { id: "308150702074967", conta: "WG 9 - Ceilândia", unidade: "Ceilândia", token: "DFGO" },
  { id: "807832341176144", conta: "WG 10 - Sobradinho", unidade: "Sobradinho", token: "DFGO" },
  { id: "1586361752143025", conta: "WG 11 - Aguas Claras", unidade: "Águas Claras Pro", token: "DFGO", incerta: true },
  { id: "787157320245418", conta: "WG 12 - Aguas Lindas", unidade: "Águas Lindas-GO", token: "DFGO" },
  { id: "365301839894540", conta: "WG 13 - Samambaia Sul", unidade: "Samambaia Sul", token: "DFGO" },
  { id: "1490683904963994", conta: "WG 14 - Ponte Alta", unidade: "Ponte Alta", token: "DFGO" },
  { id: "416852984397905", conta: "WG 15 - Goiânia Pro", unidade: "Goiânia Pro-GO", token: "DFGO" },
  { id: "454696550610583", conta: "WG 16 - Planaltina DF", unidade: "Planaltina-DF", token: "DFGO", incerta: true },
  { id: "632835829720066", conta: "WG 16 - Novo Gama", unidade: "Novo Gama-GO", token: "DFGO" },
  { id: "1328519795654729", conta: "WG - Taguatinga Norte", unidade: "Taguatinga", token: "DFGO" },
  { id: "1478514526365139", conta: "WG 14 - Águas Claras II", unidade: "Águas Claras Metrópole", token: "DFGO", incerta: true },
  { id: "1330879015199093", conta: "[CA03] WG Santa Maria", unidade: "Santa Maria", token: "DFGO" },
  { id: "911817731179169", conta: "[CA00] Institucional", unidade: null, token: "DFGO" },
];

const LEAD = new Set(["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"]);
const CONVERSA = new Set(["onsite_conversion.messaging_conversation_started_7d"]);
const soma = (acoes, tipos) => (acoes || []).filter((a) => tipos.has(a.action_type)).reduce((s, a) => s + Number(a.value || 0), 0);

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
    leads7d: soma(i.actions, LEAD),
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

/** Campanhas ativas de uma conta de anúncio (segue a paginação). */
export async function campanhasAtivas(conta, token) {
  const filtro = encodeURIComponent(JSON.stringify(["ACTIVE"]));
  let url = `https://graph.facebook.com/${VERSAO}/act_${conta.id}/campaigns?fields=${encodeURIComponent(CAMPOS)}&effective_status=${filtro}&limit=100`;
  const saida = [];
  for (let pagina = 0; url && pagina < 10; pagina++) {
    const r = await graph(url, token);
    for (const c of r.data ?? []) saida.push(campanhaDoMeta(c, conta));
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
