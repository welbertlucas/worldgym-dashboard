import { LayoutDashboard, TrendingUp, Wallet, UserCheck, Building2, MapPin, Map as MapIcon, Megaphone, Target, ShieldAlert, type LucideIcon } from "lucide-react";

export interface NavItem { id: string; label: string; icon: LucideIcon; group: number }

// Fonte única da navegação: a sidebar (desktop) e o drawer (celular) leem esta lista.
export const NAV_ITEMS: NavItem[] = [
  { id: "executiva", label: "Visão Executiva", icon: LayoutDashboard, group: 0 },
  { id: "comercial", label: "Comercial", icon: TrendingUp, group: 1 },
  { id: "metas", label: "Metas", icon: Target, group: 1 },
  { id: "financeiro", label: "Financeiro", icon: Wallet, group: 1 },
  { id: "retencao", label: "Retenção", icon: UserCheck, group: 1 },
  { id: "unidades", label: "Unidades", icon: Building2, group: 1 },
  { id: "unidade", label: "Detalhe da unidade", icon: MapPin, group: 1 },
  { id: "mapa", label: "Mapa dos alunos", icon: MapIcon, group: 1 },
  { id: "campanhas", label: "Tráfego pago", icon: Megaphone, group: 1 },
  { id: "riscos", label: "Riscos e Recomendações", icon: ShieldAlert, group: 2 },
];
