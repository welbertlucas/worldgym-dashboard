import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useRef, useState } from "react";
import { bolinha, carregarLeaflet, fotoEnquadrada, gradienteRampa, hexagono, pausa, pino, rampa, type Leaflet } from "@/components/estudos/mapaComum";
import { StreetView } from "@/components/estudos/StreetView";
import { BarraMapa, PainelCamadas } from "@/components/estudos/controlesMapa";
import { LEGENDA_DESLOCAMENTO, areaOficial, desenharDeslocamento, limitesDaArea, useDeslocamento } from "@/components/estudos/deslocamento";
import { CSS_POIS, ControlePois, SecaoPois, ondePois, rotuloPois, totalPois, usePoisNoMapa, type ModoPois, type ResultadoPois } from "@/components/estudos/pois";
import { Barras, Destaque, Partes, ReguaSimples, Secao } from "@/components/estudos/blocos";
import { MapPin, Scale, TrendingUp, Users } from "lucide-react";
import { gerarPdfDoEstudo } from "@/lib/estudoPdf";
import { AZUL, LegendaCenso, LegendaRenda, desenharCenso, ehCamadaCenso } from "@/components/estudos/camadasCenso";
export { LegendaRenda };
import { SecaoSugestoes, desenharSugestoes } from "@/components/estudos/sugestoes";
import { montarPdfUnidade } from "@/components/estudos/pdfUnidade";
import { MINUTOS_PADRAO, densidadeNaArea, posicoesMelhores, captacaoDe, classesNaArea, classesNoRaio, dentroDaArea, km, potencialNaArea, minutosPara80, moradoresNaArea, parteDosAlunos, perfilNaArea, raio80Real, reais, unidadeComoPonto, type DadosEstudos, type UnidadeEstudo } from "@/lib/estudoPonto";

