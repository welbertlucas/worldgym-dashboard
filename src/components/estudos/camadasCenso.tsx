// Camadas do Censo 2022 nos mapas dos estudos (unidade e ponto novo): população, idade, domicílios, renda, renda total, potencial de consumo
// e concentração comercial (OpenStreetMap), só nos hexágonos de dentro da área (`dentro`), recortados na borda dela como no Mapfry.
// E as legendas de cada uma, para o painel de camadas.
import type { Leaflet } from "@/components/estudos/mapaComum";
import { hexagono, rampa, recortarNaArea } from "@/components/estudos/mapaComum";
import { CLASSES_DENSIDADE, CLASSES_RENDA, CORES_IDADE, FAIXAS_IDADE, TAMANHOS_DOMICILIO, classeDaRenda, classeDensidade, dentroDaArea, faixaPredominante, gastoDoHexagono, tamanhoPredominante, type Censo, type Geometria } from "@/lib/estudoPonto";

export type CamadaCenso = "pessoas" | "idade" | "domicilios" | "renda" | "rendaTotal" | "consumo" | "comercio";
export const ehCamadaCenso = (x: string): x is CamadaCenso => ["pessoas", "idade", "domicilios", "renda", "rendaTotal", "consumo", "comercio"].includes(x);
/** Escala verde da renda total e roxa da concentração comercial (como no Mapfry). */
export const VERDE = (t: number) => `rgb(${Math.round(220 - 190 * t)},${Math.round(240 - 120 * t)},${Math.round(225 - 150 * t)})`;
export const ROXO = (t: number) => `rgb(${Math.round(237 - 150 * t)},${Math.round(225 - 190 * t)},${Math.round(247 - 120 * t)})`;
/**
 * Abaixo disso o hexágono (200 m) não é desenhado, como no Mapfry, que deixa em branco o que não é área de moradia (parques, vazios, rodovias).
 * Os números da área continuam contando todos: perto do Gama, os escondidos são quase metade dos hexágonos e 1,2% dos moradores.
 */
export const MIN_MORADORES_NO_MAPA = 20;
/** Hexágonos desenhados: os de centro dentro da área e, com a geometria, também os da borda, recortados nela. */
function poligonos(censo: Censo, c: [number, number], area?: Geometria | null): [number, number][][] {
  const h = hexagono(c[0], c[1], censo.rk);
  if (!area) return [h];
  const dentro = h.map(([la, ln]) => dentroDaArea(la, ln, area));
  return dentro.every(Boolean) ? [h] : dentro.some(Boolean) || dentroDaArea(c[0], c[1], area) ? recortarNaArea(h, area) : [];
}
const caixas = new WeakMap<object, [number, number, number, number]>();
/** Retângulo [latMin, latMax, lngMin, lngMax] da área (guardado por geometria), para só testar a borda de quem está perto. */
function caixaDe(area: Geometria) {
  let cx = caixas.get(area);
  if (!cx) {
    const pts = (area.type === "Polygon" ? [area.coordinates] : area.coordinates).flatMap((p) => p[0] ?? []);
    cx = [Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[1])), Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[0]))];
    caixas.set(area, cx);
  }
  return cx;
}
const pertoDaBorda = (censo: Censo, la: number, ln: number, area?: Geometria | null) => {
  if (!area) return false;
  const [a0, a1, b0, b1] = caixaDe(area), m = censo.rk / 100;
  if (la < a0 - m || la > a1 + m || ln < b0 - m || ln > b1 + m) return false;
  return hexagono(la, ln, censo.rk).some(([a, b]) => dentroDaArea(a, b, area));
};
/** Escala azul do potencial de consumo e da demanda. */
export const AZUL = (t: number) => `rgb(${Math.round(222 - 190 * t)},${Math.round(235 - 160 * t)},${Math.round(252 - 60 * t)})`;

