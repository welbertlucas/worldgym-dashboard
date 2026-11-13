// Instagram das unidades (só leitura): perfil, posts do feed e stories, pelo usuário de sistema "dashboard-leitura"
// do portfólio World Gym DF&GO (token META_TOKEN_DFGO, permissões instagram_basic e instagram_manage_insights).
// As contas chegam pelas páginas do Facebook atribuídas a esse usuário; o Instagram ligado à página vem junto.
// Stories somem da API em 24 horas: a rotina roda a cada 4 horas e guarda cada um (com uma imagem pequena) para o histórico.
const VERSAO = process.env.META_API_VERSION || "v24.0";
const BASE = `https://graph.facebook.com/${VERSAO}`;

/** Conta do Instagram (usuário, sem @) -> unidade do painel. `null` = conta da marca (rede toda). */
export const CONTAS_IG = {
  worldgymbrasil: null,
  "worldgym.asanorte": "Asa Norte",
  "worldgym.gama": "Gama",
  "worldgym.itapoa": "Itapoã",
  "worldgym.santamariadf": "Santa Maria",
  "worldgym.aguaslindas": "Águas Lindas-GO",
  "worldgympro.goiania": "Goiânia Pro-GO", // do portfólio World Gym Goiânia, compartilhado com o DF&GO (Insights) em 12/11/2026
};

/** Quanto tempo de posts e stories fica guardado. */
export const DIAS_GUARDADOS = 120;
/** Métricas tentadas em ordem: o Meta troca nomes (impressions -> views, reach saindo); a primeira lista aceita vale. */
export const METRICAS = {
  post: [["views", "reach", "saved", "shares", "total_interactions"], ["views", "saved", "shares", "total_interactions"], ["views"], ["reach"]],
  story: [["views", "reach", "replies", "shares", "total_interactions"], ["views", "replies", "shares"], ["views"], ["reach"]],
};

