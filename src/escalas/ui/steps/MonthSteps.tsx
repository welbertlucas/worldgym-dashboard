// Abas da escala do mês: "Mês" (feriados, compensação, dias sem folga e ajustes só deste mês) e
// "Ausências" (férias e dias em que cada pessoa não pode, e quem entra nesta escala).
// Pessoas, regras dos departamentos, horário e jornada ficam no cadastro da unidade.
import { useState } from 'react';
import { buildRange, formatDateBr, WEEKDAY_LONG, weekdayOf } from '../../domain/calendar';
import type { ShiftRisk } from '../../domain/risks';
import { formatShiftShort } from '../../domain/time';
import {
  DEPARTMENTS, deptEnabled, memberLabel, SHIFT_KIND_LABEL, teamDepts, type Alert, type Employee, type ScheduleConfig,
} from '../../domain/types';
import { Field, Segmented, Toggle } from '../components/form';
import { HolidayCompensationField, HolidaysCard, NoOffCard, OperatingHoursCard, StepDepartamentos, VacationEditor } from './ConfigSteps';
import { PeopleList } from './PeopleList';

interface StepProps {
  config: ScheduleConfig;
  update: (fn: (c: ScheduleConfig) => void) => void;
}

export type UnitTab = 'funcionamento' | 'pessoas' | 'regras' | 'jornada';

export function StepMes({ config, update, risks, weeklyOver, onBackToUnit, onOpenUnit, linked }: StepProps & {
  risks: ShiftRisk[];
  weeklyOver: Alert[];
  /** Desliga um ajuste do mês: volta a seguir o cadastro. */
  onBackToUnit: (which: 'hours' | 'deptRules') => void;
  /** Abre o cadastro da unidade numa aba. */
  onOpenUnit?: (tab: UnitTab) => void;
  /** A escala acompanha o cadastro (mês atual em diante, não confirmada). */
  linked: boolean;
}) {
  const ov = config.overrides ?? {};
  const h = config.operatingHours;
  const resumo = [1, 2, 3, 4, 5, 6, 0].map((w) => `${WEEKDAY_LONG[w].slice(0, 3)} ${h[w].open ? `${h[w].start}–${h[w].end}` : 'fechada'}`).join(' · ');
  return (
    <div className="stack">
      <HolidaysCard config={config} update={update} />
      <div className="card">
        <h2>Compensação de feriado</h2>
        <HolidayCompensationField config={config} update={update} />
      </div>
      <NoOffCard config={config} update={update} />

      <div className="card month-adjust" id="ajustes-do-mes">
        <h2>Ajustes só deste mês</h2>
        <p className="muted">Só quando este mês for diferente do cadastro da unidade, como dezembro com horário reduzido{onOpenUnit && <> (<button type="button" className="link" onClick={() => onOpenUnit('funcionamento')}>abrir cadastro</button>)</>}.</p>
        {!ov.hours && <p className="small muted">Horário em uso: {resumo}. Feriado {config.holidayHours.start}–{config.holidayHours.end}.</p>}
        <Toggle checked={!!ov.hours} label="Horário de funcionamento diferente neste mês"
          hint={ov.hours ? 'Este mês usa o horário abaixo. Desmarque para voltar ao horário do cadastro.' : 'Desmarcado: segue o horário do cadastro da unidade.'}
          onChange={(v) => (v ? update((c) => { c.overrides = { ...c.overrides, hours: true }; }) : onBackToUnit('hours'))} />
        {ov.hours && <OperatingHoursCard config={config} update={update} title="Horário deste mês" intro="Vale só para esta escala. O cadastro da unidade não muda." />}
        <Toggle checked={!!ov.deptRules} label="Regras dos departamentos diferentes neste mês"
          hint={ov.deptRules ? 'Sábado, domingo, feriado, turnos e cobertura deste mês ficam abaixo. Desmarque para voltar às regras do cadastro.' : 'Desmarcado: segue as regras do cadastro (sábado, domingo, feriado, turnos e cobertura).'}
          onChange={(v) => (v ? update((c) => { c.overrides = { ...c.overrides, deptRules: true }; }) : onBackToUnit('deptRules'))} />
        {!linked && !ov.hours && !ov.deptRules && <p className="field-hint">Esta escala é confirmada ou de mês passado: ela guarda o horário e as regras de quando foi feita.</p>}
      </div>
      {ov.deptRules && <StepDepartamentos config={config} update={update} risks={risks} weeklyOver={weeklyOver} />}
    </div>
  );
}

