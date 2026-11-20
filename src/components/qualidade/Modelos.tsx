import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { FOTO_ROTULO, FREQUENCIA_ROTULO, MODELO_SUGERIDO, TIPO_ROTULO, type Frequencia, type ItemModelo, type ModeloChecklist, type PedeFoto, type TipoItem } from "@/data/qualidade";
import { apagarModelo, salvarModelo } from "@/lib/qualidade";

type Rascunho = { id?: string; nome: string; descricao: string; frequencia: Frequencia; ativo: boolean; itens: (Partial<ItemModelo> & { texto: string; grupo: string; peso: number; foto: PedeFoto; tipo?: TipoItem })[] };
const novo = (): Rascunho => ({ nome: "", descricao: "", frequencia: "visita", ativo: true, itens: [{ texto: "", grupo: "", peso: 1, foto: "nenhuma" }] });
const sugerido = (): Rascunho => ({ ...MODELO_SUGERIDO, ativo: true, itens: MODELO_SUGERIDO.itens.map((i) => ({ ...i })) });
const deModelo = (m: ModeloChecklist): Rascunho => ({ id: m.id, nome: m.nome, descricao: m.descricao, frequencia: m.frequencia, ativo: m.ativo, itens: m.itens.map((i) => ({ ...i })) });

