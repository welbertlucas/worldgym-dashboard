// Alertas de melhoria do tráfego pago (Meta). Só leitura: nada é alterado no Meta.
// Mesmo formato dos alertas do resumo diário: { quem, gravidade: "critico" | "atencao", titulo, fato, acao }.
// `quem` é a unidade ou "Institucional" (conta da rede, separada das unidades). Usado pelo painel e pelo e-mail.

/** Limites dos alertas. Ajuste aqui: o painel mostra estes valores no rodapé do cartão. */
export const LIMITES_META = {
  /** Campanha que gastou isto (R$) em 7 dias sem nenhum contato (lead ou conversa). */
  gastoSemContato: 100,
  /** Custo por contato da campanha acima desta proporção da mediana da rede (1,5 = 50% mais caro). */
  custoAltoFator: 1.5,
  /** Só compara custo de campanhas com pelo menos estes contatos na semana (menos que isso é acaso). */
  custoAltoMinContatos: 3,
  /** Frequência na semana (vezes que a mesma pessoa viu o anúncio) a partir da qual o anúncio está cansado. */
  frequenciaAlta: 4,
  /** Campanha que termina em até estes dias. */
  terminaEmDias: 3,
  /** Só avalia a conversão em alunos com pelo menos estes contatos do Meta no mês. */
  conversaoMinContatos: 30,
  /** Menos que esta fração dos contatos do Meta virou aluno no mês (0,05 = 5%). */
  conversaoBaixa: 0.05,
  /** Cadastros do mês sem origem no EVO a partir desta fração (0,5 = metade): a conversão não é confiável. */
  semOrigemAlta: 0.5,
  /** CAC do mês acima desta proporção do mês anterior (1,3 = 30% mais caro). */
  cacAltaFator: 1.3,
  /** Só compara CAC com pelo menos estes alunos vindos do Meta nos dois meses. */
  cacMinAlunos: 3,
};

/** Origem do cadastro no EVO que conta como vinda do Meta (Instagram, Facebook, anúncio pago). */
export const ORIGEM_META = /insta|face|\bfb\b|\bmeta\b|an[uú]ncio|tr[aá]fego pago|patrocinad/i;

/** Oportunidades do mês com origem no Meta: cadastradas e convertidas (origens = { nome: [cadastradas, convertidas] }). */
export function origemMetaDe(origens) {
  let cadastradas = 0, convertidas = 0;
  for (const [o, [c, v]] of Object.entries(origens ?? {})) if (ORIGEM_META.test(o)) { cadastradas += c; convertidas += v; }
  return { cadastradas, convertidas };
}

const INSTITUCIONAL = "Institucional";
const CHAVE_INSTITUCIONAL = "Rede"; // chave da conta Institucional nos meses gravados
const contatosDe = (c) => (c.leads7d || 0) + (c.conversas7d || 0);
const reais = (n) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
const reais2 = (n) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (x) => `${Math.round(x * 100)}%`;
const mediana = (xs) => { const o = [...xs].sort((a, b) => a - b); const m = o.length >> 1; return o.length ? (o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2) : null; };
const diasEntre = (de, ate) => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86400000);

/** Campanha que deveria trazer contato (leads, mensagens, vendas). Reconhecimento e tráfego não entram no "gastando sem contato". */
export function buscaContato(c) {
  if (["OUTCOME_LEADS", "OUTCOME_SALES", "LEAD_GENERATION", "MESSAGES", "CONVERSIONS"].includes(c.objetivo)) return true;
  return /lead|cadastr|direct|whats|mensag|convers|matr[ií]cula|venda/i.test(c.nome ?? "");
}

/** Alertas por campanha, a partir da foto do dia (só campanhas no ar). */
export function alertasDeCampanhas(campanhas, { hoje, limites = LIMITES_META } = {}) {
  const L = limites;
  const out = [];
  const custos = campanhas.filter((c) => c.unidade && contatosDe(c) >= L.custoAltoMinContatos && c.gasto7d > 0).map((c) => c.gasto7d / contatosDe(c));
  const med = custos.length >= 3 ? mediana(custos) : null; // mediana da rede (sem a Institucional); com menos de 3 campanhas não compara
  for (const c of campanhas) {
    const quem = c.unidade ?? INSTITUCIONAL;
    const add = (gravidade, titulo, fato, acao) => out.push({ quem, gravidade, titulo, fato, acao, campanha: c.nome });
    const n = contatosDe(c);
    if (n === 0 && c.gasto7d >= L.gastoSemContato && buscaContato(c)) {
      add("critico", "Campanha gastando sem trazer contato", `"${c.nome}" gastou ${reais(c.gasto7d)} em 7 dias e não trouxe nenhum lead nem conversa.`, "Conferir se o formulário ou o botão de mensagem está funcionando; se estiver, pausar e trocar público ou criativo.");
    } else if (med && n >= L.custoAltoMinContatos && c.unidade && c.gasto7d / n >= med * L.custoAltoFator) {
      add("atencao", "Custo por contato alto", `"${c.nome}": ${reais2(c.gasto7d / n)} por contato na semana, ${pct(c.gasto7d / n / med - 1)} acima da mediana da rede (${reais2(med)}).`, "Testar outro criativo ou público e mover verba para a campanha da unidade que traz contato mais barato.");
    }
    if ((c.frequencia7d ?? 0) >= L.frequenciaAlta) {
      add("atencao", "Anúncio cansado", `"${c.nome}": a mesma pessoa viu o anúncio ${c.frequencia7d.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} vezes em 7 dias.`, "Trocar o criativo (imagem, vídeo ou texto) ou ampliar o público para não saturar quem já viu.");
    }
    if (c.fim && hoje && c.fim >= hoje && diasEntre(hoje, c.fim) <= L.terminaEmDias) {
      const d = diasEntre(hoje, c.fim);
      add("atencao", "Campanha terminando", `"${c.nome}" termina ${d === 0 ? "hoje" : d === 1 ? "amanhã" : `em ${d} dias`} (${c.fim.split("-").reverse().join("/")}).`, "Decidir se renova, troca por outra oferta ou deixa a unidade sem anúncio no ar.");
    }
  }
  return out;
}

