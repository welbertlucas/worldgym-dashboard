import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import type { UnitData } from "@/data/dashboardData";

const TOP = 5;
const moeda = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");
export const DURACOES = ["Mensal", "Trimestral", "Semestral", "Anual", "Outras"];
const CORES_DURACAO = ["bg-foreground/80", "bg-foreground/55", "bg-foreground/35", "bg-primary", "bg-foreground/15"];

/** Barra única dividida em partes (participação de cada uma no todo), com legenda embaixo. */
function BarraPartes({ partes, rotulo }: { partes: { nome: string; n: number; cor: string }[]; rotulo: string }) {
  const total = partes.reduce((s, p) => s + p.n, 0);
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-secondary" role="img" aria-label={`${rotulo}: ${partes.map((p) => `${p.nome} ${pct(p.n, total)}`).join(", ")}`}>
        {partes.map((p) => p.n > 0 && <div key={p.nome} className={p.cor} style={{ width: `${(p.n / total) * 100}%` }} />)}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {partes.map((p) => (
          <li key={p.nome} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${p.cor}`} aria-hidden />
            {p.nome} <span className="font-semibold tabular-nums text-foreground">{pct(p.n, total)}</span>
            <span className="tabular-nums">({p.n.toLocaleString("pt-BR")})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Os planos mais vendidos do mês (a alunos novos e a quem voltou), o tipo da venda e a duração dos planos vendidos. */
export function ContratosVendidos({ total, monthLabel, partial, unitLabel }: { total: UnitData; monthLabel: string; partial: boolean; unitLabel: string }) {
  const subtitle = <>{unitLabel} • {monthLabel}{partial && " (mês em andamento: valores parciais)"}</>;
  const lista = total.contratosVendidos;
  const tv = total.tipoVenda;
  const vendas = tv ? tv.novo[0] + tv.remat[0] : 0;
  if (!lista || !tv || vendas === 0) return <ChartCard title="Contratos mais vendidos" subtitle={subtitle}><ChartEmpty>Sem vendas de planos do EVO neste mês.</ChartEmpty></ChartCard>;
  const valor = tv.novo[1] + tv.remat[1];
  const top = lista.slice(0, TOP);
  const maior = top[0]?.[1] ?? 1;
  const dur = total.duracaoVenda ?? [0, 0, 0, 0, 0];
  return (
    <ChartCard
      title="Contratos mais vendidos"
      subtitle={subtitle}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label="Planos vendidos (novos + rematrículas)" value={vendas.toLocaleString("pt-BR")} swatch={<span className="h-2 w-2 rounded-full bg-foreground" />} />
          <HeadlineStat label="Valor médio por venda" value={moeda(valor / vendas)} swatch={<span className="h-2 w-2 rounded-full bg-foreground/50" />} />
          <HeadlineStat label={`Os ${top.length} primeiros somam`} value={pct(top.reduce((s, r) => s + r[1], 0), vendas)} swatch={<span className="h-2 w-2 rounded-full bg-primary" />} />
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <ol className="space-y-3" aria-label={`Os ${top.length} planos mais vendidos`}>
          {top.map(([nome, q, v], k) => (
            <li key={nome} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
              <span className="text-sm font-semibold tabular-nums text-muted-foreground">{k + 1}º</span>
              <span className="truncate text-sm text-foreground" title={nome}>{nome}</span>
              <span className="text-sm font-semibold tabular-nums text-foreground">{q.toLocaleString("pt-BR")} <span className="font-normal text-muted-foreground">· {pct(q, vendas)} · média {moeda(v / q)}</span></span>
              <div className="col-span-2 col-start-2 h-2 rounded-full bg-secondary" aria-hidden>
                <div className={k === 0 ? "h-full rounded-full bg-primary" : "h-full rounded-full bg-foreground/70"} style={{ width: `${Math.max((q / maior) * 100, 1.5)}%` }} />
              </div>
            </li>
          ))}
        </ol>
        <div className="space-y-6">
          <div>
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Quem comprou</h4>
            <BarraPartes rotulo="Tipo de venda" partes={[
              { nome: "Aluno novo", n: tv.novo[0], cor: "bg-foreground/80" },
              { nome: "Rematrícula", n: tv.remat[0], cor: "bg-primary" },
            ]} />
          </div>
          <div>
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Duração do plano</h4>
            <BarraPartes rotulo="Duração dos planos vendidos" partes={DURACOES.map((nome, k) => ({ nome, n: dur[k] ?? 0, cor: CORES_DURACAO[k] }))} />
          </div>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Planos vendidos no mês a alunos novos e a ex-alunos que voltaram (rematrícula), pelo nome do plano no EVO; diárias, brinquedoteca e personal ficam de fora.
        Renovações não entram no ranking porque são, na maior parte, a recorrência automática do mês ({tv.renov[0].toLocaleString("pt-BR")} no mês).
        Valor médio = valor da venda (num plano anual pago à vista, é o ano inteiro).
      </p>
    </ChartCard>
  );
}

/** Produtos e serviços avulsos que mais faturaram no mês (camisetas, coqueteleiras, diárias, avaliações...). */
export function ProdutosVendidos({ total, monthLabel, partial, unitLabel }: { total: UnitData; monthLabel: string; partial: boolean; unitLabel: string }) {
  const subtitle = <>{unitLabel} • {monthLabel}{partial && " (mês em andamento: valores parciais)"}</>;
  const lista = (total.produtosVendidos ?? []).slice(0, 8);
  if (!lista.length) return <ChartCard title="Produtos e serviços mais vendidos" subtitle={subtitle}><ChartEmpty>Sem vendas avulsas do EVO neste mês.</ChartEmpty></ChartCard>;
  const maior = lista[0][2] || 1;
  return (
    <ChartCard title="Produtos e serviços mais vendidos" subtitle={subtitle}>
      <ol className="space-y-3" aria-label="Produtos e serviços que mais faturaram">
        {lista.map(([nome, q, v], k) => (
          <li key={nome} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold tabular-nums text-muted-foreground">{k + 1}º</span>
            <span className="truncate text-sm text-foreground" title={nome}>{nome}</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">{moeda(v)} <span className="font-normal text-muted-foreground">· {q.toLocaleString("pt-BR")} un.</span></span>
            <div className="col-span-2 col-start-2 h-2 rounded-full bg-secondary" aria-hidden>
              <div className="h-full rounded-full bg-foreground/70" style={{ width: `${Math.max((v / maior) * 100, 1.5)}%` }} />
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-muted-foreground">Itens vendidos fora de contrato, pelo nome no EVO (cada unidade nomeia do seu jeito), ordenados pelo valor vendido no mês.</p>
    </ChartCard>
  );
}
