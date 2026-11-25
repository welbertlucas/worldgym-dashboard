// Pessoas da unidade numa lista única: nome, departamento e turno na linha; o resto (regime, dias,
// horário, férias, quem cobre) em "Detalhes". Mostra quantas pessoas cada departamento precisa.
import { useMemo, useState, type FormEvent } from 'react';
import { newEmployee, newIntern, SHIFT_TEMPLATES } from '../../domain/defaults';
import { suggestHeadcount } from '../../domain/staffing';
import { formatShiftShort } from '../../domain/time';
import {
  DEPARTMENTS, isHourlyDept, SHIFT_KIND_LABEL, type DeptId, type Employee, type Headcount, type ScheduleConfig, type ShiftKind,
} from '../../domain/types';
import { CoveredByRow, EmployeeCard } from './ConfigSteps';

/** Cor de cada departamento no gráfico (a mesma da legenda). */
const COR: Record<DeptId, string> = { recepcao: '#c41230', apoio: '#3d4451', professores: '#e08a2c', estagiarios: '#8d97a8' };

/** Gráfico de rosca: quantas pessoas há em cada departamento; o total fica no centro. */
function Rosca({ depts, counts, destaque }: { depts: DeptId[]; counts: Record<string, number>; destaque: DeptId | null }) {
  const total = depts.reduce((s, d) => s + (counts[d] ?? 0), 0);
  const r = 58;
  const circ = 2 * Math.PI * r;
  const ativos = depts.filter((d) => counts[d] > 0);
  const folga = ativos.length > 1 ? 3 : 0;
  let acc = 0;
  const label = `Pessoas por departamento: ${depts.map((d) => `${deptNome(d)} ${counts[d] ?? 0}`).join(', ')}. Total ${total}.`;
  return (
    <svg className="rosca" viewBox="0 0 160 160" role="img" aria-label={label}>
      <circle cx="80" cy="80" r={r} fill="none" stroke="var(--grey-2)" strokeWidth="22" />
      {total > 0 && ativos.map((d) => {
        const len = (counts[d] / total) * circ;
        const seg = (
          <circle key={d} cx="80" cy="80" r={r} fill="none" stroke={COR[d]} strokeWidth={destaque === d ? 26 : 22}
            strokeDasharray={`${Math.max(len - folga, 0.5)} ${circ}`} strokeDashoffset={-acc} transform="rotate(-90 80 80)"
            opacity={destaque && destaque !== d ? 0.35 : 1}>
            <title>{`${deptNome(d)}: ${counts[d]}`}</title>
          </circle>
        );
        acc += len;
        return seg;
      })}
      <text x="80" y="78" textAnchor="middle" className="rosca-total">{total}</text>
      <text x="80" y="98" textAnchor="middle" className="rosca-sub">{total === 1 ? 'pessoa' : 'pessoas'}</text>
    </svg>
  );
}

const KINDS: ShiftKind[] = ['abertura', 'intermediario', 'intermediario_noite', 'fechamento'];
const deptNome = (id: DeptId) => DEPARTMENTS.find((d) => d.id === id)!.name;

function novaPessoa(dept: DeptId, kind: ShiftKind, name: string): Employee {
  const e = dept === 'estagiarios' ? newIntern() : newEmployee(dept, isHourlyDept(dept) ? 'abertura' : kind);
  return { ...e, name };
}

/** Tira a pessoa da lista de "quem cobre" dos colegas. */
function semCobertura(list: Employee[], id: string) {
  for (const e of list) if (e.coveredBy?.includes(id)) e.coveredBy = e.coveredBy.filter((x) => x !== id);
}

