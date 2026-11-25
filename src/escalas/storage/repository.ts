import type { UnitRoster, UnitSettings } from '../domain/roster';
import type { Schedule, ScheduleStatus, Team } from '../domain/types';

export interface ScheduleSummary {
  id: string;
  unitId?: string;
  /** Equipe da escala; ausente = escala antiga com todos os departamentos. */
  team?: Team;
  /** Quem elaborou a escala. */
  managerName?: string;
  year: number;
  month: number;
  status: ScheduleStatus;
  updatedAt: string;
  /** Quem gravou por último (modo online). */
  updatedBy?: string;
  confirmedAt: string | null;
  generated: boolean;
}

export class AccessError extends Error {}

/** Uma versão guardada de uma escala (modo online). */
export interface ScheduleVersion {
  id: number;
  status: ScheduleStatus;
  generated: boolean;
  /** Marco que abriu a versão; ausente = edições. */
  milestone: 'criada' | 'gerada' | 'confirmada' | 'restaurada' | null;
  author: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Contrato de persistência das escalas salvas. A implementação atual guarda os rascunhos no
 * navegador de quem usa o gerador; pode ser trocada por um servidor sem mudar a interface.
 */
export interface ScheduleRepository {
  /** Com `unitId`, só as escalas daquela unidade. */
  listSchedules(unitId?: string): Promise<ScheduleSummary[]>;
  /** Escalas completas de um mês, de todas as unidades que a pessoa enxerga (painel da rede e relatório). */
  monthSchedules?(year: number, month: number): Promise<{ schedule: Schedule; updatedAt: string; updatedBy?: string }[]>;
  getSchedule(id: string): Promise<Schedule | null>;
  /**
   * Escala do mês (a mais recente, se houver mais de uma) — usada para importar os dias de borda.
   * Com `team`, só a escala daquela equipe (escalas antigas, sem equipe, contam como administrativa).
   */
  findSchedule(year: number, month: number, unitId?: string, team?: Team): Promise<Schedule | null>;
  /** Escala mais recente (opcionalmente anterior a um mês) — usada para reaproveitar a equipe. */
  latestSchedule(before?: { year: number; month: number }, unitId?: string, team?: Team): Promise<Schedule | null>;
  saveSchedule(schedule: Schedule): Promise<void>;
  deleteSchedule(id: string): Promise<void>;
  /** Histórico de versões (só no modo online). */
  listVersions?(scheduleId: string): Promise<ScheduleVersion[]>;
  /** Torna uma versão antiga a escala atual e devolve a escala restaurada. */
  restoreVersion?(versionId: number, scheduleId: string): Promise<Schedule | null>;
  /** Cadastro da equipe da unidade (só no modo online). */
  getRoster?(unitId: string, team: Team): Promise<StoredRoster | null>;
  saveRoster?(unitId: string, team: Team, roster: UnitRoster): Promise<void>;
  /** Horário de funcionamento e regras de jornada da unidade. */
  getUnitSettings?(unitId: string): Promise<StoredSettings | null>;
  /** Com includeLabor = false, as regras de jornada ficam como estão (o gestor não as altera). */
  saveUnitSettings?(unitId: string, settings: UnitSettings, opts?: { includeLabor?: boolean }): Promise<void>;
  /** Prazo da rede: dia do mês anterior até o qual a escala do mês deve estar confirmada. */
  getNetworkDeadline?(): Promise<{ day: number; updatedAt?: string; updatedBy?: string } | null>;
  /** Só Dono e Master. */
  saveNetworkDeadline?(day: number): Promise<void>;
}

export interface StoredSettings {
  settings: UnitSettings;
  updatedAt: string;
  updatedBy?: string;
}

export interface StoredRoster {
  roster: UnitRoster;
  updatedAt: string;
  updatedBy?: string;
}
