import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { bolinha, carregarLeaflet, fotoEnquadrada, gradienteRampa, hexagono, pausa, pino, rampa, type Leaflet } from "@/components/estudos/mapaComum";
import { IconeBoneco, StreetView } from "@/components/estudos/StreetView";
import { CSS_POIS, ControlePois, SecaoPois, rotuloPois, totalPois, usePoisNoMapa, type ModoPois, type ResultadoPois } from "@/components/estudos/pois";
import { Destaque, Linha, Nota, Secao } from "@/components/estudos/blocos";
import { MapPin, Scale, TrendingUp, Users } from "lucide-react";
import { gerarPdfDoEstudo, nomeDoArquivo } from "@/lib/estudoPdf";
import { CLASSES_RENDA, captacaoDe, classeDaRenda, classesNoRaio, km, raio80Real, reais, unidadeComoPonto, type DadosEstudos, type UnidadeEstudo } from "@/lib/estudoPonto";

// "limpa": só a unidade (usada na foto de satélite do PDF)
type Lente = "alunos" | "modelo" | "pessoas" | "renda" | "rede" | "limpa";
const LENTES: { id: Lente; rotulo: string }[] = [
  { id: "alunos", rotulo: "Onde moram os alunos" }, { id: "modelo", rotulo: "Onde o modelo diria" },
  { id: "pessoas", rotulo: "Pessoas" }, { id: "renda", rotulo: "Renda" }, { id: "rede", rotulo: "Nossa rede" },
];
/** Leitura do perfil de renda, no tom do estudo de geomarketing. */
function leituraDaRenda(r: ReturnType<typeof classesNoRaio>) {
  const p = (x: number) => `${(x * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  const [a, b] = [...r.classes].sort((x, y) => y.parte - x.parte);
  const perfil = r.cde >= 0.75 ? "predominantemente popular" : r.ab >= 0.4 ? "de renda mais alta" : "misto";
  const efeito = r.cde >= 0.75 ? "o que indica sensibilidade a preço e favorece modelos focados em escala e eficiência" : r.ab >= 0.4 ? "o que abre espaço para planos de maior valor e serviços" : "o que pede uma oferta que atenda as duas faixas";
  return `A região tem perfil ${perfil}: ${p(r.ab)} dos moradores nas classes AA, A e B e ${p(r.cde)} nas classes C, D e E. As classes que mais aparecem são a ${a.id} (${p(a.parte)}) e a ${b.id} (${p(b.parte)}), ${efeito}.`;
}
const fmtKm = (v: number | null) => (v == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`);

/**
 * Estudo de uma unidade em operação: mapa em cima (onde os alunos moram de verdade, onde o modelo diria, gente, renda, rede)
 * e o estudo embaixo (vendas por m² contra a rede, modelo × realidade, bairros, divisão da captação), com PDF e Street View.
 * `voltar` some quando a pessoa só tem acesso à própria unidade.
 */
