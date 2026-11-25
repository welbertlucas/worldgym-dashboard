import { useState } from 'react';
import { buildRange, formatDateBr, MONTH_NAMES, WEEKDAY_LONG, WEEKDAY_SHORT, weekdayOf } from '../../domain/calendar';
import { holidaysInDates, localHolidayDate, MOVABLE_LABEL } from '../../domain/holidays';
import type { ShiftRisk } from '../../domain/risks';
import type { Alert, Headcount, LocalHoliday, MovableHoliday } from '../../domain/types';
import { ALL_WEEKDAYS, DAILY_NORMAL_MINUTES, defaultKindForSlot, newEmployee, newId, newIntern, SHIFT_TEMPLATES } from '../../domain/defaults';
import { formatDuration, shiftWithin } from '../../domain/time';
import { suggestHeadcount } from '../../domain/staffing';
import {
  DEPARTMENTS, DEPT_IDS, deptEnabled, isHourlyDept, teamDepts, maxTeamSize, memberLabel, minTeamSize, SHIFT_KIND_LABEL, type BreakRule, type DeptConfig, type DeptId, type Employee, type ScheduleConfig, type ShiftKind, type Weekday,
} from '../../domain/types';
import { Ajuda, Field, Modal, NumberInput, Segmented, ShiftEditor, TimeInput, Toggle, WeekdayPicker } from '../components/form';

export type Update = (mutate: (c: ScheduleConfig) => void) => void;

interface StepProps {
  config: ScheduleConfig;
  update: Update;
}


/** Sábado/domingo do funcionamento mudou: os turnos de fim de semana dos departamentos acompanham (exceto estagiários). */
function syncWeekendShifts(c: ScheduleConfig, w: number) {
  if (w !== 6 && w !== 0) return;
  const h = c.operatingHours[w];
  const shift = shiftWithin(h.start, h.end, DAILY_NORMAL_MINUTES, c.labor.breakRules);
  for (const id of DEPT_IDS.filter((x) => x !== 'estagiarios')) {
    const d = c.departments[id];
    if (w === 6) {
      // O 2º turno de sábado acompanha quando era igual ao 1º.
      if (d.saturdayShift2 && JSON.stringify(d.saturdayShift2) === JSON.stringify(d.saturdayShift)) d.saturdayShift2 = { ...shift };
      d.saturdayShift = { ...shift };
    } else d.sundayShift = { ...shift };
  }
}

/** Horário de feriado mudou: o turno de feriado dos departamentos acompanha (exceto estagiários). */
function syncHolidayShifts(c: ScheduleConfig) {
  const shift = shiftWithin(c.holidayHours.start, c.holidayHours.end, DAILY_NORMAL_MINUTES, c.labor.breakRules);
  for (const id of DEPT_IDS.filter((x) => x !== 'estagiarios')) c.departments[id].holidayShift = { ...shift };
}

const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