// "limpa": só a unidade (foto de satélite e de academias do PDF); "oportunidade": demanda potencial + onde moram os alunos
type Lente = "alunos" | "modelo" | "pessoas" | "idade" | "domicilios" | "renda" | "consumo" | "rede" | "limpa" | "oportunidade";
const LENTES: { id: Lente; rotulo: string }[] = [
  { id: "alunos", rotulo: "Base de clientes" }, { id: "modelo", rotulo: "Demanda potencial" }, { id: "oportunidade", rotulo: "Oportunidades de captação" },
  { id: "pessoas", rotulo: "População" }, { id: "idade", rotulo: "Idade" }, { id: "domicilios", rotulo: "Domicílios" },
  { id: "renda", rotulo: "Renda" }, { id: "consumo", rotulo: "Potencial de consumo" }, { id: "rede", rotulo: "Canibalização" },
];
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
  const [verPois, setVerPois] = useState(true);
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
  // Área de deslocamento (10 min de carro, Mapbox): quando existe, substitui o raio em linha reta nos números e nos mapas
  const areas = useDeslocamento(u?.c, false);
  const area10 = areaOficial(areas);
  const min80 = areas?.carro && u?.bairros?.length ? minutosPara80(u.bairros, areas.carro) : null;
  const parte10 = area10 && u?.bairros?.length ? parteDosAlunos(u.bairros, area10) : null;
  const moradoresArea = area10 && dados.censo ? moradoresNaArea(dados.censo, area10) : moradores80;
  const onde80 = min80 != null ? `${min80.toLocaleString("pt-BR")} min de carro` : areas?.carro ? `mais de 20 min de carro` : fmtKm(r80);
  // onde abrir outra unidade na região (estratégia de expansão: não aparece para quem só tem acesso à própria unidade)
  const novaUnidade = useMemo(() => (u?.c && dados.censo && dados.premissas && dados.modo !== "unidade"
    ? posicoesMelhores({ c: u.c, m2: dados.premissas.modelos[u.modelo]?.padraoM2 ?? u.m2 ?? 1200 }, dados.censo, dados.unidades ?? [], [], dados.premissas.curva,
      { raioKm: 10, longeDeUnidadesKm: 3, separacaoKm: 2.5, maxCanibalizacao: 0.2, ganhoMinimo: -0.3 })
    : null), [u?.nome, dados]); // eslint-disable-line react-hooks/exhaustive-deps
  // Totais da área para a legenda (rosca das classes de renda e valor do potencial de consumo), na mesma área dos hexágonos
  const resumoCenso = useMemo(() => (u?.c && dados.censo ? {
    renda: area10 ? classesNaArea(dados.censo, area10) : classesNoRaio(u.c, dados.censo, 5),
    potencial: area10 ? potencialNaArea(dados.censo, area10) : null,
    onde: area10 ? `em ${MINUTOS_PADRAO} min de carro` : "num raio de 5 km",
  } : undefined), [u?.nome, area10, dados.censo]); // eslint-disable-line react-hooks/exhaustive-deps
  const verNovaUnidade = () => {
    const m = ref.current;
    if (!m || !u?.c || !novaUnidade?.sugestoes.length) return;
    m.mapa.fitBounds(m.L.latLngBounds([u.c, ...novaUnidade.sugestoes.map((x) => x.c)]).pad(0.25));
    el.current?.scrollIntoView({ behavior: "smooth", block: "center" });
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
    if (lente === "alunos" || lente === "oportunidade") {
      if (lente === "oportunidade" && cap && censo) {
        const mx = Math.max(...cap.pesos, 1e-9);
        cap.indices.forEach((i, k) => {
          const t = cap.pesos[k] / mx;
          if (t < 0.01) return;
          const [lat, lng] = censo.celulas[i];
          L.polygon(hexagono(lat, lng, censo.rk), { color: "#fff", weight: 1, opacity: 0.5, fillColor: AZUL(t ** 0.6), fillOpacity: 0.7, interactive: false }).addTo(camadas);
        });
      }
      const mx = Math.max(1, ...(u.bairros ?? []).map((b) => b[3]));
      const totalB = Math.max(1, (u.bairros ?? []).reduce((t, b) => t + b[3], 0));
      for (const [bairro, lat, lng, n] of [...(u.bairros ?? [])].sort((a, b) => b[3] - a[3])) {
        const raio = lente === "oportunidade" ? 4 + 20 * Math.sqrt(n / mx) : 5 + 26 * Math.sqrt(n / mx);
        L.circleMarker([lat, lng], lente === "oportunidade"
          ? { radius: raio, color: "#fff", weight: 1, fillColor: "#c41230", fillOpacity: 0.75 }
          : { radius: raio, color: "#c41230", weight: 1, fillColor: "#c41230", fillOpacity: 0.32 })
          .bindTooltip(`<strong>${bairro}</strong><br/>${n.toLocaleString("pt-BR")} ${n === 1 ? "aluno" : "alunos"} (${Math.round((n / totalB) * 100)}%)`).addTo(camadas);
        // nos bairros que têm pelo menos 3% dos alunos, o número fica escrito na bolha
        if (lente === "alunos" && n / totalB >= 0.03)
          L.marker([lat, lng], { interactive: false, icon: L.divIcon({ className: "", iconSize: [44, 16], iconAnchor: [22, 8], html: `<div style="text-align:center;font:700 11px/16px Inter,sans-serif;color:#7a0a1e;text-shadow:0 0 3px #fff,0 0 3px #fff">${n.toLocaleString("pt-BR")}</div>` }) }).addTo(camadas);
      }
      if (r80 && !area10) L.circle(u.c, { radius: r80 * 1000, color: "#1b2130", weight: 1.5, dashArray: "5 5", fill: false, interactive: false }).addTo(camadas);
    } else if (lente === "modelo" && cap && censo) {
      const mx = Math.max(...cap.pesos, 1e-9);
      cap.indices.forEach((i, k) => {
        const t = cap.pesos[k] / mx;
        if (t < 0.01) return;
        const [lat, lng] = censo.celulas[i];
        L.polygon(hexagono(lat, lng, censo.rk), { stroke: false, fillColor: rampa(t ** 0.6), fillOpacity: 0.22 + 0.5 * Math.sqrt(t), interactive: false }).addTo(camadas);
      });
      if (cap.raio80 && !area10) L.circle(u.c, { radius: cap.raio80 * 1000, color: "#1b2130", weight: 1.5, dashArray: "5 5", fill: false, interactive: false }).addTo(camadas);
    } else if (ehCamadaCenso(lente) && censo) {
      // como no Mapfry: só os hexágonos de dentro da área de deslocamento (sem ela, num raio de 5 km)
      desenharCenso(L, camadas, censo, lente, (la, ln) => (area10 ? dentroDaArea(la, ln, area10) : km([la, ln], u.c as [number, number]) < 5));
    }
    for (const o of dados.unidades ?? []) {
      if (!o.c || o.nome === u.nome || lente === "limpa") continue;
      L.marker(o.c, { icon: bolinha(L, "#c41230", lente === "rede" ? 15 : 11, lente === "rede" ? 1 : 0.7) }).bindTooltip(`World Gym ${o.nome}, a ${fmtKm(km(o.c, u.c))}`).addTo(camadas);
      if (lente === "rede") L.circle(o.c, { radius: 2400, color: "#c41230", weight: 1, dashArray: "3 4", fillOpacity: 0.05, interactive: false }).addTo(camadas);
    }
    L.marker(u.c, { zIndexOffset: 2000, title: u.nome, icon: pino(L, "#c41230", 34) })
      .bindTooltip(`<strong>World Gym ${u.nome}</strong>`).addTo(camadas);
    if (rua) L.marker(rua, { icon: bolinha(L, "#f59e0b", 14) }).addTo(camadas);
    if (lente !== "rede") desenharDeslocamento(L, camadas, areas);
    // posições sugeridas para uma nova unidade: em todas as camadas (menos a limpa das fotos)
    if (lente !== "limpa") desenharSugestoes(L, camadas, novaUnidade);
  }, [lente, u, cap, pronto, rua, areas, novaUnidade]); // eslint-disable-line react-hooks/exhaustive-deps

  usePoisNoMapa(pronto ? ref.current : null, verPois ? pois : null, modoPois);
  const aoPois = (r: ResultadoPois | null) => { setPois(r); setVerPois(true); };

  if (!u) return <p className="rounded-2xl border bg-white p-6 text-sm text-muted-foreground">Nenhuma unidade para mostrar.</p>;


  const exportar = async () => {
    const m = ref.current;
    if (!m || !u.c) return;
    setGerando(true);
    const lenteAntes = lente, poisAntes = pois, verAntes = verPois;
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
        sat: await foto("limpa", { centro: u.c, zoom: 16 }, true),
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
      await gerarPdfDoEstudo(montarPdfUnidade({
        u, faixa: dados.vendasPorM2?.[u.modelo] ?? null, porM2, comparado, minutos: MINUTOS_PADRAO, temArea: !!area10,
        parteNaArea: parte10, min80, onde80, topBairros: [...(u.bairros ?? [])].sort((a, b) => b[3] - a[3]).slice(0, 8), alunosBairro,
        esperadoNaArea, perfil, renda, novaUnidade, densidade: area10 && censo ? densidadeNaArea(censo, area10) : null, potencial: area10 && censo ? potencialNaArea(censo, area10) : null, pois: poisAntes, divideCom: cap?.divideCom ?? [], fotos,
      }));
    } finally { setLente(lenteAntes); setPois(poisAntes); setVerPois(verAntes); setGerando(false); }
  };

  return (
    <div className="space-y-4">
      <style>{`.mapa-cinza .leaflet-tile-pane{filter:grayscale(1) contrast(.9) brightness(1.06)}${CSS_POIS}`}</style>

      {/* topo: voltar, unidade, exportar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {voltar && <Button variant="outline" size="sm" onClick={voltar}>Todos os estudos</Button>}
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
          <Button onClick={exportar} disabled={gerando}>{gerando ? "Gerando…" : "Exportar PDF"}</Button>
        </div>
      </div>

      {/* mapa: camadas à direita e barra de mapa/Street View/zoom embaixo (arranjo do Mapfry) */}
      <div className="relative h-[74vh] min-h-[520px] overflow-hidden rounded-2xl border border-primary/30 bg-muted">
        <div ref={el} className="absolute inset-0" aria-label={`Mapa da unidade ${u.nome}`} />
        {verRua && <div className="absolute left-1/2 top-3 z-[456] -translate-x-1/2 rounded-lg bg-foreground px-3 py-1.5 text-xs text-background shadow">Clique no mapa onde quer ver a rua</div>}
        <PainelCamadas itens={LENTES} atual={lente} escolher={(id) => setLente(id as Lente)} vazia="limpa"
          legenda={lente === "modelo" ? <>
            <div className="flex items-center gap-2">poucos<span className="h-1.5 flex-1 rounded" style={{ background: gradienteRampa }} />muitos alunos</div>
            <p className="mt-1">Onde o modelo espera alunos, pela gente que mora perto e pelas outras World Gym. {area10 ? LEGENDA_DESLOCAMENTO : ""}</p>
          </> : lente === "oportunidade" ? <>Azul: onde o modelo espera alunos. Bolhas vermelhas: onde eles moram hoje. Azul forte sem bolha é onde vale fazer marketing.</>
            : ehCamadaCenso(lente) ? <LegendaCenso camada={lente} resumo={resumoCenso} />
            : lente === "alunos" ? <>Bolha maior = mais alunos no bairro; o número aparece nos bairros com 3% ou mais. {alunosBairro.toLocaleString("pt-BR")} alunos com bairro localizado{u.alunos ? ` de ${u.alunos.toLocaleString("pt-BR")} ativos` : ""}. {area10 ? LEGENDA_DESLOCAMENTO : "Tracejado: onde moram 80%."}</>
            : lente === "rede" ? "Bolinhas vermelhas: outras World Gym. Círculos: área de cada uma." : null}
          sobre={pois ? [{ id: "pois", rotulo: rotuloPois(pois), ativo: verPois, alternar: () => setVerPois((v) => !v), legenda: `${totalPois(pois)} ${ondePois(pois)}`, remover: () => setPois(null) }] : []} />
        <BarraMapa mapa={pronto ? ref.current?.mapa ?? null : null} satelite={satelite} setSatelite={setSatelite} verRua={verRua} setVerRua={setVerRua} />
        <div className="absolute bottom-7 left-3 z-[460]"><ControlePois centro={u.c} aviso={false} area={area10 ? { geometria: area10, rotulo: `${MINUTOS_PADRAO} min de carro` } : null} aoResultado={aoPois} modo={modoPois} setModo={setModoPois} temResultado={!!pois && verPois} /></div>
        {rua && <StreetView ponto={rua} fechar={() => setRua(null)} />}
      </div>

      {/* estudo: números e gráficos curtos, para o mapa ficar com o espaço */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Secao icone={TrendingUp} titulo="Resultado da unidade">
          <Destaque valor={u.vendas != null ? reais(u.vendas) : "—"} rotulo={`vendas por mês${u.alunos != null ? ` · ${u.alunos.toLocaleString("pt-BR")} alunos ativos` : ""}${u.m2 ? ` · ${u.m2.toLocaleString("pt-BR")} m²` : ""}`}
            tom={comparado == null ? "marca" : comparado >= 0 ? "bom" : "ruim"} />
          {porM2 && mediana ? <div className="mt-4"><Barras itens={[
            { rotulo: `${u.nome}`, valor: porM2, texto: `R$ ${Math.round(porM2).toLocaleString("pt-BR")}/m²`, destaque: true },
            { rotulo: "Média da rede", valor: mediana, texto: `R$ ${mediana.toLocaleString("pt-BR")}/m²` },
          ]} /></div> : null}
          {!u.madura && <p className="mt-2 text-[11px] text-muted-foreground">Ainda amadurecendo: a comparação vale a partir de 12 meses de operação.</p>}
        </Secao>
        <Secao icone={Scale} titulo="O modelo e a realidade">
          {u.previsto && u.vendas != null && u.madura ? (<>
            <Destaque valor={`${u.vendas >= u.previsto.provavel ? "+" : "−"}${Math.abs(Math.round((u.vendas / u.previsto.provavel - 1) * 100))}%`} rotulo={`contra os ${reais(u.previsto.provavel)} que o modelo preveria pelo tamanho`}
              tom={u.vendas >= u.previsto.provavel ? "bom" : "ruim"} />
            <ReguaSimples min={u.previsto.pessimista} max={u.previsto.otimista} valor={u.vendas} rotuloMin={reais(u.previsto.pessimista)} rotuloMax={reais(u.previsto.otimista)} rotuloValor={`vende ${reais(u.vendas)}`} bom={u.vendas >= u.previsto.pessimista} />
            <p className="mt-1 text-[11px] text-muted-foreground">Faixa cinza: o que o modelo espera para o tamanho do imóvel.</p>
          </>) : <Destaque valor="—" rotulo="a comparação começa com 12 meses de operação" />}
        </Secao>
        <Secao icone={MapPin} titulo="De onde vêm os alunos">
          <div className="grid grid-cols-2 gap-3">
            {area10 ? <Destaque valor={pct0(parte10)} rotulo={`moram a até ${MINUTOS_PADRAO} min de carro`} /> : <Destaque valor={fmtKm(r80)} rotulo="raio onde moram 80%" />}
            <Destaque valor={moradoresArea != null ? `${Math.round(moradoresArea / 1000).toLocaleString("pt-BR")} mil` : "—"} rotulo={`moradores ${area10 ? `em ${MINUTOS_PADRAO} min de carro` : "nessa área"}`} />
          </div>
          <div className="mt-4">
            {topBairros.length ? <Barras itens={topBairros.map(([b, , , n]) => ({ rotulo: b, valor: n, texto: `${n.toLocaleString("pt-BR")} (${Math.round((n / Math.max(1, alunosBairro)) * 100)}%)` }))} />
              : <p className="text-[13px] text-muted-foreground">Sem bairros localizados ainda.</p>}
          </div>
        </Secao>
        <Secao icone={Users} titulo="Canibalização com a rede">
          {cap?.divideCom.length ? (<>
            <Partes partes={[
              { rotulo: "Só desta unidade", parte: Math.max(0, 1 - cap.divideCom.reduce((a, d) => a + d.parte, 0)), cor: "#c41230" },
              ...cap.divideCom.map((d, i) => ({ rotulo: d.nome.replace("World Gym ", ""), parte: d.parte, cor: ["#f0a0ad", "#e7c3ca", "#c9ced8"][i] ?? "#c9ced8" })),
            ]} />
            <p className="mt-2 text-[11px] text-muted-foreground">Parte do público da área que outras World Gym também atraem. No mapa: camada Canibalização.</p>
          </>) : <p className="text-[13px] text-muted-foreground">Nenhuma World Gym divide a área desta unidade.</p>}
        </Secao>
      </div>
      {pois && <div className="grid gap-4 lg:grid-cols-2"><SecaoPois res={pois} /></div>}
      {novaUnidade && <div className="grid gap-4 lg:grid-cols-2"><SecaoSugestoes res={novaUnidade} tipo="nova" nome={u.nome} aoVerNoMapa={verNovaUnidade} /></div>}
    </div>
  );
}
