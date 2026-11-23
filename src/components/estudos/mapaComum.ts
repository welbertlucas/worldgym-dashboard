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
