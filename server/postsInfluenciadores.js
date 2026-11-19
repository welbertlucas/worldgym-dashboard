// Posts (feed e reels) de cada influenciador cadastrado, lidos pelo @ com o Business Discovery da Meta, e quais deles citam ou
// marcam as contas da rede. É a base para o Atlas comparar o que foi postado com o que foi combinado no contrato.
// Só leitura de conteúdo público: data, tipo, link, uma legenda curta e curtidas/comentários. Roda em scripts/instagram-perfis.mjs.
// Stories não entram: a Meta não os entrega para contas de terceiros.
import { lerJson, gravarJson } from "./armazem.js";
import { graph } from "./instagram.js";

export const ARQUIVO_POSTS = "influenciadores/posts.json";
/** Quanto tempo de posts fica guardado (cobre o mês em andamento, o anterior e uma folga). */
export const DIAS_POSTS = 90;
const PAGINAS = 3;
const POR_PAGINA = 50;
const LEGENDA_MAX = 160;

export async function lerPostsGuardados() {
  try { return (await lerJson(ARQUIVO_POSTS)) ?? {}; } catch { return {}; }
}
export const gravarPostsGuardados = (dados) => gravarJson(ARQUIVO_POSTS, dados);

/** "reels" ou "feed". Stories não chegam; anúncio e demais contam como feed. */
export const tipoDoPost = (m) => (m?.media_product_type === "REELS" || /\/reels?\//i.test(String(m?.permalink ?? "")) ? "reels" : "feed");

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Quais das contas `handles` (sem @) a legenda cita como @conta. O ponto final de uma frase não faz parte do @
 * ("@worldgym.gama." cita worldgym.gama), mas ".algo" colado faz ("@worldgym.gama.br" é outra conta).
 */
export function contasCitadas(legenda, handles) {
  const texto = String(legenda ?? "");
  return [...new Set(handles.map((h) => String(h).toLowerCase()))].filter((h) => new RegExp(`(^|[^a-z0-9._])@${escapar(h)}(?![a-z0-9_])(?!\\.[a-z0-9_])`, "i").test(texto));
}

/** Post como o painel guarda: o essencial, sem o que não precisa. `citou`: contas da rede citadas na legenda ou marcadas no post. */
export function postDoGraph(m, citou) {
  return {
    id: String(m.id),
    tipo: tipoDoPost(m),
    data: m.timestamp ?? null,
    link: m.permalink ?? null,
    legenda: String(m.caption ?? "").replace(/\s+/g, " ").trim().slice(0, LEGENDA_MAX),
    curtidas: m.like_count ?? null,
    comentarios: m.comments_count ?? null,
    citou,
  };
}

const CAMPOS_COMPLETOS = "id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count";
const CAMPOS_MINIMOS = "id,caption,media_type,timestamp,permalink";

/**
 * Posts recentes de `usuario` (até 3 páginas de 50, parando quando passa de `desdeIso`), pela conta `igId` da marca. Se o Meta recusar um
 * campo (erro 100), repete só com o essencial. Devolve { ok: true, posts } com os dados crus do Meta, ou { ok: false, temporario, detalhe }.
 */
export async function lerPostsDoPerfil(igId, usuario, token, desdeIso, g = graph) {
  const posts = [];
  let depois = null;
  let campos = CAMPOS_COMPLETOS;
  for (let pagina = 0; pagina < PAGINAS; pagina++) {
    const media = `media${depois ? `.after(${depois})` : ""}.limit(${POR_PAGINA}){${campos}}`;
    let r;
    try {
      r = await g(`${igId}?fields=${encodeURIComponent(`business_discovery.username(${usuario}){${media}}`)}`, token);
    } catch (e) {
      if (e.codigo === 100 && campos === CAMPOS_COMPLETOS) { campos = CAMPOS_MINIMOS; pagina--; continue; }
      return { ok: false, temporario: [1, 2, 4, 17, 32, 341, 368, 613].includes(e.codigo), detalhe: String(e.message ?? e).slice(0, 200) };
    }
    const m = r?.business_discovery?.media;
    for (const x of m?.data ?? []) posts.push(x);
    const ultimo = m?.data?.[m.data.length - 1];
    depois = m?.paging?.cursors?.after ?? null;
    if (!depois || !ultimo?.timestamp || ultimo.timestamp < desdeIso) break;
  }
  return { ok: true, posts: posts.filter((p) => !p.timestamp || p.timestamp >= desdeIso) };
}

/**
 * Posts de qualquer perfil que MARCAM a conta `contaUsuario` (a da unidade ou da marca), pela rota /tags: pega a marcação na imagem,
 * que a legenda não mostra. Devolve [{ id, link, usuario }]. Uma página de 50 basta: quem marca a rede é pouca gente.
 */
export async function lerMarcacoes(contaId, token, g = graph) {
  const r = await g(`${contaId}/tags?fields=${encodeURIComponent("id,username,permalink,timestamp")}&limit=${POR_PAGINA}`, token);
  return (r.data ?? []).map((m) => ({ id: String(m.id), link: m.permalink ?? null, usuario: String(m.username ?? "").toLowerCase() }));
}

/**
 * Posts guardados de um influenciador: legenda curta, tipo e as contas da rede que ele cita ou marca.
 * `marcacoes`: Map "id ou link do post" -> contas (sem @) que ele marcou. `handles`: todas as contas da rede.
 */
export function montarPosts(crus, handles, marcacoes, agora = new Date()) {
  const desde = new Date(agora.getTime() - DIAS_POSTS * 86400000).toISOString();
  return crus
    .filter((m) => !m.timestamp || m.timestamp >= desde)
    .map((m) => {
      const marcadas = [...(marcacoes.get(String(m.id)) ?? []), ...(m.permalink ? marcacoes.get(m.permalink) ?? [] : [])];
      const citou = [...new Set([...contasCitadas(m.caption, handles), ...marcadas.map((h) => h.toLowerCase())])];
      return postDoGraph(m, citou);
    })
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));
}

/** Junta as marcações lidas em cada conta da rede num Map de post -> contas marcadas, só dos `usuarios` cadastrados. */
export function indexarMarcacoes(porConta, usuarios) {
  const alvo = new Set(usuarios.map((u) => u.toLowerCase()));
  const mapa = new Map();
  for (const [conta, lista] of Object.entries(porConta)) {
    for (const t of lista) {
      if (!alvo.has(t.usuario)) continue;
      for (const chave of [t.id, t.link].filter(Boolean)) mapa.set(chave, [...(mapa.get(chave) ?? []), conta]);
    }
  }
  return mapa;
}
