// Contas do estudo de ponto (sem tela e sem rede): vendas previstas pelo tamanho do imóvel, custo, payback, veredito,
// mapa de calor da captação e unidades parecidas. As premissas (números) vêm do servidor; aqui só as fórmulas.

export type Modelo = "low" | "pro";
export interface PremissaModelo { nome: string; padraoM2: number; investimento: number; fixoBase: number; fixoPorM2: number; /** Aluguel por m² que está dentro do custo fixo por m². O aluguel real do ponto troca esta parte; sem ele (premissa não separa o aluguel), o aluguel só informa. */ aluguelPorM2?: number; variavel: number; limiteM2: number; pesoAcima: number; vendasPorM2?: number }
export interface Premissas {
  regua: { mesesAprovado: number; mesesAtencao: number; maturacaoMeses: number; maturidadeMeses?: number };
  modelos: Record<Modelo, PremissaModelo>;
  curva: { meiaDistanciaKm: number; raioKm: number };
}
export interface FaixaM2 { p25: number; mediana: number; p75: number; n: number }
/** `bairros`: onde moram os alunos ativos [bairro, lat, lng, alunos]; `previsto`: o que o modelo preveria pelo m² da unidade. */
export interface UnidadeEstudo {
  nome: string; c: [number, number] | null; /** Endereço oficial (Google Maps), público. */ endereco?: string | null; m2: number | null; modelo: Modelo; abertura: string | null; madura: boolean; vendas: number | null; alunos: number | null;
  bairros?: [string, number, number, number][]; previsto?: { pessimista: number; provavel: number; otimista: number };
  /** Ticket médio realizado no EVO (recebido ÷ clientes pagantes), média dos últimos meses fechados. */
  ticket?: number | null;
}
/**
 * Hexágonos do Censo 2022: [lat, lng, população, renda média do responsável, domicílios ocupados, moradores por faixa de idade].
 * Faixas (FAIXAS_IDADE): 0–9, 10–19, 20–29, 30–39, 40–49, 50–59, 60+ (as do Mapfry até 59 anos; o IBGE junta 60 a 69 numa faixa só).
 * Depois: domicílios com 1, 2, 3, 4 e 5 ou mais moradores (IBGE, Características do Domicílio parte 1) e domicílios por classe de renda
 * (AA, A, B, C, D, E), estimados em cada setor por uma curva lognormal com a média e a variância da renda do responsável. Os campos
 * do fim podem faltar em dados antigos.
 */
export type CelulaCenso = [number, number, number, number | null, number?, number[]?, number[]?, number[]?, (number | null)?, number?, number?];
/*
 * Malha v6 (23/11/2026, hexágonos de 200 m): depois das classes vêm a renda média do domicílio (a do responsável × o fator do estado),
 * o gasto mensal do hexágono com recreações e esportes (POF pela distribuição estimada da renda dos domicílios) e o número de pontos de
 * comércio e serviços do OpenStreetMap (lojas, escritórios, restaurantes, farmácias, bancos, escolas, clínicas), para a concentração comercial.
 */
/** A malha tem os campos da v6 (renda do domicílio, gasto e comércio). */
export const malhaV6 = (censo: Censo) => censo.celulas.some((c) => c[9] !== undefined);
/** Gasto mensal do hexágono com recreações e esportes: o da malha v6 ou, em malha antiga, domicílios × gasto pela renda média do responsável. */
export const gastoDoHexagono = (c: CelulaCenso) => (c[9] !== undefined ? c[9] : (c[4] ?? 0) * (gastoDoDomicilio(c[3]) ?? 0));
/** Renda total (soma da renda estimada dos domicílios) nos hexágonos escolhidos; null em malha antiga. */
export function rendaTotalEm(censo: Censo, dentro: (lat: number, lng: number) => boolean) {
  let total = 0, domicilios = 0;
  for (const c of censo.celulas) { if (c[8] == null || !c[4] || !dentro(c[0], c[1])) continue; total += c[8] * c[4]; domicilios += c[4]; }
  return domicilios ? { total, domicilios, porDomicilio: total / domicilios } : null;
}
/** Pontos de comércio e serviços (OpenStreetMap) nos hexágonos escolhidos; null em malha antiga. */
export function comercioEm(censo: Censo, dentro: (lat: number, lng: number) => boolean) {
  if (!censo.celulas.some((c) => c[10] !== undefined)) return null;
  return censo.celulas.reduce((a, c) => a + (dentro(c[0], c[1]) ? c[10] ?? 0 : 0), 0);
}
/** Domicílios por número de moradores, como no Mapfry (cores na ordem: 1, 2, 3, 4, 5 ou mais). */
export const TAMANHOS_DOMICILIO = [
  { rotulo: "1 morador", cor: "#e9c46a" }, { rotulo: "2 moradores", cor: "#e07a9a" }, { rotulo: "3 moradores", cor: "#3a9bd5" },
  { rotulo: "4 moradores", cor: "#2a9d8f" }, { rotulo: "5 ou mais moradores", cor: "#6a4c93" },
];
/** Tamanho de domicílio que mais aparece no hexágono (índice de TAMANHOS_DOMICILIO), ou null sem o dado. */
export const tamanhoPredominante = (t?: number[]) => (t?.length && t.some((x) => x > 0) ? t.indexOf(Math.max(...t)) : null);
export interface Censo { rk: number; celulas: CelulaCenso[] }
export const FAIXAS_IDADE = ["Crianças (0 a 9 anos)", "Adolescentes (10 a 19 anos)", "Jovens (20 a 29 anos)", "Jovens adultos (30 a 39 anos)", "Adultos (40 a 49 anos)", "Meia idade (50 a 59 anos)", "Idosos (60 anos ou mais)"];

/**
 * Potencial de consumo em academia: gasto médio mensal das famílias com "Recreações e esportes" (IBGE, POF 2017-2018, tabela 1.1.1),
 * por faixa de rendimento familiar em salários mínimos de 2018 (R$ 954): até 2, 2–3, 3–6, 6–10, 10–15, 15–25 e mais de 25 SM.
 * Na malha v6 o gasto já vem por hexágono, calculado com a renda estimada dos domicílios (a do responsável × a relação do estado) espalhada
 * entre as faixas; em malha antiga, a renda média do responsável (Censo 2022, SM de R$ 1.212) faz as vezes da renda da família (conservador).
 * Valores de 2018 corrigidos pelo IPCA até 2026 (CORRECAO_POF, estimativa).
 */
export const POF_RECREACAO_ESPORTES = [{ ateSm: 2, gasto: 3.94 }, { ateSm: 3, gasto: 6.43 }, { ateSm: 6, gasto: 14.41 }, { ateSm: 10, gasto: 34.11 }, { ateSm: 15, gasto: 49.75 }, { ateSm: 25, gasto: 87.96 }, { ateSm: Infinity, gasto: 155.75 }];
export const CORRECAO_POF = 1.56;
const SM_CENSO = 1212;
/** Gasto mensal estimado de um domicílio com recreações e esportes (R$ de hoje) pela renda média do responsável. */
export const gastoDoDomicilio = (renda: number | null | undefined) =>
  renda == null || renda <= 0 ? null : POF_RECREACAO_ESPORTES.find((f) => renda / SM_CENSO <= f.ateSm)!.gasto * CORRECAO_POF;
/** Potencial mensal de consumo em recreações e esportes dentro da área (domicílios × gasto pela renda). */
export function potencialNaArea(censo: Censo, g: Geometria) {
  let total = 0, domicilios = 0;
  const v6 = malhaV6(censo);
  for (const c of censo.celulas) {
    const [lat, lng, , r, d] = c;
    if (!d || !dentroDaArea(lat, lng, g)) continue;
    if (!v6 && gastoDoDomicilio(r) == null) continue;
    total += gastoDoHexagono(c); domicilios += d;
  }
  return domicilios ? { total, domicilios, porDomicilio: total / domicilios } : null;
}

/** Uma cor por faixa de idade (mapa: cada hexágono na cor da faixa que predomina por ano de idade), na ordem de FAIXAS_IDADE. */
export const CORES_IDADE = ["#f2c94c", "#f2994a", "#e86a92", "#27ae60", "#2bb3a3", "#2f80ed", "#8e5bd6"];
/** Anos de idade em cada faixa (60+ conta como 60 a 79), para comparar faixas de tamanhos diferentes. */
export const ANOS_FAIXA = [10, 10, 10, 10, 10, 10, 20];
/**
 * Faixa de idade que predomina no hexágono, comparando moradores POR ANO de idade (a faixa de 60 anos ou mais junta uns 20 anos e
 * ganharia muitas vezes se comparada pelo total). Null sem dado.
 */
export const faixaPredominante = (ida?: number[]) => {
  if (!ida?.length) return null;
  const porAno = ida.map((v, i) => v / (ANOS_FAIXA[i] ?? 10));
  return porAno.indexOf(Math.max(...porAno));
};
/** Moradores de cada faixa de idade somados nos hexágonos escolhidos. */
export function idadeEm(censo: Censo, dentro: (lat: number, lng: number) => boolean): number[] | null {
  const t = Array(FAIXAS_IDADE.length).fill(0); let tem = false;
  for (const [la, ln, , , , ida] of censo.celulas) if (ida?.length && dentro(la, ln)) { ida.forEach((v, i) => (t[i] += v)); tem = true; }
  return tem ? t : null;
}

/** Faixas de moradores por domicílio (mapa e legenda de densidade residencial). */
export const CLASSES_DENSIDADE = [
  { rotulo: "até 2,4 moradores por domicílio", ate: 2.4, cor: "#c8e6f5" },
  { rotulo: "2,4 a 2,8", ate: 2.8, cor: "#7fc4e8" },
  { rotulo: "2,8 a 3,2", ate: 3.2, cor: "#3d93cc" },
  { rotulo: "3,2 a 3,6", ate: 3.6, cor: "#9b6bd6" },
  { rotulo: "acima de 3,6", ate: Infinity, cor: "#5b2a9e" },
];
export const classeDensidade = (porDom: number) => CLASSES_DENSIDADE.findIndex((c) => porDom <= c.ate);
/** Domicílios da área por faixa de moradores por domicílio (média de cada hexágono). */
export const densidadeNaArea = (censo: Censo, g: Geometria) => densidadeEm(censo, (lat, lng) => dentroDaArea(lat, lng, g)).classes;
/** Domicílios por faixa de moradores por domicílio nos hexágonos escolhidos, com o total e a média de moradores por domicílio. */
export function densidadeEm(censo: Censo, dentro: (lat: number, lng: number) => boolean) {
  // Com o dado do IBGE de domicílios por número de moradores, as faixas são 1, 2, 3, 4 e 5 ou mais (como no Mapfry);
  // sem ele, a média de moradores por domicílio de cada hexágono.
  const porTamanho = censo.celulas.some((c) => c[6]?.length);
  const faixas = porTamanho ? TAMANHOS_DOMICILIO : CLASSES_DENSIDADE;
  const dom = faixas.map(() => 0);
  let moradores = 0, total = 0;
  for (const [lat, lng, p, , d, , tam] of censo.celulas) {
    if (!d || !dentro(lat, lng)) continue;
    moradores += p; total += d;
    if (porTamanho) tam?.forEach((v, i) => (dom[i] += v));
    else dom[classeDensidade(p / d)] += d;
  }
  const soma = dom.reduce((a, b) => a + b, 0);
  return { classes: faixas.map((c, i) => ({ rotulo: c.rotulo, cor: c.cor, domicilios: dom[i], parte: soma ? dom[i] / soma : 0 })), total, porDomicilio: total ? moradores / total : null, porTamanho };
}

