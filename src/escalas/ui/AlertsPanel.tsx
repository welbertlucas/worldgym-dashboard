import { useState } from 'react';
import { alertScope } from '../domain/analyze';
import { formatDayMonth, WEEKDAY_SHORT, weekdayOf } from '../domain/calendar';
import { DEPARTMENTS, type Alert, type DeptId, type Severity } from '../domain/types';
import { SeverityBadge } from './components/form';

const LABEL: Record<Severity, string> = { critico: 'Críticos', atencao: 'Atenção', info: 'Informativos' };

export function AlertsPanel({ alerts, onSelect }: { alerts: Alert[]; onSelect: (a: Alert) => void }) {
  const [sev, setSev] = useState<Severity | 'todos'>(alerts.some((a) => a.severity === 'critico') ? 'critico' : 'atencao');
  const [dept, setDept] = useState<'todos' | DeptId | 'geral'>('todos');
  const count = (s: Severity) => alerts.filter((a) => a.severity === s).length;
  const list = alerts.filter((a) => (sev === 'todos' || a.severity === sev) && (dept === 'todos' || (dept === 'geral' ? !a.dept : a.dept === dept)));
  return (
    <section className="card alerts" aria-label="Painel de alertas">
      <div className="card-head">
        <h2>Alertas</h2>
        <select className="input small" value={dept} onChange={(e) => setDept(e.target.value as typeof dept)} aria-label="Filtrar por departamento">
          <option value="todos">Todos os departamentos</option>
          {DEPARTMENTS.filter((x) => alerts.some((a) => a.dept === x.id)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          <option value="geral">Geral</option>
        </select>
      </div>
      <div className="sev-tabs" role="tablist">
        {(['critico', 'atencao', 'info'] as Severity[]).map((s) => (
          <button key={s} role="tab" aria-selected={sev === s} type="button" className={`sev-tab sev-${s} ${sev === s ? 'on' : ''}`} onClick={() => setSev(s)}>
            {LABEL[s]} <span className="count">{count(s)}</span>
          </button>
        ))}
        <button role="tab" aria-selected={sev === 'todos'} type="button" className={`sev-tab ${sev === 'todos' ? 'on' : ''}`} onClick={() => setSev('todos')}>Todos</button>
      </div>
      {list.length === 0 ? (
        <p className="muted">{sev === 'critico' ? 'Nenhum conflito obrigatório pendente.' : 'Nenhum alerta neste filtro.'}</p>
      ) : (
        <ul className="alert-list">
          {groupAlerts(list).map((g) => <AlertGroup key={g.key} group={g} onSelect={onSelect} />)}
        </ul>
      )}
    </section>
  );
}

interface Group {
  key: string;
  first: Alert;
  items: Alert[];
}

/** Junta as ocorrências do mesmo problema (mesmo tipo, departamento e colaborador) num item só. */
function groupAlerts(list: Alert[]): Group[] {
  const map = new Map<string, Group>();
  for (const a of list) {
    const key = a.severity === 'info' ? a.id : `${a.severity}|${a.code}|${a.dept ?? ''}|${a.employeeId ?? ''}`;
    const g = map.get(key);
    if (g) g.items.push(a);
    else map.set(key, { key, first: a, items: [a] });
  }
  return [...map.values()];
}

const dayText = (date: string) => `${WEEKDAY_SHORT[weekdayOf(date)]} ${formatDayMonth(date)}`;

function AlertGroup({ group, onSelect }: { group: Group; onSelect: (a: Alert) => void }) {
  const [open, setOpen] = useState(false);
  const { first: a, items } = group;
  const many = items.length > 1;
  const dated = items.filter((x) => x.date);
  return (
    <li className={`alert-item sev-${a.severity}`}>
      <div>
        <div className="alert-top">
          <SeverityBadge severity={a.severity} />
          <strong>{a.title}</strong>
          {many && <span className="alert-count">{items.length}×</span>}
        </div>
        <div className="alert-meta">
          {alertScope(a)}
          {a.employeeName && <> · {a.employeeName}</>}
          {!many && a.date && <> · {dayText(a.date)}</>}
        </div>
        {a.suggestion ? (
          <p className="alert-fix"><span>O que fazer:</span> {a.suggestion}</p>
        ) : <p>{a.message}</p>}
        {dated.length > 0 && (
          <div className="alert-days" aria-label="Dias afetados">
            {dated.slice(0, 10).map((x) => (
              <button key={x.id} type="button" className="day-pill" disabled={!x.employeeId} onClick={() => onSelect(x)}
                title={x.employeeId ? `Abrir ${dayText(x.date!)} no calendário` : x.message}>
                {dayText(x.date!)}
              </button>
            ))}
            {dated.length > 10 && <span className="muted small">+{dated.length - 10}</span>}
          </div>
        )}
        {a.suggestion && (
          <button type="button" className="link small" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? 'Ocultar detalhes' : many ? `Ver os ${items.length} casos` : 'Ver detalhe'}
          </button>
        )}
        {open && <ul className="alert-details">{items.map((x) => <li key={x.id}>{x.message}</li>)}</ul>}
      </div>
    </li>
  );
}
