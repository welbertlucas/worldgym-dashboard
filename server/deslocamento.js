// Área de deslocamento (isócrona) dos estudos de ponto, como no Mapfry: até onde se chega em X minutos pelas ruas, de carro ou a pé.
// Padrão do estudo (decisão do dono, 22/11/2026): 10 minutos de carro é a área oficial; 10 minutos a pé é só referência visual.
// Calculada no Mapbox (Isochrone API) pelo servidor — a chave (MAPBOX_TOKEN) nunca vai para o navegador — e guardada no Blob
// (estudos/deslocamento/...) por 180 dias: as ruas mudam devagar e a mesma área não é pedida de novo.
import { lerJson, lerJsonGuardado, gravarJson } from "./armazem.js";

export class ErroDeslocamento extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }

/** De carro: 5, 10, 15 e 20 min numa chamada só (o 10 é a área oficial; os outros medem onde moram os alunos). A pé: 10 min. */
export const CONTORNOS = { carro: { perfil: "driving", minutos: [5, 10, 15, 20] }, pe: { perfil: "walking", minutos: [10] } };
export const VALIDADE_DIAS = 180;

export const chaveDoDeslocamento = (c, modo) => `estudos/deslocamento/${modo}-${c[0].toFixed(4)}_${c[1].toFixed(4)}.json`;

/** Confere o pedido: posição no Brasil e modo conhecido. */
export function pedidoValido(p) {
  const c = Array.isArray(p?.c) ? p.c.map(Number) : [];
  if (c.length !== 2 || !c.every(Number.isFinite) || c[0] < -34 || c[0] > 6 || c[1] < -75 || c[1] > -32) throw new ErroDeslocamento("Posição inválida.");
  const modo = String(p?.modo ?? "carro");
  if (!CONTORNOS[modo]) throw new ErroDeslocamento("Modo de deslocamento desconhecido.");
  return { c, modo };
}

/** Busca (ou lê do Blob) as áreas de deslocamento. Devolve { c, modo, contornos: { [minutos]: geometria GeoJSON } }. */
export async function buscarDeslocamento(pedido, { chave = process.env.MAPBOX_TOKEN, fetcher = fetch, agora = Date.now() } = {}) {
  const { c, modo } = pedidoValido(pedido);
  const arquivo = chaveDoDeslocamento(c, modo);
  const guardado = await lerJson(arquivo);
  if (guardado && agora - Date.parse(guardado.em) < VALIDADE_DIAS * 864e5) return { ...guardado, doCache: true };
  // só o que já está guardado (a lista de estudos usa isto: ela não manda posição nenhuma ao Mapbox, só abre a área de quem já a tem)
  if (pedido?.soCache === true) return { ausente: true, c, modo };
  if (!chave) throw new ErroDeslocamento("A área de deslocamento ainda não foi configurada no servidor.", 503);
  const { perfil, minutos } = CONTORNOS[modo];
  const url = `https://api.mapbox.com/isochrone/v1/mapbox/${perfil}/${c[1]},${c[0]}?contours_minutes=${minutos.join(",")}&polygons=true&denoise=1&access_token=${encodeURIComponent(chave)}`;
  let j;
  try { j = await (await fetcher(url)).json(); } catch { throw new ErroDeslocamento("O Mapbox não respondeu agora.", 502); }
  const contornos = {};
  for (const f of j?.features ?? []) if (f?.geometry && minutos.includes(f.properties?.contour)) contornos[f.properties.contour] = f.geometry;
  if (!Object.keys(contornos).length) throw new ErroDeslocamento("O Mapbox não devolveu a área de deslocamento.", 502);
  const resultado = { em: new Date(agora).toISOString(), c, modo, contornos };
  await gravarJson(arquivo, resultado);
  return { ...resultado, doCache: false };
}

/** Minutos da área oficial dos estudos (MINUTOS_PADRAO da tela). */
export const MINUTOS_AREA = 10;
/** Quantas posições cabem num pedido de áreas guardadas (lista de estudos). */
export const MAX_AREAS_LOTE = 300;
const GUARDA_AREA_MS = 30 * 60e3;
/** A área de 10 min de carro já guardada no Blob para a posição, ainda válida; null se não há (nunca chama o Mapbox). */
export async function areaGuardada(c, agora = Date.now()) {
  const g = await lerJsonGuardado(chaveDoDeslocamento(c, "carro"), GUARDA_AREA_MS).catch(() => null);
  return g && agora - Date.parse(g.em) < VALIDADE_DIAS * 864e5 ? g.contornos?.[MINUTOS_AREA] ?? null : null;
}
/** Áreas guardadas de várias posições de uma vez, na mesma ordem (null onde não há): a lista de estudos fazia um pedido por estudo. */
export async function areasGuardadas(pedido) {
  const lista = Array.isArray(pedido?.posicoes) ? pedido.posicoes : null;
  if (!lista) throw new ErroDeslocamento("Lista de posições inválida.");
  if (lista.length > MAX_AREAS_LOTE) throw new ErroDeslocamento(`No máximo ${MAX_AREAS_LOTE} posições.`);
  return Promise.all(lista.map((p) => { try { return areaGuardada(pedidoValido({ c: p }).c); } catch { return null; } }));
}

/**
 * Busca de endereço: Google (Places Text Search, que acerta melhor endereço brasileiro) e, sem a chave do Google, Mapbox Geocoding.
 * Só Brasil, em português, com preferência pela região de `perto`. Devolve até 6 lugares { nome, endereco, c }. Sem cache: a busca é
 * digitada na hora por quem faz o estudo e o texto não é guardado.
 */
