import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { bolinha, carregarLeaflet, gradienteRampa, hexagono, rampa, type Leaflet } from "@/components/estudos/mapaComum";
import { captacaoDe, km, raio80Real, reais, unidadeComoPonto, type DadosEstudos, type UnidadeEstudo } from "@/lib/estudoPonto";

type Lente = "alunos" | "modelo" | "pessoas" | "renda" | "rede";
const LENTES: { id: Lente; rotulo: string }[] = [
  { id: "alunos", rotulo: "Onde moram os alunos" }, { id: "modelo", rotulo: "Onde o modelo diria" },
  { id: "pessoas", rotulo: "Pessoas" }, { id: "renda", rotulo: "Renda" }, { id: "rede", rotulo: "Nossa rede" },
];
const fmtKm = (v: number | null) => (v == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`);

/**
 * Estudo de uma unidade em operação: onde os alunos moram de verdade, onde o modelo diria que estariam, com quem divide a captação
 * e como vende por m² contra a mediana da rede. `voltar` some quando a pessoa só tem acesso à própria unidade.
 */
export function MapaUnidade({ dados, unidades, inicial, voltar }: { dados: DadosEstudos; unidades: UnidadeEstudo[]; inicial: string; voltar?: () => void }) {
  const [nome, setNome] = useState(inicial);
  const [lente, setLente] = useState<Lente>("alunos");
  const [satelite, setSatelite] = useState(false);
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

  useEffect(() => {
    let vivo = true;
    carregarLeaflet().then((L) => {
      if (!vivo || !el.current) return;
      const mapa = L.map(el.current, { zoomControl: false }).setView(u?.c ?? [-15.8, -47.9], 13);
      const ruas = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(mapa);
      const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Imagens © Esri" });
      L.control.zoom({ position: "bottomright" }).addTo(mapa);
      ref.current = { L, mapa, camadas: L.layerGroup().addTo(mapa), ruas, sat };
      setPronto(true);
    });
    return () => { vivo = false; ref.current?.mapa.remove(); ref.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ref.current && u?.c) ref.current.mapa.setView(u.c, 13); }, [nome, pronto]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    if (satelite) { m.mapa.removeLayer(m.ruas); m.sat.addTo(m.mapa); } else { m.mapa.removeLayer(m.sat); m.ruas.addTo(m.mapa); }
    m.mapa.getContainer().classList.toggle("mapa-cinza", !satelite);
  }, [satelite, pronto]);

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
      const cor = lente === "pessoas" ? "#c41230" : "#1f5f8b";
      for (const c of vis) {
        const t = Math.min(1, v(c) / mx);
        L.polygon(hexagono(c[0], c[1], censo.rk), { color: "#fff", weight: 1, opacity: 0.6, fillColor: cor, fillOpacity: 0.04 + t * t * 0.42 })
          .bindTooltip(lente === "pessoas" ? `${c[2].toLocaleString("pt-BR")} moradores` : c[3] ? `Renda média do responsável: R$ ${c[3].toLocaleString("pt-BR")}` : "Sem dado de renda", { sticky: true }).addTo(camadas);
      }
    }
    for (const o of dados.unidades ?? []) {
      if (!o.c || o.nome === u.nome) continue;
      L.marker(o.c, { icon: bolinha(L, "#c41230", lente === "rede" ? 15 : 11, lente === "rede" ? 1 : 0.7) }).bindTooltip(`World Gym ${o.nome}, a ${fmtKm(km(o.c, u.c))}`).addTo(camadas);
      if (lente === "rede") L.circle(o.c, { radius: 2400, color: "#c41230", weight: 1, dashArray: "3 4", fillOpacity: 0.05, interactive: false }).addTo(camadas);
    }
    L.marker(u.c, { zIndexOffset: 2000, title: u.nome, icon: L.divIcon({ className: "", iconSize: [30, 30], iconAnchor: [15, 30], html: `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#c41230;border:3px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.35)"></div>` }) })
      .bindTooltip(`<strong>World Gym ${u.nome}</strong>`).addTo(camadas);
  }, [lente, u, cap, pronto]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!u) return <p className="rounded-2xl border bg-white p-6 text-sm text-muted-foreground">Nenhuma unidade para mostrar.</p>;
  const comparado = porM2 && mediana ? porM2 / mediana - 1 : null;

  return (
    <div className="relative h-[calc(100vh-7.5rem)] min-h-[560px] overflow-hidden rounded-2xl border bg-muted">
      <style>{`.mapa-cinza .leaflet-tile-pane{filter:grayscale(1) contrast(.9) brightness(1.06)}`}</style>
      <div ref={el} className="absolute inset-0" aria-label={`Mapa da unidade ${u.nome}`} />

      <aside className="absolute bottom-3 left-3 top-3 z-[500] flex w-[380px] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-xl max-md:bottom-0 max-md:left-0 max-md:top-auto max-md:max-h-[58%] max-md:w-full max-md:max-w-full max-md:rounded-b-none">
        {(voltar || unidades.length > 1) && (
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
            {voltar ? <button type="button" onClick={voltar} className="rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">← Estudos</button> : <span />}
            {unidades.length > 1 && (
              <select value={u.nome} onChange={(e) => setNome(e.target.value)} aria-label="Unidade" className="rounded-lg border bg-white px-2 py-1.5 text-sm">
                {unidades.map((x) => <option key={x.nome} value={x.nome}>{x.nome}</option>)}
              </select>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          <section className="px-5 pb-4 pt-4">
            <p className="text-sm font-medium text-muted-foreground">Estudo da unidade{u.m2 ? `, ${u.m2.toLocaleString("pt-BR")} m²` : ""}</p>
            <h2 className="font-display text-2xl font-medium">World Gym {u.nome}</h2>
            {u.vendas != null && (
              <p className="mt-2 text-[17px] font-medium leading-snug">
                Vende <strong>{reais(u.vendas)}</strong> por mês
                {comparado != null && <>, <strong className={comparado >= 0 ? "text-success" : "text-destructive"}>{Math.abs(Math.round(comparado * 100))}% {comparado >= 0 ? "acima" : "abaixo"}</strong> da média da rede para o tamanho dela</>}.
                {!u.madura && <span className="block text-sm font-normal text-muted-foreground">Ainda amadurecendo: a comparação vale a partir de 12 meses de operação.</span>}
              </p>
            )}
          </section>
          <div className="grid grid-cols-2 border-t">
            {[
              ["Vendas por m²", porM2 ? `R$ ${Math.round(porM2).toLocaleString("pt-BR")}` : "—", mediana ? `rede: R$ ${mediana.toLocaleString("pt-BR")}` : ""],
              ["Alunos ativos", u.alunos != null ? u.alunos.toLocaleString("pt-BR") : "—", ""],
              ["80% dos alunos a até", fmtKm(r80), alunosBairro ? `${alunosBairro.toLocaleString("pt-BR")} com bairro` : ""],
              ["Moradores nessa área", moradores80 != null ? `${Math.round(moradores80 / 1000).toLocaleString("pt-BR")} mil` : "—", ""],
            ].map(([t, v, sub], i) => (
              <div key={t} className={`border-b px-5 py-3 ${i % 2 === 0 ? "border-r" : ""}`}>
                <small className="block text-xs text-muted-foreground">{t}</small><b className="font-display text-[21px] font-medium tabular-nums">{v}</b>
                {sub && <small className="block text-[11px] text-muted-foreground">{sub}</small>}
              </div>
            ))}
          </div>
          {u.previsto && u.vendas != null && (
            <section className="border-b px-5 py-3.5 text-[13px]">
              <h3 className="mb-1 font-semibold">O modelo e a realidade</h3>
              <p className="text-muted-foreground">Pelo tamanho do imóvel, o modelo preveria {reais(u.previsto.provavel)} por mês (entre {reais(u.previsto.pessimista)} e {reais(u.previsto.otimista)}).
                {u.vendas > u.previsto.otimista ? " A unidade vende acima da faixa: o ponto ou a gestão rendem mais que o tamanho explica." : u.vendas < u.previsto.pessimista ? " A unidade vende abaixo da faixa: vale entender o que segura as vendas." : " A unidade vende dentro da faixa."}</p>
            </section>
          )}
          <section className="border-b px-5 py-3.5">
            <h3 className="mb-2 text-[13px] font-semibold">Bairros que mais trazem alunos</h3>
            {topBairros.length ? topBairros.map(([b, , , n]) => (
              <div key={b} className="flex justify-between py-0.5 text-[13px]"><span>{b}</span><span className="tabular-nums text-muted-foreground">{n.toLocaleString("pt-BR")} ({Math.round((n / Math.max(1, alunosBairro)) * 100)}%)</span></div>
            )) : <p className="text-[13px] text-muted-foreground">Sem bairros localizados ainda.</p>}
          </section>
          <section className="px-5 py-3.5">
            <h3 className="mb-2 text-[13px] font-semibold">Com quem divide a captação</h3>
            {cap?.divideCom.length ? cap.divideCom.map((d) => (
              <div key={d.nome} className="flex justify-between py-0.5 text-[13px]"><span>{d.nome}</span><span className="tabular-nums text-muted-foreground">{Math.round(d.parte * 100)}%</span></div>
            )) : <p className="text-[13px] text-muted-foreground">Nenhuma World Gym divide a área desta unidade.</p>}
            <p className="mt-2 text-xs text-muted-foreground">Compare as lentes "Onde moram os alunos" e "Onde o modelo diria": onde o modelo espera alunos e eles não aparecem é onde vale fazer marketing.</p>
          </section>
        </div>
      </aside>

      <div className="pointer-events-none absolute left-[404px] right-16 top-3 z-[450] flex flex-col items-center gap-2 max-md:left-3 max-md:right-3">
        <nav className="pointer-events-auto flex max-w-full overflow-x-auto rounded-xl bg-white p-1 shadow-lg" aria-label="O que o mapa mostra">
          {LENTES.map((l) => (
            <button key={l.id} type="button" aria-pressed={lente === l.id} onClick={() => setLente(l.id)}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-[13px] text-muted-foreground aria-pressed:bg-foreground aria-pressed:font-medium aria-pressed:text-background">{l.rotulo}</button>
          ))}
        </nav>
        {lente === "modelo" && (
          <div className="pointer-events-auto flex items-center gap-2 rounded-lg bg-white/95 px-3 py-1.5 text-xs text-muted-foreground shadow">
            poucos alunos<span className="h-1.5 w-28 rounded" style={{ background: gradienteRampa }} />muitos alunos<span className="ml-2 border-l pl-2">tracejado: onde moram 80%</span>
          </div>
        )}
        {lente === "alunos" && <div className="pointer-events-auto rounded-lg bg-white/95 px-3 py-1.5 text-xs text-muted-foreground shadow">bolha maior = mais alunos no bairro · tracejado: onde moram 80%</div>}
      </div>

      <div className="absolute bottom-24 right-3 z-[450] flex flex-col overflow-hidden rounded-xl bg-white shadow-lg max-md:bottom-[calc(58%+5rem)]">
        <button type="button" aria-pressed={satelite} onClick={() => setSatelite((s) => !s)} title="Satélite" className="grid h-10 w-10 place-items-center aria-pressed:bg-foreground aria-pressed:text-background">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z" /><path d="M9 4v13M15 7v13" /></svg><span className="sr-only">Satélite</span>
        </button>
      </div>
    </div>
  );
}
