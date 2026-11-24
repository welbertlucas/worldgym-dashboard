import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useRef, useState } from "react";
import { aplicarFundo, bolinha, cartaoDoLugar, carregarLeaflet, fotoEnquadrada, gradienteRampa, pausa, pino, type Fundo, type Leaflet } from "@/components/estudos/mapaComum";
import { StreetView } from "@/components/estudos/StreetView";
import { BarraMapa, PainelCamadas, TelaDeMapa, useAlturaAteOFim } from "@/components/estudos/controlesMapa";
import { LEGENDA_DESLOCAMENTO, areaOficial, desenharDeslocamento, limitesDaArea, useDeslocamento, useReferenciaPopulacao } from "@/components/estudos/deslocamento";
import { CSS_POIS, ControlePois, SecaoPois, ondePois, rotuloPois, totalPois, usePoisNoMapa, type ModoPois, type ResultadoPois } from "@/components/estudos/pois";
import { gerarPdfDoEstudo } from "@/lib/estudoPdf";
import { Barras, Destaque, Linha, Nota, Partes, ReguaSimples, Secao } from "@/components/estudos/blocos";
import { MapPin, Network, TrendingUp, Users } from "lucide-react";
import { COR_OUTROS_BAIRROS, CORES_BAIRROS, LegendaCenso, type ResumoCenso, LegendaRenda, RoscaBairros, desenharCenso, desenharDemanda, ehCamadaCenso } from "@/components/estudos/camadasCenso";
export { LegendaRenda };
import { REGRAS_NOVA_UNIDADE, SecaoSugestoes, type ResultadoSugestoes, desenharSugestoes, enderecoCurto, textoParecerSugestao, useEnderecos, useSugestoesSemSaturacao } from "@/components/estudos/sugestoes";
import { montarPdfUnidade } from "@/components/estudos/pdfUnidade";
import { buscarFotosDaRua, comFotosDaRegiao, paginaDeFotos } from "@/components/estudos/fotosRua";
import { avaliarPonto, faixaDaFatia, comercioEm, rendaTotalEm, MINUTOS_PADRAO, FAIXAS_IDADE, compararComParecidas, leituraParecidas, idadeEm, densidadeEm, densidadeNaArea, posicoesMelhores, captacaoDe, classesNaArea, classesNoRaio, dentroDaArea, km, potencialNaArea, minutosPara80, moradoresNaArea, parteDosAlunos, perfilNaArea, raio80Real, reais, unidadeComoPonto, type DadosEstudos, type Sugestao, type UnidadeEstudo } from "@/lib/estudoPonto";

