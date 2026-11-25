// Modelos prontos de escala: pessoas (com nomes fictícios) e regras dos departamentos de uma coordenação.
// O horário de funcionamento e as regras de jornada continuam os da unidade. Todos seguem o 5x2
// (2 folgas por semana, até 42h semanais, 11h de descanso entre jornadas, domingo de folga a cada
// 3 semanas) e, para estagiários, a Lei do Estágio (até 6h por dia e 30h por semana).
// Cada modelo é conferido pelo gerador nos testes: sai sem conflitos obrigatórios.
import { DAILY_NORMAL_MINUTES, defaultDeptConfig, INTERN_SHIFT, newEmployee, newIntern } from './defaults';
import { formatClock, shiftWithin, suggestShiftWithBreak, toMinutes } from './time';
import type { DeptConfig, DeptId, Employee, ScheduleConfig, Shift, ShiftKind, Team } from './types';

export interface ModeloDept {
  dept: DeptId;
  pessoas: number;
  sabado: number;
  domingo: number;
  feriado: number;
}

export interface Modelo {
  id: string;
  team: Team;
  nome: string;
  descricao: string;
  /** Sugestão do sistema (não pedido pela rede). */
  sugerido?: boolean;
  /** Resumo por departamento, para o card. */
  resumo: ModeloDept[];
  /** Observações curtas (turnos, horas, lei). */
  destaques: string[];
  /** Monta os departamentos da coordenação a partir da configuração da unidade. */
  montar: (c: ScheduleConfig) => Partial<Record<DeptId, DeptConfig>>;
}

const NOMES: Record<DeptId, string> = { recepcao: 'Recepcionista', apoio: 'Serviços Gerais', professores: 'Professor', estagiarios: 'Estagiário' };
const KINDS: Record<number, ShiftKind[]> = {
  3: ['abertura', 'intermediario', 'fechamento'],
  4: ['abertura', 'intermediario', 'intermediario_noite', 'fechamento'],
  5: ['abertura', 'abertura', 'intermediario', 'intermediario_noite', 'fechamento'],
};
const mais = (t: string, min: number) => formatClock(toMinutes(t) + min);

function pessoa(dept: DeptId, i: number, kind: ShiftKind, shift?: Shift, horas = 42): Employee {
  const e = dept === 'estagiarios' ? newIntern() : newEmployee(dept, kind, horas);
  e.name = `${NOMES[dept]} ${i + 1}`;
  e.kind = kind;
  if (shift) e.shift = { ...shift };
  e.weeklyPlannedHours = horas;
  e.weeklyContractedHours = horas;
  return e;
}

/** Turnos de sábado: 1 pessoa cobre o dia todo; 2 pessoas, uma entra 1h depois e sai 1h depois da outra. */
function turnosSabado(c: ScheduleConfig, n: number): Pick<DeptConfig, 'saturdayShift' | 'saturdayShift2'> {
  const sab = c.operatingHours[6];
  const r = c.labor.breakRules;
  // Jornada de até 8h24min (42h em 5 dias). Um no sábado: o dia todo, com intervalo maior se preciso.
  if (n <= 1) return { saturdayShift: shiftWithin(sab.start, sab.end, DAILY_NORMAL_MINUTES, r), saturdayShift2: undefined };
  // Dois no sábado: um entra na abertura e o outro sai no fechamento, cada um com 8h24min.
  const janela = DAILY_NORMAL_MINUTES + 60;
  const ini = toMinutes(sab.start);
  const fim = toMinutes(sab.end);
  return {
    saturdayShift: shiftWithin(sab.start, formatClock(Math.min(fim, ini + janela)), DAILY_NORMAL_MINUTES, r),
    saturdayShift2: shiftWithin(formatClock(Math.max(ini, fim - janela)), sab.end, DAILY_NORMAL_MINUTES, r),
  };
}

function base(c: ScheduleConfig, id: DeptId, m: ModeloDept): DeptConfig {
  const d = defaultDeptConfig(id, c.operatingHours, c.labor.breakRules, c.holidayHours);
  return { ...d, enabled: true, headcount: m.pessoas, saturdayRequired: m.sabado, sundayRequired: m.domingo, holidayRequired: m.feriado, ...turnosSabado(c, m.sabado) };
}

/** Recepção ou Serviços Gerais: 5x2 com abertura, intermediários e fechamento. */
function administrativo(c: ScheduleConfig, m: ModeloDept): DeptConfig {
  const d = base(c, m.dept, m);
  d.employees = KINDS[m.pessoas].map((k, i) => pessoa(m.dept, i, k));
  return d;
}

