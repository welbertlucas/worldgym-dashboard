import { useMemo, useRef, useState } from "react";
import { Camera, Check, X } from "lucide-react";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { type DadosQualidade, type ItemModelo, type ModeloChecklist, pctTexto } from "@/data/qualidade";
import { enviarFoto, reduzirFoto, salvarVisita } from "@/lib/qualidade";

interface Resposta { conforme: boolean | null; comentario: string; fotos: { previa: string; dados: string }[] }
const vazia = (): Resposta => ({ conforme: null, comentario: "", fotos: [] });

/** Nota provisória enquanto a pessoa responde (a mesma conta do servidor: conformes entre os respondidos). */
const notaAgora = (itens: ItemModelo[], rs: Resposta[]) => {
  const v = itens.map((i, k) => ({ peso: i.peso ?? 1, r: rs[k] })).filter((x) => x.r.conforme !== null);
  const total = v.reduce((t, x) => t + x.peso, 0);
  return total ? (v.filter((x) => x.r.conforme).reduce((t, x) => t + x.peso, 0) / total) * 100 : null;
};

function Item({ item, r, onChange }: { item: ItemModelo; r: Resposta; onChange: (r: Resposta) => void }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [lendo, setLendo] = useState(false);
  const botao = (valor: boolean | null, rotulo: string, ativo: string) => (
    <button type="button" aria-pressed={r.conforme === valor} onClick={() => onChange({ ...r, conforme: r.conforme === valor ? null : valor })}
      className={cn("flex-1 rounded-lg border px-2 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", r.conforme === valor ? ativo : "border-border bg-white text-muted-foreground hover:bg-secondary")}>{rotulo}</button>
  );
  const adicionar = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setLendo(true);
    try {
      const dados = await reduzirFoto(arquivo);
      onChange({ ...r, fotos: [...r.fotos, { previa: `data:image/jpeg;base64,${dados}`, dados }].slice(0, 3) });
    } catch {
      toast({ title: "Não consegui usar essa foto", description: "Tente outra ou tire de novo.", variant: "destructive" });
    } finally {
      setLendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  };
  return (
    <li className="rounded-xl border border-border bg-white p-3">
      <p className="text-sm font-medium text-foreground">{item.texto}{item.foto === "sempre" && <span className="ml-2 rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-muted-foreground">pede foto</span>}{(item.peso ?? 1) > 1 && <span className="ml-2 rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-muted-foreground">peso {item.peso}</span>}</p>
      <div className="mt-2 flex gap-2" role="group" aria-label={`Resposta: ${item.texto}`}>
        {botao(true, "Conforme", "border-emerald-600 bg-emerald-50 text-emerald-800")}
        {botao(false, "Não conforme", "border-destructive bg-red-50 text-red-800")}
        {botao(null, "Não se aplica", "border-foreground/30 bg-secondary text-foreground")}
      </div>
      {r.conforme !== null && (
        <div className="mt-2 space-y-2">
          <input type="text" value={r.comentario} maxLength={300} onChange={(e) => onChange({ ...r, comentario: e.target.value })} placeholder={r.conforme ? "Comentário (opcional)" : "O que precisa ser corrigido? (obrigatório)"} aria-label={`Comentário: ${item.texto}`}
            className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <div className="flex flex-wrap items-center gap-2">
            {r.fotos.map((f, i) => (
              <span key={i} className="relative">
                <img src={f.previa} alt="Foto anexada" className="h-16 w-16 rounded-lg object-cover" />
                <button type="button" aria-label="Remover a foto" onClick={() => onChange({ ...r, fotos: r.fotos.filter((_, j) => j !== i) })} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background"><X className="h-3 w-3" aria-hidden /></button>
              </span>
            ))}
            {r.conforme === false && item.foto === "nao_conforme" && r.fotos.length === 0 && <span className="text-xs font-medium text-destructive">Foto obrigatória neste item.</span>}
            {r.fotos.length < 3 && (
              <>
                <input ref={entrada} type="file" accept="image/*" capture="environment" className="sr-only" aria-label={`Adicionar foto: ${item.texto}`} onChange={(e) => void adicionar(e.target.files?.[0])} />
                <Button type="button" variant="outline" size="sm" disabled={lendo} onClick={() => entrada.current?.click()}><Camera className="h-4 w-4" aria-hidden />{lendo ? "Lendo..." : "Foto"}</Button>
              </>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

/** A visita da franqueadora: escolhe a unidade e o checklist, responde item a item (conforme, não conforme ou não se aplica), comenta e fotografa. */
export function NovaVisita({ dados, hoje, onSalvou }: { dados: DadosQualidade; hoje: string; onSalvou: (unidade: string) => void }) {
  const ativos = dados.modelos.filter((m) => m.ativo);
  const [unidade, setUnidade] = useState("");
  const [modeloId, setModeloId] = useState("");
  const [data, setData] = useState(hoje);
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({});
  const [observacao, setObservacao] = useState("");
  const [chegada, setChegada] = useState("");
  const [saida, setSaida] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const modelo: ModeloChecklist | undefined = ativos.find((m) => m.id === modeloId);
  const grupos = useMemo(() => {
    const m = new Map<string, ItemModelo[]>();
    for (const i of modelo?.itens ?? []) m.set(i.grupo, [...(m.get(i.grupo) ?? []), i]);
    return [...m.entries()];
  }, [modelo]);
  const lista = (modelo?.itens ?? []).map((i) => respostas[i.id] ?? vazia());
  const nota = notaAgora(modelo?.itens ?? [], lista);

  if (ativos.length === 0) return <ChartCard title="Nova visita"><ChartEmpty>Crie um checklist na aba Checklists para registrar a primeira visita.</ChartEmpty></ChartCard>;

  const enviar = async () => {
    if (!modelo) return;
    setErro("");
    setEnviando(true);
    try {
      const itens = [];
      for (const item of modelo.itens) {
        const r = respostas[item.id] ?? vazia();
        const fotos: string[] = [];
        for (const f of r.fotos) {
          const up = await enviarFoto(f.dados);
          if (!up.ok) { setErro(up.erro); setEnviando(false); return; }
          fotos.push(up.dados.id);
        }
        itens.push({ itemId: item.id, conforme: r.conforme, comentario: r.comentario, fotos });
      }
      const res = await salvarVisita({ modeloId: modelo.id, unidade, data, chegada, saida, respostas: itens, observacao });
      if (!res.ok) { setErro(res.erro); setEnviando(false); return; }
      toast({ title: "Visita registrada", description: `${unidade}: nota ${pctTexto(res.dados.visita.nota)}.` });
      setRespostas({}); setObservacao(""); setModeloId(""); setChegada(""); setSaida("");
      onSalvou(unidade);
    } catch {
      setErro("Não consegui enviar agora. Tente de novo.");
    }
    setEnviando(false);
  };

  return (
    <ChartCard title="Nova visita" subtitle="Escolha a unidade e o checklist, responda cada item e fotografe o que for preciso.">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">Unidade
          <Select aria-label="Unidade visitada" className="mt-1 h-9 w-56 max-w-full" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
            <option value="">Escolha…</option>
            {dados.unidades.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
        </label>
        <label className="text-xs text-muted-foreground">Checklist
          <Select aria-label="Checklist da visita" className="mt-1 h-9 w-64 max-w-full" value={modeloId} onChange={(e) => { setModeloId(e.target.value); setRespostas({}); }}>
            <option value="">Escolha…</option>
            {ativos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </Select>
        </label>
        <label className="text-xs text-muted-foreground">Data
          <input type="date" value={data} max={hoje} onChange={(e) => setData(e.target.value)} aria-label="Data da visita" className="mt-1 h-9 rounded-xl border border-input bg-white px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </label>
      </div>

      {modelo && unidade && (
        <div className="mt-5 space-y-5">
          {grupos.map(([grupo, itens]) => (
            <section key={grupo || "geral"} className="space-y-2">
              {grupo && <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{grupo}</h4>}
              <ul className="space-y-2">{itens.map((i) => <Item key={i.id} item={i} r={respostas[i.id] ?? vazia()} onChange={(r) => setRespostas((s) => ({ ...s, [i.id]: r }))} />)}</ul>
            </section>
          ))}
          <div className="flex flex-wrap gap-3">
            <label className="text-xs text-muted-foreground">Chegada (opcional)
              <input type="time" value={chegada} onChange={(e) => setChegada(e.target.value)} aria-label="Hora de chegada" className="mt-1 block h-9 rounded-xl border border-input bg-white px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </label>
            <label className="text-xs text-muted-foreground">Saída (opcional)
              <input type="time" value={saida} onChange={(e) => setSaida(e.target.value)} aria-label="Hora de saída" className="mt-1 block h-9 rounded-xl border border-input bg-white px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </label>
          </div>
          <label className="block text-xs text-muted-foreground">Observação geral (ocorrências que exigiram orientação à equipe, o que ficou combinado…)
            <textarea value={observacao} maxLength={500} onChange={(e) => setObservacao(e.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </label>
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void enviar()} disabled={enviando}><Check className="h-4 w-4" aria-hidden />{enviando ? "Enviando..." : "Registrar visita"}</Button>
            <span className="text-sm text-muted-foreground">Nota até agora: <b className="font-semibold text-foreground tabular-nums">{pctTexto(nota === null ? null : Math.round(nota * 10) / 10)}</b></span>
          </div>
        </div>
      )}
      {(!modelo || !unidade) && <p className="mt-4 text-sm text-muted-foreground">Escolha a unidade e o checklist para começar.</p>}
    </ChartCard>
  );
}
