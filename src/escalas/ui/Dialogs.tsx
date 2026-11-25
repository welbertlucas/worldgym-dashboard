import { useState } from 'react';
import type { Analysis } from '../domain/analyze';
import { formatDayMonth, WEEKDAY_LONG, WEEKDAY_SHORT, weekdayOf } from '../domain/calendar';
import type { CellPatch } from '../domain/scheduleOps';
import { formatDuration, formatShift, sameShift, shiftErrors } from '../domain/time';
import { DEPT_IDS, deptName, SHIFT_KIND_LABEL, type Alert, type DeptId, type ExceptionKind, type Schedule, type Shift } from '../domain/types';
import { cellAlerts } from './cellCode';
import { Field, Modal, NumberInput, Segmented, SeverityBadge, ShiftEditor } from './components/form';

function locate(analysis: Analysis, empId: string) {
  for (const id of DEPT_IDS) {
    const da = analysis.depts[id];
    const e = da.resolved.ctx.employees.findIndex((x) => x.id === empId);
    if (e >= 0) return { da, e };
  }
  return null;
}

const ORIGIN_LABEL = { habitual: 'Horário habitual', fimDeSemana: 'Turno de fim de semana', feriado: 'Turno de feriado', substituicao: 'Substituição de turno (automática)', manual: 'Ajuste manual' };