/** Professores 5x2 de 8h24min, escalonados para cobrir o dia (abertura, meio do dia e noite). */
function professores(c: ScheduleConfig, m: ModeloDept, minPresent = 1): DeptConfig {
  const d = base(c, 'professores', m);
  const kinds = KINDS[m.pessoas];
  d.employees = kinds.map((k, i) => pessoa('professores', i, k));
  d.minPresent = minPresent;
  d.maxSimultaneous = Math.max(3, m.pessoas);
  return d;
}

/** Estagiários com jornada de até 6h por dia (Lei do Estágio), metade de manhã e metade à noite. */
function estagiarios(c: ScheduleConfig, m: ModeloDept, horasDia = 5): DeptConfig {
  const d = base(c, 'estagiarios', m);
  const r = c.labor.breakRules;
  // Jornada efetiva exata: acima de 4h entra o intervalo de 15 minutos, que não conta como trabalho.
  const bruto = (h: number) => h * 60 + (h > 4 ? 15 : 0);
  const manha = suggestShiftWithBreak('06:00', mais('06:00', bruto(horasDia)), r);
  const noite = suggestShiftWithBreak(mais('22:00', -bruto(horasDia)), '22:00', r);
  const sab = c.operatingHours[6];
  const fds = suggestShiftWithBreak(sab.start, formatClock(Math.min(toMinutes(sab.start) + bruto(Math.min(horasDia, 5)), toMinutes(sab.end))), r);
  d.employees = Array.from({ length: m.pessoas }, (_, i) => pessoa('estagiarios', i, 'abertura', i % 2 === 0 ? manha : noite, horasDia * 5));
  d.minPresent = 0;
  d.maxSimultaneous = 10;
  d.saturdayShift = { ...fds };
  d.saturdayShift2 = m.sabado > 1 ? { ...fds } : undefined;
  const dom = c.operatingHours[0];
  d.sundayShift = suggestShiftWithBreak(dom.start, formatClock(Math.min(toMinutes(dom.start) + bruto(Math.min(horasDia, 5)), toMinutes(dom.end))), r);
  d.holidayShift = { ...INTERN_SHIFT };
  return d;
}

const adm = (id: string, nome: string, pessoas: number, sabado: number, extra: Partial<Modelo> = {}, domingo = 1): Modelo => ({
  id, team: 'administrativa', nome,
  descricao: `${pessoas} na Recepção e ${pessoas} em Serviços Gerais, com ${sabado} de cada no sábado e ${domingo} de cada no domingo.`,
  resumo: (['recepcao', 'apoio'] as DeptId[]).map((dept) => ({ dept, pessoas, sabado, domingo, feriado: 1 })),
  destaques: [
    'Abertura, intermediário e fechamento em todos os dias úteis',
    sabado > 1 ? 'Sábado em dois horários: um na abertura e outro no fechamento' : 'Sábado com uma pessoa no dia todo',
    '5x2: jornada de 8h24min, 2 folgas por semana e 42h semanais',
  ],
  montar: (c) => {
    const r: Partial<Record<DeptId, DeptConfig>> = {};
    for (const dept of ['recepcao', 'apoio'] as DeptId[]) r[dept] = administrativo(c, { dept, pessoas, sabado, domingo, feriado: 1 });
    return r;
  },
  ...extra,
});

const tec = (id: string, nome: string, prof: number, est: number, sabado: number, extra: Partial<Modelo> = {}): Modelo => ({
  id, team: 'tecnica', nome,
  descricao: `${prof} professores e ${est} estagiários, com ${sabado} de cada no sábado e 1 de cada no domingo.`,
  resumo: [
    { dept: 'professores', pessoas: prof, sabado, domingo: 1, feriado: 1 },
    { dept: 'estagiarios', pessoas: est, sabado, domingo: 1, feriado: 0 },
  ],
  destaques: [
    'Professores de 8h24min em abertura, meio do dia e noite',
    'Estagiários de 5h (25h por semana), metade de manhã e metade à noite',
    'Lei do Estágio: até 6h por dia e 30h por semana',
  ],
  montar: (c) => ({
    professores: professores(c, { dept: 'professores', pessoas: prof, sabado, domingo: 1, feriado: 1 }),
    estagiarios: estagiarios(c, { dept: 'estagiarios', pessoas: est, sabado, domingo: 1, feriado: 0 }),
  }),
  ...extra,
});

