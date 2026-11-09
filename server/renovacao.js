// Contratos de prazo fixo que venceram e NÃO foram renovados, por unidade, direto do relatório de gestão do EVO
// (o mesmo número do painel Dashboard > Renovações). O relatório vem em Excel e cobre todas as unidades.
// Cancelados (FlCancelado = True) ficam de fora: não são vencimentos.
import { evoBuffer } from "./evo.js";
import { diaDeCorte } from "./ativos.js";
import { lerXlsx } from "./xlsx.js";
import { familiaPlano } from "./vendas.js";

/** Tipo do contrato não renovado, para comparar a rede: diárias à parte; o resto pelos mesmos tipos dos planos vendidos. */
export function tipoNaoRenovado(nome) {
  return /DI[AÁ]RIA/i.test(String(nome || "")) ? "Diárias" : familiaPlano(nome);
}

/**
 * Por unidade: quantos contratos venceram sem renovar no mês, quantos por tipo (todos) e os planos com mais não renovados
 * (pelo nome do contrato no EVO, os 10 maiores). Só contagens: nenhum dado do aluno sai daqui.
 */
export async function relatorioNaoRenovados(ym, hoje) {
  const fim = diaDeCorte(ym, hoje);
  const buf = await evoBuffer(`/api/v2/management/not-renewed?dtStart=${ym}-01&dtEnd=${fim}`);
  const por = new Map();
  for (const r of lerXlsx(buf)) {
    if (r.FlCancelado !== "False") continue;
    const id = Number(r.IdFilial);
    const u = por.get(id) ?? { n: 0, tipos: {}, planos: new Map() };
    const nome = String(r.ContratoVencido || "Sem nome").trim().replace(/\s+/g, " ");
    const tipo = tipoNaoRenovado(nome);
    u.n++;
    u.tipos[tipo] = (u.tipos[tipo] ?? 0) + 1;
    u.planos.set(nome, (u.planos.get(nome) ?? 0) + 1);
    por.set(id, u);
  }
  for (const u of por.values()) u.planos = [...u.planos].sort((a, b) => b[1] - a[1]).slice(0, 10);
  return por;
}

/** Mapa idFilial -> contratos vencidos e não renovados no mês (até hoje, se o mês está em andamento). */
export async function naoRenovadosDoMes(ym, hoje) {
  return new Map([...(await relatorioNaoRenovados(ym, hoje))].map(([id, u]) => [id, u.n]));
}
