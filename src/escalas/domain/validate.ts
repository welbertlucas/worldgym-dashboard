// Regras de validação: produzem alertas críticos, de atenção e informativos.
// As mesmas funções são usadas pelo gerador (para pontuar alternativas) e pelo painel.

import { formatDayMonth, WEEKDAY_SHORT } from './calendar';
import {
  coversClosing, coversOpening, peakConcurrency, restBetween, type DeptContext, type ResolvedDept,
} from './resolve';
import { breakMinutes, formatClock, formatDuration, requiredBreakMinutes, sameShift, type ShiftSpan } from './time';
import { deptHourLimits, deptName, isIntermediate, outside5x2, hoursOnlyShown, isHourlyDept, memberLabel, SHIFT_KIND_LABEL, type Alert, type Severity } from './types';

export const dayLabel = (ctx: DeptContext, d: number) => `${WEEKDAY_SHORT[ctx.weekdays[d]]} ${formatDayMonth(ctx.dates[d])}`;
export const empName = (ctx: DeptContext, e: number) => ctx.employees[e].name.trim() || `Colaborador ${e + 1}`;

function alert(
  severity: Severity, code: string, ctx: DeptContext, parts: { e?: number; d?: number; key?: string; title: string; message: string; suggestion: string },
): Alert {
  const emp = parts.e !== undefined ? ctx.employees[parts.e] : undefined;
  const date = parts.d !== undefined ? ctx.dates[parts.d] : undefined;
  return {
    id: [code, ctx.deptId, emp?.id ?? '', date ?? '', parts.key ?? ''].join('|'),
    severity,
    code,
    dept: ctx.deptId,
    employeeId: emp?.id,
    employeeName: parts.e !== undefined ? empName(ctx, parts.e) : undefined,
    date,
    title: parts.title,
    message: parts.message,
    suggestion: parts.suggestion,
  };
}

const outsideMonthNote = (ctx: DeptContext, d: number) => (ctx.range.inMonth(ctx.dates[d]) ? '' : ' (dia de outro mês, na mesma semana)');

