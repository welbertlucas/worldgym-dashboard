import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DECISAO_ROTULO, VEREDITO_ROTULO, acertoDoModelo, avaliarPonto, meses, raio80Real, reais, regiaoDe,
  type DadosEstudos, type Ponto, type Resultado, type StatusDecisao, type Veredito,
} from "@/lib/estudoPonto";

const PILULA_VEREDITO: Record<Veredito, string> = { aprovado: "bg-success/10 text-success", atencao: "bg-warning/10 text-warning", reprovado: "bg-destructive/10 text-destructive" };
const PILULA_DECISAO: Record<StatusDecisao, string> = { analise: "bg-muted text-muted-foreground", aprovado: "bg-success/10 text-success", recusado: "bg-destructive/10 text-destructive", unidade: "bg-sky-100 text-sky-800" };
const COR_PINO: Record<Veredito, string> = { aprovado: "#127a3a", atencao: "#d98a14", reprovado: "#b4232a" };
const NOME_MODELO = { low: "Low Cost", pro: "Pro" } as const;
const dataBR = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

interface Linha { p: Ponto; r: Resultado | null; regiao: string; real: number | null }

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
  return <div ref={el} className="mapa-cinza h-[300px]" aria-label="Mapa dos estudos" />;
}

/** As unidades que já funcionam: vendas reais contra a mediana da rede e contra o que o modelo preveria pelo tamanho. */
function UnidadesEmOperacao({ dados, abrir }: { dados: DadosEstudos; abrir: (nome: string) => void }) {
  const linhas = (dados.unidades ?? []).filter((u) => u.c && u.vendas).map((u) => {
    const med = dados.vendasPorM2?.[u.modelo]?.mediana ?? null, porM2 = u.m2 ? (u.vendas as number) / u.m2 : null;
    return { u, porM2, med, dif: u.previsto ? (u.vendas as number) / u.previsto.provavel - 1 : null, r80: raio80Real(u) };
  }).sort((a, b) => Number(b.u.madura) - Number(a.u.madura) || (b.porM2 ?? 0) - (a.porM2 ?? 0));
  if (!linhas.length) return null;
  return (
    <section className="space-y-2">
      <div><h3 className="text-base font-semibold">Unidades em operação</h3><p className="text-[13px] text-muted-foreground">Como cada unidade vende para o tamanho dela e de onde vêm os alunos. Clique para abrir o estudo.</p></div>
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/40 text-xs text-muted-foreground"><tr>
            <th className="px-3 py-2.5 text-left font-medium">Unidade</th><th className="px-2 py-2.5 text-right font-medium">m²</th>
            <th className="px-2 py-2.5 text-right font-medium">Vendas por mês</th><th className="px-2 py-2.5 text-right font-medium">Vendas por m²</th>
            <th className="px-2 py-2.5 text-right font-medium">80% dos alunos a até</th><th className="px-2 py-2.5 text-right font-medium">Contra o modelo</th><th className="px-3 py-2.5 text-left font-medium">Situação</th>
          </tr></thead>
          <tbody>
            {linhas.map(({ u, porM2, med, dif, r80 }) => (
              <tr key={u.nome} tabIndex={0} onClick={() => abrir(u.nome)} onKeyDown={(e) => e.key === "Enter" && abrir(u.nome)}
                className="cursor-pointer border-t hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <td className="whitespace-nowrap px-3 py-2.5 font-semibold">{u.nome}<span className="ml-1.5 text-xs font-normal text-muted-foreground">{NOME_MODELO[u.modelo]}</span></td>
                <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">{u.m2?.toLocaleString("pt-BR") ?? "—"}</td>
                <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">{reais(u.vendas as number)}</td>
                <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">{porM2 ? <span className={med ? (porM2 >= med ? "text-success" : "text-destructive") : ""}>R$ {Math.round(porM2).toLocaleString("pt-BR")}</span> : "—"}{med && <span className="ml-1 text-[11px] text-muted-foreground">rede {med}</span>}</td>
                <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">{r80 != null ? `${r80.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km` : "—"}</td>
                <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">{dif != null && u.madura ? <span className={dif >= 0 ? "text-success" : "text-destructive"}>{dif >= 0 ? "+" : "−"}{Math.abs(Math.round(dif * 100))}%</span> : "—"}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{u.madura ? "madura" : "amadurecendo"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ListaEstudos({ dados, pontos, abrir, novo, comparar, editavel = true, abrirUnidade }: { dados: DadosEstudos; pontos: Ponto[]; abrir: (id: string) => void; novo: () => void; comparar: (ids: string[]) => void; editavel?: boolean; abrirUnidade?: (nome: string) => void }) {
  const [busca, setBusca] = useState("");
  const [veredito, setVeredito] = useState<Veredito | "">("");
  const [decisao, setDecisao] = useState<StatusDecisao | "">("");
  const [modelo, setModelo] = useState("");
  const [periodo, setPeriodo] = useState(0);
  const [autor, setAutor] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());

  const linhas: Linha[] = useMemo(() => pontos.map((p) => {
    const faixa = dados.vendasPorM2?.[p.modelo];
    const u = p.decisao?.status === "unidade" ? dados.unidades?.find((x) => x.nome === p.decisao?.unidade) : undefined;
    return { p, r: faixa && dados.premissas ? avaliarPonto(p, dados.premissas, faixa) : null, regiao: regiaoDe(p, dados.unidades ?? []), real: u?.madura ? u.vendas : null };
  }).sort((a, b) => (b.p.criadoEm ?? "").localeCompare(a.p.criadoEm ?? "")), [pontos, dados]);
  const autores = [...new Set(pontos.map((p) => p.autor?.nome).filter(Boolean))] as string[];
  const agora = Date.now();
  const filtradas = linhas.filter(({ p, r, regiao }) =>
    (!veredito || r?.veredito === veredito) && (!decisao || (p.decisao?.status ?? "analise") === decisao) && (!modelo || p.modelo === modelo)
    && (!autor || p.autor?.nome === autor) && (!periodo || (p.criadoEm && agora - Date.parse(p.criadoEm) <= periodo * 864e5))
    && (!busca || semAcento(`${p.nome} ${regiao}`).includes(semAcento(busca))));
  const conta = (v: Veredito) => linhas.filter((l) => l.r?.veredito === v).length;
  const acerto = acertoDoModelo(pontos, dados.unidades ?? []);
  const alternar = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const limpar = () => { setBusca(""); setVeredito(""); setDecisao(""); setModelo(""); setPeriodo(0); setAutor(""); };
  const selecionar = "h-10 rounded-xl border bg-white px-2.5 text-[13px]";

  return (
    <div className="space-y-4 pb-20">
      <style>{`.mapa-cinza .leaflet-tile-pane{filter:grayscale(1) contrast(.9) brightness(1.06)}`}</style>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="font-display text-2xl font-medium">Estudos de ponto</h2><p className="text-sm text-muted-foreground">As unidades em operação e cada imóvel avaliado, com a previsão do modelo e a decisão.</p></div>
        {editavel && <button type="button" onClick={novo} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Novo estudo</button>}
      </div>

      {abrirUnidade && <UnidadesEmOperacao dados={dados} abrir={abrirUnidade} />}

      <div className="pt-2"><h3 className="text-base font-semibold">Pontos estudados</h3></div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {([["", linhas.length, "estudos"], ["aprovado", conta("aprovado"), "aprovados pelo modelo"], ["atencao", conta("atencao"), "em atenção"], ["reprovado", conta("reprovado"), "reprovados pelo modelo"]] as [Veredito | "", number, string][]).map(([v, n, t]) => (
          <button key={t} type="button" aria-pressed={veredito === v} onClick={() => setVeredito(v)}
            className="rounded-2xl border bg-white px-4 py-3 text-left aria-pressed:border-foreground aria-pressed:ring-1 aria-pressed:ring-foreground">
            <b className={`block font-display text-3xl font-medium leading-tight ${v === "aprovado" ? "text-success" : v === "atencao" ? "text-warning" : v === "reprovado" ? "text-destructive" : ""}`}>{n}</b>
            <span className="text-[13px] text-muted-foreground">{t}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou região" aria-label="Buscar estudo" className="h-10 min-w-[220px] flex-1 rounded-xl border bg-white px-3 text-sm" />
        <select value={decisao} onChange={(e) => setDecisao(e.target.value as StatusDecisao | "")} aria-label="Decisão" className={selecionar}>
          <option value="">Todas as decisões</option>{(Object.keys(DECISAO_ROTULO) as StatusDecisao[]).map((d) => <option key={d} value={d}>{DECISAO_ROTULO[d]}</option>)}
        </select>
        <select value={modelo} onChange={(e) => setModelo(e.target.value)} aria-label="Modelo" className={selecionar}><option value="">Low Cost e Pro</option><option value="low">Low Cost</option><option value="pro">Pro</option></select>
        <select value={periodo} onChange={(e) => setPeriodo(Number(e.target.value))} aria-label="Período" className={selecionar}>
          <option value={0}>Qualquer data</option><option value={30}>Últimos 30 dias</option><option value={90}>Últimos 3 meses</option><option value={365}>Último ano</option>
        </select>
        {autores.length > 1 && <select value={autor} onChange={(e) => setAutor(e.target.value)} aria-label="Autor" className={selecionar}><option value="">Todos os autores</option>{autores.map((a) => <option key={a}>{a}</option>)}</select>}
        <button type="button" onClick={limpar} className="text-[13px] text-muted-foreground underline">Limpar filtros</button>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-hidden rounded-2xl border bg-white">
          {!pontos.length ? (
            <div className="p-10 text-center text-sm text-muted-foreground">{editavel ? <>Nenhum estudo ainda. Clique em <strong>Novo estudo</strong> e marque o imóvel no mapa.</> : "Nenhum ponto estudado ainda."}</div>
          ) : !filtradas.length ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Nenhum estudo com esses filtros.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-muted/40 text-xs text-muted-foreground"><tr>
                  <th className="w-10 px-3 py-2.5"><span className="sr-only">Selecionar</span></th>
                  <th className="px-2 py-2.5 text-left font-medium">Estudo</th><th className="px-2 py-2.5 text-left font-medium">Modelo</th>
                  <th className="px-2 py-2.5 text-right font-medium">m²</th><th className="px-2 py-2.5 text-right font-medium">Vendas previstas</th>
                  <th className="px-2 py-2.5 text-right font-medium">Payback</th><th className="px-2 py-2.5 text-left font-medium">Veredito</th>
                  <th className="px-2 py-2.5 text-left font-medium">Decisão</th><th className="px-2 py-2.5 text-left font-medium">Autor</th><th className="px-3 py-2.5 text-right font-medium">Data</th>
                </tr></thead>
                <tbody>
                  {filtradas.map(({ p, r, regiao, real }) => (
                    <tr key={p.id} tabIndex={0} onClick={() => abrir(p.id)} onKeyDown={(e) => e.key === "Enter" && abrir(p.id)}
                      className={`cursor-pointer border-t hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${sel.has(p.id) ? "bg-primary/5" : ""}`}>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(p.id)} onChange={() => alternar(p.id)} aria-label={`Selecionar ${p.nome}`} className="h-4 w-4 accent-primary" /></td>
                      <td className="min-w-[180px] px-2 py-3"><div className="text-sm font-semibold">{p.nome}</div><div className="text-xs text-muted-foreground">{regiao}</div></td>
                      <td className="whitespace-nowrap px-2 py-3">{NOME_MODELO[p.modelo]}</td>
                      <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">{p.m2.toLocaleString("pt-BR")}</td>
                      <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">{r ? reais(r.provavel) : "—"}{real != null && <div className="text-[11px] text-sky-800">real: {reais(real)}</div>}</td>
                      <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">{r ? meses(r.payback) : "—"}</td>
                      <td className="px-2 py-3">{r && <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${PILULA_VEREDITO[r.veredito]}`}>{VEREDITO_ROTULO[r.veredito]}</span>}</td>
                      <td className="px-2 py-3"><span title={p.decisao?.comentario} className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${PILULA_DECISAO[p.decisao?.status ?? "analise"]}`}>{DECISAO_ROTULO[p.decisao?.status ?? "analise"]}</span></td>
                      <td className="whitespace-nowrap px-2 py-3">{p.autor?.nome ?? "Você"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{dataBR(p.criadoEm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
          <div className="rounded-2xl border bg-white p-4">
            <h3 className="text-sm font-semibold">O modelo está acertando?</h3>
            {acerto ? (
              <>
                <p className="mt-2 font-display text-2xl font-medium">{acerto.dentro} de {acerto.n}</p>
                <p className="text-[13px] leading-relaxed text-muted-foreground">estudos que viraram unidade madura ficaram dentro da faixa prevista. Erro médio de {Math.round(acerto.erroMedio * 100)}% entre o previsto e o real.</p>
              </>
            ) : (
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">Quando um estudo virar unidade e ela completar 12 meses, a previsão é comparada aqui com as vendas reais.</p>
            )}
          </div>
        </div>
      </div>

      {sel.size >= 2 && (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-foreground py-2.5 pl-5 pr-2.5 text-sm text-background shadow-2xl">
          <span>{sel.size} estudos selecionados</span>
          <button type="button" onClick={() => comparar([...sel])} className="rounded-xl bg-white px-3.5 py-2 font-semibold text-foreground">Comparar no mapa</button>
          <button type="button" onClick={() => setSel(new Set())} className="rounded-xl px-3 py-2 text-background/70 hover:text-background">Desmarcar</button>
        </div>
      )}
    </div>
  );
}
