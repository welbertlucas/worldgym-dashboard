// Conteúdo do PDF do estudo de uma unidade em operação, no roteiro do estudo de geomarketing da rede (Canva): resumo, metodologia,
// base de clientes, oportunidades, perfil etário, domicílios, perfil socioeconômico, concorrência, canibalização e conclusão.
// Cada seção traz a leitura escrita (o "porquê" do número), não só o mapa. Os textos são montados por regras fixas a partir dos
// números da própria tela: nada inventado; o que é estimativa ou premissa de mercado aparece escrito como tal.
import type { ConteudoPdf, Secao } from "@/lib/estudoPdf";
import { nomeDoArquivo, ALT_FOTO_MAPA } from "@/lib/estudoPdf";
import { compararComParecidas, fraseUnidadesProximas, leituraParecidas, CLASSES_RENDA, CORES_IDADE, CORRECAO_POF, FAIXAS_IDADE, reais, type densidadeNaArea, type UnidadeEstudo, type classesNoRaio, type perfilNaArea, type potencialNaArea, type FaixaM2 } from "@/lib/estudoPonto";
import type { ResultadoPois } from "@/components/estudos/pois";
import { ROTULO_SERVICO, resumoServicos } from "@/lib/servicosAcademias";
import { LIMITES_SUGESTAO, linhasSugestoes, textoSugestoes, type ResultadoSugestoes } from "@/components/estudos/sugestoes";

/** Penetração de academias na população (média nacional de ~7%, estimativas do setor): só a conta dos estudos antigos usa, como referência. Fora do PDF e do veredito desde 24/11/2026: a demanda é medida pela fatia do potencial e pela população recomendada, calibradas com a rede. */
export const PENETRACAO_MERCADO = 0.07;
/** Média de moradores por domicílio no Brasil (Censo 2022). */
const MEDIA_BRASIL_DOMICILIO = 2.79;

export interface DadosPdfUnidade {
  u: UnidadeEstudo;
  faixa: FaixaM2 | null;
  porM2: number | null; comparado: number | null;
  minutos: number; temArea: boolean;
  parteNaArea: number | null; min80: number | null; onde80: string;
  topBairros: [string, number, number, number][]; alunosBairro: number;
  esperadoNaArea: number | null;
  perfil: ReturnType<typeof perfilNaArea> | null;
  renda: ReturnType<typeof classesNoRaio> | null;
  potencial: ReturnType<typeof potencialNaArea> | null;
  densidade?: ReturnType<typeof densidadeNaArea> | null;
  /** Renda estimada dos domicílios e pontos de comércio da área (páginas Renda Total e Concentração Comercial). */
  rendaTotal?: { total: number; domicilios: number; porDomicilio: number } | null;
  comercio?: number | null;
  /** Onde abrir outra unidade na região (só para quem vê a estratégia de expansão). */
  novaUnidade?: ResultadoSugestoes | null;
  /** Endereço aproximado de cada região sugerida, na ordem delas (null quando a busca não achou). */
  enderecosNova?: (string | null)[];
  /** Unidades maduras do mesmo modelo com vizinhança parecida (moradores e renda a até 2 km). */
  parecidas?: ReturnType<typeof compararComParecidas> | null;
  pois: ResultadoPois | null;
  divideCom: { nome: string; parte: number }[];
  /** As outras World Gym mais próximas desta unidade (km em linha reta). */
  proximas?: { nome: string; km: number }[];
  /** Zonas de captação (70/90/98% dos alunos pelo CEP): raio em km, parte acumulada dos alunos, alunos e moradores dentro do raio. */
  /** Canibalização observada: alunos que moram mais perto de outra World Gym (contagem por CEP). */
  canibalObservada?: { itens: { nome: string; km: number; meusPertoDela: number; delaPertoDaqui: number }[]; algumaOutra: number; alunos: number } | null;
  zonas?: { lista: { r: number; parte: number; alunos: number; moradores: number }[]; na10: number | null; total: number } | null;
  fotos: { sat: string | null; alunos: string | null; oportunidade: string | null; zonas?: string | null; idade: string | null; domicilios: string | null; renda: string | null; consumo: string | null; pessoas?: string | null; rendaTotal?: string | null; comercio?: string | null; nova?: string | null; pois: string | null; rede: string | null };
  hoje?: Date;
}

const pct = (x: number | null | undefined, casas = 1) => (x == null ? "—" : `${(x * 100).toLocaleString("pt-BR", { maximumFractionDigits: casas })}%`);
const mil = (x: number | null | undefined) => (x == null ? "—" : x >= 10000 ? `${Math.round(x / 1000).toLocaleString("pt-BR")} mil` : Math.round(x).toLocaleString("pt-BR"));
const num = (x: number) => Math.round(x).toLocaleString("pt-BR");
const curto = (v: number) => (v >= 1e9 ? `R$ ${(v / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} bi` : v >= 1e6 ? `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi` : `R$ ${Math.round(v / 1000).toLocaleString("pt-BR")} mil`);
const dec = (x: number, c = 2) => x.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });

/** Separa os lugares do Google em grandes redes, academias independentes e studios/modalidades (lutas, dança, pilates...). */
const MODALIDADE = /capoeira|associa|pilates|dan[çc]a|jiu|jitsu|luta|krav|muay|boxe|box\b|karat|jud[oô]|taekwon|crossfit|cross fit|escola|studio|est[úu]dio|personal|fisio|cl[íi]nic|nata[çc][ãa]o|yoga|ioga|funcional|calistenia|equipamentos|ol[íi]mpico|centro de treinamento|ct\b/i;
/** Frase das legendas dos mapas do Censo: o contorno cinza marca onde o Censo não tem morador. */
const SEM_MORADORES = " Contorno cinza: sem moradores no Censo 2022 (parque, setor institucional, terra rural ou loteamento novo).";
export function classificarConcorrentes(pois: ResultadoPois | null) {
  if (!pois || pois.categoria !== "academias") return null;
  const lugares = pois.lugares.filter((l) => l.rede !== "World Gym");
  const redes = lugares.filter((l) => l.rede), resto = lugares.filter((l) => !l.rede);
  const modalidades = resto.filter((l) => MODALIDADE.test(l.nome)), independentes = resto.filter((l) => !MODALIDADE.test(l.nome));
  const nomesRedes = [...new Set(redes.map((l) => l.rede as string))].map((r) => ({ rede: r, n: redes.filter((l) => l.rede === r).length }));
  return { total: lugares.length, redes, independentes, modalidades, diretos: redes.length + independentes.length, nomesRedes };
}

