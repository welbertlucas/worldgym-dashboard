import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, Heart, Image as ImageIcon, MessageCircle, Reply } from "lucide-react";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { carregarInstagram, contasDaEscolha, imagemInstagram, NOME_DO_TIPO, resumoDasContas, storiesPorDia, type DadosInstagram, type PostInstagram, type StoryInstagram } from "@/data/instagram";
import { cn } from "@/lib/utils";

const int = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("pt-BR"));
const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
const diaLongo = (ymd: string) => { const [y, m, d] = ymd.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" }); };

/** Imagem guardada de um post/story; só busca quando aparece na tela. */
function Miniatura({ id, temMidia, className, alt }: { id: string; temMidia?: boolean | null; className?: string; alt: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!temMidia || !ref.current) return;
    let vivo = true;
    const ver = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      ver.disconnect();
      imagemInstagram(id).then((u) => vivo && setSrc(u));
    }, { rootMargin: "200px" });
    ver.observe(ref.current);
    return () => { vivo = false; ver.disconnect(); };
  }, [id, temMidia]);
  return (
    <div ref={ref} className={cn("overflow-hidden bg-secondary", className)}>
      {src ? <img src={src} alt={alt} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-muted-foreground/50"><ImageIcon className="h-6 w-6" aria-hidden /></span>}
    </div>
  );
}

function Post({ p, mostrarConta }: { p: PostInstagram; mostrarConta: boolean }) {
  return (
    <li>
      <a href={p.link ?? undefined} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title={p.legenda || undefined}>
        <div className="relative">
          <Miniatura id={p.id} temMidia={p.midia} className="aspect-square w-full" alt={p.legenda ? p.legenda.slice(0, 80) : "Post do Instagram"} />
          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">{NOME_DO_TIPO[p.tipo] ?? p.tipo}</span>
        </div>
        <div className="space-y-1 p-2.5">
          <p className="truncate text-xs text-muted-foreground">{mostrarConta && <span className="font-medium text-foreground" title={`@${p.conta}`}>{p.unidade ?? "Institucional"} · </span>}{quando(p.data)}</p>
          <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums text-foreground">
            <span className="inline-flex items-center gap-1" title="Curtidas"><Heart className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{int(p.curtidas)}</span>
            <span className="inline-flex items-center gap-1" title="Comentários"><MessageCircle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{int(p.comentarios)}</span>
            {p.visualizacoes != null && <span className="inline-flex items-center gap-1" title="Visualizações"><Eye className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{int(p.visualizacoes)}</span>}
          </p>
        </div>
      </a>
    </li>
  );
}

