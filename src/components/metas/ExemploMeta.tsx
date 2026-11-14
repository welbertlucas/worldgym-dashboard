import { TIER_COLOR } from "@/components/metas/TierGauge";
import { TIER_LABEL, formatMetaValue, type Tier } from "@/data/metas";

/** Valores só para explicar a estrutura da meta: não vêm da planilha e não são de nenhuma unidade. */
const NIVEIS: { tier: Tier; ordem: string; faturamento: number; pct: number }[] = [
  { tier: "bronze", ordem: "1º nível", faturamento: 380000, pct: 0.33 },
  { tier: "prata", ordem: "2º nível", faturamento: 420000, pct: 0.41 },
  { tier: "ouro", ordem: "Maior nível", faturamento: 460000, pct: 0.58 },
];

const pctBR = (p: number) => `${p.toFixed(2).replace(".", ",")}%`;

/** Explica, sem dados reais, como a meta mensal é montada: três níveis de faturamento, cada um com seu percentual de premiação. */
export function ExemploMeta() {
  return (
    <section aria-labelledby="metas-exemplo" className="rounded-2xl border border-dashed border-border p-5 space-y-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id="metas-exemplo" className="text-base font-semibold text-foreground">Como funciona a meta</h3>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Exemplo</span>
        </div>
        <p className="text-sm text-muted-foreground">
          A meta do mês tem três níveis de faturamento. Quanto mais alto o nível alcançado, maior o percentual de premiação.
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {NIVEIS.map((n) => (
          <li key={n.tier} className="rounded-xl bg-secondary/50 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: TIER_COLOR[n.tier] }} aria-hidden />
              {TIER_LABEL[n.tier]}
              <span className="text-xs font-normal text-muted-foreground">{n.ordem}</span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Faturamento do mês</p>
            <p className="text-lg font-bold tabular-nums text-foreground">{formatMetaValue("faturamento", n.faturamento)}</p>
            <p className="mt-2 text-xs text-muted-foreground">Premiação</p>
            <p className="text-sm tabular-nums text-foreground">
              {pctBR(n.pct)} → <span className="font-semibold">{formatMetaValue("faturamento", Math.round((n.faturamento * n.pct) / 100))}</span>
            </p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        A premiação é o percentual do nível sobre o faturamento atingido: no exemplo, fechar o mês com {formatMetaValue("faturamento", NIVEIS[0].faturamento)} dá Bronze e {pctBR(NIVEIS[0].pct)} desse valor.
      </p>
      <p className="text-xs font-semibold text-foreground">
        Exemplo ilustrativo. Os valores apresentados não representam a meta desta unidade.
      </p>
    </section>
  );
}