/** Gente, domicílios e idade dentro da área (hexágonos cujo centro cai nela). `null` nos campos que o Censo carregado não tem. */
export function perfilNaArea(censo: Censo, g: Geometria) {
  let moradores = 0, domicilios = 0, comDom = 0, comIdade = 0;
  const idade = FAIXAS_IDADE.map(() => 0);
  for (const [lat, lng, p, , d, ida] of censo.celulas) {
    if (!dentroDaArea(lat, lng, g)) continue;
    moradores += p;
    if (d != null) { domicilios += d; comDom += p; }
    if (ida?.length === FAIXAS_IDADE.length) { ida.forEach((x, i) => (idade[i] += x)); comIdade += p; }
  }
  const totalIdade = idade.reduce((a, b) => a + b, 0);
  return {
    moradores,
    domicilios: comDom ? domicilios : null,
    porDomicilio: comDom && domicilios ? comDom / domicilios : null,
    idade: comIdade ? idade : null,
    parte20a49: totalIdade ? (idade[2] + idade[3] + idade[4]) / totalIdade : null,
  };
}
/** `vagas`: vagas do próprio imóvel; `vagasPerto`: vagas de rua ou de parceria por perto (contam, mas são menos seguras). */
export interface ImovelItens { fachada: boolean; estacionamento: boolean; polo: boolean; aPe: boolean; vagas?: number; vagasPerto?: number }
/** `autor` vem do servidor (quem criou o estudo); ponto novo vai sem e fica com quem salvou. */
export type StatusDecisao = "analise" | "aprovado" | "recusado" | "unidade";
/** Sua decisão sobre o estudo. `previsao` guarda a conta do dia da decisão, para comparar depois com o real. */
export interface Decisao { status: StatusDecisao; em: string; comentario?: string; unidade?: string; previsao?: { provavel: number; pessimista: number; otimista: number } }
export interface Ponto { id: string; nome: string; regiao?: string; /** Endereço aproximado da posição (some quando o ponto é arrastado). */ endereco?: string; c: [number, number]; modelo: Modelo; m2: number; imovel: ImovelItens; autor?: { id: string; nome: string }; criadoEm?: string; atualizadoEm?: string; decisao?: Decisao; /** Vindo da planilha de imóveis: aluguel pedido (R$/mês), link do anúncio e observações. */ origem?: { aluguel?: number; link?: string; obs?: string } }
export const DECISAO_ROTULO: Record<StatusDecisao, string> = { analise: "Em análise", aprovado: "Aprovado", recusado: "Recusado", unidade: "Virou unidade" };
/** completo: dono e liberados (criam e decidem); consulta: Master (vê tudo, não edita); unidade: só a própria unidade, sem premissas. */
export type ModoEstudos = "completo" | "consulta" | "unidade";
export interface DadosEstudos { disponivel: boolean; modo?: ModoEstudos; /** No modo unidade: as unidades da pessoa. */ minhas?: string[]; premissas?: Premissas; vendasPorM2?: Record<Modelo, FaixaM2 | null>; unidades?: UnidadeEstudo[]; censo?: Censo | null; pontos?: Ponto[] }

export type Veredito = "aprovado" | "atencao" | "reprovado";
export interface Resultado {
  pessimista: number; provavel: number; otimista: number;
  investimento: number; custoFixo: number; lucro: number; payback: number;
  /** Aluguel real que entrou no custo fixo (null: custo fixo padrão da rede). */ aluguel: number | null;
  meta: number; limiteAtencao: number; veredito: Veredito; foraDaFaixa: boolean; m2Efetivo: number;
}

/** Distância em km (aproximação plana, boa para poucos km). */
export function km(a: [number, number], b: [number, number]): number {
  const dLat = (a[0] - b[0]) * 110.6;
  const dLng = (a[1] - b[1]) * 111.32 * Math.cos(((a[0] + b[0]) / 2) * (Math.PI / 180));
  return Math.hypot(dLat, dLng);
}

/** Até o limite do modelo o m² conta inteiro; acima dele, cada m² a mais conta só uma parte (a rede não tem experiência ali). */
export const m2Efetivo = (m2: number, p: PremissaModelo) => (m2 <= p.limiteM2 ? m2 : p.limiteM2 + (m2 - p.limiteM2) * p.pesoAcima);
export const investimentoDe = (m2: number, p: PremissaModelo) => (p.investimento * m2) / p.padraoM2;
/** Aluguel por m² que a premissa já considera dentro do custo fixo por m² (null: a premissa não separa o aluguel, e o aluguel real não corrige a conta). */
export const aluguelBaseDe = (p: PremissaModelo): number | null => (p.aluguelPorM2 != null && p.aluguelPorM2 >= 0 && p.aluguelPorM2 <= p.fixoPorM2 ? p.aluguelPorM2 : null);
/** Faixa de aluguel por m² que a conta aceita (R$ por m² por mês): fora dela é digitação errada e o valor é ignorado. */
export const ALUGUEL_M2_MIN = 5, ALUGUEL_M2_MAX = 150;
/** Aluguel informado no estudo, se servir para a conta: `ignorado` quando está fora da faixa (o custo fixo fica o padrão). */
export function aluguelDoPonto(ponto: { m2: number; origem?: { aluguel?: number } }): { valor: number | null; porM2: number | null; ignorado: boolean } {
  const a = ponto.origem?.aluguel;
  if (!a || !(a > 0) || !(ponto.m2 > 0)) return { valor: null, porM2: null, ignorado: false };
  const porM2 = a / ponto.m2;
  return porM2 < ALUGUEL_M2_MIN || porM2 > ALUGUEL_M2_MAX ? { valor: null, porM2, ignorado: true } : { valor: a, porM2, ignorado: false };
}
/** Custo fixo do mês. Com o aluguel real (e a premissa separando o aluguel), ele troca a parte de aluguel que a premissa já tinha no valor por m². */
export const custoFixoDe = (m2: number, p: PremissaModelo, aluguel: number | null = null) => p.fixoBase + p.fixoPorM2 * m2 + (aluguel != null && aluguelBaseDe(p) != null ? aluguel - (aluguelBaseDe(p) as number) * m2 : 0);
export const lucroDe = (vendas: number, m2: number, p: PremissaModelo, aluguel: number | null = null) => vendas * (1 - p.variavel) - custoFixoDe(m2, p, aluguel);
/** Meses para o investimento voltar, contando a maturação. Infinity quando não dá lucro. */
export function paybackDe(vendas: number, m2: number, p: PremissaModelo, maturacao: number, aluguel: number | null = null): number {
  const l = lucroDe(vendas, m2, p, aluguel);
  return l > 0 ? maturacao + investimentoDe(m2, p) / l : Infinity;
}
/** Vendas por mês que fazem o investimento voltar em `meses` (contando a maturação). */
export const vendasParaPayback = (meses: number, m2: number, p: PremissaModelo, maturacao: number, aluguel: number | null = null) =>
  (investimentoDe(m2, p) / Math.max(1, meses - maturacao) + custoFixoDe(m2, p, aluguel)) / (1 - p.variavel);

export function avaliarPonto(ponto: Pick<Ponto, "m2" | "modelo"> & { origem?: { aluguel?: number } }, premissas: Premissas, faixa: FaixaM2, fator = 1): Resultado {
  const p = premissas.modelos[ponto.modelo], r = premissas.regua;
  const ef = m2Efetivo(ponto.m2, p);
  // `fator`: ajuste pela captação do ponto (ajusteDeCaptacao); 1 = só o m² e o modelo
  const provavel = faixa.mediana * ef * fator, pessimista = faixa.p25 * ef * fator, otimista = faixa.p75 * ef * fator;
  const aluguel = aluguelBaseDe(p) != null ? aluguelDoPonto(ponto).valor : null; // aluguel real informado no estudo (fora da faixa de bom senso é ignorado; sem a premissa separar o aluguel, não corrige)
  const meta = vendasParaPayback(r.mesesAprovado, ponto.m2, p, r.maturacaoMeses, aluguel);
  const limiteAtencao = vendasParaPayback(r.mesesAtencao, ponto.m2, p, r.maturacaoMeses, aluguel);
  return {
    pessimista, provavel, otimista,
    investimento: investimentoDe(ponto.m2, p), custoFixo: custoFixoDe(ponto.m2, p, aluguel), aluguel,
    lucro: lucroDe(provavel, ponto.m2, p, aluguel), payback: paybackDe(provavel, ponto.m2, p, r.maturacaoMeses, aluguel),
    meta, limiteAtencao,
    veredito: provavel >= meta ? "aprovado" : provavel >= limiteAtencao ? "atencao" : "reprovado",
    foraDaFaixa: ponto.m2 > p.limiteM2, m2Efetivo: ef,
  };
}

/** Força com que um ponto puxa alunos a `d` km: cai pela metade a cada `meia` km (medido com onde moram os alunos da rede). */
export const atracao = (d: number, meia: number) => Math.pow(0.5, d / meia);

export interface Captacao { pesos: number[]; indices: number[]; raio80: number; populacao2km: number; divideCom: { nome: string; parte: number }[] }
/**
 * Mapa de calor: quanto de cada hexágono vai para o ponto, dividindo com as World Gym e os outros pontos em volta
 * (cada um atrai pelo próprio m²). `pesos[i]` é relativo (habitantes × parte do ponto), para colorir o mapa.
 */
/**
 * Um estudo só divide público com o ponto aberto se vai ser uma unidade de verdade (decisão do dono, 24/11/2026): "aprovado" pelo comitê,
 * ou "virou unidade" ainda fora das unidades em operação (as que já operam entram pela lista de unidades, sem contar duas vezes).
 * Estudo em análise ou recusado é só uma ideia: não tira aluno de ninguém e não entra no parecer.
 */
export function contaComoRival(o: Ponto, unidades: UnidadeEstudo[]): boolean {
  const st = o.decisao?.status ?? "analise";
  if (st === "aprovado") return true;
  if (st === "unidade") return !unidades.some((u) => u.nome === o.decisao?.unidade);
  return false;
}
export function captacaoDe(ponto: Ponto, censo: Censo, unidades: UnidadeEstudo[], outros: Ponto[], curva: Premissas["curva"]): Captacao {
  const rivais = [
    ...unidades.filter((u) => u.c && u.m2).map((u) => ({ nome: `World Gym ${u.nome}`, c: u.c as [number, number], m2: u.m2 as number })),
    ...outros.filter((o) => o.id !== ponto.id && contaComoRival(o, unidades)).map((o) => ({ nome: o.nome, c: o.c, m2: o.m2 })),
  ].filter((r) => km(r.c, ponto.c) < curva.raioKm * 2);
  const pesos: number[] = [], indices: number[] = [], perdas = new Map<string, number>();
  let total = 0, semRival = 0, populacao2km = 0;
  const dist: [number, number][] = [];
  censo.celulas.forEach(([lat, lng, pop], i) => {
    const d = km([lat, lng], ponto.c);
    if (d > curva.raioKm) return;
    if (d <= 2) populacao2km += pop;
    const meu = ponto.m2 * atracao(d, curva.meiaDistanciaKm);
    let soma = meu;
    const deles = rivais.map((r) => { const a = r.m2 * atracao(km([lat, lng], r.c), curva.meiaDistanciaKm); soma += a; return a; });
    const v = pop * (meu / soma) * atracao(d, curva.meiaDistanciaKm);
    const vSem = pop * atracao(d, curva.meiaDistanciaKm);
    rivais.forEach((r, k) => perdas.set(r.nome, (perdas.get(r.nome) ?? 0) + vSem * (deles[k] / soma)));
    pesos.push(v); indices.push(i); total += v; semRival += vSem; dist.push([d, v]);
  });
  dist.sort((a, b) => a[0] - b[0]);
  let acum = 0, raio80 = 0;
  for (const [d, v] of dist) { acum += v; if (acum >= total * 0.8) { raio80 = d; break; } }
  const divideCom = [...perdas.entries()].map(([nome, v]) => ({ nome, parte: semRival ? v / semRival : 0 })).filter((x) => x.parte >= 0.05).sort((a, b) => b.parte - a.parte).slice(0, 3);
  return { pesos, indices, raio80, populacao2km, divideCom };
}

