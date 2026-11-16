// Central de ajuda do Atlas. Cada artigo diz para quem é: "todos" ou só o "dono".
// Regra: o texto para todos fala só do uso (o que dá para fazer, o que o número quer dizer); nada sobre o que o dono
// acompanha nem sobre como o sistema funciona por dentro.
// `imagem`: nome do print da tela (guardado no armazenamento do Atlas e entregue só a quem está logado; números fictícios).
import { AJUDA } from "@/data/indicadorAjuda";
import { AUTORA, type Publico } from "@/data/novidades";

export interface ArtigoAjuda {
  id: string;
  secao: SecaoAjuda;
  titulo: string;
  resumo: string;
  paragrafos: string[];
  /** Tela que o botão "Abrir esta tela" leva (#menu ou #menu/aba). */
  tela?: string;
  imagem?: string;
  publico: Publico;
  autora: string;
  /** AAAA-MM-DD */
  atualizadoEm: string;
}

export type SecaoAjuda = "comecando" | "telas" | "alertas" | "duvidas" | "indicadores" | "dono";

export const SECOES: { id: SecaoAjuda; titulo: string; descricao: string; publico: Publico }[] = [
  { id: "comecando", titulo: "Primeiros passos", descricao: "O que é o Atlas, como escolher a unidade e o mês e como achar uma tela.", publico: "todos" },
  { id: "telas", titulo: "As telas do Atlas", descricao: "Para que serve cada tela e o que tem em cada aba.", publico: "todos" },
  { id: "alertas", titulo: "Alertas e plano de ação", descricao: "Como os alertas são decididos e como usar o plano com a equipe.", publico: "todos" },
  { id: "duvidas", titulo: "Dúvidas frequentes", descricao: "Senha, números diferentes do EVO, resumo por e-mail e mais.", publico: "todos" },
  { id: "indicadores", titulo: "O que significa cada indicador", descricao: "Churn, inadimplência, ticket médio e os outros números do Atlas.", publico: "todos" },
  { id: "dono", titulo: "Só você vê", descricao: "Usuários, rotinas automáticas e o que só você acompanha.", publico: "dono" },
];

const DATA = "2026-11-16";
const a = (secao: SecaoAjuda, id: string, titulo: string, resumo: string, paragrafos: string[], extra: Partial<ArtigoAjuda> = {}): ArtigoAjuda =>
  ({ id, secao, titulo, resumo, paragrafos, publico: secao === "dono" ? "dono" : "todos", autora: AUTORA, atualizadoEm: DATA, ...extra });

