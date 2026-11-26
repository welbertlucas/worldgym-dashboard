// Fases e tarefas da implantação de uma obra (só dono e Master; o servidor confere). Cada mudança é gravada na hora, uma por vez.
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE, authFetch } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  type Fase, type ModeloObra, type ResumoModelo, type ResumoTarefas, type SituacaoTarefa, type Tarefa,
  NOME_MODELO, dataBR, filtrarFases, fimPelaDuracao, hojeLocal, progressoFase, situacaoTarefa,
} from "@/lib/obras";

type Resposta = { fases: Fase[]; modelo: ModeloObra | null; resumo?: ResumoTarefas };

const campo = "h-8 w-full rounded-md border border-border bg-background px-2 text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring";
const SELO: Record<SituacaoTarefa, { texto: string; classe: string }> = {
  feita: { texto: "Concluída", classe: "bg-success/10 text-success" },
  atrasada: { texto: "Atrasada", classe: "bg-destructive/10 text-destructive" },
  andamento: { texto: "Em andamento", classe: "bg-primary/10 text-primary-ink" },
  "a-fazer": { texto: "A fazer", classe: "bg-muted text-muted-foreground" },
};

/** Uma linha de tarefa: edita no lugar e grava ao sair do campo (texto) ou ao mudar (datas e conclusão). */
export function TarefaLinha({ t, hoje, salvar, apagar }: { t: Tarefa; hoje: string; salvar: (t: Tarefa) => void; apagar: () => void }) {
  const [d, setD] = useState(t);
  // só reescreve o rascunho quando o conteúdo gravado muda (uma resposta do servidor traz objetos novos para todas as linhas)
  const gravado = JSON.stringify(t);
  useEffect(() => { setD(JSON.parse(gravado) as Tarefa); }, [gravado]);
  const gravar = (novo: Tarefa) => { setD(novo); if (JSON.stringify(novo) !== JSON.stringify(t)) salvar(novo); };
  /** Mudou o início ou a duração: o fim acompanha, a menos que ele tenha sido mudado à mão. */
  const comFim = (novo: Tarefa) => (t.fim === null || t.fim === fimPelaDuracao(t.inicio, t.dias) ? { ...novo, fim: fimPelaDuracao(novo.inicio, novo.dias) } : novo);
  const s = situacaoTarefa(d, hoje);
  return (
    <div className="grid grid-cols-[1.5rem_1fr_2rem] items-center gap-x-2 gap-y-1 border-t border-border/60 px-2 py-1.5 lg:grid-cols-[1.5rem_minmax(0,1fr)_9rem_4.5rem_8.5rem_8.5rem_6.5rem_2rem]">
      <input type="checkbox" checked={Boolean(d.feito)} onChange={(e) => gravar({ ...d, feito: e.target.checked ? hoje : null })} aria-label={`Concluída: ${d.nome}`} className="h-4 w-4 accent-[hsl(var(--primary))]" title={d.feito ? `Concluída em ${dataBR(d.feito)}` : "Marcar como concluída hoje"} />
      <input value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} onBlur={() => d.nome.trim() ? gravar({ ...d, nome: d.nome.trim() }) : setD(t)} maxLength={120} aria-label="Tarefa" className={cn(campo, "border-transparent bg-transparent font-medium", d.feito && "text-muted-foreground line-through")} />
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 lg:order-last" aria-label={`Apagar a tarefa ${d.nome}`} onClick={apagar}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
      <div className="col-span-3 grid grid-cols-2 gap-2 sm:grid-cols-5 lg:col-span-1 lg:contents">
        <input value={d.resp} onChange={(e) => setD({ ...d, resp: e.target.value })} onBlur={() => gravar({ ...d, resp: d.resp.trim() })} maxLength={60} placeholder="Responsável" aria-label={`Responsável: ${d.nome}`} className={campo} />
        <label className="flex items-center gap-1 text-[11px] text-muted-foreground"><input type="number" min={1} max={999} value={d.dias ?? ""} onChange={(e) => setD({ ...d, dias: e.target.value === "" ? null : Number(e.target.value) })} onBlur={() => gravar(comFim(d))} aria-label={`Duração em dias: ${d.nome}`} className={cn(campo, "px-1.5 text-right")} />d</label>
        <input type="date" value={d.inicio ?? ""} onChange={(e) => gravar(comFim({ ...d, inicio: e.target.value || null }))} aria-label={`Início: ${d.nome}`} className={campo} />
        <input type="date" value={d.fim ?? ""} min={d.inicio ?? undefined} onChange={(e) => gravar({ ...d, fim: e.target.value || null })} aria-label={`Fim: ${d.nome}`} className={cn(campo, s === "atrasada" && "border-destructive text-destructive")} />
        <span className={cn("justify-self-start whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", SELO[s].classe)}>{s === "feita" && d.feito ? `Feita ${dataBR(d.feito).slice(0, 5)}` : SELO[s].texto}</span>
      </div>
    </div>
  );
}

