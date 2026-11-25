import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { monthLabel, MONTH_NAMES, previousMonth } from '../domain/calendar';
import { analyze, createSchedule } from '../domain/scheduleOps';
import { applyRoster, normalizeUnitRules, rosterFromConfig } from '../domain/roster';
import { aplicarModelo, MODELOS, modeloPorId, type Modelo } from '../domain/modelos';
import { combinedFileName, type PdfItem } from '../pdf/names';
import { lastManager, PdfExportDialog } from './PdfDialogs';
import { DEPT_IDS, deptEnabled, TEAMS, teamName, type Schedule, type Team } from '../domain/types';
import type { ScheduleRepository, ScheduleSummary } from '../storage/repository';
import { Field, Modal, Toggle } from './components/form';
import { ModelosPage } from './ModelosPage';
import { gravacoesPendentes } from './useRosterSync';
import { UNIDADES } from '../config/unidades';
import { porQuem } from './usuarioAtual';

export function Home({ repo, unitId, onOpen, managerName, onRoster }: { repo: ScheduleRepository; unitId?: string; onOpen: (s: Schedule) => void; /** Quem está logado: vira o "Elaborada por" das escalas novas. */ managerName?: string; /** Abre o cadastro da equipe da unidade (modo online). */ onRoster?: (team: Team) => void }) {
  const [list, setList] = useState<ScheduleSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = new Date();
  const next = today.getMonth() === 11 ? { y: today.getFullYear() + 1, m: 1 } : { y: today.getFullYear(), m: today.getMonth() + 2 };
  const [year, setYear] = useState(next.y);
  const [month, setMonth] = useState(next.m);
  const [team, setTeam] = useState<Team | ''>('');
  const [nova, setNova] = useState(false);
  const [modeloId, setModeloId] = useState('');
  const [repetir, setRepetir] = useState(true);
  /** Escala gerada do mês anterior da mesma coordenação: dá para repetir o padrão dela. */
  const anterior = (() => {
    if (!team || !list) return null;
    const pm = previousMonth(year, month);
    return list.find((s) => s.year === pm.year && s.month === pm.month && (s.team ?? 'administrativa') === team && s.generated) ?? null;
  })();
  const livre = modeloId === 'livre';
  const modelo = modeloId && !livre ? modeloPorId(modeloId) : null;
  const usarModelo = (m: Modelo) => { setError(null); setTeam(m.team); setModeloId(m.id); setNova(true); };
  const usarLivre = () => { setError(null); setModeloId('livre'); setNova(true); };
  const [toDelete, setToDelete] = useState<ScheduleSummary | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [pdfItems, setPdfItems] = useState<PdfItem[] | null>(null);

  const exportSelected = async () => {
    setError(null);
    setExporting(true);
    try {
      const schedules = (await Promise.all(selected.map((id) => repo.getSchedule(id)))).filter((s): s is Schedule => !!s && !!s.cells);
      schedules.sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month));
      setPdfItems(schedules.map((schedule) => ({ schedule, analysis: analyze(schedule)! })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao preparar o PDF.');
    } finally {
      setExporting(false);
    }
  };

  const reload = useCallback(async () => {
    try {
      await gravacoesPendentes();
      setList(await repo.listSchedules(unitId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar escalas.');
    }
  }, [repo, unitId]);

  useEffect(() => { void reload(); }, [reload]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!team) return setError('Escolha a coordenação.');
    try {
      const existing = await repo.findSchedule(year, month, unitId, team);
      if (existing && (modelo || livre)) return setError(`Já existe a escala de ${monthLabel(year, month)} desta coordenação. Para usar ${livre ? 'a escala livre' : 'o modelo'}, escolha outro mês ou exclua a escala existente.`);
      if (existing) {
        onOpen(existing);
        return;
      }
      // Reaproveita equipe e parâmetros da escala mais recente da mesma equipe; senão, de qualquer escala da unidade.
      const template = (await repo.latestSchedule({ year, month }, unitId, team)) ?? (await repo.latestSchedule(undefined, unitId, team))
        ?? (await repo.latestSchedule(undefined, unitId));
      const s = { ...createSchedule(year, month, template?.config, unitId, team), managerName: managerName ?? template?.managerName ?? lastManager() };
      // Equipe vem do cadastro da unidade, quando existe.
      const cadastro = unitId && repo.getRoster ? await repo.getRoster(unitId, team) : null;
      if (cadastro) s.config = applyRoster(s.config, cadastro.roster);
      if (livre) s.config.livre = true; // escala livre: pessoas e horários do cadastro da unidade, sem regras (só o limite de 42h por semana)
      if (modelo) {
        // O modelo vira o cadastro da coordenação: pessoas (nomes fictícios) e regras dos departamentos.
        s.config = aplicarModelo(s.config, modelo);
        normalizeUnitRules(s.config);
        if (unitId && repo.saveRoster) await repo.saveRoster(unitId, team, rosterFromConfig(s.config));
      }
      if (anterior && repetir && !modelo && !livre) s.repetirAnterior = true;
      await repo.saveSchedule(s);
      onOpen(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar a escala.');
    }
  };

  const open = async (id: string) => {
    const s = await repo.getSchedule(id);
    if (s) onOpen(s);
  };

  const years = [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1, today.getFullYear() + 2];

  return (
    <section className="unit-home">
      <div className="home-head" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn primary big" onClick={() => { setError(null); setNova(true); }}>Criar escala</button>
      </div>
      {error && !nova && <div className="banner danger left" role="alert">{error}</div>}
      <div className="home-list">
        <div className="card">
          <h2>{managerName ? 'Escalas salvas' : 'Escalas salvas neste navegador'}</h2>
          {list === null && <p className="muted">Carregando…</p>}
          {list?.length === 0 && <p className="muted">Nenhuma escala salva ainda.</p>}
          {!!list?.length && (
            <>
            <p className="muted small">Marque vários meses para baixar um único PDF.</p>
            {TEAMS.map((t) => {
              const items = list.filter((s) => (s.team ?? 'administrativa') === t.id);
              return (
                <div key={t.id} className="team-group" aria-label={`Escalas – ${t.name}`} role="group">
                  <h3>{t.name} <span className="muted small">({t.id === 'administrativa' ? 'Recepção e Serviços Gerais' : 'Professores e Estagiários'})</span></h3>
                  {items.length === 0 ? <p className="muted small">Nenhuma escala desta equipe ainda.</p> : (
                    <ul className="schedule-list">
                      {items.map((s) => (
                      <li key={s.id}>
                        <input type="checkbox" aria-label={`Selecionar ${monthLabel(s.year, s.month)}`} disabled={!s.generated}
                          checked={selected.includes(s.id)} onChange={(e) => setSelected((x) => (e.target.checked ? [...x, s.id] : x.filter((y) => y !== s.id)))} />
                        <button type="button" className="schedule-item" onClick={() => open(s.id)}>
                          <strong>{monthLabel(s.year, s.month)}</strong>
                          {!s.team && <span className="tag">Todas as equipes</span>}
                          <span className={`status-chip ${s.status}`}>{s.status === 'confirmada' ? 'Confirmada' : s.generated ? 'Rascunho' : 'Em configuração'}</span>
                          <span className="muted small">{s.managerName ? <>Elaborada por <strong>{s.managerName}</strong> · </> : null}Atualizada em {new Date(s.updatedAt).toLocaleString('pt-BR')}{porQuem(s.updatedBy)}</span>
                        </button>
                        <button type="button" className="btn ghost small" aria-label={`Excluir escala de ${monthLabel(s.year, s.month)}`} onClick={() => setToDelete(s)}>Excluir</button>
                      </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
            <button type="button" className="btn primary small pdf-selected" disabled={!selected.length || exporting} onClick={exportSelected}>
              {exporting ? 'Preparando…' : `Gerar PDF (${selected.length})`}
            </button>
            </>
          )}
        </div>
      </div>
      <section className="home-modelos" aria-label="Modelos de escala">
        <h2>Modelos de escala</h2>
        <ModelosPage embutido repo={repo} unitId={unitId ?? null} onUsar={usarModelo} onUsarLivre={usarLivre} />
      </section>

      {pdfItems && (
        <PdfExportDialog
          title={`PDF de ${pdfItems.length} ${pdfItems.length === 1 ? 'mês' : 'meses'}`}
          initialManager={pdfItems[0].schedule.managerName}
          fileName={combinedFileName(pdfItems)}
          build={async (o) => (await import('../pdf/exportPdf')).buildCombinedPdf(pdfItems, { ...o, compress: true })}
          depts={DEPT_IDS.filter((id) => pdfItems.some((i) => deptEnabled(i.schedule.config, id)))}
          onClose={() => setPdfItems(null)}
        />
      )}
      {nova && (
        <Modal title="Nova escala" onClose={() => setNova(false)} footer={<>
          <button type="button" className="btn ghost" onClick={() => setNova(false)}>Cancelar</button>
          <button type="submit" form="nova-escala" className="btn primary" disabled={!team} aria-label={`Criar escala de ${monthLabel(year, month)}${team ? ` — ${teamName(team)}` : ''}`}>Criar escala</button>
        </>}>
          <form id="nova-escala" className="nova-escala" onSubmit={create}>
            <p className="muted">{onRoster
              ? 'Pessoas, horário e regras vêm do cadastro da unidade; na escala você só informa o que é do mês. Os feriados entram sozinhos.'
              : 'Se já houver uma escala salva desta unidade, a equipe e os horários são reaproveitados. Os feriados nacionais entram sozinhos.'}</p>
            <Field label="Coordenação" hint={team ? `${team === 'administrativa' ? 'Recepção e Serviços Gerais' : 'Professores e Estagiários'}.` : undefined}>
              <select className="input" aria-label="Coordenação" value={team} autoFocus onChange={(e) => { setTeam(e.target.value as Team); if (modelo && modelo.team !== e.target.value) setModeloId(''); }}>
                <option value="" disabled>Escolha a coordenação…</option>
                {TEAMS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            {team && (
              <Field label="Começar com">
                <select className="input" aria-label="Começar com" value={modeloId} onChange={(e) => setModeloId(e.target.value)}>
                  <option value="">Pessoas e regras do cadastro da unidade</option>
                  <option value="livre">Escala livre (sem regras, só o limite de horas por semana)</option>
                  {MODELOS.filter((m) => m.team === team).map((m) => <option key={m.id} value={m.id}>Modelo: {m.nome}</option>)}
                </select>
              </Field>
            )}
            {anterior && !modelo && !livre && (
              <Toggle checked={repetir} onChange={setRepetir} label={`Repetir as folgas de ${monthLabel(previousMonth(year, month).year, previousMonth(year, month).month).toLowerCase()}`}
                hint="O sistema parte do padrão do mês anterior (folgas e fins de semana de cada pessoa) e ajusta só o que as regras, os feriados e as férias exigirem." />
            )}
            {livre && (
              <div className="banner info left modelo-aviso">
                <strong>Escala livre.</strong> Você monta tudo à mão: sem regras de folga, de cobertura, de turnos nem de descanso. As pessoas e os horários vêm do cadastro da unidade, e a escala começa com todos de segunda a sexta. A única trava é o limite de horas por semana: 42 para cada pessoa e 30 para estagiários (Lei do Estágio).
              </div>
            )}
            {modelo && (
              <div className="banner warn left modelo-aviso">
                <strong>{modelo.nome}.</strong> {modelo.descricao} As pessoas e as regras da {teamName(modelo.team)} no cadastro da unidade passam a ser as do modelo, com nomes fictícios (ex.: {modelo.team === 'administrativa' ? 'Recepcionista 1' : 'Professor 1'}). Depois troque pelos nomes reais em Equipe.
              </div>
            )}
            <div className="row">
              <Field label="Mês">
                <select className="input" aria-label="Mês" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                  {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </Field>
              <Field label="Ano">
                <select className="input" aria-label="Ano" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </Field>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
          </form>
        </Modal>
      )}
      {toDelete && (
        <Modal
          title="Excluir escala"
          onClose={() => setToDelete(null)}
          footer={<>
            <button type="button" className="btn ghost" onClick={() => setToDelete(null)}>Cancelar</button>
            <button type="button" className="btn danger" onClick={async () => { await repo.deleteSchedule(toDelete.id); setSelected((x) => x.filter((y) => y !== toDelete.id)); setToDelete(null); void reload(); }}>Excluir definitivamente</button>
          </>}
        >
          <p>A escala <strong>{monthLabel(toDelete.year, toDelete.month)}</strong> será excluída deste navegador. PDFs já baixados não são afetados.</p>
        </Modal>
      )}
    </section>
  );
}
