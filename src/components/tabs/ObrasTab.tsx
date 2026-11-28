import { useEffect, useMemo, useRef, useState } from "react";
import { HardHat, Plus } from "lucide-react";
import { SectionTitle } from "@/components/SectionTitle";
import { Button } from "@/components/ui/button";
import { API_BASE, authFetch } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { TarefasObra } from "@/components/obras/TarefasObra";
import { lerCoordenadas, textoDasCoordenadas } from "@/components/estudos/mapaComum";
import {
  type ModeloObra, type Obra, type ResumoModelo, type ResumoTarefas, NOME_MODELO, dataBR, dataCurta, diasDeAtraso, hojeLocal, inauguracao, obraNova, ordenar, progresso, proximoPasso, resumoDasObras, semRoteiro, situacao, tarefasAtrasadas, usaTarefas,
} from "@/lib/obras";

type Estado = { fase: "carregando" } | { fase: "erro"; motivo: "permissao" | "falha" } | { fase: "pronto"; obras: Obra[]; podeEditar: boolean; podeApagar?: boolean; modelos?: ResumoModelo[] };

/** Pede as obras à API. A permissão é conferida no servidor a cada pedido; dono e Master mudam; só o dono apaga. */
export async function carregarObras(): Promise<Estado> {
  try {
    const res = await authFetch(`${API_BASE}/obras`);
    if (res.status === 403) return { fase: "erro", motivo: "permissao" };
    if (!res.ok) return { fase: "erro", motivo: "falha" };
    const j = (await res.json()) as { obras: Obra[]; podeEditar: boolean; podeApagar?: boolean; modelos?: ResumoModelo[] };
    return { fase: "pronto", obras: j.obras ?? [], podeEditar: Boolean(j.podeEditar), podeApagar: Boolean(j.podeApagar), modelos: j.modelos ?? [] };
  } catch {
    return { fase: "erro", motivo: "falha" };
  }
}

const SELO = {
  atrasada: { texto: "Atrasada", classe: "bg-destructive/10 text-destructive" },
  "no-prazo": { texto: "No prazo", classe: "bg-success/10 text-success" },
  concluida: { texto: "Inaugurada", classe: "bg-muted text-muted-foreground" },
} as const;

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className="card-surface px-4 py-3">
      <p className="text-[12px] text-muted-foreground">{rotulo}</p>
      <p className={cn("font-display text-2xl tabular-nums", destaque && valor > 0 && "text-destructive")}>{valor}</p>
    </div>
  );
}