/** Alertas de um dia: cobertura, simultâneos, fim de semana, intervalos, disponibilidade. */
export function dayAlerts(res: ResolvedDept, d: number, out: Alert[]): void {
  const { ctx, cells } = res;
  const { labor } = ctx.config;
  const n = ctx.employees.length;
  if (!n) return; // departamento desligado
  const hourly = isHourlyDept(ctx.deptId);
  if (cells.every((row) => row[d].locked)) return; // pertence à escala do mês anterior
  const op = ctx.operating[d];
  const label = dayLabel(ctx, d) + outsideMonthNote(ctx, d);
  const working: number[] = [];
  for (let e = 0; e < n; e++) if (cells[e][d].status === 'T') working.push(e);
  if (ctx.noOff[d])
    for (let e = 0; e < n; e++)
      if (cells[e][d].status === 'F' && !cells[e][d].locked && !ctx.unavailable[e][d])
        out.push(alert('critico', 'FOLGA_BLOQUEADA', ctx, {
          e, d, title: 'Folga em dia bloqueado',
          message: `${empName(ctx, e)} está de folga em ${label}, dia em que o gestor bloqueou as folgas.`,
          suggestion: 'Mude a folga para outro dia da semana ou retire o bloqueio em Dias sem folga (aba Mês).',
        }));

  if (!op) {
    for (const e of working)
      out.push(alert('critico', 'TRABALHO_DIA_FECHADO', ctx, {
        e, d, title: 'Escalado com a academia fechada',
        message: `${empName(ctx, e)} está escalado em ${label}, dia em que a academia não funciona${ctx.holidays[d]?.closed ? ` (feriado: ${ctx.holidays[d]!.name})` : ''}.`,
        suggestion: 'Marque o dia como folga ou revise o horário de funcionamento/feriado.',
      }));
  } else {
    const spans = working.map((e) => cells[e][d].span!);
    const subs = res.substitutions.filter((s) => s.dateIndex === d);
    const blockedText = (role: 'abertura' | 'fechamento') => {
      const ev = subs.find((s) => s.role === role);
      if (!ev || ev.outcome === 'aplicada') return '';
      if (ev.outcome === 'sem_candidato') return ' Nenhum colaborador marcado para cobrir este turno está trabalhando neste dia.';
      return ' Substituição não aplicada automaticamente: ' + ev.blocked
        .map((b) => `${ctx.employees.find((x) => x.id === b.empId)?.name || 'intermediário'} — ${b.reasons.join('; ')}`)
        .join(' | ') + '.';
    };
    const offNames = ctx.employees.filter((_, e) => cells[e][d].status === 'F').map((x) => x.name || 'colaborador');
    const altText = offNames.length ? ` Alternativas: escalar ${offNames.join(' ou ')} neste dia (trocando a folga para outro dia da semana), ajustar o horário manualmente ou rever a regra que bloqueou a troca.` : ' Alternativas: ajustar o horário manualmente ou trocar folgas na semana.';
    if (hourly) {
      // Professores: mínimo presente durante todo o funcionamento.
      const gaps = presenceGaps(spans, op.start, op.end, ctx.dept.minPresent ?? 1);
      if (gaps.length)
        out.push(alert('critico', 'PROFESSOR_DESCOBERTO', ctx, {
          d, title: `Horário sem o mínimo de ${deptName(ctx.deptId).toLowerCase()}`,
          message: `${label}: menos de ${ctx.dept.minPresent ?? 1} ${memberLabel(ctx.deptId).toLowerCase()}(es) presente(s) ${gaps.map(([a, b]) => `das ${formatClock(a)} às ${formatClock(b)}`).join(', ')}.`,
          suggestion: `Troque folgas para que haja professores nesses horários ou ajuste os horários habituais.${altText}`,
        }));
    }
    if (!hourly && !spans.some((s) => coversOpening(s, op)))
      out.push(alert('critico', 'ABERTURA_DESCOBERTA', ctx, {
        d, title: 'Abertura sem cobertura',
        message: `${label}: ninguém inicia às ${formatClock(op.start)}.${blockedText('abertura')}`,
        suggestion: `Garanta um colaborador na abertura.${altText}`,
      }));
    if (!hourly && !spans.some((s) => coversClosing(s, op)))
      out.push(alert('critico', 'FECHAMENTO_DESCOBERTO', ctx, {
        d, title: 'Fechamento sem cobertura',
        message: `${label}: ninguém permanece até ${formatClock(op.end)}.${blockedText('fechamento')}`,
        suggestion: `Garanta um colaborador no fechamento.${altText}${ctx.dept.closingCoverKinds.length ? '' : ' Se aplicável, ative a cobertura do fechamento nas regras do departamento (cadastro da unidade).'}`,
      }));

    const peak = peakConcurrency(spans);
    if (peak.count > ctx.maxSimultaneous[d])
      out.push(alert('critico', 'SIMULTANEOS_EXCEDIDO', ctx, {
        d, title: 'Colaboradores simultâneos acima do máximo',
        message: `${label}: ${peak.count} colaboradores ao mesmo tempo entre ${formatClock(peak.from)} e ${formatClock(peak.to)} (máximo ${ctx.maxSimultaneous[d]}).`,
        suggestion: 'Troque uma folga para este dia, ajuste horários para reduzir a sobreposição ou registre uma exceção autorizada pelo gestor.',
      }));

    const req = ctx.requiredStaff[d];
    if (req !== null && working.length !== req) {
      const fewer = working.length < req;
      const hol = ctx.holidayOpen[d];
      const what = hol ? `Feriado (${ctx.holidays[d]!.name})` : WEEKDAY_SHORT[ctx.weekdays[d]];
      const code = hol ? (fewer ? 'FERIADO_SEM_COBERTURA' : 'FERIADO_EXCEDIDO') : fewer ? 'FIM_SEMANA_SEM_COBERTURA' : 'FIM_SEMANA_EXCEDIDO';
      out.push(alert('critico', code, ctx, {
        d, title: fewer ? `${what} sem o colaborador necessário` : `${what} acima do limite`,
        message: `${label}: ${working.length} colaborador(es) escalado(s); exigido exatamente ${req}${ctx.staffException[d] ? ' (exceção autorizada)' : ''}.`,
        suggestion: fewer
          ? 'Escale um colaborador disponível neste dia e compense com uma folga em dia útil.'
          : 'Mantenha apenas o número configurado de colaboradores ou registre uma exceção autorizada.',
      }));
    }

    // Lacunas no meio do expediente (abertura/fechamento já são críticos).
    const sorted = [...spans].sort((a, b) => a.start - b.start);
    let reach = op.start;
    for (const s of hourly ? [] : sorted) {
      if (s.start > reach && reach > op.start && s.start < op.end)
        out.push(alert('atencao', 'LACUNA_COBERTURA', ctx, {
          d, key: String(reach), title: 'Período sem cobertura',
          message: `${label}: ninguém do departamento entre ${formatClock(reach)} e ${formatClock(s.start)}.`,
          suggestion: 'Ajuste horários ou troque folgas para cobrir o período.',
        }));
      reach = Math.max(reach, s.end);
    }

    for (const ev of subs.filter((s) => s.outcome === 'aplicada')) {
      const se = ctx.employees.findIndex((x) => x.id === ev.substituteId);
      const absentNames = ev.absentIds.map((id) => ctx.employees.find((x) => x.id === id)?.name || 'titular').join(', ');
      out.push(alert('atencao', 'SUBSTITUICAO_TURNO', ctx, {
        e: se, d, key: ev.role, title: 'Substituição de turno',
        message: `${label}: ${empName(ctx, se)} (${isHourlyDept(ctx.deptId) ? memberLabel(ctx.deptId).toLowerCase() : SHIFT_KIND_LABEL[ctx.employees[se].kind].toLowerCase()}) cobre ${isHourlyDept(ctx.deptId) ? 'o horário' : ev.role === 'abertura' ? 'a abertura' : ev.role === 'fechamento' ? 'o fechamento' : `o ${SHIFT_KIND_LABEL[ev.role].toLowerCase()}`} no lugar de ${absentNames}, das ${ev.newShift.start} às ${ev.newShift.end}.`,
        suggestion: 'Confirme a troca com o colaborador. Descanso, jornada e simultâneos já foram verificados.',
      }));
      const otherInter = ctx.employees.some((x, e) => e !== se && isIntermediate(x.kind) && cells[e][d].status === 'T' && cells[e][d].origin !== 'substituicao');
      if (isIntermediate(ctx.employees[se].kind) && !otherInter)
        out.push(alert('atencao', 'INTERMEDIARIO_DESCOBERTO', ctx, {
          d, key: ev.role, title: 'Turno intermediário sem cobertura após substituição',
          message: `${label}: com a troca, ninguém cumpre o horário intermediário (${ctx.employees[se].shift.start}–${ctx.employees[se].shift.end}).`,
          suggestion: 'Avalie se a cobertura do horário de pico está adequada; se necessário, troque a folga de outro colaborador.',
        }));
    }
  }

  for (const e of working) {
    const c = cells[e][d];
    const emp = ctx.employees[e];
    if (ctx.unavailable[e][d])
      out.push(alert('critico', 'INDISPONIVEL', ctx, {
        e, d, title: 'Escalado em dia indisponível',
        message: `${empName(ctx, e)} não pode trabalhar em ${label} (restrição de disponibilidade).`,
        suggestion: 'Marque folga neste dia e escale outro colaborador.',
      }));
    if (ctx.vacation[e][d])
      out.push(alert('critico', 'TRABALHO_FERIAS', ctx, {
        e, d, title: 'Escalado durante as férias',
        message: `${empName(ctx, e)} está escalado em ${label}, dia em que está de férias.`,
        suggestion: 'Regere a escala ou marque o dia como férias.',
      }));
    const dailyLimit = deptHourLimits(ctx.deptId)?.daily ?? labor.dailyLimitHours;
    if (c.minutes > dailyLimit * 60)
      out.push(alert('critico', 'LIMITE_DIARIO', ctx, {
        e, d, title: 'Jornada diária acima do limite',
        message: `${empName(ctx, e)} em ${label}: ${formatDuration(c.minutes)} efetivas (limite ${dailyLimit}h${deptHourLimits(ctx.deptId) ? ', Lei do Estágio' : ''}).`,
        suggestion: 'Reduza o horário do dia.',
      }));
    else if (c.minutes > labor.dailyNormalHours * 60 && !isHourlyDept(ctx.deptId))
      out.push(alert('atencao', 'HORAS_ADICIONAIS_DIA', ctx, {
        e, d, title: 'Horas adicionais no dia',
        message: `${empName(ctx, e)} em ${label}: ${formatDuration(c.minutes)} efetivas (jornada normal ${labor.dailyNormalHours}h; +${formatDuration(c.minutes - labor.dailyNormalHours * 60)}).`,
        suggestion: 'Verifique se há autorização para horas adicionais ou ajuste o horário.',
      }));
    const brk = breakMinutes(c.shift!);
    const reqBrk = requiredBreakMinutes(c.minutes, labor.breakRules);
    if (brk < reqBrk)
      out.push(alert('critico', 'INTERVALO_INSUFICIENTE', ctx, {
        e, d, title: 'Intervalo intrajornada insuficiente',
        message: `${empName(ctx, e)} em ${label}: ${formatDuration(c.minutes)} de trabalho com ${brk} min de intervalo; a regra de jornada pede ${reqBrk} min.`,
        suggestion: `Inclua ${reqBrk} min de intervalo ${c.origin === 'fimDeSemana' ? (ctx.weekdays[d] === 6 ? 'no turno de sábado (regras do departamento)' : 'no turno de domingo (regras do departamento)') : c.origin === 'feriado' ? 'no turno de feriado (regras do departamento)' : c.origin === 'manual' ? 'no horário ajustado deste dia' : 'no horário habitual da pessoa (cadastro da unidade)'}. Se a convenção da unidade tiver outra regra, o Dono ou o Master ajustam o intervalo nas regras de jornada.`,
      }));
    if (c.origin === 'manual') {
      const w = ctx.weekdays[d];
      const reference = ctx.holidayOpen[d] ? ctx.dept.holidayShift : emp.fixedDays?.includes(w) ? emp.fixedShifts?.[w] ?? emp.shift : w === 6 ? ctx.dept.saturdayShift : w === 0 ? ctx.dept.sundayShift : emp.shift;
      if (!sameShift(c.shift, reference))
        out.push(alert('atencao', 'HORARIO_DIFERENTE', ctx, {
          e, d, title: 'Jornada diferente do horário habitual',
          message: `${empName(ctx, e)} em ${label}: ${c.shift!.start}–${c.shift!.end} (habitual ${reference.start}–${reference.end}).`,
          suggestion: 'Confirme a alteração com o colaborador.',
        }));
    }
    if (op && (c.span!.start < op.start || c.span!.end > op.end))
      out.push(alert('atencao', 'FORA_DO_FUNCIONAMENTO', ctx, {
        e, d, title: 'Jornada fora do horário de funcionamento',
        message: `${empName(ctx, e)} em ${label}: ${c.shift!.start}–${c.shift!.end}, academia funciona ${formatClock(op.start)}–${formatClock(op.end)}.`,
        suggestion: 'Ajuste o horário ou confirme a necessidade (ex.: preparação antes da abertura).',
      }));
    if (op && ctx.holidays[d] && !ctx.holidays[d]!.closed)
      out.push(alert('info', 'TRABALHO_FERIADO', ctx, {
        e, d, title: 'Trabalho em feriado',
        message: `${empName(ctx, e)} trabalha em ${label} (feriado: ${ctx.holidays[d]!.name}), das ${c.shift!.start} às ${c.shift!.end}.`,
        suggestion: labor.holidayWorkCompensation === 'folga'
          ? 'Folga compensatória prevista na mesma semana. Confirme a regra da convenção coletiva.'
          : 'Sem folga compensatória: confirme o pagamento conforme a lei e a convenção coletiva.',
      }));
  }
}

