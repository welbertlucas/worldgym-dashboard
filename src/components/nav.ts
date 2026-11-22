import { KeyRound, LifeBuoy, LayoutDashboard, Sparkles, TrendingUp, Wallet, Users, UserCheck, BarChart3, DoorOpen, ListChecks, Megaphone, Target, ShieldAlert, Presentation, Landmark, Scale, ClipboardCheck, MapPinned, HardHat, type LucideIcon } from "lucide-react";

import type { Aba } from "@/components/Abas";

/** `oculto`: a tela existe (endereço, busca) mas não aparece na barra lateral; é aberta por outro lugar (o ícone de alertas no cabeçalho). */
export interface NavItem { id: string; label: string; icon: LucideIcon; oculto?: boolean }

// Fonte única da navegação: a sidebar (desktop) e o drawer (celular) leem esta lista, numa sequência só (sem títulos de grupo).
// Os ids ficam como eram (o endereço #id não muda); só os nomes e a ordem mudaram.
export const NAV_ITEMS: NavItem[] = [
  { id: "executiva", label: "Overview", icon: LayoutDashboard },
  { id: "plano", label: "Plano de ação", icon: ListChecks },
  { id: "metas", label: "Metas", icon: Target },
  { id: "riscos", label: "Alertas", icon: ShieldAlert, oculto: true },
  { id: "comercial", label: "Comercial", icon: TrendingUp },
  { id: "financeiro", label: "Financeiro", icon: Wallet },
  { id: "alunos", label: "Alunos", icon: Users },
  { id: "catraca", label: "Acessos na catraca", icon: DoorOpen },
  { id: "retencao", label: "Retenção", icon: UserCheck },
  { id: "campanhas", label: "Marketing", icon: Megaphone },
  { id: "benchmark", label: "Ranking da rede", icon: BarChart3 },
];

/** Rodapé do menu, fora da sequência das telas de trabalho: Novidades (com o número das não vistas) e a Central de ajuda. */
export const NAV_RODAPE: NavItem[] = [
  { id: "novidades", label: "Novidades", icon: Sparkles },
  { id: "ajuda", label: "Central de ajuda", icon: LifeBuoy },
];
const USUARIOS: NavItem = { id: "acessos", label: "Usuários", icon: KeyRound };
/** Só aparece para dono, Master e quem o dono liberou. */
const ROYALTIES: NavItem = { id: "royalties", label: "Royalties", icon: Landmark };
/** Só aparece para o dono e quem ele liberou. */
const JURIDICO: NavItem = { id: "juridico", label: "Jurídico", icon: Scale };
/** Só aparece para o dono e quem ele liberou. */
const QUALIDADE: NavItem = { id: "qualidade", label: "Qualidade", icon: ClipboardCheck };
/** Só aparece para quem o dono liberou (e para o dono). */
const RELATORIOS: NavItem = { id: "relatorios", label: "Relatórios", icon: Presentation };
/** Só aparecem para o dono, com o aviso "Em breve": ainda estão sendo planejados. */
const ESTUDOS_DE_PONTO: NavItem = { id: "estudos-de-ponto", label: "Estudos de ponto", icon: MapPinned };
const UNIDADES_EM_OBRA: NavItem = { id: "unidades-em-obra", label: "Unidades em obra", icon: HardHat };
/** Menus e abas reservados ao dono (ainda "Em breve"): ninguém mais os vê nem os acha na busca. */
export const MENUS_SO_DONO = new Set(["estudos-de-ponto", "unidades-em-obra"]);
/** Dos menus reservados, os que ainda não têm tela (selo "Em breve" na barra lateral). */
export const MENUS_EM_BREVE = new Set(["unidades-em-obra"]);
export const ABAS_SO_DONO = new Set(["financeiro/despesas"]);
/** Todos os menus que têm endereço (#id). */
export const TODOS_OS_MENUS: NavItem[] = [...NAV_ITEMS, ROYALTIES, JURIDICO, QUALIDADE, RELATORIOS, ESTUDOS_DE_PONTO, UNIDADES_EM_OBRA, ...NAV_RODAPE, USUARIOS];

/** Itens do menu para quem está logado: a tela de usuários só aparece para o dono. `comOcultos` serve à busca, que ainda acha as telas fora da barra lateral. */
export const itensDoMenu = (gerirAcessos: boolean, comOcultos = false, relatorios = false, royalties = false, juridico = false, qualidade = false, emBreve: boolean | { estudos?: boolean; obras?: boolean } = false): NavItem[] => {
  const e = emBreve === true ? { estudos: true, obras: true } : emBreve || {};
  const base = comOcultos ? NAV_ITEMS : NAV_ITEMS.filter((i) => !i.oculto);
  return [...base, ...(royalties ? [ROYALTIES] : []), ...(juridico ? [JURIDICO] : []), ...(qualidade ? [QUALIDADE] : []), ...(relatorios ? [RELATORIOS] : []), ...(e.estudos ? [ESTUDOS_DE_PONTO] : []), ...(e.obras ? [UNIDADES_EM_OBRA] : []), ...(gerirAcessos ? [USUARIOS] : [])];
};