function UnavailableEditor({ emp, config, onChange }: { emp: Employee; config: ScheduleConfig; onChange: (fn: (e: Employee) => void) => void }) {
  const range = buildRange(config.year, config.month);
  const [date, setDate] = useState('');
  const list = [...emp.unavailableDates].filter((d) => range.dates.includes(d)).sort();
  return (
    <div className="unavailable">
      <h4>Dias em que não pode trabalhar (só neste mês)</h4>
      {list.length > 0 && (
        <div className="chip-list">
          {list.map((d) => (
            <span key={d} className="chip">
              {WEEKDAY_LONG[weekdayOf(d)].slice(0, 3)} {formatDateBr(d)}
              <button type="button" aria-label={`Remover ${formatDateBr(d)}`} onClick={() => onChange((x) => { x.unavailableDates = x.unavailableDates.filter((y) => y !== d); })}>×</button>
            </span>
          ))}
        </div>
      )}
      <div className="row wrap end">
        <Field label="Data"><input className="input" type="date" value={date} min={range.monthDates[0]} max={range.monthDates[range.monthDates.length - 1]} onChange={(e) => setDate(e.target.value)} aria-label={`Dia em que ${emp.name || 'a pessoa'} não pode`} /></Field>
        <button type="button" className="btn ghost" disabled={!date} onClick={() => { onChange((x) => { x.unavailableDates = [...new Set([...x.unavailableDates, date])]; }); setDate(''); }}>Adicionar dia</button>
      </div>
    </div>
  );
}

