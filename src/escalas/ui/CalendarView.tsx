import type { Analysis } from '../domain/analyze';
import { formatDayMonth, WEEKDAY_LONG, WEEKDAY_SHORT } from '../domain/calendar';
import { formatDuration, formatShiftShort } from '../domain/time';

export function Legend() {
  return (
    <div className="legend" aria-label="Legenda">
      <span><b className="sw s-T" /> Trabalho (horário aparece só quando é diferente)</span>
      <span><b className="sw s-S" /> Cobrindo outro turno (com horário)</span>
      <span><b className="sw s-F" /> Folga</span>
      <span><b className="sw s-FE" /> Feriado (folga)</span>
      <span><b className="sw s-FR" /> Férias</span>
      <span><b className="sw has-alert">!</b> Alerta</span>
      <span><b className="sw hol" /> Dia de feriado</span>
    </div>
  );
}
import { deptName, isHourlyDept, offByRegime, memberLabel, SHIFT_KIND_LABEL, type DeptId, type ScheduleConfig } from '../domain/types';
import { cellCode, WEEK_CODES } from './cellCode';

/** Palavra exibida no quadro do dia. */
export function dayLabel(c: { status: string; origin: string | null }): string {
  if (c.status === 'FE') return 'Feriado';
  if (c.status === 'FR') return 'Férias';
  if (c.status !== 'T') return 'Folga';
  return c.origin === 'substituicao' ? 'Cobrindo' : 'Trabalho';
}

const LETTER_LABEL = { T: 'Trabalha', F: 'Folga', S: 'Cobrindo outro turno', FE: 'Folga de feriado', FR: 'Férias' } as const;

