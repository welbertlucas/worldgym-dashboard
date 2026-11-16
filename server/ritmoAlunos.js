// Cancelamentos e renovações "até o dia D" de um mês, a partir do histórico de contratos (server/ativos.js, resumoAluno).
// Serve ao mês em andamento e, com o mesmo cálculo, ao mesmo dia dos meses anteriores (comparação justa no meio do mês).
// Só contagens: os alunos ficam em memória.
import { ativoNoDia, diaAnterior } from "./ativos.js";

const somaDias = (dia, n) => { const t = new Date(`${dia}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const diasNoMes = (ym) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
/** O dia D do mês `ym` (num mês mais curto, o último dia). */
export const diaDoMes = (ym, n) => `${ym}-${String(Math.min(n, diasNoMes(ym))).padStart(2, "0")}`;

/**
 * Contrato de prazo fixo (sem recorrência) que termina em [de, ate] e não foi cancelado: o "a vencer" do EVO.
 * Renovou se o aluno tem outro contrato que começa depois deste, até `limite` (inclusive), e não foi cancelado antes de começar.
 * Para o que já venceu, `limite` = hoje (a renovação começa logo depois do vencimento); para o que vai vencer, sem limite
 * (quem renovou adiantado já tem o contrato novo com início no futuro).
 */
function renovacoes(alunos, de, ate, limite) {
  let venceram = 0, naoRenovados = 0;
  for (const a of alunos) for (const c of a.c) {
    const [ini, fim, cancel, , rec] = c;
    if (!fim || fim < de || fim > ate || cancel || rec) continue;
    venceram++;
    const renovou = a.c.some((o) => o !== c && o[0] && o[0] > (ini ?? "") && o[0] <= limite && !(o[2] && o[2] <= o[0]));
    if (!renovou) naoRenovados++;
  }
  return { venceram, naoRenovados };
}

/**
 * Números do mês `ym` na madrugada do dia `hoje` (os dados vão até a véspera):
 *  - ativosIni, cancelados até a véspera e churn (% dos ativos no início);
 *  - contratos de prazo fixo que venceram até a véspera e quantos não renovaram até hoje.
 */
export function ritmoAteODia(alunos, ym, hoje) {
  const ini = `${ym}-01`, ontem = diaAnterior(hoje);
  const antes = diaAnterior(ini);
  let ativosIni = 0, cancelados = 0;
  for (const a of alunos) {
    if (ativoNoDia(a.c, antes)) ativosIni++;
    if (a.c.some(([, , cancel]) => cancel && cancel >= ini && cancel <= ontem)) cancelados++;
  }
  const r = ontem >= ini ? renovacoes(alunos, ini, ontem, hoje) : { venceram: 0, naoRenovados: 0 };
  return { ativosIni, cancelados, churnPct: ativosIni ? (cancelados / ativosIni) * 100 : 0, ...r };
}

/** Contratos de prazo fixo que vencem de hoje até hoje + dias − 1 e ainda não foram renovados. */
export function vencemEmBreve(alunos, hoje, dias) {
  return renovacoes(alunos, hoje, somaDias(hoje, dias - 1), "9999-12-31").naoRenovados;
}

const round1 = (n) => Math.round(n * 10) / 10;
const mesAnterior = (ym, k) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m - 1 - k, 1)).toISOString().slice(0, 7); };

/**
 * Para o mês em andamento de uma unidade: os números de hoje, a média do mesmo dia nos 3 meses anteriores e
 * os contratos que vencem nos próximos 7 dias sem renovação. Vai para o campo `ritmoAlunos` da unidade.
 */
export function ritmoAlunosDoMes(alunos, hoje, nMeses = 3) {
  const ym = hoje.slice(0, 7), n = Number(hoje.slice(8));
  const atual = ritmoAteODia(alunos, ym, hoje);
  const base = Array.from({ length: nMeses }, (_, k) => mesAnterior(ym, k + 1)).map((m) => ritmoAteODia(alunos, m, diaDoMes(m, n)));
  const media = (f) => round1(base.reduce((s, b) => s + f(b), 0) / base.length);
  const taxa = (b) => (b.venceram ? (b.naoRenovados / b.venceram) * 100 : 0);
  return {
    dia: n,
    cancelados: atual.cancelados, churnPct: round1(atual.churnPct),
    venceram: atual.venceram, naoRenovados: atual.naoRenovados, naoRenovadosPct: round1(taxa(atual)),
    vencem7: vencemEmBreve(alunos, hoje, 7),
    base: { meses: base.length, churnPct: media((b) => b.churnPct), naoRenovadosPct: media(taxa), venceram: media((b) => b.venceram) },
  };
}
