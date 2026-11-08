import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import type { UnitData } from "@/data/dashboardData";
import { somarBairros, type MapaDados, type Pino } from "@/data/mapaAlunos";

type Bairro = NonNullable<UnitData["bairros"]>[number];

const fmt = (n: number) => n.toLocaleString("pt-BR");
/** Raio da bolha em px: proporcional à raiz da contagem, para a ÁREA acompanhar o número de alunos. */
export const raioDaBolha = (n: number, max: number) => 6 + 26 * Math.sqrt(n / Math.max(1, max));

/** Mapa real (OpenStreetMap) com uma bolha por bairro. Carrega o Leaflet só quando o cartão aparece. */
function Mapa({ bairros, pinos, inativos }: { bairros: Bairro[]; pinos: Pino[]; inativos: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let vivo = true;
    let limpar = () => {};
    import("leaflet").then((mod) => {
      if (!vivo) return;
      const L = mod.default ?? mod;
      const mapa = L.map(el, { scrollWheelZoom: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(mapa);
      const max = Math.max(...bairros.map((b) => b[2]));
      const grupo = L.featureGroup(
        [...bairros].sort((a, b) => b[2] - a[2]).map(([nome, cidade, n, lat, lng, aprox]) =>
          L.circleMarker([lat, lng], { radius: raioDaBolha(n, max), color: aprox ? "#6b7280" : inativos ? "#b45309" : "#1d4ed8", weight: 1.5, dashArray: aprox ? "4 3" : undefined, fillColor: aprox ? "#9ca3af" : inativos ? "#f59e0b" : "#3b82f6", fillOpacity: aprox ? 0.3 : 0.45 })
            .bindTooltip(`<strong>${nome}</strong>${cidade ? ` · ${cidade}` : ""}<br/>${fmt(n)} ${n === 1 ? "aluno" : "alunos"}${aprox ? "<br/><em>posição aproximada (centro da cidade)</em>" : ""}`)),
      ).addTo(mapa);
      // Pinos das unidades: destacados e sempre por cima das bolhas.
      const pino = L.divIcon({ className: "", iconSize: [26, 34], iconAnchor: [13, 32], html: `<svg width="26" height="34" viewBox="0 0 26 34" aria-hidden="true"><path d="M13 1C6.4 1 1 6.2 1 12.7 1 21.5 13 33 13 33s12-11.5 12-20.3C25 6.2 19.6 1 13 1z" fill="#e8281b" stroke="#fff" stroke-width="2"/><circle cx="13" cy="12.5" r="4.5" fill="#fff"/></svg>` });
      for (const p of pinos) {
        L.marker(p.pos, { icon: pino, zIndexOffset: 1000, title: `World Gym ${p.nome}` }).bindTooltip(`<strong>World Gym ${p.nome}</strong><br/>localização da unidade`, { direction: "top", offset: [0, -30] }).addTo(mapa);
      }
      // Enquadra o núcleo: o maior agrupamento de unidades (até 200 km entre si) e os bairros a até 60 km delas. Unidades e alunos
      // distantes (ex.: Salvador) seguem no mapa; é só dar zoom out.
      const km = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], (a[1] - b[1]) * Math.cos((a[0] * Math.PI) / 180)) * 111;
      const grupos = pinos.map((c) => pinos.filter((p) => km(c.pos, p.pos) <= 200));
      const nucleoPinos = grupos.reduce<Pino[]>((m, g) => (g.length > m.length ? g : m), []);
      const nucleo = nucleoPinos.length ? bairros.filter((b) => nucleoPinos.some((p) => km([b[3], b[4]], p.pos) <= 60)) : bairros;
      const pontos: [number, number][] = [...nucleo.map((b) => [b[3], b[4]] as [number, number]), ...nucleoPinos.map((p) => p.pos)];
      mapa.fitBounds((pontos.length ? L.latLngBounds(pontos) : grupo.getBounds()).pad(0.15), { maxZoom: 14 });
      const obs = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => mapa.invalidateSize()) : null; // mapa muda de largura ao ocultar o ranking
      obs?.observe(el);
      limpar = () => { obs?.disconnect(); mapa.remove(); };
    });
    return () => { vivo = false; limpar(); };
  }, [bairros, pinos, inativos]);
  return <div ref={ref} role="img" aria-label="Mapa com os bairros dos alunos ativos; o tamanho da bolha mostra quantos alunos" className="h-[70vh] min-h-[480px] w-full overflow-hidden rounded-xl border border-border" />;
}

