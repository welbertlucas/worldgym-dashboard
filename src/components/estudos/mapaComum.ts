// Peças de mapa usadas pelas telas de estudo de ponto (estudo de ponto novo e estudo de unidade em operação).

/** Rampa quente do mapa de calor: do amarelo-claro ao vinho. */
export const RAMPA = [[255, 236, 179], [253, 186, 116], [239, 106, 70], [196, 18, 48], [122, 10, 32]];
export function rampa(t: number) {
  const x = Math.min(0.999, Math.max(0, t)) * (RAMPA.length - 1), i = Math.floor(x), f = x - i, a = RAMPA[i], b = RAMPA[i + 1];
  return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(",")})`;
}
/** Rampa de vários tons para mapas de calor suavizados (azul → verde → amarelo → laranja → vermelho), como a do GeoFusion. */
export const RAMPA_ARCO = [[43, 131, 186], [102, 194, 165], [171, 221, 164], [255, 255, 191], [253, 174, 97], [215, 25, 28]];
export const arco = (t: number) => {
  const x = Math.min(0.999, Math.max(0, t)) * (RAMPA_ARCO.length - 1), i = Math.floor(x), f = x - i, a = RAMPA_ARCO[i], b = RAMPA_ARCO[i + 1];
  return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(",")})`;
};
export const gradienteArco = `linear-gradient(90deg,${RAMPA_ARCO.map((c) => `rgb(${c})`).join(",")})`;
export const gradienteRampa = `linear-gradient(90deg,${RAMPA.map((c) => `rgb(${c})`).join(",")})`;

/** Vértices de um hexágono de raio `rk` km centrado em (lat, lng). */
export const hexagono = (lat: number, lng: number, rk: number): [number, number][] => Array.from({ length: 6 }, (_, k) => {
  const a = (Math.PI / 3) * k + Math.PI / 6;
  return [lat + (rk / 110.6) * Math.sin(a), lng + (rk / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a)];
});

/**
 * Parte do hexágono que fica dentro da área ([lat, lng] em tudo que entra e sai). Como o hexágono é convexo, recorta cada contorno externo
 * da área pelo hexágono (Sutherland–Hodgman), como o Mapfry faz na borda da área de deslocamento. Buracos da área são ignorados.
 */
export function recortarNaArea(hex: [number, number][], g: { type: "Polygon"; coordinates: number[][][] } | { type: "MultiPolygon"; coordinates: number[][][][] }): [number, number][][] {
  const clip = hex.map(([la, ln]) => [ln, la]);
  let area2 = 0;
  for (let i = 0; i < clip.length; i++) { const [x1, y1] = clip[i], [x2, y2] = clip[(i + 1) % clip.length]; area2 += x1 * y2 - x2 * y1; }
  const s = Math.sign(area2) || 1;
  const xs = clip.map((p) => p[0]), ys = clip.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const lado = (p: number[], a: number[], b: number[]) => s * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) >= 0;
  const corte = (p: number[], q: number[], a: number[], b: number[]) => {
    const d = (p[0] - q[0]) * (a[1] - b[1]) - (p[1] - q[1]) * (a[0] - b[0]);
    if (!d) return p;
    const t = ((p[0] - a[0]) * (a[1] - b[1]) - (p[1] - a[1]) * (a[0] - b[0])) / d;
    return [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
  };
  const pols = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  const out: [number, number][][] = [];
  for (const pol of pols) {
    let sub = pol[0];
    if (!sub?.length || sub.every((p) => p[0] < x0) || sub.every((p) => p[0] > x1) || sub.every((p) => p[1] < y0) || sub.every((p) => p[1] > y1)) continue;
    for (let i = 0; i < clip.length && sub.length; i++) {
      const a = clip[i], b = clip[(i + 1) % clip.length], ent = sub;
      sub = [];
      for (let j = 0; j < ent.length; j++) {
        const p = ent[j], q = ent[(j + 1) % ent.length], pIn = lado(p, a, b), qIn = lado(q, a, b);
        if (pIn) { sub.push(p); if (!qIn) sub.push(corte(p, q, a, b)); } else if (qIn) sub.push(corte(p, q, a, b));
      }
    }
    if (sub.length >= 3) out.push(sub.map(([ln, la]) => [la, ln] as [number, number]));
  }
  return out;
}