/** "comercial/vendas" → "Comercial › Vendas" (nome do menu e da aba; endereço desconhecido aparece como está). */
export function nomeDaTela(tela: string): string {
  const [menu, aba] = tela.split("/");
  const item = TODOS_OS_MENUS.find((i) => i.id === menu);
  const sub = aba ? SUBMENUS[menu]?.find((a) => a.id === aba) : null;
  return item ? (sub ? `${item.label} › ${sub.rotulo}` : item.label) : tela;
}

/** Onde a tela fica, para quem procura: os Alertas não estão no menu, e sim no botão do cabeçalho. */
export function ondeFica(tela: string): string {
  const nome = nomeDaTela(tela);
  if (tela.split("/")[0] === "riscos") return `Botão ${nome.replace(/^Alertas/, "Alertas, no cabeçalho")}`;
  if (NAV_RODAPE.some((i) => i.id === tela.split("/")[0])) return `${nome}, no rodapé do menu`;
  return `Menu › ${nome}`;
}

/** Submenus de cada menu (abas no topo do conteúdo; endereço #menu/aba). */
export const SUBMENUS: Record<string, Aba[]> = {
  comercial: [{ id: "resumo", rotulo: "Resumo" }, { id: "vendas", rotulo: "Vendas" }, { id: "oportunidades", rotulo: "Oportunidades" }, { id: "complementares", rotulo: "Receitas complementares" }],
  financeiro: [{ id: "resumo", rotulo: "Resumo" }, { id: "recebimento", rotulo: "Pagamentos dos clientes" }, { id: "despesas", rotulo: "Despesas" }, { id: "cobranca", rotulo: "Inadimplência" }, { id: "notas", rotulo: "Notas fiscais" }],
  alunos: [{ id: "base", rotulo: "Tamanho da base" }, { id: "perfil", rotulo: "Perfil" }, { id: "onde-moram", rotulo: "Onde moram" }, { id: "contratos", rotulo: "Contratos" }],
  catraca: [{ id: "frequencia", rotulo: "Frequência" }, { id: "liberacoes", rotulo: "Liberações" }, { id: "outras-unidades", rotulo: "Outras unidades" }],
  retencao: [{ id: "cancelamentos", rotulo: "Cancelamentos" }, { id: "renovacao", rotulo: "Renovação" }, { id: "satisfacao", rotulo: "Satisfação" }],
  campanhas: [{ id: "campanhas", rotulo: "Campanhas" }, { id: "anuncios", rotulo: "Anúncios" }, { id: "instagram", rotulo: "Instagram" }, { id: "influenciadores", rotulo: "Influenciadores" }],
  riscos: [{ id: "mes", rotulo: "Mês em andamento" }, { id: "fechamento", rotulo: "Fechamento do mês anterior" }],
  benchmark: [{ id: "posicao", rotulo: "Posição e destaques" }, { id: "evolucao", rotulo: "Evolução da unidade" }, { id: "comparar", rotulo: "Comparar unidades" }, { id: "tabela", rotulo: "Tabela completa" }],
};

/** Endereços de antes da reorganização do menu (links salvos): para onde cada um foi. */
const ENDERECOS_ANTIGOS: Record<string, string> = {
  mapa: "alunos/onde-moram",
  "alunos/frequencia": "catraca/frequencia",
  "campanhas/leads": "comercial/oportunidades",
  unidades: "benchmark/posicao",
  "benchmark/contratos": "alunos/contratos",
};
export const enderecoAtual = (endereco: string) => ENDERECOS_ANTIGOS[endereco] ?? endereco;

