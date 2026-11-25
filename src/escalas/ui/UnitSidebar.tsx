import { Building2, CalendarDays, FileSpreadsheet, KeyRound, LayoutDashboard, LayoutTemplate, Users, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Unidade } from '../config/unidades';

/** Ícones do menu (mesma biblioteca do Atlas). */
const ICONES: Record<string, LucideIcon> = { escalas: CalendarDays, equipe: Users, modelos: LayoutTemplate, relatorio: FileSpreadsheet, painel: LayoutDashboard, acessos: KeyRound };

export interface NavItem {
  id: string;
  label: string;
  active: boolean;
  onClick: () => void;
  /** Precisa de unidade escolhida. */
  needsUnit?: boolean;
}

/** Seletor de unidade da barra do topo (como o "Unidade atual" do EVO). */
export function UnitPicker({ units, value, onChange }: { units: Unidade[]; value: string | null; onChange: (id: string) => void }) {
  return (
    <label className="unit-picker">
      <Building2 size={16} strokeWidth={2} aria-hidden className="unit-picker-icone" />
      <select className="unit-picker-select" value={value ?? ''} onChange={(e) => e.target.value && onChange(e.target.value)} aria-label="Unidade" disabled={units.length === 1}>
        {!value && <option value="" disabled>Escolha a unidade…</option>}
        {units.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
      </select>
    </label>
  );
}

/** Menu lateral: as áreas do sistema. */
export function UnitSidebar({ value, items, unidade }: { value: string | null; items: NavItem[]; unidade?: ReactNode }) {
  return (
    <aside className="sidebar" aria-label="Menu">
      {unidade && <div className="sidebar-unidade">{unidade}</div>}
      <nav className="sidebar-nav" aria-label="Áreas">
        {items.map((it) => (
          <button type="button" key={it.id} className={it.active ? 'on' : ''} aria-current={it.active ? 'page' : undefined}
            disabled={it.needsUnit && !value} onClick={it.onClick}>
            {(() => { const Icone = ICONES[it.id]; return Icone ? <Icone className="nav-icone" size={18} strokeWidth={2} aria-hidden /> : null; })()}
            <span>{it.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
