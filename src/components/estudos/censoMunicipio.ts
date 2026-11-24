// Censo dos municípios de fora da malha principal (Estudos de ponto). A malha principal (dados.censo) cobre só a região das unidades; para um
// ponto fora dela, o servidor devolve os hexágonos dos municípios que já foram gerados (scripts/censo-municipio.py), e esta função junta
// tudo numa malha só, para o resto da tela usar como sempre. Sem município gerado, o ponto continua "sem Censo" (aviso e parecer limitado).
import { useEffect, useMemo, useState } from "react";
import { API_BASE, authFetch } from "@/lib/auth";
import { foraDaMalhaDoCenso, type CelulaCenso, type Censo } from "@/lib/estudoPonto";

export interface MunicipioCenso { cod: string; nome: string; uf: string; celulas: CelulaCenso[] }

const pedidos = new Map<string, Promise<MunicipioCenso[]>>();
/** Hexágonos dos municípios que cobrem a posição (guardado na memória da página; posição arredondada a ~1 km). */
export function buscarCensoDoPonto(c: [number, number]): Promise<MunicipioCenso[]> {
  const k = `${c[0].toFixed(2)},${c[1].toFixed(2)}`;
  if (!pedidos.has(k)) {
    pedidos.set(k, (async () => {
      const r = await authFetch(`${API_BASE}/estudos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "censo-municipio", c }) });
      if (!r.ok) throw new Error("censo-municipio");
      return ((await r.json()).municipios ?? []) as MunicipioCenso[];
    })().catch((e) => { pedidos.delete(k); throw e; }));
  }
  return pedidos.get(k)!;
}

/** Junta ao Censo principal os hexágonos dos municípios dos pontos que estão fora dele. `carregando` enquanto algum pedido está no ar. */
export function useCensoCompleto(base: Censo | null | undefined, pontos: { c: [number, number] }[]): { censo: Censo | null | undefined; carregando: boolean } {
  const [extras, setExtras] = useState<Map<string, MunicipioCenso>>(new Map());
  const [carregando, setCarregando] = useState(false);
  const chave = pontos.map((p) => p.c.join(",")).join("|");
  // posições dos pontos que a malha principal não cobre
  const fora = useMemo(() => (base ? pontos.filter((p) => foraDaMalhaDoCenso(p.c, base)).map((p) => p.c) : []), [base, chave]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!fora.length) { setCarregando(false); return; }
    let vivo = true;
    setCarregando(true);
    Promise.all(fora.map((c) => buscarCensoDoPonto(c).catch(() => [] as MunicipioCenso[]))).then((listas) => {
      if (!vivo) return;
      setExtras((atual) => {
        const novo = new Map(atual);
        for (const m of listas.flat()) if (!novo.has(m.cod)) novo.set(m.cod, m);
        return novo.size === atual.size ? atual : novo;
      });
      setCarregando(false);
    });
    return () => { vivo = false; };
  }, [fora]);
  const censo = useMemo(() => (base && extras.size ? { ...base, celulas: [...base.celulas, ...[...extras.values()].flatMap((m) => m.celulas)] } : base), [base, extras]);
  return { censo, carregando };
}
