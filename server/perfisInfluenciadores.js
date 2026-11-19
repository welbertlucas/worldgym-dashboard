// Perfil público de cada influenciador cadastrado (seguidores e foto), lido pelo @ com o Business Discovery da Meta.
// Só funciona para contas profissionais (Business ou Creator) e públicas; para as outras, o painel avisa em vez de inventar.
// Guarda só o que o perfil já mostra a qualquer pessoa: número de seguidores, de publicações e uma foto pequena (160 px).
// A leitura roda em scripts/instagram-perfis.mjs (a cada 4 horas, junto do Instagram das unidades); aqui ficam as regras.
import { lerJson, gravarJson } from "./armazem.js";
import { graph } from "./instagram.js";

export const ARQUIVO_PERFIS = "influenciadores/perfis.json";
export const DIAS_FOTO = 7;
export const MENSAGEM_NAO_LIDO = "Perfil não lido: precisa ser uma conta profissional (Business ou Creator) e pública.";

/** Id com que a foto fica guardada junto das imagens do Instagram (nunca é só número, então não se confunde com post ou story). */
export const idDaFoto = (usuario) => `perfil-${usuario}`;

// Erros de limite de uso do Meta: passam sozinhos, então não apagam o que já se sabia do perfil.
const TEMPORARIOS = new Set([1, 2, 4, 17, 32, 341, 368, 613]);

export async function lerPerfis() {
  try { return (await lerJson(ARQUIVO_PERFIS)) ?? {}; } catch { return {}; }
}
export const gravarPerfis = (perfis) => gravarJson(ARQUIVO_PERFIS, perfis);

const falha = (e) => ({ ok: false, temporario: TEMPORARIOS.has(e.codigo), erro: MENSAGEM_NAO_LIDO, detalhe: String(e.message ?? e).slice(0, 200) });

/**
 * Lê o perfil de `usuario` pela conta `igId` (a da marca). Se o Meta recusar o campo da foto (erro 100), lê só os números
 * e avisa com `semFoto`. Devolve { ok: true, seguidores, publicacoes, fotoUrl, semFoto } ou { ok: false, temporario, erro, detalhe }.
 */
export async function lerPerfil(igId, usuario, token, g = graph) {
  const pedir = async (comFoto) => {
    const campos = `business_discovery.username(${usuario}){username,followers_count,media_count${comFoto ? ",profile_picture_url" : ""}}`;
    return (await g(`${igId}?fields=${encodeURIComponent(campos)}`, token)).business_discovery;
  };
  let bd;
  let semFoto = false;
  try {
    bd = await pedir(true);
  } catch (e) {
    if (e.codigo !== 100) return falha(e);
    try { bd = await pedir(false); semFoto = true; } catch (e2) { return falha(e2); }
  }
  if (!bd) return { ok: false, temporario: false, erro: MENSAGEM_NAO_LIDO, detalhe: "resposta sem os dados do perfil" };
  return { ok: true, seguidores: bd.followers_count ?? null, publicacoes: bd.media_count ?? null, fotoUrl: bd.profile_picture_url ?? null, semFoto };
}

/** A foto precisa ser baixada de novo? (não existe, ou a guardada tem mais de DIAS_FOTO dias) */
export function precisaDeFoto(velho, agora = new Date()) {
  if (!velho?.foto || !velho.fotoEm) return true;
  return Date.parse(velho.fotoEm) < agora.getTime() - DIAS_FOTO * 86400000;
}

/**
 * Perfil novo a partir da leitura, mantendo o que já se sabia quando a leitura falha: erro temporário repete o antigo; erro definitivo
 * guarda o aviso (e mantém a foto e os seguidores antigos, se houver). `foto`/`fotoEm`: o que ficou guardado depois desta rodada.
 */
export function perfilNovo(velho, leitura, { foto, fotoEm }, agora = new Date()) {
  if (!leitura.ok) {
    if (leitura.temporario && velho) return velho;
    return { seguidores: velho?.seguidores ?? null, publicacoes: velho?.publicacoes ?? null, foto: Boolean(velho?.foto), fotoEm: velho?.fotoEm ?? null, erro: leitura.erro, atualizadoEm: agora.toISOString() };
  }
  return { seguidores: leitura.seguidores, publicacoes: leitura.publicacoes, foto: Boolean(foto), fotoEm: fotoEm ?? null, ...(leitura.semFoto && !foto ? { semFoto: true } : {}), atualizadoEm: agora.toISOString() };
}