type Modo = "ativos" | "inativos" | "todos";
const MODOS: { id: Modo; rotulo: string }[] = [{ id: "ativos", rotulo: "Ativos" }, { id: "inativos", rotulo: "Inativos (12 meses)" }, { id: "todos", rotulo: "Todos" }];
const ROTULO_ALUNOS: Record<Modo, string> = { ativos: "alunos ativos hoje", inativos: "alunos que saíram nos últimos 12 meses", todos: "alunos ativos e que saíram nos últimos 12 meses" };

/** Onde moram os alunos: bolhas no mapa e ranking dos bairros, de quem está ativo, de quem saiu nos últimos 12 meses ou dos dois. Só contagens por bairro; nenhum endereço de aluno é guardado. */
export function OndeMoramAlunos({ unit, dados }: { unit: string; dados: MapaDados }) {
  const [ranking, setRanking] = useState(true);
  const [modo, setModo] = useState<Modo>("ativos");
  const { pinos } = dados;
  const bairros = modo === "ativos" ? dados.bairros : modo === "inativos" ? dados.inativos : somarBairros([dados.bairros, dados.inativos]);
  const semBairro = modo === "ativos" ? dados.semBairro : modo === "inativos" ? dados.semBairroInativos : dados.semBairro + dados.semBairroInativos;
  const subtitle = <>{unit} • {ROTULO_ALUNOS[modo]}</>;
  const filtro = (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div role="group" aria-label="Quais alunos mostrar no mapa" className="inline-flex rounded-lg border border-border bg-card p-0.5">
        {MODOS.map((m) => (
          <button key={m.id} type="button" aria-pressed={modo === m.id} onClick={() => setModo(m.id)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${modo === m.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>{m.rotulo}</button>
        ))}
      </div>
      <button type="button" onClick={() => setRanking((v) => !v)} aria-expanded={ranking} className="hidden rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary lg:block">
        {ranking ? "Ocultar ranking" : "Mostrar ranking"}
      </button>
    </div>
  );
  if (!bairros.length) {
    return (
      <ChartCard title="Onde moram os alunos" subtitle={subtitle}>
        {filtro}
        <ChartEmpty>{modo === "ativos" ? "Ainda não há bairros carregados para esta unidade. A foto é atualizada todo dia junto com a sincronização do EVO." : "Ainda não há bairros de quem saiu nos últimos 12 meses para esta seleção. Eles passam a aparecer na próxima sincronização do EVO."}</ChartEmpty>
      </ChartCard>
    );
  }
  const total = bairros.reduce((s, b) => s + b[2], 0);
  const aprox = bairros.filter((b) => b[5]).reduce((s, b) => s + b[2], 0);
  const top = [...bairros].sort((a, b) => b[2] - a[2]).slice(0, 10);
  const max = top[0][2];
  return (
    <ChartCard title="Onde moram os alunos" subtitle={subtitle}>
      {filtro}
      <div className={ranking ? "grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]" : ""}>
        <Mapa key={modo} bairros={bairros} pinos={pinos} inativos={modo === "inativos"} />
        {ranking && (
          <ol className="space-y-3 rounded-xl border border-border bg-card p-4 lg:h-[70vh] lg:min-h-[480px] lg:overflow-y-auto" aria-label="Bairros com mais alunos">
            {top.map(([nome, cidade, n]) => (
              <li key={`${nome}|${cidade}`} className="text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-medium text-foreground">{nome}{cidade && <span className="font-normal text-muted-foreground"> · {cidade}</span>}</span>
                  <span className="shrink-0 tabular-nums text-foreground">{fmt(n)} <span className="text-xs text-muted-foreground">({((n / total) * 100).toFixed(1).replace(".", ",")}%)</span></span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden><div className={`h-full rounded-full ${modo === "inativos" ? "bg-[#f59e0b]/80" : "bg-[#3b82f6]/70"}`} style={{ width: `${(n / max) * 100}%` }} /></div>
              </li>
            ))}
          </ol>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {fmt(total)} alunos em {fmt(bairros.length)} bairros localizados{semBairro ? `; ${fmt(semBairro)} sem endereço ou bairro não localizado ficam de fora` : ""}. A bolha fica no centro do bairro (OpenStreetMap), não na casa do aluno. {modo === "inativos" && "Inativo é quem não tem contrato ativo hoje e saiu (contrato terminado ou cancelado) nos últimos 12 meses. "}{pinos.length > 1 ? "Os pinos vermelhos são as unidades." : pinos.length === 1 ? "O pino vermelho é a unidade." : ""}{aprox > 0 && <> Bolhas cinza tracejadas ({fmt(aprox)} alunos) são bairros não encontrados no mapa, postos no centro da cidade.</>}
      </p>
    </ChartCard>
  );
}
