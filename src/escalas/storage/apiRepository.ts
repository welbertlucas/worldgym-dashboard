// Escalas guardadas no servidor do Atlas (rota /api/escalas, Blob privado). Quem pode ver e gravar cada unidade é decidido pelo servidor a cada pedido,
// não por este código: o gestor só recebe as escalas das unidades dele.
import { API_BASE, authFetch } from '@/lib/auth';
import { normalizeSchedule } from '../domain/scheduleOps';
import type { Schedule, Team } from '../domain/types';
import type { UnitRoster, UnitSettings } from '../domain/roster';
import type { ScheduleRepository, ScheduleSummary, ScheduleVersion, StoredRoster, StoredSettings } from './repository';

interface Resumo {
  id: string; unidade: string; equipe: Team | null; ano: number; mes: number; status: Schedule['status'];
  confirmadaEm: string | null; gerada: boolean; elaboradaPor: string | null; atualizadaEm: string; atualizadaPorNome: string | null;
}
const resumo = (l: Resumo): ScheduleSummary => ({
  id: l.id, unitId: l.unidade || undefined, team: l.equipe ?? undefined, managerName: l.elaboradaPor ?? undefined,
  year: l.ano, month: l.mes, status: l.status, updatedAt: l.atualizadaEm, updatedBy: l.atualizadaPorNome ?? undefined,
  confirmedAt: l.confirmadaEm, generated: l.gerada,
});

async function chamar<T = Record<string, unknown>>(acao: string, corpo: Record<string, unknown> = {}, falha = 'Não consegui falar com o servidor agora. Confira a internet e tente de novo.'): Promise<T> {
  let r: Response;
  try {
    r = await authFetch(`${API_BASE}/escalas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao, ...corpo }) });
  } catch {
    throw new Error(falha);
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(typeof j.error === 'string' && j.error ? j.error : falha);
  return j as T;
}

export class ApiScheduleRepository implements ScheduleRepository {
  async listSchedules(unitId?: string): Promise<ScheduleSummary[]> {
    const j = await chamar<{ escalas: Resumo[] }>('listar', { unidade: unitId });
    return j.escalas.map(resumo);
  }

  async getSchedule(id: string): Promise<Schedule | null> {
    const j = await chamar<{ escala: Schedule | null }>('ler', { id });
    return j.escala ? normalizeSchedule(j.escala) : null;
  }

  async findSchedule(year: number, month: number, unitId?: string, team?: Team): Promise<Schedule | null> {
    const j = await chamar<{ escala: Schedule | null }>('achar', { ano: year, mes: month, unidade: unitId, equipe: team });
    return j.escala ? normalizeSchedule(j.escala) : null;
  }

  async latestSchedule(before?: { year: number; month: number }, unitId?: string, team?: Team): Promise<Schedule | null> {
    const j = await chamar<{ escala: Schedule | null }>('ultima', { antes: before, unidade: unitId, equipe: team });
    return j.escala ? normalizeSchedule(j.escala) : null;
  }

  async saveSchedule(schedule: Schedule): Promise<void> {
    await chamar('salvar', { escala: schedule }, 'Não consegui salvar a escala agora. Confira a internet e tente de novo.');
  }

  async deleteSchedule(id: string): Promise<void> {
    await chamar('apagar', { id }, 'Não consegui excluir a escala agora. Confira a internet e tente de novo.');
  }

  async listVersions(scheduleId: string): Promise<ScheduleVersion[]> {
    const j = await chamar<{ versoes: ScheduleVersion[] }>('versoes', { id: scheduleId }, 'Não consegui carregar o histórico agora.');
    return j.versoes;
  }

  async restoreVersion(versionId: number, scheduleId: string): Promise<Schedule | null> {
    const j = await chamar<{ escala: Schedule | null }>('restaurar', { id: scheduleId, versao: versionId }, 'Não consegui restaurar a versão agora.');
    return j.escala ? normalizeSchedule(j.escala) : null;
  }

  /** Escalas completas de um mês, de todas as unidades que a pessoa enxerga (painel da rede e relatório). */
  async monthSchedules(year: number, month: number): Promise<{ schedule: Schedule; updatedAt: string; updatedBy?: string }[]> {
    const j = await chamar<{ escalas: { schedule: Schedule; updatedAt: string; updatedBy?: string }[] }>('mes', { ano: year, mes: month }, 'Não consegui carregar o painel agora.');
    return j.escalas.map((x) => ({ schedule: normalizeSchedule(x.schedule), updatedAt: x.updatedAt, updatedBy: x.updatedBy }));
  }

  async getRoster(unitId: string, team: Team): Promise<StoredRoster | null> {
    const j = await chamar<{ equipe: StoredRoster | null }>('equipe-ler', { unidade: unitId, equipe: team }, 'Não consegui carregar o cadastro da equipe agora.');
    return j.equipe;
  }

  async saveRoster(unitId: string, team: Team, roster: UnitRoster): Promise<void> {
    await chamar('equipe-salvar', { unidade: unitId, equipe: team, roster }, 'Não consegui salvar o cadastro da equipe agora.');
  }

  async getNetworkDeadline(): Promise<{ day: number; updatedAt?: string; updatedBy?: string } | null> {
    const j = await chamar<{ prazo: { day: number; updatedAt?: string; updatedBy?: string } }>('prazo-ler', {}, 'Não consegui carregar o prazo da rede agora.');
    return j.prazo;
  }

  async saveNetworkDeadline(day: number): Promise<void> {
    await chamar('prazo-salvar', { dia: day }, 'Não consegui salvar o prazo da rede agora.');
  }

  async getUnitSettings(unitId: string): Promise<StoredSettings | null> {
    const j = await chamar<{ config: StoredSettings | null }>('config-ler', { unidade: unitId }, 'Não consegui carregar o funcionamento da unidade agora.');
    return j.config;
  }

  async saveUnitSettings(unitId: string, s: UnitSettings, opts: { includeLabor?: boolean } = {}): Promise<void> {
    await chamar('config-salvar', { unidade: unitId, settings: { operatingHours: s.operatingHours, holidayHours: s.holidayHours, localHolidays: s.localHolidays ?? [], labor: s.labor }, incluirJornada: !!opts.includeLabor }, 'Não consegui salvar o funcionamento da unidade agora.');
  }
}
