import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { carimbarAutor } from '../domain/avisos';
import { buildRange, formatDayMonth, monthLabel, previousMonth } from '../domain/calendar';
import { validateConfig, type ConfigIssue } from '../domain/schema';
import {
  addException, analyze, applyGeneration, confirmSchedule, configSignature, removeException, setCell, swapOffDays, updateConfig, type CellPatch,
} from '../domain/scheduleOps';
import { weekendShiftRisks } from '../domain/risks';
import { gerarLivre } from '../domain/generator';
import { LIVRE_LIMITE_SEMANAL_HORAS } from '../domain/validate';
import { generateFollowingMonths, MAX_FOLLOWING_MONTHS, type MonthResult } from '../domain/multiMonth';
import { DEPT_IDS, deptEnabled, deptName, teamName, type Alert, type DeptId, type Schedule, type ScheduleConfig, type Team } from '../domain/types';
import type { ScheduleRepository } from '../storage/repository';
import { HistoryDialog } from './HistoryDialog';
import { normalizeUnitRules } from '../domain/roster';
import { RosterBanner } from './RosterBanner';
import { registrarGravacao, useRosterSync } from './useRosterSync';
import { AlertsPanel } from './AlertsPanel';
import { IssueList } from './IssueList';
import { CalendarView, Legend } from './CalendarView';
import { Field, MenuButton, Modal, Segmented, Toggle } from './components/form';
import { CellDialog, ChangeReviewDialog, EmployeeDialog, ExceptionDialog, SwapDialog } from './Dialogs';
import { generateInBackground } from './generation';
import { pdfFileName } from '../pdf/names';
import { PdfExportDialog } from './PdfDialogs';
import { PdfIndividualDialog } from './PdfIndividualDialog';
import { UNIDADES } from '../config/unidades';
import { StepColaboradores, StepDepartamentos, StepFuncionamento, StepJornada } from './steps/ConfigSteps';
import { StepAusencias, StepEquipe, StepMes, type EquipeTab, type UnitTab } from './steps/MonthSteps';

/** Escalas ligadas ao cadastro da unidade: só o que é do mês. */
const STEPS_MES = [
  { id: 'equipe', label: 'Equipe' },
  { id: 'mes', label: 'Mês' },
  { id: 'ausencias', label: 'Ausências' },
  { id: 'escala', label: 'Escala' },
] as const;
/** Escalas antigas, sem equipe definida (ou sem cadastro): tudo dentro da escala, como antes. */
const STEPS_COMPLETO = [
  { id: 'funcionamento', label: 'Funcionamento' },
  { id: 'jornada', label: 'Jornada' },
  { id: 'departamentos', label: 'Departamentos' },
  { id: 'colaboradores', label: 'Colaboradores' },
  { id: 'escala', label: 'Escala' },
] as const;
type StepId = (typeof STEPS_MES)[number]['id'] | (typeof STEPS_COMPLETO)[number]['id'];
type IssueTarget = { header: true } | { step: StepId } | { equipe: EquipeTab } | { unit: UnitTab };

type CalendarMode = 'mes' | 'semana';
const VIEW_KEY = 'wg-escala5x2:visualizacao';

function storedView(): CalendarMode {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'semana' ? 'semana' : 'mes';
  } catch {
    return 'mes';
  }
}

/** Semana de hoje, se estiver no mês da escala; senão a primeira. */
function currentWeekIndex(year: number, month: number): number {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const i = buildRange(year, month).dates.indexOf(today);
  return i >= 0 ? Math.floor(i / 7) : 0;
}

