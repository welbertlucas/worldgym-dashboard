import { useState } from "react";
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from "recharts";
import { SectionTitle } from "@/components/SectionTitle";
import { Select } from "@/components/ui/select";
import { type MonthData } from "@/data/dashboardData";
import {
  META_INDICATORS, TIER_LABEL, TIERS, actualFor, attainment, formatMetaValue, getMeta, highestTier, metaWarnings, nextTier, tierReached,
  type Meta, type MetaKey, type TierResult,
} from "@/data/metas";
import { formatMonthLong } from "@/data/periods";
import { Notice } from "@/components/Notice";
import { AXIS_TICK, GRID, TOOLTIP_STYLE } from "@/components/chartTheme";

const axis = AXIS_TICK;
const tip = TOOLTIP_STYLE;
const TIER_COLOR: Record<TierResult, string> = {
  ouro: "hsl(43 90% 48%)", prata: "hsl(220 9% 60%)", bronze: "hsl(25 60% 45%)", abaixo: "hsl(0 72% 51%)",
};
const shortMonth = (m: string) => { const [y, mo] = m.split("-").map(Number); return new Date(y, mo - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }); };

function TierBadge({ tier }: { tier: TierResult }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold">
      <span className="h-2 w-2 rounded-full" style={{ background: TIER_COLOR[tier] }} aria-hidden />
      {TIER_LABEL[tier]}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="card-surface p-6 text-sm space-y-3">
      <p className="font-semibold">Nenhuma meta cadastrada ainda.</p>
      <p className="text-muted-foreground">
        Preencha a aba <b>Metas</b> da planilha: uma linha por unidade, mês e indicador, com os três níveis. Use a unidade <b>Rede</b> (ou <b>TOTAL</b>) para a meta da rede.
        Bronze é o nível mais fácil e ouro o mais difícil; para churn e inadimplência, em que menos é melhor, o ouro é o menor valor. Os níveis podem ficar em branco.
      </p>
      <table className="text-xs border border-border">
        <thead><tr className="bg-secondary">{["Mês", "Unidade", "Indicador", "Bronze", "Prata", "Ouro"].map((h) => <th key={h} className="px-3 py-1.5 text-left border-r border-border">{h}</th>)}</tr></thead>
        <tbody>
          <tr><td className="px-3 py-1.5">2026-10</td><td className="px-3 py-1.5">Gama</td><td className="px-3 py-1.5">Faturamento</td><td className="px-3 py-1.5">R$ 380.000</td><td className="px-3 py-1.5">R$ 420.000</td><td className="px-3 py-1.5">R$ 460.000</td></tr>
          <tr><td className="px-3 py-1.5">2026-10</td><td className="px-3 py-1.5">Rede</td><td className="px-3 py-1.5">Churn</td><td className="px-3 py-1.5">8,0%</td><td className="px-3 py-1.5">6,5%</td><td className="px-3 py-1.5">5,0%</td></tr>
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">Indicadores aceitos: {Object.values(META_INDICATORS).map((i) => i.label).join(", ")}. Mês no formato aaaa-mm.</p>
    </div>
  );
}

