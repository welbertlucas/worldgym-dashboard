import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import type { UnitData } from "@/data/dashboardData";
import type { Pino } from "@/data/mapaAlunos";

type Bairro = NonNullable<UnitData["bairros"]>[number];

const fmt = (n: number) => n.toLocaleString("pt-BR");
/** Raio da bolha em px: proporcional à raiz da contagem, para a ÁREA acompanhar o número de alunos. */
export const raioDaBolha = (n: number, max: number) => 6 + 26 * Math.sqrt(n / Math.max(1, max));

/** Mapa real (OpenStreetMap) com uma bolha por bairro. Carrega o Leaflet só quando o cartão aparece. */
function Mapa({ bairros, pinos }: { bairros: Bairro[]; pinos: Pino[] }) {
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
          L.circleMarker([lat, lng], { radius: raioDaBolha(n, max), color: aprox ? "#6b7280" : "#1d4ed8", weight: 1.5, dashArray: aprox ? "4 3" : undefined, fillColor: aprox ? "#9ca3af" : "#3b82f6", fillOpacity: aprox ? 0.3 : 0.45 })
            .bindTooltip(`<strong>${nome}</strong>${cidade ? ` · ${cidade}` : ""}<br/>${fmt(n)} ${n === 1 ? "aluno" : "alunos"}${aprox ? "<br/><em>posição aproximada (centro da cidade)</em>" : ""}`)),
      ).addTo(mapa);
      // Pinos das unidades: destacados e sempre por cima das bolhas.
      const pino = L.divIcon({ className: "", iconSize: [26, 34], iconAnchor: [13, 32], html: `<svg width="26" height="34" viewBox="0 0 26 34" aria-hidden="true"><path d="M13 1C6.4 1 1 6.2 1 12.7 1 21.5 13 33 13 33s12-11.5 12-20.3C25 6.2 19.6 1 13 1z" fill="#e8281b" stroke="#fff" stroke-width="2"/><circle cx="13" cy="12.5" r="4.5" fill="#fff"/></svg>` });
      for (const p of pinos) {
        L.marker(p.pos, { icon: pino, zIndexOffset: 1000, title: `World Gym ${p.nome}` }).bindTooltip(`<strong>World Gym ${p.nome}</strong><br/>localização da unidade`, { direction: "top", offset: [0, -30] }).addTo(mapa);
        grupo.addLayer(L.circleMarker(p.pos, { radius: 1, opacity: 0, fillOpacity: 0, interactive: false }));
      }
      mapa.fitBounds(grupo.getBounds().pad(0.15), { maxZoom: 14 });
      const obs = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => mapa.invalidateSize()) : null; // mapa muda de largura ao ocultar o ranking
      obs?.observe(el);
      limpar = () => { obs?.disconnect(); mapa.remove(); };
    });
    return () => { vivo = false; limpar(); };
  }, [bairros, pinos]);
  return <div ref={ref} role="img" aria-label="Mapa com os bairros dos alunos ativos; o tamanho da bolha mostra quantos alunos" className="h-[70vh] min-h-[480px] w-full overflow-hidden rounded-xl border border-border" />;
}

/** Onde moram os alunos ativos hoje: bolhas no mapa e ranking dos bairros. Só contagens por bairro; nenhum endereço de aluno é guardado. */
export function OndeMoramAlunos({ unit, bairros, semBairro, pinos = [] }: { unit: string; bairros?: UnitData["bairros"]; semBairro?: number; pinos?: Pino[] }) {
  const [ranking, setRanking] = useState(true);
  const subtitle = <>{unit} • alunos ativos hoje</>;
  if (!bairros?.length) return <ChartCard title="Onde moram os alunos" subtitle={subtitle}><ChartEmpty>Ainda não há bairros carregados para esta unidade. A foto é atualizada todo dia junto com a sincronização do EVO.</ChartEmpty></ChartCard>;
  const total = bairros.reduce((s, b) => s + b[2], 0);
  const aprox = bairros.filter((b) => b[5]).reduce((s, b) => s + b[2], 0);
  const top = [...bairros].sort((a, b) => b[2] - a[2]).slice(0, 10);
  const max = top[0][2];
  return (
    <ChartCard title="Onde moram os alunos" subtitle={subtitle}>
      <div className="mb-3 flex justify-end">
        <button type="button" onClick={() => setRanking((v) => !v)} aria-expanded={ranking} className="hidden rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary lg:block">
          {ranking ? "Ocultar ranking" : "Mostrar ranking"}
        </button>
      </div>
      <div className={ranking ? "grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]" : ""}>
        <Mapa bairros={bairros} pinos={pinos} />
        {ranking && (
          <ol className="space-y-3 rounded-xl border border-border bg-card p-4 lg:h-[70vh] lg:min-h-[480px] lg:overflow-y-auto" aria-label="Bairros com mais alunos">
            {top.map(([nome, cidade, n]) => (
              <li key={`${nome}|${cidade}`} className="text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-medium text-foreground">{nome}{cidade && <span className="font-normal text-muted-foreground"> · {cidade}</span>}</span>
                  <span className="shrink-0 tabular-nums text-foreground">{fmt(n)} <span className="text-xs text-muted-foreground">({((n / total) * 100).toFixed(1).replace(".", ",")}%)</span></span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden><div className="h-full rounded-full bg-[#3b82f6]/70" style={{ width: `${(n / max) * 100}%` }} /></div>
              </li>
            ))}
          </ol>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {fmt(total)} alunos em {fmt(bairros.length)} bairros localizados{semBairro ? `; ${fmt(semBairro)} sem endereço ou bairro não localizado ficam de fora` : ""}. A bolha fica no centro do bairro (OpenStreetMap), não na casa do aluno. {pinos.length > 1 ? "Os pinos vermelhos são as unidades." : pinos.length === 1 ? "O pino vermelho é a unidade." : ""}{aprox > 0 && <> Bolhas cinza tracejadas ({fmt(aprox)} alunos) são bairros não encontrados no mapa, postos no centro da cidade.</>}
      </p>
    </ChartCard>
  );
}