export function ObrasLista({ obras, abrir, hoje = hojeLocal() }: { obras: Obra[]; abrir: (o: Obra) => void; hoje?: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {ordenar(obras, hoje).map((o) => {
        const s = situacao(o, hoje), selo = SELO[s], prox = proximoPasso(o), atraso = diasDeAtraso(o, hoje), comTarefas = usaTarefas(o);
        const p = progresso(o), tAtrasadas = tarefasAtrasadas(o.tarefas, hoje);
        return (
          <button key={o.id} type="button" onClick={() => abrir(o)}
            className="card-surface flex flex-col gap-2 px-4 py-3 text-left transition hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold">{o.nome}</p>
                <p className="truncate text-[12px] text-muted-foreground">{[o.cidade, NOME_MODELO[o.modelo], o.m2 ? `${o.m2.toLocaleString("pt-BR")} m²` : ""].filter(Boolean).join(" · ")}</p>
              </div>
              <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", selo.classe)}>{selo.texto}</span>
            </div>
            <div className="flex items-center gap-2" aria-label={`${p}% ${comTarefas ? "das tarefas" : "dos marcos"} concluídos`}>
              <span className="relative h-1.5 flex-1 rounded-full bg-muted"><span className={cn("absolute inset-y-0 left-0 rounded-full", s === "atrasada" ? "bg-destructive" : "bg-success")} style={{ width: `${p}%` }} /></span>
              <span className="text-[12px] tabular-nums text-muted-foreground">{p}%</span>
            </div>
            <div className="text-[12px] text-muted-foreground">
              {prox ? <p>Próximo: <span className="font-medium text-foreground">{prox.nome}</span> · {dataCurta(prox.data)}{atraso > 0 && <span className="text-destructive"> · {atraso} {atraso === 1 ? "dia" : "dias"} de atraso</span>}</p>
                : prox === null ? <p>{comTarefas ? "Todas as tarefas concluídas" : "Todos os marcos concluídos"}</p>
                : semRoteiro(o) ? <p>Sem fases e tarefas: abra a obra para trazer o roteiro do modelo.</p>
                : atraso > 0 ? <p className="text-destructive">{atraso} {atraso === 1 ? "dia" : "dias"} de atraso</p> : null}
              <p>Inauguração {s === "concluida" ? "em" : "prevista:"} <span className="font-medium text-foreground">{dataBR(inauguracao(o))}</span></p>
              {comTarefas && o.tarefas && <p>Tarefas: <span className="font-medium text-foreground">{o.tarefas.concluidas} de {o.tarefas.total}</span>{tAtrasadas > 0 && <span className="text-destructive"> · {tAtrasadas} atrasada{tAtrasadas > 1 ? "s" : ""}</span>}</p>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

const campo = "h-9 w-full rounded-md border border-border bg-background px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-muted/40 disabled:text-muted-foreground";

function ObraDialog({ inicial, podeEditar, podeApagar = false, existe, modelos = [], salvar, apagar, fechar, aoMudarTarefas }: { inicial: Obra; podeEditar: boolean; podeApagar?: boolean; existe: boolean; modelos?: ResumoModelo[]; salvar: (o: Obra, comModelo: boolean) => Promise<void>; apagar: (id: string) => Promise<void>; fechar: () => void; aoMudarTarefas?: (r: ResumoTarefas | undefined) => void }) {
  const [o, setO] = useState<Obra>(inicial);
  const [aba, setAba] = useState<"dados" | "tarefas">("dados");
  const [comModelo, setComModelo] = useState(true);
  const [resumoT, setResumoT] = useState(inicial.tarefas);
  const modeloEscolhido = modelos.find((m) => m.id === o.modelo);
  /** Obra que anda pelas fases e tarefas: não mostra marcos. */
  /** A obra já tem fases e tarefas: o modelo fica travado. */
  const comRoteiroSalvo = existe && usaTarefas({ ...o, tarefas: resumoT });
  // obra nova salva com o roteiro do modelo: a janela continua aberta e vai direto para as tarefas
  const jaExistia = useRef(existe);
  useEffect(() => { if (existe && !jaExistia.current) { jaExistia.current = true; setAba("tarefas"); } }, [existe]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [achando, setAchando] = useState(false);
  const [achado, setAchado] = useState<string | null>(null);
  /** Busca a posição do endereço (o mesmo serviço de mapas dos Estudos de ponto) e guarda a posição na obra. */
  const acharNoMapa = async () => {
    const q = [o.endereco, o.cidade].filter(Boolean).join(", ").trim();
    if (!q) { setErro("Informe o endereço ou a cidade da obra para achar a posição."); return; }
    // coordenadas no campo do endereço ("-12.255347, -38.976201"): usa direto, sem buscar
    const coord = lerCoordenadas(o.endereco ?? "");
    if (coord) { setErro(null); setO((x) => ({ ...x, c: coord })); setAchado(`Coordenadas ${textoDasCoordenadas(coord)}`); return; }
    setErro(null); setAchando(true); setAchado(null);
    try {
      const r = await authFetch(`${API_BASE}/estudos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "geocodificar-lote", itens: [{ i: 0, q }] }) });
      const j = (await r.json().catch(() => ({}))) as { resultados?: { lugar: { endereco: string; c: [number, number] } | null }[]; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Não consegui buscar o endereço agora.");
      const lugar = j.resultados?.[0]?.lugar;
      if (!lugar) setErro("Não achei esse endereço. Acrescente a cidade ou o bairro e tente de novo.");
      else { setO((x) => ({ ...x, c: lugar.c })); setAchado(lugar.endereco); }
    } catch (e) { setErro(e instanceof Error ? e.message : "Não consegui buscar o endereço agora."); }
    setAchando(false);
  };
  const ler = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setO((x) => ({ ...x, [e.target.name]: e.target.name === "m2" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value }));
  const guardar = async () => {
    setErro(null); setOcupado(true);
    const comRoteiro = !existe && comModelo && Boolean(modeloEscolhido);
    // obra com o roteiro do modelo não usa marcos: as fases e tarefas fazem esse papel
    try { await salvar({ ...o, marcos: [] }, comRoteiro); setOcupado(false); } catch (e) { setErro(e instanceof Error ? e.message : "Não consegui salvar agora."); setOcupado(false); }
  };
  const excluir = async () => {
    if (!window.confirm(`Apagar a obra ${o.nome || "sem nome"}? Isso não pode ser desfeito.`)) return;
    setErro(null); setOcupado(true);
    try { await apagar(o.id); } catch (e) { setErro(e instanceof Error ? e.message : "Não consegui apagar agora."); setOcupado(false); }
  };
  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Obra">
      <div className={cn("max-h-[92vh] w-full overflow-y-auto rounded-xl border border-border bg-white p-5 shadow-xl", aba === "tarefas" ? "max-w-6xl" : "max-w-3xl")}>
        <div className="flex items-start justify-between gap-3">
          <div><h3 className="font-display text-xl font-medium">{existe ? o.nome || "Obra" : "Nova obra"}</h3><p className="text-sm text-muted-foreground">{!podeEditar ? "Só o dono e o Master mudam as obras; aqui você consulta." : aba === "tarefas" ? "O roteiro da implantação: cada mudança é gravada na hora." : "A situação e a inauguração prevista saem das fases e tarefas."}</p></div>
          <Button variant="ghost" onClick={fechar}>Fechar</Button>
        </div>
        {existe && podeEditar && (
          <div className="mt-3 flex gap-1 border-b border-border" role="tablist">
            {([["dados", "Dados da obra"], ["tarefas", `Fases e tarefas${resumoT?.total ? ` (${resumoT.concluidas}/${resumoT.total})` : ""}`]] as const).map(([id, rotulo]) => (
              <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)} className={cn("-mb-px border-b-2 px-3 py-2 text-[13px]", aba === id ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{rotulo}</button>
            ))}
          </div>
        )}
        {aba === "tarefas" && existe && podeEditar ? (
          <div className="mt-4"><TarefasObra obraId={o.id} modeloDaObra={o.modelo} modelos={modelos} aoMudar={(r) => { setResumoT(r); aoMudarTarefas?.(r); }} /></div>
        ) : (<>
        {erro && <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-[12px] text-muted-foreground">Unidade<input name="nome" value={o.nome} onChange={ler} disabled={!podeEditar} maxLength={60} className={campo} placeholder="Nome da unidade" /></label>
          <label className="text-[12px] text-muted-foreground">Cidade<input name="cidade" value={o.cidade} onChange={ler} disabled={!podeEditar} maxLength={60} className={campo} placeholder="Cidade e estado" /></label>
          <label className="text-[12px] text-muted-foreground">Modelo
            <select name="modelo" value={o.modelo} onChange={ler} disabled={!podeEditar || comRoteiroSalvo} title={comRoteiroSalvo ? "A obra já tem as fases e tarefas deste modelo" : undefined} className={campo}>{(Object.keys(NOME_MODELO) as ModeloObra[]).map((m) => <option key={m} value={m}>{NOME_MODELO[m]}</option>)}</select></label>
          {!existe && podeEditar && modeloEscolhido && (
            <label className="flex items-start gap-2 text-[13px] text-foreground sm:col-span-2">
              <input type="checkbox" checked={comModelo} onChange={(e) => setComModelo(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" />
              <span>Já criar com as fases e tarefas do modelo {NOME_MODELO[o.modelo]} <span className="block text-xs text-muted-foreground">{modeloEscolhido.fases} fases e {modeloEscolhido.tarefas} tarefas, com a duração de cada uma. As datas e os responsáveis você preenche depois, na aba Fases e tarefas.</span></span>
            </label>
          )}
          <label className="text-[12px] text-muted-foreground">Área (m²)<input name="m2" type="number" min={1} max={20000} value={o.m2 ?? ""} onChange={ler} disabled={!podeEditar} className={campo} /></label>
          <label className="text-[12px] text-muted-foreground sm:col-span-2">Endereço da obra (para pôr a unidade no mapa da rede)
            <div className="flex gap-2">
              <input name="endereco" value={o.endereco ?? ""} onChange={(e) => { ler(e); setAchado(null); }} disabled={!podeEditar} maxLength={160} className={campo} placeholder="Rua, número e bairro (ou coordenadas)" />
              {podeEditar && <Button type="button" variant="outline" className="h-9 shrink-0" onClick={acharNoMapa} disabled={achando}>{achando ? "Buscando…" : "Achar no mapa"}</Button>}
            </div>
            <span className="mt-1 block text-[12px]">{o.c ? (achado ? `Posição marcada: ${achado}` : "Posição marcada no mapa da rede.") : "Sem posição: a obra não aparece no mapa da rede."}{podeEditar && o.c && <button type="button" className="ml-2 underline" onClick={() => { setO((x) => ({ ...x, c: null })); setAchado(null); }}>Tirar</button>}</span>
          </label>
          <label className="text-[12px] text-muted-foreground sm:col-span-2">Responsável pela obra<input name="responsavel" value={o.responsavel} onChange={ler} disabled={!podeEditar} maxLength={60} className={campo} /></label>
        </div>
        <label className="mt-4 block text-[12px] text-muted-foreground">Observações<textarea name="obs" value={o.obs} onChange={ler} disabled={!podeEditar} maxLength={600} rows={3} className={cn(campo, "h-auto py-2")} /></label>
        {podeEditar && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <Button onClick={guardar} disabled={ocupado || !o.nome.trim()}>{ocupado ? "Salvando…" : "Salvar"}</Button>
            {existe && podeApagar && <Button variant="outline" onClick={excluir} disabled={ocupado} className="text-destructive">Apagar obra</Button>}
          </div>
        )}
        </>)}
      </div>
    </div>
  );
}

export function ObrasConteudo({ estado, abrir, nova, hoje }: { estado: Estado; abrir: (o: Obra) => void; nova: () => void; hoje?: string }) {
  if (estado.fase === "carregando") return <p className="text-sm text-muted-foreground">Carregando as obras…</p>;
  if (estado.fase === "erro") return <p className="rounded-xl border bg-white p-6 text-sm text-muted-foreground">{estado.motivo === "permissao" ? "Você não tem acesso a esta tela." : "Não consegui carregar as obras agora. Tente de novo em instantes."}</p>;
  const { obras, podeEditar } = estado;
  const r = resumoDasObras(obras, hoje);
  if (!obras.length) {
    return (
      <div className="card-surface px-6 py-10 text-center">
        <p className="text-base font-semibold">Nenhuma obra cadastrada</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Cadastre cada unidade em implantação com o roteiro do modelo: as fases e tarefas da prospecção do ponto até a inauguração.</p>
        {podeEditar && <Button className="mt-4" onClick={nova}><Plus className="mr-1 h-4 w-4" aria-hidden />Nova obra</Button>}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero rotulo="Em obra" valor={r.emObra} />
        <Numero rotulo="Atrasadas" valor={r.atrasadas} destaque />
        <Numero rotulo="Inauguram em 90 dias" valor={r.inauguramEm90} />
        <Numero rotulo="Já inauguradas" valor={r.concluidas} />
      </div>
      <ObrasLista obras={obras} abrir={abrir} hoje={hoje} />
    </div>
  );
}

export function ObrasTab() {
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [aberta, setAberta] = useState<{ obra: Obra; existe: boolean } | null>(null);
  const recarregar = async () => setEstado(await carregarObras());
  useEffect(() => { let vivo = true; carregarObras().then((e) => { if (vivo) setEstado(e); }); return () => { vivo = false; }; }, []);
  const podeEditar = estado.fase === "pronto" && estado.podeEditar;
  const post = async (corpo: object) => {
    const res = await authFetch(`${API_BASE}/obras`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Não consegui salvar agora.");
  };
  const dialogo = useMemo(() => aberta, [aberta]);
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle level="page"><span className="inline-flex items-center gap-2"><HardHat className="h-6 w-6" aria-hidden />Unidades em obra</span></SectionTitle>
        {podeEditar && estado.fase === "pronto" && estado.obras.length > 0 && <Button onClick={() => setAberta({ obra: obraNova(), existe: false })}><Plus className="mr-1 h-4 w-4" aria-hidden />Nova obra</Button>}
      </div>
      <ObrasConteudo estado={estado} abrir={(o) => setAberta({ obra: o, existe: true })} nova={() => setAberta({ obra: obraNova(), existe: false })} />
      {dialogo && (
        <ObraDialog key={dialogo.obra.id} inicial={dialogo.obra} existe={dialogo.existe} podeEditar={podeEditar} podeApagar={estado.fase === "pronto" && estado.podeApagar === true} modelos={estado.fase === "pronto" ? estado.modelos : []}
          aoMudarTarefas={(r) => setEstado((e) => (e.fase === "pronto" ? { ...e, obras: e.obras.map((x) => (x.id === dialogo.obra.id ? { ...x, tarefas: r } : x)) } : e))}
          salvar={async (o, comModelo) => {
            await post({ acao: "salvar", obra: o });
            if (comModelo) await post({ acao: "aplicar-modelo", obraId: o.id, modelo: o.modelo });
            await recarregar();
            // obra nova com o roteiro do modelo: reabre já na obra salva, para seguir para as tarefas
            setAberta(comModelo ? { obra: { ...o }, existe: true } : null);
          }}
          apagar={async (id) => { await post({ acao: "apagar", id }); setAberta(null); await recarregar(); }}
          fechar={() => setAberta(null)} />
      )}
    </section>
  );
}