/** Descanso mínimo entre jornadas nos pares de dias consecutivos [from-1 → from ... to]. */
export function restAlerts(res: ResolvedDept, from: number, to: number, out: Alert[]): void {
  const { ctx, cells } = res;
  const min = ctx.config.labor.minInterJourneyRestHours * 60;
  for (let e = 0; e < ctx.employees.length; e++) {
    for (let d = Math.max(1, from); d <= to; d++) {
      const a = cells[e][d - 1];
      const b = cells[e][d];
      if (!a?.span || !b?.span || (a.locked && b.locked)) continue;
      const rest = restBetween(a.span, b.span);
      if (rest < min)
        out.push(alert('critico', 'DESCANSO_ENTRE_JORNADAS', ctx, {
          e, d, title: 'Intervalo entre jornadas insuficiente',
          message: `${empName(ctx, e)}: ${formatDuration(rest)} de descanso entre ${dayLabel(ctx, d - 1)} (saída ${a.shift!.end}) e ${dayLabel(ctx, d)} (entrada ${b.shift!.start}); mínimo ${ctx.config.labor.minInterJourneyRestHours}h.`,
          suggestion: 'Troque a folga para um destes dias ou ajuste o horário de entrada/saída.',
        }));
    }
  }
}

export interface WeekTotals {
  minutes: number;
  workDays: number;
  offDays: number;
  /** Folgas de feriado (FE). */
  holidayDays: number;
  /** Feriados em dias úteis (seg–sex) na semana. */
  weekdayHolidays: number;
  /** Feriados em dias úteis trabalhados pelo colaborador. */
  weekdayHolidaysWorked: number;
  /** Dias de férias na semana. */
  vacationDays: number;
}

