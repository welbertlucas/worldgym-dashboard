import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Building2, CheckCircle2, Clapperboard, ExternalLink, Image as ImageIcon, Plus, Smartphone, UserRound, Users } from "lucide-react";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { FaixaKpi, type ItemKpi } from "@/components/FaixaKpi";
import { Avatar } from "@/components/instagram/Midia";
import { diaDeBrasilia, entregasDoMes, mesAnteriorDe, resumoDeEntregas, ROTULO_SITUACAO_MES, type ContasDaRede, type EntregasDoMes, type PostsDoPerfil, type SituacaoMes } from "@/data/entregas";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ehDono, papelAtual, unidadesProprias } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { getAvailableUnits } from "@/data/dashboardData";
import {
  andamentoDoContrato, atualizarInfluenciador, criarInfluenciador, dasUnidades, fotoDoPerfil, hojeBR, listarInfluenciadores, ordenarInfluenciadores, removerInfluenciador,
  resumoDosContratos, ROTULO_SITUACAO, seguidoresCompacto, situacaoDoContrato, TIPOS_ENTREGA, vigencia,
  type CamposInfluenciador, type Entregas, type Influenciador, type PerfilInfluenciador, type SituacaoContrato,
} from "@/data/influenciadores";

const campo = "h-10 w-full rounded-xl border border-input bg-white px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring";
const REDE = "__rede__";
const COR_SITUACAO: Record<SituacaoContrato, string> = {
  vigente: "bg-emerald-50 text-emerald-700",
  futuro: "bg-amber-50 text-amber-700",
  encerrado: "bg-secondary text-muted-foreground",
  inativo: "bg-secondary text-muted-foreground",
};
const ICONE_ENTREGA: Record<keyof Entregas, typeof ImageIcon> = { stories: Smartphone, feed: ImageIcon, reels: Clapperboard };
const ROTULO_ENTREGA: Record<keyof Entregas, string> = { stories: "Stories", feed: "Feed", reels: "Reels" };
const int = (n: number) => n.toLocaleString("pt-BR");
const nomeDoMes = (ym: string) => { const [a, m] = ym.split("-").map(Number); return new Date(a, m - 1, 1).toLocaleDateString("pt-BR", { month: "long" }); };
const COR_SITUACAO_MES: Record<SituacaoMes, string> = {
  cumprido: "bg-emerald-50 text-emerald-700", no_ritmo: "bg-emerald-50 text-emerald-700", atrasado: "bg-destructive/10 text-destructive", nao_cumprido: "bg-destructive/10 text-destructive",
  sem_meta: "bg-secondary text-muted-foreground", fora: "bg-secondary text-muted-foreground", sem_leitura: "bg-secondary text-muted-foreground", desativado: "bg-secondary text-muted-foreground",
};
/** "3 posts no feed e 1 reel" (só o que tem número). */
const quantosTextos = (q: { feed: number; reels: number }) => [q.feed > 0 && `${q.feed} ${q.feed === 1 ? "post no feed" : "posts no feed"}`, q.reels > 0 && `${q.reels} ${q.reels === 1 ? "reel" : "reels"}`].filter(Boolean).join(" e ");

type FiltroStatus = "todos" | "vigor" | "outros";
const FILTROS: { id: FiltroStatus; rotulo: string }[] = [{ id: "todos", rotulo: "Todos" }, { id: "vigor", rotulo: "Em vigor" }, { id: "outros", rotulo: "Encerrados e desativados" }];

/**
 * Marketing > Influenciadores: os contratos dos influenciadores da rede (o @, a unidade e o que foi combinado por mês).
 * Todos veem a lista (quem tem acesso por unidades, só a da sua unidade). Dono e Master cadastram, editam e removem em qualquer unidade
 * e na "Rede toda"; quem tem acesso por unidades faz isso só na sua unidade.
 * Próximas etapas: comparar com o que foi postado (feed e reels pelo @, stories pela marcação da unidade).
 */
