// Academias concorrentes (e outros lugares) no mapa dos estudos, como no Mapfry: busca por categoria num raio em volta do ponto, com o NOME de cada
// lugar sempre visível no mapa (para print e PDF), sem precisar clicar. Etiquetas que se sobrepõem somem até aproximar o zoom;
// grandes redes têm prioridade. Modo "Números + lista" para quando há lugares demais. Longe (zoom de cidade), agrupa com o número.
import { useEffect, useRef, useState } from "react";
import { Pilula } from "@/components/ui/pilula";
import { Button } from "@/components/ui/button";
import { API_BASE, authFetch } from "@/lib/auth";
import type { Leaflet } from "@/components/estudos/mapaComum";
import { Linha, Secao } from "@/components/estudos/blocos";
import { MapPinned } from "lucide-react";
import { dentroDaArea, type Geometria } from "@/lib/estudoPonto";
import { raioQueCobre } from "@/components/estudos/deslocamento";

export interface Lugar { nome: string; endereco: string; c: [number, number]; km: number; rede: string | null }
export interface ResultadoPois { categoria: string; rotulo: string; c: [number, number]; raioKm: number; total: number; cortado?: boolean; lugares: Lugar[]; areaRotulo?: string; /** Lugares que o Google chama de academia mas não são (quadra, campo, parque...), tirados da conta. */ foraDaConta?: number }
export type ModoPois = "nomes" | "numeros";

export const CATEGORIAS_POIS: { id: string; rotulo: string; singular: string }[] = [
  { id: "academias", rotulo: "Academias concorrentes", singular: "academia concorrente" },
  { id: "escolas", rotulo: "Escolas e faculdades", singular: "escola ou faculdade" },
  { id: "supermercados", rotulo: "Supermercados", singular: "supermercado" },
  { id: "shoppings", rotulo: "Shoppings", singular: "shopping" },
  { id: "transporte", rotulo: "Ônibus, metrô e estações", singular: "estação ou terminal" },
  { id: "hospitais", rotulo: "Hospitais", singular: "hospital" },
];

/** Nome da busca (o da tela, não o guardado no servidor) e o total; nas academias, as World Gym não contam como concorrentes. */
export const rotuloPois = (res: ResultadoPois) => CATEGORIAS_POIS.find((c) => c.id === res.categoria)?.rotulo ?? res.rotulo;
/** Onde foi a busca: "em 10 min de carro" (área de deslocamento) ou "a até 2 km" (raio). */
export const ondePois = (res: ResultadoPois) => (res.areaRotulo ? `em ${res.areaRotulo}` : `a até ${res.raioKm.toLocaleString("pt-BR")} km`);
export const totalPois = (res: ResultadoPois) => (res.categoria === "academias" ? res.lugares.filter((l) => l.rede !== "World Gym").length : res.total);

/**
 * Nomes que o Google marca como lugar de exercício mas não disputam o aluno da World Gym (pedido do dono, 23/11/2026): quadras, campos,
 * parques, praças, escolas, institutos, associações, pilates e capoeira. Saem da contagem e da lista de academias concorrentes.
 */
export const NAO_ACADEMIA = /\b(quadras?|campos?|society|parques?|parquinho|pra[çc]as?|institutos?|escolas?|col[eé]gios?|associa[çc][aã]o|capoeira|pilates|igrejas?|condom[ií]nios?)\b/i;
/** Nome com cara de academia fica sempre (ex.: "Academia Campos" não sai por causa de "campos"). */
const EH_ACADEMIA = /academia|fitness|\bgym\b|\bfit\b|crossfit|muscula[çc][aã]o/i;
export const ehAcademiaConcorrente = (nome: string) => EH_ACADEMIA.test(nome) || !NAO_ACADEMIA.test(nome);