function Editor({ inicial, onSalvou, onCancelar }: { inicial: Rascunho; onSalvou: () => void; onCancelar: () => void }) {
  const [m, setM] = useState(inicial);
  const [colar, setColar] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const item = (i: number, campos: Partial<Rascunho["itens"][number]>) => setM((s) => ({ ...s, itens: s.itens.map((x, j) => (j === i ? { ...x, ...campos } : x)) }));
  const mover = (i: number, d: number) => setM((s) => { const a = [...s.itens]; const j = i + d; if (j < 0 || j >= a.length) return s; [a[i], a[j]] = [a[j], a[i]]; return { ...s, itens: a }; });
  const salvar = async () => {
    setErro("");
    setEnviando(true);
    const r = await salvarModelo({ ...m, itens: m.itens.filter((i) => i.texto.trim()) } as Partial<ModeloChecklist>);
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    toast({ title: "Checklist salvo" });
    onSalvou();
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">Nome
          <input value={m.nome} maxLength={80} onChange={(e) => setM({ ...m, nome: e.target.value })} placeholder="Ex.: Limpeza e organização" className="mt-1 h-9 w-full rounded-xl border border-input bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </label>
        <label className="text-xs text-muted-foreground">Quando é feito
          <Select aria-label="Frequência" className="mt-1 h-9 w-full" value={m.frequencia} onChange={(e) => setM({ ...m, frequencia: e.target.value as Frequencia })}>
            {(Object.keys(FREQUENCIA_ROTULO) as Frequencia[]).map((f) => <option key={f} value={f}>{FREQUENCIA_ROTULO[f]}</option>)}
          </Select>
        </label>
      </div>
      <label className="block text-xs text-muted-foreground">Descrição (opcional)
        <input value={m.descricao} maxLength={200} onChange={(e) => setM({ ...m, descricao: e.target.value })} className="mt-1 h-9 w-full rounded-xl border border-input bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
      </label>
      <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={m.ativo} onChange={(e) => setM({ ...m, ativo: e.target.checked })} className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />Em uso (aparece para escolher na visita)</label>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Itens ({m.itens.length})</p>
        {m.itens.map((it, i) => (
          <div key={i} className="grid gap-2 rounded-xl border border-border bg-white p-2 sm:grid-cols-[minmax(0,1fr)_10rem_5.5rem_11rem_auto]">
            <input value={it.texto} maxLength={200} onChange={(e) => item(i, { texto: e.target.value })} placeholder="O que conferir (ex.: Vestiário limpo e sem odor)" aria-label={`Item ${i + 1}`} className="h-9 rounded-lg border border-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            <input value={it.grupo} maxLength={60} onChange={(e) => item(i, { grupo: e.target.value })} placeholder="Grupo (ex.: Vestiários)" aria-label={`Grupo do item ${i + 1}`} className="h-9 rounded-lg border border-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            <Select aria-label={`Peso do item ${i + 1}`} className="h-9" value={it.peso} onChange={(e) => item(i, { peso: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map((p) => <option key={p} value={p}>Peso {p}</option>)}
            </Select>
            <Select aria-label={`Foto do item ${i + 1}`} className="h-9" value={it.foto} onChange={(e) => item(i, { foto: e.target.value as PedeFoto })}>
              {(Object.keys(FOTO_ROTULO) as PedeFoto[]).map((f) => <option key={f} value={f}>{FOTO_ROTULO[f]}</option>)}
            </Select>
            <span className="flex items-center gap-1">
              <button type="button" aria-label="Subir o item" onClick={() => mover(i, -1)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"><ArrowUp className="h-4 w-4" aria-hidden /></button>
              <button type="button" aria-label="Descer o item" onClick={() => mover(i, 1)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"><ArrowDown className="h-4 w-4" aria-hidden /></button>
              <button type="button" aria-label="Remover o item" onClick={() => setM((s) => ({ ...s, itens: s.itens.filter((_, j) => j !== i) }))} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"><Trash2 className="h-4 w-4" aria-hidden /></button>
            </span>
            <Select aria-label={`Tipo do item ${i + 1}`} className="h-9 sm:col-span-full sm:w-72" value={it.tipo ?? "conforme"} onChange={(e) => item(i, { tipo: e.target.value as TipoItem })}>
              {(Object.keys(TIPO_ROTULO) as TipoItem[]).map((t) => <option key={t} value={t}>{TIPO_ROTULO[t]}</option>)}
            </Select>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setM((s) => ({ ...s, itens: [...s.itens, { texto: "", grupo: s.itens[s.itens.length - 1]?.grupo ?? "", peso: 1, foto: "nenhuma" }] }))}><Plus className="h-4 w-4" aria-hidden /> Item</Button>
      </div>

      <details className="rounded-xl border border-border bg-secondary/30 p-3">
        <summary className="cursor-pointer text-sm font-medium text-foreground">Colar vários itens de uma vez</summary>
        <p className="mt-2 text-xs text-muted-foreground">Um item por linha. Para dar um grupo, escreva "Grupo: item" (ex.: "Vestiários: Piso limpo e seco").</p>
        <textarea value={colar} onChange={(e) => setColar(e.target.value)} rows={5} className="mt-2 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => {
          const novos = colar.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const k = l.indexOf(":"); return k > 0 && k < 40 ? { grupo: l.slice(0, k).trim(), texto: l.slice(k + 1).trim(), peso: 1, foto: "nenhuma" as PedeFoto } : { grupo: "", texto: l, peso: 1, foto: "nenhuma" as PedeFoto }; });
          setM((s) => ({ ...s, itens: [...s.itens.filter((i) => i.texto.trim()), ...novos] }));
          setColar("");
        }}>Adicionar à lista</Button>
      </details>

      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <div className="flex gap-2">
        <Button onClick={() => void salvar()} disabled={enviando}>{enviando ? "Salvando..." : "Salvar checklist"}</Button>
        <Button variant="ghost" onClick={onCancelar}>Cancelar</Button>
      </div>
    </div>
  );
}

/** Os checklists da franqueadora: criar, editar, tirar de uso e apagar. As visitas já feitas guardam o próprio texto e não mudam. */
export function Modelos({ modelos, onMudou }: { modelos: ModeloChecklist[]; onMudou: () => void }) {
  const [editando, setEditando] = useState<Rascunho | null>(null);
  const apagar = async (m: ModeloChecklist) => {
    if (!window.confirm(`Apagar o checklist "${m.nome}"? As visitas já registradas continuam; só deixa de poder ser escolhido.`)) return;
    const r = await apagarModelo(m.id);
    if (!r.ok) return toast({ title: "Não consegui apagar", description: r.erro, variant: "destructive" });
    onMudou();
  };
  if (editando) return <ChartCard title={editando.id ? "Editar checklist" : "Novo checklist"}><Editor inicial={editando} onSalvou={() => { setEditando(null); onMudou(); }} onCancelar={() => setEditando(null)} /></ChartCard>;
  return (
    <ChartCard title="Checklists" subtitle="As listas de itens que a franqueadora usa nas visitas." legend={<div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setEditando(sugerido())}>Usar o roteiro sugerido</Button><Button size="sm" onClick={() => setEditando(novo())}><Plus className="h-4 w-4" aria-hidden /> Novo checklist</Button></div>}>
      {modelos.length === 0 ? (
        <ChartEmpty>Nenhum checklist ainda. Crie o primeiro (ex.: limpeza, uniforme, equipamentos).</ChartEmpty>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-border">
          {modelos.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
              <span className="min-w-0 text-sm"><span className="font-medium text-foreground">{m.nome}</span>{!m.ativo && <span className="ml-2 rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-muted-foreground">Fora de uso</span>}
                <span className="block text-xs text-muted-foreground">{m.itens.length} itens · {FREQUENCIA_ROTULO[m.frequencia]}{m.itens.some((i) => i.foto !== "nenhuma") ? ` · ${m.itens.filter((i) => i.foto !== "nenhuma").length} pedem foto` : ""}</span></span>
              <span className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setEditando(deModelo(m))}>Editar</Button><Button variant="ghost" size="sm" onClick={() => void apagar(m)} aria-label={`Apagar ${m.nome}`}><Trash2 className="h-4 w-4" aria-hidden /></Button></span>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}
