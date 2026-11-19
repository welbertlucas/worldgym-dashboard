import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import type { PostInstagram } from "@/data/instagram";
import { calorDePostagem, DIAS_SEMANA, DIAS_SEMANA_LONGO, FAIXAS, MIN_POSTS_CELULA } from "@/data/instagramPainel";
import { cn } from "@/lib/utils";

const dec = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: n < 10 ? 1 : 0 });

/** "Quarta, de manhã" a partir da célula do mapa. */
export const nomeDaCelula = (dia: number, faixa: number) => `${DIAS_SEMANA_LONGO[dia][0].toUpperCase()}${DIAS_SEMANA_LONGO[dia].slice(1)}, ${["de manhã", "à tarde", "à noite"][faixa]}`;

/**
 * Mapa de calor do dia da semana × parte do dia com as interações médias por post (horário de Brasília), na escala de
 * vermelho que o Atlas usa nos outros mapas. Célula com menos de 2 posts fica apagada e não vale como "melhor".
 */
export function MelhorHorario({ posts, quem, dias }: { posts: PostInstagram[]; quem: string; dias: number }) {
  const { celulas, melhor, maior } = calorDePostagem(posts);
  const subtitle = <>{quem} • últimos {dias} dias, horário de Brasília</>;
  if (posts.length === 0) return <ChartCard title="Melhor dia e horário para postar" subtitle={subtitle}><ChartEmpty>Nenhum post no período.</ChartEmpty></ChartCard>;
  return (
    <ChartCard
      title="Melhor dia e horário para postar"
      subtitle={subtitle}
      headline={melhor ? (
        <div className="grid grid-cols-2 gap-4">
          <HeadlineStat label="Quando os posts mais engajaram" value={nomeDaCelula(melhor.dia, melhor.faixa)} swatch={<span className="h-2 w-2 rounded-full bg-primary" />} />
          <HeadlineStat label="Interações por post nesse horário" value={dec(melhor.media as number)} swatch={<span className="h-2 w-2 rounded-full bg-foreground/40" />} />
        </div>
      ) : undefined}
    >
      <table className="w-full table-fixed border-separate border-spacing-1">
        <caption className="sr-only">Interações médias por post, por dia da semana e parte do dia</caption>
        <thead>
          <tr>
            <td className="w-16 sm:w-24" />
            {DIAS_SEMANA.map((d) => <th key={d} scope="col" className="pb-1 text-center text-[11px] font-medium text-muted-foreground">{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {FAIXAS.map((f, fi) => (
            <tr key={f.id}>
              <th scope="row" className="pr-2 text-left align-middle text-[11px] font-medium text-muted-foreground">
                {f.rotulo}<span className="hidden text-[10px] font-normal sm:block">{f.horas}</span>
              </th>
              {DIAS_SEMANA.map((_, di) => {
                const c = celulas.find((x) => x.dia === di && x.faixa === fi)!;
                const forte = c.n >= MIN_POSTS_CELULA && c.media != null;
                const alfa = forte ? 0.08 + 0.82 * ((c.media as number) / maior) : 0;
                const ehMelhor = melhor?.dia === di && melhor.faixa === fi;
                const titulo = c.n === 0 ? `${nomeDaCelula(di, fi)}: nenhum post` : `${nomeDaCelula(di, fi)}: ${dec(c.media as number)} interações por post, em ${c.n} ${c.n === 1 ? "post" : "posts"}${forte ? "" : " (poucos posts: a média diz pouco)"}`;
                return (
                  <td key={di} title={titulo} className="p-0">
                    <div
                      className={cn("flex h-12 items-center justify-center rounded-md text-sm tabular-nums sm:h-14", !forte && (c.n ? "bg-secondary text-muted-foreground" : "bg-secondary/40"), ehMelhor && "ring-2 ring-foreground")}
                      style={forte ? { background: `hsl(4 90% 50% / ${alfa})`, color: alfa > 0.5 ? "white" : "hsl(222 25% 14%)" } : undefined}
                    >
                      <span className={cn("font-semibold", !forte && "font-normal")}>{c.n ? Math.round(c.media as number) : ""}</span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted-foreground">
        Em cada quadrado, as interações médias por post nesse dia e parte do dia: quanto mais vermelho, mais interação. Quadrados em cinza têm menos de {MIN_POSTS_CELULA} posts e não contam para o melhor horário. É o que já aconteceu, não uma garantia do que vai acontecer.
      </p>
    </ChartCard>
  );
}
