import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ExternalLink, Plus } from "lucide-react";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ehDono } from "@/lib/auth";
import { getAvailableUnits } from "@/data/dashboardData";
import {
  atualizarInfluenciador, criarInfluenciador, dasUnidades, listarInfluenciadores, ordenarInfluenciadores, removerInfluenciador,
  ROTULO_SITUACAO, situacaoDoContrato, textoEntregas, TIPOS_ENTREGA, vigencia,
  type CamposInfluenciador, type Influenciador, type SituacaoContrato,
} from "@/data/influenciadores";

const campo = "h-10 w-full rounded-xl border border-input bg-white px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring";
const REDE = "__rede__";
const COR_SITUACAO: Record<SituacaoContrato, string> = {
  vigente: "bg-emerald-50 text-emerald-700",
  futuro: "bg-amber-50 text-amber-700",
  encerrado: "bg-secondary text-muted-foreground",
  inativo: "bg-secondary text-muted-foreground",
};

/**
 * Marketing > Influenciadores: os contratos dos influenciadores da rede (o @, a unidade e o que foi combinado por mês).
 * Todos veem a lista (quem tem acesso por unidades, só a da sua unidade); só o dono cadastra e altera.
 * Próximas etapas: comparar com o que foi postado (feed e reels pelo @, stories pela marcação da unidade).
 */
export function InfluenciadoresTab({ unit }: { unit: string | null }) {
  const dono = ehDono();
  const [lista, setLista] = useState<Influenciador[] | null>(null);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState<Influenciador | "novo" | null>(null);

  const carregar = useCallback(async () => {
    const r = await listarInfluenciadores();
    if (r.ok) { setLista(Array.isArray(r.dados.influenciadores) ? r.dados.influenciadores : []); setErro(""); } else setErro(r.erro);
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const visiveis = useMemo(() => ordenarInfluenciadores(dasUnidades(lista ?? [], unit)), [lista, unit]);

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

  return (
    <div className="space-y-6">
      {editando && dono && (
        <ChartCard title={editando === "novo" ? "Novo influenciador" : `Editar @${editando.usuario}`} subtitle="O que foi combinado por mês no contrato. A quantidade de cada tipo vale para cada mês do período.">
          <Formulario
            inicial={editando === "novo" ? null : editando}
            unidadeInicial={editando === "novo" ? unit : null}
            onSalvo={() => { setEditando(null); void carregar(); }}
            onCancelar={() => setEditando(null)}
          />
        </ChartCard>
      )}
      <ChartCard
        title="Contratos dos influenciadores"
        subtitle={unit ? `Unidade escolhida: ${unit}` : "Todas as unidades"}
        legend={dono && !editando ? <Button size="sm" onClick={() => setEditando("novo")}><Plus className="h-4 w-4" aria-hidden />Novo influenciador</Button> : undefined}
      >
        {erro ? <p role="alert" className="text-sm text-destructive">{erro}</p>
          : lista === null ? <p className="text-sm text-muted-foreground">Carregando...</p>
          : visiveis.length === 0 ? (
            <ChartEmpty>{dono ? "Nenhum influenciador cadastrado para este filtro. Use Novo influenciador para começar." : "Nenhum influenciador cadastrado para a sua unidade."}</ChartEmpty>
          ) : (
            <ul className="divide-y divide-border">
              {visiveis.map((i) => <Linha key={i.id} i={i} dono={dono} onEditar={() => setEditando(i)} onAtivo={() => alternarAtivo(i)} onRemover={() => remover(i)} />)}
            </ul>
          )}
        <p className="mt-4 text-xs text-muted-foreground">Por enquanto são só os contratos. Em breve o Atlas passa a conferir o que cada influenciador postou (feed, reels e stories) contra o que foi combinado.</p>
      </ChartCard>
    </div>
  );
}

function Linha({ i, dono, onEditar, onAtivo, onRemover }: { i: Influenciador; dono: boolean; onEditar: () => void; onAtivo: () => void; onRemover: () => void }) {
  const sit = situacaoDoContrato(i);
  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <a href={`https://www.instagram.com/${i.usuario}/`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
            @{i.usuario}<ExternalLink className="h-3 w-3 text-muted-foreground" aria-hidden /><span className="sr-only"> (abre o Instagram)</span>
          </a>
          {i.nome && <span className="text-muted-foreground">{i.nome}</span>}
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${COR_SITUACAO[sit]}`}>{ROTULO_SITUACAO[sit]}</span>
        </p>
        <p className="text-xs text-muted-foreground">{i.unidade ?? "Rede toda (Institucional)"} · {vigencia(i)}</p>
        <p className="text-sm text-foreground">{textoEntregas(i.entregas)}</p>
        {i.obs && <p className="text-xs text-muted-foreground">{i.obs}</p>}
      </div>
      {dono && (
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onEditar}>Editar</Button>
          <Button size="sm" variant="outline" onClick={onAtivo}>{i.ativo ? "Desativar" : "Reativar"}</Button>
          <Button size="sm" variant="ghost" onClick={onRemover}>Remover</Button>
        </div>
      )}
    </li>
  );
}

function Formulario({ inicial, unidadeInicial, onSalvo, onCancelar }: { inicial: Influenciador | null; unidadeInicial: string | null; onSalvo: () => void; onCancelar: () => void }) {
  const unidades = useMemo(() => getAvailableUnits(), []);
  const [usuario, setUsuario] = useState(inicial?.usuario ?? "");
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [unidade, setUnidade] = useState<string>(inicial ? inicial.unidade ?? REDE : unidadeInicial ?? "");
  const [inicio, setInicio] = useState(inicial?.inicio ?? "");
  const [fim, setFim] = useState(inicial?.fim ?? "");
  const [qtd, setQtd] = useState({ stories: String(inicial?.entregas.stories ?? ""), feed: String(inicial?.entregas.feed ?? ""), reels: String(inicial?.entregas.reels ?? "") });
  const [obs, setObs] = useState(inicial?.obs ?? "");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    if (!unidade) { setErro("Escolha a unidade do contrato (ou Rede toda)."); return; }
    const campos: CamposInfluenciador = {
      usuario, nome: nome.trim() || undefined, unidade: unidade === REDE ? null : unidade, inicio: inicio || null, fim: fim || null,
      entregas: { stories: Number(qtd.stories || 0), feed: Number(qtd.feed || 0), reels: Number(qtd.reels || 0) },
      obs: obs.trim() || undefined, ativo: inicial?.ativo ?? true,
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
            <option value={REDE}>Rede toda (Institucional)</option>
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
