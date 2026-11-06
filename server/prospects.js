// Conversão de cadastros, como no relatório Gerencial > Prospects > "Cadastro/conversão de oportunidade" do EVO
// (com "Contabilizar especiais" e "Contabilizar conversões sem venda" marcadas, o padrão):
//  - oportunidades = prospects cadastrados no mês;
//  - conversões = desses, os que viraram cliente dentro do mesmo mês ("Convertido no período");
//  - origens = cadastradas e convertidas por origem do cadastro (coluna Marketing).
// Conferido contra a tela do EVO em Valparaíso/out-2026: 295 cadastrados e 257 convertidos.
// O relatório vem em Excel (todas as unidades de uma vez); as datas vêm em DD/MM/AAAA.
import { evoBuffer } from "./evo.js";
import { diaDeCorte } from "./ativos.js";
import { lerXlsx } from "./xlsx.js";
import { UNIT_NAMES } from "./units.js";

/** "TOTEM/SITE/ " → "Totem/Site"; vazio → "Sem origem". */
export function origemDaOportunidade(marketing) {
  const t = String(marketing ?? "").replace(/\/+\s*$/, "").trim();
  if (!t) return "Sem origem";
  return t.toLowerCase().replace(/(^|[\s/])(\p{L})/gu, (_m, sep, c) => sep + c.toUpperCase());
}

const iso = (d) => (/^\d\d\/\d\d\/\d{4}$/.test(d) ? d.split("/").reverse().join("-") : "");

/** Resume as linhas do relatório: { [unidade]: { oportunidades, conversoes } } para o período [de, ate]. */
export function resumirProspects(rows, de, ate) {
  const por = {};
  for (const r of rows) {
    const nome = UNIT_NAMES[Number(r.IdFilial)];
    if (!nome) continue;
    const cad = iso(r.DtCadastro);
    if (!cad || cad < de || cad > ate) continue;
    const u = (por[nome] ??= { oportunidades: 0, conversoes: 0, origens: {} });
    u.oportunidades += 1;
    const o = (u.origens[origemDaOportunidade(r.Marketing)] ??= [0, 0]); // [cadastradas, convertidas no mês]
    o[0] += 1;
    const conv = iso(r.DtConversao);
    if (conv && conv >= de && conv <= ate) { u.conversoes += 1; o[1] += 1; }
  }
  return por;
}

export async function prospectsDoMes(ym, hoje) {
  const ate = diaDeCorte(ym, hoje);
  const de = `${ym}-01`;
  const rows = lerXlsx(await evoBuffer(`/api/v2/management/prospects?dtStart=${de}&dtEnd=${ate}`));
  return resumirProspects(rows, de, ate);
}