export function ScheduleEditor({ repo, initial, onClose, onOpen, onOpenUnit, userName }: {
  repo: ScheduleRepository; initial: Schedule; onClose: () => void; onOpen: (s: Schedule) => void;
  /** Quem está logado (modo online): vira o "Elaborada por" sem precisar digitar. */
  userName?: string;
  /** Abre o cadastro da unidade numa aba (e, opcionalmente, rola até um elemento). */
  onOpenUnit?: (team: Team, tab: UnitTab, focusId?: string) => void;
}) {
  const modern = !!(repo.getRoster && initial.unitId && initial.config.team);
  const STEPS: ReadonlyArray<{ id: StepId; label: string }> = modern ? STEPS_MES : STEPS_COMPLETO;
  const [schedule, setSchedule] = useState<Schedule>(initial);
  const [step, setStep] = useState<StepId>(initial.cells ? 'escala' : modern ? 'equipe' : 'funcionamento')
  const [equipeTab, setEquipeTab] = useState<EquipeTab>('pessoas');
  const [saveState, setSaveState] = useState<'salvo' | 'salvando' | 'erro'>('salvo');
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [cell, setCellSel] = useState<{ empId: string; date: string } | null>(null);
  const [employee, setEmployee] = useState<string | null>(null);
  const [day, setDay] = useState<{ dept: DeptId; date: string } | null>(null);
  const [pending, setPending] = useState<{ candidate: Schedule; newAlerts: Alert[] } | null>(null);
  const [swap, setSwap] = useState(false);
  const [individual, setIndividual] = useState(false);
  /** Avisos de atenção ficam recolhidos; conflitos obrigatórios aparecem sempre. */
  const [showAlerts, setShowAlerts] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  /** Existe escala gerada do mês anterior (mesma unidade e coordenação): dá para repetir o padrão dela. */
  const [anteriorGerada, setAnteriorGerada] = useState(false);
  useEffect(() => {
    let vivo = true;
    const pm = previousMonth(initial.year, initial.month);
    repo.findSchedule(pm.year, pm.month, initial.unitId, initial.config.team).then((s) => { if (vivo) setAnteriorGerada(!!s?.cells); }).catch(() => undefined);
    return () => { vivo = false; };
  }, [repo, initial.year, initial.month, initial.unitId, initial.config.team]);
  const [regenDepts, setRegenDepts] = useState<DeptId[]>([]);
  const [confirmPdf, setConfirmPdf] = useState(false);
  const [showEdge, setShowEdge] = useState(false);
  const [history, setHistory] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  /** Planilha para folha de pagamento e ponto (a biblioteca só carrega agora). */
  const exportXlsx = async () => {
    const a = analyze(schedule);
    if (!a) return;
    setExportingXlsx(true);
    try {
      const { buildScheduleXlsx, excelFileName } = await import('../export/exportExcel');
      const blob = await buildScheduleXlsx(schedule, a);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = excelFileName(schedule);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      setError(e instanceof Error ? `Falha ao gerar a planilha: ${e.message}` : 'Falha ao gerar a planilha.');
    } finally {
      setExportingXlsx(false);
    }
  };
  const [view, setView] = useState<CalendarMode>(storedView);
  const [week, setWeek] = useState(() => currentWeekIndex(initial.year, initial.month));
  const changeView = (v: CalendarMode) => {
    setView(v);
    try { window.localStorage.setItem(VIEW_KEY, v); } catch { /* sem armazenamento: só não lembra */ }
  };
  const [following, setFollowing] = useState<{ count: number; running: boolean; done: number; results: MonthResult[] | null } | null>(null);
  const first = useRef(true);

  // Alterações feitas nesta sessão levam o nome de quem as fez (para o aviso aos colegas da unidade).
  const baseLog = useRef(initial.changeLog.length);
  const nomeRef = useRef(userName);
  nomeRef.current = userName;
  const comAutor = (s: Schedule): Schedule => ({ ...s, changeLog: carimbarAutor(s.changeLog, Math.min(baseLog.current, s.changeLog.length), nomeRef.current) });

  // Salvamento automático (e, ao sair da escala com algo pendente, grava na hora)
  const pendente = useRef<Schedule | null>(null);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setSaveState('salvando');
    pendente.current = schedule;
    const t = setTimeout(() => {
      pendente.current = null;
      repo.saveSchedule(comAutor(schedule)).then(() => setSaveState('salvo')).catch((e) => { setSaveState('erro'); setError(e instanceof Error ? e.message : 'Erro ao salvar.'); });
    }, 350);
    return () => clearTimeout(t);
  }, [schedule, repo]);
  useEffect(() => () => {
    if (pendente.current) registrarGravacao(repo.saveSchedule(comAutor(pendente.current)));
  }, [repo]);

  const update = useCallback((mutate: (c: ScheduleConfig) => void) => {
    setSchedule((s) => {
      const c = structuredClone(s.config);
      mutate(c);
      normalizeUnitRules(c);
      return updateConfig(s, c);
    });
  }, []);
  // Quem entra na escala é automático (Recepção e Serviços Gerais sempre; Professores e Estagiários com alguém com nome).
  useEffect(() => {
    setSchedule((s) => {
      const c = structuredClone(s.config);
      return normalizeUnitRules(c) ? updateConfig(s, c) : s;
    });
  }, []);

  const roster = useRosterSync(repo, schedule, update);

  // Com login, escala sem "Elaborada por" recebe o nome de quem a abriu.
  useEffect(() => {
    if (userName && !initial.managerName?.trim()) setSchedule((s) => ({ ...s, managerName: userName, updatedAt: new Date().toISOString() }));
  }, [userName, initial.managerName]);

  const issues = useMemo<ConfigIssue[]>(() => {
    const nome: ConfigIssue[] = schedule.managerName?.trim() || userName ? [] : [{ section: 'identificacao' as const, where: 'Elaborada por', message: 'Informe, no alto da escala, o nome de quem está elaborando.' }];
    // Escala livre: só pede o nome de quem elabora e pelo menos uma pessoa; as regras de cobertura e de turnos não valem.
    if (schedule.config.livre) {
      const semGente = DEPT_IDS.every((id) => !deptEnabled(schedule.config, id) || schedule.config.departments[id].employees.length === 0);
      return [...nome, ...(semGente ? [{ section: 'colaboradores' as const, where: 'Equipe', message: 'Cadastre pelo menos uma pessoa na equipe para montar a escala.' }] : [])];
    }
    return [...nome, ...validateConfig(schedule.config)];
  }, [schedule.config, schedule.managerName]);
  const analysis = useMemo(() => analyze(schedule), [schedule]);
  const risks = useMemo(() => weekendShiftRisks(schedule.config), [schedule.config]);
  const weeklyOver = analysis?.alerts.filter((a) => a.code === 'LIMITE_SEMANAL') ?? [];
  const stale = !!schedule.cells && schedule.generation?.configSignature !== undefined && schedule.generation.configSignature !== configSignature(schedule.config);
  const hasManual = schedule.changeLog.length > 0;

  /** `only`: gera só estes departamentos e mantém a escala (e os ajustes) dos demais. */
  const generate = async (only?: DeptId[]) => {
    setError(null);
    if (issues.length) {
      goToIssue(issues[0]);
      setError(`Há ${issues.length} pendência(s) antes de gerar. Veja a lista abaixo: cada item leva ao campo a corrigir.`);
      return;
    }
    if (schedule.config.livre) {
      // Escala livre: sem a confirmação dos parâmetros de jornada; só monta a grade para editar à mão.
      setSchedule((s) => applyGeneration(s, gerarLivre(s.config), 0, !!s.cells && !!only));
      setStep('escala');
      setConfirmRegen(false);
      return;
    }
    if (!schedule.config.labor.validatedByLegal) {
      setStep('escala');
      setError('Para gerar, confirme que os parâmetros de jornada foram validados pelo sócio-operador da unidade.');
      return;
    }
    setGenerating(true);
    try {
      const pm = previousMonth(schedule.year, schedule.month);
      const prev = await repo.findSchedule(pm.year, pm.month, schedule.unitId, schedule.config.team);
      const seed = schedule.generation ? schedule.generation.seed + 1 : 0;
      const partial = !!only && !!schedule.cells;
      const reference = schedule.repetirAnterior && prev?.cells ? { cells: prev.cells, weeks: buildRange(pm.year, pm.month).weeks.map((w) => w.dates) } : null;
      const r = await generateInBackground(schedule.config, seed, prev?.cells ?? null, { ...(partial ? { only, keep: schedule.cells } : {}), reference });
      setSchedule((s) => applyGeneration(s, r, seed, partial));
      setStep('escala');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao gerar a escala.');
    } finally {
      setGenerating(false);
      setConfirmRegen(false);
    }
  };

  // Configuração mudou depois da geração e não há ajustes manuais: refaz a escala sozinho ao abrir a
  // etapa Escala (uma vez por configuração), para a tela nunca mostrar a escala antiga.
  const autoRegenFor = useRef<string | null>(null);
  const [autoRegenerated, setAutoRegenerated] = useState(false);
  useEffect(() => {
    if (step !== 'escala' || !stale || hasManual || generating || issues.length || schedule.config.livre) return;
    const sig = configSignature(schedule.config);
    if (autoRegenFor.current === sig) return;
    autoRegenFor.current = sig;
    void generate().then(() => setAutoRegenerated(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, stale, hasManual, generating, issues.length]);

  const enabledDepts = DEPT_IDS.filter((id) => deptEnabled(schedule.config, id));
  // Departamentos incluídos depois da geração (ou com gente nova): ainda sem escala.
  const missingDepts = schedule.cells
    ? enabledDepts.filter((id) => schedule.config.departments[id].employees.some((e) => e.active && !schedule.cells![e.id]))
    : [];
  const openRegen = (preset?: DeptId[]) => {
    setRegenDepts(preset ?? enabledDepts);
    setConfirmRegen(true);
  };

  /** Aplica uma alteração feita à mão; se ela criar alertas, pede confirmação antes de manter. */
  const propose = (make: () => Schedule) => {
    try {
      const candidate = make();
      const before = new Set(analysis?.alerts.map((a) => a.id));
      const after = analyze(candidate)!;
      const newAlerts = after.alerts.filter((a) => a.severity !== 'info' && !before.has(a.id));
      if (newAlerts.length) setPending({ candidate, newAlerts });
      else setSchedule(candidate);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível alterar.');
    }
  };
  const applyCell = (patch: CellPatch) => {
    if (!cell) return;
    const { empId, date } = cell;
    setCellSel(null);
    propose(() => setCell(schedule, empId, date, patch));
  };
  const applySwap = (emp1: string, dia1: string, emp2: string, dia2: string) => {
    setSwap(false);
    propose(() => swapOffDays(schedule, emp1, dia1, emp2, dia2));
  };

  const confirm = () => {
    try {
      setSchedule(confirmSchedule(schedule));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível confirmar.');
    }
  };

  const runFollowing = async () => {
    if (!following) return;
    setFollowing({ ...following, running: true, done: 0, results: null });
    try {
      await repo.saveSchedule(schedule);
      const results = await generateFollowingMonths(schedule, following.count, {
        find: (y, m) => repo.findSchedule(y, m, schedule.unitId, schedule.config.team),
        save: (s) => repo.saveSchedule(s),
        generate: generateInBackground,
        onProgress: (done) => setFollowing((f) => (f ? { ...f, done } : f)),
      });
      setFollowing((f) => (f ? { ...f, running: false, results } : f));
    } catch (e) {
      setFollowing(null);
      setError(e instanceof Error ? e.message : 'Falha ao gerar os meses seguintes.');
    }
  };

  const ov = schedule.config.overrides ?? {};
  /** Onde se corrige cada pendência: no cabeçalho, numa aba da escala ou no cadastro da unidade. */
  const targetOf = (i: ConfigIssue): IssueTarget => {
    if (i.section === 'identificacao') return { header: true };
    if (!modern) return { step: i.section };
    if (i.section === 'funcionamento') {
      const horario = i.where === 'Horário de funcionamento' || /horário de feriado/i.test(i.message);
      return horario && !ov.hours ? { equipe: 'funcionamento' } : { step: 'mes' };
    }
    if (i.section === 'jornada') return { unit: 'jornada' };
    if (i.section === 'colaboradores') return /férias/i.test(i.message) ? { step: 'ausencias' } : { equipe: 'pessoas' };
    if (!i.dept) return { equipe: 'pessoas' };
    return ov.deptRules ? { step: 'mes' } : { equipe: 'regras' };
  };
  const issuesFor = (step: StepId) => issues.filter((i) => { const t = targetOf(i); return ('step' in t && t.step === step) || ('equipe' in t && step === 'equipe'); });
  const issueLabel = (i: ConfigIssue) => {
    const t = targetOf(i);
    if ('header' in t) return 'Preencher';
    if ('unit' in t) return 'Ver regras de jornada';
    if ('equipe' in t) return `Corrigir em Equipe (${t.equipe === 'pessoas' ? 'Pessoas' : t.equipe === 'regras' ? 'Regras' : 'Funcionamento'})`;
    return `Corrigir em ${STEPS.find((x) => x.id === t.step)?.label ?? t.step}`;
  };
  // Leva ao campo com pendência: abre a etapa e rola até o colaborador ou o departamento.
  const goToIssue = (i: ConfigIssue) => {
    const t = targetOf(i);
    if ('unit' in t) {
      if (onOpenUnit && schedule.config.team) onOpenUnit(schedule.config.team, t.unit, i.employeeId ? `emp-${i.employeeId}` : i.dept ? (t.unit === 'pessoas' ? `team-${i.dept}` : `dept-${i.dept}`) : undefined);
      return;
    }
    if ('equipe' in t) {
      setStep('equipe');
      setEquipeTab(t.equipe);
      const alvo = i.employeeId ? `emp-${i.employeeId}` : i.dept ? (t.equipe === 'pessoas' ? `team-${i.dept}` : `dept-${i.dept}`) : t.equipe === 'funcionamento' ? 'horario-funcionamento' : null;
      window.setTimeout(() => {
        const el = alvo ? document.getElementById(alvo) : null;
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.add('flash');
        window.setTimeout(() => el.classList.remove('flash'), 1600);
      }, 80);
      return;
    }
    if ('header' in t) {
      const el = document.getElementById('manager-field');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (el as HTMLInputElement | null)?.focus();
      el?.classList.add('flash');
      window.setTimeout(() => el?.classList.remove('flash'), 1600);
      return;
    }
    setStep(t.step);
    const target = i.employeeId ? `emp-${i.employeeId}` : i.dept ? (t.step === 'colaboradores' || t.step === 'ausencias' ? `team-${i.dept}` : `dept-${i.dept}`) : null;
    window.setTimeout(() => {
      const el = target ? document.getElementById(target) : null;
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('flash');
      window.setTimeout(() => el.classList.remove('flash'), 1600);
    }, 60);
  };
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <section className="editor">
      <div className="page-head">
        <div>
          <button type="button" className="link back-link" onClick={onClose}>Escalas salvas</button>
          <h1>Escala de {monthLabel(schedule.year, schedule.month)}{schedule.config.team && <span className="team-title"> · {teamName(schedule.config.team)}</span>}</h1>
          <p className="muted">{UNIDADES.find((u) => u.id === schedule.unitId)?.nome && <strong className="unit-name">{UNIDADES.find((u) => u.id === schedule.unitId)!.nome} · </strong>}<span className={`status-chip ${schedule.status}`}>{schedule.status === 'confirmada' ? 'Versão final confirmada' : schedule.cells ? 'Rascunho' : 'Em configuração'}</span> · <span className={`save ${saveState}`}>{saveState === 'salvo' ? 'Salvo' : saveState === 'salvando' ? 'Salvando…' : 'Erro ao salvar'}</span></p>
          {userName ? (
            <p className="manager-inline">Elaborada por <strong>{schedule.managerName?.trim() || userName}</strong></p>
          ) : (
            <label className={`manager-inline ${schedule.managerName?.trim() ? '' : 'missing'}`}>
              <span>Elaborada por</span>
              <input id="manager-field" className="input small" value={schedule.managerName ?? ''} placeholder="Nome de quem elabora a escala"
                aria-label="Escala elaborada por" onChange={(e) => { const managerName = e.target.value; setSchedule((s) => ({ ...s, managerName, updatedAt: new Date().toISOString() })); }} />
            </label>
          )}
        </div>
        {repo.listVersions && (
          <div className="page-head-actions">
            <button type="button" className="btn ghost small" onClick={() => setHistory(true)}>Histórico</button>
          </div>
        )}
      </div>

      <nav className="stepper" aria-label="Etapas">
        {STEPS.map((s, i) => {
          const n = s.id === 'escala' ? 0 : issuesFor(s.id).length;
          return (
            <button type="button" key={s.id} className={`step ${s.id === step ? 'on' : ''} ${i < stepIndex ? 'done' : ''}`} onClick={() => setStep(s.id)} aria-current={s.id === step ? 'step' : undefined}>
              <span className="num">{i + 1}</span>{s.label}{n > 0 && <span className="issue-dot" title={`${n} pendência(s)`}>{n}</span>}
            </button>
          );
        })}
      </nav>

      <RosterBanner state={roster.state} onBring={roster.trazerDoCadastro} onSend={roster.levarParaCadastro} step={step} />

      {error && <div className="banner danger" role="alert">{error}<button type="button" className="icon-btn" aria-label="Fechar aviso" onClick={() => setError(null)}>×</button></div>}

      {step !== 'escala' && issuesFor(step).length > 0 && (
        <div className="banner warn">
          <strong>Corrija antes de gerar ({issuesFor(step).length}):</strong>
          <IssueList issues={issuesFor(step)} onGo={goToIssue} limit={6} labelFor={issueLabel} />
        </div>
      )}

      {step === 'equipe' && <StepEquipe config={schedule.config} update={update} risks={risks} sub={equipeTab} onSub={setEquipeTab}
        linked={roster.state.kind === 'sync' || roster.state.kind === 'diff' || roster.state.kind === 'loading'}
        onOpenUnit={onOpenUnit && schedule.config.team ? (tab) => onOpenUnit(schedule.config.team!, tab) : undefined} />}
      {step === 'mes' && <StepMes config={schedule.config} update={update} risks={risks} weeklyOver={schedule.cells ? weeklyOver : []}
        onBackToUnit={roster.voltarAoCadastro} linked={roster.state.kind === 'sync' || roster.state.kind === 'diff' || roster.state.kind === 'loading'}
        onOpenUnit={(tab) => { setStep('equipe'); setEquipeTab(tab === 'regras' ? 'regras' : tab === 'funcionamento' ? 'funcionamento' : 'pessoas'); }} />}
      {step === 'ausencias' && <StepAusencias config={schedule.config} update={update}
        onOpenUnit={() => { setStep('equipe'); setEquipeTab('pessoas'); }} />}
      {step === 'funcionamento' && <StepFuncionamento config={schedule.config} update={update} />}
      {step === 'departamentos' && <StepDepartamentos config={schedule.config} update={update} risks={risks} weeklyOver={schedule.cells ? weeklyOver : []} />}
      {step === 'colaboradores' && <StepColaboradores config={schedule.config} update={update} />}
      {step === 'jornada' && <StepJornada config={schedule.config} update={update} />}

      {step !== 'escala' && (
        <div className="step-nav">
          {stepIndex > 0 && <button type="button" className="btn ghost" onClick={() => setStep(STEPS[stepIndex - 1].id)}>Voltar</button>}
          {stepIndex < STEPS.length - 2 && <button type="button" className="btn primary" onClick={() => setStep(STEPS[stepIndex + 1].id)}>Continuar</button>}
          {stepIndex === STEPS.length - 2 && <button type="button" className="btn primary" disabled={generating} onClick={() => (schedule.cells ? setStep('escala') : generate())}>{schedule.cells ? 'Ver escala' : generating ? 'Gerando…' : 'Gerar escala'}</button>}
        </div>
      )}

      {step === 'escala' && (
        <>
          {!schedule.cells && schedule.config.livre && (
            <div className="card center">
              <h2>Montar escala livre</h2>
              <p className="muted">Você monta tudo à mão. O sistema só cria a grade, com todos de segunda a sexta no horário cadastrado de cada pessoa, e daí você troca qualquer dia e qualquer horário. Não há regra de folga, de cobertura, de turno nem de descanso.</p>
              <p className="muted">A única trava: ninguém pode passar de {LIVRE_LIMITE_SEMANAL_HORAS} horas na semana (estagiários, 30 horas, pela Lei do Estágio).</p>
              {issues.length > 0 && (
                <div className="banner warn left">
                  <strong>{issues.length} pendência(s) antes de montar:</strong>
                  <IssueList issues={issues} onGo={goToIssue} labelFor={issueLabel} />
                </div>
              )}
              <button type="button" className="btn primary big" disabled={generating || issues.length > 0} onClick={() => void generate()}>Montar escala livre</button>
            </div>
          )}
          {!schedule.cells && !schedule.config.livre && (
            <div className="card center">
              <h2>Gerar escala automaticamente</h2>
              <p className="muted">O sistema distribui folgas e turnos com base nos cadastros e regras, valida jornadas e coberturas e mostra os conflitos antes de você confirmar.</p>
              {issues.length > 0 && (
                <div className="banner warn left">
                  <strong>{issues.length} pendência(s) antes de gerar:</strong>
                  <IssueList issues={issues} onGo={goToIssue} labelFor={issueLabel} />
                </div>
              )}
              <ValidatedByLegal config={schedule.config} update={update} />
              {anteriorGerada && <RepetirAnterior schedule={schedule} onChange={(v) => setSchedule((s) => ({ ...s, repetirAnterior: v, updatedAt: new Date().toISOString() }))} />}
              <button type="button" className="btn primary big" disabled={generating || issues.length > 0 || !schedule.config.labor.validatedByLegal} onClick={() => generate()}>{generating ? 'Gerando escala…' : 'Gerar escala'}</button>
            </div>
          )}

          {schedule.cells && analysis && (
            <>
              {schedule.config.livre && <div className="banner info left" role="note"><strong>Escala livre.</strong> Sem regras de folga, cobertura, turnos ou descanso: você decide tudo. A única trava é o limite de horas por semana: {LIVRE_LIMITE_SEMANAL_HORAS} para cada pessoa e 30 para estagiários (Lei do Estágio).</div>}
              <div className="toolbar card">
                <div className="validity">
                  {analysis.valid ? (
                    <span className="valid ok">✓ Sem conflitos obrigatórios</span>
                  ) : (
                    <span className="valid bad">✕ Escala NÃO válida: {analysis.counts.critico} conflito(s) obrigatório(s)</span>
                  )}
                  <button type="button" className="link avisos-link" aria-expanded={showAlerts} onClick={() => setShowAlerts((v) => !v)}>
                    {showAlerts ? 'Ocultar avisos' : `Ver avisos (${analysis.counts.atencao + analysis.counts.info})`}
                  </button>
                </div>
                <div className="toolbar-actions">
                  <MenuButton label={generating ? 'Gerando…' : exportingXlsx ? 'Montando planilha…' : 'Mais ações'} items={[
                    { label: 'Trocar folga', onClick: () => setSwap(true) },
                    { label: 'Regerar escala', onClick: () => openRegen(), disabled: generating },
                    { label: 'Gerar meses seguintes', onClick: () => setFollowing({ count: 2, running: false, done: 0, results: null }), disabled: generating || stale, title: stale ? 'Regere este mês com os parâmetros atuais antes' : '' },
                    { label: 'PDF individual', onClick: () => setIndividual(true) },
                    { label: 'Exportar Excel', onClick: () => void exportXlsx(), disabled: exportingXlsx },
                  ]} />
                  <button type="button" className="btn dark" disabled={!analysis.valid || schedule.status === 'confirmada' || stale} onClick={confirm}
                    title={!analysis.valid ? 'Corrija os conflitos obrigatórios antes de confirmar' : stale ? 'Regere a escala com os parâmetros atuais' : ''}>
                    {schedule.status === 'confirmada' ? 'Versão final confirmada' : 'Confirmar versão final'}
                  </button>
                  <button type="button" className="btn primary" onClick={() => setConfirmPdf(true)}>Exportar escala em PDF</button>
                </div>
              </div>

              {risks.length > 0 && (
                <div className="banner warn">
                  <strong>Atenção: turno de fim de semana pode ultrapassar a carga horária.</strong>
                  <ul>{risks.slice(0, 6).map((r, i) => <li key={i}>{r.message}</li>)}</ul>
                  O gerador evita essas combinações; se não houver alternativa, a semana aparece como conflito crítico.
                </div>
              )}
              {autoRegenerated && !stale && (
                <div className="banner info" role="status">A escala foi refeita com a configuração atual.<button type="button" className="icon-btn" aria-label="Fechar aviso" onClick={() => setAutoRegenerated(false)}>×</button></div>
              )}
              {stale && (
                <div className="banner warn">
                  <strong>A configuração mudou depois que esta escala foi gerada</strong> (ex.: quantidade no sábado, horários, férias). O calendário abaixo ainda é o anterior.
                  {hasManual ? <> Como há {schedule.changeLog.length} ajuste(s) manual(is), a escala não foi refeita sozinha.</> : null}
                  {missingDepts.length > 0 && <> <strong>{missingDepts.map(deptName).join(' e ')} ainda não {missingDepts.length > 1 ? 'têm' : 'tem'} escala</strong> (aparece tudo como folga).</>}
                  <div className="row wrap" style={{ marginTop: '0.5rem' }}>
                    {missingDepts.length > 0 && (
                      <button type="button" className="btn primary" disabled={generating} onClick={() => generate(missingDepts)}>
                        {generating ? 'Gerando…' : `Gerar só ${missingDepts.map(deptName).join(' e ')} (mantém os demais)`}
                      </button>
                    )}
                    <button type="button" className={`btn ${missingDepts.length ? 'ghost' : 'primary'}`} disabled={generating} onClick={() => (hasManual ? openRegen() : generate())}>
                      {generating ? 'Refazendo…' : hasManual ? 'Escolher o que refazer…' : 'Refazer a escala agora'}
                    </button>
                  </div>
                </div>
              )}
              {!analysis.valid && schedule.generation && !schedule.generation.feasible && !hasManual && (
                <div className="banner danger">
                  <strong>Não foi encontrada uma escala válida com a equipe e as regras configuradas.</strong> A melhor tentativa está abaixo, com os conflitos marcados. Opções para resolver:
                  <ul>
                    {schedule.generation.conflicts.map((c, i) => (
                      <li key={i}>{c.description}<ul>{c.suggestions.map((s, k) => <li key={k}>{s}</li>)}</ul></li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="view-bar">
                <Segmented ariaLabel="Visualização" value={view} onChange={changeView} options={[{ value: 'mes', label: 'Mês' }, { value: 'semana', label: 'Semana' }]} />
                {view === 'semana' && (
                  <div className="week-nav">
                    <button type="button" className="btn ghost small" aria-label="Semana anterior" disabled={week === 0} onClick={() => setWeek((w) => w - 1)}>‹</button>
                    <select className="input" aria-label="Semana" value={week} onChange={(e) => setWeek(Number(e.target.value))}>
                      {analysis.range.weeks.map((w, i) => (
                        <option key={w.start} value={i}>Semana {i + 1} · {formatDayMonth(w.start)} a {formatDayMonth(w.end)}</option>
                      ))}
                    </select>
                    <button type="button" className="btn ghost small" aria-label="Próxima semana" disabled={week >= analysis.range.weeks.length - 1} onClick={() => setWeek((w) => w + 1)}>›</button>
                  </div>
                )}
                {view === 'mes' && <Toggle checked={showEdge} onChange={setShowEdge} label="Mostrar dias de outros meses" />}
              </div>
              <div className="legend-row">
                <Legend />
                <span className="muted small">Clique num dia para alterar; no nome, para ver as horas.</span>
              </div>

              <div className={`calendar-layout ${showAlerts || !analysis.valid ? '' : 'sem-avisos'}`}>
                <div className="stack">
                  {DEPT_IDS.filter((id) => deptEnabled(schedule.config, id)).map((id) => (
                    <CalendarView key={id} analysis={analysis} config={schedule.config} deptId={id} showEdgeDays={showEdge} week={view === 'semana' ? Math.min(week, analysis.range.weeks.length - 1) : null}
                      onCell={(empId, date) => setCellSel({ empId, date })} onEmployee={setEmployee} onDay={(date) => setDay({ dept: id, date })} />
                  ))}
                </div>
                {(showAlerts || !analysis.valid) && <AlertsPanel alerts={analysis.alerts} onSelect={(a) => a.employeeId && a.date && setCellSel({ empId: a.employeeId, date: a.date })} />}
              </div>
            </>
          )}
        </>
      )}

      {history && <HistoryDialog repo={repo} schedule={schedule} onClose={() => setHistory(false)} onRestored={(s) => { setHistory(false); onOpen(s); }} />}
      {cell && analysis && <CellDialog schedule={schedule} analysis={analysis} empId={cell.empId} date={cell.date} onApply={applyCell} onClose={() => setCellSel(null)} />}
      {individual && analysis && <PdfIndividualDialog schedule={schedule} analysis={analysis} onClose={() => setIndividual(false)} />}
      {swap && analysis && <SwapDialog analysis={analysis} onApply={applySwap} onClose={() => setSwap(false)} />}
      {pending && <ChangeReviewDialog newAlerts={pending.newAlerts} onUndo={() => setPending(null)} onKeep={() => { setSchedule(pending.candidate); setPending(null); }} />}
      {employee && analysis && <EmployeeDialog analysis={analysis} schedule={schedule} empId={employee} onClose={() => setEmployee(null)} />}
      {day && (
        <ExceptionDialog schedule={schedule} deptId={day.dept} date={day.date} onClose={() => setDay(null)}
          onAdd={(kind, value, reason) => { setSchedule((s) => addException(s, { date: day.date, dept: day.dept, kind, value, reason })); setDay(null); }}
          onRemove={(id) => setSchedule((s) => removeException(s, id))} />
      )}
      {following && (
        <Modal title="Gerar meses seguintes" onClose={() => !following.running && setFollowing(null)} footer={following.results ? (
          <button type="button" className="btn primary" onClick={() => setFollowing(null)}>Concluir</button>
        ) : <>
          <button type="button" className="btn ghost" disabled={following.running} onClick={() => setFollowing(null)}>Cancelar</button>
          <button type="button" className="btn primary" disabled={following.running} onClick={runFollowing}>{following.running ? `Gerando ${following.done + 1} de ${following.count}…` : 'Gerar'}</button>
        </>}>
          {!following.results ? (
            <>
              <p>Gera os próximos meses com a mesma equipe e os mesmos parâmetros desta escala. Cada mês recebe os feriados nacionais do período e continua a semana que vira o mês. Meses que já têm escala gerada são mantidos como estão.</p>
              <Field label="Quantidade de meses">
                <select className="input" value={following.count} disabled={following.running} onChange={(e) => setFollowing({ ...following, count: Number(e.target.value) })}>
                  {Array.from({ length: MAX_FOLLOWING_MONTHS }, (_, i) => i + 1).map((n) => {
                    let { year: y, month: m } = schedule;
                    for (let k = 0; k < n; k++) ({ year: y, month: m } = m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 });
                    return <option key={n} value={n}>{n} {n === 1 ? 'mês' : 'meses'} (até {monthLabel(y, m)})</option>;
                  })}
                </select>
              </Field>
              <p className="field-hint">Revise cada mês depois: feriados estaduais/municipais, férias e indisponibilidades específicas precisam ser incluídos mês a mês.</p>
            </>
          ) : (
            <ul className="schedule-list">
              {following.results.map((r) => (
                <li key={`${r.year}-${r.month}`}>
                  <button type="button" className="schedule-item" onClick={() => { setFollowing(null); onOpen(r.schedule); }}>
                    <strong>{monthLabel(r.year, r.month)}</strong>
                    <span className={`status-chip ${r.valid ? 'confirmada' : ''}`}>{r.valid ? 'Sem conflitos' : `${r.critical} conflito(s)`}</span>
                    <span className="muted small">{r.outcome === 'gerada' ? 'Gerada agora — clique para revisar' : 'Já existia — mantida'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
      {confirmRegen && (
        <Modal title="Regerar escala" onClose={() => setConfirmRegen(false)} footer={<>
          <button type="button" className="btn ghost" onClick={() => setConfirmRegen(false)}>Cancelar</button>
          <button type="button" className="btn primary" disabled={generating || !regenDepts.length}
            onClick={() => generate(regenDepts.length === enabledDepts.length ? undefined : regenDepts)}>
            {regenDepts.length === enabledDepts.length ? 'Regerar tudo' : `Regerar ${regenDepts.length} departamento(s)`}
          </button>
        </>}>
          <p>Escolha os departamentos que terão uma nova escala. Os outros ficam exatamente como estão, com os ajustes manuais.</p>
          {anteriorGerada && <RepetirAnterior schedule={schedule} onChange={(v) => setSchedule((s) => ({ ...s, repetirAnterior: v, updatedAt: new Date().toISOString() }))} />}
          <div className="stack-sm">
            {enabledDepts.map((id) => (
              <Toggle key={id} checked={regenDepts.includes(id)} label={deptName(id)}
                hint={missingDepts.includes(id) ? 'Ainda sem escala.' : undefined}
                onChange={(v) => setRegenDepts((cur) => (v ? DEPT_IDS.filter((x) => x === id || cur.includes(x)) : cur.filter((x) => x !== id)))} />
            ))}
          </div>
          {hasManual && regenDepts.length > 0 && <p className="field-hint">Ajustes manuais feitos nos departamentos marcados serão descartados.</p>}
        </Modal>
      )}
      {confirmPdf && analysis && (
        <PdfExportDialog
          title="Exportar escala em PDF"
          initialManager={schedule.managerName}
          fileName={pdfFileName(schedule)}
          build={async (o) => (await import('../pdf/exportPdf')).buildSchedulePdf(schedule, analysis, { ...o, compress: true })}
          depts={DEPT_IDS.filter((id) => deptEnabled(schedule.config, id))}
          onManager={(managerName) => managerName !== schedule.managerName && setSchedule((s) => ({ ...s, managerName }))}
          onClose={() => setConfirmPdf(false)}
          notice={<>
            {!analysis.valid && <p className="form-error">Atenção: a escala ainda tem {analysis.counts.critico} conflito(s) obrigatório(s) sem correção.</p>}
            {analysis.valid && schedule.status !== 'confirmada' && <p className="muted">A escala ainda não foi confirmada como versão final.</p>}
          </>}
        />
      )}
    </section>
  );
}

/** Confirmação obrigatória antes de gerar: os parâmetros de jornada foram validados pelo sócio-operador. */
/** Gerar repetindo as folgas e os fins de semana do mês anterior (as regras obrigatórias continuam valendo). */
function RepetirAnterior({ schedule, onChange }: { schedule: Schedule; onChange: (v: boolean) => void }) {
  const pm = previousMonth(schedule.year, schedule.month);
  return (
    <Toggle checked={!!schedule.repetirAnterior} onChange={onChange} label={`Repetir as folgas de ${monthLabel(pm.year, pm.month).toLowerCase()}`}
      hint="Mantém o padrão de cada pessoa (folgas e fins de semana) e ajusta só o que as regras, os feriados e as férias exigirem." />
  );
}

function ValidatedByLegal({ config, update }: { config: ScheduleConfig; update: (fn: (c: ScheduleConfig) => void) => void }) {
  return (
    <label className={`legal-check ${config.labor.validatedByLegal ? 'ok' : ''}`}>
      <input type="checkbox" checked={config.labor.validatedByLegal} onChange={(e) => { const v = e.target.checked; update((c) => { c.labor.validatedByLegal = v; }); }} />
      <span>Os parâmetros de jornada desta escala foram validados pelo sócio-operador da unidade.</span>
    </label>
  );
}
