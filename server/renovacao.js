// Contratos de prazo fixo que venceram e NÃO foram renovados, por unidade, direto do relatório de gestão do EVO
// (o mesmo número do painel Dashboard > Renovações). O relatório vem em Excel e cobre todas as unidades.
// Cancelados (FlCancelado = True) ficam de fora: não são vencimentos.
import { evoBuffer } from "./evo.js";
import { diaDeCorteRenovacao } from "./ativos.js";
import { lerXlsx } from "./xlsx.js";
import { catalogoEmMemoria, precosPorNome, tipoContrato } from "./vendas.js";

/** Tipo do contrato não renovado (mesma regra dos cancelados). */
export const tipoNaoRenovado = tipoContrato;
const nomeChave = (n) => String(n).trim().replace(/\s+/g, " ").toUpperCase();

/**
 * Por unidade: quantos contratos venceram sem renovar no mês, quantos por tipo (todos) e os planos com mais não renovados
 * (pelo nome do contrato no EVO, os 10 maiores). Só contagens: nenhum dado do aluno sai daqui.
 */
export async function relatorioNaoRenovados(ym, hoje, planos = null) {
  const fim = diaDeCorteRenovacao(ym, hoje);
  const por = new Map();
  if (fim < `${ym}-01`) return por; // hoje é dia 1: ainda não há vencimento fechado no mês
  const precos = precosPorNome(planos ?? (await catalogoEmMemoria()));
  const buf = await evoBuffer(`/api/v2/management/not-renewed?dtStart=${ym}-01&dtEnd=${fim}`);
  for (const r of lerXlsx(buf)) {
    if (r.FlCancelado !== "False") continue;
    const id = Number(r.IdFilial);
    const u = por.get(id) ?? { n: 0, tipos: {}, planos: new Map() };
    const nome = String(r.ContratoVencido || "Sem nome").trim().replace(/\s+/g, " ");
    const tipo = tipoNaoRenovado(nome, precos.get(nomeChave(nome)));
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
