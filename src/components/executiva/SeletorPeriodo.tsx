import { CalendarRange } from "lucide-react";
import { Chip, formatMonth, mesCurto } from "@/components/DateFilter";

export interface Periodo { de: string; ate: string }

/**
 * Overview por período: "Ver por período" liga a soma de vários meses; depois dele, o mês inicial e o final. Mexer num lado nunca
 * deixa o início depois do fim (o outro lado acompanha). O botão de limpar volta ao mês escolhido no topo.
 */
export function SeletorPeriodo({ meses, periodo, aoMudar, ate }: {
  /** Meses disponíveis, do mais antigo ao mais novo. */
  meses: string[];
  periodo: Periodo | null;
  aoMudar: (p: Periodo | null) => void;
  /** Mês em que o período começa a valer ao ligar (o mês escolhido no topo). */
  ate: string;
}) {
  if (!periodo) {
    const i = meses.indexOf(ate);
    const de = meses[Math.max(0, i - 2)] ?? ate;
    return (
      <button
        type="button"
        onClick={() => aoMudar({ de, ate })}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3 text-sm shadow-sm transition-colors hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CalendarRange className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="font-medium text-foreground">Ver por período</span>
      </button>
    );
  }
  const opcoes = [...meses].reverse().map((m) => <option key={m} value={m}>{formatMonth(m)}</option>);
  return (
    <div role="group" aria-label="Período do Overview" className="flex flex-wrap items-center gap-2">
      <Chip id="periodo-de" rotulo="De" valor={mesCurto(periodo.de)} ativo icone={<CalendarRange className="h-4 w-4" />} value={periodo.de}
        onChange={(v) => aoMudar({ de: v, ate: v > periodo.ate ? v : periodo.ate })}>{opcoes}</Chip>
      <Chip id="periodo-ate" rotulo="Até" valor={mesCurto(periodo.ate)} ativo icone={<CalendarRange className="h-4 w-4" />} value={periodo.ate}
        onChange={(v) => aoMudar({ de: v < periodo.de ? v : periodo.de, ate: v })}
        aoLimpar={() => aoMudar(null)} rotuloLimpar="Voltar ao mês escolhido">{opcoes}</Chip>
    </div>
  );
}
