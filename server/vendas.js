// Vendas do mês (EVO /sales) resumidas por unidade: novos contratos, vendas online e receitas complementares.
// A rota devolve as vendas de TODAS as unidades de uma vez (o filtro idBranch é ignorado), então um mês inteiro
// custa uma única varredura. Regras conferidas contra a planilha (set/2026):
//  - novos contratos: itens de contrato que NÃO renovam um contrato anterior (idMembershipRenewed vazio), sem as diárias
//    vendidas como contrato;
//  - vendas online: soma das vendas feitas pelo site/totem (saleSource = 2), batem ao centavo onde a planilha é exata;
//  - diárias, kids/brinquedoteca, camisetas e coqueteleiras: soma dos itens pelo nome (cada unidade nomeia do seu jeito);
//  - taxa de personal: soma do valor dos contratos de personal vendidos (item de contrato com PERSONAL no nome). Em set/2026
//    bateu com a planilha em 21 das 23 unidades.
import { fetchAll } from "./evo.js";
import { UNIT_NAMES } from "./units.js";
import { semanaDoDia } from "./semanas.js";

const ONLINE = 2;
/** saleSource da recorrência automática (a renovação mensal do cartão): confere com o "Total de vendas recorrentes" do Gerencial do EVO. */
const RECORRENCIA = 11;
/** Renovação automática do cartão: origem 11, ou sem origem (nos meses já fechados o EVO traz a recorrência sem `saleSource`; venda manual e online sempre trazem). */
const ehRecorrencia = (s) => s.saleSource === RECORRENCIA || s.saleSource == null;
const upper = (i) => String(i.item || i.description || "").toUpperCase();

/**
 * Categoria de receita complementar de um item da venda (ou null).
 *  - kids (Brinquedoteca): diária kids e brinquedoteca avulsa. Mensalidade kids e luta infantil são contratos
 *    normais (planos locais da unidade) e não entram aqui;
 *  - diárias: DIÁRIA no nome (DIARIA, DIÁRIA, WG PRO DIÁRIA...), avulsa ou vendida como contrato ("11 - WG DIÁRIA 30,00");
 *  - camisetas e coqueteleiras: só itens avulsos (um contrato nunca vira camiseta).
 */
export function categoriaItem(item) {
  const t = upper(item);
  const kids = /KIDS|BRINQUEDOTECA/.test(t);
  if (kids && (!item.idMembership || /DI[AÁ]RIA|BRINQUEDOTECA/.test(t))) return "kids";
  if (kids) return null; // mensalidade kids: contrato normal
  // WG Plus e Pro+: contratos (2x, 3x, com piscina, dependente) e itens avulsos, somados pelo valor como o personal.
  if (/\bPRO ?\+/.test(t)) return "proMais";
  if (/\bPLUS\b/.test(t)) return "plus";
  if (/DI[AÁ]RIA/.test(t)) return "diarias";
  if (item.idMembership) return null;
  if (/COQUETEL|COQUETEIRA|SHAKER/.test(t)) return "coqueteleiras";
  if (/CAMIS/.test(t)) return "camisetas";
  return null;
}
export const categoriaAvulsa = categoriaItem;

const round2 = (n) => Math.round(n * 100) / 100;

/** Nome do plano como aparece na venda, sem espaços sobrando (" WG 30  " → "WG 30"). */
export const nomePlano = (i) => String(i.item || i.description || "").replace(/\s+/g, " ").trim();

/**
 * Tipo da venda de contrato: novo (matrícula), rematrícula (ex-aluno voltando) ou renovação. "renewal" no EVO é toda nova venda depois de um
 * contrato anterior, manual (plano com vigência) ou automática (recorrência mensal): a separação é feita em `tipoVenda.auto`.
 */
export function tipoDaVenda(venda, item) {
  if (venda.registrationKind === "enrollment") return "novo";
  if (venda.registrationKind === "re-enrollment") return "remat";
  if (venda.registrationKind === "renewal" || item.idMembershipRenewed) return "renov";
  return "novo";
}