// "limpa": só a unidade (foto de satélite e de academias do PDF); "oportunidade": demanda potencial + onde moram os alunos
type Lente = "alunos" | "modelo" | "pessoas" | "idade" | "domicilios" | "renda" | "rendaTotal" | "consumo" | "comercio" | "rede" | "limpa" | "oportunidade";
const LENTES: { id: Lente; rotulo: string }[] = [
  { id: "alunos", rotulo: "Base de clientes" }, { id: "modelo", rotulo: "Demanda potencial" }, { id: "oportunidade", rotulo: "Oportunidades de captação" },
  { id: "pessoas", rotulo: "População" }, { id: "idade", rotulo: "Idade" }, { id: "domicilios", rotulo: "Domicílios" },
  { id: "renda", rotulo: "Renda" }, { id: "rendaTotal", rotulo: "Renda total" }, { id: "consumo", rotulo: "Potencial de consumo" }, { id: "comercio", rotulo: "Concentração comercial" }, { id: "rede", rotulo: "Canibalização" },
];
const SEM_UNIDADES: UnidadeEstudo[] = [];
const fmtKm = (v: number | null) => (v == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`);

/**
 * Estudo de uma unidade em operação: mapa em cima (onde os alunos moram de verdade, onde o modelo diria, gente, renda, rede)
 * e o estudo embaixo (vendas por m² contra a rede, modelo × realidade, bairros, divisão da captação), com PDF e Street View.
 * `voltar` some quando a pessoa só tem acesso à própria unidade.
 */
/** `estudarPosicao`: cria um estudo de ponto numa posição sugerida para nova unidade e abre esse estudo (só para quem cria estudos). */
export function MapaUnidade({ dados, unidades, inicial, voltar, estudarPosicao, verRede }: { dados: DadosEstudos; unidades: UnidadeEstudo[]; inicial: string; voltar?: () => void; estudarPosicao?: (c: [number, number], nome: string, u: UnidadeEstudo, endereco?: string | null) => void; verRede?: () => void }) {
  const [nome, setNome] = useState(inicial);
  const [lente, setLente] = useState<Lente>("alunos");
  const [fundo, setFundo] = useState<Fundo>("padrao");
  const satelite = fundo === "satelite";
  // o mapa ocupa do topo dele até o fim da tela, sem precisar rolar
  const caixaMapa = useRef<HTMLDivElement>(null);
  const alturaMapa = useAlturaAteOFim(caixaMapa, 480, 0);
  const [vista, setVista] = useState<"mapa" | "estudo">("mapa");
  useEffect(() => { ref.current?.mapa.invalidateSize(); }, [alturaMapa, vista]);
  const [verRua, setVerRua] = useState(false);
  const [rua, setRua] = useState<[number, number] | null>(null);
  const [gerando, setGerando] = useState(false);
  const [pois, setPois] = useState<ResultadoPois | null>(null);
  const [modoPois, setModoPois] = useState<ModoPois>("nomes");
  const [verPois, setVerPois] = useState(true);
  const [verNova, setVerNova] = useState(true);
  const [verParec, setVerParec] = useState(false);
  const el = useRef<HTMLDivElement>(null);
  const ref = useRef<{ L: Leaflet; mapa: import("leaflet").Map; camadas: import("leaflet").LayerGroup; ruas: import("leaflet").TileLayer; sat: import("leaflet").TileLayer } | null>(null);
  const [pronto, setPronto] = useState(false);
  const u = unidades.find((x) => x.nome === nome) ?? unidades[0];
  const outras = (dados.unidades ?? []).filter((x) => x.nome !== u?.nome);
  const cap = useMemo(() => (u?.c && dados.censo && dados.premissas?.curva ? captacaoDe(unidadeComoPonto(u), dados.censo, outras, [], dados.premissas.curva) : null), [u, dados]); // eslint-disable-line react-hooks/exhaustive-deps
  // Para o desenho das camadas de demanda: a mesma conta, num raio que cobre a área de 10 min inteira (os números do estudo usam `cap`)
  const capMapa = useMemo(() => (u?.c && dados.censo && dados.premissas?.curva ? captacaoDe(unidadeComoPonto(u), dados.censo, outras, [], { ...dados.premissas.curva, raioKm: Math.max(dados.premissas.curva.raioKm, 15) }) : null), [u, dados]); // eslint-disable-line react-hooks/exhaustive-deps
  const r80 = u ? raio80Real(u) : null;
  const mediana = u ? dados.vendasPorM2?.[u.modelo]?.mediana ?? null : null;
  const porM2 = u?.vendas && u.m2 ? u.vendas / u.m2 : null;
  const alunosBairro = (u?.bairros ?? []).reduce((a, b) => a + b[3], 0);
  const topBairros = [...(u?.bairros ?? [])].sort((a, b) => b[3] - a[3]).slice(0, 5);
  const moradores80 = u?.c && r80 && dados.censo ? dados.censo.celulas.reduce((a, [la, ln, p]) => a + (km([la, ln], u.c as [number, number]) <= r80 ? p : 0), 0) : null;
  const comparado = porM2 && mediana ? porM2 / mediana - 1 : null;
  // Área de deslocamento (10 min de carro, Mapbox): quando existe, substitui o raio em linha reta nos números e nos mapas
  const areas = useDeslocamento(u?.c, false);
  const area10 = areaOficial(areas);
  const min80 = areas?.carro && u?.bairros?.length ? minutosPara80(u.bairros, areas.carro) : null;
  const parte10 = area10 && u?.bairros?.length ? parteDosAlunos(u.bairros, area10) : null;
  const moradoresArea = area10 && dados.censo ? moradoresNaArea(dados.censo, area10) : moradores80;
  const onde80 = min80 != null ? `${min80.toLocaleString("pt-BR")} min de carro` : areas?.carro ? `mais de 20 min de carro` : fmtKm(r80);
  // onde abrir outra unidade na região (estratégia de expansão: não aparece para quem só tem acesso à própria unidade)
  // candidatas: até 8, para sobrar 3 depois de descartar as regiões saturadas de academias (useSugestoesSemSaturacao)
  const candidatasNova = useMemo(() => (u?.c && dados.censo && dados.premissas && dados.modo !== "unidade"
    ? posicoesMelhores({ c: u.c, m2: dados.premissas.modelos[u.modelo]?.padraoM2 ?? u.m2 ?? 1200 }, dados.censo, dados.unidades ?? [], [], dados.premissas.curva,
      { raioKm: 10, n: 8, separacaoKm: 2.5, ganhoMinimo: -0.3, ...REGRAS_NOVA_UNIDADE })
    : null), [u?.nome, dados]); // eslint-disable-line react-hooks/exhaustive-deps
  // parecer de cada posição sugerida: o mesmo do estudo de ponto, com o tamanho padrão do modelo e a fatia do potencial contra a rede
  const refsModelo = useReferenciaPopulacao(dados.unidades ?? SEM_UNIDADES, dados.censo, candidatasNova && u ? u.modelo : null);
  const avaliacaoNova = useMemo(() => {
    const faixaM2 = u ? dados.vendasPorM2?.[u.modelo] : null;
    if (!u || !dados.premissas || !faixaM2 || !refsModelo) return null;
    const r = avaliarPonto({ m2: dados.premissas.modelos[u.modelo]?.padraoM2 ?? u.m2 ?? 1200, modelo: u.modelo }, dados.premissas, faixaM2);
    return { provavel: r.provavel, veredito: r.veredito, faixa: faixaDaFatia(refsModelo) };
  }, [u?.nome, dados, refsModelo]); // eslint-disable-line react-hooks/exhaustive-deps
  const novaUnidade = useSugestoesSemSaturacao(avaliacaoNova ? candidatasNova : null, dados.censo, 3, avaliacaoNova);
  // Totais da área para a legenda (rosca das classes de renda e valor do potencial de consumo), na mesma área dos hexágonos
  const resumoCenso = useMemo(() => (u?.c && dados.censo ? {
    renda: area10 ? classesNaArea(dados.censo, area10) : classesNoRaio(u.c, dados.censo, 5),
    potencial: area10 ? potencialNaArea(dados.censo, area10) : null,
    rendaTotal: rendaTotalEm(dados.censo, (la, ln) => (area10 ? dentroDaArea(la, ln, area10) : km([la, ln], u.c as [number, number]) < 5)),
    comercio: comercioEm(dados.censo, (la, ln) => (area10 ? dentroDaArea(la, ln, area10) : km([la, ln], u.c as [number, number]) < 5)),
    idade: idadeEm(dados.censo, (la, ln) => (area10 ? dentroDaArea(la, ln, area10) : km([la, ln], u.c as [number, number]) < 5)),
    domicilios: densidadeEm(dados.censo, (la, ln) => (area10 ? dentroDaArea(la, ln, area10) : km([la, ln], u.c as [number, number]) < 5)),
    moradores: area10 ? moradoresNaArea(dados.censo, area10) : dados.censo.celulas.reduce((a, [la, ln, p]) => a + (km([la, ln], u.c as [number, number]) < 5 ? p : 0), 0),
    onde: area10 ? `em ${MINUTOS_PADRAO} min de carro` : "num raio de 5 km",
  } : undefined), [u?.nome, area10, dados.censo]); // eslint-disable-line react-hooks/exhaustive-deps
  // Unidades maduras do mesmo modelo com vizinhança parecida (moradores e renda a até 2 km), para separar o efeito do ponto do da operação.
  // No modo unidade as outras unidades vêm sem vendas, então a comparação não aparece.
  const compParec = useMemo(() => (u?.c && dados.censo ? compararComParecidas(u.c, u.modelo, dados.censo, dados.unidades ?? [], { excluir: u.nome, sujeito: "esta unidade" }) : null), [u?.nome, dados]); // eslint-disable-line react-hooks/exhaustive-deps
  const endsNova = useEnderecos(novaUnidade);
  const verNovaUnidade = () => {
    const m = ref.current;
    if (!m || !u?.c || !novaUnidade?.sugestoes.length) return;
    // ao ligar a camada (ou no link "Ver as posições no mapa"), o mapa enquadra a unidade e as posições sugeridas
    m.mapa.fitBounds(m.L.latLngBounds([u.c, ...novaUnidade.sugestoes.map((x) => x.c)]).pad(0.25));
  };
  const pct0 = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)}%`);


  useEffect(() => {
    let vivo = true;
    carregarLeaflet().then((L) => {
      if (!vivo || !el.current) return;
      // A rolagem do mouse (e o gesto de pinça do trackpad) aproxima o mapa direto.
      const mapa = L.map(el.current, { zoomControl: false, preferCanvas: true, scrollWheelZoom: true, wheelPxPerZoomLevel: 90 }).setView(u?.c ?? [-15.8, -47.9], 13);
      const ruas = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap", crossOrigin: "anonymous" }).addTo(mapa);
      const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Imagens © Esri", crossOrigin: "anonymous" });
      ref.current = { L, mapa, camadas: L.layerGroup().addTo(mapa), ruas, sat };
      setPronto(true);
    });
    return () => { vivo = false; ref.current?.mapa.remove(); ref.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ref.current && u?.c) ref.current.mapa.setView(u.c, 13); setRua(null); setPois(null); }, [nome, pronto]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    aplicarFundo(m, fundo);
  }, [fundo, pronto]);
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

  useEffect(() => {
    const m = ref.current;
    if (!m || !u?.c) return;
    const { L, camadas } = m;
    camadas.clearLayers();
    const censo = dados.censo;
    // a mesma área em todas as camadas: a de 10 min de carro (sem ela, 5 km em volta)
    const dentroDoEstudo = (la: number, ln: number) => (area10 ? dentroDaArea(la, ln, area10) : km([la, ln], u.c as [number, number]) < 5);
    if (lente === "alunos" || lente === "oportunidade") {
      if (lente === "oportunidade" && capMapa && censo) desenharDemanda(L, camadas, censo, capMapa, dentroDoEstudo, "vermelho", area10);
      const mx = Math.max(1, ...(u.bairros ?? []).map((b) => b[3]));
      const totalB = Math.max(1, (u.bairros ?? []).reduce((t, b) => t + b[3], 0));
      // a cor de cada bolha é a do bairro na rosca do painel (os 5 maiores); os outros ficam em cinza
      const corBairro = new Map(topBairros.map(([b], i) => [b, CORES_BAIRROS[i]] as [string, string]));
      for (const [bairro, lat, lng, n] of [...(u.bairros ?? [])].sort((a, b) => b[3] - a[3])) {
        const raio = lente === "oportunidade" ? 4 + 20 * Math.sqrt(n / mx) : 5 + 26 * Math.sqrt(n / mx);
        L.circleMarker([lat, lng], lente === "oportunidade"
          ? { radius: raio, color: "#1b2130", weight: 1.6, fillColor: "#ffffff", fillOpacity: 0.35 }
          : { radius: raio, color: "#fff", weight: 1, fillColor: corBairro.get(bairro) ?? COR_OUTROS_BAIRROS, fillOpacity: 0.72 })
          .bindTooltip(`<strong>${bairro}</strong><br/>${n.toLocaleString("pt-BR")} ${n === 1 ? "aluno" : "alunos"} (${Math.round((n / totalB) * 100)}%)`).addTo(camadas);
        // nos bairros que têm pelo menos 3% dos alunos, o número fica escrito na bolha
        if (lente === "alunos" && n / totalB >= 0.03)
          L.marker([lat, lng], { interactive: false, icon: L.divIcon({ className: "", iconSize: [44, 16], iconAnchor: [22, 8], html: `<div style="text-align:center;font:700 11px/16px Inter,sans-serif;color:#fff;text-shadow:0 0 3px rgba(0,0,0,.65),0 0 2px rgba(0,0,0,.65)">${n.toLocaleString("pt-BR")}</div>` }) }).addTo(camadas);
      }
      if (r80 && !area10) L.circle(u.c, { radius: r80 * 1000, color: "#1b2130", weight: 1.5, dashArray: "5 5", fill: false, interactive: false }).addTo(camadas);
    } else if (lente === "modelo" && cap && capMapa && censo) {
      desenharDemanda(L, camadas, censo, capMapa, dentroDoEstudo, "quente", area10);
      if (cap.raio80 && !area10) L.circle(u.c, { radius: cap.raio80 * 1000, color: "#1b2130", weight: 1.5, dashArray: "5 5", fill: false, interactive: false }).addTo(camadas);
    } else if (ehCamadaCenso(lente) && censo) {
      // como no Mapfry: só os hexágonos de dentro da área de deslocamento (sem ela, num raio de 5 km)
      desenharCenso(L, camadas, censo, lente, dentroDoEstudo, area10);
    }
    for (const o of dados.unidades ?? []) {
      if (!o.c || o.nome === u.nome || lente === "limpa") continue;
      // outras unidades: pino menor que o da unidade aberta (34)
      L.marker(o.c, { icon: pino(L, "#c41230", lente === "rede" ? 24 : 20) }).bindTooltip(`World Gym ${o.nome}, a ${fmtKm(km(o.c, u.c))}`)
        .bindPopup(() => cartaoDoLugar(`World Gym ${o.nome}`, o.c as [number, number], o.endereco, "Endereço não cadastrado."), { offset: [0, -16], minWidth: 240, maxWidth: 300 }).addTo(camadas);
      if (lente === "rede") L.circle(o.c, { radius: 2400, color: "#c41230", weight: 1, dashArray: "3 4", fillOpacity: 0.05, interactive: false }).addTo(camadas);
    }
    // canibalização: a área da própria unidade também, mais marcada, para ver onde ela encosta nas vizinhas
    if (lente === "rede") L.circle(u.c, { radius: 2400, color: "#7a0a1e", weight: 1.6, fillColor: "#c41230", fillOpacity: 0.12, interactive: false }).addTo(camadas);
    // clicar no pino abre o cartão com o endereço oficial e as coordenadas (pedido do dono, 23/11/2026)
    L.marker(u.c, { zIndexOffset: 2000, title: u.nome, icon: pino(L, "#c41230", 34) })
      .bindTooltip(`<strong>World Gym ${u.nome}</strong>`)
      .bindPopup(() => cartaoDoLugar(`World Gym ${u.nome}`, u.c as [number, number], u.endereco, "Endereço não cadastrado."), { offset: [0, -28], minWidth: 240, maxWidth: 300 }).addTo(camadas);
    if (rua) L.marker(rua, { icon: bolinha(L, "#f59e0b", 14) }).addTo(camadas);
    if (lente !== "rede") desenharDeslocamento(L, camadas, areas);
    // posições sugeridas para uma nova unidade: em todas as camadas (menos a limpa das fotos)
    if (lente !== "limpa" && verNova) desenharSugestoes(L, camadas, novaUnidade);
    // unidades parecidas: anel verde (parecida) ou cinza (só referência) com o nome
    if (lente !== "limpa" && verParec) for (const it of compParec?.itens ?? []) {
      if (!it.u.c) continue;
      L.circleMarker(it.u.c, { radius: 13, color: it.parecida ? "#127a3a" : "#8a93a3", weight: 3, fill: false, interactive: false }).addTo(camadas);
      L.marker(it.u.c, { interactive: false, icon: L.divIcon({ className: "", iconSize: [140, 16], iconAnchor: [-14, 8], html: `<div style="font:700 11px/16px Inter,sans-serif;color:${it.parecida ? "#127a3a" : "#5b6577"};text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff;white-space:nowrap">${it.u.nome}</div>` }) }).addTo(camadas);
    }
  }, [lente, u, cap, capMapa, pronto, rua, areas, novaUnidade, verNova, verParec, compParec]); // eslint-disable-line react-hooks/exhaustive-deps

  usePoisNoMapa(pronto ? ref.current : null, verPois ? pois : null, modoPois);
  const aoPois = (r: ResultadoPois | null) => { setPois(r); setVerPois(true); };

  if (!u) return <p className="rounded-2xl border bg-white p-6 text-sm text-muted-foreground">Nenhuma unidade para mostrar.</p>;


  const exportar = async () => {
    const m = ref.current;
    if (!m || !u.c) return;
    setGerando(true);
    // as fotos saem do mapa: na aba Estudo ele está escondido (sem tamanho) e as fotos vinham vazias; mostra o mapa durante a exportação
    const vistaAntes = vista;
    if (vista === "estudo") { setVista("mapa"); await pausa(400); m.mapa.invalidateSize({ animate: false }); }
    const lenteAntes = lente, poisAntes = pois, verAntes = verPois;
    // fotos de rua do último slide: pedidas já no começo (endereço público da unidade, sem pergunta)
    const ruaP = buscarFotosDaRua(u.c, false);
    setPois(null); // as academias só aparecem na foto delas
    // Fotos do mapa num enquadramento fixo (o mesmo para todo mundo): satélite do imóvel e uma foto por tema, na área de 10 min de carro.
    const foto = async (l: Lente, alvo: Parameters<typeof fotoEnquadrada>[1], sat = false) => { setLente(l); await pausa(350); return fotoEnquadrada(m, alvo, sat); };
    try {
      const areaLim = area10 ? limitesDaArea(m.L, area10).pad(0.08) : m.L.latLng(u.c).toBounds(Math.max(3, r80 ?? 3) * 2000);
      // alunos: a área com folga e os bairros com pelo menos 2% dos alunos que ficam perto (nada cortado nas bordas)
      const raioAlunos = Math.max(3, (r80 ?? 3) * 1.25);
      const areaAlunos = area10 ? limitesDaArea(m.L, area10).pad(0.12) : m.L.latLng(u.c).toBounds(raioAlunos * 2000);
      for (const [, la, ln, n] of u.bairros ?? []) if (n >= alunosBairro * 0.02 && km([la, ln], u.c) <= raioAlunos * 2) areaAlunos.extend([la, ln]);
      const temIdade = !!dados.censo?.celulas.some((c) => c[5]?.length), temDom = !!dados.censo?.celulas.some((c) => c[4]);
      const fotos = {
        sat: await foto("limpa", { centro: u.c, zoom: 18 }, true),
        alunos: await foto("alunos", { limites: areaAlunos }),
        oportunidade: cap ? await foto("oportunidade", { limites: areaAlunos }) : null,
        idade: temIdade ? await foto("idade", { limites: areaLim }) : null,
        domicilios: temDom ? await foto("domicilios", { limites: areaLim }) : null,
        renda: dados.censo ? await foto("renda", { limites: areaLim }) : null,
        consumo: temDom ? await foto("consumo", { limites: areaLim }) : null,
        rede: await foto("rede", { limites: m.L.latLng(u.c).toBounds(14000) }),
        nova: novaUnidade?.sugestoes.length ? await foto("rede", { limites: m.L.latLngBounds([u.c, ...novaUnidade.sugestoes.map((x) => x.c)]).pad(0.25) }) : null,
        pois: null as string | null,
      };
      if (poisAntes) {
        setPois(poisAntes); setVerPois(true); await pausa(300);
        fotos.pois = await foto("limpa", { limites: poisAntes.areaRotulo && area10 ? areaLim : m.L.latLng(poisAntes.c).toBounds(poisAntes.raioKm * 2000) });
      }
      setLente(lenteAntes);
      const censo = dados.censo;
      const perfil = area10 && censo ? perfilNaArea(censo, area10) : null;
      const renda = censo ? (area10 ? classesNaArea(censo, area10) : classesNoRaio(u.c, censo, r80 ?? 3)) : null;
      let esperadoNaArea: number | null = null;
      if (cap && area10 && censo) {
        const tot = cap.pesos.reduce((a, b) => a + b, 0);
        esperadoNaArea = tot ? cap.indices.reduce((a, i, k) => a + (dentroDaArea(censo.celulas[i][0], censo.celulas[i][1], area10) ? cap.pesos[k] : 0), 0) / tot : null;
      }
      const fotosRua = paginaDeFotos(await ruaP, "Fotos da Região", `World Gym ${u.nome}`);
      await gerarPdfDoEstudo(comFotosDaRegiao(montarPdfUnidade({
        u, faixa: dados.vendasPorM2?.[u.modelo] ?? null, porM2, comparado, minutos: MINUTOS_PADRAO, temArea: !!area10,
        parteNaArea: parte10, min80, onde80, topBairros: [...(u.bairros ?? [])].sort((a, b) => b[3] - a[3]).slice(0, 8), alunosBairro,
        esperadoNaArea, perfil, renda, novaUnidade, parecidas: compParec, densidade: area10 && censo ? densidadeNaArea(censo, area10) : null, potencial: area10 && censo ? potencialNaArea(censo, area10) : null, pois: poisAntes, divideCom: cap?.divideCom ?? [], fotos,
      }), fotosRua));
    } finally { setLente(lenteAntes); setPois(poisAntes); setVerPois(verAntes); setGerando(false); setVista(vistaAntes); }
  };

  return (
    <>
      <TelaDeMapa caixaRef={caixaMapa} altura={alturaMapa} vista={vista} setVista={setVista}
        subtitulo={`Estudo da unidade${u.m2 ? `, ${u.m2.toLocaleString("pt-BR")} m²` : ""}`}
        titulo={unidades.length > 1
          ? <select value={u.nome} onChange={(e) => setNome(e.target.value)} aria-label="Unidade" className="-ml-1 max-w-[16rem] truncate rounded-md bg-transparent pr-1 font-display text-lg font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
              {unidades.map((x) => <option key={x.nome} value={x.nome}>World Gym {x.nome}</option>)}
            </select>
          : `World Gym ${u.nome}`}
        navegacao={<>
          {voltar && <Button variant="outline" size="sm" className="h-7 px-2 text-[12px]" onClick={voltar}>Todos os estudos</Button>}
          {verRede && <Button variant="outline" size="sm" className="h-7 px-2 text-[12px]" onClick={verRede}>Mapa da rede</Button>}
        </>}
        acoes={<Button size="sm" className="h-7 px-2.5 text-[12px]" onClick={exportar} disabled={gerando}>{gerando ? "Gerando…" : "Exportar PDF"}</Button>}
        painel={<PainelCamadas itens={LENTES} atual={lente} escolher={(id) => setLente(id as Lente)} vazia="limpa" naColuna
          abaExtra={{ rotulo: "Lugares por perto", conteudo: <ControlePois embutido centro={u.c} aviso={false} area={area10 ? { geometria: area10, rotulo: `${MINUTOS_PADRAO} min de carro` } : null} aoResultado={aoPois} res={pois} modo={modoPois} setModo={setModoPois} temResultado={!!pois && verPois} /> }}
          legenda={lente === "modelo" ? <>
            <div className="flex items-center gap-2">poucos<span className="h-1.5 flex-1 rounded" style={{ background: gradienteRampa }} />muitos alunos</div>
            <p className="mt-1">Onde o modelo espera alunos, pela gente que mora perto e pelas outras World Gym. {area10 ? LEGENDA_DESLOCAMENTO : ""}</p>
          </> : lente === "oportunidade" ? <>
            <div className="flex items-center gap-2">menos<span className="h-1.5 flex-1 rounded" style={{ background: "linear-gradient(90deg,rgba(196,18,48,.08),#c41230)" }} />mais alunos esperados</div>
            <p className="mt-1">Vermelho: onde o modelo espera alunos. Círculos escuros: onde eles moram hoje. Vermelho forte sem círculo é onde vale fazer marketing.</p>
          </>
            : ehCamadaCenso(lente) ? <LegendaCenso camada={lente} resumo={resumoCenso} />
            : lente === "alunos" ? <>{topBairros.length > 0 && <div className="mb-2"><RoscaBairros total={alunosBairro} bairros={topBairros.map(([b, , , n]) => ({ nome: b.replace(/\s*\([^)]*\)/, ""), n }))} /></div>}{area10 ? "" : "Tracejado: onde moram 80%."}</>
            : lente === "rede" ? <p>O círculo cheio é a área desta unidade; os tracejados, a de cada vizinha. Quanto do público ela divide com cada uma está na aba Estudo.</p>
            : null}
          sobre={[
            ...(pois ? [{ id: "pois", rotulo: rotuloPois(pois), ativo: verPois, alternar: () => setVerPois((v) => !v), legenda: `${totalPois(pois)} ${ondePois(pois)}`, remover: () => setPois(null) }] : []),
            ...(compParec?.itens.length ? [{ id: "parecidas", rotulo: "Unidades parecidas", ativo: verParec, alternar: () => {
              if (!verParec) { const m = ref.current; if (m && u.c) m.mapa.fitBounds(m.L.latLngBounds([u.c, ...compParec.itens.flatMap((x) => (x.u.c ? [x.u.c] : []))]).pad(0.2)); }
              setVerParec((v) => !v);
            }, legenda: <p>Anel verde: parecida; cinza: só referência. A comparação está na aba Estudo.</p> }] : []),
            ...(candidatasNova ? [{ id: "nova", rotulo: "Onde abrir outra unidade", ativo: verNova, alternar: () => { if (!verNova) verNovaUnidade(); setVerNova((v) => !v); }, legenda: !novaUnidade ? <p>Conferindo as academias em volta das posições…</p> : <>
              {novaUnidade.sugestoes.length
                ? <>{novaUnidade.sugestoes.map((x, i) => <p key={i} className="mb-1"><b className="text-foreground">{i + 1}.</b> {endsNova[i] ? enderecoCurto(endsNova[i]) : "Buscando o endereço…"}{textoParecerSugestao(x.parecer) ? ` · ${textoParecerSugestao(x.parecer)}` : ""}</p>)}
                  <p className="mt-1">Detalhes e o botão para estudar cada posição estão na aba Estudo.</p></>
                : <p>Pelo que o Atlas mede, a região não comporta outra unidade hoje.</p>}
            </> }] : []),
          ]} />}
        mapa={<>
        <style>{`.mapa-cinza .leaflet-tile-pane{filter:grayscale(1) contrast(.9) brightness(1.06)}${CSS_POIS}`}</style>
        <div ref={el} className="absolute inset-0" aria-label={`Mapa da unidade ${u.nome}`} />
        {verRua && <div className="absolute left-1/2 top-3 z-[456] -translate-x-1/2 rounded-lg bg-foreground px-3 py-1.5 text-xs text-background shadow">Clique no mapa onde quer ver a rua</div>}
        <BarraMapa mapa={pronto ? ref.current?.mapa ?? null : null} fundo={fundo} setFundo={setFundo} verRua={verRua} setVerRua={setVerRua} />
        {rua && <StreetView ponto={rua} fechar={() => setRua(null)} />}
        </>}
        estudo={<EstudoDaUnidade u={u} porM2={porM2} mediana={mediana} area10={!!area10} parte10={parte10} onde80={onde80}
          moradoresArea={moradoresArea} resumo={resumoCenso} topBairros={[...(u.bairros ?? [])].sort((a, b) => b[3] - a[3]).slice(0, 8)} alunosBairro={alunosBairro}
          divideCom={cap?.divideCom ?? null} compParec={compParec} faixaFatia={faixaDaFatia(refsModelo)} novaUnidade={candidatasNova ? novaUnidade : null} pois={pois}
          aoEstudar={estudarPosicao ? (s, i, e) => estudarPosicao(s.c, `Nova unidade ${i + 1} perto de ${u.nome}`, u, e) : undefined}
          aoVerNoMapa={() => { setVista("mapa"); setVerNova(true); setTimeout(verNovaUnidade, 60); }} />}
      />
    </>
  );
}