export function InfluenciadoresTab({ unit }: { unit: string | null }) {
  const dono = ehDono();
  const proprias = unidadesProprias(); // nível "unidades": só as suas
  const amplo = dono || papelAtual() === "master"; // qualquer unidade e a rede toda
  const podeCadastrar = amplo || proprias !== null;
  const [lista, setLista] = useState<Influenciador[] | null>(null);
  const [perfis, setPerfis] = useState<Record<string, PerfilInfluenciador>>({});
  const [posts, setPosts] = useState<Record<string, PostsDoPerfil>>({});
  const [contas, setContas] = useState<ContasDaRede>({ marca: null, porUnidade: {} });
  const [mesVisto, setMesVisto] = useState<"atual" | "anterior">("atual");
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState<Influenciador | "novo" | null>(null);
  const [filtro, setFiltro] = useState<FiltroStatus>("todos");

  const carregar = useCallback(async () => {
    const r = await listarInfluenciadores();
    if (r.ok) { setLista(Array.isArray(r.dados.influenciadores) ? r.dados.influenciadores : []); setPerfis(r.dados.perfis ?? {}); setPosts(r.dados.posts ?? {}); if (r.dados.contas) setContas(r.dados.contas); setErro(""); } else setErro(r.erro);
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const daEscolha = useMemo(() => dasUnidades(lista ?? [], unit), [lista, unit]);
  const resumo = useMemo(() => resumoDosContratos(daEscolha), [daEscolha]);
  const hoje = hojeBR();
  const ym = mesVisto === "atual" ? hoje.slice(0, 7) : mesAnteriorDe(hoje.slice(0, 7));
  const entregue = useMemo(() => resumoDeEntregas(daEscolha, posts, contas, ym, hoje), [daEscolha, posts, contas, ym, hoje]);
  const visiveis = useMemo(() => {
    const ordenados = ordenarInfluenciadores(daEscolha);
    if (filtro === "todos") return ordenados;
    return ordenados.filter((i) => (situacaoDoContrato(i) === "vigente") === (filtro === "vigor"));
  }, [daEscolha, filtro]);

  const alternarAtivo = async (i: Influenciador) => {
    const r = await atualizarInfluenciador(i.id, { ativo: !i.ativo });
    if (r.ok) { toast({ title: i.ativo ? `@${i.usuario} desativado` : `@${i.usuario} reativado` }); void carregar(); }
    else toast({ title: "Não consegui atualizar", description: r.erro, variant: "destructive" });
  };
  const remover = async (i: Influenciador) => {
    if (!window.confirm(`Remover @${i.usuario} do cadastro? Isso apaga o contrato e não dá para desfazer. Para só pausar, use Desativar.`)) return;
    const r = await removerInfluenciador(i.id);
    if (r.ok) { toast({ title: `@${i.usuario} removido` }); void carregar(); }
    else toast({ title: "Não consegui remover", description: r.erro, variant: "destructive" });
  };

  const itens: ItemKpi[] = [
    { id: "vigor", rotulo: "Contratos em vigor", valor: int(resumo.emVigor), icone: <UserRound className="h-3.5 w-3.5" aria-hidden />, detalhe: `${int(resumo.total)} ${resumo.total === 1 ? "cadastrado" : "cadastrados"} no total` },
    {
      id: "entregue", rotulo: `Feed e reels entregues, ${nomeDoMes(ym)}`, icone: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />,
      valor: entregue.comLeitura ? `${int(entregue.feitas)}/${int(entregue.combinadas)}` : "—",
      detalhe: entregue.comLeitura ? `${int(entregue.comLeitura)} ${entregue.comLeitura === 1 ? "contrato conferido" : "contratos conferidos"} pelo Instagram` : "Ainda sem leitura do Instagram",
    },
    ...TIPOS_ENTREGA.map((t) => {
      const Icone = ICONE_ENTREGA[t.id];
      return { id: t.id, rotulo: `${t.rotulo} por mês`, valor: int(resumo[t.id]), icone: <Icone className="h-3.5 w-3.5" aria-hidden />, detalhe: "combinados nos contratos em vigor" } satisfies ItemKpi;
    }),
    { id: "unidades", rotulo: "Unidades com influenciador", valor: int(resumo.unidades), icone: <Building2 className="h-3.5 w-3.5" aria-hidden />, detalhe: "com contrato em vigor" },
  ];
  const carregando = lista === null && !erro;

  return (
    <div className="space-y-6">
      {!carregando && !erro && lista!.length > 0 && <FaixaKpi itens={itens} rotulo={unit ? `Contratos dos influenciadores, ${unit}` : "Contratos dos influenciadores da rede"} />}

      {editando && podeCadastrar && (
        <ChartCard title={editando === "novo" ? "Novo influenciador" : `Editar @${editando.usuario}`} subtitle="O que foi combinado por mês no contrato. A quantidade de cada tipo vale para cada mês do período.">
          <Formulario
            inicial={editando === "novo" ? null : editando}
            unidadeInicial={editando === "novo" ? unit : null}
            amplo={amplo}
            proprias={proprias}
            onSalvo={() => { setEditando(null); void carregar(); }}
            onCancelar={() => setEditando(null)}
          />
        </ChartCard>
      )}

      <section aria-label="Contratos dos influenciadores" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Contratos dos influenciadores</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{unit ? `Unidade escolhida: ${unit}` : "Todas as unidades"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {daEscolha.length > 0 && (
              <div role="group" aria-label="Mês das entregas" className="inline-flex max-w-full overflow-x-auto rounded-full border border-border bg-white p-0.5">
                {([["atual", "Este mês"], ["anterior", "Mês passado"]] as const).map(([id, rotulo]) => (
                  <button key={id} type="button" aria-pressed={mesVisto === id} onClick={() => setMesVisto(id)} className={cn("shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", mesVisto === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{rotulo}</button>
                ))}
              </div>
            )}
            {daEscolha.length > 0 && (
              <div role="group" aria-label="Filtrar por situação do contrato" className="inline-flex max-w-full overflow-x-auto rounded-full border border-border bg-white p-0.5">
                {FILTROS.map((f) => (
                  <button key={f.id} type="button" aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)} className={cn("shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", filtro === f.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{f.rotulo}</button>
                ))}
              </div>
            )}
            {podeCadastrar && !editando && <Button size="sm" onClick={() => setEditando("novo")}><Plus className="h-4 w-4" aria-hidden />Novo influenciador</Button>}
          </div>
        </div>

        {erro ? <p role="alert" className="text-sm text-destructive">{erro}</p>
          : carregando ? <p className="text-sm text-muted-foreground">Carregando...</p>
          : visiveis.length === 0 ? (
            <ChartEmpty>
              {daEscolha.length === 0
                ? (podeCadastrar ? "Nenhum influenciador cadastrado para este filtro. Use Novo influenciador para começar." : "Nenhum influenciador cadastrado.")
                : "Nenhum contrato nesta situação."}
            </ChartEmpty>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visiveis.map((i) => <CartaoDoInfluenciador key={i.id} i={i} perfil={perfis[i.usuario] ?? null} entrega={entregasDoMes(i, posts[i.usuario], contas, ym, hoje)} pode={podeCadastrar} onEditar={() => setEditando(i)} onAtivo={() => alternarAtivo(i)} onRemover={() => remover(i)} />)}
            </ul>
          )}
        <p className="text-xs text-muted-foreground">O Atlas lê os posts de cada perfil a cada 4 horas e confere o feed e os reels contra o combinado. Por padrão, só conta o post que cita ou marca a conta da unidade (ou da marca); cada contrato pode mudar isso para qualquer post do perfil. Os stories ainda não são conferidos: a Meta não os entrega para contas de terceiros.</p>
      </section>
    </div>
  );
}

/**
 * O que foi entregue de feed e reels no mês contra o combinado (stories só aparecem como combinado: não são conferidos), com a situação,
 * o que falta e a lista dos posts que contaram. Sem leitura do Instagram, mostra só o combinado.
 */
function EntregasDoCartao({ i, e }: { i: Influenciador; e: EntregasDoMes }) {
  const conferido = e.situacao !== "sem_leitura" && e.situacao !== "desativado" && e.situacao !== "fora";
  const faltam = quantosTextos(e.faltam);
  const deviaTer = quantosTextos(e.esperado);
  const dia = (iso: string | null) => (iso ? `${diaDeBrasilia(iso).slice(8)}/${diaDeBrasilia(iso).slice(5, 7)}` : "");
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p className="text-[11px] text-muted-foreground">{conferido ? `Entregas de ${nomeDoMes(e.ym)}${e.parcial ? " (até hoje)" : ""}` : "Combinado por mês"}</p>
        {e.situacao !== "fora" && <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", COR_SITUACAO_MES[e.situacao])}>{ROTULO_SITUACAO_MES[e.situacao]}</span>}
      </div>
      <ul className="grid grid-cols-3 gap-2">
        {TIPOS_ENTREGA.map((t) => {
          const Icone = ICONE_ENTREGA[t.id];
          const meta = e.metas[t.id];
          const feito = t.id === "stories" ? null : e.feitas[t.id];
          const mostraFeito = conferido && feito !== null;
          const cheio = mostraFeito && meta > 0 && (feito as number) >= meta;
          return (
            <li key={t.id} className={cn("rounded-xl bg-secondary/60 px-3 py-2", meta === 0 && "opacity-40")}>
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Icone className="h-3 w-3" aria-hidden />{ROTULO_ENTREGA[t.id]}</p>
              <p className="mt-0.5 flex items-baseline gap-1">
                <span className={cn("font-display text-2xl font-semibold leading-none tabular-nums", cheio ? "text-success" : "text-foreground")}>{int(mostraFeito ? (feito as number) : meta)}</span>
                {mostraFeito && <span className="text-sm tabular-nums text-muted-foreground">/ {int(meta)}</span>}
              </p>
              {mostraFeito && meta > 0 && (
                <div className="mt-1.5 h-1 rounded-full bg-background" role="img" aria-label={`${feito} de ${meta}`}>
                  <div className={cn("h-full rounded-full", cheio ? "bg-success" : "bg-primary")} style={{ width: `${Math.min(100, ((feito as number) / meta) * 100)}%` }} />
                </div>
              )}
              {t.id === "stories" && meta > 0 && conferido && <p className="mt-1 text-[10px] leading-tight text-muted-foreground">combinado, não conferido</p>}
            </li>
          );
        })}
      </ul>
      {conferido && e.situacao === "atrasado" && <p className="mt-2 text-xs text-foreground">Faltam {faltam}. No ritmo do contrato, já deveriam ter saído {deviaTer}.</p>}
      {conferido && e.situacao === "no_ritmo" && faltam && <p className="mt-2 text-xs text-muted-foreground">Faltam {faltam} até o fim do mês.</p>}
      {conferido && e.situacao === "nao_cumprido" && <p className="mt-2 text-xs text-foreground">Faltaram {faltam}.</p>}
      {e.situacao === "sem_leitura" && i.ativo && <p className="mt-2 text-xs text-muted-foreground">O Atlas ainda não leu os posts deste perfil. A próxima atualização (a cada 4 horas) traz.</p>}
      {conferido && e.semCitar > 0 && (i.contagem ?? "marcando") === "marcando" && (
        <p className="mt-2 text-xs text-warning">{e.semCitar} {e.semCitar === 1 ? "post do perfil neste mês não cita nem marca a unidade e não entra na conta." : "posts do perfil neste mês não citam nem marcam a unidade e não entram na conta."}</p>
      )}
      {conferido && e.contam.length > 0 && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer select-none font-medium text-foreground hover:underline">Ver {e.contam.length === 1 ? "o post que contou" : `os ${e.contam.length} posts que contaram`}</summary>
          <ul className="mt-1.5 divide-y divide-border rounded-lg border border-border">
            {e.contam.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                <span className="min-w-0 truncate"><span className="tabular-nums text-muted-foreground">{dia(p.data)}</span> · {p.tipo === "reels" ? "Reel" : "Feed"}{p.legenda ? <span className="text-muted-foreground"> · {p.legenda}</span> : null}</span>
                {p.link && <a href={p.link} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Ver<ExternalLink className="h-3 w-3" aria-hidden /><span className="sr-only"> no Instagram</span></a>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** Um contrato: quem é, em que unidade, o que foi combinado por mês e em que ponto do prazo estamos. */
export function CartaoDoInfluenciador({ i, perfil, entrega, pode, onEditar, onAtivo, onRemover }: { i: Influenciador; perfil: PerfilInfluenciador | null; entrega: EntregasDoMes; pode: boolean; onEditar: () => void; onAtivo: () => void; onRemover: () => void }) {
  const sit = situacaoDoContrato(i);
  const and = andamentoDoContrato(i);
  const apagado = sit === "encerrado" || sit === "inativo";
  const [foto, setFoto] = useState<string | null>(null);
  const temFoto = Boolean(perfil?.foto);
  useEffect(() => {
    let vivo = true;
    if (temFoto) fotoDoPerfil(i.usuario).then((u) => vivo && setFoto(u));
    return () => { vivo = false; };
  }, [i.usuario, temFoto]);
  // O texto do andamento já diz as datas de um contrato em vigor com início ou fim sozinhos; o período só entra quando acrescenta algo.
  const mostrarPeriodo = Boolean(i.inicio || i.fim) && !(sit === "vigente" && !(i.inicio && i.fim));
  return (
    <li className={cn("card-surface flex min-w-0 flex-col gap-4 p-4", apagado && "bg-secondary/30")}>
      <div className="flex items-start gap-3">
        <Avatar foto={foto} nome={i.usuario} />
        <div className="min-w-0 flex-1">
          <a href={`https://www.instagram.com/${i.usuario}/`} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 rounded text-sm font-semibold text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="truncate">@{i.usuario}</span><ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden /><span className="sr-only"> (abre o Instagram)</span>
          </a>
          <p className="truncate text-xs text-muted-foreground">{i.nome ? `${i.nome} · ` : ""}{i.unidade ?? "Rede toda (Institucional)"}</p>
          {perfil && perfil.seguidores != null && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums" title={`${perfil.seguidores.toLocaleString("pt-BR")} seguidores${perfil.publicacoes != null ? ` · ${perfil.publicacoes.toLocaleString("pt-BR")} publicações` : ""}`}>
              <Users className="h-3 w-3" aria-hidden /><span><b className="font-semibold text-foreground">{seguidoresCompacto(perfil.seguidores)}</b> seguidores</span>
            </p>
          )}
          {perfil?.erro && <p className="mt-0.5 text-[11px] text-warning" title={perfil.erro}>Perfil não lido: conta pessoal ou privada?</p>}
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", COR_SITUACAO[sit])}>{ROTULO_SITUACAO[sit]}</span>
      </div>

      <EntregasDoCartao i={i} e={entrega} />

      <div>
        {and.pct !== null && (
          <div className="mb-1.5 h-1.5 rounded-full bg-secondary" role="img" aria-label={`${and.pct}% do prazo do contrato`}>
            <div className={cn("h-full rounded-full", apagado ? "bg-foreground/30" : "bg-primary")} style={{ width: `${and.pct}%` }} />
          </div>
        )}
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
          <span className="font-medium text-foreground">{and.texto}</span>
          {mostrarPeriodo && <span className="text-muted-foreground">{vigencia(i)}</span>}
        </p>
        {i.obs && <p className="mt-2 text-xs text-muted-foreground">{i.obs}</p>}
      </div>

      {pode && (
        <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-3">
          <Button size="sm" variant="outline" onClick={onEditar}>Editar</Button>
          <Button size="sm" variant="outline" onClick={onAtivo}>{i.ativo ? "Desativar" : "Reativar"}</Button>
          <Button size="sm" variant="ghost" onClick={onRemover}>Remover</Button>
        </div>
      )}
    </li>
  );
}

function Formulario({ inicial, unidadeInicial, amplo, proprias, onSalvo, onCancelar }: { inicial: Influenciador | null; unidadeInicial: string | null; amplo: boolean; proprias: string[] | null; onSalvo: () => void; onCancelar: () => void }) {
  const unidades = useMemo(() => proprias ?? getAvailableUnits(), [proprias]);
  const [usuario, setUsuario] = useState(inicial?.usuario ?? "");
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [unidade, setUnidade] = useState<string>(inicial ? inicial.unidade ?? REDE : unidadeInicial ?? (unidades.length === 1 && !amplo ? unidades[0] : ""));
  const [inicio, setInicio] = useState(inicial?.inicio ?? "");
  const [fim, setFim] = useState(inicial?.fim ?? "");
  const [qtd, setQtd] = useState({ stories: String(inicial?.entregas.stories ?? ""), feed: String(inicial?.entregas.feed ?? ""), reels: String(inicial?.entregas.reels ?? "") });
  const [obs, setObs] = useState(inicial?.obs ?? "");
  const [contagem, setContagem] = useState<"marcando" | "qualquer">(inicial?.contagem ?? "marcando");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    if (!unidade) { setErro(amplo ? "Escolha a unidade do contrato (ou Rede toda)." : "Escolha a unidade do contrato."); return; }
    const campos: CamposInfluenciador = {
      usuario, nome: nome.trim() || undefined, unidade: unidade === REDE ? null : unidade, inicio: inicio || null, fim: fim || null,
      entregas: { stories: Number(qtd.stories || 0), feed: Number(qtd.feed || 0), reels: Number(qtd.reels || 0) },
      obs: obs.trim() || undefined, contagem, ativo: inicial?.ativo ?? true,
    };
    setEnviando(true);
    setErro("");
    const r = inicial ? await atualizarInfluenciador(inicial.id, campos) : await criarInfluenciador(campos);
    setEnviando(false);
    if (!r.ok) { setErro(r.erro); return; }
    toast({ title: inicial ? "Contrato atualizado" : `@${r.dados.influenciador.usuario} cadastrado` });
    onSalvo();
  };

  return (
    <form onSubmit={enviar} className="mt-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="space-y-1.5 text-sm font-medium text-foreground">@ do Instagram<input className={campo} value={usuario} onChange={(e) => setUsuario(e.target.value)} required maxLength={80} autoComplete="off" placeholder="@nomedoperfil" /></label>
        <label className="space-y-1.5 text-sm font-medium text-foreground">Nome <span className="font-normal text-muted-foreground">(opcional)</span><input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} autoComplete="off" /></label>
        <label className="space-y-1.5 text-sm font-medium text-foreground">Unidade
          <Select value={unidade} onChange={(e) => setUnidade(e.target.value)} required>
            <option value="">Escolha...</option>
            {amplo && <option value={REDE}>Rede toda (Institucional)</option>}
            {unidades.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm font-medium text-foreground">Início do contrato <span className="font-normal text-muted-foreground">(vazio = sem data de início)</span><input className={campo} type="date" value={inicio} max={fim || undefined} onChange={(e) => setInicio(e.target.value)} /></label>
        <label className="space-y-1.5 text-sm font-medium text-foreground">Fim do contrato <span className="font-normal text-muted-foreground">(vazio = sem data de fim)</span><input className={campo} type="date" value={fim} min={inicio || undefined} onChange={(e) => setFim(e.target.value)} /></label>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">Combinado por mês</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          {TIPOS_ENTREGA.map((t) => (
            <label key={t.id} className="space-y-1.5 text-sm text-foreground">{t.rotulo}
              <input className={campo} type="number" inputMode="numeric" min={0} max={999} step={1} value={qtd[t.id]} onChange={(e) => setQtd({ ...qtd, [t.id]: e.target.value })} placeholder="0" />
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block space-y-1.5 text-sm font-medium text-foreground">O que conta como entrega de feed e reels
        <Select value={contagem} onChange={(e) => setContagem(e.target.value as "marcando" | "qualquer")}>
          <option value="marcando">Só post que cita ou marca a unidade (ou a marca) — recomendado</option>
          <option value="qualquer">Qualquer post do perfil</option>
        </Select>
        <span className="block text-xs font-normal text-muted-foreground">Os stories ainda não são conferidos pelo Atlas.</span>
      </label>
      <label className="block space-y-1.5 text-sm font-medium text-foreground">Observação <span className="font-normal text-muted-foreground">(opcional, até 200 caracteres)</span>
        <input className={campo} value={obs} onChange={(e) => setObs(e.target.value)} maxLength={200} autoComplete="off" />
      </label>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={enviando}>{enviando ? "Salvando..." : inicial ? "Salvar alterações" : "Cadastrar"}</Button>
        <Button type="button" variant="ghost" onClick={onCancelar}>Cancelar</Button>
      </div>
    </form>
  );
}
