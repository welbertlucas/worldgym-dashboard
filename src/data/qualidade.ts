// Qualidade: tipos e cálculos da tela (checklists da franqueadora e visitas às unidades).

export type Frequencia = "visita" | "diaria" | "semanal" | "mensal";
export const FREQUENCIA_ROTULO: Record<Frequencia, string> = { visita: "Na visita da franqueadora", diaria: "Diária (a unidade preenche)", semanal: "Semanal (a unidade preenche)", mensal: "Mensal (a unidade preenche)" };

export type PedeFoto = "nenhuma" | "nao_conforme" | "sempre";
export const FOTO_ROTULO: Record<PedeFoto, string> = { nenhuma: "Foto opcional", nao_conforme: "Obrigatória se não conforme", sempre: "Sempre obrigatória" };
export type TipoItem = "conforme" | "equipamentos" | "vencimento";
export const TIPO_ROTULO: Record<TipoItem, string> = { conforme: "Conforme ou não", equipamentos: "Lista de equipamentos parados", vencimento: "Data de vencimento (certificado)" };
export interface ItemModelo { id: string; grupo: string; texto: string; peso: number; foto: PedeFoto; tipo?: TipoItem; /** "Como avaliar": orientação curta de como julgar o item (aparece num ícone de informação na visita e no checklist da unidade). */ instrucao?: string; /** Unidades em que o item não vale (vale para todas as outras). */ foraDe?: string[]; /** Unidades em que o item SÓ vale (o item que a unidade pediu e o dono liberou só para ela). */ soEm?: string[] }
/** Itens do checklist que valem para a unidade (os marcados como "não vale" para ela ficam de fora). */
export const itensDaUnidade = (itens: ItemModelo[], unidade: string): ItemModelo[] => itens.filter((i) => !(i.foraDe ?? []).includes(unidade) && (!(i.soEm ?? []).length || i.soEm!.includes(unidade)));
export interface EquipamentoParado { codigo: string; descricao: string; fotos: string[] }
export interface ModeloChecklist { id: string; nome: string; descricao: string; frequencia: Frequencia; itens: ItemModelo[]; ativo: boolean; /** Pede selfie no check-in; sem o campo, só a visita da franqueadora pede. */ selfie?: boolean; plano?: boolean; atualizadoEm: string }
/** O checklist pede uma selfie no check-in? Por padrão a visita da franqueadora pede e o checklist da unidade não. */
/** Pede plano de ação no item não conforme; sem o campo, só a visita da franqueadora pede. */
export const exigePlano = (m: Pick<ModeloChecklist, "plano" | "frequencia">) => (typeof m.plano === "boolean" ? m.plano : m.frequencia === "visita");
export const pedeSelfie = (m: Pick<ModeloChecklist, "selfie" | "frequencia">) => (typeof m.selfie === "boolean" ? m.selfie : m.frequencia === "visita");
export interface RespostaVisita { itemId: string; grupo: string; texto: string; peso?: number; tipo?: TipoItem; conforme: boolean | null; comentario: string; fotos: string[]; equipamentos?: EquipamentoParado[]; /** AAAA-MM-DD, nos itens de vencimento. */ vencimento?: string }
/** Check-in ou check-out: horário do servidor, localização do aparelho (se a pessoa permitiu), IP e a distância até o local marcado da unidade. */
export interface MarcaDeLocal { em: string; loc: { lat: number; lng: number; precisao: number } | null; ip: string; distanciaM?: number; foraDoLocal?: boolean; /** Selfie tirada no check-in ("AAAA-MM_uuid"); guardada por poucos meses. */ selfie?: string }
export interface LocalUnidade { lat: number; lng: number; raio: number }
export interface Visita {
  /** "unidade" nos envios do checklist da própria unidade. */ origem?: "unidade";
  /** Check-in e check-out (horário do servidor, localização e IP, e a selfie no check-in), com a duração. */
  checkin?: MarcaDeLocal; checkout?: MarcaDeLocal; duracaoMin?: number; assinatura?: { nome: string; cargo: string; foto: string };
  id: string; modeloId: string; modeloNome: string; unidade: string; data: string; mes: string;
  /** Nota de cada grupo de itens (calculada no servidor, que conhece os pesos). */ notasPorGrupo?: Record<string, number | null>; avaliador: { nome: string; email: string }; chegada?: string; saida?: string; respostas: RespostaVisita[]; observacao: string; nota: number | null; criadoEm: string;
}
/** `modo` "completo": dono e liberados (checklists, visitas, notas e o que as unidades enviam); "unidade": só preencher o checklist da própria unidade. */
/** Pedido de item novo: a unidade descreve o que falta no checklist dela e o dono aprova (o item entra no checklist) ou recusa (com uma resposta). */
/** Nota da visita, ou só a do grupo de itens escolhido (null quando a visita não tem o grupo ou nenhum item dele foi respondido). */
export const notaFiltrada = (v: Visita, grupo: string): number | null => (grupo ? v.notasPorGrupo?.[grupo] ?? null : v.nota);
export const avaliadoresDasVisitas = (visitas: Visita[]): string[] => [...new Set(visitas.map((v) => v.avaliador.nome).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
export const gruposDasVisitas = (visitas: Visita[]): string[] => [...new Set(visitas.flatMap((v) => Object.keys(v.notasPorGrupo ?? {})))].sort((a, b) => a.localeCompare(b, "pt-BR"));
export interface PontoEvolucao { mes: string; nota: number; visitas: number }
/** Média mensal da nota das visitas (ou do grupo escolhido), em ordem de mês; meses sem nota ficam de fora. */
export function evolucaoDaNota(visitas: Visita[], grupo = ""): PontoEvolucao[] {
  const por = new Map<string, number[]>();
  for (const v of visitas) { const n = notaFiltrada(v, grupo); if (n !== null) por.set(v.mes, [...(por.get(v.mes) ?? []), n]); }
  return [...por.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, ns]) => ({ mes, nota: Math.round((ns.reduce((t, n) => t + n, 0) / ns.length) * 10) / 10, visitas: ns.length }));
}
export interface PedidoItem {
  id: string; unidade: string; modeloId: string; modeloNome: string; texto: string; motivo: string;
  solicitante: { nome: string; email: string }; status: "pendente" | "aprovado" | "recusado"; criadoEm: string;
  decisao?: { por: string; em: string; resposta: string; escopo?: "unidade" | "todas"; itemId?: string };
}
export const pedidosPendentes = (ps: PedidoItem[] | undefined) => (ps ?? []).filter((p) => p.status === "pendente");
/** Plano de ação criado na visita para um item não conforme: a unidade corrige e marca como feito; quem criou o plano confirma (ou devolve). */
export interface PlanoAcao {
  id: string; unidade: string; visitaId: string; visitaMes: string; itemId: string; itemTexto: string; modeloNome: string;
  oQue: string; prazo: string; responsavel: string; como: string; criadoPor: { nome: string; email: string }; criadoEm: string;
  status: "aberto" | "validacao" | "concluido"; concluidoEm?: string;
  historico: { em: string; por: { nome: string; email: string }; acao: "criado" | "feito" | "devolvido" | "confirmado"; texto: string; fotos: string[] }[];
}
export const planoAtrasado = (p: PlanoAcao, hoje: string) => p.status === "aberto" && p.prazo < hoje;
/** Quem confirma a correção: quem criou o plano ou o dono. */
export const podeValidarPlano = (p: PlanoAcao, email: string, dono: boolean) => p.status === "validacao" && (dono || p.criadoPor.email === email);
export interface DadosQualidade { modo?: "completo" | "unidade"; /** Visitas agendadas (só o menu completo). */ agenda?: AgendaVisita[]; unidades: string[]; modelos: ModeloChecklist[]; visitas: Visita[]; /** Envios dos checklists que a própria unidade preenche (não entram na nota). */ envios?: Visita[]; /** Pedidos de item novo (o dono vê todos; a unidade, os dela). */ pedidos?: PedidoItem[]; /** Planos de ação (a franqueadora vê todos; a unidade, os dela). */ planos?: PlanoAcao[]; /** Onde cada unidade fica (marcado pelo dono), para conferir o local dos check-ins. */ locais?: Record<string, LocalUnidade> }

