// Instagram das unidades (gravado por scripts/instagram-sync.mjs a cada 4 horas).
// GET /api/instagram            -> { geradoEm, contas, seguidores, posts, stories, erros } (só as contas que a pessoa pode ver)
// GET /api/instagram?midia=<id> -> a imagem pequena guardada daquele post/story (JPEG)
import { loadInstagram, loadMidiaInstagram } from "../server/store.js";
import { cors, exigirLogin } from "./_auth.js";
import { filtrarInstagram } from "../server/visibilidade.js";

const TTL_MS = 10 * 60 * 1000;
let memo = null;

async function dados() {
  if (!memo || Date.now() - memo.em > TTL_MS) memo = { em: Date.now(), dados: (await loadInstagram()) ?? { geradoEm: null, contas: [], seguidores: {}, posts: [], stories: [], erros: [] } };
  return memo.dados;
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  const sessao = await exigirLogin(req, res);
  if (!sessao) return;
  try {
    const visiveis = filtrarInstagram(await dados(), sessao);
    const id = typeof req.query?.midia === "string" ? req.query.midia : null;
    if (id) {
      // Só entrega a imagem de um post/story que a pessoa pode ver (o id vem da lista filtrada acima).
      if (!/^\d+$/.test(id) || ![...visiveis.posts, ...visiveis.stories].some((x) => x.id === id && x.midia)) return res.status(404).end();
      const stream = await loadMidiaInstagram(id);
      if (!stream) return res.status(404).end();
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "private, max-age=604800, immutable");
      return res.status(200).send(Buffer.from(await new Response(stream).arrayBuffer()));
    }
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.status(200).json(visiveis);
  } catch (e) {
    return res.status(500).json({ error: String(e?.message ?? e) });
  }
}
