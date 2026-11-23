import "leaflet/dist/leaflet.css";
import { Pilula } from "@/components/ui/pilula";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { API_BASE, authFetch } from "@/lib/auth";
import { ListaEstudos } from "@/components/estudos/ListaEstudos";
import { fotoDoMapa, fotoEnquadrada, gradienteRampa, pausa, pino } from "@/components/estudos/mapaComum";
import { StreetView } from "@/components/estudos/StreetView";
import { LEGENDA_DESLOCAMENTO, areaOficial, desenharDeslocamento, limitesDaArea, useDeslocamento, useReferenciaPopulacao } from "@/components/estudos/deslocamento";
import { CSS_POIS, ControlePois, SecaoPois, ondePois, rotuloPois, totalPois, usePoisNoMapa, type ModoPois, type ResultadoPois } from "@/components/estudos/pois";
import { Destaque, Faixa, Linha, Nota, Secao } from "@/components/estudos/blocos";
import { Building2, Calculator, Gavel, ListChecks, Store, TrendingUp } from "lucide-react";
import { gerarPdfDoEstudo } from "@/lib/estudoPdf";
import { montarPdfPonto } from "@/components/estudos/pdfPonto";
import { MapaUnidade } from "@/components/estudos/MapaUnidade";
import { LegendaCenso, desenharCenso, ehCamadaCenso } from "@/components/estudos/camadasCenso";
import { BarraMapa, BuscaEndereco, PainelCamadas } from "@/components/estudos/controlesMapa";
import { SecaoSugestoes, desenharSugestoes } from "@/components/estudos/sugestoes";
import {
  DECISAO_ROTULO, MINUTOS_PADRAO, classesNaArea, densidadeNaArea, perfilNaArea, potencialNaArea, VEREDITO_ROTULO, avaliarPonto, posicoesMelhores, type Sugestao, captacaoDe, dentroDaArea, fatoresDe, km, moradoresNaArea, meses, parecidas, reais, regiaoDe,
  SITUACAO_POPULACAO, SITUACAO_VAGAS, alunosDoPonto, populacaoRecomendada, ticketSugerido, vagasDoPonto, vereditoFinal,
  type DadosEstudos, type Modelo, type Ponto, type Resultado, type StatusDecisao, type Veredito,
} from "@/lib/estudoPonto";

