// Contratos de prazo fixo que venceram e NÃO foram renovados, por unidade, direto do relatório de gestão do EVO
// (o mesmo número do painel Dashboard > Renovações). O relatório vem em Excel e cobre todas as unidades.
// Cancelados (FlCancelado = True) ficam de fora: não são vencimentos.
import { evoBuffer } from "./evo.js";
import { diaDeCorte } from "./ativos.js";
import { lerXlsx } from "./xlsx.js";

/** Mapa idFilial -> contratos vencidos e não renovados no mês (até hoje, se o mês está em andamento). */
export async function naoRenovadosDoMes(ym, hoje) {
  const fim = diaDeCorte(ym, hoje);
  const buf = await evoBuffer(`/api/v2/management/not-renewed?dtStart=${ym}-01&dtEnd=${fim}`);
  const por = new Map();
  for (const r of lerXlsx(buf)) {
    if (r.FlCancelado !== "False") continue;
    const id = Number(r.IdFilial);
    por.set(id, (por.get(id) ?? 0) + 1);
  }
  return por;
}
