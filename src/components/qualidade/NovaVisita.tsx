import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, Info, MapPin, Plus, UserRound, X } from "lucide-react";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { type DadosQualidade, type ItemModelo, type ModeloChecklist, exigePlano, itensDaUnidade, pctTexto, pedeSelfie } from "@/data/qualidade";
import { enviarFoto, fazerCheckin, lerLocalizacao, reduzirFoto, reduzirSelfie, salvarEnvio, salvarVisita, type RespostaCheckin } from "@/lib/qualidade";
import { ehDono } from "@/lib/auth";

type FotoLocal = { previa: string; dados: string };
interface EquipamentoLocal { codigo: string; descricao: string; fotos: FotoLocal[] }
/** `na`: a pessoa marcou "não se aplica" de propósito (item sem resposta não fica com esse botão aceso). */
interface PlanoLocal { oQue: string; prazo: string; responsavel: string }
interface Resposta { conforme: boolean | null; na?: boolean; comentario: string; fotos: FotoLocal[]; equipamentos: EquipamentoLocal[]; vencimento: string; plano?: PlanoLocal }
const vazia = (): Resposta => ({ conforme: null, na: false, comentario: "", fotos: [], equipamentos: [], vencimento: "" });
/** Nos itens de vencimento a pessoa só informa a data: está em dia se ela é igual ou depois da data da visita (o servidor refaz a conta). */
const efetiva = (item: ItemModelo, r: Resposta, dataVisita: string): Resposta => (item.tipo === "vencimento" ? { ...r, conforme: r.vencimento ? r.vencimento >= dataVisita : null } : r);
const equipamentoVazio = (): EquipamentoLocal => ({ codigo: "", descricao: "", fotos: [] });

/** Lê a foto escolhida no celular e a devolve já reduzida, com a prévia para mostrar na tela. */
async function lerFoto(arquivo: File): Promise<FotoLocal> {
  const dados = await reduzirFoto(arquivo);
  return { previa: `data:image/jpeg;base64,${dados}`, dados };
}

/** A lista de equipamentos parados: um registro por equipamento, com código, descrição e foto. */
function Equipamentos({ item, lista, onChange }: { item: ItemModelo; lista: EquipamentoLocal[]; onChange: (l: EquipamentoLocal[]) => void }) {
  const exigeFoto = item.foto !== "nenhuma";
  const edita = (i: number, campos: Partial<EquipamentoLocal>) => onChange(lista.map((e, j) => (j === i ? { ...e, ...campos } : e)));
  const foto = async (i: number, arquivo: File | undefined, entrada: HTMLInputElement) => {
    if (!arquivo) return;
    try { edita(i, { fotos: [...lista[i].fotos, await lerFoto(arquivo)].slice(0, 3) }); } catch { toast({ title: "Não consegui usar essa foto", description: "Tente outra ou tire de novo.", variant: "destructive" }); }
    entrada.value = "";
  };
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Equipamentos parados ({lista.length}){exigeFoto ? ": cada um pede código e foto" : ""}</p>
      {lista.map((e, i) => (
        <div key={i} className="rounded-xl border border-border bg-secondary/30 p-2">
          <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_auto]">
            <input value={e.codigo} maxLength={40} onChange={(ev) => edita(i, { codigo: ev.target.value })} placeholder="Código" aria-label={`Código do equipamento ${i + 1}`} className="h-9 rounded-lg border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            <input value={e.descricao} maxLength={200} onChange={(ev) => edita(i, { descricao: ev.target.value })} placeholder="O que está parado? (ex.: esteira 3, travada)" aria-label={`Descrição do equipamento ${i + 1}`} className="h-9 rounded-lg border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            <button type="button" aria-label={`Remover o equipamento ${i + 1}`} onClick={() => onChange(lista.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" aria-hidden /></button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {e.fotos.map((f, k) => (
              <span key={k} className="relative">
                <img src={f.previa} alt={`Foto do equipamento ${e.codigo || i + 1}`} className="h-16 w-16 rounded-lg object-cover" />
                <button type="button" aria-label="Remover a foto" onClick={() => edita(i, { fotos: e.fotos.filter((_, j) => j !== k) })} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background"><X className="h-3 w-3" aria-hidden /></button>
              </span>
            ))}
            {e.fotos.length < 3 && (
              <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-input bg-white px-3 text-sm font-medium hover:bg-secondary focus-within:ring-2 focus-within:ring-ring">
                <Camera className="h-4 w-4" aria-hidden />Foto
                <input type="file" accept="image/*" capture="environment" className="sr-only" aria-label={`Foto do equipamento ${i + 1}`} onChange={(ev) => void foto(i, ev.target.files?.[0], ev.target)} />
              </label>
            )}
            {exigeFoto && e.fotos.length === 0 && <span className="text-xs font-medium text-destructive">Foto obrigatória</span>}
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...lista, equipamentoVazio()])}><Plus className="h-4 w-4" aria-hidden /> Equipamento parado</Button>
    </div>
  );
}

