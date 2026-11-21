import { useState } from "react";
import { Camera, Check, CornerUpLeft, X } from "lucide-react";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ehDono, getUsuario } from "@/lib/auth";
import { type DadosQualidade, type PlanoAcao, dataBR, planoAtrasado, podeValidarPlano } from "@/data/qualidade";
import { enviarFoto, marcarPlanoFeito, reduzirFoto, validarPlano } from "@/lib/qualidade";
import { FotoGuardada } from "@/components/qualidade/Fotos";

const ACAO = { criado: "Plano criado", feito: "Unidade marcou como feito", devolvido: "Devolvido para a unidade", confirmado: "Correção confirmada" } as const;
const STATUS = { aberto: "Aberto", validacao: "Aguardando confirmação de quem visitou", concluido: "Concluído" } as const;
const diasAte = (de: string, ate: string) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86400000);

function Prazo({ p, hoje }: { p: PlanoAcao; hoje: string }) {
  if (p.status === "concluido") return <span className="text-muted-foreground">prazo {dataBR(p.prazo)}</span>;
  const atrasado = planoAtrasado(p, hoje);
  return <span className={cn(atrasado ? "font-semibold text-destructive" : "text-muted-foreground")}>{atrasado ? `atrasado há ${diasAte(p.prazo, hoje)} dia${diasAte(p.prazo, hoje) === 1 ? "" : "s"} (prazo ${dataBR(p.prazo)})` : `prazo ${dataBR(p.prazo)}`}</span>;
}

function Historico({ p }: { p: PlanoAcao }) {
  return (
    <ol className="mt-2 space-y-1.5 border-l border-border pl-3">
      {p.historico.map((h, i) => (
        <li key={i} className="text-xs text-muted-foreground">
          <b className="font-semibold text-foreground">{ACAO[h.acao]}</b> · {h.por.nome || "—"} · {dataBR(h.em.slice(0, 10))}
          {h.texto && <span className="block text-sm text-foreground">{h.texto}</span>}
          {h.fotos.length > 0 && <span className="mt-1 flex flex-wrap gap-2">{h.fotos.map((f) => <FotoGuardada key={f} id={f} />)}</span>}
        </li>
      ))}
    </ol>
  );
}

/** Quem criou o plano (ou o dono) confirma a correção ou devolve para a unidade com o que falta. */
function Validacao({ p, onMudou }: { p: PlanoAcao; onMudou: () => void }) {
  const [modo, setModo] = useState<"confirmar" | "devolver" | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const enviar = async () => {
    if (!modo) return;
    setEnviando(true);
    setErro("");
    const r = await validarPlano(p.id, { decisao: modo, texto });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    toast({ title: modo === "confirmar" ? "Correção confirmada" : "Plano devolvido para a unidade" });
    onMudou();
  };
  if (!modo) {
    return (
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => setModo("confirmar")}><Check className="h-4 w-4" aria-hidden /> Confirmar a correção</Button>
        <Button size="sm" variant="outline" onClick={() => setModo("devolver")}><CornerUpLeft className="h-4 w-4" aria-hidden /> Devolver</Button>
      </div>
    );
  }
  return (
    <div className="mt-3 space-y-2 rounded-lg bg-secondary/30 p-3">
      <input value={texto} maxLength={300} onChange={(e) => setTexto(e.target.value)} aria-label={modo === "confirmar" ? "Comentário da confirmação" : "O que ainda falta"} placeholder={modo === "confirmar" ? "Comentário (opcional)" : "O que ainda falta? (aparece para a unidade)"} className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <div className="flex gap-2"><Button size="sm" onClick={() => void enviar()} disabled={enviando || (modo === "devolver" && texto.trim().length < 3)}>{enviando ? "Salvando..." : modo === "confirmar" ? "Confirmar" : "Devolver para a unidade"}</Button><Button size="sm" variant="ghost" onClick={() => setModo(null)}>Cancelar</Button></div>
    </div>
  );
}

type Filtro = "validar" | "validacao" | "abertos" | "concluidos" | "todos";