/**
 * Público alcançável de uma posição: moradores ponderados pela distância (a mesma curva da captação), já descontado o que as
 * World Gym e os outros pontos em volta dividem. É a "nota" para comparar posições na mesma região; não é previsão de vendas.
 */
export function publicoAlcancavel(c: [number, number], m2: number, censo: Censo, unidades: UnidadeEstudo[], outros: Ponto[], curva: Premissas["curva"]) {
  const cap = captacaoDe({ id: "__teste", nome: "", c, modelo: "low", m2, imovel: { fachada: false, estacionamento: false, polo: false, aPe: false } } as Ponto, censo, unidades, outros, curva);
  const publico = cap.pesos.reduce((a, b) => a + b, 0);
  return { publico, divideCom: cap.divideCom, renda: arredores(c, censo, 2).renda, populacao2km: cap.populacao2km };
}
// ---------- Ajuste das vendas previstas pela captação do ponto (decisão do dono, 25/11/2026) ----------
// A previsão era R$ por m² da rede × m² e não olhava o lugar. Agora ela é corrigida pelo público alcançável do ponto contra o das unidades maduras do
// mesmo modelo. O efeito vem da própria rede: elasticidade = quanto as vendas por m² mudam, em proporção, quando o público muda (regressão em log
// nas unidades maduras). Em 25/11/2026 (16 Low Cost) deu ~0,13 com correlação 0,23: o lugar explica pouco das vendas, então o ajuste é pequeno e limitado.
export const ELASTICIDADE_MAXIMA = 0.3;
export const FATOR_AJUSTE_MIN = 0.85;
export const FATOR_AJUSTE_MAX = 1.15;
export const MIN_UNIDADES_AJUSTE = 10;
export interface AjusteCaptacao { fator: number; publico: number; mediana: number; razao: number; elasticidade: number; n: number }
interface RefsCaptacao { mediana: number; elasticidade: number; n: number }
const cacheRefsCaptacao = new WeakMap<UnidadeEstudo[], { censo: Censo; porModelo: Map<string, RefsCaptacao | null> }>();

function refsDeCaptacao(modelo: Modelo, premissas: Premissas, censo: Censo, unidades: UnidadeEstudo[]): RefsCaptacao | null {
  let c = cacheRefsCaptacao.get(unidades);
  if (!c || c.censo !== censo) { c = { censo, porModelo: new Map() }; cacheRefsCaptacao.set(unidades, c); }
  if (c.porModelo.has(modelo)) return c.porModelo.get(modelo) ?? null;
  const pad = premissas.modelos[modelo]?.padraoM2 ?? 1200;
  const maduras = unidades.filter((u) => u.madura && u.modelo === modelo && u.c && u.m2 && u.vendas);
  let out: RefsCaptacao | null = null;
  if (maduras.length >= MIN_UNIDADES_AJUSTE) {
    const pubs = maduras.map((u) => publicoAlcancavel(u.c as [number, number], pad, censo, unidades.filter((x) => x.nome !== u.nome), [], premissas.curva).publico);
    const vm2 = maduras.map((u) => (u.vendas as number) / (u.m2 as number));
    const ok = pubs.map((v, i) => i).filter((i) => pubs[i] > 0 && vm2[i] > 0);
    if (ok.length >= MIN_UNIDADES_AJUSTE) {
      const med = (a: number[]) => { const v = [...a].sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };
      const mp = med(ok.map((i) => pubs[i])), mv = med(ok.map((i) => vm2[i]));
      const x = ok.map((i) => Math.log(pubs[i] / mp)), y = ok.map((i) => Math.log(vm2[i] / mv));
      const mx = x.reduce((a, b) => a + b, 0) / x.length, my = y.reduce((a, b) => a + b, 0) / y.length;
      const cov = x.reduce((a, v, i) => a + (v - mx) * (y[i] - my), 0), vx = x.reduce((a, v) => a + (v - mx) ** 2, 0);
      out = { mediana: mp, elasticidade: vx > 0 ? Math.min(ELASTICIDADE_MAXIMA, Math.max(0, cov / vx)) : 0, n: ok.length };
    }
  }
  c.porModelo.set(modelo, out);
  return out;
}

/**
 * Fator que corrige as vendas previstas pelo lugar. Sem unidades maduras suficientes do modelo (o Pro tem 3), sem Censo na região do ponto ou sem público,
 * não há ajuste (null) e a previsão fica só pelo m² e pelo modelo. O fator fica entre FATOR_AJUSTE_MIN e FATOR_AJUSTE_MAX.
 */
export function ajusteDeCaptacao(ponto: Pick<Ponto, "c" | "m2" | "modelo">, premissas: Premissas, censo: Censo | null | undefined, unidades: UnidadeEstudo[]): AjusteCaptacao | null {
  if (!censo || !premissas.curva) return null;
  const ref = refsDeCaptacao(ponto.modelo, premissas, censo, unidades);
  if (!ref) return null;
  if (!censo.celulas.some((c) => c[2] > 0 && km([c[0], c[1]], ponto.c) < 3)) return null; // fora da malha: zero moradores é falta de dado
  const pad = premissas.modelos[ponto.modelo]?.padraoM2 ?? 1200;
  const publico = publicoAlcancavel(ponto.c, pad, censo, unidades, [], premissas.curva).publico;
  if (!(publico > 0)) return null;
  const razao = publico / ref.mediana;
  const fator = Math.min(FATOR_AJUSTE_MAX, Math.max(FATOR_AJUSTE_MIN, razao ** ref.elasticidade));
  return { fator, publico, mediana: ref.mediana, razao, elasticidade: ref.elasticidade, n: ref.n };
}

export interface Sugestao { c: [number, number]; publico: number; ganho: number; distanciaKm: number; renda: number | null; populacao2km: number; divideCom: { nome: string; parte: number }[] }

/**
 * Posições melhores por perto: testa os centros dos hexágonos do Censo com moradores num raio em volta do ponto e devolve as
 * melhores (público alcançável maior que o do ponto), afastadas entre si. `longeDeUnidadesKm` > 0 exclui posições perto de
 * World Gym existentes (para sugerir uma NOVA unidade na região de uma unidade em operação).
 */
export function posicoesMelhores(base: { c: [number, number]; m2: number }, censo: Censo, unidades: UnidadeEstudo[], outros: Ponto[], curva: Premissas["curva"],
  { raioKm = 3, n = 3, separacaoKm = 1, ganhoMinimo = 0.1, longeDeUnidadesKm = 0, minimoMoradores = 130, maxCanibalizacao = 1 }: { raioKm?: number; n?: number; separacaoKm?: number; ganhoMinimo?: number; longeDeUnidadesKm?: number; minimoMoradores?: number; maxCanibalizacao?: number } = {}) {
  const ref = publicoAlcancavel(base.c, base.m2, censo, unidades, outros, curva);
  const cand: Sugestao[] = [];
  // minimoMoradores (130): só posições com gente morando em volta; equivale a ~1.250 moradores por km² no hexágono de 200 m (era 300 no de 300 m)
  let avaliadas = 0; // todas as posições do raio com gente, antes das regras de distância e divisão com a rede (é o "testamos N posições")
  for (const [lat, lng, pop] of censo.celulas) {
    if (pop < minimoMoradores) continue;
    const c: [number, number] = [lat, lng], d = km(c, base.c);
    if (d > raioKm || d < 0.4) continue;
    avaliadas++;
    if (longeDeUnidadesKm && unidades.some((u) => u.c && km(u.c, c) < longeDeUnidadesKm)) continue;
    const r = publicoAlcancavel(c, base.m2, censo, unidades, outros, curva);
    if (r.divideCom.some((x) => x.parte > maxCanibalizacao)) continue;
    cand.push({ c, publico: r.publico, ganho: ref.publico ? r.publico / ref.publico - 1 : 0, distanciaKm: d, renda: r.renda, populacao2km: r.populacao2km, divideCom: r.divideCom });
  }
  cand.sort((a, b) => b.publico - a.publico);
  const escolhidas: Sugestao[] = [];
  for (const x of cand) {
    if (escolhidas.length >= n) break;
    if (x.ganho < ganhoMinimo) break;
    if (escolhidas.some((e) => km(e.c, x.c) < separacaoKm)) continue;
    escolhidas.push(x);
  }
  return { referencia: ref, sugestoes: escolhidas, testadas: avaliadas };
}

/** População e renda média num raio, somando os hexágonos. */
export function arredores(c: [number, number], censo: Censo, raio = 2): { pop: number; renda: number | null } {
  let pop = 0, soma = 0, peso = 0;
  for (const [lat, lng, p, r] of censo.celulas) {
    if (km([lat, lng], c) > raio) continue;
    pop += p;
    if (r != null) { soma += r * p; peso += p; }
  }
  return { pop, renda: peso ? soma / peso : null };
}

/** Salário mínimo vigente (2026: R$ 1.621, Decreto 12.797/2025), para mostrar as faixas das classes em reais de hoje. Atualizar todo janeiro. */
export const SALARIO_MINIMO = 1621;
const reaisSM = (n: number) => `R$ ${Math.round(n * SALARIO_MINIMO).toLocaleString("pt-BR")}`;
/**
 * Classes de renda do domicílio em salários mínimos (as do estudo de geomarketing): E até 1, D de 1 a 2, C de 2 a 5, B de 5 a 10, A de 10 a 15
 * e AA acima de 15. Como a renda vem do Censo 2022, a comparação usa o mínimo de 2022 (`min`, em reais de 2022); a faixa mostrada na tela e
 * no PDF usa o mínimo vigente (correção de 23/11/2026: antes as rendas de 2022 eram comparadas com o mínimo de 2025).
 */
export const CLASSES_RENDA = [
  { id: "AA", rotulo: "Classe AA", sm: 15, faixa: `acima de ${reaisSM(15)}`, min: 15 * SM_CENSO, cor: "#1e3a8a" },
  { id: "A", rotulo: "Classe A", sm: 10, faixa: `${reaisSM(10)} a ${reaisSM(15)}`, min: 10 * SM_CENSO, cor: "#0284c7" },
  { id: "B", rotulo: "Classe B", sm: 5, faixa: `${reaisSM(5)} a ${reaisSM(10)}`, min: 5 * SM_CENSO, cor: "#16a34a" },
  { id: "C", rotulo: "Classe C", sm: 2, faixa: `${reaisSM(2)} a ${reaisSM(5)}`, min: 2 * SM_CENSO, cor: "#8b5cf6" },
  { id: "D", rotulo: "Classe D", sm: 1, faixa: `${reaisSM(1)} a ${reaisSM(2)}`, min: 1 * SM_CENSO, cor: "#f59e0b" },
  { id: "E", rotulo: "Classe E", sm: 0, faixa: `até ${reaisSM(1)}`, min: 0, cor: "#ef6f6c" },
] as const;
export type ClasseRenda = (typeof CLASSES_RENDA)[number];
export const classeDaRenda = (r: number | null): ClasseRenda | null => (r == null || r <= 0 ? null : CLASSES_RENDA.find((c) => r >= c.min) ?? null);

/** Divisão dos moradores por classe de renda num raio (peso = moradores do hexágono), a renda média e os blocos A/B e C/D/E. */
export const classesNoRaio = (c: [number, number], censo: Censo, raio: number) => classesEm(censo, (lat, lng) => km([lat, lng], c) <= raio);

