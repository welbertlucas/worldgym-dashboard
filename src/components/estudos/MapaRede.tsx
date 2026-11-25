// Mapa da rede: só as unidades World Gym (Low Cost e Pro), sem os estudos de cada uma. Clique numa unidade abre o estudo dela.
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CREDITO_DO_MAPA, pino, camadaRuas, aplicarFundo, carregarLeaflet, pinoUnidade, URL_SAT, type Fundo, type Leaflet } from "@/components/estudos/mapaComum";
import { BarraMapa, TelaDeMapa, useAlturaAteOFim } from "@/components/estudos/controlesMapa";
import { StreetView } from "@/components/estudos/StreetView";
import { DECISAO_ROTULO, reais, type Ponto, type UnidadeEstudo } from "@/lib/estudoPonto";
import { carregarObras } from "@/components/tabs/ObrasTab";
import { ehDono, podeVerObras } from "@/lib/auth";
import { type Obra, dataBR, diasDeAtraso, inauguracao, proximoMarco, situacao } from "@/lib/obras";

const COR = { low: "#c41230", pro: "#1b2130" } as const;
const NOME = { low: "Low Cost", pro: "Pro" } as const;
/** Status da rede no mapa: unidades em operação (pino com a marca), obras em andamento e pontos em estudo (em análise e aprovados). */
export const COR_OBRA = "#d97706";
export const COR_PONTO = { analise: "#5b6577", aprovado: "#15803d" } as const;
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

