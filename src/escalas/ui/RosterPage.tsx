// Equipe e regras da unidade: preenchido uma vez e lido por todas as escalas.
// Funcionamento e regras de jornada valem para a unidade; pessoas e regras dos departamentos, por equipe.
// Salva sozinho. As regras de jornada só o Dono e o Master mudam.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UNIDADES } from '../config/unidades';
import { normalizeUnitRules, rostersFromUnitConfig, settingsFromConfig, stableStringify, unitConfig } from '../domain/roster';
import { weekendShiftRisks } from '../domain/risks';
import { createSchedule } from '../domain/scheduleOps';
import type { ScheduleConfig, Team } from '../domain/types';
import type { ScheduleRepository } from '../storage/repository';
import { LocalHolidaysCard, OperatingHoursCard, StepDepartamentos, StepJornada } from './steps/ConfigSteps';
import { PeopleList } from './steps/PeopleList';
import { gravacoesPendentes } from './useRosterSync';
import { DEPT_IDS } from '../domain/types';
import type { UnitTab } from './steps/MonthSteps';
import { porQuem } from './usuarioAtual';

const TABS: { value: UnitTab; label: string }[] = [
  { value: 'funcionamento', label: 'Funcionamento' },
  { value: 'pessoas', label: 'Pessoas' },
  { value: 'regras', label: 'Regras dos departamentos' },
  { value: 'jornada', label: 'Regras de jornada' },
];

const horario = (c: ScheduleConfig) => stableStringify(settingsFromConfig(c, false));
const jornada = (c: ScheduleConfig) => stableStringify(settingsFromConfig(c, true).labor);