export function desenharCenso(L: Leaflet, grupo: import("leaflet").LayerGroup, censo: Censo, camada: CamadaCenso, dentro: (lat: number, lng: number) => boolean, area?: Geometria | null) {
  const vis = censo.celulas.filter(([la, ln, p, , d, ida, , , rd, , com]) => (camada === "comercio" || p >= MIN_MORADORES_NO_MAPA) && (dentro(la, ln) || pertoDaBorda(censo, la, ln, area))
    && (camada === "idade" ? ida?.length : camada === "domicilios" || camada === "consumo" ? d : camada === "rendaTotal" ? d && rd : camada === "comercio" ? com : true));
  const hex = (c: (typeof vis)[number], estilo: import("leaflet").PolylineOptions, dica: string) => {
    const ps = poligonos(censo, [c[0], c[1]], area);
    if (ps.length) L.polygon(ps, { color: "#fff", weight: 0.6, opacity: 0.7, ...estilo }).bindTooltip(dica, { sticky: true }).addTo(grupo);
  };
  const escala = (val: (c: (typeof vis)[number]) => number) => { const xs = vis.map(val).filter((x) => x > 0).sort((a, b) => a - b); return xs[Math.floor(xs.length * 0.95)] ?? 1; };
  if (camada === "pessoas") {
    const mx = escala((c) => c[2]);
    for (const c of vis) { const t = Math.min(1, c[2] / mx); hex(c, { fillColor: "#c41230", fillOpacity: 0.04 + t * t * 0.42 }, `${c[2].toLocaleString("pt-BR")} moradores`); }
  } else if (camada === "renda") {
    for (const c of vis) {
      // Com a estimativa por domicílio, a cor é a da classe com mais domicílios no hexágono; sem ela, a da renda média do responsável
      const dist = c[7];
      if (dist?.length && dist.some((x) => x > 0)) {
        const tot = dist.reduce((a, x) => a + x, 0), i = dist.indexOf(Math.max(...dist)), cl = CLASSES_RENDA[i];
        hex(c, { fillColor: cl.cor, fillOpacity: 0.45 }, `<strong>Mais domicílios: ${cl.rotulo}</strong><br/>${CLASSES_RENDA.map((k, j) => `${k.rotulo}: ${Math.round((dist[j] / tot) * 100)}%`).join("<br/>")}${c[3] ? `<br/>renda média do responsável R$ ${c[3].toLocaleString("pt-BR")}` : ""}`);
        continue;
      }
      const cl = classeDaRenda(c[3]); if (cl) hex(c, { fillColor: cl.cor, fillOpacity: 0.45 }, `${cl.rotulo}: renda média do responsável R$ ${c[3]!.toLocaleString("pt-BR")}`);
    }
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
  } else if (camada === "rendaTotal") {
    const val = (c: (typeof vis)[number]) => (c[8] ?? 0) * (c[4] ?? 0), mx = escala(val);
    for (const c of vis) { const v = val(c); hex(c, { fillColor: VERDE(Math.min(1, v / mx)), fillOpacity: 0.72 }, `Renda dos domicílios: R$ ${Math.round(v).toLocaleString("pt-BR")} por mês<br/>${Math.round(c[4] ?? 0).toLocaleString("pt-BR")} domicílios · R$ ${(c[8] ?? 0).toLocaleString("pt-BR")} por domicílio (estimativa)`); }
  } else if (camada === "comercio") {
    const mx = escala((c) => c[10] ?? 0);
    for (const c of vis) { const n = c[10] ?? 0, t = Math.min(1, n / mx); hex(c, { fillColor: ROXO(t), fillOpacity: 0.25 + 0.55 * t }, `${n.toLocaleString("pt-BR")} ${n === 1 ? "ponto" : "pontos"} de comércio e serviços (OpenStreetMap)`); }
  } else {
    const val = (c: (typeof vis)[number]) => gastoDoHexagono(c), mx = escala(val);
    for (const c of vis) { const v = val(c); hex(c, { fillColor: AZUL(Math.min(1, v / mx)), fillOpacity: 0.72 }, `R$ ${Math.round(v).toLocaleString("pt-BR")} por mês em recreações e esportes (estimativa)`); }
  }
}

/**
 * Camadas de demanda (Demanda potencial, Oportunidades de captação, Captação estimada): todo hexágono com moradores dentro da área, como as
 * outras camadas. A cor é medida pelo hexágono no topo da faixa comum (95% dos hexágonos abaixo dele), e não pelo maior, para um hexágono muito
 * forte não deixar os outros quase transparentes. `pesos`/`indices` vêm de captacaoDe (calculada com raio que cubra a área).
 */
