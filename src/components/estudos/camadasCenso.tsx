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
    for (const c of vis) {
      const i = faixaPredominante(c[5]); if (i == null) continue;
      const tot = c[5]!.reduce((a, b) => a + b, 0) || 1;
      hex(c, { fillColor: CORES_IDADE[i], fillOpacity: 0.62 }, `<strong>Predomina: ${FAIXAS_IDADE[i]}</strong> (por ano de idade)<br/>${c[5]!.map((v, k) => `${FAIXAS_IDADE[k]}: ${Math.round(v).toLocaleString("pt-BR")} (${Math.round((v / tot) * 100)}%)`).join("<br/>")}`);
    }
  } else if (camada === "domicilios") {
    for (const c of vis) { const pd = c[2] / (c[4] as number); hex(c, { fillColor: CLASSES_DENSIDADE[classeDensidade(pd)].cor, fillOpacity: 0.65 }, `${pd.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} moradores por domicílio`); }
  } else {
    const val = (c: (typeof vis)[number]) => (c[4] ?? 0) * (gastoDoDomicilio(c[3]) ?? 0), mx = escala(val);
    for (const c of vis) { const v = val(c); hex(c, { fillColor: AZUL(Math.min(1, v / mx)), fillOpacity: 0.72 }, `R$ ${Math.round(v).toLocaleString("pt-BR")} por mês em recreações e esportes (estimativa)`); }
  }
}

/** Totais da área para mostrar junto da legenda (rosca das classes de renda, valor do potencial de consumo). */
export interface ResumoCenso {
  renda?: { classes: { id: string; cor: string; faixa: string; parte: number }[]; media: number | null; moradores: number } | null;
  potencial?: { total: number; domicilios: number; porDomicilio: number } | null;
  /** Moradores por faixa de idade na área (na ordem de FAIXAS_IDADE). */
  idade?: number[] | null;
  /** Moradores na área. */
  moradores?: number;
  onde?: string;
}
const reaisCurto = (v: number) => (v >= 1e6 ? `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi` : `R$ ${Math.round(v / 1000).toLocaleString("pt-BR")} mil`);

/** Rosca das classes de renda (moradores por classe na área). */
function RoscaRenda({ classes }: { classes: { id: string; cor: string; parte: number }[] }) {
  const r = 15.9155, c = 2 * Math.PI * r;
  let acum = 0;
  return (
    <svg viewBox="0 0 42 42" className="h-20 w-20 flex-none -rotate-90" aria-hidden>
      <circle cx="21" cy="21" r={r} fill="none" stroke="#eef0f3" strokeWidth="7" />
      {classes.filter((x) => x.parte > 0).map((x) => {
        const el = <circle key={x.id} cx="21" cy="21" r={r} fill="none" stroke={x.cor} strokeWidth="7" strokeDasharray={`${x.parte * c} ${c}`} strokeDashoffset={-acum * c} />;
        acum += x.parte; return el;
      })}
    </svg>
  );
}

/** Legenda da camada do Censo para o painel. Com `resumo`, a Renda mostra a rosca das classes e o Potencial de consumo, o valor da área. */
export function LegendaCenso({ camada, resumo }: { camada: CamadaCenso; resumo?: ResumoCenso }) {
  if (camada === "renda") {
    const rd = resumo?.renda;
    if (!rd || !rd.moradores) return <LegendaRenda />;
    return (
      <div className="space-y-2 text-foreground">
        <div className="flex items-center gap-2.5">
          <RoscaRenda classes={rd.classes} />
          <div className="min-w-0 flex-1 space-y-0.5 text-[11px]">
            {rd.classes.map((x) => <div key={x.id} className="flex items-center gap-1.5" title={x.faixa}><span className="h-2.5 w-2.5 flex-none rounded-sm" style={{ background: x.cor }} /><span className="flex-1 whitespace-nowrap">Classe {x.id}</span><b className="tabular-nums">{Math.round(x.parte * 100)}%</b></div>)}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">Moradores por classe {resumo?.onde ?? "na área"}{rd.media ? `; renda média do responsável R$ ${Math.round(rd.media).toLocaleString("pt-BR")}` : ""} (Censo 2022).</p>
      </div>
    );
  }
  if (camada === "pessoas") return (
    <div className="space-y-1">
      {resumo?.moradores ? <div className="text-foreground"><span className="font-display text-2xl font-semibold leading-none text-primary">{Math.round(resumo.moradores).toLocaleString("pt-BR")}</span> <span className="text-xs text-muted-foreground">moradores {resumo.onde ?? "na área"}</span></div> : null}
      <p>Vermelho mais forte = mais moradores no hexágono (Censo 2022). Passe o mouse para ver o número.</p>
    </div>
  );
  if (camada === "consumo") {
    const pt = resumo?.potencial;
    return (
      <div className="space-y-2">
        {pt && <div className="text-foreground"><div className="font-display text-2xl font-semibold leading-none text-primary">{reaisCurto(pt.total)}<span className="ml-1 text-xs font-normal text-muted-foreground">por mês</span></div>
          <p className="mt-1 text-[11px] text-muted-foreground">gasto com recreações e esportes {resumo?.onde ?? "na área"}: {pt.domicilios.toLocaleString("pt-BR")} domicílios, R$ {Math.round(pt.porDomicilio).toLocaleString("pt-BR")} por domicílio (estimativa POF e Censo).</p></div>}
        <div className="flex items-center gap-2">menos<span className="h-1.5 flex-1 rounded" style={{ background: `linear-gradient(90deg,${AZUL(0)},${AZUL(1)})` }} />mais gasto com esporte</div>
      </div>
    );
  }
  if (camada === "idade") {
    const t = resumo?.idade, soma = t ? t.reduce((a, b) => a + b, 0) : 0;
    return (
      <div className="space-y-1">
        <p>Cor da faixa que predomina em cada hexágono, comparando moradores por ano de idade (as faixas têm tamanhos diferentes).</p>
        {FAIXAS_IDADE.map((f, i) => (
          <div key={f} className="flex items-center gap-1.5 text-foreground">
            <span className="h-2.5 w-2.5 flex-none rounded-sm" style={{ background: CORES_IDADE[i] }} /><span className="flex-1 text-muted-foreground">{f}</span>
            {t && soma > 0 && <span className="tabular-nums"><b>{Math.round((t[i] / soma) * 100)}%</b> <span className="text-muted-foreground">{Math.round(t[i]).toLocaleString("pt-BR")}</span></span>}
          </div>
        ))}
        {t && soma > 0 && <p className="pt-1 text-[11px]">{Math.round(soma).toLocaleString("pt-BR")} moradores {resumo?.onde ?? "na área"} (Censo 2022).</p>}
      </div>
    );
  }
  const itens = CLASSES_DENSIDADE;
  return (
    <div className="space-y-1">
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