export type Leaflet = typeof import("leaflet");
export async function carregarLeaflet(): Promise<Leaflet> {
  const mod = await import("leaflet");
  return (mod as unknown as { default?: Leaflet }).default ?? (mod as Leaflet);
}

/** Bolinha simples (unidade da rede, concorrente). */
export const bolinha = (L: Leaflet, cor: string, tam: number, opacidade = 1) =>
  L.divIcon({ className: "", iconSize: [tam, tam], iconAnchor: [tam / 2, tam / 2], html: `<div style="width:${tam}px;height:${tam}px;border-radius:50%;background:${cor};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3);opacity:${opacidade}"></div>` });

/** Formato do pino de localização (viewBox 24×32, ponta embaixo no meio). */
export const PINO_D = "M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z";
/** Pino de localização (unidade estudada, ponto novo com a letra). `data-pino` deixa a foto do PDF desenhar o mesmo pino. */
/**
 * Raio (px) da bolha de um bairro: proporcional à raiz da contagem, para a ÁREA acompanhar o número de alunos. Mesma escala no estudo e na aba
 * Alunos (24/11/2026: menores, para dois bairros grandes não parecerem os únicos com alunos).
 */
export const raioDaBolha = (n: number, max: number) => 4 + 14 * Math.sqrt(n / Math.max(1, max));
/** Frase de leitura do mapa de bolhas: cada bolha é um bairro (no centro dele) e quantos % dos alunos moram nos maiores. */
export function fraseDosBairros(itens: { nome: string; n: number }[]): string {
  const v = itens.filter((i) => i.n > 0).sort((a, b) => b.n - a.n);
  const total = v.reduce((a, b) => a + b.n, 0);
  if (v.length < 2 || !total) return "Cada bolha é um bairro, desenhada no centro dele.";
  let k = 1, cum = v[0].n / total;
  while (cum < 0.8 && k < 3 && k < v.length) { cum += v[k].n / total; k++; }
  const nomes = v.slice(0, k).map((i) => i.nome.replace(/\s*\([^)]*\)/, ""));
  const lista = nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
  const resto = v.length - k;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return `Cada bolha é um bairro, desenhada no centro dele. ${pct(cum)} dos alunos moram em ${lista}${resto > 0 ? `; ${resto === 1 ? "o outro bairro soma" : `os outros ${resto} bairros somam`} ${pct(1 - cum)}` : ""}.`;
}

export function pino(L: Leaflet, cor: string, alto = 34, letra = "") {
  const w = Math.round(alto * 0.75);
  const miolo = letra
    ? `<text x="12" y="16" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="Inter,sans-serif">${letra}</text>`
    : `<circle cx="12" cy="12" r="4.4" fill="#fff"/>`;
  return L.divIcon({ className: "", iconSize: [w, alto], iconAnchor: [w / 2, alto],
    html: `<div data-pino="${cor}" data-pino-letra="${letra}" style="width:${w}px;height:${alto}px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))"><svg viewBox="0 0 24 32" width="${w}" height="${alto}" style="display:block"><path d="${PINO_D}" fill="${cor}" stroke="#fff" stroke-width="1.6"/>${miolo}</svg></div>` });
}

/** Globo da logomarca (branco, fundo transparente): em `public/`, então vale tanto no navegador quanto na foto do PDF. */
const URL_GLOBO = `${(import.meta.env.BASE_URL as string | undefined) ?? "/"}globo-wg.png`;
let contaPinos = 0;
/**
 * Pino das unidades World Gym: o mesmo alfinete com um disco branco e o globo da logomarca na cor do pino (pedido do dono, 25/11/2026).
 * `data-pino-logo` avisa a foto do PDF para desenhar o globo também.
 */
