import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Check, ChevronDown, Download, Trash2, X } from "lucide-react";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AXIS_TICK, GRID, REF_LINE, TOOLTIP_STYLE } from "@/components/chartTheme";
import { type DadosQualidade, type MarcaDeLocal, type PlanoAcao, type Visita, NOTA_ATENCAO, NOTA_BOA, avaliadoresDasVisitas, dataBR, evolucaoDaNota, gruposDasVisitas, notaFiltrada, pctTexto, tomDaNota } from "@/data/qualidade";
import { apagarVisita } from "@/lib/qualidade";
import { ehDono, getUsuario, podeEditarQualidade } from "@/lib/auth";
import { FotoGuardada } from "@/components/qualidade/Fotos";

const CHIP = { good: "bg-success/10 text-success", warn: "bg-warning/10 text-warning", bad: "bg-destructive/10 text-destructive", neutral: "bg-secondary text-muted-foreground" } as const;
const POR_VEZ = 15;

const horaSP = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const metrosTxt = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} km` : `${m} m`);

/** Uma linha do check-in ou do check-out: horário, onde foi (com o mapa) ou só o IP, e se estava fora do local da unidade. */
function LinhaMarca({ titulo, m }: { titulo: string; m: MarcaDeLocal }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2">
      <b className="font-semibold text-foreground">{titulo} {horaSP(m.em)}</b>
      {m.loc ? (
        <>
          <span className={cn(m.foraDoLocal ? "font-semibold text-destructive" : "text-muted-foreground")}>
            {m.distanciaM !== undefined ? `${m.foraDoLocal ? "fora do local: " : ""}a ${metrosTxt(m.distanciaM)} da unidade` : "localização registrada"}
          </span>
          <a href={`https://www.google.com/maps?q=${m.loc.lat},${m.loc.lng}`} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary-ink underline underline-offset-2">ver no mapa</a>
        </>
      ) : <span className="text-muted-foreground">sem localização (só horário e IP {m.ip || "—"})</span>}
    </li>
  );
}

/** Baixa o relatório da visita em PDF (nota, respostas por grupo, comentários, fotos, planos de ação e assinatura). A selfie não entra. */
function BotaoPdf({ v, planos }: { v: Visita; planos: PlanoAcao[] }) {
  const [gerando, setGerando] = useState(false);
  const baixar = async () => {
    setGerando(true);
    try {
      const { gerarPdfDaVisita } = await import("@/lib/qualidadePdf");
      await gerarPdfDaVisita(v, planos, { email: getUsuario()?.email ?? "" });
    } catch {
      toast({ title: "Não consegui gerar o PDF agora", description: "Tente de novo em instantes.", variant: "destructive" });
    } finally {
      setGerando(false);
    }
  };
  return <Button variant="outline" size="sm" onClick={() => void baixar()} disabled={gerando}><Download className="h-4 w-4" aria-hidden /> {gerando ? "Gerando PDF..." : "Baixar PDF"}</Button>;
}