/** Dados de mercado da área (iguais para unidade em operação e ponto novo). `vendas`: unidade = o que vende; ponto = a meta da régua. */
export interface DadosMercado {
  tipo: "unidade" | "ponto"; nome: string; area: string; vendas: number | null; alunosNaArea: number | null;
  perfil: ReturnType<typeof perfilNaArea> | null; renda: ReturnType<typeof classesNoRaio> | null; potencial: ReturnType<typeof potencialNaArea> | null;
  densidade?: ReturnType<typeof densidadeNaArea> | null; pois: ResultadoPois | null;
  /** O ponto está fora da malha do Censo do Atlas: as seções de gente, renda e consumo não existem e uma página explica por quê. */
  semCenso?: boolean;
  /** Renda estimada dos domicílios da área (soma, domicílios e média), para a página de Renda Total. */
  rendaTotal?: { total: number; domicilios: number; porDomicilio: number } | null;
  /** Pontos de comércio e serviços na área (OpenStreetMap), para a página de Concentração Comercial. */
  comercio?: number | null;
  /** Nota do ponto no score de atratividade (0 a 100), a parte da área com nota menor e as variáveis usadas com o peso normalizado (soma 1). */
  atratividade?: { score: number; melhorQue: number; usadas: { rotulo: string; peso: number }[] } | null;
  fotos: { idade: string | null; domicilios: string | null; renda: string | null; consumo: string | null; pois: string | null; pessoas?: string | null; rendaTotal?: string | null; comercio?: string | null; atratividade?: string | null };
}
/** Números de mercado da área: concorrência classificada, praticantes, habitantes por academia e participação. */
export function resumoMercado(m: Pick<DadosMercado, "perfil" | "renda" | "pois" | "alunosNaArea">) {
  const conc = classificarConcorrentes(m.pois);
  const moradores = m.perfil?.moradores ?? null;
  const habPorAcademia = moradores != null && conc ? moradores / (conc.diretos + 1) : null;
  const nivelConcorrencia = habPorAcademia == null ? null : habPorAcademia <= 1950 ? "saturada" : habPorAcademia <= 3000 ? "alta" : habPorAcademia <= 6600 ? "moderada" : "baixa";
  const perfilRenda = m.renda ? (m.renda.cde >= 0.75 ? "predominantemente popular" : m.renda.ab >= 0.4 ? "de renda mais alta" : "misto") : null;
  return { conc, moradores, habPorAcademia, nivelConcorrencia, perfilRenda };
}
/** Seções de mercado: faixa etária, domicílios, perfil socioeconômico, potencial de consumo e concorrência. */
/** Cabem 3 colunas de 25 linhas embaixo da rosca, na mesma página. */
export const MAX_LISTA_ACADEMIAS = 75;
/**
 * Nome resumido para a lista em 3 colunas: o que vem depois de " - ", " | " ou vírgula (filial, bairro, modalidades) sai; o nome da rede
 * é acrescentado só quando o resumo não o traz. O endereço completo continua no mapa e na busca do Atlas.
 */