export function RosterPage({ repo, unitId, initialTab = 'pessoas', focusId, canEditLabor, onBack, backLabel = 'Escalas salvas' }: {
  repo: ScheduleRepository;
  unitId: string;
  /** Equipe de onde veio (a lista é da unidade inteira; mantido por compatibilidade). */
  initialTeam?: Team;
  initialTab?: UnitTab;
  /** Elemento para destacar ao abrir (ex.: o colaborador com pendência). */
  focusId?: string;
  canEditLabor: boolean;
  onBack: () => void;
  backLabel?: string;
}) {
  const [tab, setTab] = useState<UnitTab>(initialTab);
  const [config, setConfig] = useState<ScheduleConfig | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [save, setSave] = useState<'salvo' | 'salvando' | 'erro'>('salvo');
  const [erro, setErro] = useState<string | null>(null);
  const ultimo = useRef({ administrativa: '', tecnica: '', horario: '', jornada: '' });

  useEffect(() => {
    let vivo = true;
    setConfig(null);
    setErro(null);
    (async () => {
      try {
        await gravacoesPendentes();
        const [adm, tec, unit, baseAdm, baseTec] = await Promise.all([
          repo.getRoster!(unitId, 'administrativa'),
          repo.getRoster!(unitId, 'tecnica'),
          repo.getUnitSettings ? repo.getUnitSettings(unitId) : Promise.resolve(null),
          repo.latestSchedule(undefined, unitId, 'administrativa'),
          repo.latestSchedule(undefined, unitId, 'tecnica'),
        ]);
        const hoje = new Date();
        const base = structuredClone((baseAdm ?? baseTec)?.config ?? createSchedule(hoje.getFullYear(), hoje.getMonth() + 1, null, unitId, 'administrativa').config);
        if (baseAdm && baseTec) for (const id of ['professores', 'estagiarios'] as const) base.departments[id] = structuredClone(baseTec.config.departments[id]);
        const c = unitConfig(base, { administrativa: adm?.roster, tecnica: tec?.roster }, unit?.settings);
        normalizeUnitRules(c);
        if (!vivo) return;
        const r = rostersFromUnitConfig(c);
        // Sem nada guardado ainda: o que está na tela é o ponto de partida e é salvo na primeira mudança.
        ultimo.current = {
          administrativa: adm ? stableStringify(r.administrativa) : '',
          tecnica: tec ? stableStringify(r.tecnica) : '',
          horario: unit ? horario(c) : '',
          jornada: unit?.settings.labor ? jornada(c) : '',
        };
        const quem = adm ?? tec ?? unit;
        setInfo(quem ? `Alterado em ${new Date(quem.updatedAt).toLocaleString('pt-BR')}${porQuem(quem.updatedBy)}` : 'Cadastro novo: cadastre as pessoas e confira o funcionamento.');
        setConfig(c);
      } catch (e) {
        if (vivo) setErro(e instanceof Error ? e.message : 'Não consegui carregar o cadastro.');
      }
    })();
    return () => { vivo = false; };
  }, [repo, unitId]);

  // Destaca o item com pendência (vindo da escala).
  useEffect(() => {
    if (!config || !focusId) return;
    const t = window.setTimeout(() => {
      const el = document.getElementById(focusId);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('flash');
      window.setTimeout(() => el.classList.remove('flash'), 1600);
    }, 80);
    return () => window.clearTimeout(t);
  }, [config, focusId, tab]);

  // Salvamento automático: pessoas e regras (cadastro de cada equipe) e funcionamento/jornada (unidade).
  const gravar = useCallback(async (c: ScheduleConfig) => {
    const r = rostersFromUnitConfig(c);
    const k = { administrativa: stableStringify(r.administrativa), tecnica: stableStringify(r.tecnica), horario: horario(c), jornada: canEditLabor ? jornada(c) : ultimo.current.jornada };
    const mudou = (['administrativa', 'tecnica'] as Team[]).filter((t) => k[t] !== ultimo.current[t]);
    const mudouUnidade = k.horario !== ultimo.current.horario || (canEditLabor && k.jornada !== ultimo.current.jornada);
    if (!mudou.length && !mudouUnidade) return false;
    ultimo.current = k;
    for (const t of mudou) await repo.saveRoster!(unitId, t, r[t]);
    if (mudouUnidade && repo.saveUnitSettings) await repo.saveUnitSettings(unitId, settingsFromConfig(c, true), { includeLabor: canEditLabor });
    return true;
  }, [repo, unitId, canEditLabor]);
  const ultimaTela = useRef<ScheduleConfig | null>(null);
  useEffect(() => {
    if (!config) return;
    ultimaTela.current = config;
    setSave('salvando');
    const t = setTimeout(async () => {
      try {
        if (await gravar(config)) setInfo(`Alterado em ${new Date().toLocaleString('pt-BR')}`);
        setSave('salvo');
      } catch (e) {
        setSave('erro');
        setErro(e instanceof Error ? e.message : 'Não consegui salvar.');
      }
    }, 600);
    return () => clearTimeout(t);
  }, [config, gravar]);
  // Ao sair da tela com mudança ainda não gravada, grava na hora.
  const sair = async () => {
    // O campo que estava em edição confirma o valor ao perder o foco: espera a tela atualizar.
    await new Promise((r) => window.setTimeout(r, 60));
    const u = ultimaTela.current;
    if (u) await gravar(u).catch(() => undefined);
    onBack();
  };

  const update = useCallback((fn: (c: ScheduleConfig) => void) => {
    setConfig((c) => {
      if (!c) return c;
      const n = structuredClone(c);
      fn(n);
      normalizeUnitRules(n);
      return n;
    });
  }, []);
  const risks = useMemo(() => (config ? weekendShiftRisks(config) : []), [config]);

  const unidade = UNIDADES.find((u) => u.id === unitId)?.nome ?? unitId;
  return (
    <section className="editor roster-page">
      <div className="page-head">
        <div>
          <button type="button" className="link back-link" onClick={() => void sair()}>{backLabel}</button>
          <h1>Equipe e regras da unidade <span className="team-title">· {unidade}</span></h1>
          <p className="muted"><span className={`save ${save}`}>{save === 'salvo' ? 'Salvo' : save === 'salvando' ? 'Salvando…' : 'Erro ao salvar'}</span>{info && <> · {info}</>}</p>
        </div>
      </div>
      <p className="muted roster-intro">Preencha uma vez: todas as escalas da unidade usam este cadastro. Escalas confirmadas e de meses passados não mudam.</p>

      <nav className="stepper" aria-label="Partes do cadastro">
        {TABS.map((t) => (
          <button type="button" key={t.value} className={`step ${tab === t.value ? 'on' : ''}`} aria-current={tab === t.value ? 'page' : undefined} onClick={() => setTab(t.value)}>{t.label}</button>
        ))}
      </nav>

      {erro && <div className="banner danger left" role="alert">{erro}</div>}
      {!config && !erro && <p className="muted">Carregando…</p>}
      {config && tab === 'funcionamento' && (
        <div className="stack">
          <OperatingHoursCard config={config} update={update}
            intro="Horário habitual da unidade, igual para as duas equipes. Se um mês for diferente (ex.: dezembro), ajuste só naquela escala, na aba Mês." />
          <LocalHolidaysCard config={config} update={update} />
        </div>
      )}
      {config && tab === 'pessoas' && <PeopleList config={config} update={update} depts={[...DEPT_IDS]} />}
      {config && tab === 'regras' && <StepDepartamentos config={config} update={update} risks={risks} weeklyOver={[]} cadastro />}
      {config && tab === 'jornada' && <StepJornada config={config} update={update} cadastro readOnly={!canEditLabor} />}
    </section>
  );
}
