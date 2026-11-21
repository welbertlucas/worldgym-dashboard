// NPS por ponto de contato (WeHelp): Recepção, Limpeza, Manutenção, Estrutura, professores, grade de aulas etc.
// Só totais por unidade e mês: [respostas, promotores, detratores]. NPS = (promotores − detratores) ÷ respostas.
import type { UnitData } from "@/data/dashboardData";

export interface PontoSomado { resp: number; prom: number; det: number }
export interface LinhaDoPonto extends PontoSomado { ponto: string; nome: string; nps: number | null; neutros: number }

/** Com menos respostas que isso o NPS do ponto balança com poucos alunos: aparece com aviso. */
export const BASE_PEQUENA_PONTO = 15;
/** Faixas do NPS do WeHelp: 75 ou mais é excelência, 50 a 74 qualidade, abaixo disso melhorar. */
export const faixaDoNps = (v: number | null): "otimo" | "bom" | "melhorar" | "sem" => (v === null ? "sem" : v >= 75 ? "otimo" : v >= 50 ? "bom" : "melhorar");

/** "ATENDIMENTO PROFESSORES DE MUSCULAÇÃO" → "Atendimento professores de musculação". */
export const nomeDoPonto = (ponto: string) => { const t = ponto.trim().toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); };

export const npsDoPonto = (p: PontoSomado): number | null => (p.resp > 0 ? Math.round(((p.prom - p.det) / p.resp) * 1000) / 10 : null);

/** Soma os pontos de contato das unidades (a rede ou as unidades escolhidas). */
export function somarPontos(units: Pick<UnitData, "npsPontos">[]): Record<string, PontoSomado> {
  const por: Record<string, PontoSomado> = {};
  for (const u of units) for (const [ponto, [resp, prom, det]] of Object.entries(u.npsPontos ?? {})) {
    const a = (por[ponto] ??= { resp: 0, prom: 0, det: 0 });
    a.resp += resp; a.prom += prom; a.det += det;
  }
  return por;
}

/** Os pontos de contato do conjunto de unidades, do melhor NPS para o pior (os de poucas respostas por último). */
export function rankingDePontos(units: Pick<UnitData, "npsPontos">[]): LinhaDoPonto[] {
  const linhas = Object.entries(somarPontos(units)).map(([ponto, p]) => ({ ...p, ponto, nome: nomeDoPonto(ponto), nps: npsDoPonto(p), neutros: p.resp - p.prom - p.det }));
  return linhas.sort((a, b) => Number(a.resp < BASE_PEQUENA_PONTO) - Number(b.resp < BASE_PEQUENA_PONTO) || (b.nps ?? -999) - (a.nps ?? -999));
}

/** Todos os pontos que aparecem em algum mês ou unidade, na ordem de quem tem mais respostas. */
export function pontosPresentes(units: Pick<UnitData, "npsPontos">[]): string[] {
  return Object.entries(somarPontos(units)).sort((a, b) => b[1].resp - a[1].resp).map(([p]) => p);
}

/** Linha do tempo do NPS de um ponto de contato: um valor por mês (null sem respostas). */
export function serieDoPonto(meses: { month: string; units: Pick<UnitData, "name" | "npsPontos">[] }[], unidade: string | null, ponto: string): { month: string; nps: number | null; resp: number }[] {
  return meses.map((m) => {
    const us = unidade ? m.units.filter((u) => u.name === unidade) : m.units;
    const p = somarPontos(us)[ponto];
    return { month: m.month, nps: p ? npsDoPonto(p) : null, resp: p?.resp ?? 0 };
  });
}
