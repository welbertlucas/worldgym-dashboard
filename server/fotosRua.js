// Fotos de rua dos estudos de ponto (último slide do PDF, pedido do dono em 23/11/2026): Google Street View Static.
// 1) metadados (gratuitos no Google): acha a foto de rua mais próxima do lugar, a posição dela e a data;
// 2) quatro fotos dessa mesma posição: de frente para o lugar (a direção vem da posição da foto até o lugar), para os dois lados da rua
//    e para o outro lado. Custo: o Street View Static tem cota grátis mensal; o dono põe um limite diário na API para nunca passar dela.
// As fotos não são guardadas (regra do Google): o servidor busca na hora de exportar e devolve direto ao navegador.
// A chave do servidor (GOOGLE_PLACES_KEY, a mesma dos concorrentes) nunca vai para o navegador.

import { gravarJson, lerJson } from "./armazem.js";

/**
 * Trava de custo no próprio Atlas (o Google não deixa mudar a cota desta conta, 23/11/2026): no máximo LIMITE_FOTOS_MES fotos por mês,
 * metade da cota grátis do Street View Static (10 mil). Passando disso, o PDF sai sem o slide até o mês virar. Só a contagem fica no Blob.
 */
export const LIMITE_FOTOS_MES = 5000;
const chaveDoUso = (agora) => `estudos/fotos-rua/uso-${new Date(agora).toISOString().slice(0, 7)}.json`;

export class ErroFotosRua extends Error {
  constructor(mensagem, status = 400) { super(mensagem); this.status = status; }
}

