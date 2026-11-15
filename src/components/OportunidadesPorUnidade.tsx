import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { UnitLink } from "@/components/UnitLink";
import type { UnitData } from "@/data/dashboardData";
import { origensOrdenadas } from "@/components/OrigemOportunidades";

const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1).replace(".", ",")}%` : "—");

/** Cada unidade: oportunidades cadastradas, quanto converteu, o tempo médio até converter e a origem que mais trouxe gente. */
export function OportunidadesPorUnidade({ units, monthLabel, partial }: { units: UnitData[]; monthLabel: string; partial: boolean }) {
  const subtitle = <>Rede • {monthLabel}{partial && " (mês em andamento: valores parciais)"}</>;
  const linhas = units.filter((u) => (u.oportunidades ?? 0) > 0).map((u) => {
    const o = u.origens ? origensOrdenadas(u.origens).find(([n]) => n !== "Sem origem" && n !== "Demais origens") : undefined;
    const t = u.tempoConversao;
    return { nome: u.name, cad: u.oportunidades ?? 0, conv: u.conversoes ?? 0, tempo: t && t.n > 0 ? t.soma / t.n : null, origem: o?.[0] ?? "—" };
  }).sort((a, b) => b.cad - a.cad);
  if (linhas.length === 0) return <ChartCard title="Oportunidades por unidade" subtitle={subtitle}><ChartEmpty>Sem oportunidades do EVO neste mês.</ChartEmpty></ChartCard>;
  return (
    <ChartCard title="Oportunidades por unidade" subtitle={subtitle}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-medium">Unidade</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Cadastradas</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Convertidas</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Conversão</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Tempo médio</th>
              <th scope="col" className="py-2 pl-3 font-medium">Origem principal</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.nome} className="border-t border-border">
                <th scope="row" className="py-2 pr-3 text-left font-medium text-foreground"><UnitLink name={l.nome} /></th>
                <td className="px-2 py-2 text-right tabular-nums">{l.cad.toLocaleString("pt-BR")}</td>
                <td className="px-2 py-2 text-right tabular-nums">{l.conv.toLocaleString("pt-BR")}</td>
                <td className="px-2 py-2 text-right font-semibold tabular-nums">{pct(l.conv, l.cad)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{l.tempo === null ? "—" : `${l.tempo.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} d`}</td>
                <td className="py-2 pl-3 text-foreground">{l.origem}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Ordenado pelas oportunidades cadastradas. "Conversão" = viraram cliente no próprio mês do cadastro. "Origem principal" ignora os cadastros sem origem. Clique no nome para ver a posição da unidade na rede.</p>
    </ChartCard>
  );
}