/**
 * Aba Estudo da unidade em operação (pedido do dono, 23/11/2026): os números reais em cards, no padrão do estudo de ponto, sem previsão nem
 * parecer (a unidade já tem o resultado do EVO). As legendas do mapa ficam só com a chave de cores; o detalhe mora aqui.
 */
function EstudoDaUnidade({ u, porM2, mediana, area10, parte10, onde80, moradoresArea, resumo, topBairros, alunosBairro, divideCom, compParec, faixaFatia, novaUnidade, pois, aoEstudar, aoVerNoMapa }: {
  u: UnidadeEstudo; porM2: number | null; mediana: number | null; area10: boolean; parte10: number | null; onde80: string;
  moradoresArea: number | null; resumo: ResumoCenso | undefined; topBairros: [string, number, number, number][]; alunosBairro: number;
  divideCom: { nome: string; parte: number }[] | null; compParec: ReturnType<typeof compararComParecidas> | null; faixaFatia: ReturnType<typeof faixaDaFatia>;
  novaUnidade: ResultadoSugestoes | null; pois: ResultadoPois | null; aoEstudar?: (s: Sugestao, i: number, endereco?: string | null) => void; aoVerNoMapa: () => void;
}) {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const mil = (x: number) => `${Math.round(x / 1000).toLocaleString("pt-BR")} mil`;
  const vsModelo = u.previsto && u.vendas != null && u.madura ? u.vendas / u.previsto.provavel - 1 : null;
  const potencial = resumo?.potencial?.total ?? null;
  const fatia = u.vendas && potencial ? u.vendas / potencial : null;
  const idade = resumo?.idade, totIdade = idade ? idade.reduce((a, b) => a + b, 0) : 0;
  const renda = resumo?.renda;
  const so = divideCom ? Math.max(0, 1 - divideCom.reduce((a, d) => a + d.parte, 0)) : null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Secao icone={TrendingUp} titulo="Resultado">
        <Destaque valor={u.vendas != null ? reais(u.vendas) : "—"} rotulo="vendas por mês (EVO)" tom={vsModelo == null ? "marca" : vsModelo >= 0 ? "bom" : "ruim"} />
        {u.previsto && u.vendas != null && u.madura && <ReguaSimples min={u.previsto.pessimista} max={u.previsto.otimista} valor={u.vendas} rotuloMin={reais(u.previsto.pessimista)} rotuloMax={reais(u.previsto.otimista)}
          rotuloValor={`modelo ${reais(u.previsto.provavel)}`} bom={u.vendas >= u.previsto.provavel} />}
        <div className="mt-3">
          {vsModelo != null && <Linha rotulo="Diferença para o modelo" valor={`${vsModelo >= 0 ? "+" : "−"}${pct(Math.abs(vsModelo))}`} />}
          {porM2 && <Linha rotulo="Vendas por m²" valor={`R$ ${Math.round(porM2).toLocaleString("pt-BR")}${mediana ? ` (rede R$ ${mediana.toLocaleString("pt-BR")})` : ""}`} />}
          {u.alunos != null && <Linha rotulo="Alunos ativos" valor={u.alunos.toLocaleString("pt-BR")} />}
          {u.ticket && <Linha rotulo="Ticket médio" valor={`R$ ${u.ticket.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />}
          {u.m2 && <Linha rotulo="Tamanho" valor={`${u.m2.toLocaleString("pt-BR")} m²`} />}
          {fatia != null && <Linha rotulo={`Fatia do potencial em ${MINUTOS_PADRAO} min`} valor={pct(fatia)} />}
        </div>
        {fatia != null && faixaFatia && <div className="mt-3"><Nota>
          A unidade vende o equivalente a {pct(fatia)} do que os moradores da área de {MINUTOS_PADRAO} min gastam com recreações e esportes.
          Nas {faixaFatia.unidades} unidades maduras do modelo a mediana é {pct(faixaFatia.mediana)}, a comum vai até {pct(faixaFatia.comum)} e a maior chega a {pct(faixaFatia.maxima)}.
        </Nota></div>}
        {!u.madura && <p className="mt-2 text-[11px] text-muted-foreground">Ainda amadurecendo: a comparação com o modelo vale a partir de 12 meses de operação.</p>}
      </Secao>

      <Secao icone={MapPin} titulo="De onde vêm os alunos">
        <div className="grid grid-cols-2 gap-3">
          <Destaque valor={parte10 != null ? pct(parte10) : "—"} rotulo={`moram a até ${MINUTOS_PADRAO} min de carro`} />
          <Destaque valor={onde80.replace(" de carro", "")} rotulo={onde80.includes("de carro") ? "de carro: ali moram 80%" : "onde moram 80%"} />
        </div>
        {topBairros.length > 0 && <div className="mt-4"><Barras itens={topBairros.map(([b, , , n], i) => ({ rotulo: b.replace(/\s*\([^)]*\)/, ""), valor: n, texto: `${n.toLocaleString("pt-BR")} · ${pct(alunosBairro ? n / alunosBairro : 0)}`, destaque: i === 0 }))} /></div>}
        <p className="mt-2 text-[11px] text-muted-foreground">{alunosBairro.toLocaleString("pt-BR")} alunos com bairro localizado{u.alunos ? `, de ${u.alunos.toLocaleString("pt-BR")} ativos` : ""} (EVO). Só contagens por bairro.</p>
      </Secao>

      <Secao icone={Users} titulo={`Área de ${MINUTOS_PADRAO} min de carro`}>
        {!area10 && <p className="mb-2 text-[12px] text-muted-foreground">Sem a área de deslocamento: números num raio de 5 km.</p>}
        <div className="grid grid-cols-2 gap-3">
          <Destaque valor={moradoresArea != null ? mil(moradoresArea) : "—"} rotulo="moradores" />
          <Destaque valor={potencial != null ? (potencial >= 1e6 ? `R$ ${(potencial / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi` : reais(potencial)) : "—"} rotulo="potencial de consumo por mês" />
        </div>
        <div className="mt-3">
          {resumo?.domicilios?.total ? <Linha rotulo="Domicílios" valor={`${resumo.domicilios.total.toLocaleString("pt-BR")}${resumo.domicilios.porDomicilio ? ` (${resumo.domicilios.porDomicilio.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} moradores cada)` : ""}`} /> : null}
          {idade && totIdade > 0 && <Linha rotulo="De 20 a 49 anos" valor={pct((idade[2] + idade[3] + idade[4]) / totIdade)} />}
          {resumo?.rendaTotal && <Linha rotulo="Renda média do domicílio" valor={`R$ ${Math.round(resumo.rendaTotal.porDomicilio).toLocaleString("pt-BR")}`} />}
          {resumo?.comercio != null && <Linha rotulo="Pontos de comércio e serviços" valor={resumo.comercio.toLocaleString("pt-BR")} />}
        </div>
        {renda && renda.moradores > 0 && <div className="mt-3">
          <p className="mb-1.5 text-[12px] font-medium text-foreground">{renda.porDomicilio ? "Domicílios" : "Moradores"} por classe de renda</p>
          <Partes partes={renda.classes.filter((c) => c.parte > 0).map((c) => ({ rotulo: c.id, parte: c.parte, cor: c.cor }))} />
        </div>}
        {idade && totIdade > 0 && <div className="mt-3">
          <p className="mb-1.5 text-[12px] font-medium text-foreground">Moradores por idade</p>
          <Barras itens={FAIXAS_IDADE.map((f, i) => ({ rotulo: f.replace(/^.*\(|\)$/g, ""), valor: idade[i], texto: pct(idade[i] / totIdade), destaque: i >= 2 && i <= 4 }))} />
        </div>}
        <p className="mt-2 text-[11px] text-muted-foreground">Censo 2022 (IBGE) por hexágono; renda do domicílio e potencial (POF 2017-2018, corrigido pelo IPCA) são estimativas.</p>
      </Secao>

      <Secao icone={Network} titulo="Rede">
        {so != null && divideCom && divideCom.length > 0
          ? <><Partes partes={[{ rotulo: "Só desta unidade", parte: so, cor: "#8c0c22" }, ...divideCom.map((d, i) => ({ rotulo: `Divide com ${d.nome.replace("World Gym ", "")}`, parte: d.parte, cor: ["#e0475e", "#f6bcc5", "#cfd3d9"][i] ?? "#cfd3d9" }))]} />
              <p className="mt-2 text-[12px] text-muted-foreground">Parte do público da área que outras World Gym também atraem.</p></>
          : <p className="text-[13px]">Nenhuma World Gym divide a área desta unidade.</p>}
        {compParec && compParec.itens.length > 0 && <div className="mt-4">
          <p className="mb-1.5 text-[12px] font-medium text-foreground">Unidades parecidas</p>
          <Nota>{leituraParecidas(compParec, u.vendas)}</Nota>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {compParec.itens.map((it) => (
              <div key={it.u.nome} className={`rounded-xl border p-2.5 ${it.parecida ? "" : "border-dashed opacity-80"}`}>
                <div className="flex items-center justify-between gap-1"><b className="truncate text-[13px]">{it.u.nome}</b><span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${it.parecida ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{it.parecida ? "parecida" : "referência"}</span></div>
                <p className="mt-1 text-[13px] tabular-nums">{it.u.vendas ? reais(it.u.vendas) : "—"} <span className="text-muted-foreground">por mês</span></p>
                <p className="mt-1 text-[11px] text-muted-foreground">{it.leitura}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Unidades maduras do mesmo modelo, comparadas pelos moradores e pela renda a até 2 km.</p>
        </div>}
      </Secao>

      {novaUnidade && <SecaoSugestoes res={novaUnidade} tipo="nova" nome={u.nome} aoEstudar={aoEstudar} aoVerNoMapa={aoVerNoMapa} />}
      {pois && <SecaoPois res={pois} />}
    </div>
  );
}