const ARTIGOS_ESCRITOS: ArtigoAjuda[] = [
  // Primeiros passos
  a("comecando", "o-que-e-o-atlas", "O que é o Atlas", "O painel de resultados da rede World Gym.", [
    "O Atlas reúne num lugar só os números das academias: faturamento, recebimento, inadimplência, vendas, oportunidades, alunos, acessos na catraca, retenção, metas e marketing.",
    "Os números vêm do EVO, das contas de anúncio do Meta, das pesquisas de satisfação e da planilha de metas. Você não precisa lançar nada no Atlas: ele lê essas fontes sozinho.",
    "A primeira tela é o Overview, com os principais números do mês. As outras telas ficam no menu lateral (no celular, no botão de três linhas no canto de cima). No rodapé do menu ficam as Novidades e esta Central de ajuda.",
  ], { tela: "executiva", imagem: "overview" }),
  a("comecando", "unidade-e-mes", "Como escolher a unidade e o mês", "O botão de unidade fica no cabeçalho; o mês, no topo de cada tela.", [
    "O botão de unidade, no canto do cabeçalho, filtra as telas para uma unidade. Escolhida a unidade, ela vale em todas as telas até você trocar. No celular, o botão fica logo abaixo do título.",
    "O mês fica no topo de cada tela. O botão Comparar coloca outro mês ao lado, para ver o que melhorou e o que piorou.",
    "O Overview mostra sempre o total das unidades que você acompanha, sem filtro de unidade.",
  ], { imagem: "filtros" }),
  a("comecando", "buscar-tela", "Como achar uma tela", "Use a busca no topo do menu.", [
    "Digite na busca do menu o nome da tela ou o assunto que procura, como \"churn\", \"nota\", \"catraca\" ou \"saldo devedor\". A busca mostra a tela e a aba certas.",
    "Use as setas para escolher e Enter para abrir.",
  ]),
  a("comecando", "mes-em-andamento", "Mês em andamento", "Os números do mês atual são parciais.", [
    "O mês que ainda não terminou mostra o que aconteceu até agora. Por isso o faturamento, as vendas e o recebimento parecem menores do que nos meses fechados.",
    "Para comparar de forma justa, os alertas do mês em andamento olham o mesmo dia dos meses anteriores. As Metas mostram a projeção de fechamento no ritmo atual.",
  ]),
  a("comecando", "novidades", "Novidades", "O que mudou no Atlas fica em Novidades, no rodapé do menu.", [
    "Quando o Atlas ganha algo novo, o item Novidades, no rodapé do menu, mostra um número (no celular, uma bolinha no botão do menu).",
    "Cada novidade diz se é algo novo ou uma melhoria. \"Saiba mais\" abre o artigo da Central de ajuda sobre o assunto e \"Ver na tela\" leva direto ao lugar.",
  ], { tela: "novidades" }),

  // Telas
  a("telas", "tela-overview", "Overview", "Os principais números do mês, num olhar.", [
    "Cada velocímetro mostra um indicador do mês selecionado. A marca no arco é o mês anterior: dá para ver na hora se subiu ou caiu.",
    "Mais abaixo vem a comparação entre unidades no último mês fechado.",
  ], { tela: "executiva", imagem: "overview" }),
  a("telas", "tela-plano", "Plano de ação", "O que fazer em cada unidade neste mês.", [
    "O plano nasce dos alertas do mês em andamento: para cada unidade, o que resolver agora e o que fazer para o mês fechar bem.",
    "O botão Copiar leva o plano pronto para mandar no WhatsApp para o gestor, a equipe ou os sócios.",
    "Quando uma ação for feita, use \"Marcar como feito\" no item. Assim todos sabem o que já foi resolvido.",
  ], { tela: "plano", imagem: "plano" }),
  a("telas", "tela-metas", "Metas", "Acompanhamento das metas bronze, prata e ouro.", [
    "Mostra quanto do mês já foi atingido em cada meta e a projeção de fechamento de faturamento e de novos contratos, no ritmo atual.",
    "A meta é da unidade inteira, dividida entre a equipe.",
  ], { tela: "metas" }),
  a("telas", "tela-alertas", "Alertas", "O que pede atenção, no mês em andamento e no último fechamento.", [
    "O botão Alertas no cabeçalho mostra quantos alertas críticos existem e os mais importantes. \"Ver todos\" abre a tela completa.",
    "A aba Mês em andamento mostra o que fazer agora. A aba Fechamento conta o que aconteceu no mês anterior.",
  ], { tela: "riscos/mes", imagem: "alertas" }),
  a("telas", "tela-comercial", "Comercial", "Vendas, oportunidades e receitas complementares.", [
    "Resumo: novos contratos, cancelamentos, vendas online e conversão.",
    "Vendas: vendas por dia, projeção de fechamento e os planos mais vendidos.",
    "Oportunidades: de onde vêm, o perfil, o tempo até fechar e os consultores que mais convertem.",
    "Receitas complementares: diárias, personal, brinquedoteca, WG Plus, Pro+, camisetas e coqueteleiras.",
  ], { tela: "comercial", imagem: "comercial" }),
  a("telas", "tela-financeiro", "Financeiro", "Faturamento, recebimento, inadimplência e notas fiscais.", [
    "Resumo: faturamento, recebimento, inadimplência e ticket médio, com a previsão de faturamento até o fim do mês.",
    "Recebimento: formas de pagamento, bandeiras de cartão e taxas cobradas.",
    "Inadimplência: cobranças de cartão recusadas, saldo devedor por unidade e o perfil de quem está em atraso.",
    "Notas fiscais: notas emitidas no mês por unidade.",
  ], { tela: "financeiro", imagem: "financeiro" }),
  a("telas", "tela-alunos", "Alunos", "Tamanho da base, perfil e onde os alunos moram.", [
    "Tamanho da base: alunos ativos, quem entrou, voltou e saiu, permanência média e LTV.",
    "Perfil: gênero e faixa de idade. Onde moram: os bairros dos alunos no mapa.",
  ], { tela: "alunos", imagem: "alunos" }),
  a("telas", "tela-catraca", "Acessos na catraca", "Frequência, liberações manuais e outras unidades.", [
    "Frequência: entradas por dia e o mapa de calor dos horários mais cheios.",
    "Liberações: entradas liberadas à mão na recepção e os motivos.",
    "Outras unidades: alunos que treinam em outra unidade da rede.",
  ], { tela: "catraca", imagem: "catraca" }),
  a("telas", "tela-retencao", "Retenção", "Cancelamentos, renovação e satisfação.", [
    "Cancelamentos: churn do mês e os motivos. Renovação: contratos de prazo fixo que venceram e quantos renovaram.",
    "Satisfação: NPS, nota do Google e nota do Reclame Aqui.",
  ], { tela: "retencao", imagem: "retencao" }),
  a("telas", "tela-marketing", "Marketing", "Campanhas, anúncios e Instagram.", [
    "Campanhas: investimento no Meta, custo por contato e evolução. Anúncios: os que trazem contato mais barato e os horários dos contatos.",
    "Instagram: posts, stories e seguidores das contas das unidades.",
  ], { tela: "campanhas" }),
  a("telas", "tela-ranking", "Ranking da rede", "Como cada unidade está em relação às outras.", [
    "Posição e destaques, evolução da unidade mês a mês, comparação lado a lado entre duas unidades, contratos ativos e a tabela completa com todos os indicadores.",
  ], { tela: "benchmark", imagem: "ranking" }),

  // Alertas e plano de ação
  a("alertas", "como-funcionam-alertas", "Como os alertas são decididos", "Comparação com o mesmo dia dos meses anteriores.", [
    "Um alerta do mês em andamento compara a unidade com ela mesma: o número de hoje contra a média do mesmo dia dos três meses anteriores. Por exemplo, a inadimplência do dia 16 é comparada com a do dia 16 dos três meses antes.",
    "Assim a comparação é justa, mesmo com o mês pela metade. Alguns alertas só começam depois do dia 10, quando o mês já tem movimento suficiente.",
  ], { tela: "riscos/mes" }),
  a("alertas", "atencao-critico", "Atenção e crítico", "O que muda entre os dois níveis.", [
    "Atenção: o número saiu do normal para esta altura do mês. Vale olhar e acompanhar.",
    "Crítico: saiu do normal com folga. Pede ação agora; é o que aparece primeiro no Plano de ação e no botão Alertas.",
  ]),
  a("alertas", "marcar-feito", "Marcar uma ação como feita", "Como usar o botão \"Marcar como feito\".", [
    "No Plano de ação, cada item tem o botão \"Marcar como feito\". Depois de marcado, o item mostra quem marcou e quando.",
    "Se marcou por engano, clique de novo para desfazer.",
  ], { tela: "plano", imagem: "plano" }),
  a("alertas", "copiar-plano", "Mandar o plano para a equipe", "O botão Copiar deixa o texto pronto para o WhatsApp.", [
    "Em cada unidade do Plano de ação há o botão Copiar. Ele copia o plano em texto, pronto para colar numa conversa.",
  ], { tela: "plano" }),
  a("alertas", "mes-x-fechamento", "Mês em andamento e fechamento", "Duas abas, dois momentos.", [
    "Mês em andamento: o que fazer agora, enquanto ainda dá para mudar o resultado.",
    "Fechamento: o que aconteceu no mês anterior, com as possíveis causas e a comparação com o mesmo mês do ano passado.",
  ], { tela: "riscos/fechamento" }),

  // Dúvidas
  a("duvidas", "dado-de-hoje", "Por que o que aconteceu hoje ainda não aparece?", "Os números do EVO são atualizados de madrugada.", [
    "O Atlas lê o EVO uma vez por dia, de madrugada. O que aconteceu hoje aparece amanhã cedo.",
  ]),
  a("duvidas", "diferente-do-evo", "Por que um número é diferente do que vejo no EVO?", "Alguns indicadores usam uma regra própria.", [
    "Cada indicador tem uma regra de cálculo, explicada em \"O que significa cada indicador\" e no botão \"i\" de cada card. A conversão, por exemplo, segue o relatório de cadastro e conversão de oportunidades, e não o número de visitantes do painel do EVO.",
    "Se mesmo assim o número parecer errado, avise quem liberou o seu acesso.",
  ]),
  a("duvidas", "trocar-senha", "Como troco minha senha?", "Pelo seu nome, no canto do cabeçalho.", [
    "No computador, clique no seu nome no canto do cabeçalho e escolha a nova senha.",
    "Se esqueceu a senha, peça uma nova a quem liberou o seu acesso.",
  ]),
  a("duvidas", "pediu-senha", "Por que o Atlas pediu a senha de novo?", "Por segurança, depois de um tempo sem uso.", [
    "Depois de um tempo sem uso, e também depois de alguns dias, o Atlas pede para entrar de novo. É para ninguém ver os números num computador esquecido aberto.",
  ]),
  a("duvidas", "nao-vejo-unidade", "Não encontro uma unidade", "Você vê as unidades liberadas para o seu acesso.", [
    "Cada acesso vê as unidades que foram liberadas para ele. Se precisar de outra, peça a quem liberou o seu acesso.",
  ]),
  a("duvidas", "resumo-email", "O resumo que chega por e-mail", "Todo dia de manhã, com os números de ontem.", [
    "Todo dia de manhã chega um resumo com o faturamento de ontem e do mês e os alertas que pedem atenção. Se não quiser receber, peça a quem liberou o seu acesso.",
  ]),

  // Só o dono
  a("dono", "dono-usuarios", "Usuários e níveis de acesso", "Criar acessos, níveis e o resumo por e-mail.", [
    "Em Usuários você cria acessos de Dono, Master ou Unidades (uma ou mais). A senha provisória vai por e-mail e a pessoa escolhe a própria no primeiro acesso.",
    "Você pode liberar um Master para gerenciar acessos e ligar ou desligar o resumo diário de cada pessoa.",
    "Clique no nome de um usuário para ver o último acesso e as telas que ele abriu.",
  ], { tela: "acessos" }),
  a("dono", "dono-ver-como", "Ver como", "Olhar o Atlas como um Master ou como uma unidade.", [
    "O botão Ver como, no cabeçalho, mostra o Atlas exatamente como outro nível vê. Vale só na aba do navegador em que foi ligado.",
    "Enquanto estiver vendo como outro nível, o que é só seu (como esta seção) some da tela.",
  ]),
  a("dono", "dono-uso-do-plano", "Quem está usando o plano", "Adoção do Plano de ação por unidade.", [
    "No Plano de ação, com a rede selecionada, o quadro mostra quantos itens cada unidade marcou como feitos no mês e quando foi a última marcação. As unidades que nunca marcaram aparecem primeiro.",
  ], { tela: "plano" }),
  a("dono", "dono-rotinas", "Rotinas automáticas e avisos", "O que roda sozinho e quando você é avisado.", [
    "De madrugada o Atlas lê o EVO; de manhã lê o Meta e envia o resumo por e-mail; o Instagram é lido a cada 4 horas; a lista de usuários tem backup diário.",
    "Se alguma dessas rotinas falhar ou passar do tempo, chega um e-mail só para você dizendo o que deixou de ser atualizado.",
  ]),
  a("dono", "dono-atualizar", "Atualizar da planilha", "O botão de setas no cabeçalho.", [
    "O botão de setas no cabeçalho busca de novo a planilha de metas e os números guardados, sem esperar a atualização automática.",
  ]),
  a("dono", "dono-ajuda-novidades", "Central de ajuda e novidades só para você", "O que fica fora da vista dos outros usuários.", [
    "Artigos e novidades sobre controles seus (usuários, atividade, uso do plano, avisos de rotinas) só aparecem para você. Os outros usuários veem só o uso das telas.",
  ]),
];

