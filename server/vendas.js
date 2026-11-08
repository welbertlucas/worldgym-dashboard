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

const ONLINE = 2;
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

/** Tipo da venda de contrato: novo (matrícula), rematrícula (ex-aluno voltando) ou renovação. */
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

/** Plano de academia (entra no ranking de contratos vendidos): contrato que não é diária, brinquedoteca nem personal. */
const ehPlano = (i) => i.idMembership && !categoriaItem(i) && !/PERSONAL/.test(upper(i));

export function resumirVendas(vendas, planos = new Map()) {
  const por = {};
  for (const s of vendas) {
    const nome = UNIT_NAMES[s.idBranch];
    if (!nome || s.removed) continue;
    const u = (por[nome] ??= { novosContratos: 0, vendasOnline: 0, diarias: 0, camisetas: 0, coqueteleiras: 0, personal: 0, kids: 0, _planos: new Map(), _avulsos: new Map(), tipoVenda: { novo: [0, 0], remat: [0, 0], renov: [0, 0] }, duracaoVenda: [0, 0, 0, 0, 0] });
    for (const i of s.saleItens || []) {
      // Produtos e serviços avulsos (camiseta, coqueteleira, diária, avaliação...): ranking pelo valor vendido.
      if (!i.idMembership) {
        const n = nomePlano(i) || "Sem descrição";
        const at = u._avulsos.get(n) ?? [0, 0];
        u._avulsos.set(n, [at[0] + (i.quantity || 1), at[1] + (i.saleValue || 0)]);
      }
      if (ehPlano(i)) {
        const tipo = tipoDaVenda(s, i);
        const v = i.saleValue || 0;
        u.tipoVenda[tipo][0] += 1;
        u.tipoVenda[tipo][1] += v;
        // Ranking e duração olham só a venda nova (matrícula e rematrícula): renovação é, na maior parte, a recorrência mensal automática.
        if (tipo !== "renov") {
          const n = nomePlano(i);
          const at = u._planos.get(n) ?? [0, 0];
          u._planos.set(n, [at[0] + 1, at[1] + v]);
          u.duracaoVenda[faixaDuracao(planos.get(i.idMembership))] += 1;
        }
      }
      const cat = categoriaItem(i);
      // Diária vendida como contrato conta como diária, não como contrato novo.
      if (i.idMembership && !i.idMembershipRenewed && cat !== "diarias") u.novosContratos += 1;
      if (s.saleSource === ONLINE) u.vendasOnline += i.saleValue || 0;
      if (i.idMembership && /PERSONAL/.test(upper(i))) u.personal += i.saleValue || 0;
      if (cat) u[cat] += i.saleValue || 0;
    }
  }
  for (const u of Object.values(por)) {
    for (const k of ["vendasOnline", "diarias", "camisetas", "coqueteleiras", "personal", "kids"]) u[k] = round2(u[k]);
    for (const t of Object.values(u.tipoVenda)) t[1] = round2(t[1]);
    // Guarda os 10 planos mais vendidos (o painel mostra 5; a rede soma os das unidades).
    u.contratosVendidos = [...u._planos].map(([n, [q, v]]) => [n, q, round2(v)]).sort((a, b) => b[1] - a[1] || b[2] - a[2]).slice(0, 10);
    u.produtosVendidos = [...u._avulsos].map(([n, [q, v]]) => [n, q, round2(v)]).filter(([, , v]) => v > 0).sort((a, b) => b[2] - a[2] || b[1] - a[1]).slice(0, 10);
    delete u._planos;
    delete u._avulsos;
  }
  return por;
}

/** Catálogo de planos de todas as unidades (id → duração), para classificar a duração dos contratos vendidos. */
export async function catalogoDePlanos() {
  const planos = new Map();
  for (const id of Object.keys(UNIT_NAMES)) {
    for (const p of await fetchAll(`/membership?idBranch=${id}`)) planos.set(p.idMembership, { duration: p.duration, durationType: p.durationType });
  }
  return planos;
}

export async function vendasDoMes(ym, planos) {
  const [y, m] = ym.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  // idBranch é obrigatório na rota, mas ignorado: traz todas as unidades.
  return resumirVendas(await fetchAll(`/sales?idBranch=5&dateSaleStart=${ym}-01&dateSaleEnd=${ym}-${String(ultimo).padStart(2, "0")}`), planos);
}