export function StepAusencias({ config, update, onOpenUnit }: StepProps & { onOpenUnit?: (tab: UnitTab) => void }) {
  const range = buildRange(config.year, config.month);
  const [aberto, setAberto] = useState<string | null>(null);
  const noMes = (e: Employee) => (e.vacations ?? []).filter((v) => v.end >= range.monthDates[0] && v.start <= range.monthDates[range.monthDates.length - 1]);
  return (
    <div className="stack">
      <div className="ausencias-head">
        <p className="muted">Informe só o que é deste mês: férias e dias em que alguém não pode trabalhar. Nome, turno, regime e quem cobre quem ficam na aba Equipe.</p>
        {onOpenUnit && <button type="button" className="btn ghost small" onClick={() => onOpenUnit('pessoas')}>Editar pessoas</button>}
      </div>
      {DEPARTMENTS.filter((x) => teamDepts(config).includes(x.id)).map(({ id: dept, name }) => {
        const d = config.departments[dept];
        const enabled = deptEnabled(config, dept);
        return (
          <section key={dept} id={`team-${dept}`} className={`team-section ${enabled ? '' : 'off'}`} aria-label={`Ausências – ${name}`}>
            <div className="team-head">
              <h2>{name}</h2>
              <span className="tag">{d.employees.length} {d.employees.length === 1 ? 'pessoa' : 'pessoas'}</span>
            </div>
            {!enabled ? (
              <p className="muted small">Ninguém com nome cadastrado: {name.toLowerCase()} não entram nesta escala. Cadastre as pessoas na aba Equipe para incluir.</p>
            ) : (
              <ul className="ausencias-list">
                {d.employees.map((emp, i) => {
                  const ferias = noMes(emp);
                  const dias = emp.unavailableDates.filter((x) => range.dates.includes(x)).length;
                  const open = aberto === emp.id;
                  return (
                    <li key={emp.id} id={`emp-${emp.id}`} className={open ? 'open' : ''}>
                      <button type="button" className="ausencia-row" aria-expanded={open} onClick={() => setAberto(open ? null : emp.id)}>
                        <span className="who">
                          <strong>{emp.name.trim() || `${memberLabel(dept)} ${i + 1} (sem nome)`}</strong>
                          <span className="muted small">{SHIFT_KIND_LABEL[emp.kind]} · {formatShiftShort(emp.shift)}{emp.weekendOnly ? ' · só fim de semana e feriado' : emp.fixedDays?.length ? ' · dias fixos' : ''}</span>
                        </span>
                        <span className="badges">
                          {ferias.map((v) => <span key={v.start} className="chip vac">Férias {formatDateBr(v.start).slice(0, 5)}–{formatDateBr(v.end).slice(0, 5)}</span>)}
                          {dias > 0 && <span className="chip">{dias} {dias === 1 ? 'dia indisponível' : 'dias indisponíveis'}</span>}
                          {!ferias.length && !dias && <span className="muted small">Sem ausências</span>}
                        </span>
                        <span className="chev" aria-hidden="true">{open ? '−' : '+'}</span>
                      </button>
                      {open && (
                        <div className="ausencia-edit">
                          <VacationEditor emp={emp} onChange={(fn) => update((c) => fn(c.departments[dept].employees[i]))} />
                          <UnavailableEditor emp={emp} config={config} onChange={(fn) => update((c) => fn(c.departments[dept].employees[i]))} />
                        </div>
                      )}
                    </li>
                  );
                })}
                {d.employees.length === 0 && <li className="muted small">Ninguém cadastrado neste departamento.</li>}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

export type EquipeTab = 'pessoas' | 'regras' | 'funcionamento';

/**
 * Aba "Equipe" da escala: pessoas, regras dos departamentos e funcionamento da unidade.
 * Em escalas que acompanham o cadastro, o que muda aqui vai para o cadastro da unidade
 * (vale para as próximas escalas). Em escalas confirmadas ou de mês passado, vale só para esta.
 */
export function StepEquipe({ config, update, risks, sub, onSub, linked, onOpenUnit }: StepProps & {
  risks: ShiftRisk[];
  sub: EquipeTab;
  onSub: (t: EquipeTab) => void;
  linked: boolean;
  onOpenUnit?: (tab: UnitTab) => void;
}) {
  const ov = config.overrides ?? {};
  return (
    <div className="stack">
      <div className="equipe-head">
        <Segmented ariaLabel="Parte da equipe" value={sub} onChange={onSub}
          options={[{ value: 'pessoas', label: 'Pessoas' }, { value: 'regras', label: 'Regras dos departamentos' }, { value: 'funcionamento', label: 'Funcionamento' }]} />
        <p className="muted small">
          {linked
            ? 'Este é o cadastro da unidade: o que você muda aqui vale para esta e para as próximas escalas.'
            : 'Escala confirmada ou de mês passado: o que você muda aqui vale só para esta escala.'}
          {onOpenUnit && <> <button type="button" className="link" onClick={() => onOpenUnit('jornada')}>Ver regras de jornada</button></>}
        </p>
      </div>
      {sub === 'pessoas' && <PeopleList config={config} update={update} depts={teamDepts(config)} />}
      {sub === 'regras' && (ov.deptRules
        ? <p className="roster-note">Este mês usa regras próprias dos departamentos (aba Mês, "Ajustes só deste mês"). Desmarque lá para voltar às regras da unidade.</p>
        : <StepDepartamentos config={config} update={update} risks={risks} weeklyOver={[]} cadastro />)}
      {sub === 'funcionamento' && (ov.hours
        ? <p className="roster-note">Este mês usa horário próprio (aba Mês, "Ajustes só deste mês"). Desmarque lá para voltar ao horário da unidade.</p>
        : <OperatingHoursCard config={config} update={update} intro="Horário habitual da unidade, igual para as duas equipes. Se só um mês for diferente (ex.: dezembro), use os ajustes da aba Mês." />)}
    </div>
  );
}