export function desenharDemanda(L: Leaflet, grupo: import("leaflet").LayerGroup, censo: Censo, cap: { pesos: number[]; indices: number[] }, dentro: (lat: number, lng: number) => boolean, cor: "quente" | "azul" | "vermelho", area?: Geometria | null) {
  const vis: [number, number][] = [];
  cap.indices.forEach((i, k) => { const c = censo.celulas[i]; if (cap.pesos[k] > 0 && c[2] >= MIN_MORADORES_NO_MAPA && (dentro(c[0], c[1]) || pertoDaBorda(censo, c[0], c[1], area))) vis.push([i, cap.pesos[k]]); });
  const xs = vis.map((v) => v[1]).sort((a, b) => a - b);
  const ref = xs[Math.floor(xs.length * 0.95)] ?? 1;
  for (const [i, w] of vis) {
    const c = censo.celulas[i], t = Math.min(1, w / ref);
    const ps = poligonos(censo, [c[0], c[1]], area);
    if (!ps.length) continue;
    if (cor === "vermelho") { L.polygon(ps, { color: "#fff", weight: 0.6, opacity: 0.7, fillColor: "#c41230", fillOpacity: 0.06 + 0.6 * t ** 0.8, interactive: false }).addTo(grupo); continue; }
    L.polygon(ps, cor === "quente"
      // cor mínima visível: o hexágono de demanda baixa não some sobre o mapa cinza
      ? { color: "#fff", weight: 0.6, opacity: 0.6, fillColor: rampa(0.15 + 0.85 * t ** 0.7), fillOpacity: 0.5 + 0.3 * t, interactive: false }
      : { color: "#fff", weight: 0.6, opacity: 0.6, fillColor: AZUL(0.12 + 0.88 * t ** 0.7), fillOpacity: 0.72, interactive: false }).addTo(grupo);
  }
}