export async function buscarEndereco(pedido, { chave = process.env.MAPBOX_TOKEN, chaveGoogle = process.env.GOOGLE_PLACES_KEY, fetcher = fetch } = {}) {
  const q = String(pedido?.q ?? "").trim().slice(0, 160);
  if (q.length < 3) throw new ErroDeslocamento("Digite pelo menos 3 letras.");
  const perto = Array.isArray(pedido?.perto) && pedido.perto.length === 2 && pedido.perto.every((x) => Number.isFinite(Number(x))) ? pedido.perto.map(Number) : null;
  if (chaveGoogle) {
    let j;
    try {
      j = await (await fetcher("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": chaveGoogle, "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location" },
        body: JSON.stringify({ textQuery: q, languageCode: "pt-BR", regionCode: "BR", pageSize: 6, ...(perto ? { locationBias: { circle: { center: { latitude: perto[0], longitude: perto[1] }, radius: 50000 } } } : {}) }),
      })).json();
    } catch { throw new ErroDeslocamento("O Google não respondeu agora.", 502); }
    if (!j?.error) return { lugares: (j?.places ?? []).filter((p) => p.location).map((p) => ({ nome: p.displayName?.text ?? "", endereco: p.formattedAddress ?? "", c: [p.location.latitude, p.location.longitude] })) };
    if (!chave) throw new ErroDeslocamento("O Google não respondeu à busca agora.", 502);
  }
  if (!chave) throw new ErroDeslocamento("A busca de endereço ainda não foi configurada no servidor.", 503);
  const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}&country=br&language=pt&limit=6&autocomplete=true${perto ? `&proximity=${perto[1]},${perto[0]}` : ""}&access_token=${encodeURIComponent(chave)}`;
  let j;
  try { j = await (await fetcher(url)).json(); } catch { throw new ErroDeslocamento("O Mapbox não respondeu agora.", 502); }
  return {
    lugares: (j?.features ?? []).filter((f) => Array.isArray(f?.geometry?.coordinates)).map((f) => ({
      nome: f.properties?.name ?? "",
      endereco: f.properties?.full_address ?? f.properties?.place_formatted ?? "",
      c: [f.geometry.coordinates[1], f.geometry.coordinates[0]],
    })),
  };
}

export const MAX_ENDERECOS_LOTE = 40;
/**
 * Posição de vários endereços de uma vez (importação de imóveis por planilha). Usa a mesma busca de `buscarEndereco` e fica com o 1º resultado de
 * cada texto. Devolve { resultados: [{ i, lugar }] } na ordem do pedido; `lugar` é null quando nada foi achado ou a busca falhou naquele endereço.
 * Os textos não são guardados. A rota só atende estudos de pontos novos (fora do modo unidade).
 */
export async function geocodificarLote(pedido, deps = {}) {
  const itens = (Array.isArray(pedido?.itens) ? pedido.itens : []).slice(0, MAX_ENDERECOS_LOTE + 1);
  if (!itens.length) throw new ErroDeslocamento("Nenhum endereço para buscar.");
  if (itens.length > MAX_ENDERECOS_LOTE) throw new ErroDeslocamento(`No máximo ${MAX_ENDERECOS_LOTE} endereços por vez.`);
  const perto = pedido?.perto;
  const resultados = new Array(itens.length);
  let proximo = 0;
  const trabalhador = async () => {
    while (proximo < itens.length) {
      const k = proximo++;
      const q = String(itens[k]?.q ?? "").trim();
      try {
        const r = await buscarEndereco({ q, perto }, deps);
        resultados[k] = { i: itens[k]?.i ?? k, lugar: r.lugares[0] ?? null };
      } catch (e) {
        // sem chave configurada ou serviço fora do ar: interrompe o lote inteiro; erro só deste texto (curto demais): vira "não achei"
        if (e instanceof ErroDeslocamento && e.status >= 500) throw e;
        resultados[k] = { i: itens[k]?.i ?? k, lugar: null };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, itens.length) }, trabalhador));
  return { resultados };
}

/**
 * Endereço aproximado de uma posição (rua, bairro e cidade), para as posições sugeridas pelo Atlas (Mapbox Geocoding v6, reverso).
 * Só para quem vê estudos de pontos novos; a posição sai do servidor e o texto não é guardado.
 */
export async function enderecoDaPosicao(pedido, { chave = process.env.MAPBOX_TOKEN, fetcher = fetch } = {}) {
  const c = Array.isArray(pedido?.c) ? pedido.c.map(Number) : [];
  if (c.length !== 2 || !c.every(Number.isFinite) || c[0] < -34 || c[0] > 6 || c[1] < -75 || c[1] > -32) throw new ErroDeslocamento("Posição inválida.");
  if (!chave) throw new ErroDeslocamento("A busca de endereço ainda não foi configurada no servidor.", 503);
  const url = `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${c[1]}&latitude=${c[0]}&language=pt&limit=1&types=address,street,neighborhood,locality,place&access_token=${encodeURIComponent(chave)}`;
  let j;
  try { j = await (await fetcher(url)).json(); } catch { throw new ErroDeslocamento("O Mapbox não respondeu agora.", 502); }
  const f = j?.features?.[0]?.properties;
  return { endereco: f ? (f.full_address ?? [f.name, f.place_formatted].filter(Boolean).join(", ")) : null };
}
