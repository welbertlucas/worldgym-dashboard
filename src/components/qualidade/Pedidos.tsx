import { useState } from "react";
import { Check, X } from "lucide-react";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { FOTO_ROTULO, type DadosQualidade, type PedidoItem, type PedeFoto, dataBR, pedidosPendentes } from "@/data/qualidade";
import { decidirPedido } from "@/lib/qualidade";

/** Cartão de um pedido pendente: o dono ajusta o item, escolhe se vale só para a unidade ou para todas e aprova, ou recusa com uma resposta. */
function CartaoPendente({ p, grupos, onMudou }: { p: PedidoItem; grupos: string[]; onMudou: () => void }) {
  const [modo, setModo] = useState<"aprovar" | "recusar" | null>(null);
  const [texto, setTexto] = useState(p.texto);
  const [grupo, setGrupo] = useState("");
  const [peso, setPeso] = useState(1);
  const [foto, setFoto] = useState<PedeFoto>("nenhuma");
  const [escopo, setEscopo] = useState<"unidade" | "todas">("unidade");
  const [resposta, setResposta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const confirmar = async () => {
    setErro("");
    setEnviando(true);
    const r = await decidirPedido(p.id, modo === "aprovar" ? { decisao: "aprovar", escopo, resposta, item: { texto, grupo, peso, foto } } : { decisao: "recusar", resposta });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    toast({ title: modo === "aprovar" ? "Item incluído no checklist" : "Pedido recusado" });
    onMudou();
  };
  return (
    <li className="rounded-xl border border-border bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{p.texto}</p>
        <p className="text-xs text-muted-foreground">{p.unidade} · {p.modeloNome} · {dataBR(p.criadoEm.slice(0, 10))}</p>
      </div>
      {p.motivo && <p className="mt-1 text-sm text-muted-foreground">{p.motivo}</p>}
      <p className="mt-1 text-xs text-muted-foreground">Pedido por {p.solicitante.nome || "—"}</p>
      {!modo && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={() => setModo("aprovar")}><Check className="h-4 w-4" aria-hidden /> Aprovar</Button>
          <Button size="sm" variant="outline" onClick={() => setModo("recusar")}><X className="h-4 w-4" aria-hidden /> Recusar</Button>
        </div>
      )}
      {modo === "aprovar" && (
        <div className="mt-3 space-y-3 rounded-lg bg-secondary/30 p-3">
          <label className="block text-xs text-muted-foreground">Texto do item (você pode ajustar)
            <input value={texto} maxLength={200} onChange={(e) => setTexto(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-input bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="text-xs text-muted-foreground">Grupo
              <input list="grupos-qualidade" value={grupo} maxLength={60} onChange={(e) => setGrupo(e.target.value)} placeholder="Ex.: Áreas de apoio" className="mt-1 block h-9 w-52 rounded-lg border border-input bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              <datalist id="grupos-qualidade">{grupos.map((g) => <option key={g} value={g} />)}</datalist>
            </label>
            <label className="text-xs text-muted-foreground">Peso
              <Select aria-label="Peso do item" className="mt-1 h-9 w-24" value={peso} onChange={(e) => setPeso(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</Select>
            </label>
            <label className="text-xs text-muted-foreground">Foto
              <Select aria-label="Regra da foto" className="mt-1 h-9 w-56" value={foto} onChange={(e) => setFoto(e.target.value as PedeFoto)}>{(Object.keys(FOTO_ROTULO) as PedeFoto[]).map((f) => <option key={f} value={f}>{FOTO_ROTULO[f]}</option>)}</Select>
            </label>
          </div>
          <div className="space-y-1 text-sm text-foreground" role="radiogroup" aria-label="Onde o item vale">
            <label className="flex items-center gap-2"><input type="radio" name={`escopo-${p.id}`} checked={escopo === "unidade"} onChange={() => setEscopo("unidade")} className="accent-primary" />Só para {p.unidade}</label>
            <label className="flex items-center gap-2"><input type="radio" name={`escopo-${p.id}`} checked={escopo === "todas"} onChange={() => setEscopo("todas")} className="accent-primary" />Para todas as unidades do checklist (entra na nota de todas)</label>
          </div>
          <label className="block text-xs text-muted-foreground">Resposta para a unidade (opcional)
            <input value={resposta} maxLength={300} onChange={(e) => setResposta(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-input bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </label>
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <div className="flex gap-2"><Button size="sm" onClick={() => void confirmar()} disabled={enviando || !texto.trim()}>{enviando ? "Salvando..." : "Incluir no checklist"}</Button><Button size="sm" variant="ghost" onClick={() => setModo(null)}>Cancelar</Button></div>
        </div>
      )}
      {modo === "recusar" && (
        <div className="mt-3 space-y-3 rounded-lg bg-secondary/30 p-3">
          <label className="block text-xs text-muted-foreground">Resposta para a unidade (aparece para ela)
            <input value={resposta} maxLength={300} onChange={(e) => setResposta(e.target.value)} placeholder="Ex.: Esse ponto já é coberto pelo item de banheiros" className="mt-1 h-9 w-full rounded-lg border border-input bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </label>
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void confirmar()} disabled={enviando}>{enviando ? "Salvando..." : "Confirmar recusa"}</Button><Button size="sm" variant="ghost" onClick={() => setModo(null)}>Cancelar</Button></div>
        </div>
      )}
    </li>
  );
}

/** Aba do dono: os pedidos de item novo das unidades, para aprovar (o item entra no checklist) ou recusar. */
export function Pedidos({ dados, onMudou }: { dados: DadosQualidade; onMudou: () => void }) {
  const todos = dados.pedidos ?? [];
  const pendentes = pedidosPendentes(todos).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  const respondidos = todos.filter((p) => p.status !== "pendente").sort((a, b) => (b.decisao?.em ?? "").localeCompare(a.decisao?.em ?? "")).slice(0, 20);
  const grupos = [...new Set(dados.modelos.flatMap((m) => m.itens.map((i) => i.grupo)).filter(Boolean))];
  return (
    <div className="space-y-4">
      <ChartCard title="Pedidos de item novo" subtitle="O que as unidades pediram para incluir no checklist delas. Aprovar põe o item no checklist; recusar manda a sua resposta para a unidade.">
        {pendentes.length === 0 ? <ChartEmpty>Nenhum pedido esperando resposta.</ChartEmpty> : <ul className="space-y-3">{pendentes.map((p) => <CartaoPendente key={p.id} p={p} grupos={grupos} onMudou={onMudou} />)}</ul>}
      </ChartCard>
      {respondidos.length > 0 && (
        <ChartCard title="Já respondidos" subtitle="Os 20 mais recentes.">
          <ul className="divide-y divide-border">
            {respondidos.map((p) => (
              <li key={p.id} className="py-2.5 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="font-medium text-foreground">{p.texto}</span><span className={cn("text-xs font-semibold", p.status === "aprovado" ? "text-emerald-700" : "text-destructive")}>{p.status === "aprovado" ? (p.decisao?.escopo === "todas" ? "Aprovado para todas" : "Aprovado só para a unidade") : "Recusado"}</span></div>
                <p className="text-xs text-muted-foreground">{p.unidade} · {p.modeloNome} · respondido em {dataBR((p.decisao?.em ?? "").slice(0, 10))}{p.decisao?.resposta ? ` · “${p.decisao.resposta}”` : ""}</p>
              </li>
            ))}
          </ul>
        </ChartCard>
      )}
    </div>
  );
}
