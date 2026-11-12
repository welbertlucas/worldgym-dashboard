import { KeyRound, LayoutDashboard, TrendingUp, Wallet, Users, UserCheck, Building2, BarChart3, DoorOpen, ListChecks, Megaphone, Target, ShieldAlert, type LucideIcon } from "lucide-react";

import type { Aba } from "@/components/Abas";

export interface NavItem { id: string; label: string; icon: LucideIcon; group: number }

/** Título de cada grupo do menu (o número é o `group` dos itens). */
export const GRUPOS_DO_MENU = ["Painel", "Áreas", "Unidades", "Administração"];

// Fonte única da navegação: a sidebar (desktop) e o drawer (celular) leem esta lista.
// Os ids ficam como eram (o endereço #id não muda); só os nomes e a ordem mudaram.
export const NAV_ITEMS: NavItem[] = [
  { id: "executiva", label: "Overview", icon: LayoutDashboard, group: 0 },
  { id: "plano", label: "Plano de ação", icon: ListChecks, group: 0 },
  { id: "metas", label: "Metas", icon: Target, group: 0 },
  { id: "riscos", label: "Alertas", icon: ShieldAlert, group: 0 },
  { id: "comercial", label: "Comercial", icon: TrendingUp, group: 1 },
  { id: "financeiro", label: "Financeiro", icon: Wallet, group: 1 },
  { id: "alunos", label: "Alunos", icon: Users, group: 1 },
  { id: "catraca", label: "Acessos na catraca", icon: DoorOpen, group: 1 },
  { id: "retencao", label: "Retenção", icon: UserCheck, group: 1 },
  { id: "campanhas", label: "Marketing", icon: Megaphone, group: 1 },
  { id: "unidades", label: "Raio-X da unidade", icon: Building2, group: 2 },
  { id: "benchmark", label: "Ranking da rede", icon: BarChart3, group: 2 },
];

/** Itens do menu para quem está logado: a tela de usuários só aparece para o dono. */
export const itensDoMenu = (gerirAcessos: boolean): NavItem[] =>
  gerirAcessos ? [...NAV_ITEMS, { id: "acessos", label: "Usuários", icon: KeyRound, group: 3 }] : NAV_ITEMS;

/** Submenus de cada menu (abas no topo do conteúdo; endereço #menu/aba). */
export const SUBMENUS: Record<string, Aba[]> = {
  comercial: [{ id: "resumo", rotulo: "Resumo" }, { id: "vendas", rotulo: "Vendas" }, { id: "complementares", rotulo: "Receitas complementares" }],
  financeiro: [{ id: "resumo", rotulo: "Resumo" }, { id: "recebimento", rotulo: "Recebimento" }, { id: "cobranca", rotulo: "Cobrança" }, { id: "notas", rotulo: "Notas fiscais" }],
  alunos: [{ id: "base", rotulo: "Tamanho da base" }, { id: "perfil", rotulo: "Perfil" }, { id: "onde-moram", rotulo: "Onde moram" }],
  catraca: [{ id: "frequencia", rotulo: "Frequência" }, { id: "liberacoes", rotulo: "Liberações" }, { id: "outras-unidades", rotulo: "Outras unidades" }],
  retencao: [{ id: "cancelamentos", rotulo: "Cancelamentos" }, { id: "renovacao", rotulo: "Renovação" }, { id: "satisfacao", rotulo: "Satisfação" }],
  campanhas: [{ id: "campanhas", rotulo: "Campanhas" }, { id: "anuncios", rotulo: "Anúncios" }, { id: "leads", rotulo: "Leads" }],
  benchmark: [{ id: "posicao", rotulo: "Posição e destaques" }, { id: "contratos", rotulo: "Contratos ativos" }, { id: "tabela", rotulo: "Tabela completa" }],
};

/** Endereços de antes da reorganização do menu (links salvos): para onde cada um foi. */
const ENDERECOS_ANTIGOS: Record<string, string> = {
  mapa: "alunos/onde-moram",
  "alunos/frequencia": "catraca/frequencia",
  "comercial/oportunidades": "campanhas/leads",
};
export const enderecoAtual = (endereco: string) => ENDERECOS_ANTIGOS[endereco] ?? endereco;

