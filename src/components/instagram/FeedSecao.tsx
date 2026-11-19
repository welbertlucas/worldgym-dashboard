import { useMemo, useState } from "react";
import { Eye, Heart, MessageCircle } from "lucide-react";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { ICONE_TIPO } from "@/components/instagram/tipos";
import { Miniatura } from "@/components/instagram/Midia";
import { NOME_DO_TIPO, type PostInstagram } from "@/data/instagram";
import { filtrarFeed, interacoesDe, type FiltroTipo, type OrdemFeed } from "@/data/instagramPainel";
import { cn } from "@/lib/utils";

const int = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("pt-BR"));
const quando = (iso: string | null) => (iso ? new Date(iso.replace(/([+-]\d{2})(\d{2})$/, "$1:$2")).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
const POR_VEZ = 12;

function PostTile({ p, mostrarConta, maior }: { p: PostInstagram; mostrarConta: boolean; maior: number }) {
  const total = interacoesDe(p);
  return (
    <li>
      <a href={p.link ?? undefined} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="relative">
          <Miniatura id={p.id} temMidia={p.midia} className="aspect-square w-full" alt={p.legenda ? p.legenda.slice(0, 80) : "Post do Instagram"} />
          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">{NOME_DO_TIPO[p.tipo] ?? p.tipo}</span>
        </div>
        <div className="space-y-1.5 p-2.5">
          <p className="truncate text-xs text-muted-foreground">{mostrarConta && <span className="font-medium text-foreground" title={`@${p.conta}`}>{p.unidade ?? "Institucional"} · </span>}{quando(p.data)}</p>
          <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums text-foreground">
            <span className="inline-flex items-center gap-1" title="Curtidas"><Heart className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{int(p.curtidas)}</span>
            <span className="inline-flex items-center gap-1" title="Comentários"><MessageCircle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{int(p.comentarios)}</span>
            {p.visualizacoes != null && <span className="inline-flex items-center gap-1" title="Visualizações"><Eye className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{int(p.visualizacoes)}</span>}
          </p>
          <div className="h-1 rounded-full bg-secondary" title={`${int(total)} interações`} aria-hidden>
            <div className="h-full rounded-full bg-primary" style={{ width: `${total > 0 ? Math.max((total / Math.max(maior, 1)) * 100, 3) : 0}%` }} />
          </div>
        </div>
      </a>
    </li>
  );
}

/** Feed guardado no painel: filtro por tipo e ordem (mais recentes ou mais interação). A barrinha de cada post compara as interações com o maior da lista. */
export function FeedSecao({ posts, quem, mostrarConta }: { posts: PostInstagram[]; quem: string; mostrarConta: boolean }) {
  const [tipo, setTipo] = useState<FiltroTipo>("todos");
  const [ordem, setOrdem] = useState<OrdemFeed>("recentes");
  const [mais, setMais] = useState(false);
  const tipos = useMemo(() => {
    const n = new Map<string, number>();
    for (const p of posts) n.set(p.tipo, (n.get(p.tipo) ?? 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1]);
  }, [posts]);
  const lista = useMemo(() => filtrarFeed(posts, tipo, ordem), [posts, tipo, ordem]);
  const visiveis = mais ? lista : lista.slice(0, POR_VEZ);
  const maior = Math.max(1, ...visiveis.map(interacoesDe));
  const chip = (ativo: boolean) => cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", ativo ? "border-foreground bg-foreground text-background" : "border-border text-foreground hover:bg-secondary");
  return (
    <ChartCard title="Feed" subtitle={<>{quem} • posts guardados no painel</>}>
      {posts.length === 0 ? <ChartEmpty>Nenhum post guardado.</ChartEmpty> : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div role="group" aria-label="Filtrar por tipo" className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={tipo === "todos"} onClick={() => { setTipo("todos"); setMais(false); }} className={chip(tipo === "todos")}>Todos <span className="tabular-nums opacity-70">{posts.length}</span></button>
              {tipos.map(([t, n]) => {
                const Icone = ICONE_TIPO[t];
                return (
                  <button key={t} type="button" aria-pressed={tipo === t} onClick={() => { setTipo(t); setMais(false); }} className={chip(tipo === t)}>
                    {Icone && <Icone className="h-3.5 w-3.5" aria-hidden />}{NOME_DO_TIPO[t] ?? t} <span className="tabular-nums opacity-70">{n}</span>
                  </button>
                );
              })}
            </div>
            <div role="group" aria-label="Ordem dos posts" className="inline-flex max-w-full overflow-x-auto rounded-full border border-border p-0.5">
              {([["recentes", "Mais recentes"], ["interacao", "Mais interação"]] as const).map(([id, rotulo]) => (
                <button key={id} type="button" aria-pressed={ordem === id} onClick={() => setOrdem(id)} className={cn("shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", ordem === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{rotulo}</button>
              ))}
            </div>
          </div>
          {lista.length === 0 ? <ChartEmpty>Nenhum post desse tipo.</ChartEmpty> : (
            <>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" aria-label={ordem === "recentes" ? "Posts do feed, do mais recente para o mais antigo" : "Posts do feed, do que mais teve interação para o que menos teve"}>
                {visiveis.map((p) => <PostTile key={p.id} p={p} mostrarConta={mostrarConta} maior={maior} />)}
              </ul>
              {lista.length > POR_VEZ && <button type="button" onClick={() => setMais(!mais)} className="mt-4 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary">{mais ? "Ver menos" : `Ver todos os ${lista.length.toLocaleString("pt-BR")} posts`}</button>}
            </>
          )}
        </>
      )}
    </ChartCard>
  );
}
