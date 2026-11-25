import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DECISAO_ROTULO, VEREDITO_ROTULO, acertoDoModelo, avaliarCompleto, foraDaMalhaDoCenso, meses, raio80Real, reais, regiaoDe,
  type DadosEstudos, type Ponto, type Resultado, type StatusDecisao, type UnidadeEstudo, type Veredito,
} from "@/lib/estudoPonto";
import { ImportarImoveis } from "@/components/estudos/ImportarImoveis";
import { useAreasEmCache, useReferenciaPopulacao } from "@/components/estudos/deslocamento";

const SEM_UNIDADES: UnidadeEstudo[] = [];

const PILULA_VEREDITO: Record<Veredito, string> = { aprovado: "bg-success/10 text-success", atencao: "bg-warning/10 text-warning", reprovado: "bg-destructive/10 text-destructive" };
const PILULA_DECISAO: Record<StatusDecisao, string> = { analise: "bg-muted text-muted-foreground", aprovado: "bg-success/10 text-success", recusado: "bg-destructive/10 text-destructive", unidade: "bg-sky-100 text-sky-800" };
const COR_PINO: Record<Veredito, string> = { aprovado: "#127a3a", atencao: "#d98a14", reprovado: "#b4232a" };
const NOME_MODELO = { low: "Low Cost", pro: "Pro" } as const;
const dataBR = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

interface Linha { p: Ponto; r: Resultado | null; regiao: string; real: number | null; /** O parecer já inclui população, renda e alunos contra a rede (precisa da área de 10 min do ponto, guardada ao abrir o estudo). */ completo: boolean }

/** Mapa pequeno com todos os estudos filtrados, coloridos pelo veredito (borda azul: virou unidade). */
function MiniMapa({ linhas, abrir }: { linhas: Linha[]; abrir: (id: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const ref = useRef<{ L: typeof import("leaflet"); mapa: import("leaflet").Map; grupo: import("leaflet").FeatureGroup } | null>(null);
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    let vivo = true;
    import("leaflet").then((mod) => {
      if (!vivo || !el.current) return;
      const L = (mod as unknown as { default?: typeof import("leaflet") }).default ?? (mod as typeof import("leaflet"));
      const mapa = L.map(el.current, { zoomControl: false, attributionControl: false }).setView([-15.85, -47.95], 9);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(mapa);
      ref.current = { L, mapa, grupo: L.featureGroup().addTo(mapa) };
      setPronto(true);
    });
    return () => { vivo = false; ref.current?.mapa.remove(); ref.current = null; };
  }, []);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    m.grupo.clearLayers();
    for (const { p, r, regiao } of linhas) {
      if (!r) continue;
      const unid = p.decisao?.status === "unidade";
      m.L.circleMarker(p.c, { radius: 7, color: unid ? "#1f5f8b" : "#fff", weight: unid ? 3 : 2, fillColor: COR_PINO[r.veredito], fillOpacity: 1 })
        .bindTooltip(`<strong>${p.nome}</strong><br/>${regiao} · ${VEREDITO_ROTULO[r.veredito]}`).on("click", () => abrir(p.id)).addTo(m.grupo);
    }
    if (linhas.length) m.mapa.fitBounds(m.grupo.getBounds(), { padding: [24, 24], maxZoom: 13 });
  }, [linhas, pronto, abrir]);
  return <div ref={el} className="h-[220px]" aria-label="Mapa dos estudos" />; // fundo padrão (colorido), como nos outros mapas (pedido do dono, 23/11/2026)
}

