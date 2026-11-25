// Novidades já vistas neste navegador (ids). O número no menu ("Novidades") lê daqui e some ao abrir a tela.
import { useSyncExternalStore } from "react";
import { ehDono, podeVerJuridico, podeVerEscalas, podeVerQualidade, podeVerRoyalties } from "@/lib/auth";
import { naoVistas, novidadesPara } from "@/data/novidades";

const CHAVE = "atlas-novidades-vistas";
const ouvintes = new Set<() => void>();
let cache: string | null = null;

function ler(): string {
  if (cache === null) { try { cache = localStorage.getItem(CHAVE) ?? "[]"; } catch { cache = "[]"; } }
  return cache;
}
export function lerVistas(): string[] {
  try { const v = JSON.parse(ler()); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function marcarVistas(ids: string[]) {
  const todas = [...new Set([...lerVistas(), ...ids])];
  cache = JSON.stringify(todas);
  try { localStorage.setItem(CHAVE, cache); } catch { /* armazenamento indisponível: o número volta na próxima visita */ }
  ouvintes.forEach((f) => f());
}
const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };

/** Quantas novidades a pessoa ainda não viu. */
export function useNovidadesNaoVistas(): number {
  const bruto = useSyncExternalStore(assinar, ler, () => "[]");
  void bruto;
  return naoVistas(novidadesPara(ehDono(), undefined, podeVerRoyalties(), podeVerJuridico(), podeVerQualidade(), podeVerEscalas()), lerVistas());
}