export async function graph(caminho, token) {
  const url = caminho.startsWith("http") ? caminho : `${BASE}/${caminho}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const corpo = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(`Meta ${res.status}: ${corpo.error?.message ?? "erro sem mensagem"}`); // nunca a URL: pode levar o token
    e.codigo = corpo.error?.code;
    throw e;
  }
  return corpo;
}

/** Contas do Instagram que o token enxerga (pelas páginas), com seguidores e número de posts. */
export async function descobrirContas(token, g = graph) {
  const campos = "name,instagram_business_account{id,username,name,followers_count,media_count,profile_picture_url}";
  const out = [];
  let url = `me/accounts?fields=${encodeURIComponent(campos)}&limit=100`;
  while (url) {
    const r = await g(url, token);
    for (const p of r.data ?? []) {
      const ig = p.instagram_business_account;
      if (ig?.id && ig.username) out.push({ id: ig.id, usuario: ig.username, nome: ig.name ?? p.name, pagina: p.name, seguidores: ig.followers_count ?? null, posts: ig.media_count ?? null, foto: ig.profile_picture_url ?? null });
    }
    url = r.paging?.next ?? null;
  }
  return out;
}

/** Valor de cada métrica de uma resposta de insights: { views: 120, reach: 90 }. */
export const valoresDeInsights = (r) => Object.fromEntries((r.data ?? []).map((m) => [m.name, Number(m.values?.[0]?.value ?? m.total_value?.value ?? 0)]));

/**
 * Insights de um post ou story, tentando as listas de métricas em ordem. `lembrar` guarda qual lista funcionou para não
 * repetir as que o Meta recusou. Story com menos de 5 pessoas volta erro 10: fica sem números (null), não é falha.
 */
export async function insightsDe(id, tipo, token, lembrar = {}, g = graph) {
  const listas = METRICAS[tipo].slice(lembrar[tipo] ?? 0);
  for (let i = 0; i < listas.length; i++) {
    try {
      const r = await g(`${id}/insights?metric=${listas[i].join(",")}`, token);
      lembrar[tipo] = (lembrar[tipo] ?? 0) + i;
      return valoresDeInsights(r);
    } catch (e) {
      if (e.codigo === 10) return null;
      if (i === listas.length - 1) return null;
    }
  }
  return null;
}

const corta = (t, n = 280) => (t && t.length > n ? `${t.slice(0, n - 1)}…` : t ?? "");

/** Post do Graph -> registro guardado. */
export function postDoGraph(m, conta, numeros) {
  return {
    id: m.id,
    conta: conta.usuario,
    unidade: CONTAS_IG[conta.usuario] ?? null,
    tipo: m.media_product_type === "REELS" ? "REELS" : m.media_type ?? "IMAGE", // IMAGE, VIDEO, CAROUSEL_ALBUM ou REELS
    legenda: corta(m.caption),
    link: m.permalink ?? null,
    data: m.timestamp ?? null,
    curtidas: m.like_count ?? null,
    comentarios: m.comments_count ?? null,
    visualizacoes: numeros?.views ?? null,
    alcance: numeros?.reach ?? null,
    salvos: numeros?.saved ?? null,
    compartilhamentos: numeros?.shares ?? null,
    interacoes: numeros?.total_interactions ?? null,
  };
}

/** Story do Graph -> registro guardado. */
export function storyDoGraph(s, conta, numeros) {
  return {
    id: s.id,
    conta: conta.usuario,
    unidade: CONTAS_IG[conta.usuario] ?? null,
    tipo: s.media_type ?? "IMAGE",
    link: s.permalink ?? null,
    data: s.timestamp ?? null,
    visualizacoes: numeros?.views ?? null,
    alcance: numeros?.reach ?? null,
    respostas: numeros?.replies ?? null,
    compartilhamentos: numeros?.shares ?? null,
    interacoes: numeros?.total_interactions ?? null,
  };
}

/** Endereço da imagem a copiar: capa (thumbnail_url) nos vídeos, a própria mídia nas fotos. */
export const imagemDe = (m) => m.thumbnail_url ?? (m.media_type === "VIDEO" ? null : m.media_url) ?? null;

const CAMPOS_POST = "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count";
const CAMPOS_STORY = "id,media_type,media_url,thumbnail_url,permalink,timestamp";

/** Posts do feed desde `desde` (ISO), mais novos primeiro. */
export async function postsDesde(igId, desde, token, g = graph) {
  const out = [];
  let url = `${igId}/media?fields=${CAMPOS_POST}&limit=50`;
  while (url) {
    const r = await g(url, token);
    const lote = r.data ?? [];
    out.push(...lote.filter((m) => !m.timestamp || m.timestamp >= desde));
    url = lote.length && lote[lote.length - 1].timestamp >= desde ? r.paging?.next ?? null : null;
  }
  return out;
}

export const storiesNoAr = async (igId, token, g = graph) => (await g(`${igId}/stories?fields=${CAMPOS_STORY}`, token)).data ?? [];

/**
 * Junta a leitura nova à guardada: posts e stories pelo id (a leitura nova atualiza os números; stories que saíram do ar
 * ficam como estavam), descarta o que passou de DIAS_GUARDADOS e anota os seguidores do dia por conta.
 * Devolve também os ids descartados, para apagar as imagens deles.
 */
export function mesclar(antigo, novo, agora = new Date()) {
  const limite = new Date(agora.getTime() - DIAS_GUARDADOS * 86400000).toISOString();
  const junta = (velhos = [], novos = []) => {
    const m = new Map(velhos.map((x) => [x.id, x]));
    for (const x of novos) m.set(x.id, { ...m.get(x.id), ...x, midia: x.midia ?? m.get(x.id)?.midia ?? null });
    const todos = [...m.values()].sort((a, b) => String(b.data).localeCompare(String(a.data)));
    return { ficam: todos.filter((x) => !x.data || x.data >= limite), saem: todos.filter((x) => x.data && x.data < limite).map((x) => x.id) };
  };
  const posts = junta(antigo?.posts, novo.posts);
  const stories = junta(antigo?.stories, novo.stories);
  const dia = agora.toISOString().slice(0, 10);
  const seguidores = { ...(antigo?.seguidores ?? {}) };
  for (const c of novo.contas ?? []) if (c.seguidores != null) seguidores[c.usuario] = { ...(seguidores[c.usuario] ?? {}), [dia]: c.seguidores };
  return {
    dados: { geradoEm: agora.toISOString(), contas: novo.contas ?? antigo?.contas ?? [], seguidores, posts: posts.ficam, stories: stories.ficam, erros: novo.erros ?? [] },
    descartados: [...posts.saem, ...stories.saem],
  };
}