export const isWeekdayHoliday = (ctx: DeptContext, d: number) => !!ctx.holidays[d] && ctx.weekdays[d] !== 0 && ctx.weekdays[d] !== 6;

export function weekTotals(res: ResolvedDept, e: number, weekIdx: number): WeekTotals {
  const t: WeekTotals = { minutes: 0, workDays: 0, offDays: 0, holidayDays: 0, weekdayHolidays: 0, weekdayHolidaysWorked: 0, vacationDays: 0 };
  for (let d = weekIdx * 7; d < weekIdx * 7 + 7; d++) {
    const c = res.cells[e][d];
    if (c.status === 'FR') { t.vacationDays++; continue; }
    if (isWeekdayHoliday(res.ctx, d)) {
      t.weekdayHolidays++;
      if (c.status === 'T') t.weekdayHolidaysWorked++;
    }
    if (c.status === 'T') {
      t.minutes += c.minutes;
      t.workDays++;
    } else if (c.status === 'FE') t.holidayDays++;
    else t.offDays++;
  }
  return t;
}

/** Máximo de dias de trabalho na semana: 5 no 5x2; com férias, os dias fora delas menos a folga proporcional. */
export function maxWorkDays(res: ResolvedDept, t: WeekTotals): number {
  const { labor } = res.ctx.config;
  if (!t.vacationDays) return labor.workDaysPerWeek;
  const days = 7 - t.vacationDays;
  return days - Math.round((labor.restDaysPerWeek * days) / 7);
}

