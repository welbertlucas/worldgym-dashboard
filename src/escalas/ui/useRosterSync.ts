// Liga a escala aberta ao cadastro da unidade (pessoas e regras dos departamentos da equipe; horário de
// funcionamento e regras de jornada da unidade).
// - Escalas do mês atual em diante, ainda não confirmadas, acompanham o cadastro.
// - Ao abrir: sem cadastro, a escala vira o cadastro; escala ainda não gerada recebe o cadastro sozinha;
//   escala já gerada e diferente mostra as diferenças e deixa o gestor escolher.
// - Enquanto estão em sintonia, mudanças de pessoas feitas na escala (férias) atualizam o cadastro.
// - "Ajustes só deste mês" (overrides) deixam o horário e/ou as regras dos departamentos fora disso.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applyRoster, applySettings, rosterDiff, rosterFromConfig, settingsFromConfig, stableStringify, type RosterDiff, type UnitRoster, type UnitSettings,
} from '../domain/roster';
import { teamDepts, type Schedule, type ScheduleConfig } from '../domain/types';
import type { ScheduleRepository } from '../storage/repository';

export interface UnitStored {
  roster: UnitRoster;
  settings: UnitSettings | null;
  updatedAt: string;
  updatedBy?: string;
}

export type RosterState =
  | { kind: 'off'; reason: 'sem-cadastro' | 'confirmada' | 'mes-passado' }
  | { kind: 'loading' }
  | { kind: 'sync'; stored: UnitStored | null; applied: boolean }
  | { kind: 'diff'; stored: UnitStored; diff: RosterDiff }
  | { kind: 'erro'; message: string };

function elegivel(repo: ScheduleRepository, s: Schedule): RosterState | null {
  if (!repo.getRoster || !repo.saveRoster || !s.unitId || !s.config.team) return { kind: 'off', reason: 'sem-cadastro' };
  if (s.status === 'confirmada') return { kind: 'off', reason: 'confirmada' };
  const hoje = new Date();
  if (s.year * 12 + s.month < hoje.getFullYear() * 12 + hoje.getMonth() + 1) return { kind: 'off', reason: 'mes-passado' };
  return null;
}

/** Aplica o cadastro (pessoas, regras, horário e jornada) a uma configuração de escala. */
export function applyUnit(c: ScheduleConfig, roster: UnitRoster | null, settings: UnitSettings | null): ScheduleConfig {
  let n = roster ? applyRoster(c, roster) : c;
  if (settings) n = applySettings(n, settings);
  return n;
}

/** Cadastro das pessoas a partir da escala, mantendo as regras do cadastro quando a escala tem ajuste do mês. */
function pessoasParaCadastro(config: ScheduleConfig, atual: UnitRoster): UnitRoster {
  const r = rosterFromConfig(config);
  if (config.overrides?.deptRules)
    for (const id of teamDepts(config)) if (r.departments[id]) r.departments[id]!.rules = atual.departments[id]?.rules ?? r.departments[id]!.rules;
  return r;
}

/** Gravações ainda em andamento (ao sair da escala): quem vai ler o cadastro espera por elas. */
let gravando: Promise<unknown> = Promise.resolve();
export function registrarGravacao(p: Promise<unknown>) {
  gravando = Promise.all([gravando, p.catch(() => undefined)]);
}
export const gravacoesPendentes = () => gravando;

