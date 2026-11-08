import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import { CORTESIAS, type UnitData } from "@/data/dashboardData";
import { MiniRosca } from "@/components/MiniRosca";

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

const TIPOS_DA_ROSCA: { nome: string; cor: string }[] = [
  { nome: "WG Local", cor: "hsl(var(--primary))" },
  { nome: "WG Rede", cor: "hsl(222 25% 25%)" },
  { nome: "WG 30", cor: "hsl(222 14% 55%)" },
  { nome: "Aquática", cor: "hsl(200 70% 45%)" },
];

/**
 * Fatias da rosca de planos por tipo: WG Local, WG Rede, WG 30 e Aquática; todo o resto dos planos vendidos (cortesias,
 * promoções, parcerias e planos sem tipo) vira "Outros", para a rosca fechar 100% do total.
 */
export function fatiasPorTipo(familias: [string, number, number][], vendas: number, valor: number) {
  const principais = TIPOS_DA_ROSCA.map((t) => {
    const r = familias.find(([n]) => n === t.nome);
    return { rotulo: t.nome, n: r?.[1] ?? 0, v: r?.[2] ?? 0, cor: t.cor };
  }).filter((f) => f.n > 0).sort((a, b) => b.n - a.n);
  const n = vendas - principais.reduce((s, f) => s + f.n, 0);
  const v = valor - principais.reduce((s, f) => s + f.v, 0);
  return n > 0 ? [...principais, { rotulo: "Outros", n, v: Math.max(0, v), cor: "hsl(var(--foreground) / 0.18)" }] : principais;
}

/**
 * Os planos mais vendidos do mês (a alunos novos e a quem voltou), o tipo da venda e a duração dos planos vendidos.
 * Na rede (porFamilia), agrupa pelo tipo do plano, porque cada unidade dá nome próprio aos seus planos.
 */
export function ContratosVendidos({ total, monthLabel, partial, unitLabel, porFamilia = false }: { total: UnitData; monthLabel: string; partial: boolean; unitLabel: string; porFamilia?: boolean }) {
  const subtitle = <>{unitLabel} • {monthLabel}{partial && " (mês em andamento: valores parciais)"}</>;
  // Cortesias e promoções contam no total de planos vendidos, mas ficam fora da lista por tipo.
  const visiveis = total.familiasVendidas?.filter(([n]) => n !== CORTESIAS);
  const familias = porFamilia && visiveis?.length ? visiveis : null;
  const lista = familias ?? total.contratosVendidos;
  const tv = total.tipoVenda;
  const vendas = tv ? tv.novo[0] + tv.remat[0] : 0;
  if (!lista || !tv || vendas === 0) return <ChartCard title="Contratos mais vendidos" subtitle={subtitle}><ChartEmpty>Sem vendas de planos do EVO neste mês.</ChartEmpty></ChartCard>;
  const valor = tv.novo[1] + tv.remat[1];
  const top = familias ? familias.slice(0, 8) : lista.slice(0, TOP);
  const maior = top[0]?.[1] ?? 1;
  const dur = total.duracaoVenda ?? [0, 0, 0, 0, 0];
  const fatias = familias ? fatiasPorTipo(familias, vendas, valor) : null;
  const lider = fatias ? fatias.filter((f) => f.rotulo !== "Outros").sort((a, b) => b.n - a.n)[0] : null;
  return (
    <ChartCard
      title={familias ? "Planos mais vendidos por tipo" : "Contratos mais vendidos"}
      subtitle={subtitle}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label="Planos vendidos (novos + rematrículas)" value={vendas.toLocaleString("pt-BR")} swatch={<span className="h-2 w-2 rounded-full bg-foreground" />} />
          <HeadlineStat label="Valor médio por venda" value={moeda(valor / vendas)} swatch={<span className="h-2 w-2 rounded-full bg-foreground/50" />} />
          <HeadlineStat label={lider ? `${lider.rotulo} responde por` : `Os ${top.length} primeiros somam`} value={pct(lider ? lider.n : top.reduce((s, r) => s + r[1], 0), vendas)} swatch={<span className="h-2 w-2 rounded-full bg-primary" />} />
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {fatias ? (
          <div className="self-center">
            <MiniRosca
              rotulo="Planos vendidos por tipo"
              tamanho="h-40 w-40"
              centro={{ valor: vendas.toLocaleString("pt-BR"), legenda: "planos vendidos" }}
              fatias={fatias.map((f) => ({ rotulo: f.rotulo, n: f.n, cor: f.cor, detalhe: f.n > 0 ? <>média {moeda(f.v / f.n)}</> : undefined }))}
            />
          </div>
        ) : (
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
        )}
        <div className="space-y-6">
          <div>
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Quem comprou</h4>
            <MiniRosca rotulo="Tipo de venda" tamanho="h-24 w-24" fatias={[
              { rotulo: "Aluno novo", n: tv.novo[0], cor: "hsl(var(--foreground) / 0.8)" },
              { rotulo: "Rematrícula", n: tv.remat[0], cor: "hsl(var(--primary))" },
            ]} />
          </div>
          <div>
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Duração do plano</h4>
            <BarraPartes rotulo="Duração dos planos vendidos" partes={DURACOES.map((nome, k) => ({ nome, n: dur[k] ?? 0, cor: CORES_DURACAO[k] }))} />
          </div>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        {familias
          ? <>Planos vendidos no mês a alunos novos e a ex-alunos que voltaram (rematrícula), agrupados pelo tipo do plano, porque cada unidade dá nome próprio aos seus planos no EVO; planos com Rede, PRO, Fit ou Anual no nome contam como WG Rede (Anual VIP e Anual Local não); WG 90 conta como WG 30; "Outros" junta free pass, experimental, promoção de 1º mês, parcerias, militares e planos sem tipo. Escolha uma unidade no filtro para ver os planos pelo nome. Diárias, brinquedoteca e personal ficam de fora.</>
          : <>Planos vendidos no mês a alunos novos e a ex-alunos que voltaram (rematrícula), pelo nome do plano no EVO; diárias, brinquedoteca e personal ficam de fora.</>}
        {" "}Renovações não entram no ranking porque são, na maior parte, a recorrência automática do mês ({tv.renov[0].toLocaleString("pt-BR")} no mês).
        Valor médio = valor da venda (num plano anual pago à vista, é o ano inteiro).
      </p>
    </ChartCard>
  );
}