/** Dias de trabalho esperados na semana: feriado em dia útil reduz um dia (salvo trabalho pago em feriado). */
export function targetWorkDays(res: ResolvedDept, t: WeekTotals): number {
  const { labor } = res.ctx.config;
  const paid = labor.holidayWorkCompensation === 'pagamento' ? t.weekdayHolidaysWorked : 0;
  // Feriado folgado que conta como folga não reduz os dias de trabalho; só o trabalhado, com folga compensatória.
  // (Semana que não fechou assim e ficou com as 2 folgas além do feriado segue a conta antiga.)
  if (labor.holidayCountsAsRest !== false && t.offDays < labor.restDaysPerWeek) return Math.max(0, maxWorkDays(res, t) - (labor.holidayWorkCompensation === 'folga' ? t.weekdayHolidaysWorked : 0));
  return Math.max(0, maxWorkDays(res, t) - t.weekdayHolidays + paid);
}

/** Jornada planejada da semana, proporcional quando há feriado em dia útil. */
export function plannedWeekMinutes(res: ResolvedDept, e: number, weekIdx: number): number {
  const { labor } = res.ctx.config;
  const t = weekTotals(res, e, weekIdx);
  const targetDays = targetWorkDays(res, t);
  return (res.ctx.employees[e].weeklyPlannedHours * 60 * targetDays) / labor.workDaysPerWeek;
}

export function weekAlerts(res: ResolvedDept, weekIdx: number, out: Alert[]): void {
  const { ctx } = res;
  const { labor } = ctx.config;
  const week = ctx.range.weeks[weekIdx];
  const wl = `semana ${week.index} (${formatDayMonth(week.start)}–${formatDayMonth(week.end)})`;
  // Professores horistas: as horas são só exibidas, sem limite semanal nem carga planejada.
  const hourly = isHourlyDept(ctx.deptId);
  for (let e = 0; e < ctx.employees.length; e++) {
    if (res.cells[e].slice(weekIdx * 7, weekIdx * 7 + 7).every((c) => c.locked)) continue;
    const t = weekTotals(res, e, weekIdx);
    const d0 = weekIdx * 7;
    const weeklyLimit = deptHourLimits(ctx.deptId)?.weekly ?? labor.weeklyLimitHours;
    if (!hoursOnlyShown(ctx.deptId) && t.minutes > weeklyLimit * 60)
      out.push(alert('critico', 'LIMITE_SEMANAL', ctx, {
        e, d: d0, title: 'Jornada semanal acima do limite',
        message: `${empName(ctx, e)}, ${wl}: ${formatDuration(t.minutes)} escaladas (limite ${weeklyLimit}h${deptHourLimits(ctx.deptId) ? ', Lei do Estágio' : ''}; excesso ${formatDuration(t.minutes - weeklyLimit * 60)}).`,
        suggestion: 'Reduza o horário de algum dia ou conceda folga adicional na semana.',
      }));
    const maxDays = maxWorkDays(res, t);
    if (t.workDays > maxDays)
      out.push(alert('critico', 'MODELO_5X2', ctx, {
        e, d: d0, title: 'Escala 5x2 não respeitada',
        message: `${empName(ctx, e)}, ${wl}: ${t.workDays} dias trabalhados e ${t.offDays} folga(s) (${t.vacationDays ? `semana com ${t.vacationDays} dia(s) de férias: até ${maxDays} dias de trabalho` : `modelo ${maxDays}x${7 - maxDays}`}).`,
        suggestion: 'Marque folga em um dos dias da semana.',
      }));
    if (t.weekdayHolidays > 0 && t.workDays > targetWorkDays(res, t) && t.workDays <= maxDays)
      out.push(alert('atencao', 'FERIADO_SEM_COMPENSACAO', ctx, {
        e, d: d0, title: t.weekdayHolidaysWorked ? 'Trabalho em feriado sem folga compensatória' : 'Semana com feriado sem a folga do feriado',
        message: `${empName(ctx, e)}, ${wl}: ${t.workDays} dias de trabalho numa semana com feriado (esperado ${targetWorkDays(res, t)}${t.weekdayHolidaysWorked ? ', com a folga compensatória' : ''}).`,
        suggestion: 'Conceda a folga compensatória em outro dia da semana ou altere a compensação de feriado na aba Mês.',
      }));
    const planned = plannedWeekMinutes(res, e, weekIdx);
    if (!hourly && t.minutes < planned - labor.underloadToleranceHours * 60)
      out.push(alert('atencao', 'CARGA_ABAIXO', ctx, {
        e, d: d0, title: 'Carga horária abaixo da planejada',
        message: `${empName(ctx, e)}, ${wl}: ${formatDuration(t.minutes)} escaladas para ${formatDuration(planned)} planejadas.`,
        suggestion: 'Revise as folgas ou o turno de fim de semana; horas não trabalhadas não geram crédito automático.',
      }));
    const contracted = ctx.employees[e].weeklyContractedHours * 60;
    if (!hourly && t.minutes > contracted && t.minutes <= labor.weeklyLimitHours * 60)
      out.push(alert('atencao', 'HORAS_ADICIONAIS_SEMANA', ctx, {
        e, d: d0, title: 'Horas adicionais na semana',
        message: `${empName(ctx, e)}, ${wl}: ${formatDuration(t.minutes)} escaladas para ${formatDuration(contracted)} contratadas (+${formatDuration(t.minutes - contracted)}).`,
        suggestion: labor.compensationAllowed ? 'Registre a compensação conforme o acordo vigente.' : 'Sem regra de compensação configurada: confirme a autorização de horas adicionais.',
      }));
  }
}

