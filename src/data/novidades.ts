// Novidades do Atlas (tela "Novidades", no rodapé do menu, com o número das não vistas). Cada uma diz para quem é: "todos" ou só o "dono".
// O que é controle do dono não aparece para os outros usuários, nem como novidade nem como explicação.
// Para incluir uma: a mais nova no topo, id único e estável (o "visto" guarda os ids).
// Formato: título "Tela: o que mudou"; o texto começa pelo problema da academia e depois diz o que mudou.
// `artigo` liga ao artigo da Central de ajuda ("Saiba mais"); `tela` abre o lugar ("Ver na tela").

/** "royalties": só quem vê o menu Royalties (dono, Master e quem o dono liberou); "juridico": só quem vê o menu Jurídico (dono e quem ele liberou); "dono": só o dono. */
export type Publico = "todos" | "dono" | "royalties" | "juridico" | "qualidade";
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
    id: "2026-11-20-qualidade", data: "2026-11-20", tipo: "novo", publico: "qualidade", autora: AUTORA, tela: "qualidade", artigo: "qualidade-o-que-e",
    titulo: "Qualidade: checklists e visitas às unidades dentro do Atlas",
    texto: "O roteiro de visitação às unidades (limpeza, uniforme, equipamentos) agora vive no Atlas. O menu Qualidade deixa criar os checklists, registrar a visita a cada unidade item a item (conforme, não conforme ou não se aplica) com comentário e foto, e acompanhar a nota de cada unidade, os itens que mais falham e quem está sem visita. Item não conforme pede o que corrigir; nos itens mais importantes, também uma foto. O menu aparece só para o dono e para quem ele liberar na tela Usuários.",
  },
  {
    id: "2026-11-20-juridico", data: "2026-11-20", tipo: "novo", publico: "juridico", autora: AUTORA, tela: "juridico", artigo: "juridico-o-que-e",
    titulo: "Jurídico: os processos da rede dentro do Atlas",
    texto: "Os processos que o escritório jurídico manda todo mês ficavam numa planilha. Agora o menu Jurídico mostra quantos processos a rede tem, quanto está em causa, por empresa, por órgão e por tipo de ação, quais estão sem andamento e a lista completa, com filtros de situação, natureza e empresa. O nome da parte contrária e os textos do processo não entram no Atlas. O menu aparece só para o dono e para quem ele liberar na tela Usuários.",
  },
  {
    id: "2026-11-20-royalties", data: "2026-11-20", tipo: "novo", publico: "royalties", autora: AUTORA, tela: "royalties", artigo: "royalties-o-que-e",
    titulo: "Royalties: os recebimentos da marca dentro do Atlas",
    texto: "Acompanhar o que cada unidade paga à marca (taxa fixa e royalties) e quem está devendo exigia abrir outro painel, com outra senha. Agora o menu Royalties mostra o resumo do período, quem está devendo (com a concentração do saldo e exportação em CSV), a situação de pagamento mês a mês, os royalties de cada unidade com as marcações de mês sem pagamento e queda forte, e o que era esperado contra o que entrou. Clicar numa unidade abre o detalhe da cobrança. Os números são os mesmos do painel anterior.",
  },
  {
    id: "2026-11-20-total-de-vendas", data: "2026-11-20", tipo: "novo", publico: "todos", autora: AUTORA, tela: "comercial", artigo: "diferente-do-evo",
    titulo: "Comercial: Total de vendas como no EVO",
    texto: "O Faturamento do Atlas soma as cobranças que venceram no mês e por isso nunca batia com o Total de vendas do Gerencial do EVO. Agora o Comercial também tem o cartão Total de vendas, que soma o valor das vendas de contrato do mês como o EVO faz, separado em recepção, cartão recorrente e online. O Faturamento continua em Financeiro. O cartão aparece nos meses em que o EVO já foi lido de novo; nos outros, fica sem dado.",
  },
  {
    id: "2026-11-20-contratos-vendidos-evo", data: "2026-11-20", tipo: "novo", publico: "todos", autora: AUTORA, tela: "comercial", artigo: "diferente-do-evo",
    titulo: "Comercial: Contratos Vendidos como no EVO",
    texto: "O número de contratos do Atlas não batia com o do Gerencial do EVO, porque o Atlas contava só os contratos novos. Agora o cartão do Comercial se chama Contratos Vendidos e soma o mesmo que o EVO: matrículas, rematrículas e renovações feitas na recepção, sem a renovação automática do cartão, a diária e o personal. As metas de novos contratos e o Saldo de Clientes continuam contando só matrículas e rematrículas. O cartão aparece nos meses em que o EVO já foi lido de novo; nos outros, fica sem dado.",
  },
  {
    id: "2026-11-20-contratos-por-plano", data: "2026-11-20", tipo: "novo", publico: "todos", autora: AUTORA, tela: "alunos/contratos", artigo: "tela-alunos",
    titulo: "Alunos: contratos ativos por plano",
    texto: "Para saber quantos alunos estão em cada plano era preciso abrir o relatório Clientes por contratos no EVO, unidade por unidade. Agora, em Alunos › Contratos, o Atlas lista os planos com mais contratos ativos hoje, com a quantidade e o percentual de cada um. Com uma unidade no filtro mostra os planos dela; sem, a rede. Dá para buscar um plano pelo nome e ver todos.",
  },
  {
    id: "2026-11-19-influenciadores-conferencia", data: "2026-11-19", tipo: "novo", publico: "todos", autora: AUTORA, tela: "campanhas/influenciadores", artigo: "tela-marketing",
    titulo: "Influenciadores: o que cada um postou contra o combinado",
    texto: "Saber se o influenciador cumpriu o contrato exigia abrir o perfil dele e contar post por post. Agora o Atlas lê o feed e os reels de cada perfil a cada 4 horas e mostra, para este mês ou o mês passado, quantos já saíram contra o combinado, se o ritmo está em dia e quais posts contaram, com o link de cada um. Por padrão só conta o post que cita a conta da unidade na legenda; em cada contrato dá para escolher que qualquer post do perfil conta. Marcação só na imagem, colaboração e stories o Atlas não enxerga. A conferência aparece depois da próxima atualização do Instagram.",
  },
  {
    id: "2026-11-19-marketing-visual", data: "2026-11-19", tipo: "melhoria", publico: "todos", autora: AUTORA, tela: "campanhas/instagram", artigo: "tela-marketing",
    titulo: "Marketing: Instagram e Influenciadores mais visuais",
    texto: "A aba Instagram era uma tabela e a de Influenciadores, uma lista de texto, difíceis de entender de relance. Agora o Instagram abre com os números dos últimos 30 dias (seguidores com o ganho e a evolução, interações e visualizações), um cartão por conta, o que gera mais interação e de que ela é feita, o melhor dia e horário para postar, os posts que mais engajaram com a imagem grande, os stories dos últimos 14 dias e o feed com filtro por tipo. Em Influenciadores, o topo mostra os contratos em vigor e o total combinado por mês, e cada contrato ganhou um cartão com o ponto do prazo em que está.",
  },
  {
    id: "2026-11-19-marketing-influenciadores", data: "2026-11-19", tipo: "novo", publico: "todos", autora: AUTORA, tela: "campanhas/influenciadores", artigo: "tela-marketing",
    titulo: "Marketing: aba Influenciadores",
    texto: "Os combinados com os influenciadores ficavam espalhados, e não havia onde conferir o que foi acertado com cada um. A nova aba Influenciadores, dentro de Marketing, guarda o @ do Instagram, a unidade, o período do contrato (início e fim são opcionais) e quanto de stories, feed e reels foi combinado por mês. O gestor da unidade cadastra e edita os da sua unidade; o Master e o dono, os de qualquer unidade. Por enquanto são só os contratos; a conferência do que cada um postou entra nas próximas etapas.",
  },
  {
    id: "2026-11-19-esqueci-minha-senha", data: "2026-11-19", tipo: "novo", publico: "todos", autora: AUTORA, artigo: "trocar-senha",
    titulo: "Entrar: esqueci minha senha",
    texto: "Quem esquecia a senha ficava esperando alguém gerar uma nova. Agora, na tela de entrada, o botão Esqueci minha senha manda para o seu e-mail um link para criar a senha nova. O link vale por 30 minutos e só funciona uma vez, e a senha antiga continua valendo até você usá-lo.",
  },
  {
    id: "2026-11-19-contratos-em-alunos", data: "2026-11-19", tipo: "melhoria", publico: "todos", autora: AUTORA, tela: "alunos/contratos", artigo: "tela-alunos",
    titulo: "Alunos: contratos ativos mudaram de lugar",
    texto: "Quantos contratos especiais, de personal, de plano local e de plano rede a unidade tem era um dado de base de alunos escondido no Ranking da rede. Agora fica em Alunos, na aba Contratos, com o percentual da rede ao lado quando uma unidade está escolhida. O endereço antigo continua funcionando e leva para o novo.",
  },
  {
    id: "2026-11-19-conversoes-cadastros-antigos", data: "2026-11-19", tipo: "melhoria", publico: "todos", autora: AUTORA, tela: "comercial/oportunidades", artigo: "tela-comercial",
    titulo: "Comercial: conversões de cadastros antigos",
    texto: "O número de visitantes e conversões do Resumo gerencial do EVO nunca batia com o do Atlas, e não dava para saber por quê. A conversão do Atlas conta só quem se cadastrou e virou cliente no mesmo período; o EVO também considera gente que se cadastrou antes e fechou agora. Na tabela Oportunidades por unidade, a nova coluna De cadastros antigos mostra quantos foram, sem mudar a taxa de conversão. A coluna aparece com os dados de hoje em diante.",
  },
  {
    id: "2026-11-18-overview-por-periodo", data: "2026-11-18", tipo: "novo", publico: "todos", autora: AUTORA, tela: "executiva", artigo: "tela-overview",
    titulo: "Overview: números de vários meses de uma vez",
    texto: "Para saber o faturamento de um trimestre ou do ano, era preciso somar mês a mês. No Overview, o botão Ver por período deixa escolher o mês inicial e o final: faturamento, recebimento e vendas online aparecem somados, e churn, inadimplência, renovação e conversão em média ponderada pelo tamanho de cada mês (um mês grande pesa mais que um pequeno). A marca no arco passa a ser o período anterior, com o mesmo número de meses. O X no botão volta ao mês escolhido no topo.",
  },
  {
    id: "2026-11-18-vendedores-que-mais-vendem", data: "2026-11-18", tipo: "novo", publico: "todos", autora: AUTORA, tela: "comercial/vendas", artigo: "tela-comercial",
    titulo: "Comercial: vendedores que mais vendem",
    texto: "Era preciso abrir o EVO para saber quem estava fechando os contratos da unidade. A aba Vendas agora traz o ranking dos vendedores do mês, com os contratos novos e rematrículas de cada um e o valor vendido, além de quantos vendedores venderam e quantos contratos ficaram sem vendedor no EVO (online e recorrência). Renovações não entram. Cada unidade vê os nomes só da própria equipe. O ranking aparece com os dados de hoje em diante; os meses já lidos ficam sem ele até serem recalculados.",
  },
  {
    id: "2026-11-18-gateway-cobrancas-taxas", data: "2026-11-18", tipo: "melhoria", publico: "todos", autora: AUTORA, tela: "financeiro/recebimento", artigo: "tela-financeiro",
    titulo: "Financeiro: cobranças e taxas por gateway de cartão",
    texto: "O recebimento em cartão mostrava só quanto entrou por Stone, Rede, Cielo e outros, sem dizer o peso de cada um. Agora cada gateway traz também quantas cobranças foram, o ticket médio e, quando o EVO informa, as taxas e quanto elas representam do recebido. Os meses já lidos ganham esse detalhe quando forem recalculados; o mês atual já vem com ele a partir da próxima atualização do EVO.",
  },
  {
    id: "2026-11-17-relatorios-para-todos", data: "2026-11-17", tipo: "novo", publico: "todos", autora: AUTORA, tela: "relatorios", artigo: "tela-relatorios",
    titulo: "Relatórios: a apresentação da reunião semanal em PowerPoint",
    texto: "Montar os números da reunião semanal exigia copiar valores de várias telas. O novo menu Relatórios gera uma apresentação em PowerPoint, no modelo do Report Operacional, com a semana ou o mês fechado, as unidades e os indicadores que você escolher, incluindo o mês até aqui, a evolução dos últimos 6 períodos e o plano de ação da unidade. Está disponível para quem recebeu o acesso.",
  },
  {
    id: "2026-11-17-relatorios-plano-mes", data: "2026-11-17", tipo: "melhoria", publico: "dono", autora: AUTORA, tela: "relatorios", artigo: "dono-relatorios",
    titulo: "Relatórios: plano de ação também no relatório do mês",
    texto: "O slide do plano de ação só aparecia no relatório da semana, e o relatório de um mês fechado ficava sem o que fazer. Agora o relatório de uma unidade, de semana ou de mês fechado, pode levar o plano de ação atual da unidade, com o mês do plano e a data dos dados escritos no slide.",
  },
  {
    id: "2026-11-17-resumo-sem-ontem-zerado", data: "2026-11-17", tipo: "melhoria", publico: "todos", autora: AUTORA, artigo: "resumo-email",
    titulo: "Resumo por e-mail: sem \"R$ 0 de ontem\" quando os dados atrasam",
    texto: "Em um dia em que a atualização da madrugada não terminou, o resumo chegou com o faturamento e os contratos de ontem zerados, como se nada tivesse acontecido. Agora, nesses dias, o resumo avisa no começo e mostra só o acumulado do mês, sem inventar um \"ontem\" vazio.",
  },
  {
    id: "2026-11-17-relatorios-evolucao", data: "2026-11-17", tipo: "melhoria", publico: "dono", autora: AUTORA, tela: "relatorios", artigo: "dono-relatorios",
    titulo: "Relatórios: evolução dos últimos 6 períodos e capa com a unidade",
    texto: "O relatório de uma unidade só mostrava um cartão com dois números, sem dizer se a unidade vinha subindo ou caindo. Agora cada indicador traz o valor e a variação em cima e as colunas dos últimos 6 períodos (meses ou semanas) embaixo, com a meta do mês como linha. A capa passou a levar o nome da unidade e o período, e quem vê só algumas unidades gera o relatório só com as suas.",
  },
  {
    id: "2026-11-17-relatorios-plano", data: "2026-11-17", tipo: "melhoria", publico: "dono", autora: AUTORA, tela: "relatorios", artigo: "dono-relatorios",
    titulo: "Relatórios: plano de ação da unidade",
    texto: "A reunião semanal precisava terminar com o que fazer, e os números ficavam num lado e o plano no outro. O relatório semanal de uma unidade agora pode levar o slide Plano de ação, com os itens em aberto do plano do mês, o que resolver agora e o que fazer para acelerar o mês.",
  },
  {
    id: "2026-11-17-relatorios-mes-ate-aqui", data: "2026-11-17", tipo: "melhoria", publico: "dono", autora: AUTORA, tela: "relatorios", artigo: "dono-relatorios",
    titulo: "Relatórios: o mês até aqui",
    texto: "Na reunião semanal, a pergunta é se o mês vai fechar. O relatório da semana agora traz o slide O mês até aqui: faturamento, recebimento, novos contratos e vendas online acumulados do dia 1 até o fim da semana, contra a meta do mês e contra o mesmo ponto do mês anterior.",
  },
  {
    id: "2026-11-17-relatorios-semana", data: "2026-11-17", tipo: "melhoria", publico: "dono", autora: AUTORA, tela: "relatorios", artigo: "dono-relatorios",
    titulo: "Relatórios: apresentação da semana",
    texto: "A reunião semanal precisava dos números da semana, e o relatório só tinha o mês. Agora dá para escolher a semana (1 a 7, 8 a 14, 15 a 21, 22 a 28 e 29 em diante) e comparar com a mesma semana do mês anterior. Todo percentual vem com a base, como 4 de 12 oportunidades.",
  },
  {
    id: "2026-11-17-relatorios", data: "2026-11-17", tipo: "novo", publico: "dono", autora: AUTORA, tela: "relatorios", artigo: "dono-relatorios",
    titulo: "Relatórios: apresentação em PowerPoint",
    texto: "Montar o Report Operacional do mês levava horas de cópia de números. Agora o menu Relatórios gera os slides (capa, números gerais e rankings por unidade) a partir do que o Atlas já guarda, num arquivo editável. Você escolhe o mês, as unidades e os indicadores, e libera o menu para quem quiser em Usuários.",
  },
  {
    id: "2026-11-16-stories-24h", data: "2026-11-16", tipo: "melhoria", publico: "todos", autora: AUTORA, tela: "campanhas/instagram", artigo: "tela-marketing",
    titulo: "Marketing: stories das últimas 24 horas",
    texto: "Para saber se a unidade postou hoje, era preciso rolar uma semana de stories. Agora o Instagram abre com o que está no ar, das últimas 24 horas. Os botões abaixo mostram os últimos 7 e 30 dias.",
  },
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
    id: "2026-11-16-ranking-plano", data: "2026-11-16", tipo: "novo", publico: "dono", autora: AUTORA, tela: "plano", artigo: "dono-uso-do-plano",
    titulo: "Plano de ação: ranking de quem mais resolveu",
    texto: "Saber quais unidades agem sobre o plano exigia comparar à mão, e contar só os itens marcados favorecia quem tinha mais problemas. No quadro Quem está usando o plano, o novo Ranking do mês ordena pela proporção resolvida, deixa as unidades sem pendência à parte em \"Plano limpo\" e recomeça todo mês. Só você vê, em teste até 16/12.",
  },
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
/** Quem vê cada novidade: todos veem as "todos"; o dono vê tudo; as de royalties só vão a quem pode ver o menu Royalties (`royalties`, por padrão igual ao dono). */
export const publicoVe = (publico: Publico, dono: boolean, royalties: boolean = dono, juridico: boolean = dono, qualidade: boolean = dono) => publico === "todos" || (publico === "royalties" ? royalties : publico === "juridico" ? juridico : publico === "qualidade" ? qualidade : dono);
export const novidadesPara = (dono: boolean, lista: Novidade[] = NOVIDADES, royalties: boolean = dono, juridico: boolean = dono, qualidade: boolean = dono): Novidade[] =>
  lista.filter((n) => publicoVe(n.publico, dono, royalties, juridico, qualidade)).sort((a, b) => b.data.localeCompare(a.data));

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