/** Faixas da nota (% de itens conformes) usadas nas cores. Combinadas como ponto de partida: mudar só com o dono. */
export const NOTA_BOA = 90;
export const NOTA_ATENCAO = 75;
/** Unidade sem nenhuma visita há mais que isso aparece como pendente. */
export const DIAS_SEM_VISITA = 60;
/** Janela da nota média de cada unidade. */
export const DIAS_DA_MEDIA = 90;

export const tomDaNota = (n: number | null): "good" | "warn" | "bad" | "neutral" => (n === null ? "neutral" : n >= NOTA_BOA ? "good" : n >= NOTA_ATENCAO ? "warn" : "bad");
export const pctTexto = (n: number | null) => (n === null ? "—" : `${n.toFixed(1).replace(".", ",").replace(/,0$/, "")}%`);
export const dataBR = (d: string) => d.split("-").reverse().join("/");

const dias = (de: string, ate: string) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86400000);

export interface LinhaUnidade { unidade: string; ultima: Visita | null; media: number | null; visitas: number; diasSemVisita: number | null }
/** Uma linha por unidade da rede: nota média dos últimos 90 dias, última visita e quanto tempo sem visita. Quem tem nota vem primeiro (maior para menor), depois as sem visita. */
export function resumoPorUnidade(visitas: Visita[], unidades: string[], hoje: string): LinhaUnidade[] {
  const linhas = unidades.map((unidade) => {
    const dela = visitas.filter((v) => v.unidade === unidade).sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm));
    const recentes = dela.filter((v) => v.nota !== null && dias(v.data, hoje) <= DIAS_DA_MEDIA);
    const media = recentes.length ? Math.round((recentes.reduce((t, v) => t + (v.nota as number), 0) / recentes.length) * 10) / 10 : null;
    return { unidade, ultima: dela[0] ?? null, media, visitas: dela.length, diasSemVisita: dela[0] ? Math.max(0, dias(dela[0].data, hoje)) : null };
  });
  return linhas.sort((a, b) => (b.media ?? -1) - (a.media ?? -1) || (b.ultima ? 1 : 0) - (a.ultima ? 1 : 0) || a.unidade.localeCompare(b.unidade, "pt-BR"));
}