/** Geometria GeoJSON (Polygon/MultiPolygon, coordenadas [lng, lat]) da área de deslocamento. */
export type Geometria = { type: "Polygon"; coordinates: number[][][] } | { type: "MultiPolygon"; coordinates: number[][][][] };
/** Áreas de deslocamento de um lugar: minutos → geometria (carro: 5, 10, 15, 20; a pé: 10). */
export interface Deslocamento { c: [number, number]; modo: "carro" | "pe"; contornos: Record<string, Geometria> }
export const MINUTOS_PADRAO = 10;

const noAnel = (x: number, y: number, anel: number[][]) => {
  let d = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i], [xj, yj] = anel[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
};
/** O ponto (lat, lng) está dentro da área? (respeita buracos do polígono) */
export function dentroDaArea(lat: number, lng: number, g: Geometria | null | undefined) {
  if (!g) return false;
  const pols = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return pols.some((pol) => noAnel(lng, lat, pol[0]) && !pol.slice(1).some((b) => noAnel(lng, lat, b)));
}
/** Moradores (Censo) dos hexágonos cujo centro cai na área. */
export const moradoresNaArea = (censo: Censo, g: Geometria) => censo.celulas.reduce((a, [lat, lng, p]) => a + (dentroDaArea(lat, lng, g) ? p : 0), 0);
/** Classes de renda dos moradores dentro da área. */
export const classesNaArea = (censo: Censo, g: Geometria) => classesEm(censo, (lat, lng) => dentroDaArea(lat, lng, g));
/** Parte dos alunos (pelos bairros [nome, lat, lng, n]) que mora dentro da área. */
export function parteDosAlunos(bairros: [string, number, number, number][], g: Geometria) {
  const total = bairros.reduce((a, b) => a + b[3], 0);
  return total ? bairros.reduce((a, [, lat, lng, n]) => a + (dentroDaArea(lat, lng, g) ? n : 0), 0) / total : null;
}
/** Em quantos minutos de carro moram 80% dos alunos (interpola entre os contornos; null se passa do maior). */
export function minutosPara80(bairros: [string, number, number, number][], d: Deslocamento) {
  const mins = Object.keys(d.contornos).map(Number).sort((a, b) => a - b);
  let antes: [number, number] = [0, 0];
  for (const m of mins) {
    const p = parteDosAlunos(bairros, d.contornos[m]);
    if (p == null) return null;
    if (p >= 0.8) return antes[1] >= 0.8 ? antes[0] : Math.round((antes[0] + ((m - antes[0]) * (0.8 - antes[1])) / Math.max(1e-9, p - antes[1])) * 2) / 2;
    antes = [m, p];
  }
  return null;
}

/**
 * Classes de renda dos hexágonos que passam no filtro. Com a estimativa por domicílio (último campo do hexágono), conta domicílios em
 * cada classe, como o Mapfry; sem ela (dado antigo), põe todos os moradores do hexágono na classe da renda média.
 */
function classesEm(censo: Censo, dentro: (lat: number, lng: number) => boolean) {
  const conta = new Map<string, number>();
  let total = 0, soma = 0, peso = 0;
  const porDomicilio = censo.celulas.some((c) => c[7]?.length);
  for (const [lat, lng, p, r, d, , , cls] of censo.celulas) {
    if (!dentro(lat, lng)) continue;
    if (porDomicilio) {
      if (!cls?.length) continue;
      cls.forEach((n, i) => { const id = CLASSES_RENDA[i].id; conta.set(id, (conta.get(id) ?? 0) + n); total += n; });
      if (r && d) { soma += r * d; peso += d; }
      continue;
    }
    const cl = classeDaRenda(r);
    if (!cl || !p) continue;
    conta.set(cl.id, (conta.get(cl.id) ?? 0) + p); total += p; soma += (r ?? 0) * p; peso += p;
  }
  const parte = (id: string) => (total ? (conta.get(id) ?? 0) / total : 0);
  const classes = CLASSES_RENDA.map((cl) => ({ ...cl, parte: parte(cl.id) }));
  return { classes, moradores: total, porDomicilio, media: peso ? soma / peso : null, ab: parte("AA") + parte("A") + parte("B"), cde: parte("C") + parte("D") + parte("E") };
}

/** As unidades maduras do mesmo modelo mais parecidas com o ponto (gente e renda a até 2 km). */
export function parecidas(ponto: Ponto, censo: Censo, unidades: UnidadeEstudo[], n = 3) {
  const alvo = arredores(ponto.c, censo);
  const cand = unidades.filter((u) => u.madura && u.c && u.vendas && u.m2 && u.modelo === ponto.modelo).map((u) => ({ u, a: arredores(u.c as [number, number], censo) }));
  const ln = (x: number | null) => Math.log(Math.max(1, x ?? 1));
  return cand
    .map(({ u, a }) => ({ u, d: Math.hypot(ln(a.pop) - ln(alvo.pop), ln(a.renda) - ln(alvo.renda)) }))
    .sort((x, y) => x.d - y.d).slice(0, n).map((x) => x.u);
}

/**
 * O ponto está fora da malha do Censo do Atlas (nenhum hexágono a até `raioKm`)? A malha cobre só a região das unidades (DF e entorno,
 * Goiânia, Salvador); fora dela, população, renda, idade, potencial e divisão com a rede dão zero por falta de dado, não porque ninguém
 * mora ali (visto em 24/11/2026 num estudo em Jataí-GO, a 277 km do hexágono mais perto).
 */
export function foraDaMalhaDoCenso(c: [number, number], censo: Censo | null | undefined, raioKm = 5): boolean {
  if (!censo?.celulas?.length) return true;
  const dLat = raioKm / 110.6, dLng = raioKm / (111.32 * Math.cos((c[0] * Math.PI) / 180));
  return !censo.celulas.some(([la, ln]) => Math.abs(la - c[0]) <= dLat && Math.abs(ln - c[1]) <= dLng && km([la, ln], c) <= raioKm);
}

/**
 * Sem o Censo da região a demanda não foi medida: o parecer nunca passa de "com condicionantes" (decisão do dono, 24/11/2026: "nunca
 * passar se não tiver o Censo"). "Não aprova" continua não aprovando.
 */
export function limitarSemCenso(v: Veredito, semCenso?: boolean): Veredito;
export function limitarSemCenso(v: Veredito | null, semCenso?: boolean): Veredito | null;
export function limitarSemCenso(v: Veredito | null, semCenso?: boolean): Veredito | null {
  return semCenso && v === "aprovado" ? "atencao" : v;
}

export interface Fator { positivo: boolean; texto: string }
/** O que pesa a favor e contra, em frases curtas. */
export function fatoresDe(ponto: Ponto, r: Resultado, cap: Captacao, unidades: UnidadeEstudo[], censo: Censo, premissas: Premissas, semCenso = false): Fator[] {
  const f: Fator[] = [];
  const p = premissas.modelos[ponto.modelo];
  if (r.foraDaFaixa) f.push({ positivo: false, texto: `Imóvel acima de ${p.limiteM2.toLocaleString("pt-BR")} m²: a rede não tem experiência nesse tamanho, o excedente conta pela metade` });
  if (semCenso) {
    f.push({ positivo: false, texto: "Sem dados do Censo nesta região: população, renda e divisão com a rede não foram medidas" });
    return f;
  }
  const maduras = unidades.filter((u) => u.madura && u.c && u.modelo === ponto.modelo).map((u) => arredores(u.c as [number, number], censo).pop).sort((a, b) => a - b);
  if (maduras.length) {
    const med = maduras[Math.floor(maduras.length / 2)];
    const mil = (v: number) => `${Math.round(v / 1000).toLocaleString("pt-BR")} mil`;
    f.push(cap.populacao2km >= med
      ? { positivo: true, texto: `${mil(cap.populacao2km)} moradores a até 2 km (a unidade típica tem ${mil(med)})` }
      : { positivo: false, texto: `${mil(cap.populacao2km)} moradores a até 2 km, menos que a unidade típica (${mil(med)})` });
  }
  for (const d of cap.divideCom) f.push({ positivo: false, texto: `Divide ${Math.round(d.parte * 100)}% da captação com ${d.nome}` });
  if (!cap.divideCom.length) f.push({ positivo: true, texto: "Nenhuma World Gym dividindo a captação" });
  return f;
}

/** Rótulo curto do parecer nas listas, no mapa e no PDF (o mesmo sentido de PARECER_ROTULO). */
export const VEREDITO_ROTULO: Record<Veredito, string> = { aprovado: "Aprova", atencao: "Com condicionantes", reprovado: "Não aprova" };
export const reais = (v: number) => `R$ ${Math.round(v / 1000).toLocaleString("pt-BR")} mil`;
export const meses = (v: number) => (Number.isFinite(v) ? `${Math.round(v)} meses` : "não se paga");

/** As World Gym mais próximas de uma posição (distância em linha reta), da mais perto para a mais longe. `ignorar`: a própria unidade, no estudo dela. */
export function unidadesMaisProximas(c: [number, number], unidades: UnidadeEstudo[], n = 3, ignorar?: string): { nome: string; km: number }[] {
  return unidades.filter((u) => u.c && u.nome !== ignorar).map((u) => ({ nome: `World Gym ${u.nome}`, km: km(u.c as [number, number], c) })).sort((a, b) => a.km - b.km).slice(0, n);
}
/** Frase do PDF com a distância da World Gym mais próxima (e das seguintes), para a página de canibalização. */
export function fraseUnidadesProximas(px: { nome: string; km: number }[] | null | undefined, de: "ponto" | "unidade"): string {
  if (!px?.length) return "";
  const f = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const resto = px.slice(1);
  return `A World Gym mais próxima ${de === "ponto" ? "do ponto" : "desta unidade"} é a ${px[0].nome.replace(/^World Gym /, "WG ")}, a ${f(px[0].km)} km em linha reta${resto.length ? `; em seguida, ${resto.map((x) => `${x.nome.replace(/^World Gym /, "WG ")} (${f(x.km)} km)`).join(" e ")}` : ""}.`;
}

/** Região para mostrar na lista: a que a pessoa escreveu, ou "perto de <unidade>" pela World Gym mais próxima. */
export function regiaoDe(p: Ponto, unidades: UnidadeEstudo[]): string {
  if (p.regiao) return p.regiao;
  let melhor: { nome: string; d: number } | null = null;
  for (const u of unidades) if (u.c) { const d = km(u.c, p.c); if (!melhor || d < melhor.d) melhor = { nome: u.nome, d }; }
  return melhor ? `a ${melhor.d.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km da WG ${melhor.nome}` : "";
}

/** O modelo está acertando? Estudos que viraram unidade madura: quantos ficaram dentro da faixa prevista e o erro médio. */
export function acertoDoModelo(pontos: Ponto[], unidades: UnidadeEstudo[]) {
  const casos = pontos.flatMap((p) => {
    const d = p.decisao, u = d?.status === "unidade" ? unidades.find((x) => x.nome === d.unidade) : undefined;
    return d?.previsao && u?.madura && u.vendas ? [{ prev: d.previsao, real: u.vendas }] : [];
  });
  if (!casos.length) return null;
  const dentro = casos.filter((c) => c.real >= c.prev.pessimista && c.real <= c.prev.otimista).length;
  const erro = casos.reduce((a, c) => a + Math.abs(c.prev.provavel - c.real) / c.real, 0) / casos.length;
  return { n: casos.length, dentro, erroMedio: erro };
}