export function PeopleList({ config, update, depts }: {
  config: ScheduleConfig;
  update: (fn: (c: ScheduleConfig) => void) => void;
  /** Departamentos mostrados (a unidade inteira ou só os da equipe da escala). */
  depts: DeptId[];
}) {
  const [filtro, setFiltro] = useState<DeptId | 'todos'>('todos');
  const [aberto, setAberto] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [novoDept, setNovoDept] = useState<DeptId>(depts[0]);
  const [novoTurno, setNovoTurno] = useState<ShiftKind>('abertura');

  const pessoas = useMemo(() => depts.flatMap((d) => config.departments[d].employees.map((e, i) => ({ e, dept: d, i }))), [config, depts]);
  const visiveis = filtro === 'todos' ? pessoas : pessoas.filter((p) => p.dept === filtro);
  const staffing = useMemo(() => Object.fromEntries(depts.map((d) => [d, suggestHeadcount(config, d)])), [config, depts]);

  const set = (dept: DeptId, i: number, fn: (e: Employee) => void) => update((c) => fn(c.departments[dept].employees[i]));
  const ajustarQtd = (c: ScheduleConfig, d: DeptId) => { c.departments[d].headcount = c.departments[d].employees.length as Headcount; };

  const adicionar = (ev: FormEvent) => {
    ev.preventDefault();
    const n = nome.trim();
    if (n.length < 2) return;
    update((c) => {
      c.departments[novoDept].employees.push(novaPessoa(novoDept, novoTurno, n));
      ajustarQtd(c, novoDept);
    });
    setNome('');
  };

  const mudarDept = (from: DeptId, i: number, to: DeptId) => update((c) => {
    const [e] = c.departments[from].employees.splice(i, 1);
    semCobertura(c.departments[from].employees, e.id);
    const horista = isHourlyDept(to);
    const mudouTipo = horista !== isHourlyDept(from);
    const moved: Employee = { ...e, dept: to, coveredBy: [] };
    if (to === 'estagiarios' && from !== 'estagiarios') Object.assign(moved, { shift: newIntern().shift, weeklyPlannedHours: 25, weeklyContractedHours: 25 });
    else if (mudouTipo) moved.shift = { ...SHIFT_TEMPLATES[moved.kind] };
    c.departments[to].employees.push(moved);
    ajustarQtd(c, from);
    ajustarQtd(c, to);
  });

  const remover = (dept: DeptId, i: number) => update((c) => {
    const [e] = c.departments[dept].employees.splice(i, 1);
    semCobertura(c.departments[dept].employees, e.id);
    ajustarQtd(c, dept);
  });

  return (
    <div className="people">
      <div className="staffing-chart">
        <Rosca depts={depts} counts={Object.fromEntries(depts.map((d) => [d, staffing[d].current]))} destaque={filtro === 'todos' ? null : filtro} />
        <ul className="staffing-legend" aria-label="Pessoas por departamento">
          {depts.map((d) => {
            const s = staffing[d];
            const falta = s.suggested - s.current;
            return (
              <li key={d}>
                <button type="button" className={`staffing-card ${filtro === d ? 'on' : ''} ${falta > 0 ? 'falta' : 'ok'}`} onClick={() => setFiltro(filtro === d ? 'todos' : d)}
                  aria-pressed={filtro === d} title={s.explanation}>
                  <span className="dot" style={{ background: COR[d] }} aria-hidden="true" />
                  <span className="staffing-name">{deptNome(d)}</span>
                  <span className="staffing-num"><strong>{s.current}</strong> {s.current === 1 ? 'pessoa' : 'pessoas'}</span>
                  <span className="staffing-hint">{falta > 0 ? `Padrão da rede: ${s.suggested} (faltam ${falta})` : `Padrão da rede: ${s.suggested}`}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="field-hint staffing-note">Padrão da rede: 4 na Recepção, 4 em Serviços Gerais, 4 Professores e 6 Estagiários. Clique num departamento para filtrar a lista.</p>

      <form className="people-add" onSubmit={adicionar}>
        <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do colaborador" aria-label="Nome da nova pessoa" />
        <select className="input" value={novoDept} onChange={(e) => setNovoDept(e.target.value as DeptId)} aria-label="Departamento da nova pessoa">
          {depts.map((d) => <option key={d} value={d}>{deptNome(d)}</option>)}
        </select>
        {!isHourlyDept(novoDept) && (
          <select className="input" value={novoTurno} onChange={(e) => setNovoTurno(e.target.value as ShiftKind)} aria-label="Turno da nova pessoa">
            {KINDS.map((k) => <option key={k} value={k}>{SHIFT_KIND_LABEL[k]}</option>)}
          </select>
        )}
        <button className="btn primary" disabled={nome.trim().length < 2}>Adicionar</button>
      </form>

      <ul className="people-list">
        {depts.filter((d) => filtro === 'todos' || filtro === d).map((d) => <li key={`a-${d}`} id={`team-${d}`} className="people-anchor" aria-hidden="true" />)}
        {visiveis.map(({ e, dept, i }) => {
          const open = aberto === e.id;
          const horista = isHourlyDept(dept);
          const regime = e.fixedDays?.length ? 'Dias fixos' : e.weekendOnly ? 'Fim de semana' : '5x2';
          const colegas = config.departments[dept].employees.filter((x) => x.id !== e.id && x.active);
          const semNome = e.name.trim().length < 2;
          return (
            <li key={e.id} id={`emp-${e.id}`} className={`person ${open ? 'open' : ''} ${e.active ? '' : 'inactive'}`}>
              <div className="person-row">
                <input className={`input person-name ${semNome ? 'missing' : ''}`} value={e.name} placeholder="Nome do colaborador" aria-label={`Nome – ${deptNome(dept)}`}
                  onChange={(ev) => { const v = ev.target.value; set(dept, i, (x) => { x.name = v; }); }} />
                <select className="input" value={dept} onChange={(ev) => mudarDept(dept, i, ev.target.value as DeptId)} aria-label={`Departamento de ${e.name || 'pessoa sem nome'}`}>
                  {depts.map((d) => <option key={d} value={d}>{deptNome(d)}</option>)}
                </select>
                {horista ? <span className="person-kind muted small">Horário livre</span> : (
                  <select className="input" value={e.kind} aria-label={`Turno de ${e.name || 'pessoa sem nome'}`}
                    onChange={(ev) => { const k = ev.target.value as ShiftKind; set(dept, i, (x) => {
                      const modelo = SHIFT_TEMPLATES[x.kind];
                      if (x.shift.start === modelo.start && x.shift.end === modelo.end) x.shift = { ...SHIFT_TEMPLATES[k] };
                      x.kind = k;
                    }); }}>
                    {KINDS.map((k) => <option key={k} value={k}>{SHIFT_KIND_LABEL[k]}</option>)}
                  </select>
                )}
                <span className="person-meta small">{e.weekendOnly ? 'Sáb, dom e feriado' : e.fixedShifts ? 'Horário por dia' : formatShiftShort(e.shift)} · {regime}{!e.active && ' · inativo'}{(e.vacations?.length ?? 0) > 0 && ' · férias'}</span>
                <span className="person-actions">
                  <button type="button" className="btn ghost small" aria-expanded={open} onClick={() => setAberto(open ? null : e.id)}>{open ? 'Fechar' : 'Detalhes'}</button>
                  <button type="button" className="btn ghost small icon-only" aria-label={`Remover ${e.name || 'pessoa sem nome'}`} title="Remover" onClick={() => remover(dept, i)}>×</button>
                </span>
              </div>
              {open && (
                <div className="person-details">
                  <EmployeeCard emp={e} index={i} breakRules={config.labor.breakRules} onChange={(fn) => set(dept, i, fn)} compact />
                  {colegas.length > 0 && (
                    <div className="person-cover">
                      <h4>Quem cobre {e.name.trim() || 'esta pessoa'} nas folgas</h4>
                      <div className="cover-table" role="table" aria-label={`Quem cobre ${e.name || 'pessoa sem nome'}`}>
                        <CoveredByRow emp={e} hourly={horista} colleagues={colegas} onChange={(fn) => set(dept, i, fn)} />
                      </div>
                      <p className="field-hint">{horista ? 'Sem nome escolhido, não há troca; o sistema só confere o mínimo presente.' : 'Sem nome escolhido, vale a regra de cobertura do departamento (aba Regras dos departamentos).'}</p>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
        {visiveis.length === 0 && <li className="muted small people-empty">Ninguém cadastrado{filtro !== 'todos' ? ` em ${deptNome(filtro)}` : ''}. Use o campo acima para adicionar.</li>}
      </ul>
    </div>
  );
}
