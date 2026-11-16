// Novidades do Atlas (topo da tela "Ajuda e novidades"; o número aparece no item do menu). Cada uma diz para quem é: "todos" ou só o "dono".
// O que é controle do dono não aparece para os outros usuários, nem como novidade nem como explicação.
// Para incluir uma: a mais nova no topo, id único e estável (o "visto" guarda os ids).

export type Publico = "todos" | "dono";

export interface Novidade {
  id: string;
  /** AAAA-MM-DD */
  data: string;
  titulo: string;
  texto: string;
  /** Tela que o botão "Ver na tela" abre (#menu ou #menu/aba). */
  tela?: string;
  publico: Publico;
  autora: string;
}

export const AUTORA = "Ana Júlia";

export const NOVIDADES: Novidade[] = [
  {
    id: "2026-11-16-central-de-ajuda", data: "2026-11-16", publico: "todos", autora: AUTORA, tela: "ajuda",
    titulo: "Central de ajuda",
    texto: "Um guia de cada tela, o significado de cada indicador e as dúvidas mais comuns, com busca, aqui mesmo, logo abaixo das novidades.",
  },
  {
    id: "2026-11-16-alerta-conversao", data: "2026-11-16", publico: "todos", autora: AUTORA, tela: "riscos/mes",
    titulo: "Alerta de conversão de oportunidades",
    texto: "Quando a conversão de oportunidades do mês fica bem abaixo do normal para esta altura do mês, a unidade recebe um alerta, com o plano do que fazer.",
  },
  {
    id: "2026-11-16-celular", data: "2026-11-16", publico: "todos", autora: AUTORA,
    titulo: "Atlas mais fácil de ler no celular",
    texto: "As listas por unidade (saldo devedor, notas fiscais, liberações e outras unidades) mostram o nome inteiro da unidade e o número ao lado, sem aperto.",
  },
  {
    id: "2026-11-16-menu", data: "2026-11-16", publico: "todos", autora: AUTORA,
    titulo: "Menu em uma lista só",
    texto: "O menu lateral ficou mais simples, com todas as telas numa sequência. A busca no topo do menu continua achando qualquer tela pelo nome ou pelo assunto.",
  },
  {
    id: "2026-11-15-alertas-do-mes", data: "2026-11-15", publico: "todos", autora: AUTORA, tela: "riscos/mes",
    titulo: "Alertas do mês em andamento",
    texto: "Os alertas agora olham o mês que está acontecendo e comparam com o mesmo dia dos meses anteriores. Dá para agir antes de o mês fechar. O que aconteceu no mês passado fica na aba Fechamento.",
  },
  {
    id: "2026-11-15-previsao-faturamento", data: "2026-11-15", publico: "todos", autora: AUTORA, tela: "metas",
    titulo: "Projeção de fechamento do mês",
    texto: "As Metas mostram para onde o faturamento e os novos contratos devem ir até o fim do mês, no ritmo atual, e quanto falta para cada meta.",
  },
  {
    id: "2026-11-15-oportunidades", data: "2026-11-15", publico: "todos", autora: AUTORA, tela: "comercial/oportunidades",
    titulo: "Nova aba Oportunidades",
    texto: "Em Comercial: de onde vêm as oportunidades, o perfil, quanto tempo levam para fechar e os consultores que mais convertem.",
  },
  {
    id: "2026-11-13-marcar-feito", data: "2026-11-13", publico: "todos", autora: AUTORA, tela: "plano",
    titulo: "Marque o que já foi feito no Plano de ação",
    texto: "Cada item do plano tem o botão \"Marcar como feito\". Assim a equipe sabe o que já foi resolvido e o que ainda falta neste mês.",
  },

  // Só o dono
  {
    id: "2026-11-16-uso-do-plano", data: "2026-11-16", publico: "dono", autora: AUTORA, tela: "plano",
    titulo: "Quem está usando o plano",
    texto: "No Plano de ação, com a rede selecionada: quantos itens cada unidade marcou como feitos no mês e quando foi a última marcação.",
  },
  {
    id: "2026-11-16-aviso-falha", data: "2026-11-16", publico: "dono", autora: AUTORA,
    titulo: "Aviso quando uma rotina falha",
    texto: "Se a leitura do EVO, o resumo diário, o backup, o Meta, o Instagram ou a publicação do site falhar, chega um e-mail para você com o que deixou de ser atualizado.",
  },
  {
    id: "2026-11-15-atividade", data: "2026-11-15", publico: "dono", autora: AUTORA, tela: "acessos",
    titulo: "Atividade de cada usuário",
    texto: "Em Usuários, clique no nome da pessoa para ver o último acesso e as telas que ela abriu, com a unidade e o mês.",
  },
  {
    id: "2026-11-13-master-acessos", data: "2026-11-13", publico: "dono", autora: AUTORA, tela: "acessos",
    titulo: "Master pode gerenciar acessos",
    texto: "Você pode liberar um Master para criar e ajustar acessos, sem dar a ele o restante do que é seu.",
  },
];

/** Novidades que a pessoa pode ver, da mais nova para a mais antiga. */
export const novidadesPara = (dono: boolean, lista: Novidade[] = NOVIDADES): Novidade[] =>
  lista.filter((n) => n.publico === "todos" || dono).sort((a, b) => b.data.localeCompare(a.data));

/** Quantas ainda não foram vistas. */
export const naoVistas = (lista: Novidade[], vistas: Iterable<string>): number => {
  const v = new Set(vistas);
  return lista.filter((n) => !v.has(n.id)).length;
};