export function pinoUnidade(L: Leaflet, cor: string, alto = 34) {
  const w = Math.round(alto * 0.75), id = `pg${++contaPinos}`;
  return L.divIcon({ className: "", iconSize: [w, alto], iconAnchor: [w / 2, alto],
    html: `<div data-pino="${cor}" data-pino-letra="" data-pino-logo="1" style="width:${w}px;height:${alto}px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))"><svg viewBox="0 0 24 32" width="${w}" height="${alto}" style="display:block"><defs><mask id="${id}" maskUnits="userSpaceOnUse" x="5" y="4.5" width="14" height="14"><image href="${URL_GLOBO}" x="5" y="4.5" width="14" height="14"/></mask></defs><path d="${PINO_D}" fill="${cor}" stroke="#fff" stroke-width="1.6"/><circle cx="12" cy="11.5" r="8.2" fill="#fff"/><rect x="5" y="4.5" width="14" height="14" fill="${cor}" mask="url(#${id})"/></svg></div>` });
}
let globoPronto: Promise<HTMLImageElement | null> | null = null;
const carregarGlobo = () => (globoPronto ??= new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = URL_GLOBO; }));

/** Chave do Street View embutido (Maps Embed API). Sem ela, "Ver a rua" abre o Google Maps em outra aba. */
export const CHAVE_STREET_VIEW: string = (import.meta.env.VITE_GOOGLE_EMBED_KEY as string | undefined) ?? "";
export const urlStreetView = (c: [number, number]) =>
  CHAVE_STREET_VIEW
    ? `https://www.google.com/maps/embed/v1/streetview?key=${encodeURIComponent(CHAVE_STREET_VIEW)}&location=${c[0]},${c[1]}&fov=90&language=pt-BR`
    : `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${c[0]},${c[1]}`;

/**
 * Foto do mapa como está na tela (para o PDF): azulejos do fundo coloridos (cinza só com `cinza`), as camadas desenhadas em canvas
 * (o mapa usa preferCanvas) e os alfinetes/bolinhas. Os azulejos precisam ter vindo com crossOrigin, senão o canvas fica "sujo".
 */