/** Faixa de duração do plano: 0 mensal, 1 trimestral, 2 semestral, 3 anual, 4 outra (diária, semanal, 2 anos...). */
export function faixaDuracao(plano) {
  if (!plano || !plano.duration) return 4;
  const meses = plano.durationType === "Days" ? plano.duration / 30 : plano.durationType === "Months" ? plano.duration : plano.durationType === "Years" ? plano.duration * 12 : NaN;
  if (!(meses > 0)) return 4;
  if (meses >= 0.9 && meses <= 1.1) return 0;
  if (meses >= 2 && meses <= 3) return 1;
  if (meses >= 4 && meses <= 6) return 2;
  if (meses >= 7 && meses <= 12) return 3;
  return 4;
}

/**
 * Família do plano, para comparar a rede: cada unidade dá nome próprio aos seus planos ("WG JARDIM INGÁ LOCAL | R$ 139,90",
 * "01 - WG LOCAL RIACHO 2"...), então o ranking da rede agrupa pelo tipo do plano. A ordem das regras importa.
 */
export const CORTESIAS = "Cortesias e promoções";
const FAMILIAS = [
  // Cortesias, testes, promoções e convênios: contam nos planos vendidos, mas o painel não os mostra na lista por tipo.
  // Vêm antes para que "WG LOCAL MILITAR" não caia em WG Local.
  [CORTESIAS, /FREE ?PASS/],
  [CORTESIAS, /EXPERIMENTAL/],
  [CORTESIAS, /EX-? ?ALUNO|1[º°O]? M[ÊE]S/],
  ["Aquática", /AQUA|NATA[ÇC]|COMBO ?DUO/],
  [CORTESIAS, /PARCE|PACEIRO|MILITAR|GIFT|CONV[ÊE]NIO|TOP LIFE/],
  // WG 90 (pacote trimestral) conta como WG 30.
  ["WG 30", /WG ?-? ?90\b/],
  // Rede, PRO e Fit contam como WG Rede (antes de WG 30: "WG PRO 30" é Rede). Anual também, menos Anual VIP e Anual Local.
  ["WG Rede", /REDE|\bPRO\b|\bFIT\b|^(?!.*(VIP?\b|LOCAL)).*ANUAL/],
  ["WG 30", /WG ?-? ?30/],
  ["WG Local", /LOCAL|MENSAL|FLEX|\b[1-5] ?X\b/],
];
/** Plano com a primeira parcela abaixo disto conta como promoção, qualquer que seja o tipo (um WG Local ou um WG 30 barato é promoção). */
export const LIMITE_PROMOCAO = 129.9;
export const ehBarato = (preco) => typeof preco === "number" && preco >= 0 && preco < LIMITE_PROMOCAO;

/**
 * Valor da primeira parcela de um plano do catálogo do EVO: o valor do período promocional, quando o plano tem um; senão a mensalidade
 * equivalente (valor do contrato ÷ meses). Nulo quando o catálogo não traz valor ou duração (aí vale só o nome do plano).
 */
export function primeiraParcela(p) {
  const promo = Number(p?.valuePromotionalPeriod);
  if (promo > 0) return promo;
  const valor = Number(p?.value);
  const meses = p?.durationType === "Days" ? p.duration / 30 : p?.durationType === "Months" ? p.duration : p?.durationType === "Years" ? p.duration * 12 : NaN;
  return valor > 0 && meses > 0 ? Math.round((valor / meses) * 100) / 100 : null;
}

/**
 * Tipo de um contrato (vencido ou cancelado), para comparar a rede: diárias e free pass/experimental à parte; promoções de 1º mês, parcerias,
 * militares, gift card, os planos sem tipo reconhecido ("outros") e os de primeira parcela abaixo de R$ 129,90 como "Promoções"; o resto pelos tipos dos planos vendidos.
 */
export function tipoContrato(nome, preco = null) {
  const t = String(nome || "").toUpperCase();
  if (/DI[AÁ]RIA/.test(t)) return "Diárias";
  if (/FREE ?PASS|EXPERIMENTAL/.test(t)) return "Free pass e experimental";
  const f = familiaPlano(nome, preco);
  return f === CORTESIAS ? "Promoções" : f;
}

