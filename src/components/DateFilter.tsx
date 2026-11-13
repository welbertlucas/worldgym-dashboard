import type { ReactNode } from "react";
import { Building2, CalendarDays, ChevronDown, ArrowLeftRight, X } from "lucide-react";
import { getAvailableMonths, getAvailableUnits } from "@/data/dashboardData";
import { cn } from "@/lib/utils";
import { unidadesProprias } from "@/lib/auth";

interface DateFilterProps {
  selectedMonth: string;
  compareMonth: string | null;
  onMonthChange: (month: string) => void;
  onCompareMonthChange: (month: string | null) => void;
  hideCompare?: boolean;
}

/** "2026-10" -> "Out/26" (botões curtos do topo). */
export function mesCurto(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const nome = new Date(y, (mo || 1) - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)}/${String(y).slice(2)}`;
}

export function formatMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const s = new Date(y, (mo || 1) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Um filtro em forma de "chip": ícone, rótulo pequeno e o valor escolhido em destaque. O select nativo fica por cima,
 * invisível, então o clique abre o seletor do próprio sistema (bom no celular) e leitores de tela leem o select de verdade.
 */
export function Chip({ id, rotulo, valor, icone, ativo, children, value, onChange, aoLimpar, rotuloLimpar, rotuloVisivel = true, className }: {
  id: string; rotulo: string; valor: string; icone: ReactNode; ativo?: boolean; children: ReactNode;
  value: string; onChange: (v: string) => void; aoLimpar?: () => void; rotuloLimpar?: string;
  /** Mostra o rótulo antes do valor ("Severidade Todas"); desligado quando o valor já se explica (unidade, mês). */
  rotuloVisivel?: boolean; className?: string;
}) {
  // Pílula no mesmo formato dos botões do topo (unidade, mês e comparação): ícone, valor, seta; ativo no vermelho claro.
  return (
    <div
      className={cn(
        "relative inline-flex h-9 min-w-0 max-w-full items-center gap-2 rounded-full border px-3 text-sm shadow-sm transition-colors focus-within:ring-2 focus-within:ring-ring",
        ativo ? "border-primary/40 bg-primary/5" : "border-border bg-card hover:border-foreground/25",
        className,
      )}
      title={rotulo}
    >
      <span className={cn("shrink-0", ativo ? "text-primary-ink" : "text-muted-foreground")} aria-hidden>{icone}</span>
      {rotuloVisivel && <span className="shrink-0 text-muted-foreground">{rotulo}</span>}
      <span className="min-w-0 truncate font-medium text-foreground">{valor}</span>
      {aoLimpar
        ? <button type="button" onClick={aoLimpar} title={rotuloLimpar} aria-label={rotuloLimpar} className="relative z-10 -mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="h-3.5 w-3.5" aria-hidden /></button>
        : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
      <label htmlFor={id} className="sr-only">{rotulo}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer rounded-full opacity-0">
        {children}
      </select>
    </div>
  );
}

/** Chip de mês: "Out/26" no botão e os nomes inteiros na lista (meses em ordem crescente). */
export function ChipMes({ id, rotulo, value, months, onChange }: { id: string; rotulo: string; value: string; months: string[]; onChange: (m: string) => void }) {
  return (
    <Chip id={id} rotulo={rotulo} valor={mesCurto(value)} icone={<CalendarDays className="h-4 w-4" />} ativo value={value} onChange={onChange} rotuloVisivel={false}>
      {[...months].reverse().map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
    </Chip>
  );
}

/**
 * Chip de unidade: "Toda a rede" + as unidades; `extras` entra logo depois da rede (ex.: Institucional).
 * Perfil de unidades: não existe "rede". Com uma unidade só, o chip mostra só ela; com várias, "Todas as suas unidades".
 */
export function ChipUnidade({ id, value, units, onChange, extras, rotuloRede = "Toda a rede" }: { id: string; value: string | null; units: string[]; onChange: (u: string | null) => void; extras?: ReactNode; rotuloRede?: string }) {
  const proprias = unidadesProprias();
  if (proprias?.length === 1) {
    const u = proprias[0];
    return (
      <Chip id={id} rotulo="Unidade" valor={u} icone={<Building2 className="h-4 w-4" />} ativo value={u} onChange={() => {}} rotuloVisivel={false}>
        <option value={u}>{u}</option>
      </Chip>
    );
  }
  if (proprias) { rotuloRede = "Todas as suas unidades"; extras = null; }
  return (
    <Chip
      rotuloVisivel={false}
      id={id}
      rotulo="Unidade"
      valor={value ?? rotuloRede}
      icone={<Building2 className="h-4 w-4" />}
      ativo={!!value}
      value={value ?? ""}
      onChange={(v) => onChange(v || null)}
      aoLimpar={value ? () => onChange(null) : undefined}
      rotuloLimpar="Limpar filtro de unidade"
    >
      <option value="">{rotuloRede}</option>
      {extras}
      {units.map((u) => <option key={u} value={u}>{u}</option>)}
    </Chip>
  );
}

/**
 * Botão de unidade do cabeçalho (canto superior direito): mostra a unidade escolhida ou a rede e, ao clicar, abre a
 * lista do próprio sistema (select nativo invisível por cima). Vale para todas as telas que filtram por unidade.
 * Quem tem uma unidade só vê o nome dela, sem lista.
 */
export function BotaoUnidade({ id, value, onChange, className }: { id: string; value: string | null; onChange: (u: string | null) => void; className?: string }) {
  const proprias = unidadesProprias();
  const caixa = "relative flex h-9 min-w-0 max-w-[11rem] sm:max-w-[16rem] items-center gap-2 rounded-full border px-3 text-sm shadow-sm";
  if (proprias?.length === 1) {
    return (
      <span className={cn(caixa, "border-border bg-card", className)} title={proprias[0]}>
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate font-medium text-foreground">{proprias[0]}</span>
      </span>
    );
  }
  const rotuloRede = proprias ? "Todas as suas unidades" : "Toda a rede";
  const units = getAvailableUnits().filter((u) => !proprias || proprias.includes(u));
  return (
    <div
      className={cn(caixa, "transition-colors focus-within:ring-2 focus-within:ring-ring", value ? "border-primary/40 bg-primary/5" : "border-border bg-card hover:border-foreground/25", className)}
      title="Escolher a unidade ou a rede"
    >
      <Building2 className={cn("h-4 w-4 shrink-0", value ? "text-primary-ink" : "text-muted-foreground")} aria-hidden />
      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{value ?? rotuloRede}</span>
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <label htmlFor={id} className="sr-only">Unidade</label>
      <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className="absolute inset-0 h-full w-full cursor-pointer rounded-full opacity-0">
        <option value="">{rotuloRede}</option>
        {units.map((u) => <option key={u} value={u}>{u}</option>)}
      </select>
    </div>
  );
}

/** Botões lado a lado (ex.: "Por unidade | Lista completa") na mesma altura e formato de pílula dos chips. */
export function Segmentos<T extends string | number>({ rotulo, opcoes, valor, onChange }: { rotulo: string; opcoes: readonly (readonly [T, string])[]; valor: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={rotulo} className="inline-flex h-9 shrink-0 items-center gap-0.5 rounded-full border border-border bg-card p-0.5 shadow-sm">
      {opcoes.map(([v, label]) => (
        <button
          key={String(v)}
          type="button"
          aria-pressed={valor === v}
          onClick={() => onChange(v)}
          className={cn("h-full rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", valor === v ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * Botão em pílula, no mesmo formato do botão de unidade do cabeçalho: ícone, valor e seta. Ativo fica no tom vermelho
 * claro. O select nativo fica invisível por cima, então o clique abre a lista do próprio sistema.
 */
function BotaoPilula({ id, rotulo, valor, ativo, icone, value, onChange, aoLimpar, rotuloLimpar, children }: {
  id: string; rotulo: string; valor: string; ativo: boolean; icone: ReactNode; value: string; onChange: (v: string) => void;
  aoLimpar?: () => void; rotuloLimpar?: string; children: ReactNode;
}) {
  return (
    <div
      className={cn("relative flex h-9 min-w-0 items-center gap-2 rounded-full border px-3 text-sm shadow-sm transition-colors focus-within:ring-2 focus-within:ring-ring", ativo ? "border-primary/40 bg-primary/5" : "border-border bg-card hover:border-foreground/25")}
      title={rotulo}
    >
      <span className={cn("shrink-0", ativo ? "text-primary-ink" : "text-muted-foreground")} aria-hidden>{icone}</span>
      <span className={cn("min-w-0 flex-1 truncate font-medium", ativo ? "text-foreground" : "text-muted-foreground")}>{valor}</span>
      {aoLimpar
        ? <button type="button" onClick={aoLimpar} title={rotuloLimpar} aria-label={rotuloLimpar} className="relative z-10 -mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="h-3.5 w-3.5" aria-hidden /></button>
        : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
      <label htmlFor={id} className="sr-only">{rotulo}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer rounded-full opacity-0">
        {children}
      </select>
    </div>
  );
}

/** Mês e comparação no topo do conteúdo; a unidade fica no botão do cabeçalho (BotaoUnidade). */
export function DateFilter({ selectedMonth, compareMonth, onMonthChange, onCompareMonthChange, hideCompare }: DateFilterProps) {
  const months = getAvailableMonths();
  return (
    <div role="group" aria-label="Filtros do dashboard" className="flex flex-wrap items-center gap-2">
      <BotaoPilula id="filtro-mes" rotulo="Mês de referência" valor={mesCurto(selectedMonth)} ativo icone={<CalendarDays className="h-4 w-4" />} value={selectedMonth} onChange={onMonthChange}>
        {[...months].reverse().map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
      </BotaoPilula>

      {!hideCompare && (
        <BotaoPilula
          id="filtro-comparar"
          rotulo="Comparar com"
          valor={compareMonth ? `x ${mesCurto(compareMonth)}` : "Comparar"}
          ativo={!!compareMonth}
          icone={<ArrowLeftRight className="h-4 w-4" />}
          value={compareMonth ?? ""}
          onChange={(v) => onCompareMonthChange(v || null)}
          aoLimpar={compareMonth ? () => onCompareMonthChange(null) : undefined}
          rotuloLimpar="Remover comparação"
        >
          <option value="">Sem comparação</option>
          {[...months].reverse().filter((m) => m !== selectedMonth).map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
        </BotaoPilula>
      )}
    </div>
  );
}
