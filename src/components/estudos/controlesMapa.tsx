// Controles dos mapas dos estudos, no arranjo do Mapfry: busca de endereço no alto à direita, painel de camadas no alto à esquerda
// (com a legenda da camada aberta) e barra horizontal embaixo à direita (mapa/satélite, Street View e zoom).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Eye, EyeOff, Layers, Ruler, Search, X } from "lucide-react";
import { API_BASE, authFetch } from "@/lib/auth";
import { IconeBoneco } from "@/components/estudos/StreetView";

export interface ItemCamada { id: string; rotulo: string }
/** Camada que fica por cima da escolhida (ex.: academias concorrentes depois de buscar): liga e desliga sozinha. */
export interface Sobreposicao { id: string; rotulo: string; ativo: boolean; alternar: () => void; legenda?: ReactNode; remover?: () => void }

/** Painel de camadas no alto à esquerda: uma camada por vez, com a legenda dela embaixo. Recolhe no celular. */
/**
 * `vazia`: a camada sem nada pintado (ex.: "limpa"). Com ela, o olho do topo desliga todas as camadas de uma vez (a escolhida e as de
 * cima do mapa) e, clicado de novo, volta ao que estava ligado.
 */
export function PainelCamadas({ itens, atual, escolher, legenda, topo = "top-3", sobre = [], vazia }: { itens: ItemCamada[]; atual: string; escolher: (id: string) => void; legenda?: ReactNode; topo?: string; sobre?: Sobreposicao[]; vazia?: string }) {
  const [aberto, setAberto] = useState(() => typeof window === "undefined" || window.innerWidth >= 768);
  const guardado = useRef<{ camada: string; sobre: string[] } | null>(null);
  const tudoDesligado = !!vazia && atual === vazia && sobre.every((o) => !o.ativo);
  const alternarTudo = () => {
    if (!vazia) return;
    if (tudoDesligado) {
      const g = guardado.current;
      escolher(g?.camada ?? itens[0]?.id ?? atual);
      for (const o of sobre) if (g?.sobre.includes(o.id) && !o.ativo) o.alternar();
      guardado.current = null;
    } else {
      guardado.current = { camada: atual === vazia ? guardado.current?.camada ?? itens[0]?.id ?? atual : atual, sobre: sobre.filter((o) => o.ativo).map((o) => o.id) };
      escolher(vazia);
      for (const o of sobre) if (o.ativo) o.alternar();
    }
  };
  return (
    <div className={`absolute left-3 ${topo} z-[455] w-64 max-w-[calc(100%-1.5rem)] overflow-hidden rounded-xl border bg-white/95 shadow-lg backdrop-blur`}>
      <div className="flex items-center">
        <button type="button" onClick={() => setAberto((a) => !a)} aria-expanded={aberto} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-sm font-semibold">
          <Layers className="h-4 w-4 text-primary" aria-hidden />Camadas
          <ChevronDown className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${aberto ? "rotate-180" : ""}`} aria-hidden />
        </button>
        {vazia && (
          <button type="button" onClick={alternarTudo} aria-pressed={tudoDesligado}
            title={tudoDesligado ? "Mostrar as camadas de novo" : "Desligar todas as camadas"} aria-label={tudoDesligado ? "Mostrar as camadas de novo" : "Desligar todas as camadas"}
            className="mr-1.5 grid h-8 w-8 flex-none place-items-center rounded-lg hover:bg-muted">
            {tudoDesligado ? <EyeOff className="h-4 w-4 text-muted-foreground" aria-hidden /> : <Eye className="h-4 w-4 text-foreground" aria-hidden />}
          </button>
        )}
      </div>
      {aberto && (
        <div className="max-h-[52vh] space-y-1 overflow-y-auto border-t px-2 py-2">
          {sobre.length > 0 && <p className="px-2.5 pb-1 text-[11px] font-medium text-muted-foreground">Por cima do mapa</p>}
          {sobre.map((o) => (
            <div key={o.id} className={`rounded-lg ${o.ativo ? "bg-muted" : ""}`}>
              <button type="button" aria-pressed={o.ativo} onClick={o.alternar}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-muted aria-pressed:font-semibold">
                <span className="flex-1">{o.rotulo}</span>
                {o.ativo ? <Eye className="h-4 w-4 text-foreground" aria-hidden /> : <EyeOff className="h-4 w-4 text-muted-foreground/60" aria-hidden />}
              </button>
              {o.ativo && (o.legenda || o.remover) && (
                <div className="px-2.5 pb-2.5 text-xs text-muted-foreground">
                  {o.legenda}
                  {o.remover && <button type="button" onClick={o.remover} className="mt-1 block font-medium text-foreground underline underline-offset-2">Apagar a busca</button>}
                </div>
              )}
            </div>
          ))}
          {sobre.length > 0 && <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium text-muted-foreground">Camada do mapa</p>}
          {itens.map((i) => {
            const ativo = i.id === atual;
            return (
              <div key={i.id} className={`rounded-lg ${ativo ? "bg-muted" : ""}`}>
                <button type="button" aria-pressed={ativo} onClick={() => escolher(i.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-muted aria-pressed:font-semibold">
                  <span className="flex-1">{i.rotulo}</span>
                  {ativo ? <Eye className="h-4 w-4 text-foreground" aria-hidden /> : <EyeOff className="h-4 w-4 text-muted-foreground/60" aria-hidden />}
                </button>
                {ativo && legenda && <div className="px-2.5 pb-2.5 text-xs text-muted-foreground">{legenda}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const fmtDist = (m: number) => (m >= 1000 ? `${(m / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km` : `${Math.round(m)} m`);

/** Barra horizontal embaixo à direita: miniatura que troca mapa/satélite e barra com Street View, + zoom −. */
export function BarraMapa({ mapa, satelite, setSatelite, verRua, setVerRua }: {
  mapa: import("leaflet").Map | null; satelite: boolean; setSatelite: (f: (s: boolean) => boolean) => void; verRua: boolean; setVerRua: (f: (v: boolean) => boolean) => void;
}) {
  const [zoom, setZoom] = useState(() => Math.round(mapa?.getZoom() ?? 13));
  const [centro, setCentro] = useState<[number, number]>(() => { const c = mapa?.getCenter(); return c ? [c.lat, c.lng] : [-15.8, -47.9]; });
  useEffect(() => {
    if (!mapa) return;
    const ao = () => { setZoom(Math.round(mapa.getZoom())); const c = mapa.getCenter(); setCentro([c.lat, c.lng]); };
    ao(); mapa.on("zoomend moveend", ao);
    return () => { mapa.off("zoomend moveend", ao); };
  }, [mapa]);
  // Régua (como no Mapfry): cada clique no mapa marca um ponto; a distância total pelos pontos aparece no último. Desligar apaga a medida.
  const [medindo, setMedindo] = useState(false);
  const [distancia, setDistancia] = useState(0);
  useEffect(() => {
    if (!mapa || !medindo) return;
    let vivo = true, grupo: import("leaflet").LayerGroup | null = null;
    const pts: import("leaflet").LatLng[] = [];
    const el = mapa.getContainer();
    let inicio: { x: number; y: number } | null = null;
    const aoApertar = (ev: MouseEvent) => { inicio = { x: ev.clientX, y: ev.clientY }; };
    let aoSoltar: ((ev: MouseEvent) => void) | null = null;
    const cursor = el.style.cursor;
    el.style.cursor = "crosshair";
    mapa.doubleClickZoom.disable();
    import("leaflet").then((mod) => {
      if (!vivo) return;
      const L = (mod as unknown as { default?: typeof import("leaflet") }).default ?? (mod as typeof import("leaflet"));
      grupo = L.layerGroup().addTo(mapa);
      // Clique direto na área do mapa (o Leaflet não repassa ao mapa o clique feito em cima de hexágono ou pino); arrastar não marca ponto.
      aoSoltar = (ev) => {
        if (ev.button !== 0 || !inicio || Math.hypot(ev.clientX - inicio.x, ev.clientY - inicio.y) > 5) return;
        pts.push(mapa.mouseEventToLatLng(ev));
        grupo!.clearLayers();
        let total = 0;
        for (let i = 1; i < pts.length; i++) total += mapa.distance(pts[i - 1], pts[i]);
        setDistancia(total);
        if (pts.length > 1) L.polyline(pts, { color: "#1b2130", weight: 3, dashArray: "6 6", interactive: false }).addTo(grupo!);
        pts.forEach((p, i) => {
          const mk = L.circleMarker(p, { radius: 5, color: "#fff", weight: 2, fillColor: "#1b2130", fillOpacity: 1, interactive: false }).addTo(grupo!);
          if (i === pts.length - 1 && pts.length > 1) mk.bindTooltip(fmtDist(total), { permanent: true, direction: "right", className: "font-semibold" }).openTooltip();
        });
      };
      el.addEventListener("mousedown", aoApertar, true);
      el.addEventListener("mouseup", aoSoltar, true);
    });
    return () => { vivo = false; el.removeEventListener("mousedown", aoApertar, true); if (aoSoltar) el.removeEventListener("mouseup", aoSoltar, true); grupo?.remove(); el.style.cursor = cursor; mapa.doubleClickZoom.enable(); setDistancia(0); };
  }, [mapa, medindo]);
  // miniatura: o pedaço do lugar atual na outra vista (satélite quando está no mapa, mapa quando está no satélite), borrado
  const z = Math.max(3, Math.min(16, zoom - 2)), n = 2 ** z, rad = (centro[0] * Math.PI) / 180;
  const tx = Math.floor(((centro[1] + 180) / 360) * n), ty = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  const mini = satelite ? `https://tile.openstreetmap.org/${z}/${tx}/${ty}.png` : `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${ty}/${tx}`;
  return (
    <div className="absolute bottom-7 right-3 z-[455] flex items-end gap-2">
      {medindo && (
        <div className="mb-1 rounded-lg bg-foreground px-3 py-1.5 text-xs text-background shadow">
          {distancia > 0 ? <>Distância: <b className="tabular-nums">{fmtDist(distancia)}</b> · clique para continuar</> : "Clique no mapa para começar a medir"}
        </div>
      )}
      <button type="button" onClick={() => setSatelite((s) => !s)} title={satelite ? "Ver mapa" : "Ver satélite"} aria-label={satelite ? "Ver mapa" : "Ver satélite"}
        className="relative h-12 w-16 overflow-hidden rounded-xl border-[3px] border-white bg-muted shadow-lg">
        <img src={mini} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-125 object-cover blur-[1.5px]" />
      </button>
      <div className="flex h-12 items-center rounded-xl bg-white px-1 shadow-lg">
        <button type="button" aria-pressed={medindo} onClick={() => { setMedindo((m) => !m); setVerRua(() => false); }} title={medindo ? "Desligar a régua (apaga a medida)" : "Régua: clique no mapa para medir a distância"}
          className="grid h-10 w-10 place-items-center rounded-lg aria-pressed:bg-foreground aria-pressed:text-background">
          <Ruler className="h-5 w-5" aria-hidden /><span className="sr-only">Régua</span>
        </button>
        <button type="button" aria-pressed={verRua} onClick={() => { setMedindo(false); setVerRua((v) => !v); }} title="Ver a rua (Street View)" className="grid h-10 w-10 place-items-center rounded-lg aria-pressed:bg-foreground aria-pressed:text-background">
          <IconeBoneco /><span className="sr-only">Ver a rua</span>
        </button>
        <span className="mx-1 h-6 w-px bg-border" aria-hidden />
        <button type="button" onClick={() => mapa?.zoomIn()} title="Aproximar" className="grid h-10 w-9 place-items-center rounded-lg text-xl leading-none hover:bg-muted">+</button>
        <span className="w-6 text-center text-sm tabular-nums" aria-label={`Zoom ${zoom}`}>{zoom}</span>
        <button type="button" onClick={() => mapa?.zoomOut()} title="Afastar" className="grid h-10 w-9 place-items-center rounded-lg text-xl leading-none hover:bg-muted">−</button>
      </div>
    </div>
  );
}

interface LugarAchado { nome: string; endereco: string; c: [number, number] }

/** Busca de endereço (Mapbox, pelo servidor). Ao escolher, devolve o lugar; quem usa decide o que fazer (centralizar, marcar). */
export function BuscaEndereco({ perto, aoEscolher }: { perto: [number, number] | null; aoEscolher: (l: LugarAchado) => void }) {
  const [q, setQ] = useState("");
  const [lista, setLista] = useState<LugarAchado[]>([]);
  const [estado, setEstado] = useState<"" | "buscando" | "vazio" | "erro">("");
  const vez = useRef(0), escolhido = useRef("");
  useEffect(() => {
    const texto = q.trim();
    if (texto.length < 4 || texto === escolhido.current) { setLista([]); setEstado(""); return; }
    const minha = ++vez.current;
    const t = setTimeout(async () => {
      setEstado("buscando");
      try {
        const r = await authFetch(`${API_BASE}/estudos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "endereco", q: texto, perto }) });
        const j = await r.json().catch(() => ({}));
        if (minha !== vez.current) return;
        if (!r.ok) { setEstado("erro"); setLista([]); return; }
        setLista(j.lugares ?? []); setEstado((j.lugares ?? []).length ? "" : "vazio");
      } catch { if (minha === vez.current) setEstado("erro"); }
    }, 450);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="absolute right-3 top-3 z-[460] w-72 max-w-[calc(100%-1.5rem)]">
      <div className="flex h-11 items-center gap-2 rounded-xl border bg-white px-3 shadow-lg">
        <Search className="h-4 w-4 flex-none text-muted-foreground" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar endereço" aria-label="Buscar endereço"
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        {q && <button type="button" onClick={() => { setQ(""); setLista([]); }} title="Limpar" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" aria-hidden /></button>}
      </div>
      {(lista.length > 0 || estado) && q.trim().length >= 4 && (
        <div className="mt-1 overflow-hidden rounded-xl border bg-white shadow-2xl">
          {estado === "buscando" && !lista.length && <p className="px-3 py-2.5 text-xs text-muted-foreground">Buscando…</p>}
          {estado === "vazio" && <p className="px-3 py-2.5 text-xs text-muted-foreground">Nenhum endereço encontrado.</p>}
          {estado === "erro" && <p className="px-3 py-2.5 text-xs text-destructive">Não consegui buscar agora.</p>}
          {lista.map((l, i) => (
            <button key={`${l.endereco}-${i}`} type="button" onClick={() => { escolhido.current = l.nome.trim(); vez.current++; aoEscolher(l); setLista([]); setQ(l.nome); setEstado(""); }}
              className="block w-full border-b px-3 py-2 text-left last:border-0 hover:bg-muted">
              <span className="block truncate text-sm font-medium">{l.nome}</span>
              <span className="block truncate text-xs text-muted-foreground">{l.endereco}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
