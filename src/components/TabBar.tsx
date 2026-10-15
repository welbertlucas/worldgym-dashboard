import { cn } from "@/lib/utils";

export interface TabDef { id: string; label: string; badge?: number }

interface TabBarProps { tabs: TabDef[]; active: string; onChange: (id: string) => void }

export function TabBar({ tabs, active, onChange }: TabBarProps) {
  return (
    <div className="-mx-3 px-3 sm:mx-0 sm:px-0 overflow-x-auto">
      <div role="tablist" className="inline-flex gap-1 rounded-full bg-secondary p-1 border border-border/70">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              "whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active === t.id ? "bg-white text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {!!t.badge && <span className="rounded-full bg-primary text-primary-foreground text-[11px] leading-none px-1.5 py-1 font-semibold">{t.badge}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-4 sm:mb-5">
      <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">{children}</h2>
      {hint && <p className="text-sm text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}
