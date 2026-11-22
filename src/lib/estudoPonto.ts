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
export interface UnidadeEstudo { nome: string; c: [number, number] | null; m2: number | null; modelo: Modelo; abertura: string | null; madura: boolean; vendas: number | null; alunos: number | null }
/** Hexágonos do Censo 2022: [lat, lng, população, renda média do responsável]. */
export interface Censo { rk: number; celulas: [number, number, number, number | null][] }
export interface ImovelItens { fachada: boolean; estacionamento: boolean; polo: boolean; aPe: boolean }
/** `autor` vem do servidor (quem criou o estudo); ponto novo vai sem e fica com quem salvou. */
export interface Ponto { id: string; nome: string; c: [number, number]; modelo: Modelo; m2: number; imovel: ImovelItens; autor?: { id: string; nome: string } }
export interface DadosEstudos { disponivel: boolean; premissas?: Premissas; vendasPorM2?: Record<Modelo, FaixaM2 | null>; unidades?: UnidadeEstudo[]; censo?: Censo | null; pontos?: Ponto[] }

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
const lucroDe = (vendas: number, m2: number, p: PremissaModelo) => vendas * (1 - p.variavel) - custoFixoDe(m2, p);
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