/** Aba da franqueadora: os planos de ação das visitas. Quem criou o plano confirma (ou devolve) a correção que a unidade marcou como feita; o dono também pode. */
export function PlanosDaFranqueadora({ dados, hoje, onMudou }: { dados: DadosQualidade; hoje: string; onMudou: () => void }) {
  const email = getUsuario()?.email ?? "";
  const dono = ehDono();
  const todos = dados.planos ?? [];
  const meus = todos.filter((p) => podeValidarPlano(p, email, dono));
  const [filtro, setFiltro] = useState<Filtro>(meus.length > 0 ? "validar" : "abertos");
  const [unidade, setUnidade] = useState("");
  const por: Record<Filtro, PlanoAcao[]> = {
    validar: meus, validacao: todos.filter((p) => p.status === "validacao"), abertos: todos.filter((p) => p.status === "aberto"), concluidos: todos.filter((p) => p.status === "concluido"), todos,
  };
  const lista = [...por[filtro]].filter((p) => !unidade || p.unidade === unidade).sort((a, b) => (a.status === "concluido" ? 1 : 0) - (b.status === "concluido" ? 1 : 0) || a.prazo.localeCompare(b.prazo));
  const atrasados = todos.filter((p) => planoAtrasado(p, hoje)).length;
  const abas: [Filtro, string][] = [["validar", `Para eu confirmar (${meus.length})`], ["validacao", `Aguardando confirmação (${por.validacao.length})`], ["abertos", `Abertos (${por.abertos.length})`], ["concluidos", `Concluídos (${por.concluidos.length})`], ["todos", `Todos (${todos.length})`]];
  return (
    <ChartCard
      title="Planos de ação"
      subtitle={`O que corrigir depois das visitas. A unidade marca como feito; quem criou o plano confirma. ${atrasados > 0 ? `${atrasados} atrasado${atrasados === 1 ? "" : "s"}.` : "Nenhum atrasado."}`}
      legend={<Select aria-label="Unidade" className="h-9 w-48" value={unidade} onChange={(e) => setUnidade(e.target.value)}><option value="">Todas as unidades</option>{dados.unidades.map((u) => <option key={u} value={u}>{u}</option>)}</Select>}
    >
      <div role="group" aria-label="Filtro dos planos" className="mb-4 flex flex-wrap rounded-xl border border-border bg-white p-0.5">
        {abas.map(([id, rotulo]) => <button key={id} type="button" aria-pressed={filtro === id} onClick={() => setFiltro(id)} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", filtro === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{rotulo}</button>)}
      </div>
      {lista.length === 0 ? (
        <ChartEmpty>{todos.length === 0 ? "Nenhum plano de ação ainda. Eles nascem nas visitas, nos itens não conformes." : "Nenhum plano neste filtro."}</ChartEmpty>
      ) : (
        <ul className="space-y-3">
          {lista.map((p) => (
            <li key={p.id} className="rounded-xl border border-border bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{p.itemTexto}</p>
                <span className={cn("text-xs font-semibold", p.status === "concluido" ? "text-emerald-700" : p.status === "validacao" ? "text-warning" : planoAtrasado(p, hoje) ? "text-destructive" : "text-muted-foreground")}>{STATUS[p.status]}</span>
              </div>
              <p className="text-xs text-muted-foreground">{p.unidade} · {p.modeloNome} · criado por {p.criadoPor.nome || "—"} em {dataBR(p.criadoEm.slice(0, 10))} · <Prazo p={p} hoje={hoje} />{p.responsavel ? ` · responsável: ${p.responsavel}` : ""}</p>
              <p className="mt-1 text-sm text-foreground"><b className="font-semibold">O que será feito:</b> {p.oQue}</p>
              <Historico p={p} />
              {podeValidarPlano(p, email, dono) && <Validacao p={p} onMudou={onMudou} />}
              {p.status === "validacao" && !podeValidarPlano(p, email, dono) && <p className="mt-2 text-xs text-muted-foreground">Quem confirma é {p.criadoPor.nome || "quem criou o plano"} (ou o dono).</p>}
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}

/** Na tela da unidade: os planos de ação dela. Os abertos pedem que a unidade diga o que fez (com foto, se quiser) e mande para a confirmação de quem visitou. */
export function PlanosDaUnidade({ dados, hoje, onMudou }: { dados: DadosQualidade; hoje: string; onMudou: () => void }) {
  const planos = [...(dados.planos ?? [])].sort((a, b) => (a.status === "concluido" ? 1 : 0) - (b.status === "concluido" ? 1 : 0) || a.prazo.localeCompare(b.prazo)).slice(0, 30);
  const [aberto, setAberto] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [fotos, setFotos] = useState<{ previa: string; dados: string }[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  if (planos.length === 0) return null;
  const adicionar = async (arquivo: File | undefined) => {
    if (!arquivo || fotos.length >= 3) return;
    try { const d = await reduzirFoto(arquivo); setFotos((f) => [...f, { previa: `data:image/jpeg;base64,${d}`, dados: d }]); } catch { setErro("Não consegui usar essa foto."); }
  };
  const enviar = async (p: PlanoAcao) => {
    setErro("");
    setEnviando(true);
    const ids: string[] = [];
    for (const f of fotos) {
      const up = await enviarFoto(f.dados);
      if (!up.ok) { setErro(up.erro); setEnviando(false); return; }
      ids.push(up.dados.id);
    }
    const r = await marcarPlanoFeito(p.id, { texto, fotos: ids });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    toast({ title: "Enviado para confirmação", description: `${p.criadoPor.nome || "Quem visitou"} vai conferir a correção.` });
    setAberto(null); setTexto(""); setFotos([]);
    onMudou();
  };
  return (
    <ChartCard title="Planos de ação da unidade" subtitle="O que ficou para corrigir depois das visitas. Quando fizer, marque como feito: quem criou o plano confirma.">
      <ul className="space-y-3">
        {planos.map((p) => {
          const devolvido = p.status === "aberto" ? [...p.historico].reverse().find((h) => h.acao === "devolvido") : undefined;
          return (
            <li key={p.id} className="rounded-xl border border-border bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-sm font-medium text-foreground">{p.oQue}</p><span className={cn("text-xs font-semibold", p.status === "concluido" ? "text-emerald-700" : p.status === "validacao" ? "text-warning" : planoAtrasado(p, hoje) ? "text-destructive" : "text-muted-foreground")}>{STATUS[p.status]}</span></div>
              <p className="text-xs text-muted-foreground">{p.itemTexto} · <Prazo p={p} hoje={hoje} />{p.responsavel ? ` · responsável: ${p.responsavel}` : ""}</p>
              {devolvido && <p className="mt-1 text-sm text-destructive"><b className="font-semibold">Devolvido:</b> {devolvido.texto}</p>}
              {p.status === "aberto" && aberto !== p.id && <Button size="sm" className="mt-3" onClick={() => { setAberto(p.id); setErro(""); }}>Marcar como feito</Button>}
              {p.status === "aberto" && aberto === p.id && (
                <div className="mt-3 space-y-2 rounded-lg bg-secondary/30 p-3">
                  <input value={texto} maxLength={300} onChange={(e) => setTexto(e.target.value)} placeholder="O que foi feito?" aria-label="O que foi feito" className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  <div className="flex flex-wrap items-center gap-2">
                    {fotos.map((f, i) => <span key={i} className="relative"><img src={f.previa} alt="Foto anexada" className="h-14 w-14 rounded-lg object-cover" /><button type="button" aria-label="Remover a foto" onClick={() => setFotos((l) => l.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background"><X className="h-3 w-3" aria-hidden /></button></span>)}
                    {fotos.length < 3 && <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-input bg-white px-3 text-sm font-medium hover:bg-secondary focus-within:ring-2 focus-within:ring-ring"><Camera className="h-4 w-4" aria-hidden />Foto<input type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Foto do que foi feito" onChange={(e) => { void adicionar(e.target.files?.[0]); e.target.value = ""; }} /></label>}
                  </div>
                  {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
                  <div className="flex gap-2"><Button size="sm" onClick={() => void enviar(p)} disabled={enviando || texto.trim().length < 3}>{enviando ? "Enviando..." : "Enviar para confirmação"}</Button><Button size="sm" variant="ghost" onClick={() => setAberto(null)}>Cancelar</Button></div>
                </div>
              )}
              {p.historico.some((h) => h.acao !== "criado") && <Historico p={p} />}
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}