export interface ItemFalho { modelo: string; texto: string; falhas: number; respondidas: number; unidades: number }
/** Itens que mais deram "não conforme" nos últimos 90 dias (só os que falharam ao menos uma vez), do mais frequente para o menos. */
export function itensQueMaisFalham(visitas: Visita[], hoje: string): ItemFalho[] {
  const m = new Map<string, ItemFalho & { u: Set<string> }>();
  for (const v of visitas) {
    if (dias(v.data, hoje) > DIAS_DA_MEDIA) continue;
    for (const r of v.respostas) {
      if (r.conforme === null) continue;
      const k = `${v.modeloNome}|${r.texto}`;
      const g = m.get(k) ?? { modelo: v.modeloNome, texto: r.texto, falhas: 0, respondidas: 0, unidades: 0, u: new Set<string>() };
      g.respondidas += 1;
      if (!r.conforme) { g.falhas += 1; g.u.add(v.unidade); }
      m.set(k, g);
    }
  }
  return [...m.values()].filter((g) => g.falhas > 0).map(({ u, ...g }) => ({ ...g, unidades: u.size })).sort((a, b) => b.falhas / b.respondidas - a.falhas / a.respondidas || b.falhas - a.falhas).slice(0, 10);
}

export interface ResumoRede { notaMedia: number | null; visitasNoMes: number; semVisita: number; naoConformes: number }
export function resumoDaRede(visitas: Visita[], unidades: string[], hoje: string): ResumoRede {
  const linhas = resumoPorUnidade(visitas, unidades, hoje);
  const comNota = linhas.filter((l) => l.media !== null);
  return {
    notaMedia: comNota.length ? Math.round((comNota.reduce((t, l) => t + (l.media as number), 0) / comNota.length) * 10) / 10 : null,
    visitasNoMes: visitas.filter((v) => v.mes === hoje.slice(0, 7)).length,
    semVisita: linhas.filter((l) => l.diasSemVisita === null || l.diasSemVisita > DIAS_SEM_VISITA).length,
    naoConformes: visitas.filter((v) => dias(v.data, hoje) <= DIAS_DA_MEDIA).reduce((t, v) => t + v.respostas.filter((r) => r.conforme === false).length, 0),
  };
}

/** Roteiro sugerido, baseado no questionário de visitação que a rede já usa, com os pontos fracos dele corrigidos: critério verificável em cada item,
 *  pergunta sempre no sentido "está certo?" (Sim = conforme), peso maior nos itens críticos (segurança e documentos 3; equipamentos e banheiros 2) e foto obrigatória quando não conforme só nos itens importantes (peso 2 ou 3). */
