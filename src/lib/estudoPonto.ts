// Contas do estudo de ponto (sem tela e sem rede): vendas previstas pelo tamanho do imóvel, custo, payback, veredito,
// mapa de calor da captação e unidades parecidas. As premissas (números) vêm do servidor; aqui só as fórmulas.

export type Modelo = "low" | "pro";
export interface PremissaModelo { nome: string; padraoM2: number; investimento: number; fixoBase: number; fixoPorM2: number; variavel: number; limiteM2: number; pesoAcima: number; vendasPorM2?: number }
export interface Premissas {
  regua: { mesesAprovado: number; mesesAtencao: number; maturacaoMeses: number; maturidadeMeses?: number };
  modelos: Record<Modelo, PremissaModelo>;
  curva: { meiaDistanciaKm: number; raioKm: number };
}
export interface FaixaM2 { p25: number; mediana: number; p75: number; n: number }
/** `bairros`: onde moram os alunos ativos [bairro, lat, lng, alunos]; `previsto`: o que o modelo preveria pelo m² da unidade. */
export interface UnidadeEstudo {
  nome: string; c: [number, number] | null; m2: number | null; modelo: Modelo; abertura: string | null; madura: boolean; vendas: number | null; alunos: number | null;
  bairros?: [string, number, number, number][]; previsto?: { pessimista: number; provavel: number; otimista: number };
  /** Ticket médio realizado no EVO (recebido ÷ clientes pagantes), média dos últimos meses fechados. */
  ticket?: number | null;
}
/**
 * Hexágonos do Censo 2022: [lat, lng, população, renda média do responsável, domicílios ocupados, moradores por faixa de idade].
 * Faixas (FAIXAS_IDADE): 0–14, 15–19, 20–29, 30–39, 40–49, 50–59, 60+. Os dois últimos campos podem faltar em dados antigos.
 */
export type CelulaCenso = [number, number, number, number | null, number?, number[]?];
export interface Censo { rk: number; celulas: CelulaCenso[] }
export const FAIXAS_IDADE = ["0 a 14 anos", "15 a 19 anos", "20 a 29 anos", "30 a 39 anos", "40 a 49 anos", "50 a 59 anos", "60 anos ou mais"];

/**
 * Potencial de consumo em academia: gasto médio mensal das famílias com "Recreações e esportes" (IBGE, POF 2017-2018, tabela 1.1.1),
 * por faixa de rendimento familiar em salários mínimos de 2018 (R$ 954): até 2, 2–3, 3–6, 6–10, 10–15, 15–25 e mais de 25 SM.
 * A renda do hexágono é a renda média do responsável (Censo 2022, SM de R$ 1.212), usada como aproximação da renda da família
 * (fica conservador: a família costuma ter mais de uma renda). Valores de 2018 corrigidos pelo IPCA até 2026 (CORRECAO_POF, estimativa).
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
  for (const [lat, lng, , r, d] of censo.celulas) {
    if (!d || !dentroDaArea(lat, lng, g)) continue;
    const gasto = gastoDoDomicilio(r);
    if (gasto == null) continue;
    total += d * gasto; domicilios += d;
  }
  return domicilios ? { total, domicilios, porDomicilio: total / domicilios } : null;
}

/** Uma cor por faixa de idade (mapa: cada hexágono na cor da faixa que predomina por ano de idade), na ordem de FAIXAS_IDADE. */
export const CORES_IDADE = ["#f2c94c", "#f2994a", "#e86a92", "#27ae60", "#2bb3a3", "#2f80ed", "#8e5bd6"];
/** Anos de idade em cada faixa (60+ conta como 60 a 79), para comparar faixas de tamanhos diferentes. */
export const ANOS_FAIXA = [15, 5, 10, 10, 10, 10, 20];
/**
 * Faixa de idade que predomina no hexágono, comparando moradores POR ANO de idade (a faixa 0 a 14 junta 15 anos e ganharia quase
 * sempre se comparada pelo total: em Ceilândia ela é 19% dos moradores e "vencia" em 2 de cada 3 hexágonos). Null sem dado.
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
  const dom = CLASSES_DENSIDADE.map(() => 0);
  let moradores = 0;
  for (const [lat, lng, p, , d] of censo.celulas) {
    if (!d || !dentro(lat, lng)) continue;
    dom[classeDensidade(p / d)] += d; moradores += p;
  }
  const total = dom.reduce((a, b) => a + b, 0);
  return { classes: CLASSES_DENSIDADE.map((c, i) => ({ ...c, domicilios: dom[i], parte: total ? dom[i] / total : 0 })), total, porDomicilio: total ? moradores / total : null };
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
export interface Ponto { id: string; nome: string; regiao?: string; c: [number, number]; modelo: Modelo; m2: number; imovel: ImovelItens; autor?: { id: string; nome: string }; criadoEm?: string; atualizadoEm?: string; decisao?: Decisao }
export const DECISAO_ROTULO: Record<StatusDecisao, string> = { analise: "Em análise", aprovado: "Aprovado", recusado: "Recusado", unidade: "Virou unidade" };
/** completo: dono e liberados (criam e decidem); consulta: Master (vê tudo, não edita); unidade: só a própria unidade, sem premissas. */
export type ModoEstudos = "completo" | "consulta" | "unidade";
export interface DadosEstudos { disponivel: boolean; modo?: ModoEstudos; /** No modo unidade: as unidades da pessoa. */ minhas?: string[]; premissas?: Premissas; vendasPorM2?: Record<Modelo, FaixaM2 | null>; unidades?: UnidadeEstudo[]; censo?: Censo | null; pontos?: Ponto[] }