/** Família do plano. Sem tipo reconhecido ("outros") e plano barato (primeira parcela abaixo do limite) caem em Cortesias e promoções. */
export function familiaPlano(nome, preco = null) {
  const t = String(nome || "").toUpperCase();
  let f = CORTESIAS;
  for (const [fam, re] of FAMILIAS) if (re.test(t)) { f = fam; break; }
  return ehBarato(preco) ? CORTESIAS : f;
}

/** Item avulso que não é produto nem serviço: multa, taxa, pró-rata, inadimplência, estorno, ajuste. */
export const ehTaxa = (nome) => /MULTA|PR[OÓ][ -]?RATA|TAXA|ADES[AÃ]O|INADIMPL|CONTESTA|ESTORNO|AJUSTE|ACORDO|RECEBIMENTO|^TESTE/.test(String(nome || "").toUpperCase());

/** Plano de academia (entra no ranking de contratos vendidos): contrato que não é diária, brinquedoteca nem personal. */
const ehPlano = (i) => i.idMembership && !categoriaItem(i) && !/PERSONAL/.test(upper(i));


/**
 * Linha agrupada da lista de produtos e serviços: Pro+, WG Plus, diárias, brinquedoteca e taxa de personal entram com o total da categoria
 * (avulsas e vendidas como contrato, como nos cartões), em vez de uma linha por nome cadastrado na unidade.
 */
function grupoProduto(i, cat) {
  if (cat === "proMais") return "Pro+";
  if (cat === "plus") return "WG Plus";
  if (cat === "diarias") return "Diária";
  if (cat === "kids") return "Brinquedoteca";
  if (i.idMembership && /PERSONAL/.test(upper(i))) return "Taxa de personal";
  return null;
}

export const SEM_VENDEDOR = "Sem vendedor";
/** Quem vendeu (`nameEmployeeSale`). Vendas sem vendedor no EVO (online, recorrência) viram "Sem vendedor". */
export const nomeVendedor = (venda) => String(venda.nameEmployeeSale ?? "").replace(/\s+/g, " ").trim() || SEM_VENDEDOR;

/**
 * Resume as vendas do mês por unidade. `dias` = tamanho do mês, para `vendasDia` (novos contratos em cada dia do mês,
 * pelo dia da venda; o horário do EVO não é confiável, muitas vendas vêm às 00:00, então fica só o dia).
 */
