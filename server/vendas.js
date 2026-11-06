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

export function resumirVendas(vendas) {
  const por = {};
  for (const s of vendas) {
    const nome = UNIT_NAMES[s.idBranch];
    if (!nome || s.removed) continue;
    const u = (por[nome] ??= { novosContratos: 0, vendasOnline: 0, diarias: 0, camisetas: 0, coqueteleiras: 0, personal: 0, kids: 0 });
    for (const i of s.saleItens || []) {
      const cat = categoriaItem(i);
      // Diária vendida como contrato conta como diária, não como contrato novo.
      if (i.idMembership && !i.idMembershipRenewed && cat !== "diarias") u.novosContratos += 1;
      if (s.saleSource === ONLINE) u.vendasOnline += i.saleValue || 0;
      if (i.idMembership && /PERSONAL/.test(upper(i))) u.personal += i.saleValue || 0;
      if (cat) u[cat] += i.saleValue || 0;
    }
  }
  for (const u of Object.values(por)) for (const k of ["vendasOnline", "diarias", "camisetas", "coqueteleiras", "personal", "kids"]) u[k] = round2(u[k]);
  return por;
}

export async function vendasDoMes(ym) {
  const [y, m] = ym.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  // idBranch é obrigatório na rota, mas ignorado: traz todas as unidades.
  return resumirVendas(await fetchAll(`/sales?idBranch=5&dateSaleStart=${ym}-01&dateSaleEnd=${ym}-${String(ultimo).padStart(2, "0")}`));
}
