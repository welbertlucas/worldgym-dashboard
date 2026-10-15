import { useState } from "react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { SectionTitle } from "@/components/SectionTitle";
import { Notice } from "@/components/Notice";
import { Select } from "@/components/ui/select";
import { MetaCard, TIER_COLOR, TierBadge, TierBullet, TierChips, shownPct, tierName } from "@/components/metas/TierGauge";
import { GoalRing } from "@/components/metas/GoalRing";
import { type MonthData } from "@/data/dashboardData";
import {
  META_INDICATORS, TIER_LABEL, TIERS, actualFor, bulletScale, formatMetaValue, getMeta, isSingleGoal, metaWarnings, progressToNext, resolveGoal, tierReached,
  type Meta, type MetaKey, type TierResult,
} from "@/data/metas";
import { formatMonthLong, isPartialMonth } from "@/data/periods";
import { AXIS_TICK, GRID, TOOLTIP_STYLE } from "@/components/chartTheme";

const shortMonth = (m: string) => { const [y, mo] = m.split("-").map(Number); return new Date(y, mo - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }); };
const TIER_RANK: Record<TierResult, number> = { ouro: 3, prata: 2, bronze: 1, abaixo: 0 };

function EmptyState() {
  return (
    <div className="card-surface p-6 text-sm space-y-3">
      <p className="font-semibold">Nenhuma meta cadastrada ainda.</p>
      <p className="text-muted-foreground">
        Preencha a aba <b>Metas</b> da planilha: uma linha por unidade, mês e indicador, com os três níveis. Use a unidade <b>Rede</b> (ou <b>TOTAL</b>) para a meta da rede.
        Bronze é o nível mais fácil e ouro o mais difícil; para churn e inadimplência, em que menos é melhor, o ouro é o menor valor. Os níveis podem ficar em branco.
        O mês vai no formato <b>aaaa-mm</b> (por exemplo, 2026-10).
      </p>
      <div className="overflow-x-auto">
        <table className="text-xs border border-border">
          <thead><tr className="bg-secondary">{["Mês", "Unidade", "Indicador", "Bronze", "Prata", "Ouro"].map((h) => <th key={h} className="px-3 py-1.5 text-left border-r border-border">{h}</th>)}</tr></thead>
          <tbody>
            <tr><td className="px-3 py-1.5">2026-10</td><td className="px-3 py-1.5">Gama</td><td className="px-3 py-1.5">Faturamento</td><td className="px-3 py-1.5">R$ 380.000</td><td className="px-3 py-1.5">R$ 420.000</td><td className="px-3 py-1.5">R$ 460.000</td></tr>
            <tr><td className="px-3 py-1.5">2026-10</td><td className="px-3 py-1.5">Rede</td><td className="px-3 py-1.5">Churn</td><td className="px-3 py-1.5">8,0%</td><td className="px-3 py-1.5">6,5%</td><td className="px-3 py-1.5">5,0%</td></tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Indicadores aceitos: {Object.values(META_INDICATORS).map((i) => i.label).join(", ")}.</p>
    </div>
  );
}

