// Qualidade: tipos e cálculos da tela (checklists da franqueadora e visitas às unidades).

export type Frequencia = "visita" | "diaria" | "semanal" | "mensal";
export const FREQUENCIA_ROTULO: Record<Frequencia, string> = { visita: "Na visita da franqueadora", diaria: "Diária (a unidade preenche)", semanal: "Semanal (a unidade preenche)", mensal: "Mensal (a unidade preenche)" };

export type PedeFoto = "nenhuma" | "nao_conforme" | "sempre";
export const FOTO_ROTULO: Record<PedeFoto, string> = { nenhuma: "Foto opcional", nao_conforme: "Obrigatória se não conforme", sempre: "Sempre obrigatória" };
export type TipoItem = "conforme" | "equipamentos" | "vencimento";
export const TIPO_ROTULO: Record<TipoItem, string> = { conforme: "Conforme ou não", equipamentos: "Lista de equipamentos parados", vencimento: "Data de vencimento (certificado)" };
export interface ItemModelo { id: string; grupo: string; texto: string; peso: number; foto: PedeFoto; tipo?: TipoItem }
export interface EquipamentoParado { codigo: string; descricao: string; fotos: string[] }
export interface ModeloChecklist { id: string; nome: string; descricao: string; frequencia: Frequencia; itens: ItemModelo[]; ativo: boolean; atualizadoEm: string }
export interface RespostaVisita { itemId: string; grupo: string; texto: string; peso?: number; tipo?: TipoItem; conforme: boolean | null; comentario: string; fotos: string[]; equipamentos?: EquipamentoParado[]; /** AAAA-MM-DD, nos itens de vencimento. */ vencimento?: string }
export interface Visita {
  /** "unidade" nos envios do checklist da própria unidade. */ origem?: "unidade";
  id: string; modeloId: string; modeloNome: string; unidade: string; data: string; mes: string;
  avaliador: { nome: string; email: string }; chegada?: string; saida?: string; respostas: RespostaVisita[]; observacao: string; nota: number | null; criadoEm: string;
}
/** `modo` "completo": dono e liberados (checklists, visitas, notas e o que as unidades enviam); "unidade": só preencher o checklist da própria unidade. */
export interface DadosQualidade { modo?: "completo" | "unidade"; unidades: string[]; modelos: ModeloChecklist[]; visitas: Visita[]; /** Envios dos checklists que a própria unidade preenche (não entram na nota). */ envios?: Visita[] }

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
const it = (grupo: string, texto: string, peso = 1, tipo: TipoItem = "conforme"): Omit<ItemModelo, "id"> => ({ grupo, texto, peso, foto: peso > 1 ? "nao_conforme" : "nenhuma", tipo });
export const MODELO_SUGERIDO: { nome: string; descricao: string; frequencia: Frequencia; itens: Omit<ItemModelo, "id">[] } = {
  nome: "Roteiro de visitação às unidades",
  descricao: "Limpeza, organização, uniforme, segurança e equipamentos. Item não conforme pede a correção; nos itens importantes, também uma foto.",
  frequencia: "visita",
  itens: [
    it("Equipamentos", "Todos os equipamentos de ginástica estão em operação, sem aviso de manutenção? (Se não, registre cada equipamento parado com código e foto.)", 2, "equipamentos"),
    it("Segurança e documentos", "Extintores dentro da validade, saídas de emergência desobstruídas e kit de primeiros socorros (e desfibrilador, se a unidade tiver) disponíveis?", 3),
    it("Segurança e documentos", "Há profissional de educação física (CREF) presente no salão durante o horário de funcionamento?", 3),
    it("Segurança e documentos", "Certificado de Regularidade PJ do CREF da unidade: informe a data de vencimento. Ele deve estar exposto à vista dos alunos.", 3, "vencimento"),
    it("Segurança e documentos", "Alvará de funcionamento, licença dos bombeiros e dedetização estão em dia, com os comprovantes à mão?", 3),
    it("Equipe", "A equipe está uniformizada: camisa e calçado fechado do padrão, uniforme limpo e em bom estado?"),
    it("Equipe", "O registro de limpeza do dia está preenchido e atualizado, com horário e responsável?"),
    it("Recepção e convivência", "Entrada: piso limpo, vidros sem marcas, sem lixo?"),
    it("Recepção e convivência", "Recepção: balcão limpo e organizado, sem objetos pessoais à vista, piso limpo?"),
    it("Recepção e convivência", "Área de estar: sofás e mesas limpos e organizados, sem lixo?"),
    it("Padrão da marca", "Fachada e placas no padrão da marca e em bom estado, banners e preços atualizados, mural sem papel antigo?"),
    it("Conforto do aluno", "Climatização funcionando na temperatura adequada e sem lâmpadas queimadas nas áreas de treino?"),
    it("Conforto do aluno", "Bebedouros funcionando e som em volume adequado?"),
    it("Conforto do aluno", "Álcool em gel ou higienizante e papel disponíveis nas áreas de treino, para o aluno limpar os equipamentos?"),
    it("Áreas de treino", "Ergometria (cardio): esteiras e bikes limpas, sem suor ou poeira, displays e assentos limpos?"),
    it("Áreas de treino", "Sala de musculação: equipamentos limpos, pesos nos suportes, espelhos limpos, piso livre de objetos?"),
    it("Áreas de treino", "Peso livre: halteres e anilhas organizados por peso, bancos limpos, nada solto no chão?"),
    it("Áreas de treino", "Atletics: área organizada, materiais guardados, piso limpo?"),
    it("Áreas de treino", "Sala de aulas coletivas: piso e espelhos limpos, materiais organizados, som e climatização funcionando?"),
    it("Áreas de treino", "Área de lutas: tatame e sacos limpos, materiais organizados?"),
    it("Banheiros e vestiários", "Banheiro feminino: piso seco, sem odor, vasos e pias limpos, com papel, sabonete e lixeira esvaziada?", 2),
    it("Banheiros e vestiários", "Banheiro masculino: piso seco, sem odor, vasos, pias e mictórios limpos, com papel, sabonete e lixeira esvaziada?", 2),
    it("Banheiros e vestiários", "Banheiro PNE: limpo, sem odor, barras de apoio e alarme funcionando, livre de objetos guardados?", 2),
    it("Banheiros e vestiários", "Vestiários: chuveiros funcionando, armários em ordem, secadores funcionando?", 2),
    it("Áreas de apoio", "Sala de avaliações (se tiver): limpa, organizada e com os equipamentos de avaliação guardados?"),
    it("Áreas de apoio", "Sala do administrativo: organizada, sem documentos expostos, piso limpo?"),
    it("Áreas de apoio", "Copa: limpa, sem alimentos expostos ou louça suja, lixeira esvaziada?"),
    it("Áreas de apoio", "DML e depósito: produtos de limpeza identificados e organizados, fora do alcance de alunos, sem vazamento, passagem livre e sem entulho?"),
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
    it("Equipamentos", "Todos os equipamentos de ginástica estão em operação, sem aviso de manutenção? (Se não, registre cada equipamento parado com código e foto.)", 2, "equipamentos"),
    it("Recepção e convivência", "Entrada e recepção limpas e organizadas, sem objetos pessoais à vista?"),
    it("Recepção e convivência", "Área de estar limpa e organizada, sem lixo?"),
    it("Áreas de treino", "Salão de musculação, cardio e peso livre limpos e organizados, pesos nos suportes?"),
    it("Banheiros e vestiários", "Banheiros e vestiários abertos, limpos, sem odor, com papel, sabonete e lixeira esvaziada, chuveiros funcionando?", 2),
    it("Conforto do aluno", "Climatização funcionando e sem lâmpadas queimadas?"),
    it("Conforto do aluno", "Bebedouros funcionando e som em volume adequado?"),
    it("Conforto do aluno", "Álcool em gel ou higienizante e papel disponíveis nas áreas de treino?"),
    it("Equipe", "A equipe do turno está uniformizada, com uniforme limpo e calçado fechado?"),
    it("Equipe", "O registro de limpeza do turno anterior está preenchido?"),
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
      const ultimo = envios.filter((e) => e.unidade === unidade && e.modeloId === m.id).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))[0] ?? null;
      const d = ultimo ? Math.max(0, dias(ultimo.data, hoje)) : null;
      out.push({ unidade, modeloId: m.id, modeloNome: m.nome, frequencia: m.frequencia, ultimo, dias: d, situacao: d === null ? "nunca" : d > PRAZO_DIAS[m.frequencia] ? "atrasado" : "em-dia", naoConformes: ultimo ? ultimo.respostas.filter((r) => r.conforme === false).length : 0 });
    }
  }
  const peso = { atrasado: 0, nunca: 1, "em-dia": 2 } as const;
  return out.sort((a, b) => peso[a.situacao] - peso[b.situacao] || (b.dias ?? 0) - (a.dias ?? 0) || b.naoConformes - a.naoConformes || a.unidade.localeCompare(b.unidade, "pt-BR"));
}
