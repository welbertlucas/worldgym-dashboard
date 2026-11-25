import { buscarFotosDaRua, comFotosDaRegiao, paginaDeFotos } from "@/components/estudos/fotosRua";
import "leaflet/dist/leaflet.css";
import { Pilula } from "@/components/ui/pilula";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { API_BASE, authFetch } from "@/lib/auth";
import { ListaEstudos } from "@/components/estudos/ListaEstudos";
import { useCensoCompleto, usaFatorPadrao } from "@/components/estudos/censoMunicipio";
import { PedirCenso } from "@/components/estudos/PedirCenso";
import { CREDITO_DO_MAPA, camadaRuas, ZOOMS_DO_SATELITE, aplicarFundo, cartaoDoLugar, fotoNoPadrao, primeiraComImagem, fotoEnquadrada, gradienteRampa, pausa, pino, pinoUnidade, type Fundo } from "@/components/estudos/mapaComum";
import { StreetView } from "@/components/estudos/StreetView";
import { LEGENDA_DESLOCAMENTO, areaOficial, desenharDeslocamento, limitesDaArea, raioQueCobre, useDeslocamento, useReferenciaPopulacao } from "@/components/estudos/deslocamento";
import { CSS_POIS, AcoesPois, ControlePois, buscarPois, SecaoPois, ondePois, rotuloPois, totalPois, usePoisNoMapa, type ModoPois, type ResultadoPois } from "@/components/estudos/pois";
import { Destaque, Faixa, Linha, Nota, Secao } from "@/components/estudos/blocos";
import { Building2, Calculator, Gavel, ListChecks, Pencil, Store, TrendingUp } from "lucide-react";
import { gerarPdfDoEstudo } from "@/lib/estudoPdf";
import { montarPdfPonto } from "@/components/estudos/pdfPonto";
import { MapaRede } from "@/components/estudos/MapaRede";
import { MapaUnidade } from "@/components/estudos/MapaUnidade";
import { LegendaCenso, RoscaComLegenda, desenharCenso, desenharDemanda, ehCamadaCenso } from "@/components/estudos/camadasCenso";
import { BarraMapa, BuscaEndereco, PainelCamadas, useAlturaAteOFim, TelaDeMapa } from "@/components/estudos/controlesMapa";
import { SecaoSugestoes, desenharSugestoes, ehPlusCode, enderecoCurto, enderecoDaPosicao, useSugestoesSemSaturacao } from "@/components/estudos/sugestoes";
import {
  comercioEm, rendaTotalEm, faixaDaFatia, vereditoComFatia, avaliarCompleto, unidadesMaisProximas, refsParaModelo, freiosDeDemanda, aplicarFreios, contaDoPonto, PARECER_ROTULO, parecerDoPonto, DECISAO_ROTULO, MINUTOS_PADRAO, classesNaArea, classesNoRaio, idadeEm, densidadeEm, densidadeNaArea, perfilNaArea, potencialNaArea, VEREDITO_ROTULO, avaliarPonto, ajusteDeCaptacao, posicoesMelhores, type Sugestao, captacaoDe, dentroDaArea, fatoresDe, km, moradoresNaArea, meses, parecidas, reais, regiaoDe,
  SITUACAO_POPULACAO, SITUACAO_VAGAS, foraDaMalhaDoCenso, limitarSemCenso, compararComParecidas, leituraParecidas, alunosDoPonto, populacaoRecomendada, ticketSugerido, vagasDoPonto, vereditoFinal,
  type DadosEstudos, type Modelo, type Ponto, type Resultado, type StatusDecisao, type Veredito,
} from "@/lib/estudoPonto";

const CORES = ["#c41230", "#1f5f8b", "#7a4bb5", "#0f7b6c", "#b45309", "#334155"];
const letra = (i: number) => String.fromCharCode(65 + (i % 26));
const ITENS: { k: "fachada" | "polo" | "aPe"; rotulo: string }[] = [
  { k: "fachada", rotulo: "Fachada na avenida" },
  { k: "polo", rotulo: "Polo comercial" }, { k: "aPe", rotulo: "Bom acesso a pé" },
];
// "limpa": só os pinos (usada nas fotos de satélite do PDF); "sugestoes": pinos, área e posições sugeridas (foto do PDF)
type Lente = "captacao" | "pessoas" | "idade" | "domicilios" | "renda" | "rendaTotal" | "consumo" | "comercio" | "rede" | "limpa" | "sugestoes";
const LENTES: { id: Lente; rotulo: string }[] = [
  { id: "captacao", rotulo: "Captação estimada" }, { id: "pessoas", rotulo: "População" }, { id: "domicilios", rotulo: "Domicílios" }, { id: "idade", rotulo: "Idade" },
  { id: "renda", rotulo: "Renda" }, { id: "rendaTotal", rotulo: "Renda total" }, { id: "consumo", rotulo: "Potencial de consumo" }, { id: "comercio", rotulo: "Concentração comercial" }, { id: "rede", rotulo: "Canibalização" },
];
const FUNDO_VEREDITO: Record<Veredito, string> = { aprovado: "bg-success/10 text-success", atencao: "bg-warning/10 text-warning", reprovado: "bg-destructive/10 text-destructive" };

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
  /** O Censo de um município de fora da malha principal ainda está chegando. */
  carregandoCenso: boolean;
  /** Busca o Censo dos municípios de novo (depois de pedir o de uma cidade nova). */
  recarregarCenso: () => void;
}