/** Glossário: o mesmo texto do botão "i" de cada card (uma fonte só). */
const INDICADORES: ArtigoAjuda[] = Object.entries(AJUDA)
  .filter(([nome]) => nome !== "Conversão de Cadastros")
  .map(([nome, texto]) => a("indicadores", `indicador-${nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`, nome, texto.split(". ")[0] + ".", [texto]));

export const ARTIGOS: ArtigoAjuda[] = [...ARTIGOS_ESCRITOS, ...INDICADORES];

export const artigosPara = (dono: boolean, lista: ArtigoAjuda[] = ARTIGOS) => lista.filter((x) => x.publico === "todos" || dono);
export const secoesPara = (dono: boolean) => SECOES.filter((s) => s.publico === "todos" || dono);

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Busca: todas as palavras precisam aparecer no título, resumo ou texto; o que bate no título vem primeiro. */
export function buscarAjuda(lista: ArtigoAjuda[], consulta: string): ArtigoAjuda[] {
  const termos = semAcento(consulta).split(/\s+/).filter(Boolean);
  if (!termos.length) return [];
  return lista
    .map((x) => {
      const titulo = semAcento(x.titulo);
      const tudo = `${titulo} ${semAcento(x.resumo)} ${semAcento(x.paragrafos.join(" "))}`;
      return { x, ok: termos.every((t) => tudo.includes(t)), pontos: termos.filter((t) => titulo.includes(t)).length };
    })
    .filter((r) => r.ok)
    .sort((p, q) => q.pontos - p.pontos)
    .map((r) => r.x);
}