export function MapaUnidade({ dados, unidades, inicial, voltar }: { dados: DadosEstudos; unidades: UnidadeEstudo[]; inicial: string; voltar?: () => void }) {
  const [nome, setNome] = useState(inicial);
  const [lente, setLente] = useState<Lente>("alunos");
  const [satelite, setSatelite] = useState(false);
  const [verRua, setVerRua] = useState(false);
  const [rua, setRua] = useState<[number, number] | null>(null);
  const [gerando, setGerando] = useState(false);
  const [pois, setPois] = useState<ResultadoPois | null>(null);
  const [modoPois, setModoPois] = useState<ModoPois>("nomes");
  const el = useRef<HTMLDivElement>(null);
  const ref = useRef<{ L: Leaflet; mapa: import("leaflet").Map; camadas: import("leaflet").LayerGroup; ruas: import("leaflet").TileLayer; sat: import("leaflet").TileLayer } | null>(null);
  const [pronto, setPronto] = useState(false);
  const u = unidades.find((x) => x.nome === nome) ?? unidades[0];
  const outras = (dados.unidades ?? []).filter((x) => x.nome !== u?.nome);
  const cap = useMemo(() => (u?.c && dados.censo && dados.premissas?.curva ? captacaoDe(unidadeComoPonto(u), dados.censo, outras, [], dados.premissas.curva) : null), [u, dados]); // eslint-disable-line react-hooks/exhaustive-deps
  const r80 = u ? raio80Real(u) : null;
  const mediana = u ? dados.vendasPorM2?.[u.modelo]?.mediana ?? null : null;
  const porM2 = u?.vendas && u.m2 ? u.vendas / u.m2 : null;
  const alunosBairro = (u?.bairros ?? []).reduce((a, b) => a + b[3], 0);
  const topBairros = [...(u?.bairros ?? [])].sort((a, b) => b[3] - a[3]).slice(0, 5);
  const moradores80 = u?.c && r80 && dados.censo ? dados.censo.celulas.reduce((a, [la, ln, p]) => a + (km([la, ln], u.c as [number, number]) <= r80 ? p : 0), 0) : null;
  const comparado = porM2 && mediana ? porM2 / mediana - 1 : null;
  const leituraModelo = u?.previsto && u.vendas != null
    ? `Pelo tamanho do imóvel, o modelo preveria ${reais(u.previsto.provavel)} por mês (entre ${reais(u.previsto.pessimista)} e ${reais(u.previsto.otimista)}).${u.vendas > u.previsto.otimista ? " A unidade vende acima da faixa: o ponto ou a gestão rendem mais que o tamanho explica." : u.vendas < u.previsto.pessimista ? " A unidade vende abaixo da faixa: vale entender o que segura as vendas." : " A unidade vende dentro da faixa."}`
    : null;

  useEffect(() => {
    let vivo = true;
    carregarLeaflet().then((L) => {
      if (!vivo || !el.current) return;
      // A rolagem do mouse (e o gesto de pinça do trackpad) aproxima o mapa direto.
      const mapa = L.map(el.current, { zoomControl: false, preferCanvas: true, scrollWheelZoom: true, wheelPxPerZoomLevel: 90 }).setView(u?.c ?? [-15.8, -47.9], 13);
      const ruas = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap", crossOrigin: "anonymous" }).addTo(mapa);
      const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Imagens © Esri", crossOrigin: "anonymous" });
      L.control.zoom({ position: "bottomright" }).addTo(mapa);
      ref.current = { L, mapa, camadas: L.layerGroup().addTo(mapa), ruas, sat };
      setPronto(true);
    });
    return () => { vivo = false; ref.current?.mapa.remove(); ref.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ref.current && u?.c) ref.current.mapa.setView(u.c, 13); setRua(null); setPois(null); }, [nome, pronto]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    if (satelite) { m.mapa.removeLayer(m.ruas); m.sat.addTo(m.mapa); } else { m.mapa.removeLayer(m.sat); m.ruas.addTo(m.mapa); }
    m.mapa.getContainer().classList.toggle("mapa-cinza", !satelite);
  }, [satelite, pronto]);
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
    if (lente === "alunos") {
      const mx = Math.max(1, ...(u.bairros ?? []).map((b) => b[3]));
      for (const [bairro, lat, lng, n] of [...(u.bairros ?? [])].sort((a, b) => b[3] - a[3]))
        L.circleMarker([lat, lng], { radius: 5 + 24 * Math.sqrt(n / mx), color: "#c41230", weight: 1, fillColor: "#c41230", fillOpacity: 0.32 })
          .bindTooltip(`<strong>${bairro}</strong><br/>${n.toLocaleString("pt-BR")} ${n === 1 ? "aluno" : "alunos"}`).addTo(camadas);
      if (r80) L.circle(u.c, { radius: r80 * 1000, color: "#1b2130", weight: 1.5, dashArray: "5 5", fill: false, interactive: false }).addTo(camadas);
    } else if (lente === "modelo" && cap && censo) {
      const mx = Math.max(...cap.pesos, 1e-9);
      cap.indices.forEach((i, k) => {
        const t = cap.pesos[k] / mx;
        if (t < 0.03) return;
        const [lat, lng] = censo.celulas[i];
        L.polygon(hexagono(lat, lng, censo.rk), { stroke: false, fillColor: rampa(t ** 0.6), fillOpacity: 0.22 + 0.5 * Math.sqrt(t), interactive: false }).addTo(camadas);
      });
      if (cap.raio80) L.circle(u.c, { radius: cap.raio80 * 1000, color: "#1b2130", weight: 1.5, dashArray: "5 5", fill: false, interactive: false }).addTo(camadas);
    } else if ((lente === "pessoas" || lente === "renda") && censo) {
      const vis = censo.celulas.filter(([la, ln]) => km([la, ln], u.c as [number, number]) < 5);
      const v = (c: (typeof vis)[number]) => (lente === "pessoas" ? c[2] : c[3] ?? 0);
      const xs = vis.map(v).filter((x) => x > 0).sort((a, b) => a - b), mx = xs[Math.floor(xs.length * 0.95)] ?? 1;
      for (const c of vis) {
        const t = Math.min(1, v(c) / mx), classe = lente === "renda" ? classeDaRenda(c[3]) : null;
        if (lente === "renda" && !classe) continue;
        // pessoas: vermelho mais forte onde mora mais gente; renda: uma cor por classe (legenda em cima do mapa)
        L.polygon(hexagono(c[0], c[1], censo.rk), lente === "renda"
          ? { color: "#fff", weight: 1, opacity: 0.6, fillColor: classe!.cor, fillOpacity: 0.45 }
          : { color: "#fff", weight: 1, opacity: 0.6, fillColor: "#c41230", fillOpacity: 0.04 + t * t * 0.42 })
          .bindTooltip(lente === "pessoas" ? `${c[2].toLocaleString("pt-BR")} moradores` : c[3] ? `${classeDaRenda(c[3])?.rotulo ?? ""}: renda média do responsável R$ ${c[3].toLocaleString("pt-BR")}` : "Sem dado de renda", { sticky: true }).addTo(camadas);
      }
    }
    for (const o of dados.unidades ?? []) {
      if (!o.c || o.nome === u.nome || lente === "limpa") continue;
      L.marker(o.c, { icon: bolinha(L, "#c41230", lente === "rede" ? 15 : 11, lente === "rede" ? 1 : 0.7) }).bindTooltip(`World Gym ${o.nome}, a ${fmtKm(km(o.c, u.c))}`).addTo(camadas);
      if (lente === "rede") L.circle(o.c, { radius: 2400, color: "#c41230", weight: 1, dashArray: "3 4", fillOpacity: 0.05, interactive: false }).addTo(camadas);
    }
    L.marker(u.c, { zIndexOffset: 2000, title: u.nome, icon: pino(L, "#c41230", 34) })
      .bindTooltip(`<strong>World Gym ${u.nome}</strong>`).addTo(camadas);
    if (rua) L.marker(rua, { icon: bolinha(L, "#f59e0b", 14) }).addTo(camadas);
  }, [lente, u, cap, pronto, rua]); // eslint-disable-line react-hooks/exhaustive-deps

  usePoisNoMapa(pronto ? ref.current : null, pois, modoPois);

  if (!u) return <p className="rounded-2xl border bg-white p-6 text-sm text-muted-foreground">Nenhuma unidade para mostrar.</p>;

  const numeros = [
    { rotulo: "Vendas por m²", valor: porM2 ? `R$ ${Math.round(porM2).toLocaleString("pt-BR")}` : "—", nota: mediana ? `rede: R$ ${mediana.toLocaleString("pt-BR")}` : "" },
    { rotulo: "Alunos ativos", valor: u.alunos != null ? u.alunos.toLocaleString("pt-BR") : "—", nota: "" },
    { rotulo: "80% dos alunos a até", valor: fmtKm(r80), nota: alunosBairro ? `${alunosBairro.toLocaleString("pt-BR")} com bairro` : "" },
    { rotulo: "Moradores nessa área", valor: moradores80 != null ? `${Math.round(moradores80 / 1000).toLocaleString("pt-BR")} mil` : "—", nota: "Censo 2022" },
  ];
  const frase = u.vendas != null
    ? `Vende ${reais(u.vendas)} por mês${comparado != null ? `, ${Math.abs(Math.round(comparado * 100))}% ${comparado >= 0 ? "acima" : "abaixo"} da média da rede para o tamanho dela` : ""}.`
    : null;

  // Conclusão do estudo, montada com os mesmos números das páginas (regras fixas, sem texto inventado)
  const concorrentesPdf = pois && pois.categoria === "academias" ? pois.lugares.filter((l) => l.rede !== "World Gym") : null;
  const redesPdf = concorrentesPdf ? [...new Set(concorrentesPdf.map((l) => l.rede).filter((r): r is string => !!r))] : [];
  const conclusao = (renda: ReturnType<typeof classesNoRaio> | null) => {
    const itens: string[] = [];
    if (u.vendas != null && comparado != null) itens.push(`Vende ${reais(u.vendas)} por mês, ${Math.abs(Math.round(comparado * 100))}% ${comparado >= 0 ? "acima" : "abaixo"} da média da rede por m².`);
    if (u.previsto && u.vendas != null && u.madura) itens.push(u.vendas > u.previsto.otimista ? "Vende acima do que o modelo espera para o tamanho do imóvel." : u.vendas < u.previsto.pessimista ? "Vende abaixo do que o modelo espera para o tamanho do imóvel." : "Vende dentro do que o modelo espera para o tamanho do imóvel.");
    if (r80) itens.push(`80% dos alunos moram a até ${fmtKm(r80)}${topBairros[0] ? `; o bairro que mais traz alunos é ${topBairros[0][0]} (${Math.round((topBairros[0][3] / Math.max(1, alunosBairro)) * 100)}%)` : ""}.`);
    if (renda) itens.push(`Perfil ${renda.cde >= 0.75 ? "popular" : renda.ab >= 0.4 ? "de renda mais alta" : "misto"}: ${Math.round(renda.cde * 100)}% dos moradores nas classes C, D e E.`);
    if (concorrentesPdf && pois) itens.push(`${concorrentesPdf.length} academias concorrentes a até ${pois.raioKm.toLocaleString("pt-BR")} km${redesPdf.length ? `, entre elas ${redesPdf.join(", ")}` : ""}.`);
    itens.push(cap?.divideCom.length ? `Divide a área com ${cap.divideCom.map((d) => `${d.nome} (${Math.round(d.parte * 100)}%)`).join(", ")}.` : "Nenhuma World Gym divide a área desta unidade.");
    return itens;
  };
  const recomendacao = () => {
    if (!u.madura) return "A unidade ainda está amadurecendo (menos de 12 meses): a leitura de resultado vale a partir do 12º mês.";
    if (comparado != null && comparado < -0.1) return "A unidade vende abaixo do que o tamanho dela permite. Compare os mapas \"Onde moram os alunos\" e \"Onde o modelo diria\": os bairros onde o modelo espera alunos e eles não aparecem são onde concentrar marketing e parcerias. Veja também a pressão das academias concorrentes mais próximas.";
    if (comparado != null && comparado > 0.1) return "A unidade vende acima da média da rede para o tamanho dela: o ponto e a gestão funcionam. Vale proteger a base (renovação e atendimento) e acompanhar a entrada de novas academias concorrentes na área.";
    return "A unidade vende perto da média da rede para o tamanho dela. Os bairros onde o modelo espera alunos e eles não aparecem são a principal oportunidade de crescimento.";
  };

  const exportar = async () => {
    const m = ref.current;
    if (!m || !u.c) return;
    setGerando(true);
    const lenteAntes = lente, poisAntes = pois;
    setPois(null); // as academias só aparecem na foto delas
    // Fotos do mapa num enquadramento fixo: satélite do imóvel e uma foto por lente, todas na área onde moram 80% dos alunos.
    const foto = async (l: Lente, alvo: Parameters<typeof fotoEnquadrada>[1], sat = false) => { setLente(l); await pausa(350); return fotoEnquadrada(m, alvo, sat); };
    try {
      const area = m.L.latLng(u.c).toBounds(Math.max(2.5, r80 ?? 2.5) * 2000);
      // alunos: a área dos 80% com folga e os bairros com pelo menos 2% dos alunos que ficam perto (até 2× esse raio)
      const raioAlunos = Math.max(3, (r80 ?? 3) * 1.25);
      const areaAlunos = m.L.latLng(u.c).toBounds(raioAlunos * 2000);
      for (const [, la, ln, n] of u.bairros ?? []) if (n >= alunosBairro * 0.02 && km([la, ln], u.c) <= raioAlunos * 2) areaAlunos.extend([la, ln]);
      const fotoSat = await foto("limpa", { centro: u.c, zoom: 16 }, true);
      const fotoAlunos = await foto("alunos", { limites: areaAlunos });
      const fotoModelo = cap ? await foto("modelo", { limites: area }) : null;
      const fotoPessoas = dados.censo ? await foto("pessoas", { limites: m.L.latLng(u.c).toBounds(8000) }) : null;
      const fotoRenda = dados.censo ? await foto("renda", { limites: m.L.latLng(u.c).toBounds(8000) }) : null;
      const fotoRede = await foto("rede", { limites: m.L.latLng(u.c).toBounds(14000) });
      if (pois) { setPois(pois); await pausa(300); }
      const fotoPois = pois ? await foto("limpa", { limites: m.L.latLng(pois.c).toBounds(pois.raioKm * 2000) }) : null;
      setLente(lenteAntes);
      const renda = dados.censo ? classesNoRaio(u.c, dados.censo, r80 ?? 3) : null;
      const pct = (x: number) => `${(x * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
      await gerarPdfDoEstudo({
        arquivo: nomeDoArquivo(`estudo-unidade-${u.nome}`), cabecalho: "Estudo da unidade", foto: null,
        capa: { titulo: "Estudo de Geomarketing", linha: "Estudo da Unidade", subtitulo: `World Gym ${u.nome}${u.m2 ? ` | ${u.m2.toLocaleString("pt-BR")} m²` : ""}` },
        paginas: [{
          titulo: `World Gym ${u.nome}`, subtitulo: `Estudo da unidade${u.m2 ? ` · ${u.m2.toLocaleString("pt-BR")} m²` : ""}${u.madura ? "" : " · ainda amadurecendo (menos de 12 meses)"}`,
          foto: { dados: fotoSat, legenda: "A unidade vista de cima (imagem de satélite)." },
          destaques: [
            { valor: porM2 ? `R$ ${Math.round(porM2).toLocaleString("pt-BR")}` : "—", rotulo: `vendas por m² por mês${mediana ? ` (rede: R$ ${mediana.toLocaleString("pt-BR")})` : ""}` },
            { valor: fmtKm(r80), rotulo: "raio onde moram 80% dos alunos" },
            { valor: u.alunos != null ? u.alunos.toLocaleString("pt-BR") : "—", rotulo: "alunos ativos" },
          ],
          frase: frase ?? undefined,
          numeros: [],
          secoes: [
            ...(leituraModelo ? [{ titulo: "O modelo e a realidade", linhas: [], nota: leituraModelo }] : []),
            { titulo: "Onde moram os alunos", novaPagina: true, foto: { dados: fotoAlunos, legenda: "Bolha maior = mais alunos no bairro. Tracejado: área onde moram 80% dos alunos." },
              linhas: [{ texto: "Moradores na área onde moram 80% dos alunos (Censo 2022)", valor: moradores80 != null ? `${Math.round(moradores80 / 1000).toLocaleString("pt-BR")} mil` : "—" },
                ...topBairros.map(([b, , , n]) => ({ texto: b, valor: `${n.toLocaleString("pt-BR")} alunos (${Math.round((n / Math.max(1, alunosBairro)) * 100)}%)` }))] },
            ...(fotoModelo ? [{ titulo: "Onde o modelo diria", novaPagina: true, foto: { dados: fotoModelo, legenda: "Mais escuro = onde o modelo espera mais alunos (moradores, distância e outras World Gym por perto)." }, linhas: [],
              nota: "Compare com o mapa anterior: onde o modelo espera alunos e eles não aparecem é onde vale fazer marketing." }] : []),
            ...(fotoPessoas ? [{ titulo: "Onde mora a população", novaPagina: true, foto: { dados: fotoPessoas, legenda: "Mais forte = mais moradores (Censo 2022), num raio de 4 km." },
              linhas: [{ texto: "Moradores na área onde moram 80% dos alunos", valor: moradores80 != null ? `${Math.round(moradores80 / 1000).toLocaleString("pt-BR")} mil` : "—" },
                ...(moradores80 && u.alunos ? [{ texto: "Alunos para cada mil moradores dessa área", valor: (u.alunos / (moradores80 / 1000)).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) }] : [])] }] : []),
            ...(fotoRenda && renda ? [{ titulo: "Perfil socioeconômico", novaPagina: true, altFoto: 92, foto: { dados: fotoRenda, legenda: "Cada hexágono na cor da classe pela renda média do responsável pelo domicílio (Censo 2022)." },
              legenda: CLASSES_RENDA.map((c) => ({ cor: c.cor, texto: `${c.rotulo} (${c.faixa})` })),
              destaques: [{ valor: pct(renda.ab), rotulo: "moradores nas classes AA + A + B" }, { valor: pct(renda.cde), rotulo: "moradores nas classes C + D + E" },
                ...(renda.media ? [{ valor: `R$ ${(Math.round(renda.media / 10) * 10).toLocaleString("pt-BR")}`, rotulo: "renda média do responsável" }] : [])],
              linhas: renda.classes.filter((c) => c.parte >= 0.0005).map((c) => ({ texto: `${c.rotulo} (${c.faixa})`, valor: pct(c.parte) })),
              nota: leituraDaRenda(renda), paragrafo: `Moradores da área onde moram 80% dos alunos (${fmtKm(r80 ?? 3)} da unidade), pela renda média do responsável pelo domicílio em cada hexágono do Censo 2022.` }] : []),
            ...(pois ? [{ titulo: `${rotuloPois(pois)} a até ${pois.raioKm.toLocaleString("pt-BR")} km: ${totalPois(pois)}`, novaPagina: true,
              foto: { dados: fotoPois, legenda: "Fonte: Google. Grandes redes em destaque escuro." },
              linhas: pois.lugares.map((l, i) => ({ texto: `${i + 1}. ${l.nome}${l.rede ? ` (${l.rede})` : ""}`, valor: `${l.km.toLocaleString("pt-BR")} km` })), paragrafo: "Os números seguem a ordem de distância." }] : []),
            { titulo: "Nossa rede e a divisão da captação", novaPagina: true, foto: { dados: fotoRede, legenda: "Bolinhas vermelhas: outras World Gym. Círculos: área de cada uma." },
              linhas: cap?.divideCom.length ? cap.divideCom.map((d) => ({ texto: d.nome, valor: `${Math.round(d.parte * 100)}%` })) : [{ texto: "Nenhuma World Gym divide a área desta unidade." }] },
            { titulo: "Conclusão", novaPagina: true, linhas: conclusao(renda).map((texto) => ({ texto: `• ${texto}` })),
              nota: recomendacao() },
          ],
        }],
      });
    } finally { setLente(lenteAntes); setPois(poisAntes); setGerando(false); }
  };

  return (
    <div className="space-y-4">
      <style>{`.mapa-cinza .leaflet-tile-pane{filter:grayscale(1) contrast(.9) brightness(1.06)}${CSS_POIS}`}</style>

      {/* topo: voltar, unidade, exportar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {voltar && <button type="button" onClick={voltar} className="rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">← Estudos</button>}
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Estudo da unidade{u.m2 ? `, ${u.m2.toLocaleString("pt-BR")} m²` : ""}</p>
            <h2 className="truncate font-display text-2xl font-medium">World Gym {u.nome}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unidades.length > 1 && (
            <select value={u.nome} onChange={(e) => setNome(e.target.value)} aria-label="Unidade" className="h-10 rounded-xl border bg-white px-2.5 text-sm">
              {unidades.map((x) => <option key={x.nome} value={x.nome}>{x.nome}</option>)}
            </select>
          )}
          <button type="button" onClick={exportar} disabled={gerando} className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">{gerando ? "Gerando…" : "Exportar PDF"}</button>
        </div>
      </div>

      {/* mapa */}
      <div className="relative h-[52vh] min-h-[380px] overflow-hidden rounded-2xl border border-primary/30 bg-muted">
        <div ref={el} className="absolute inset-0" aria-label={`Mapa da unidade ${u.nome}`} />
        <div className="pointer-events-none absolute inset-x-3 top-3 z-[450] flex flex-col items-center gap-2">
          <nav className="pointer-events-auto flex max-w-full overflow-x-auto rounded-xl bg-white p-1 shadow-lg" aria-label="O que o mapa mostra">
            {LENTES.map((l) => (
              <button key={l.id} type="button" aria-pressed={lente === l.id} onClick={() => setLente(l.id)}
                className="whitespace-nowrap rounded-lg px-3 py-2 text-[13px] text-muted-foreground aria-pressed:bg-foreground aria-pressed:font-medium aria-pressed:text-background">{l.rotulo}</button>
            ))}
          </nav>
          {lente === "modelo" && <div className="pointer-events-auto flex items-center gap-2 rounded-lg bg-white/95 px-3 py-1.5 text-xs text-muted-foreground shadow">poucos alunos<span className="h-1.5 w-28 rounded" style={{ background: gradienteRampa }} />muitos alunos<span className="ml-2 border-l pl-2">tracejado: onde moram 80%</span></div>}
          {lente === "renda" && <LegendaRenda />}
          {lente === "alunos" && <div className="pointer-events-auto rounded-lg bg-white/95 px-3 py-1.5 text-xs text-muted-foreground shadow">bolha maior = mais alunos no bairro · tracejado: onde moram 80%</div>}
          {verRua && <div className="pointer-events-auto rounded-lg bg-foreground px-3 py-1.5 text-xs text-background shadow">Clique no mapa onde quer ver a rua</div>}
        </div>
        <div className="absolute bottom-24 right-3 z-[450] flex flex-col overflow-hidden rounded-xl bg-white shadow-lg">
          <button type="button" aria-pressed={satelite} onClick={() => setSatelite((s) => !s)} title="Satélite" className="grid h-10 w-10 place-items-center aria-pressed:bg-foreground aria-pressed:text-background">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z" /><path d="M9 4v13M15 7v13" /></svg><span className="sr-only">Satélite</span>
          </button>
          <button type="button" aria-pressed={verRua} onClick={() => setVerRua((v) => !v)} title="Ver a rua (Street View)" className="grid h-10 w-10 place-items-center border-t aria-pressed:bg-foreground aria-pressed:text-background">
            <IconeBoneco /><span className="sr-only">Ver a rua</span>
          </button>
        </div>
        <div className="absolute bottom-3 left-3 z-[460]"><ControlePois centro={u.c} aviso={false} aoResultado={setPois} modo={modoPois} setModo={setModoPois} temResultado={!!pois} /></div>
        {rua && <StreetView ponto={rua} fechar={() => setRua(null)} />}
      </div>

      {/* estudo, no padrão do estudo de geomarketing */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Secao icone={TrendingUp} titulo="Resultado da unidade">
          <Destaque valor={porM2 ? `R$ ${Math.round(porM2).toLocaleString("pt-BR")}` : "—"} rotulo={`vendas por m² por mês${mediana ? ` (média da rede: R$ ${mediana.toLocaleString("pt-BR")})` : ""}`}
            tom={comparado == null ? "marca" : comparado >= 0 ? "bom" : "ruim"} />
          {frase && <div className="mt-4"><Nota>{frase}{!u.madura && " Ainda amadurecendo: a comparação vale a partir de 12 meses de operação."}</Nota></div>}
          <div className="mt-3">
            <Linha rotulo="Vendas por mês" valor={u.vendas != null ? reais(u.vendas) : "—"} />
            <Linha rotulo="Alunos ativos" valor={u.alunos != null ? u.alunos.toLocaleString("pt-BR") : "—"} />
            <Linha rotulo="Tamanho do imóvel" valor={u.m2 ? `${u.m2.toLocaleString("pt-BR")} m²` : "—"} />
          </div>
        </Secao>
        <Secao icone={Scale} titulo="O modelo e a realidade">
          {u.previsto && u.vendas != null && u.madura ? (
            <Destaque valor={`${u.vendas >= u.previsto.provavel ? "+" : "−"}${Math.abs(Math.round((u.vendas / u.previsto.provavel - 1) * 100))}%`} rotulo={`contra os ${reais(u.previsto.provavel)} que o modelo preveria`}
              tom={u.vendas >= u.previsto.provavel ? "bom" : "ruim"} />
          ) : <Destaque valor="—" rotulo="a comparação começa com 12 meses de operação" />}
          {leituraModelo && <div className="mt-4"><Nota>{leituraModelo}</Nota></div>}
        </Secao>
        <Secao icone={MapPin} titulo="De onde vêm os alunos">
          <div className="grid grid-cols-2 gap-3">
            <Destaque valor={fmtKm(r80)} rotulo="raio onde moram 80% dos alunos" />
            <Destaque valor={moradores80 != null ? `${Math.round(moradores80 / 1000).toLocaleString("pt-BR")} mil` : "—"} rotulo="moradores nessa área (Censo 2022)" />
          </div>
          <div className="mt-4">
            {topBairros.length ? topBairros.map(([b, , , n]) => <Linha key={b} rotulo={b} valor={`${n.toLocaleString("pt-BR")} (${Math.round((n / Math.max(1, alunosBairro)) * 100)}%)`} />)
              : <p className="text-[13px] text-muted-foreground">Sem bairros localizados ainda.</p>}
          </div>
        </Secao>
        <Secao icone={Users} titulo="Divisão da captação">
          {cap?.divideCom.length ? cap.divideCom.map((d) => <Linha key={d.nome} rotulo={d.nome} valor={`${Math.round(d.parte * 100)}%`} />)
            : <p className="text-[13px] text-muted-foreground">Nenhuma World Gym divide a área desta unidade.</p>}
          <div className="mt-3"><Nota>Compare as lentes "Onde moram os alunos" e "Onde o modelo diria": onde o modelo espera alunos e eles não aparecem é onde vale fazer marketing.</Nota></div>
        </Secao>
      </div>
      {pois && <div className="grid gap-4 lg:grid-cols-2"><SecaoPois res={pois} /></div>}
    </div>
  );
}

/** Legenda da lente Renda: uma cor por classe (renda média do responsável, Censo 2022). */
export function LegendaRenda() {
  return (
    <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-lg bg-white/95 px-3 py-1.5 text-xs text-muted-foreground shadow" title="Classe pela renda média do responsável pelo domicílio (Censo 2022)">
      {CLASSES_RENDA.map((c) => <span key={c.id} className="flex items-center gap-1" title={c.faixa}><span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.cor }} />{c.id}</span>)}
      <span className="border-l pl-2">renda média do responsável</span>
    </div>
  );
}
