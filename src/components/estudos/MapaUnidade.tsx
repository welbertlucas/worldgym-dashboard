import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useRef, useState } from "react";
import { CREDITO_DO_MAPA, camadaRuas, ZOOMS_DO_SATELITE, gradienteArco, aplicarFundo, bolinha, cartaoDoLugar, primeiraComImagem, carregarLeaflet, fotoEnquadrada, gradienteRampa, pausa, pinoUnidade, type Fundo, type Leaflet } from "@/components/estudos/mapaComum";
import { StreetView } from "@/components/estudos/StreetView";
import { BarraMapa, PainelCamadas, TelaDeMapa, useAlturaAteOFim } from "@/components/estudos/controlesMapa";
import { LEGENDA_DESLOCAMENTO, areaOficial, desenharDeslocamento, limitesDaArea, raioQueCobre, useDeslocamento, useReferenciaPopulacao } from "@/components/estudos/deslocamento";
import { CSS_POIS, AcoesPois, ControlePois, SecaoPois, buscarPois, carregarServicos, ondePois, rotuloPois, totalPois, usePoisNoMapa, type ModoPois, type ResultadoPois } from "@/components/estudos/pois";
import { API_BASE, authFetch } from "@/lib/auth";
import { gerarPdfDoEstudo } from "@/lib/estudoPdf";
import { Barras, Destaque, Linha, Nota, Partes, ReguaSimples, Secao } from "@/components/estudos/blocos";
import { ChevronsUpDown, MapPin, Network, TrendingUp, Users } from "lucide-react";
import { LegendaCenso, type ResumoCenso, LegendaRenda, desenharCenso, desenharDemanda, ehCamadaCenso } from "@/components/estudos/camadasCenso";
export { LegendaRenda };
import { REGRAS_NOVA_UNIDADE, SecaoSugestoes, type ResultadoSugestoes, desenharSugestoes, enderecoCurto, textoParecerSugestao, useEnderecos, enderecoDaPosicao, useSugestoesSemSaturacao } from "@/components/estudos/sugestoes";
import { montarPdfUnidade } from "@/components/estudos/pdfUnidade";
import { buscarFotosDaRua, comFotosDaRegiao, paginaDeFotos } from "@/components/estudos/fotosRua";
import { avaliarPonto, faixaDaFatia, refsParaModelo, suavizarContagem, lacunaDeCaptacao, zonasDeCaptacao, canibalizacaoObservada, unidadesMaisProximas, comercioEm, rendaTotalEm, MINUTOS_PADRAO, FAIXAS_IDADE, compararComParecidas, leituraParecidas, idadeEm, densidadeEm, densidadeNaArea, posicoesMelhores, captacaoDe, classesNaArea, classesNoRaio, dentroDaArea, km, potencialNaArea, minutosPara80, moradoresNaArea, parteDosAlunos, perfilNaArea, raio80Real, reais, unidadeComoPonto, type DadosEstudos, type Sugestao, type UnidadeEstudo } from "@/lib/estudoPonto";

