import { useEffect, useRef } from "react";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/components/nav";
import wgLogo from "@/assets/wg-logo.png";

interface NavProps {
  active: string;
  onChange: (id: string) => void;
  /** Alertas críticos, exibido junto de "Riscos e Recomendações". */
  criticalCount: number;
}

function NavList({ active, onChange, criticalCount, collapsed = false }: NavProps & { collapsed?: boolean }) {
  return (
    <nav aria-label="Seções do dashboard" className="flex-1 overflow-y-auto px-3 py-2">
      <ul className="space-y-0.5">
        {NAV_ITEMS.map((item, i) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          const badge = item.id === "riscos" ? criticalCount : 0;
          return (
            <li key={item.id}>
              {i > 0 && NAV_ITEMS[i - 1].group !== item.group && <div className="my-2 mx-2 h-px bg-border" role="separator" />}
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
                <Icon className={cn("w-[18px] h-[18px] shrink-0", isActive && "text-primary")} aria-hidden />
                <span className={cn("flex-1 text-left", collapsed && "sr-only")}>{item.label}</span>
                {badge > 0 && (
                  <span
                    className={cn(
                      "rounded-full bg-primary text-primary-foreground text-[11px] leading-none font-semibold",
                      collapsed ? "absolute top-1 right-2 px-1.5 py-1" : "px-2 py-1"
                    )}
                    aria-label={`${badge} alertas críticos`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 px-4 h-16 shrink-0", collapsed && "justify-center px-0")}>
      <img src={wgLogo} alt="World Gym" className="h-9 w-auto shrink-0" />
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <p className="text-sm font-semibold text-foreground truncate">World Gym Brasil</p>
          <p className="text-xs text-muted-foreground truncate">Resultados da rede</p>
        </div>
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
          aria-expanded={!collapsed}
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {collapsed ? <PanelLeftOpen className="w-[18px] h-[18px]" aria-hidden /> : <PanelLeftClose className="w-[18px] h-[18px]" aria-hidden />}
          {!collapsed && <span>Recolher menu</span>}
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