// Foto obrigatória (quando não conforme) só nos itens importantes, os de peso 2 ou 3; nos demais ela é opcional.
const it = (grupo: string, texto: string, peso = 1, tipo: TipoItem = "conforme", instrucao = ""): Omit<ItemModelo, "id"> => ({ grupo, texto, peso, foto: peso > 1 ? "nao_conforme" : "nenhuma", tipo, ...(instrucao ? { instrucao } : {}) });
export const MODELO_SUGERIDO: { nome: string; descricao: string; frequencia: Frequencia; itens: Omit<ItemModelo, "id">[] } = {
  nome: "Roteiro de visitação às unidades",
  descricao: "Limpeza, organização, uniforme, quadro de colaboradores, estrutura física, segurança e equipamentos. Item não conforme pede a correção; nos itens importantes, também uma foto.",
  frequencia: "visita",
  itens: [
    it("Equipamentos", "Todos os equipamentos de ginástica estão em operação, sem aviso de manutenção? (Se não, registre cada equipamento parado com código e foto.)", 2, "equipamentos", "Percorra o salão. Conta como parado: equipamento desligado, quebrado, interditado ou com aviso de manutenção. Se houver, marque Não e registre o código de cada um (etiqueta no equipamento) com foto."),
    it("Segurança e documentos", "Extintores dentro da validade, saídas de emergência desobstruídas e kit de primeiros socorros (e desfibrilador, se a unidade tiver) disponíveis?", 3, "conforme", "Confira a validade no selo de cada extintor, se as saídas de emergência estão livres (sem caixas ou equipamentos) e se o kit de primeiros socorros está acessível e completo. Desfibrilador só se a unidade tiver."),
    it("Segurança e documentos", "Há profissional de educação física (CREF) presente no salão durante o horário de funcionamento?", 3, "conforme", "Pergunte quem é o profissional de educação física de plantão e confira se ele está no salão, não só na escala. Sem profissional no salão durante o horário de funcionamento: Não."),
    it("Segurança e documentos", "Certificado de Regularidade PJ do CREF da unidade: informe a data de vencimento. Ele deve estar exposto à vista dos alunos.", 3, "vencimento", "Procure o certificado exposto à vista dos alunos (recepção ou salão) e informe a data de vencimento impressa nele. Se não estiver exposto, peça o documento à gerência e informe a data dele."),
    it("Segurança e documentos", "Alvará de funcionamento, licença dos bombeiros e dedetização estão em dia, com os comprovantes à mão?", 3, "conforme", "Peça os três comprovantes: alvará de funcionamento, licença dos bombeiros e certificado de dedetização. Todos precisam estar dentro da validade e à mão."),
    it("Equipe", "A equipe está uniformizada: camisa e calçado fechado do padrão, uniforme limpo e em bom estado?", 1, "conforme", "Observe quem está de plantão: camisa e calçado fechado do padrão, uniforme limpo e sem rasgos, sem adereços fora do padrão."),
    it("Equipe", "O registro de limpeza do dia está preenchido e atualizado, com horário e responsável?", 1, "conforme", "Peça a planilha ou o registro de limpeza do dia: deve ter horário e responsável preenchidos para as áreas já limpas no turno."),
    it("Equipe", "Quadro de colaboradores atualizado: nome, cargo e horário de cada colaborador, e o registro no CREF de cada professor?", 2, "conforme", "Peça o quadro de colaboradores e confira com a equipe do dia: todo colaborador com nome, cargo e horário; todo professor com o número do CREF. Quem saiu ainda listado, quem entrou faltando ou professor sem CREF = não conforme."),
    it("Recepção e convivência", "Entrada: piso limpo, vidros sem marcas, sem lixo?", 1, "conforme", "Piso sem lixo ou poeira, vidros e portas sem marcas de mão, capacho em bom estado e nada empilhado na entrada."),
    it("Recepção e convivência", "Recepção: balcão limpo e organizado, sem objetos pessoais à vista, piso limpo?", 1, "conforme", "Balcão limpo e organizado, sem objetos pessoais (bolsa, alimento) à vista, computador e papéis em ordem, piso limpo."),
    it("Recepção e convivência", "Área de estar: sofás e mesas limpos e organizados, sem lixo?", 1, "conforme", "Sofás e mesas limpos e arrumados, sem lixo, copos ou revistas espalhados."),
    it("Padrão da marca", "Fachada e placas no padrão da marca e em bom estado, banners e preços atualizados, mural sem papel antigo?", 1, "conforme", "Fachada e placas sem desgaste ou sujeira, banners e tabela de preços com as campanhas vigentes, mural sem avisos vencidos."),
    it("Estrutura física", "Pintura: paredes, tetos e portas sem manchas, descascados, infiltração ou mofo?", 1, "conforme", "Percorra recepção, salão, vestiários e áreas de apoio. Registre com foto onde a pintura está manchada, descascada ou com infiltração."),
    it("Estrutura física", "Móveis: sofás, cadeiras, bancadas e armários sem rasgos, quebras ou peças soltas?", 1, "conforme", "Confira estofados sem rasgos, cadeiras e bancadas firmes, portas e puxadores de armários no lugar."),
    it("Estrutura física", "Piso vinílico (e emborrachado): sem placas soltas, rasgadas, levantadas ou desgastadas?", 2, "conforme", "Ande pelo salão e pelas áreas de circulação. Placa solta ou levantada é risco de queda: registre com foto e o local."),
    it("Estrutura física", "Comunicação interna: sinalização, adesivos, quadros e avisos no padrão da marca, legíveis e atualizados?", 1, "conforme", "Placas de sinalização (salas, saídas, banheiros), adesivos de parede, quadros e avisos internos no padrão da marca, sem rasgos e sem informação vencida."),
    it("Conforto do aluno", "Climatização funcionando na temperatura adequada e sem lâmpadas queimadas nas áreas de treino?", 1, "conforme", "Ar-condicionado ligado, salão sem calor excessivo e sem lâmpadas queimadas ou piscando nas áreas de treino."),
    it("Conforto do aluno", "Bebedouros funcionando e som em volume adequado?", 1, "conforme", "Teste os bebedouros (jato e temperatura) e confira que o som está audível sem incomodar."),
    it("Conforto do aluno", "Álcool em gel ou higienizante e papel disponíveis nas áreas de treino, para o aluno limpar os equipamentos?", 1, "conforme", "Dispensers com álcool em gel ou higienizante abastecidos e papel-toalha disponível perto das áreas de treino."),
    it("Áreas de treino", "Ergometria (cardio): esteiras e bikes limpas, sem suor ou poeira, displays e assentos limpos?", 1, "conforme", "Esteiras e bikes sem suor ou poeira, displays e assentos limpos."),
    it("Áreas de treino", "Sala de musculação: equipamentos limpos, pesos nos suportes, espelhos limpos, piso livre de objetos?", 1, "conforme", "Aparelhos e bancos limpos, pesos nos suportes, espelhos sem marcas, piso livre de objetos soltos."),
    it("Áreas de treino", "Peso livre: halteres e anilhas organizados por peso, bancos limpos, nada solto no chão?", 1, "conforme", "Halteres e anilhas guardados por peso nos suportes, barras no lugar, bancos limpos, nada solto no chão."),
    it("Áreas de treino", "Atletics: área organizada, materiais guardados, piso limpo?", 1, "conforme", "Área organizada, materiais guardados nos lugares, piso limpo."),
    it("Áreas de treino", "Sala de aulas coletivas: piso e espelhos limpos, materiais organizados, som e climatização funcionando?", 1, "conforme", "Piso e espelhos limpos, tatames e materiais organizados, som e ar-condicionado funcionando."),
    it("Áreas de treino", "Área de lutas: tatame e sacos limpos, materiais organizados?", 1, "conforme", "Tatame e sacos de pancada limpos, luvas e materiais guardados, sem mau cheiro."),
    it("Banheiros e vestiários", "Banheiro feminino: piso seco, sem odor, vasos e pias limpos, com papel, sabonete e lixeira esvaziada?", 2, "conforme", "Piso seco, sem mau cheiro, vasos e pias limpos, papel higiênico, sabonete e papel-toalha disponíveis, lixeira esvaziada."),
    it("Banheiros e vestiários", "Banheiro masculino: piso seco, sem odor, vasos, pias e mictórios limpos, com papel, sabonete e lixeira esvaziada?", 2, "conforme", "Igual ao feminino, incluindo mictórios limpos."),
    it("Banheiros e vestiários", "Banheiro PNE: limpo, sem odor, barras de apoio e alarme funcionando, livre de objetos guardados?", 2, "conforme", "Limpo e sem odor, barras de apoio firmes, alarme ou campainha funcionando, sem materiais guardados dentro."),
    it("Banheiros e vestiários", "Vestiários: chuveiros funcionando, armários em ordem, secadores funcionando?", 2, "conforme", "Chuveiros com água e drenagem funcionando, armários em ordem e sem portas quebradas, secadores funcionando."),
    it("Áreas de apoio", "Sala de avaliações (se tiver): limpa, organizada e com os equipamentos de avaliação guardados?", 1, "conforme", "Se a unidade tiver a sala: limpa, com os equipamentos de avaliação (balança, adipômetro, fitas) guardados e organizados. Sem a sala: Não se aplica."),
    it("Áreas de apoio", "Sala do administrativo: organizada, sem documentos expostos, piso limpo?", 1, "conforme", "Mesa organizada, documentos e dados de alunos guardados (não expostos), piso limpo."),
    it("Áreas de apoio", "Copa: limpa, sem alimentos expostos ou louça suja, lixeira esvaziada?", 1, "conforme", "Pia e bancada limpas, sem louça suja ou alimentos expostos, geladeira organizada, lixeira esvaziada."),
    it("Áreas de apoio", "DML e depósito: produtos de limpeza identificados e organizados, fora do alcance de alunos, sem vazamento, passagem livre e sem entulho, e EPIs da limpeza disponíveis e em uso?", 1, "conforme", "Produtos de limpeza identificados, fechados e fora do alcance de alunos, sem vazamentos, passagem livre e sem entulho acumulado. Confira os EPIs da equipe de limpeza: luvas, botas e óculos ou máscara disponíveis, em bom estado e sendo usados."),
  ],
};

