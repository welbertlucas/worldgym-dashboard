import { useEffect, useMemo, useState } from "react";
import { HardHat, Plus, Trash2 } from "lucide-react";
import { SectionTitle } from "@/components/SectionTitle";
import { Button } from "@/components/ui/button";
import { API_BASE, authFetch } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  type Marco, type Obra, dataBR, dataCurta, diasDeAtraso, hojeLocal, inauguracao, novoId, obraNova, ordenar, progresso, proximoMarco, resumoDasObras, situacao,
} from "@/lib/obras";

type Estado = { fase: "carregando" } | { fase: "erro"; motivo: "permissao" | "falha" } | { fase: "pronto"; obras: Obra[]; podeEditar: boolean; podeApagar?: boolean };

/** Pede as obras à API. A permissão é conferida no servidor a cada pedido; dono e Master mudam; só o dono apaga. */
export async function carregarObras(): Promise<Estado> {
  try {
    const res = await authFetch(`${API_BASE}/obras`);
    if (res.status === 403) return { fase: "erro", motivo: "permissao" };
    if (!res.ok) return { fase: "erro", motivo: "falha" };
    const j = (await res.json()) as { obras: Obra[]; podeEditar: boolean; podeApagar?: boolean };
    return { fase: "pronto", obras: j.obras ?? [], podeEditar: Boolean(j.podeEditar), podeApagar: Boolean(j.podeApagar) };
  } catch {
    return { fase: "erro", motivo: "falha" };
  }
}

const SELO = {
  atrasada: { texto: "Atrasada", classe: "bg-destructive/10 text-destructive" },
  "no-prazo": { texto: "No prazo", classe: "bg-success/10 text-success" },
  concluida: { texto: "Inaugurada", classe: "bg-muted text-muted-foreground" },
} as const;
const NOME_MODELO = { low: "Low Cost", pro: "Pro" } as const;

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
        const s = situacao(o, hoje), selo = SELO[s], prox = proximoMarco(o), atraso = diasDeAtraso(o, hoje), p = progresso(o);
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
            <div className="flex items-center gap-2" aria-label={`${p}% dos marcos concluídos`}>
              <span className="relative h-1.5 flex-1 rounded-full bg-muted"><span className={cn("absolute inset-y-0 left-0 rounded-full", s === "atrasada" ? "bg-destructive" : "bg-success")} style={{ width: `${p}%` }} /></span>
              <span className="text-[12px] tabular-nums text-muted-foreground">{p}%</span>
            </div>
            <div className="text-[12px] text-muted-foreground">
              {prox ? <p>Próximo: <span className="font-medium text-foreground">{prox.nome}</span> · {dataCurta(prox.previsto)}{atraso > 0 && <span className="text-destructive"> · {atraso} {atraso === 1 ? "dia" : "dias"} de atraso</span>}</p> : <p>Todos os marcos concluídos</p>}
              <p>Inauguração {s === "concluida" ? "em" : "prevista:"} <span className="font-medium text-foreground">{dataBR(inauguracao(o))}</span></p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

const campo = "h-9 w-full rounded-md border border-border bg-background px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-muted/40 disabled:text-muted-foreground";