/** As unidades que já funcionam, em cards: vendas reais contra a mediana da rede (R$/m²) e contra o que o modelo preveria pelo tamanho. */
function UnidadesEmOperacao({ dados, abrir }: { dados: DadosEstudos; abrir: (nome: string) => void }) {
  const linhas = (dados.unidades ?? []).filter((u) => u.c && u.vendas).map((u) => {
    const med = dados.vendasPorM2?.[u.modelo]?.mediana ?? null, porM2 = u.m2 ? (u.vendas as number) / u.m2 : null;
    return { u, porM2, med, dif: u.previsto ? (u.vendas as number) / u.previsto.provavel - 1 : null, r80: raio80Real(u) };
  }).sort((a, b) => Number(b.u.madura) - Number(a.u.madura) || (b.porM2 ?? 0) - (a.porM2 ?? 0));
  const [todas, setTodas] = useState(false);
  // busca pelo nome da unidade (pedido do dono, 24/11/2026): sem acento nem maiúscula; com busca, mostra todas as que combinam
  const [busca, setBusca] = useState("");
  if (!linhas.length) return null;
  const sem = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const q = sem(busca);
  const achadas = q ? linhas.filter((l) => sem(l.u.nome).includes(q)) : linhas;
  const visiveis = q || todas ? achadas : linhas.slice(0, 12);
  const maxM2 = Math.max(...linhas.map((l) => Math.max(l.porM2 ?? 0, l.med ?? 0)), 1);
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h3 className="text-base font-semibold">Unidades em operação</h3><p className="text-[12px] text-muted-foreground">Vendas por mês, R$/m² (o traço na barra é a média da rede) e quanto a unidade vende acima ou abaixo do modelo. Clique para abrir o estudo.</p></div>
        <label className="relative block w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar unidade" aria-label="Buscar unidade pelo nome"
            onKeyDown={(e) => { if (e.key === "Enter" && achadas.length === 1) abrir(achadas[0].u.nome); if (e.key === "Escape") setBusca(""); }}
            className="h-9 w-full rounded-xl border bg-white pl-9 pr-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </label>
      </div>
      {q && !achadas.length && <p className="rounded-xl border bg-white px-3 py-3 text-sm text-muted-foreground">Nenhuma unidade com “{busca.trim()}” no nome.</p>}
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {visiveis.map(({ u, porM2, med, dif }) => {
          const acima = porM2 != null && med != null ? porM2 >= med : null;
          // card enxuto (pedido do dono, 23/11/2026: o Atlas é minimalista): nome, diferença para o modelo, vendas, R$/m² e uma barra com o traço da rede
          return (
            <button key={u.nome} type="button" onClick={() => abrir(u.nome)} title={`${NOME_MODELO[u.modelo]}${u.m2 ? ` · ${u.m2.toLocaleString("pt-BR")} m²` : ""}`}
              className="card-surface flex flex-col gap-1.5 px-3 py-2.5 text-left transition hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[13px] font-semibold">{u.nome}</p>
                {dif != null && u.madura
                  ? <span title="vendas reais contra o previsto pelo modelo" className={`whitespace-nowrap text-[11px] font-semibold tabular-nums ${dif >= 0 ? "text-success" : "text-destructive"}`}>{dif >= 0 ? "+" : "−"}{Math.abs(Math.round(dif * 100))}%</span>
                  : <span className="whitespace-nowrap text-[11px] text-muted-foreground">amadurecendo</span>}
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[15px] font-semibold tabular-nums">{reais(u.vendas as number)}</span>
                {porM2 != null && <span className="text-[11px] tabular-nums text-muted-foreground">R$ {Math.round(porM2).toLocaleString("pt-BR")}/m²</span>}
              </div>
              {porM2 != null && (
                <span className="relative h-1 rounded-full bg-muted" aria-hidden>
                  <span className={`absolute inset-y-0 left-0 rounded-full ${acima === false ? "bg-destructive" : "bg-success"}`} style={{ width: `${(porM2 / maxM2) * 100}%` }} />
                  {med != null && <span className="absolute -top-0.5 h-2 w-0.5 rounded bg-foreground/60" style={{ left: `${(med / maxM2) * 100}%` }} />}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {!q && linhas.length > 12 && <div className="flex justify-center"><Button variant="outline" size="sm" onClick={() => setTodas((t) => !t)}>{todas ? "Mostrar menos" : `Ver todas as ${linhas.length} unidades`}</Button></div>}
    </section>
  );
}

export function ListaEstudos({ dados, pontos, abrir, novo, comparar, editavel = true, abrirUnidade, apagar, verRede, importar }: { dados: DadosEstudos; pontos: Ponto[]; abrir: (id: string) => void; novo: () => void; comparar: (ids: string[]) => void; editavel?: boolean; abrirUnidade?: (nome: string) => void; apagar?: (id: string) => void; verRede?: () => void; importar?: (novos: Ponto[]) => void }) {
  const [importando, setImportando] = useState(false);
  const [busca, setBusca] = useState("");
  const [veredito, setVeredito] = useState<Veredito | "">("");
  const [decisao, setDecisao] = useState<StatusDecisao | "">("");
  const [modelo, setModelo] = useState("");
  const [periodo, setPeriodo] = useState(0);
  const [ordem, setOrdem] = useState<"recentes" | "parecer" | "payback" | "venda">("recentes");
  const [autor, setAutor] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [filtros, setFiltros] = useState(false);

  // os mesmos freios do estudo (população, fatia, renda e alunos): a área de 10 min vem do que o servidor já guardou (sem mandar posição ao Mapbox)
  const refsTodas = useReferenciaPopulacao(dados.unidades ?? SEM_UNIDADES, dados.censo, pontos.length ? "low" : null);
  const areas = useAreasEmCache(pontos);
  const linhas: Linha[] = useMemo(() => pontos.map((p) => {
    const u = p.decisao?.status === "unidade" ? dados.unidades?.find((x) => x.nome === p.decisao?.unidade) : undefined;
    // sem Censo na região do ponto, o veredito nunca passa de "com condicionantes" (decisão do dono, 24/11/2026)
    const res = dados.premissas && dados.vendasPorM2 ? avaliarCompleto(p, { premissas: dados.premissas, vendasPorM2: dados.vendasPorM2, unidades: dados.unidades ?? SEM_UNIDADES, censo: dados.censo, refs: refsTodas, area: areas.get(p.id) ?? null, semCenso: foraDaMalhaDoCenso(p.c, dados.censo) }) : null;
    const r = res ? { ...res.r, veredito: res.veredito } : null;
    return { p, r, regiao: regiaoDe(p, dados.unidades ?? []), real: u?.madura ? u.vendas : null, completo: !!res?.completo };
  }).sort((a, b) => (b.p.criadoEm ?? "").localeCompare(a.p.criadoEm ?? "")), [pontos, dados, refsTodas, areas]);
  const autores = [...new Set(pontos.map((p) => p.autor?.nome).filter(Boolean))] as string[];
  const agora = Date.now();
  const filtradas0 = linhas.filter(({ p, r, regiao }) =>
    (!veredito || r?.veredito === veredito) && (!decisao || (p.decisao?.status ?? "analise") === decisao) && (!modelo || p.modelo === modelo)
    && (!autor || p.autor?.nome === autor) && (!periodo || (p.criadoEm && agora - Date.parse(p.criadoEm) <= periodo * 864e5))
    && (!busca || semAcento(`${p.nome} ${regiao}`).includes(semAcento(busca))));
  // ordem da lista: os mais recentes (padrão) ou o ranking dos candidatos (parecer, depois payback; payback; venda esperada)
  const PESO_VEREDITO = { aprovado: 0, atencao: 1, reprovado: 2 } as const;
  const filtradas = ordem === "recentes" ? filtradas0 : [...filtradas0].sort((a, b) => {
    if (!a.r || !b.r) return a.r ? -1 : b.r ? 1 : 0;
    if (ordem === "venda") return b.r.provavel - a.r.provavel;
    if (ordem === "payback") return (a.r.payback || 1e9) - (b.r.payback || 1e9);
    return PESO_VEREDITO[a.r.veredito] - PESO_VEREDITO[b.r.veredito] || (a.r.payback || 1e9) - (b.r.payback || 1e9);
  });
  const conta = (v: Veredito) => linhas.filter((l) => l.r?.veredito === v).length;
  const acerto = acertoDoModelo(pontos, dados.unidades ?? []);
  const alternar = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const limpar = () => { setBusca(""); setVeredito(""); setDecisao(""); setModelo(""); setPeriodo(0); setAutor(""); setOrdem("recentes"); };
  const selecionar = "h-9 rounded-xl border bg-white px-2.5 text-[13px]";
  const nFiltros = [decisao, modelo, periodo, autor, ordem !== "recentes" ? ordem : ""].filter(Boolean).length;

  return (
    <div className="space-y-4 pb-20">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="font-display text-2xl font-medium">Estudos de ponto</h2><p className="text-sm text-muted-foreground">As unidades em operação e cada imóvel avaliado, com a previsão do modelo e a decisão.</p></div>
        <div className="flex items-center gap-2">
          {verRede && <Button variant="outline" onClick={verRede}>Mapa da rede</Button>}
          {editavel && importar && <Button variant="outline" onClick={() => setImportando(true)}>Importar imóveis</Button>}
          {editavel && <Button onClick={novo}>Novo estudo</Button>}
        </div>
      </div>

      {importando && importar && <ImportarImoveis dados={dados} pontos={pontos} criar={importar} fechar={() => setImportando(false)} />}
      {abrirUnidade && <UnidadesEmOperacao dados={dados} abrir={abrirUnidade} />}

      <div className="flex items-baseline gap-2 pt-2"><h3 className="text-base font-semibold">Pontos estudados</h3><span className="text-xs text-muted-foreground">{linhas.length === 1 ? "1 estudo" : `${linhas.length} estudos`}</span></div>

      {/* uma barra só: busca, contagem por veredito (os chips filtram) e os demais filtros recolhidos (proposta aprovada em 24/11/2026) */}
      <div className="flex flex-wrap items-center gap-2">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou região" aria-label="Buscar estudo" className="h-9 min-w-[200px] flex-1 rounded-xl border bg-white px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por veredito">
          {([["", linhas.length, "Todos"], ["aprovado", conta("aprovado"), "Aprovam"], ["atencao", conta("atencao"), "Condicionantes"], ["reprovado", conta("reprovado"), "Não aprovam"]] as [Veredito | "", number, string][]).map(([v, n, t]) => (
            <button key={t} type="button" aria-pressed={veredito === v} onClick={() => setVeredito(v)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-white px-3 text-[12px] font-medium text-muted-foreground hover:bg-muted aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background">
              {t}<b className={`tabular-nums ${veredito === v ? "" : v === "aprovado" ? "text-success" : v === "atencao" ? "text-warning" : v === "reprovado" ? "text-destructive" : "text-foreground"}`}>{n}</b>
            </button>
          ))}
        </div>
        <button type="button" aria-expanded={filtros} onClick={() => setFiltros((f) => !f)}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-white px-3 text-[12px] font-medium hover:bg-muted aria-expanded:border-foreground">
          Filtros{nFiltros > 0 && <span className="rounded-full bg-primary px-1.5 text-[10.5px] font-semibold text-primary-foreground">{nFiltros}</span>}
        </button>
        {(nFiltros > 0 || busca || veredito) && <Button variant="ghost" size="sm" onClick={limpar}>Limpar</Button>}
      </div>
      {refsTodas && linhas.some((l) => !l.completo) && <p className="text-[11px] text-muted-foreground">Em {linhas.filter((l) => !l.completo).length === 1 ? "1 estudo" : `${linhas.filter((l) => !l.completo).length} estudos`}, o parecer ainda não inclui população, renda e alunos: a área de 10 min só é guardada quando o estudo é aberto. Abra o estudo para completar.</p>}
      {filtros && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-2.5">
          <select value={ordem} onChange={(e) => setOrdem(e.target.value as typeof ordem)} aria-label="Ordem" className={selecionar}><option value="recentes">Mais recentes</option><option value="parecer">Melhor parecer</option><option value="payback">Menor payback</option><option value="venda">Maior venda esperada</option></select>
          <select value={decisao} onChange={(e) => setDecisao(e.target.value as StatusDecisao | "")} aria-label="Decisão" className={selecionar}>
            <option value="">Todas as decisões</option>{(Object.keys(DECISAO_ROTULO) as StatusDecisao[]).map((d) => <option key={d} value={d}>{DECISAO_ROTULO[d]}</option>)}
          </select>
          <select value={modelo} onChange={(e) => setModelo(e.target.value)} aria-label="Modelo" className={selecionar}><option value="">Low Cost e Pro</option><option value="low">Low Cost</option><option value="pro">Pro</option></select>
          <select value={periodo} onChange={(e) => setPeriodo(Number(e.target.value))} aria-label="Período" className={selecionar}>
            <option value={0}>Qualquer data</option><option value={30}>Últimos 30 dias</option><option value={90}>Últimos 3 meses</option><option value={365}>Último ano</option>
          </select>
          {autores.length > 1 && <select value={autor} onChange={(e) => setAutor(e.target.value)} aria-label="Autor" className={selecionar}><option value="">Todos os autores</option>{autores.map((a) => <option key={a}>{a}</option>)}</select>}
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {!pontos.length ? (
            <div className="card-surface p-10 text-center text-sm text-muted-foreground">{editavel ? <>Nenhum estudo ainda. Clique em <strong>Novo estudo</strong> e marque o imóvel no mapa.</> : "Nenhum ponto estudado ainda."}</div>
          ) : !filtradas.length ? (
            <div className="card-surface p-10 text-center text-sm text-muted-foreground">Nenhum estudo com esses filtros.</div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {filtradas.map(({ p, r, regiao, real }) => (
                // card enxuto, no mesmo estilo dos cards das unidades (pedido do dono, 23/11/2026)
                <div key={p.id} role="button" tabIndex={0} onClick={() => abrir(p.id)} onKeyDown={(e) => e.key === "Enter" && abrir(p.id)}
                  className={`card-surface flex cursor-pointer flex-col gap-1 px-3 py-2.5 transition hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${sel.has(p.id) ? "border-primary ring-1 ring-primary" : ""}`}>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: r ? COR_PINO[r.veredito] : "#c9ced8" }} aria-hidden />
                    <p className="min-w-0 flex-1 truncate text-[13px] font-semibold">{p.nome}</p>
                    {r && <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${PILULA_VEREDITO[r.veredito]}`}>{VEREDITO_ROTULO[r.veredito]}</span>}
                    <input type="checkbox" checked={sel.has(p.id)} onClick={(e) => e.stopPropagation()} onChange={() => alternar(p.id)} title="Marcar para comparar no mapa" aria-label={`Selecionar ${p.nome} para comparar`} className="h-3.5 w-3.5 accent-primary" />
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">{p.endereco ? p.endereco.replace(/,\s*\d{5}(-\d{3})?/, "").replace(/,\s*Brasil$/, "") : regiao || "sem região"} · {NOME_MODELO[p.modelo]} · {p.m2.toLocaleString("pt-BR")} m²</p>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[15px] font-semibold tabular-nums">{r ? reais(r.provavel) : "—"}<span className="ml-1 text-[11px] font-normal text-muted-foreground">por mês{real != null ? ` · real ${reais(real)}` : ""}</span></span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">{p.origem?.aluguel ? `aluguel ${reais(p.origem.aluguel)} · ` : "sem aluguel · "}{r ? `payback ${meses(r.payback)}` : ""}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span className="truncate">{p.autor?.nome ?? "Você"} · {dataBR(p.criadoEm)}{(p.decisao?.status ?? "analise") !== "analise" ? ` · ${DECISAO_ROTULO[p.decisao!.status]}` : ""}</span>
                    {apagar && editavel && (
                      <button type="button" title="Apagar este estudo" aria-label={`Apagar o estudo ${p.nome}`}
                        onClick={(e) => { e.stopPropagation(); if (window.confirm(`Apagar o estudo "${p.nome}"? Ele sai da lista e não dá para desfazer.`)) apagar(p.id); }}
                        className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 xl:sticky xl:top-4">
          <div className="overflow-hidden rounded-2xl border bg-white">
            <MiniMapa linhas={filtradas} abrir={abrir} />
            <div className="flex flex-wrap gap-3 border-t px-3.5 py-2.5 text-xs text-muted-foreground">
              {(["aprovado", "atencao", "reprovado"] as Veredito[]).map((v) => <span key={v}><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-[-1px]" style={{ background: COR_PINO[v] }} />{VEREDITO_ROTULO[v].toLowerCase()}</span>)}
              <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full border-2 border-sky-800 align-[-1px]" />virou unidade</span>
            </div>
          </div>
          {acerto ? (
            <div className="rounded-2xl border bg-white p-4">
              <h3 className="text-sm font-semibold">O modelo está acertando?</h3>
              <p className="mt-2 font-display text-2xl font-medium">{acerto.dentro} de {acerto.n}</p>
              <p className="text-[13px] leading-relaxed text-muted-foreground">estudos que viraram unidade madura ficaram dentro da faixa prevista. Erro médio de {Math.round(acerto.erroMedio * 100)}% entre o previsto e o real.</p>
            </div>
          ) : (
            <p className="px-1 text-[12px] leading-relaxed text-muted-foreground"><b className="font-semibold text-foreground">O modelo está acertando?</b> Quando um estudo virar unidade e completar 12 meses, a previsão é comparada aqui com as vendas reais.</p>
          )}
        </div>
      </div>

      {sel.size >= 2 && (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-foreground py-2.5 pl-5 pr-2.5 text-sm text-background shadow-2xl">
          <span>{sel.size} estudos selecionados</span>
          <Button variant="secondary" onClick={() => comparar([...sel])}>Comparar no mapa</Button>
          <Button variant="ghost" className="text-background hover:bg-background/15 hover:text-background" onClick={() => setSel(new Set())}>Desmarcar</Button>
        </div>
      )}
    </div>
  );
}