function NovaTarefa({ criar }: { criar: (nome: string, dias: number | null) => Promise<void> }) {
  const [nome, setNome] = useState("");
  const [dias, setDias] = useState("");
  const ir = async () => { const n = nome.trim(); if (!n) return; await criar(n, dias ? Number(dias) : null); setNome(""); setDias(""); };
  return (
    <div className="flex items-center gap-2 border-t border-border/60 px-2 py-1.5">
      <Plus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <input value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ir(); }} maxLength={120} placeholder="Nova tarefa" aria-label="Nome da nova tarefa" className={campo} />
      <input type="number" min={1} max={999} value={dias} onChange={(e) => setDias(e.target.value)} placeholder="dias" aria-label="Duração da nova tarefa em dias" className={cn(campo, "w-20")} />
      <Button type="button" size="sm" variant="outline" className="h-8" onClick={ir} disabled={!nome.trim()}>Acrescentar</Button>
    </div>
  );
}

/** Fases com as tarefas, filtros e busca. `fases` já vem filtrada; `todas` é a lista completa (para os números da fase). */
export function TarefasLista({ fases, todas, abertas, alternar, hoje, salvarTarefa, apagarTarefa, criarTarefa, renomearFase, apagarFase, versao = 0 }: {
  fases: Fase[]; todas: Fase[]; abertas: Set<string>; alternar: (id: string) => void; hoje: string; /** Muda quando uma gravação falha: as linhas voltam ao que está gravado. */ versao?: number;
  salvarTarefa: (faseId: string, t: Tarefa) => void; apagarTarefa: (faseId: string, t: Tarefa) => void; criarTarefa: (faseId: string, nome: string, dias: number | null) => Promise<void>;
  renomearFase: (f: Fase) => void; apagarFase: (f: Fase) => void;
}) {
  return (
    <div className="space-y-2">
      {fases.map((f) => {
        const cheia = todas.find((x) => x.id === f.id) ?? f;
        const p = progressoFase(cheia), feitas = cheia.tarefas.filter((t) => t.feito).length;
        const atrasadas = cheia.tarefas.filter((t) => situacaoTarefa(t, hoje) === "atrasada").length;
        const aberta = abertas.has(f.id);
        return (
          <div key={f.id} className="overflow-hidden rounded-lg border border-border bg-white">
            <div className="flex items-center gap-2 px-2 py-2">
              <button type="button" onClick={() => alternar(f.id)} aria-expanded={aberta} className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
                {aberta ? <ChevronDown className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />}
                <span className="truncate text-[13px] font-semibold">{f.nome}</span>
                {f.marco && <span className="hidden whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[10.5px] text-muted-foreground sm:inline">{f.marco}</span>}
                {atrasadas > 0 && <span className="whitespace-nowrap rounded-full bg-destructive/10 px-2 py-0.5 text-[10.5px] font-semibold text-destructive">{atrasadas} atrasada{atrasadas > 1 ? "s" : ""}</span>}
              </button>
              <span className="hidden w-28 items-center gap-1.5 sm:flex" aria-label={`${p}% da fase concluída`}><span className="relative h-1.5 flex-1 rounded-full bg-muted"><span className="absolute inset-y-0 left-0 rounded-full bg-success" style={{ width: `${p}%` }} /></span></span>
              <span className="whitespace-nowrap text-[12px] tabular-nums text-muted-foreground">{feitas}/{cheia.tarefas.length}</span>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={`Renomear a fase ${f.nome}`} onClick={() => renomearFase(f)}><Pencil className="h-3.5 w-3.5" aria-hidden /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={`Apagar a fase ${f.nome}`} onClick={() => apagarFase(f)}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
            </div>
            {aberta && (
              <div>
                <div className="hidden grid-cols-[1.5rem_minmax(0,1fr)_9rem_4.5rem_8.5rem_8.5rem_6.5rem_2rem] gap-2 border-t border-border/60 bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground lg:grid"><span /><span>Tarefa</span><span>Responsável</span><span>Duração</span><span>Início</span><span>Fim</span><span>Situação</span><span /></div>
                {f.tarefas.map((t) => <TarefaLinha key={`${t.id}-${versao}`} t={t} hoje={hoje} salvar={(n) => salvarTarefa(f.id, n)} apagar={() => apagarTarefa(f.id, t)} />)}
                <NovaTarefa criar={(nome, dias) => criarTarefa(f.id, nome, dias)} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Painel de fases e tarefas de uma obra: carrega, oferece trazer do modelo quando está vazia e grava cada mudança. */
export function TarefasObra({ obraId, modeloDaObra, modelos, aoMudar }: { obraId: string; modeloDaObra: ModeloObra; modelos: ResumoModelo[]; aoMudar: (r: ResumoTarefas | undefined) => void }) {
  const [fases, setFases] = useState<Fase[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"todas" | "pendentes" | "atrasadas">("todas");
  const [busca, setBusca] = useState("");
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const [modelo, setModelo] = useState<ModeloObra>(modeloDaObra);
  const [ocupado, setOcupado] = useState(false);
  const [novaFase, setNovaFase] = useState("");
  const fila = useRef<Promise<unknown>>(Promise.resolve());
  const naFila = useRef(0);
  const [versao, setVersao] = useState(0);
  const hoje = hojeLocal();

  const post = async (corpo: object): Promise<Resposta> => {
    const res = await authFetch(`${API_BASE}/obras`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    const j = (await res.json().catch(() => ({}))) as Resposta & { error?: string };
    if (!res.ok) throw new Error(j.error ?? "Não consegui salvar agora.");
    return j;
  };
  /** Uma gravação por vez, na ordem em que foram feitas (o servidor lê, muda e grava). */
  // A lista na tela só é trocada pela resposta quando não há outra gravação esperando (senão desfaria o que acabou de ser marcado).
  // Se o servidor recusa, a lista volta ao que está gravado, para a linha não mostrar um valor que não foi salvo.
  const gravar = (corpo: object) => {
    naFila.current += 1;
    const p = fila.current.then(() => post({ obraId, ...corpo })).then((r) => {
      naFila.current -= 1;
      aoMudar(r.resumo); setErro(null);
      if (naFila.current === 0) setFases(r.fases);
      return r;
    }, async (e) => {
      naFila.current -= 1;
      setErro(`${e instanceof Error ? e.message : "Não consegui salvar agora."} A lista voltou ao que está gravado.`);
      const atual = await post({ acao: "tarefas", obraId }).catch(() => null);
      if (atual && naFila.current === 0) setFases(atual.fases);
      setVersao((v) => v + 1);
      throw e;
    });
    fila.current = p.catch(() => {});
    return p;
  };

  useEffect(() => {
    let vivo = true;
    post({ acao: "tarefas", obraId }).then((r) => { if (vivo) { setFases(r.fases); if (r.resumo) aoMudar(r.resumo); } }).catch((e) => { if (vivo) { setErro(e instanceof Error ? e.message : "Não consegui carregar as tarefas."); setFases([]); } });
    return () => { vivo = false; };
  }, [obraId]); // eslint-disable-line react-hooks/exhaustive-deps

  const visiveis = useMemo(() => (fases ? filtrarFases(fases, filtro, busca, hoje) : []), [fases, filtro, busca, hoje]);
  const contagem = useMemo(() => {
    const todas = (fases ?? []).flatMap((f) => f.tarefas);
    return { total: todas.length, feitas: todas.filter((t) => t.feito).length, pendentes: todas.filter((t) => !t.feito).length, atrasadas: todas.filter((t) => situacaoTarefa(t, hoje) === "atrasada").length };
  }, [fases, hoje]);
  // com filtro ou busca, as fases que sobraram ficam abertas
  const abertasAgora = filtro !== "todas" || busca.trim() ? new Set(visiveis.map((f) => f.id)) : abertas;
  const alternar = (id: string) => setAbertas((a) => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  if (fases === null) return <p className="py-6 text-sm text-muted-foreground">Carregando as fases e tarefas…</p>;

  if (!fases.length) {
    const m = modelos.find((x) => x.id === modelo);
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
        <p className="text-sm font-semibold">Esta obra ainda não tem fases e tarefas</p>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-muted-foreground">Traga o roteiro completo de implantação do modelo da unidade: as fases, as tarefas e a duração de cada uma. As datas e os responsáveis você preenche aqui.</p>
        {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}
        {modelos.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <select value={modelo} onChange={(e) => setModelo(e.target.value as ModeloObra)} aria-label="Modelo" className={cn(campo, "w-auto")}>
              {modelos.map((x) => <option key={x.id} value={x.id}>{NOME_MODELO[x.id] ?? x.nome} · {x.tarefas} tarefas</option>)}
            </select>
            <Button disabled={ocupado || !m} onClick={async () => { setOcupado(true); try { await gravar({ acao: "aplicar-modelo", modelo }); } catch { /* erro já mostrado */ } setOcupado(false); }}>{ocupado ? "Trazendo…" : "Trazer fases e tarefas"}</Button>
          </div>
        ) : <p className="mt-3 text-[13px] text-muted-foreground">Nenhum modelo cadastrado ainda.</p>}
        <button type="button" className="mt-3 text-[12px] text-muted-foreground underline" onClick={() => gravar({ acao: "fase-salvar", fase: { nome: "Fase 1" } }).catch(() => {})}>ou começar em branco</button>
      </div>
    );
  }

  const chip = (id: typeof filtro, rotulo: string, n: number) => (
    <button type="button" onClick={() => setFiltro(id)} aria-pressed={filtro === id} className={cn("rounded-full border px-3 py-1 text-[12px]", filtro === id ? "border-primary bg-primary/10 font-semibold text-primary-ink" : "border-border text-muted-foreground hover:text-foreground")}>{rotulo} <span className="tabular-nums">{n}</span></button>
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {chip("todas", "Todas", contagem.total)}
        {chip("pendentes", "Pendentes", contagem.pendentes)}
        {chip("atrasadas", "Atrasadas", contagem.atrasadas)}
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar tarefa ou responsável" aria-label="Buscar tarefa ou responsável" className={cn(campo, "ml-auto w-full sm:w-64")} />
      </div>
      <p className="text-[12px] text-muted-foreground">{contagem.feitas} de {contagem.total} tarefas concluídas ({contagem.total ? Math.round((contagem.feitas / contagem.total) * 100) : 0}%). A duração é em dias corridos; o fim acompanha o início e a duração, e dá para mudar à mão. {filtro === "todas" && !busca.trim() && <button type="button" className="underline" onClick={() => setAbertas(abertas.size ? new Set() : new Set(fases.map((f) => f.id)))}>{abertas.size ? "Fechar todas as fases" : "Abrir todas as fases"}</button>}</p>
      {erro && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
      {visiveis.length ? (
        <TarefasLista fases={visiveis} todas={fases} abertas={abertasAgora} alternar={alternar} hoje={hoje} versao={versao}
          salvarTarefa={(faseId, t) => { gravar({ acao: "tarefa-salvar", faseId, tarefa: t }).catch(() => {}); }}
          apagarTarefa={(faseId, t) => { if (window.confirm(`Apagar a tarefa "${t.nome}"?`)) gravar({ acao: "tarefa-apagar", faseId, tarefaId: t.id }).catch(() => {}); }}
          criarTarefa={async (faseId, nome, dias) => { await gravar({ acao: "tarefa-salvar", faseId, tarefa: { nome, dias, resp: "", inicio: null, fim: null, feito: null } }).catch(() => {}); }}
          renomearFase={(f) => { const n = window.prompt("Nome da fase", f.nome)?.trim(); if (n && n !== f.nome) gravar({ acao: "fase-salvar", fase: { id: f.id, nome: n } }).catch(() => {}); }}
          apagarFase={(f) => { if (window.confirm(`Apagar a fase "${f.nome}" e as ${f.tarefas.length} tarefas dela?`)) gravar({ acao: "fase-apagar", faseId: f.id }).catch(() => {}); }} />
      ) : <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma tarefa {filtro === "atrasadas" ? "atrasada" : filtro === "pendentes" ? "pendente" : ""}{busca.trim() ? " com essa busca" : ""}.</p>}
      {filtro === "todas" && !busca.trim() && (
        <div className="flex items-center gap-2">
          <input value={novaFase} onChange={(e) => setNovaFase(e.target.value)} maxLength={80} placeholder="Nova fase" aria-label="Nome da nova fase" className={cn(campo, "max-w-xs")} />
          <Button type="button" size="sm" variant="outline" className="h-8" disabled={!novaFase.trim()} onClick={() => { gravar({ acao: "fase-salvar", fase: { nome: novaFase.trim() } }).then(() => setNovaFase("")).catch(() => {}); }}><Plus className="mr-1 h-4 w-4" aria-hidden />Acrescentar fase</Button>
        </div>
      )}
    </div>
  );
}