/** Horário de funcionamento por dia da semana e horário dos feriados em que a academia abre. */
export function OperatingHoursCard({ config, update, title = 'Horário de funcionamento', intro }: StepProps & { title?: string; intro?: string }) {
  const weekendShiftsOutdated = teamDepts(config).filter((id) => id !== 'estagiarios').some((id) => {
    const d = config.departments[id];
    return (config.operatingHours[6].open && (d.saturdayShift.start !== config.operatingHours[6].start || d.saturdayShift.end !== config.operatingHours[6].end)) ||
      (config.operatingHours[0].open && (d.sundayShift.start !== config.operatingHours[0].start || d.sundayShift.end !== config.operatingHours[0].end));
  });
  return (
      <div className="card" id="horario-funcionamento">
        <h2>{title}</h2>
        <p className="muted">{intro ?? 'Valores iniciais sugeridos: segunda a sexta 05h–23h, sábado e feriado 08h–18h, domingo 08h–13h. Ajuste conforme a unidade.'}</p>
        <div className="table-wrap">
          <table className="form-table">
            <thead><tr><th>Dia</th><th>Funciona</th><th>Abertura</th><th>Fechamento</th></tr></thead>
            <tbody>
              {WEEK_ORDER.map((w) => {
                const d = config.operatingHours[w];
                return (
                  <tr key={w}>
                    <td>{WEEKDAY_LONG[w]}</td>
                    <td><input type="checkbox" aria-label={`${WEEKDAY_LONG[w]} funciona`} checked={d.open} onChange={(e) => update((c) => { c.operatingHours[w].open = e.target.checked; })} /></td>
                    <td><TimeInput ariaLabel={`Abertura ${WEEKDAY_LONG[w]}`} value={d.start} disabled={!d.open} onChange={(v) => update((c) => { c.operatingHours[w].start = v; syncWeekendShifts(c, w); })} /></td>
                    <td><TimeInput ariaLabel={`Fechamento ${WEEKDAY_LONG[w]}`} value={d.end} disabled={!d.open} onChange={(v) => update((c) => { c.operatingHours[w].end = v; syncWeekendShifts(c, w); })} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="row wrap">
          <button type="button" className="btn ghost" onClick={() => update((c) => { for (const w of [2, 3, 4, 5]) c.operatingHours[w] = { ...c.operatingHours[1] }; })}>
            Aplicar o horário de segunda a todos os dias úteis
          </button>
          {weekendShiftsOutdated && (
            <button type="button" className="btn ghost" onClick={() => update((c) => {
              for (const id of teamDepts(c).filter((x) => x !== 'estagiarios')) {
                c.departments[id].saturdayShift = shiftWithin(c.operatingHours[6].start, c.operatingHours[6].end, DAILY_NORMAL_MINUTES, c.labor.breakRules);
                c.departments[id].sundayShift = shiftWithin(c.operatingHours[0].start, c.operatingHours[0].end, DAILY_NORMAL_MINUTES, c.labor.breakRules);
              }
            })}>
              Ajustar turnos de sábado e domingo ao funcionamento
            </button>
          )}
        </div>
        <p className="field-hint">Ao mudar o horário de sábado ou domingo, os turnos de fim de semana dos departamentos acompanham automaticamente (estagiários mantêm o turno de até 6h). Se algum departamento precisar de outro horário, ajuste nas regras do departamento.</p>
        <div className="row wrap end holiday-hours">
          <Field label="Abertura no feriado"><TimeInput ariaLabel="Abertura no feriado" value={config.holidayHours.start} onChange={(v) => update((c) => { c.holidayHours.start = v; syncHolidayShifts(c); })} /></Field>
          <Field label="Fechamento no feriado"><TimeInput ariaLabel="Fechamento no feriado" value={config.holidayHours.end} onChange={(v) => update((c) => { c.holidayHours.end = v; syncHolidayShifts(c); })} /></Field>
          <button type="button" className="btn ghost" onClick={() => update((c) => {
            for (const id of teamDepts(c).filter((x) => x !== 'estagiarios')) c.departments[id].holidayShift = shiftWithin(c.holidayHours.start, c.holidayHours.end, DAILY_NORMAL_MINUTES, c.labor.breakRules);
          })}>Aplicar ao turno de feriado dos departamentos</button>
        </div>

        {weekendShiftsOutdated && <p className="field-hint">Os turnos de fim de semana de algum departamento estão diferentes do horário de funcionamento.</p>}
      </div>
  );
}

export function StepFuncionamento({ config, update }: StepProps) {
  return (
    <div className="stack">
      <OperatingHoursCard config={config} update={update} />
      <HolidaysCard config={config} update={update} />
      <NoOffCard config={config} update={update} />
    </div>
  );
}

const SOURCE_LABEL = { nacional: 'nacional', facultativo: 'ponto facultativo', manual: 'só deste mês', estadual: 'estadual (unidade)', municipal: 'municipal (unidade)' } as const;
const daUnidade = (h: { source: string }) => h.source === 'estadual' || h.source === 'municipal';

export function HolidaysCard({ config, update }: StepProps) {
  const range = buildRange(config.year, config.month);
  const [hDate, setHDate] = useState(range.monthDates[0]);
  const [hName, setHName] = useState('');
  const suggestions = holidaysInDates(range.dates).filter((h) => !config.holidays.some((x) => x.date === h.date));
  const sorted = [...config.holidays].sort((a, b) => a.date.localeCompare(b.date));
  const hh = config.holidayHours;
  return (
    <div className="card">
      <h2>Feriados</h2>
      <p className="muted">Nacionais, estaduais e municipais entram sozinhos. Para um feriado só deste mês, adicione abaixo.</p>
      <Ajuda>
        Os estaduais e municipais vêm do cadastro da unidade (Equipe e regras da unidade, aba Funcionamento).
        Com a academia aberta, ela funciona no horário de feriado ({hh.start}–{hh.end}); o gerador escala a quantidade definida nas
        regras de cada departamento, em rodízio, e dá <strong>folga de feriado</strong> aos demais — essa folga não conta entre as 2 folgas da semana.
      </Ajuda>
      {sorted.length > 0 ? (
        <div className="table-wrap">
          <table className="form-table wide">
            <thead><tr><th>Data</th><th>Feriado</th><th>Tipo</th><th>Academia</th><th></th></tr></thead>
            <tbody>
              {sorted.map((h) => (
                <tr key={h.date}>
                  <td>{WEEKDAY_LONG[weekdayOf(h.date)].split('-')[0]}, {formatDateBr(h.date)}{range.inMonth(h.date) ? '' : ' (outro mês)'}</td>
                  <td>{h.name}</td>
                  <td className="muted small">{SOURCE_LABEL[h.source]}</td>
                  <td>
                    {daUnidade(h) ? <span className="muted small">{h.closed ? 'Fechada' : `Aberta ${hh.start}–${hh.end}`}</span> : (
                    <Segmented ariaLabel={`Funcionamento em ${h.name}`} value={h.closed ? 'fechada' : 'aberta'}
                      onChange={(v) => update((c) => { c.holidays = c.holidays.map((x) => (x.date === h.date ? { ...x, closed: v === 'fechada' } : x)); })}
                      options={[{ value: 'aberta', label: `Aberta ${hh.start}–${hh.end}` }, { value: 'fechada', label: 'Fechada' }]} />
                    )}
                  </td>
                  <td>{daUnidade(h) ? <span className="muted small" title="Muda no cadastro da unidade">Cadastro da unidade</span> : <button type="button" className="btn ghost small" aria-label={`Remover feriado ${h.name}`} onClick={() => update((c) => { c.holidays = c.holidays.filter((x) => x.date !== h.date); })}>Remover</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="muted">Nenhum feriado no período.</p>}
      {suggestions.length > 0 && (
        <div className="stack-sm">
          <span className="field-label">Sugestões para o período</span>
          {suggestions.map((h) => (
            <div key={h.date} className="row wrap">
              <span>{formatDateBr(h.date)} — {h.name} <span className="muted small">({h.note ?? SOURCE_LABEL[h.source]})</span></span>
              <button type="button" className="btn ghost small" onClick={() => update((c) => { c.holidays = [...c.holidays, { date: h.date, name: h.name, closed: false, source: h.source }]; })}>Incluir</button>
            </div>
          ))}
        </div>
      )}
      <div className="row wrap end">
        <Field label="Data">
          <input className="input" type="date" value={hDate} min={range.dates[0]} max={range.dates[range.dates.length - 1]} onChange={(e) => setHDate(e.target.value)} />
        </Field>
        <Field label="Outro feriado (só deste mês)"><input className="input" value={hName} onChange={(e) => setHName(e.target.value)} placeholder="Ex.: ponto facultativo decretado" /></Field>
        <button type="button" className="btn ghost" disabled={!hName.trim() || !hDate || config.holidays.some((x) => x.date === hDate && daUnidade(x))} onClick={() => {
          update((c) => { c.holidays = [...c.holidays.filter((x) => x.date !== hDate), { date: hDate, name: hName.trim(), closed: false, source: 'manual' }]; });
          setHName('');
        }}>Adicionar feriado</button>
      </div>
    </div>
  );
}

/** Feriados estaduais e municipais da unidade (cadastro): entram sozinhos em todas as escalas. */
export function LocalHolidaysCard({ config, update }: StepProps) {
  const lista = config.localHolidays ?? [];
  const hh = config.holidayHours;
  const hoje = new Date();
  const proximo = (h: LocalHoliday) => {
    const hojeIso = hoje.toISOString().slice(0, 10);
    for (const y of [hoje.getFullYear(), hoje.getFullYear() + 1]) {
      const d = localHolidayDate(h, y);
      if (d && d >= hojeIso) return `${WEEKDAY_SHORT[weekdayOf(d)]}, ${formatDateBr(d)}`;
    }
    return null;
  };
  const mudar = (id: string, fn: (h: LocalHoliday) => void) => update((c) => {
    c.localHolidays = (c.localHolidays ?? []).map((h) => { if (h.id !== id) return h; const n = { ...h }; fn(n); return n; });
  });
  return (
    <div className="card" id="feriados-locais">
      <h2>Feriados estaduais e municipais</h2>
      <p className="muted">Cadastre uma vez: eles entram sozinhos em todas as escalas da unidade.</p>
      {lista.length === 0 && <p className="muted">Nenhum feriado local cadastrado.</p>}
      {lista.map((h) => {
        const [mes, dia] = (h.date ?? '01-01').split('-').map(Number);
        const quando = proximo(h);
        return (
          <div key={h.id} className="local-holiday">
            <Field label="Feriado"><input className="input" aria-label="Nome do feriado" value={h.name} placeholder="Ex.: Aniversário da cidade" onChange={(e) => mudar(h.id, (x) => { x.name = e.target.value; })} /></Field>
            <Field label="Tipo">
              <select className="input" aria-label={`Tipo de ${h.name || 'feriado'}`} value={h.scope} onChange={(e) => mudar(h.id, (x) => { x.scope = e.target.value as LocalHoliday['scope']; })}>
                <option value="municipal">Municipal</option>
                <option value="estadual">Estadual</option>
              </select>
            </Field>
            <Field label="Data" hint={quando ? `Próximo: ${quando}` : 'Data inválida.'}>
              <div className="row">
                <select className="input" aria-label={`Data de ${h.name || 'feriado'}`} value={h.movable ?? 'fixa'} onChange={(e) => mudar(h.id, (x) => {
                  const v = e.target.value;
                  if (v === 'fixa') { delete x.movable; x.date = x.date ?? '01-01'; } else { x.movable = v as MovableHoliday; delete x.date; }
                })}>
                  <option value="fixa">Data fixa</option>
                  {(Object.keys(MOVABLE_LABEL) as MovableHoliday[]).map((m) => <option key={m} value={m}>{MOVABLE_LABEL[m]}</option>)}
                </select>
                {!h.movable && <>
                  <select className="input small" aria-label={`Dia de ${h.name || 'feriado'}`} value={dia} onChange={(e) => mudar(h.id, (x) => { x.date = `${String(mes).padStart(2, '0')}-${e.target.value.padStart(2, '0')}`; })}>
                    {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                  </select>
                  <select className="input small" aria-label={`Mês de ${h.name || 'feriado'}`} value={mes} onChange={(e) => mudar(h.id, (x) => { x.date = `${e.target.value.padStart(2, '0')}-${String(dia).padStart(2, '0')}`; })}>
                    {MONTH_NAMES.map((n, i) => <option key={n} value={i + 1}>{n.toLowerCase()}</option>)}
                  </select>
                </>}
              </div>
            </Field>
            <Field label="Academia">
              <Segmented ariaLabel={`Funcionamento em ${h.name || 'feriado'}`} value={h.closed ? 'fechada' : 'aberta'} onChange={(v) => mudar(h.id, (x) => { x.closed = v === 'fechada'; })}
                options={[{ value: 'aberta', label: `Aberta ${hh.start}–${hh.end}` }, { value: 'fechada', label: 'Fechada' }]} />
            </Field>
            <button type="button" className="btn ghost small" aria-label={`Remover ${h.name || 'feriado'}`} onClick={() => update((c) => { c.localHolidays = (c.localHolidays ?? []).filter((x) => x.id !== h.id); })}>Remover</button>
          </div>
        );
      })}
      <button type="button" className="btn ghost" onClick={() => update((c) => { c.localHolidays = [...(c.localHolidays ?? []), { id: newId('fer'), name: '', scope: 'municipal', date: '01-01', closed: false }]; })}>Adicionar feriado local</button>
    </div>
  );
}

export function NoOffCard({ config, update }: StepProps) {
  const days = config.noOffWeekdays ?? [];
  const closedDays = days.filter((w) => !config.operatingHours[w].open);
  return (
    <div className="card">
      <h2>Dias sem folga</h2>
      <p className="muted">Marque os dias da semana em que ninguém pode folgar.</p>
      <Ajuda>
        O bloqueio vale para todas as semanas da escala, nos dois departamentos, e continua nos meses seguintes até você
        desmarcar. As folgas da semana ficam nos outros dias. Feriados seguem a regra de feriado.
      </Ajuda>
      <WeekdayPicker ariaLabel="Dias sem folga" value={days} onChange={(v) => update((c) => { c.noOffWeekdays = v; })} />
      <p className="field-hint">
        {days.length ? `Ninguém folga: ${[1, 2, 3, 4, 5, 6, 0].filter((w) => days.includes(w as Weekday)).map((w) => WEEKDAY_LONG[w].split('-')[0].toLowerCase()).join(', ')}.` : 'Nenhum dia bloqueado.'}
        {closedDays.length > 0 && ' A academia não abre em parte desses dias; neles o bloqueio não se aplica.'}
        {days.length > 0 && ' Gere ou regere a escala depois de mudar.'}
      </p>
    </div>
  );
}

export function CoverPicker<K extends ShiftKind>({ label, options, value, onChange }: { label: string; options: [K, string][]; value: ShiftKind[]; onChange: (v: ShiftKind[]) => void }) {
  return (
    <div className="cover-picker">
      <span className="field-label">{label}</span>
      <div className="row wrap">
        {options.map(([k, text]) => (
          <Toggle key={k} checked={value.includes(k)} label={text}
            onChange={(on) => onChange(on ? options.map(([o]) => o).filter((o) => o === k || value.includes(o)) : value.filter((x) => x !== k))} />
        ))}
      </div>
      <span className="field-hint">{value.length ? `Ordem de tentativa: ${value.map((k) => SHIFT_KIND_LABEL[k]).join(', depois ')}.` : 'Sem cobertura automática: o sistema alerta quando o turno ficar descoberto.'}</span>
    </div>
  );
}

const DEPT_INTRO: Partial<Record<DeptId, string>> = {
  professores: 'Professores horistas seguem o 5x2; a cobertura é pelo mínimo de professores presentes e as horas são só exibidas.',
  estagiarios: 'Estagiários seguem o 5x2 com horário próprio (padrão 5h por dia) e sábado/domingo em rodízio; a escala respeita a Lei do Estágio (até 6h por dia e 30h por semana).',
};

function InternLawNotice() {
  return (
    <div className="banner warn intern-law" role="note">
      <strong>Lei do Estágio (Lei nº 11.788/2008)</strong>
      <ul>
        <li>Jornada de no máximo <strong>6 horas por dia e 30 horas por semana</strong> (art. 10), compatível com o horário escolar. Não há hora extra nem banco de horas.</li>
        <li>Em períodos de prova, a carga horária deve ser reduzida <strong>ao menos à metade</strong>, se previsto no termo de compromisso (art. 10, § 2º).</li>
        <li>Estágio de 1 ano ou mais dá direito a <strong>30 dias de recesso</strong>, de preferência nas férias escolares; proporcional se for menor (art. 13). Cadastre o recesso no campo Férias.</li>
        <li>O horário deve seguir o termo de compromisso assinado com a instituição de ensino.</li>
      </ul>
      O sistema alerta se a escala passar de 6h no dia ou 30h na semana. Confirme as regras com o sócio-operador da unidade.
    </div>
  );
}

/** Quantidade no sábado, domingo ou feriado: o mesmo campo numérico em todos os departamentos. */
function CountChoice({ value, max, ariaLabel, onChange }: { hourly?: boolean; value: number; max: number; ariaLabel: string; onChange: (v: number) => void }) {
  return <NumberInput value={value} min={0} max={max} suffix="pessoa(s)" ariaLabel={ariaLabel}
    onChange={(v) => { if (Number.isInteger(v) && v >= 0 && v <= max) onChange(v); }} />;
}

function resizeTeam(d: DeptConfig, size: Headcount) {
  d.headcount = size;
  // Com 5 pessoas, 2 simultâneas não comportam a jornada de todos nos dias úteis.
  if (size === 5 && d.maxSimultaneous < 3) d.maxSimultaneous = 3;
  while (d.employees.length < size) d.employees.push(d.id === 'estagiarios' ? newIntern() : newEmployee(d.id, defaultKindForSlot(d.employees.length)));
}

export function StepDepartamentos({ config, update, risks, weeklyOver, cadastro = false }: StepProps & { risks: ShiftRisk[]; weeklyOver: Alert[]; /** No cadastro da unidade: sem incluir/tirar da escala e com a quantidade vinda das pessoas cadastradas. */ cadastro?: boolean }) {
  const hasOpenHoliday = config.holidays.some((h) => !h.closed);
  return (
    <div className="stack">
      {weeklyOver.length > 0 && (
        <div className="banner danger" role="alert">
          <strong>A escala gerada passou a ter {weeklyOver.length} semana(s) acima do limite de {config.labor.weeklyLimitHours}h com os horários atuais:</strong>
          <ul>{weeklyOver.slice(0, 6).map((a) => <li key={a.id}>{a.message}</li>)}</ul>
          Ajuste o horário ou clique em Regerar escala na etapa Escala.
        </div>
      )}
      {DEPARTMENTS.filter((x) => teamDepts(config).includes(x.id)).map(({ id, name }) => {
        const d = config.departments[id];
        const set = (fn: (x: DeptConfig) => void) => update((c) => fn(c.departments[id]));
        const removable = d.employees.length > d.headcount;
        const hourly = isHourlyDept(id);
        if (d.enabled === false && !cadastro)
          return (
            <div className="card" key={id} id={`dept-${id}`}>
              <div className="card-head"><h2>{name}</h2></div>
              <p className="muted small">{DEPT_INTRO[id] ? `${DEPT_INTRO[id]} ` : ''}Ninguém com nome cadastrado: não entra nesta escala. Cadastre as pessoas para incluir.</p>
            </div>
          );
        return (
          <div className="card" key={id} id={`dept-${id}`}>
            <div className="card-head">
              <h2>{name}</h2>
              <span className="tag">{id === 'professores' ? 'Horistas · 5x2' : id === 'estagiarios' ? 'Até 6h/dia e 30h/semana · 5x2' : 'Departamento fixo'}</span>
            </div>
            {id === 'estagiarios' && <InternLawNotice />}
            <div className="grid-3">
              {cadastro ? (
                <Field label="Pessoas na equipe" hint={suggestHeadcount(config, id).explanation}>
                  <input className="input" readOnly value={`${d.employees.length} ${d.employees.length === 1 ? 'pessoa' : 'pessoas'}`} aria-label={`Quantidade de colaboradores – ${name}`} />
                </Field>
              ) : (
                <Field label="Pessoas na equipe" hint={`De ${minTeamSize(id)} a ${maxTeamSize(id)}.`}>
                  <NumberInput value={d.headcount} min={minTeamSize(id)} max={maxTeamSize(id)} suffix="pessoa(s)" ariaLabel={`Quantidade de colaboradores – ${name}`}
                    onChange={(v) => { if (Number.isInteger(v) && v >= minTeamSize(id) && v <= maxTeamSize(id)) set((x) => resizeTeam(x, v)); }} />
                </Field>
              )}
              {hourly ? (
                <Field label="Mínimo presente" hint={id === 'estagiarios' ? 'Use 0 se não precisa de estagiário em todo o funcionamento.' : 'Em todo o horário de funcionamento. Se faltar, o horário aparece como conflito.'}>
                  <NumberInput value={d.minPresent ?? 1} min={0} max={d.headcount} onChange={(v) => set((x) => { x.minPresent = v; })} suffix="pessoa(s)" ariaLabel={`Mínimo de ${name.toLowerCase()} presentes – ${name}`} />
                </Field>
              ) : <div />}
              <Field label="Colaboradores no sábado" hint={d.saturdayRequired >= 2 ? 'Cada um no seu horário (defina os turnos de sábado abaixo); todos mantêm as 2 folgas da semana.' : 'Em rodízio entre a equipe.'}>
                <CountChoice hourly={hourly} max={d.headcount} value={d.saturdayRequired} ariaLabel={`Colaboradores no sábado – ${name}`}
                  onChange={(v) => set((x) => {
                    x.saturdayRequired = v;
                    if (v > x.maxSimultaneous) x.maxSimultaneous = v;
                    if (v >= 2 && !x.saturdayShift2) x.saturdayShift2 = { ...x.saturdayShift };
                  })} />
              </Field>
              <Field label="Colaboradores no domingo" hint="Em rodízio entre a equipe.">
                <CountChoice hourly={hourly} max={d.headcount} value={d.sundayRequired} ariaLabel={`Colaboradores no domingo – ${name}`}
                  onChange={(v) => set((x) => { x.sundayRequired = v; if (v > x.maxSimultaneous) x.maxSimultaneous = v; })} />
              </Field>
              <Field label="Colaboradores no feriado" hint="Feriados com a academia aberta.">
                <CountChoice hourly={hourly} max={d.headcount} value={d.holidayRequired} ariaLabel={`Colaboradores no feriado – ${name}`}
                  onChange={(v) => set((x) => { x.holidayRequired = v; if (v > x.maxSimultaneous) x.maxSimultaneous = v; })} />
              </Field>
            </div>
            {d.saturdayRequired >= 2 && d.headcount === 3 && (
              <p className="note">
                Com 3 colaboradores e 2 no sábado, sobra menos gente nos dias úteis. Em semanas com feriado
                {(config.noOffWeekdays ?? []).length ? ' ou com dia sem folga' : ''} pode ficar um dia com uma pessoa só, sem cobrir abertura e fechamento.
                Se a escala apontar esse conflito, use 1 no sábado nessas semanas (exceção no calendário) ou aumente a equipe.
              </p>
            )}
            {removable && <p className="form-error">Há {d.employees.length} colaboradores cadastrados. Remova um nas pessoas cadastradas.</p>}
            <div className="grid-2">
              <div>
                <h3>{d.saturdayRequired >= 2 ? 'Turno de sábado — 1º colaborador' : 'Turno de sábado'}</h3>
                <ShiftEditor breakRules={config.labor.breakRules} shift={d.saturdayShift} onChange={(s) => set((x) => { x.saturdayShift = s; })} />
              </div>
              {d.saturdayRequired >= 2 && (
                <div>
                  <h3>Turno de sábado — 2º colaborador</h3>
                  <ShiftEditor breakRules={config.labor.breakRules} shift={d.saturdayShift2 ?? d.saturdayShift} onChange={(s) => set((x) => { x.saturdayShift2 = s; })} />
                  <p className="field-hint">O 1º turno fica com quem vem antes na ordem abertura, intermediário, fechamento; o outro colaborador do sábado faz este horário.</p>
                </div>
              )}
              <div>
                <h3>Turno de domingo</h3>
                <ShiftEditor breakRules={config.labor.breakRules} shift={d.sundayShift} onChange={(s) => set((x) => { x.sundayShift = s; })} />
              </div>
              {hasOpenHoliday && (
                <div>
                  <h3>Turno de feriado</h3>
                  <ShiftEditor breakRules={config.labor.breakRules} shift={d.holidayShift} onChange={(s) => set((x) => { x.holidayShift = s; })} />
                </div>
              )}
            </div>
            {risks.filter((r) => r.dept === id).length > 0 && (
              <div className="banner warn" role="alert">
                <strong>Carga horária acima do limite com estes turnos:</strong>
                <ul>{risks.filter((r) => r.dept === id).map((r, i) => <li key={i}>{r.message}</li>)}</ul>
                O gerador evitará escalar essas combinações. Se não houver alternativa, a semana fica como conflito crítico. Para resolver, reduza o turno de fim de semana ou o horário habitual.
              </div>
            )}
            <div className="stack-sm">
              {!hourly && (
                <div className="dept-cover-rule">
                  <h4>Cobertura nas folgas (quando não há nome escolhido)</h4>
                  <CoverPicker label="Quando quem abre folga, a abertura é coberta por:" options={[['intermediario', 'Intermediário manhã'], ['intermediario_noite', 'Intermediário noite'], ['fechamento', 'Fechamento']]}
                    value={d.openingCoverKinds} onChange={(v) => set((x) => { x.openingCoverKinds = v; })} />
                  <CoverPicker label="Quando quem fecha folga, o fechamento é coberto por:" options={[['intermediario_noite', 'Intermediário noite'], ['intermediario', 'Intermediário manhã'], ['abertura', 'Abertura']]}
                    value={d.closingCoverKinds} onChange={(v) => set((x) => { x.closingCoverKinds = v; })} />
                  <p className="field-hint">Quem cobre cada pessoa pelo nome fica em Pessoas, nos detalhes de cada um.</p>
                </div>
              )}
              <Toggle checked={d.allowExtraOffDays} onChange={(v) => set((x) => { x.allowExtraOffDays = v; })}
                label="Permitir folga adicional quando necessário"
                hint="O gerador pode conceder uma 3ª folga na semana para cumprir regras obrigatórias. Reduz a carga semanal e gera alerta." />
            </div>
          </div>
        );
      })}
    </div>
  );
}

type Regime = '5x2' | 'fds' | 'fixos';
const REGIME_HINT: Record<Regime, string> = {
  '5x2': '5 dias de trabalho e 2 folgas por semana, distribuídas pelo gerador.',
  fds: 'Fora do 5x2: não é escalado nos dias úteis e usa os turnos de sábado, domingo e feriado do departamento. Confirme com o sócio-operador a regra de folga aos domingos para este regime.',
  fixos: 'Fora do 5x2: trabalha sempre nos dias marcados, no horário abaixo — inclusive sábado e domingo, se marcados. Ex.: seg, qua e sex, 2h por dia.',
};

export function EmployeeCard({ emp, index, label = 'Colaborador', breakRules, onChange, onRemove, onReplace, compact = false }: {
  emp: Employee; index: number; label?: string; breakRules: BreakRule[]; onChange: (fn: (e: Employee) => void) => void; onRemove?: () => void; onReplace?: () => void;
  /** Dentro da lista de pessoas: sem cabeçalho, nome e turno (já estão na linha). */
  compact?: boolean;
}) {
  const blocked = ALL_WEEKDAYS.filter((w) => !emp.availableWeekdays.includes(w));
  const regime: Regime = emp.fixedDays?.length || emp.fixedDays ? 'fixos' : emp.weekendOnly ? 'fds' : '5x2';
  return (
    <div className={`${compact ? 'employee-details' : 'card employee'} ${emp.active ? '' : 'inactive'}`} id={compact ? undefined : `emp-${emp.id}`}>
      {!compact && <div className="card-head">
        <h3>{label} {index + 1}{emp.name.trim() ? ` — ${emp.name}` : ''}</h3>
        <div className="row">
          {onReplace && <button type="button" className="btn ghost small" onClick={onReplace}>Substituir</button>}
          {onRemove && <button type="button" className="btn ghost small" onClick={onRemove}>Remover</button>}
        </div>
      </div>}
      {!compact && <div className="grid-3">
        <Field label="Nome completo" className="span-2">
          <input className="input" value={emp.name} onChange={(e) => onChange((x) => { x.name = e.target.value; })} placeholder="Nome do colaborador" />
        </Field>
        <Field label="Turno principal">
          <select className="input" value={emp.kind} onChange={(e) => onChange((x) => { x.kind = e.target.value as ShiftKind; })}>
            {(Object.keys(SHIFT_KIND_LABEL) as ShiftKind[]).map((k) => <option key={k} value={k}>{SHIFT_KIND_LABEL[k]}</option>)}
          </select>
        </Field>
      </div>}
      <Field label="Regime de trabalho" hint={REGIME_HINT[regime]}>
        <Segmented ariaLabel="Regime de trabalho" value={regime} onChange={(v) => onChange((x) => {
          x.weekendOnly = v === 'fds' || undefined;
          x.fixedDays = v === 'fixos' ? (x.fixedDays?.length ? x.fixedDays : [1, 3, 5]) : undefined;
          if (v !== 'fixos') delete x.fixedShifts;
          if (v !== '5x2') x.availableWeekdays = [...ALL_WEEKDAYS];
        })} options={[{ value: '5x2', label: '5x2' }, { value: 'fds', label: 'Só sábado, domingo e feriado' }, { value: 'fixos', label: 'Dias fixos' }]} />
      </Field>
      {regime === 'fixos' && (
        <Field label="Dias em que trabalha">
          <WeekdayPicker value={emp.fixedDays ?? []} ariaLabel="Dias em que trabalha" onChange={(v) => onChange((x) => {
            x.fixedDays = v;
            if (x.fixedShifts) x.fixedShifts = Object.fromEntries(v.map((w) => [w, x.fixedShifts![w] ?? { ...x.shift }]));
          })} />
        </Field>
      )}
      {regime === 'fixos' && (
        <Toggle checked={!!emp.fixedShifts} label="Horário diferente em cada dia" hint="Ex.: segunda 06–10 e sábado 08–12."
          onChange={(v) => onChange((x) => {
            if (v) x.fixedShifts = Object.fromEntries((x.fixedDays ?? []).map((w) => [w, { ...x.shift }]));
            else delete x.fixedShifts;
          })} />
      )}
      {regime === 'fixos' && emp.fixedShifts && (
        <div className="fixed-shifts">
          {[1, 2, 3, 4, 5, 6, 0].filter((w) => emp.fixedDays?.includes(w as Weekday)).map((w) => (
            <div key={w} className="fixed-shift-day">
              <h4>{WEEKDAY_LONG[w]}</h4>
              <ShiftEditor breakRules={breakRules} compact shift={emp.fixedShifts![w as Weekday] ?? emp.shift}
                onChange={(sh) => onChange((x) => { x.fixedShifts = { ...x.fixedShifts, [w]: sh }; })} />
            </div>
          ))}
        </div>
      )}
      {regime !== 'fds' && !(regime === 'fixos' && emp.fixedShifts) && <>
      <h4>{regime === 'fixos' ? 'Horário nos dias de trabalho' : 'Horário habitual (dias úteis)'}</h4>
      <ShiftEditor breakRules={breakRules} shift={emp.shift} onChange={(s) => onChange((x) => { x.shift = s; })} />
      <button type="button" className="link" onClick={() => onChange((x) => { x.shift = { ...SHIFT_TEMPLATES[x.kind] }; })}>
        Usar horário modelo do turno ({SHIFT_TEMPLATES[emp.kind].start}–{SHIFT_TEMPLATES[emp.kind].end})
      </button>
      </>}
      <div className="grid-3">
        <Field label="Jornada semanal planejada"><NumberInput value={emp.weeklyPlannedHours} min={1} max={60} step={0.5} suffix="h" onChange={(v) => onChange((x) => { x.weeklyPlannedHours = v; })} ariaLabel="Jornada planejada" /></Field>
        <Field label="Jornada contratada" hint="Base para horas adicionais."><NumberInput value={emp.weeklyContractedHours} min={1} max={60} step={0.5} suffix="h" onChange={(v) => onChange((x) => { x.weeklyContractedHours = v; })} ariaLabel="Jornada contratada" /></Field>
        <Field label="Situação">
          <Segmented ariaLabel="Situação" value={emp.active ? 'ativo' : 'inativo'} onChange={(v) => onChange((x) => { x.active = v === 'ativo'; })} options={[{ value: 'ativo', label: 'Ativo' }, { value: 'inativo', label: 'Inativo' }]} />
        </Field>
      </div>
      <div className="grid-2">
        {regime === '5x2' && <Field label="Nunca trabalha em" hint={blocked.length ? `O gerador nunca escala ${emp.name.trim() || 'este colaborador'} nesses dias (contam como folga). No máximo 2 dias, para cumprir o 5x2.` : 'Marque os dias da semana em que este colaborador não pode trabalhar (ex.: faculdade às terças).'}>
          <WeekdayPicker value={blocked} onChange={(v) => onChange((x) => { x.availableWeekdays = ALL_WEEKDAYS.filter((w) => !v.includes(w)); })} ariaLabel="Dias em que nunca trabalha" />
        </Field>}
        <Field label="Outras restrições (observações)">
          <textarea className="input" rows={2} value={emp.restrictionNotes} onChange={(e) => onChange((x) => { x.restrictionNotes = e.target.value; })} />
        </Field>
      </div>
      <VacationEditor emp={emp} onChange={onChange} />
    </div>
  );
}

/** Quem cobre as folgas desta pessoa: até 2 colegas, por ordem; vazio = regra do departamento. */
/**
 * Quem cobre quem, depois dos cadastros: a regra do departamento e, para cada pessoa, até 2 colegas
 * (por ordem) que assumem o turno dela nas folgas.
 */
function CoverageBox({ dept, d, rest, setRule, setEmployee, hideRule = false }: {
  dept: DeptId; d: DeptConfig; rest: number; hideRule?: boolean;
  setRule: (fn: (x: DeptConfig) => void) => void;
  setEmployee: (index: number, fn: (e: Employee) => void) => void;
}) {
  const active = d.employees.map((emp, i) => ({ emp, i })).filter((x) => x.emp.active);
  const hourly = isHourlyDept(dept);
  if (active.length < 2) return null;
  return (
    <div className="card cover-box" id={`cover-${dept}`}>
      <h3>Quem cobre quem nas folgas</h3>
      <p className="muted small">{hourly
        ? `Depois de cadastrar a equipe, escolha quem assume o horário de cada ${memberLabel(dept).toLowerCase()} nos dias de folga. Sem nome escolhido, não há troca; o sistema só confere o mínimo de presentes.`
        : 'Depois de cadastrar a equipe, defina quem assume o turno de cada pessoa quando ela folgar. Sem nome escolhido, vale a regra do departamento (abaixo) para abertura e fechamento; o intermediário fica sem troca.'}</p>
      <div className="cover-table" role="table" aria-label="Quem cobre quem">
        <div className="cover-row head" role="row">
          <span role="columnheader">Quando folgar…</span><span role="columnheader">1ª opção</span><span role="columnheader">2ª opção (se a 1ª não puder)</span>
        </div>
        {active.map(({ emp, i }) => (
          <CoveredByRow key={emp.id} emp={emp} hourly={hourly} colleagues={active.map((x) => x.emp).filter((x) => x.id !== emp.id)} onChange={(fn) => setEmployee(i, fn)} />
        ))}
      </div>
      {hideRule ? <p className="field-hint">Sem nome escolhido, vale a regra de cobertura do departamento (aba Regras dos departamentos).</p> : hourly ? <p className="field-hint">A troca só acontece se respeitar o descanso de {rest}h entre jornadas e os limites de jornada, e se não deixar nenhum horário abaixo do mínimo de presentes.</p> : <>
      <h4>Regra do departamento (quando não há nome escolhido)</h4>
      <CoverPicker label="Quando quem abre folga, a abertura é coberta por:" options={[['intermediario', 'Intermediário manhã'], ['intermediario_noite', 'Intermediário noite'], ['fechamento', 'Fechamento']]}
        value={d.openingCoverKinds} onChange={(v) => setRule((x) => { x.openingCoverKinds = v; })} />
      <CoverPicker label="Quando quem fecha folga, o fechamento é coberto por:" options={[['intermediario_noite', 'Intermediário noite'], ['intermediario', 'Intermediário manhã'], ['abertura', 'Abertura']]}
        value={d.closingCoverKinds} onChange={(v) => setRule((x) => { x.closingCoverKinds = v; })} />
      <p className="field-hint">Com dois no mesmo turno, quando um folga o outro já cobre. A troca só acontece se respeitar o descanso de {rest}h entre jornadas, os limites de jornada, e se quem cobre não deixar o próprio turno descoberto; se não der, o sistema alerta.</p>
      </>}
    </div>
  );
}

export function CoveredByRow({ emp, colleagues, hourly = false, onChange }: { emp: Employee; colleagues: Employee[]; hourly?: boolean; onChange: (fn: (e: Employee) => void) => void }) {
  const list = (emp.coveredBy ?? []).filter((id) => colleagues.some((c) => c.id === id));
  const label = (c: Employee) => `${c.name.trim() || 'Sem nome'} — ${hourly ? `${c.shift.start}–${c.shift.end}` : SHIFT_KIND_LABEL[c.kind]}`;
  const setAt = (pos: number, id: string) => onChange((x) => {
    const next = [...list];
    if (id) next[pos] = id;
    else next.splice(pos, 1);
    x.coveredBy = [...new Set(next.filter(Boolean))];
  });
  const inter = hourly || emp.kind === 'intermediario' || emp.kind === 'intermediario_noite';
  const who = emp.name.trim() || 'Sem nome';
  return (
    <div className="cover-row" role="row">
      <span role="cell"><strong>{who}</strong><small>{hourly ? '' : `${SHIFT_KIND_LABEL[emp.kind]} · `}{emp.shift.start}–{emp.shift.end}</small></span>
      <span role="cell">
        <select className="input" value={list[0] ?? ''} onChange={(e) => setAt(0, e.target.value)} aria-label={`Quem cobre ${who} – 1ª opção`}>
          <option value="">{inter ? 'Ninguém (sem troca)' : 'Regra do departamento'}</option>
          {colleagues.map((c) => <option key={c.id} value={c.id}>{label(c)}</option>)}
        </select>
      </span>
      <span role="cell">
        <select className="input" value={list[1] ?? ''} disabled={!list.length} onChange={(e) => setAt(1, e.target.value)} aria-label={`Quem cobre ${who} – 2ª opção`}>
          <option value="">{inter ? 'Ninguém' : 'Regra do departamento'}</option>
          {colleagues.filter((c) => c.id !== list[0]).map((c) => <option key={c.id} value={c.id}>{label(c)}</option>)}
        </select>
      </span>
    </div>
  );
}

/** Férias do colaborador: períodos de início e fim (valem para todos os meses em que caírem). */
export function VacationEditor({ emp, onChange }: { emp: Employee; onChange: (fn: (e: Employee) => void) => void }) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const list = [...(emp.vacations ?? [])].sort((a, b) => a.start.localeCompare(b.start));
  const valid = !!start && !!end && end >= start;
  return (
    <div className="vacations">
      <h4>Férias</h4>
      {list.length > 0 && (
        <div className="chip-list">
          {list.map((v) => (
            <span key={v.start} className="chip vac">
              {formatDateBr(v.start)} a {formatDateBr(v.end)}
              <button type="button" aria-label={`Remover férias de ${formatDateBr(v.start)}`}
                onClick={() => onChange((x) => { x.vacations = (x.vacations ?? []).filter((y) => y.start !== v.start); })}>×</button>
            </span>
          ))}
        </div>
      )}
      <div className="row wrap end">
        <Field label="Início"><input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} aria-label="Início das férias" /></Field>
        <Field label="Fim"><input className="input" type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} aria-label="Fim das férias" /></Field>
        <button type="button" className="btn ghost" disabled={!valid} onClick={() => {
          onChange((x) => { x.vacations = [...(x.vacations ?? []).filter((y) => y.end < start || y.start > end), { start, end }]; });
          setStart('');
          setEnd('');
        }}>Adicionar férias</button>
      </div>
      <p className="field-hint">Nos dias de férias o colaborador não é escalado. Na semana em que as férias começam ou terminam, a folga é proporcional aos dias trabalhados. Se faltar gente, os dias descobertos aparecem como conflito para você resolver.</p>
    </div>
  );
}

export function StepColaboradores({ config, update, cadastro = false }: StepProps & { /** Tela do cadastro da equipe da unidade (sem as opções de cada escala). */ cadastro?: boolean }) {
  const [confirmReplace, setConfirmReplace] = useState<{ dept: DeptId; index: number } | null>(null);
  return (
    <div className="stack">
      {cadastro ? <p className="muted">Quem trabalha na unidade, com horário, regime, férias e quem cobre quem.</p> : <p className="muted">Preencha um departamento de cada vez. Os horários vêm de um modelo por turno: confirme os reais de cada pessoa.</p>}
      {DEPARTMENTS.filter((x) => teamDepts(config).includes(x.id)).map(({ id: dept, name }) => {
        const d = config.departments[dept];
        const enabled = true;
        const named = d.employees.filter((e) => e.name.trim().length >= 2).length;
        const fora = !cadastro && !deptEnabled(config, dept);
        return (
          <section key={dept} id={`team-${dept}`} className="team-section" aria-label={`Equipe – ${name}`}>
            <div className="team-head">
              <h2>{name}</h2>
              <span className={`tag ${named === d.headcount ? 'ok' : ''}`}>{named} de {d.headcount} preenchido(s)</span>
              {isHourlyDept(dept) && named === 0 && <span className="muted small">{cadastro ? 'Sem ninguém com nome, não entra nas escalas (deixe em branco se a unidade não tiver).' : fora ? 'Sem ninguém com nome: não entra nesta escala.' : ''}</span>}
            </div>
            {!enabled ? null : (
              <div className="stack">
                {d.employees.map((emp, i) => (
                  <EmployeeCard
                    key={emp.id}
                    emp={emp}
                    index={i}
                    label={memberLabel(dept)}
                    breakRules={config.labor.breakRules}
                    onChange={(fn) => update((c) => fn(c.departments[dept].employees[i]))}
                    onReplace={() => setConfirmReplace({ dept, index: i })}
                    onRemove={d.employees.length > minTeamSize(dept) ? () => update((c) => {
                      const x = c.departments[dept];
                      x.employees.splice(i, 1);
                      x.headcount = Math.max(minTeamSize(dept), x.employees.length) as Headcount;
                    }) : undefined}
                  />
                ))}
                {d.employees.length < maxTeamSize(dept) && (
                  <button type="button" className="btn ghost" onClick={() => update((c) => {
                    const x = c.departments[dept];
                    x.employees.push(dept === 'estagiarios' ? newIntern() : newEmployee(dept, defaultKindForSlot(x.employees.length)));
                    x.headcount = x.employees.length as Headcount;
                    // Com 5 pessoas, 2 simultâneas não comportam a jornada de todos nos dias úteis.
                    if (x.employees.length === 5 && x.maxSimultaneous < 3) x.maxSimultaneous = 3;
                  })}>+ Adicionar {memberLabel(dept).toLowerCase()} em {name}</button>
                )}
                  <CoverageBox dept={dept} d={d} rest={config.labor.minInterJourneyRestHours} hideRule={cadastro}
                    setRule={(fn) => update((c) => fn(c.departments[dept]))}
                    setEmployee={(i, fn) => update((c) => fn(c.departments[dept].employees[i]))} />
              </div>
            )}
          </section>
        );
      })}
      {confirmReplace !== null && (
        <Modal
          title="Substituir colaborador"
          onClose={() => setConfirmReplace(null)}
          footer={<>
            <button type="button" className="btn ghost" onClick={() => setConfirmReplace(null)}>Cancelar</button>
            <button type="button" className="btn primary" onClick={() => {
              const { dept, index } = confirmReplace;
              update((c) => {
                const old = c.departments[dept].employees[index];
                const fresh = newEmployee(dept, old.kind, old.weeklyPlannedHours);
                fresh.shift = { ...old.shift };
                c.departments[dept].employees[index] = fresh;
              });
              setConfirmReplace(null);
            }}>Substituir</button>
          </>}
        >
          <p>O colaborador será substituído por um novo cadastro com o mesmo turno e horário. Preencha o nome e confira os demais dados. Se a escala já foi gerada, gere novamente.</p>
        </Modal>
      )}
    </div>
  );
}

export function StepJornada({ config, update, cadastro = false, readOnly = false }: StepProps & {
  /** No cadastro da unidade: sem a compensação de feriado (que é do gestor, em cada mês) e sem a vigência. */
  cadastro?: boolean;
  /** Gestor de unidade: vê as regras, mas só o Dono e o Master mudam. */
  readOnly?: boolean;
}) {
  const l = config.labor;
  const set = (fn: (x: typeof l) => void) => update((c) => fn(c.labor));
  return (
    <fieldset className="plain-fieldset stack" disabled={readOnly}>
      {readOnly && <div className="banner info left">Regras de jornada definidas pela rede. Só o Dono e o Master podem mudar; se a convenção da sua cidade for diferente, fale com eles.</div>}
      <div className="card">
        <h2>Parâmetros de jornada</h2>
        <p className="muted">Limite semanal de 42h e jornada de 8h24min são fixos para toda a rede. Os demais limites devem ser validados pelo sócio-operador.</p>
        <div className="grid-3">
          <Field label="Limite semanal" hint="Fixo para toda a rede."><input className="input" readOnly value={`${l.weeklyLimitHours} horas por semana`} aria-label="Limite semanal" /></Field>
          <Field label="Limite diário (crítico acima)"><NumberInput value={l.dailyLimitHours} min={1} max={24} step={0.5} suffix="h" onChange={(v) => set((x) => { x.dailyLimitHours = v; })} ariaLabel="Limite diário" /></Field>
          <Field label="Jornada diária normal" hint="Fixa para toda a rede: 42h em 5 dias, autorizada até 2028. Acima disso, horas adicionais."><input className="input" readOnly value="8h24min por dia" aria-label="Jornada diária normal" /></Field>
          <Field label="Intervalo mínimo entre jornadas"><NumberInput value={l.minInterJourneyRestHours} min={0} max={24} step={0.5} suffix="h" onChange={(v) => set((x) => { x.minInterJourneyRestHours = v; })} ariaLabel="Intervalo entre jornadas" /></Field>
        </div>
        <h3>Intervalo intrajornada</h3>
        <p className="field-hint">Padrão da CLT (art. 71): acima de 4h e até 6h de trabalho, 15 min de intervalo; acima de 6h, 1 hora. Até 4h não precisa de intervalo. Se a convenção da unidade for diferente, ajuste aqui: vale para todos os turnos e alertas.</p>
        <div className="grid-3">
          {l.breakRules.map((r, i) => (
            <Field key={i} label={`Regra ${i + 1}: acima de ${r.aboveHours}h de trabalho`}>
              <div className="row">
                <NumberInput value={r.aboveHours} min={0} max={24} step={0.5} suffix="h:" onChange={(v) => set((x) => { x.breakRules[i].aboveHours = v; })} ariaLabel={`Regra ${i + 1} horas`} />
                <NumberInput value={r.minBreakMinutes} min={0} max={240} step={5} suffix="min" onChange={(v) => set((x) => { x.breakRules[i].minBreakMinutes = v; })} ariaLabel={`Regra ${i + 1} minutos`} />
              </div>
            </Field>
          ))}
        </div>
        <h3>Compensação</h3>
        <div className="stack-sm">
          {!cadastro && <HolidayCompensationField config={config} update={update} />}
          <Toggle checked={l.hourBankEnabled} onChange={(v) => set((x) => { x.hourBankEnabled = v; })} label="Banco de horas formalmente configurado" hint="Sem banco de horas, horas não trabalhadas nunca viram crédito da empresa; apenas horas adicionais são apontadas." />
        </div>
      </div>
      <div className="card">
        <h2>{cadastro ? 'Referência normativa' : 'Vigência e referência normativa'}</h2>
        {!cadastro && <div className="grid-3">
          <Field label="Início da vigência destas regras"><input className="input" type="date" value={l.effectiveFrom} onChange={(e) => set((x) => { x.effectiveFrom = e.target.value; })} /></Field>
        </div>}
        <Field label="Referência normativa" hint="Somente leitura."><textarea className="input" rows={3} value={l.normativeReference} readOnly /></Field>
      </div>
      <div className="card">
        <h2>Como as horas são tratadas</h2>
        <dl className="definitions">
          <dt>Limite legal configurado</dt><dd>{formatDuration(l.weeklyLimitHours * 60)} por semana — acima disso o alerta é crítico.</dd>
          <dt>Jornada contratada</dt><dd>Informada por colaborador; base para apontar horas adicionais.</dd>
          <dt>Jornada planejada</dt><dd>Informada por colaborador; base para o alerta de carga abaixo da planejada.</dd>
          <dt>Jornada efetivamente escalada</dt><dd>Calculada dia a dia: saída − entrada − intervalo, somada por semana completa (segunda a domingo).</dd>
          <dt>Horas adicionais</dt><dd>Escalado acima do contratado (diário acima da jornada normal ou semanal acima da contratada).</dd>
          <dt>Saldo de compensação</dt><dd>{l.hourBankEnabled ? 'Exibido porque o banco de horas está configurado.' : 'Não exibido: não há banco de horas formalmente configurado.'}</dd>
        </dl>
      </div>
    </fieldset>
  );
}

/** Trabalho em feriado: folga compensatória ou pagamento (escolha do gestor, em cada escala). */
export function HolidayCompensationField({ config, update }: StepProps) {
  return (
    <>
    <Toggle checked={config.labor.holidayCountsAsRest !== false} onChange={(v) => update((c) => { c.labor.holidayCountsAsRest = v; })}
      label="O feriado conta como folga"
      hint="Quem folga no feriado (segunda a sexta) precisa de só mais 1 folga na semana e trabalha os 5 dias. O gerador coloca a folga no feriado sempre que a cobertura permite." />
    <Field label="Trabalho em feriado" hint="Lei 605/1949, art. 9º: o trabalho em feriado é pago em dobro, salvo se houver folga compensatória. Confirme a convenção coletiva.">
      <Segmented ariaLabel="Trabalho em feriado" value={config.labor.holidayWorkCompensation} onChange={(v) => update((c) => { c.labor.holidayWorkCompensation = v; })}
        options={[{ value: 'folga', label: 'Folga compensatória na mesma semana' }, { value: 'pagamento', label: 'Sem folga extra (pagamento)' }]} />
    </Field>
    </>
  );
}
