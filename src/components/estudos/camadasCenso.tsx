// Camadas do Censo 2022 nos mapas dos estudos (unidade e ponto novo): população, idade, domicílios, renda e potencial de consumo,
// só nos hexágonos de dentro da área (`dentro`), como no Mapfry. E as legendas de cada uma, para o painel de camadas.
import type { Leaflet } from "@/components/estudos/mapaComum";
import { hexagono } from "@/components/estudos/mapaComum";
import { CLASSES_DENSIDADE, CLASSES_RENDA, CORES_IDADE, FAIXAS_IDADE, classeDaRenda, classeDensidade, faixaPredominante, gastoDoDomicilio, type Censo } from "@/lib/estudoPonto";

export type CamadaCenso = "pessoas" | "idade" | "domicilios" | "renda" | "consumo";
export const ehCamadaCenso = (x: string): x is CamadaCenso => ["pessoas", "idade", "domicilios", "renda", "consumo"].includes(x);
/** Escala azul do potencial de consumo e da demanda. */
export const AZUL = (t: number) => `rgb(${Math.round(222 - 190 * t)},${Math.round(235 - 160 * t)},${Math.round(252 - 60 * t)})`;

export function desenharCenso(L: Leaflet, grupo: import("leaflet").LayerGroup, censo: Censo, camada: CamadaCenso, dentro: (lat: number, lng: number) => boolean) {
  const vis = censo.celulas.filter(([la, ln, , , d, ida]) => dentro(la, ln) && (camada === "idade" ? ida?.length : camada === "domicilios" || camada === "consumo" ? d : true));
  const hex = (c: (typeof vis)[number], estilo: import("leaflet").PolylineOptions, dica: string) =>
    L.polygon(hexagono(c[0], c[1], censo.rk), { color: "#fff", weight: 1, opacity: 0.6, ...estilo }).bindTooltip(dica, { sticky: true }).addTo(grupo);
  const escala = (val: (c: (typeof vis)[number]) => number) => { const xs = vis.map(val).filter((x) => x > 0).sort((a, b) => a - b); return xs[Math.floor(xs.length * 0.95)] ?? 1; };
  if (camada === "pessoas") {
    const mx = escala((c) => c[2]);
    for (const c of vis) { const t = Math.min(1, c[2] / mx); hex(c, { fillColor: "#c41230", fillOpacity: 0.04 + t * t * 0.42 }, `${c[2].toLocaleString("pt-BR")} moradores`); }
  } else if (camada === "renda") {
    for (const c of vis) { const cl = classeDaRenda(c[3]); if (cl) hex(c, { fillColor: cl.cor, fillOpacity: 0.45 }, `${cl.rotulo}: renda média do responsável R$ ${c[3]!.toLocaleString("pt-BR")}`); }
  } else if (camada === "idade") {
    for (const c of vis) { const i = faixaPredominante(c[5]); if (i != null) hex(c, { fillColor: CORES_IDADE[i], fillOpacity: 0.62 }, `Predomina: ${FAIXAS_IDADE[i]}`); }
  } else if (camada === "domicilios") {
    for (const c of vis) { const pd = c[2] / (c[4] as number); hex(c, { fillColor: CLASSES_DENSIDADE[classeDensidade(pd)].cor, fillOpacity: 0.65 }, `${pd.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} moradores por domicílio`); }
  } else {
    const val = (c: (typeof vis)[number]) => (c[4] ?? 0) * (gastoDoDomicilio(c[3]) ?? 0), mx = escala(val);
    for (const c of vis) { const v = val(c); hex(c, { fillColor: AZUL(Math.min(1, v / mx)), fillOpacity: 0.72 }, `R$ ${Math.round(v).toLocaleString("pt-BR")} por mês em recreações e esportes (estimativa)`); }
  }
}

/** Legenda da camada do Censo para o painel. */
export function LegendaCenso({ camada }: { camada: CamadaCenso }) {
  if (camada === "renda") return <LegendaRenda />;
  if (camada === "pessoas") return <>Vermelho mais forte = mais moradores (Censo 2022).</>;
  if (camada === "consumo") return <div className="flex items-center gap-2">menos<span className="h-1.5 flex-1 rounded" style={{ background: `linear-gradient(90deg,${AZUL(0)},${AZUL(1)})` }} />mais gasto com esporte</div>;
  const itens = camada === "idade" ? FAIXAS_IDADE.map((f, i) => ({ rotulo: f, cor: CORES_IDADE[i] })) : CLASSES_DENSIDADE;
  return (
    <div className="space-y-1">
      {camada === "idade" && <p>Cor da faixa com mais moradores:</p>}
      {itens.map((x) => <div key={x.rotulo} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 flex-none rounded-sm" style={{ background: x.cor }} />{x.rotulo}</div>)}
    </div>
  );
}

/** Legenda da lente Renda: uma cor por classe (renda média do responsável, Censo 2022). */
export function LegendaRenda() {
  return (
    <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-lg bg-white/95 px-3 py-1.5 text-xs text-muted-foreground shadow" title="Classe pela renda média do responsável pelo domicílio (Censo 2022)">
      {CLASSES_RENDA.map((c) => <span key={c.id} className="flex items-center gap-1" title={c.faixa}><span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.cor }} />{c.id}</span>)}
      <span className="border-l pl-2">renda média do responsável</span>
    </div>
  );
}