export function MetasTab({ data, metas, month }: { data: MonthData[]; metas: Meta[]; month: string }) {
  const keysWithMetas = (Object.keys(META_INDICATORS) as MetaKey[]).filter((k) => metas.some((m) => m.key === k));
  const [key, setKey] = useState<MetaKey | "">("");
  if (!metas.length) return <div><SectionTitle>Metas</SectionTitle><EmptyState /></div>;

  const k = (key && keysWithMetas.includes(key) ? key : keysWithMetas[0]) as MetaKey;
  const info = META_INDICATORS[k];
  const metaMonths = Array.from(new Set(metas.filter((m) => m.key === k).map((m) => m.month))).sort();
  const shownMonth = metaMonths.includes(month) ? month : metaMonths[metaMonths.length - 1];
  const md = data.find((d) => d.month === shownMonth);
  const warnings = metaWarnings(metas.filter((m) => m.month === shownMonth));

  // Rede: todos os indicadores com meta no mês
  const summary = keysWithMetas.map((kk) => {
    const meta = getMeta(metas, shownMonth, "TOTAL", kk);
    const actual = md ? actualFor(md, "TOTAL", kk) : null;
    return meta && actual !== null ? { kk, meta, actual, tier: tierReached(kk, actual, meta), next: nextTier(kk, actual, meta) } : null;
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  // Evolução mensal (rede): realizado × níveis
  const evolution = data.slice(-12).map((d) => {
    const meta = getMeta(metas, d.month, "TOTAL", k);
    return { month: shortMonth(d.month), realizado: actualFor(d, "TOTAL", k), bronze: meta?.bronze ?? null, prata: meta?.prata ?? null, ouro: meta?.ouro ?? null };
  });

  // Comparação entre unidades: realizado como % do nível mais alto cadastrado
  const byUnit = (md?.units ?? []).map((u) => {
    const meta = getMeta(metas, shownMonth, u.name, k);
    const top = meta && highestTier(meta);
    if (!meta || !top) return null;
    const progress = attainment(k, u[k], top.value);
    return progress === null ? null : { unit: u.name, progress: Number(progress.toFixed(1)), tier: tierReached(k, u[k], meta), realizado: u[k], meta, top };
  }).filter((x): x is NonNullable<typeof x> => x !== null).sort((a, b) => b.progress - a.progress);

  return (
    <div className="space-y-6">
      <SectionTitle hint="Nível atingido em cada indicador: bronze, prata ou ouro.">Metas</SectionTitle>
      <div className="flex flex-wrap items-center gap-3">
        <Select value={k} onChange={(e) => setKey(e.target.value as MetaKey)} className="w-52">
          {keysWithMetas.map((x) => <option key={x} value={x}>{META_INDICATORS[x].label}</option>)}
        </Select>
        <span className="text-sm text-muted-foreground">Mês: <b>{formatMonthLong(shownMonth)}</b>{shownMonth !== month && " (último mês com meta)"}{info.lowerIsBetter && " • menor é melhor"}</span>
      </div>

      {warnings.length > 0 && (
        <Notice icon="alert">
          <b>Confira o cadastro na planilha:</b>
          <ul className="list-disc pl-5">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </Notice>
      )}

      {summary.length > 0 && (
        <div className="card-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-xs font-medium text-muted-foreground border-b border-border">
              <th className="text-left px-4 py-2">Rede</th>
              {TIERS.map((t) => <th key={t} className="text-right px-4 py-2">{TIER_LABEL[t]}</th>)}
              <th className="text-right px-4 py-2">Realizado</th><th className="text-left px-4 py-2">Nível</th><th className="text-left px-4 py-2">Próximo nível</th>
            </tr></thead>
            <tbody>{summary.map((r) => (
              <tr key={r.kk} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-2 font-medium">{META_INDICATORS[r.kk].label}</td>
                {TIERS.map((t) => <td key={t} className="px-4 py-2 text-right text-muted-foreground">{r.meta[t] === undefined ? "—" : formatMetaValue(r.kk, r.meta[t]!)}</td>)}
                <td className="px-4 py-2 text-right font-semibold">{formatMetaValue(r.kk, r.actual)}</td>
                <td className="px-4 py-2"><TierBadge tier={r.tier} /></td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{r.next ? `faltam ${formatMetaValue(r.kk, r.next.gap)} para o ${TIER_LABEL[r.next.tier].toLowerCase()}` : "todos os níveis atingidos"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <div className="card-surface p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Realizado × níveis de meta — {info.label} (rede)</h3>
        <p className="text-xs text-muted-foreground mb-4">Evolução mensal; as linhas mostram bronze, prata e ouro de cada mês.</p>
        <ResponsiveContainer width="100%" height={270}>
          <ComposedChart data={evolution} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="month" tick={axis} />
            <YAxis tick={axis} width={70} tickFormatter={(v) => (info.format === "currency" ? new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(v) : String(v))} />
            <Tooltip contentStyle={tip} formatter={(v: number, n: string) => [formatMetaValue(k, v), n]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="realizado" name="Realizado" fill="hsl(4 90% 50%)" radius={[3, 3, 0, 0]} />
            {TIERS.map((t) => <Line key={t} dataKey={t} name={TIER_LABEL[t]} stroke={TIER_COLOR[t]} strokeWidth={2} strokeDasharray={t === "ouro" ? undefined : "5 3"} dot={{ r: 2 }} connectNulls />)}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="card-surface p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Comparação entre unidades — {info.label}</h3>
        <p className="text-xs text-muted-foreground mb-4">Barra = realizado como % do nível mais alto cadastrado. A cor é o nível atingido.</p>
        <div className="flex flex-wrap gap-3 mb-3 text-xs">{(["ouro", "prata", "bronze", "abaixo"] as TierResult[]).map((t) => <TierBadge key={t} tier={t} />)}</div>
        {byUnit.length ? (
          <ResponsiveContainer width="100%" height={Math.max(220, byUnit.length * 26)}>
            <BarChart data={byUnit} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis type="number" tick={axis} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="unit" width={120} tick={axis} interval={0} />
              <Tooltip contentStyle={tip} formatter={(v: number, _n, p) => [`${v}% do ${TIER_LABEL[p.payload.top.tier as TierResult].toLowerCase()} — realizado ${formatMetaValue(k, p.payload.realizado)} • nível: ${TIER_LABEL[p.payload.tier as TierResult]}`, "Progresso"]} />
              <Bar dataKey="progress" radius={[0, 3, 3, 0]}>{byUnit.map((u) => <Cell key={u.unit} fill={TIER_COLOR[u.tier]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="text-sm text-muted-foreground">Nenhuma meta por unidade para este indicador/mês.</p>}
      </div>
    </div>
  );
}