export function CellDialog({ schedule, analysis, empId, date, onApply, onClose }: {
  schedule: Schedule; analysis: Analysis; empId: string; date: string; onApply: (patch: CellPatch) => void; onClose: () => void;
}) {
  const loc = locate(analysis, empId)!;
  const { da, e } = loc;
  const d = analysis.range.dates.indexOf(date);
  const resolved = da.resolved.cells[e][d];
  const raw = schedule.cells?.[empId]?.[date];
  const emp = da.resolved.ctx.employees[e];
  const [status, setStatus] = useState<'T' | 'F'>(resolved.status === 'T' ? 'T' : 'F');
  const [custom, setCustom] = useState<boolean>(!!raw?.manualShift);
  const [shift, setShift] = useState<Shift>(raw?.manualShift ?? resolved.shift ?? emp.shift);
  const alerts = cellAlerts(da, e, d, analysis.alerts);
  const others = analysis.alerts.filter((a) => a.employeeId === empId && a.date === date && a.severity !== 'critico');
  const readOnly = resolved.locked || !!da.resolved.ctx.holidays[d]?.closed;
  const errors = custom && status === 'T' ? shiftErrors(shift, 'Horário') : [];

  const apply = () => {
    const patch: CellPatch = { status };
    if (status === 'T') patch.manualShift = custom ? shift : null;
    onApply(patch);
  };
  const unchanged = status === (resolved.status === 'T' ? 'T' : 'F') && (status === 'F' || (custom ? sameShift(shift, raw?.manualShift) : !raw?.manualShift));

  return (
    <Modal
      title={`${emp.name || 'Colaborador'} — ${WEEKDAY_LONG[weekdayOf(date)]}, ${formatDayMonth(date)}`}
      onClose={onClose}
      footer={readOnly ? <button type="button" className="btn ghost" onClick={onClose}>Fechar</button> : <>
        <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn primary" disabled={errors.length > 0 || unchanged} onClick={apply}>Aplicar alteração</button>
      </>}
    >
      <p className="muted">{deptName(da.deptId)} · {SHIFT_KIND_LABEL[emp.kind]} · habitual {formatShift(emp.shift)}</p>
      <div className="info-box">
        {resolved.status === 'T' ? (
          <>Situação atual: <strong>Trabalha</strong> {resolved.shift!.start}–{resolved.shift!.end} — {formatDuration(resolved.minutes)} efetivas ({ORIGIN_LABEL[resolved.origin!]})</>
        ) : resolved.status === 'FR' ? <>Situação atual: <strong>Férias</strong> (cadastradas em Ausências)</> : resolved.status === 'FE' ? <>Situação atual: <strong>Folga de feriado</strong>{da.resolved.ctx.holidays[d]?.closed ? ' (academia fechada)' : ''}</> : <>Situação atual: <strong>Folga</strong></>}
      </div>
      {resolved.locked && <p className="note">Este dia pertence à semana que começou no mês anterior e foi importado daquela escala. Para alterá-lo, edite a escala do mês anterior.</p>}
      {!readOnly && (
        <div className="stack-sm">
          <Segmented ariaLabel="Situação do dia" value={status} onChange={setStatus} options={[{ value: 'T', label: 'Trabalha (T)' }, { value: 'F', label: 'Folga (F)' }]} />
          {status === 'T' && (
            <>
              <Segmented ariaLabel="Horário" value={custom ? 'manual' : 'auto'} onChange={(v) => setCustom(v === 'manual')} options={[{ value: 'auto', label: 'Horário automático' }, { value: 'manual', label: 'Ajustar horário deste dia' }]} />
              {custom && <ShiftEditor shift={shift} onChange={setShift} />}
              {!custom && <p className="field-hint">Automático: horário habitual nos dias úteis, turno do departamento no fim de semana e substituição da abertura quando aplicável.</p>}
            </>
          )}
          <p className="field-hint">Horas, coberturas e alertas são recalculados imediatamente após aplicar.</p>
        </div>
      )}
      {[...alerts, ...others].length > 0 && (
        <ul className="alert-list compact">
          {[...alerts, ...others].map((a) => (
            <li key={a.id} className={`alert-item sev-${a.severity}`}><div><SeverityBadge severity={a.severity} /> <strong>{a.title}</strong><p>{a.message}</p></div></li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export function ChangeReviewDialog({ newAlerts, onKeep, onUndo }: { newAlerts: Alert[]; onKeep: () => void; onUndo: () => void }) {
  const critical = newAlerts.filter((a) => a.severity === 'critico').length;
  return (
    <Modal
      title="Esta alteração gera alertas"
      onClose={onUndo}
      footer={<>
        <button type="button" className="btn ghost" onClick={onUndo}>Desfazer alteração</button>
        <button type="button" className={`btn ${critical ? 'danger' : 'primary'}`} onClick={onKeep}>Manter alteração</button>
      </>}
    >
      {critical > 0 && <p className="form-error">{critical} conflito(s) obrigatório(s): a escala não poderá ser confirmada enquanto não forem corrigidos.</p>}
      <ul className="alert-list compact">
        {newAlerts.map((a) => (
          <li key={a.id} className={`alert-item sev-${a.severity}`}>
            <div><SeverityBadge severity={a.severity} /> <strong>{a.title}</strong><p>{a.message}</p>{a.suggestion && <p className="suggestion"><span>Sugestão:</span> {a.suggestion}</p>}</div>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

export function EmployeeDialog({ analysis, schedule, empId, onClose }: { analysis: Analysis; schedule: Schedule; empId: string; onClose: () => void }) {
  const { da, e } = locate(analysis, empId)!;
  const emp = da.resolved.ctx.employees[e];
  const s = da.stats[e];
  const { range } = analysis;
  const labor = schedule.config.labor;
  const limit = labor.weeklyLimitHours * 60;
  const alerts = analysis.alerts.filter((a) => a.employeeId === empId && a.severity !== 'info');
  return (
    <Modal title={emp.name || 'Colaborador'} onClose={onClose} wide footer={<button type="button" className="btn ghost" onClick={onClose}>Fechar</button>}>
      <p className="muted">{deptName(da.deptId)} · {SHIFT_KIND_LABEL[emp.kind]} · habitual {formatShift(emp.shift)} · planejada {emp.weeklyPlannedHours}h · contratada {emp.weeklyContractedHours}h/semana</p>
      <div className="kpis">
        <div><span>Total no mês</span><strong>{formatDuration(s.monthMinutes)}</strong></div>
        <div><span>Dias trabalhados</span><strong>{s.workedDays}</strong></div>
        <div><span>Dias de descanso</span><strong>{s.offDays}{s.holidayDays ? ` + ${s.holidayDays} fer.` : ''}</strong></div>
        <div><span>Sábados / domingos</span><strong>{s.saturdays} / {s.sundays}</strong></div>
        {s.hourBankBalance !== null && <div><span>Saldo de compensação</span><strong>{formatDuration(s.hourBankBalance)}</strong></div>}
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Semana</th><th>Dias</th><th>Escalado</th><th>Limite</th><th>Saldo ao limite</th><th>Planejada</th><th>Adicionais</th></tr></thead>
          <tbody>
            {range.weeks.map((w, i) => {
              const days = w.dates.map((dt) => da.resolved.cells[e][range.dates.indexOf(dt)]).filter((c) => c.status === 'T').length;
              return (
                <tr key={w.index} className={s.weekMinutes[i] > limit ? 'over' : ''}>
                  <td>S{w.index} · {formatDayMonth(w.start)}–{formatDayMonth(w.end)}{w.partial ? ' *' : ''}</td>
                  <td>{days}</td>
                  <td><strong>{formatDuration(s.weekMinutes[i])}</strong></td>
                  <td>{formatDuration(limit)}</td>
                  <td>{formatDuration(limit - s.weekMinutes[i])}</td>
                  <td>{formatDuration(s.weekPlanned[i])}</td>
                  <td>{s.weekExtra[i] ? `+${formatDuration(s.weekExtra[i])}` : '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="field-hint">* semana que atravessa o mês: o total semanal inclui os dias do mês vizinho; o total mensal, não.</p>
      <h3>Horas por dia</h3>
      <div className="day-grid">
        {range.dates.map((dt, d) => {
          const c = da.resolved.cells[e][d];
          return (
            <div key={dt} className={`day-chip s-${c.status} ${range.inMonth(dt) ? '' : 'edge'}`}>
              <span>{WEEKDAY_SHORT[weekdayOf(dt)]} {formatDayMonth(dt)}</span>
              <strong>{c.status === 'T' ? formatDuration(c.minutes) : c.status === 'FE' ? 'Folga de feriado' : c.status === 'FR' ? 'Férias' : 'Folga'}</strong>
              {c.shift && <small>{c.shift.start}–{c.shift.end}{c.origin === 'substituicao' ? ' (S)' : c.origin === 'manual' ? ' (ajuste)' : ''}</small>}
            </div>
          );
        })}
      </div>
      {alerts.length > 0 && (
        <>
          <h3>Alertas de jornada</h3>
          <ul className="alert-list compact">
            {alerts.map((a) => <li key={a.id} className={`alert-item sev-${a.severity}`}><div><SeverityBadge severity={a.severity} /> <strong>{a.title}</strong><p>{a.message}</p></div></li>)}
          </ul>
        </>
      )}
    </Modal>
  );
}

export function ExceptionDialog({ schedule, deptId, date, onAdd, onRemove, onClose }: {
  schedule: Schedule; deptId: DeptId; date: string;
  onAdd: (kind: ExceptionKind, value: number, reason: string) => void; onRemove: (id: string) => void; onClose: () => void;
}) {
  const w = weekdayOf(date);
  const holiday = schedule.config.holidays.find((h) => h.date === date && !h.closed);
  const weekend = w === 0 || w === 6 || !!holiday;
  const dept = schedule.config.departments[deptId];
  const baseRequired = holiday ? dept.holidayRequired : w === 6 ? dept.saturdayRequired : dept.sundayRequired;
  const [kind, setKind] = useState<ExceptionKind>(weekend ? 'weekendStaff' : 'maxSimultaneous');
  const [value, setValue] = useState(kind === 'weekendStaff' ? baseRequired + 1 : dept.maxSimultaneous + 1);
  const [reason, setReason] = useState('');
  const existing = schedule.config.exceptions.filter((x) => x.dept === deptId && x.date === date);
  return (
    <Modal
      title={`Exceção autorizada — ${deptName(deptId)}, ${WEEKDAY_SHORT[w]} ${formatDayMonth(date)}`}
      onClose={onClose}
      footer={<>
        <button type="button" className="btn ghost" onClick={onClose}>Fechar</button>
        <button type="button" className="btn primary" disabled={reason.trim().length < 5 || !Number.isFinite(value) || value < 0} onClick={() => onAdd(kind, value, reason.trim())}>Registrar exceção</button>
      </>}
    >
      <p className="muted">Use somente quando o gestor autorizar formalmente uma quantidade diferente da configurada. A exceção fica identificada no calendário e no PDF.</p>
      {existing.length > 0 && (
        <ul className="chip-list">
          {existing.map((x) => (
            <li key={x.id} className="chip">{x.kind === 'weekendStaff' ? 'Equipe no fim de semana' : 'Máx. simultâneos'} = {x.value} — {x.reason}
              <button type="button" aria-label="Remover exceção" onClick={() => onRemove(x.id)}>×</button></li>
          ))}
        </ul>
      )}
      <div className="stack-sm">
        <Segmented ariaLabel="Tipo de exceção" value={kind} onChange={(k) => { setKind(k); setValue(k === 'weekendStaff' ? baseRequired + 1 : dept.maxSimultaneous + 1); }}
          options={[...(weekend ? [{ value: 'weekendStaff' as const, label: 'Equipe exigida no dia' }] : []), { value: 'maxSimultaneous' as const, label: 'Máximo simultâneo' }]} />
        <Field label="Quantidade autorizada"><NumberInput value={value} min={0} max={4} onChange={setValue} suffix="pessoas" ariaLabel="Quantidade autorizada" /></Field>
        <Field label="Motivo / autorização" hint="Obrigatório (mín. 5 caracteres)."><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <p className="field-hint">Depois de registrar, gere novamente ou ajuste os dias manualmente.</p>
      </div>
    </Modal>
  );
}

/** Troca de folga entre dois colegas do mesmo departamento (ex.: pedido de um funcionário). */
export function SwapDialog({ analysis, onApply, onClose }: {
  analysis: Analysis; onApply: (emp1: string, dia1: string, emp2: string, dia2: string) => void; onClose: () => void;
}) {
  const depts = DEPT_IDS.filter((id) => analysis.depts[id]?.resolved.ctx.employees.length > 1);
  const [dept, setDept] = useState<DeptId | ''>(depts[0] ?? '');
  const [p1, setP1] = useState('');
  const [d1, setD1] = useState('');
  const [p2, setP2] = useState('');
  const [d2, setD2] = useState('');
  const da = dept ? analysis.depts[dept] : null;
  const emps = da?.resolved.ctx.employees ?? [];
  const dias = analysis.range.monthDates;
  const cel = (empId: string, date: string) => {
    const e = emps.findIndex((x) => x.id === empId);
    return e < 0 ? null : da!.resolved.cells[e][analysis.range.dates.indexOf(date)];
  };
  const livre = (empId: string, date: string, st: 'T' | 'F') => { const c = cel(empId, date); return !!c && c.status === st && !c.locked; };
  const label = (date: string) => `${WEEKDAY_SHORT[weekdayOf(date)]}, ${formatDayMonth(date)}`;
  const folgas1 = p1 ? dias.filter((d) => livre(p1, d, 'F')) : [];
  const colegas = d1 ? emps.filter((x) => x.id !== p1 && livre(x.id, d1, 'T') && dias.some((d) => livre(x.id, d, 'F') && livre(p1, d, 'T'))) : [];
  const folgas2 = p2 ? dias.filter((d) => livre(p2, d, 'F') && livre(p1, d, 'T')) : [];
  const nome = (id: string) => emps.find((x) => x.id === id)?.name || 'Colaborador';
  const pronto = !!(p1 && d1 && p2 && d2);

  return (
    <Modal title="Trocar folga" onClose={onClose}
      footer={<>
        <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn primary" disabled={!pronto} onClick={() => onApply(p1, d1, p2, d2)}>Trocar folgas</button>
      </>}>
      <p className="muted">Duas pessoas do mesmo departamento trocam um dia de folga. Depois da troca, a escala confere 5x2, descanso e cobertura e mostra se surgir algum alerta.</p>
      {!depts.length ? <p className="note">Nenhum departamento com duas pessoas ou mais nesta escala.</p> : (
        <div className="stack-sm swap-form">
          <Field label="Departamento">
            <select className="input" aria-label="Departamento" value={dept} onChange={(e) => { setDept(e.target.value as DeptId); setP1(''); setD1(''); setP2(''); setD2(''); }}>
              {depts.map((id) => <option key={id} value={id}>{deptName(id)}</option>)}
            </select>
          </Field>
          <div className="swap-grid">
            <Field label="Quem quer trocar">
              <select className="input" aria-label="Pessoa 1" value={p1} onChange={(e) => { setP1(e.target.value); setD1(''); setP2(''); setD2(''); }}>
                <option value="">Escolha</option>
                {emps.map((x) => <option key={x.id} value={x.id}>{x.name || 'Colaborador'}</option>)}
              </select>
            </Field>
            <Field label="Folga que vai trabalhar" hint={p1 && !folgas1.length ? 'Sem folgas livres neste mês.' : undefined}>
              <select className="input" aria-label="Folga da pessoa 1" value={d1} disabled={!p1} onChange={(e) => { setD1(e.target.value); setP2(''); setD2(''); }}>
                <option value="">Escolha</option>
                {folgas1.map((d) => <option key={d} value={d}>{label(d)}</option>)}
              </select>
            </Field>
            <Field label="Colega que folga no lugar" hint={d1 && !colegas.length ? 'Ninguém trabalha nesse dia com uma folga para trocar.' : undefined}>
              <select className="input" aria-label="Pessoa 2" value={p2} disabled={!d1} onChange={(e) => { setP2(e.target.value); setD2(''); }}>
                <option value="">Escolha</option>
                {colegas.map((x) => <option key={x.id} value={x.id}>{x.name || 'Colaborador'}</option>)}
              </select>
            </Field>
            <Field label="Folga do colega que passa para quem pediu">
              <select className="input" aria-label="Folga da pessoa 2" value={d2} disabled={!p2} onChange={(e) => setD2(e.target.value)}>
                <option value="">Escolha</option>
                {folgas2.map((d) => <option key={d} value={d}>{label(d)}</option>)}
              </select>
            </Field>
          </div>
          {pronto && (
            <div className="info-box">
              <strong>{nome(p1)}</strong> trabalha em {label(d1)} e folga em {label(d2)}.<br />
              <strong>{nome(p2)}</strong> folga em {label(d1)} e trabalha em {label(d2)}.
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