export interface ParadoNaUnidade { unidade: string; codigo: string; descricao: string; fotos: string[]; desde: string; visitas: number; dias: number; visitaId: string }
/**
 * Equipamentos parados hoje em cada unidade: os da visita mais recente que tem o item de equipamentos. O "parado desde" é a primeira das visitas
 * seguidas, até a mais recente, em que o mesmo código apareceu (se o código sumiu numa visita, a contagem recomeça quando ele volta).
 */
export function equipamentosParados(visitas: Visita[], hoje: string): ParadoNaUnidade[] {
  const out: ParadoNaUnidade[] = [];
  const porUnidade = new Map<string, Visita[]>();
  for (const v of visitas) if (v.respostas.some((r) => r.tipo === "equipamentos" && r.conforme !== null)) porUnidade.set(v.unidade, [...(porUnidade.get(v.unidade) ?? []), v]);
  for (const [unidade, lista] of porUnidade) {
    const ordem = [...lista].sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm)); // da mais nova para a mais velha
    const doItem = (v: Visita) => v.respostas.find((r) => r.tipo === "equipamentos" && r.conforme !== null);
    const ultima = ordem[0];
    for (const e of doItem(ultima)?.equipamentos ?? []) {
      const chave = e.codigo.trim().toLowerCase();
      let desde = ultima.data;
      let n = 1;
      for (const v of ordem.slice(1)) {
        if (!(doItem(v)?.equipamentos ?? []).some((x) => x.codigo.trim().toLowerCase() === chave)) break;
        desde = v.data;
        n += 1;
      }
      out.push({ unidade, codigo: e.codigo, descricao: e.descricao, fotos: e.fotos, desde, visitas: n, dias: Math.max(0, dias(desde, hoje)), visitaId: ultima.id });
    }
  }
  return out.sort((a, b) => b.dias - a.dias || a.unidade.localeCompare(b.unidade, "pt-BR") || a.codigo.localeCompare(b.codigo, "pt-BR"));
}

