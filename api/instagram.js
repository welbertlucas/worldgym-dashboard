// Instagram das unidades (gravado por scripts/instagram-sync.mjs a cada 4 horas).
// GET /api/instagram            -> { geradoEm, contas, seguidores, posts, stories, erros } (só as contas que a pessoa pode ver)
// GET /api/instagram?midia=<id> -> a imagem pequena guardada daquele post/story (JPEG)
// GET /api/instagram?influenciadores=1 -> { influenciadores } (cadastro; Master vê todos, unidades só os seus)
// POST /api/instagram { acao: "criar" | "atualizar" | "remover", ... } -> só o dono (ver server/influenciadores.js)
import { loadInstagram, loadMidiaInstagram } from "../server/store.js";
import { cors, exigirLogin } from "./_auth.js";
import { filtrarInstagram, filtrarInfluenciadores } from "../server/visibilidade.js";
import { tratarInfluenciadores } from "../server/influenciadores.js";

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
  // Cadastro dos influenciadores (Marketing > Influenciadores). Fica nesta rota para não criar mais uma função na Vercel.
  if (req.method === "POST" || req.query?.influenciadores !== undefined) return tratarInfluenciadores(req, res, sessao, filtrarInfluenciadores);
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