const rad = (g) => (g * Math.PI) / 180;
/** Distância em metros entre dois pontos [lat, lng]. */
export function metros(a, b) {
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}
/** Direção (graus, 0 = norte, sentido horário) de `de` até `para`. */
export function rumo(de, para) {
  const y = Math.sin(rad(para[1] - de[1])) * Math.cos(rad(para[0]));
  const x = Math.cos(rad(de[0])) * Math.sin(rad(para[0])) - Math.sin(rad(de[0])) * Math.cos(rad(para[0])) * Math.cos(rad(para[1] - de[1]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
/** Foto oficial do Google ("© Google" ou "© 2024 Google"), e não de usuário (que vem com o nome de quem publicou). */
export const ehDoGoogle = (copyright) => typeof copyright === "string" && /^©\s*(\d{4}\s+)?Google$/i.test(copyright.trim());
const norm = (g) => Math.round(((g % 360) + 360) % 360);

/** Vistas pedidas a partir da posição da foto: de frente para o lugar, os dois lados da rua e o outro lado. */
export function vistas(direcao, distanciaM = 20) {
  // de frente: o campo de visão fecha com a distância, para o lugar ocupar o quadro (uns 36 m de largura na altura dele), entre 30° e 80°
  const fov = Math.round(Math.min(80, Math.max(30, (2 * Math.atan(18 / Math.max(1, distanciaM)) * 180) / Math.PI)));
  return [
    { rotulo: "De frente para o lugar", heading: norm(direcao), fov },
    { rotulo: "Rua, para um lado", heading: norm(direcao + 90), fov: 90 },
    { rotulo: "Rua, para o outro lado", heading: norm(direcao - 90), fov: 90 },
    { rotulo: "Do outro lado da rua", heading: norm(direcao + 180), fov: 90 },
  ];
}

/**
 * Busca as fotos de rua em volta de `c` ([lat, lng]). Devolve { fotos: [{ rotulo, dados (data URL JPEG) }], data ("AAAA-MM" ou null),
 * distanciaM (da foto ao lugar), motivo } — `motivo` explica quando não há fotos: "sem-imagem" (não há Street View perto) ou
 * "indisponivel" (API desligada, chave sem permissão ou limite do dia atingido).
 */
export async function fotosDaRua(pedido, { chave = process.env.GOOGLE_PLACES_KEY, fetcher = fetch, agora = Date.now(), limite = LIMITE_FOTOS_MES } = {}) {
  const c = Array.isArray(pedido?.c) ? pedido.c.map(Number) : [];
  if (c.length !== 2 || !c.every(Number.isFinite) || Math.abs(c[0]) > 90 || Math.abs(c[1]) > 180) throw new ErroFotosRua("Posição inválida.");
  if (!chave) throw new ErroFotosRua("As fotos de rua ainda não foram configuradas no servidor.", 503);
  const base = "https://maps.googleapis.com/maps/api/streetview";
  // Só fotos oficiais do Google (carro do Street View): a mais próxima pode ser um panorama de usuário, por exemplo dentro de um shopping
  // (visto na Gama em 23/11/2026). Consulta o lugar e dois anéis em volta (25 m e 60 m, 8 direções) e fica com a foto oficial MAIS PERTO
  // do lugar (pedido do dono: o mais perto possível e de frente). Os metadados não são cobrados.
  const pontos = [[0, 0], ...[25, 60].flatMap((r) => [0, 45, 90, 135, 180, 225, 270, 315].map((g) => [r * Math.cos(rad(g)), r * Math.sin(rad(g))]))]
    .map(([dn, de]) => [c[0] + dn / 111195, c[1] + de / (111195 * Math.cos(rad(c[0])))]);
  const metas = await Promise.all(pontos.map(async (p) => {
    try { return await (await fetcher(`${base}/metadata?location=${p[0]},${p[1]}&radius=120&source=outdoor&key=${encodeURIComponent(chave)}`)).json(); } catch { return {}; }
  }));
  const negado = metas.some((m) => m?.status && !["OK", "ZERO_RESULTS", "NOT_FOUND"].includes(m.status));
  let meta = null, menor = Infinity;
  for (const m of metas) {
    if (m?.status !== "OK" || !m.pano_id || !ehDoGoogle(m.copyright)) continue;
    const d = metros([Number(m.location?.lat), Number(m.location?.lng)], c);
    if (Number.isFinite(d) && d < menor) { menor = d; meta = m; }
  }
  if (!meta) return { fotos: [], data: null, distanciaM: null, motivo: negado ? "indisponivel" : "sem-imagem" };
  // trava do mês: confere antes de pedir as fotos (as 4 vistas) e soma depois
  const caminhoUso = chaveDoUso(agora);
  const uso = Number((await lerJson(caminhoUso).catch(() => null))?.fotos) || 0;
  if (uso + 4 > limite) return { fotos: [], data: null, distanciaM: null, motivo: "limite" };
  const pano = [Number(meta.location?.lat), Number(meta.location?.lng)];
  const distanciaM = pano.every(Number.isFinite) ? Math.round(metros(pano, c)) : null;
  // foto em cima do lugar (menos de 8 m): não dá para saber a frente; usa o norte
  const direcao = distanciaM != null && distanciaM >= 8 ? rumo(pano, c) : 0;
  const fotos = [];
  for (const v of vistas(direcao, distanciaM ?? 20)) {
    const r = await fetcher(`${base}?size=640x400&pano=${encodeURIComponent(meta.pano_id)}&heading=${v.heading}&fov=${v.fov}&pitch=3&return_error_code=true&key=${encodeURIComponent(chave)}`);
    if (!r.ok) { if (!fotos.length) return { fotos: [], data: null, distanciaM, motivo: "indisponivel" }; break; }
    const buf = Buffer.from(await r.arrayBuffer());
    fotos.push({ rotulo: v.rotulo, dados: `data:image/jpeg;base64,${buf.toString("base64")}` });
  }
  if (fotos.length) await gravarJson(caminhoUso, { fotos: uso + fotos.length }).catch(() => {});
  return { fotos, data: typeof meta.date === "string" ? meta.date : null, distanciaM, motivo: fotos.length ? null : "indisponivel" };
}
