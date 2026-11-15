import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { NOME_DO_TIPO, type PostInstagram } from "@/data/instagram";
import { cn } from "@/lib/utils";

/** Abaixo disto a média de um tipo diz pouco (poucos posts): a barra fica em cinza claro. */
export const MIN_POSTS = 3;

export interface LinhaTipo { tipo: string; rotulo: string; posts: number; media: number }

const interacoesDe = (p: PostInstagram) => p.interacoes ?? ((p.curtidas ?? 0) + (p.comentarios ?? 0) + (p.salvos ?? 0) + (p.compartilhamentos ?? 0));

/** Interações médias por post em cada tipo de conteúdo (foto, vídeo, carrossel, reels), da maior média para a menor. */
export function desempenhoPorTipo(posts: PostInstagram[]): LinhaTipo[] {
  const por = new Map<string, { n: number; soma: number }>();
  for (const p of posts) {
    const a = por.get(p.tipo) ?? { n: 0, soma: 0 };
    a.n += 1; a.soma += interacoesDe(p);
    por.set(p.tipo, a);
  }
  return [...por].map(([tipo, a]) => ({ tipo, rotulo: NOME_DO_TIPO[tipo] ?? tipo, posts: a.n, media: a.soma / a.n })).sort((a, b) => b.media - a.media);
}

const dec = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: n < 10 ? 1 : 0 });

/** O que mais gera interação (curtidas, comentários, salvos e compartilhamentos): média por post de cada tipo de conteúdo. */
export function DesempenhoPorTipo({ posts, quem }: { posts: PostInstagram[]; quem: string }) {
  const linhas = desempenhoPorTipo(posts);
  const subtitle = <>{quem} • posts guardados no painel</>;
  if (linhas.length === 0) return <ChartCard title="O que gera mais interação" subtitle={subtitle}><ChartEmpty>Nenhum post guardado.</ChartEmpty></ChartCard>;
  const maior = Math.max(...linhas.map((l) => l.media), 1);
  const melhor = linhas.find((l) => l.posts >= MIN_POSTS);
  return (
    <ChartCard title="O que gera mais interação" subtitle={subtitle}>
      <ol className="space-y-3" aria-label="Interações médias por post, por tipo de conteúdo">
        {linhas.map((l) => {
          const pouco = l.posts < MIN_POSTS;
          return (
            <li key={l.tipo} className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-x-3 text-sm">
              <span className={cn("text-foreground", pouco && "text-muted-foreground")}>{l.rotulo}</span>
              <div className="h-2.5 rounded-full bg-secondary" aria-hidden>
                <div className={cn("h-full rounded-full", pouco ? "bg-foreground/20" : l === melhor ? "bg-primary" : "bg-foreground/70")} style={{ width: `${Math.max((l.media / maior) * 100, 1.5)}%` }} />
              </div>
              <span className="text-right tabular-nums"><span className="font-semibold text-foreground">{dec(l.media)}</span> <span className="text-xs text-muted-foreground">por post · {l.posts.toLocaleString("pt-BR")} {l.posts === 1 ? "post" : "posts"}</span></span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">Interações = curtidas, comentários, salvos e compartilhamentos. Em carmim, o tipo com mais interação por post; em cinza claro, os com menos de {MIN_POSTS} posts, em que a média diz pouco. Não mede alcance nem qualidade da conversa.</p>
    </ChartCard>
  );
}