// "limpa": só a unidade (foto de satélite e de academias do PDF); "oportunidade": demanda potencial + onde moram os alunos
type Lente = "alunos" | "modelo" | "pessoas" | "idade" | "domicilios" | "renda" | "rendaTotal" | "consumo" | "comercio" | "rede" | "limpa" | "oportunidade";
const LENTES: { id: Lente; rotulo: string }[] = [
  { id: "alunos", rotulo: "Base de clientes" }, { id: "modelo", rotulo: "Demanda potencial" }, { id: "oportunidade", rotulo: "Lacuna de captação" },
  { id: "pessoas", rotulo: "População" }, { id: "idade", rotulo: "Idade" }, { id: "domicilios", rotulo: "Domicílios" },
  { id: "renda", rotulo: "Renda" }, { id: "rendaTotal", rotulo: "Renda total" }, { id: "consumo", rotulo: "Potencial de consumo" }, { id: "comercio", rotulo: "Concentração comercial" }, { id: "rede", rotulo: "Canibalização" },
];
const SEM_UNIDADES: UnidadeEstudo[] = [];
const ZONAS_COR = ["#c41230", "#e8851c", "#e3b505"]; // primária, secundária, terciária
const ZONAS_NOME = ["Primária", "Secundária", "Terciária"];
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
  const [avisoPdf, setAvisoPdf] = useState("");
  const [pois, setPois] = useState<ResultadoPois | null>(null);
  const [modoPois, setModoPois] = useState<ModoPois>("nomes");
  const [verPois, setVerPois] = useState(true);
  const [buscandoAcademias, setBuscandoAcademias] = useState(false);
  const [verNova, setVerNova] = useState(true);
  const [verParec, setVerParec] = useState(false);
  // contagem de alunos ativos por hexágono do Censo, feita pela rotina noturna a partir do CEP (só totais; some se a rotina ainda não rodou)
  const [alunosHex, setAlunosHex] = useState<{ celulas: [number, number, number][]; total: number; comPosicao: number; porPrefixo: number } | null>(null);
  useEffect(() => {
    setAlunosHex(null);
    if (!nome) return;
    let vivo = true;
    authFetch(`${API_BASE}/estudos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "alunos-hex", unidade: nome }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (vivo && j && !j.ausente && Array.isArray(j.celulas) && j.celulas.length) setAlunosHex({ celulas: j.celulas, total: j.total ?? 0, comPosicao: j.comPosicao ?? 0, porPrefixo: j.porPrefixo ?? 0 }); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [nome]);
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
  // contagem do CEP -> hexágonos do Censo desta tela (mesmas posições) -> suavizada para o mapa de calor
  const calorAlunos = useMemo(() => {
    const censo = dados.censo;
    if (!alunosHex || !censo || !u?.c) return null;
    const porPosicao = new Map<string, number>();
    censo.celulas.forEach((c, i) => porPosicao.set(`${c[0]},${c[1]}`, i));
    const indices: number[] = [], pesos: number[] = [];
    for (const [la, ln, n] of alunosHex.celulas) { const i = porPosicao.get(`${la},${ln}`); if (i !== undefined) { indices.push(i); pesos.push(n); } }
    return indices.length ? suavizarContagem(censo, indices, pesos, u.c as [number, number]) : null;
  }, [alunosHex, dados.censo, u?.nome]); // eslint-disable-line react-hooks/exhaustive-deps
  // Canibalização observada: contagem de alunos por hexágono das vizinhas (até 4, a até 12 km). Só dono e Master leem as outras unidades; para quem tem só a própria, vem vazio.
  const [vizHex, setVizHex] = useState<{ nome: string; c: [number, number]; celulas: [number, number, number][] }[]>([]);
  useEffect(() => {
    setVizHex([]);
    if (!u?.c || !dados.unidades) return;
    let vivo = true;
    const centro = u.c as [number, number];
    const perto = dados.unidades.filter((x) => x.nome !== u.nome && x.c && km(x.c as [number, number], centro) <= 12).sort((a, b) => km(a.c as [number, number], centro) - km(b.c as [number, number], centro)).slice(0, 4);
    Promise.all(perto.map((x) => authFetch(`${API_BASE}/estudos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "alunos-hex", unidade: x.nome }) })
      .then((r) => (r.ok ? r.json() : null)).then((j) => (j && !j.ausente && Array.isArray(j.celulas) && j.celulas.length ? { nome: x.nome, c: x.c as [number, number], celulas: j.celulas as [number, number, number][] } : null)).catch(() => null)))
      .then((l) => { if (vivo) setVizHex(l.filter((x): x is NonNullable<typeof x> => !!x)); });
    return () => { vivo = false; };
  }, [u?.nome]); // eslint-disable-line react-hooks/exhaustive-deps
  const observada = useMemo(() => (alunosHex && u?.c && vizHex.length ? canibalizacaoObservada({ c: u.c as [number, number], celulas: alunosHex.celulas }, vizHex) : null), [alunosHex, vizHex, u?.nome]); // eslint-disable-line react-hooks/exhaustive-deps
  const topBairros = [...(u?.bairros ?? [])].sort((a, b) => b[3] - a[3]).slice(0, 5);
  const moradores80 = u?.c && r80 && dados.censo ? dados.censo.celulas.reduce((a, [la, ln, p]) => a + (km([la, ln], u.c as [number, number]) <= r80 ? p : 0), 0) : null;
  const comparado = porM2 && mediana ? porM2 / mediana - 1 : null;
  // Área de deslocamento (10 min de carro, Mapbox): quando existe, substitui o raio em linha reta nos números e nos mapas
  const areas = useDeslocamento(u?.c, false);
  const area10 = areaOficial(areas);
  // Lacuna de captação: onde o modelo espera mais alunos do que a unidade tem (só com a contagem por CEP; a área é a de 10 min de carro)
  const lacuna = useMemo(() => {
    const censo = dados.censo;
    if (!capMapa || !calorAlunos || !censo || !u?.c) return null;
    const dentro = (i: number) => { const c = censo.celulas[i]; return area10 ? dentroDaArea(c[0], c[1], area10) : km([c[0], c[1]], u.c as [number, number]) < 5; };
    const l = lacunaDeCaptacao(capMapa, calorAlunos, dentro);
    return l.indices.length ? l : null;
  }, [capMapa, calorAlunos, area10, dados.censo, u?.nome]); // eslint-disable-line react-hooks/exhaustive-deps
  // Zonas de captação: raios que reúnem 70%, 90% e 98% dos alunos (contagem real por CEP), com quantos moradores e que parte deles é aluno em cada zona
  const zonas = useMemo(() => {
    const censo = dados.censo;
    if (!alunosHex || !u?.c) return null;
    const z = zonasDeCaptacao(alunosHex.celulas, u.c as [number, number]);
    if (!z || z.raios.length < 3) return null;
    const centro = u.c as [number, number];
    const dentro = (r: number) => ({
      alunos: alunosHex.celulas.reduce((a, [la, ln, n]) => a + (km(centro, [la, ln]) <= r ? n : 0), 0),
      moradores: censo ? censo.celulas.reduce((a, [la, ln, p]) => a + (km(centro, [la, ln]) <= r ? p : 0), 0) : 0,
    });
    const lista = z.raios.map((r, i) => ({ r, parte: z.partes[i], ...dentro(r) }));
    const na10 = area10 ? alunosHex.celulas.reduce((a, [la, ln, n]) => a + (dentroDaArea(la, ln, area10) ? n : 0), 0) / z.total : null;
    return { lista, na10, total: z.total };
  }, [alunosHex, dados.censo, u?.nome, area10]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const refsTodas = useReferenciaPopulacao(dados.unidades ?? SEM_UNIDADES, dados.censo, candidatasNova && u ? u.modelo : null, dados.areasRede);
  const refsModelo = useMemo(() => (u ? refsParaModelo(refsTodas, u.modelo)?.refs ?? null : null), [refsTodas, u?.modelo]); // do modelo; com poucas unidades, a rede toda // eslint-disable-line react-hooks/exhaustive-deps
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
      mapa.attributionControl.setPrefix(CREDITO_DO_MAPA);
      const ruas = camadaRuas(L).addTo(mapa);
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
      if (lente === "oportunidade" && lacuna && censo) desenharDemanda(L, camadas, censo, lacuna, dentroDoEstudo, "vermelho", area10);
      // anéis finos das zonas primária e secundária por cima da lacuna: magenta dentro do anel menor é o mais fácil de captar (números na legenda da camada)
      if (lente === "oportunidade" && zonas) zonas.lista.slice(0, 2).forEach((z, i) => L.circle(u.c as [number, number], { radius: z.r * 1000, color: ZONAS_COR[i], weight: 2, dashArray: "6 5", fill: false, interactive: false }).addTo(camadas));
      // Base de clientes: o mapa não marca os bairros (dono, 25/11/2026). A posição que o Atlas tem de cada bairro é aproximada (vem do OpenStreetMap) e
      // pode cair longe do bairro de verdade; a camada só lista a quantidade de alunos por bairro no painel. A Lacuna de captação usa a contagem por CEP.
      if (lente === "alunos" && calorAlunos && censo) desenharDemanda(L, camadas, censo, calorAlunos, dentroDoEstudo, "arco", area10);
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
      L.marker(o.c, { icon: pinoUnidade(L, "#c41230", lente === "rede" ? 24 : 22) }).bindTooltip(`World Gym ${o.nome}, a ${fmtKm(km(o.c, u.c))}`)
        .bindPopup(() => cartaoDoLugar(`World Gym ${o.nome}`, o.c as [number, number], o.endereco, "Endereço não cadastrado."), { offset: [0, -16], minWidth: 240, maxWidth: 300 }).addTo(camadas);
      if (lente === "rede") L.circle(o.c, { radius: 2400, color: "#c41230", weight: 1, dashArray: "3 4", fillOpacity: 0.05, interactive: false }).addTo(camadas);
    }
    // canibalização: a área da própria unidade também, mais marcada, para ver onde ela encosta nas vizinhas
    if (lente === "rede") L.circle(u.c, { radius: 2400, color: "#7a0a1e", weight: 1.6, fillColor: "#c41230", fillOpacity: 0.12, interactive: false }).addTo(camadas);
    // clicar no pino abre o cartão com o endereço oficial e as coordenadas (pedido do dono, 23/11/2026)
    L.marker(u.c, { zIndexOffset: 2000, title: u.nome, icon: pinoUnidade(L, "#c41230", 34) })
      .bindTooltip(`<strong>World Gym ${u.nome}</strong>`)
      .bindPopup(() => cartaoDoLugar(`World Gym ${u.nome}`, u.c as [number, number], u.endereco, "Endereço não cadastrado."), { offset: [0, -28], minWidth: 240, maxWidth: 300 }).addTo(camadas);
    if (rua) L.marker(rua, { icon: bolinha(L, "#f59e0b", 14) }).addTo(camadas);
    if (lente !== "rede") desenharDeslocamento(L, camadas, areas);
    // posições sugeridas para uma nova unidade e unidades parecidas: valem em qualquer camada, inclusive sem camada escolhida; só ficam de fora das fotos "limpas" do PDF (satélite e academias)
    const fotoLimpa = lente === "limpa" && gerando;
    if (!fotoLimpa && verNova) desenharSugestoes(L, camadas, novaUnidade, endsNova);
    // unidades parecidas: anel verde (parecida) ou cinza (só referência) com o nome
    if (!fotoLimpa && verParec) for (const it of compParec?.itens ?? []) {
      if (!it.u.c) continue;
      L.circleMarker(it.u.c, { radius: 13, color: it.parecida ? "#127a3a" : "#8a93a3", weight: 3, fill: false, interactive: false }).addTo(camadas);
      L.marker(it.u.c, { interactive: false, icon: L.divIcon({ className: "", iconSize: [140, 16], iconAnchor: [-14, 8], html: `<div style="font:700 11px/16px Inter,sans-serif;color:${it.parecida ? "#127a3a" : "#5b6577"};text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff;white-space:nowrap">${it.u.nome}</div>` }) }).addTo(camadas);
    }
  }, [lente, u, cap, capMapa, lacuna, zonas, pronto, rua, areas, novaUnidade, endsNova, verNova, verParec, calorAlunos, compParec, gerando]); // eslint-disable-line react-hooks/exhaustive-deps

  usePoisNoMapa(pronto ? ref.current : null, verPois ? pois : null, modoPois);
  const aoPois = (r: ResultadoPois | null) => { setPois(r); setVerPois(true); };
  // Academias concorrentes como camada do painel, igual ao estudo de ponto novo; a busca só roda quando a pessoa liga a camada (o servidor guarda cada busca por 90 dias)
  const refazerAcademias = async (): Promise<ResultadoPois | null> => {
    if (!u?.c || !area10) return null;
    setBuscandoAcademias(true);
    try {
      const r = await buscarPois(u.c as [number, number], raioQueCobre(u.c as [number, number], area10), "academias");
      const lugares = r.lugares.filter((l) => dentroDaArea(l.c[0], l.c[1], area10));
      const res = { ...r, lugares, total: lugares.length, areaRotulo: `${MINUTOS_PADRAO} min de carro` };
      setPois(res); setVerPois(true); return res;
    } catch { return null; /* sem resposta: a camada continua desligada e dá para tentar de novo */ } finally { setBuscandoAcademias(false); }
  };

  if (!u) return <p className="rounded-2xl border bg-white p-6 text-sm text-muted-foreground">Nenhuma unidade para mostrar.</p>;


  const exportar = async () => {
    const m = ref.current;
    if (!m || !u.c) return;
    setAvisoPdf("");
    setGerando(true);
    // horários, nota e serviços das academias entram no PDF: gerar o PDF já é o pedido (guardado por 90 dias); se falhar, sai sem eles
    // sem a busca de concorrentes feita, o PDF busca sozinho (como o estudo de ponto, que busca ao abrir; pedido do dono, 26/11/2026)
    let poisComServicos = pois ?? await refazerAcademias();
    if (poisComServicos?.categoria === "academias" && !poisComServicos.servicosCarregados) { try { poisComServicos = await carregarServicos(poisComServicos); setPois(poisComServicos); } catch { /* segue sem os serviços */ } }
    // as fotos saem do mapa: na aba Estudo ele está escondido (sem tamanho) e as fotos vinham vazias; mostra o mapa durante a exportação
    const vistaAntes = vista;
    if (vista === "estudo") { setVista("mapa"); await pausa(400); m.mapa.invalidateSize({ animate: false }); }
    const lenteAntes = lente, poisAntes = poisComServicos, verAntes = verPois;
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
      const temRendaTotal = !!dados.censo?.celulas.some((c) => c[4] && c[8]), temComercio = !!dados.censo?.celulas.some((c) => c[10] !== undefined);
      const fotos = {
        sat: await primeiraComImagem(ZOOMS_DO_SATELITE, (z) => foto("limpa", { centro: u.c as [number, number], zoom: z }, true)),
        alunos: calorAlunos ? await foto("alunos", { limites: areaAlunos }) : null, // sem a contagem por CEP a camada só lista bairros: sem foto no PDF
        oportunidade: lacuna ? await foto("oportunidade", { limites: areaAlunos }) : null,
        pessoas: area10 && dados.censo ? await foto("pessoas", { limites: areaLim }) : null,
        idade: temIdade ? await foto("idade", { limites: areaLim }) : null,
        domicilios: temDom ? await foto("domicilios", { limites: areaLim }) : null,
        renda: dados.censo ? await foto("renda", { limites: areaLim }) : null,
        rendaTotal: area10 && temRendaTotal ? await foto("rendaTotal", { limites: areaLim }) : null,
        consumo: temDom ? await foto("consumo", { limites: areaLim }) : null,
        comercio: area10 && temComercio ? await foto("comercio", { limites: areaLim }) : null,
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
        proximas: u.c ? unidadesMaisProximas(u.c, dados.unidades ?? [], 3, u.nome) : [],
        esperadoNaArea, perfil, renda, rendaTotal: resumoCenso?.rendaTotal ?? null, comercio: resumoCenso?.comercio ?? null, novaUnidade, enderecosNova: novaUnidade?.sugestoes.length ? await Promise.all(novaUnidade.sugestoes.map((x) => enderecoDaPosicao(x.c))) : [], zonas: zonas ? { lista: zonas.lista, na10: zonas.na10, total: zonas.total } : null, canibalObservada: observada, parecidas: compParec, densidade: area10 && censo ? densidadeNaArea(censo, area10) : null, potencial: area10 && censo ? potencialNaArea(censo, area10) : null, pois: poisAntes, divideCom: cap?.divideCom ?? [], fotos,
      }), fotosRua));
    } catch (e) {
      // antes o erro sumia: o botão voltava a "Exportar PDF" e nada baixava. Agora aparece ao lado do botão, com o motivo.
      console.error("Exportar PDF da unidade", e);
      setAvisoPdf(`Não consegui gerar o PDF (${(e as Error)?.message || String(e)}). Tire um print desta mensagem e mande para o suporte do Atlas.`);
    } finally { setLente(lenteAntes); setPois(poisAntes); setVerPois(verAntes); setGerando(false); setVista(vistaAntes); }
  };

  return (
    <>
      <TelaDeMapa caixaRef={caixaMapa} altura={alturaMapa} vista={vista} setVista={setVista}
        subtitulo={`Estudo da unidade${u.m2 ? `, ${u.m2.toLocaleString("pt-BR")} m²` : ""}`}
        titulo={unidades.length > 1
          ? <label className="relative block max-w-full" title="Trocar de unidade">
              <span className="sr-only">Trocar de unidade</span>
              {/* controle visível (borda e seta), e não texto solto: antes parecia só o título e ninguém via que dava para trocar (dono, 25/11/2026) */}
              <select value={u.nome} onChange={(e) => setNome(e.target.value)} aria-label="Unidade" className="w-full cursor-pointer appearance-none truncate rounded-lg border bg-white py-1.5 pl-2.5 pr-8 font-display text-lg font-medium shadow-sm outline-none hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring">
                {unidades.map((x) => <option key={x.nome} value={x.nome}>World Gym {x.nome}</option>)}
              </select>
              <ChevronsUpDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            </label>
          : `World Gym ${u.nome}`}
        navegacao={<>
          {voltar && <Button variant="outline" size="sm" className="h-7 px-2 text-[12px]" onClick={voltar}>Todos os estudos</Button>}
          {verRede && <Button variant="outline" size="sm" className="h-7 px-2 text-[12px]" onClick={verRede}>Mapa da rede</Button>}
        </>}
        acoes={<><Button size="sm" className="h-7 px-2.5 text-[12px]" onClick={exportar} disabled={gerando}>{gerando ? "Gerando…" : "Exportar PDF"}</Button>{avisoPdf && <span role="alert" className="text-[11px] font-medium text-red-700">{avisoPdf}</span>}</>}
        painel={<PainelCamadas itens={LENTES} atual={lente} escolher={(id) => setLente(id as Lente)} vazia="limpa" naColuna
          legenda={lente === "modelo" ? <>
            <div className="flex items-center gap-2">poucos<span className="h-1.5 flex-1 rounded" style={{ background: gradienteRampa }} />muitos alunos</div>
            <p className="mt-1">Onde o modelo espera alunos, pela gente que mora perto e pelas outras World Gym. {area10 ? LEGENDA_DESLOCAMENTO : ""}</p>
          </> : lente === "oportunidade" ? <>
            <div className="flex items-center gap-2">menor<span className="h-1.5 flex-1 rounded" style={{ background: "linear-gradient(90deg,rgba(157,42,107,.08),#9d2a6b)" }} />maior lacuna</div>
            <p className="mt-1">{lacuna ? <>Magenta forte: o modelo espera mais alunos do que a unidade tem ali, o melhor lugar para panfletagem, parcerias e mídia. Sem cor: a unidade já capta o esperado (ou mais).{zonas ? " Os anéis tracejados são as zonas primária (vermelho) e secundária (laranja): magenta dentro do anel menor é o mais fácil de captar." : ""}</> : "Aguardando a contagem de alunos por CEP (rotina noturna) para comparar com o que o modelo espera."}</p>
              {zonas && <div className="mt-2.5 border-t pt-2 text-foreground">
                <p className="mb-1.5 text-[11px] font-medium">Zonas de captação (de onde vêm os alunos)</p>
                <ul className="space-y-1.5 text-[11px]">
                  {zonas.lista.slice(0, 2).map((z, i) => {
                    const ant = zonas.lista[i - 1];
                    return <li key={i} className="flex gap-2">
                      <span className="mt-0.5 h-3 w-3 flex-none rounded-full" style={{ background: ZONAS_COR[i] }} />
                      <span className="min-w-0 flex-1"><b>{ZONAS_NOME[i]}</b>{ant ? ` (${fmtKm(ant.r)} a ${fmtKm(z.r)})` : ` (até ${fmtKm(z.r)})`}: {Math.round((z.parte - (ant?.parte ?? 0)) * 100)}% dos alunos<br />
                        <span className="text-muted-foreground">{z.moradores.toLocaleString("pt-BR")} moradores dentro de {fmtKm(z.r)}{z.moradores ? `, ${((z.alunos / z.moradores) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% são alunos` : ""}</span></span>
                    </li>;
                  })}
                </ul>
                {zonas.na10 != null && <p className="mt-1.5 text-[11px]">A área de {MINUTOS_PADRAO} min de carro reúne {Math.round(zonas.na10 * 100)}% dos alunos.</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">Raios em linha reta, pelo CEP de {zonas.total.toLocaleString("pt-BR")} alunos ativos (só os com CEP localizado). Cada zona é o menor círculo com 70% (primária) e 90% (secundária) dos alunos.</p>
              </div>}
          </>
            : ehCamadaCenso(lente) ? <LegendaCenso camada={lente} resumo={resumoCenso} />
            : lente === "alunos" ? <>
              {calorAlunos && alunosHex ? <div className="mb-2">
                <div className="flex items-center gap-2">menos<span className="h-1.5 flex-1 rounded" style={{ background: gradienteArco }} />mais alunos</div>
                <p className="mt-1">Mapa suavizado a partir do CEP de {alunosHex.comPosicao.toLocaleString("pt-BR")} alunos ativos{alunosHex.total ? ` (${Math.round((alunosHex.comPosicao / alunosHex.total) * 100)}% da base)` : ""}. Só a contagem por região é guardada, nunca o endereço.{alunosHex.porPrefixo > 0 ? ` ${alunosHex.porPrefixo.toLocaleString("pt-BR")} deles foram posicionados pela região do CEP (CEP que o IBGE não tem), com erro típico de 150 m.` : ""}</p>
              </div> : null}
              <ListaDeBairros bairros={u?.bairros ?? []} total={alunosBairro} ativos={u?.alunos ?? null} />
            </>
            : lente === "rede" ? <p>O círculo cheio é a área desta unidade; os tracejados, a de cada vizinha. Quanto do público ela divide com cada uma está na aba Estudo.</p>
            : null}
          sobre={[
            { id: "pois", rotulo: pois ? rotuloPois(pois) : `Academias concorrentes${buscandoAcademias ? " · buscando…" : area10 ? "" : " · aguardando a área de 10 min"}`, ativo: !!pois && verPois,
              alternar: () => { if (!pois) void refazerAcademias(); else setVerPois((v) => !v); },
              legenda: pois ? `${totalPois(pois)} ${ondePois(pois)}` : undefined, remover: pois ? () => setPois(null) : undefined,
              acoes: pois ? <AcoesPois modo={modoPois} setModo={setModoPois} categoria={pois.categoria} atualizar={() => void refazerAcademias()} buscando={buscandoAcademias}
                outros={<ControlePois embutido centro={u.c} aviso={false} area={area10 ? { geometria: area10, rotulo: `${MINUTOS_PADRAO} min de carro` } : null} aoResultado={aoPois} res={pois} modo={modoPois} setModo={setModoPois} temResultado={!!pois && verPois} />} /> : undefined },
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
          divideCom={cap?.divideCom ?? null} observada={observada} compParec={compParec} faixaFatia={faixaDaFatia(refsModelo)} novaUnidade={candidatasNova ? novaUnidade : null} pois={pois} aoMudarPois={setPois}
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
/** Legenda da camada "Base de clientes": só a quantidade de alunos por bairro, sem gráfico nem marcas no mapa. */
function ListaDeBairros({ bairros, total, ativos }: { bairros: [string, number, number, number][]; total: number; ativos: number | null }) {
  const [todos, setTodos] = useState(false);
  const v = [...bairros].sort((a, b) => b[3] - a[3]);
  const mostrar = todos ? v : v.slice(0, 5);
  const resto = v.slice(5).reduce((a, b) => a + b[3], 0);
  const pct = (n: number) => `${Math.round((n / Math.max(1, total)) * 100)}%`;
  if (!v.length) return <p>Sem alunos com bairro identificado.</p>;
  return (
    <div className="text-foreground">
      <p className="mb-1.5 text-[11px] text-muted-foreground">Alunos ativos por bairro (quantidade · %)</p>
      <ul className={`space-y-1 text-[11px] ${todos ? "max-h-52 overflow-y-auto pr-1" : ""}`}>
        {mostrar.map(([b, , , n]) => (
          <li key={b} className="flex items-baseline gap-2"><span className="min-w-0 flex-1 break-words">{b.replace(/\s*\([^)]*\)/, "")}</span><span className="whitespace-nowrap tabular-nums"><b>{n.toLocaleString("pt-BR")}</b> · {pct(n)}</span></li>
        ))}
        {!todos && v.length > 5 && <li className="flex items-baseline gap-2 text-muted-foreground"><span className="flex-1">Outros {v.length - 5} bairros</span><span className="whitespace-nowrap tabular-nums"><b>{resto.toLocaleString("pt-BR")}</b> · {pct(resto)}</span></li>}
      </ul>
      {v.length > 5 && <button type="button" onClick={() => setTodos((t) => !t)} className="mt-1 block font-medium underline underline-offset-2">{todos ? "Mostrar só os 5 maiores" : `Ver mais bairros`}</button>}
      <p className="mt-1.5 text-[11px] text-muted-foreground">{total.toLocaleString("pt-BR")} alunos com bairro identificado{ativos ? `, de ${ativos.toLocaleString("pt-BR")} ativos` : ""}, pelo bairro do cadastro no EVO. O mapa não marca os bairros (posição aproximada).</p>
    </div>
  );
}

function EstudoDaUnidade({ u, porM2, mediana, area10, parte10, onde80, moradoresArea, resumo, topBairros, alunosBairro, divideCom, observada, compParec, faixaFatia, novaUnidade, pois, aoMudarPois, aoEstudar, aoVerNoMapa }: {
  u: UnidadeEstudo; porM2: number | null; mediana: number | null; area10: boolean; parte10: number | null; onde80: string;
  moradoresArea: number | null; resumo: ResumoCenso | undefined; topBairros: [string, number, number, number][]; alunosBairro: number;
  divideCom: { nome: string; parte: number }[] | null; observada: ReturnType<typeof canibalizacaoObservada>; compParec: ReturnType<typeof compararComParecidas> | null; faixaFatia: ReturnType<typeof faixaDaFatia>;
  novaUnidade: ResultadoSugestoes | null; pois: ResultadoPois | null; aoMudarPois?: (r: ResultadoPois) => void; aoEstudar?: (s: Sugestao, i: number, endereco?: string | null) => void; aoVerNoMapa: () => void;
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
        {observada && <div className="mt-3 border-t pt-3">
          <p className="mb-1 text-[12px] font-medium text-foreground">Observado nos alunos</p>
          <p className="text-[12px]"><b>{Math.round(observada.algumaOutra * 100)}%</b> dos alunos moram mais perto de outra World Gym.</p>
          <ul className="mt-1.5 space-y-1 text-[11.5px] text-muted-foreground">
            {observada.itens.map((x) => <li key={x.nome}><b className="text-foreground">{x.nome.replace("World Gym ", "")}</b> ({fmtKm(x.km)}): {Math.round(x.meusPertoDela * 100)}% dos alunos daqui moram mais perto dela; {Math.round(x.delaPertoDaqui * 100)}% dos alunos dela moram mais perto daqui.</li>)}
          </ul>
          <p className="mt-1.5 text-[11px] text-muted-foreground">Linha reta, pela contagem por CEP. O modelo acima estima o que cada vizinha atrai; aqui é onde os alunos moram de verdade. Os percentuais por vizinha não somam.</p>
        </div>}
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
      {pois && <SecaoPois res={pois} aoMudar={aoMudarPois} />}
    </div>
  );
}