export const MODELOS: Modelo[] = [
  adm('adm-4-sab1', '4 + 4, um no sábado', 4, 1),
  adm('adm-4-sab2', '4 + 4, dois no sábado', 4, 2),
  adm('adm-3-sab1', '3 + 3, um no sábado', 3, 1),
  adm('adm-3-sab2', '3 + 3, dois no sábado', 3, 2),
  adm('adm-5-sab2-dom2', '5 + 5, dois no sábado e no domingo', 5, 2, { sugerido: true }, 2),

  tec('tec-4-6-sab1', '4 professores e 6 estagiários, um no sábado', 4, 6, 1),
  tec('tec-4-6-sab2', '4 professores e 6 estagiários, dois no sábado', 4, 6, 2),
  tec('tec-3-3-sab1', '3 professores e 3 estagiários, um no sábado', 3, 3, 1),
  tec('tec-3-3-sab2', '3 professores e 3 estagiários, dois no sábado', 3, 3, 2, {
    destaques: [
      'Professores de 8h24min em abertura, meio do dia e noite',
      'Com 2 dos 3 professores no sábado, alguns dias úteis ficam sem professor no início ou no fim do dia: sem mínimo obrigatório',
      'Estagiários de 5h (25h por semana). Lei do Estágio: até 6h por dia e 30h por semana',
    ],
    montar: (c) => ({
      professores: professores(c, { dept: 'professores', pessoas: 3, sabado: 2, domingo: 1, feriado: 1 }, 0),
      estagiarios: estagiarios(c, { dept: 'estagiarios', pessoas: 3, sabado: 2, domingo: 1, feriado: 0 }),
    }),
  }),
  {
    id: 'tec-3prof-6h-fds',
    team: 'tecnica',
    nome: '3 professores de 6h e 1 de fim de semana',
    descricao: '3 professores de 6h por dia (30h por semana) de segunda a sexta e 1 professor só de sábado, domingo e feriado.',
    resumo: [{ dept: 'professores', pessoas: 4, sabado: 1, domingo: 1, feriado: 1 }],
    destaques: [
      'Professores de 6h: manhã, tarde e noite',
      'Professor de fim de semana fora do 5x2 (sábado, domingo e feriado)',
      'Sem estagiários. Sem mínimo de professores o dia todo: 3 turnos de 6h não cobrem as 18h de funcionamento',
    ],
    montar: (c) => {
      const m: ModeloDept = { dept: 'professores', pessoas: 4, sabado: 1, domingo: 1, feriado: 1 };
      const d = base(c, 'professores', m);
      const r = c.labor.breakRules;
      const turnos = [suggestShiftWithBreak('06:00', '12:15', r), suggestShiftWithBreak('11:45', '18:00', r), suggestShiftWithBreak('16:45', '23:00', r)];
      d.employees = turnos.map((t, i) => pessoa('professores', i, (['abertura', 'intermediario', 'fechamento'] as ShiftKind[])[i], t, 30));
      const fds = pessoa('professores', 3, 'intermediario', d.saturdayShift, 14);
      fds.weekendOnly = true;
      d.employees.push(fds);
      d.minPresent = 0;
      return { professores: d, estagiarios: { ...defaultDeptConfig('estagiarios', c.operatingHours, c.labor.breakRules, c.holidayHours), employees: [] } };
    },
  },
  tec('tec-4-4-6h', '4 professores e 4 estagiários de 6h', 4, 4, 1, {
    sugerido: true,
    descricao: '4 professores e 4 estagiários na jornada máxima da Lei do Estágio (6h por dia, 30h por semana), 1 de cada no sábado e no domingo.',
    destaques: ['Estagiários de 6h (30h por semana): o máximo da Lei do Estágio', 'Professores de 8h24min em abertura, meio do dia e noite', 'Fins de semana em rodízio'],
    montar: (c) => ({
      professores: professores(c, { dept: 'professores', pessoas: 4, sabado: 1, domingo: 1, feriado: 1 }),
      estagiarios: estagiarios(c, { dept: 'estagiarios', pessoas: 4, sabado: 1, domingo: 1, feriado: 0 }, 6),
    }),
  }),
  tec('tec-3-6-4h', '3 professores e 6 estagiários de 4h', 3, 6, 1, {
    sugerido: true,
    descricao: '3 professores e 6 estagiários de meio período (4h por dia, 20h por semana), 1 de cada no sábado e no domingo.',
    destaques: ['Estagiários de 4h (20h por semana), metade de manhã e metade à noite', 'Professores de 8h24min em abertura, meio do dia e noite', 'Lei do Estágio: até 6h por dia e 30h por semana'],
    montar: (c) => ({
      professores: professores(c, { dept: 'professores', pessoas: 3, sabado: 1, domingo: 1, feriado: 1 }),
      estagiarios: estagiarios(c, { dept: 'estagiarios', pessoas: 6, sabado: 1, domingo: 1, feriado: 0 }, 4),
    }),
  }),
];

export const modeloPorId = (id: string) => MODELOS.find((m) => m.id === id) ?? null;

/** Aplica o modelo na configuração: troca as pessoas e as regras dos departamentos da coordenação. */
export function aplicarModelo(config: ScheduleConfig, modelo: Modelo): ScheduleConfig {
  const c = structuredClone(config);
  const depts = modelo.montar(c);
  for (const [id, d] of Object.entries(depts) as [DeptId, DeptConfig][]) c.departments[id] = d;
  delete c.overrides;
  return c;
}
