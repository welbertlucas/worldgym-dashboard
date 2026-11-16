// Novidades do Atlas (tela "Novidades", no rodapé do menu, com o número das não vistas). Cada uma diz para quem é: "todos" ou só o "dono".
// O que é controle do dono não aparece para os outros usuários, nem como novidade nem como explicação.
// Para incluir uma: a mais nova no topo, id único e estável (o "visto" guarda os ids).
// Formato: título "Tela: o que mudou"; o texto começa pelo problema da academia e depois diz o que mudou.
// `artigo` liga ao artigo da Central de ajuda ("Saiba mais"); `tela` abre o lugar ("Ver na tela").

export type Publico = "todos" | "dono";
export type TipoNovidade = "novo" | "melhoria";

export interface Novidade {
  id: string;
  /** AAAA-MM-DD */
  data: string;
  tipo: TipoNovidade;
  titulo: string;
  texto: string;
  /** Tela que o botão "Ver na tela" abre (#menu ou #menu/aba). */
  tela?: string;
  /** Artigo da Central de ajuda que o "Saiba mais" abre. */
  artigo?: string;
  publico: Publico;
  autora: string;
}

export const AUTORA = "Ana Júlia";

export const NOVIDADES: Novidade[] = [
  {
    id: "2026-11-16-central-de-ajuda", data: "2026-11-16", tipo: "novo", publico: "todos", autora: AUTORA, tela: "ajuda",
    titulo: "Central de ajuda: um guia de cada tela",
    texto: "Bateu a dúvida sobre um número ou sobre onde fica alguma coisa? A Central de ajuda, no rodapé do menu, explica cada tela e cada indicador, com busca. As novidades também ganharam lugar próprio, logo acima dela.",
  },
  {
    id: "2026-11-16-alerta-conversao", data: "2026-11-16", tipo: "novo", publico: "todos", autora: AUTORA, tela: "riscos/mes", artigo: "como-funcionam-alertas",
    titulo: "Alertas: conversão de oportunidades",
    texto: "Muita oportunidade entrando e pouca virando matrícula só ficava claro no fim do mês. Agora, quando a conversão fica bem abaixo do normal para esta altura do mês, a unidade recebe um alerta, com o plano do que fazer.",
  },
  {
    id: "2026-11-16-celular", data: "2026-11-16", tipo: "melhoria", publico: "todos", autora: AUTORA,
    titulo: "Celular: listas por unidade sem aperto",
    texto: "No celular, o nome das unidades ficava cortado nas listas. Agora saldo devedor, notas fiscais, liberações e outras unidades mostram o nome inteiro, com o número ao lado.",
  },
  {
    id: "2026-11-16-menu", data: "2026-11-16", tipo: "melhoria", publico: "todos", autora: AUTORA, artigo: "buscar-tela",
    titulo: "Menu: todas as telas numa lista só",
    texto: "Com o menu dividido em grupos, algumas telas ficavam escondidas. Agora todas estão numa sequência só, e a busca no topo do menu acha qualquer tela pelo nome ou pelo assunto.",
  },
  {
    id: "2026-11-15-alertas-do-mes", data: "2026-11-15", tipo: "novo", publico: "todos", autora: AUTORA, tela: "riscos/mes", artigo: "mes-x-fechamento",
    titulo: "Alertas: o mês em andamento",
    texto: "Os alertas só chegavam depois de o mês fechar, quando já não dava para reagir. Agora eles olham o mês que está acontecendo e comparam com o mesmo dia dos meses anteriores. O que aconteceu no mês passado fica na aba Fechamento.",
  },
  {
    id: "2026-11-15-previsao-faturamento", data: "2026-11-15", tipo: "novo", publico: "todos", autora: AUTORA, tela: "metas", artigo: "tela-metas",
    titulo: "Metas: projeção de fechamento do mês",
    texto: "Descobrir no último dia que a meta não vai sair não ajuda. As Metas agora mostram para onde o faturamento e os novos contratos devem ir até o fim do mês, no ritmo atual, e quanto falta para cada meta.",
  },
  {
    id: "2026-11-15-oportunidades", data: "2026-11-15", tipo: "novo", publico: "todos", autora: AUTORA, tela: "comercial/oportunidades", artigo: "tela-comercial",
    titulo: "Comercial: nova aba Oportunidades",
    texto: "De onde vêm os interessados, e quem converte melhor? A nova aba mostra a origem das oportunidades, o perfil, quanto tempo levam para fechar e os consultores que mais convertem.",
  },
  {
    id: "2026-11-13-marcar-feito", data: "2026-11-13", tipo: "novo", publico: "todos", autora: AUTORA, tela: "plano", artigo: "marcar-feito",
    titulo: "Plano de ação: marcar como feito",
    texto: "Sem saber o que já tinha sido resolvido, a equipe repetia ou esquecia tarefas. Cada item do plano agora tem o botão \"Marcar como feito\", e a equipe sabe o que ainda falta neste mês.",
  },

  // Só o dono
  {
    id: "2026-11-16-uso-do-plano", data: "2026-11-16", tipo: "novo", publico: "dono", autora: AUTORA, tela: "plano", artigo: "dono-uso-do-plano",
    titulo: "Plano de ação: quem está usando",
    texto: "Para saber se as unidades seguem o plano, era preciso perguntar. No Plano de ação, com a rede selecionada, você vê quantos itens cada unidade marcou como feitos no mês e quando foi a última marcação.",
  },
  {
    id: "2026-11-16-aviso-falha", data: "2026-11-16", tipo: "novo", publico: "dono", autora: AUTORA, artigo: "dono-rotinas",
    titulo: "Rotinas: aviso quando algo falha",
    texto: "Uma rotina parada só era notada pelos números desatualizados. Agora, se a leitura do EVO, o resumo diário, o backup, o Meta, o Instagram ou a publicação do site falhar, chega um e-mail para você com o que deixou de ser atualizado.",
  },
  {
    id: "2026-11-15-atividade", data: "2026-11-15", tipo: "novo", publico: "dono", autora: AUTORA, tela: "acessos", artigo: "dono-usuarios",
    titulo: "Usuários: atividade de cada pessoa",
    texto: "Para saber se alguém usa o Atlas, não havia onde olhar. Em Usuários, clique no nome da pessoa para ver o último acesso e as telas que ela abriu, com a unidade e o mês.",
  },
  {
    id: "2026-11-13-master-acessos", data: "2026-11-13", tipo: "melhoria", publico: "dono", autora: AUTORA, tela: "acessos", artigo: "dono-usuarios",
    titulo: "Usuários: Master pode gerenciar acessos",
    texto: "Criar cada acesso dependia só de você. Agora dá para liberar um Master para criar e ajustar acessos, sem dar a ele o restante do que é seu.",
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

const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Busca nas novidades: todas as palavras precisam aparecer no título, no texto ou no tipo (novo, melhoria). */
export const buscarNovidades = (lista: Novidade[], consulta: string): Novidade[] => {
  const termos = semAcento(consulta).split(/\s+/).filter(Boolean);
  if (!termos.length) return lista;
  return lista.filter((n) => { const tudo = semAcento(`${n.titulo} ${n.texto} ${n.tipo}`); return termos.every((t) => tudo.includes(t)); });
};