/** Aviso de vencimento: documento que vence em menos que isso aparece em atenção. Combinado como ponto de partida: mudar só com o dono. */
export const DIAS_AVISO_VENCIMENTO = 60;
export interface CertificadoUnidade { unidade: string; vencimento: string | null; dias: number | null; situacao: "vencido" | "a-vencer" | "em-dia" | "sem-data"; visitaData: string | null }
/** Vencimento do certificado de cada unidade: o da visita mais recente em que a data foi informada. Unidade sem registro vem no fim, "sem data". */
export function certificadosPorUnidade(visitas: Visita[], unidades: string[], hoje: string): CertificadoUnidade[] {
  const doItem = (v: Visita) => v.respostas.find((r) => r.tipo === "vencimento" && r.vencimento);
  const linhas = unidades.map((unidade): CertificadoUnidade => {
    const v = visitas.filter((x) => x.unidade === unidade && doItem(x)).sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm))[0];
    if (!v) return { unidade, vencimento: null, dias: null, situacao: "sem-data", visitaData: null };
    const vencimento = doItem(v)!.vencimento as string;
    const d = dias(hoje, vencimento);
    return { unidade, vencimento, dias: d, situacao: d < 0 ? "vencido" : d <= DIAS_AVISO_VENCIMENTO ? "a-vencer" : "em-dia", visitaData: v.data };
  });
  return linhas.sort((a, b) => (a.dias ?? Infinity) - (b.dias ?? Infinity) || a.unidade.localeCompare(b.unidade, "pt-BR"));
}