export function resumirVendas(vendas, planos = new Map(), dias = 31) {
  const por = {};
  for (const s of vendas) {
    const nome = UNIT_NAMES[s.idBranch];
    if (!nome || s.removed) continue;
    const u = (por[nome] ??= { novosContratos: 0, vendasContratos: 0, vendasManuais: 0, vendasRecorrentes: 0, vendasOnlineContratos: 0, vendasOnline: 0, diarias: 0, camisetas: 0, coqueteleiras: 0, personal: 0, kids: 0, plus: 0, proMais: 0, _planos: new Map(), _vendedores: new Map(), _familias: new Map(), _avulsos: new Map(), _taxas: new Map(), tipoVenda: { novo: [0, 0], remat: [0, 0], renov: [0, 0], auto: [0, 0] }, duracaoVenda: [0, 0, 0, 0, 0], vendasDia: Array(dias).fill(0), semanas: Array.from({ length: dias > 28 ? 5 : 4 }, () => ({ novosContratos: 0, vendasContratos: 0, vendasOnline: 0, diarias: 0, camisetas: 0, coqueteleiras: 0, personal: 0, kids: 0, plus: 0, proMais: 0 })) });
    const dia = Number(String(s.saleDate ?? "").slice(8, 10));
    const sem = dia >= 1 && dia <= dias ? u.semanas[semanaDoDia(dia) - 1] : null; // semana do mês (relatórios semanais)
    for (const i of s.saleItens || []) {
      // Produtos e serviços avulsos (camiseta, coqueteleira, diária, avaliação...): ranking pelo valor vendido.
      const grupo = grupoProduto(i, categoriaItem(i));
      if (grupo) {
        const at = u._avulsos.get(grupo) ?? [0, 0];
        u._avulsos.set(grupo, [at[0] + (i.quantity || 1), at[1] + (i.saleValue || 0)]);
      } else if (!i.idMembership) {
        const n = nomePlano(i) || "Sem descrição";
        const lista = ehTaxa(n) ? u._taxas : u._avulsos;
        const at = lista.get(n) ?? [0, 0];
        lista.set(n, [at[0] + (i.quantity || 1), at[1] + (i.saleValue || 0)]);
      }
      if (ehPlano(i)) {
        const tipo = tipoDaVenda(s, i);
        const v = i.saleValue || 0;
        u.tipoVenda[tipo][0] += 1;
        u.tipoVenda[tipo][1] += v;
        // Renovação de plano de recorrência mensal (o item vem com valueNextMonth): o EVO renova sozinho todo mês. `auto` é parte de `renov`.
        if (tipo === "renov" && i.valueNextMonth != null) { u.tipoVenda.auto[0] += 1; u.tipoVenda.auto[1] += v; }
        // Ranking e duração olham só a venda nova (matrícula e rematrícula): renovação é, na maior parte, a recorrência mensal automática.
        if (tipo !== "renov") {
          const n = nomePlano(i);
          const at = u._planos.get(n) ?? [0, 0];
          u._planos.set(n, [at[0] + 1, at[1] + v]);
          const f = familiaPlano(n, planos.get(i.idMembership)?.primeira);
          const af = u._familias.get(f) ?? [0, 0];
          u._familias.set(f, [af[0] + 1, af[1] + v]);
          u.duracaoVenda[faixaDuracao(planos.get(i.idMembership))] += 1;
          // Ranking de vendedores (quem vendeu, `nameEmployeeSale`; o campo da comissão não é usado): contratos novos e rematrículas e o valor deles.
          const vend = nomeVendedor(s);
          const av = u._vendedores.get(vend) ?? [0, 0];
          u._vendedores.set(vend, [av[0] + 1, av[1] + v]);
        }
      }
      const cat = categoriaItem(i);
      // Diária vendida como contrato conta como diária, não como contrato novo.
      if (i.idMembership && !i.idMembershipRenewed && cat !== "diarias") {
        u.novosContratos += 1;
        if (dia >= 1 && dia <= dias) u.vendasDia[dia - 1] += 1;
        if (sem) sem.novosContratos += 1;
      }
      // "Contratos vendidos" como no Gerencial do EVO: toda venda de contrato lançada na recepção ou online (matrícula, rematrícula e renovação manual), sem a recorrência automática, a diária e o personal.
      if (i.idMembership && !ehRecorrencia(s) && cat !== "diarias" && !/PERSONAL/.test(upper(i))) { u.vendasContratos += 1; if (sem) sem.vendasContratos += 1; }
      // "Total de vendas" como no Gerencial do EVO: o valor das vendas de contrato do mês, separado por origem (recepção, recorrência automática, online).
      if (i.idMembership) {
        const v = i.saleValue || 0;
        if (ehRecorrencia(s)) u.vendasRecorrentes += v;
        else if (s.saleSource === ONLINE) u.vendasOnlineContratos += v;
        else u.vendasManuais += v;
      }
      if (s.saleSource === ONLINE) { u.vendasOnline += i.saleValue || 0; if (sem) sem.vendasOnline += i.saleValue || 0; }
      if (i.idMembership && /PERSONAL/.test(upper(i))) { u.personal += i.saleValue || 0; if (sem) sem.personal += i.saleValue || 0; }
      if (cat) { u[cat] += i.saleValue || 0; if (sem && cat in sem) sem[cat] += i.saleValue || 0; }
    }
  }
  for (const u of Object.values(por)) {
    for (const k of ["vendasManuais", "vendasRecorrentes", "vendasOnlineContratos", "vendasOnline", "diarias", "camisetas", "coqueteleiras", "personal", "kids", "plus", "proMais"]) u[k] = round2(u[k]);
    for (const t of Object.values(u.tipoVenda)) t[1] = round2(t[1]);
    for (const w of u.semanas) for (const k of ["vendasOnline", "diarias", "camisetas", "coqueteleiras", "personal"]) w[k] = round2(w[k]);
    // Guarda os 10 planos mais vendidos (o painel mostra 5; a rede soma os das unidades).
    u.contratosVendidos = [...u._planos].map(([n, [q, v]]) => [n, q, round2(v)]).sort((a, b) => b[1] - a[1] || b[2] - a[2]).slice(0, 10);
    u.familiasVendidas = [...u._familias].map(([n, [q, v]]) => [n, q, round2(v)]).sort((a, b) => b[1] - a[1] || b[2] - a[2]);
    const porValor = (m) => [...m].map(([n, [q, v]]) => [n, q, round2(v)]).filter(([, , v]) => v > 0).sort((a, b) => b[2] - a[2] || b[1] - a[1]).slice(0, 10);
    u.produtosVendidos = porValor(u._avulsos);
    u.taxasCobradas = porValor(u._taxas);
    // Resumo de todas as cobranças avulsas (a lista acima guarda só as 10 maiores): [valor total, multas (qtd), multas (valor)].
    const todas = [...u._taxas];
    const multas = todas.filter(([n]) => /MULTA/i.test(n));
    u.taxasResumo = [round2(todas.reduce((n, [, [, v]]) => n + v, 0)), multas.reduce((n, [, [q]]) => n + q, 0), round2(multas.reduce((n, [, [, v]]) => n + v, 0))];
    // Vendedores: os 10 maiores por quantidade de contratos (e valor, no empate) e o total da unidade, para o painel mostrar "Outros".
    // "Sem vendedor" (online e recorrência, que o EVO não atribui a ninguém) entra na soma, mas nunca no ranking.
    const vend = [...u._vendedores].map(([n, [q, v]]) => [n, q, round2(v)]);
    u.vendedores = vend.filter(([n]) => n !== SEM_VENDEDOR).sort((a, b) => b[1] - a[1] || b[2] - a[2] || a[0].localeCompare(b[0], "pt-BR")).slice(0, 10);
    u.vendedoresTotal = [vend.reduce((n, [, q]) => n + q, 0), round2(vend.reduce((n, [, , v]) => n + v, 0)), vend.filter(([n]) => n !== SEM_VENDEDOR).length, vend.filter(([n]) => n === SEM_VENDEDOR).reduce((n, [, q]) => n + q, 0)];
    delete u._vendedores;
    delete u._planos;
    delete u._familias;
    delete u._avulsos;
    delete u._taxas;
  }
  return por;
}