/** Palavras que levam a cada menu ou aba na busca do menu (o que tem nos cards dela). */
const PALAVRAS: Record<string, string> = {
  executiva: "visao executiva resumo geral rede painel principal inicio",
  "comercial/resumo": "novos contratos cancelamentos vendas online conversao saldo de clientes",
  "comercial/vendas": "vendas por dia projecao fechamento calendario contratos mais vendidos planos",
  "comercial/complementares": "diarias personal brinquedoteca kids wg plus pro+ camisetas coqueteleiras produtos",
  plano: "plano de acao o que fazer bussola gestor tarefas copiar whatsapp equipe socios prioridades",
  metas: "meta bronze prata ouro atingimento",
  "financeiro/resumo": "faturamento recebimento receita inadimplencia adimplentes ticket medio",
  "financeiro/recebimento": "formas de pagamento pix cartao credito debito bandeiras gateways adquirente multas taxas ajustes",
  "financeiro/cobranca": "cobrancas recusadas cartao recusado saldo devedor divida devendo",
  "financeiro/notas": "notas fiscais nf nfs-e nfse iss emissao",
  "alunos/base": "alunos ativos base fluxo novos retornos saidas permanencia ltv suspensos",
  "alunos/perfil": "genero idade perfil",
  "alunos/onde-moram": "mapa dos alunos bairros onde moram endereco localizacao",
  catraca: "controle de acesso entradas check-in",
  "catraca/frequencia": "frequencia entradas horarios mapa de calor dias ultimo acesso sumidos",
  "catraca/liberacoes": "liberacoes manuais entrada manual recepcao visitante sem pagamento fraude",
  "catraca/outras-unidades": "outra unidade treinam em outra fluxo entre unidades",
  "retencao/cancelamentos": "churn cancelamentos motivos quem cancela",
  "retencao/renovacao": "renovacao a vencer nao renovados",
  "retencao/satisfacao": "nps google reclame aqui satisfacao notas avaliacao",
  unidades: "raio x raio-x retrato unidade posicao resultado evolucao pdf imprimir",
  "benchmark/posicao": "benchmark ranking posicao destaques comparar unidades melhorou piorou",
  "benchmark/contratos": "contratos ativos especiais vip personal local rede",
  "benchmark/tabela": "tabela completa todas as unidades indicadores",
  campanhas: "trafego pago meta facebook instagram",
  "campanhas/campanhas": "investimento alertas evolucao cac pixel compras",
  "campanhas/anuncios": "anuncios contato mais barato horarios dos contatos campanhas no ar veiculando",
  "campanhas/leads": "oportunidades leads origem perfil prospects cadastros",
  riscos: "alertas riscos recomendacoes atencao critico",
  acessos: "usuarios senha permissoes login niveis quem entra no painel",
};

export interface ItemDeBusca { destino: string; rotulo: string; menu: string; palavras: string }

/** Tudo o que a busca do menu encontra: cada menu e cada aba, com o nome do menu de cima. */
export function itensDeBusca(itens: NavItem[]): ItemDeBusca[] {
  return itens.flatMap((m) => [
    { destino: m.id, rotulo: m.label, menu: m.label, palavras: PALAVRAS[m.id] ?? "" },
    ...(SUBMENUS[m.id] ?? []).map((a) => ({ destino: `${m.id}/${a.id}`, rotulo: a.rotulo, menu: m.label, palavras: PALAVRAS[`${m.id}/${a.id}`] ?? "" })),
  ]);
}

/** Sem acento e em minúsculas, para a busca. */
export const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Resultados da busca: todas as palavras digitadas precisam aparecer; o que bate no nome vem primeiro. Até 8. */
export function buscarNoMenu(itens: ItemDeBusca[], consulta: string): ItemDeBusca[] {
  const termos = normalizar(consulta).split(/\s+/).filter(Boolean);
  if (!termos.length) return [];
  return itens
    .map((i) => {
      const nome = normalizar(`${i.menu} ${i.rotulo}`);
      const tudo = `${nome} ${normalizar(i.palavras)}`;
      return { i, ok: termos.every((t) => tudo.includes(t)), pontos: termos.filter((t) => nome.includes(t)).length + (i.destino.includes("/") ? 0 : 0.5) };
    })
    .filter((r) => r.ok)
    .sort((a, b) => b.pontos - a.pontos)
    .map((r) => r.i)
    .slice(0, 8);
}
