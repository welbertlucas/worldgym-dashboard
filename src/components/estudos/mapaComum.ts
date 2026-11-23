// Peças de mapa usadas pelas telas de estudo de ponto (estudo de ponto novo e estudo de unidade em operação).

/** Rampa quente do mapa de calor: do amarelo-claro ao vinho. */
export const RAMPA = [[255, 236, 179], [253, 186, 116], [239, 106, 70], [196, 18, 48], [122, 10, 32]];
export function rampa(t: number) {
  const x = Math.min(0.999, Math.max(0, t)) * (RAMPA.length - 1), i = Math.floor(x), f = x - i, a = RAMPA[i], b = RAMPA[i + 1];
  return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(",")})`;
}
export const gradienteRampa = `linear-gradient(90deg,${RAMPA.map((c) => `rgb(${c})`).join(",")})`;

/** Vértices de um hexágono de raio `rk` km centrado em (lat, lng). */
export const hexagono = (lat: number, lng: number, rk: number): [number, number][] => Array.from({ length: 6 }, (_, k) => {
  const a = (Math.PI / 3) * k + Math.PI / 6;
  return [lat + (rk / 110.6) * Math.sin(a), lng + (rk / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a)];
});

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
export function pino(L: Leaflet, cor: string, alto = 34, letra = "") {
  const w = Math.round(alto * 0.75);
  const miolo = letra
    ? `<text x="12" y="16" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="Inter,sans-serif">${letra}</text>`
    : `<circle cx="12" cy="12" r="4.4" fill="#fff"/>`;
  return L.divIcon({ className: "", iconSize: [w, alto], iconAnchor: [w / 2, alto],
    html: `<div data-pino="${cor}" data-pino-letra="${letra}" style="width:${w}px;height:${alto}px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))"><svg viewBox="0 0 24 32" width="${w}" height="${alto}" style="display:block"><path d="${PINO_D}" fill="${cor}" stroke="#fff" stroke-width="1.6"/>${miolo}</svg></div>` });
}

/** Chave do Street View embutido (Maps Embed API). Sem ela, "Ver a rua" abre o Google Maps em outra aba. */
export const CHAVE_STREET_VIEW: string = (import.meta.env.VITE_GOOGLE_EMBED_KEY as string | undefined) ?? "";
export const urlStreetView = (c: [number, number]) =>
  CHAVE_STREET_VIEW
    ? `https://www.google.com/maps/embed/v1/streetview?key=${encodeURIComponent(CHAVE_STREET_VIEW)}&location=${c[0]},${c[1]}&fov=90&language=pt-BR`
    : `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${c[0]},${c[1]}`;

/**
 * Foto do mapa como está na tela (para o PDF): azulejos do fundo em tons de cinza, as camadas desenhadas em canvas
 * (o mapa usa preferCanvas) e os alfinetes/bolinhas. Os azulejos precisam ter vindo com crossOrigin, senão o canvas fica "sujo".
 */
export async function fotoDoMapa(mapa: import("leaflet").Map, cinza = true): Promise<string | null> {
  try {
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
        if (alvo.dataset.pinoLetra) { ctx.fillStyle = "#fff"; ctx.font = "700 11px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(alvo.dataset.pinoLetra, 12, 12.5); }
        else { ctx.beginPath(); ctx.arc(12, 12, 4.4, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); }
        ctx.restore();
        continue;
      }
      const cor = getComputedStyle(alvo).backgroundColor || "#c41230";
      ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + p.h / 2, Math.max(4, Math.min(p.w, p.h) / 2), 0, Math.PI * 2);
      ctx.fillStyle = cor; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke();
    }
    return c.toDataURL("image/jpeg", 0.85);
  } catch { return null; }
}

export const pausa = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));
type MapaBase = { mapa: import("leaflet").Map; ruas: import("leaflet").TileLayer; sat: import("leaflet").TileLayer };

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
export async function fotoEnquadrada(m: MapaBase, alvo: { centro: [number, number]; zoom: number } | { limites: import("leaflet").LatLngBounds }, satelite = false): Promise<string | null> {
  const centro = m.mapa.getCenter(), zoom = m.mapa.getZoom();
  const tinhaSat = m.mapa.hasLayer(m.sat), tinhaRuas = m.mapa.hasLayer(m.ruas);
  try {
    if (satelite) { if (tinhaRuas) m.mapa.removeLayer(m.ruas); if (!tinhaSat) m.sat.addTo(m.mapa); }
    else { if (tinhaSat) m.mapa.removeLayer(m.sat); if (!tinhaRuas) m.ruas.addTo(m.mapa); }
    if ("limites" in alvo) m.mapa.fitBounds(alvo.limites, { animate: false, padding: [12, 12] });
    else m.mapa.setView(alvo.centro, alvo.zoom, { animate: false });
    await esperarAzulejos(m);
    return await fotoDoMapa(m.mapa, !satelite);
  } finally {
    if (m.mapa.hasLayer(m.sat) !== tinhaSat) { if (tinhaSat) m.sat.addTo(m.mapa); else m.mapa.removeLayer(m.sat); }
    if (m.mapa.hasLayer(m.ruas) !== tinhaRuas) { if (tinhaRuas) m.ruas.addTo(m.mapa); else m.mapa.removeLayer(m.ruas); }
    m.mapa.setView(centro, zoom, { animate: false });
  }
}
