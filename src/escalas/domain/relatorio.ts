// Relatório mensal para a contabilidade: horas e dias de cada pessoa, por unidade e coordenação.
// Usa as mesmas contas da análise da escala. Horas adicionais = horas acima da jornada contratada nas
// semanas do mês (semanas que atravessam o mês entram inteiras, como na folha).
import { analyze } from './scheduleOps';
import { DEPT_IDS, deptEnabled, deptName, teamName, type Schedule, type Team } from './types';
import { UNIDADES } from '../config/unidades';

export type SituacaoEscala = 'confirmada' | 'rascunho' | 'em-configuracao';

export interface RelatorioLinha {
  unidadeId: string;
  unidade: string;
  team: Team;
  coordenacao: string;
  departamento: string;
  nome: string;
  situacao: SituacaoEscala;
  /** Jornada contratada por semana, em horas. */
  contratada: number;
  diasTrabalhados: number;
  minutosNoMes: number;
  minutosAdicionais: number;
  folgas: number;
  folgasFeriado: number;
  feriadosTrabalhados: number;
  sabados: number;
  domingos: number;
  diasFerias: number;
  coberturas: number;
}

export interface RelatorioTotais {
  pessoas: number;
  diasTrabalhados: number;
  minutosNoMes: number;
  minutosAdicionais: number;
  feriadosTrabalhados: number;
  diasFerias: number;
}

export const nomeDaUnidade = (id: string | undefined) => UNIDADES.find((u) => u.id === id)?.nome ?? id ?? 'Sem unidade';
const situacaoDe = (s: Schedule): SituacaoEscala => (s.status === 'confirmada' ? 'confirmada' : s.cells ? 'rascunho' : 'em-configuracao');

/** Uma linha por pessoa de cada escala gerada (escalas sem folgas geradas não entram). */
export function linhasDoRelatorio(schedules: Schedule[]): RelatorioLinha[] {
  const out: RelatorioLinha[] = [];
  for (const schedule of schedules) {
    if (!schedule.cells) continue;
    const analysis = analyze(schedule);
    if (!analysis) continue;
    const team: Team = schedule.config.team ?? 'administrativa';
    for (const id of DEPT_IDS.filter((d) => deptEnabled(schedule.config, d))) {
      const da = analysis.depts[id];
      da.resolved.ctx.employees.forEach((emp, e) => {
        const s = da.stats[e];
        out.push({
          unidadeId: schedule.unitId ?? '',
          unidade: nomeDaUnidade(schedule.unitId),
          team,
          coordenacao: teamName(team),
          departamento: deptName(id),
          nome: emp.name || 'Colaborador',
          situacao: situacaoDe(schedule),
          contratada: emp.weeklyContractedHours,
          diasTrabalhados: s.workedDays,
          minutosNoMes: s.monthMinutes,
          minutosAdicionais: s.weekExtra.reduce((a, b) => a + b, 0),
          folgas: s.offDays,
          folgasFeriado: s.holidayDays,
          feriadosTrabalhados: s.holidaysWorked,
          sabados: s.saturdays,
          domingos: s.sundays,
          diasFerias: s.vacationDays,
          coberturas: s.substitutions,
        });
      });
    }
  }
  return out.sort((a, b) => a.unidade.localeCompare(b.unidade, 'pt-BR') || a.team.localeCompare(b.team) || 0);
}

export function totais(linhas: RelatorioLinha[]): RelatorioTotais {
  return linhas.reduce<RelatorioTotais>((t, l) => ({
    pessoas: t.pessoas + 1,
    diasTrabalhados: t.diasTrabalhados + l.diasTrabalhados,
    minutosNoMes: t.minutosNoMes + l.minutosNoMes,
    minutosAdicionais: t.minutosAdicionais + l.minutosAdicionais,
    feriadosTrabalhados: t.feriadosTrabalhados + l.feriadosTrabalhados,
    diasFerias: t.diasFerias + l.diasFerias,
  }), { pessoas: 0, diasTrabalhados: 0, minutosNoMes: 0, minutosAdicionais: 0, feriadosTrabalhados: 0, diasFerias: 0 });
}

export interface PendenciaRelatorio { unidade: string; coordenacao: string; motivo: 'sem-escala' | 'em-configuracao' | 'rascunho' }

/** O que ainda não está confirmado no mês, por unidade e coordenação (para avisar antes de enviar). */
export function pendenciasDoRelatorio(schedules: Schedule[], unidades: string[]): PendenciaRelatorio[] {
  const out: PendenciaRelatorio[] = [];
  for (const u of unidades) {
    for (const team of ['administrativa', 'tecnica'] as Team[]) {
      const s = schedules.find((x) => x.unitId === u && (x.config.team ?? 'administrativa') === team);
      const motivo = !s ? 'sem-escala' : situacaoDe(s) === 'confirmada' ? null : situacaoDe(s) === 'em-configuracao' ? 'em-configuracao' : 'rascunho';
      if (motivo) out.push({ unidade: nomeDaUnidade(u), coordenacao: teamName(team), motivo });
    }
  }
  return out;
}

/** Texto do escopo: a unidade, "Toda a rede" ou "Minhas unidades". */
export const escopoDoRelatorio = (unidades: string[], todas: boolean) => (unidades.length === 1 ? nomeDaUnidade(unidades[0]) : todas ? 'Toda a rede' : `${unidades.length} unidades`);