/** Escala livre: a única regra é o limite semanal: 42 horas para todo mundo e 30 horas para estagiários (Lei do Estágio). */
export const LIVRE_LIMITE_SEMANAL_HORAS = 42;
export const livreLimiteSemanal = (dept: Parameters<typeof deptHourLimits>[0]) => deptHourLimits(dept)?.weekly ?? LIVRE_LIMITE_SEMANAL_HORAS;
export function livreWeekAlerts(res: ResolvedDept, weekIdx: number, out: Alert[]): void {
  const { ctx } = res;
  const week = ctx.range.weeks[weekIdx];
  const wl = `semana ${week.index} (${formatDayMonth(week.start)}–${formatDayMonth(week.end)})`;
  const limite = livreLimiteSemanal(ctx.deptId);
  for (let e = 0; e < ctx.employees.length; e++) {
    const t = weekTotals(res, e, weekIdx);
    if (t.minutes > limite * 60)
      out.push(alert('critico', 'LIMITE_SEMANAL', ctx, {
        e, d: weekIdx * 7, title: 'Jornada semanal acima do limite',
        message: `${empName(ctx, e)}, ${wl}: ${formatDuration(t.minutes)} escaladas (limite ${limite}h${deptHourLimits(ctx.deptId) ? ', Lei do Estágio' : ''}; excesso ${formatDuration(t.minutes - limite * 60)}).`,
        suggestion: 'Reduza o horário de algum dia ou tire um dia de trabalho nessa semana.',
      }));
  }
}

/** Regras que dependem de várias semanas: dias consecutivos, fins de semana seguidos, domingos. */
export function multiWeekAlerts(res: ResolvedDept, upToDay: number, out: Alert[], checkAll = true): void {
  const { ctx, cells } = res;
  const { labor } = ctx.config;
  for (let e = 0; e < ctx.employees.length; e++) {
    let run = 0;
    let reported = false;
    for (let d = 0; d <= upToDay; d++) {
      run = cells[e][d].status === 'T' ? run + 1 : 0;
      if (run === 0) reported = false;
      if (run > labor.maxConsecutiveWorkDays && !reported) {
        reported = true;
        out.push(alert('critico', 'DIAS_CONSECUTIVOS', ctx, {
          e, d, title: 'Descanso semanal não respeitado',
          message: `${empName(ctx, e)} trabalha mais de ${labor.maxConsecutiveWorkDays} dias seguidos (até ${dayLabel(ctx, d)}).`,
          suggestion: 'Antecipe uma folga para interromper a sequência.',
        }));
      }
    }
    if (!checkAll) continue;
    // Quem só trabalha no fim de semana trabalha todos os fins de semana por definição.
    if (outside5x2(ctx.employees[e])) continue;
    const weeks = Math.floor((upToDay + 1) / 7);
    let wkRun = 0;
    let sunRun = 0;
    for (let w = 0; w < weeks; w++) {
      const sat = cells[e][w * 7 + 5].status === 'T';
      const sun = cells[e][w * 7 + 6].status === 'T';
      wkRun = sat || sun ? wkRun + 1 : 0;
      if (wkRun === labor.maxConsecutiveWeekends + 1)
        out.push(alert('atencao', 'FINS_SEMANA_CONSECUTIVOS', ctx, {
          e, d: w * 7 + 5, title: 'Muitos fins de semana consecutivos',
          message: `${empName(ctx, e)} trabalha ${wkRun} fins de semana seguidos (até a semana ${w + 1}).`,
          suggestion: 'Alterne o colaborador de fim de semana nesta semana.',
        }));
      sunRun = sun ? sunRun + 1 : 0;
      if (labor.sundayOffWithinWeeks > 0 && sunRun === labor.sundayOffWithinWeeks)
        out.push(alert('atencao', 'DOMINGO_SEM_FOLGA', ctx, {
          e, d: w * 7 + 6, title: 'Sem folga aos domingos',
          message: `${empName(ctx, e)} trabalha ${sunRun} domingos seguidos (até ${dayLabel(ctx, w * 7 + 6)}).`,
          suggestion: `Garanta ao menos um domingo de folga a cada ${labor.sundayOffWithinWeeks} semanas (confirme a regra aplicável com o sócio-operador da unidade).`,
        }));
    }
  }
}

