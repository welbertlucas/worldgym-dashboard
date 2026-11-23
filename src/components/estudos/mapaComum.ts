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
      const cor = getComputedStyle(alvo).backgroundColor || "#c41230";
      ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + p.h / 2, Math.max(4, Math.min(p.w, p.h) / 2), 0, Math.PI * 2);
      ctx.fillStyle = cor; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke();
    }
    return c.toDataURL("image/jpeg", 0.85);
  } catch { return null; }
}
