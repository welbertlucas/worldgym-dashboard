import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import type { UnitData } from "@/data/dashboardData";

type Bairro = NonNullable<UnitData["bairros"]>[number];

const fmt = (n: number) => n.toLocaleString("pt-BR");
/** Raio da bolha em px: proporcional à raiz da contagem, para a ÁREA acompanhar o número de alunos. */
export const raioDaBolha = (n: number, max: number) => 6 + 26 * Math.sqrt(n / Math.max(1, max));

/** Mapa real (OpenStreetMap) com uma bolha por bairro. Carrega o Leaflet só quando o cartão aparece. */
function Mapa({ bairros }: { bairros: Bairro[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let vivo = true;
    let limpar = () => {};
    import("leaflet").then((mod) => {
      if (!vivo) return;
      const L = mod.default ?? mod;
      const mapa = L.map(el, { scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(mapa);
      const max = Math.max(...bairros.map((b) => b[2]));
      const grupo = L.featureGroup(
        [...bairros].sort((a, b) => b[2] - a[2]).map(([nome, cidade, n, lat, lng, aprox]) =>
          L.circleMarker([lat, lng], { radius: raioDaBolha(n, max), color: aprox ? "#6b7280" : "#c91d12", weight: 1.5, dashArray: aprox ? "4 3" : undefined, fillColor: aprox ? "#9ca3af" : "#e8281b", fillOpacity: aprox ? 0.3 : 0.45 })
            .bindTooltip(`<strong>${nome}</strong>${cidade ? ` · ${cidade}` : ""}<br/>${fmt(n)} ${n === 1 ? "aluno" : "alunos"}${aprox ? "<br/><em>posição aproximada (centro da cidade)</em>" : ""}`)),
      ).addTo(mapa);
      mapa.fitBounds(grupo.getBounds().pad(0.15), { maxZoom: 14 });
      limpar = () => mapa.remove();
    });
    return () => { vivo = false; limpar(); };
  }, [bairros]);
  return <div ref={ref} role="img" aria-label="Mapa com os bairros dos alunos ativos; o tamanho da bolha mostra quantos alunos" className="h-[360px] w-full overflow-hidden rounded-xl border border-border" />;
}

/** Onde moram os alunos ativos hoje: bolhas no mapa e ranking dos bairros. Só contagens por bairro; nenhum endereço de aluno é guardado. */
export function OndeMoramAlunos({ unit, bairros, semBairro }: { unit: string; bairros?: UnitData["bairros"]; semBairro?: number }) {
  const subtitle = <>{unit} • alunos ativos hoje</>;
  if (!bairros?.length) return <ChartCard title="Onde moram os alunos" subtitle={subtitle}><ChartEmpty>Ainda não há bairros carregados para esta unidade. A foto é atualizada todo dia junto com a sincronização do EVO.</ChartEmpty></ChartCard>;
  const total = bairros.reduce((s, b) => s + b[2], 0);
  const aprox = bairros.filter((b) => b[5]).reduce((s, b) => s + b[2], 0);
  const top = [...bairros].sort((a, b) => b[2] - a[2]).slice(0, 10);
  const max = top[0][2];
  return (
    <ChartCard title="Onde moram os alunos" subtitle={subtitle}>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Mapa bairros={bairros} />
        <ol className="space-y-2" aria-label="Bairros com mais alunos">
          {top.map(([nome, cidade, n]) => (
            <li key={`${nome}|${cidade}`} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-medium text-foreground">{nome}{cidade && <span className="font-normal text-muted-foreground"> · {cidade}</span>}</span>
                <span className="shrink-0 tabular-nums text-foreground">{fmt(n)} <span className="text-xs text-muted-foreground">({((n / total) * 100).toFixed(1).replace(".", ",")}%)</span></span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden><div className="h-full rounded-full bg-primary/70" style={{ width: `${(n / max) * 100}%` }} /></div>
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {fmt(total)} alunos em {fmt(bairros.length)} bairros localizados{semBairro ? `; ${fmt(semBairro)} sem endereço ou bairro não localizado ficam de fora` : ""}. A bolha fica no centro do bairro (OpenStreetMap), não na casa do aluno.{aprox > 0 && <> Bolhas cinza tracejadas ({fmt(aprox)} alunos) são bairros não encontrados no mapa, postos no centro da cidade.</>}
      </p>
    </ChartCard>
  );
}
