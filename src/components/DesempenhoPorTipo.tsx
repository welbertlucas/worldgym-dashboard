import { Bookmark, Heart, Image as ImageIcon, MessageCircle, Share2 } from "lucide-react";
import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import type { PostInstagram } from "@/data/instagram";
import { ICONE_TIPO } from "@/components/instagram/tipos";
import { composicaoPorTipo, interacoesDe } from "@/data/instagramPainel";
import { cn } from "@/lib/utils";

/** Abaixo disto a média de um tipo diz pouco (poucos posts): a barra fica apagada. */
export const MIN_POSTS = 3;

export interface LinhaTipo { tipo: string; rotulo: string; posts: number; media: number }

/** Interações médias por post em cada tipo de conteúdo (foto, vídeo, carrossel, reels), da maior média para a menor. */
export function desempenhoPorTipo(posts: PostInstagram[]): LinhaTipo[] {
  return composicaoPorTipo(posts).map(({ tipo, rotulo, posts: n, media }) => ({ tipo, rotulo, posts: n, media }));
}

const dec = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: n < 10 ? 1 : 0 });

/** As partes de uma interação, na ordem da barra: cor da marca para a maior parte (curtidas), cinzas para as demais. */
const PARTES = [
  { id: "curtidas", rotulo: "Curtidas", cor: "hsl(4 90% 50%)", Icone: Heart },
  { id: "comentarios", rotulo: "Comentários", cor: "hsl(222 25% 28%)", Icone: MessageCircle },
  { id: "salvos", rotulo: "Salvos", cor: "hsl(220 9% 58%)", Icone: Bookmark },
  { id: "compartilhamentos", rotulo: "Compartilhamentos", cor: "hsl(220 14% 82%)", Icone: Share2 },
] as const;

/** O que mais gera interação (curtidas, comentários, salvos e compartilhamentos): média por post de cada tipo de conteúdo e de que ela é feita. */
export function DesempenhoPorTipo({ posts, quem }: { posts: PostInstagram[]; quem: string }) {
  const linhas = composicaoPorTipo(posts);
  const subtitle = <>{quem} • posts guardados no painel</>;
  if (linhas.length === 0) return <ChartCard title="O que gera mais interação" subtitle={subtitle}><ChartEmpty>Nenhum post guardado.</ChartEmpty></ChartCard>;
  const maior = Math.max(...linhas.map((l) => l.media), 1);
  const melhor = linhas.find((l) => l.posts >= MIN_POSTS);
  const mediaGeral = posts.length ? posts.reduce((s, p) => s + interacoesDe(p), 0) / posts.length : 0;
  return (
    <ChartCard
      title="O que gera mais interação"
      subtitle={subtitle}
      headline={melhor && (
        <div className="grid grid-cols-2 gap-4">
          <HeadlineStat label="Tipo com mais interação por post" value={melhor.rotulo} swatch={<span className="h-2 w-2 rounded-full bg-primary" />} />
          <HeadlineStat label="Interações por post nesse tipo" value={dec(melhor.media)} swatch={<span className="h-2 w-2 rounded-full bg-foreground/40" />} />
        </div>
      )}
      legend={
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground" aria-label="Legenda das barras">
          {PARTES.map((p) => <li key={p.id} className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm" style={{ background: p.cor }} aria-hidden />{p.rotulo}</li>)}
        </ul>
      }
    >
      <ol className="space-y-4" aria-label="Interações médias por post, por tipo de conteúdo">
        {linhas.map((l) => {
          const pouco = l.posts < MIN_POSTS;
          const Icone = ICONE_TIPO[l.tipo] ?? ImageIcon;
          const partes = PARTES.map((p) => ({ ...p, v: l[p.id] }));
          const totalPartes = partes.reduce((s, p) => s + p.v, 0);
          return (
            <li key={l.tipo} className={cn("grid grid-cols-[7.5rem_minmax(0,1fr)_auto] items-center gap-x-3 text-sm", pouco && "opacity-60")}>
              <span className="flex items-center gap-2 text-foreground"><Icone className="h-4 w-4 text-muted-foreground" aria-hidden />{l.rotulo}</span>
              <div className="h-3 rounded-full bg-secondary" aria-hidden>
                <div className="flex h-full overflow-hidden rounded-full" style={{ width: `${Math.max((l.media / maior) * 100, 2)}%` }}>
                  {totalPartes > 0
                    ? partes.filter((p) => p.v > 0).map((p) => <span key={p.id} title={`${p.rotulo}: ${dec(p.v)} por post`} style={{ width: `${(p.v / totalPartes) * 100}%`, background: p.cor }} />)
                    : <span className="w-full bg-foreground/40" />}
                </div>
              </div>
              <span className="text-right tabular-nums">
                <span className={cn("font-display text-lg font-semibold", l === melhor ? "text-primary-ink" : "text-foreground")}>{dec(l.media)}</span>{" "}
                <span className="text-xs text-muted-foreground">por post · {l.posts.toLocaleString("pt-BR")} {l.posts === 1 ? "post" : "posts"}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-xs text-muted-foreground">
        Interações = curtidas, comentários, salvos e compartilhamentos. A média de todos os posts é {dec(mediaGeral)} por post. Barras apagadas: tipos com menos de {MIN_POSTS} posts, em que a média diz pouco. Não mede alcance nem qualidade da conversa.
      </p>
    </ChartCard>
  );
}