/** O mapa do estudo: painel com os pontos (todos, ou só os escolhidos para comparar), a conta e a decisão; lentes e ferramentas. */
function MapaEstudos({ dados, pontos: todos, setPontos, atualId, setAtualId, iniciarAdicionando, comparando, voltar, salvo, editavel, carregandoCenso, recarregarCenso }: PropsMapa) {
  const [lente, setLente] = useState<Lente>("captacao");
  const cartaoAberto = useRef<string | null>(null);
  // o mapa vai do topo dele até o fim da tela, sem precisar rolar
  const caixaMapa = useRef<HTMLDivElement>(null);
  const alturaMapa = useAlturaAteOFim(caixaMapa, 480, 0);
  const [vista, setVista] = useState<"mapa" | "estudo">("mapa");
  useEffect(() => { mapaRef.current?.mapa.invalidateSize(); }, [alturaMapa, vista]);
  const [adicionando, setAdicionando] = useState(iniciarAdicionando);
  const [fundo, setFundo] = useState<Fundo>("padrao");
  const satelite = fundo === "satelite";
  const [verRua, setVerRua] = useState(false);
  const [rua, setRua] = useState<[number, number] | null>(null);
  const [gerando, setGerando] = useState(false);
  const [avisoPdf, setAvisoPdf] = useState("");
  const [pois, setPois] = useState<ResultadoPois | null>(null);
  useEffect(() => { if (pois?.categoria === "academias") setAvisoPdf(""); }, [pois]);
  const [buscandoAcademias, setBuscandoAcademias] = useState(false);
  const [falhaAcademias, setFalhaAcademias] = useState(false);
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
  // ajuste da previsão pelo lugar (só com Censo na região do ponto e unidades maduras suficientes do modelo)
  const ajusteDe = (p: Ponto) => (foraDaMalhaDoCenso(p.c, dados.censo) ? null : ajusteDeCaptacao(p, dados.premissas!, dados.censo, dados.unidades!));
  const avaliar = (p: Ponto) => (dados.vendasPorM2![p.modelo] ? avaliarPonto(p, dados.premissas!, dados.vendasPorM2![p.modelo]!, ajusteDe(p)?.fator ?? 1) : null);
  const resultados = useMemo(() => new Map(pontos.map((p) => [p.id, avaliar(p)])), [pontos, dados]); // eslint-disable-line react-hooks/exhaustive-deps
  // pontos fora da malha do Censo (ex.: Jataí-GO, antes de o município ser gerado): zero moradores é falta de dado, e o parecer não passa de "com condicionantes"
  const semCensoPorPonto = useMemo(() => new Map(todos.map((p) => [p.id, foraDaMalhaDoCenso(p.c, dados.censo)])), [todos, dados.censo]);
  // ticket sugerido, alunos e vagas de cada ponto (estacionamento insuficiente reprova: critério eliminatório)
  const extras = useMemo(() => new Map(pontos.map((p) => {
    const rr = resultados.get(p.id) ?? null;
    const tk = ticketSugerido(p.modelo, dados.unidades!, parecidas(p, dados.censo!, dados.unidades!));
    const alunos = rr && tk ? alunosDoPonto(rr, tk.preco) : null;
    const vagas = alunos ? vagasDoPonto(alunos, p.imovel) : null;
    return [p.id, { ticket: tk, alunos, vagas, veredito: rr ? vereditoFinal(rr.veredito, vagas) : null }];
  })), [resultados, pontos, dados]); // eslint-disable-line react-hooks/exhaustive-deps
  const cap = useMemo(() => (atual && pronto ? captacaoDe(atual, dados.censo!, dados.unidades!, todos, dados.premissas!.curva) : null), [atual, pontos, dados]); // eslint-disable-line react-hooks/exhaustive-deps
  // Para o desenho da captação: a mesma conta, num raio que cobre a área de 10 min inteira (os números usam `cap`)
  const capMapa = useMemo(() => (atual && pronto ? captacaoDe(atual, dados.censo!, dados.unidades!, todos, { ...dados.premissas!.curva, raioKm: Math.max(dados.premissas!.curva.raioKm, 15) }) : null), [atual, pontos, dados]); // eslint-disable-line react-hooks/exhaustive-deps
  const r = atual ? resultados.get(atual.id) ?? null : null;
  // área de 10 min de carro do ponto aberto (pergunta antes de mandar a posição ao Mapbox)
  const areas = useDeslocamento(atual?.c, true);
  const area10 = areaOficial(areas);
  // ponto aberto fora da malha do Censo: moradores, renda, idade e potencial dariam zero por falta de dado, e o parecer não pode usá-los
  const semCenso = atual ? semCensoPorPonto.get(atual.id) ?? false : false;
  const avisoCenso = semCenso && !carregandoCenso; // o aviso só aparece depois de tentar buscar o município
  const moradores10 = area10 && !semCenso ? moradoresNaArea(dados.censo!, area10) : null;
  // população recomendada calibrada com a rede (moradores na área de 10 min de cada unidade madura do modelo)
  const refsTodas = useReferenciaPopulacao(dados.unidades!, dados.censo, atual?.modelo ?? null);
  const refsPop = useMemo(() => (atual ? refsParaModelo(refsTodas, atual.modelo)?.refs ?? null : null), [refsTodas, atual?.modelo]); // eslint-disable-line react-hooks/exhaustive-deps
  // do modelo; com poucas unidades, a rede toda
  const ex = atual ? extras.get(atual.id) ?? null : null;
  const pop = r && refsPop ? populacaoRecomendada(r.meta, moradores10, refsPop) : null;
  // Totais da área para a legenda (rosca das classes de renda e valor do potencial de consumo)
  const resumoCenso = useMemo(() => (atual && dados.censo && !semCenso ? {
    renda: area10 ? classesNaArea(dados.censo, area10) : classesNoRaio(atual.c, dados.censo, 5),
    potencial: area10 ? potencialNaArea(dados.censo, area10) : null,
    rendaTotal: rendaTotalEm(dados.censo, (la, ln) => (area10 ? dentroDaArea(la, ln, area10) : km([la, ln], atual.c) < 5)),
    comercio: comercioEm(dados.censo, (la, ln) => (area10 ? dentroDaArea(la, ln, area10) : km([la, ln], atual.c) < 5)),
    idade: idadeEm(dados.censo, (la, ln) => (area10 ? dentroDaArea(la, ln, area10) : km([la, ln], atual.c) < 5)),
    domicilios: densidadeEm(dados.censo, (la, ln) => (area10 ? dentroDaArea(la, ln, area10) : km([la, ln], atual.c) < 5)),
    moradores: area10 ? moradoresNaArea(dados.censo, area10) : dados.censo.celulas.reduce((a, [la, ln, p]) => a + (km([la, ln], atual.c) < 5 ? p : 0), 0),
    onde: area10 ? `em ${MINUTOS_PADRAO} min de carro` : "num raio de 5 km",
  } : undefined), [atual?.id, atual?.c[0], atual?.c[1], area10, dados.censo, semCenso]); // eslint-disable-line react-hooks/exhaustive-deps
  // fatia do potencial de consumo que o ponto precisaria (vendas previstas ÷ gasto com esportes na área de 10 min), contra a faixa da rede
  const faixaFatia = faixaDaFatia(refsPop);
  const potencial10 = resumoCenso?.potencial?.total ?? null;
  const fatiaPonto = r && potencial10 ? r.provavel / potencial10 : null;
  // freios da demanda (população, renda e alunos contra a rede): valem para qualquer modelo (decisão do dono, 24/11/2026)
  const ab10 = area10 ? resumoCenso?.renda?.ab ?? null : null;
  const freios = useMemo(() => (r && atual ? freiosDeDemanda({ modelo: atual.modelo, refs: refsTodas, meta: r.meta, moradores: moradores10, ab: ab10, alunosNecessarios: ex?.alunos ?? null, semCenso }).freios : []),
    [r, atual?.modelo, refsTodas, moradores10, ab10, ex?.alunos, semCenso]); // eslint-disable-line react-hooks/exhaustive-deps
  // alunos ativos das unidades maduras do modelo do ponto: régua do gráfico de alunos no PDF
  const alunosRede = useMemo(() => {
    const v = (refsTodas ?? []).filter((x) => atual && x.modelo === atual.modelo && (x.alunos ?? 0) > 0).map((x) => x.alunos as number).sort((a, b) => a - b);
    if (v.length < 2) return null;
    const meio = Math.floor(v.length / 2);
    return { mediana: v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2, maior: v[v.length - 1], n: v.length };
  }, [refsTodas, atual?.modelo]); // eslint-disable-line react-hooks/exhaustive-deps
  const vfBase = aplicarFreios(vereditoComFatia(ex?.veredito ?? r?.veredito ?? null, fatiaPonto, faixaFatia), freios);
  const vf = limitarSemCenso(vfBase, semCenso); // sem Censo nunca passa de "com condicionantes" (decisão do dono, 24/11/2026)
  // os dois modelos lado a lado, com os m² e a posição do imóvel (a troca de modelo não muda o imóvel); o Atlas recomenda o que passa melhor
  const compModelos = useMemo(() => {
    if (!atual || !dados.premissas || !dados.vendasPorM2 || !dados.unidades || !dados.censo) return null;
    const rank: Record<Veredito, number> = { aprovado: 2, atencao: 1, reprovado: 0 };
    const itens = (["low", "pro"] as Modelo[]).flatMap((m) => {
      const av = avaliarCompleto({ ...atual, modelo: m }, { premissas: dados.premissas!, vendasPorM2: dados.vendasPorM2!, unidades: dados.unidades!, censo: dados.censo, refs: refsTodas, area: area10, semCenso });
      return av ? [{ modelo: m, nome: dados.premissas!.modelos[m].nome, r: av.r, veredito: av.veredito, freios: av.freios }] : [];
    });
    if (itens.length < 2) return null;
    const melhor = [...itens].sort((a, b) => rank[b.veredito] - rank[a.veredito] || (a.r.payback === b.r.payback ? 0 : a.r.payback < b.r.payback ? -1 : 1))[0];
    return { itens, recomendado: melhor.veredito === "reprovado" ? null : melhor.modelo };
  }, [atual?.id, atual?.m2, atual?.imovel, atual?.c, dados, refsTodas, area10, semCenso]); // eslint-disable-line react-hooks/exhaustive-deps
  // recomendação: posições até 3 km com mais público alcançável que o ponto aberto
  const candidatasPerto = useMemo(() => (atual && dados.censo && !semCenso && dados.premissas
    ? posicoesMelhores({ c: atual.c, m2: atual.m2 }, dados.censo, dados.unidades!, todos.filter((p) => p.id !== atual.id), dados.premissas.curva, { n: 8 })
    : null), [atual?.id, atual?.c[0], atual?.c[1], atual?.m2, todos.length, dados, semCenso]); // eslint-disable-line react-hooks/exhaustive-deps
  // as posições melhores passam pelo mesmo parecer do ponto (decisão do dono, 23/11/2026): saturadas de academias ou "Não aprova" saem
  const avaliacaoPerto = useMemo(() => (r && atual && refsPop ? { provavel: r.provavel, veredito: (ex?.veredito ?? r.veredito), faixa: faixaFatia } : null),
    [r?.provavel, r?.veredito, ex?.veredito, atual?.id, refsPop, faixaFatia?.comum, faixaFatia?.maxima]); // eslint-disable-line react-hooks/exhaustive-deps
  const sugestoes = useSugestoesSemSaturacao(avaliacaoPerto ? candidatasPerto : null, dados.censo, 3, avaliacaoPerto);

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
      mapa.attributionControl.setPrefix(CREDITO_DO_MAPA);
      const ruas = camadaRuas(L).addTo(mapa);
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
    aplicarFundo(m, fundo);
  }, [fundo, desenho]);

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
    const censo = dados.censo!;
    if (lente === "captacao" && cap && capMapa && atual) {
      desenharDemanda(L, camadas, censo, capMapa, (la, ln) => (area10 ? dentroDaArea(la, ln, area10) : km([la, ln], atual.c) < 5), "quente", area10);
      if (cap.raio80 && !area10) L.circle(atual.c, { radius: cap.raio80 * 1000, color: "#1b2130", weight: 1.5, dashArray: "5 5", fill: false, interactive: false }).addTo(camadas);
    } else if (ehCamadaCenso(lente) && atual) {
      desenharCenso(L, camadas, censo, lente, (la, ln) => (area10 ? dentroDaArea(la, ln, area10) : km([la, ln], atual.c) < 5), area10);
    }
    // unidades da rede (sempre, discretas; em destaque na lente "Nossa rede")
    for (const u of dados.unidades!) {
      if (!u.c) continue;
      // pino pequeno (pedido do dono, 23/11/2026): bolinha não lia como unidade quando o mapa está afastado
      L.marker(u.c, { icon: pinoUnidade(L, "#c41230", lente === "rede" ? 24 : 22) })
        .bindPopup(() => cartaoDoLugar(`World Gym ${u.nome}`, u.c as [number, number], u.endereco, "Endereço não cadastrado."), { offset: [0, -16], minWidth: 240, maxWidth: 300 })
        .bindTooltip(`<strong>World Gym ${u.nome}</strong>${u.m2 ? `<br/>${u.m2.toLocaleString("pt-BR")} m²` : ""}${u.vendas ? `<br/>${reais(u.vendas)} por mês` : ""}${u.madura ? "" : "<br/><em>ainda amadurecendo</em>"}`).addTo(camadas);
      if (lente === "rede" && dados.premissas) L.circle(u.c, { radius: 2400, color: "#c41230", weight: 1, dashArray: "3 4", fillOpacity: 0.05, interactive: false }).addTo(camadas);
    }
    // pontos em estudo
    pontos.forEach((p, i) => {
      const sel = p.id === atualId;
      // canibalização: a área do ponto também (contorno cheio, como a da unidade no estudo dela), para ver onde ela encosta nas World Gym vizinhas
      if (lente === "rede") L.circle(p.c, { radius: 2400, color: "#7a0a1e", weight: sel ? 1.6 : 1, fillColor: "#c41230", fillOpacity: sel ? 0.12 : 0.05, interactive: false }).addTo(camadas);
      const mk = L.marker(p.c, { draggable: editavel, zIndexOffset: sel ? 2000 : 1000, icon: pino(L, CORES[i % CORES.length], sel ? 40 : 32, letra(i)) })
        .bindPopup(() => cartaoDoLugar(`${letra(i)}. ${p.nome}`, p.c, p.endereco, "Sem endereço guardado: use “Buscar o endereço” no estudo, embaixo do nome do ponto."), { offset: [0, -28], minWidth: 240, maxWidth: 300, className: "cartao-pino" }).addTo(camadas);
      // clicar num ponto que não estava escolhido redesenha o mapa: o cartão reabre no pino novo depois do redesenho
      if (cartaoAberto.current === p.id) { cartaoAberto.current = null; setTimeout(() => mk.openPopup(), 0); }
      mk.on("click", () => { if (p.id !== atualId) cartaoAberto.current = p.id; setAtualId(p.id); });
      // arrastou: o endereço guardado deixa de valer
      mk.on("dragend", () => { const ll = mk.getLatLng(); mudar(p.id, { c: [ll.lat, ll.lng], endereco: undefined }); setAtualId(p.id); });
    });
    if (rua) L.marker(rua, { icon: L.divIcon({ className: "", iconSize: [14, 14], iconAnchor: [7, 7], html: '<div style="width:14px;height:14px;border-radius:50%;background:#f59e0b;border:2px solid #fff"></div>' }) }).addTo(camadas);
    if (lente !== "rede") desenharDeslocamento(L, camadas, areas);
    if (lente !== "limpa") desenharSugestoes(L, camadas, sugestoes);
  }, [lente, cap, capMapa, pontos, atualId, desenho, rua, areas, sugestoes]); // eslint-disable-line react-hooks/exhaustive-deps

  usePoisNoMapa(desenho ? mapaRef.current : null, verPois ? pois : null, modoPois);
  const aoPois = (res: ResultadoPois | null) => { setPois(res); setVerPois(true); };
  // pino do endereço achado
  useEffect(() => {
    const m = mapaRef.current;
    if (!m || !achado) return;
    const mk = m.L.marker(achado.c, { zIndexOffset: 3000, icon: pino(m.L, "#1b2130", 34) }).bindTooltip(achado.endereco).addTo(m.mapa);
    return () => { mk.remove(); };
  }, [achado, desenho]);
  const estudarSugestao = (sg: Sugestao, i: number, endereco?: string | null) => {
    if (!atual) return;
    const agora = new Date().toISOString();
    const novo: Ponto = { id: `p${Date.now().toString(36)}`, nome: `Sugestão ${i + 1} de ${atual.nome}`.slice(0, 60), ...(endereco ? { regiao: enderecoCurto(endereco).slice(0, 60), endereco: endereco.slice(0, 160) } : {}), criadoEm: agora, atualizadoEm: agora, decisao: { status: "analise", em: agora }, c: sg.c, modelo: atual.modelo, m2: atual.m2, imovel: { fachada: false, estacionamento: false, polo: false, aPe: false } };
    setPontos((ps) => [...ps, novo]); setAtualId(novo.id);
  };
  const estudarAchado = async () => {
    if (!achado || !editavel) return;
    let { nome, endereco } = achado;
    // só o Plus Code (ou nenhum endereço): busca o endereço da posição, que vai ao Mapbox só depois de confirmar (estudo de ponto é estratégia comercial)
    if (ehPlusCode(nome) || ehPlusCode(endereco) || !endereco) {
      if (window.confirm("Este lugar só tem o Plus Code. Para achar o endereço, a posição será enviada ao Mapbox. Continuar?")) {
        const e = await enderecoDaPosicao(achado.c).catch(() => null);
        if (e) { endereco = e; if (ehPlusCode(nome) || !nome) nome = enderecoCurto(e); }
      }
    }
    const agora = new Date().toISOString();
    const novo: Ponto = { id: `p${Date.now().toString(36)}`, nome: nome.slice(0, 60) || `Ponto ${letra(todos.length)}`, ...(endereco && !ehPlusCode(endereco) ? { endereco: endereco.slice(0, 160), regiao: enderecoCurto(endereco).slice(0, 60) } : {}), criadoEm: agora, atualizadoEm: agora, decisao: { status: "analise", em: agora }, c: achado.c, modelo: "low", m2: dados?.premissas?.modelos.low.padraoM2 ?? 1000, imovel: { fachada: false, estacionamento: false, polo: false, aPe: false } };
    setPontos((ps) => [...ps, novo]); setAtualId(novo.id); setAchado(null);
  };
  useEffect(() => { setPois(null); setVerPois(true); setFalhaAcademias(false); }, [atualId]);
  // Academias concorrentes: a busca roda sozinha quando o estudo abre (assim que a área de 10 min existe); a camada nasce ligada (decisão do dono, 24/11/2026).
  // O servidor guarda cada busca por 90 dias, então abrir o mesmo estudo de novo não é cobrado outra vez. Depois de "Limpar" não busca de novo.
  const buscouAuto = useRef("");
  const atualIdRef = useRef(atualId); atualIdRef.current = atualId;
  const buscarAcademias = async (): Promise<ResultadoPois | null> => {
    if (!atual || !area10) return null;
    setBuscandoAcademias(true);
    try {
      const r = await buscarPois(atual.c, raioQueCobre(atual.c, area10), "academias");
      const lugares = r.lugares.filter((l) => dentroDaArea(l.c[0], l.c[1], area10));
      return { ...r, lugares, total: lugares.length, areaRotulo: `${MINUTOS_PADRAO} min de carro` };
    } catch { return null; } finally { setBuscandoAcademias(false); }
  };
  const refazerAcademias = async () => {
    const res = await buscarAcademias();
    if (res) { setFalhaAcademias(false); setPois(res); setVerPois(true); } else setFalhaAcademias(true);
  };
  useEffect(() => {
    if (!atual || !area10 || pois || buscouAuto.current === atual.id) return;
    buscouAuto.current = atual.id;
    const id = atual.id;
    buscarAcademias().then((res) => { if (res) { setFalhaAcademias(false); setPois((p) => (p ?? (id === atualIdRef.current ? res : null))); } else { buscouAuto.current = ""; if (id === atualIdRef.current) setFalhaAcademias(true); } });
  }, [atual?.id, area10, !!pois]); // eslint-disable-line react-hooks/exhaustive-deps

  const idx = atual ? pontos.findIndex((p) => p.id === atual.id) : -1;
  const compParec = useMemo(() => (atual && !semCenso ? compararComParecidas(atual.c, atual.modelo, dados.censo!, dados.unidades!) : null), [atual?.id, atual?.c[0], atual?.c[1], atual?.modelo, dados]); // eslint-disable-line react-hooks/exhaustive-deps
  const fatores = atual && r && cap ? fatoresDe(atual, r, cap, dados.unidades!, dados.censo!, dados.premissas!, semCenso) : [];

  const exportar = async () => {
    const m = mapaRef.current;
    if (!m) return;
    // o PDF é do estudo aberto; só sai mais de um ponto quando a pessoa escolheu comparar vários na lista (e não há outro estudo "de carona")
    const listaPdf = comparando ? pontos : atual ? [atual] : pontos;
    // sem as academias o parecer sairia sem concorrência: o PDF só sai com elas (decisão do dono, 24/11/2026). A busca roda sozinha ao abrir o estudo;
    // aqui só se refaz se ainda não chegou (ou se a camada foi trocada por outro tipo de lugar).
    let poisPdf = pois;
    if (atual && pois?.categoria !== "academias") {
      setAvisoPdf(""); setGerando(true);
      poisPdf = await buscarAcademias();
      setGerando(false);
      if (!poisPdf) { setAvisoPdf(area10 ? "Não consegui buscar as academias concorrentes agora. Tente de novo em instantes." : "Espere a área de 10 min aparecer no mapa: as academias concorrentes são buscadas nela."); return; }
    }
    setAvisoPdf("");
    setGerando(true);
    // as fotos saem do mapa: na aba Estudo ele está escondido (sem tamanho) e as fotos vinham vazias; mostra o mapa durante a exportação
    const vistaAntes = vista;
    if (vista === "estudo") { setVista("mapa"); await pausa(400); m.mapa.invalidateSize({ animate: false }); }
    const lenteAntes = lente, poisAntes = pois, verAntes = verPois, poisUso = poisPdf;
    // fotos de rua do último slide (até 4 pontos): pedidas já no começo; se a pessoa não autorizar mandar a posição ao Google, para no primeiro
    const ruaP = (async () => {
      const out: (ReturnType<typeof paginaDeFotos>)[] = [];
      for (const [i, p] of listaPdf.slice(0, 4).entries()) {
        const f = await buscarFotosDaRua(p.c, true);
        if (!f && i === 0) break;
        out.push(paginaDeFotos(f, "Fotos da Região", `${letra(i)}. ${p.nome}${p.endereco ? ` · ${enderecoCurto(p.endereco)}` : ""}`));
      }
      return out;
    })();
    // fotos para o PDF: o mapa como está na tela, o satélite de cada ponto e, do ponto aberto, uma foto por tema na área de 10 min
    const tirar = async (l: Lente, alvo: Parameters<typeof fotoEnquadrada>[1], sat = false) => { setLente(l); await pausa(350); return fotoEnquadrada(m, alvo, sat); };
    try {
      const fotoGeral = listaPdf.length > 1 ? await fotoNoPadrao(m, fundo) : null;
      setPois(null); // as academias só aparecem na foto delas
      const sats = new Map<string, string | null>();
      for (const p of listaPdf) sats.set(p.id, await primeiraComImagem(ZOOMS_DO_SATELITE, (z) => tirar("limpa", { centro: p.c, zoom: z }, true)));
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
      if (poisUso && atual) {
        setPois(poisUso); setVerPois(true); await pausa(300);
        fotos.pois = await tirar("limpa", { limites: poisUso.areaRotulo && area10 ? limitesDaArea(m.L, area10).pad(0.08) : m.L.latLng(poisUso.c).toBounds(poisUso.raioKm * 2000) });
      }
      setLente(lenteAntes);
      const mercado = atual && area10 ? (semCenso
        ? { perfil: null, renda: null, potencial: null, densidade: null, pois: poisUso, fotos, semCenso: true }
        : { perfil: perfilNaArea(censo, area10), renda: classesNaArea(censo, area10), potencial: potencialNaArea(censo, area10), densidade: densidadeNaArea(censo, area10), pois: poisUso, fotos }) : null;
      const paginasRua = await ruaP;
      await gerarPdfDoEstudo(comFotosDaRegiao(montarPdfPonto({
        premissas: dados.premissas!, minutos: MINUTOS_PADRAO, temArea: !!area10, atualId: atual?.id ?? null, mercado, semCenso, fatorPadrao: !!atual && !semCenso && usaFatorPadrao(atual.c),
        fotoCaptacao: fotoCap, fotoRede, fotoSugestoes, sugestoes, comparacao: { foto: fotoGeral }, itensImovel: ITENS,
        populacao: pop && moradores10 != null ? { ...pop, moradores: moradores10 } : null,
        ticket: ex?.ticket ?? null, alunos: ex?.alunos ?? null, vagas: ex?.vagas ?? null,
        faixaFatia, freios, alunosRede,
        pontos: listaPdf.map((p, i) => {
          const rr = resultados.get(p.id) ?? null;
          const cp = captacaoDe(p, censo, dados.unidades!, todos, dados.premissas!.curva);
          return { ponto: p, letra: letra(i), regiao: regiaoDe(p, dados.unidades!), resultado: rr, captacao: cp, proximas: unidadesMaisProximas(p.c, dados.unidades!),
            fatores: rr ? fatoresDe(p, rr, cp, dados.unidades!, censo, dados.premissas!, foraDaMalhaDoCenso(p.c, censo)) : [],
            parecidas: foraDaMalhaDoCenso(p.c, censo) ? { ...compararComParecidas(p.c, p.modelo, censo, dados.unidades!), itens: [] } : compararComParecidas(p.c, p.modelo, censo, dados.unidades!), foto: sats.get(p.id) ?? null, semCenso: foraDaMalhaDoCenso(p.c, censo) };
        }),
      }), ...paginasRua));
    } finally { setLente(lenteAntes); setPois(poisAntes); setVerPois(verAntes); setGerando(false); setVista(vistaAntes); }
  };

  return (
    <TelaDeMapa caixaRef={caixaMapa} altura={alturaMapa} vista={vista} setVista={setVista} temEstudo={pontos.length > 0}
      subtitulo={comparando ? `Comparando ${pontos.length} pontos` : "Estudo de ponto"}
      titulo={atual ? <NomeDoEstudo letra={letra(Math.max(0, pontos.findIndex((p) => p.id === atual.id)))} nome={atual.nome} editavel={editavel && !comparando} salvar={(n) => mudar(atual.id, { nome: n })} /> : "Novo estudo"}
      navegacao={<Button variant="outline" size="sm" className="h-7 px-2 text-[12px]" onClick={voltar}>Todos os estudos</Button>}
      acoes={<>
        {editavel && <Button size="sm" className="h-7 px-2.5 text-[12px]" variant={adicionando ? "secondary" : "outline"} onClick={() => { setVista("mapa"); setAdicionando((a) => !a); }} aria-pressed={adicionando}>{adicionando ? "Clique no mapa…" : "Adicionar ponto"}</Button>}
        <Button size="sm" className="h-7 px-2.5 text-[12px]" onClick={exportar} disabled={gerando || carregandoCenso || !pontos.length}>{gerando ? "Gerando…" : "Exportar PDF"}</Button>
        {falhaAcademias && !pois && !buscandoAcademias && <span role="alert" className="text-[11px] font-medium text-red-700">Não consegui buscar as academias concorrentes. <button type="button" className="underline" onClick={() => { buscouAuto.current = ""; setFalhaAcademias(false); buscarAcademias().then((res) => { if (res) setPois(res); else setFalhaAcademias(true); }); }}>Tentar de novo</button></span>}
        {avisoPdf && <span role="alert" className="text-[11px] font-medium text-red-700">{avisoPdf}</span>}
        <span className="text-[11px] text-muted-foreground">{salvo === "salvando" ? "Salvando…" : salvo === "salvo" ? "Salvo" : salvo === "erro" ? "Não consegui salvar" : ""}</span>
      </>}
      painel={<PainelCamadas itens={LENTES} atual={lente} escolher={(id) => setLente(id as Lente)} vazia="limpa" naColuna
          legenda={lente === "captacao" ? <>
            <div className="flex items-center gap-2">poucos<span className="h-1.5 flex-1 rounded" style={{ background: gradienteRampa }} />muitos alunos</div>
            <p className="mt-1">{area10 ? LEGENDA_DESLOCAMENTO : "tracejado: onde moram 80%"}</p>
          </> : ehCamadaCenso(lente) ? <LegendaCenso camada={lente} resumo={resumoCenso} /> : lente === "rede" ? <>
            {cap?.divideCom.length ? (() => {
              const so = Math.max(0, 1 - cap.divideCom.reduce((x, d) => x + d.parte, 0));
              return <RoscaComLegenda soPercentual total={100} centro={{ valor: `${Math.round(so * 100)}%`, rotulo: "exclusivo" }}
                fatias={[{ rotulo: "Só deste ponto", n: so * 100, cor: "#8c0c22" }, ...cap.divideCom.map((d, i) => ({ rotulo: `Divide com ${d.nome.replace("World Gym ", "")}`, n: d.parte * 100, cor: ["#e0475e", "#f6bcc5", "#cfd3d9"][i] ?? "#cfd3d9" }))]} />;
            })() : <p>Nenhuma World Gym divide a área deste ponto.</p>}
            <p className="mt-1.5">Parte do público da área que World Gym vizinhas também atraem. Círculos: a área de cada unidade e a do ponto.</p>
          </> : null}
          sobre={[{ id: "pois", rotulo: pois ? rotuloPois(pois) : `Academias concorrentes${buscandoAcademias ? " · buscando…" : ""}`, ativo: !!pois && verPois,
            alternar: () => { if (!pois) void refazerAcademias(); else setVerPois((v) => !v); },
            legenda: pois ? `${totalPois(pois)} ${ondePois(pois)}` : undefined, remover: pois ? () => setPois(null) : undefined,
            acoes: pois ? <AcoesPois modo={modoPois} setModo={setModoPois} categoria={pois.categoria} atualizar={() => void refazerAcademias()} buscando={buscandoAcademias}
              outros={<ControlePois embutido centro={atual?.c ?? null} aviso area={area10 ? { geometria: area10, rotulo: `${MINUTOS_PADRAO} min de carro` } : null} aoResultado={aoPois} res={pois} modo={modoPois} setModo={setModoPois} temResultado={!!pois && verPois} />} /> : undefined }]} />}
      mapa={<>
        <style>{`.mapa-cinza .leaflet-tile-pane{filter:grayscale(1) contrast(.9) brightness(1.06)}${CSS_POIS}`}</style>
        <div ref={mapaEl} className="absolute inset-0" aria-label="Mapa do estudo de ponto" />
        {(avisoCenso || (semCenso && carregandoCenso)) && !(adicionando || verRua || achado) && (
          <div role="status" className="absolute left-1/2 top-3 z-[456] max-w-[calc(100%-34rem)] -translate-x-1/2 rounded-lg bg-foreground px-3 py-1.5 text-center text-xs text-background shadow max-lg:bottom-20 max-lg:top-auto max-lg:max-w-[calc(100%-1.5rem)]">
            {carregandoCenso ? "Buscando o Censo desta região…" : "Sem dados do Censo nesta região: as camadas de população, renda, idade e consumo ficam vazias."}
          </div>
        )}
        {(adicionando || verRua || achado) && (
          <div className="absolute left-1/2 top-3 z-[456] flex max-w-[calc(100%-34rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-lg bg-foreground px-3 py-1.5 text-xs text-background shadow max-lg:bottom-20 max-lg:top-auto max-lg:max-w-[calc(100%-1.5rem)]">
            {adicionando ? "Clique no mapa onde fica o imóvel" : verRua ? "Clique no mapa onde quer ver a rua" : <span className="truncate">{achado!.nome}</span>}
            {achado && !adicionando && !verRua && editavel && <Button size="sm" onClick={estudarAchado}>Estudar este endereço</Button>}
            {achado && !adicionando && !verRua && <Button size="sm" variant="ghost" className="text-background hover:bg-background/15 hover:text-background" onClick={() => setAchado(null)}>Fechar</Button>}
          </div>
        )}
        <BuscaEndereco perto={atual?.c ?? (mapaRef.current ? [mapaRef.current.mapa.getCenter().lat, mapaRef.current.mapa.getCenter().lng] : null)}
          aoEscolher={(l) => { setAdicionando(false); setVerRua(false); setAchado(l); mapaRef.current?.mapa.setView(l.c, 16); }} />
        <BarraMapa mapa={desenho ? mapaRef.current?.mapa ?? null : null} fundo={fundo} setFundo={setFundo} verRua={verRua} setVerRua={(f) => { setAdicionando(false); setVerRua(f); }} />
        {rua && <StreetView ponto={rua} fechar={() => setRua(null)} />}
      </>}
      estudo={<div className="space-y-4">
      {/* pontos em estudo */}
      {pontos.length > 0 ? (
        <div className="flex gap-2.5 overflow-x-auto pb-1" role="tablist" aria-label="Pontos em estudo">
          {pontos.map((p, i) => {
            const rr = resultados.get(p.id);
            const vv = limitarSemCenso(p.id === atual?.id ? vf ?? rr?.veredito ?? null : extras.get(p.id)?.veredito ?? rr?.veredito ?? null, semCensoPorPonto.get(p.id)); // o ponto aberto já com a fatia do potencial
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
            <EnderecoDoPonto endereco={atual.endereco} editavel={editavel} buscar={async () => {
              // a posição vai ao Mapbox (pelo servidor) só depois de confirmar: estudo de ponto é estratégia comercial
              if (!window.confirm("Para achar o endereço, a posição deste ponto será enviada ao Mapbox. Continuar?")) return;
              const e = await enderecoDaPosicao(atual.c);
              if (e) mudar(atual.id, { endereco: e.slice(0, 160), ...(atual.regiao && !ehPlusCode(atual.regiao) ? {} : { regiao: enderecoCurto(e).slice(0, 60) }), ...(ehPlusCode(atual.nome) ? { nome: enderecoCurto(e).slice(0, 60) } : {}) });
              else window.alert("Não achei o endereço desta posição.");
            }} />
            <div className="flex gap-1.5" role="group" aria-label="Modelo">
              {(["low", "pro"] as Modelo[]).map((m) => (
                <Pilula key={m} ativo={atual.modelo === m} onClick={() => mudar(atual.id, { modelo: m })}>{dados.premissas!.modelos[m].nome}</Pilula>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="number" min={300} max={8000} step={50} value={atual.m2} onChange={(e) => mudar(atual.id, { m2: Math.max(300, Math.min(8000, Number(e.target.value) || 0)) })}
                className="w-20 rounded-md border bg-white px-2 py-1 text-right text-sm tabular-nums text-foreground" aria-label="Tamanho do imóvel em m²" /> m²
            </label>
          </div>

          {compModelos && (
            <div className="rounded-xl border bg-white p-3" role="region" aria-label="Modelo recomendado">
              <p className="text-[13px]"><b className="font-semibold">Modelo recomendado:</b> {compModelos.recomendado ? dados.premissas!.modelos[compModelos.recomendado].nome : "nenhum dos dois aprova este ponto"}</p>
              <p className="text-[11px] text-muted-foreground">Os dois modelos avaliados com o mesmo imóvel ({atual.m2.toLocaleString("pt-BR")} m²). Clique para ver o estudo no outro modelo.</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {compModelos.itens.map((it) => (
                  <button key={it.modelo} type="button" aria-pressed={atual.modelo === it.modelo} onClick={() => mudar(atual.id, { modelo: it.modelo })}
                    className="rounded-lg border px-3 py-2 text-left text-[12px] hover:bg-muted aria-pressed:border-foreground aria-pressed:ring-1 aria-pressed:ring-foreground">
                    <span className="flex items-center justify-between gap-2"><b className="text-[13px]">{it.nome}</b><span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${FUNDO_VEREDITO[it.veredito]}`}>{VEREDITO_ROTULO[it.veredito]}</span></span>
                    <span className="mt-0.5 block text-muted-foreground">{reais(it.r.provavel)} por mês · payback {meses(it.r.payback)}</span>
                    {it.freios.length > 0 && <span className="mt-0.5 block text-destructive">{it.freios.map((f) => ({ populacao: "população abaixo do mínimo da rede", renda: "renda abaixo da rede", alunos: "alunos acima da rede" }[f.id])).join(" · ")}</span>}
                  </button>
                ))}
              </div>
              {atual.m2 < dados.premissas!.modelos[atual.modelo].padraoM2 * 0.75 && <p className="mt-2 text-[11px] text-muted-foreground">O imóvel ({atual.m2.toLocaleString("pt-BR")} m²) é menor que o padrão do {dados.premissas!.modelos[atual.modelo].nome} ({dados.premissas!.modelos[atual.modelo].padraoM2.toLocaleString("pt-BR")} m²). A conta usa o tamanho real.</p>}
            </div>
          )}

          <Faixa tom={vf === "aprovado" ? "bom" : vf === "atencao" ? "atencao" : "ruim"}>
            Parecer do Atlas: {PARECER_ROTULO[vf ?? r.veredito]} · payback {meses(r.payback)}{ex?.vagas?.situacao === "insuficiente" ? " · estacionamento insuficiente" : ""}
          </Faixa>
          {avisoCenso && <Nota><b>Sem dados do Censo nesta região.</b> O Atlas ainda não tem o Censo desta cidade. Moradores, renda, idade, potencial de consumo e divisão com a rede não foram medidos, e o parecer vale só pela estimativa de vendas por m² da rede.
            {editavel && atual && <div className="mt-2"><PedirCenso c={atual.c} aoChegar={recarregarCenso} /></div>}</Nota>}
          {atual && !semCenso && usaFatorPadrao(atual.c) && <Nota><b>Renda estimada com o fator nacional.</b> Para passar da renda do responsável à renda do domicílio, o estado desta cidade ainda não tem o fator próprio, então vale o padrão do país (1,50). A renda e o consumo podem variar uns 3%.</Nota>}

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
            <Secao icone={Gavel} titulo="Parecer do Atlas">
              {(() => {
                const pr = parecerDoPonto({ veredito: vfBase ?? r.veredito, provavel: r.provavel, meta: r.meta, payback: r.payback, mesesAprovado: dados.premissas!.regua.mesesAprovado, mesesAtencao: dados.premissas!.regua.mesesAtencao,
                  vagas: ex?.vagas ?? null, populacao: pop ? { situacao: pop.situacao, recomendada: pop.recomendada } : null, divideCom: semCenso ? [] : cap?.divideCom, semCenso, freios,
                  fatia: fatiaPonto != null && faixaFatia && potencial10 ? { valor: fatiaPonto, potencial: potencial10, comum: faixaFatia.comum, maxima: faixaFatia.maxima } : null });
                const tom = (vf ?? r.veredito) === "aprovado" ? "text-success" : (vf ?? r.veredito) === "atencao" ? "text-warning" : "text-destructive";
                return <>
                  <p className={`font-display text-2xl font-semibold ${tom}`}>{pr.rotulo}</p>
                  <p className="mt-1 text-[13px] text-foreground">{pr.porque}</p>
                  {pr.condicoes.length > 0 && <>
                    <p className="mt-2 text-[12px] font-semibold text-foreground">{(vf ?? r.veredito) === "reprovado" ? "O que mudaria a conclusão" : "Condições para seguir"}</p>
                    <ul className="mt-1 space-y-1 text-[13px]">{pr.condicoes.map((c) => <li key={c} className="flex gap-2"><span className="flex-none text-muted-foreground">•</span>{c}</li>)}</ul>
                  </>}
                  {(() => {
                    const faixaM = dados.vendasPorM2![atual.modelo];
                    if (!faixaM) return null;
                    const reaisM2 = dados.unidades!.filter((u) => u.madura && u.modelo === atual.modelo && u.vendas && u.m2).map((u) => (u.vendas as number) / (u.m2 as number));
                    const linhasConta = contaDoPonto(atual, r, dados.premissas!, faixaM, reaisM2.length ? { min: Math.min(...reaisM2), max: Math.max(...reaisM2), n: reaisM2.length } : null, ajusteDe(atual));
                    return <details className="mt-3 rounded-lg border bg-muted/40 px-2.5 py-1.5"><summary className="cursor-pointer text-xs font-medium text-muted-foreground">Como o Atlas chegou nesse número</summary>
                      <ul className="mt-1.5 space-y-1.5 text-[12px] text-muted-foreground">{linhasConta.map((l) => <li key={l}>{l}</li>)}</ul></details>;
                  })()}
                </>;
              })()}
              <details className="mt-3 rounded-lg border bg-muted/40 px-2.5 py-1.5" open={(atual.decisao?.status ?? "analise") !== "analise"}>
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Registrar o que foi decidido (opcional){(atual.decisao?.status ?? "analise") !== "analise" ? `: ${DECISAO_ROTULO[atual.decisao!.status]}` : ""}</summary>
                <p className="mt-1 text-[11px] text-muted-foreground">Só para guardar o que a diretoria decidiu de fato, por exemplo quando o ponto virar unidade. O Atlas guarda a previsão do dia para comparar depois com as vendas reais.</p>
                <div className="mt-2">
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
                </div>
              </details>
            </Secao>
            <Secao icone={Building2} titulo="O imóvel">
              {atual.origem && <div className="mb-3 rounded-lg border bg-muted/40 px-3 py-2 text-[12px]">
                <p className="mb-1 font-medium text-foreground">Dados do anúncio (da planilha importada)</p>
                {atual.origem.aluguel ? <p>Aluguel: <b className="tabular-nums">{reais(atual.origem.aluguel)}</b> por mês{atual.m2 ? ` · R$ ${(atual.origem.aluguel / atual.m2).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} por m²` : ""}</p> : null}
                {atual.origem.link && /^https?:\/\//i.test(atual.origem.link) ? <p><a href={atual.origem.link} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">Abrir o anúncio</a></p> : null}
                {atual.origem.obs ? <p className="text-muted-foreground">{atual.origem.obs}</p> : null}
              </div>}
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
            {compParec && compParec.itens.length > 0 && (
              <Secao icone={Store} titulo="Unidades parecidas na rede" className="lg:col-span-2">
                <Nota>{leituraParecidas(compParec)}</Nota>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {compParec.itens.map((it) => (
                    <div key={it.u.nome} className={`rounded-xl border p-3 ${it.parecida ? "" : "border-dashed opacity-80"}`}>
                      <div className="flex items-center justify-between gap-2"><b className="text-sm">{it.u.nome}</b><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${it.parecida ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{it.parecida ? "parecida" : "só referência"}</span></div>
                      <Linha rotulo="Vendas por mês" valor={it.u.vendas ? reais(it.u.vendas) : "—"} />
                      <Linha rotulo="Moradores a até 2 km" valor={`${Math.round(it.moradores / 1000).toLocaleString("pt-BR")} mil`} />
                      <Linha rotulo="Renda média" valor={it.renda ? `R$ ${Math.round(it.renda).toLocaleString("pt-BR")}` : "—"} />
                      <p className="mt-1.5 text-[11px] text-muted-foreground">{it.leitura}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">Unidades maduras do mesmo modelo, comparadas pelos moradores e pela renda média a até 2 km (Censo 2022). O ponto tem {Math.round(compParec.alvo.pop / 1000).toLocaleString("pt-BR")} mil moradores{compParec.alvo.renda ? ` e renda média de R$ ${Math.round(compParec.alvo.renda).toLocaleString("pt-BR")}` : ""} a até 2 km.</p>
              </Secao>
            )}
          </div>
          <div className="flex justify-end text-xs text-muted-foreground">
            {editavel ? <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { if (window.confirm(`Remover o ${atual.nome}?`)) remover(atual.id); }}>Remover ponto {letra(idx)}</Button> : <span>Só consulta</span>}
          </div>
        </fieldset>
      )}
      </div>}
    />
  );
}

type Visao = { tela: "lista" } | { tela: "rede" } | { tela: "unidade"; nome: string } | { tela: "mapa"; atualId: string | null; novo: boolean; comparando: Set<string> | null };

/** Estudos de ponto: abre na lista (carteira de estudos); o mapa abre num estudo, num estudo novo ou na comparação. */
export function EstudosPontoTab() {
  const [dadosApi, setDados] = useState<DadosEstudos | null>(null);
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

  // Censo dos municípios de fora da malha principal (ex.: Jataí, Rio Verde): vem do servidor para os pontos que a malha principal não cobre
  // e entra na mesma malha, então lista, mapa e PDF usam `dados.censo` como sempre
  const { censo: censoCompleto, carregando: carregandoCenso, recarregar: recarregarCenso } = useCensoCompleto(dadosApi?.censo, pontos);
  const dados = useMemo(() => (dadosApi && censoCompleto ? { ...dadosApi, censo: censoCompleto } : dadosApi), [dadosApi, censoCompleto]);

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
    // Posição sugerida para nova unidade: vira um estudo de ponto (modelo e tamanho padrão da unidade de origem) e abre no mapa dos estudos
    const estudarPosicao = editavel ? (c: [number, number], nome: string, u: (typeof emOperacao)[number], endereco?: string | null) => {
      const agora = new Date().toISOString();
      const novo: Ponto = { id: `p${Date.now().toString(36)}`, nome: nome.slice(0, 60), regiao: (endereco ? enderecoCurto(endereco) : `perto da WG ${u.nome}`).slice(0, 60), ...(endereco ? { endereco: endereco.slice(0, 160) } : {}), criadoEm: agora, atualizadoEm: agora, decisao: { status: "analise", em: agora }, c, modelo: u.modelo, m2: dados.premissas!.modelos[u.modelo].padraoM2, imovel: { fachada: false, estacionamento: false, polo: false, aPe: false } };
      setPontos((ps) => [...ps, novo]);
      setVisao({ tela: "mapa", atualId: novo.id, novo: false, comparando: null });
    } : undefined;
    return <MapaUnidade dados={dados} unidades={emOperacao} inicial={visao.nome} voltar={() => setVisao({ tela: "lista" })} estudarPosicao={estudarPosicao} verRede={() => setVisao({ tela: "rede" })} />;
  }
  if (visao.tela === "rede") {
    return <MapaRede unidades={dados.unidades ?? []} abrir={(nome) => setVisao({ tela: "unidade", nome })} voltar={() => setVisao({ tela: "lista" })} />;
  }
  if (visao.tela === "lista")
    return (
      <ListaEstudos dados={dados} pontos={pontos} editavel={editavel} abrirUnidade={(nome: string) => setVisao({ tela: "unidade", nome })} verRede={() => setVisao({ tela: "rede" })}
        apagar={editavel ? (id: string) => setPontos((ps) => ps.filter((x) => x.id !== id)) : undefined}
        importar={editavel ? (novos: Ponto[]) => setPontos((ps) => [...ps, ...novos]) : undefined}
        abrir={(id) => setVisao({ tela: "mapa", atualId: id, novo: false, comparando: null })}
        novo={() => setVisao({ tela: "mapa", atualId: null, novo: true, comparando: null })}
        comparar={(ids) => setVisao({ tela: "mapa", atualId: ids[0] ?? null, novo: false, comparando: new Set(ids) })} />
    );
  return (
    <MapaEstudos dados={dados} pontos={pontos} setPontos={setPontos} salvo={salvo} editavel={editavel} carregandoCenso={carregandoCenso} recarregarCenso={recarregarCenso} iniciarAdicionando={visao.novo} comparando={visao.comparando}
      atualId={visao.atualId} setAtualId={(id) => setVisao((v) => (v.tela === "mapa" ? { ...v, atualId: id, comparando: v.comparando && id && !v.comparando.has(id) ? new Set([...v.comparando, id]) : v.comparando } : v))}
      voltar={() => setVisao({ tela: "lista" })} />
  );
}

/** Linha do endereço do ponto, embaixo do nome: o endereço guardado ou o botão para buscar (com confirmação, pois envia a posição ao Mapbox). */
/** Nome do estudo no título: clicar renomeia (Enter ou sair do campo salva, Esc cancela). O nome é livre, ex.: "Unidade Jataí 3". */
function NomeDoEstudo({ letra, nome, editavel, salvar }: { letra: string; nome: string; editavel: boolean; salvar: (nome: string) => void }) {
  const [editando, setEditando] = useState(false);
  const [v, setV] = useState(nome);
  useEffect(() => { setV(nome); setEditando(false); }, [nome]);
  const fim = (grava: boolean) => { setEditando(false); const n = v.replace(/\s+/g, " ").trim().slice(0, 60); if (grava && n && n !== nome) salvar(n); else setV(nome); };
  if (editando) return <span className="flex items-center gap-1"><span>{letra}.</span><input autoFocus value={v} maxLength={60} aria-label="Nome do estudo" onChange={(e) => setV(e.target.value)} onBlur={() => fim(true)}
    onKeyDown={(e) => { if (e.key === "Enter") fim(true); if (e.key === "Escape") fim(false); }} className="min-w-0 flex-1 rounded-md border bg-white px-1.5 py-0.5 font-display text-base font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring" /></span>;
  if (!editavel) return <>{letra}. {nome}</>;
  return <button type="button" onClick={() => setEditando(true)} title="Renomear o estudo" aria-label={`Renomear o estudo ${nome}`} className="group text-left">{letra}. {nome}<Pencil className="ml-1.5 inline h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-foreground" aria-hidden /></button>;
}

function EnderecoDoPonto({ endereco, editavel, buscar }: { endereco?: string; editavel: boolean; buscar: () => Promise<void> }) {
  const [buscando, setBuscando] = useState(false);
  return (
    <div className="flex basis-full items-center gap-2 text-sm text-muted-foreground">
      <span className="min-w-0 truncate" title={endereco}>{endereco ? <>Endereço: <span className="text-foreground">{endereco}</span></> : "Sem endereço guardado."}</span>
      {editavel && <Button type="button" variant="outline" size="sm" className="h-7 px-2.5 text-xs" disabled={buscando} onClick={async () => { setBuscando(true); try { await buscar(); } finally { setBuscando(false); } }}>
        {buscando ? "Buscando…" : endereco ? "Atualizar o endereço" : "Buscar o endereço"}
      </Button>}
    </div>
  );
}