export function MetasTab({ data, metas, month, unit = null }: { data: MonthData[]; metas: Meta[]; month: string; unit?: string | null }) {
  const keysWithMetas = (Object.keys(META_INDICATORS) as MetaKey[]).filter((k) => metas.some((m) => m.key === k));
  const [key, setKey] = useState<MetaKey | "">("");
  if (!metas.length) return <div><SectionTitle level="page">Metas</SectionTitle><EmptyState /></div>;

  // Mês exibido: o selecionado se tiver meta cadastrada; senão, o último mês com meta.
  const metaMonths = Array.from(new Set(metas.map((m) => m.month))).sort();
  const shownMonth = metaMonths.includes(month) ? month : metaMonths[metaMonths.length - 1];
  const md = data.find((d) => d.month === shownMonth);
  const partial = isPartialMonth(shownMonth);
  const warnings = metaWarnings(metas.filter((m) => m.month === shownMonth));

  // Rede: um cartão por indicador com meta da rede neste mês
  const redeCards = keysWithMetas.map((kk) => {
    const meta = getMeta(metas, shownMonth, "TOTAL", kk);
    const actual = md ? actualFor(md, "TOTAL", kk) : null;
    return meta && actual !== null ? { kk, meta, actual } : null;
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  // Unidades: indicador escolhido, ordenadas por nível atingido e progresso
  const keysThisMonth = keysWithMetas.filter((kk) => metas.some((m) => m.month === shownMonth && m.key === kk && m.unit !== "TOTAL"));
  const k = (key && keysThisMonth.includes(key) ? key : keysThisMonth[0]) as MetaKey | undefined;
  const unitRows = !k || !md ? [] : md.units.map((u) => {
    const meta = getMeta(metas, shownMonth, u.name, k);
    if (!meta) return null;
    const actual = u[k];
    const tier = tierReached(k, actual, meta);
    const prog = progressToNext(k, actual, meta);
    return { name: u.name, meta, actual, tier, pct: prog.pct, done: prog.next === null, scale: bulletScale(k, actual, meta) };
  }).filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier] || b.pct - a.pct);

  // Rosca: unidade selecionada no filtro do topo (ou a rede), no indicador escolhido
  const ringKeys = md ? keysWithMetas.filter((kk) => resolveGoal(metas, md, shownMonth, unit, kk)) : [];
  const rk = (key && ringKeys.includes(key) ? key : ringKeys[0]) as MetaKey | undefined;
  const ring = md && rk ? resolveGoal(metas, md, shownMonth, unit, rk) : null;
  const ringName = unit ?? "Rede";

  // Histórico (rede) do indicador escolhido: realizado × níveis de meta
  const evoKey = k ?? keysWithMetas[0];
  const evolution = data.slice(-12).map((d) => {
    const meta = getMeta(metas, d.month, "TOTAL", evoKey);
    return {
      month: shortMonth(d.month) + (isPartialMonth(d.month) ? " (parc.)" : ""),
      realizado: actualFor(d, "TOTAL", evoKey),
      bronze: meta?.bronze ?? null, prata: meta?.prata ?? null, ouro: meta?.ouro ?? null,
    };
  });
  const hasHistory = evolution.some((e) => e.bronze !== null || e.prata !== null || e.ouro !== null);

  return (
    <div className="space-y-8 sm:space-y-10">
      <div>
        <SectionTitle level="page" hint={`Acompanhamento de ${formatMonthLong(shownMonth)}${shownMonth !== month ? " (último mês com meta)" : ""}`}>Metas</SectionTitle>
        {partial && (
          <Notice>
            <b>Mês em andamento:</b> o realizado é parcial e se atualiza sozinho a cada 5 minutos enquanto esta tela estiver aberta. O percentual mostra quanto já foi alcançado de cada meta; o resultado só fica definitivo quando o mês fechar.
          </Notice>
        )}
        {warnings.length > 0 && (
          <Notice icon="alert" className="mt-3">
            <b>Confira o cadastro na planilha:</b>
            <ul className="list-disc pl-5">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </Notice>
        )}
      </div>

      <section aria-labelledby="metas-anel">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
          <h3 id="metas-anel" className="text-base font-semibold text-foreground">Atingimento • {ringName}</h3>
          {ringKeys.length > 1 && (
            <div className="flex flex-col gap-1">
              <label htmlFor="metas-anel-indicador" className="text-xs font-medium text-muted-foreground">Indicador</label>
              <Select id="metas-anel-indicador" value={rk} onChange={(e) => setKey(e.target.value as MetaKey)} className="w-52">
                {ringKeys.map((x) => <option key={x} value={x}>{META_INDICATORS[x].label}</option>)}
              </Select>
            </div>
          )}
        </div>
        {ring && rk ? (
          <GoalRing
            metaKey={rk}
            actual={ring.actual}
            meta={ring.meta}
            partial={partial}
            title={META_INDICATORS[rk].label}
            subtitle={`${ringName} • ${formatMonthLong(shownMonth)}${partial ? " • parcial do mês em andamento" : ""}${ring.units ? ` • soma das ${ring.units} ${ring.units === 1 ? "unidade" : "unidades"} com meta (realizado e metas só dela${ring.units === 1 ? "" : "s"})` : ""}`}
          />
        ) : (
          <p className="card-surface px-5 py-8 text-center text-sm text-muted-foreground">
            {ringName === "Rede" ? "A rede não tem meta cadastrada neste mês." : `${ringName} não tem meta cadastrada em ${formatMonthLong(shownMonth)}.`} Preencha a aba Metas da planilha.
          </p>
        )}
      </section>

      {redeCards.length > 0 && (
        <section aria-labelledby="metas-rede">
          <h3 id="metas-rede" className="text-base font-semibold text-foreground mb-3">Rede</h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {redeCards.map((c) => <MetaCard key={c.kk} metaKey={c.kk} actual={c.actual} meta={c.meta} partial={partial} />)}
          </div>
        </section>
      )}

      {k && (
        <section aria-labelledby="metas-unidades">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
            <div>
              <h3 id="metas-unidades" className="text-base font-semibold text-foreground">Unidades</h3>
              <p className="text-sm text-muted-foreground">
                {unitRows.length} {unitRows.length === 1 ? "unidade com meta" : "unidades com meta"} de {META_INDICATORS[k].label.toLowerCase()}
                {META_INDICATORS[k].lowerIsBetter && " • menor é melhor"}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="metas-indicador" className="text-xs font-medium text-muted-foreground">Indicador</label>
              <Select id="metas-indicador" value={k} onChange={(e) => setKey(e.target.value as MetaKey)} className="w-52">
                {keysThisMonth.map((x) => <option key={x} value={x}>{META_INDICATORS[x].label}</option>)}
              </Select>
            </div>
          </div>
          <ol className="card-surface divide-y divide-border">
            {unitRows.map((r) => (
              <li key={r.name} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[11rem_minmax(0,1fr)_13.5rem] items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">{formatMetaValue(k, r.actual)}</p>
                </div>
                <div className="sm:order-3 flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums w-10 shrink-0 text-right">{shownPct(r.pct, r.done)}%</span>
                  <span className="w-[10.5rem] flex justify-start"><TierBadge tier={r.tier} partial={partial} single={isSingleGoal(r.meta)} /></span>
                </div>
                <div className="col-span-2 sm:col-span-1 sm:order-2">{r.scale && <TierBullet scale={r.scale} thin />}</div>
                <div className="col-span-2 sm:order-4 sm:col-span-3"><TierChips metaKey={k} actual={r.actual} meta={r.meta} /></div>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-muted-foreground">
            A porcentagem é o quanto já foi alcançado do próximo nível. A barra mostra as faixas Bronze, Prata e Ouro; o traço escuro é o realizado.
          </p>
        </section>
      )}

      {hasHistory && (
        <section aria-labelledby="metas-hist" className="card-surface p-5">
          <h3 id="metas-hist" className="text-sm font-semibold text-foreground">Histórico da rede — {META_INDICATORS[evoKey].label}</h3>
          <p className="text-xs text-muted-foreground mb-4">Realizado mês a mês e os níveis de meta cadastrados da rede.</p>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={evolution} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} tickMargin={8} minTickGap={16} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={64} tickFormatter={(v) => (META_INDICATORS[evoKey].format === "currency" ? new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(v) : String(v))} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [formatMetaValue(evoKey, v), n]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="realizado" name="Realizado" fill="hsl(4 90% 50%)" radius={[4, 4, 0, 0]} maxBarSize={16} />
              {TIERS.map((t) => <Line key={t} dataKey={t} name={TIER_LABEL[t]} stroke={TIER_COLOR[t]} strokeWidth={2} strokeDasharray={t === "ouro" ? undefined : "5 3"} dot={{ r: 2 }} connectNulls />)}
            </ComposedChart>
          </ResponsiveContainer>
        </section>
      )}
    </div>
  );
}
