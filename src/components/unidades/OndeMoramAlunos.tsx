import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import type { UnitData } from "@/data/dashboardData";
import { somarBairros, type MapaDados, type Pino } from "@/data/mapaAlunos";
import { CREDITO_DO_MAPA, URL_SAT, aplicarFundo, camadaRuas, carregarLeaflet, fraseDosBairros, gradienteArco, pino as pinoDoMapa, raioDaBolha, type Fundo, type Leaflet } from "@/components/estudos/mapaComum";
import { BarraMapa } from "@/components/estudos/controlesMapa";
import { StreetView } from "@/components/estudos/StreetView";
import { desenharDemanda } from "@/components/estudos/camadasCenso";
import { suavizarContagem, type Censo } from "@/lib/estudoPonto";
import { API_BASE, authFetch } from "@/lib/auth";

type Bairro = NonNullable<UnitData["bairros"]>[number];

const fmt = (n: number) => n.toLocaleString("pt-BR");
export { raioDaBolha };

type Calor = { censo: Censo; indices: number[]; pesos: number[]; comPosicao: number; total: number };

let censoEmCache: Promise<Censo | null> | null = null;
const lerCenso = () => (censoEmCache ??= authFetch(`${API_BASE}/estudos`).then((r) => (r.ok ? r.json() : null)).then((j) => (j?.censo?.celulas?.length ? (j.censo as Censo) : null)).catch(() => { censoEmCache = null; return null; }));
const lerHex = (unidade: string): Promise<{ celulas: [number, number, number][]; total?: number; comPosicao?: number } | null> =>
  authFetch(`${API_BASE}/estudos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "alunos-hex", unidade }) })
    .then((r) => (r.ok ? r.json() : null)).then((j) => (j && !j.ausente && Array.isArray(j.celulas) && j.celulas.length ? j : null)).catch(() => null);

/**
 * Mapa de calor dos alunos ativos pelo CEP (mesma conta da camada "Base de clientes" dos Estudos de ponto): a contagem por hexágono do Censo de cada
 * unidade é suavizada em volta da unidade e, na rede, somada. Só contagens; sem a rotina noturna (ou sem acesso) devolve null e o mapa fica em bolhas.
 */
function useCalorAlunos(pinos: Pino[]): Calor | null {
  const [calor, setCalor] = useState<Calor | null>(null);
  const chave = pinos.map((p) => p.nome).join("|");
  useEffect(() => {
    setCalor(null);
    if (!pinos.length) return;
    let vivo = true;
    Promise.all([lerCenso(), ...pinos.map((p) => lerHex(p.nome))]).then(([censo, ...hex]) => {
      if (!vivo || !censo) return;
      const porPosicao = new Map<string, number>();
      censo.celulas.forEach((c, i) => porPosicao.set(`${c[0]},${c[1]}`, i));
      const soma = new Map<number, number>();
      let comPosicao = 0, total = 0;
      hex.forEach((h, k) => {
        if (!h) return;
        const indices: number[] = [], pesos: number[] = [];
        for (const [la, ln, n] of h.celulas) { const i = porPosicao.get(`${la},${ln}`); if (i !== undefined) { indices.push(i); pesos.push(n); } }
        if (!indices.length) return;
        comPosicao += h.comPosicao ?? 0; total += h.total ?? 0;
        const sm = suavizarContagem(censo, indices, pesos, pinos[k].pos);
        sm.indices.forEach((i, j) => soma.set(i, (soma.get(i) ?? 0) + sm.pesos[j]));
      });
      if (soma.size) setCalor({ censo, indices: [...soma.keys()], pesos: [...soma.values()], comPosicao, total });
    });
    return () => { vivo = false; };
  }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps
  return calor;
}

/**
 * Mapa dos alunos, no mesmo padrão dos Estudos de ponto (fundo Mapbox, barra de fundo/régua/Street View, créditos). Com a contagem por CEP mostra o
 * mapa de calor; sem ela (ou em inativos e todos, que só existem por bairro) uma bolha por bairro. Carrega o Leaflet só quando o cartão aparece.
 */
function Mapa({ bairros, pinos, inativos, calor }: { bairros: Bairro[]; pinos: Pino[]; inativos: boolean; calor: Calor | null }) {
  const el = useRef<HTMLDivElement>(null);
  const ref = useRef<{ L: Leaflet; mapa: import("leaflet").Map; grupo: import("leaflet").LayerGroup; calor: import("leaflet").LayerGroup; ruas: import("leaflet").TileLayer; sat: import("leaflet").TileLayer } | null>(null);
  const [pronto, setPronto] = useState(false);
  const [zoom, setZoom] = useState(9);
  const [fundo, setFundo] = useState<Fundo>("padrao");
  const [verRua, setVerRua] = useState(false);
  const [rua, setRua] = useState<[number, number] | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarLeaflet().then((L) => {
      if (!vivo || !el.current) return;
      const mapa = L.map(el.current, { zoomControl: false, scrollWheelZoom: true, wheelPxPerZoomLevel: 90 }).setView([-15.8, -47.9], 9); // vista inicial: a barra do mapa lê o centro antes do enquadramento
      mapa.attributionControl.setPrefix(CREDITO_DO_MAPA);
      const ruas = camadaRuas(L).addTo(mapa);
      const sat = L.tileLayer(URL_SAT, { maxZoom: 19, attribution: "Imagens © Esri", crossOrigin: "anonymous" });
      ref.current = { L, mapa, calor: L.layerGroup().addTo(mapa), grupo: L.layerGroup().addTo(mapa), ruas, sat };
      mapa.on("zoomend", () => setZoom(mapa.getZoom()));
      setPronto(true);
    });
    const obs = typeof ResizeObserver !== "undefined" && el.current ? new ResizeObserver(() => ref.current?.mapa.invalidateSize()) : null; // mapa muda de largura ao ocultar o ranking
    if (el.current) obs?.observe(el.current);
    return () => { vivo = false; obs?.disconnect(); ref.current?.mapa.remove(); ref.current = null; setPronto(false); };
  }, []);
  useEffect(() => { if (ref.current) aplicarFundo(ref.current, fundo); }, [fundo, pronto]);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const { L, mapa, grupo } = m;
    grupo.clearLayers();
    const km = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], (a[1] - b[1]) * Math.cos((a[0] * Math.PI) / 180)) * 111;
    if (!calor) {
      const max = Math.max(1, ...bairros.map((b) => b[2]));
      for (const [nome, cidade, n, lat, lng, aprox] of [...bairros].sort((a, b) => b[2] - a[2])) {
        L.circleMarker([lat, lng], { radius: raioDaBolha(n, max), color: aprox ? "#6b7280" : inativos ? "#b45309" : "#1d4ed8", weight: 1.5, dashArray: aprox ? "4 3" : undefined, fillColor: aprox ? "#9ca3af" : inativos ? "#f59e0b" : "#3b82f6", fillOpacity: aprox ? 0.3 : 0.45 })
          .bindTooltip(`<strong>${nome}</strong>${cidade ? ` · ${cidade}` : ""}<br/>${fmt(n)} ${n === 1 ? "aluno" : "alunos"}${aprox ? "<br/><em>posição aproximada (centro da cidade)</em>" : ""}`).addTo(grupo);
      }
    }
    // Pinos das unidades: sempre por cima.
    for (const p of pinos) L.marker(p.pos, { icon: pinoDoMapa(L, "#c41230", 30), zIndexOffset: 1000, title: `World Gym ${p.nome}` }).bindTooltip(`<strong>World Gym ${p.nome}</strong><br/>localização da unidade`, { direction: "top", offset: [0, -30] }).addTo(grupo);
    // Enquadra o núcleo: o maior agrupamento de unidades (até 200 km entre si) e os bairros a até 60 km delas. Unidades e alunos
    // distantes (ex.: Salvador) seguem no mapa; é só dar zoom out.
    const grupos = pinos.map((c) => pinos.filter((p) => km(c.pos, p.pos) <= 200));
    const nucleoPinos = grupos.reduce<Pino[]>((mm, g) => (g.length > mm.length ? g : mm), []);
    const nucleo = nucleoPinos.length ? bairros.filter((b) => nucleoPinos.some((p) => km([b[3], b[4]], p.pos) <= 60)) : bairros;
    const pontos: [number, number][] = [...(calor ? [] : nucleo.map((b) => [b[3], b[4]] as [number, number])), ...nucleoPinos.map((p) => p.pos)];
    if (pontos.length) mapa.fitBounds(L.latLngBounds(pontos).pad(calor ? 0.45 : 0.15), { maxZoom: calor ? 13 : 14 });
  }, [bairros, pinos, inativos, calor, pronto]);
  // Calor: no zoom de região o hexágono de 200 m some; engorda o hexágono até um tamanho mínimo na tela (a mancha continua legível)
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    m.calor.clearLayers();
    if (!calor) return;
    const lat = pinos[0]?.pos[0] ?? -15.8;
    const raioPx = 200 / ((156543.03 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom);
    const km = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], (a[1] - b[1]) * Math.cos((a[0] * Math.PI) / 180)) * 111;
    desenharDemanda(m.L, m.calor, { ...calor.censo, rk: calor.censo.rk * Math.max(1, 4 / raioPx) }, calor, (la, ln) => pinos.some((p) => km([la, ln], p.pos) <= 6), "arco", null);
  }, [calor, pinos, zoom, pronto]);
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
  return (
    <div className="relative h-[70vh] min-h-[480px] w-full overflow-hidden rounded-xl border border-border">
      <style>{`.mapa-cinza .leaflet-tile-pane{filter:grayscale(1) contrast(.9) brightness(1.06)}`}</style>
      <div ref={el} role="img" aria-label="Mapa de onde moram os alunos ativos; as cores mostram a concentração de alunos" className="absolute inset-0" />
      {verRua && <div className="absolute left-1/2 top-3 z-[456] -translate-x-1/2 rounded-lg bg-foreground px-3 py-1.5 text-xs text-background shadow">Clique no mapa onde quer ver a rua</div>}
      <BarraMapa mapa={pronto ? ref.current?.mapa ?? null : null} fundo={fundo} setFundo={setFundo} verRua={verRua} setVerRua={setVerRua} />
      {rua && <StreetView ponto={rua} fechar={() => setRua(null)} />}
    </div>
  );
}

type Modo = "ativos" | "inativos" | "todos";
const MODOS: { id: Modo; rotulo: string }[] = [{ id: "ativos", rotulo: "Ativos" }, { id: "inativos", rotulo: "Inativos (12 meses)" }, { id: "todos", rotulo: "Todos" }];
const ROTULO_ALUNOS: Record<Modo, string> = { ativos: "alunos ativos hoje", inativos: "alunos que saíram nos últimos 12 meses", todos: "alunos ativos e que saíram nos últimos 12 meses" };

/** Onde moram os alunos: bolhas no mapa e ranking dos bairros, de quem está ativo, de quem saiu nos últimos 12 meses ou dos dois. Só contagens por bairro; nenhum endereço de aluno é guardado. */
export function OndeMoramAlunos({ unit, dados }: { unit: string; dados: MapaDados }) {
  const [ranking, setRanking] = useState(true);
  const [todos, setTodos] = useState(false);
  const [modo, setModo] = useState<Modo>("ativos");
  const { pinos } = dados;
  const calorTodos = useCalorAlunos(pinos);
  const calor = modo === "ativos" ? calorTodos : null; // inativos e todos só existem por bairro
  const bairros = modo === "ativos" ? dados.bairros : modo === "inativos" ? dados.inativos : somarBairros([dados.bairros, dados.inativos]);
  const semBairro = modo === "ativos" ? dados.semBairro : modo === "inativos" ? dados.semBairroInativos : dados.semBairro + dados.semBairroInativos;
  const subtitle = <>{unit} • {ROTULO_ALUNOS[modo]}</>;
  const filtro = (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div role="group" aria-label="Quais alunos mostrar no mapa" className="inline-flex rounded-lg border border-border bg-card p-0.5">
        {MODOS.map((m) => (
          <button key={m.id} type="button" aria-pressed={modo === m.id} onClick={() => setModo(m.id)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${modo === m.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>{m.rotulo}</button>
        ))}
      </div>
      <button type="button" onClick={() => setRanking((v) => !v)} aria-expanded={ranking} className="hidden rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary lg:block">
        {ranking ? "Ocultar ranking" : "Mostrar ranking"}
      </button>
    </div>
  );
  if (!bairros.length) {
    return (
      <ChartCard title="Onde moram os alunos" subtitle={subtitle}>
        {filtro}
        <ChartEmpty>{modo === "ativos" ? "Ainda não há bairros carregados para esta unidade. A foto é atualizada todo dia junto com a sincronização do EVO." : "Ainda não há bairros de quem saiu nos últimos 12 meses para esta seleção. Eles passam a aparecer na próxima sincronização do EVO."}</ChartEmpty>
      </ChartCard>
    );
  }
  const total = bairros.reduce((s, b) => s + b[2], 0);
  const aprox = bairros.filter((b) => b[5]).reduce((s, b) => s + b[2], 0);
  const ordenados = [...bairros].sort((a, b) => b[2] - a[2]);
  const top = todos ? ordenados : ordenados.slice(0, 10);
  const max = ordenados[0][2];
  // O ranking mostra os 10 maiores; o resto vira uma linha só, para a lista fechar com o total do mapa.
  const restoBairros = todos ? 0 : ordenados.length - top.length;
  const restoAlunos = todos ? 0 : total - top.reduce((s, b) => s + b[2], 0);
  const pct = (n: number) => ((n / total) * 100).toFixed(1).replace(".", ",");
  return (
    <ChartCard title="Onde moram os alunos" subtitle={subtitle}>
      {filtro}
      <p className="mb-2 text-xs text-muted-foreground">{(calor ? (t: string) => t.replace(/^Cada bolha[^.]*\.\s*/, "") : (t: string) => t)(fraseDosBairros(bairros.map((b) => ({ nome: b[0], n: b[2] }))))}</p>
      <div className={ranking ? "grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]" : ""}>
        <div>
          <Mapa key={modo} bairros={bairros} pinos={pinos} inativos={modo === "inativos"} calor={calor} />
          {calor && <div className="mt-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2">poucos<span className="h-1.5 w-40 rounded" style={{ background: gradienteArco }} />muitos alunos</div>
            <p className="mt-1">Mapa suavizado a partir do CEP de {fmt(calor.comPosicao)} alunos ativos{calor.total ? ` (${Math.round((calor.comPosicao / calor.total) * 100)}% da base)` : ""}. Só a contagem por região é guardada, nunca o endereço.</p>
          </div>}
        </div>
        {ranking && (
          <ol className="space-y-3 rounded-xl border border-border bg-card p-4 lg:h-[70vh] lg:min-h-[480px] lg:overflow-y-auto" aria-label="Bairros com mais alunos">
            {top.map(([nome, cidade, n]) => (
              <li key={`${nome}|${cidade}`} className="text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-medium text-foreground" title={cidade ? `${nome} · ${cidade}` : nome}>{nome}{cidade && <span className="font-normal text-muted-foreground"> · {cidade}</span>}</span>
                  <span className="shrink-0 tabular-nums text-foreground">{fmt(n)} <span className="text-xs text-muted-foreground">({pct(n)}%)</span></span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden><div className={`h-full rounded-full ${modo === "inativos" ? "bg-[#f59e0b]/80" : "bg-[#3b82f6]/70"}`} style={{ width: `${(n / max) * 100}%` }} /></div>
              </li>
            ))}
            {restoBairros > 0 && (
              <li className="border-t border-border pt-3 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-muted-foreground">Outros {fmt(restoBairros)} bairros</span>
                  <span className="shrink-0 tabular-nums text-foreground">{fmt(restoAlunos)} <span className="text-xs text-muted-foreground">({pct(restoAlunos)}%)</span></span>
                </div>
              </li>
            )}
            <li className="flex items-baseline justify-between gap-3 border-t border-border pt-3 text-sm font-medium">
              <span className="text-foreground">Total localizado</span>
              <span className="shrink-0 tabular-nums text-foreground">{fmt(total)}</span>
            </li>
            {bairros.length > 10 && (
              <li className="list-none">
                <button type="button" onClick={() => setTodos((v) => !v)} aria-expanded={todos} className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                  {todos ? "Mostrar só os 10 maiores" : `Ver os ${fmt(bairros.length)} bairros`}
                </button>
              </li>
            )}
          </ol>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {fmt(total)} alunos em {fmt(bairros.length)} bairros localizados{semBairro ? `; ${fmt(semBairro)} sem endereço ou bairro não localizado ficam de fora` : ""}. {calor ? "O mapa mostra a concentração pelo CEP; o ranking ao lado é pelo bairro do cadastro. " : "A bolha fica no centro do bairro (OpenStreetMap), não na casa do aluno. "}{modo === "inativos" && "Inativo é quem não tem contrato ativo hoje e saiu (contrato terminado ou cancelado) nos últimos 12 meses. "}{pinos.length > 1 ? "Os pinos vermelhos são as unidades." : pinos.length === 1 ? "O pino vermelho é a unidade." : ""}{aprox > 0 && <> Bolhas cinza tracejadas ({fmt(aprox)} alunos) são bairros não encontrados no mapa, postos no centro da cidade.</>}
      </p>
    </ChartCard>
  );
}