/**
 * Alertas por unidade no mês, cruzando o Meta (investimento e contatos) com o EVO (alunos vindos do Meta).
 * metaMes/metaAnterior = { unidades: { nome: { investimento, leads, conversas } } }; evoMes/evoAnterior = { units: [{ name, origens }] }.
 */
export function alertasDeUnidades({ metaMes, metaAnterior, evoMes, evoAnterior, campanhas = [], limites = LIMITES_META }) {
  const L = limites;
  const out = [];
  const evo = (m, nome) => (m?.units ?? []).find((u) => u.name === nome);
  for (const [nome, v] of Object.entries(metaMes?.unidades ?? {})) {
    if (nome === CHAVE_INSTITUCIONAL) continue;
    const add = (gravidade, titulo, fato, acao) => out.push({ quem: nome, gravidade, titulo, fato, acao });
    const ant = metaAnterior?.unidades?.[nome];
    const noAr = campanhas.some((c) => c.unidade === nome);
    if (!noAr && (ant?.investimento ?? 0) > 0) {
      add("atencao", "Unidade sem campanha no ar", `Nenhuma campanha veiculando hoje; no mês passado a unidade investiu ${reais(ant.investimento)} no Meta.`, "Confirmar se a pausa foi decidida; se não, reativar ou subir uma campanha de captação.");
    }
    const contatos = (v.leads || 0) + (v.conversas || 0);
    const o = origemMetaDe(evo(evoMes, nome)?.origens);
    if (contatos >= L.conversaoMinContatos) {
      const origens = evo(evoMes, nome)?.origens ?? {};
      const total = Object.values(origens).reduce((s, [c]) => s + c, 0);
      const semOrigem = total ? (origens["Sem origem"]?.[0] ?? 0) / total : 0;
      if (o.cadastradas === 0 || semOrigem >= L.semOrigemAlta) {
        add("atencao", "Origem Meta não marcada no EVO", `${contatos} contatos do Meta no mês e só ${o.cadastradas} ${o.cadastradas === 1 ? "cadastro" : "cadastros"} com origem Instagram ou Facebook no EVO${semOrigem >= L.semOrigemAlta ? `; ${pct(semOrigem)} dos cadastros do mês estão sem origem` : ""}.`, "Orientar a recepção a marcar a origem no cadastro do prospect; sem isso o CAC e o ROI do Meta ficam subestimados.");
      } else if (o.convertidas / contatos < L.conversaoBaixa) {
        add("atencao", "Contatos do Meta não viram alunos", `${contatos} contatos no mês e ${o.convertidas} ${o.convertidas === 1 ? "aluno" : "alunos"} vindos do Meta (${pct(o.convertidas / contatos)}).`, "O anúncio está trazendo gente: revisar a velocidade e o roteiro de resposta no WhatsApp e o convite para a aula experimental.");
      }
    }
    const oa = origemMetaDe(evo(evoAnterior, nome)?.origens);
    if (o.convertidas >= L.cacMinAlunos && oa.convertidas >= L.cacMinAlunos && v.investimento > 0 && (ant?.investimento ?? 0) > 0) {
      const cac = v.investimento / o.convertidas, cacAnt = ant.investimento / oa.convertidas;
      if (cac >= cacAnt * L.cacAltaFator) add("atencao", "CAC do Meta subindo", `${reais(cac)} por aluno neste mês, contra ${reais(cacAnt)} no mês passado (${pct(cac / cacAnt - 1)} a mais).`, "Ver quais campanhas encareceram o contato e se a conversão de contato em aluno caiu.");
    }
  }
  return out;
}

/** Todos os alertas do Meta: campanhas (foto do dia) + unidades (mês corrente contra o anterior). */
export function alertasMeta({ campanhas = [], metaMes, metaAnterior, evoMes, evoAnterior, hoje, limites = LIMITES_META }) {
  return [...alertasDeCampanhas(campanhas, { hoje, limites }), ...alertasDeUnidades({ metaMes, metaAnterior, evoMes, evoAnterior, campanhas, limites })];
}
