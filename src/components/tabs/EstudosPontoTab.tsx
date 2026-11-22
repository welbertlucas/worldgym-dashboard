import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE, authFetch } from "@/lib/auth";
import {
  VEREDITO_ROTULO, avaliarPonto, captacaoDe, fatoresDe, km, meses, parecidas, reais,
  type DadosEstudos, type Modelo, type Ponto, type Resultado, type Veredito,
} from "@/lib/estudoPonto";

const CORES = ["#c41230", "#1f5f8b", "#7a4bb5", "#0f7b6c", "#b45309", "#334155"];
const letra = (i: number) => String.fromCharCode(65 + (i % 26));
const ITENS: { k: keyof Ponto["imovel"]; rotulo: string }[] = [
  { k: "fachada", rotulo: "Fachada na avenida" }, { k: "estacionamento", rotulo: "Estacionamento" },
  { k: "polo", rotulo: "Polo comercial" }, { k: "aPe", rotulo: "Bom acesso a pé" },
];
type Lente = "captacao" | "pessoas" | "renda" | "rede";
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

export function EstudosPontoTab() {
  const [dados, setDados] = useState<DadosEstudos | null>(null);
  const [erro, setErro] = useState("");
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [atualId, setAtualId] = useState<string | null>(null);
  const [lente, setLente] = useState<Lente>("captacao");
  const [adicionando, setAdicionando] = useState(false);
  const [satelite, setSatelite] = useState(false);
  const [salvo, setSalvo] = useState<"" | "salvando" | "salvo" | "erro">("");
  const mapaEl = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<{ L: typeof import("leaflet"); mapa: import("leaflet").Map; camadas: import("leaflet").LayerGroup; ruas: import("leaflet").TileLayer; sat: import("leaflet").TileLayer } | null>(null);
  const primeiraCarga = useRef(true);
  const [desenho, setDesenho] = useState(0);

  useEffect(() => {
    authFetch(`${API_BASE}/estudos`).then(async (res) => {
      if (!res.ok) throw new Error(res.status === 403 ? "Sem permissão para ver os estudos de ponto." : "Não consegui carregar os estudos agora.");
      const d: DadosEstudos = await res.json();
      setDados(d); setPontos(d.pontos ?? []); setAtualId(d.pontos?.[0]?.id ?? null);
    }).catch((e) => setErro(e.message));
  }, []);

  // grava os pontos no servidor um instante depois da última mudança
  useEffect(() => {
    if (!dados?.disponivel) return;
    if (primeiraCarga.current) { primeiraCarga.current = false; return; }
    setSalvo("salvando");
    const t = setTimeout(() => {
      authFetch(`${API_BASE}/estudos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "pontos", pontos }) })
        .then((r) => setSalvo(r.ok ? "salvo" : "erro")).catch(() => setSalvo("erro"));
    }, 900);
    return () => clearTimeout(t);
  }, [pontos, dados?.disponivel]);

  const atual = pontos.find((p) => p.id === atualId) ?? null;
  const pronto = dados?.disponivel && dados.premissas && dados.vendasPorM2 && dados.censo && dados.unidades;
  const avaliar = (p: Ponto) => (pronto && dados.vendasPorM2![p.modelo] ? avaliarPonto(p, dados.premissas!, dados.vendasPorM2![p.modelo]!) : null);
  const resultados = useMemo(() => new Map(pontos.map((p) => [p.id, avaliar(p)])), [pontos, dados]); // eslint-disable-line react-hooks/exhaustive-deps
  const cap = useMemo(() => (atual && pronto ? captacaoDe(atual, dados.censo!, dados.unidades!, pontos, dados.premissas!.curva) : null), [atual, pontos, dados]); // eslint-disable-line react-hooks/exhaustive-deps
  const r = atual ? resultados.get(atual.id) ?? null : null;

  const mudar = (id: string, campos: Partial<Ponto>) => setPontos((ps) => ps.map((p) => (p.id === id ? { ...p, ...campos } : p)));
  const remover = (id: string) => { setPontos((ps) => ps.filter((p) => p.id !== id)); setAtualId((a) => (a === id ? pontos.find((p) => p.id !== id)?.id ?? null : a)); };

  // mapa: cria uma vez
  useEffect(() => {
    if (!pronto || !mapaEl.current || mapaRef.current) return;
    let vivo = true;
    import("leaflet").then((mod) => {
      if (!vivo || !mapaEl.current) return;
      const L = (mod as unknown as { default?: typeof import("leaflet") }).default ?? (mod as typeof import("leaflet"));
      const centro = pontos[0]?.c ?? dados.unidades!.find((u) => u.c)?.c ?? [-15.8, -47.9];
      const mapa = L.map(mapaEl.current, { zoomControl: false }).setView(centro, 13);
      const ruas = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(mapa);
      const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Imagens © Esri" });
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
      const novo: Ponto = { id: `p${Date.now().toString(36)}`, nome: `Ponto ${letra(pontos.length)}`, c: [e.latlng.lat, e.latlng.lng], modelo: "low", m2: dados?.premissas?.modelos.low.padraoM2 ?? 1000, imovel: { fachada: false, estacionamento: false, polo: false, aPe: false } };
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
      const cor = lente === "pessoas" ? "#c41230" : "#1f5f8b";
      for (const c of vis) {
        const t = Math.min(1, v(c) / mx);
        L.polygon(hex(c[0], c[1]), { color: "#fff", weight: 1, opacity: 0.6, fillColor: cor, fillOpacity: 0.04 + t * t * 0.42 })
          .bindTooltip(lente === "pessoas" ? `${c[2].toLocaleString("pt-BR")} moradores` : c[3] ? `Renda média do responsável: R$ ${c[3].toLocaleString("pt-BR")}` : "Sem dado de renda", { sticky: true }).addTo(camadas);
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
      const sel = p.id === atualId, tam = sel ? 34 : 26;
      const mk = L.marker(p.c, {
        draggable: true, zIndexOffset: sel ? 2000 : 1000, title: p.nome,
        icon: L.divIcon({ className: "", iconSize: [tam, tam], iconAnchor: [tam / 2, tam], html: `<div style="width:${tam}px;height:${tam}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${CORES[i % CORES.length]};border:3px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.35);display:grid;place-items:center;cursor:grab"><span style="transform:rotate(45deg);color:#fff;font:600 ${sel ? 14 : 12}px Inter,sans-serif">${letra(i)}</span></div>` }),
      }).addTo(camadas);
      mk.on("click", () => setAtualId(p.id));
      mk.on("dragend", () => { const ll = mk.getLatLng(); mudar(p.id, { c: [ll.lat, ll.lng] }); setAtualId(p.id); });
    });
  }, [lente, cap, pontos, atualId, desenho]); // eslint-disable-line react-hooks/exhaustive-deps

  if (erro) return <p className="rounded-2xl border bg-white p-6 text-sm text-muted-foreground">{erro}</p>;
  if (!dados) return <p className="rounded-2xl border bg-white p-6 text-sm text-muted-foreground">Carregando os estudos de ponto…</p>;
  if (!dados.disponivel || !pronto) return <p className="rounded-2xl border bg-white p-6 text-sm text-muted-foreground">As premissas dos estudos de ponto ainda não foram carregadas.</p>;

  const idx = atual ? pontos.findIndex((p) => p.id === atual.id) : -1;
  const parec = atual ? parecidas(atual, dados.censo!, dados.unidades!) : [];
  const fatores = atual && r && cap ? fatoresDe(atual, r, cap, dados.unidades!, dados.censo!, dados.premissas!) : [];

  return (
    <div className="relative h-[calc(100vh-7.5rem)] min-h-[560px] overflow-hidden rounded-2xl border bg-muted">
      <style>{`.mapa-cinza .leaflet-tile-pane{filter:grayscale(1) contrast(.9) brightness(1.06)}`}</style>
      <div ref={mapaEl} className="absolute inset-0" aria-label="Mapa do estudo de ponto" />

      {/* painel */}
      <aside className="absolute bottom-3 left-3 top-3 z-[500] flex w-[380px] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-xl max-md:bottom-0 max-md:left-0 max-md:top-auto max-md:max-h-[58%] max-md:w-full max-md:max-w-full max-md:rounded-b-none">
        <div className="flex-1 overflow-y-auto">
          <div className="border-b p-2">
            {pontos.map((p, i) => {
              const rr = resultados.get(p.id);
              return (
                <button key={p.id} type="button" onClick={() => setAtualId(p.id)} aria-current={p.id === atualId}
                  className="grid w-full grid-cols-[28px_1fr_auto] items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-muted aria-[current=true]:bg-muted">
                  <span className="grid h-[26px] w-[26px] place-items-center rounded-full text-[13px] font-semibold text-white" style={{ background: CORES[i % CORES.length] }}>{letra(i)}</span>
                  <span className="min-w-0"><span className="block truncate text-sm font-medium">{p.nome}</span>
                    {rr && <span className="block text-xs tabular-nums text-muted-foreground">{reais(rr.provavel)} por mês · {meses(rr.payback)}</span>}</span>
                  {rr && <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${FUNDO_VEREDITO[rr.veredito]}`}>{VEREDITO_ROTULO[rr.veredito]}</span>}
                </button>
              );
            })}
            <button type="button" onClick={() => setAdicionando((a) => !a)} aria-pressed={adicionando}
              className="mt-1 w-full rounded-xl border border-dashed px-3 py-2 text-left text-sm text-muted-foreground aria-pressed:border-primary aria-pressed:bg-primary/5 aria-pressed:text-primary">
              {adicionando ? "Clique no mapa onde fica o imóvel" : "+ Adicionar ponto"}
            </button>
          </div>

          {!atual && <p className="p-5 text-sm text-muted-foreground">Adicione um ponto e clique no mapa onde fica o imóvel. A conta aparece aqui.</p>}

          {atual && r && (
            <>
              <section className="px-5 pb-1 pt-4">
                <input value={atual.nome} onChange={(e) => mudar(atual.id, { nome: e.target.value })} aria-label="Nome do ponto"
                  className="w-full rounded-md bg-transparent text-sm font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                <div className="mt-2 flex items-center gap-2">
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
                <p className="mt-3 text-[19px] font-medium leading-snug">
                  Deve vender <strong className={COR_VEREDITO[r.veredito]}>{reais(r.provavel)}</strong> por mês.{" "}
                  {r.veredito === "aprovado"
                    ? <>Passa dos {reais(r.meta)} que pagam o investimento em {dados.premissas!.regua.mesesAprovado / 12} anos.</>
                    : <>Para pagar o investimento em {dados.premissas!.regua.mesesAprovado / 12} anos, precisa de {reais(r.meta)}.</>}
                </p>
                <Regua r={r} />
              </section>

              <div className="mt-3 grid grid-cols-2 border-t">
                {[["Lucro por mês", r.lucro > 0 ? reais(r.lucro) : "prejuízo"], ["Payback", meses(r.payback)], ["Investimento", `R$ ${(r.investimento / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`], ["80% dos alunos a até", cap ? `${cap.raio80.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km` : "—"]].map(([t, v], i) => (
                  <div key={t} className={`border-b px-5 py-3 ${i % 2 === 0 ? "border-r" : ""}`}><small className="block text-xs text-muted-foreground">{t}</small><b className="font-display text-[21px] font-medium tabular-nums">{v}</b></div>
                ))}
              </div>

              <section className="border-b px-5 py-3.5">
                <h3 className="mb-2 text-[13px] font-semibold">O que pesa</h3>
                <ul className="space-y-1 text-[13px]">
                  {fatores.map((f) => <li key={f.texto} className="flex gap-2.5"><span className={`w-3.5 flex-none text-center font-bold ${f.positivo ? "text-success" : "text-destructive"}`}>{f.positivo ? "+" : "−"}</span>{f.texto}</li>)}
                </ul>
              </section>

              <section className="border-b px-5 py-3.5">
                <h3 className="mb-2 text-[13px] font-semibold">O imóvel</h3>
                <div className="flex flex-wrap gap-1.5">
                  {ITENS.map((it) => (
                    <button key={it.k} type="button" aria-pressed={atual.imovel[it.k]} onClick={() => mudar(atual.id, { imovel: { ...atual.imovel, [it.k]: !atual.imovel[it.k] } })}
                      className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground aria-pressed:border-foreground aria-pressed:bg-muted aria-pressed:font-medium aria-pressed:text-foreground">{it.rotulo}</button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Fica registrado no estudo. Ainda não muda a conta: o peso de cada item será medido com as unidades da rede.</p>
              </section>

              {parec.length > 0 && (
                <section className="border-b px-5 py-3.5">
                  <h3 className="mb-2 text-[13px] font-semibold">Unidades parecidas na rede</h3>
                  {parec.map((u) => <div key={u.nome} className="flex justify-between py-0.5 text-[13px]"><span className="text-muted-foreground">{u.nome}, {u.m2?.toLocaleString("pt-BR")} m²</span><span className="font-medium tabular-nums">{u.vendas ? reais(u.vendas) : "—"}</span></div>)}
                  <p className="mt-1 text-xs text-muted-foreground">Mesma quantidade de moradores e renda a até 2 km.</p>
                </section>
              )}

              <div className="flex items-center justify-between px-5 py-3 text-xs text-muted-foreground">
                <span>{salvo === "salvando" ? "Salvando…" : salvo === "salvo" ? "Salvo" : salvo === "erro" ? "Não consegui salvar" : ""}</span>
                <button type="button" onClick={() => { if (window.confirm(`Remover o ${atual.nome}?`)) remover(atual.id); }} className="text-destructive hover:underline">Remover ponto {letra(idx)}</button>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* lentes */}
      <div className="pointer-events-none absolute left-[404px] right-16 top-3 z-[450] flex flex-col items-center gap-2 max-md:left-3 max-md:right-3">
        <nav className="pointer-events-auto flex max-w-full overflow-x-auto rounded-xl bg-white p-1 shadow-lg" aria-label="O que o mapa mostra">
          {LENTES.map((l) => (
            <button key={l.id} type="button" aria-pressed={lente === l.id} onClick={() => setLente(l.id)}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-[13px] text-muted-foreground aria-pressed:bg-foreground aria-pressed:font-medium aria-pressed:text-background">{l.rotulo}</button>
          ))}
        </nav>
        {lente === "captacao" && atual && (
          <div className="pointer-events-auto flex items-center gap-2 rounded-lg bg-white/95 px-3 py-1.5 text-xs text-muted-foreground shadow">
            poucos alunos<span className="h-1.5 w-28 rounded" style={{ background: `linear-gradient(90deg,${RAMPA.map((c) => `rgb(${c})`).join(",")})` }} />muitos alunos
            <span className="ml-2 border-l pl-2">tracejado: onde moram 80%</span>
          </div>
        )}
      </div>

      {/* ferramentas */}
      <div className="absolute bottom-24 right-3 z-[450] flex flex-col overflow-hidden rounded-xl bg-white shadow-lg max-md:bottom-[calc(58%+5rem)]">
        <button type="button" aria-pressed={satelite} onClick={() => setSatelite((s) => !s)} title="Satélite" className="grid h-10 w-10 place-items-center aria-pressed:bg-foreground aria-pressed:text-background">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z" /><path d="M9 4v13M15 7v13" /></svg><span className="sr-only">Satélite</span>
        </button>
        <button type="button" disabled={!atual} title="Ver a rua no Google (abre outra aba)" className="grid h-10 w-10 place-items-center border-t disabled:opacity-40"
          onClick={() => atual && window.open(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${atual.c[0]},${atual.c[1]}`, "_blank", "noopener")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="5" r="2.5" /><path d="M12 8v7M8 12h8M10 21l2-6 2 6" /></svg><span className="sr-only">Ver a rua</span>
        </button>
      </div>
    </div>
  );
}
