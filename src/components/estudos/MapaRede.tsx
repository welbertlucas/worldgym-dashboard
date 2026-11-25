// Mapa da rede: só as unidades World Gym (Low Cost e Pro), sem os estudos de cada uma. Clique numa unidade abre o estudo dela.
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CREDITO_DO_MAPA, camadaRuas, aplicarFundo, carregarLeaflet, pino, URL_SAT, type Fundo, type Leaflet } from "@/components/estudos/mapaComum";
import { BarraMapa, TelaDeMapa, useAlturaAteOFim } from "@/components/estudos/controlesMapa";
import { StreetView } from "@/components/estudos/StreetView";
import { reais, type UnidadeEstudo } from "@/lib/estudoPonto";

const COR = { low: "#c41230", pro: "#1b2130" } as const;
const NOME = { low: "Low Cost", pro: "Pro" } as const;

export function MapaRede({ unidades, abrir, voltar }: { unidades: UnidadeEstudo[]; abrir?: (nome: string) => void; voltar: () => void }) {
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
      const mk = m.L.marker(u.c as [number, number], { title: u.nome, icon: pino(m.L, COR[u.modelo], 30) })
        .bindTooltip(`<strong>World Gym ${u.nome}</strong><br/>${NOME[u.modelo]}${u.m2 ? ` · ${u.m2.toLocaleString("pt-BR")} m²` : ""}${u.vendas ? `<br/>${reais(u.vendas)} por mês` : ""}${u.alunos ? ` · ${u.alunos.toLocaleString("pt-BR")} alunos` : ""}${abrir ? "<br/><em>clique para abrir o estudo</em>" : ""}`, { direction: "top" })
        .addTo(m.grupo);
      if (abrir) mk.on("click", () => abrir(u.nome));
    }
    if (comPosicao.length) m.mapa.fitBounds(m.grupo.getBounds(), { padding: [40, 40], maxZoom: 11 });
  }, [pronto, unidades, abrir]); // eslint-disable-line react-hooks/exhaustive-deps
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
        <span>{comPosicao.length} unidades</span>
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
