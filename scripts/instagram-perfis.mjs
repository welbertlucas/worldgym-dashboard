// Lê o perfil público (seguidores e foto) de cada influenciador cadastrado, pelo @, e grava no Blob. Só leitura no Instagram.
// Roda a cada 4 horas, depois do instagram-sync (usa a conta da marca que ele já guardou). Falha aqui nunca derruba o resto.
// Uso: META_TOKEN_DFGO=... BLOB_READ_WRITE_TOKEN=... node scripts/instagram-perfis.mjs
import sharp from "sharp";
import { listarInfluenciadores } from "../server/influenciadores.js";
import { gravarPerfis, idDaFoto, lerPerfil, lerPerfis, perfilNovo, precisaDeFoto } from "../server/perfisInfluenciadores.js";
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
  if (removidos.length) await gravarPerfis({});
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
  } else {
    falhas++;
    console.log(`@${usuario}: não lido${leitura.temporario ? " (limite do Meta; repete na próxima rodada)" : ""} — ${leitura.detalhe}`);
  }
  novos[usuario] = perfilNovo(velho, leitura, { foto, fotoEm }, agora);
  await new Promise((r) => setTimeout(r, 400));
}
await gravarPerfis(novos);
console.log(`Perfis dos influenciadores: ${lidos} lidos, ${falhas} sem leitura, ${fotos} fotos novas.`);
