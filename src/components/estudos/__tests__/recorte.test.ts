import { describe, expect, it } from "vitest";
import { hexagono, recortarNaArea } from "@/components/estudos/mapaComum";

describe("recorte do hexágono na borda da área", () => {
  const areaDe = (lng0: number, lng1: number, lat0: number, lat1: number) => ({ type: "Polygon" as const, coordinates: [[[lng0, lat0], [lng1, lat0], [lng1, lat1], [lng0, lat1], [lng0, lat0]]] });
  const areaDoPoligono = (ps: [number, number][]) => Math.abs(ps.reduce((s, [a, b], i) => { const [c, d] = ps[(i + 1) % ps.length]; return s + a * d - c * b; }, 0) / 2);
  it("hexágono todo dentro fica inteiro; metade fora fica com metade da área; todo fora some", () => {
    const h = hexagono(0, 0, 0.2);
    const inteiro = recortarNaArea(h, areaDe(-1, 1, -1, 1));
    expect(inteiro).toHaveLength(1);
    expect(areaDoPoligono(inteiro[0])).toBeCloseTo(areaDoPoligono(h), 8);
    const metade = recortarNaArea(h, areaDe(0, 1, -1, 1)); // só o lado leste (lng ≥ 0)
    expect(areaDoPoligono(metade[0]) / areaDoPoligono(h)).toBeCloseTo(0.5, 5);
    expect(recortarNaArea(h, areaDe(2, 3, 2, 3))).toEqual([]);
  });
});
