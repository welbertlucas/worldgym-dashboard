// Camadas do Censo 2022 nos mapas dos estudos (unidade e ponto novo): população, idade, domicílios, renda e potencial de consumo,
// só nos hexágonos de dentro da área (`dentro`), como no Mapfry. E as legendas de cada uma, para o painel de camadas.
import type { Leaflet } from "@/components/estudos/mapaComum";
import { hexagono, rampa } from "@/components/estudos/mapaComum";
import { CLASSES_DENSIDADE, CLASSES_RENDA, CORES_IDADE, FAIXAS_IDADE, TAMANHOS_DOMICILIO, classeDaRenda, classeDensidade, faixaPredominante, gastoDoDomicilio, tamanhoPredominante, type Censo } from "@/lib/estudoPonto";

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
    for (const c of vis) {
      const pd = c[2] / (c[4] as number), t = tamanhoPredominante(c[6]);
      if (t != null) { hex(c, { fillColor: TAMANHOS_DOMICILIO[t].cor, fillOpacity: 0.62 }, `<strong>Mais comum: ${TAMANHOS_DOMICILIO[t].rotulo}</strong><br/>${c[6]!.map((v, k) => `${TAMANHOS_DOMICILIO[k].rotulo}: ${Math.round(v).toLocaleString("pt-BR")}`).join("<br/>")}<br/>${Math.round(c[4] as number).toLocaleString("pt-BR")} domicílios · ${pd.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} moradores por domicílio`); continue; } hex(c, { fillColor: CLASSES_DENSIDADE[classeDensidade(pd)].cor, fillOpacity: 0.65 }, `${Math.round(c[4] as number).toLocaleString("pt-BR")} domicílios, ${c[2].toLocaleString("pt-BR")} moradores<br/>${pd.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} moradores por domicílio`); }
  } else {
    const val = (c: (typeof vis)[number]) => (c[4] ?? 0) * (gastoDoDomicilio(c[3]) ?? 0), mx = escala(val);
    for (const c of vis) { const v = val(c); hex(c, { fillColor: AZUL(Math.min(1, v / mx)), fillOpacity: 0.72 }, `R$ ${Math.round(v).toLocaleString("pt-BR")} por mês em recreações e esportes (estimativa)`); }
  }
}

/**
 * Camadas de demanda (Demanda potencial, Oportunidades de captação, Captação estimada): todo hexágono com moradores dentro da área, como as
 * outras camadas. A cor é medida pelo hexágono no topo da faixa comum (95% dos hexágonos abaixo dele), e não pelo maior, para um hexágono muito
 * forte não deixar os outros quase transparentes. `pesos`/`indices` vêm de captacaoDe (calculada com raio que cubra a área).
 */
export function desenharDemanda(L: Leaflet, grupo: import("leaflet").LayerGroup, censo: Censo, cap: { pesos: number[]; indices: number[] }, dentro: (lat: number, lng: number) => boolean, cor: "quente" | "azul") {
  const vis: [number, number][] = [];
  cap.indices.forEach((i, k) => { const c = censo.celulas[i]; if (cap.pesos[k] > 0 && dentro(c[0], c[1])) vis.push([i, cap.pesos[k]]); });
  const xs = vis.map((v) => v[1]).sort((a, b) => a - b);
  const ref = xs[Math.floor(xs.length * 0.95)] ?? 1;
  for (const [i, w] of vis) {
    const c = censo.celulas[i], t = Math.min(1, w / ref);
    L.polygon(hexagono(c[0], c[1], censo.rk), cor === "quente"
      // cor mínima visível: o hexágono de demanda baixa não some sobre o mapa cinza
      ? { color: "#fff", weight: 1, opacity: 0.5, fillColor: rampa(0.15 + 0.85 * t ** 0.7), fillOpacity: 0.5 + 0.3 * t, interactive: false }
      : { color: "#fff", weight: 1, opacity: 0.5, fillColor: AZUL(0.12 + 0.88 * t ** 0.7), fillOpacity: 0.72, interactive: false }).addTo(grupo);
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
  /** Domicílios por faixa de moradores por domicílio, com o total e a média. */
  domicilios?: { classes: { rotulo: string; cor: string; domicilios: number; parte: number }[]; total: number; porDomicilio: number | null; porTamanho?: boolean } | null;
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

/** Lista no estilo do Mapfry: total em cima (com a faixa de cores) e cada item com o número e uma barra fina na cor dele. */
function ListaTotais({ total, rotuloTotal, itens }: { total: number; rotuloTotal: string; itens: { rotulo: string; n: number; cor: string }[] }) {
  const mx = Math.max(1, ...itens.map((i) => i.n));
  return (
    <div className="space-y-2 text-foreground">
      <div className="rounded-lg bg-muted px-2.5 py-1.5">
        <div className="flex items-center justify-between text-[12px]"><span>{rotuloTotal}</span><b className="tabular-nums">{Math.round(total).toLocaleString("pt-BR")}</b></div>
        <div className="mt-1 h-1 rounded-full" style={{ background: `linear-gradient(90deg,${itens.map((i) => i.cor).join(",")})` }} />
      </div>
      {itens.map((i) => (
        <div key={i.rotulo}>
          <div className="flex items-baseline justify-between gap-2 text-[12px]"><span className="min-w-0">{i.rotulo}</span><span className="whitespace-nowrap tabular-nums"><b>{Math.round(i.n).toLocaleString("pt-BR")}</b> <span className="text-muted-foreground">{total ? Math.round((i.n / total) * 100) : 0}%</span></span></div>
          <div className="mt-1 h-1 rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${(i.n / mx) * 100}%`, background: i.cor }} /></div>
        </div>
      ))}
    </div>
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
      <div className="space-y-2">
        {t && soma > 0
          ? <ListaTotais total={soma} rotuloTotal={`Moradores ${resumo?.onde ?? "na área"}`} itens={FAIXAS_IDADE.map((f, k) => ({ rotulo: f, n: t[k], cor: CORES_IDADE[k] }))} />
          : FAIXAS_IDADE.map((f, k) => <div key={f} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 flex-none rounded-sm" style={{ background: CORES_IDADE[k] }} />{f}</div>)}
        <p className="text-[11px]">No mapa, cada hexágono tem a cor da faixa que predomina, comparando moradores por ano de idade (as faixas do Censo têm tamanhos diferentes).</p>
      </div>
    );
  }
  const dm = resumo?.domicilios;
  if (dm && dm.total > 0) return (
    <div className="space-y-2">
      <ListaTotais total={dm.total} rotuloTotal={`Domicílios ${resumo?.onde ?? "na área"}`} itens={dm.classes.map((x) => ({ rotulo: x.rotulo, n: x.domicilios, cor: x.cor }))} />
      <p className="text-[11px]">{dm.porDomicilio ? `Média de ${dm.porDomicilio.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} moradores por domicílio. ` : ""}{dm.porTamanho ? "Domicílios ocupados por número de moradores; no mapa, a cor do tamanho mais comum em cada hexágono (Censo 2022)." : "Cada faixa soma os domicílios dos hexágonos com aquela média de moradores (Censo 2022)."}</p>
    </div>
  );
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