export type Veredito = "aprovado" | "atencao" | "reprovado";
export interface Resultado {
  pessimista: number; provavel: number; otimista: number;
  investimento: number; custoFixo: number; lucro: number; payback: number;
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
export const custoFixoDe = (m2: number, p: PremissaModelo) => p.fixoBase + p.fixoPorM2 * m2;
export const lucroDe = (vendas: number, m2: number, p: PremissaModelo) => vendas * (1 - p.variavel) - custoFixoDe(m2, p);
/** Meses para o investimento voltar, contando a maturação. Infinity quando não dá lucro. */
export function paybackDe(vendas: number, m2: number, p: PremissaModelo, maturacao: number): number {
  const l = lucroDe(vendas, m2, p);
  return l > 0 ? maturacao + investimentoDe(m2, p) / l : Infinity;
}
/** Vendas por mês que fazem o investimento voltar em `meses` (contando a maturação). */
export const vendasParaPayback = (meses: number, m2: number, p: PremissaModelo, maturacao: number) =>
  (investimentoDe(m2, p) / Math.max(1, meses - maturacao) + custoFixoDe(m2, p)) / (1 - p.variavel);

export function avaliarPonto(ponto: Pick<Ponto, "m2" | "modelo">, premissas: Premissas, faixa: FaixaM2): Resultado {
  const p = premissas.modelos[ponto.modelo], r = premissas.regua;
  const ef = m2Efetivo(ponto.m2, p);
  const provavel = faixa.mediana * ef, pessimista = faixa.p25 * ef, otimista = faixa.p75 * ef;
  const meta = vendasParaPayback(r.mesesAprovado, ponto.m2, p, r.maturacaoMeses);
  const limiteAtencao = vendasParaPayback(r.mesesAtencao, ponto.m2, p, r.maturacaoMeses);
  return {
    pessimista, provavel, otimista,
    investimento: investimentoDe(ponto.m2, p), custoFixo: custoFixoDe(ponto.m2, p),
    lucro: lucroDe(provavel, ponto.m2, p), payback: paybackDe(provavel, ponto.m2, p, r.maturacaoMeses),
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
export function captacaoDe(ponto: Ponto, censo: Censo, unidades: UnidadeEstudo[], outros: Ponto[], curva: Premissas["curva"]): Captacao {
  const rivais = [
    ...unidades.filter((u) => u.c && u.m2).map((u) => ({ nome: `World Gym ${u.nome}`, c: u.c as [number, number], m2: u.m2 as number })),
    ...outros.filter((o) => o.id !== ponto.id).map((o) => ({ nome: o.nome, c: o.c, m2: o.m2 })),
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
export interface Sugestao { c: [number, number]; publico: number; ganho: number; distanciaKm: number; renda: number | null; populacao2km: number; divideCom: { nome: string; parte: number }[] }

/**
 * Posições melhores por perto: testa os centros dos hexágonos do Censo com moradores num raio em volta do ponto e devolve as
 * melhores (público alcançável maior que o do ponto), afastadas entre si. `longeDeUnidadesKm` > 0 exclui posições perto de
 * World Gym existentes (para sugerir uma NOVA unidade na região de uma unidade em operação).
 */
export function posicoesMelhores(base: { c: [number, number]; m2: number }, censo: Censo, unidades: UnidadeEstudo[], outros: Ponto[], curva: Premissas["curva"],
  { raioKm = 3, n = 3, separacaoKm = 1, ganhoMinimo = 0.1, longeDeUnidadesKm = 0, minimoMoradores = 300, maxCanibalizacao = 1 }: { raioKm?: number; n?: number; separacaoKm?: number; ganhoMinimo?: number; longeDeUnidadesKm?: number; minimoMoradores?: number; maxCanibalizacao?: number } = {}) {
  const ref = publicoAlcancavel(base.c, base.m2, censo, unidades, outros, curva);
  const cand: Sugestao[] = [];
  for (const [lat, lng, pop] of censo.celulas) {
    if (pop < minimoMoradores) continue;
    const c: [number, number] = [lat, lng], d = km(c, base.c);
    if (d > raioKm || d < 0.4) continue;
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
  return { referencia: ref, sugestoes: escolhidas, testadas: cand.length };
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

/**
 * Classes de renda (as faixas do estudo de geomarketing, em reais) pela renda média do responsável pelo domicílio em cada
 * hexágono do Censo 2022. É uma aproximação: o Censo dá a média do hexágono, não a renda de cada casa.
 */
export const CLASSES_RENDA = [
  { id: "AA", rotulo: "Classe AA", faixa: "acima de R$ 22.770", min: 22770, cor: "#1e3a8a" },
  { id: "A", rotulo: "Classe A", faixa: "R$ 15.180 a 22.770", min: 15180, cor: "#0284c7" },
  { id: "B", rotulo: "Classe B", faixa: "R$ 7.590 a 15.180", min: 7590, cor: "#16a34a" },
  { id: "C", rotulo: "Classe C", faixa: "R$ 3.036 a 7.590", min: 3036, cor: "#8b5cf6" },
  { id: "D", rotulo: "Classe D", faixa: "R$ 1.518 a 3.036", min: 1518, cor: "#f59e0b" },
  { id: "E", rotulo: "Classe E", faixa: "até R$ 1.518", min: 0, cor: "#ef6f6c" },
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

/** Classes de renda dos hexágonos que passam no filtro. */
function classesEm(censo: Censo, dentro: (lat: number, lng: number) => boolean) {
  const conta = new Map<string, number>();
  let total = 0, soma = 0;
  for (const [lat, lng, p, r] of censo.celulas) {
    if (!dentro(lat, lng)) continue;
    const cl = classeDaRenda(r);
    if (!cl || !p) continue;
    conta.set(cl.id, (conta.get(cl.id) ?? 0) + p); total += p; soma += (r ?? 0) * p;
  }
  const parte = (id: string) => (total ? (conta.get(id) ?? 0) / total : 0);
  const classes = CLASSES_RENDA.map((cl) => ({ ...cl, parte: parte(cl.id) }));
  return { classes, moradores: total, media: total ? soma / total : null, ab: parte("AA") + parte("A") + parte("B"), cde: parte("C") + parte("D") + parte("E") };
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

export interface Fator { positivo: boolean; texto: string }
/** O que pesa a favor e contra, em frases curtas. */
export function fatoresDe(ponto: Ponto, r: Resultado, cap: Captacao, unidades: UnidadeEstudo[], censo: Censo, premissas: Premissas): Fator[] {
  const f: Fator[] = [];
  const p = premissas.modelos[ponto.modelo];
  if (r.foraDaFaixa) f.push({ positivo: false, texto: `Imóvel acima de ${p.limiteM2.toLocaleString("pt-BR")} m²: a rede não tem experiência nesse tamanho, o excedente conta pela metade` });
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

export const VEREDITO_ROTULO: Record<Veredito, string> = { aprovado: "Aprovado", atencao: "Atenção", reprovado: "Reprovado" };
export const reais = (v: number) => `R$ ${Math.round(v / 1000).toLocaleString("pt-BR")} mil`;
export const meses = (v: number) => (Number.isFinite(v) ? `${Math.round(v)} meses` : "não se paga");

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
export interface RefPopulacao { nome: string; vendas: number; moradores: number }
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
/** Veredito final: o do modelo, mas estacionamento insuficiente reprova (critério eliminatório). */
export const vereditoFinal = (v: Veredito, vagas: { situacao: SituacaoVagas } | null): Veredito => (vagas?.situacao === "insuficiente" ? "reprovado" : v);