export interface EmployeeStats {
  employeeId: string;
  /** Dias de férias no mês. */
  vacationDays: number;
  dayMinutes: number[];
  weekMinutes: number[];
  weekPlanned: number[];
  monthMinutes: number;
  workedDays: number;
  offDays: number;
  holidayDays: number;
  holidaysWorked: number;
  saturdays: number;
  sundays: number;
  substitutions: number;
  /** Horas acima da jornada contratada, por semana (nunca negativo). */
  weekExtra: number[];
  /** Saldo de compensação — apenas quando o banco de horas está formalmente configurado. */
  hourBankBalance: number | null;
}

export function employeeStats(res: ResolvedDept, e: number): EmployeeStats {
  const { ctx, cells } = res;
  const emp = ctx.employees[e];
  const s: EmployeeStats = {
    employeeId: emp.id, vacationDays: 0, dayMinutes: [], weekMinutes: [], weekPlanned: [], monthMinutes: 0, workedDays: 0, offDays: 0,
    holidayDays: 0, holidaysWorked: 0, saturdays: 0, sundays: 0, substitutions: 0, weekExtra: [], hourBankBalance: null,
  };
  ctx.dates.forEach((date, d) => {
    const c = cells[e][d];
    s.dayMinutes.push(c.minutes);
    if (!ctx.range.inMonth(date)) return;
    if (c.status === 'T') {
      s.monthMinutes += c.minutes;
      s.workedDays++;
      if (ctx.weekdays[d] === 6) s.saturdays++;
      if (ctx.weekdays[d] === 0) s.sundays++;
      if (c.origin === 'substituicao') s.substitutions++;
      if (ctx.holidayOpen[d]) s.holidaysWorked++;
    } else if (c.status === 'FE') s.holidayDays++;
    else if (c.status === 'FR') s.vacationDays++;
    else s.offDays++;
  });
  ctx.range.weeks.forEach((_, w) => {
    const t = weekTotals(res, e, w);
    s.weekMinutes.push(t.minutes);
    s.weekPlanned.push(plannedWeekMinutes(res, e, w));
    s.weekExtra.push(Math.max(0, t.minutes - emp.weeklyContractedHours * 60));
  });
  if (ctx.config.labor.hourBankEnabled)
    s.hourBankBalance = s.weekMinutes.reduce((acc, m, w) => acc + m - (emp.weeklyContractedHours * 60 * (s.weekPlanned[w] / (emp.weeklyPlannedHours * 60 || 1))), 0);
  return s;
}

export function dailyCount(res: ResolvedDept, d: number): number {
  return res.cells.reduce((acc, row) => acc + (row[d].status === 'T' ? 1 : 0), 0);
}