function ObraDialog({ inicial, podeEditar, podeApagar = false, existe, salvar, apagar, fechar }: { inicial: Obra; podeEditar: boolean; podeApagar?: boolean; existe: boolean; salvar: (o: Obra) => Promise<void>; apagar: (id: string) => Promise<void>; fechar: () => void }) {
  const [o, setO] = useState<Obra>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [achando, setAchando] = useState(false);
  const [achado, setAchado] = useState<string | null>(null);
  /** Busca a posição do endereço (o mesmo serviço de mapas dos Estudos de ponto) e guarda a posição na obra. */
  const acharNoMapa = async () => {
    const q = [o.endereco, o.cidade].filter(Boolean).join(", ").trim();
    if (!q) { setErro("Informe o endereço ou a cidade da obra para achar a posição."); return; }
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
  const mudaMarco = (id: string, patch: Partial<Marco>) => setO((x) => ({ ...x, marcos: x.marcos.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  const ler = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setO((x) => ({ ...x, [e.target.name]: e.target.name === "m2" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value }));
  const guardar = async () => {
    setErro(null); setOcupado(true);
    try { await salvar(o); } catch (e) { setErro(e instanceof Error ? e.message : "Não consegui salvar agora."); setOcupado(false); }
  };
  const excluir = async () => {
    if (!window.confirm(`Apagar a obra ${o.nome || "sem nome"}? Isso não pode ser desfeito.`)) return;
    setErro(null); setOcupado(true);
    try { await apagar(o.id); } catch (e) { setErro(e instanceof Error ? e.message : "Não consegui apagar agora."); setOcupado(false); }
  };
  const hoje = hojeLocal();
  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Obra">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div><h3 className="font-display text-xl font-medium">{existe ? o.nome || "Obra" : "Nova obra"}</h3><p className="text-sm text-muted-foreground">{podeEditar ? "Cada marco tem a data prevista e, quando acontece, a data real." : "Só o dono e o Master mudam as obras; aqui você consulta."}</p></div>
          <Button variant="ghost" onClick={fechar}>Fechar</Button>
        </div>
        {erro && <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-[12px] text-muted-foreground">Unidade<input name="nome" value={o.nome} onChange={ler} disabled={!podeEditar} maxLength={60} className={campo} placeholder="Nome da unidade" /></label>
          <label className="text-[12px] text-muted-foreground">Cidade<input name="cidade" value={o.cidade} onChange={ler} disabled={!podeEditar} maxLength={60} className={campo} placeholder="Cidade e estado" /></label>
          <label className="text-[12px] text-muted-foreground">Modelo
            <select name="modelo" value={o.modelo} onChange={ler} disabled={!podeEditar} className={campo}><option value="low">Low Cost</option><option value="pro">Pro</option></select></label>
          <label className="text-[12px] text-muted-foreground">Área (m²)<input name="m2" type="number" min={1} max={20000} value={o.m2 ?? ""} onChange={ler} disabled={!podeEditar} className={campo} /></label>
          <label className="text-[12px] text-muted-foreground sm:col-span-2">Endereço da obra (para pôr a unidade no mapa da rede)
            <div className="flex gap-2">
              <input name="endereco" value={o.endereco ?? ""} onChange={(e) => { ler(e); setAchado(null); }} disabled={!podeEditar} maxLength={160} className={campo} placeholder="Rua, número e bairro" />
              {podeEditar && <Button type="button" variant="outline" className="h-9 shrink-0" onClick={acharNoMapa} disabled={achando}>{achando ? "Buscando…" : "Achar no mapa"}</Button>}
            </div>
            <span className="mt-1 block text-[12px]">{o.c ? (achado ? `Posição marcada: ${achado}` : "Posição marcada no mapa da rede.") : "Sem posição: a obra não aparece no mapa da rede."}{podeEditar && o.c && <button type="button" className="ml-2 underline" onClick={() => { setO((x) => ({ ...x, c: null })); setAchado(null); }}>Tirar</button>}</span>
          </label>
          <label className="text-[12px] text-muted-foreground sm:col-span-2">Responsável pela obra<input name="responsavel" value={o.responsavel} onChange={ler} disabled={!podeEditar} maxLength={60} className={campo} /></label>
        </div>
        <h4 className="mt-5 text-sm font-semibold">Marcos</h4>
        <div className="mt-2 space-y-1.5">
          <div className="hidden grid-cols-[1fr_9rem_12.5rem_2rem] gap-2 px-1 text-[11px] text-muted-foreground sm:grid"><span>Marco</span><span>Previsto</span><span>Realizado</span><span /></div>
          {o.marcos.map((m) => {
            const atrasado = !m.real && m.previsto && m.previsto < hoje;
            return (
              <div key={m.id} className="grid items-center gap-2 sm:grid-cols-[1fr_9rem_12.5rem_2rem]">
                <input value={m.nome} onChange={(e) => mudaMarco(m.id, { nome: e.target.value })} disabled={!podeEditar} maxLength={60} aria-label="Nome do marco" className={campo} />
                <input type="date" value={m.previsto ?? ""} onChange={(e) => mudaMarco(m.id, { previsto: e.target.value || null })} disabled={!podeEditar} aria-label={`Previsto: ${m.nome}`} className={cn(campo, atrasado && "border-destructive text-destructive")} />
                <div className="flex items-center gap-1">
                  <input type="date" value={m.real ?? ""} onChange={(e) => mudaMarco(m.id, { real: e.target.value || null })} disabled={!podeEditar} aria-label={`Realizado: ${m.nome}`} className={campo} />
                  {podeEditar && !m.real && <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 px-2" title="Marcar como concluído hoje" onClick={() => mudaMarco(m.id, { real: hoje })}>Hoje</Button>}
                </div>
                {podeEditar ? <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={`Tirar o marco ${m.nome}`} onClick={() => setO((x) => ({ ...x, marcos: x.marcos.filter((y) => y.id !== m.id) }))} disabled={o.marcos.length <= 1}><Trash2 className="h-4 w-4" aria-hidden /></Button> : <span />}
              </div>
            );
          })}
        </div>
        {podeEditar && <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setO((x) => ({ ...x, marcos: [...x.marcos, { id: novoId("m"), nome: "", previsto: null, real: null }] }))} disabled={o.marcos.length >= 24}><Plus className="mr-1 h-4 w-4" aria-hidden />Acrescentar marco</Button>}
        <label className="mt-4 block text-[12px] text-muted-foreground">Observações<textarea name="obs" value={o.obs} onChange={ler} disabled={!podeEditar} maxLength={600} rows={3} className={cn(campo, "h-auto py-2")} /></label>
        {podeEditar && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <Button onClick={guardar} disabled={ocupado || !o.nome.trim()}>{ocupado ? "Salvando…" : "Salvar"}</Button>
            {existe && podeApagar && <Button variant="outline" onClick={excluir} disabled={ocupado} className="text-destructive">Apagar obra</Button>}
          </div>
        )}
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
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Cadastre cada unidade em construção com os marcos até a inauguração: contrato do ponto, projeto, alvará, obra, equipamentos e vistoria.</p>
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
        <ObraDialog key={dialogo.obra.id} inicial={dialogo.obra} existe={dialogo.existe} podeEditar={podeEditar} podeApagar={estado.fase === "pronto" && estado.podeApagar === true}
          salvar={async (o) => { await post({ acao: "salvar", obra: o }); setAberta(null); await recarregar(); }}
          apagar={async (id) => { await post({ acao: "apagar", id }); setAberta(null); await recarregar(); }}
          fechar={() => setAberta(null)} />
      )}
    </section>
  );
}