/** Checklist de abertura sugerido para a unidade preencher todo dia pelo celular: curto, só o que a própria unidade confere. Não entra na nota da rede. */
export const MODELO_ABERTURA: { nome: string; descricao: string; frequencia: Frequencia; itens: Omit<ItemModelo, "id">[] } = {
  nome: "Checklist de abertura",
  descricao: "Conferência rápida antes de abrir a unidade. Item não conforme pede o que corrigir; nos itens importantes, também uma foto.",
  frequencia: "diaria",
  itens: [
    it("Equipamentos", "Todos os equipamentos de ginástica estão em operação, sem aviso de manutenção? (Se não, registre cada equipamento parado com código e foto.)", 2, "equipamentos", "Antes de abrir, passe pelo salão: equipamento desligado, quebrado ou com aviso de manutenção está parado. Registre o código de cada um, com foto."),
    it("Recepção e convivência", "Entrada e recepção limpas e organizadas, sem objetos pessoais à vista?", 1, "conforme", "Piso sem lixo, balcão organizado, sem objetos pessoais à vista."),
    it("Recepção e convivência", "Área de estar limpa e organizada, sem lixo?", 1, "conforme", "Sofás e mesas arrumados, sem lixo."),
    it("Áreas de treino", "Salão de musculação, cardio e peso livre limpos e organizados, pesos nos suportes?", 1, "conforme", "Aparelhos e bancos limpos, pesos nos suportes, nada solto no chão."),
    it("Banheiros e vestiários", "Banheiros e vestiários abertos, limpos, sem odor, com papel, sabonete e lixeira esvaziada, chuveiros funcionando?", 2, "conforme", "Banheiros e vestiários abertos e limpos, com papel, sabonete e lixeira em ordem, chuveiros funcionando."),
    it("Conforto do aluno", "Climatização funcionando e sem lâmpadas queimadas?", 1, "conforme", "Ar-condicionado ligado e sem lâmpadas queimadas."),
    it("Conforto do aluno", "Bebedouros funcionando e som em volume adequado?", 1, "conforme", "Bebedouros funcionando e som no volume adequado."),
    it("Conforto do aluno", "Álcool em gel ou higienizante e papel disponíveis nas áreas de treino?", 1, "conforme", "Dispensers de álcool em gel abastecidos e papel disponível."),
    it("Equipe", "A equipe do turno está uniformizada, com uniforme limpo e calçado fechado?", 1, "conforme", "Equipe do turno com uniforme completo e limpo e calçado fechado."),
    it("Equipe", "O registro de limpeza do turno anterior está preenchido?", 1, "conforme", "Registro de limpeza do turno anterior com horário e responsável."),
  ],
};

/** Em quantos dias o checklist de cada frequência deve ter um novo envio. Palpite combinado como ponto de partida: mudar só com o dono. */
export const PRAZO_DIAS: Record<Frequencia, number> = { visita: 0, diaria: 1, semanal: 7, mensal: 31 };

export interface LinhaRotina { unidade: string; modeloId: string; modeloNome: string; frequencia: Frequencia; ultimo: Visita | null; dias: number | null; situacao: "em-dia" | "atrasado" | "nunca"; naoConformes: number }
/** Rotina das unidades: para cada checklist que a unidade preenche, o último envio, há quantos dias e se está atrasado (mais dias que o prazo da frequência). Atrasadas primeiro. */
export function rotinaDasUnidades(envios: Visita[], modelos: ModeloChecklist[], unidades: string[], hoje: string): LinhaRotina[] {
  const rotinas = modelos.filter((m) => m.ativo && m.frequencia !== "visita");
  const out: LinhaRotina[] = [];
  for (const m of rotinas) {
    for (const unidade of unidades) {
      if (m.itens.length > 0 && itensDaUnidade(m.itens, unidade).length === 0) continue; // nenhum item vale para essa unidade
      const ultimo = envios.filter((e) => e.unidade === unidade && e.modeloId === m.id).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))[0] ?? null;
      const d = ultimo ? Math.max(0, dias(ultimo.data, hoje)) : null;
      out.push({ unidade, modeloId: m.id, modeloNome: m.nome, frequencia: m.frequencia, ultimo, dias: d, situacao: d === null ? "nunca" : d > PRAZO_DIAS[m.frequencia] ? "atrasado" : "em-dia", naoConformes: ultimo ? ultimo.respostas.filter((r) => r.conforme === false).length : 0 });
    }
  }
  const peso = { atrasado: 0, nunca: 1, "em-dia": 2 } as const;
  return out.sort((a, b) => peso[a.situacao] - peso[b.situacao] || (b.dias ?? 0) - (a.dias ?? 0) || b.naoConformes - a.naoConformes || a.unidade.localeCompare(b.unidade, "pt-BR"));
}


