// Lê o Instagram das unidades (só leitura) e grava perfis, posts, stories e seguidores no Blob, com uma imagem pequena
// de cada post/story (o link do Meta vence em poucos dias). Roda a cada 4 horas: stories somem da API em 24 horas.
// Sem token, ou com um token que ainda não tem as permissões do Instagram, termina sem erro e mantém o que já havia.
// Uso: META_TOKEN_DFGO=... BLOB_READ_WRITE_TOKEN=... node scripts/instagram-sync.mjs
import sharp from "sharp";
import { CONTAS_IG, DIAS_GUARDADOS, descobrirContas, imagemDe, insightsDe, mesclar, postDoGraph, postsDesde, storiesNoAr, storyDoGraph } from "../server/instagram.js";
import { apagarMidiasInstagram, loadInstagram, saveInstagram, saveMidiaInstagram } from "../server/store.js";

const token = process.env.META_TOKEN_DFGO;
if (!token) { console.log("Instagram desligado: sem META_TOKEN_DFGO."); process.exit(0); }

let contas;
try {
  contas = await descobrirContas(token);
} catch (e) {
  console.log(`Instagram ainda indisponível (${e.message}). Nada foi gravado.`);
  process.exit(0);
}
const fora = contas.filter((c) => !(c.usuario in CONTAS_IG));
if (fora.length) console.log(`Contas vistas pelo token mas fora da lista do painel (ignoradas): ${fora.map((c) => `@${c.usuario}`).join(", ")}`);
contas = contas.filter((c) => c.usuario in CONTAS_IG).map((c) => ({ ...c, unidade: CONTAS_IG[c.usuario] }));
if (!contas.length) { console.log("Nenhuma conta do Instagram visível para o token (falta a permissão ou a atribuição). Nada foi gravado."); process.exit(0); }

const antigo = await loadInstagram();
const conhecidas = new Set([...(antigo?.posts ?? []), ...(antigo?.stories ?? [])].filter((x) => x.midia).map((x) => x.id));
const agora = new Date();
const desde = new Date(agora.getTime() - (antigo ? 35 : DIAS_GUARDADOS) * 86400000).toISOString(); // 1ª vez: tudo o que se guarda
const lembrar = {};
const erros = [];
const posts = [];
const stories = [];
let imagens = 0;

/** Baixa a imagem e grava uma cópia de 360 px de largura (cerca de 20 KB). Falha aqui não derruba a leitura. */
async function copiarImagem(id, url) {
  if (!url || conhecidas.has(id)) return conhecidas.has(id) ? true : null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const jpeg = await sharp(Buffer.from(await res.arrayBuffer())).resize({ width: 360, withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
    await saveMidiaInstagram(id, jpeg);
    imagens++;
    return true;
  } catch { return null; }
}

for (const conta of contas) {
  try {
    const lidos = await postsDesde(conta.id, desde, token);
    for (const m of lidos) {
      const recente = m.timestamp >= new Date(agora.getTime() - 35 * 86400000).toISOString(); // números só dos últimos 35 dias
      const numeros = recente ? await insightsDe(m.id, "post", token, lembrar) : null;
      const p = postDoGraph(m, conta, numeros);
      if (!numeros) { const velho = antigo?.posts?.find((x) => x.id === p.id); if (velho) Object.assign(p, { visualizacoes: velho.visualizacoes, alcance: velho.alcance, salvos: velho.salvos, compartilhamentos: velho.compartilhamentos, interacoes: velho.interacoes }); }
      if (await copiarImagem(m.id, imagemDe(m))) p.midia = true;
      posts.push(p);
    }
    const noAr = await storiesNoAr(conta.id, token);
    for (const s of noAr) {
      const st = storyDoGraph(s, conta, await insightsDe(s.id, "story", token, lembrar));
      if (await copiarImagem(s.id, imagemDe(s))) st.midia = true;
      stories.push(st);
    }
    console.log(`@${conta.usuario} (${conta.unidade ?? "rede"}): ${conta.seguidores ?? "?"} seguidores, ${lidos.length} posts lidos, ${noAr.length} stories no ar`);
  } catch (e) {
    erros.push({ conta: conta.usuario, erro: e.message });
    console.log(`ERRO @${conta.usuario}: ${e.message}`);
  }
}
console.log(`Métricas aceitas: post = lista ${lembrar.post ?? "-"}, story = lista ${lembrar.story ?? "-"} (0 = completa); ${imagens} imagens novas`);
if (!posts.length && !stories.length && erros.length === contas.length) throw new Error("Nada foi lido; os dados anteriores foram mantidos.");

const contasGuardadas = contas.map(({ id, usuario, nome, unidade, seguidores, posts: n, foto }) => ({ id, usuario, nome, unidade, seguidores, posts: n, foto }));
const { dados, descartados } = mesclar(antigo, { contas: contasGuardadas, posts, stories, erros }, agora);
await saveInstagram(dados);
console.log(`Gravado: instagram/dados.json (${dados.posts.length} posts, ${dados.stories.length} stories guardados)`);
if (descartados.length) { await apagarMidiasInstagram(descartados); console.log(`${descartados.length} imagens antigas apagadas`); }