export function nomeNaLista(nome: string, rede: string | null): string {
  const limpo = nome.replace(/\s+/g, " ").trim();
  const corte = limpo.split(/\s[-–—|]\s|,\s/)[0].trim();
  const curto = corte.length >= 5 ? corte : limpo;
  const sem = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return rede && !sem(curto).includes(sem(rede)) ? `${curto} (${rede})` : curto;
}
/** Página dos horários, da reputação e dos serviços das academias (só quando foram buscados). */
export const TITULO_SERVICOS = "Horários e Serviços dos Concorrentes";
/** Quantas academias entram na tabela da página de serviços (as mais próximas). */
export const MAX_TABELA_SERVICOS = 26;
/** Páginas da concorrência: no PDF vêm depois da canibalização, como "Academias concorrentes" é a última camada do mapa (decisão do dono, 24/11/2026). */
const TITULOS_CONCORRENCIA = ["Análise de Concorrência", "Composição da Concorrência e Academias da Área", TITULO_SERVICOS];
export const separarConcorrencia = (secoes: Secao[]): { antes: Secao[]; concorrencia: Secao[] } => ({ antes: secoes.filter((x) => !TITULOS_CONCORRENCIA.includes(x.titulo)), concorrencia: secoes.filter((x) => TITULOS_CONCORRENCIA.includes(x.titulo)) });
export function secoesDeMercado(m: DadosMercado): Secao[] {
  const { perfil, renda, area } = m;
  const { conc, moradores, habPorAcademia, nivelConcorrencia, perfilRenda } = resumoMercado(m);
  const secoes: Secao[] = [];
  if (m.semCenso) secoes.push({
    titulo: "Dados do Censo indisponíveis", novaPagina: true, linhas: [],
    texto: [
      "O Atlas guarda o Censo 2022 do IBGE só para a região das unidades da rede (Distrito Federal e entorno, Goiânia e Salvador). Este ponto está fora dessa região, então não há dados de moradores, renda, idade e domicílios para a área de deslocamento.",
      "Por isso este estudo não traz as páginas de População por Faixa Etária, Domicílios e Densidade, Perfil Socioeconômico e Potencial de Consumo, nem a população recomendada e a divisão do público com a rede. Zero moradores nesses números seria falta de dado, não a realidade do lugar.",
      "A estimativa de faturamento, o retorno e o parecer pelo que a rede vende por m² continuam valendo. A demanda precisa ser conferida de outra forma antes da decisão.",
    ],
  });
  // ---------- Score de atratividade ----------
  if (m.atratividade && m.fotos.atratividade) {
    const at = m.atratividade;
    secoes.push({
      titulo: "Score de Atratividade", novaPagina: true, linhas: [],
      destaques: [{ valor: `${at.score}`, rotulo: "de 100 neste ponto" }, { valor: pct(at.melhorQue, 0), rotulo: "dos hexágonos da área têm nota menor" }],
      texto: [
        `Cada hexágono da área ${area} recebe uma nota de 0 a 100 pela posição dele, entre os hexágonos da área, em ${at.usadas.length} variáveis: ${at.usadas.map((u) => `${u.rotulo.toLowerCase()} (${pct(u.peso, 0)})`).join(", ")}. O hexágono onde fica ${m.tipo === "ponto" ? "o ponto" : "a unidade"} recebeu ${at.score}, acima de ${pct(at.melhorQue, 0)} dos hexágonos da área.`,
        "A nota serve para comparar lugares na mesma região e mostra onde a combinação de gente, consumo, comércio e pouca concorrência é mais favorável. Não é previsão de vendas: na rede, nenhuma variável sozinha explicou bem as vendas das unidades.",
      ],
      foto: { dados: m.fotos.atratividade, legenda: "Cada hexágono na cor da nota de atratividade: mais escuro = nota mais alta. Os pesos são os padrões do Atlas."+SEM_MORADORES }, altFoto: ALT_FOTO_MAPA,
    });
  }

  // ---------- População ----------
  if (perfil?.moradores && m.fotos.pessoas) {
    secoes.push({
      titulo: "População da Área", novaPagina: true, linhas: [],
      destaques: [{ valor: num(perfil.moradores), rotulo: `moradores ${area}` }, ...(perfil.domicilios ? [{ valor: num(perfil.domicilios), rotulo: "domicílios ocupados" }] : [])],
      texto: [`A área ${area} reúne ${num(perfil.moradores)} moradores (Censo 2022 do IBGE). O mapa mostra onde eles estão: cada hexágono, de cerca de 200 m, fica mais azul quanto mais moradores tem.`],
      foto: { dados: m.fotos.pessoas, legenda: "Azul mais forte = mais moradores no hexágono (Censo 2022)."+SEM_MORADORES }, altFoto: ALT_FOTO_MAPA,
    });
  }

  // ---------- Domicílios e densidade ----------
  if (perfil?.domicilios && perfil.porDomicilio) {
    const pd = perfil.porDomicilio;
    secoes.push({
      titulo: "Domicílios e Densidade Residencial", novaPagina: true, linhas: [],
      destaques: [{ valor: num(perfil.domicilios), rotulo: "domicílios ocupados" }, { valor: dec(pd), rotulo: "moradores por domicílio" }, { valor: mil(perfil.moradores), rotulo: "moradores" }],
      texto: [`A área conta com ${num(perfil.domicilios)} domicílios ocupados, com média de ${dec(pd)} moradores por domicílio (Brasil: ${dec(MEDIA_BRASIL_DOMICILIO)}). ${pd >= 2.95 ? "Famílias maiores dividem a renda entre mais pessoas: o consumo é compartilhado e a sensibilidade a preço é maior, o que reforça ticket acessível, planos familiares e alto volume de alunos." : pd <= 2.55 ? "Domicílios menores (pessoas sozinhas e casais) costumam ter mais renda disponível por pessoa e mais rotina individual, o que favorece frequência alta e planos de maior valor." : "O tamanho das famílias está perto da média nacional: o público combina famílias e adultos que moram sozinhos, sem pressão extra sobre o preço."}`],
      foto: { dados: m.fotos.domicilios, legenda: m.densidade?.[0]?.rotulo === "1 morador" ? "Cada hexágono na cor do tamanho de domicílio mais comum (número de moradores, Censo 2022)."+SEM_MORADORES : "Cada hexágono na cor da faixa de moradores por domicílio (média do hexágono, Censo 2022)."+SEM_MORADORES }, altFoto: ALT_FOTO_MAPA,
      ...(m.densidade ? { grafico: { tipo: "rosca" as const, titulo: m.densidade[0]?.rotulo === "1 morador" ? "Domicílios por número de moradores" : "Domicílios por faixa de moradores por domicílio", fatias: m.densidade.map((c) => ({ rotulo: c.rotulo, valor: c.parte, cor: c.cor })), centro: mil(perfil.domicilios), rotuloCentro: "domicílios" } } : {}),
    });
  }

  // ---------- Perfil etário ----------
  if (perfil?.idade && perfil.parte20a49 != null) {
    const tot = perfil.idade.reduce((a, b) => a + b, 0);
    const p2049 = perfil.parte20a49, nucleo = (perfil.idade[3] + perfil.idade[4]) / tot;
    secoes.push({
      titulo: "População por Faixa Etária", novaPagina: true, linhas: [],
      texto: [`A população de 20 a 49 anos ${area} soma ${num(tot * p2049)} pessoas, ${pct(p2049)} do total. ${p2049 >= 0.49 ? "É uma aderência etária alta ao público de academia." : p2049 >= 0.42 ? "É uma aderência etária média, com base relevante de público economicamente ativo." : "A aderência etária é baixa: a área é mais jovem ou mais envelhecida que o público típico, o que pede oferta e comunicação ajustadas."} Na rede, 55% dos alunos ativos têm de 25 a 44 anos, faixa em que o churn e a inadimplência são menores que entre os mais jovens; na área, os moradores de 30 a 49 anos são ${pct(nucleo)}.`],
      foto: { dados: m.fotos.idade, legenda: "Cada hexágono na cor da faixa de idade que predomina, comparando moradores por ano de idade (Censo 2022)."+SEM_MORADORES }, altFoto: ALT_FOTO_MAPA,
      legenda: FAIXAS_IDADE.map((f, i) => ({ cor: CORES_IDADE[i], texto: `${f}: ${num(perfil.idade![i])} (${pct(perfil.idade![i] / tot, 0)})` })),
      destaques: [{ valor: pct(p2049), rotulo: "moradores de 20 a 49 anos" }, { valor: mil(tot * p2049), rotulo: "pessoas de 20 a 49 anos" }],
    });
  }

  // ---------- Perfil socioeconômico ----------
  if (renda && m.fotos.renda) {
    const [a, b] = [...renda.classes].sort((x, y) => y.parte - x.parte);
    secoes.push({
      titulo: "Perfil Socioeconômico", novaPagina: true, linhas: [],
      texto: [`A região tem perfil ${perfilRenda}: ${pct(renda.ab)} dos ${renda.porDomicilio ? "domicílios" : "moradores"} estão nas classes AA, A e B e ${pct(renda.cde)} nas classes C, D e E. As classes que mais aparecem são a ${a.id} (${pct(a.parte)}) e a ${b.id} (${pct(b.parte)}), ${renda.cde >= 0.75 ? "o que indica sensibilidade a preço e favorece modelos focados em escala e eficiência, como o Low Cost." : renda.ab >= 0.4 ? "o que abre espaço para planos de maior valor, serviços adicionais e o modelo Pro." : "o que pede uma oferta que atenda as duas faixas, com plano de entrada e opções de maior valor."}${renda.media ? ` A renda média do responsável pelo domicílio na área é de R$ ${num(Math.round(renda.media / 10) * 10)}.` : ""}`],
      foto: { dados: m.fotos.renda, legenda: renda.porDomicilio ? "Cada hexágono na cor da classe com mais domicílios (renda do domicílio estimada a partir do Censo 2022)."+SEM_MORADORES : "Cada hexágono na cor da classe pela renda média do responsável pelo domicílio (Censo 2022, estimativa por hexágono)."+SEM_MORADORES }, altFoto: ALT_FOTO_MAPA,
      grafico: { tipo: "rosca", titulo: `Distribuição dos ${renda.porDomicilio ? "domicílios" : "moradores"} por classe de renda`, fatias: CLASSES_RENDA.map((c) => ({ rotulo: `${c.rotulo} (${c.faixa})`, valor: renda.classes.find((x) => x.id === c.id)?.parte ?? 0, cor: c.cor })), centro: mil(renda.moradores), rotuloCentro: renda.porDomicilio ? "domicílios" : "moradores" },
    });
  }

  // ---------- Renda total ----------
  if (m.rendaTotal && m.fotos.rendaTotal) {
    const rt = m.rendaTotal;
    secoes.push({
      titulo: "Renda Total dos Domicílios", novaPagina: true, linhas: [],
      destaques: [{ valor: curto(rt.total), rotulo: "renda dos domicílios por mês" }, { valor: num(rt.domicilios), rotulo: "domicílios" }, { valor: `R$ ${num(rt.porDomicilio)}`, rotulo: "renda média por domicílio" }],
      texto: [`Somando a renda estimada de cada domicílio, a área ${area} reúne cerca de ${curto(rt.total)} por mês, em ${num(rt.domicilios)} domicílios (média de R$ ${num(rt.porDomicilio)} por domicílio). Mostra onde está o dinheiro da região, e não só onde há gente: um hexágono com poucas casas de renda alta pode pesar mais que outro com muitas de renda baixa.`, "A renda de cada domicílio é uma estimativa a partir do Censo 2022 (classes de renda do responsável), por isso o total é uma ordem de grandeza e não um valor exato."],
      foto: { dados: m.fotos.rendaTotal, legenda: "Mais escuro = maior renda total dos domicílios do hexágono (estimada a partir do Censo 2022)."+SEM_MORADORES }, altFoto: ALT_FOTO_MAPA,
    });
  }

  // ---------- Potencial de consumo ----------
  if (m.potencial) {
    const pot = m.potencial, fatia = m.vendas != null && pot.total ? m.vendas / pot.total : null;
    secoes.push({
      titulo: "Potencial de Consumo", novaPagina: true, linhas: [],
      destaques: [{ valor: `R$ ${pot.total >= 1e6 ? `${(pot.total / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi` : `${Math.round(pot.total / 1000).toLocaleString("pt-BR")} mil`}`, rotulo: "potencial de consumo por mês" }, { valor: `R$ ${dec(pot.porDomicilio)}`, rotulo: "por domicílio por mês" }, ...(fatia != null ? [{ valor: pct(fatia, 0), rotulo: m.tipo === "unidade" ? "do potencial é o que a unidade vende" : "do potencial precisa ser capturado" }] : [])],
      texto: [
        `Os ${num(pot.domicilios)} domicílios ${area} gastam, juntos, cerca de R$ ${num(pot.total)} por mês com recreações e esportes (academias, clubes, aulas e eventos esportivos), pela renda de cada região. ${renda && renda.cde >= 0.75 ? "Apesar da renda predominantemente popular, a escala de domicílios forma uma base de mercado que sustenta operações de volume." : "A renda da área sustenta gasto acima da média com atividade física, o que favorece ticket maior e serviços adicionais."}`,
        ...(fatia != null ? [m.tipo === "unidade"
          ? `A World Gym ${m.nome} vende ${reais(m.vendas!)} por mês, o equivalente a ${pct(fatia, 0)} desse potencial. ${fatia >= 0.36 ? "É uma fatia alta: parte das vendas vem de alunos de fora da área e o espaço para crescer dentro dela é mais estreito (nos estudos da rede, pontos novos que precisariam de mais de ~36% do potencial foram reprovados)." : fatia >= 0.33 ? "É uma fatia na zona de atenção usada nos estudos da rede (33% a 35%)." : "É uma fatia confortável (nos estudos da rede, até ~32% do potencial é considerado capturável), o que indica espaço para crescer."}`
          : `Para chegar à meta de ${reais(m.vendas!)} por mês (o que paga o investimento no prazo da régua da rede), o ponto precisaria capturar ${pct(fatia, 0)} desse potencial. ${fatia >= 0.36 ? "É uma fatia alta demais: nos estudos da rede, pontos que precisavam de mais de ~36% do potencial foram reprovados." : fatia >= 0.33 ? "Está na zona de atenção dos estudos da rede (33% a 35%)." : "Está dentro do que os estudos da rede consideram capturável (até ~32%)."}`] : []),
        `Estimativa: gasto médio mensal das famílias com recreações e esportes por faixa de renda (IBGE, POF 2017-2018), corrigido pela inflação (×${dec(CORRECAO_POF)}) e aplicado à renda estimada dos domicílios de cada hexágono do Censo 2022 (a renda do responsável, a mais informada pelo IBGE, convertida em renda do domicílio pela relação média do estado e espalhada entre as faixas pela variação da renda em cada setor).`,
      ],
      foto: { dados: m.fotos.consumo, legenda: "Mais escuro = maior gasto estimado com recreações e esportes."+SEM_MORADORES }, altFoto: ALT_FOTO_MAPA,
    });
  }

  // ---------- Concentração comercial ----------
  if (m.comercio != null && m.fotos.comercio) {
    secoes.push({
      titulo: "Concentração Comercial", novaPagina: true, linhas: [],
      destaques: [{ valor: num(m.comercio), rotulo: `pontos de comércio e serviços ${area}` }],
      texto: [`Foram mapeados ${num(m.comercio)} pontos de comércio e serviços ${area}: lojas, escritórios, restaurantes, farmácias, bancos, escolas e clínicas (OpenStreetMap). O mapa mostra onde o comércio se concentra, o que costuma indicar movimento de pessoas e facilidade de acesso.`, "É uma aproximação: não é contagem de pessoas passando (dado de celular), e a cobertura do OpenStreetMap varia de cidade para cidade."],
      foto: { dados: m.fotos.comercio, legenda: "Mais escuro = mais pontos de comércio e serviços no hexágono (OpenStreetMap)." }, altFoto: ALT_FOTO_MAPA,
    });
  }

  // ---------- Concorrência e mercado ----------
  if (m.pois && conc) {
    const texto: string[] = [];
    texto.push(`Foram identificados ${conc.total} lugares cadastrados como academia no Google ${m.pois.areaRotulo ? `na área de ${m.pois.areaRotulo}` : `a até ${m.pois.raioKm.toLocaleString("pt-BR")} km`}. Separando por tipo: ${conc.redes.length} unidades de grandes redes${conc.nomesRedes.length ? ` (${conc.nomesRedes.map((r) => `${r.rede}${r.n > 1 ? ` ${r.n}` : ""}`).join(", ")})` : ""}, ${conc.independentes.length} academias independentes e ${conc.modalidades.length} studios e modalidades (lutas, pilates, dança, crossfit), que disputam só parte do mesmo aluno. A classificação é automática pelo nome e vale conferir.`);
    if (habPorAcademia != null) texto.push(`Com ${mil(moradores)} moradores e ${conc.diretos} concorrentes diretos mais ${m.tipo === "unidade" ? "a própria unidade" : "a nova unidade"}, a área tem ${num(habPorAcademia)} habitantes por academia: concorrência ${nivelConcorrencia}${nivelConcorrencia === "saturada" ? " (nos estudos da rede, áreas abaixo de ~1.950 habitantes por academia foram reprovadas por saturação)" : ""}.`);
    secoes.push({
      titulo: "Análise de Concorrência", novaPagina: true, linhas: [], texto,
      destaques: [{ valor: num(conc.diretos), rotulo: "concorrentes diretos" }, ...(habPorAcademia != null ? [{ valor: num(habPorAcademia), rotulo: "habitantes por academia" }] : [])],
      foto: { dados: m.fotos.pois, legenda: "Fonte: Google. Grandes redes em destaque escuro." }, altFoto: ALT_FOTO_MAPA,
    });
    // Composição e lista numa página só (decisão do dono, 24/11/2026): a lista mostra no máximo MAX_LISTA_ACADEMIAS lugares, o que cabe embaixo da rosca;
    // passando disso ficam os mais próximos e uma frase conta quantos ficaram de fora. As World Gym não entram: o mesmo critério da rosca e do total.
    const todos = m.pois.lugares.filter((l) => l.rede !== "World Gym");
    const lista = todos.slice(0, MAX_LISTA_ACADEMIAS), fora = todos.length - lista.length;
    secoes.push({
      titulo: "Composição da Concorrência e Academias da Área", novaPagina: true, linhas: [],
      texto: [`Dos ${conc.total} lugares, ${conc.diretos} disputam diretamente o aluno da World Gym (grandes redes e academias independentes). Os studios e modalidades atendem nichos e entram só em parte na disputa.`],
      grafico: { tipo: "rosca", fatias: [{ rotulo: "Grandes redes", valor: conc.redes.length, cor: "#1b2130" }, { rotulo: "Academias independentes", valor: conc.independentes.length, cor: "#1f5f8b" }, { rotulo: "Studios e modalidades", valor: conc.modalidades.length, cor: "#b9c3d0" }], centro: String(conc.total), rotuloCentro: "lugares" },
      tabela: { colunas: ["Nº", "Academia", "km"], larguras: [6.5, 38.5, 9], blocos: 3, linhas: lista.map((l, i) => [String(i + 1), nomeNaLista(l.nome, l.rede), l.km.toLocaleString("pt-BR")]) },
      paragrafo: `Os ${todos.length} lugares estão em ordem de distância ${m.tipo === "unidade" ? "da unidade" : "do ponto"}, em quilômetros; os nomes aparecem resumidos.${fora > 0 ? ` A lista mostra os ${lista.length} mais próximos; outros ${fora} mais distantes ficaram de fora.` : ""}`,
    });
    // Horários, nota e serviços (quando foram buscados). Não achar um serviço não quer dizer que a academia não ofereça: o texto diz "informam" e
    // mostra quantas ficaram sem informação; não há frase de lacuna ou oportunidade (a cobertura medida em 26/11/2026 foi baixa).
    const r = m.pois.servicosCarregados ? resumoServicos(todos.filter((l) => l.info !== undefined).map((l) => l.info)) : null;
    if (m.pois.servicosCarregados && r && r.consultadas > 0) {
      const consultadas = todos.map((l, i) => ({ l, i })).filter((x) => x.l.info !== undefined);
      const um = (n: number) => n.toLocaleString("pt-BR");
      const txt: string[] = [];
      txt.push(`Das ${um(r.consultadas)} academias consultadas (as mais próximas), ${um(r.comHorario)} têm horário no Google: ${um(r.h24)} abrem 24 horas e ${um(r.domingo)} abrem no domingo.${r.abreMaisCedo ? ` Na área, a abertura mais cedo é às ${r.abreMaisCedo} e o fechamento mais tarde, às ${r.fechaMaisTarde}.` : ""}`);
      if (r.notaMedia != null) txt.push(`A nota média no Google é ${r.notaMedia.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}, ponderada pelo número de avaliações, entre as ${um(r.comNota)} academias com pelo menos 5 avaliações. O número de avaliações também indica o movimento de cada academia.`);
      txt.push(r.porServico.length
        ? `Modalidades encontradas além de musculação: ${r.porServico.map((x) => `${x.rotulo.toLowerCase()} (${um(x.n)})`).join(", ")}, em ${um(r.comServico)} das ${um(r.consultadas)} academias. Nas outras ${um(r.consultadas - r.comServico)} não foi possível encontrar outras modalidades, o que não quer dizer que não ofereçam.`
        : `Não foi possível encontrar modalidades além de musculação nas academias consultadas, o que não quer dizer que não ofereçam.`);
      if (m.pois.servicosSemCota) txt.push(`${um(m.pois.servicosSemCota)} ${m.pois.servicosSemCota === 1 ? "academia ficou" : "academias ficaram"} sem consulta porque o limite gratuito mensal do Google foi atingido.`);
      txt.push(`Fontes: horário e nota, Google; modalidades, o nome da academia, o site quando dá para ler (Instagram não dá; nas grandes redes, só a página da unidade quando ela traz a grade)${consultadas.some((x) => x.l.info?.aulas) ? " e, em algumas unidades, as aulas pesquisadas e informadas pela World Gym" : ""}.`);
      const linhas = consultadas.slice(0, MAX_TABELA_SERVICOS).map(({ l, i }) => [String(i + 1), nomeNaLista(l.nome, l.rede), l.info ? (l.info.nota == null ? "—" : `${l.info.nota.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} (${um(l.info.avaliacoes)})`) : "—", l.info?.horario ? (l.info.horario.h24 ? "24 horas" : `${l.info.horario.abre}–${l.info.horario.fecha}${l.info.horario.domingo ? " +dom" : ""}`) : "—", l.info ? (l.info.aulas ?? l.info.servicos.filter((x) => x.id !== "musculacao").map((x) => ROTULO_SERVICO[x.id]).join(", ")) || "Não encontradas" : "Sem resposta"]);
      secoes.push({
        titulo: TITULO_SERVICOS, novaPagina: true, linhas: [], texto: txt,
        destaques: [{ valor: um(r.h24), rotulo: "abrem 24 horas" }, { valor: um(r.domingo), rotulo: "abrem no domingo" }, ...(r.notaMedia != null ? [{ valor: r.notaMedia.toLocaleString("pt-BR", { maximumFractionDigits: 1 }), rotulo: "nota média no Google" }] : [])],
        tabela: { colunas: ["Nº", "Academia", "Nota", "Horário", "Outras modalidades"], larguras: [4, 26, 10, 13, 30], linhas },
        paragrafo: `A tabela mostra as ${um(linhas.length)} academias mais próximas, com o mesmo número da lista. "+dom" = abre no domingo. "Não encontradas" = não foi possível encontrar outras modalidades além de musculação.`,
      });
    }
  }

  return secoes;
}

export function montarPdfUnidade(d: DadosPdfUnidade): ConteudoPdf {
  const { u, faixa, perfil, renda } = d;
  const area = d.temArea ? `na área de até ${d.minutos} minutos de carro` : "na área onde moram 80% dos alunos";
  const mes = (d.hoje ?? new Date()).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const alunosNaArea = u.alunos != null && d.parteNaArea != null ? u.alunos * d.parteNaArea : null;
  const { conc, moradores, habPorAcademia, nivelConcorrencia, perfilRenda } = resumoMercado({ perfil, renda, pois: d.pois, alunosNaArea });
  const secoes: Secao[] = [];

  // ---------- Resumo (página principal) ----------
  const resumo: string[] = [];
  if (u.vendas != null) {
    resumo.push(`A World Gym ${u.nome} vende em média ${reais(u.vendas)} por mês${u.m2 ? ` em ${num(u.m2)} m²` : ""}, o equivalente a ${d.porM2 ? `R$ ${num(d.porM2)}` : "—"} por m²${faixa ? `, contra R$ ${num(faixa.mediana)} da mediana das unidades maduras da rede${Number.isFinite(faixa.p25) && Number.isFinite(faixa.p75) ? ` (metade das unidades fica entre R$ ${num(faixa.p25)} e R$ ${num(faixa.p75)})` : ""}` : ""}. ${d.comparado == null ? "" : d.comparado >= 0.1 ? `É um resultado ${Math.round(d.comparado * 100)}% acima da rede para o tamanho do imóvel, o que coloca a unidade entre as que mais extraem resultado de cada metro quadrado.` : d.comparado <= -0.1 ? `É um resultado ${Math.abs(Math.round(d.comparado * 100))}% abaixo da rede para o tamanho do imóvel: o espaço está subaproveitado e há margem para crescer sem ampliar a área.` : "O resultado está em linha com a rede para o tamanho do imóvel."}`);
  }
  if (u.previsto && u.vendas != null && u.madura) {
    resumo.push(`Pelo tamanho do imóvel, o modelo da rede esperaria ${reais(u.previsto.provavel)} por mês (faixa de ${reais(u.previsto.pessimista)} a ${reais(u.previsto.otimista)}). ${u.vendas > u.previsto.otimista ? "A unidade supera a faixa, sinal de que o ponto e a gestão rendem mais do que o tamanho explica." : u.vendas < u.previsto.pessimista ? "A unidade fica abaixo da faixa: o tamanho comportaria mais vendas, e as páginas a seguir mostram onde estão os entraves." : "A unidade está dentro da faixa esperada."}`);
  } else if (!u.madura) resumo.push("A unidade tem menos de 12 meses de operação: a comparação com a rede vale a partir da maturidade.");
  if (alunosNaArea != null && moradores) resumo.push(`${pct(d.parteNaArea, 0)} dos ${num(u.alunos!)} alunos ativos moram ${area}, onde vivem ${mil(moradores)} pessoas.`);
  const barrasM2 = faixa && d.porM2 && Number.isFinite(faixa.mediana) ? {
    tipo: "barras" as const, titulo: "Vendas por m² por mês: unidade x rede",
    itens: [
      { rotulo: `World Gym ${u.nome}`, valor: d.porM2, texto: `R$ ${num(d.porM2)}`, destaque: true },
      ...(Number.isFinite(faixa.p75) ? [{ rotulo: "Rede: quartil superior", valor: faixa.p75, texto: `R$ ${num(faixa.p75)}` }] : []),
      { rotulo: "Rede: mediana", valor: faixa.mediana, texto: `R$ ${num(faixa.mediana)}` },
      ...(Number.isFinite(faixa.p25) ? [{ rotulo: "Rede: quartil inferior", valor: faixa.p25, texto: `R$ ${num(faixa.p25)}` }] : []),
    ],
  } : undefined;

  // ---------- Metodologia (página própria, antes da unidade) ----------
  const metodologia: Secao = {
    titulo: "", linhas: [],
    texto: ["A análise foi realizada considerando os seguintes critérios e fontes de dados:"],
    lista: [
      d.temArea ? `Área de influência de até ${d.minutos} minutos de deslocamento de carro, calculada pelas ruas (Mapbox)` : "Área onde moram 80% dos alunos",
      "População total, faixa etária e domicílios (Censo 2022, IBGE, por setor censitário)",
      "Renda média do responsável e classes de renda (Censo 2022)",
      "Potencial de consumo em recreações e esportes (POF 2017-2018, IBGE)",
      `Base de clientes ativos por bairro e vendas da unidade (EVO, ${mes})`,
      "Mapeamento das academias concorrentes (Google)",
      "Premissas da rede: régua de vendas por m² das unidades maduras, população recomendada e fatia do potencial de consumo calibradas com as unidades",
    ],
    paragrafo: "Os dados do Censo são agregados em hexágonos de cerca de 200 m e contados quando o centro do hexágono cai dentro da área. Contagens de alunos são totais por bairro, sem dado pessoal.",
  };

  // ---------- Base de clientes ativos ----------
  if (d.topBairros.length) {
    const top3 = d.topBairros.slice(0, 3).reduce((a, b) => a + b[3], 0) / Math.max(1, d.alunosBairro);
    const texto: string[] = [];
    texto.push(`Os ${num(d.alunosBairro)} alunos com bairro identificado se concentram em ${d.topBairros[0][0]} (${pct(d.topBairros[0][3] / Math.max(1, d.alunosBairro), 0)}), ${d.topBairros.slice(1, 3).map((b) => b[0]).join(" e ")}: os três primeiros bairros somam ${pct(top3, 0)} da base. ${top3 >= 0.7 ? "É uma base muito concentrada, típica de unidade de bairro, que depende da força local da marca." : top3 >= 0.45 ? "A concentração é moderada: há um núcleo forte e captação complementar nos bairros vizinhos." : "A base é espalhada, sinal de que a unidade atrai de longe (avenida de passagem, polo comercial ou pouca oferta na região)."}`);
    if (d.parteNaArea != null) texto.push(`${pct(d.parteNaArea, 0)} da base mora ${area} e 80% dos alunos moram a até ${d.onde80}. ${d.parteNaArea >= 0.8 ? "A área de 10 minutos explica quase toda a base: é nela que se concentram as ações de marketing e as parcerias." : "Uma parte relevante da base vem de fora da área de 10 minutos: vale entender o que atrai esses alunos (trabalho, estudo ou trajeto) e reforçar esse canal."}`);
    secoes.push({
      titulo: "Base de Clientes Ativos", novaPagina: true, linhas: [], texto,
      ...(d.fotos.alunos ? { foto: { dados: d.fotos.alunos, legenda: "Concentração de alunos ativos pelo CEP (mais forte = mais alunos)." }, altFoto: ALT_FOTO_MAPA } : {}),      grafico: d.parteNaArea != null ? { tipo: "rosca", fatias: [{ rotulo: `Moram ${area}`, valor: d.parteNaArea, cor: "#1e3a8a" }, { rotulo: "Moram fora da área", valor: 1 - d.parteNaArea, cor: "#d6d9e0" }], centro: pct(d.parteNaArea, 0), rotuloCentro: "na área" } : undefined,
      tabela: { colunas: ["Bairro", "Alunos", "%"], larguras: [2.4, 0.8, 0.6], blocos: 2, linhas: d.topBairros.map(([b, , , n]) => [b, num(n), pct(n / Math.max(1, d.alunosBairro), 0)]) },
    });
  }

  // ---------- Lacuna e zonas de captação (uma página só: a foto da lacuna já leva os anéis das zonas) ----------
  const zonasOk = !!d.zonas && d.zonas.lista.length >= 3;
  if (d.fotos.oportunidade || zonasOk) {
    const texto: string[] = [];
    if (d.fotos.oportunidade) {
      texto.push(`O mapa compara duas medidas, cada uma como a parte que o local tem do total da área: onde o modelo da rede espera alunos (moradores, distância até a unidade e outras World Gym por perto) e onde os alunos ativos moram de verdade (CEP do cadastro). Em magenta fica a lacuna, onde o esperado é maior que o real: são as prioridades para panfletagem, parcerias com empresas e mídia geolocalizada. Sem cor, a unidade já capta o esperado.`);
      if (d.esperadoNaArea != null && d.parteNaArea != null) texto.push(`Pelo modelo, ${pct(d.esperadoNaArea, 0)} dos alunos deveriam morar ${area}; na prática são ${pct(d.parteNaArea, 0)}. ${d.parteNaArea < d.esperadoNaArea - 0.05 ? "A unidade capta abaixo do esperado no entorno imediato: o maior potencial de crescimento está perto da porta, e não em bairros distantes." : d.parteNaArea > d.esperadoNaArea + 0.05 ? "A unidade já domina o entorno imediato: o crescimento passa por atrair público de fora da área (trajeto casa-trabalho, empresas e faculdades)." : "A captação no entorno está em linha com o esperado; o ganho vem de aumentar a participação nos bairros com mais moradores."}`);
    }
    let tabela: Secao["tabela"];
    if (zonasOk) {
      const [z1, z2] = d.zonas!.lista, km1 = (v: number) => `${dec(v, 1)} km`;
      texto.push(`As zonas mostram até onde a unidade chega, pela contagem real de alunos ativos por CEP (${num(d.zonas!.total)} alunos com CEP localizado). Cada zona é o menor círculo, em linha reta, que reúne uma fatia dos alunos: 70% na primária e 90% na secundária. ${pct(z1.parte, 0)} dos alunos moram a até ${km1(z1.r)} da unidade e ${pct(z2.parte, 0)} a até ${km1(z2.r)}.${d.zonas!.na10 != null ? ` A área de 10 minutos de carro reúne ${pct(d.zonas!.na10, 0)} dos alunos.` : ""}${d.fotos.oportunidade ? " Magenta dentro do anel da zona primária é a lacuna mais fácil de captar, porque o aluno já costuma vir dali; magenta além da secundária pede mais esforço." : ""}`);
      tabela = { colunas: ["Zona", "Distância", "% dos alunos", "Moradores no raio", "Alunos entre os moradores"], larguras: [1.1, 1.3, 1.1, 1.4, 1.6], linhas: d.zonas!.lista.slice(0, 2).map((z, i) => [["Primária", "Secundária"][i] ?? "", i === 0 ? `até ${km1(z.r)}` : `${km1(d.zonas!.lista[i - 1].r)} a ${km1(z.r)}`, pct(z.parte - (d.zonas!.lista[i - 1]?.parte ?? 0), 0), num(z.moradores), pct(z.moradores ? z.alunos / z.moradores : null, 1)]) };
    }
    secoes.push({
      titulo: d.fotos.oportunidade && zonasOk ? "Lacuna e Zonas de Captação" : zonasOk ? "Zonas de Captação" : "Lacuna de Captação", novaPagina: true, linhas: [], texto,
      ...(d.fotos.oportunidade ? { foto: { dados: d.fotos.oportunidade, legenda: `Magenta: onde o modelo espera mais alunos do que a unidade tem (mais forte = maior lacuna). ${zonasOk ? "Anéis tracejados: zona primária (vermelho) e secundária (laranja). " : ""}Sem cor: a unidade já capta o esperado.` } } : {}),
      ...(tabela ? { tabela } : {}),
    });
  }

  const mercadoU = separarConcorrencia(secoesDeMercado({ tipo: "unidade", nome: u.nome, area, vendas: u.vendas, alunosNaArea, perfil, renda, potencial: d.potencial, densidade: d.densidade, rendaTotal: d.rendaTotal, comercio: d.comercio, pois: d.pois, fotos: d.fotos }));
  secoes.push(...mercadoU.antes);

  // ---------- Canibalização ----------
  const perda = d.divideCom.reduce((a, x) => a + x.parte, 0);
  secoes.push({
    titulo: "Canibalização com a Rede", novaPagina: true, linhas: [],
    texto: [d.divideCom.length
      ? `A área da unidade se sobrepõe à de outras World Gym. Pelo modelo de captação, ${d.divideCom.map((x) => `${pct(x.parte, 0)} do potencial é disputado com a ${x.nome}`).join(", ")}. ${perda >= 0.25 ? "É uma sobreposição alta: ações comerciais devem ser coordenadas entre as unidades para não disputar o mesmo aluno com desconto, e novas aberturas nessa direção pedem cuidado." : "É uma sobreposição moderada, comum em redes adensadas; vale combinar campanhas entre as unidades para cobrir os bairros de fronteira."}`
      : "Nenhuma outra World Gym divide de forma relevante a área desta unidade: não há canibalização dentro da rede, e o crescimento depende só da disputa com a concorrência externa.",
      ...(fraseUnidadesProximas(d.proximas, "unidade") ? [fraseUnidadesProximas(d.proximas, "unidade")] : []),
      ...(d.canibalObservada ? [`Pelos alunos de verdade (CEP): ${pct(d.canibalObservada.algumaOutra, 0)} dos alunos moram mais perto de outra World Gym do que da ${u.nome}. ${d.canibalObservada.itens.map((x) => `${pct(x.meusPertoDela, 0)} dos alunos daqui moram mais perto da ${x.nome.replace("World Gym ", "")} (${dec(x.km, 1)} km), e ${pct(x.delaPertoDaqui, 0)} dos alunos dela moram mais perto daqui`).join("; ")}. Distâncias em linha reta; os percentuais por vizinha não somam.`] : [])],
    foto: { dados: d.fotos.rede, legenda: "Pinos vermelhos pequenos: outras World Gym. Círculos: área de cada uma." }, altFoto: ALT_FOTO_MAPA,
    grafico: d.divideCom.length ? { tipo: "rosca", titulo: "Potencial de captação da unidade", fatias: [{ rotulo: `Só da World Gym ${u.nome}`, valor: Math.max(0, 1 - perda), cor: "#c41230" }, ...d.divideCom.map((x, i) => ({ rotulo: `Dividido com ${x.nome}`, valor: x.parte, cor: ["#f0a0ad", "#e7c3ca", "#d6d9e0"][i] ?? "#d6d9e0" }))] } : undefined,
  });

  secoes.push(...mercadoU.concorrencia);

  // ---------- Unidades parecidas ----------
  if (d.parecidas?.itens.length) secoes.push({
    titulo: "Unidades Parecidas na Rede", novaPagina: true, linhas: [],
    texto: [leituraParecidas(d.parecidas, u.vendas), ...d.parecidas.itens.map((it) => `${it.leitura} A WG ${it.u.nome} vende ${it.u.vendas ? reais(it.u.vendas) : "—"} por mês${it.parecida ? "." : " (vizinhança diferente: só referência)."}`)],
    tabela: { colunas: ["Unidade", "Vendas por mês", "Moradores (2 km)", "Renda média", "Parecida?"], larguras: [1.6, 1, 1, 1, 0.8], linhas: [
      [`${u.nome} (esta)`, u.vendas != null ? reais(u.vendas) : "—", mil(d.parecidas.alvo.pop), d.parecidas.alvo.renda ? `R$ ${num(d.parecidas.alvo.renda)}` : "—", ""],
      ...d.parecidas.itens.map((it) => [it.u.nome, it.u.vendas ? reais(it.u.vendas) : "—", mil(it.moradores), it.renda ? `R$ ${num(it.renda)}` : "—", it.parecida ? "sim" : "não"]),
    ] },
    paragrafo: "Unidades maduras do mesmo modelo, comparadas pelos moradores e pela renda média a até 2 km (Censo 2022). Com vizinhança parecida, a diferença de vendas tende a vir da operação (gestão, equipe, preço), e não do ponto.",
  });

  // ---------- Nova unidade na região ----------
  if (d.novaUnidade) {
    secoes.push({
      titulo: "Oportunidade de Nova Unidade", novaPagina: true, linhas: [],
      texto: [textoSugestoes(d.novaUnidade, "nova", u.nome), LIMITES_SUGESTAO],
      foto: d.fotos.nova ? { dados: d.fotos.nova, legenda: "Pinos cinza numerados: regiões sugeridas. Pinos vermelhos pequenos: World Gym em operação." } : undefined, altFoto: ALT_FOTO_MAPA,
      ...(d.novaUnidade.sugestoes.length ? { tabela: { colunas: ["Região", "Endereço aproximado", "Distância", "Público", "Renda média", "Divide com a rede"], larguras: [0.55, 2.4, 0.8, 0.8, 0.95, 1.6], linhas: linhasSugestoes(d.novaUnidade, d.enderecosNova) } } : {}),
    });
  }

  // ---------- Conclusão ----------
  const conclusao: string[] = [];
  conclusao.push(`A World Gym ${u.nome} ${u.vendas != null ? `vende ${reais(u.vendas)} por mês` : "está em operação"}${d.comparado != null ? `, ${Math.abs(Math.round(d.comparado * 100))}% ${d.comparado >= 0 ? "acima" : "abaixo"} da média da rede por m²` : ""}${u.alunos != null ? `, com ${num(u.alunos)} alunos ativos` : ""}. ${!u.madura ? "Como ainda não completou 12 meses, a leitura de resultado é preliminar." : d.comparado != null && d.comparado >= 0.1 ? "O ponto e a operação mostram força: o desafio é proteger a base e defender a posição contra a entrada de novos concorrentes." : d.comparado != null && d.comparado <= -0.1 ? "O imóvel comporta mais vendas do que entrega hoje, e o diagnóstico abaixo indica onde agir." : "O desempenho está em linha com a rede, com espaço para ganhos pontuais."}`);
  const demanda: string[] = [];
  if (moradores) demanda.push(`${area} vivem ${mil(moradores)} pessoas${perfil?.domicilios ? ` em ${mil(perfil.domicilios)} domicílios` : ""}`);
  if (perfil?.parte20a49 != null) demanda.push(`${pct(perfil.parte20a49, 0)} delas com 20 a 49 anos`);
  if (renda) demanda.push(`perfil ${perfilRenda} (${pct(renda.cde, 0)} nas classes C, D e E)`);
  const base: string[] = [];
  if (d.parteNaArea != null) base.push(`${pct(d.parteNaArea, 0)} dos alunos moram ${area} e 80% deles a até ${d.onde80}`);
  if (d.topBairros.length >= 3) base.push(`os três bairros com mais alunos (${d.topBairros.slice(0, 3).map((b) => b[0]).join(", ")}) somam ${pct(d.topBairros.slice(0, 3).reduce((a, b) => a + b[3], 0) / Math.max(1, d.alunosBairro), 0)} da base`);
  if (d.esperadoNaArea != null && d.parteNaArea != null) base.push(`o modelo esperaria ${pct(d.esperadoNaArea, 0)} dos alunos dentro da área, ${d.parteNaArea < d.esperadoNaArea - 0.05 ? "o que mostra demanda ainda não capturada perto da unidade" : d.parteNaArea > d.esperadoNaArea + 0.05 ? "o que mostra que a unidade já domina o entorno e passa a crescer atraindo público de fora" : "em linha com o que a unidade capta hoje"}`);
  if (base.length) conclusao.push(`Na base de clientes, ${base.join("; ")}.`);
  if (d.potencial) demanda.push(`potencial de consumo de cerca de R$ ${num(d.potencial.total)} por mês em recreações e esportes`);
  if (perfil?.porDomicilio) demanda.push(`${dec(perfil.porDomicilio)} moradores por domicílio (Brasil: ${dec(MEDIA_BRASIL_DOMICILIO)})`);
  if (demanda.length) conclusao.push(`Do lado da demanda, ${demanda.join(", ")}. ${renda && renda.cde >= 0.75 ? "É um mercado de volume, em que preço de entrada competitivo, régua de cobrança eficiente e retenção pesam mais que serviços adicionais." : "O público comporta oferta em mais de uma faixa de preço, o que abre espaço para planos de maior valor e receitas complementares."}`);
  if (conc && habPorAcademia != null) conclusao.push(`A concorrência é ${nivelConcorrencia}: ${conc.diretos} concorrentes diretos${conc.nomesRedes.length ? `, entre eles ${conc.nomesRedes.map((r) => r.rede).join(", ")}` : ""}, e ${num(habPorAcademia)} habitantes por academia.`);
  else conclusao.push("A leitura de concorrência não entrou neste estudo porque as academias concorrentes não foram buscadas antes de exportar; recomenda-se gerar o PDF com a busca feita.");
  conclusao.push(d.divideCom.length ? `Dentro da rede, a unidade divide ${pct(perda, 0)} do potencial com ${d.divideCom.map((x) => x.nome).join(" e ")}, o que pede coordenação comercial entre as unidades.` : "Dentro da rede não há canibalização relevante.");
  const acoes: string[] = [];
  if (d.parteNaArea != null && d.esperadoNaArea != null && d.parteNaArea < d.esperadoNaArea - 0.05) acoes.push("concentrar marketing e parcerias nos bairros da área de 10 minutos onde a demanda potencial é alta e a base é pequena");
  if (d.topBairros[0]) acoes.push(`defender a base em ${d.topBairros[0][0]}, que sozinho responde por ${pct(d.topBairros[0][3] / Math.max(1, d.alunosBairro), 0)} dos alunos`);
  if (nivelConcorrencia === "alta" || nivelConcorrencia === "saturada") acoes.push("monitorar preço e lançamentos das redes vizinhas e reforçar retenção (onboarding, avaliação e acompanhamento dos primeiros 90 dias)");
  if (renda && renda.cde >= 0.75) acoes.push("manter plano de entrada competitivo e usar o recorrente para reduzir inadimplência");
  if (d.comparado != null && d.comparado <= -0.1) acoes.push("revisar ocupação do espaço e horários de pico para converter a área ociosa em vendas");
  conclusao.push(`Recomendação: ${acoes.length ? acoes.join("; ") : "manter a estratégia atual e acompanhar os indicadores mês a mês"}.`);
  const faixaConclusao = !u.madura ? "Unidade em maturação: acompanhar até 12 meses" : d.comparado != null && d.comparado >= 0.1 ? "Unidade forte: proteger a base e crescer no entorno" : d.comparado != null && d.comparado <= -0.1 ? "Unidade abaixo do potencial: plano de captação" : "Unidade em linha com a rede: ganhos pontuais";
  secoes.push({ titulo: "Conclusão e Recomendação", novaPagina: true, linhas: [], faixa: faixaConclusao, texto: conclusao,
    paragrafo: `Os números de mercado usam premissas (classes estimadas pela renda média do Censo e gasto da POF corrigido pela inflação) e devem ser lidos como ordem de grandeza.` });

  return {
    arquivo: nomeDoArquivo(`estudo-unidade-${u.nome}`), cabecalho: "Estudo da unidade", foto: null,
    capa: { titulo: "Estudo de Geomarketing", linha: "Estudo da Unidade", subtitulo: `World Gym ${u.nome}${u.m2 ? ` | ${num(u.m2)} m²` : ""}${u.endereco ? `\n${u.endereco}` : ""}` }, // e o endereço oficial embaixo (23/11/2026)
    paginas: [{
      titulo: "Objetivo do Estudo", subtitulo: "", numeros: [], secoes: [],
      texto: [`O presente estudo de geomarketing tem como objetivo avaliar o desempenho da World Gym ${u.nome} e o mercado em volta dela, considerando critérios demográficos, socioeconômicos, concorrenciais e de rede, por meio da análise de:`],
      lista: ["Base de clientes ativos e oportunidades de captação", "Dados demográficos e domiciliares", "Indicadores socioeconômicos e potencial de consumo", "Análise concorrencial", "Sobreposição com a rede World Gym e oportunidade de nova unidade"],
      destaque: "O material foi desenvolvido para subsidiar decisões do comitê de expansão e da gestão da unidade, alinhado ao modelo de negócio da World Gym.",
    }, {
      titulo: "Metodologia de Análise", subtitulo: "", numeros: [], secoes: [metodologia],
    }, {
      titulo: `World Gym ${u.nome}`, subtitulo: `Estudo da unidade${u.m2 ? ` · ${num(u.m2)} m²` : ""}${u.madura ? "" : " · ainda amadurecendo (menos de 12 meses)"}`,
      foto: { dados: d.fotos.sat, legenda: "A unidade vista de cima (imagem de satélite)." },
      destaques: [
        { valor: d.porM2 ? `R$ ${num(d.porM2)}` : "—", rotulo: `vendas por m² por mês${faixa ? ` (rede: R$ ${num(faixa.mediana)})` : ""}` },
        d.parteNaArea != null ? { valor: pct(d.parteNaArea, 0), rotulo: `dos alunos moram a até ${d.minutos} min de carro` } : { valor: d.onde80, rotulo: "onde moram 80% dos alunos" },
        { valor: u.alunos != null ? num(u.alunos) : "—", rotulo: "alunos ativos" },
      ],
      texto: resumo, grafico: barrasM2,
      numeros: [], secoes,
    }],
  };
}