function Story({ s, mostrarConta }: { s: StoryInstagram; mostrarConta: boolean }) {
  return (
    <li className="w-24 shrink-0">
      <a href={s.link ?? undefined} target="_blank" rel="noreferrer" className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
        <Miniatura id={s.id} temMidia={s.midia} className="aspect-[9/16] w-24 rounded-xl border border-border" alt={`Story de @${s.conta}`} />
      </a>
      {mostrarConta && <p className="mt-1 truncate text-[11px] font-medium text-foreground" title={`@${s.conta}`}>{s.unidade ?? "Institucional"}</p>}
      <p className={cn("flex gap-2 text-[11px] tabular-nums text-foreground", !mostrarConta && "mt-1")}>
        <span className="text-muted-foreground">{s.data ? new Date(s.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
        <span className="inline-flex items-center gap-0.5" title="Visualizações"><Eye className="h-3 w-3 text-muted-foreground" aria-hidden />{int(s.visualizacoes)}</span>
        {(s.respostas ?? 0) > 0 && <span className="inline-flex items-center gap-0.5" title="Respostas"><Reply className="h-3 w-3 text-muted-foreground" aria-hidden />{int(s.respostas)}</span>}
      </p>
    </li>
  );
}

/**
 * Instagram das unidades: perfis (seguidores e ritmo de postagem), o feed e os stories guardados. Segue o botão de
 * unidade do alto: na rede mostra todas as contas (a Institucional primeiro); com uma unidade, só a conta dela.
 */
export function InstagramTab({ unit }: { unit: string | null }) {
  const [d, setD] = useState<DadosInstagram | null | undefined>(undefined);
  const [diasStories, setDiasStories] = useState(7);
  const [maisPosts, setMaisPosts] = useState(false);
  useEffect(() => { let vivo = true; carregarInstagram().then((x) => vivo && setD(x)); return () => { vivo = false; }; }, []);
  const contas = useMemo(() => (d ? contasDaEscolha(d, unit) : []), [d, unit]);
  const usuarios = useMemo(() => new Set(contas.map((c) => c.usuario)), [contas]);
  const resumo = useMemo(() => (d ? resumoDasContas(d, contas) : []), [d, contas]);
  const posts = useMemo(() => (d ? d.posts.filter((p) => usuarios.has(p.conta)) : []), [d, usuarios]);
  const dias = useMemo(() => (d ? storiesPorDia(d.stories.filter((s) => usuarios.has(s.conta))) : []), [d, usuarios]);
  const quem = unit ?? "Rede";
  const atualizado = d?.geradoEm ? ` • atualizado em ${quando(d.geradoEm)}` : "";

  if (d === undefined) return <ChartCard title="Instagram" subtitle={quem}><ChartEmpty>Carregando…</ChartEmpty></ChartCard>;
  if (!d?.geradoEm) return <ChartCard title="Instagram" subtitle={quem}><ChartEmpty>O Instagram das unidades aparece aqui depois da primeira leitura, que começa quando o novo acesso do Meta (com permissão de Instagram) estiver ativo.</ChartEmpty></ChartCard>;
  if (!contas.length) return <ChartCard title="Instagram" subtitle={quem}><ChartEmpty>{unit ? `O Instagram de ${unit} ainda não está ligado ao painel.` : "Nenhuma conta do Instagram ligada ao painel."}</ChartEmpty></ChartCard>;
  const varias = contas.length > 1;
  const postsVisiveis = maisPosts ? posts : posts.slice(0, 12);

  return (
    <div className="space-y-6">
      <ChartCard title="Contas" subtitle={<>{quem} • últimos 30 dias{atualizado}</>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">Conta</th>
                <th scope="col" className="py-2 px-3 text-right font-medium">Seguidores</th>
                <th scope="col" className="py-2 px-3 text-right font-medium">Posts</th>
                <th scope="col" className="py-2 px-3 text-right font-medium">Stories</th>
                <th scope="col" className="py-2 px-3 text-right font-medium">Último post</th>
                <th scope="col" className="py-2 pl-3 text-right font-medium">Visualizações por post</th>
              </tr>
            </thead>
            <tbody>
              {resumo.map((r) => (
                <tr key={r.conta.usuario} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5 pr-3">
                    <span className="block font-medium text-foreground">@{r.conta.usuario}</span>
                    <span className="block text-xs text-muted-foreground">{r.conta.unidade ?? "Institucional"}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    <span className="font-semibold text-foreground">{int(r.conta.seguidores)}</span>
                    {r.ganhoSeguidores != null && <span className={cn("block text-xs", r.ganhoSeguidores >= 0 ? "text-success" : "text-destructive")}>{r.ganhoSeguidores >= 0 ? "+" : ""}{int(r.ganhoSeguidores)}</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{int(r.postsNoPeriodo)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{int(r.storiesNoPeriodo)}</td>
                  <td className={cn("py-2.5 px-3 text-right tabular-nums", r.diasSemPost != null && r.diasSemPost > 7 && "font-semibold text-destructive")}>
                    {r.diasSemPost == null ? "—" : r.diasSemPost === 0 ? "hoje" : r.diasSemPost === 1 ? "ontem" : `há ${r.diasSemPost} dias`}
                  </td>
                  <td className="py-2.5 pl-3 text-right tabular-nums">{int(r.mediaVisualizacoes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Stories contam só a partir do dia em que o painel começou a guardá-los (o Meta só os entrega enquanto estão no ar, por 24 horas). O ganho de seguidores aparece quando houver histórico. Último post em vermelho: mais de 7 dias sem postar no feed.
        </p>
      </ChartCard>

      <ChartCard title="Stories" subtitle={<>{quem} • {diasStories === 7 ? "últimos 7 dias" : "últimos 30 dias"}</>}>
        {dias.length === 0 ? <ChartEmpty>Nenhum story guardado ainda.</ChartEmpty> : (
          <div className="space-y-4">
            {dias.slice(0, diasStories).map(([dia, lista]) => (
              <section key={dia} aria-label={`Stories de ${diaLongo(dia)}`}>
                <h4 className="mb-2 text-xs font-medium text-muted-foreground first-letter:uppercase">{diaLongo(dia)} · {lista.length} {lista.length === 1 ? "story" : "stories"}</h4>
                <ul className="flex gap-3 overflow-x-auto pb-1">{lista.map((s) => <Story key={s.id} s={s} mostrarConta={varias} />)}</ul>
              </section>
            ))}
            {dias.length > 7 && <button type="button" onClick={() => setDiasStories(diasStories === 7 ? 30 : 7)} className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary">{diasStories === 7 ? "Ver os últimos 30 dias" : "Ver só os últimos 7 dias"}</button>}
          </div>
        )}
      </ChartCard>

      <ChartCard title="Feed" subtitle={<>{quem} • posts mais recentes</>}>
        {posts.length === 0 ? <ChartEmpty>Nenhum post guardado.</ChartEmpty> : (
          <>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" aria-label="Posts do feed, do mais recente para o mais antigo">
              {postsVisiveis.map((p) => <Post key={p.id} p={p} mostrarConta={varias} />)}
            </ul>
            {posts.length > 12 && <button type="button" onClick={() => setMaisPosts(!maisPosts)} className="mt-4 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary">{maisPosts ? "Ver menos" : `Ver todos os ${posts.length} posts`}</button>}
          </>
        )}
      </ChartCard>
    </div>
  );
}
