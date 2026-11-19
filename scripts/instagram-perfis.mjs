// Lê o perfil público (seguidores e foto) e os posts (feed e reels) de cada influenciador cadastrado, pelo @, e grava no Blob.
// Os posts guardam quais contas da rede cada um cita na legenda ou marca na imagem (base da conferência do contrato). Só leitura.
// Roda a cada 4 horas, depois do instagram-sync (usa a conta da marca que ele já guardou). Falha aqui nunca derruba o resto.
// Uso: META_TOKEN_DFGO=... BLOB_READ_WRITE_TOKEN=... node scripts/instagram-perfis.mjs
import sharp from "sharp";
import { listarInfluenciadores } from "../server/influenciadores.js";
import { CONTAS_IG } from "../server/instagram.js";
import { gravarPerfis, idDaFoto, lerPerfil, lerPerfis, perfilNovo, precisaDeFoto } from "../server/perfisInfluenciadores.js";
import { DIAS_POSTS, gravarPostsGuardados, indexarMarcacoes, lerMarcacoes, lerPostsDoPerfil, lerPostsGuardados, montarPosts } from "../server/postsInfluenciadores.js";
import { apagarMidiasInstagram, loadInstagram, saveMidiaInstagram } from "../server/store.js";

const token = process.env.META_TOKEN_DFGO;
if (!token) { console.log("Perfis dos influenciadores desligados: sem META_TOKEN_DFGO."); process.exit(0); }

const cadastro = await listarInfluenciadores();
const usuarios = [...new Set(cadastro.filter((i) => i.ativo !== false).map((i) => i.usuario))];
const antigos = await lerPerfis();

// Quem saiu do cadastro perde o perfil e a foto guardados.
const removidos = Object.keys(antigos).filter((u) => !usuarios.includes(u));
if (removidos.length) {
  const comFoto = removidos.filter((u) => antigos[u]?.foto).map(idDaFoto);
  if (comFoto.length) await apagarMidiasInstagram(comFoto);
  console.log(`Perfis removidos (saíram do cadastro): ${removidos.map((u) => `@${u}`).join(", ")}`);
}
if (!usuarios.length) {
  if (removidos.length) { await gravarPerfis({}); await gravarPostsGuardados({}); }
  console.log("Nenhum influenciador ativo no cadastro.");
  process.exit(0);
}

// Quem consulta é a conta da marca que o instagram-sync já descobriu e guardou.
const dados = await loadInstagram();
const marca = dados?.contas?.find((c) => c.unidade === null) ?? dados?.contas?.[0];
if (!marca) { console.log("Ainda não há conta do Instagram guardada para consultar os perfis. Nada foi gravado."); process.exit(0); }

const agora = new Date();
const novos = {};
let lidos = 0, fotos = 0, falhas = 0;

// Posts que MARCAM as contas da rede (a legenda não mostra a marcação na imagem): uma leitura por conta da rede.
const handles = Object.keys(CONTAS_IG);
const porConta = {};
for (const c of dados.contas ?? []) {
  try { porConta[c.usuario] = await lerMarcacoes(c.id, token); }
  catch (e) { console.log(`Marcações em @${c.usuario} não lidas (${e.message}); vale só o que a legenda cita.`); }
}
const marcacoes = indexarMarcacoes(porConta, usuarios);
const postsAntigos = await lerPostsGuardados();
const postsNovos = {};
const desdePosts = new Date(agora.getTime() - DIAS_POSTS * 86400000).toISOString();
let semPosts = 0;
for (const usuario of usuarios) {
  const velho = antigos[usuario];
  const leitura = await lerPerfil(marca.id, usuario, token);
  let foto = Boolean(velho?.foto);
  let fotoEm = velho?.fotoEm ?? null;
  if (leitura.ok) {
    lidos++;
    if (leitura.fotoUrl && precisaDeFoto(velho, agora)) {
      try {
        const res = await fetch(leitura.fotoUrl);
        if (res.ok) {
          const jpeg = await sharp(Buffer.from(await res.arrayBuffer())).resize(160, 160, { fit: "cover" }).jpeg({ quality: 80 }).toBuffer();
          await saveMidiaInstagram(idDaFoto(usuario), jpeg);
          foto = true; fotoEm = agora.toISOString(); fotos++;
        }
      } catch (e) { console.log(`@${usuario}: foto não copiada (${e.message})`); }
    }
    console.log(`@${usuario}: ${leitura.seguidores ?? "?"} seguidores${leitura.semFoto ? " (o Meta não entrega a foto de perfil de terceiros)" : ""}${foto ? ", foto guardada" : ""}`);
    const posts = await lerPostsDoPerfil(marca.id, usuario, token, desdePosts);
    if (posts.ok) {
      const guardados = montarPosts(posts.posts, handles, marcacoes, agora);
      postsNovos[usuario] = { lidoEm: agora.toISOString(), posts: guardados };
      console.log(`  posts: ${guardados.length} nos últimos ${DIAS_POSTS} dias (${guardados.filter((x) => x.tipo === "reels").length} reels), ${guardados.filter((x) => x.citou.length).length} citam ou marcam a rede`);
    } else {
      semPosts++;
      if (postsAntigos[usuario]) postsNovos[usuario] = postsAntigos[usuario];
      console.log(`  posts não lidos${posts.temporario ? " (limite do Meta; repete na próxima rodada)" : ""} — ${posts.detalhe}`);
    }
  } else {
    falhas++;
    console.log(`@${usuario}: não lido${leitura.temporario ? " (limite do Meta; repete na próxima rodada)" : ""} — ${leitura.detalhe}`);
    if (postsAntigos[usuario]) postsNovos[usuario] = postsAntigos[usuario];
  }
  novos[usuario] = perfilNovo(velho, leitura, { foto, fotoEm }, agora);
  await new Promise((r) => setTimeout(r, 400));
}
await gravarPerfis(novos);
await gravarPostsGuardados(postsNovos);
console.log(`Perfis dos influenciadores: ${lidos} lidos, ${falhas} sem leitura, ${fotos} fotos novas. Posts: ${Object.keys(postsNovos).length} perfis guardados, ${semPosts} sem leitura de posts.`);
