// Central de ajuda do Atlas. Cada artigo diz para quem é: "todos" ou só o "dono".
// Regra: o texto para todos fala só do uso (o que dá para fazer, o que o número quer dizer); nada sobre o que o dono
// acompanha nem sobre como o sistema funciona por dentro.
// `imagem`: nome do print da tela (guardado no armazenamento do Atlas e entregue só a quem está logado; números fictícios).
import { AJUDA } from "@/data/indicadorAjuda";
import { AUTORA, publicoVe, type Publico } from "@/data/novidades";

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

export type SecaoAjuda = "comecando" | "telas" | "alertas" | "duvidas" | "indicadores" | "franqueadora" | "royalties" | "juridico" | "qualidade" | "escalas" | "documentos" | "dono";

export const SECOES: { id: SecaoAjuda; titulo: string; descricao: string; publico: Publico }[] = [
  { id: "comecando", titulo: "Primeiros passos", descricao: "O que é o Atlas, como escolher a unidade e o mês e como achar uma tela.", publico: "todos" },
  { id: "telas", titulo: "As telas do Atlas", descricao: "Para que serve cada tela e o que tem em cada aba.", publico: "todos" },
  { id: "alertas", titulo: "Alertas e plano de ação", descricao: "Como os alertas são decididos e como usar o plano com a equipe.", publico: "todos" },
  { id: "duvidas", titulo: "Dúvidas frequentes", descricao: "Senha, números diferentes do EVO, resumo por e-mail e mais.", publico: "todos" },
  { id: "indicadores", titulo: "O que significa cada indicador", descricao: "Churn, inadimplência, ticket médio e os outros números do Atlas.", publico: "todos" },
  { id: "franqueadora", titulo: "Franqueadora", descricao: "O menu que reúne Royalties e Jurídico, e quem vê cada aba.", publico: "franqueadora" },
  { id: "royalties", titulo: "Royalties", descricao: "Os recebimentos da marca, quem está devendo e como ler cada painel.", publico: "royalties" },
  { id: "juridico", titulo: "Jurídico", descricao: "Os processos da rede e como ler a tela.", publico: "juridico" },
  { id: "qualidade", titulo: "Qualidade", descricao: "Checklists, visitas às unidades e a nota de cada uma.", publico: "qualidade" },
  { id: "escalas", titulo: "Gerador de escalas", descricao: "A escala 5x2 da equipe, a escala livre, o histórico, o PDF e o Excel.", publico: "escalas" },
  { id: "documentos", titulo: "Documentos", descricao: "Os arquivos de cada unidade: pastas, envio, limites e quem vê.", publico: "documentos" },
  { id: "dono", titulo: "Só você vê", descricao: "Usuários, rotinas automáticas e o que só você acompanha.", publico: "dono" },
];

const DATA = "2026-11-16";
const a = (secao: SecaoAjuda, id: string, titulo: string, resumo: string, paragrafos: string[], extra: Partial<ArtigoAjuda> = {}): ArtigoAjuda =>
  ({ id, secao, titulo, resumo, paragrafos, publico: secao === "dono" ? "dono" : secao === "royalties" ? "royalties" : secao === "juridico" ? "juridico" : secao === "qualidade" ? "qualidade" : secao === "escalas" ? "escalas" : secao === "documentos" ? "documentos" : secao === "franqueadora" ? "franqueadora" : "todos", autora: AUTORA, atualizadoEm: DATA, ...extra });