// ---------- Score de atratividade por hexágono (25/11/2026) ----------
// Cada hexágono recebe de 0 a 100 pela posição dele, entre os hexágonos da área, em cada variável (percentil), somadas com pesos visíveis e editáveis.
// Os números do Censo são suavizados em volta (como no mapa de calor) para a mancha não ficar quebrada. É uma nota para COMPARAR lugares na mesma
// região; não é previsão de vendas (na rede, nenhuma variável sozinha explicou bem as vendas das unidades).
export const ATRATIVIDADE_VARIAVEIS = [
  { id: "moradores", rotulo: "Moradores", padrao: 25 },
  { id: "alvo", rotulo: "Moradores de 20 a 49 anos", padrao: 20 },
  { id: "consumo", rotulo: "Potencial de consumo", padrao: 25 },
  { id: "comercio", rotulo: "Concentração comercial", padrao: 15 },
  { id: "livre", rotulo: "Longe das World Gym", padrao: 15 },
] as const;
export type VariavelAtratividade = (typeof ATRATIVIDADE_VARIAVEIS)[number]["id"];
export type PesosAtratividade = Record<VariavelAtratividade, number>;
export const PESOS_ATRATIVIDADE_PADRAO = Object.fromEntries(ATRATIVIDADE_VARIAVEIS.map((v) => [v.id, v.padrao])) as PesosAtratividade;

/** Soma de cada valor espalhada pelos vizinhos até `raio` km, com peso gaussiano (`sigma` km). Só olha os próprios pontos da lista. */
function suavizarSelecao(pos: [number, number][], valores: number[], sigma = 0.35, raio = 1.2): number[] {
  if (!pos.length) return [];
  const kLat = 110.6, kLng = 111.32 * Math.cos((pos[0][0] * Math.PI) / 180);
  const pts = pos.map((p, i) => ({ y: p[0] * kLat, x: p[1] * kLng, i })).sort((a, b) => a.y - b.y);
  const out = new Array<number>(pos.length).fill(0), dois = 2 * sigma * sigma, r2 = raio * raio;
  let lo = 0;
  for (const p of pts) {
    while (lo < pts.length && pts[lo].y < p.y - raio) lo++;
    let v = 0;
    for (let k = lo; k < pts.length && pts[k].y <= p.y + raio; k++) {
      const dx = pts[k].x - p.x, dy = pts[k].y - p.y, d2 = dx * dx + dy * dy;
      if (d2 <= r2) v += valores[pts[k].i] * Math.exp(-d2 / dois);
    }
    out[p.i] = v;
  }
  return out;
}
/** Posição de cada valor entre todos (0 a 1; empate fica no meio do grupo). */
function percentis(v: number[]): number[] {
  if (v.length < 2) return v.map(() => 0.5);
  const s = [...v].sort((a, b) => a - b);
  const abaixo = (x: number) => { let lo = 0, hi = s.length; while (lo < hi) { const m = (lo + hi) >> 1; if (s[m] < x) lo = m + 1; else hi = m; } return lo; };
  const ate = (x: number) => { let lo = 0, hi = s.length; while (lo < hi) { const m = (lo + hi) >> 1; if (s[m] <= x) lo = m + 1; else hi = m; } return lo; };
  return v.map((x) => ((abaixo(x) + ate(x) - 1) / 2) / (s.length - 1));
}
export interface ScoreAtratividade {
  indices: number[]; score: number[];
  /** Variáveis que entraram (as que o Censo e a rede têm), com o peso já normalizado (soma 1). */
  usadas: { id: VariavelAtratividade; peso: number }[];
  /** Nota do hexágono onde está o ponto e a parte dos hexágonos da área com nota menor que a dele. */
  doPonto: { score: number; melhorQue: number } | null;
}
/**
 * Score de atratividade (0 a 100) dos hexágonos escolhidos por `dentro`. `unidades`: World Gym que já existem (a variável "Longe das World Gym"
 * cai perto delas). Variável sem dado (idade, comércio, sem unidades) sai e os pesos das outras são refeitos. Sem hexágonos ou com todos os pesos em zero, null.
 */
export function scoreDeAtratividade(censo: Censo, dentro: (lat: number, lng: number) => boolean, pesos: PesosAtratividade, unidades: { c: [number, number] | null }[], meiaDistanciaKm: number, ponto?: [number, number] | null): ScoreAtratividade | null {
  const indices: number[] = [];
  censo.celulas.forEach((c, i) => { if (c[2] > 0 && dentro(c[0], c[1])) indices.push(i); });
  if (indices.length < 2) return null;
  const cel = indices.map((i) => censo.celulas[i]), pos = cel.map((c) => [c[0], c[1]] as [number, number]);
  const temIdade = cel.some((c) => c[5]?.length), temComercio = cel.some((c) => c[10] !== undefined);
  const ucs = unidades.filter((u) => u.c).map((u) => u.c as [number, number]);
  const valores: Partial<Record<VariavelAtratividade, number[]>> = {
    moradores: suavizarSelecao(pos, cel.map((c) => c[2])),
    consumo: suavizarSelecao(pos, cel.map((c) => gastoDoHexagono(c))),
  };
  if (temIdade) valores.alvo = suavizarSelecao(pos, cel.map((c) => (c[5] ? (c[5][2] ?? 0) + (c[5][3] ?? 0) + (c[5][4] ?? 0) : 0)));
  if (temComercio) valores.comercio = suavizarSelecao(pos, cel.map((c) => c[10] ?? 0));
  if (ucs.length) valores.livre = pos.map((p) => 1 - Math.min(1, ucs.reduce((a, u) => a + atracao(km(p, u), meiaDistanciaKm), 0)));
  const ativas = ATRATIVIDADE_VARIAVEIS.filter((v) => valores[v.id] && pesos[v.id] > 0);
  const soma = ativas.reduce((a, v) => a + pesos[v.id], 0);
  if (!soma) return null;
  const score = new Array<number>(indices.length).fill(0);
  const usadas = ativas.map((v) => ({ id: v.id, peso: pesos[v.id] / soma }));
  for (const u of usadas) { const p = percentis(valores[u.id]!); p.forEach((x, k) => { score[k] += 100 * u.peso * x; }); }
  let doPonto: ScoreAtratividade["doPonto"] = null;
  if (ponto) {
    let melhor = -1, dm = 0.3;
    pos.forEach((p, k) => { const d = km(p, ponto); if (d < dm) { dm = d; melhor = k; } });
    if (melhor >= 0) doPonto = { score: score[melhor], melhorQue: score.filter((x) => x < score[melhor]).length / score.length };
  }
  return { indices, score, usadas, doPonto };
}

/**
 * Canibalização observada (só com a contagem real de alunos por hexágono, em linha reta): para cada World Gym vizinha, que parte dos alunos desta
 * unidade mora mais perto da vizinha do que daqui, e que parte dos alunos da vizinha mora mais perto daqui. `algumaOutra` = parte dos alunos desta unidade
 * que mora mais perto de alguma das vizinhas informadas. Os números por vizinha não somam (um aluno pode estar mais perto de duas). Sem alunos, null.
 */
export interface CanibalObservada { itens: { nome: string; km: number; meusPertoDela: number; delaPertoDaqui: number }[]; algumaOutra: number; alunos: number }
export function canibalizacaoObservada(
  minha: { c: [number, number]; celulas: [number, number, number][] },
  vizinhas: { nome: string; c: [number, number]; celulas: [number, number, number][] }[],
): CanibalObservada | null {
  const total = (cs: [number, number, number][]) => cs.reduce((a, x) => a + (x[2] > 0 ? x[2] : 0), 0);
  const meus = total(minha.celulas);
  if (!meus || !vizinhas.length) return null;
  const parte = (cs: [number, number, number][], de: [number, number], para: [number, number]) => {
    const t = total(cs);
    return t ? cs.reduce((a, [la, ln, n]) => a + (n > 0 && km([la, ln], para) < km([la, ln], de) ? n : 0), 0) / t : 0;
  };
  const itens = vizinhas.map((v) => ({ nome: v.nome, km: km(minha.c, v.c), meusPertoDela: parte(minha.celulas, minha.c, v.c), delaPertoDaqui: parte(v.celulas, v.c, minha.c) })).sort((a, b) => a.km - b.km);
  const algumaOutra = minha.celulas.reduce((a, [la, ln, n]) => a + (n > 0 && vizinhas.some((v) => km([la, ln], v.c) < km([la, ln], minha.c)) ? n : 0), 0) / meus;
  return { itens, algumaOutra, alunos: meus };
}

/**
 * Zonas de captação (primária, secundária, terciária) pela contagem real de alunos por hexágono: ordena os hexágonos pela distância em linha reta até
 * a unidade e acha o menor raio que reúne cada fatia dos alunos (padrão 70%, 90% e 98%). Devolve os raios em km, a parte dos alunos dentro de cada
 * um (um pouco acima do corte, porque o hexágono não se divide) e o total contado. Sem alunos, null.
 */
export function zonasDeCaptacao(celulas: [number, number, number][], c: [number, number], cortes = [0.7, 0.9, 0.98]): { raios: number[]; partes: number[]; total: number } | null {
  const v = celulas.filter((x) => x[2] > 0).map((x) => ({ d: km(c, [x[0], x[1]]), n: x[2] })).sort((a, b) => a.d - b.d);
  const total = v.reduce((a, b) => a + b.n, 0);
  if (!total) return null;
  const raios: number[] = [], partes: number[] = [];
  let acum = 0, k = 0;
  for (const x of v) {
    acum += x.n;
    while (k < cortes.length && acum / total >= cortes[k]) { raios.push(x.d); partes.push(acum / total); k++; }
    if (k >= cortes.length) break;
  }
  return { raios, partes, total };
}

/**
 * Lacuna de captação: onde o modelo espera mais alunos do que a unidade tem. As duas medidas têm escalas diferentes (alunos esperados pela conta do
 * modelo, alunos reais pela contagem do CEP), então cada uma vira a parte que o hexágono tem do total dentro da área e a lacuna é a diferença
 * (esperado - real), só onde é positiva. Devolve no formato de `desenharDemanda`. Sem alunos ou sem demanda na área, não há lacuna.
 */