type Linha = [string, number, number];

/** Lista numerada por valor, com barra proporcional ao primeiro. */
function RankingPorValor({ lista, rotulo }: { lista: Linha[]; rotulo: string }) {
  const maior = lista[0][2] || 1;
  return (
    <ol className="space-y-3" aria-label={rotulo}>
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
  );
}

/** Produtos e serviços avulsos que mais faturaram no mês (diárias, coqueteleiras, bebidas, avaliações...). */
export function ProdutosVendidos({ total, monthLabel, partial, unitLabel }: { total: UnitData; monthLabel: string; partial: boolean; unitLabel: string }) {
  const subtitle = <>{unitLabel} • {monthLabel}{partial && " (mês em andamento: valores parciais)"}</>;
  const lista = (total.produtosVendidos ?? []).slice(0, 5);
  if (!lista.length) return <ChartCard title="Produtos e serviços mais vendidos" subtitle={subtitle}><ChartEmpty>Sem vendas avulsas do EVO neste mês.</ChartEmpty></ChartCard>;
  return (
    <ChartCard title="Produtos e serviços mais vendidos" subtitle={subtitle}>
      <RankingPorValor lista={lista} rotulo="Produtos e serviços que mais faturaram" />
      <p className="mt-4 text-xs text-muted-foreground">Os 5 itens que mais faturaram no mês. Pro+, WG Plus, diárias, brinquedoteca e taxa de personal aparecem somados, cada um na sua linha (avulsas e vendidas como contrato, como nos cartões); nas unidades PRO a diária aparece separada, com o nome da unidade. Os demais itens são vendas fora de contrato, pelo nome no EVO. Multas, taxas e ajustes de cobrança ficam no Financeiro.</p>
    </ChartCard>
  );
}

/** Multas, taxas, pró-rata e ajustes cobrados fora de contrato no mês (não são produtos vendidos). */
export function TaxasCobradas({ total, monthLabel, partial, unitLabel }: { total: UnitData; monthLabel: string; partial: boolean; unitLabel: string }) {
  const subtitle = <>{unitLabel} • {monthLabel}{partial && " (mês em andamento: valores parciais)"}</>;
  const lista = (total.taxasCobradas ?? []).slice(0, 8);
  if (!lista.length) return <ChartCard title="Multas, taxas e ajustes" subtitle={subtitle}><ChartEmpty>Sem multas, taxas ou ajustes lançados no EVO neste mês.</ChartEmpty></ChartCard>;
  const [soma, multasQ, multasV] = total.taxasResumo ?? [0, 0, 0];
  return (
    <ChartCard
      title="Multas, taxas e ajustes"
      subtitle={subtitle}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label="Total cobrado" value={moeda(soma)} swatch={<span className="h-2 w-2 rounded-full bg-foreground" />} />
          <HeadlineStat label="Multas de cancelamento" value={`${moeda(multasV)} (${multasQ.toLocaleString("pt-BR")})`} swatch={<span className="h-2 w-2 rounded-full bg-primary" />} />
        </div>
      }
    >
      <RankingPorValor lista={lista} rotulo="Multas, taxas e ajustes cobrados" />
      <p className="mt-4 text-xs text-muted-foreground">Cobranças avulsas que não são produto: multa de cancelamento, pró-rata por mudança do dia de cobrança, taxa de adesão, inadimplência renegociada, contestação de cartão e ajustes. Pelo nome no EVO, ordenadas pelo valor do mês.</p>
    </ChartCard>
  );
}