/** Totais da área para mostrar junto da legenda (rosca das classes de renda, valor do potencial de consumo). */
export interface ResumoCenso {
  renda?: { classes: { id: string; cor: string; faixa: string; parte: number }[]; media: number | null; moradores: number; porDomicilio?: boolean } | null;
  potencial?: { total: number; domicilios: number; porDomicilio: number } | null;
  /** Soma da renda estimada dos domicílios da área (malha v6). */
  rendaTotal?: { total: number; domicilios: number; porDomicilio: number } | null;
  /** Pontos de comércio e serviços na área (OpenStreetMap; malha v6). */
  comercio?: number | null;
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

/** Cartão do total da área, como no Mapfry: o número grande, o que ele é e a barra de cor da camada (de menos para mais). */
function CaixaTotal({ rotulo, valor, onde, nota, barra }: { rotulo: string; valor: string; onde?: string; nota?: string; barra?: [string, string] }) {
  return (
    <div className="rounded-lg border bg-white px-3 py-2.5 text-center text-foreground">
      <b className="block text-[22px] font-semibold leading-tight tabular-nums" style={barra ? { color: barra[1] } : undefined}>{valor}</b>
      <p className="text-[12px] leading-tight">{rotulo}</p>
      {onde && <p className="text-[10.5px] leading-tight text-muted-foreground">{onde}</p>}
      {barra && <div className="mx-auto mt-2 h-1.5 w-11/12 rounded-full" style={{ background: `linear-gradient(90deg,${barra[0]},${barra[1]})` }} />}
      {nota && <p className="mt-1.5 text-left text-[10.5px] leading-tight text-muted-foreground">{nota}</p>}
    </div>
  );
}

/** Cores da rosca da Base de clientes: do vermelho forte (bairro com mais alunos) ao claro; "Outros bairros" em cinza. */
export const CORES_BAIRROS = ["#8c0c22", "#c41230", "#e0475e", "#ee8495", "#f6bcc5"];
/** Cor dos bairros fora dos 5 maiores (fatia "Outros bairros" e bolhas do mapa). */
export const COR_OUTROS_BAIRROS = "#a7aeb8";
/**
 * Rosca da Base de clientes (pedido do dono, 23/11/2026): os bairros com mais alunos e o resto em "Outros bairros", com o total no meio
 * e a legenda embaixo (nome inteiro, alunos e percentual), como a rosca de renda.
 */
export function RoscaBairros({ bairros, total, nota }: { bairros: { nome: string; n: number }[]; total: number; nota?: string }) {
  const resto = Math.max(0, total - bairros.reduce((a, b) => a + b.n, 0));
  const fatias = [...bairros.map((b, i) => ({ id: b.nome, cor: CORES_BAIRROS[i] ?? CORES_BAIRROS[CORES_BAIRROS.length - 1], parte: total ? b.n / total : 0 })), ...(resto > 0 ? [{ id: "Outros bairros", cor: COR_OUTROS_BAIRROS, parte: resto / total }] : [])];
  // o mesmo arranjo da camada Renda: rosca à esquerda, lista à direita e o total embaixo
  return (
    <div className="space-y-2 text-foreground">
      <div className="flex items-center gap-2.5">
        <RoscaRenda classes={fatias} />
        <div className="min-w-0 flex-1 space-y-0.5 text-[11px]">
          {fatias.map((x) => <div key={x.id} className="flex items-start gap-1.5"><span className="mt-[2px] h-2.5 w-2.5 flex-none rounded-sm" style={{ background: x.cor }} /><span className="min-w-0 flex-1 break-words leading-tight">{x.id}</span><b className="tabular-nums">{Math.round(x.parte * 100)}%</b></div>)}
        </div>
      </div>
      {nota && <p className="text-[11px] text-muted-foreground">{nota}</p>}
    </div>
  );
}

/** Rosca com o número no meio e a legenda embaixo (nome inteiro, número e percentual; `soPercentual` mostra só o percentual). */
export function RoscaComLegenda({ fatias, total, centro, nota, soPercentual }: { fatias: { rotulo: string; n: number; cor: string }[]; total: number; centro: { valor: string; rotulo: string }; nota?: string; soPercentual?: boolean }) {
  const r = 15.9155, c = 2 * Math.PI * r;
  let acum = 0;
  return (
    <div className="space-y-2 text-foreground">
      <div className="relative mx-auto h-32 w-32">
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="21" cy="21" r={r} fill="none" stroke="#eef0f3" strokeWidth="6" />
          {fatias.map((f) => {
            const p = total ? f.n / total : 0;
            const el = <circle key={f.rotulo} cx="21" cy="21" r={r} fill="none" stroke={f.cor} strokeWidth="6" strokeDasharray={`${p * c} ${c}`} strokeDashoffset={-acum * c} />;
            acum += p; return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <b className="text-[18px] leading-none tabular-nums">{centro.valor}</b>
          <span className="mt-0.5 px-5 text-[10.5px] leading-tight text-muted-foreground">{centro.rotulo}</span>
        </div>
      </div>
      {nota && <p className="text-center text-[10.5px] text-muted-foreground">{nota}</p>}
      <div className="space-y-1">
        {fatias.map((f) => (
          <div key={f.rotulo} className="flex items-start gap-1.5 text-[11.5px] leading-snug">
            <span className="mt-[3px] h-2.5 w-2.5 flex-none rounded-sm" style={{ background: f.cor }} />
            <span className="min-w-0 flex-1 break-words">{f.rotulo}</span>
            <span className="whitespace-nowrap tabular-nums">{soPercentual ? <b>{total ? Math.round((f.n / total) * 100) : 0}%</b> : <><b>{Math.round(f.n).toLocaleString("pt-BR")}</b> <span className="text-muted-foreground">{total ? Math.round((f.n / total) * 100) : 0}%</span></>}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Lista no estilo do Mapfry: total em cima (com a faixa de cores) e cada item com o número e uma barra fina na cor dele. */
function ListaTotais({ total, rotuloTotal, onde, itens }: { total: number; rotuloTotal: string; onde?: string; itens: { rotulo: string; n: number; cor: string }[] }) {
  const mx = Math.max(1, ...itens.map((i) => i.n));
  return (
    <div className="space-y-2 text-foreground">
      <div className="rounded-lg bg-muted px-2.5 py-1.5">
        <div className="flex items-center justify-between gap-2 text-[12px] leading-tight"><span className="font-medium">{rotuloTotal}</span><b className="whitespace-nowrap tabular-nums">{Math.round(total).toLocaleString("pt-BR")}</b></div>
        {onde && <p className="text-[10.5px] leading-tight text-muted-foreground">{onde}</p>}
        <div className="mt-1 h-1 rounded-full" style={{ background: `linear-gradient(90deg,${itens.map((i) => i.cor).join(",")})` }} />
      </div>
      {itens.map((i) => (
        <div key={i.rotulo}>
          <div className="flex items-center justify-between gap-2 text-[11.5px] leading-tight"><span className="min-w-0 break-words leading-snug">{i.rotulo}</span><span className="whitespace-nowrap tabular-nums"><b>{Math.round(i.n).toLocaleString("pt-BR")}</b> <span className="text-muted-foreground">{total ? Math.round((i.n / total) * 100) : 0}%</span></span></div>
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
        <p className="text-[11px] text-muted-foreground">{rd.porDomicilio ? `${Math.round(rd.moradores).toLocaleString("pt-BR")} domicílios por classe` : "Moradores por classe"} {resumo?.onde ?? "na área"}{rd.media ? `; renda média do responsável R$ ${Math.round(rd.media).toLocaleString("pt-BR")}` : ""} (Censo 2022{rd.porDomicilio ? "; a classe de cada domicílio é estimada pela média e pela variação da renda em cada setor" : ""}).</p>
      </div>
    );
  }
  if (camada === "pessoas") return (
    <div className="space-y-1">
      {resumo?.moradores ? <CaixaTotal rotulo="Moradores" valor={Math.round(resumo.moradores).toLocaleString("pt-BR")} onde={resumo.onde ?? "na área"} barra={["#f6d6dc", "#c41230"]} /> : null}
      <p>Vermelho mais forte = mais moradores no hexágono (Censo 2022). Passe o mouse para ver o número.</p>
    </div>
  );
  if (camada === "consumo") {
    const pt = resumo?.potencial;
    return (
      <div className="space-y-2">
        {pt && <CaixaTotal rotulo="Gasto com esportes por mês" valor={reaisCurto(pt.total)} onde={resumo?.onde ?? "na área"} barra={[AZUL(0), AZUL(1)]} nota={`${Math.round(pt.domicilios).toLocaleString("pt-BR")} domicílios, R$ ${Math.round(pt.porDomicilio).toLocaleString("pt-BR")} por domicílio (estimativa: POF 2017-2018 pela renda estimada dos domicílios do Censo 2022).`} />}
        {!pt && <div className="flex items-center gap-2">menos<span className="h-1.5 flex-1 rounded" style={{ background: `linear-gradient(90deg,${AZUL(0)},${AZUL(1)})` }} />mais gasto com esporte</div>}
      </div>
    );
  }
  if (camada === "rendaTotal") {
    const rt = resumo?.rendaTotal;
    return rt ? <CaixaTotal rotulo="Renda dos domicílios por mês" valor={reaisCurto(rt.total)} onde={resumo?.onde ?? "na área"} barra={[VERDE(0), VERDE(1)]} nota={`${Math.round(rt.domicilios).toLocaleString("pt-BR")} domicílios, R$ ${Math.round(rt.porDomicilio).toLocaleString("pt-BR")} por domicílio (estimativa: renda do responsável no Censo 2022 × a relação entre a renda do domicílio e a do responsável no estado).`} />
      : <p>Sem a renda dos domicílios nesta malha do Censo.</p>;
  }
  if (camada === "comercio") {
    const n = resumo?.comercio;
    return (
      <div className="space-y-2">
        {n != null && <CaixaTotal rotulo="Pontos de comércio e serviços" valor={n.toLocaleString("pt-BR")} onde={resumo?.onde ?? "na área"} barra={[ROXO(0), ROXO(1)]} />}
        <div className="flex justify-between text-[10.5px] text-muted-foreground"><span>Baixa</span><span>Média</span><span>Alta</span><span>Muito alta</span></div>
        <p className="text-[11px]">Lojas, escritórios, restaurantes, farmácias, bancos, escolas e clínicas mapeados no OpenStreetMap, por hexágono. Mostra onde o comércio se concentra; não é contagem de pessoas passando (dado de celular).</p>
      </div>
    );
  }
  if (camada === "idade") {
    const t = resumo?.idade, soma = t ? t.reduce((a, b) => a + b, 0) : 0;
    return (
      <div className="space-y-2">
        {t && soma > 0
          ? <ListaTotais total={soma} rotuloTotal="Moradores" onde={resumo?.onde ?? "na área"} itens={FAIXAS_IDADE.map((f, k) => ({ rotulo: f, n: t[k], cor: CORES_IDADE[k] }))} />
          : FAIXAS_IDADE.map((f, k) => <div key={f} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 flex-none rounded-sm" style={{ background: CORES_IDADE[k] }} />{f}</div>)}
        <p className="text-[11px]">No mapa, cada hexágono tem a cor da faixa que predomina, comparando moradores por ano de idade (as faixas do Censo têm tamanhos diferentes).</p>
      </div>
    );
  }
  const dm = resumo?.domicilios;
  if (dm && dm.total > 0) return (
    <div className="space-y-2">
      <ListaTotais total={dm.total} rotuloTotal="Domicílios" onde={resumo?.onde ?? "na área"} itens={dm.classes.map((x) => ({ rotulo: x.rotulo, n: x.domicilios, cor: x.cor }))} />
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
