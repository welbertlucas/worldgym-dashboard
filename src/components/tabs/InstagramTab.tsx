import { useEffect, useMemo, useState } from "react";
import { Eye, Heart, Images, Percent, Users } from "lucide-react";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { Delta, FaixaKpi, Sparkline, type ItemKpi } from "@/components/FaixaKpi";
import { DesempenhoPorTipo } from "@/components/DesempenhoPorTipo";
import { CartaoDaConta } from "@/components/instagram/CartaoDaConta";
import { FeedSecao } from "@/components/instagram/FeedSecao";
import { MelhorHorario } from "@/components/instagram/MelhorHorario";
import { PostsEmDestaque } from "@/components/instagram/PostsEmDestaque";
import { StoriesSecao } from "@/components/instagram/StoriesSecao";
import { carregarInstagram, contasDaEscolha, resumoDasContas, type DadosInstagram } from "@/data/instagram";
import { cartoesDasContas, kpisDoInstagram, ordenarContas, postsDesde, postsQueMaisEngajaram, ROTULO_ORDEM, type OrdemContas } from "@/data/instagramPainel";
import { cn } from "@/lib/utils";

const int = (n: number | null | undefined) => (n == null ? "—" : Math.round(n).toLocaleString("pt-BR"));
const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");

/** Janela dos números e dos destaques; o melhor horário usa uma janela maior porque precisa de mais posts. */
const DIAS = 30;
const DIAS_HORARIO = 90;

/**
 * Instagram das unidades: números da rede (ou da unidade), um cartão por conta, o que gera mais interação, o melhor dia e horário
 * para postar, os posts que mais engajaram, os stories e o feed. Segue o botão de unidade do alto: na rede mostra todas as contas
 * (a Institucional inclusive); com uma unidade, só a conta dela.
 */
