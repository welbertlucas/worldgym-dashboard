import { useState } from "react";
import { CalendarClock, Trash2 } from "lucide-react";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { type DadosQualidade, type LinhaAgenda, type SituacaoAgenda, DIAS_SEM_VISITA, SITUACAO_AGENDA_ROTULO, agendaComSituacao, dataBR, unidadesParaAgendar } from "@/data/qualidade";
import { apagarAgendamento, salvarAgendamento } from "@/lib/qualidade";

const CHIP: Record<SituacaoAgenda, string> = { feita: "bg-success/10 text-success", atrasada: "bg-destructive/10 text-destructive", hoje: "bg-warning/10 text-warning", proxima: "bg-secondary text-muted-foreground" };
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const diaDaSemana = (iso: string) => DIAS[new Date(`${iso}T12:00:00Z`).getUTCDay()];
const POR_VEZ = 10;

/**
 * Agenda de visitas da franqueadora: quem edita marca a unidade, a data e o checklist (e quem vai); todo o menu completo (Master inclusive) vê a agenda e a
 * situação de cada visita: agendada, é hoje, atrasada ou feita (quando a unidade teve a visita com aquele checklist na data marcada ou depois).
 */
export function Agenda({ dados, hoje, podeEditar, onMudou }: { dados: DadosQualidade; hoje: string; podeEditar: boolean; onMudou: () => void }) {
  const modelos = dados.modelos.filter((m) => m.ativo && m.frequencia === "visita");
  const [unidade, setUnidade] = useState("");
  const [data, setData] = useState("");
  const [modeloId, setModeloId] = useState(modelos.length === 1 ? modelos[0].id : "");
  const [responsavel, setResponsavel] = useState("");
  const [observacao, setObservacao] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [feitas, setFeitas] = useState(POR_VEZ);
  const linhas = agendaComSituacao(dados.agenda, dados.visitas, hoje);
  const abertas = linhas.filter((l) => l.situacao !== "feita");
  const concluidas = linhas.filter((l) => l.situacao === "feita");
  const sugestoes = unidadesParaAgendar(dados.visitas, dados.unidades, dados.agenda, hoje);
  const atrasadas = abertas.filter((l) => l.situacao === "atrasada").length;
  const pronto = unidade !== "" && /^\d{4}-\d{2}-\d{2}$/.test(data) && data >= hoje && modeloId !== "";

  const agendar = async () => {
    setOcupado(true);
    const r = await salvarAgendamento({ unidade, data, modeloId, responsavel, observacao });
    setOcupado(false);
    if (!r.ok) return toast({ title: "Não consegui agendar", description: r.erro, variant: "destructive" });
    toast({ title: `Visita agendada: ${unidade}, ${dataBR(data)}` });
    setUnidade(""); setData(""); setResponsavel(""); setObservacao("");
    onMudou();
  };
  const cancelar = async (l: LinhaAgenda) => {
    if (!window.confirm(`Tirar da agenda a visita de ${l.unidade} em ${dataBR(l.data)}?`)) return;
    const r = await apagarAgendamento(l.id);
    if (!r.ok) return toast({ title: "Não consegui tirar da agenda", description: r.erro, variant: "destructive" });
    onMudou();
  };
  const linha = (l: LinhaAgenda) => (
    <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-3 last:border-b-0">
      <span className="w-28 shrink-0 text-sm tabular-nums text-foreground">{dataBR(l.data)}<span className="block text-xs text-muted-foreground">{diaDaSemana(l.data)}</span></span>
      <span className="min-w-0 flex-1 text-sm">
        <span className="font-medium text-foreground">{l.unidade}</span>
        <span className="block truncate text-xs text-muted-foreground">{l.modeloNome}{l.responsavel && ` · ${l.responsavel}`}{l.observacao && ` · ${l.observacao}`}</span>
      </span>
      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", CHIP[l.situacao])}>{SITUACAO_AGENDA_ROTULO[l.situacao]}</span>
      {podeEditar && l.situacao !== "feita" && <button type="button" onClick={() => void cancelar(l)} aria-label={`Tirar da agenda: ${l.unidade}, ${dataBR(l.data)}`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Trash2 className="h-4 w-4" aria-hidden /></button>}
    </li>
  );

  return (
    <div className="space-y-4">
      {podeEditar && (
        <ChartCard title="Agendar uma visita" subtitle="Escolha a unidade, o dia e o checklist. Quem vai e a observação são opcionais.">
          {sugestoes.length > 0 && (
            <div className="mb-4 rounded-xl bg-secondary/50 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">Sem visita há mais de {DIAS_SEM_VISITA} dias e sem nada agendado (toque para preencher a unidade):</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {sugestoes.map((s) => (
                  <button key={s.unidade} type="button" onClick={() => setUnidade(s.unidade)} className={cn("rounded-full border px-2.5 py-1 text-xs hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", unidade === s.unidade ? "border-foreground bg-white font-semibold" : "border-border")}>
                    {s.unidade} · {s.dias === null ? "nunca visitada" : `${s.dias} dias`}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-muted-foreground">Unidade
              <Select aria-label="Unidade a visitar" className="mt-1 h-9 w-52 max-w-full" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
                <option value="">Escolha…</option>
                {dados.unidades.map((u) => <option key={u} value={u}>{u}</option>)}
              </Select>
            </label>
            <label className="text-xs text-muted-foreground">Data
              <input type="date" aria-label="Data da visita" min={hoje} value={data} onChange={(e) => setData(e.target.value)} className="mt-1 block h-9 rounded-lg border border-input bg-white px-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
            <label className="text-xs text-muted-foreground">Checklist
              <Select aria-label="Checklist da visita" className="mt-1 h-9 w-56 max-w-full" value={modeloId} onChange={(e) => setModeloId(e.target.value)}>
                <option value="">Escolha…</option>
                {modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </Select>
            </label>
            <label className="text-xs text-muted-foreground">Quem vai (opcional)
              <input value={responsavel} maxLength={80} onChange={(e) => setResponsavel(e.target.value)} placeholder="Nome" aria-label="Quem vai fazer a visita" className="mt-1 block h-9 w-44 rounded-lg border border-input bg-white px-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
            <label className="min-w-[12rem] flex-1 text-xs text-muted-foreground">Observação (opcional)
              <input value={observacao} maxLength={300} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: levar o termo de vistoria" aria-label="Observação da visita" className="mt-1 block h-9 w-full rounded-lg border border-input bg-white px-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
            <Button disabled={ocupado || !pronto} onClick={() => void agendar()}><CalendarClock className="h-4 w-4" aria-hidden /> Agendar</Button>
          </div>
          {modelos.length === 0 && <p className="mt-3 text-xs text-muted-foreground">Crie um checklist de visita na aba Checklists para poder agendar.</p>}
        </ChartCard>
      )}

      <ChartCard title="Agenda de visitas" subtitle={abertas.length ? `${abertas.length} ${abertas.length === 1 ? "visita à frente" : "visitas à frente"}${atrasadas ? `, ${atrasadas} ${atrasadas === 1 ? "atrasada" : "atrasadas"}` : ""}` : "Nenhuma visita agendada"}>
        {abertas.length === 0 ? (
          <ChartEmpty>{podeEditar ? "Nenhuma visita agendada. Use o formulário acima para marcar a próxima." : "Nenhuma visita agendada por enquanto."}</ChartEmpty>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-border">{abertas.map(linha)}</ul>
        )}
      </ChartCard>

      {concluidas.length > 0 && (
        <ChartCard title="Visitas já feitas" subtitle="Agendadas que a unidade recebeu na data marcada ou depois.">
          <ul className="overflow-hidden rounded-xl border border-border">{concluidas.slice(0, feitas).map(linha)}</ul>
          {concluidas.length > feitas && <button type="button" onClick={() => setFeitas((q) => q + POR_VEZ)} className="mt-3 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">Ver mais ({concluidas.length - feitas})</button>}
        </ChartCard>
      )}
    </div>
  );
}