/** Catálogo de planos de todas as unidades (id → duração, nome e valor da primeira parcela), para a duração e o tipo dos contratos. */
export async function catalogoDePlanos() {
  const planos = new Map();
  for (const id of Object.keys(UNIT_NAMES)) {
    for (const p of await fetchAll(`/membership?idBranch=${id}`)) planos.set(p.idMembership, { duration: p.duration, durationType: p.durationType, nome: p.nameMembership, primeira: primeiraParcela(p) });
  }
  return planos;
}

let memoCatalogo = null;
/**
 * O mesmo catálogo, lido uma vez só por execução (cancelados e não renovados classificam pelo preço do plano). Se a leitura falhar, segue só pelo
 * nome do plano, avisando, para não derrubar a rotina.
 */
export function catalogoEmMemoria() {
  memoCatalogo ??= catalogoDePlanos().catch((e) => { console.warn(`catálogo de planos indisponível (${e.message}): tipos só pelo nome do plano`); return new Map(); });
  return memoCatalogo;
}
/** Nome do plano (sem espaços repetidos, em maiúsculas) → primeira parcela, para os relatórios que só trazem o nome do contrato. */
export function precosPorNome(planos) {
  const m = new Map();
  for (const p of planos.values()) if (p.nome && p.primeira != null) { const k = String(p.nome).trim().replace(/\s+/g, " ").toUpperCase(); if (!m.has(k)) m.set(k, p.primeira); }
  return m;
}

export async function vendasDoMes(ym, planos) {
  const [y, m] = ym.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  // idBranch é obrigatório na rota, mas ignorado: traz todas as unidades.
  return resumirVendas(await fetchAll(`/sales?idBranch=5&dateSaleStart=${ym}-01&dateSaleEnd=${ym}-${String(ultimo).padStart(2, "0")}`), planos, ultimo);
}