export function lacunaDeCaptacao(esperado: { indices: number[]; pesos: number[] }, real: { indices: number[]; pesos: number[] }, dentro: (i: number) => boolean): { indices: number[]; pesos: number[] } {
  const soma = (m: Map<number, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  const mapa = (d: { indices: number[]; pesos: number[] }) => { const m = new Map<number, number>(); d.indices.forEach((i, k) => { if (d.pesos[k] > 0 && dentro(i)) m.set(i, (m.get(i) ?? 0) + d.pesos[k]); }); return m; };
  const e = mapa(esperado), r = mapa(real);
  const te = soma(e), tr = soma(r);
  if (!te || !tr) return { indices: [], pesos: [] };
  const indices: number[] = [], pesos: number[] = [];
  for (const [i, w] of e) { const f = w / te - (r.get(i) ?? 0) / tr; if (f > 0) { indices.push(i); pesos.push(f); } }
  return { indices, pesos };
}

/**
 * Suaviza uma contagem por hexágono para o mapa de calor: o valor de cada hexágono do Censo vira a soma da contagem dos hexágonos em volta, com peso
 * que cai com a distância (gaussiana de `sigmaKm`, até `raioKm`). O mapa fica preenchido e contínuo, sem hexágonos soltos, e um hexágono com 1 ou 2
 * alunos deixa de aparecer sozinho. Só entram hexágonos com moradores, até `maxKm` de `c`. Devolve no formato de `desenharDemanda`.
 */
export function suavizarContagem(censo: Censo, indices: number[], pesos: number[], c: [number, number], { sigmaKm = 0.35, raioKm = 1.2, maxKm = 6 } = {}): { indices: number[]; pesos: number[] } {
  const kLat = 110.6, kLng = 111.32 * Math.cos((c[0] * Math.PI) / 180);
  const fontes = indices.map((i, k) => ({ la: censo.celulas[i][0] * kLat, ln: censo.celulas[i][1] * kLng, w: pesos[k] })).filter((f) => f.w > 0);
  const out = { indices: [] as number[], pesos: [] as number[] };
  const dois = 2 * sigmaKm * sigmaKm, r2 = raioKm * raioKm;
  censo.celulas.forEach(([la, ln, pop], j) => {
    if (!pop) return;
    const y = la * kLat, x = ln * kLng;
    if (km(c, [la, ln]) > maxKm) return;
    let v = 0;
    for (const f of fontes) { const dy = f.la - y; if (dy > raioKm || dy < -raioKm) continue; const d2 = dy * dy + (f.ln - x) * (f.ln - x); if (d2 <= r2) v += f.w * Math.exp(-d2 / dois); }
    if (v > 0) { out.indices.push(j); out.pesos.push(v); }
  });
  return out;
}
/** Até onde moram 80% dos alunos de verdade (pelos bairros), em km. */
export function raio80Real(u: UnidadeEstudo): number | null {
  if (!u.c || !u.bairros?.length) return null;
  const d = u.bairros.map(([, lat, lng, n]) => [km(u.c as [number, number], [lat, lng]), n] as const).sort((a, b) => a[0] - b[0]);
  const total = d.reduce((a, x) => a + x[1], 0);
  let acum = 0;
  for (const [dist, n] of d) { acum += n; if (acum >= total * 0.8) return dist; }
  return d[d.length - 1][0];
}

/** Unidade em operação vista como um ponto, para reaproveitar o mapa de calor (as outras unidades dividem a captação). */
export const unidadeComoPonto = (u: UnidadeEstudo): Ponto => ({
  id: `unidade-${u.nome}`, nome: u.nome, c: u.c as [number, number], modelo: u.modelo, m2: u.m2 ?? 1000,
  imovel: { fachada: false, estacionamento: false, polo: false, aPe: false },
});

// ---------- População recomendada, ticket e estacionamento (decisões do dono em 23/11/2026) ----------

/** Percentil p (0 a 1) com interpolação. */
function percentilDe(valores: number[], p: number): number | null {
  const v = [...valores].sort((a, b) => a - b);
  if (!v.length) return null;
  const i = (v.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return v[lo] + (v[hi] - v[lo]) * (i - lo);
}

/** Referência de uma unidade madura da rede: vendas por mês e moradores na própria área de 10 min de carro. */
export interface RefPopulacao { nome: string; vendas: number; moradores: number; /** Gasto mensal com esportes na área de 10 min (potencial de consumo). */ potencial?: number; /** Modelo da unidade (a referência de cada modelo sai daqui). */ modelo?: Modelo; /** Parte dos moradores das classes AA, A e B na área de 10 min. */ ab?: number | null; /** Alunos ativos da unidade. */ alunos?: number | null }
/**
 * Fatia do potencial de consumo (decisão do dono, 23/11/2026): vendas ÷ o que os moradores da área de 10 min gastam com esportes.
 * A faixa vem das unidades maduras do mesmo modelo: `comum` = 3 em cada 4 unidades ficam até ela; `maxima` = a maior da rede.
 * Em 23/11/2026 (Low Cost): mediana 28%, comum 38%, máxima 74%. Com menos de MIN_UNIDADES_FATIA unidades com o dado, não há faixa
 * (decisão do dono, 23/11/2026: o Pro tem 3 unidades, poucas para a fatia barrar o parecer; ela fica só como informação).
 */
export const MIN_UNIDADES_FATIA = 5;
export function faixaDaFatia(refs: RefPopulacao[] | null | undefined): { comum: number; maxima: number; mediana: number; unidades: number } | null {
  const fs = (refs ?? []).filter((r) => (r.potencial ?? 0) > 0 && r.vendas > 0).map((r) => r.vendas / (r.potencial as number));
  if (fs.length < MIN_UNIDADES_FATIA) return null;
  return { comum: percentilDe(fs, 0.75)!, maxima: Math.max(...fs), mediana: percentilDe(fs, 0.5)!, unidades: fs.length };
}
/** Veredito com a fatia: acima da maior da rede não aprova; acima da comum, no máximo "com condicionantes". */
export function vereditoComFatia(v: Veredito | null, fatia: number | null, faixa: { comum: number; maxima: number } | null): Veredito | null {
  if (!v || fatia == null || !faixa) return v;
  if (fatia > faixa.maxima) return "reprovado";
  if (fatia > faixa.comum && v === "aprovado") return "atencao";
  return v;
}
export type SituacaoPopulacao = "adequada" | "limite" | "abaixo";
/**
 * População recomendada calibrada com a rede: quanto as unidades maduras vendem por morador da própria área de 10 min de carro.
 * Recomendada = meta ÷ mediana (o ponto vendendo por morador como a unidade típica); mínima = meta ÷ quartil de cima (como as que
 * mais vendem por morador). Abaixo da mínima, o ponto só bate a meta se vender por morador mais que 3 de cada 4 unidades da rede.
 */
export function populacaoRecomendada(meta: number, moradores: number | null, refs: RefPopulacao[]) {
  const porMorador = refs.filter((x) => x.vendas > 0 && x.moradores > 0).map((x) => x.vendas / x.moradores);
  if (porMorador.length < 4) return null;
  const med = percentilDe(porMorador, 0.5)!, p75 = percentilDe(porMorador, 0.75)!;
  const recomendada = meta / med, minima = meta / p75;
  const situacao: SituacaoPopulacao | null = moradores == null ? null : moradores >= recomendada ? "adequada" : moradores >= minima ? "limite" : "abaixo";
  return { recomendada, minima, vendasPorMorador: med, n: porMorador.length, situacao };
}
export const SITUACAO_POPULACAO: Record<SituacaoPopulacao, string> = { adequada: "adequada", limite: "no limite", abaixo: "abaixo do recomendado" };

// ---------- Freios da demanda para qualquer modelo (decisão do dono, 24/11/2026) ----------
// Antes, o Pro (só 3 unidades) ficava sem população recomendada, sem fatia do potencial e sem unidades parecidas: passava só pela conta
// do dinheiro (R$ por m² × m²), que não olha o lugar. Agora cada freio usa as unidades maduras do próprio modelo e, quando elas são
// poucas, a rede toda (avisado no texto). Renda e alunos têm limites próprios, tirados das unidades que a rede já tem.

/** Unidades do modelo com dado suficiente para servir de régua (a fatia do potencial pede ao menos MIN_UNIDADES_FATIA). */
export function refsParaModelo(refs: RefPopulacao[] | null | undefined, modelo: Modelo): { refs: RefPopulacao[]; daRede: boolean } | null {
  if (!refs) return null;
  const doModelo = refs.filter((x) => x.modelo === modelo);
  return doModelo.length >= MIN_UNIDADES_FATIA ? { refs: doModelo, daRede: false } : { refs, daRede: true };
}

/** Renda: o ponto não pode ter menos moradores AA+A+B que a unidade do modelo com menos (abaixo disso, com condicionantes; abaixo da metade, não aprova). */
export const FATOR_RENDA_REPROVA = 0.5;
/** Alunos: o ponto não pode exigir mais alunos que a maior base real do modelo (acima, com condicionantes; acima de 1,5 vez, não aprova). */
export const FATOR_ALUNOS_REPROVA = 1.5;
export const MIN_UNIDADES_LIMITE = 2;

export interface Freio { id: "populacao" | "renda" | "alunos"; nivel: "atencao" | "reprovado"; /** Frase do parecer. */ texto: string; /** O que mudaria a conclusão. */ condicao: string }
const pctF = (x: number) => `${Math.round(x * 100)}%`;
const milF = (v: number) => `${Math.round(v / 1000).toLocaleString("pt-BR")} mil`;

export function freiosDeDemanda(o: {
  modelo: Modelo; refs: RefPopulacao[] | null | undefined; meta: number; moradores: number | null; ab: number | null; alunosNecessarios: number | null; semCenso?: boolean;
}) {
  const sel = refsParaModelo(o.refs, o.modelo);
  const freios: Freio[] = [];
  const nome = o.modelo === "pro" ? "Pro" : "Low Cost";
  const pop = sel && !o.semCenso ? populacaoRecomendada(o.meta, o.moradores, sel.refs) : null;
  const daRede = sel?.daRede ? " (referência da rede toda: o modelo tem poucas unidades)" : "";
  if (pop?.situacao === "abaixo" && o.moradores != null) freios.push({ id: "populacao", nivel: "atencao",
    texto: `A área de 10 min tem ${milF(o.moradores)} moradores, abaixo dos ${milF(pop.minima)} que a rede precisa no mínimo para chegar a essa venda${daRede}.`,
    condicao: `Procurar um ponto com mais moradores na área de 10 min (a rede pede ${milF(pop.recomendada)}; o mínimo é ${milF(pop.minima)})${daRede}.` });
  // renda: só vale com a régua do próprio modelo e para quem vende mais caro (Pro): é onde a renda decide
  const doModelo = (o.refs ?? []).filter((x) => x.modelo === o.modelo && x.ab != null);
  if (o.modelo === "pro" && !o.semCenso && o.ab != null && doModelo.length >= MIN_UNIDADES_LIMITE) {
    const piso = Math.min(...doModelo.map((x) => x.ab as number));
    if (o.ab < piso * FATOR_RENDA_REPROVA) freios.push({ id: "renda", nivel: "reprovado",
      texto: `Só ${pctF(o.ab)} dos moradores da área estão nas classes A e B; a ${nome} com menos tem ${pctF(piso)}. A renda da área é muito menor que a de qualquer ${nome} da rede.`,
      condicao: `Procurar uma área com mais renda (classes A e B acima de ${pctF(piso)}) ou avaliar o ponto como Low Cost.` });
    else if (o.ab < piso) freios.push({ id: "renda", nivel: "atencao",
      texto: `${pctF(o.ab)} dos moradores da área estão nas classes A e B; a ${nome} com menos tem ${pctF(piso)}.`,
      condicao: `Conferir a renda da área: está abaixo da de qualquer ${nome} da rede (A e B: ${pctF(piso)}).` });
  }
  const comAlunos = (o.refs ?? []).filter((x) => x.modelo === o.modelo && (x.alunos ?? 0) > 0);
  let maxAlunos: number | null = null;
  if (comAlunos.length >= MIN_UNIDADES_LIMITE && o.alunosNecessarios != null) {
    maxAlunos = Math.max(...comAlunos.map((x) => x.alunos as number));
    if (o.alunosNecessarios > maxAlunos * FATOR_ALUNOS_REPROVA) freios.push({ id: "alunos", nivel: "reprovado",
      texto: `Para vender isso o ponto precisaria de ${o.alunosNecessarios.toLocaleString("pt-BR")} alunos; a maior ${nome} da rede tem ${maxAlunos.toLocaleString("pt-BR")}.`,
      condicao: `Esperar menos alunos: a maior ${nome} da rede tem ${maxAlunos.toLocaleString("pt-BR")}. Um imóvel menor ou outro modelo pede uma base mais realista.` });
    else if (o.alunosNecessarios > maxAlunos) freios.push({ id: "alunos", nivel: "atencao",
      texto: `O ponto precisaria de ${o.alunosNecessarios.toLocaleString("pt-BR")} alunos, mais que a maior ${nome} da rede (${maxAlunos.toLocaleString("pt-BR")}).`,
      condicao: `Conferir a base de alunos: a meta pede mais que a maior ${nome} da rede (${maxAlunos.toLocaleString("pt-BR")}).` });
  }
  return { freios, pop, daRede: !!sel?.daRede, faixaFatia: sel ? faixaDaFatia(sel.refs) : null, maxAlunos };
}
/**
 * A conta do estudo em linhas, para o parecer explicar de onde sai o número (pedido do dono, 24/11/2026): vendas = R$ por m² × m²;
 * mínimo = investimento ÷ meses + custo fixo, descontada a parte variável. `real`: R$ por m² das unidades maduras do modelo.
 */
export function contaDoPonto(ponto: Pick<Ponto, "m2" | "modelo">, r: Resultado, premissas: Premissas, faixa: FaixaM2, real: { min: number; max: number; n: number } | null, ajuste: AjusteCaptacao | null = null, aluguel: number | null = null): string[] {
  const p = premissas.modelos[ponto.modelo], rg = premissas.regua;
  const num = (v: number) => Math.round(v).toLocaleString("pt-BR");
  const mi = (v: number) => `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  const ehPremissa = p.vendasPorM2 != null && faixa.mediana === p.vendasPorM2;
  const linhas: string[] = [];
  linhas.push(`Vendas previstas: R$ ${num(faixa.mediana)} por m² × ${num(r.m2Efetivo)} m²${ajuste ? ` × ${ajuste.fator.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (ajuste pelo lugar)` : ""} = ${reais(r.provavel)} por mês.${ponto.m2 > p.limiteM2 ? ` Acima de ${num(p.limiteM2)} m², cada m² a mais conta só ${Math.round(p.pesoAcima * 100)}%.` : ""}`);
  linhas.push(ehPremissa
    ? `O R$ ${num(faixa.mediana)} por m² do ${p.nome} é uma premissa: a rede tem poucas unidades maduras do modelo.${real ? ` As ${real.n} que existem vendem de R$ ${num(real.min)} a R$ ${num(real.max)} por m².` : ""}`
    : `O R$ ${num(faixa.mediana)} por m² é a mediana de ${faixa.n} unidades maduras do ${p.nome}${real ? ` (de R$ ${num(real.min)} a R$ ${num(real.max)} por m²)` : ""}.`);
  linhas.push(`Mínimo para pagar o investimento em ${rg.mesesAprovado / 12} anos: ${mi(r.investimento)} ÷ ${rg.mesesAprovado - rg.maturacaoMeses} meses + custo fixo de ${reais(r.custoFixo)}, descontando ${Math.round(p.variavel * 1000) / 10}% de custo variável = ${reais(r.meta)} por mês.`);
  const ag = aluguelDoPonto({ m2: ponto.m2, origem: aluguel ? { aluguel } : undefined }), base = aluguelBaseDe(p);
  linhas.push(r.aluguel != null && base != null
    ? `Aluguel real: ${reais(r.aluguel)} por mês (R$ ${(r.aluguel / ponto.m2).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} por m²). A premissa considera R$ ${base.toLocaleString("pt-BR")} por m² de aluguel dentro do custo fixo; nesta conta ele é trocado pelo aluguel real, e o custo fixo fica em ${reais(r.custoFixo)}.`
    : aluguel && ag.ignorado
      ? `O aluguel informado (R$ ${(aluguel / ponto.m2).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} por m²) está fora do esperado (de R$ ${ALUGUEL_M2_MIN} a R$ ${ALUGUEL_M2_MAX} por m²): ignorei e usei o custo fixo padrão da rede. Confira o valor.`
      : aluguel && base == null
        ? `Aluguel informado: ${reais(aluguel)} por mês (R$ ${(aluguel / ponto.m2).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} por m²). A premissa deste modelo ainda não separa o aluguel do custo fixo, então ele não corrige o payback: serve para comparar imóveis.`
        : "Aluguel não informado: o custo fixo é o padrão da rede (a base mais o valor por m² acima). Informe o aluguel do imóvel para uma conta mais real.");
  linhas.push(`Lucro esperado: ${reais(r.provavel)} × (1 − ${Math.round(p.variavel * 1000) / 10}%) − ${reais(r.custoFixo)} = ${r.lucro > 0 ? reais(r.lucro) : "prejuízo"} por mês.`);
  linhas.push(ajuste
    ? `Ajuste pelo lugar: o público alcançável do ponto (moradores pesados pela distância, já descontadas as World Gym em volta) é ${Math.round(ajuste.razao * 100)}% da mediana das ${ajuste.n} unidades maduras do modelo. Na rede, cada 10% a mais de público veio com cerca de ${(ajuste.elasticidade * 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% a mais de vendas por m²: o lugar explica pouco, então o ajuste é pequeno (limitado a ${Math.round((FATOR_AJUSTE_MIN - 1) * 100)}% a +${Math.round((FATOR_AJUSTE_MAX - 1) * 100)}%). População, renda, potencial de consumo e alunos continuam como freios do parecer.`
    : "Sem ajuste pelo lugar (o modelo tem poucas unidades maduras ou não há Censo na região): a previsão é só R$ por m² × m². População, renda, potencial de consumo e alunos entram como freios do parecer.");
  return linhas;
}
/**
 * O parecer completo de um ponto num modelo: payback, estacionamento, fatia do potencial, freios da demanda e "sem Censo". A tela do estudo,
 * a comparação de modelos, a lista de estudos e o mapa usam esta mesma conta, para o veredito não mudar de uma tela para outra.
 * Sem a área de 10 min do ponto (ainda não calculada) ou sem as referências da rede, devolve o parecer simples e `completo: false`.
 */
export interface ContextoAvaliacao { premissas: Premissas; vendasPorM2: Record<Modelo, FaixaM2 | null>; unidades: UnidadeEstudo[]; censo: Censo | null | undefined; refs: RefPopulacao[] | null; area: Geometria | null; semCenso: boolean }
export function avaliarCompleto(ponto: Ponto, ctx: ContextoAvaliacao): { r: Resultado; veredito: Veredito; freios: Freio[]; completo: boolean; ajuste: AjusteCaptacao | null } | null {
  const faixa = ctx.vendasPorM2[ponto.modelo];
  if (!faixa) return null;
  const ajuste = ctx.semCenso ? null : ajusteDeCaptacao(ponto, ctx.premissas, ctx.censo, ctx.unidades);
  const r = avaliarPonto(ponto, ctx.premissas, faixa, ajuste?.fator ?? 1);
  const tk = ctx.censo ? ticketSugerido(ponto.modelo, ctx.unidades, parecidas(ponto, ctx.censo, ctx.unidades)) : null;
  const alunos = tk ? alunosDoPonto(r, tk.preco) : null;
  const base = vereditoFinal(r.veredito, alunos ? vagasDoPonto(alunos, ponto.imovel) : null);
  if (ctx.semCenso) return { r, veredito: limitarSemCenso(base, true), freios: [], completo: true, ajuste };
  if (!ctx.area || !ctx.refs || !ctx.censo) return { r, veredito: base, freios: [], completo: false, ajuste };
  const potencial = potencialNaArea(ctx.censo, ctx.area)?.total ?? null;
  const fm = freiosDeDemanda({ modelo: ponto.modelo, refs: ctx.refs, meta: r.meta, moradores: moradoresNaArea(ctx.censo, ctx.area), ab: classesNaArea(ctx.censo, ctx.area).ab, alunosNecessarios: alunos });
  const v = aplicarFreios(vereditoComFatia(base, potencial ? r.provavel / potencial : null, fm.faixaFatia), fm.freios) as Veredito;
  return { r, veredito: v, freios: fm.freios, completo: true, ajuste };
}
/** Aplica os freios ao veredito: um que reprova reprova; um de atenção tira o "aprova". */
export function aplicarFreios(v: Veredito | null, freios: Freio[]): Veredito | null {
  if (!v) return v;
  if (freios.some((f) => f.nivel === "reprovado")) return "reprovado";
  if (freios.length && v === "aprovado") return "atencao";
  return v;
}

/** Referência dos estudos de geomarketing antigos (Canva): alunos ÷ (penetração × participação de 15% a 20%). */
export const PARTICIPACAO_CANVA = [0.15, 0.2] as const;
export const populacaoCanva = (alunos: number, penetracao: number) => ({ min: alunos / (penetracao * PARTICIPACAO_CANVA[1]), max: alunos / (penetracao * PARTICIPACAO_CANVA[0]) });

/** Preço de tabela mais perto do ticket: termina em ,90 (ex.: 137 vira 139,90). */
export const precoDeTabela = (v: number) => Math.max(10, Math.round(v / 10) * 10) - 0.1;
/**
 * Ticket sugerido: o ticket realizado (EVO) das unidades parecidas com o ponto (moradores e renda); sem elas, a mediana do modelo.
 * A faixa (quartis) vem das unidades maduras do mesmo modelo.
 */
export function ticketSugerido(modelo: Modelo, unidades: UnidadeEstudo[], parecidasDoPonto: UnidadeEstudo[]) {
  const doModelo = unidades.filter((u) => u.madura && u.modelo === modelo && u.ticket && u.ticket > 0).map((u) => u.ticket as number);
  if (!doModelo.length) return null;
  const par = parecidasDoPonto.filter((u) => u.ticket && u.ticket > 0).map((u) => u.ticket as number);
  const base = par.length ? percentilDe(par, 0.5)! : percentilDe(doModelo, 0.5)!;
  return { realizado: base, preco: precoDeTabela(base), p25: percentilDe(doModelo, 0.25)!, p75: percentilDe(doModelo, 0.75)!, n: doModelo.length, dasParecidas: par.length > 0 };
}
/** Alunos que o ponto precisa atender: o maior entre a meta e a previsão, dividido pelo ticket. */
export const alunosDoPonto = (r: Pick<Resultado, "meta" | "provavel">, ticket: number) => Math.ceil(Math.max(r.meta, r.provavel) / ticket);

/** Estacionamento (prompt novo, decisão do dono): pico de 8% a 12% dos alunos no mesmo horário, 20% a 30% deles de carro. Eliminatório. */
export const ESTACIONAMENTO = { pico: [0.08, 0.12], carro: [0.2, 0.3] } as const;
export type SituacaoVagas = "suficiente" | "limite" | "insuficiente" | "sem-dado";
export function vagasDoPonto(alunos: number, imovel: ImovelItens) {
  const min = Math.ceil(alunos * ESTACIONAMENTO.pico[0] * ESTACIONAMENTO.carro[0]);
  const max = Math.ceil(alunos * ESTACIONAMENTO.pico[1] * ESTACIONAMENTO.carro[1]);
  const informadas = imovel.vagas == null && imovel.vagasPerto == null ? null : (imovel.vagas ?? 0) + (imovel.vagasPerto ?? 0);
  const situacao: SituacaoVagas = informadas == null ? "sem-dado" : informadas >= max ? "suficiente" : informadas >= min ? "limite" : "insuficiente";
  return { min, max, informadas, proprias: imovel.vagas ?? null, perto: imovel.vagasPerto ?? null, situacao };
}
export const SITUACAO_VAGAS: Record<SituacaoVagas, string> = { suficiente: "suficiente", limite: "no limite", insuficiente: "insuficiente", "sem-dado": "vagas não informadas" };
/** Parecer do Atlas em palavras (decisão do dono, 23/11/2026: o Atlas diz se aprova; o registro da diretoria é opcional). */
export const PARECER_ROTULO: Record<Veredito, string> = { aprovado: "Aprova", atencao: "Aprova com condicionantes", reprovado: "Não aprova" };
/**
 * Por que o Atlas aprova ou não e o que precisa acontecer para seguir. Regras: payback dentro da régua aprova; entre a régua e o limite
 * de atenção aprova com condicionantes; abaixo disso, ou com estacionamento insuficiente (eliminatório), não aprova.
 */
export function parecerDoPonto(o: {
  veredito: Veredito; provavel: number; meta: number; payback: number | null; mesesAprovado: number; mesesAtencao: number;
  vagas?: { situacao: SituacaoVagas; min: number; max: number } | null; populacao?: { situacao: SituacaoPopulacao | null; recomendada: number } | null;
  divideCom?: { nome: string; parte: number }[];
  /** O ponto está fora da malha do Censo: a demanda não foi medida (foraDaMalhaDoCenso). */
  semCenso?: boolean;
  /** Fatia do potencial que o ponto precisaria, o potencial da área e a faixa da rede (faixaDaFatia). */
  fatia?: { valor: number; potencial: number; comum: number; maxima: number } | null;
  /** Freios da demanda (população, renda, alunos contra a rede), já aplicados ao `veredito` recebido. */
  freios?: Freio[];
}) {
  // sem Censo, "aprova" vira "com condicionantes" (limitarSemCenso); o texto continua dizendo os números do modelo
  const limitado = o.semCenso && o.veredito === "aprovado";
  const r = (v: number) => `R$ ${Math.round(v / 1000).toLocaleString("pt-BR")} mil`;
  const anos = (m: number) => `${(m / 12).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} anos`;
  const pb = o.payback != null && Number.isFinite(o.payback) ? ` (o investimento volta em ${Math.round(o.payback)} meses)` : "";
  const porque = o.vagas?.situacao === "insuficiente"
    ? `O estacionamento não comporta o movimento previsto (precisa de ${o.vagas.min} a ${o.vagas.max} vagas). Estacionamento é critério eliminatório.`
    : o.veredito === "aprovado" ? `Deve vender cerca de ${r(o.provavel)} por mês com a unidade madura, acima dos ${r(o.meta)} que pagam o investimento em ${anos(o.mesesAprovado)}${pb}.${limitado ? " Mesmo assim o parecer não passa de \"com condicionantes\": sem o Censo desta região, a demanda não foi medida." : ""}`
    : o.veredito === "atencao" && o.provavel >= o.meta ? `Deve vender cerca de ${r(o.provavel)} por mês com a unidade madura, acima dos ${r(o.meta)} que pagam o investimento em ${anos(o.mesesAprovado)}${pb}. O parecer fica com condicionantes pelo que está listado abaixo.`
    : o.veredito === "atencao" ? `Deve vender cerca de ${r(o.provavel)} por mês, abaixo dos ${r(o.meta)} que pagam o investimento em ${anos(o.mesesAprovado)}, mas dentro do limite de ${anos(o.mesesAtencao)}${pb}. A margem é apertada.`
    : `Deve vender cerca de ${r(o.provavel)} por mês, abaixo do mínimo para o investimento voltar em ${anos(o.mesesAtencao)}${pb}.`;
  const pf = (x: number) => `${Math.round(x * 100)}%`;
  const fatiaAlta = o.fatia && o.fatia.valor > o.fatia.maxima;
  const freioReprova = (o.freios ?? []).find((f) => f.nivel === "reprovado");
  const textosFreios = (o.freios ?? []).map((f) => f.texto).join(" ");
  const contaFecha = o.provavel >= o.meta ? `A conta do dinheiro fecha: deve vender cerca de ${r(o.provavel)} por mês com a unidade madura, acima dos ${r(o.meta)} que pagam o investimento em ${anos(o.mesesAprovado)}. ` : "";
  const porqueFinal = freioReprova && o.vagas?.situacao !== "insuficiente" && !fatiaAlta
    ? (contaFecha ? `${contaFecha}Mas o ponto não aprova: ${textosFreios}` : `${porque} Além disso: ${textosFreios}`)
    : (o.freios ?? []).length && o.veredito === "atencao" && o.provavel >= o.meta && o.vagas?.situacao !== "insuficiente" && !fatiaAlta
    ? `${contaFecha}O parecer fica com condicionantes: ${textosFreios}`
    : fatiaAlta && o.vagas?.situacao !== "insuficiente"
    ? `Para vender ${r(o.provavel)} por mês, o ponto precisaria de ${pf(o.fatia!.valor)} de tudo o que os moradores da área de 10 min gastam com esportes (${r(o.fatia!.potencial)} por mês). Nenhuma unidade da rede tira tanto do seu mercado: a maior fica em ${pf(o.fatia!.maxima)}.`
    : porque;
  const condicoes: string[] = [];
  if (o.semCenso) condicoes.push("Medir a demanda antes de decidir: o Atlas não tem o Censo desta região (a malha cobre só a região das unidades), então moradores, renda, idade e divisão com a rede não entraram. O parecer vale só pela estimativa de vendas por m² da rede.");
  if (fatiaAlta) condicoes.push("Procurar um ponto com mais gente e mais renda em volta, ou um imóvel menor, até a fatia do mercado ficar dentro do que a rede já faz.");
  else if (o.fatia && o.fatia.valor > o.fatia.comum) condicoes.push(`O ponto precisa tirar ${pf(o.fatia.valor)} do mercado de esportes da região, mais que 3 em cada 4 unidades da rede (até ${pf(o.fatia.comum)}): só as mais fortes conseguem.`);
  if (o.veredito === "atencao" && o.provavel < o.meta && o.vagas?.situacao !== "insuficiente") condicoes.push("Baixar o investimento ou o aluguel (carência, imóvel menor, obra mais barata) até a conta fechar na régua.");
  if (o.vagas?.situacao === "limite") condicoes.push(`Garantir mais vagas: as informadas estão no limite (o ideal são ${o.vagas.max}).`);
  if (o.vagas?.situacao === "sem-dado") condicoes.push(`Confirmar o estacionamento: o ponto precisa de ${o.vagas.min} a ${o.vagas.max} vagas (próprias ou bem perto).`);
  if (!(o.freios ?? []).some((f) => f.id === "populacao") && (o.populacao?.situacao === "abaixo" || o.populacao?.situacao === "limite")) condicoes.push(`Conferir o público na visita: a área de 10 min tem menos moradores que os ${Math.round(o.populacao.recomendada / 1000).toLocaleString("pt-BR")} mil recomendados.`);
  for (const d of o.divideCom ?? []) if (Math.round(d.parte * 100) >= 20) condicoes.push(`Aceitar dividir ${Math.round(d.parte * 100)}% do público com ${/^World Gym /.test(d.nome) ? `a ${d.nome}` : `o ponto "${d.nome}", já aprovado`}.`);
  for (const f of o.freios ?? []) condicoes.push(f.condicao);
  return { rotulo: PARECER_ROTULO[o.vagas?.situacao === "insuficiente" ? "reprovado" : limitarSemCenso(o.veredito, o.semCenso)], porque: porqueFinal, condicoes };
}
/** Veredito final: o do modelo, mas estacionamento insuficiente reprova (critério eliminatório). */
export const vereditoFinal = (v: Veredito, vagas: { situacao: SituacaoVagas } | null): Veredito => (vagas?.situacao === "insuficiente" ? "reprovado" : v);

// ---------- Unidades parecidas, com comparação (pedido do dono, 23/11/2026) ----------

/** Quão diferente é a vizinhança (2 km) de duas posições: distância entre os logaritmos de moradores e de renda. */
const LIMITE_PARECIDA = 0.4; // ~ até 40-50% de diferença em moradores ou renda
export interface ItemParecida { u: UnidadeEstudo; moradores: number; renda: number | null; difMoradores: number; difRenda: number | null; parecida: boolean; leitura: string }
const pctTxt = (x: number) => `${Math.abs(Math.round(x * 100))}%`;

/**
 * Compara a vizinhança de uma posição (moradores e renda a até 2 km) com as unidades maduras do mesmo modelo e devolve as 3 mais parecidas,
 * cada uma com a leitura ("o ponto tem 20% mais moradores e renda 10% menor que Gama"). `semReferencia`: nenhuma passa do limite de parecida.
 * `excluir`: a própria unidade, no estudo de uma unidade em operação.
 */
export function compararComParecidas(c: [number, number], modelo: Modelo, censo: Censo, unidades: UnidadeEstudo[], { excluir, n = 3, sujeito = "o ponto" }: { excluir?: string; n?: number; sujeito?: string } = {}) {
  const alvo = arredores(c, censo);
  const ln = (x: number | null) => Math.log(Math.max(1, x ?? 1));
  const cand = unidades.filter((u) => u.madura && u.c && u.vendas && u.modelo === modelo && u.nome !== excluir).map((u) => {
    const a = arredores(u.c as [number, number], censo);
    const d = Math.hypot(ln(a.pop) - ln(alvo.pop), alvo.renda && a.renda ? ln(a.renda) - ln(alvo.renda) : 0);
    return { u, a, d };
  }).sort((x, y) => x.d - y.d).slice(0, n);
  const itens: ItemParecida[] = cand.map(({ u, a, d }) => {
    const difMoradores = a.pop ? alvo.pop / a.pop - 1 : 0;
    const difRenda = alvo.renda && a.renda ? alvo.renda / a.renda - 1 : null;
    const partes = [
      Math.abs(difMoradores) < 0.1 ? "quase os mesmos moradores" : `${pctTxt(difMoradores)} ${difMoradores > 0 ? "mais" : "menos"} moradores`,
      difRenda == null ? null : Math.abs(difRenda) < 0.1 ? "renda parecida" : `renda ${pctTxt(difRenda)} ${difRenda > 0 ? "maior" : "menor"}`,
    ].filter(Boolean);
    return { u, moradores: a.pop, renda: a.renda, difMoradores, difRenda, parecida: d <= LIMITE_PARECIDA, leitura: `${sujeito.charAt(0).toUpperCase() + sujeito.slice(1)} tem ${partes.join(" e ")} a até 2 km que a WG ${u.nome}.` };
  });
  return { alvo, itens, semReferencia: !itens.some((i) => i.parecida) };
}

/** Leitura geral: o que as parecidas dizem sobre o ponto (ou sobre a unidade em operação, com `vendas`). */
export function leituraParecidas(res: ReturnType<typeof compararComParecidas>, vendas?: number | null) {
  const boas = res.itens.filter((i) => i.parecida);
  if (!res.itens.length) return "A rede ainda não tem unidades maduras deste modelo para comparar.";
  if (res.semReferencia) return "Nenhuma unidade madura da rede tem vizinhança parecida (moradores e renda a até 2 km). As mais próximas aparecem abaixo só como referência: a previsão fica menos segura.";
  const media = boas.reduce((a, i) => a + (i.u.vendas ?? 0), 0) / boas.length;
  const mediaMoradores = boas.reduce((a, i) => a + i.moradores, 0) / boas.length;
  const maisGente = res.alvo.pop / mediaMoradores - 1;
  if (vendas != null) {
    const dif = vendas / media - 1;
    return `As ${boas.length === 1 ? "unidade parecida vende" : `${boas.length} unidades parecidas vendem`} em média R$ ${Math.round(media / 1000).toLocaleString("pt-BR")} mil por mês; esta unidade vende ${pctTxt(dif)} ${dif >= 0 ? "a mais" : "a menos"}. ${Math.abs(maisGente) < 0.15 ? (dif >= 0.1 ? "Com vizinhança parecida, a diferença vem mais da operação (gestão, equipe, preço) do que do ponto." : dif <= -0.1 ? "Com vizinhança parecida, a diferença indica espaço para melhorar a operação: as parecidas vendem mais com o mesmo tipo de entorno." : "Vende em linha com unidades de entorno parecido.") : maisGente > 0 ? "Ela tem mais moradores em volta que as parecidas, o que explica parte da diferença." : "Ela tem menos moradores em volta que as parecidas, o que explica parte da diferença."}`;
  }
  return `${boas.length === 1 ? "A unidade parecida vende" : `As ${boas.length} unidades parecidas vendem`} em média R$ ${Math.round(media / 1000).toLocaleString("pt-BR")} mil por mês. ${Math.abs(maisGente) < 0.15 ? "O ponto tem vizinhança parecida com a delas: é uma boa referência do que ele pode vender." : maisGente > 0 ? `O ponto tem ${pctTxt(maisGente)} mais moradores em volta que elas, o que favorece vender acima dessa média.` : `O ponto tem ${pctTxt(maisGente)} menos moradores em volta que elas: é prudente esperar menos que essa média.`}`;
}
