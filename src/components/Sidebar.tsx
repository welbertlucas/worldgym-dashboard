import { useEffect, useRef, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { buscarNoMenu, itensDeBusca, itensDoMenu, MENUS_EM_BREVE, MENUS_NOVIDADE, NAV_RODAPE, type NavItem } from "@/components/nav";
import { ehDono, podeVerObras, podeGerarRelatorios, podeGerirAcessos, podeVerJuridico, podePreencherChecklist, podeVerQualidade, podeVerRoyalties } from "@/lib/auth";
import { useNovidadesNaoVistas } from "@/lib/novidadesVistas";
import wgLogo from "@/assets/wg-logo.png";

interface NavProps {
  active: string;
  onChange: (id: string) => void;
  /** Alertas críticos, exibido junto de "Alertas". */
  criticalCount?: number;
}

/**
 * Busca no topo do menu (como na Naya): encontra menus e abas pelo nome ou pelo que tem nos cards ("nota", "saldo",
 * "catraca", "churn"...). Setas escolhem, Enter abre, Esc limpa. O nome do menu aparece embaixo de cada aba.
 */
function BuscaMenu({ onChange }: { onChange: (destino: string) => void }) {
  const [consulta, setConsulta] = useState("");
  const [sel, setSel] = useState(0);
  const campo = useRef<HTMLInputElement>(null);
  const resultados = buscarNoMenu(itensDeBusca([...itensDoMenu(podeGerirAcessos(), true, podeGerarRelatorios(), podeVerRoyalties(), podeVerJuridico(), podeVerQualidade() || podePreencherChecklist(), emBreveLiberado()), ...NAV_RODAPE], ehDono()), consulta);
  const abrir = (destino: string) => { setConsulta(""); campo.current?.blur(); onChange(destino); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((i) => Math.min(i + 1, resultados.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSel((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && resultados[sel]) { e.preventDefault(); abrir(resultados[sel].destino); }
    if (e.key === "Escape") { setConsulta(""); campo.current?.blur(); }
  };
  return (
    <div className="px-3 pt-1 pb-2">
      <label className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-2.5 py-2 text-muted-foreground focus-within:border-foreground/30 focus-within:text-foreground">
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        <input
          ref={campo}
          value={consulta}
          onChange={(e) => { setConsulta(e.target.value); setSel(0); }}
          onKeyDown={onKeyDown}
          placeholder="Buscar"
          aria-label="Buscar nos menus"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>
      {consulta.trim() && (
        <ul className="mt-1 flex flex-col gap-0.5 text-sm" role="listbox" aria-label="Resultados da busca">
          {resultados.map((r, i) => (
            <li key={r.destino} role="option" aria-selected={i === sel}>
              <button
                type="button"
                onMouseEnter={() => setSel(i)}
                onClick={() => abrir(r.destino)}
                className={cn("flex w-full flex-col rounded-lg px-2.5 py-1.5 text-left", i === sel ? "bg-foreground/[0.07] text-foreground" : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground")}
              >
                <span>{r.rotulo}</span>
                {r.menu !== r.rotulo && <span className="text-[11px] text-muted-foreground">{r.menu}</span>}
              </button>
            </li>
          ))}
          {resultados.length === 0 && <li className="px-2.5 py-1.5 text-muted-foreground">Nada encontrado.</li>}
        </ul>
      )}
    </div>
  );
}

/** Estudos de ponto: todos veem (a unidade, só o estudo dela). Unidades em obra (ainda "Em breve"): o dono e quem ele liberou. */
const emBreveLiberado = () => (ehDono() ? true : { estudos: true, obras: podeVerObras() });

function ItemDoMenu({ item, active, onChange, collapsed, numero = 0, criticos = 0 }: { item: NavItem; active: string; onChange: (id: string) => void; collapsed: boolean; numero?: number; criticos?: number }) {
  const Icon = item.icon;
  const isActive = active === item.id;
  return (
    <li>
      <button
        type="button"
        onClick={() => onChange(item.id)}
        aria-current={isActive ? "page" : undefined}
        title={collapsed ? item.label : undefined}
        className={cn(
          "relative w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          collapsed && "justify-center px-0",
          isActive ? "bg-foreground/[0.07] text-foreground font-semibold" : "text-muted-foreground font-medium hover:bg-secondary/70 hover:text-foreground"
        )}
      >
        <Icon className="w-[18px] h-[18px] shrink-0 text-primary" aria-hidden />
        <span className={cn("flex-1 text-left", collapsed && "sr-only")}>{item.label}</span>
        {MENUS_EM_BREVE.has(item.id) && !collapsed && (
          <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-muted-foreground">Em breve</span>
        )}
        {MENUS_NOVIDADE.has(item.id) && !collapsed && (
          <span className="text-[10px] font-semibold leading-none text-primary-ink">Novidade</span>
        )}
        {criticos > 0 && (
          <span
            className={cn("rounded-full bg-primary text-center text-[11px] font-semibold leading-none text-primary-foreground", collapsed ? "absolute right-1.5 top-1 px-1.5 py-1" : "px-2 py-1")}
            aria-label={`${criticos} ${criticos === 1 ? "alerta crítico" : "alertas críticos"}`}
          >
            {criticos}
          </span>
        )}
        {numero > 0 && (
          <span
            className={cn("rounded-full bg-primary text-center text-[10px] font-semibold leading-none text-primary-foreground", collapsed ? "absolute right-1.5 top-1 h-2 w-2" : "min-w-[1.1rem] px-1.5 py-0.5")}
            aria-label={`${numero} ${numero === 1 ? "novidade" : "novidades"}`}
          >
            {!collapsed && (numero > 9 ? "9+" : numero)}
          </span>
        )}
      </button>
    </li>
  );
}

/** Telas de trabalho em cima; Novidades e Central de ajuda no rodapé do menu. */
function NavList({ active, onChange, criticalCount = 0, collapsed = false }: NavProps & { collapsed?: boolean }) {
  const itens = itensDoMenu(podeGerirAcessos(), false, podeGerarRelatorios(), podeVerRoyalties(), podeVerJuridico(), podeVerQualidade() || podePreencherChecklist(), emBreveLiberado());
  const novas = useNovidadesNaoVistas();
  return (
    <>
    {!collapsed && <BuscaMenu onChange={onChange} />}
    <nav aria-label="Seções do dashboard" className="flex flex-1 flex-col overflow-y-auto px-3 py-2">
      <ul className="space-y-0.5">
        {itens.map((item) => <ItemDoMenu key={item.id} item={item} active={active} onChange={onChange} collapsed={collapsed} criticos={item.id === "riscos" ? criticalCount : 0} />)}
      </ul>
      <ul className="mt-auto space-y-0.5 border-t border-border pt-2" aria-label="Novidades e ajuda">
        {NAV_RODAPE.map((item) => <ItemDoMenu key={item.id} item={item} active={active} onChange={onChange} collapsed={collapsed} numero={item.id === "novidades" ? novas : 0} />)}
      </ul>
    </nav>
    </>
  );
}

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 px-4 h-16 shrink-0", collapsed && "justify-center px-0")}>
      <img src={wgLogo} alt="World Gym" className="h-9 w-auto shrink-0" />
      {!collapsed && (
        <p className="min-w-0 text-sm font-semibold text-foreground truncate">World Gym Atlas</p>
      )}
    </div>
  );
}

interface SidebarProps extends NavProps { collapsed: boolean; onToggleCollapsed: () => void }

/** Sidebar fixa, visível a partir de lg. */
export function Sidebar({ collapsed, onToggleCollapsed, ...nav }: SidebarProps) {
  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col sticky top-0 h-screen shrink-0 border-r border-border bg-white transition-[width] duration-200 motion-reduce:transition-none",
        collapsed ? "w-[76px]" : "w-64"
      )}
    >
      <Brand collapsed={collapsed} />
      <NavList {...nav} collapsed={collapsed} />
      <div className={cn("border-t border-border p-3", collapsed && "flex justify-center")}>
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-expanded={!collapsed}
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {collapsed ? <PanelLeftOpen className="w-[18px] h-[18px]" aria-hidden /> : <PanelLeftClose className="w-[18px] h-[18px]" aria-hidden />}
        </button>
      </div>
    </aside>
  );
}

interface DrawerProps extends NavProps { open: boolean; onClose: () => void }

/** Drawer de navegação para telas menores que lg: Esc fecha, foco fica preso e volta ao botão de origem. */
export function MobileDrawer({ open, onClose, active, onChange, criticalCount }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>("button, [href]") ?? []);
    focusables()[1]?.focus(); // primeiro item de navegação (o 0 é o botão fechar)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      const f = focusables();
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] lg:hidden">
      <div className="absolute inset-0 bg-foreground/30" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
        className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white border-r border-border shadow-xl flex flex-col"
      >
        <div className="flex items-center justify-between pr-3">
          <Brand />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="rounded-xl p-2 text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>
        <NavList active={active} criticalCount={criticalCount} onChange={(id) => { onChange(id); onClose(); }} />
      </div>
    </div>
  );
}