const ARTIGOS_ESCRITOS: ArtigoAjuda[] = [
  // Primeiros passos
  a("comecando", "o-que-e-o-atlas", "O que é o Atlas", "O painel de resultados da rede World Gym.", [
    "O Atlas reúne num lugar só os números das academias: faturamento, pagamentos dos clientes, inadimplência, vendas, oportunidades, alunos, acessos na catraca, retenção, metas e marketing.",
    "Os números vêm do EVO, das contas de anúncio do Meta, das pesquisas de satisfação e da planilha de metas. Você não precisa lançar nada no Atlas: ele lê essas fontes sozinho.",
    "A primeira tela é o Overview, com os principais números do mês. As outras telas ficam no menu lateral (no celular, no botão de três linhas no canto de cima). No rodapé do menu ficam as Novidades e esta Central de ajuda.",
    "Quem recebeu o acesso também tem o menu Relatórios, que monta no PowerPoint a apresentação da reunião semanal, com os números da semana ou do mês.",
  ], { tela: "executiva", imagem: "overview", atualizadoEm: "2026-11-17" }),
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
    "O mês que ainda não terminou mostra o que aconteceu até agora. Por isso o faturamento, as vendas e os pagamentos dos clientes parecem menores do que nos meses fechados.",
    "Para comparar de forma justa, os alertas do mês em andamento olham o mesmo dia dos meses anteriores. As Metas mostram a projeção de fechamento no ritmo atual.",
  ]),
  a("comecando", "novidades", "Novidades", "O que mudou no Atlas fica em Novidades, no rodapé do menu.", [
    "Quando o Atlas ganha algo novo, o item Novidades, no rodapé do menu, mostra um número (no celular, uma bolinha no botão do menu).",
    "Cada novidade diz se é algo novo ou uma melhoria. \"Saiba mais\" abre o artigo da Central de ajuda sobre o assunto e \"Ver na tela\" leva direto ao lugar.",
  ], { tela: "novidades" }),

  // Telas
  a("telas", "tela-overview", "Overview", "Os principais números do mês, num olhar.", [
    "Cada velocímetro mostra um indicador do mês selecionado. A marca no arco é o mês anterior: dá para ver na hora se subiu ou caiu.",
    "Para olhar vários meses juntos, use Ver por período e escolha o mês inicial e o final. Faturamento, pagamentos dos clientes e vendas online são somados; churn, inadimplência, renovação e conversão viram a média dos meses ponderada pelo tamanho de cada um (alunos ativos no início, pagantes, contratos a vencer e oportunidades). A marca no arco passa a ser o período anterior, do mesmo tamanho. O X volta ao mês do topo.",
    "Mais abaixo vem a comparação entre unidades no último mês fechado.",
  ], { tela: "executiva", imagem: "overview" }),
  a("telas", "tela-plano", "Plano de ação", "O que fazer em cada unidade neste mês.", [
    "O plano nasce dos alertas do mês em andamento: para cada unidade, o que resolver agora e o que fazer para o mês fechar bem.",
    "O botão Copiar leva o plano pronto para mandar no WhatsApp para o gestor, a equipe ou os sócios.",
    "Quando uma ação for feita, use \"Marcar como feito\" no item. Assim todos sabem o que já foi resolvido.",
    "O plano de uma unidade também pode ir para a apresentação da reunião: no menu Relatórios, o slide Plano de ação traz os itens em aberto.",
  ], { tela: "plano", imagem: "plano", atualizadoEm: "2026-11-17" }),
  a("telas", "tela-metas", "Metas", "Acompanhamento das metas bronze, prata e ouro.", [
    "Mostra quanto do mês já foi atingido em cada meta e a projeção de fechamento de faturamento e de novos contratos, no ritmo atual.",
    "A meta é da unidade inteira, dividida entre a equipe.",
  ], { tela: "metas" }),
  a("telas", "tela-alertas", "Alertas", "O que pede atenção, no mês em andamento e no último fechamento.", [
    "O menu Alertas, logo abaixo de Overview, mostra ao lado do nome quantos alertas críticos existem no mês em andamento.",
    "A aba Mês em andamento mostra o que fazer agora. A aba Fechamento conta o que aconteceu no mês anterior.",
  ], { tela: "riscos/mes", imagem: "alertas" }),
  a("telas", "tela-gerencial", "Gerencial", "Vendas, oportunidades, receitas complementares, recebimentos, inadimplência e notas fiscais (o antigo Comercial e o antigo Financeiro, num menu só).", [
    "Vendas: contratos vendidos, novos contratos, cancelamentos, vendas online e conversão; vendas por dia, projeção de fechamento, os 10 planos mais vendidos e os vendedores que mais vendem (contratos novos e rematrículas, com o valor; cada unidade vê os nomes só da própria equipe).",
    "Oportunidades: de onde vêm, o perfil, o tempo até fechar e os consultores que mais convertem. Na tabela por unidade, a coluna \"De cadastros antigos\" mostra quem se cadastrou em meses anteriores e fechou neste mês; ela não entra na taxa de conversão.",
    "Receitas complementares: diárias, personal, brinquedoteca, WG Plus, Pro+, camisetas e coqueteleiras.",
    "Recebimentos: ticket médio e adimplentes, a previsão de faturamento em duas linhas (vendido até agora e quanto deve fechar o mês, pela curva de vendas dos 3 meses anteriores até o mesmo dia) e o histórico; formas de pagamento, bandeiras de cartão e taxas cobradas. No cartão, o gateway (Stone, Rede, Cielo...) mostra quanto entrou por cada um, quantas cobranças foram e o ticket; quando o EVO informa, também as taxas e quanto elas pesam no recebido. Esse percentual é a taxa que o EVO registrou, não a cobrada no extrato da operadora; a cobrança sem taxa registrada entra como zero, e por isso o card diz em quantos % das cobranças há taxa registrada (abaixo de 90% o número fica marcado como incompleto).",
    "Inadimplência: o histórico, as cobranças de cartão recusadas, o saldo devedor por unidade e o perfil de quem está em atraso.",
    "Notas fiscais: notas emitidas no mês por unidade.",
  ], { tela: "gerencial", imagem: "comercial" }),
  a("telas", "tela-alunos", "Alunos", "Tamanho da base, perfil, onde os alunos moram e contratos ativos.", [
    "Tamanho da base: alunos ativos, quem entrou, voltou e saiu, permanência média e LTV.",
    "Perfil: gênero e faixa de idade. Onde moram: um mapa de calor feito a partir do CEP dos alunos, em que as manchas mais quentes são onde moram mais alunos. Dá para ver os ativos, quem saiu nos últimos 12 meses ou os dois juntos; só a contagem por região é guardada, nunca o endereço. A lista dos bairros fica ao lado, e o mapa tem Street View e zoom.",
    "Contratos: foto de hoje dos contratos ativos, quantos são especiais/VIP, de personal, de plano local (até 9 unidades) e de plano rede (10 ou mais; nas unidades Pro, todos). Local e rede somam 100%; especiais e personal são recortes dentro deles.",
    "Contratos ativos por plano: logo abaixo, a lista dos planos com mais contratos ativos hoje, do maior para o menor, com a quantidade e o percentual sobre o total, como o relatório Clientes por contratos do EVO. Com uma unidade no filtro, só os planos dela; sem, a rede (planos de mesmo nome somam). Mostra os 10 maiores, com busca e a opção de ver todos. Quem tem mais de um contrato ativo aparece em cada um deles.",
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
    "Instagram: números dos últimos 30 dias (seguidores com o ganho e a evolução, interações e visualizações), um cartão por conta, o que gera mais interação (e de que são feitas as interações), o melhor dia e horário para postar, os posts que mais engajaram, os stories dos últimos 14 dias e o feed, que dá para filtrar por tipo e ordenar por interação.",
    "Influenciadores: os contratos dos influenciadores da rede, com o @ do Instagram, a unidade, o período, em que ponto do prazo cada contrato está e quanto de stories, feed e reels foi combinado por mês (no topo, o total combinado nos contratos em vigor). A foto e o número de seguidores vêm do perfil público do Instagram e são atualizados a cada 4 horas; só dá para ler contas profissionais (Business ou Creator) e públicas. Se o perfil for pessoal ou privado, o cartão avisa e fica com a inicial no lugar da foto. Um influenciador recém-cadastrado aparece com foto na próxima atualização. O dono e o Master cadastram, editam, desativam e removem em qualquer unidade e na rede toda. Quem tem acesso por unidades faz isso só com os influenciadores da sua unidade (e vê só esses). Para pausar um contrato sem apagá-lo, use Desativar.",
    "Conferência do contrato: a cada 4 horas o Atlas lê os posts de cada perfil e mostra, para este mês ou o mês passado, quantos posts de feed e reels já saíram contra o combinado, se o ritmo está em dia, o que falta e quais posts contaram. Por padrão só conta o post que cita a conta da unidade (ou da marca) na legenda, com ou sem @ (ou como hashtag); no contrato dá para escolher que qualquer post do perfil conta. Quem tem o contrato só no meio do mês é cobrado em proporção. O Atlas não enxerga marcação feita só na imagem, post em colaboração nem stories, porque a Meta não entrega isso para contas de terceiros; por isso, “atrasado” pode significar só que a entrega não aparece na legenda. Cada cartão mostra a conta que o influenciador deve citar e tem o botão Copiar pedido, com a mensagem pronta para mandar a ele.",
  ], { tela: "campanhas" }),
  a("telas", "tela-relatorios", "Relatórios", "Gerar os slides do Report Operacional com os dados que você já vê no Atlas.", [
    "O menu Relatórios monta uma apresentação em PowerPoint (.pptx), no modelo do Report Operacional, com os dados do Atlas: capa, números gerais, o mês até aqui e um slide por indicador. Os gráficos são do próprio PowerPoint, então dá para ajustar valores e textos depois.",
    "Escolha o período: uma semana (semana 1 = dias 1 a 7, 2 = 8 a 14, 3 = 15 a 21, 4 = 22 a 28 e, quando existir, a 5 = 29 em diante) ou um mês fechado. A semana compara com a mesma semana do mês anterior; o mês fechado compara com o mesmo mês do ano anterior. Depois escolha as unidades e os indicadores: a lista ao lado mostra os slides que vão sair.",
    "No relatório de uma unidade só, cada indicador mostra o valor e a variação em cima e as colunas dos últimos 6 períodos embaixo, com a meta do mês como linha. Dá para incluir também o slide Plano de ação, com os itens em aberto do plano da unidade.",
    "Na semana, todo percentual vem com a base (por exemplo, conversão de 4 de 12 oportunidades), porque em 7 dias poucos casos mudam muito o percentual. Os dados vão até a véspera: a semana em andamento sai sem comparação. Ticket médio, inadimplência, churn e notas são do mês e não entram na semana.",
    "O relatório traz só as unidades que você enxerga, e o rodapé de cada slide leva o seu e-mail e a data. Se o menu Relatórios não aparece para você, peça o acesso a quem administra o Atlas.",
  ], { tela: "relatorios", atualizadoEm: "2026-11-17" }),
  a("telas", "tela-ranking", "Ranking da rede", "Como cada unidade está em relação às outras.", [
    "Posição e destaques, evolução da unidade mês a mês, comparação lado a lado entre duas unidades e a tabela completa com todos os indicadores.",
  ], { tela: "benchmark", imagem: "ranking" }),
  a("telas", "estudos-de-ponto-unidade", "Estudos de ponto: o estudo da sua unidade", "O mapa e o estudo da unidade: camadas, o que cada uma mostra e como exportar o PDF.", [
    "Quem tem acesso a unidades abre, neste menu, o estudo da própria unidade (quem tem mais de uma escolhe qual). O Master consulta o estudo de todas as unidades. O mapa ocupa a tela, e no cartão do canto as abas Mapa e Estudo alternam entre o mapa e os números.",
    "Camadas do mapa (painel à esquerda; clique para ligar e desligar). Base de clientes: mapa de calor de onde moram os alunos ativos, feito a partir do CEP; as manchas mais quentes têm mais alunos, e a lista dos bairros maiores fica no painel. Demanda potencial: onde a rede espera alunos, pela gente que mora perto e pelas outras unidades. Lacuna de captação: em magenta, onde há mais gente do que alunos, com os anéis das zonas de captação (primária, em vermelho, e secundária, em laranja) e, na legenda, de que distância vêm 70% e 90% dos alunos. População, Idade, Domicílios, Renda, Renda total, Potencial de consumo e Concentração comercial: o Censo 2022 do IBGE por hexágono de 200 metros (o potencial de consumo é a estimativa do que as famílias gastam com esportes). Canibalização: a área da unidade e a das unidades vizinhas, para ver quanto do público elas dividem.",
    "Por cima do mapa: Academias concorrentes mostra as academias da região (grandes redes com a cor de cada marca), buscadas no Google dentro da área de 10 minutos de carro. Os contornos azuis marcam essa área de deslocamento. A barra de baixo do mapa troca o fundo (Padrão, Cinza ou Satélite), mede distâncias com a régua, abre o Street View e aproxima ou afasta.",
    "Aba Estudo: De onde vêm os alunos (quantos moram a até 10 minutos de carro, onde moram 80% e os bairros maiores), Área de 10 min de carro (moradores, renda, idade e potencial de consumo da área) e Rede (quanto do público a unidade divide com as outras).",
    "Exportar PDF: o botão vermelho no cartão do canto gera o estudo da unidade em PDF, com uma foto do mapa de cada camada e os números. Leva alguns segundos porque as fotos são montadas na hora, sempre no mesmo enquadramento (não importa onde você deixou o zoom). A página das academias concorrentes só entra se a camada estiver ligada na hora de exportar, e as páginas que dependem da contagem por CEP só entram quando ela existe para a unidade. As fotos levam o crédito do mapa.",
    "Como ler: tudo aqui é estimativa. O Censo é de 2022, as zonas são distâncias em linha reta e o mapa de calor é por região, nunca por endereço de aluno. Serve para decidir onde fazer panfletagem, parcerias e anúncios, e não para prever vendas.",
  ], { tela: "estudos-de-ponto", atualizadoEm: "2026-11-25" }),

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
  a("duvidas", "diferente-do-evo", "Por que um número é diferente do que vejo no EVO?", "O Atlas usa regras próprias e é gravado de madrugada.", [
    "Cada indicador tem uma regra de cálculo, explicada em “O que significa cada indicador” e no botão “i” de cada card. O painel Gerencial do EVO usa outras regras, e o número dele muda durante o dia. O Atlas é gravado de madrugada, então os dois só batem por acaso.",
    "Faturamento: é o mesmo número do “Total de vendas” do Gerencial do EVO, o valor das vendas de contrato lançadas no mês (recepção, cartão recorrente e online). O Atlas usa uma conta só, com o mesmo nome e o mesmo valor, no Overview e no Gerencial. Pequenas diferenças para o EVO podem sobrar porque o EVO ainda tira vendas ao longo do dia, como as de cartão recusado. Os Pagamentos dos clientes, no Gerencial, aba Recebimentos, são outra informação: o que os clientes pagaram no mês, segundo o EVO.",
    "Contratos vendidos: o cartão Contratos Vendidos do Atlas segue o do EVO e soma matrículas, rematrículas e renovações feitas na recepção, sem a renovação automática do cartão, a diária e o personal. O Atlas lê o EVO de madrugada, com as vendas até a véspera: a tela do EVO, que mostra também as de hoje, fica um pouco à frente durante o dia. Já as metas de novos contratos e o Saldo de Clientes continuam contando só matrículas e rematrículas (contratos novos), sem as renovações.",
    "Conversão: segue o relatório de cadastro e conversão de oportunidades, e não o número de visitantes do Resumo gerencial do EVO, que usa outra regra e também conta quem se cadastrou antes e fechou agora. Esse grupo aparece à parte, na coluna “De cadastros antigos” de Oportunidades por unidade.",
    "Se mesmo assim o número parecer errado, avise quem liberou o seu acesso.",
  ], { atualizadoEm: "2026-11-20" }),
  a("duvidas", "trocar-senha", "Como troco minha senha? E se eu esquecer?", "Pelo seu nome, no cabeçalho; se esqueceu, pelo “Esqueci minha senha”.", [
    "Para trocar: no computador, clique no seu nome no canto do cabeçalho e escolha a nova senha.",
    "Se esqueceu a senha: na tela de entrada, clique em Esqueci minha senha e digite o e-mail do seu acesso. Chega um e-mail com um link para criar a nova senha. O link vale por 30 minutos e só funciona uma vez.",
    "Por segurança, o Atlas responde igual tenha o e-mail acesso ou não. Se o e-mail não chegar, olhe a caixa de spam e confira se digitou o e-mail do seu acesso; se ainda assim não chegar, peça uma nova senha a quem liberou o seu acesso.",
    "Ao criar a nova senha, o Atlas sai dos aparelhos onde você estava conectado, e você entra de novo com a senha nova.",
  ]),
  a("duvidas", "pediu-senha", "Por que o Atlas pediu a senha de novo?", "Por segurança, depois de um tempo sem uso.", [
    "Depois de um tempo sem uso, e também depois de alguns dias, o Atlas pede para entrar de novo. É para ninguém ver os números num computador esquecido aberto.",
  ]),
  a("duvidas", "nao-vejo-unidade", "Não encontro uma unidade", "Você vê as unidades liberadas para o seu acesso.", [
    "Cada acesso vê as unidades que foram liberadas para ele. Se precisar de outra, peça a quem liberou o seu acesso.",
  ]),
  a("duvidas", "resumo-email", "O resumo que chega por e-mail", "Todo dia de manhã, com os números de ontem.", [
    "Todo dia de manhã chega um resumo com o faturamento de ontem e do mês e os alertas que pedem atenção. Se não quiser receber, peça a quem liberou o seu acesso.",
    "Às vezes a atualização dos dados da madrugada não termina a tempo. Nesses dias o resumo traz um aviso no começo e mostra só o acumulado do mês, sem os números de ontem, que não chegaram. No dia seguinte, com os dados em dia, ele volta ao normal.",
  ], { atualizadoEm: "2026-11-17" }),

  // Franqueadora (só quem vê Royalties ou Jurídico)
  a("franqueadora", "franqueadora-o-que-e", "O que é o menu Franqueadora", "Royalties e Jurídico, agora como abas de um menu só.", [
    "Franqueadora é o menu que reúne o que a marca acompanha da relação com as unidades. Ele absorveu os antigos menus Royalties e Jurídico, que agora são duas abas dele: Royalties, com os recebimentos da marca por unidade e quem está devendo, e Jurídico, com os processos da rede.",
    "Quem vê o quê não mudou. A aba Royalties aparece para o dono, para todo Master e para quem o dono liberou; a aba Jurídico, para o dono e para quem ele liberou. Quem tem só uma das duas abre o menu direto nela, sem a faixa de abas. Quem tem as duas escolhe pela faixa no topo.",
    "O conteúdo de cada aba é o mesmo de antes, e os artigos das seções Royalties e Jurídico, aqui na Central de ajuda, continuam valendo. Links salvos como #royalties e #juridico continuam funcionando e abrem a aba certa dentro da Franqueadora.",
  ], { tela: "franqueadora", atualizadoEm: "2026-11-25" }),

  // Royalties (só quem vê o menu)
  a("royalties", "royalties-o-que-e", "O que é a aba Royalties", "Os recebimentos da marca, por unidade, e o que ainda falta entrar.", [
    "Mostra o que cada unidade pagou à marca em taxa fixa e em royalties, mês a mês, e quanto cada uma ainda deve (o saldo devedor). Os números vêm da planilha de controle dos recebimentos da marca e são atualizados todo dia de manhã.",
    "No topo ficam os filtros: período (mês inicial e final, com atalhos por ano), modalidade (taxa fixa ou royalties), só devedoras e unidade. Eles valem para todos os painéis da tela.",
    "O aviso de mês parcial quer dizer que o extrato do mês veio incompleto. Esses meses aparecem com asterisco e hachurados nos gráficos.",
  ], { tela: "royalties", atualizadoEm: "2026-11-20" }),
  a("royalties", "royalties-paineis", "Como ler cada painel", "Resumo, quem está devendo, situação mês a mês e, recolhidas, as análises extras.", [
    "Resumo: o total recebido, quanto veio de taxa fixa e de royalties, o saldo devedor total e quantas unidades estão inadimplentes. As bolinhas são as unidades com cobrança: as vermelhas devem; clique numa para abrir o detalhe.",
    "Quem está devendo: o saldo devedor de cada unidade, do maior para o menor, com a porcentagem de cada uma no total e a frase das três maiores. Dá para exportar a lista em CSV.",
    "Situação de pagamento mês a mês: uma linha por unidade, com o que a planilha de controle marca em cada mês (pago, não pago, ainda não devido). Mostra os últimos 12 meses; um botão abaixo da tabela abre o período inteiro.",
    "Mais análises (fechado, clique para abrir): Royalties por unidade, com as linhas de cada unidade de royalties. Um círculo vazado marca mês sem pagamento ou queda abaixo de metade da média dos três meses anteriores, e o losango marca o primeiro royalty de uma unidade que abriu depois do início da série. Onde não há valor esperado informado, uma queda forte é um possível rateio e um pico é um possível dividendo: é só uma marcação, não muda totais nem saldos. Os alertas mostram os 5 mais recentes. Esperado e recebido: para as unidades com valor esperado informado, o quanto devia entrar e o quanto entrou em cada mês. O saldo devedor de royalties vem só dessas unidades.",
  ], { tela: "royalties", atualizadoEm: "2026-11-20" }),
  a("royalties", "royalties-detalhe", "O detalhe de uma unidade", "Clique numa unidade para ver a cobrança, os meses sem recebimento e a observação.", [
    "Em qualquer painel, clicar no nome de uma unidade abre um painel ao lado, com o saldo devedor, quanto foi recebido do que era devido, os dados da cobrança (valor mensal, início, vencimento, último pagamento), os meses sem recebimento, o mês a mês e a observação da planilha. Para fechar, use o botão Fechar, a tecla Esc ou clique fora.",
    "Quando uma unidade não tem cobrança, o painel diz isso e mostra só o que ela já pagou. Quando é de royalties sem valor esperado informado, o saldo aparece como não calculado.",
  ], { tela: "royalties", atualizadoEm: "2026-11-20" }),

  // Qualidade (só quem vê o menu)
  a("qualidade", "qualidade-o-que-e", "O que é o menu Qualidade", "Checklists da franqueadora e as visitas às unidades, com nota e fotos.", [
    "A franqueadora monta os checklists (listas de itens como limpeza, uniforme e equipamentos) e registra cada visita a uma unidade: para cada item, marca conforme, não conforme ou não se aplica, comenta e fotografa. O Atlas calcula a nota da visita e a nota média de cada unidade.",
    "Quem vê e aplica os checklists (registra visitas): o dono e todo Master. Quem edita (cria e muda checklists, apaga visitas) é o dono e quem ele liberar na tela Usuários. A tela é conferida no servidor a cada abertura. As fotos ficam guardadas de forma privada e só aparecem para quem tem acesso ao menu; evite fotografar alunos.",
    "São duas rotinas separadas. A visita da franqueadora (Roteiro de visitação) tem nota e entra no ranking. O checklist da unidade (como o de abertura) é preenchido pela própria unidade pelo celular, com fotos, e serve só para acompanhar a rotina: a franqueadora não aprova nem reprova, e ele não entra na nota nem no ranking.",
    "A aba Agenda guarda as visitas marcadas: quem edita escolhe a unidade, o dia e o checklist (e, se quiser, quem vai e uma observação). Cada visita aparece como agendada, é hoje, atrasada ou feita; ela conta como feita quando a unidade recebe a visita com aquele checklist na data marcada ou depois. O Atlas também lembra as unidades sem visita há mais de 60 dias e sem nada agendado. O Master vê a agenda, mas só quem edita marca e tira visitas.",
  ], { tela: "qualidade", atualizadoEm: "2026-11-20" }),
  a("qualidade", "qualidade-como-usar", "Como usar e como a nota é calculada", "Checklists, nova visita, check-in, nota e foto.", [
    "Checklists: crie o seu ou use o roteiro sugerido, baseado no questionário de visitação que a rede já usava. Cada item tem um tipo (conforme ou não; lista de equipamentos parados, com um registro por equipamento; ou data de vencimento de um certificado), um grupo e a regra da foto (opcional, obrigatória se não conforme ou sempre obrigatória). Cada item pode ter um Como avaliar (até 600 caracteres): uma orientação curta do que observar e do que conta como conforme, que aparece num ícone ao lado da pergunta, na visita e no checklist da unidade. Os roteiros sugeridos já trazem o texto de cada item. Dá para colar vários itens de uma vez, um por linha. Itens por unidade: cada item vale, por padrão, para todas as unidades. Em Vale para, na linha do item, ou em Ajustar por unidade, desmarque as unidades em que ele não existe (ex.: área de lutas). O item que não vale para a unidade não é perguntado na visita nem no checklist dela e não conta na nota; unidade nova já recebe todos os itens.",
    "Nova visita: escolha a unidade e o checklist e faça o check-in: o Atlas registra o horário (do servidor, ninguém digita) e, se a pessoa permitir no navegador, a localização do aparelho; sem localização fica o horário e o endereço IP. Na visita da franqueadora o check-in também pede uma selfie tirada na unidade (o dono escolhe, em cada checklist, se pede ou não). Responda item a item; item não conforme exige dizer o que precisa ser corrigido e, nos itens em que a foto é obrigatória, uma foto; nos demais a foto é opcional. A data da visita é sempre a de hoje, sem escolha. Ao registrar, o check-out é feito do mesmo jeito. Cada visita mostra o check-in, o check-out, a duração e a selfie (só para o dono e quem edita a qualidade) e, se o dono marcou o local da unidade, a distância e se o check-in foi fora do local. Nos itens de data de vencimento (ex.: Certificado de Regularidade PJ do CREF), a pessoa informa só a data: o Atlas marca em dia se ela é igual ou depois da data da visita, e a visão geral lista o vencimento de cada unidade, em atenção quando faltam 60 dias ou menos. A observação geral é opcional.",
    "Checklist da unidade: na aba Checklists, use o checklist de abertura sugerido (ou crie um com frequência diária, semanal ou mensal) e, na tela Usuários, marque Pode preencher o checklist da unidade para quem tem acesso a unidades. A pessoa vê o menu Qualidade só com os checklists da própria unidade; o envio vale sempre para hoje. A aba Rotina das unidades mostra o último envio de cada unidade, quem está atrasado (prazo: diária 1 dia, semanal 7, mensal 31) e o que veio não conforme, com as fotos. Equipamentos parados informados pela unidade também entram no painel da visão geral.",
    "Planos de ação: na visita da franqueadora, cada item não conforme pede um plano (o que será feito, até quando e, se quiser, quem faz). A unidade vê os planos dela, faz a correção e marca como feito, dizendo o que foi feito e, se quiser, mandando fotos. O plano vai então para quem o criou, que confirma a correção (e ele conclui) ou devolve com o que ainda falta (e ele volta para a unidade). Se essa pessoa não estiver disponível, o dono também confirma. O gerente nunca confirma o próprio plano. A aba Planos de ação mostra os abertos, os aguardando confirmação (e quais são seus), os concluídos e os atrasados. Em cada checklist, no editor, o dono escolhe se ele pede plano de ação: por padrão a visita da franqueadora pede e o checklist da unidade não.",
    "Pedidos de item novo: se faltar algo no checklist dela, a unidade descreve o que precisa ser conferido em Pedir um item novo. O pedido chega para o dono, na aba Pedidos, que aprova (o item entra no checklist, só para aquela unidade ou para todas, com o grupo e a regra da foto que ele escolher) ou recusa com uma resposta. A unidade vê a resposta na própria tela.",
    "Nota: é a porcentagem dos pontos conseguidos entre os itens que se aplicam, considerando a importância de cada item (definida pelo dono); os não se aplica ficam fora. Na visão geral, a nota de cada unidade é a média das visitas dos últimos 90 dias, verde a partir de 90%, amarelo a partir de 75% e vermelho abaixo. Uma unidade sem visita há mais de 60 dias aparece como pendente.",
  ], { tela: "qualidade", atualizadoEm: "2026-11-20" }),

  // Gerador de escalas (só quem vê o menu)
  a("documentos", "documentos-o-que-e", "O que é o menu Documentos", "Os arquivos de cada unidade, em pastas.", [
    "O menu Documentos guarda os papéis de cada unidade: contrato social, contrato de locação, alvarás, licenças e o que mais fizer sentido. Se você acompanha mais de uma unidade, escolha a unidade primeiro.",
    "Quem vê: o dono e o Master veem os documentos de todas as unidades. Quem tem acesso a unidades vê só as suas, e só se tiver a liberação de acessar documentos. Quem vê também pode enviar, baixar e criar pastas. Para apagar um arquivo ou uma pasta, fale com o dono do Atlas.",
  ], { tela: "documentos", atualizadoEm: "2026-11-25" }),
  a("documentos", "documentos-como-enviar", "Como enviar e organizar", "Pastas, tipos de arquivo e limites de tamanho.", [
    "Abra a unidade, entre na pasta (ou crie uma com Nova pasta; dá para ter pasta dentro de pasta, até três níveis) e toque em Enviar arquivo. Você pode escolher vários de uma vez.",
    "Entram PDF, imagem (JPG ou PNG), Word (.docx) e Excel (.xlsx), até 4 MB cada. Cada unidade tem 50 MB no total. Se um PDF digitalizado passar do limite, salve-o de novo com resolução menor ou use a opção de reduzir o tamanho do arquivo.",
    "O olho abre PDF e imagem na própria tela; a seta baixa o arquivo. No celular, se o PDF não aparecer na janela, use Baixar. Não guarde documentos de alunos aqui.",
  ], { tela: "documentos", atualizadoEm: "2026-11-25" }),
  a("escalas", "escalas-o-que-e", "O que é o Gerador de escalas", "A escala 5x2 mensal da equipe de cada unidade, dentro do Atlas.", [
    "O Gerador de escalas monta a escala do mês da equipe de cada unidade, em duas coordenações: a Administrativa (Recepção e Serviços Gerais) e a Técnica (Professores e Estagiários). O sistema distribui folgas e turnos no 5x2 (cinco dias de trabalho e duas folgas por semana), confere jornada, descanso e cobertura e mostra os conflitos antes de você confirmar.",
    "Quem usa: o dono e todo Master. Quem tem acesso só a algumas unidades usa se o dono liberar na tela Usuários, e vê apenas as unidades dele. O campo Unidade, no alto da tela, escolhe a unidade; o sino ao lado mostra os avisos (escalas atrasadas, conflitos e alterações de outra pessoa).",
    "As abas: Escalas (criar, abrir, baixar o PDF e os modelos), Equipe e regras da unidade, Relatório do mês e Painel da rede (só dono e Master). As escalas e as equipes que estavam no site antigo do gerador foram trazidas para cá. Os nomes dos colaboradores ficam guardados com acesso protegido: cada pessoa vê só as unidades dela.",
  ], { tela: "escalas", atualizadoEm: "2026-11-25" }),
  a("escalas", "escalas-como-montar", "Como montar a escala do mês", "Criar a escala, gerar, ajustar e confirmar a versão final.", [
    "Criar: na aba Escalas, clique em Criar escala e escolha a coordenação, o mês e o ano. Em Começar com, use as pessoas e as regras do cadastro da unidade, um modelo pronto ou a escala livre. Os feriados nacionais entram sozinhos. Se já existe a escala daquele mês, o sistema abre a que existe.",
    "Os quatro passos: Equipe (as pessoas e os horários, vindos do cadastro da unidade), Mês (regras do mês, como turnos de fim de semana e dias sem folga), Ausências (férias e dias em que alguém não pode trabalhar) e Escala. Para gerar, marque que os parâmetros de jornada foram validados pelo sócio-operador da unidade e clique em Gerar escala.",
    "Depois de gerada, a tela diz se a escala está sem conflitos obrigatórios ou quantos conflitos faltam resolver; com conflito obrigatório não dá para confirmar. Ver avisos mostra o que merece atenção sem impedir a confirmação. Clique numa célula para trocar o dia ou o horário de uma pessoa. Em Mais ações há Trocar folga, Regerar escala, Gerar meses seguintes, PDF individual e Exportar Excel.",
    "Quando estiver certa, clique em Confirmar versão final. O botão Histórico mostra as versões da escala (criada, gerada, confirmada, restaurada e as edições) e deixa voltar a uma versão antiga, que fica registrada como restaurada. Cada escala mostra quem a elaborou e quem alterou por último.",
  ], { tela: "escalas", atualizadoEm: "2026-11-25" }),
  a("escalas", "escalas-livre", "Escala livre", "Montar à mão, sem regras; só o limite de horas por semana.", [
    "A escala livre é para quando as regras do 5x2 não servem. Você a escolhe pelo card Escala livre, em Modelos de escala, ou em Criar escala, no campo Começar com. As pessoas e os horários vêm do cadastro da unidade.",
    "O sistema só monta a grade, com todos trabalhando de segunda a sexta no horário cadastrado e folgando no fim de semana. Daí você troca qualquer dia e qualquer horário. Não há mínimo de pessoas, regra de folga, turno pronto, descanso entre jornadas nem feriado como regra.",
    "A única trava é o limite de horas por semana: 42 horas para cada pessoa e 30 horas para estagiários (Lei do Estágio). Passou do limite, a escala fica com conflito obrigatório e não dá para confirmar a versão final. O PDF, o Excel e o histórico funcionam como numa escala comum.",
  ], { tela: "escalas", atualizadoEm: "2026-11-25" }),
  a("escalas", "escalas-pdf-excel", "PDF, Excel e relatório do mês", "Baixar a escala em PDF, em planilha e as horas de cada pessoa.", [
    "PDF da escala: dentro da escala, o botão Exportar escala em PDF baixa o mês. Na aba Escalas, marque vários meses (só os já gerados) e clique em Gerar PDF para baixar um único arquivo com todos. Em Mais ações, PDF individual faz a escala de cada colaborador.",
    "Excel: em Mais ações, Exportar Excel monta a planilha da escala, para quem prefere mexer fora do Atlas.",
    "Relatório do mês: mostra as horas e os dias de cada pessoa no mês escolhido, para enviar à contabilidade. Mostra só as escalas já geradas das unidades que você enxerga.",
  ], { tela: "escalas", atualizadoEm: "2026-11-25" }),
  a("escalas", "escalas-equipe-regras", "Equipe e regras da unidade e Painel da rede", "O cadastro da equipe, as regras da unidade e o prazo da rede.", [
    "Equipe e regras da unidade: o cadastro que todas as escalas da unidade usam. Pessoas (nome, departamento e horário de cada uma), Regras dos departamentos (quantas pessoas, fins de semana e coberturas) e Funcionamento (horários da unidade e feriados locais). O que você muda aqui vale para a escala em aberto e para as próximas. As regras de jornada (limites de horas e descanso) só o dono e o Master mudam.",
    "Painel da rede (dono e Master): mostra, para o mês escolhido, quais unidades já têm a escala criada, gerada ou confirmada e quais estão com conflito ou atrasadas. O prazo da rede é o dia do mês anterior até o qual a escala precisa estar confirmada; só o dono e o Master mudam esse dia, e o sino avisa as unidades quando o prazo passa.",
  ], { tela: "escalas", atualizadoEm: "2026-11-25" }),

  // Jurídico (só quem vê o menu)
  a("juridico", "juridico-o-que-e", "O que é a aba Jurídico", "Os processos judiciais e extrajudiciais da rede, vindos da planilha do jurídico.", [
    "Mostra os processos que o escritório jurídico acompanha: quantos são, quanto está em causa, em que empresa e órgão (tribunal, Procon, Ministério Público) estão e quais estão sem andamento. Os dados vêm da planilha que o jurídico manda todo mês e o Atlas lê todo dia.",
    "O nome da parte contrária (em geral um aluno ou ex-colaborador) e os textos livres do processo (objeto e último andamento) não entram no Atlas: ele guarda só o número, a empresa, o órgão, o tipo, o polo, o valor, o status e a data da última movimentação.",
    "Quem vê: o dono e todo Master (só consulta). Quem tem acesso só a algumas unidades vê se o dono liberar na tela Usuários. A tela é conferida no servidor a cada abertura.",
  ], { tela: "juridico", atualizadoEm: "2026-11-20" }),
  a("juridico", "juridico-como-ler", "Como ler a tela", "Cartões, rankings e a lista de processos.", [
    "Filtros do topo: situação (ativos, arquivados ou todos), natureza (judicial ou extrajudicial) e empresa. Valem para tudo na tela. As empresas são as razões sociais da planilha, não as unidades do Atlas.",
    "Cartões: Processos (e quantos estão arquivados), Valor em causa (soma do valor da causa; processos sigilosos ou sem valor ficam de fora da soma e aparecem no aviso), Como réu, Judiciais (e quantos são extrajudiciais) e Sem andamento, que conta os processos ativos com a última movimentação há mais de 60 dias ou sem data.",
    "Por empresa, Por órgão e Por tipo de ação: do que tem mais valor em causa para o que tem menos; a barra é a quantidade de processos. A lista de baixo traz cada processo e pode ser ordenada por maior valor, mais tempo sem andamento ou movimentados há pouco. A data em vermelho é de processo sem andamento.",
  ], { tela: "juridico", atualizadoEm: "2026-11-20" }),
  // Só o dono
  a("dono", "dono-usuarios", "Usuários e níveis de acesso", "Criar acessos, níveis e o resumo por e-mail.", [
    "Em Usuários você cria acessos de Dono, Master ou Unidades (uma ou mais). A senha provisória vai por e-mail e a pessoa escolhe a própria no primeiro acesso.",
    "Você pode liberar um Master para gerenciar acessos, liberar o menu Relatórios (Pode gerar relatórios) para qualquer Master ou gestor de unidades e ligar ou desligar o resumo diário de cada pessoa.",
    "Clique no nome de um usuário para ver o último acesso e as telas que ele abriu.",
  ], { tela: "acessos", atualizadoEm: "2026-11-17" }),
  a("dono", "dono-fichas-unidades", "Ficha da unidade: aluguel e fim do contrato", "Onde informar o aluguel de cada unidade e o que o Atlas calcula.", [
    "A aba Unidades, no menu Franqueadora, é só sua. Cada unidade em operação tem um card com o modelo, o m² e a abertura (vêm das premissas dos Estudos de ponto, só para leitura) e com o que você informa aqui: o aluguel mensal, a data em que o contrato de locação termina e observações.",
    "Com o aluguel, o card calcula o aluguel por m² (aluguel mensal dividido pelo m² da unidade) e a parte das vendas mensais que ele representa (média dos últimos meses fechados). Contrato que vence em até 6 meses, ou já vencido, aparece em vermelho.",
    "No alto da tela, quantas unidades já têm o aluguel levantado e, por modelo, a mediana, o menor e o maior valor por m². A mediana é o número que corrige o aluguel real no payback dos Estudos de ponto; o Atlas só a usa nas contas depois de você confirmar o valor, e nada é gravado nas premissas sozinho.",
    "Aluguel é dado comercial: fica guardado só no Atlas, com acesso do dono, e não vai para o repositório. Os cards das unidades sem aluguel levantado aparecem primeiro.",
  ], { tela: "franqueadora/unidades", atualizadoEm: "2026-11-26" }),
  a("dono", "dono-unidades-em-obra", "Unidades em obra: como cadastrar e acompanhar", "Marcos, atrasos e quem pode ver.", [
    "O menu Unidades em obra acompanha as unidades em construção até a inauguração. Só você cadastra e muda as obras; quem você liberar em Usuários (Pode ver unidades em obra) consulta.",
    "Nova obra: informe a unidade, a cidade, o modelo, a área e o responsável. A obra já nasce com oito marcos: contrato do ponto assinado, projeto aprovado, alvará, início da obra, fim da obra, equipamentos instalados, vistoria da franqueadora e inauguração. Dá para renomear, apagar e acrescentar marcos, e a ordem da lista é a ordem da obra.",
    "Cada marco tem a data prevista e, quando acontece, a data real (o botão Hoje preenche a de hoje). A obra fica Atrasada quando algum marco passou da data prevista sem data real; sem data prevista, o marco não conta como atraso. A inauguração prevista é a data do último marco.",
    "No alto da tela: obras em andamento, atrasadas, as que inauguram em até 90 dias e as já inauguradas. Os cards mostram as atrasadas primeiro. As obras ficam guardadas só no Atlas, com acesso protegido.",
    "Mapa da rede: para a obra aparecer no mapa dos Estudos de ponto (botão Mapa da rede), informe o endereço e clique em Achar no mapa na janela da obra. A obra aparece com um pino laranja, ao lado dos pontos em estudo (em análise e aprovados) e das unidades em operação; os botões no alto do mapa escondem cada grupo. Obra sem posição não aparece no mapa, e obra já inaugurada sai dele.",
  ], { tela: "unidades-em-obra", atualizadoEm: "2026-11-25" }),
  a("dono", "dono-royalties", "Royalties: quem vê e como atualiza", "O menu é seu, de todo Master e de quem você liberar.", [
    "A aba Royalties, no menu Franqueadora, aparece para você e para todo Master. Quem tem acesso só a unidades não vê, a não ser que você marque Pode ver royalties no acesso dele, em Usuários. Só você dá ou tira essa liberação: um Master que gerencia acessos não consegue. Em Ver como acesso de unidades, o menu some, como sumiria para a pessoa.",
    "Os dados vêm da planilha de controle dos recebimentos da marca e são atualizados todo dia de manhã. Se a leitura da planilha falhar ou as conferências não fecharem, o menu continua com a última versão boa e avisa no topo.",
    "A ajuda e as novidades sobre Royalties só aparecem para quem vê o menu; quem não tem acesso não encontra nenhum texto sobre ele.",
  ], { tela: "acessos", atualizadoEm: "2026-11-20" }),
  a("dono", "dono-relatorios", "Relatórios: quem gera e o que fica registrado", "Permissão, registro e rodapé dos arquivos gerados.", [
    "O uso do menu Relatórios (período, unidades, indicadores e o que vem em cada slide) está no artigo Relatórios, em As telas do Atlas, o mesmo que os outros usuários leem. Aqui ficam só os controles que são seus.",
    "Você e todo Master veem o menu. Para quem tem acesso só a unidades ver, marque Pode gerar relatórios ao criar ou editar o acesso dela em Usuários. Só você dá ou tira essa permissão; quem gerencia acessos não consegue.",
    "Cada arquivo gerado aparece no registro de atividades, com quem gerou, o mês e a unidade (quando é uma só). O rodapé de cada slide leva o e-mail de quem gerou e a data. No Ver como, o menu continua aparecendo, com os dados do nível simulado.",
    "Os textos de análise, as avaliações dos clientes e as ações por unidade continuam sendo escritos à mão no PowerPoint.",
  ], { tela: "relatorios", atualizadoEm: "2026-11-17" }),
  a("dono", "dono-qualidade", "Qualidade: pesos, permissões e o local das unidades", "O que só você controla no menu Qualidade.", [
    "O peso de cada item (de 1 a 5) é só seu: nem Master nem quem você libera o vê ou o altera. Um item de peso maior pesa mais na nota. Quem edita um checklist sem ser você não manda os pesos: os itens que já existiam mantêm o peso guardado e os novos começam em 1, para você ajustar depois. O servidor nem envia o peso a quem não é o dono.",
    "Todo Master vê o menu Qualidade e aplica os checklists (registra visitas); o Jurídico, os Royalties e os Relatórios ele vê só para consulta. Para ele ou para outra pessoa criar e editar checklists, marque Pode editar a qualidade em Usuários. Quem tem acesso só a unidades preenche o checklist da própria unidade com Pode preencher o checklist da unidade. A aba Pedidos, onde você aprova ou recusa os itens que as unidades pedem, e o Local das unidades são só seus.",
    "Local das unidades: em Checklists, abra Local das unidades e marque onde cada unidade fica (use Usar onde estou, de dentro da unidade, ou cole as coordenadas do Google Maps). Com isso, cada check-in mostra a distância até a unidade e avisa quando foi fora do raio (padrão 300 metros, descontada a precisão do aparelho). Sem a localização do aparelho, o registro fica só com o horário e o IP, e não dá para dizer onde a pessoa estava. A selfie do check-in é reduzida no aparelho (uns 30 a 60 KB), só você e quem edita a qualidade a veem, e é apagada depois de 3 meses; em cada checklist, no editor, você escolhe se ele pede selfie.",
  ], { atualizadoEm: "2026-11-20" }),
  a("dono", "dono-ver-como", "Ver como", "Olhar o Atlas como um Master, como uma unidade ou como uma pessoa específica.", [
    "O botão Ver como, no cabeçalho, mostra o Atlas exatamente como outro nível vê. Vale só na aba do navegador em que foi ligado.",
    "Enquanto estiver vendo como outro nível, o que é só seu (como esta seção) some da tela. O menu Relatórios continua aparecendo, com os dados do nível simulado, para você testar o que a pessoa receberia.",
    "Ver como Master ou como uma unidade simula só o nível, sem as liberações de cada pessoa (royalties, jurídico, qualidade, checklist da unidade): esses menus ficam fechados. Para ver exatamente o que uma pessoa vê, com as liberações dela, escolha Uma pessoa no Ver como e depois o nome. Nesse modo é só consulta: nada é gravado em nome dela (enviar checklist, trocar senha e mexer em acessos são recusados), e o seu acesso não aparece no registro de atividades.",
  ], { atualizadoEm: "2026-11-20" }),
  a("dono", "dono-uso-do-plano", "Quem está usando o plano", "Ranking do mês e uso do Plano de ação por unidade.", [
    "No Plano de ação, com a rede selecionada, o quadro tem duas visões. \"Uso por unidade\" mostra quantos itens cada unidade marcou como feitos no mês e quando foi a última marcação; as que nunca marcaram aparecem primeiro.",
    "\"Ranking do mês\" mede quanto do plano cada unidade resolveu: itens marcados como feitos cujo alerta saiu da leitura do EVO, sobre o total de itens (resolvidos mais pendentes). Vale a proporção, não a quantidade, para a unidade com poucos problemas não ficar atrás da que tem muitos.",
    "Marcado como feito com o alerta ainda no EVO fica \"aguardando o EVO\" até a leitura seguinte; se o alerta continuar, volta a pendente. Item que sumiu sem ninguém marcar não conta a favor nem contra. Só entra na disputa quem teve 3 itens ou mais no mês: com menos, a unidade aparece em \"Poucos itens\". Unidade sem nenhum item aparece em \"Plano limpo\", fora da disputa e nunca abaixo de quem tem itens.",
    "O ranking recomeça todo mês. Está visível só para você, em teste por um mês (até 16/12/2026), para ver como as unidades se distribuem antes de decidir se a rede também vê.",
  ], { tela: "plano" }),
  a("dono", "dono-rotinas", "Rotinas automáticas e avisos", "O que roda sozinho e quando você é avisado.", [
    "De madrugada o Atlas lê o EVO; de manhã lê o Meta e envia o resumo por e-mail; o Instagram é lido a cada 4 horas; a lista de usuários tem backup diário. A leitura do EVO também separa os números de cada semana do mês (faturamento, pagamentos dos clientes, vendas, oportunidades e cancelamentos), que alimentam o relatório semanal.",
    "Se alguma dessas rotinas falhar ou passar do tempo, chega um e-mail só para você dizendo o que deixou de ser atualizado. A etapa que lê os alunos tem limite de 150 minutos: se o EVO estiver lento, ela falha sozinha e as outras etapas (vendas, oportunidades, cancelamentos e a atualização do painel) ainda rodam.",
  ], { atualizadoEm: "2026-11-17" }),
  a("dono", "dono-atualizar", "Atualizar da planilha", "O botão de setas no cabeçalho.", [
    "O botão de setas no cabeçalho busca de novo a planilha de metas e os números guardados, sem esperar a atualização automática.",
  ]),
  a("dono", "dono-ajuda-novidades", "Central de ajuda e novidades só para você", "O que fica fora da vista dos outros usuários.", [
    "Artigos e novidades sobre controles seus (usuários, atividade, uso do plano, avisos de rotinas) só aparecem para você. Os outros usuários veem só o uso das telas.",
  ]),
];

/** Glossário: o mesmo texto do botão "i" de cada card (uma fonte só). */
const INDICADORES: ArtigoAjuda[] = Object.entries(AJUDA)
  .filter(([nome]) => nome !== "Conversão de cadastros")
  .map(([nome, texto]) => a("indicadores", `indicador-${nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`, nome, texto.split(". ")[0] + ".", [texto]));

export const ARTIGOS: ArtigoAjuda[] = [...ARTIGOS_ESCRITOS, ...INDICADORES];

export const artigosPara = (dono: boolean, lista: ArtigoAjuda[] = ARTIGOS, royalties: boolean = dono, juridico: boolean = dono, qualidade: boolean = dono, escalas: boolean = dono, documentos: boolean = dono) => lista.filter((x) => publicoVe(x.publico, dono, royalties, juridico, qualidade, escalas, documentos));
export const secoesPara = (dono: boolean, royalties: boolean = dono, juridico: boolean = dono, qualidade: boolean = dono, escalas: boolean = dono, documentos: boolean = dono) => SECOES.filter((s) => publicoVe(s.publico, dono, royalties, juridico, qualidade, escalas, documentos));

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
