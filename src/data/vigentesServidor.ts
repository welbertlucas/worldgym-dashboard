// Alertas do mês em andamento para o resumo diário por e-mail (rotina do GitHub, em Node): as MESMAS regras da tela
// Alertas → Mês em andamento e do Plano de ação, para o e-mail e o Atlas dizerem a mesma coisa.
// Empacotado em server/gerado/vigentes.mjs (npm run build:vigentes) antes de rodar scripts/resumo-diario.mjs.
import { dashboardData, mergeEvo, type EvoMonth } from "@/data/dashboardData";
import { computeAlertasVigentes, type ResultadoVigente } from "@/data/alertasVigentes";
import { type Meta, type MetaKey } from "@/data/metas";

/** Meta como o servidor lê da planilha (server/metas.js). */
export interface MetaServidor { mes: string; unidade: string; chave: string; bronze?: number; prata?: number; ouro?: number }

/**
 * `meses`: o arquivo consolidado do Blob (o mesmo do painel). `hoje`: dia do resumo (AAAA-MM-DD); o resumo fala do dia anterior,
 * então os alertas são do mês de ontem (no dia 1º, o mês que acabou de fechar, como estava no último dia).
 */
export function alertasVigentesDoResumo(meses: EvoMonth[], metas: MetaServidor[] | null, hoje: string): ResultadoVigente {
  const t = new Date(`${hoje}T12:00:00`);
  t.setDate(t.getDate() - 1);
  dashboardData.length = 0;
  dashboardData.push(...mergeEvo([], meses));
  const atualizadoEm = meses.map((m) => m.generatedAt ?? "").sort().pop() || null;
  const ms: Meta[] = (metas ?? []).map((m) => ({ month: m.mes, unit: m.unidade, key: m.chave as MetaKey, bronze: m.bronze, prata: m.prata, ouro: m.ouro }));
  return computeAlertasVigentes(dashboardData, ms, { atualizadoEm, now: t, incluirRede: true });
}
