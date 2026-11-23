import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { API_BASE, authFetch } from "@/lib/auth";
import { ListaEstudos } from "@/components/estudos/ListaEstudos";
import { fotoDoMapa, fotoEnquadrada, gradienteRampa, pausa, pino } from "@/components/estudos/mapaComum";
import { IconeBoneco, StreetView } from "@/components/estudos/StreetView";
import { CSS_POIS, ControlePois, SecaoPois, rotuloPois, totalPois, usePoisNoMapa, type ModoPois, type ResultadoPois } from "@/components/estudos/pois";
import { Destaque, Faixa, Linha, Nota, Secao } from "@/components/estudos/blocos";
import { Building2, Calculator, Gavel, ListChecks, Store, TrendingUp } from "lucide-react";
import { gerarPdfDoEstudo, nomeDoArquivo } from "@/lib/estudoPdf";
import { LegendaRenda, MapaUnidade } from "@/components/estudos/MapaUnidade";
import {
  DECISAO_ROTULO, VEREDITO_ROTULO, avaliarPonto, captacaoDe, classeDaRenda, fatoresDe, km, meses, parecidas, reais, regiaoDe,
  type DadosEstudos, type Modelo, type Ponto, type Resultado, type StatusDecisao, type Veredito,
} from "@/lib/estudoPonto";