export async function buscarPois(c: [number, number], raioKm: number, categoria: string): Promise<ResultadoPois> {
  const r = await authFetch(`${API_BASE}/estudos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "pois", c, raioKm, categoria }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Não consegui buscar agora.");
  const res = j as ResultadoPois;
  if (res.categoria !== "academias") return res;
  const lugares = res.lugares.filter((l) => ehAcademiaConcorrente(l.nome));
  return { ...res, lugares, total: lugares.length, foraDaConta: res.lugares.length - lugares.length };
}

/** Cor de cada grande rede no mapa (fundo e texto, aproximada da marca), para reconhecer a concorrente de longe, como no Mapfry. */
export const COR_REDE: Record<string, [string, string]> = {
  "Smart Fit": ["#ffc20e", "#111111"], Bluefit: ["#0a4da2", "#ffffff"], Selfit: ["#f26522", "#ffffff"], Panobianco: ["#111111", "#ffd100"],
  Bodytech: ["#111111", "#ffffff"], "Bio Ritmo": ["#e30613", "#ffffff"], Skyfit: ["#00a3e0", "#ffffff"], Pratique: ["#e4002b", "#ffffff"],
  "Contorno do Corpo": ["#7b2d8e", "#ffffff"], Justfit: ["#00a651", "#ffffff"], "i9 Fit": ["#5b2c83", "#ffffff"], "World Gym": ["#c41230", "#ffffff"],
};
const corRede = (rede: string | null) => (rede ? COR_REDE[rede] ?? ["#1b2130", "#ffffff"] : null);
const curto = (s: string) => (s.length > 24 ? `${s.slice(0, 23)}…` : s);
const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]!));

export const CSS_POIS = `
.poi{display:flex;align-items:center;gap:4px;white-space:nowrap;pointer-events:auto}
.poi-ponto{width:10px;height:10px;border-radius:50%;background:#1f5f8b;border:2px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,.35);flex:none}
.poi-nome{font:600 11px/1.2 Inter,sans-serif;color:#1b2130;background:rgba(255,255,255,.92);padding:1px 5px;border-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,.18)}
.poi-rede .poi-ponto{background:#1b2130;width:12px;height:12px}
.poi-rede .poi-nome{font-weight:700;color:#fff;background:#1b2130}
.poi-num{width:20px;height:20px;border-radius:50%;background:#1f5f8b;color:#fff;font:700 10px/20px Inter,sans-serif;text-align:center;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35)}
.poi-num.rede{background:#1b2130}
.poi-grupo{width:30px;height:30px;border-radius:50%;background:rgba(31,95,139,.9);color:#fff;font:700 12px/30px Inter,sans-serif;text-align:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)}
`;

/** Desenha os lugares no grupo de camadas. Devolve a função que esconde etiquetas sobrepostas (chamar depois de mover/zoom). */
export function desenharPois(L: Leaflet, mapa: import("leaflet").Map, grupo: import("leaflet").LayerGroup, res: ResultadoPois, modo: ModoPois) {
  grupo.clearLayers();
  // na área de deslocamento o contorno já está no mapa; no raio, o círculo mostra até onde foi a busca
  if (!res.areaRotulo) L.circle(res.c, { radius: res.raioKm * 1000, color: "#1f5f8b", weight: 1.5, dashArray: "6 5", fill: false, interactive: false }).addTo(grupo);
  const zoom = mapa.getZoom();
  const itens = res.lugares.map((l, i) => ({ l, i }));
  // longe (zoom < 12): junta os lugares próximos em bolinhas com o número
  if (zoom < 12) {
    const celulas = new Map<string, typeof itens>();
    for (const it of itens) { const p = mapa.latLngToLayerPoint(it.l.c); const k = `${Math.floor(p.x / 56)}_${Math.floor(p.y / 56)}`; (celulas.get(k) ?? celulas.set(k, []).get(k)!).push(it); }
    for (const g of celulas.values()) {
      if (g.length === 1) { const { l, i } = g[0], cr = corRede(l.rede); L.marker(l.c, { icon: L.divIcon({ className: "", iconSize: [20, 20], iconAnchor: [10, 10], html: `<div class="poi-num${l.rede ? " rede" : ""}" data-poi-num="${i + 1}"${cr ? ` style="background:${cr[0]};color:${cr[1]}"` : ""}>${i + 1}</div>` }) }).bindTooltip(esc(l.nome)).addTo(grupo); continue; }
      const lat = g.reduce((a, x) => a + x.l.c[0], 0) / g.length, lng = g.reduce((a, x) => a + x.l.c[1], 0) / g.length;
      L.marker([lat, lng], { icon: L.divIcon({ className: "", iconSize: [30, 30], iconAnchor: [15, 15], html: `<div class="poi-grupo" data-poi-num="${g.length}">${g.length}</div>` }) }).bindTooltip(`${g.length} lugares (aproxime para ver os nomes)`).addTo(grupo);
    }
    return () => {};
  }
  for (const { l, i } of itens) {
    const cr = corRede(l.rede);
    const html = modo === "numeros"
      ? `<div class="poi-num${l.rede ? " rede" : ""}" data-poi-num="${i + 1}"${cr ? ` style="background:${cr[0]};color:${cr[1]}"` : ""}>${i + 1}</div>`
      : `<div class="poi${l.rede ? " poi-rede" : ""}" data-poi-nome="${esc(curto(l.nome))}" data-poi-prioridade="${l.rede ? 0 : 1}"><span class="poi-ponto"${cr ? ` style="background:${cr[0]}"` : ""}></span><span class="poi-nome"${cr ? ` style="background:${cr[0]};color:${cr[1]}"` : ""}>${esc(curto(l.nome))}</span></div>`;
    L.marker(l.c, { zIndexOffset: l.rede ? 600 : 500, icon: L.divIcon({ className: "", iconSize: modo === "numeros" ? [20, 20] : [10, 10], iconAnchor: modo === "numeros" ? [10, 10] : [7, 7], html }) })
      .bindTooltip(`<strong>${esc(l.nome)}</strong><br/>${esc(l.endereco)}<br/>${l.km.toLocaleString("pt-BR")} km`, { direction: "top" }).addTo(grupo);
  }
  // esconde as etiquetas que encostam numa já mostrada (redes primeiro, depois as mais perto)
  const arrumar = () => {
    const els = Array.from(mapa.getContainer().querySelectorAll<HTMLElement>(".poi[data-poi-nome]"));
    els.sort((a, b) => Number(a.dataset.poiPrioridade) - Number(b.dataset.poiPrioridade));
    const mostrados: DOMRect[] = [];
    for (const e of els) {
      const nome = e.querySelector<HTMLElement>(".poi-nome");
      if (!nome) continue;
      nome.style.visibility = "visible";
      const r = nome.getBoundingClientRect();
      const bate = mostrados.some((m) => r.left < m.right + 2 && r.right > m.left - 2 && r.top < m.bottom + 1 && r.bottom > m.top - 1);
      if (bate) nome.style.visibility = "hidden"; else mostrados.push(r);
    }
  };
  requestAnimationFrame(arrumar);
  return arrumar;
}

/** Controle "Academias concorrentes" (no canto de baixo do mapa): categoria, raio e buscar. `aviso`: pergunta antes de mandar a posição ao Google (pontos novos). */
export function ControlePois({ centro, aviso, aoResultado, modo, setModo, temResultado, area, res, embutido }: {
  centro: [number, number] | null; aviso: boolean; aoResultado: (r: ResultadoPois | null) => void; modo: ModoPois; setModo: (m: ModoPois) => void; temResultado: boolean;
  /** O resultado mostrado (para o cartão com o total, como no Mapfry). */
  res?: ResultadoPois | null;
  /** Dentro da aba "Lugares por perto" do painel de camadas: o formulário fica aberto, sem botão flutuante sobre o mapa. */
  embutido?: boolean;
  /** Área de deslocamento: a busca cobre a área e só ficam os lugares de dentro (sem escolher raio). */
  area?: { geometria: Geometria; rotulo: string } | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [categoria, setCategoria] = useState("academias");
  const [raio, setRaio] = useState(2);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState("");
  const avisou = useRef(false);
  const buscar = async () => {
    if (!centro) return;
    if (aviso && !avisou.current && !window.confirm("Para buscar, a posição deste ponto será enviada ao Google. Continuar?")) return;
    avisou.current = true;
    setBuscando(true); setErro("");
    try {
      if (area) {
        const r = await buscarPois(centro, raioQueCobre(centro, area.geometria), categoria);
        const lugares = r.lugares.filter((l) => dentroDaArea(l.c[0], l.c[1], area.geometria));
        aoResultado({ ...r, lugares, total: lugares.length, areaRotulo: area.rotulo });
      } else aoResultado(await buscarPois(centro, raio, categoria));
      setAberto(false);
    } catch (e) { setErro((e as Error).message); } finally { setBuscando(false); }
  };
  if (embutido) return (
    <div className="space-y-3 text-foreground">
      <label className="block text-xs font-medium text-muted-foreground">O que buscar
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="mt-1 h-9 w-full rounded-lg border bg-white px-2 text-sm text-foreground">
          {CATEGORIAS_POIS.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
        </select>
      </label>
      {area ? <p className="text-xs text-muted-foreground">Onde: <b className="text-foreground">área de {area.rotulo}</b> (a linha verde do mapa)</p> : (
        <label className="block text-xs font-medium text-muted-foreground">Raio: <b className="text-foreground">{raio.toLocaleString("pt-BR")} km</b>
          <input type="range" min={0.5} max={5} step={0.5} value={raio} onChange={(e) => setRaio(Number(e.target.value))} className="mt-1 w-full accent-primary" />
        </label>
      )}
      {erro && <p className="text-xs text-destructive">{erro}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={buscar} disabled={buscando || !centro} className="flex-1">{buscando ? "Buscando…" : "Buscar"}</Button>
        {temResultado && <Button size="sm" variant="outline" onClick={() => aoResultado(null)}>Limpar</Button>}
      </div>
      {res && (
        <div className="rounded-lg bg-muted px-2.5 py-2">
          <div className="flex items-baseline gap-2"><b className="text-xl font-semibold tabular-nums text-primary">{totalPois(res)}</b><span className="text-[12px]">{totalPois(res) === 1 ? CATEGORIAS_POIS.find((c) => c.id === res.categoria)?.singular ?? "lugar" : rotuloPois(res).toLowerCase()}</span></div>
          <p className="text-[11px] text-muted-foreground">{ondePois(res)}{res.categoria === "academias" && totalPois(res) !== res.total ? " · sem contar as World Gym" : ""}{res.lugares.some((l) => l.rede && l.rede !== "World Gym") ? ` · redes: ${[...new Set(res.lugares.map((l) => l.rede).filter((r): r is string => !!r && r !== "World Gym"))].join(", ")}` : ""}</p>
        </div>
      )}
      {temResultado && (
        <div className="flex gap-1.5" role="group" aria-label="Como mostrar os lugares">
          {(["nomes", "numeros"] as ModoPois[]).map((m) => (
            <Pilula key={m} ativo={modo === m} onClick={() => setModo(m)}>{m === "nomes" ? "Nomes no mapa" : "Números + lista"}</Pilula>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">Dados do Google. A mesma busca fica guardada por 90 dias. A lista completa aparece embaixo do mapa.</p>
    </div>
  );
  return (
    // botão embaixo à esquerda e, ao lado dele (não em cima, para não cobrir o painel de camadas), o total e o modo de mostrar
    <div className="pointer-events-auto relative flex items-end gap-2">
      <Button variant="outline" aria-expanded={aberto} onClick={() => setAberto((a) => !a)} disabled={!centro} className="bg-white shadow-lg aria-expanded:ring-2 aria-expanded:ring-foreground">
        <MapPinned className="h-4 w-4 text-primary" aria-hidden />Academias concorrentes
      </Button>
      {aberto && (
        <div className="absolute bottom-12 left-0 z-[700] w-72 space-y-3 rounded-xl border bg-white p-3 shadow-2xl">
          <label className="block text-xs font-medium text-muted-foreground">O que buscar
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="mt-1 h-9 w-full rounded-lg border bg-white px-2 text-sm text-foreground">
              {CATEGORIAS_POIS.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
            </select>
          </label>
          {area ? <p className="text-xs text-muted-foreground">Onde: <b className="text-foreground">área de {area.rotulo}</b> (a linha verde do mapa)</p> : (
            <label className="block text-xs font-medium text-muted-foreground">Raio: <b className="text-foreground">{raio.toLocaleString("pt-BR")} km</b>
              <input type="range" min={0.5} max={5} step={0.5} value={raio} onChange={(e) => setRaio(Number(e.target.value))} className="mt-1 w-full accent-primary" />
            </label>
          )}
          {erro && <p className="text-xs text-destructive">{erro}</p>}
          <div className="flex gap-2">
            <Button onClick={buscar} disabled={buscando} className="flex-1">{buscando ? "Buscando…" : "Buscar"}</Button>
            {temResultado && <Button variant="outline" onClick={() => { aoResultado(null); setAberto(false); }}>Limpar</Button>}
          </div>
          <p className="text-[11px] text-muted-foreground">Dados do Google. A mesma busca fica guardada por 90 dias.</p>
        </div>
      )}
      {(res || temResultado) && <div className="flex flex-col items-start gap-1.5">
      {res && (
        <div className="max-w-xs rounded-xl border bg-white px-3 py-2 shadow-lg">
          <div className="flex items-baseline gap-2"><b className="text-2xl font-semibold tabular-nums text-primary">{totalPois(res)}</b><span className="text-sm text-foreground">{totalPois(res) === 1 ? CATEGORIAS_POIS.find((c) => c.id === res.categoria)?.singular ?? "lugar" : rotuloPois(res).toLowerCase()}</span></div>
          <p className="text-[11px] text-muted-foreground">{ondePois(res)}{res.categoria === "academias" && totalPois(res) !== res.total ? " · sem contar as World Gym" : ""}{res.lugares.some((l) => l.rede && l.rede !== "World Gym") ? ` · redes: ${[...new Set(res.lugares.map((l) => l.rede).filter((r): r is string => !!r && r !== "World Gym"))].join(", ")}` : ""}</p>
        </div>
      )}
      {temResultado && (
        <div className="flex gap-1.5" role="group" aria-label="Como mostrar os lugares">
          {(["nomes", "numeros"] as ModoPois[]).map((m) => (
            <Pilula key={m} ativo={modo === m} onClick={() => setModo(m)} className="bg-white shadow">{m === "nomes" ? "Nomes no mapa" : "Números + lista"}</Pilula>
          ))}
        </div>
      )}
      </div>}
    </div>
  );
}

/** Hook: redesenha os lugares quando muda o resultado, o modo ou o zoom. */
export function usePoisNoMapa(mapa: { L: Leaflet; mapa: import("leaflet").Map } | null, res: ResultadoPois | null, modo: ModoPois) {
  useEffect(() => {
    if (!mapa) return;
    const grupo = mapa.L.layerGroup().addTo(mapa.mapa);
    let arrumar = () => {};
    const desenhar = () => { arrumar = res ? desenharPois(mapa.L, mapa.mapa, grupo, res, modo) : (grupo.clearLayers(), () => {}); };
    const mover = () => arrumar();
    desenhar();
    mapa.mapa.on("zoomend", desenhar);
    mapa.mapa.on("moveend", mover);
    return () => { mapa.mapa.off("zoomend", desenhar); mapa.mapa.off("moveend", mover); grupo.remove(); };
  }, [mapa, res, modo]);
}

/** Seção do estudo com a contagem e a lista numerada (a mesma ordem dos números no mapa). */
export function SecaoPois({ res }: { res: ResultadoPois }) {
  const cat = CATEGORIAS_POIS.find((c) => c.id === res.categoria);
  const total = totalPois(res);
  const redes = [...new Set(res.lugares.map((l) => l.rede).filter((r): r is string => !!r && r !== "World Gym"))];
  return (
    <Secao icone={MapPinned} titulo={`${rotuloPois(res)} ${ondePois(res)}`} className="lg:col-span-2">
      <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div className="text-center">
          <div className="font-display text-[44px] font-semibold leading-none text-primary">{total}</div>
          <div className="mt-1 text-sm text-muted-foreground">{total === 1 ? cat?.singular ?? "lugar" : rotuloPois(res).toLowerCase()}</div>
          {res.categoria === "academias" && total !== res.total && <div className="mt-1 text-xs text-muted-foreground">sem contar as World Gym</div>}
          {redes.length > 0 && <div className="mt-3 text-xs text-muted-foreground">Grandes redes: <b className="text-foreground">{redes.join(", ")}</b></div>}
          {res.foraDaConta ? <div className="mt-2 text-xs text-muted-foreground">{res.foraDaConta} {res.foraDaConta === 1 ? "lugar que não é academia ficou" : "lugares que não são academia (quadras, campos, parques…) ficaram"} de fora.</div> : null}
          {res.cortado && <div className="mt-2 text-xs text-warning">Área com muitos lugares: a lista mostra os 220 mais perto.</div>}
        </div>
        <div className="max-h-72 overflow-y-auto pr-1 sm:columns-2 sm:gap-6">
          {res.lugares.map((l, i) => <div key={`${l.nome}-${i}`} className="break-inside-avoid"><Linha rotulo={<><b className="mr-1.5 tabular-nums text-muted-foreground">{i + 1}.</b>{l.rede ? <b>{l.nome}</b> : l.nome}</>} valor={`${l.km.toLocaleString("pt-BR")} km`} /></div>)}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Fonte: Google. Os números seguem a ordem de distância e são os mesmos do mapa no modo "Números + lista".</p>
    </Secao>
  );
}