export async function fotoDoMapa(mapa: import("leaflet").Map, cinza = false): Promise<string | null> {
  try {
    const globo = await carregarGlobo();
    const el = mapa.getContainer(), caixa = el.getBoundingClientRect(), esc = 2;
    const c = document.createElement("canvas");
    c.width = Math.round(caixa.width * esc); c.height = Math.round(caixa.height * esc);
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.scale(esc, esc);
    ctx.fillStyle = "#eef0f3"; ctx.fillRect(0, 0, caixa.width, caixa.height);
    const pos = (e: Element) => { const r = e.getBoundingClientRect(); return { x: r.left - caixa.left, y: r.top - caixa.top, w: r.width, h: r.height }; };
    if (cinza) ctx.filter = "grayscale(1) contrast(.9) brightness(1.06)";
    for (const img of Array.from(el.querySelectorAll<HTMLImageElement>(".leaflet-tile-pane img"))) {
      if (!img.complete || !img.naturalWidth) continue;
      const p = pos(img); ctx.drawImage(img, p.x, p.y, p.w, p.h);
    }
    ctx.filter = "none";
    for (const cv of Array.from(el.querySelectorAll<HTMLCanvasElement>(".leaflet-overlay-pane canvas"))) { const p = pos(cv); ctx.drawImage(cv, p.x, p.y, p.w, p.h); }
    for (const mk of Array.from(el.querySelectorAll<HTMLElement>(".leaflet-marker-pane .leaflet-marker-icon"))) {
      const alvo = (mk.firstElementChild as HTMLElement | null) ?? mk, p = pos(alvo);
      // pontos de interesse: número na bolinha, ou ponto + nome (só os nomes que estão visíveis na tela)
      if (alvo.dataset.poiNum) {
        const r = Math.max(9, p.w / 2), cx = p.x + p.w / 2, cy = p.y + p.h / 2;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = getComputedStyle(alvo).backgroundColor || "#1f5f8b"; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = "700 10px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(alvo.dataset.poiNum, cx, cy + 0.5);
        continue;
      }
      if (alvo.dataset.poiNome) {
        const ponto = alvo.querySelector<HTMLElement>(".poi-ponto"), nome = alvo.querySelector<HTMLElement>(".poi-nome");
        if (ponto) { const q = pos(ponto); ctx.beginPath(); ctx.arc(q.x + q.w / 2, q.y + q.h / 2, q.w / 2, 0, Math.PI * 2); ctx.fillStyle = getComputedStyle(ponto).backgroundColor; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke(); }
        if (nome && nome.style.visibility !== "hidden") {
          const q = pos(nome), est = getComputedStyle(nome);
          ctx.fillStyle = est.backgroundColor; ctx.fillRect(q.x, q.y, q.w, q.h);
          ctx.fillStyle = est.color; ctx.font = `${est.fontWeight} ${est.fontSize} Inter, sans-serif`; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(nome.textContent ?? "", q.x + 5, q.y + q.h / 2 + 0.5);
        }
        continue;
      }
      // pino de localização: o mesmo desenho, um pouco menor na foto (ponta no mesmo lugar)
      if (alvo.dataset.pino) {
        const esc2 = 0.78, w = p.w * esc2, h = p.h * esc2, x = p.x + (p.w - w) / 2, yy = p.y + p.h - h;
        ctx.save(); ctx.translate(x, yy); ctx.scale(w / 24, h / 32);
        const forma = new Path2D(PINO_D);
        ctx.fillStyle = alvo.dataset.pino; ctx.fill(forma); ctx.lineWidth = 1.6; ctx.strokeStyle = "#fff"; ctx.stroke(forma);
        if (alvo.dataset.pinoLogo && globo) {
          // disco branco e o globo na cor do pino (a imagem é branca: pinta com a cor por cima dela)
          ctx.beginPath(); ctx.arc(12, 11.5, 8.2, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
          const t = document.createElement("canvas"); t.width = t.height = 128;
          const tc = t.getContext("2d");
          if (tc) { tc.drawImage(globo, 0, 0, 128, 128); tc.globalCompositeOperation = "source-in"; tc.fillStyle = alvo.dataset.pino; tc.fillRect(0, 0, 128, 128); ctx.drawImage(t, 5, 4.5, 14, 14); }
        }
        else if (alvo.dataset.pinoLetra) { ctx.fillStyle = "#fff"; ctx.font = "700 11px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(alvo.dataset.pinoLetra, 12, 12.5); }
        else { ctx.beginPath(); ctx.arc(12, 12, 4.4, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); }
        ctx.restore();
        continue;
      }
      const cor = getComputedStyle(alvo).backgroundColor || "#c41230";
      ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + p.h / 2, Math.max(4, Math.min(p.w, p.h) / 2), 0, Math.PI * 2);
      ctx.fillStyle = cor; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke();
    }
    // créditos na faixa de baixo, centralizados (pedido do dono, 25/11/2026): a mesma frase do mapa na tela, mais a fonte do fundo
    const tiles = Array.from(el.querySelectorAll<HTMLImageElement>(".leaflet-tile-pane img")).map((i) => i.src);
    const fonte = tiles.some((u) => u.includes("World_Imagery")) ? "Imagens © Esri" : tiles.some((u) => u.includes("World_Topo")) ? "© Esri" : tiles.some((u) => u.includes("api.mapbox.com")) ? "© Mapbox © OpenStreetMap" : "© OpenStreetMap";
    const texto = `${CREDITO_DO_MAPA} | ${fonte}`, fs = Math.max(11, Math.round(caixa.width / 50));
    ctx.font = `600 ${fs}px Inter, Arial, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const larg = Math.min(caixa.width - 8, ctx.measureText(texto).width + fs * 1.4), alto = fs * 1.9;
    ctx.fillStyle = "rgba(255,255,255,0.82)"; ctx.fillRect((caixa.width - larg) / 2, caixa.height - alto, larg, alto);
    ctx.fillStyle = "#1b2130"; ctx.fillText(texto, caixa.width / 2, caixa.height - alto / 2 + 0.5, larg - fs);
    return c.toDataURL("image/jpeg", 0.85);
  } catch { return null; }
}

/** Frase de créditos dos mapas dos Estudos de ponto (tela e fotos do PDF). */
export const CREDITO_DO_MAPA = "Desenvolvido por Flag Holding LTDA - WG Master Franchise Brasil";

export const pausa = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));
type MapaBase = { mapa: import("leaflet").Map; ruas: import("leaflet").TileLayer; sat: import("leaflet").TileLayer };

/** Fundos do mapa (como no Mapfry): padrão (ruas coloridas, também no PDF), cinza e satélite. */
export type Fundo = "padrao" | "cinza" | "satelite";
/** Token PÚBLICO do Mapbox (feito para ir no navegador); sem ele os fundos Mapbox não aparecem. */
export const TOKEN_MAPBOX: string = (import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined) ?? "";
const mb = (estilo: string, lado: number) => `https://api.mapbox.com/styles/v1/mapbox/${estilo}/tiles/${lado}/{z}/{x}/{y}${lado === 512 ? "@2x" : ""}?access_token=${TOKEN_MAPBOX}`;
export const URL_MB_RUAS = mb("streets-v12", 512), URL_MB_CLARO = mb("light-v11", 512);
/** Miniaturas dos fundos Mapbox (azulejos de 256, com o mesmo {z}/{x}/{y} dos outros). */
export const URL_MB_RUAS_MINI = mb("streets-v12", 256), URL_MB_CLARO_MINI = mb("light-v11", 256);
/** Troca o endereço dos azulejos; os do Mapbox são de 512 px (zoom deslocado em 1). */
export function definirUrl(camada: import("leaflet").TileLayer, url: string) {
  const o = camada.options as { tileSize?: number; zoomOffset?: number };
  const grande = url.includes("api.mapbox.com") && url.includes("/512/");
  o.tileSize = grande ? 512 : 256; o.zoomOffset = grande ? -1 : 0;
  // crédito do fundo na faixa do mapa (o Mapbox exige o dele)
  const a = camada.options as { attribution?: string }, novo = creditoDoFundo(url), ctl = (camada as unknown as { _map?: { attributionControl?: { removeAttribution(t: string): void; addAttribution(t: string): void } } })._map?.attributionControl;
  if (ctl && a.attribution !== novo) { if (a.attribution) ctl.removeAttribution(a.attribution); ctl.addAttribution(novo); }
  a.attribution = novo;
  camada.setUrl(url);
}
export const creditoDoFundo = (url: string) => (url.includes("api.mapbox.com") ? "© Mapbox © OpenStreetMap" : url.includes("World_Topo") ? "© Esri" : "© OpenStreetMap");
export const URL_OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
/** Fundos de cada opção: com o token do Mapbox, Streets (padrão) e Light (cinza); sem ele, o jeito antigo (OpenStreetMap, filtro cinza e Esri). */
export const URL_PADRAO = TOKEN_MAPBOX ? URL_MB_RUAS : URL_OSM;
export const URL_CINZA = TOKEN_MAPBOX ? URL_MB_CLARO : URL_OSM;
/** Camada de ruas do mapa: já nasce no fundo padrão (azulejos de 512 px no caso do Mapbox). */
export function camadaRuas(L: Leaflet) {
  return L.tileLayer(URL_PADRAO, { maxZoom: 19, attribution: creditoDoFundo(URL_PADRAO), crossOrigin: "anonymous", ...(TOKEN_MAPBOX ? { tileSize: 512, zoomOffset: -1 } : {}) });
}
export const URL_SAT = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const urlDe = (c: import("leaflet").TileLayer) => (c as unknown as { _url: string })._url;
/** Troca o fundo: satélite usa a camada `sat`; os outros, a camada `ruas` com o endereço certo (cinza = filtro por cima). */
export function aplicarFundo(m: MapaBase, fundo: Fundo) {
  if (fundo === "satelite") { m.mapa.removeLayer(m.ruas); if (!m.mapa.hasLayer(m.sat)) m.sat.addTo(m.mapa); }
  else {
    m.mapa.removeLayer(m.sat);
    const url = fundo === "cinza" ? URL_CINZA : URL_PADRAO;
    if (urlDe(m.ruas) !== url) definirUrl(m.ruas, url);
    if (!m.mapa.hasLayer(m.ruas)) m.ruas.addTo(m.mapa);
  }
  m.mapa.getContainer().classList.toggle("mapa-cinza", fundo === "cinza" && !TOKEN_MAPBOX);
}

/** Espera os azulejos do fundo carregarem (no máximo `ms`). */
async function esperarAzulejos(m: MapaBase, ms = 5000) {
  await pausa(160);
  const camada = m.mapa.hasLayer(m.sat) ? m.sat : m.ruas;
  if (!(camada as unknown as { isLoading?: () => boolean }).isLoading?.()) return pausa(80);
  await new Promise<void>((ok) => { const t = setTimeout(ok, ms); camada.once("load", () => { clearTimeout(t); ok(); }); });
  await pausa(120);
}

/**
 * Foto do mapa para o PDF num enquadramento fixo (o mesmo para todo mundo, não importa o zoom da tela): leva o mapa até `alvo`,
 * troca o fundo (ruas cinza ou satélite), espera carregar, fotografa e devolve tudo como estava.
 */
/** Lado, em pixels, das fotos de mapa do PDF (quadradas). */
export const LADO_FOTO = 900;
export async function fotoEnquadrada(m: MapaBase, alvo: { centro: [number, number]; zoom: number } | { limites: import("leaflet").LatLngBounds }, satelite = false): Promise<string | null> {
  const centro = m.mapa.getCenter(), zoom = m.mapa.getZoom();
  const tinhaSat = m.mapa.hasLayer(m.sat), tinhaRuas = m.mapa.hasLayer(m.ruas);
  // o PDF sai sempre com as ruas do mapa padrão (colorido), qualquer que seja o fundo escolhido na tela
  const urlAntes = urlDe(m.ruas);
  if (!satelite && urlAntes !== URL_PADRAO) definirUrl(m.ruas, URL_PADRAO);
  // foto QUADRADA (como nos estudos do Mapfry), do mesmo tamanho em todos os mapas: o mapa vira um quadrado de LADO_FOTO só durante a foto,
  // e a área enche o quadro (o enquadramento fica igual em todos os temas, sem sobrar mapa dos lados)
  const caixa = m.mapa.getContainer(), estiloAntes = caixa.getAttribute("style") ?? "";
  caixa.style.width = `${LADO_FOTO}px`; caixa.style.height = `${LADO_FOTO}px`; caixa.style.right = "auto"; caixa.style.bottom = "auto";
  m.mapa.invalidateSize({ animate: false });
  try {
    if (satelite) { if (tinhaRuas) m.mapa.removeLayer(m.ruas); if (!tinhaSat) m.sat.addTo(m.mapa); }
    else { if (tinhaSat) m.mapa.removeLayer(m.sat); if (!tinhaRuas) m.ruas.addTo(m.mapa); }
    // zoom fracionado só para a foto: com zoom inteiro o enquadramento sobra muito em volta da área
    const snap = m.mapa.options.zoomSnap;
    m.mapa.options.zoomSnap = 0.1;
    if ("limites" in alvo) m.mapa.fitBounds(alvo.limites, { animate: false, padding: [14, 14] });
    else m.mapa.setView(alvo.centro, alvo.zoom, { animate: false });
    m.mapa.options.zoomSnap = snap;
    await esperarAzulejos(m);
    return await fotoDoMapa(m.mapa); // fundo padrão (colorido), como na tela (pedido do dono, 23/11/2026)
  } finally {
    if (m.mapa.hasLayer(m.sat) !== tinhaSat) { if (tinhaSat) m.sat.addTo(m.mapa); else m.mapa.removeLayer(m.sat); }
    if (m.mapa.hasLayer(m.ruas) !== tinhaRuas) { if (tinhaRuas) m.ruas.addTo(m.mapa); else m.mapa.removeLayer(m.ruas); }
    if (urlDe(m.ruas) !== urlAntes) definirUrl(m.ruas, urlAntes);
    caixa.setAttribute("style", estiloAntes);
    m.mapa.invalidateSize({ animate: false });
    m.mapa.setView(centro, zoom, { animate: false });
  }
}

/**
 * Foto do mapa como está enquadrado na tela, mas sempre no fundo padrão (decisão do dono, 23/11/2026: o PDF sai no padrão, qualquer que
 * seja o fundo escolhido na tela). Troca o fundo só durante a foto e devolve o que a pessoa tinha marcado.
 */
export async function fotoNoPadrao(m: MapaBase, fundoDaTela: Fundo): Promise<string | null> {
  if (fundoDaTela === "padrao") return fotoDoMapa(m.mapa);
  aplicarFundo(m, "padrao");
  try { await esperarAzulejos(m); return await fotoDoMapa(m.mapa); }
  finally { aplicarFundo(m, fundoDaTela); }
}

/** Copia um texto: a área de transferência do navegador e, se ela recusar, o jeito antigo (seleção + copiar). */
export async function copiarTexto(texto: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(texto); return true; } catch { /* tenta o jeito antigo */ }
  const ta = document.createElement("textarea");
  ta.value = texto; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { return document.execCommand("copy"); } catch { return false; } finally { ta.remove(); }
}

/**
 * Cartão do pino (como no Mapfry), dos pontos estudados e das unidades em operação: nome, endereço e coordenadas; clicar no endereço ou
 * nas coordenadas copia o texto. Montado com elementos (não com HTML em texto), para o nome e o endereço nunca virarem código.
 */
/** Botão no cartão do pino (ex.: "Apagar este ponto"). `perigo` pinta de vermelho. */
export interface AcaoDoCartao { rotulo: string; aoClicar: () => void; perigo?: boolean }

export function cartaoDoLugar(titulo: string, c: [number, number], endereco: string | null | undefined, semEndereco: string, nota?: string, acoes: AcaoDoCartao[] = []): HTMLElement {
  const el = (tag: string, cls: string, texto?: string) => { const e = document.createElement(tag); e.className = cls; if (texto != null) e.textContent = texto; return e; };
  const caixa = el("div", "space-y-2 text-[13px] text-foreground");
  caixa.appendChild(el("p", "font-semibold", titulo));
  const copiavel = (rotulo: string, texto: string) => {
    const b = el("button", "flex w-full items-start gap-2 rounded-md px-1 py-0.5 text-left hover:bg-muted") as HTMLButtonElement;
    b.type = "button"; b.title = `Clique para copiar ${rotulo}`;
    const t = el("span", "min-w-0 flex-1 break-words", texto), aviso = el("span", "flex-none text-[11px] text-muted-foreground", "copiar");
    b.append(t, aviso);
    b.onclick = async () => {
      aviso.textContent = (await copiarTexto(texto)) ? "copiado ✓" : "não copiou";
      setTimeout(() => { aviso.textContent = "copiar"; }, 1600);
    };
    return b;
  };
  if (endereco) caixa.appendChild(copiavel("o endereço", endereco));
  else caixa.appendChild(el("p", "text-muted-foreground", semEndereco));
  caixa.appendChild(copiavel("as coordenadas", `${c[0].toFixed(6)}, ${c[1].toFixed(6)}`));
  if (nota) caixa.appendChild(el("p", "text-[11px] text-muted-foreground", nota));
  if (acoes.length) {
    const linha = el("div", "flex flex-wrap gap-2 border-t pt-2");
    for (const a of acoes) {
      const b = el("button", `rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted ${a.perigo ? "border-red-200 text-red-700 hover:bg-red-50" : ""}`, a.rotulo) as HTMLButtonElement;
      b.type = "button";
      b.onclick = (e) => { e.stopPropagation(); a.aoClicar(); };
      linha.appendChild(b);
    }
    caixa.appendChild(linha);
  }
  return caixa;
}

/**
 * Lê coordenadas digitadas na busca ("-12.255347, -38.976201", "-12.255347 -38.976201" ou com vírgula decimal: "-12,255347; -38,976201").
 * Sempre latitude primeiro, como o Google Maps copia. Devolve null se não for um par válido (latitude entre -90 e 90, longitude entre -180 e 180).
 */
export function lerCoordenadas(texto: string): [number, number] | null {
  const t = texto.trim();
  const num = "(-?\\d{1,3}[.,]\\d+)"; // com casas decimais: "10, 20" sozinho pode ser pedaço de endereço
  // ponto decimal: separados por vírgula, ponto e vírgula ou espaço; vírgula decimal: separados por ponto e vírgula ou espaço
  const m = t.match(new RegExp(`^${num.replace("[.,]", "\\.")}\\s*[,;\\s]\\s*${num.replace("[.,]", "\\.")}$`))
    ?? t.match(new RegExp(`^${num}\\s*(?:;|\\s)\\s*${num}$`));
  if (!m) return null;
  const lat = Number(m[1].replace(",", ".")), lng = Number(m[2].replace(",", "."));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return [lat, lng];
}

/** Coordenadas no formato da busca e do cartão do pino: "-12.255347, -38.976201". */
export const textoDasCoordenadas = (c: [number, number]) => `${c[0].toFixed(6)}, ${c[1].toFixed(6)}`;

/**
 * O aviso cinza liso "Map data not yet available" que o Esri devolve onde não tem imagem de satélite naquele zoom (visto em Jataí-GO,
 * em 24/11/2026: zoom 18 sem imagem, 17 com). Medido nas telhas: o aviso tem quase nenhuma variação de brilho (desvio 4) e nenhuma cor;
 * imagem de verdade tem desvio de 35 a 70 e alguma cor.
 */
export const ehAvisoSemImagem = (desvio: number, saturacao: number) => desvio < 12 && saturacao < 0.03;

/** A foto (data URL) é só o aviso cinza do Esri? Em caso de dúvida (imagem não abre), devolve false. */
export async function fotoSemImagem(dataUrl: string | null): Promise<boolean> {
  if (!dataUrl || typeof document === "undefined") return false;
  try {
    const img = new Image();
    await new Promise<void>((ok, falha) => { img.onload = () => ok(); img.onerror = () => falha(new Error("imagem")); img.src = dataUrl; });
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const x = c.getContext("2d");
    if (!x) return false;
    x.drawImage(img, 0, 0, 64, 64);
    const d = x.getImageData(0, 0, 64, 64).data;
    let soma = 0, soma2 = 0, cor = 0; const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      soma += l; soma2 += l * l;
      cor += (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2])) / 255;
    }
    const media = soma / n;
    return ehAvisoSemImagem(Math.sqrt(Math.max(0, soma2 / n - media * media)), cor / n);
  } catch { return false; }
}

/**
 * Foto de satélite o mais perto possível: tenta os zooms em ordem (18, 17, 16) e fica com o primeiro em que o Esri tem imagem. Cidades
 * menores só têm imagem até o zoom 17. Sem imagem em nenhum, devolve null (o PDF sai sem a foto, e não com um quadrado cinza).
 */
export async function primeiraComImagem(zooms: number[], tirar: (zoom: number) => Promise<string | null>): Promise<string | null> {
  for (const z of zooms) {
    const f = await tirar(z);
    if (f && !(await fotoSemImagem(f))) return f;
  }
  return null;
}
export const ZOOMS_DO_SATELITE = [19, 18, 17, 16];