export function CalendarView({ analysis, config, deptId, showEdgeDays, week = null, onCell, onEmployee, onDay }: {
  analysis: Analysis;
  config: ScheduleConfig;
  deptId: DeptId;
  showEdgeDays: boolean;
  /** Índice da semana exibida (visualização por semana) ou null para o mês inteiro. */
  week?: number | null;
  onCell: (empId: string, date: string) => void;
  onEmployee: (empId: string) => void;
  onDay: (date: string) => void;
}) {
  const da = analysis.depts[deptId];
  const { ctx, cells } = da.resolved;
  const { range } = analysis;
  const weekly = week !== null;
  const dayIdx = weekly
    ? range.dates.map((_, i) => i).slice(week * 7, week * 7 + 7)
    : range.dates.map((_, i) => i).filter((i) => showEdgeDays || range.inMonth(range.dates[i]));
  const weekCols = weekly ? [week] : range.weeks.map((_, w) => w);
  const limit = config.labor.weeklyLimitHours * 60;
  const weekAlert = (empId: string, w: number) =>
    analysis.alerts.some((a) => a.severity === 'critico' && WEEK_CODES.has(a.code) && a.employeeId === empId && a.date === range.weeks[w].start);

  return (
    <section className="card calendar-card" aria-label={`Escala – ${deptName(deptId)}`}>
      <div className="card-head">
        <h2>{deptName(deptId)}</h2>
        <span className="muted small">{ctx.employees.length} {isHourlyDept(deptId) ? `${deptName(deptId).toLowerCase()} · mín. ${ctx.dept.minPresent ?? 1} presente(s)` : 'colaboradores ativos'} · sáb. {ctx.dept.saturdayRequired} / dom. {ctx.dept.sundayRequired}</span>
      </div>
      <div className="table-wrap">
        <table className={`cal ${weekly ? 'week-view' : ''}`}>
          <thead>
            <tr>
              <th className="sticky-col name-col">Colaborador</th>
              {dayIdx.map((d) => {
                const w = ctx.weekdays[d];
                const edge = !range.inMonth(range.dates[d]);
                const hol = ctx.holidays[d];
                return (
                  <th key={d} className={`day ${w === 0 || w === 6 ? 'weekend' : ''} ${hol ? 'holiday' : ''} ${edge ? 'edge' : ''} ${w === 1 ? 'week-start' : ''}`}
                    title={`${WEEKDAY_LONG[w]}, ${formatDayMonth(range.dates[d])}${edge ? ' (outro mês)' : ''}${hol ? ` – feriado: ${hol.name}` : ''}${ctx.noOff[d] ? ' – folgas bloqueadas' : ''}`}>
                    <span className="wdname">{WEEKDAY_SHORT[w].slice(0, 3)}</span>
                    {weekly && <span className="ddate">{formatDayMonth(range.dates[d])}</span>}
                    {hol && <span className="hol-tag">feriado</span>}
                    {ctx.noOff[d] && <span className="nooff-tag">sem folga</span>}
                  </th>
                );
              })}
              {weekCols.map((wi) => {
                const w = range.weeks[wi];
                return (
                  <th key={w.index} className="wk" title={`Horas da semana ${formatDayMonth(w.start)} a ${formatDayMonth(w.end)}${w.partial ? ' — atravessa o mês' : ''}`}>
                    <span className="wd">{weekly ? 'Horas' : 'Semana'}</span><span className="num">{weekly ? 'semana' : `${formatDayMonth(w.start)}${w.partial ? '*' : ''}`}</span>
                  </th>
                );
              })}
              {!weekly && <>
                <th className="total"><span className="wd">Horas</span><span className="num">Mês</span></th>
                <th className="total" title="Dias trabalhados no mês"><span className="wd">Dias</span><span className="num">trab.</span></th>
                <th className="total" title="Folgas no mês"><span className="wd">Folgas</span><span className="num">mês</span></th>
              </>}
            </tr>
          </thead>
          <tbody>
            {ctx.employees.map((emp, e) => {
              const s = da.stats[e];
              return (
                <tr key={emp.id}>
                  <th className="sticky-col name-col" scope="row">
                    <button type="button" className="emp-btn" onClick={() => onEmployee(emp.id)}>
                      <strong>{emp.name || `Colaborador ${e + 1}`}</strong>
                      <span>{isHourlyDept(deptId) ? memberLabel(deptId) : SHIFT_KIND_LABEL[emp.kind]} · {formatShiftShort(emp.shift)}</span>
                    </button>
                  </th>
                  {dayIdx.map((d) => {
                    const c = cells[e][d];
                    const code = cellCode(da, e, d, analysis.alerts);
                    const w = ctx.weekdays[d];
                    const tip = [
                      `${emp.name} – ${WEEKDAY_SHORT[w]} ${formatDayMonth(range.dates[d])}`,
                      LETTER_LABEL[code.letter],
                      c.shift ? `${c.shift.start}–${c.shift.end} · ${formatDuration(c.minutes)} trabalhadas` : '',
                      c.origin === 'manual' ? 'Horário ajustado pelo gestor' : '',
                      c.locked ? 'Definido na escala do mês anterior' : '',
                      ...code.alerts.map((a) => `⚠ ${a.title}`),
                    ].filter(Boolean).join('\n');
                    return (
                      <td key={d} className={`cell s-${code.letter} ${code.alert ? 'has-alert' : ''} ${c.origin === 'manual' ? 'manual' : ''} ${c.locked ? 'locked' : ''} ${!range.inMonth(range.dates[d]) ? 'edge' : ''} ${w === 1 ? 'week-start' : ''}`}>
                        <button type="button" title={tip} aria-label={tip} onClick={() => onCell(emp.id, range.dates[d])}>
                          {!weekly && <span className="dnum">{Number(range.dates[d].slice(8))}</span>}
                          {/* No mês, dia de trabalho normal fica limpo: só o número. */}
                          {(weekly || code.letter !== 'T') && <span className="lbl">{c.status === 'F' && offByRegime(emp, w) ? '—' : dayLabel(c)}</span>}
                          {c.status === 'T' && (weekly || c.origin !== 'habitual') && <span className="tm">{formatShiftShort(c.shift!)}</span>}
                          {code.alert && <span className="a-mark" aria-hidden="true">!</span>}
                        </button>
                      </td>
                    );
                  })}
                  {weekCols.map((w) => ({ m: s.weekMinutes[w], w })).map(({ m, w }) => (
                    <td key={w} className={`wk-total ${m > limit || weekAlert(emp.id, w) ? 'over' : ''}`} title={`Semana ${w + 1}: ${formatDuration(m)} escaladas · limite ${formatDuration(limit)} · saldo ${formatDuration(limit - m)} · planejada ${formatDuration(s.weekPlanned[w])}`}>
                      {formatDuration(m)}
                    </td>
                  ))}
                  {!weekly && <>
                    <td className="total strong">{formatDuration(s.monthMinutes)}</td>
                    <td className="total">{s.workedDays}</td>
                    <td className="total">{s.offDays}{s.holidayDays ? `+${s.holidayDays}` : ''}</td>
                  </>}
                </tr>
              );
            })}
            <tr className="summary-row">
              <th className="sticky-col name-col" scope="row">Equipe no dia</th>
              {dayIdx.map((d) => {
                const req = ctx.requiredStaff[d];
                const count = da.dailyCounts[d];
                const ex = ctx.staffException[d] || ctx.simultaneousException[d];
                const bad = req !== null && count !== req;
                return (
                  <td key={d} className={`${bad ? 'bad' : ''} ${ex ? 'exception' : ''} ${ctx.weekdays[d] === 1 ? 'week-start' : ''} ${!range.inMonth(range.dates[d]) ? 'edge' : ''}`}>
                    <button type="button" onClick={() => onDay(range.dates[d])} title={`${count} trabalhando${req !== null ? ` (exigido ${req})` : ''}${ex ? ' · exceção autorizada' : ''} — clique para registrar exceção`}>
                      {count}{ex ? '*' : ''}
                    </button>
                  </td>
                );
              })}
              <td colSpan={weekCols.length + (weekly ? 0 : 3)} className="muted small">* exceção autorizada</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