// ---------- agenda de visitas ----------
/** Uma visita da franqueadora marcada para uma unidade, numa data, com um checklist. */
export interface AgendaVisita { id: string; unidade: string; data: string; modeloId: string; modeloNome: string; responsavel: string; observacao: string; criadoPor: { nome: string; email: string }; atualizadoEm: string }
export type SituacaoAgenda = "feita" | "atrasada" | "hoje" | "proxima";
export const SITUACAO_AGENDA_ROTULO: Record<SituacaoAgenda, string> = { feita: "Feita", atrasada: "Atrasada", hoje: "É hoje", proxima: "Agendada" };

/**
 * Situação de uma visita agendada. "Feita" quando a unidade teve uma visita com esse checklist na data marcada ou depois dela (e antes da próxima
 * agendada da mesma unidade e checklist); sem isso, "atrasada" se a data já passou, "é hoje" ou "agendada".
 */
export function situacaoDaAgenda(a: AgendaVisita, agenda: AgendaVisita[], visitas: Pick<Visita, "unidade" | "modeloId" | "data">[], hoje: string): SituacaoAgenda {
  const proxima = agenda.filter((x) => x.id !== a.id && x.unidade === a.unidade && x.modeloId === a.modeloId && x.data > a.data).map((x) => x.data).sort()[0];
  const feita = visitas.some((v) => v.unidade === a.unidade && v.modeloId === a.modeloId && v.data >= a.data && (!proxima || v.data < proxima));
  return feita ? "feita" : a.data < hoje ? "atrasada" : a.data === hoje ? "hoje" : "proxima";
}

export interface LinhaAgenda extends AgendaVisita { situacao: SituacaoAgenda }
/** A agenda com a situação de cada visita: atrasadas, de hoje e próximas por data (as mais antigas primeiro), e as feitas por último (as mais recentes primeiro). */
export function agendaComSituacao(agenda: AgendaVisita[] | undefined, visitas: Pick<Visita, "unidade" | "modeloId" | "data">[], hoje: string): LinhaAgenda[] {
  const lista = agenda ?? [];
  const linhas = lista.map((a) => ({ ...a, situacao: situacaoDaAgenda(a, lista, visitas, hoje) }));
  const abertas = linhas.filter((l) => l.situacao !== "feita").sort((a, b) => a.data.localeCompare(b.data) || a.unidade.localeCompare(b.unidade));
  const feitas = linhas.filter((l) => l.situacao === "feita").sort((a, b) => b.data.localeCompare(a.data) || a.unidade.localeCompare(b.unidade));
  return [...abertas, ...feitas];
}

/** Unidades que precisam de visita: sem visita há mais de `DIAS_SEM_VISITA` dias (ou nunca) e sem nenhuma visita agendada daqui para a frente. */
export function unidadesParaAgendar(visitas: Visita[], unidades: string[], agenda: AgendaVisita[] | undefined, hoje: string): { unidade: string; dias: number | null }[] {
  const marcadas = new Set((agenda ?? []).filter((a) => a.data >= hoje).map((a) => a.unidade));
  return resumoPorUnidade(visitas, unidades, hoje)
    .filter((l) => (l.diasSemVisita === null || l.diasSemVisita > DIAS_SEM_VISITA) && !marcadas.has(l.unidade))
    .map((l) => ({ unidade: l.unidade, dias: l.diasSemVisita }))
    .sort((a, b) => (b.dias ?? Infinity) - (a.dias ?? Infinity) || a.unidade.localeCompare(b.unidade));
}