export function Detalhe({ v, planos = [], onApagar }: { v: Visita; planos?: PlanoAcao[]; onApagar?: () => void }) {
  const falhas = v.respostas.filter((r) => r.conforme === false).length;
  return (
    <div className="space-y-3 border-t border-border bg-secondary/30 px-4 py-4">
      {(v.checkin || v.checkout) && (
        <ul className="space-y-1 rounded-xl border border-border bg-white px-3 py-2 text-sm" aria-label="Check-in e check-out">
          {v.checkin && <LinhaMarca titulo="Check-in" m={v.checkin} />}
          {v.checkout && <LinhaMarca titulo="Check-out" m={v.checkout} />}
          {v.duracaoMin !== undefined && <li className="text-xs text-muted-foreground">Duração: {v.duracaoMin} min</li>}
        </ul>
      )}
      {v.checkin?.selfie && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-white px-3 py-2">
          {podeEditarQualidade() || ehDono() ? <FotoGuardada id={v.checkin.selfie} selfie /> : null}
          <p className="text-sm text-foreground">Selfie no check-in{podeEditarQualidade() || ehDono() ? "" : " registrada (só quem edita a qualidade a vê)"}</p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Avaliador: <b className="font-semibold text-foreground">{v.avaliador.nome || "—"}</b>{v.chegada ? ` · chegada ${v.chegada}` : ""}{v.saida ? ` · saída ${v.saida}` : ""} · {falhas} não {falhas === 1 ? "conforme" : "conformes"}</p>
      <ul className="space-y-2">
        {v.respostas.map((r) => (
          <li key={r.itemId} className="rounded-xl border border-border bg-white px-3 py-2">
            <div className="flex items-start gap-2 text-sm">
              <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", r.conforme === true ? "bg-emerald-100 text-emerald-800" : r.conforme === false ? "bg-red-100 text-red-800" : "bg-secondary text-muted-foreground")} aria-label={r.conforme === true ? "Conforme" : r.conforme === false ? "Não conforme" : "Não se aplica"}>
                {r.conforme === true ? <Check className="h-3 w-3" aria-hidden /> : r.conforme === false ? <X className="h-3 w-3" aria-hidden /> : "–"}
              </span>
              <span className="min-w-0 text-foreground">{r.texto}{r.grupo && <span className="block text-xs text-muted-foreground">{r.grupo}</span>}</span>
            </div>
            {r.vencimento && <p className="mt-1.5 pl-7 text-sm text-muted-foreground">Vencimento: <b className="font-semibold text-foreground">{dataBR(r.vencimento)}</b></p>}
            {r.comentario && <p className="mt-1.5 pl-7 text-sm text-muted-foreground">{r.comentario}</p>}
            {(r.equipamentos ?? []).length > 0 && (
              <ul className="mt-2 space-y-2 pl-7">
                {(r.equipamentos ?? []).map((e, i) => (
                  <li key={`${e.codigo}-${i}`} className="rounded-lg border border-border px-3 py-2">
                    <p className="text-sm text-foreground"><b className="font-semibold">{e.codigo}</b>{e.descricao && <span className="text-muted-foreground"> · {e.descricao}</span>}</p>
                    {e.fotos.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{e.fotos.map((f) => <FotoGuardada key={f} id={f} />)}</div>}
                  </li>
                ))}
              </ul>
            )}
            {r.fotos.length > 0 && <div className="mt-2 flex flex-wrap gap-2 pl-7">{r.fotos.map((f) => <FotoGuardada key={f} id={f} />)}</div>}
          </li>
        ))}
      </ul>
      {v.observacao && <p className="text-sm text-foreground"><b className="font-semibold">Observação:</b> {v.observacao}</p>}
      <div className="flex flex-wrap gap-2">
      <BotaoPdf v={v} planos={planos} />
      {onApagar && <Button variant="outline" size="sm" onClick={onApagar}><Trash2 className="h-4 w-4" aria-hidden /> Apagar {v.origem === "unidade" ? "este envio" : "esta visita"}</Button>}
      </div>
    </div>
  );
}

const mesCurto = (ym: string) => { const [a, m] = ym.split("-").map(Number); return new Date(a, m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(". de ", "/").replace(" de ", "/"); };

/** Média mensal da nota das visitas que passam nos filtros (ou do grupo escolhido). Precisa de pelo menos dois meses para mostrar a evolução. */
function EvolucaoDaNota({ visitas, grupo }: { visitas: Visita[]; grupo: string }) {
  const pontos = useMemo(() => evolucaoDaNota(visitas, grupo).map((p) => ({ ...p, rotulo: mesCurto(p.mes) })), [visitas, grupo]);
  if (pontos.length < 2) return <p className="mb-4 rounded-xl bg-secondary/50 px-4 py-3 text-xs text-muted-foreground">A evolução da nota aparece quando há visitas em pelo menos dois meses com esses filtros.</p>;
  return (
    <div className="mb-4" role="img" aria-label={`Evolução da nota${grupo ? ` do grupo ${grupo}` : ""}: ${pontos.map((p) => `${p.rotulo} ${pctTexto(p.nota)}`).join(", ")}`}>
      <p className="mb-1 text-xs text-muted-foreground">Nota média por mês{grupo ? ` · ${grupo}` : ""}</p>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={pontos} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="rotulo" tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(n: number) => `${n}%`} />
            <ReferenceLine y={NOTA_BOA} stroke="hsl(152 55% 38%)" {...REF_LINE} />
            <ReferenceLine y={NOTA_ATENCAO} stroke="hsl(32 92% 45%)" {...REF_LINE} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, _n, item) => [`${pctTexto(v)} (${(item.payload as { visitas: number }).visitas} ${(item.payload as { visitas: number }).visitas === 1 ? "visita" : "visitas"})`, "Nota"]} />
            <Line type="monotone" dataKey="nota" stroke="hsl(4 90% 50%)" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Histórico das visitas dos últimos 12 meses, com filtro por unidade e checklist; cada linha abre as respostas, os comentários e as fotos. */
export function Visitas({ dados, unidadeInicial, podeApagar = true, onMudou }: { dados: DadosQualidade; unidadeInicial: string; /** Só quem edita a qualidade apaga; Master sem liberação só consulta. */ podeApagar?: boolean; onMudou: () => void }) {
  const [unidade, setUnidade] = useState(unidadeInicial);
  const [modelo, setModelo] = useState("");
  const [avaliador, setAvaliador] = useState("");
  const [grupo, setGrupo] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);
  const [quantas, setQuantas] = useState(POR_VEZ);
  const avaliadores = useMemo(() => avaliadoresDasVisitas(dados.visitas), [dados.visitas]);
  const grupos = useMemo(() => gruposDasVisitas(dados.visitas), [dados.visitas]);
  // Com um grupo escolhido, só entram as visitas que têm nota nele, e a nota mostrada é a do grupo.
  const lista = dados.visitas.filter((v) => (!unidade || v.unidade === unidade) && (!modelo || v.modeloId === modelo) && (!avaliador || v.avaliador.nome === avaliador) && (!grupo || notaFiltrada(v, grupo) !== null));
  const mudar = (f: (x: string) => void) => (e: { target: { value: string } }) => { f(e.target.value); setQuantas(POR_VEZ); };
  const apagar = async (v: Visita) => {
    if (!window.confirm(`Apagar a visita de ${v.unidade} em ${dataBR(v.data)}? As fotos também serão apagadas e isso não dá para desfazer.`)) return;
    const r = await apagarVisita(v.id, v.mes);
    if (!r.ok) return toast({ title: "Não consegui apagar", description: r.erro, variant: "destructive" });
    setAberta(null);
    onMudou();
  };
  return (
    <ChartCard
      title="Visitas"
      subtitle={`${lista.length} nos últimos 12 meses`}
      legend={
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Unidade" className="h-9 w-48" value={unidade} onChange={mudar(setUnidade)}>
            <option value="">Todas as unidades</option>
            {dados.unidades.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
          <Select aria-label="Checklist" className="h-9 w-48" value={modelo} onChange={mudar(setModelo)}>
            <option value="">Todos os checklists</option>
            {dados.modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </Select>
          <Select aria-label="Avaliador" className="h-9 w-48" value={avaliador} onChange={mudar(setAvaliador)}>
            <option value="">Todos os avaliadores</option>
            {avaliadores.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
          <Select aria-label="Grupo de itens" className="h-9 w-48" value={grupo} onChange={mudar(setGrupo)}>
            <option value="">Todos os grupos</option>
            {grupos.map((g) => <option key={g} value={g}>{g}</option>)}
          </Select>
        </div>
      }
    >
      {lista.length === 0 ? (
        <ChartEmpty>Nenhuma visita registrada com esse filtro.</ChartEmpty>
      ) : (
        <>
        <EvolucaoDaNota visitas={lista} grupo={grupo} />
        <ul className="overflow-hidden rounded-xl border border-border">
          {lista.slice(0, quantas).map((v) => (
            <li key={v.id} className="border-b border-border last:border-b-0">
              <button type="button" aria-expanded={aberta === v.id} onClick={() => setAberta(aberta === v.id ? null : v.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="w-20 shrink-0 text-sm tabular-nums text-muted-foreground">{dataBR(v.data)}</span>
                <span className="min-w-0 flex-1 text-sm"><span className="font-medium text-foreground">{v.unidade}</span><span className="block truncate text-xs text-muted-foreground">{v.modeloNome}</span></span>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", CHIP[tomDaNota(notaFiltrada(v, grupo))])}>{pctTexto(notaFiltrada(v, grupo))}</span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", aberta === v.id && "rotate-180")} aria-hidden />
              </button>
              {aberta === v.id && <Detalhe v={v} planos={dados.planos ?? []} onApagar={podeApagar ? () => void apagar(v) : undefined} />}
            </li>
          ))}
        </ul>
        </>
      )}
      {lista.length > quantas && <button type="button" onClick={() => setQuantas((q) => q + POR_VEZ)} className="mt-3 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">Ver mais ({lista.length - quantas})</button>}
    </ChartCard>
  );
}