export function useRosterSync(repo: ScheduleRepository, schedule: Schedule, update: (fn: (c: ScheduleConfig) => void) => void) {
  const [state, setState] = useState<RosterState>(() => elegivel(repo, schedule) ?? { kind: 'loading' });
  const salvo = useRef<{ roster: UnitRoster; settings: UnitSettings | null } | null>(null);
  const inicial = useRef(schedule);
  /** Gravação do cadastro ainda esperando: feita na hora se a escala for fechada antes. */
  const pendente = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => () => { if (pendente.current) registrarGravacao(pendente.current()); }, []);

  const aplicar = useCallback((roster: UnitRoster | null, settings: UnitSettings | null) => {
    update((c) => {
      const n = applyUnit(c, roster, settings);
      for (const id of teamDepts(c)) c.departments[id] = n.departments[id];
      c.operatingHours = n.operatingHours;
      c.holidayHours = n.holidayHours;
      c.labor = n.labor;
      c.localHolidays = n.localHolidays;
      c.holidays = n.holidays;
    });
  }, [update]);

  // Ao abrir a escala
  useEffect(() => {
    const s = inicial.current;
    if (elegivel(repo, s)) return;
    let vivo = true;
    (async () => {
      try {
        const [r, u] = await Promise.all([repo.getRoster!(s.unitId!, s.config.team!), repo.getUnitSettings ? repo.getUnitSettings(s.unitId!) : Promise.resolve(null)]);
        if (!vivo) return;
        let roster = r?.roster ?? null;
        let settings = u?.settings ?? null;
        // Sem cadastro ainda: a escala vira o cadastro.
        if (!roster) {
          roster = rosterFromConfig(s.config);
          await repo.saveRoster!(s.unitId!, s.config.team!, roster);
        }
        if (!settings && repo.saveUnitSettings) {
          settings = settingsFromConfig(s.config);
          await repo.saveUnitSettings(s.unitId!, settings, { includeLabor: true }).catch(() => undefined);
          settings = { ...settings, labor: null };
        }
        if (!vivo) return;
        salvo.current = { roster, settings };
        const stored: UnitStored = { roster, settings, updatedAt: r?.updatedAt ?? u?.updatedAt ?? new Date().toISOString(), updatedBy: r?.updatedBy ?? u?.updatedBy };
        const diff = rosterDiff(s.config, roster, settings);
        if (!diff) return setState({ kind: 'sync', stored: r ? stored : null, applied: false });
        if (!s.cells) {
          aplicar(roster, settings);
          return setState({ kind: 'sync', stored, applied: true });
        }
        setState({ kind: 'diff', stored, diff });
      } catch (e) {
        if (vivo) setState({ kind: 'erro', message: e instanceof Error ? e.message : 'Não consegui carregar o cadastro da unidade.' });
      }
    })();
    return () => { vivo = false; };
  }, [repo, aplicar]);

  // Em sintonia: leva mudanças das pessoas (ex.: férias lançadas na escala) para o cadastro.
  const emSintonia = state.kind === 'sync';
  useEffect(() => {
    if (!emSintonia || !salvo.current || schedule.status === 'confirmada') return;
    const atual = salvo.current.roster;
    const r = pessoasParaCadastro(schedule.config, atual);
    const mudouPessoas = stableStringify(r) !== stableStringify(atual);
    // Horário editado na aba Equipe (sem ajuste do mês) também vai para a unidade.
    const horario = { operatingHours: schedule.config.operatingHours, holidayHours: schedule.config.holidayHours };
    const base = salvo.current.settings;
    const mudouHorario = !!repo.saveUnitSettings && !schedule.config.overrides?.hours && !!base
      && stableStringify(horario) !== stableStringify({ operatingHours: base.operatingHours, holidayHours: base.holidayHours });
    if (!mudouPessoas && !mudouHorario) return;
    const gravar = async () => {
      pendente.current = null;
      try {
        if (mudouPessoas) {
          await repo.saveRoster!(schedule.unitId!, schedule.config.team!, r);
          if (salvo.current) salvo.current.roster = r;
        }
        if (mudouHorario && base) {
          const novo = { ...base, ...structuredClone(horario) };
          await repo.saveUnitSettings!(schedule.unitId!, novo, { includeLabor: false });
          if (salvo.current) salvo.current.settings = novo;
        }
      } catch (e) {
        setState({ kind: 'erro', message: e instanceof Error ? e.message : 'Não consegui salvar o cadastro da unidade.' });
      }
    };
    pendente.current = gravar;
    const t = setTimeout(() => void gravar(), 800);
    return () => clearTimeout(t);
  }, [emSintonia, schedule, repo]);

  const trazerDoCadastro = useCallback(() => {
    if (state.kind !== 'diff') return;
    aplicar(state.stored.roster, state.stored.settings);
    setState({ kind: 'sync', stored: state.stored, applied: true });
  }, [state, aplicar]);

  /** Mantém a equipe desta escala e leva as pessoas para o cadastro (horário e regras não mudam). */
  const levarParaCadastro = useCallback(async () => {
    if (state.kind !== 'diff') return;
    const r = pessoasParaCadastro(schedule.config, state.stored.roster);
    try {
      await repo.saveRoster!(schedule.unitId!, schedule.config.team!, r);
      salvo.current = { roster: r, settings: state.stored.settings };
      aplicar(r, state.stored.settings);
      setState({ kind: 'sync', stored: null, applied: false });
    } catch (e) {
      setState({ kind: 'erro', message: e instanceof Error ? e.message : 'Não consegui salvar o cadastro da equipe.' });
    }
  }, [state, schedule, repo, aplicar]);

  /** Desliga um ajuste só deste mês: a escala volta a seguir o cadastro naquele ponto. */
  const voltarAoCadastro = useCallback((which: 'hours' | 'deptRules') => {
    update((c) => {
      c.overrides = { ...c.overrides, [which]: false };
      const base = salvo.current;
      if (!base) return;
      const n = applyUnit(c, base.roster, base.settings);
      if (which === 'hours') { c.operatingHours = n.operatingHours; c.holidayHours = n.holidayHours; }
      else for (const id of teamDepts(c)) Object.assign(c.departments[id], { ...n.departments[id], employees: c.departments[id].employees, headcount: c.departments[id].headcount, enabled: c.departments[id].enabled });
    });
  }, [update]);

  return { state, trazerDoCadastro, levarParaCadastro, voltarAoCadastro };
}