/** Nota provisória enquanto a pessoa responde (a mesma conta do servidor: conformes entre os respondidos). */
const notaAgora = (itens: ItemModelo[], rs: Resposta[], dataVisita: string) => {
  const v = itens.map((i, k) => ({ peso: i.peso ?? 1, r: efetiva(i, rs[k], dataVisita) })).filter((x) => x.r.conforme !== null);
  const total = v.reduce((t, x) => t + x.peso, 0);
  return total ? (v.filter((x) => x.r.conforme).reduce((t, x) => t + x.peso, 0) / total) * 100 : null;
};

/** Ícone "Como avaliar" ao lado da pergunta: abre a orientação do item (o que observar e o que conta como conforme). */
export function InstrucaoDoItem({ texto, titulo }: { texto: string; titulo: string }) {
  const [aberta, setAberta] = useState(false);
  useEffect(() => {
    if (!aberta) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberta(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [aberta]);
  return (
    <>
      <button type="button" onClick={() => setAberta(true)} aria-label={`Como avaliar: ${titulo}`} title="Como avaliar" className="ml-2 inline-flex items-center gap-1 rounded-full border border-border bg-white px-2 py-0.5 align-middle text-xs font-medium text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Info className="h-3 w-3" aria-hidden />Como avaliar
      </button>
      {aberta && (
        <div role="dialog" aria-modal="true" aria-label="Como avaliar" onClick={() => setAberta(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div onClick={(e) => e.stopPropagation()} className="max-h-[80vh] w-full max-w-md overflow-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3"><h4 className="text-sm font-semibold text-foreground">Como avaliar</h4><button type="button" onClick={() => setAberta(false)} aria-label="Fechar" className="rounded-full p-1 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" aria-hidden /></button></div>
            <p className="mt-1 text-xs text-muted-foreground">{titulo}</p>
            <p className="mt-3 whitespace-pre-line text-sm text-foreground">{texto}</p>
          </div>
        </div>
      )}
    </>
  );
}

/** Um item do checklist, com as respostas e as fotos. */
export function Item({ item, r: bruta, dataVisita, mostraPeso = true, pedePlano = false, onChange }: { item: ItemModelo; r: Resposta; dataVisita: string; /** O peso é da franqueadora: o gestor da unidade não o vê. */ mostraPeso?: boolean; /** Item não conforme pede o plano de ação (o quê, até quando, quem). */ pedePlano?: boolean; onChange: (r: Resposta) => void }) {
  const r = efetiva(item, bruta, dataVisita);
  const vence = item.tipo === "vencimento";
  const entrada = useRef<HTMLInputElement>(null);
  const [lendo, setLendo] = useState(false);
  // Botões pequenos: Conforme, Não conforme e Não se aplica (este só fica aceso se a pessoa o escolheu).
  const botao = (valor: boolean | null, rotulo: string, ativo: string) => {
    const aceso = valor === null ? Boolean(bruta.na) && r.conforme === null : r.conforme === valor;
    return (
      <button type="button" aria-pressed={aceso} onClick={() => {
        if (valor === null) { onChange({ ...r, conforme: null, na: !bruta.na }); return; }
        const c = r.conforme === valor ? null : valor;
        onChange({ ...r, conforme: c, na: false, equipamentos: item.tipo === "equipamentos" && c === false && r.equipamentos.length === 0 ? [equipamentoVazio()] : r.equipamentos });
      }}
        className={cn("rounded-lg border px-3 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", aceso ? ativo : "border-border bg-white text-muted-foreground hover:bg-secondary")}>{rotulo}</button>
    );
  };
  const adicionar = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setLendo(true);
    try {
      const dados = await reduzirFoto(arquivo);
      onChange({ ...r, fotos: [...r.fotos, { previa: `data:image/jpeg;base64,${dados}`, dados }].slice(0, 10) });
    } catch {
      toast({ title: "Não consegui usar essa foto", description: "Tente outra ou tire de novo.", variant: "destructive" });
    } finally {
      setLendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  };
  return (
    <li className="rounded-xl border border-border bg-white p-3">
      <p className="text-sm font-medium text-foreground">{item.texto}{item.instrucao && <InstrucaoDoItem texto={item.instrucao} titulo={item.texto} />}{item.foto === "sempre" && <span className="ml-2 rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-muted-foreground">pede foto</span>}{mostraPeso && (item.peso ?? 1) > 1 && <span className="ml-2 rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-muted-foreground">peso {item.peso}</span>}</p>
      {vence ? (
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted-foreground">Data de vencimento
            <input type="date" value={bruta.vencimento} onChange={(e) => onChange({ ...bruta, vencimento: e.target.value })} aria-label={`Data de vencimento: ${item.texto}`} className="mt-1 block h-9 rounded-xl border border-input bg-white px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </label>
          {bruta.vencimento && <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", r.conforme ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800")}>{r.conforme ? "Em dia" : "Vencido"}</span>}
          {!bruta.vencimento && <span className="text-xs text-muted-foreground">Sem data, o item fica como não se aplica.</span>}
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`Resposta: ${item.texto}`}>
          {botao(true, "Conforme", "border-emerald-600 bg-emerald-50 text-emerald-800")}
          {botao(false, "Não conforme", "border-destructive bg-red-50 text-red-800")}
          {botao(null, "Não se aplica", "border-foreground/30 bg-secondary text-foreground")}
        </div>
      )}
      {item.tipo === "equipamentos" && r.conforme === false && <div className="mt-2"><Equipamentos item={item} lista={r.equipamentos} onChange={(equipamentos) => onChange({ ...r, equipamentos })} /></div>}
      {pedePlano && r.conforme === false && (
        <div className="mt-2 space-y-2 rounded-xl border border-warning/40 bg-warning/5 p-3" aria-label={`Plano de ação: ${item.texto}`}>
          <p className="text-xs font-semibold text-foreground">Plano de ação (quem registra a visita confirma a correção depois)</p>
          <input value={r.plano?.oQue ?? ""} maxLength={300} onChange={(e) => onChange({ ...r, plano: { prazo: "", responsavel: "", ...r.plano, oQue: e.target.value } })} placeholder="O que será feito? (ex.: repor o sabonete e consertar a descarga)" aria-label={`O que será feito: ${item.texto}`} className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <div className="flex flex-wrap gap-2">
            <label className="text-xs text-muted-foreground">Até quando
              <input type="date" min={dataVisita} value={r.plano?.prazo ?? ""} onChange={(e) => onChange({ ...r, plano: { oQue: "", responsavel: "", ...r.plano, prazo: e.target.value } })} aria-label={`Prazo do plano: ${item.texto}`} className="mt-1 block h-9 rounded-lg border border-input bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </label>
            <label className="min-w-[10rem] flex-1 text-xs text-muted-foreground">Quem faz (opcional)
              <input value={r.plano?.responsavel ?? ""} maxLength={80} onChange={(e) => onChange({ ...r, plano: { oQue: "", prazo: "", ...r.plano, responsavel: e.target.value } })} placeholder="Nome do responsável" aria-label={`Responsável pelo plano: ${item.texto}`} className="mt-1 h-9 w-full rounded-lg border border-input bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </label>
          </div>
        </div>
      )}
      {r.conforme !== null && (
        <div className="mt-2 space-y-2">
          <textarea value={r.comentario} maxLength={1000} rows={2} onChange={(e) => onChange({ ...r, comentario: e.target.value })} placeholder={r.conforme || item.tipo === "equipamentos" || vence || pedePlano ? "Comentário (opcional)" : "O que precisa ser corrigido? (obrigatório)"} aria-label={`Comentário: ${item.texto}`}
            className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <div className="flex flex-wrap items-center gap-2">
            {r.fotos.map((f, i) => (
              <span key={i} className="relative">
                <img src={f.previa} alt="Foto anexada" className="h-16 w-16 rounded-lg object-cover" />
                <button type="button" aria-label="Remover a foto" onClick={() => onChange({ ...r, fotos: r.fotos.filter((_, j) => j !== i) })} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background"><X className="h-3 w-3" aria-hidden /></button>
              </span>
            ))}
            {r.conforme === false && item.tipo !== "equipamentos" && item.foto === "nao_conforme" && r.fotos.length === 0 && <span className="text-xs font-medium text-destructive">Foto obrigatória neste item.</span>}
            {r.fotos.length < 10 && (
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
const horaDe = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const metros = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} km` : `${m} m`);

/**
 * Visita da franqueadora ou checklist da própria unidade. Começa pelo check-in (horário do servidor e localização do aparelho, se a pessoa permitir), termina
 * com o check-out automático no envio. O check-in pede uma selfie da pessoa na unidade quando o checklist está marcado para isso (por padrão, a visita da
 * franqueadora). A data é sempre a de hoje e ninguém escolhe horário: tudo vem do check-in.
 */
export function NovaVisita({ dados, hoje, modo = "visita", onSalvou }: { dados: DadosQualidade; hoje: string; modo?: "visita" | "unidade"; onSalvou: (unidade: string) => void }) {
  const daUnidade = modo === "unidade";
  const ativos = dados.modelos.filter((m) => m.ativo && (!daUnidade || m.frequencia !== "visita"));
  const [unidade, setUnidade] = useState(daUnidade && dados.unidades.length === 1 ? dados.unidades[0] : "");
  const [modeloId, setModeloId] = useState(ativos.length === 1 ? ativos[0].id : ""); // com um checklist só, já vem escolhido
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({});
  const [observacao, setObservacao] = useState("");
  const [checkin, setCheckin] = useState<RespostaCheckin | null>(null);
  const [iniciando, setIniciando] = useState(false);
  const [selfie, setSelfie] = useState<{ previa: string; dados: string } | null>(null);
  const [lendoSelfie, setLendoSelfie] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const modelo: ModeloChecklist | undefined = ativos.find((m) => m.id === modeloId);
  // Só os itens que valem para a unidade escolhida (o que não vale para ela nem é perguntado nem conta na nota).
  const itens = useMemo(() => itensDaUnidade(modelo?.itens ?? [], unidade), [modelo, unidade]);
  const grupos = useMemo(() => {
    const m = new Map<string, ItemModelo[]>();
    for (const i of itens) m.set(i.grupo, [...(m.get(i.grupo) ?? []), i]);
    return [...m.entries()];
  }, [itens]);
  const lista = itens.map((i) => respostas[i.id] ?? vazia());
  const nota = notaAgora(itens, lista, hoje);

  if (ativos.length === 0) return <ChartCard title={daUnidade ? "Checklist da unidade" : "Nova visita"}><ChartEmpty>{daUnidade ? "Ainda não há checklist disponível para a sua unidade." : "Crie um checklist na aba Checklists para registrar a primeira visita."}</ChartEmpty></ChartCard>;

  const trocou = () => { setCheckin(null); setRespostas({}); setSelfie(null); setErro(""); };
  const tirarSelfie = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setLendoSelfie(true);
    try {
      const dados = await reduzirSelfie(arquivo);
      setSelfie({ previa: `data:image/jpeg;base64,${dados}`, dados });
    } catch {
      setErro("Não consegui usar essa selfie. Tire outra.");
    }
    setLendoSelfie(false);
  };
  const iniciar = async () => {
    if (!modelo) return;
    setErro("");
    setIniciando(true);
    const loc = await lerLocalizacao();
    const r = await fazerCheckin({ unidade, modeloId: modelo.id, loc, ...(selfie ? { selfie: selfie.dados } : {}) });
    setIniciando(false);
    if (!r.ok) return setErro(r.erro);
    setCheckin(r.dados.checkin);
  };

  const enviar = async () => {
    if (!modelo || !checkin) return;
    // Plano de ação de cada item não conforme (quando o checklist pede): o quê e até quando.
    const planos = !daUnidade && exigePlano(modelo)
      ? itens.filter((i) => (respostas[i.id] ?? vazia()).conforme === false).map((i) => ({ itemId: i.id, ...(respostas[i.id]?.plano ?? { oQue: "", prazo: "", responsavel: "" }) }))
      : [];
    const incompleto = planos.find((p) => (p.oQue ?? "").trim().length < 3 || !p.prazo);
    if (incompleto) return setErro(`Falta o plano de ação do item não conforme: "${itens.find((i) => i.id === incompleto.itemId)?.texto}" (o que será feito e até quando).`);
    setErro("");
    setEnviando(true);
    try {
      const localizacaoSaida = await lerLocalizacao(8000); // check-out: horário do servidor e, se a pessoa permitir, a localização
      const itensEnviados = [];
      for (const item of itens) {
        const r = respostas[item.id] ?? vazia();
        const fotos: string[] = [];
        for (const f of r.fotos) {
          const up = await enviarFoto(f.dados);
          if (!up.ok) { setErro(up.erro); setEnviando(false); return; }
          fotos.push(up.dados.id);
        }
        const equipamentos = [];
        if (item.tipo === "equipamentos" && r.conforme === false) {
          for (const e of r.equipamentos.filter((x) => x.codigo.trim())) {
            const ids: string[] = [];
            for (const f of e.fotos) {
              const up = await enviarFoto(f.dados);
              if (!up.ok) { setErro(up.erro); setEnviando(false); return; }
              ids.push(up.dados.id);
            }
            equipamentos.push({ codigo: e.codigo, descricao: e.descricao, fotos: ids });
          }
        }
        itensEnviados.push({ itemId: item.id, conforme: item.tipo === "vencimento" ? null : r.conforme, comentario: r.comentario, fotos, ...(item.tipo === "equipamentos" ? { equipamentos } : {}), ...(item.tipo === "vencimento" ? { vencimento: r.vencimento } : {}) });
      }
      const res = daUnidade
        ? await salvarEnvio({ modeloId: modelo.id, unidade, checkinId: checkin.id, localizacaoSaida, respostas: itensEnviados, observacao })
        : await salvarVisita({ modeloId: modelo.id, unidade, checkinId: checkin.id, localizacaoSaida, respostas: itensEnviados, observacao, planos });
      if (!res.ok) { setErro(res.erro); setEnviando(false); return; }
      toast(daUnidade ? { title: "Checklist enviado", description: `${unidade}: ${modelo.nome}. Check-out registrado.` } : { title: "Visita registrada", description: `${unidade}: nota ${pctTexto((res.dados as { visita: { nota: number | null } }).visita.nota)}. Check-out registrado.` });
      setRespostas({}); setObservacao(""); setModeloId(""); setCheckin(null); setSelfie(null);
      onSalvou(unidade);
    } catch {
      setErro("Não consegui enviar agora. Tente de novo.");
    }
    setEnviando(false);
  };

  return (
    <ChartCard title={daUnidade ? "Preencher o checklist" : "Nova visita"} subtitle={daUnidade ? "Faça o check-in, responda cada item, fotografe o que for preciso e envie. O envio vale para hoje." : "Escolha a unidade e o checklist, faça o check-in com a selfie, responda cada item e registre a visita."}>
      <div className="flex flex-wrap items-end gap-3">
        {!(daUnidade && dados.unidades.length === 1) && <label className="text-xs text-muted-foreground">Unidade
          <Select aria-label="Unidade visitada" className="mt-1 h-9 w-56 max-w-full" value={unidade} onChange={(e) => { setUnidade(e.target.value); trocou(); }}>
            <option value="">Escolha…</option>
            {dados.unidades.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
        </label>}
        <label className="text-xs text-muted-foreground">Checklist
          <Select aria-label="Checklist da visita" className="mt-1 h-9 w-64 max-w-full" value={modeloId} onChange={(e) => { setModeloId(e.target.value); trocou(); }}>
            <option value="">Escolha…</option>
            {ativos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </Select>
        </label>
      </div>

      {modelo && unidade && !checkin && (
        <div className="mt-5 space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground"><MapPin className="h-4 w-4" aria-hidden />Check-in</p>
          <p className="text-sm text-muted-foreground">Ao iniciar, o Atlas registra o horário e a localização do seu aparelho (o navegador vai pedir a sua permissão), só para confirmar que o checklist foi feito na unidade. Sem a localização, ficam registrados apenas o horário e o endereço IP. Ao enviar, o check-out é registrado do mesmo jeito.</p>
          {pedeSelfie(modelo) && (
            <div className="space-y-2 rounded-lg border border-border bg-white p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground"><UserRound className="h-4 w-4" aria-hidden />Selfie na unidade</p>
              <p className="text-xs text-muted-foreground">Tire uma selfie aí na academia. Ela fica guardada por poucos meses, só para confirmar que o checklist foi feito na unidade.</p>
              <div className="flex flex-wrap items-center gap-3">
                {selfie && <img src={selfie.previa} alt="Sua selfie" className="h-20 w-20 rounded-lg object-cover" />}
                <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-input bg-white px-3 text-sm font-medium hover:bg-secondary focus-within:ring-2 focus-within:ring-ring">
                  <Camera className="h-4 w-4" aria-hidden />{lendoSelfie ? "Lendo..." : selfie ? "Tirar outra" : "Tirar a selfie"}
                  <input type="file" accept="image/*" capture="user" className="sr-only" aria-label="Tirar a selfie" onChange={(e) => { void tirarSelfie(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
              </div>
            </div>
          )}
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <Button onClick={() => void iniciar()} disabled={iniciando || (pedeSelfie(modelo) && !selfie)}><MapPin className="h-4 w-4" aria-hidden />{iniciando ? "Registrando o check-in..." : "Iniciar o checklist (check-in)"}</Button>
        </div>
      )}

      {modelo && unidade && checkin && (
        <div className="mt-5 space-y-5">
          <p className={cn("flex flex-wrap items-center gap-x-2 rounded-xl px-3 py-2 text-sm", checkin.foraDoLocal ? "bg-warning/10 text-foreground" : "bg-secondary/50 text-foreground")}>
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            <span><b className="font-semibold">Check-in às {horaDe(checkin.em)}</b>
              {checkin.comLocalizacao ? (checkin.distanciaM !== undefined ? ` · localização registrada, a ${metros(checkin.distanciaM)} da unidade${checkin.foraDoLocal ? " (fora do local)" : ""}` : " · localização registrada") : " · sem localização (ficou só o horário e o IP)"}</span>
          </p>
          {grupos.map(([grupo, itens]) => (
            <section key={grupo || "geral"} className="space-y-2">
              {grupo && <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{grupo}</h4>}
              <ul className="space-y-2">{itens.map((i) => <Item key={i.id} item={i} r={respostas[i.id] ?? vazia()} dataVisita={hoje} mostraPeso={!daUnidade && ehDono()} pedePlano={!daUnidade && modelo ? exigePlano(modelo) : false} onChange={(r) => setRespostas((s) => ({ ...s, [i.id]: r }))} />)}</ul>
            </section>
          ))}
          <label className="block text-xs text-muted-foreground">Observação geral (opcional)
            <textarea value={observacao} maxLength={500} onChange={(e) => setObservacao(e.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </label>
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void enviar()} disabled={enviando}><Check className="h-4 w-4" aria-hidden />{enviando ? "Registrando o check-out..." : daUnidade ? "Enviar e fazer o check-out" : "Registrar a visita e fazer o check-out"}</Button>
            {!daUnidade && ehDono() && <span className="text-sm text-muted-foreground">Nota até agora: <b className="font-semibold text-foreground tabular-nums">{pctTexto(nota === null ? null : Math.round(nota * 10) / 10)}</b></span>}
          </div>
        </div>
      )}
      {(!modelo || !unidade) && <p className="mt-4 text-sm text-muted-foreground">{daUnidade && dados.unidades.length === 1 ? "Escolha o checklist para começar." : "Escolha a unidade e o checklist para começar."}</p>}
    </ChartCard>
  );
}
