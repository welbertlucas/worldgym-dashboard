import { Bookmark, Eye, Heart, MessageCircle, Share2 } from "lucide-react";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { ICONE_TIPO } from "@/components/instagram/tipos";
import { Miniatura } from "@/components/instagram/Midia";
import { NOME_DO_TIPO, type PostInstagram } from "@/data/instagram";
import { interacoesDe } from "@/data/instagramPainel";
import { cn } from "@/lib/utils";

const int = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("pt-BR"));
const quando = (iso: string | null) => (iso ? new Date(iso.replace(/([+-]\d{2})(\d{2})$/, "$1:$2")).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "");

/**
 * Os posts do período que mais engajaram: o primeiro em destaque grande (ocupa duas colunas e duas linhas no computador) e os outros ao lado,
 * cada um com a imagem, as interações e de que tipo foram.
 */
export function PostsEmDestaque({ posts, quem, dias, mostrarConta }: { posts: PostInstagram[]; quem: string; dias: number; mostrarConta: boolean }) {
  return (
    <ChartCard title="Posts que mais engajaram" subtitle={<>{quem} • últimos {dias} dias, por interações (curtidas, comentários, salvos e compartilhamentos)</>}>
      {posts.length === 0 ? <ChartEmpty>Nenhum post com interações no período.</ChartEmpty> : (
        <ol className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:grid-rows-2" aria-label="Posts em ordem de interações">
          {posts.map((p, i) => {
            const Icone = ICONE_TIPO[p.tipo];
            const destaque = i === 0;
            return (
              <li key={p.id} className={cn("min-w-0", destaque && "col-span-2 lg:row-span-2")}>
                <a href={p.link ?? undefined} target="_blank" rel="noreferrer" className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <div className={cn("relative", destaque && "lg:min-h-[18rem] lg:flex-1")}>
                    <Miniatura id={p.id} temMidia={p.midia} className={cn("w-full aspect-[4/5]", destaque && "lg:absolute lg:inset-0 lg:aspect-auto lg:h-full")} alt={p.legenda ? p.legenda.slice(0, 80) : `Post ${i + 1} em destaque`} />
                    <span className={cn("absolute left-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full px-2 font-display text-sm font-semibold", destaque ? "bg-primary text-primary-foreground" : "bg-black/65 text-white")}>{i + 1}º</span>
                    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                      {Icone && <Icone className="h-3 w-3" aria-hidden />}{NOME_DO_TIPO[p.tipo] ?? p.tipo}
                    </span>
                  </div>
                  <div className="space-y-1.5 p-3">
                    <p className="truncate text-xs text-muted-foreground">{mostrarConta && <span className="font-medium text-foreground">{p.unidade ?? "Institucional"} · </span>}{quando(p.data)}</p>
                    <p className="flex items-baseline gap-1.5"><span className={cn("font-display font-semibold leading-none tabular-nums text-foreground", destaque ? "text-4xl" : "text-2xl")}>{int(interacoesDe(p))}</span><span className="text-xs text-muted-foreground">interações</span></p>
                    <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums text-foreground">
                      <span className="inline-flex items-center gap-1" title="Curtidas"><Heart className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{int(p.curtidas)}</span>
                      <span className="inline-flex items-center gap-1" title="Comentários"><MessageCircle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{int(p.comentarios)}</span>
                      <span className="inline-flex items-center gap-1" title="Salvos"><Bookmark className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{int(p.salvos)}</span>
                      <span className="inline-flex items-center gap-1" title="Compartilhamentos"><Share2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{int(p.compartilhamentos)}</span>
                      {p.visualizacoes != null && <span className="inline-flex items-center gap-1" title="Visualizações"><Eye className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{int(p.visualizacoes)}</span>}
                    </p>
                  </div>
                </a>
              </li>
            );
          })}
        </ol>
      )}
    </ChartCard>
  );
}