export function MapaRede({ unidades, abrir, voltar, pontos = [], abrirPonto }: { unidades: UnidadeEstudo[]; abrir?: (nome: string) => void; voltar: () => void; pontos?: Ponto[]; abrirPonto?: (id: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const ref = useRef<{ L: Leaflet; mapa: import("leaflet").Map; grupo: import("leaflet").FeatureGroup; ruas: import("leaflet").TileLayer; sat: import("leaflet").TileLayer } | null>(null);
  const [pronto, setPronto] = useState(false);
  // os mesmos controles do mapa da unidade: fundo (padrão, cinza, satélite), régua, Street View e zoom
  const [fundo, setFundo] = useState<Fundo>("padrao");
  const caixa = useRef<HTMLDivElement>(null);
  const altura = useAlturaAteOFim(caixa, 480, 0);
  useEffect(() => { ref.current?.mapa.invalidateSize(); }, [altura]);
  const [verRua, setVerRua] = useState(false);
  const [rua, setRua] = useState<[number, number] | null>(null);
  const comPosicao = unidades.filter((u) => u.c);
  // obras em andamento (só quem pode ver Unidades em obra) e pontos em estudo
  const [obras, setObras] = useState<Obra[]>([]);
  const [verObras, setVerObras] = useState(true), [verPontos, setVerPontos] = useState(true);
  useEffect(() => {
    if (!(ehDono() || podeVerObras())) return;
    let vivo = true;
    carregarObras().then((e) => { if (vivo && e.fase === "pronto") setObras(e.obras); });
    return () => { vivo = false; };
  }, []);
  const obrasNoMapa = obras.filter((o) => o.c && situacao(o) !== "concluida");
  const obrasSemPosicao = obras.filter((o) => !o.c && situacao(o) !== "concluida").length;
  const pontosNoMapa = pontos.filter((p) => p.c && (p.decisao?.status ?? "analise") !== "recusado" && (p.decisao?.status ?? "analise") !== "unidade");
  useEffect(() => {
    let vivo = true;
    carregarLeaflet().then((L) => {
      if (!vivo || !el.current) return;
      const mapa = L.map(el.current, { zoomControl: false, scrollWheelZoom: true, wheelPxPerZoomLevel: 90 }).setView([-15.8, -47.9], 5);
      mapa.attributionControl.setPrefix(CREDITO_DO_MAPA);
      const ruas = camadaRuas(L).addTo(mapa);
      const sat = L.tileLayer(URL_SAT, { maxZoom: 19, attribution: "Imagens © Esri", crossOrigin: "anonymous" });
      ref.current = { L, mapa, grupo: L.featureGroup().addTo(mapa), ruas, sat };
      setPronto(true);
    });
    return () => { vivo = false; ref.current?.mapa.remove(); ref.current = null; };
  }, []);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    m.grupo.clearLayers();
    for (const u of comPosicao) {
      const mk = m.L.marker(u.c as [number, number], { title: u.nome, icon: pinoUnidade(m.L, COR[u.modelo], 30) })
        .bindTooltip(`<strong>World Gym ${u.nome}</strong><br/>${NOME[u.modelo]}${u.m2 ? ` · ${u.m2.toLocaleString("pt-BR")} m²` : ""}${u.vendas ? `<br/>${reais(u.vendas)} por mês` : ""}${u.alunos ? ` · ${u.alunos.toLocaleString("pt-BR")} alunos` : ""}${abrir ? "<br/><em>clique para abrir o estudo</em>" : ""}`, { direction: "top" })
        .addTo(m.grupo);
      if (abrir) mk.on("click", () => abrir(u.nome));
    }
    if (verObras) for (const o of obrasNoMapa) {
      const prox = proximoMarco(o), atraso = diasDeAtraso(o), inaug = inauguracao(o);
      m.L.marker(o.c as [number, number], { title: o.nome, zIndexOffset: 400, icon: pino(m.L, COR_OBRA, 28) })
        .bindTooltip(`<strong>Em obra: ${esc(o.nome)}</strong>${o.cidade ? `<br/>${esc(o.cidade)}` : ""}<br/>${prox ? `Próximo: ${esc(prox.nome)}` : "Todos os marcos concluídos"}${atraso > 0 ? ` · <span style="color:#b91c1c">${atraso} ${atraso === 1 ? "dia" : "dias"} de atraso</span>` : ""}<br/>Inauguração prevista: ${dataBR(inaug)}`, { direction: "top" })
        .addTo(m.grupo);
    }
    if (verPontos) for (const p of pontosNoMapa) {
      const st = (p.decisao?.status ?? "analise") as "analise" | "aprovado";
      const mk = m.L.marker(p.c, { title: p.nome, zIndexOffset: 300, icon: pino(m.L, COR_PONTO[st], 24) })
        .bindTooltip(`<strong>Ponto em estudo: ${esc(p.nome)}</strong><br/>${DECISAO_ROTULO[st]} · ${NOME[p.modelo]}${p.m2 ? ` · ${p.m2.toLocaleString("pt-BR")} m²` : ""}${abrirPonto ? "<br/><em>clique para abrir o estudo</em>" : ""}`, { direction: "top" })
        .addTo(m.grupo);
      if (abrirPonto) mk.on("click", () => abrirPonto(p.id));
    }
    if (m.grupo.getLayers().length) m.mapa.fitBounds(m.grupo.getBounds(), { padding: [40, 40], maxZoom: 11 });
  }, [pronto, unidades, abrir, obras, pontos, verObras, verPontos]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ref.current) aplicarFundo(ref.current, fundo); }, [fundo, pronto]);
  // "Ver a rua": o próximo clique no mapa abre o Street View daquele lugar
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    m.mapa.getContainer().style.cursor = verRua ? "crosshair" : "";
    if (!verRua) return;
    const aoClicar = (e: import("leaflet").LeafletMouseEvent) => { setRua([e.latlng.lat, e.latlng.lng]); setVerRua(false); };
    m.mapa.once("click", aoClicar);
    return () => { m.mapa.off("click", aoClicar); };
  }, [verRua, pronto]);
  const n = (mod: "low" | "pro") => comPosicao.filter((u) => u.modelo === mod).length;
  return (
    <TelaDeMapa caixaRef={caixa} altura={altura} vista="mapa" setVista={() => {}} temEstudo={false}
      titulo="Mapa da rede"
      subtitulo={abrir ? "Clique numa unidade para abrir o estudo dela" : undefined}
      navegacao={<Button variant="outline" size="sm" className="h-7 px-2 text-[12px]" onClick={voltar}>Todos os estudos</Button>}
      acoes={<div className="flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COR.low }} />{n("low")} Low Cost</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COR.pro }} />{n("pro")} Pro</span>
        <span>{comPosicao.length} unidades em operação</span>
        {obrasNoMapa.length > 0 && <button type="button" aria-pressed={verObras} onClick={() => setVerObras((v) => !v)} className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 ${verObras ? "border-border text-foreground" : "border-dashed opacity-60"}`} title={obrasSemPosicao ? `${obrasSemPosicao} obra(s) sem posição não aparecem no mapa` : "Mostrar ou esconder as obras"}><span className="h-2.5 w-2.5 rounded-full" style={{ background: COR_OBRA }} />{obrasNoMapa.length} em obra</button>}
        {pontosNoMapa.length > 0 && <button type="button" aria-pressed={verPontos} onClick={() => setVerPontos((v) => !v)} className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 ${verPontos ? "border-border text-foreground" : "border-dashed opacity-60"}`} title="Mostrar ou esconder os pontos em estudo"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COR_PONTO.analise }} />{pontosNoMapa.length} em estudo</button>}
      </div>}
      mapa={<>
        <style>{`.mapa-cinza .leaflet-tile-pane{filter:grayscale(1) contrast(.9) brightness(1.06)}`}</style>
        <div ref={el} className="absolute inset-0" aria-label="Mapa das unidades da rede" />
        {verRua && <div className="absolute left-1/2 top-3 z-[456] -translate-x-1/2 rounded-lg bg-foreground px-3 py-1.5 text-xs text-background shadow">Clique no mapa onde quer ver a rua</div>}
        <BarraMapa mapa={pronto ? ref.current?.mapa ?? null : null} fundo={fundo} setFundo={setFundo} verRua={verRua} setVerRua={setVerRua} />
        {rua && <StreetView ponto={rua} fechar={() => setRua(null)} />}
      </>}
    />
  );
}
