import { ChevronDown, Eye } from "lucide-react";
import { definirVerComo, getVerComo, podeVerComo, simulando } from "@/lib/auth";
import { getAvailableUnits } from "@/data/dashboardData";
import { cn } from "@/lib/utils";

// Lista real das unidades, guardada enquanto o dono vê tudo: durante a simulação os nomes das outras unidades chegam
// trocados ("Unidade 07"), então o seletor usa esta lista para continuar oferecendo todas.
const UNIDADES_KEY = "atlas-unidades-reais";
function unidadesReais(): string[] {
  if (!simulando()) {
    const u = getAvailableUnits();
    try { if (u.length) sessionStorage.setItem(UNIDADES_KEY, JSON.stringify(u)); } catch { /* nada */ }
    return u;
  }
  try { return JSON.parse(sessionStorage.getItem(UNIDADES_KEY) ?? "[]") as string[]; } catch { return []; }
}

/** Valor do select: "" = dono, "master", "u:<unidade>". */
function valorAtual(): string {
  const v = getVerComo();
  if (!v || !simulando()) return "";
  return v.papel === "master" ? "master" : `u:${v.unidades[0] ?? ""}`;
}

/** Seletor "Ver como" do cabeçalho: só para o dono; troca o nível e recarrega o painel. */
export function VerComo({ className }: { className?: string }) {
  if (!podeVerComo()) return null;
  const valor = valorAtual();
  const rotulo = valor === "" ? "Dono" : valor === "master" ? "Master" : valor.slice(2);
  return (
    <div className={cn("relative flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs shadow-sm focus-within:ring-2 focus-within:ring-ring", valor ? "border-warning/60 bg-warning/10" : "border-border bg-card hover:border-foreground/25", className)} title="Ver o painel como outro nível de acesso">
      <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="text-muted-foreground">Ver como</span>
      <span className="max-w-[8rem] truncate font-medium text-foreground">{rotulo}</span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <label htmlFor="ver-como" className="sr-only">Ver o painel como</label>
      <select
        id="ver-como"
        value={valor}
        onChange={(e) => {
          const v = e.target.value;
          definirVerComo(v === "" ? null : v === "master" ? { papel: "master" } : { papel: "unidades", unidades: [v.slice(2)] });
        }}
        className="absolute inset-0 h-full w-full cursor-pointer rounded-full opacity-0"
      >
        <option value="">Dono (você)</option>
        <option value="master">Master</option>
        <optgroup label="Acesso de uma unidade">
          {unidadesReais().map((u) => <option key={u} value={`u:${u}`}>{u}</option>)}
        </optgroup>
      </select>
    </div>
  );
}

/** Faixa no topo enquanto o dono simula outro nível. */
export function AvisoVerComo() {
  if (!simulando()) return null;
  const v = getVerComo();
  const quem = v?.papel === "unidades" ? `o acesso de ${v.unidades.join(", ")}` : "Master";
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-warning/40 bg-warning/10 px-3 py-2 text-sm sm:px-6 lg:px-8">
      <span className="text-foreground">Você está vendo o Atlas como <b>{quem}</b>: menus e dados são exatamente os desse nível.</span>
      <button type="button" onClick={() => definirVerComo(null)} className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:bg-foreground/90">Voltar a ver como dono</button>
    </div>
  );
}