const CORES = ["#c41230", "#1f5f8b", "#7a4bb5", "#0f7b6c", "#b45309", "#334155"];
const letra = (i: number) => String.fromCharCode(65 + (i % 26));
const ITENS: { k: "fachada" | "polo" | "aPe"; rotulo: string }[] = [
  { k: "fachada", rotulo: "Fachada na avenida" },
  { k: "polo", rotulo: "Polo comercial" }, { k: "aPe", rotulo: "Bom acesso a pé" },
];
// "limpa": só os pinos (usada nas fotos de satélite do PDF); "sugestoes": pinos, área e posições sugeridas (foto do PDF)
type Lente = "captacao" | "pessoas" | "idade" | "domicilios" | "renda" | "consumo" | "rede" | "limpa" | "sugestoes";
const LENTES: { id: Lente; rotulo: string }[] = [
  { id: "captacao", rotulo: "Captação estimada" }, { id: "pessoas", rotulo: "População" }, { id: "idade", rotulo: "Idade" }, { id: "domicilios", rotulo: "Domicílios" },
  { id: "renda", rotulo: "Renda" }, { id: "consumo", rotulo: "Potencial de consumo" }, { id: "rede", rotulo: "Canibalização" },
];
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
  const [verPois, setVerPois] = useState(true);
  // endereço achado na busca: fica marcado até virar ponto de estudo ou ser fechado
  const [achado, setAchado] = useState<{ nome: string; endereco: string; c: [number, number] } | null>(null);
  const mapaEl = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<{ L: typeof import("leaflet"); mapa: import("leaflet").Map; camadas: import("leaflet").LayerGroup; ruas: import("leaflet").TileLayer; sat: import("leaflet").TileLayer } | null>(null);
  const [desenho, setDesenho] = useState(0);
  const pontos = comparando ? todos.filter((p) => comparando.has(p.id)) : todos;

  const atual = pontos.find((p) => p.id === atualId) ?? null;
  const pronto = true;
  const avaliar = (p: Ponto) => (dados.vendasPorM2![p.modelo] ? avaliarPonto(p, dados.premissas!, dados.vendasPorM2![p.modelo]!) : null);
  const resultados = useMemo(() => new Map(pontos.map((p) => [p.id, avaliar(p)])), [pontos, dados]); // eslint-disable-line react-hooks/exhaustive-deps
  // ticket sugerido, alunos e vagas de cada ponto (estacionamento insuficiente reprova: critério eliminatório)
  const extras = useMemo(() => new Map(pontos.map((p) => {
    const rr = resultados.get(p.id) ?? null;
    const tk = ticketSugerido(p.modelo, dados.unidades!, parecidas(p, dados.censo!, dados.unidades!));
    const alunos = rr && tk ? alunosDoPonto(rr, tk.preco) : null;
    const vagas = alunos ? vagasDoPonto(alunos, p.imovel) : null;
    return [p.id, { ticket: tk, alunos, vagas, veredito: rr ? vereditoFinal(rr.veredito, vagas) : null }];
  })), [resultados, pontos, dados]); // eslint-disable-line react-hooks/exhaustive-deps
  const cap = useMemo(() => (atual && pronto ? captacaoDe(atual, dados.censo!, dados.unidades!, todos, dados.premissas!.curva) : null), [atual, pontos, dados]); // eslint-disable-line react-hooks/exhaustive-deps
  const r = atual ? resultados.get(atual.id) ?? null : null;
  // área de 10 min de carro do ponto aberto (pergunta antes de mandar a posição ao Mapbox)
  const areas = useDeslocamento(atual?.c, true);
  const area10 = areaOficial(areas);
  const moradores10 = area10 ? moradoresNaArea(dados.censo!, area10) : null;
  // população recomendada calibrada com a rede (moradores na área de 10 min de cada unidade madura do modelo)
  const refsPop = useReferenciaPopulacao(dados.unidades!, dados.censo, atual?.modelo ?? null);
  const ex = atual ? extras.get(atual.id) ?? null : null;
  const pop = r && refsPop ? populacaoRecomendada(r.meta, moradores10, refsPop) : null;
  const vf = ex?.veredito ?? r?.veredito ?? null;
  // recomendação: posições até 3 km com mais público alcançável que o ponto aberto
  const sugestoes = useMemo(() => (atual && dados.censo && dados.premissas
    ? posicoesMelhores({ c: atual.c, m2: atual.m2 }, dados.censo, dados.unidades!, todos.filter((p) => p.id !== atual.id), dados.premissas.curva)
    : null), [atual?.id, atual?.c[0], atual?.c[1], atual?.m2, todos.length, dados]); // eslint-disable-line react-hooks/exhaustive-deps

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
        if (t < 0.01) return;
        const [lat, lng] = censo.celulas[i];
        L.polygon(hex(lat, lng), { stroke: false, fillColor: rampa(t ** 0.6), fillOpacity: 0.22 + 0.5 * Math.sqrt(t), interactive: false }).addTo(camadas);
      });
      if (cap.raio80 && !area10) L.circle(atual.c, { radius: cap.raio80 * 1000, color: "#1b2130", weight: 1.5, dashArray: "5 5", fill: false, interactive: false }).addTo(camadas);
    } else if (ehCamadaCenso(lente) && atual) {
      desenharCenso(L, camadas, censo, lente, (la, ln) => (area10 ? dentroDaArea(la, ln, area10) : km([la, ln], atual.c) < 5));
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
    if (lente !== "rede") desenharDeslocamento(L, camadas, areas);
    if (lente !== "limpa") desenharSugestoes(L, camadas, sugestoes);
  }, [lente, cap, pontos, atualId, desenho, rua, areas, sugestoes]); // eslint-disable-line react-hooks/exhaustive-deps

  usePoisNoMapa(desenho ? mapaRef.current : null, verPois ? pois : null, modoPois);
  const aoPois = (res: ResultadoPois | null) => { setPois(res); setVerPois(true); };
  // pino do endereço achado
  useEffect(() => {
    const m = mapaRef.current;
    if (!m || !achado) return;
    const mk = m.L.marker(achado.c, { zIndexOffset: 3000, icon: pino(m.L, "#1b2130", 34) }).bindTooltip(achado.endereco).addTo(m.mapa);
    return () => { mk.remove(); };
  }, [achado, desenho]);
  const estudarSugestao = (sg: Sugestao, i: number) => {
    if (!atual) return;
    const agora = new Date().toISOString();
    const novo: Ponto = { id: `p${Date.now().toString(36)}`, nome: `Sugestão ${i + 1} de ${atual.nome}`.slice(0, 60), criadoEm: agora, atualizadoEm: agora, decisao: { status: "analise", em: agora }, c: sg.c, modelo: atual.modelo, m2: atual.m2, imovel: { fachada: false, estacionamento: false, polo: false, aPe: false } };
    setPontos((ps) => [...ps, novo]); setAtualId(novo.id);
  };
  const estudarAchado = () => {
    if (!achado || !editavel) return;
    const agora = new Date().toISOString();
    const novo: Ponto = { id: `p${Date.now().toString(36)}`, nome: achado.nome.slice(0, 60) || `Ponto ${letra(todos.length)}`, criadoEm: agora, atualizadoEm: agora, decisao: { status: "analise", em: agora }, c: achado.c, modelo: "low", m2: dados?.premissas?.modelos.low.padraoM2 ?? 1000, imovel: { fachada: false, estacionamento: false, polo: false, aPe: false } };
    setPontos((ps) => [...ps, novo]); setAtualId(novo.id); setAchado(null);
  };
  useEffect(() => { setPois(null); }, [atualId]);

  const idx = atual ? pontos.findIndex((p) => p.id === atual.id) : -1;
  const parec = atual ? parecidas(atual, dados.censo!, dados.unidades!) : [];
  const fatores = atual && r && cap ? fatoresDe(atual, r, cap, dados.unidades!, dados.censo!, dados.premissas!) : [];

  const exportar = async () => {
    const m = mapaRef.current;
    if (!m) return;
    setGerando(true);
    const lenteAntes = lente, poisAntes = pois, verAntes = verPois;
    // fotos para o PDF: o mapa como está na tela, o satélite de cada ponto e, do ponto aberto, uma foto por tema na área de 10 min
    const tirar = async (l: Lente, alvo: Parameters<typeof fotoEnquadrada>[1], sat = false) => { setLente(l); await pausa(350); return fotoEnquadrada(m, alvo, sat); };
    try {
      const fotoGeral = pontos.length > 1 ? await fotoDoMapa(m.mapa, !satelite) : null;
      setPois(null); // as academias só aparecem na foto delas
      const sats = new Map<string, string | null>();
      for (const p of pontos) sats.set(p.id, await tirar("limpa", { centro: p.c, zoom: 16 }, true));
      const censo = dados.censo!;
      const areaLim = atual ? (area10 ? limitesDaArea(m.L, area10).pad(0.1) : m.L.latLng(atual.c).toBounds(Math.max(2.5, cap?.raio80 ?? 3) * 2000)) : null;
      const temIdade = censo.celulas.some((c) => c[5]?.length), temDom = censo.celulas.some((c) => c[4]);
      const fotoCap = atual && cap && areaLim ? await tirar("captacao", { limites: areaLim }) : null;
      const fotos = {
        idade: atual && area10 && temIdade ? await tirar("idade", { limites: areaLim! }) : null,
        domicilios: atual && area10 && temDom ? await tirar("domicilios", { limites: areaLim! }) : null,
        renda: atual && area10 ? await tirar("renda", { limites: areaLim! }) : null,
        consumo: atual && area10 && temDom ? await tirar("consumo", { limites: areaLim! }) : null,
        pois: null as string | null,
      };
      const fotoRede = atual ? await tirar("rede", { limites: m.L.latLng(atual.c).toBounds(14000) }) : null;
      let fotoSugestoes: string | null = null;
      if (atual && sugestoes?.sugestoes.length) {
        // enquadra o ponto e as posições sugeridas (com pelo menos 1,5 km em volta do ponto), para os pinos aparecerem grandes
        const lim = m.L.latLngBounds([atual.c, ...sugestoes.sugestoes.map((sg) => sg.c)]).extend(m.L.latLng(atual.c).toBounds(3000));
        fotoSugestoes = await tirar("sugestoes", { limites: lim.pad(0.25) });
      }
      if (poisAntes && atual) {
        setPois(poisAntes); setVerPois(true); await pausa(300);
        fotos.pois = await tirar("limpa", { limites: poisAntes.areaRotulo && area10 ? limitesDaArea(m.L, area10).pad(0.08) : m.L.latLng(poisAntes.c).toBounds(poisAntes.raioKm * 2000) });
      }
      setLente(lenteAntes);
      const mercado = atual && area10 ? {
        perfil: perfilNaArea(censo, area10), renda: classesNaArea(censo, area10), potencial: potencialNaArea(censo, area10),
        densidade: densidadeNaArea(censo, area10), pois: poisAntes, fotos,
      } : null;
      await gerarPdfDoEstudo(montarPdfPonto({
        premissas: dados.premissas!, minutos: MINUTOS_PADRAO, temArea: !!area10, atualId: atual?.id ?? null, mercado,
        fotoCaptacao: fotoCap, fotoRede, fotoSugestoes, sugestoes, comparacao: { foto: fotoGeral }, itensImovel: ITENS,
        populacao: pop && moradores10 != null ? { ...pop, moradores: moradores10 } : null,
        ticket: ex?.ticket ?? null, alunos: ex?.alunos ?? null, vagas: ex?.vagas ?? null,
        pontos: pontos.map((p, i) => {
          const rr = resultados.get(p.id) ?? null;
          const cp = captacaoDe(p, censo, dados.unidades!, todos, dados.premissas!.curva);
          return { ponto: p, letra: letra(i), regiao: regiaoDe(p, dados.unidades!), resultado: rr, captacao: cp,
            fatores: rr ? fatoresDe(p, rr, cp, dados.unidades!, censo, dados.premissas!) : [], parecidas: parecidas(p, censo, dados.unidades!), foto: sats.get(p.id) ?? null };
        }),
      }));
    } finally { setLente(lenteAntes); setPois(poisAntes); setVerPois(verAntes); setGerando(false); }
  };

  return (
    <div className="space-y-4">
      <style>{`.mapa-cinza .leaflet-tile-pane{filter:grayscale(1) contrast(.9) brightness(1.06)}${CSS_POIS}`}</style>

      {/* topo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={voltar}>Todos os estudos</Button>
          <h2 className="font-display text-2xl font-medium">{comparando ? `Comparando ${pontos.length} pontos` : "Estudo de ponto"}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{salvo === "salvando" ? "Salvando…" : salvo === "salvo" ? "Salvo" : salvo === "erro" ? "Não consegui salvar" : ""}</span>
          {editavel && (
            <Button variant={adicionando ? "secondary" : "outline"} onClick={() => setAdicionando((a) => !a)} aria-pressed={adicionando}>{adicionando ? "Clique no mapa…" : "Adicionar ponto"}</Button>
          )}
          <Button onClick={exportar} disabled={gerando || !pontos.length}>{gerando ? "Gerando…" : "Exportar PDF"}</Button>
        </div>
      </div>

      {/* mapa: busca de endereço e camadas à direita, barra de mapa/Street View/zoom embaixo (arranjo do Mapfry) */}
      <div className="relative h-[74vh] min-h-[520px] overflow-hidden rounded-2xl border border-primary/30 bg-muted">
        <div ref={mapaEl} className="absolute inset-0" aria-label="Mapa do estudo de ponto" />
        {(adicionando || verRua || achado) && (
          <div className="absolute left-1/2 top-3 z-[456] flex max-w-[calc(100%-34rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-lg bg-foreground px-3 py-1.5 text-xs text-background shadow max-lg:bottom-20 max-lg:top-auto max-lg:max-w-[calc(100%-1.5rem)]">
            {adicionando ? "Clique no mapa onde fica o imóvel" : verRua ? "Clique no mapa onde quer ver a rua" : <span className="truncate">{achado!.nome}</span>}
            {achado && !adicionando && !verRua && editavel && <Button size="sm" onClick={estudarAchado}>Estudar este endereço</Button>}
            {achado && !adicionando && !verRua && <Button size="sm" variant="ghost" className="text-background hover:bg-background/15 hover:text-background" onClick={() => setAchado(null)}>Fechar</Button>}
          </div>
        )}
        <BuscaEndereco perto={atual?.c ?? (mapaRef.current ? [mapaRef.current.mapa.getCenter().lat, mapaRef.current.mapa.getCenter().lng] : null)}
          aoEscolher={(l) => { setAdicionando(false); setVerRua(false); setAchado(l); mapaRef.current?.mapa.setView(l.c, 16); }} />
        <PainelCamadas itens={LENTES} atual={lente} escolher={(id) => setLente(id as Lente)}
          legenda={lente === "captacao" ? <>
            <div className="flex items-center gap-2">poucos<span className="h-1.5 flex-1 rounded" style={{ background: gradienteRampa }} />muitos alunos</div>
            <p className="mt-1">{area10 ? LEGENDA_DESLOCAMENTO : "tracejado: onde moram 80%"}</p>
          </> : ehCamadaCenso(lente) ? <LegendaCenso camada={lente} /> : lente === "rede" ? "Bolinhas vermelhas: World Gym. Círculos: área de cada unidade." : null}
          sobre={pois ? [{ id: "pois", rotulo: rotuloPois(pois), ativo: verPois, alternar: () => setVerPois((v) => !v), legenda: `${totalPois(pois)} ${ondePois(pois)}`, remover: () => setPois(null) }] : []} />
        <BarraMapa mapa={desenho ? mapaRef.current?.mapa ?? null : null} satelite={satelite} setSatelite={setSatelite} verRua={verRua} setVerRua={(f) => { setAdicionando(false); setVerRua(f); }} />
        <div className="absolute bottom-7 left-3 z-[460]"><ControlePois centro={atual?.c ?? null} aviso area={area10 ? { geometria: area10, rotulo: `${MINUTOS_PADRAO} min de carro` } : null} aoResultado={aoPois} modo={modoPois} setModo={setModoPois} temResultado={!!pois} /></div>
        {rua && <StreetView ponto={rua} fechar={() => setRua(null)} />}
      </div>

      {/* pontos em estudo */}
      {pontos.length > 0 ? (
        <div className="flex gap-2.5 overflow-x-auto pb-1" role="tablist" aria-label="Pontos em estudo">
          {pontos.map((p, i) => {
            const rr = resultados.get(p.id);
            const vv = extras.get(p.id)?.veredito ?? rr?.veredito;
            return (
              <button key={p.id} type="button" role="tab" aria-selected={p.id === atualId} onClick={() => setAtualId(p.id)}
                className="flex min-w-[230px] items-center gap-2.5 rounded-xl border bg-white px-3 py-2.5 text-left hover:bg-muted/40 aria-selected:border-foreground aria-selected:ring-1 aria-selected:ring-foreground">
                <span className="grid h-[26px] w-[26px] flex-none place-items-center rounded-full text-[13px] font-semibold text-white" style={{ background: CORES[i % CORES.length] }}>{letra(i)}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{p.nome}</span>
                  {rr && <span className="block text-xs tabular-nums text-muted-foreground">{reais(rr.provavel)} · {meses(rr.payback)}</span>}</span>
                {rr && vv && <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${FUNDO_VEREDITO[vv]}`}>{VEREDITO_ROTULO[vv]}</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="rounded-2xl border bg-white p-5 text-sm text-muted-foreground">{editavel ? "Clique em \u201c+ Adicionar ponto\u201d e depois no mapa onde fica o imóvel. A conta aparece aqui." : "Nenhum ponto neste estudo."}</p>
      )}

      {pois && <div className="grid gap-4 lg:grid-cols-2"><SecaoPois res={pois} /></div>}
      {atual && <div className="grid gap-4 lg:grid-cols-2"><SecaoSugestoes res={sugestoes} tipo="ponto" nome={atual.nome} aoEstudar={editavel ? estudarSugestao : undefined} /></div>}

      {/* estudo do ponto escolhido, no padrão do estudo de geomarketing */}
      {atual && r && (
        <fieldset disabled={!editavel} className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-white px-4 py-3">
            <input value={atual.nome} onChange={(e) => mudar(atual.id, { nome: e.target.value })} aria-label="Nome do ponto"
              className="min-w-[180px] flex-1 rounded-md bg-transparent font-display text-xl font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <input value={atual.regiao ?? ""} onChange={(e) => mudar(atual.id, { regiao: e.target.value })} placeholder="Região (ex.: Taguatinga Norte)" aria-label="Região do ponto"
              className="min-w-[180px] flex-1 rounded-md bg-transparent text-sm text-muted-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring" />
            <div className="flex gap-1.5" role="group" aria-label="Modelo">
              {(["low", "pro"] as Modelo[]).map((m) => (
                <Pilula key={m} ativo={atual.modelo === m} onClick={() => mudar(atual.id, { modelo: m, m2: dados.premissas!.modelos[m].padraoM2 })}>{dados.premissas!.modelos[m].nome}</Pilula>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="number" min={300} max={8000} step={50} value={atual.m2} onChange={(e) => mudar(atual.id, { m2: Math.max(300, Math.min(8000, Number(e.target.value) || 0)) })}
                className="w-20 rounded-md border bg-white px-2 py-1 text-right text-sm tabular-nums text-foreground" aria-label="Tamanho do imóvel em m²" /> m²
            </label>
          </div>

          <Faixa tom={vf === "aprovado" ? "bom" : vf === "atencao" ? "atencao" : "ruim"}>
            {VEREDITO_ROTULO[vf ?? r.veredito]} pelo modelo · payback {meses(r.payback)}{ex?.vagas?.situacao === "insuficiente" ? " · estacionamento insuficiente" : ""}
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
                {moradores10 != null && <Linha rotulo={`Moradores em ${MINUTOS_PADRAO} min de carro`} valor={`${Math.round(moradores10 / 1000).toLocaleString("pt-BR")} mil`} />}
                {pop && <Linha rotulo="População recomendada" valor={`${Math.round(pop.recomendada / 1000).toLocaleString("pt-BR")} mil${pop.situacao ? ` (${SITUACAO_POPULACAO[pop.situacao]})` : ""}`} />}
                {!pop && moradores10 != null && <Linha rotulo="População recomendada" valor={refsPop ? "rede sem dados" : "calculando…"} />}
                {ex?.ticket && <Linha rotulo="Ticket sugerido" valor={`R$ ${ex.ticket.preco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />}
                {ex?.alunos != null && <Linha rotulo="Alunos para atender" valor={ex.alunos.toLocaleString("pt-BR")} />}
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
                  <Pilula key={st} ativo={(atual.decisao?.status ?? "analise") === st}
                    onClick={() => mudar(atual.id, { decisao: { ...atual.decisao, status: st, em: new Date().toISOString(), previsao: st === "analise" ? undefined : { provavel: Math.round(r.provavel), pessimista: Math.round(r.pessimista), otimista: Math.round(r.otimista) }, unidade: st === "unidade" ? atual.decisao?.unidade : undefined } })}
                  >{DECISAO_ROTULO[st]}</Pilula>
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
                  <Pilula key={it.k} ativo={atual.imovel[it.k]} onClick={() => mudar(atual.id, { imovel: { ...atual.imovel, [it.k]: !atual.imovel[it.k] } })}>{it.rotulo}</Pilula>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {([["vagas", "Vagas do imóvel"], ["vagasPerto", "Vagas por perto (rua, parceria)"]] as const).map(([k, rot]) => (
                  <label key={k} className="text-xs text-muted-foreground">{rot}
                    <input type="number" min={0} max={2000} step={1} inputMode="numeric" value={atual.imovel[k] ?? ""} placeholder="não informado" aria-label={rot}
                      onChange={(e) => { const t = e.target.value; const n = t === "" ? undefined : Math.max(0, Math.min(2000, Math.round(Number(t) || 0))); mudar(atual.id, { imovel: { ...atual.imovel, [k]: n, ...(k === "vagas" ? { estacionamento: (n ?? 0) > 0 } : {}) } }); }}
                      className="mt-1 w-full rounded-md border bg-white px-2 py-1 text-right text-sm tabular-nums text-foreground" />
                  </label>
                ))}
              </div>
              {ex?.vagas && <div className="mt-3"><Nota>
                Para {ex.alunos?.toLocaleString("pt-BR")} alunos o ponto precisa de {ex.vagas.min} a {ex.vagas.max} vagas (8% a 12% no mesmo horário, 20% a 30% de carro).{" "}
                {ex.vagas.situacao === "sem-dado" ? "Informe as vagas: estacionamento é critério eliminatório." : `Informadas: ${ex.vagas.informadas}, ${SITUACAO_VAGAS[ex.vagas.situacao]}${ex.vagas.situacao === "insuficiente" ? ": o ponto não é aprovado" : ""}.`}
              </Nota></div>}
            </Secao>
            {parec.length > 0 && (
              <Secao icone={Store} titulo="Unidades parecidas na rede">
                {parec.map((u) => <Linha key={u.nome} rotulo={`${u.nome}, ${u.m2?.toLocaleString("pt-BR")} m²`} valor={u.vendas ? reais(u.vendas) : "—"} />)}
                <div className="mt-3"><Nota>Mesma quantidade de moradores e renda a até 2 km.</Nota></div>
              </Secao>
            )}
          </div>
          <div className="flex justify-end text-xs text-muted-foreground">
            {editavel ? <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { if (window.confirm(`Remover o ${atual.nome}?`)) remover(atual.id); }}>Remover ponto {letra(idx)}</Button> : <span>Só consulta</span>}
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