export function InstagramTab({ unit }: { unit: string | null }) {
  const [d, setD] = useState<DadosInstagram | null | undefined>(undefined);
  const [ordem, setOrdem] = useState<OrdemContas>("seguidores");
  useEffect(() => { let vivo = true; carregarInstagram().then((x) => vivo && setD(x)); return () => { vivo = false; }; }, []);
  const contas = useMemo(() => (d ? contasDaEscolha(d, unit) : []), [d, unit]);
  const usuarios = useMemo(() => new Set(contas.map((c) => c.usuario)), [contas]);
  const resumo = useMemo(() => (d ? resumoDasContas(d, contas, new Date(), DIAS) : []), [d, contas]);
  const posts = useMemo(() => (d ? d.posts.filter((p) => usuarios.has(p.conta)) : []), [d, usuarios]);
  const stories = useMemo(() => (d ? d.stories.filter((s) => usuarios.has(s.conta)) : []), [d, usuarios]);
  const kpis = useMemo(() => (d ? kpisDoInstagram(d, contas, resumo, DIAS) : null), [d, contas, resumo]);
  const cartoes = useMemo(() => (d ? ordenarContas(cartoesDasContas(d, resumo, DIAS), ordem) : []), [d, resumo, ordem]);
  const destaques = useMemo(() => postsQueMaisEngajaram(posts, 5, DIAS), [posts]);
  const postsHorario = useMemo(() => postsDesde(posts, DIAS_HORARIO), [posts]);
  const quem = unit ?? "Rede";
  const atualizado = d?.geradoEm ? ` • atualizado em ${quando(d.geradoEm)}` : "";

  if (d === undefined) return <ChartCard title="Instagram" subtitle={quem}><ChartEmpty>Carregando…</ChartEmpty></ChartCard>;
  if (!d?.geradoEm) return <ChartCard title="Instagram" subtitle={quem}><ChartEmpty>O Instagram das unidades aparece aqui depois da primeira leitura, que começa quando o novo acesso do Meta (com permissão de Instagram) estiver ativo.</ChartEmpty></ChartCard>;
  if (!contas.length || !kpis) return <ChartCard title="Instagram" subtitle={quem}><ChartEmpty>{unit ? `O Instagram de ${unit} ainda não está ligado ao painel.` : "Nenhuma conta do Instagram ligada ao painel."}</ChartEmpty></ChartCard>;
  const varias = contas.length > 1;
  // A barra compara as unidades entre si: a conta da rede (Institucional) é bem maior e esmagaria as outras, então fica sem barra.
  const maiorConta = Math.max(1, ...contas.filter((c) => c.unidade !== null).map((c) => c.seguidores ?? 0));

  const itens: ItemKpi[] = [
    {
      id: "seguidores", rotulo: varias ? "Seguidores somados" : "Seguidores", valor: int(kpis.seguidores), icone: <Users className="h-3.5 w-3.5" aria-hidden />,
      extra: <div className="flex items-center justify-between gap-3"><Delta valor={kpis.ganho} titulo={`Variação de seguidores nos últimos ${DIAS} dias`} /><Sparkline valores={kpis.serie.map((p) => p.total)} rotulo="Evolução dos seguidores" className="w-20" /></div>,
      detalhe: varias ? `${contas.length} contas · ${DIAS} dias` : `${DIAS} dias`,
    },
    { id: "interacoes", rotulo: "Interações", valor: int(kpis.interacoes), icone: <Heart className="h-3.5 w-3.5" aria-hidden />, detalhe: kpis.interacoesPorPost == null ? "Nenhum post no período" : `${int(kpis.interacoesPorPost)} por post · curtidas, comentários, salvos e compartilhamentos` },
    { id: "views", rotulo: "Visualizações dos posts", valor: int(kpis.visualizacoes), icone: <Eye className="h-3.5 w-3.5" aria-hidden />, detalhe: kpis.posts ? `${int(kpis.visualizacoes / kpis.posts)} por post` : "Nenhum post no período" },
    { id: "posts", rotulo: "Posts no feed", valor: int(kpis.posts), icone: <Images className="h-3.5 w-3.5" aria-hidden />, detalhe: `${int(kpis.stories)} ${kpis.stories === 1 ? "story" : "stories"} no período${kpis.mediaViewsStory != null ? ` · ${int(kpis.mediaViewsStory)} views por story` : ""}` },
    {
      id: "taxa", rotulo: "Interação por seguidor", icone: <Percent className="h-3.5 w-3.5" aria-hidden />,
      valor: kpis.taxaInteracao == null ? "—" : `${(kpis.taxaInteracao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
      detalhe: "Em média, quanto de cada 100 seguidores interage com um post",
    },
  ];

  return (
    <div className="space-y-6">
      <FaixaKpi itens={itens} rotulo={`Números do Instagram, ${quem}, últimos ${DIAS} dias`} />

      <section aria-label="Contas" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{varias ? "Contas" : "Conta"}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{quem} • últimos {DIAS} dias{atualizado}</p>
          </div>
          {varias && (
            <div role="group" aria-label="Ordenar as contas por" className="inline-flex max-w-full overflow-x-auto rounded-full border border-border bg-white p-0.5">
              {(Object.keys(ROTULO_ORDEM) as OrdemContas[]).map((o) => (
                <button key={o} type="button" aria-pressed={ordem === o} onClick={() => setOrdem(o)} className={cn("shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", ordem === o ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{ROTULO_ORDEM[o]}</button>
              ))}
            </div>
          )}
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cartoes.map((c) => <CartaoDaConta key={c.conta.usuario} c={c} maior={maiorConta} mostrarBarra={varias && c.conta.unidade !== null} />)}
        </ul>
        <p className="text-xs text-muted-foreground">{varias ? "A barra de cada cartão compara a unidade com a maior unidade (a conta da rede fica de fora). " : ""}O ganho de seguidores aparece quando houver histórico. Em vermelho, a conta que ficou mais de 7 dias sem postar no feed.</p>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <DesempenhoPorTipo posts={posts} quem={quem} />
        <MelhorHorario posts={postsHorario} quem={quem} dias={DIAS_HORARIO} />
      </div>

      <PostsEmDestaque posts={destaques} quem={quem} dias={DIAS} mostrarConta={varias} />
      <StoriesSecao stories={stories} quem={quem} mostrarConta={varias} />
      <FeedSecao posts={posts} quem={quem} mostrarConta={varias} />
    </div>
  );
}
