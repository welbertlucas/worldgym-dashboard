import { useState } from "react";
import { Send } from "lucide-react";
import { ChartCard } from "@/components/ChartCard";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { type DadosQualidade, type PedidoItem, dataBR } from "@/data/qualidade";
import { pedirItem } from "@/lib/qualidade";

const ROTULO = { pendente: "Aguardando resposta", aprovado: "Aprovado: já está no seu checklist", recusado: "Não aprovado" } as const;

/** Na tela da unidade: pedir que um item seja incluído no checklist dela e acompanhar a resposta do dono. */
export function PedidosDaUnidade({ dados, onMudou }: { dados: DadosQualidade; onMudou: () => void }) {
  const modelos = dados.modelos.filter((m) => m.ativo && m.frequencia !== "visita");
  const [aberto, setAberto] = useState(false);
  const [unidade, setUnidade] = useState(dados.unidades.length === 1 ? dados.unidades[0] : "");
  const [modeloId, setModeloId] = useState(modelos.length === 1 ? modelos[0].id : "");
  const [texto, setTexto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const pedidos = [...(dados.pedidos ?? [])].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, 15);
  if (modelos.length === 0) return null;

  const enviar = async () => {
    setErro("");
    setEnviando(true);
    const r = await pedirItem({ modeloId, unidade, texto, motivo });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    toast({ title: "Pedido enviado", description: "Você vê a resposta aqui quando o dono decidir." });
    setTexto(""); setMotivo(""); setAberto(false);
    onMudou();
  };
  return (
    <ChartCard
      title="Pedir um item novo"
      subtitle="Falta algo no seu checklist? Descreva o que precisa ser conferido. O dono analisa e responde aqui."
      legend={!aberto ? <Button size="sm" variant="outline" onClick={() => setAberto(true)}>Fazer um pedido</Button> : undefined}
    >
      {aberto && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            {dados.unidades.length > 1 && (
              <label className="text-xs text-muted-foreground">Unidade
                <Select aria-label="Unidade do pedido" className="mt-1 h-9 w-56" value={unidade} onChange={(e) => setUnidade(e.target.value)}><option value="">Escolha…</option>{dados.unidades.map((u) => <option key={u} value={u}>{u}</option>)}</Select>
              </label>
            )}
            {modelos.length > 1 && (
              <label className="text-xs text-muted-foreground">Checklist
                <Select aria-label="Checklist do pedido" className="mt-1 h-9 w-64" value={modeloId} onChange={(e) => setModeloId(e.target.value)}><option value="">Escolha…</option>{modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</Select>
              </label>
            )}
          </div>
          <label className="block text-xs text-muted-foreground">O que precisa ser conferido?
            <input value={texto} maxLength={200} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: Piscina: cloro e pH medidos e registrados" className="mt-1 h-9 w-full rounded-xl border border-input bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </label>
          <label className="block text-xs text-muted-foreground">Por que esse item faz falta? (opcional)
            <textarea value={motivo} maxLength={300} rows={2} onChange={(e) => setMotivo(e.target.value)} className="mt-1 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </label>
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <div className="flex gap-2">
            <Button onClick={() => void enviar()} disabled={enviando || !texto.trim() || !unidade || !modeloId}><Send className="h-4 w-4" aria-hidden />{enviando ? "Enviando..." : "Enviar pedido"}</Button>
            <Button variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
          </div>
        </div>
      )}
      {pedidos.length > 0 && (
        <ul className={cn("divide-y divide-border", aberto && "mt-4 border-t border-border")}>
          {pedidos.map((p: PedidoItem) => (
            <li key={p.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="font-medium text-foreground">{p.texto}</span><span className={cn("text-xs font-semibold", p.status === "pendente" ? "text-muted-foreground" : p.status === "aprovado" ? "text-emerald-700" : "text-destructive")}>{ROTULO[p.status]}</span></div>
              <p className="text-xs text-muted-foreground">{p.modeloNome}{dados.unidades.length > 1 ? ` · ${p.unidade}` : ""} · pedido em {dataBR(p.criadoEm.slice(0, 10))}</p>
              {p.decisao?.resposta && <p className="mt-1 text-sm text-foreground"><b className="font-semibold">Resposta:</b> {p.decisao.resposta}</p>}
            </li>
          ))}
        </ul>
      )}
      {pedidos.length === 0 && !aberto && <p className="text-sm text-muted-foreground">Nenhum pedido feito ainda.</p>}
    </ChartCard>
  );
}
