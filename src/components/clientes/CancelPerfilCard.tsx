import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import { GENEROS, ROTULOS_IDADE } from "@/components/perfil/blocos";
import type { UnitData } from "@/data/dashboardData";

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const taxa = (canc: number, base: number) => (base > 0 ? (canc / base) * 100 : null);
const fmtTaxa = (t: number | null) => (t === null ? "—" : `${t.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);

/** Grupos com menos alunos que isso no início do mês têm taxa instável: aparecem apagados e não entram no destaque. */
export const BASE_MINIMA = 30;

type Linha = { rotulo: string; base: number; canc: number; t: number | null };

/** Diferença mínima entre gêneros (p.p.) para destacar um deles; abaixo disso, é ruído. */
export const DIFERENCA_GENERO = 1;

/** O grupo (com base suficiente) que mais cancela, em proporção. */
export function maiorTaxa(linhas: Linha[]): Linha | null {
  return linhas.filter((l) => l.base >= BASE_MINIMA && l.t !== null).reduce<Linha | null>((m, l) => (!m || l.t! > m.t! ? l : m), null);
}

function Lista({ titulo, linhas, geral }: { titulo: string; linhas: Linha[]; geral: number | null }) {
  // Escala pelos grupos com base suficiente: um grupo de 4 alunos com 1 cancelamento (25%) não achata os outros.
  const maior = Math.max(...linhas.filter((l) => l.base >= BASE_MINIMA).map((l) => l.t ?? 0), geral ?? 0, 0.1);
  return (
    <div>
      <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</h4>
      <ul className="space-y-2" aria-label={`Cancelamento ${titulo.toLowerCase()}`}>
        {linhas.map((l) => {
          const pequena = l.base < BASE_MINIMA;
          const acima = !pequena && geral !== null && l.t !== null && l.t > geral;
          return (
            <li key={l.rotulo} className={`grid grid-cols-[6.5rem_minmax(0,1fr)_8.5rem] items-center gap-3 text-sm ${pequena ? "opacity-50" : ""}`}>
              <span className="truncate text-foreground">{l.rotulo}</span>
              <span className="relative h-2.5 rounded-full bg-secondary" aria-hidden>
                <span className={`block h-full rounded-full ${acima ? "bg-primary" : "bg-foreground/55"}`} style={{ width: `${Math.min(100, ((l.t ?? 0) / maior) * 100)}%` }} />
                {geral !== null && <span className="absolute -top-1 h-[18px] w-0.5 bg-foreground/70" style={{ left: `${(geral / maior) * 100}%` }} />}
              </span>
              <span className="text-right tabular-nums text-muted-foreground"><span className="font-semibold text-foreground">{fmtTaxa(l.t)}</span> · {int(l.canc)} de {int(l.base)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Quem cancela: churn do mês por gênero e por faixa de idade (cancelados ÷ ativos no início do mês em cada grupo),
 * com a mesma regra do churn do painel. A taxa importa mais que o total: um grupo grande cancela mais só por ser grande.
 */
export function CancelPerfilCard({ total, monthLabel, partial, unitLabel }: { total: UnitData; monthLabel: string; partial: boolean; unitLabel: string }) {
  const subtitle = <>{unitLabel} • {monthLabel}{partial && " (mês em andamento: até hoje)"}</>;
  const titulo = "Quem cancela: gênero e idade";
  const p = total.cancelPerfil;
  if (!p) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>O perfil dos cancelamentos ainda não foi carregado para este mês.</ChartEmpty></ChartCard>;

  const linha = (rotulo: string, [base, canc]: [number, number]): Linha => ({ rotulo, base, canc, t: taxa(canc, base) });
  const generos = GENEROS.map((g, k) => linha(g.rotulo, p.g[k] ?? [0, 0])).filter((l) => l.base > 0 || l.canc > 0);
  const idades = ROTULOS_IDADE.map((r, k) => linha(r, p.i[k] ?? [0, 0])).filter((l) => l.base > 0 || l.canc > 0);
  const base = p.g.reduce((s, [b]) => s + b, 0);
  const canc = p.g.reduce((s, [, c]) => s + c, 0);
  const geral = taxa(canc, base);
  if (!canc) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>Nenhum cancelamento neste mês.</ChartEmpty></ChartCard>;
  const idadeTopo = maiorTaxa(idades.filter((l) => l.rotulo !== "Sem data"));
  const comparaveis = generos.filter((l) => l.rotulo !== "Não informado" && l.base >= BASE_MINIMA && l.t !== null);
  const generoTopo = maiorTaxa(comparaveis);
  const generoMenor = comparaveis.reduce<Linha | null>((m, l) => (!m || l.t! < m.t! ? l : m), null);
  const generoDifere = !!generoTopo && !!generoMenor && generoTopo.t! - generoMenor.t! >= DIFERENCA_GENERO;

  return (
    <ChartCard
      title={titulo}
      subtitle={subtitle}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label="Churn do mês" value={fmtTaxa(geral)} swatch={<span className="h-0.5 w-3 bg-foreground/70" />} />
          {idadeTopo && <HeadlineStat label={`Faixa que mais cancela: ${idadeTopo.rotulo}`} value={fmtTaxa(idadeTopo.t)} swatch={<span className="h-2 w-2 rounded-full bg-primary" />} />}
          {generoTopo && (generoDifere
            ? <HeadlineStat label={`Gênero que mais cancela: ${generoTopo.rotulo.toLowerCase()}`} value={fmtTaxa(generoTopo.t)} swatch={<span className="h-2 w-2 rounded-full bg-primary/60" />} />
            : <HeadlineStat label="Gênero" value="Sem diferença" swatch={<span className="h-2 w-2 rounded-full bg-foreground/30" />} />)}
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <Lista titulo="Por gênero" linhas={generos} geral={geral} />
        <Lista titulo="Por faixa de idade" linhas={idades} geral={idades.length ? geral : null} />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Em cada grupo: alunos que cancelaram no mês ÷ alunos ativos no início do mês, a mesma conta do churn do painel. O traço vertical é o churn do mês;
        em vermelho, os grupos que cancelam acima dele. Entre os gêneros, só há destaque com diferença de {DIFERENCA_GENERO} p.p. ou mais. Idade no dia 1º do mês. Grupos com menos de {BASE_MINIMA} alunos aparecem apagados e ficam fora dos destaques, porque poucos cancelamentos já mudam muito a taxa.
      </p>
    </ChartCard>
  );
}
