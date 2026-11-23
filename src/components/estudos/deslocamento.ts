// Área de deslocamento no mapa dos estudos (como no Mapfry): contorno verde-azulado de 10 minutos de carro, a área oficial do estudo.
// (O contorno a pé foi tirado do mapa em 22/11/2026: dois contornos confundiam a leitura.) As áreas vêm do servidor (Mapbox, Blob).
import { useEffect, useState } from "react";
import { API_BASE, authFetch } from "@/lib/auth";
import type { Leaflet } from "@/components/estudos/mapaComum";
import { MINUTOS_PADRAO, moradoresNaArea, type Censo, type Deslocamento, type Geometria, type Modelo, type RefPopulacao, type UnidadeEstudo } from "@/lib/estudoPonto";

export const COR_DESLOCAMENTO = "#0f8a8a";
const guardados = new Map<string, Promise<Deslocamento>>();
let avisado = false;

export async function buscarDeslocamento(c: [number, number], modo: "carro" | "pe"): Promise<Deslocamento> {
  const k = `${modo}:${c[0].toFixed(4)},${c[1].toFixed(4)}`;
  if (!guardados.has(k)) {
    guardados.set(k, (async () => {
      const r = await authFetch(`${API_BASE}/estudos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "deslocamento", c, modo }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Não consegui calcular a área de deslocamento agora.");
      return j as Deslocamento;
    })().catch((e) => { guardados.delete(k); throw e; }));
  }
  return guardados.get(k)!;
}

export interface Areas { carro: Deslocamento | null; pe: Deslocamento | null; erro: string }
/** A área oficial (10 min de carro) dentro das áreas carregadas. */
export const areaOficial = (a: Areas | null): Geometria | null => a?.carro?.contornos[String(MINUTOS_PADRAO)] ?? null;

/**
 * Carrega as áreas de carro e a pé de um lugar. `aviso`: pontos novos são estratégia comercial, então pergunta uma vez por sessão
 * antes de mandar a posição ao Mapbox (unidades em operação têm endereço público e não perguntam).
 */
export function useDeslocamento(c: [number, number] | null | undefined, aviso: boolean): Areas | null {
  const [areas, setAreas] = useState<Areas | null>(null);
  const k = c ? `${c[0].toFixed(5)},${c[1].toFixed(5)}` : "";
  useEffect(() => {
    setAreas(null);
    if (!c) return;
    if (aviso && !avisado) {
      if (typeof window === "undefined" || !window.confirm("Para desenhar a área de 10 minutos de carro, a posição dos pontos estudados será enviada ao Mapbox. Continuar?")) {
        setAreas({ carro: null, pe: null, erro: "Área de deslocamento não calculada (posição não enviada)." });
        return;
      }
      avisado = true;
    }
    let vivo = true;
    buscarDeslocamento(c, "carro").then(
      (car) => vivo && setAreas({ carro: car, pe: null, erro: "" }),
      (e) => vivo && setAreas({ carro: null, pe: null, erro: (e as Error).message }),
    );
    return () => { vivo = false; };
  }, [k, aviso]); // eslint-disable-line react-hooks/exhaustive-deps
  return areas;
}

const anel = (r: number[][]) => r.map(([lng, lat]) => [lat, lng] as [number, number]);
const comoLeaflet = (g: Geometria): [number, number][][][] => (g.type === "Polygon" ? [g.coordinates.map(anel)] : g.coordinates.map((p) => p.map(anel)));

/** Desenha o contorno da área de 10 min de carro no grupo de camadas. */
export function desenharDeslocamento(L: Leaflet, grupo: import("leaflet").LayerGroup, areas: Areas | null) {
  const carro = areaOficial(areas);
  if (carro) L.polygon(comoLeaflet(carro), { color: COR_DESLOCAMENTO, weight: 1.4, opacity: 0.95, fill: false, interactive: false }).addTo(grupo);
}

/** Limites da área (para enquadrar a foto do PDF). */
export function limitesDaArea(L: Leaflet, g: Geometria) {
  return L.polygon(comoLeaflet(g)).getBounds();
}

/** Raio (km) do círculo que cobre a área, para a busca do Google (limitado a 5 km). */
export function raioQueCobre(c: [number, number], g: Geometria) {
  const pols = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  let mx = 0;
  for (const p of pols) for (const [lng, lat] of p[0]) mx = Math.max(mx, Math.hypot((lat - c[0]) * 110.6, (lng - c[1]) * 111.32 * Math.cos((c[0] * Math.PI) / 180)));
  return Math.min(5, Math.ceil((mx + 0.1) * 10) / 10);
}

/** Legenda curta do contorno. */
export const LEGENDA_DESLOCAMENTO = "linha verde: área de até 10 min de carro";

/**
 * Referência da rede para a população recomendada: moradores na área de 10 min de carro de cada unidade madura do modelo (endereços
 * públicos, sem pergunta) e as vendas dela. As áreas vêm do Blob quando já foram calculadas; as que faltam são pedidas ao Mapbox uma vez.
 */
export function useReferenciaPopulacao(unidades: UnidadeEstudo[], censo: Censo | null | undefined, modelo: Modelo | null): RefPopulacao[] | null {
  const [refs, setRefs] = useState<RefPopulacao[] | null>(null);
  useEffect(() => {
    setRefs(null);
    if (!modelo || !censo) return;
    const alvo = unidades.filter((u) => u.madura && u.modelo === modelo && u.c && u.vendas);
    let vivo = true;
    (async () => {
      const out: RefPopulacao[] = [];
      for (let i = 0; i < alvo.length; i += 4) {
        const lote = await Promise.all(alvo.slice(i, i + 4).map(async (u) => {
          try {
            const g = (await buscarDeslocamento(u.c as [number, number], "carro")).contornos[String(MINUTOS_PADRAO)];
            return g ? { nome: u.nome, vendas: u.vendas as number, moradores: moradoresNaArea(censo, g) } : null;
          } catch { return null; }
        }));
        out.push(...lote.filter((x): x is RefPopulacao => !!x));
        if (!vivo) return;
      }
      if (vivo) setRefs(out);
    })();
    return () => { vivo = false; };
  }, [modelo, censo, unidades]);
  return refs;
}