/** Palavras que levam a cada menu ou aba na busca do menu (o que tem nos cards dela). */
const PALAVRAS: Record<string, string> = {
  executiva: "visao executiva resumo geral rede painel principal inicio",
  "comercial/resumo": "novos contratos cancelamentos vendas online conversao saldo de clientes",
  "comercial/vendas": "vendas por dia projecao fechamento calendario contratos mais vendidos planos vendedores ranking quem vendeu",
  "comercial/complementares": "diarias personal brinquedoteca kids wg plus pro+ camisetas coqueteleiras produtos",
  plano: "plano de acao o que fazer bussola gestor tarefas copiar whatsapp equipe socios prioridades",
  metas: "meta bronze prata ouro atingimento",
  "financeiro/resumo": "faturamento recebimento receita inadimplencia adimplentes ticket medio",
  "financeiro/recebimento": "formas de pagamento pix cartao credito debito bandeiras gateways adquirente multas taxas ajustes",
  "financeiro/cobranca": "cobrancas recusadas cartao recusado saldo devedor divida devendo inadimplencia por genero idade perfil quem deve",
  "financeiro/notas": "notas fiscais nf nfs-e nfse iss emissao",
  "alunos/base": "alunos ativos base fluxo novos retornos saidas permanencia ltv suspensos",
  "alunos/perfil": "genero idade perfil",
  "alunos/onde-moram": "mapa dos alunos bairros onde moram endereco localizacao",
  "alunos/contratos": "contratos ativos especiais vip personal local rede plano tipo de contrato",
  catraca: "controle de acesso entradas check-in",
  "catraca/frequencia": "frequencia entradas horarios mapa de calor dias ultimo acesso sumidos",
  "catraca/liberacoes": "liberacoes manuais entrada manual recepcao visitante sem pagamento fraude",
  "catraca/outras-unidades": "outra unidade treinam em outra fluxo entre unidades",
  "retencao/cancelamentos": "churn cancelamentos motivos quem cancela",
  "retencao/renovacao": "renovacao a vencer nao renovados",
  "retencao/satisfacao": "nps google reclame aqui satisfacao notas avaliacao",
  "benchmark/posicao": "benchmark ranking posicao destaques comparar unidades melhorou piorou pdf imprimir exportar",
  "benchmark/evolucao": "evolucao da unidade faturamento recebimento inadimplencia churn renovacao novos contratos linha mes a mes raio x",
  "benchmark/comparar": "comparar duas unidades lado a lado indicador a indicador",
  "benchmark/tabela": "tabela completa todas as unidades indicadores",
  campanhas: "trafego pago meta facebook instagram",
  "campanhas/campanhas": "investimento alertas evolucao cac pixel compras",
  "campanhas/anuncios": "anuncios contato mais barato horarios dos contatos campanhas no ar veiculando",
  "comercial/oportunidades": "oportunidades leads origem perfil prospects cadastros consultor tempo converter conversao unidade",
  "campanhas/instagram": "instagram feed stories posts seguidores redes sociais perfil postagem",
  "campanhas/influenciadores": "influenciadores influencer parceiros contrato stories feed reels instagram arroba combinado entregas",
  riscos: "alertas riscos recomendacoes atencao critico",
  "riscos/mes": "alertas do mes atual em andamento pendencias ritmo cobrar cartao detratores renovacao projecao",
  "riscos/fechamento": "fechamento mes anterior fechado o que aconteceu hipoteses comparativo anual",
  ajuda: "ajuda central duvidas como usar perguntas frequentes glossario o que significa senha tutorial manual",
  novidades: "novidades o que mudou novo melhoria atualizacoes lancamentos",
  royalties: "royalties taxa fixa recebimentos marca franquia devedores inadimplencia saldo devedor matriz situacao",
  juridico: "juridico processos acoes judiciais extrajudiciais procon tribunal advogado valor da causa contencioso risco",
  qualidade: "qualidade checklist visita vistoria limpeza uniforme organizacao padrao unidade auditoria nota fotos roteiro",
  "estudos-de-ponto": "estudos de ponto geomarketing geolocalizacao onde abrir nova unidade mapfry concorrentes regiao praca",
  "unidades-em-obra": "unidades em obra construcao obras inauguracao nova unidade cronograma",
  "financeiro/despesas": "despesas contas a pagar contas pagas custos gastos fornecedores financeiro f360",
  relatorios: "relatorio apresentacao pptx powerpoint slides exportar baixar report operacional",
  acessos: "usuarios senha permissoes login niveis quem entra no painel",
};

export interface ItemDeBusca { destino: string; rotulo: string; menu: string; palavras: string }

/** Tudo o que a busca do menu encontra: cada menu e cada aba, com o nome do menu de cima. */
export function itensDeBusca(itens: NavItem[], dono = false): ItemDeBusca[] {
  return itens.flatMap((m) => [
    { destino: m.id, rotulo: m.label, menu: m.label, palavras: PALAVRAS[m.id] ?? "" },
    ...(SUBMENUS[m.id] ?? []).filter((a) => dono || !ABAS_SO_DONO.has(`${m.id}/${a.id}`)).map((a) => ({ destino: `${m.id}/${a.id}`, rotulo: a.rotulo, menu: m.label, palavras: PALAVRAS[`${m.id}/${a.id}`] ?? "" })),
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