const CORES = ["#c41230", "#1f5f8b", "#7a4bb5", "#0f7b6c", "#b45309", "#334155"];
const letra = (i: number) => String.fromCharCode(65 + (i % 26));
const ITENS: { k: keyof Ponto["imovel"]; rotulo: string }[] = [
  { k: "fachada", rotulo: "Fachada na avenida" }, { k: "estacionamento", rotulo: "Estacionamento" },
  { k: "polo", rotulo: "Polo comercial" }, { k: "aPe", rotulo: "Bom acesso a pé" },
];
// "limpa": só os pinos (usada nas fotos de satélite do PDF)
type Lente = "captacao" | "pessoas" | "renda" | "rede" | "limpa";
const LENTES: { id: Lente; rotulo: string }[] = [
  { id: "captacao", rotulo: "De onde vêm os alunos" }, { id: "pessoas", rotulo: "Pessoas" }, { id: "renda", rotulo: "Renda" }, { id: "rede", rotulo: "Nossa rede" },
];
const COR_VEREDITO: Record<Veredito, string> = { aprovado: "text-success", atencao: "text-warning", reprovado: "text-destructive" };
const FUNDO_VEREDITO: Record<Veredito, string> = { aprovado: "bg-success/10 text-success", atencao: "bg-warning/10 text-warning", reprovado: "bg-destructive/10 text-destructive" };
// rampa quente da captação: do amarelo-claro ao vinho
const RAMPA = [[255, 236, 179], [253, 186, 116], [239, 106, 70], [196, 18, 48], [122, 10, 32]];
function rampa(t: number) {
  const x = Math.min(0.999, Math.max(0, t)) * (RAMPA.length - 1), i = Math.floor(x), f = x - i, a = RAMPA[i], b = RAMPA[i + 1];
  return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(",")})`;
}

/** Régua com a faixa pessimista–otimista, o provável e a meta de payback. */
function Regua({ r }: { r: Resultado }) {
  const mn = Math.min(r.pessimista, r.meta * 0.9), mx = Math.max(r.otimista, r.meta * 1.1), pos = (v: number) => `${((v - mn) / (mx - mn)) * 100}%`;
  return (
    <div className="mt-4" aria-hidden="true">
      <div className="relative h-4 text-[11px] font-semibold text-foreground"><span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `clamp(48px, ${pos(r.meta)}, calc(100% - 48px))` }}>meta {reais(r.meta)}</span></div>
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-[10px] h-1 rounded bg-foreground/10" />
        <div className="absolute top-[7px] h-2.5 rounded bg-foreground/20" style={{ left: pos(r.pessimista), width: `calc(${pos(r.otimista)} - ${pos(r.pessimista)})` }} />
        <div className="absolute top-[2px] h-5 w-0.5 bg-foreground" style={{ left: pos(r.meta) }} />
        <div className="absolute top-[3px] h-[18px] w-[18px] -translate-x-1/2 rounded-full border-[3px] border-white bg-primary shadow" style={{ left: pos(r.provavel) }} />
      </div>
      <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground"><span>{reais(r.pessimista)}</span><span>{reais(r.otimista)}</span></div>
    </div>
  );
}

interface PropsMapa {
  dados: DadosEstudos; pontos: Ponto[]; setPontos: Dispatch<SetStateAction<Ponto[]>>; atualId: string | null; setAtualId: (id: string | null) => void;
  iniciarAdicionando: boolean; comparando: Set<string> | null; voltar: () => void; salvo: string; editavel: boolean;
}

/** O mapa do estudo: painel com os pontos (todos, ou só os escolhidos para comparar), a conta e a decisão; lentes e ferramentas. */
function MapaEstudos({ dados, pontos: todos, setPontos, atualId, setAtualId, iniciarAdicionando, comparando, voltar, salvo, editavel }: PropsMapa) {
  const [lente, setLente] = useState<Lente>("captacao");
  const [adicionando, setAdicionando] = useState(iniciarAdicionando);
  const [satelite, setSatelite] = useState(false);
  const [verRua, setVerRua] = useState(false);
  const [rua, setRua] = useState<[number, number] | null>(null);
  const [gerando, setGerando] = useState(false);
  const [pois, setPois] = useState<ResultadoPois | null>(null);
  const [modoPois, setModoPois] = useState<ModoPois>("nomes");
  const mapaEl = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<{ L: typeof import("leaflet"); mapa: import("leaflet").Map; camadas: import("leaflet").LayerGroup; ruas: import("leaflet").TileLayer; sat: import("leaflet").TileLayer } | null>(null);
  const [desenho, setDesenho] = useState(0);
  const pontos = comparando ? todos.filter((p) => comparando.has(p.id)) : todos;

  const atual = pontos.find((p) => p.id === atualId) ?? null;
  const pronto = true;
  const avaliar = (p: Ponto) => (dados.vendasPorM2![p.modelo] ? avaliarPonto(p, dados.premissas!, dados.vendasPorM2![p.modelo]!) : null);
  const resultados = useMemo(() => new Map(pontos.map((p) => [p.id, avaliar(p)])), [pontos, dados]); // eslint-disable-line react-hooks/exhaustive-deps
  const cap = useMemo(() => (atual && pronto ? captacaoDe(atual, dados.censo!, dados.unidades!, todos, dados.premissas!.curva) : null), [atual, pontos, dados]); // eslint-disable-line react-hooks/exhaustive-deps
  const r = atual ? resultados.get(atual.id) ?? null : null;

  const mudar = (id: string, campos: Partial<Ponto>) => editavel && setPontos((ps) => ps.map((p) => (p.id === id ? { ...p, ...campos, atualizadoEm: new Date().toISOString() } : p)));
  const remover = (id: string) => { setPontos((ps) => ps.filter((p) => p.id !== id)); if (atualId === id) setAtualId(pontos.find((p) => p.id !== id)?.id ?? null); };

  // mapa: cria uma vez
  useEffect(() => {
    if (!pronto || !mapaEl.current || mapaRef.current) return;
    let vivo = true;
    import("leaflet").then((mod) => {
      if (!vivo || !mapaEl.current) return;
      const L = (mod as unknown as { default?: typeof import("leaflet") }).default ?? (mod as typeof import("leaflet"));
      const centro = (todos.find((p) => p.id === atualId) ?? pontos[0])?.c ?? dados.unidades!.find((u) => u.c)?.c ?? [-15.8, -47.9];
      // a rolagem do mouse aproxima o mapa direto; azulejos com crossOrigin para a foto do PDF
      const mapa = L.map(mapaEl.current, { zoomControl: false, preferCanvas: true, scrollWheelZoom: true, wheelPxPerZoomLevel: 90 }).setView(centro, 13);
      const ruas = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap", crossOrigin: "anonymous" }).addTo(mapa);
      const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Imagens © Esri", crossOrigin: "anonymous" });
      L.control.zoom({ position: "bottomright" }).addTo(mapa);
      mapaRef.current = { L, mapa, camadas: L.layerGroup().addTo(mapa), ruas, sat };
      setDesenho((n) => n + 1);
    });
    return () => { vivo = false; };
  }, [pronto]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { mapaRef.current?.mapa.remove(); mapaRef.current = null; }, []);

  // clique no mapa adiciona ponto
  useEffect(() => {
    const m = mapaRef.current;
    if (!m) return;
    m.mapa.getContainer().style.cursor = adicionando ? "crosshair" : "";
    if (!adicionando) return;
    const aoClicar = (e: import("leaflet").LeafletMouseEvent) => {
      const agora = new Date().toISOString();
      const novo: Ponto = { id: `p${Date.now().toString(36)}`, nome: `Ponto ${letra(todos.length)}`, criadoEm: agora, atualizadoEm: agora, decisao: { status: "analise", em: agora }, c: [e.latlng.lat, e.latlng.lng], modelo: "low", m2: dados?.premissas?.modelos.low.padraoM2 ?? 1000, imovel: { fachada: false, estacionamento: false, polo: false, aPe: false } };
      setPontos((ps) => [...ps, novo]); setAtualId(novo.id); setAdicionando(false);
    };
    m.mapa.once("click", aoClicar);
    return () => { m.mapa.off("click", aoClicar); };
  }, [adicionando, desenho]); // eslint-disable-line react-hooks/exhaustive-deps

  // satélite
  useEffect(() => {
    const m = mapaRef.current;
    if (!m) return;
    if (satelite) { m.mapa.removeLayer(m.ruas); m.sat.addTo(m.mapa); } else { m.mapa.removeLayer(m.sat); m.ruas.addTo(m.mapa); }
    m.mapa.getContainer().classList.toggle("mapa-cinza", !satelite);
  }, [satelite, desenho]);

  // "Ver a rua": o próximo clique no mapa abre o Street View daquele lugar
  useEffect(() => {
    const m = mapaRef.current;
    if (!m) return;
    if (verRua) m.mapa.getContainer().style.cursor = "crosshair";
    if (!verRua) return;
    const aoClicar = (e: import("leaflet").LeafletMouseEvent) => { setRua([e.latlng.lat, e.latlng.lng]); setVerRua(false); m.mapa.getContainer().style.cursor = ""; };
    m.mapa.once("click", aoClicar);
    return () => { m.mapa.off("click", aoClicar); };
  }, [verRua, desenho]);

  // desenha a lente e os pinos
  useEffect(() => {
    const m = mapaRef.current;
    if (!m || !pronto) return;
    const { L, camadas } = m;
    camadas.clearLayers();
    const censo = dados.censo!, rk = censo.rk;
    const hex = (lat: number, lng: number): [number, number][] => Array.from({ length: 6 }, (_, k) => {
      const a = (Math.PI / 3) * k + Math.PI / 6;
      return [lat + (rk / 110.6) * Math.sin(a), lng + (rk / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a)];
    });
    if (lente === "captacao" && cap && atual) {
      const mx = Math.max(...cap.pesos, 1e-9);
      cap.indices.forEach((i, k) => {
        const t = cap.pesos[k] / mx;
        if (t < 0.03) return;
        const [lat, lng] = censo.celulas[i];
        L.polygon(hex(lat, lng), { stroke: false, fillColor: rampa(t ** 0.6), fillOpacity: 0.22 + 0.5 * Math.sqrt(t), interactive: false }).addTo(camadas);
      });
      if (cap.raio80) L.circle(atual.c, { radius: cap.raio80 * 1000, color: "#1b2130", weight: 1.5, dashArray: "5 5", fill: false, interactive: false }).addTo(camadas);
    } else if ((lente === "pessoas" || lente === "renda") && atual) {
      const vis = censo.celulas.filter(([lat, lng]) => km([lat, lng], atual.c) < 5);
      const v = (c: (typeof vis)[number]) => (lente === "pessoas" ? c[2] : c[3] ?? 0);
      const xs = vis.map(v).filter((x) => x > 0).sort((a, b) => a - b), mx = xs[Math.floor(xs.length * 0.95)] ?? 1;
      for (const c of vis) {
        const t = Math.min(1, v(c) / mx), classe = lente === "renda" ? classeDaRenda(c[3]) : null;
        if (lente === "renda" && !classe) continue;
        L.polygon(hex(c[0], c[1]), lente === "renda"
          ? { color: "#fff", weight: 1, opacity: 0.6, fillColor: classe!.cor, fillOpacity: 0.45 }
          : { color: "#fff", weight: 1, opacity: 0.6, fillColor: "#c41230", fillOpacity: 0.04 + t * t * 0.42 })
          .bindTooltip(lente === "pessoas" ? `${c[2].toLocaleString("pt-BR")} moradores` : c[3] ? `${classeDaRenda(c[3])?.rotulo ?? ""}: renda média do responsável R$ ${c[3].toLocaleString("pt-BR")}` : "Sem dado de renda", { sticky: true }).addTo(camadas);
      }
    }
    // unidades da rede (sempre, discretas; em destaque na lente "Nossa rede")
    for (const u of dados.unidades!) {
      if (!u.c) continue;
      const tam = lente === "rede" ? 15 : 11;
      L.marker(u.c, { icon: L.divIcon({ className: "", html: `<div style="width:${tam}px;height:${tam}px;border-radius:50%;background:#c41230;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3);opacity:${lente === "rede" ? 1 : 0.7}"></div>`, iconSize: [tam, tam], iconAnchor: [tam / 2, tam / 2] }) })
        .bindTooltip(`<strong>World Gym ${u.nome}</strong>${u.m2 ? `<br/>${u.m2.toLocaleString("pt-BR")} m²` : ""}${u.vendas ? `<br/>${reais(u.vendas)} por mês` : ""}${u.madura ? "" : "<br/><em>ainda amadurecendo</em>"}`).addTo(camadas);
      if (lente === "rede" && dados.premissas) L.circle(u.c, { radius: 2400, color: "#c41230", weight: 1, dashArray: "3 4", fillOpacity: 0.05, interactive: false }).addTo(camadas);
    }
    // pontos em estudo
    pontos.forEach((p, i) => {
      const sel = p.id === atualId;
      const mk = L.marker(p.c, { draggable: editavel, zIndexOffset: sel ? 2000 : 1000, title: p.nome, icon: pino(L, CORES[i % CORES.length], sel ? 40 : 32, letra(i)) }).addTo(camadas);
      mk.on("click", () => setAtualId(p.id));
      mk.on("dragend", () => { const ll = mk.getLatLng(); mudar(p.id, { c: [ll.lat, ll.lng] }); setAtualId(p.id); });
    });
    if (rua) L.marker(rua, { icon: L.divIcon({ className: "", iconSize: [14, 14], iconAnchor: [7, 7], html: '<div style="width:14px;height:14px;border-radius:50%;background:#f59e0b;border:2px solid #fff"></div>' }) }).addTo(camadas);
  }, [lente, cap, pontos, atualId, desenho, rua]); // eslint-disable-line react-hooks/exhaustive-deps

  usePoisNoMapa(desenho ? mapaRef.current : null, pois, modoPois);
  useEffect(() => { setPois(null); }, [atualId]);

  const idx = atual ? pontos.findIndex((p) => p.id === atual.id) : -1;
  const parec = atual ? parecidas(atual, dados.censo!, dados.unidades!) : [];
  const fatores = atual && r && cap ? fatoresDe(atual, r, cap, dados.unidades!, dados.censo!, dados.premissas!) : [];

  const exportar = async () => {
    const m = mapaRef.current;
    if (!m) return;
    setGerando(true);
    const lenteAntes = lente, poisAntes = pois;
    // fotos para o PDF: o mapa como está na tela, o satélite de cada ponto e, do ponto aberto, a área de captação e as academias
    const tirar = async (l: Lente, alvo: Parameters<typeof fotoEnquadrada>[1], sat = false) => { setLente(l); await pausa(350); return fotoEnquadrada(m, alvo, sat); };
    try {
      const foto = await fotoDoMapa(m.mapa, !satelite);
      setPois(null); // as academias só aparecem na foto delas
      const sats = new Map<string, string | null>();
      for (const p of pontos) sats.set(p.id, await tirar("limpa", { centro: p.c, zoom: 16 }, true));
      const fotoCap = atual && cap ? await tirar("captacao", { limites: m.L.latLng(atual.c).toBounds(Math.max(2.5, cap.raio80) * 2000) }) : null;
      if (pois) { setPois(pois); await pausa(300); }
      const fotoPois = atual && pois ? await tirar("limpa", { limites: m.L.latLng(pois.c).toBounds(pois.raioKm * 2000) }) : null;
      setLente(lenteAntes);
      const reg = dados.premissas!.regua;
      const paginas = pontos.map((p, i) => {
        const rr = resultados.get(p.id);
        const cp = captacaoDe(p, dados.censo!, dados.unidades!, todos, dados.premissas!.curva);
        const fs = rr ? fatoresDe(p, rr, cp, dados.unidades!, dados.censo!, dados.premissas!) : [];
        const pr = parecidas(p, dados.censo!, dados.unidades!);
        return {
          titulo: `${letra(i)}. ${p.nome}`, subtitulo: `${regiaoDe(p, dados.unidades!)} · ${dados.premissas!.modelos[p.modelo].nome} · ${p.m2.toLocaleString("pt-BR")} m²`,
          foto: { dados: sats.get(p.id) ?? null, legenda: "O ponto visto de cima (imagem de satélite)." },
          faixa: rr ? { texto: `${VEREDITO_ROTULO[rr.veredito]} pelo modelo · payback ${meses(rr.payback)}`, tom: (rr.veredito === "aprovado" ? "bom" : rr.veredito === "atencao" ? "atencao" : "ruim") as "bom" | "atencao" | "ruim" } : undefined,
          destaques: rr ? [{ valor: reais(rr.provavel), rotulo: "vendas por mês previstas" }, { valor: rr.lucro > 0 ? reais(rr.lucro) : "prejuízo", rotulo: "lucro por mês" }, { valor: meses(rr.payback), rotulo: "para o investimento voltar" }] : undefined,
          frase: rr ? `Deve vender ${reais(rr.provavel)} por mês (entre ${reais(rr.pessimista)} e ${reais(rr.otimista)}). Para pagar o investimento em ${reg.mesesAprovado / 12} anos, precisa de ${reais(rr.meta)}.` : undefined,
          numeros: rr ? [
            { rotulo: "Investimento", valor: `R$ ${(rr.investimento / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi` },
            { rotulo: "80% dos alunos a até", valor: `${cp.raio80.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km` },
          ] : [],
          secoes: [
            ...(p.id === atual?.id && fotoCap ? [{ titulo: "Onde estariam os alunos", novaPagina: true, linhas: [], foto: { dados: fotoCap, legenda: "Mais escuro = onde o modelo espera mais alunos. Tracejado: área onde morariam 80% deles." } }] : []),
            { titulo: "O que pesa", linhas: fs.map((f) => ({ texto: `${f.positivo ? "+" : "−"} ${f.texto}`, tom: (f.positivo ? "bom" : "ruim") as "bom" | "ruim" })) },
            { titulo: "Decisão", linhas: [{ texto: DECISAO_ROTULO[p.decisao?.status ?? "analise"] + (p.decisao?.unidade ? `: ${p.decisao.unidade}` : ""), valor: p.decisao?.em ? new Date(p.decisao.em).toLocaleDateString("pt-BR") : undefined }], paragrafo: p.decisao?.comentario || undefined },
            ...(pois && p.id === atual?.id ? [{ titulo: `${rotuloPois(pois)} a até ${pois.raioKm.toLocaleString("pt-BR")} km: ${totalPois(pois)}`, novaPagina: true, foto: { dados: fotoPois, legenda: "Fonte: Google. Grandes redes em destaque escuro." }, linhas: pois.lugares.map((l, k) => ({ texto: `${k + 1}. ${l.nome}${l.rede ? ` (${l.rede})` : ""}`, valor: `${l.km.toLocaleString("pt-BR")} km` })), paragrafo: "Fonte: Google. Os números seguem a ordem de distância." }] : []),
            { titulo: "O imóvel", linhas: ITENS.map((it) => ({ texto: it.rotulo, valor: p.imovel[it.k] ? "sim" : "não" })) },
            ...(pr.length ? [{ titulo: "Unidades parecidas na rede", linhas: pr.map((u) => ({ texto: `${u.nome}, ${u.m2?.toLocaleString("pt-BR")} m²`, valor: u.vendas ? reais(u.vendas) : "—" })), paragrafo: "Mesma quantidade de moradores e renda a até 2 km." }] : []),
          ],
        };
      });
      await gerarPdfDoEstudo({
        arquivo: nomeDoArquivo(pontos.length === 1 ? `estudo-de-ponto-${pontos[0].nome}` : "estudos-de-ponto"), cabecalho: "Estudo de ponto", foto: null,
        fotoComparacao: pontos.length > 1 ? { dados: foto, legenda: "Mapa do estudo, como estava na tela. Letras: os pontos estudados; bolinhas vermelhas: unidades World Gym." } : undefined,
        capa: { titulo: "Estudo de Geomarketing", linha: "Avaliação de Ponto", subtitulo: pontos.map((p) => `${p.nome}${p.regiao ? ` | ${p.regiao}` : ""}`).join(" · ") },
        paginas,
        comparacao: pontos.length > 1 ? {
          colunas: ["Ponto", "Modelo e m²", "Vendas previstas", "Payback", "Veredito", "Decisão"],
          linhas: pontos.map((p, i) => { const rr = resultados.get(p.id); return [`${letra(i)}. ${p.nome}`, `${dados.premissas!.modelos[p.modelo].nome}, ${p.m2.toLocaleString("pt-BR")} m²`, rr ? reais(rr.provavel) : "—", rr ? meses(rr.payback) : "—", rr ? VEREDITO_ROTULO[rr.veredito] : "—", DECISAO_ROTULO[p.decisao?.status ?? "analise"]]; }),
        } : undefined,
      });
    } finally { setLente(lenteAntes); setPois(poisAntes); setGerando(false); }
  };

  return (
    <div className="space-y-4">
      <style>{`.mapa-cinza .leaflet-tile-pane{filter:grayscale(1) contrast(.9) brightness(1.06)}${CSS_POIS}`}</style>

      {/* topo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={voltar} className="rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">← Estudos</button>
          <h2 className="font-display text-2xl font-medium">{comparando ? `Comparando ${pontos.length} pontos` : "Estudo de ponto"}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{salvo === "salvando" ? "Salvando…" : salvo === "salvo" ? "Salvo" : salvo === "erro" ? "Não consegui salvar" : ""}</span>
          {editavel && (
            <button type="button" onClick={() => setAdicionando((a) => !a)} aria-pressed={adicionando}
              className="h-10 rounded-xl border bg-white px-3.5 text-sm font-medium aria-pressed:border-primary aria-pressed:text-primary">{adicionando ? "Clique no mapa…" : "+ Adicionar ponto"}</button>
          )}
          <button type="button" onClick={exportar} disabled={gerando || !pontos.length} className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">{gerando ? "Gerando…" : "Exportar PDF"}</button>
        </div>
      </div>

      {/* mapa */}
      <div className="relative h-[52vh] min-h-[380px] overflow-hidden rounded-2xl border border-primary/30 bg-muted">
        <div ref={mapaEl} className="absolute inset-0" aria-label="Mapa do estudo de ponto" />
        <div className="pointer-events-none absolute inset-x-3 top-3 z-[450] flex flex-col items-center gap-2">
          <nav className="pointer-events-auto flex max-w-full overflow-x-auto rounded-xl bg-white p-1 shadow-lg" aria-label="O que o mapa mostra">
            {LENTES.map((l) => (
              <button key={l.id} type="button" aria-pressed={lente === l.id} onClick={() => setLente(l.id)}
                className="whitespace-nowrap rounded-lg px-3 py-2 text-[13px] text-muted-foreground aria-pressed:bg-foreground aria-pressed:font-medium aria-pressed:text-background">{l.rotulo}</button>
            ))}
          </nav>
          {lente === "captacao" && atual && (
            <div className="pointer-events-auto flex items-center gap-2 rounded-lg bg-white/95 px-3 py-1.5 text-xs text-muted-foreground shadow">
              poucos alunos<span className="h-1.5 w-28 rounded" style={{ background: gradienteRampa }} />muitos alunos<span className="ml-2 border-l pl-2">tracejado: onde moram 80%</span>
            </div>
          )}
          {lente === "renda" && <LegendaRenda />}
          {(adicionando || verRua) && <div className="pointer-events-auto rounded-lg bg-foreground px-3 py-1.5 text-xs text-background shadow">{adicionando ? "Clique no mapa onde fica o imóvel" : "Clique no mapa onde quer ver a rua"}</div>}
        </div>
        <div className="absolute bottom-24 right-3 z-[450] flex flex-col overflow-hidden rounded-xl bg-white shadow-lg">
          <button type="button" aria-pressed={satelite} onClick={() => setSatelite((s) => !s)} title="Satélite" className="grid h-10 w-10 place-items-center aria-pressed:bg-foreground aria-pressed:text-background">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z" /><path d="M9 4v13M15 7v13" /></svg><span className="sr-only">Satélite</span>
          </button>
          <button type="button" aria-pressed={verRua} onClick={() => { setAdicionando(false); setVerRua((v) => !v); }} title="Ver a rua (Street View)" className="grid h-10 w-10 place-items-center border-t aria-pressed:bg-foreground aria-pressed:text-background">
            <IconeBoneco /><span className="sr-only">Ver a rua</span>
          </button>
        </div>
        <div className="absolute bottom-3 left-3 z-[460]"><ControlePois centro={atual?.c ?? null} aviso aoResultado={setPois} modo={modoPois} setModo={setModoPois} temResultado={!!pois} /></div>
        {rua && <StreetView ponto={rua} fechar={() => setRua(null)} />}
      </div>

      {/* pontos em estudo */}
      {pontos.length > 0 ? (
        <div className="flex gap-2.5 overflow-x-auto pb-1" role="tablist" aria-label="Pontos em estudo">
          {pontos.map((p, i) => {
            const rr = resultados.get(p.id);
            return (
              <button key={p.id} type="button" role="tab" aria-selected={p.id === atualId} onClick={() => setAtualId(p.id)}
                className="flex min-w-[230px] items-center gap-2.5 rounded-xl border bg-white px-3 py-2.5 text-left hover:bg-muted/40 aria-selected:border-foreground aria-selected:ring-1 aria-selected:ring-foreground">
                <span className="grid h-[26px] w-[26px] flex-none place-items-center rounded-full text-[13px] font-semibold text-white" style={{ background: CORES[i % CORES.length] }}>{letra(i)}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{p.nome}</span>
                  {rr && <span className="block text-xs tabular-nums text-muted-foreground">{reais(rr.provavel)} · {meses(rr.payback)}</span>}</span>
                {rr && <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${FUNDO_VEREDITO[rr.veredito]}`}>{VEREDITO_ROTULO[rr.veredito]}</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="rounded-2xl border bg-white p-5 text-sm text-muted-foreground">{editavel ? "Clique em \u201c+ Adicionar ponto\u201d e depois no mapa onde fica o imóvel. A conta aparece aqui." : "Nenhum ponto neste estudo."}</p>
      )}

      {pois && <div className="grid gap-4 lg:grid-cols-2"><SecaoPois res={pois} /></div>}

      {/* estudo do ponto escolhido, no padrão do estudo de geomarketing */}
      {atual && r && (
        <fieldset disabled={!editavel} className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-white px-4 py-3">
            <input value={atual.nome} onChange={(e) => mudar(atual.id, { nome: e.target.value })} aria-label="Nome do ponto"
              className="min-w-[180px] flex-1 rounded-md bg-transparent font-display text-xl font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <input value={atual.regiao ?? ""} onChange={(e) => mudar(atual.id, { regiao: e.target.value })} placeholder="Região (ex.: Taguatinga Norte)" aria-label="Região do ponto"
              className="min-w-[180px] flex-1 rounded-md bg-transparent text-sm text-muted-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring" />
            <div className="flex rounded-lg bg-muted p-0.5" role="group" aria-label="Modelo">
              {(["low", "pro"] as Modelo[]).map((m) => (
                <button key={m} type="button" aria-pressed={atual.modelo === m} onClick={() => mudar(atual.id, { modelo: m, m2: dados.premissas!.modelos[m].padraoM2 })}
                  className="rounded-md px-2.5 py-1 text-xs font-semibold text-muted-foreground aria-pressed:bg-white aria-pressed:text-foreground aria-pressed:shadow-sm">{dados.premissas!.modelos[m].nome}</button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="number" min={300} max={8000} step={50} value={atual.m2} onChange={(e) => mudar(atual.id, { m2: Math.max(300, Math.min(8000, Number(e.target.value) || 0)) })}
                className="w-20 rounded-md border bg-white px-2 py-1 text-right text-sm tabular-nums text-foreground" aria-label="Tamanho do imóvel em m²" /> m²
            </label>
          </div>

          <Faixa tom={r.veredito === "aprovado" ? "bom" : r.veredito === "atencao" ? "atencao" : "ruim"}>
            {VEREDITO_ROTULO[r.veredito]} pelo modelo · payback {meses(r.payback)}
          </Faixa>

          <div className="grid gap-4 lg:grid-cols-2">
            <Secao icone={TrendingUp} titulo="Estimativa de vendas">
              <Destaque valor={reais(r.provavel)} rotulo="vendas por mês com a unidade madura" tom={r.veredito === "aprovado" ? "bom" : r.veredito === "atencao" ? "atencao" : "ruim"} />
              <Regua r={r} />
              <div className="mt-3"><Nota>
                {r.veredito === "aprovado"
                  ? <>Passa dos {reais(r.meta)} por mês que pagam o investimento em {dados.premissas!.regua.mesesAprovado / 12} anos.</>
                  : <>Para pagar o investimento em {dados.premissas!.regua.mesesAprovado / 12} anos, o ponto precisa vender {reais(r.meta)} por mês.</>}
              </Nota></div>
            </Secao>
            <Secao icone={Calculator} titulo="Retorno">
              <div className="grid grid-cols-2 gap-3">
                <Destaque valor={r.lucro > 0 ? reais(r.lucro) : "prejuízo"} rotulo="lucro por mês" />
                <Destaque valor={meses(r.payback)} rotulo="para o investimento voltar" />
              </div>
              <div className="mt-3">
                <Linha rotulo="Investimento" valor={`R$ ${(r.investimento / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`} />
                <Linha rotulo="Equilíbrio do mês" valor={`${reais(r.custoFixo / (1 - dados.premissas!.modelos[atual.modelo].variavel))} de vendas`} />
                <Linha rotulo="80% dos alunos a até" valor={cap ? `${cap.raio80.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km` : "—"} />
              </div>
            </Secao>
            <Secao icone={ListChecks} titulo="O que pesa">
              <ul className="space-y-1.5 text-[13px]">
                {fatores.map((f) => <li key={f.texto} className="flex gap-2.5"><span className={`w-3.5 flex-none text-center font-bold ${f.positivo ? "text-success" : "text-destructive"}`}>{f.positivo ? "+" : "−"}</span>{f.texto}</li>)}
              </ul>
            </Secao>
            <Secao icone={Gavel} titulo="Sua decisão">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Decisão">
                {(Object.keys(DECISAO_ROTULO) as StatusDecisao[]).map((st) => (
                  <button key={st} type="button" aria-pressed={(atual.decisao?.status ?? "analise") === st}
                    onClick={() => mudar(atual.id, { decisao: { ...atual.decisao, status: st, em: new Date().toISOString(), previsao: st === "analise" ? undefined : { provavel: Math.round(r.provavel), pessimista: Math.round(r.pessimista), otimista: Math.round(r.otimista) }, unidade: st === "unidade" ? atual.decisao?.unidade : undefined } })}
                    className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground aria-pressed:border-primary aria-pressed:bg-primary/5 aria-pressed:font-medium aria-pressed:text-primary">{DECISAO_ROTULO[st]}</button>
                ))}
              </div>
              {atual.decisao?.status === "unidade" && (
                <select value={atual.decisao.unidade ?? ""} onChange={(e) => mudar(atual.id, { decisao: { ...atual.decisao!, unidade: e.target.value || undefined } })} aria-label="Qual unidade"
                  className="mt-2 w-full rounded-lg border bg-white px-2 py-1.5 text-sm">
                  <option value="">Qual unidade?</option>
                  {dados.unidades!.map((u) => <option key={u.nome} value={u.nome}>{u.nome}</option>)}
                </select>
              )}
              <textarea value={atual.decisao?.comentario ?? ""} placeholder="Comentário (ex.: negociar carência de 4 meses)" aria-label="Comentário da decisão" rows={2}
                onChange={(e) => mudar(atual.id, { decisao: { status: atual.decisao?.status ?? "analise", em: atual.decisao?.em ?? new Date().toISOString(), ...atual.decisao, comentario: e.target.value } })}
                className="mt-2 w-full resize-none rounded-lg border bg-white px-2.5 py-1.5 text-sm" />
            </Secao>
            <Secao icone={Building2} titulo="O imóvel">
              <div className="flex flex-wrap gap-1.5">
                {ITENS.map((it) => (
                  <button key={it.k} type="button" aria-pressed={atual.imovel[it.k]} onClick={() => mudar(atual.id, { imovel: { ...atual.imovel, [it.k]: !atual.imovel[it.k] } })}
                    className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground aria-pressed:border-foreground aria-pressed:bg-muted aria-pressed:font-medium aria-pressed:text-foreground">{it.rotulo}</button>
                ))}
              </div>
              <div className="mt-3"><Nota>Fica registrado no estudo. Ainda não muda a conta: o peso de cada item será medido com as unidades da rede.</Nota></div>
            </Secao>
            {parec.length > 0 && (
              <Secao icone={Store} titulo="Unidades parecidas na rede">
                {parec.map((u) => <Linha key={u.nome} rotulo={`${u.nome}, ${u.m2?.toLocaleString("pt-BR")} m²`} valor={u.vendas ? reais(u.vendas) : "—"} />)}
                <div className="mt-3"><Nota>Mesma quantidade de moradores e renda a até 2 km.</Nota></div>
              </Secao>
            )}
          </div>
          <div className="flex justify-end text-xs text-muted-foreground">
            {editavel ? <button type="button" onClick={() => { if (window.confirm(`Remover o ${atual.nome}?`)) remover(atual.id); }} className="text-destructive hover:underline">Remover ponto {letra(idx)}</button> : <span>Só consulta</span>}
          </div>
        </fieldset>
      )}
    </div>
  );
}

type Visao = { tela: "lista" } | { tela: "unidade"; nome: string } | { tela: "mapa"; atualId: string | null; novo: boolean; comparando: Set<string> | null };

/** Estudos de ponto: abre na lista (carteira de estudos); o mapa abre num estudo, num estudo novo ou na comparação. */
export function EstudosPontoTab() {
  const [dados, setDados] = useState<DadosEstudos | null>(null);
  const [erro, setErro] = useState("");
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [salvo, setSalvo] = useState<"" | "salvando" | "salvo" | "erro">("");
  const [visao, setVisao] = useState<Visao>({ tela: "lista" });
  const primeiraCarga = useRef(true);

  useEffect(() => {
    authFetch(`${API_BASE}/estudos`).then(async (res) => {
      if (!res.ok) throw new Error(res.status === 403 ? "Sem permissão para ver os estudos de ponto." : "Não consegui carregar os estudos agora.");
      const d: DadosEstudos = await res.json();
      setDados(d); setPontos(d.pontos ?? []);
    }).catch((e) => setErro(e.message));
  }, []);

  // grava os pontos no servidor um instante depois da última mudança
  useEffect(() => {
    if (!dados?.disponivel || (dados.modo ?? "completo") !== "completo") return;
    if (primeiraCarga.current) { primeiraCarga.current = false; return; }
    setSalvo("salvando");
    const t = setTimeout(() => {
      authFetch(`${API_BASE}/estudos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "pontos", pontos }) })
        .then((r) => setSalvo(r.ok ? "salvo" : "erro")).catch(() => setSalvo("erro"));
    }, 900);
    return () => clearTimeout(t);
  }, [pontos, dados?.disponivel]);

  if (erro) return <p className="rounded-2xl border bg-white p-6 text-sm text-muted-foreground">{erro}</p>;
  if (!dados) return <p className="rounded-2xl border bg-white p-6 text-sm text-muted-foreground">Carregando os estudos de ponto…</p>;
  if (!dados.disponivel || !dados.premissas || !dados.vendasPorM2 || !dados.censo || !dados.unidades)
    return <p className="rounded-2xl border bg-white p-6 text-sm text-muted-foreground">As premissas dos estudos de ponto ainda não foram carregadas.</p>;

  const editavel = (dados.modo ?? "completo") === "completo";
  // quem tem acesso a unidades vê só o estudo da(s) própria(s) unidade(s)
  if (dados.modo === "unidade") {
    const minhas = (dados.unidades ?? []).filter((u) => dados.minhas?.includes(u.nome));
    return minhas.length
      ? <MapaUnidade dados={dados} unidades={minhas} inicial={minhas[0].nome} />
      : <p className="rounded-2xl border bg-white p-6 text-sm text-muted-foreground">Nenhuma unidade ligada ao seu acesso.</p>;
  }
  if (visao.tela === "unidade") {
    const emOperacao = (dados.unidades ?? []).filter((u) => u.c);
    return <MapaUnidade dados={dados} unidades={emOperacao} inicial={visao.nome} voltar={() => setVisao({ tela: "lista" })} />;
  }
  if (visao.tela === "lista")
    return (
      <ListaEstudos dados={dados} pontos={pontos} editavel={editavel} abrirUnidade={(nome: string) => setVisao({ tela: "unidade", nome })}
        abrir={(id) => setVisao({ tela: "mapa", atualId: id, novo: false, comparando: null })}
        novo={() => setVisao({ tela: "mapa", atualId: null, novo: true, comparando: null })}
        comparar={(ids) => setVisao({ tela: "mapa", atualId: ids[0] ?? null, novo: false, comparando: new Set(ids) })} />
    );
  return (
    <MapaEstudos dados={dados} pontos={pontos} setPontos={setPontos} salvo={salvo} editavel={editavel} iniciarAdicionando={visao.novo} comparando={visao.comparando}
      atualId={visao.atualId} setAtualId={(id) => setVisao((v) => (v.tela === "mapa" ? { ...v, atualId: id, comparando: v.comparando && id && !v.comparando.has(id) ? new Set([...v.comparando, id]) : v.comparando } : v))}
      voltar={() => setVisao({ tela: "lista" })} />
  );
}
