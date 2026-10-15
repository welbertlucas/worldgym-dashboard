import { KpiGaugeCard, TILE_FRAME } from "@/components/executiva/KpiGaugeCard";
import { MetricCard } from "@/components/MetricCard";
import { shownPct } from "@/components/metas/TierGauge";
import { TIER_LABEL, type TierResult } from "@/data/metas";
import { Target } from "lucide-react";

export interface RedeGoal { tier: TierResult; /** progresso 0–100 rumo ao próximo nível */ pct: number; done: boolean; single: boolean }

interface Props { goals: RedeGoal[]; partial: boolean; onOpen: () => void }

/** Metas da rede em meia-lua: progresso (médio, se houver mais de uma meta) rumo ao próximo nível, quantas metas já foram atingidas. */
export function MetasKpiCard({ goals, partial, onOpen }: Props) {
  if (!goals.length) {
    return (
      <MetricCard bare className={TILE_FRAME} title="Metas da rede" value="—" icon={Target} variant="default"
        empty={{ message: "Sem metas da rede cadastradas para este mês", hint: "Preencha a aba Metas da planilha para acompanhar as metas da rede." }} />
    );
  }
  const n = goals.length;
  const reached = goals.filter((g) => g.tier !== "abaixo").length;
  const allDone = goals.every((g) => g.done);
  const avg = goals.reduce((s, g) => s + g.pct, 0) / n;
  const shown = shownPct(avg, allDone);
  const tone = partial ? "neutral" : reached === n ? "good" : (n - reached) * 2 >= n ? "bad" : "warn";
  const tiers = goals.some((g) => !g.single)
    ? (["ouro", "prata", "bronze"] as const).map((t) => `${TIER_LABEL[t]} ${goals.filter((g) => g.tier === t && !g.single).length}`).join(" • ")
    : null;
  const details = [
    { text: `${reached} de ${n} ${n === 1 ? "meta atingida" : "metas atingidas"}`, tone: "neutral" as const },
    ...(n > 1 ? [{ text: "progresso médio das metas", tone: "neutral" as const }] : []),
    ...(tiers ? [{ text: tiers, tone: "neutral" as const }] : []),
  ];
  return (
    <KpiGaugeCard
      title="Metas da rede" value={`${shown}%`} fill={shown / 100} marker={null} tone={tone} partial={partial} details={details}
      footer={<button type="button" onClick={onOpen} className="rounded-lg text-sm font-semibold text-primary-ink underline underline-offset-4 hover:text-primary-ink/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Ver metas</button>}
    />
  );
}
