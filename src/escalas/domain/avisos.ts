// Avisos do sino além do prazo: conflito obrigatório, férias com conflito na escala e trocas feitas por outra pessoa.
import { formatDayMonth, MONTH_NAMES } from './calendar';
import { analyze } from './scheduleOps';
import { TEAMS, type ChangeEntry, type Schedule } from './types';

export interface AvisoEscala {
  id: string;
  tipo: 'conflito' | 'ferias' | 'troca';
  titulo: string;
  escalaId: string;
  /** Avisos só informativos podem ser marcados como lidos; os demais somem quando o problema é resolvido. */
  dispensavel: boolean;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const nomeEquipe = (s: Schedule) => TEAMS.find((t) => t.id === (s.config.team ?? 'administrativa'))?.name ?? 'Coordenação';

/** Marca com `by` as entradas novas (a partir de `base`) que ainda não têm autor. */
export function carimbarAutor(log: ChangeEntry[], base: number, nome?: string): ChangeEntry[] {
  if (!nome) return log;
  return log.map((e, i) => (i >= base && !e.by ? { ...e, by: nome } : e));
}

/** `schedules`: escalas da unidade (mês atual e próximo bastam). `lidoEm`: ISO do último "marcar como lidas". */
export function avisosDasEscalas(schedules: Schedule[], opts: { hoje?: Date; usuario?: string; lidoEm?: string | null } = {}): AvisoEscala[] {
  const hoje = opts.hoje ?? new Date();
  const hojeIso = iso(hoje);
  const em7 = new Date(hoje); em7.setDate(em7.getDate() + 7);
  const fimIso = iso(em7);
  const out: AvisoEscala[] = [];
  const atual = hoje.getFullYear() * 12 + hoje.getMonth() + 1;
  for (const s of schedules) {
    const k = s.year * 12 + s.month;
    if (k < atual || k > atual + 1) continue;
    const mes = MONTH_NAMES[s.month - 1].toLowerCase();
    const a = analyze(s);
    if (a && a.counts.critico > 0) {
      const n = a.counts.critico;
      out.push({ id: `conflito|${s.id}`, tipo: 'conflito', escalaId: s.id, dispensavel: false,
        titulo: `${nomeEquipe(s)}: a escala de ${mes} tem ${n} ${n === 1 ? 'conflito obrigatório' : 'conflitos obrigatórios'}` });
    }
    if (a) {
      for (const [deptId, dept] of Object.entries(s.config.departments)) {
        for (const e of dept.employees) {
          if (e.active === false) continue;
          for (const v of e.vacations ?? []) {
            if (v.start <= hojeIso || v.start > fimIso) continue;
            const semCobertura = a.alerts.some((al) => al.severity === 'critico' && al.date && al.date >= v.start && al.date <= v.end && (!al.dept || al.dept === deptId));
            if (!semCobertura) continue;
            out.push({ id: `ferias|${s.id}|${e.id}|${v.start}`, tipo: 'ferias', escalaId: s.id, dispensavel: false,
              titulo: `${nomeEquipe(s)}: ${e.name} entra de férias em ${formatDayMonth(v.start)} e a escala ainda tem conflito nesse período` });
          }
        }
      }
    }
    const recentes = s.changeLog.filter((c) => c.by && c.by !== opts.usuario && (!opts.lidoEm || c.at > opts.lidoEm));
    if (recentes.length) {
      const quem = [...new Set(recentes.map((c) => c.by!))].join(', ');
      out.push({ id: `troca|${s.id}`, tipo: 'troca', escalaId: s.id, dispensavel: true,
        titulo: `${nomeEquipe(s)}: ${quem} alterou a escala de ${mes} (${recentes.length} ${recentes.length === 1 ? 'alteração' : 'alterações'})` });
    }
  }
  return out;
}
