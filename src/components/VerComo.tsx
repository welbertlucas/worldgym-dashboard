import { useEffect, useRef, useState } from "react";
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

type Escolha = "dono" | "master" | "unidades";

/** Seletor "Ver como" do cabeçalho: só para o dono. Abre um painel com Dono, Master ou uma ou mais unidades. */
export function VerComo({ className }: { className?: string }) {
  const atual = simulando() ? getVerComo() : null;
  const [aberto, setAberto] = useState(false);
  const [escolha, setEscolha] = useState<Escolha>(atual?.papel ?? "dono");
  const [marcadas, setMarcadas] = useState<string[]>(atual?.papel === "unidades" ? atual.unidades : []);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);
  if (!podeVerComo()) return null;
  const unidades = unidadesReais();
  const rotulo = !atual ? "Dono" : atual.papel === "master" ? "Master" : atual.unidades.length === 1 ? atual.unidades[0] : `${atual.unidades.length} unidades`;
  const alterna = (u: string) => setMarcadas((m) => (m.includes(u) ? m.filter((x) => x !== u) : [...m, u]));
  const podeAplicar = escolha !== "unidades" || marcadas.length > 0;
  const aplicar = () => definirVerComo(escolha === "dono" ? null : escolha === "master" ? { papel: "master" } : { papel: "unidades", unidades: marcadas });
  const opcao = (id: Escolha, texto: string) => (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-secondary">
      <input type="radio" name="ver-como" checked={escolha === id} onChange={() => setEscolha(id)} className="accent-primary" />
      {texto}
    </label>
  );
  return (
    <div ref={caixa} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        title="Ver o painel como outro nível de acesso"
        className={cn("flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", atual ? "border-warning/60 bg-warning/10" : "border-border bg-card hover:border-foreground/25")}
      >
        <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="text-muted-foreground">Ver como</span>
        <span className="max-w-[8rem] truncate font-medium text-foreground">{rotulo}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </button>
      {aberto && (
        <div role="dialog" aria-label="Ver o painel como" className="absolute right-0 top-11 z-50 w-72 rounded-xl border border-border bg-white p-2 shadow-lg">
          {opcao("dono", "Dono (você)")}
          {opcao("master", "Master")}
          {opcao("unidades", "Acesso de unidades")}
          {escolha === "unidades" && (
            <div className="mt-1 border-t border-border pt-2">
              <div className="mb-1 flex items-center justify-between px-2 text-xs text-muted-foreground">
                <span>{marcadas.length ? `${marcadas.length} marcada${marcadas.length > 1 ? "s" : ""}` : "Marque uma ou mais"}</span>
                {marcadas.length > 0 && <button type="button" onClick={() => setMarcadas([])} className="underline hover:text-foreground">limpar</button>}
              </div>
              <ul className="max-h-64 overflow-y-auto">
                {unidades.map((u) => (
                  <li key={u}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-secondary">
                      <input type="checkbox" checked={marcadas.includes(u)} onChange={() => alterna(u)} className="accent-primary" />
                      {u}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-2 flex justify-end gap-2 border-t border-border pt-2">
            <button type="button" onClick={() => setAberto(false)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary">Cancelar</button>
            <button type="button" disabled={!podeAplicar} onClick={aplicar} className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:bg-foreground/90 disabled:opacity-40">Ver o painel</button>
          </div>
        </div>
      )}
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