/** Alertas de distribuição e informativos do mês. */
export function monthAlerts(res: ResolvedDept, stats: EmployeeStats[], out: Alert[]): void {
  const { ctx } = res;
  if (!ctx.employees.length) return;
  // Quem tirou férias no mês fica fora das comparações de equilíbrio.
  const cmp = stats.map((s, e) => ({ s, e })).filter((x) => !x.s.vacationDays && !outside5x2(ctx.employees[x.e]));
  const weekendDays = stats.map((s) => s.saturdays + s.sundays);
  const cmpW = cmp.map((x) => weekendDays[x.e]);
  const maxW = cmpW.length ? Math.max(...cmpW) : 0;
  const minW = cmpW.length ? Math.min(...cmpW) : 0;
  if (maxW - minW > 2) {
    const lo = cmp.find((x) => weekendDays[x.e] === minW)!.e;
    const hi = cmp.find((x) => weekendDays[x.e] === maxW)!.e;
    out.push(alert('atencao', 'FINS_SEMANA_DESIGUAIS', ctx, {
      title: 'Fins de semana distribuídos de forma desigual',
      message: `${deptName(ctx.deptId)}: ${empName(ctx, hi)} trabalha ${maxW} dia(s) de fim de semana no mês e ${empName(ctx, lo)} trabalha ${minW}.`,
      suggestion: `Revise a distribuição. Se ${empName(ctx, lo)} não pode trabalhar no fim de semana por causa do turno (ex.: fechamento), avalie a regra de cobertura do fechamento ou o horário de sábado.`,
    }));
  }
  const offs = cmp.map((x) => x.s.offDays);
  if (offs.length && Math.max(...offs) - Math.min(...offs) > 2)
    out.push(alert('atencao', 'FOLGAS_DESIGUAIS', ctx, {
      title: 'Distribuição desigual das folgas',
      message: `${deptName(ctx.deptId)}: folgas no mês variam de ${Math.min(...offs)} a ${Math.max(...offs)} entre os colaboradores.`,
      suggestion: 'Equilibre as folgas entre a equipe.',
    }));
  // Férias no mês: aviso com o período, para o gestor conferir a cobertura dos dias.
  ctx.employees.forEach((emp, e) => {
    const first = ctx.range.monthDates[0];
    const last = ctx.range.monthDates[ctx.range.monthDates.length - 1];
    for (const v of emp.vacations ?? []) {
      if (v.end < first || v.start > last) continue;
      out.push(alert('info', 'FERIAS', ctx, {
        e, key: v.start, title: 'Férias no mês',
        message: `${empName(ctx, e)} de férias de ${formatDayMonth(v.start)} a ${formatDayMonth(v.end)}. Nas semanas com férias a folga é proporcional; se faltar gente, os dias descobertos aparecem como conflito.`,
        suggestion: '',
      }));
    }
  });
  stats.forEach((s, e) => {
    const emp = ctx.employees[e];
    out.push(alert('info', 'RESUMO_COLABORADOR', ctx, {
      e, title: 'Resumo do colaborador',
      message: `${empName(ctx, e)} (${SHIFT_KIND_LABEL[emp.kind]}): ${formatDuration(s.monthMinutes)} no mês, ${s.workedDays} dias trabalhados, ${s.offDays} folgas${s.holidayDays ? `, ${s.holidayDays} folga(s) de feriado` : ''}${s.vacationDays ? `, ${s.vacationDays} dia(s) de férias` : ''}; ${s.saturdays} sábado(s) e ${s.sundays} domingo(s) trabalhados${s.holidaysWorked ? `; ${s.holidaysWorked} feriado(s) trabalhado(s)` : ''}${s.substitutions ? `; ${s.substitutions} substituição(ões) de turno` : ''}.`,
      suggestion: '',
    }));
  });
  const md = ctx.dates.map((_, d) => d).filter((d) => ctx.range.inMonth(ctx.dates[d]));
  const avg = (pred: (d: number) => boolean) => {
    const ds = md.filter(pred);
    return ds.length ? (ds.reduce((a, d) => a + dailyCount(res, d), 0) / ds.length).toFixed(1).replace('.', ',') : '-';
  };
  out.push(alert('info', 'RESUMO_DEPARTAMENTO', ctx, {
    title: 'Pessoas por dia',
    message: `${deptName(ctx.deptId)}: ${ctx.employees.length} colaboradores ativos; média de ${avg((d) => ctx.weekdays[d] !== 0 && ctx.weekdays[d] !== 6)} por dia útil, ${avg((d) => ctx.weekdays[d] === 6)} aos sábados e ${avg((d) => ctx.weekdays[d] === 0)} aos domingos.`,
    suggestion: '',
  }));
}

/** Intervalos de [from, to) em que há menos de `min` pessoas presentes. */
export function presenceGaps(spans: ShiftSpan[], from: number, to: number, min: number): [number, number][] {
  if (min <= 0) return [];
  const points = [...new Set([from, to, ...spans.flatMap((s) => [s.start, s.end])])].filter((p) => p >= from && p <= to).sort((a, b) => a - b);
  const gaps: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const count = spans.filter((s) => s.start <= a && s.end >= b).length;
    if (count >= min) continue;
    const last = gaps[gaps.length - 1];
    if (last && last[1] === a) last[1] = b;
    else gaps.push([a, b]);
  }
  return gaps;
}

export function spanText(s: ShiftSpan): string {
  return `${formatClock(s.start)}–${formatClock(s.end)}`;
}
