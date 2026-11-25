import type { ConfigIssue } from '../domain/schema';
import { DEPARTMENTS, type DeptId } from '../domain/types';

const SECTION_LABEL: Record<ConfigIssue['section'], string> = {
  identificacao: 'Elaborada por', funcionamento: 'Funcionamento', departamentos: 'Departamentos', colaboradores: 'Colaboradores', jornada: 'Jornada',
};

/**
 * Pendências da configuração agrupadas por departamento: cada item diz onde está e o que fazer,
 * com um botão que leva direto ao campo; cada departamento pode ser tirado desta escala.
 */
export function IssueList({ issues, onGo, onSkipDept, limit = 12, labelFor }: {
  /** Texto do link de correção (padrão: "Corrigir em <etapa>"). */
  labelFor?: (issue: ConfigIssue) => string;
  issues: ConfigIssue[];
  onGo: (issue: ConfigIssue) => void;
  onSkipDept?: (dept: DeptId) => void;
  limit?: number;
}) {
  const groups = [
    ...DEPARTMENTS.map((d) => ({ dept: d.id as DeptId | undefined, title: d.name, list: issues.filter((i) => i.dept === d.id) })),
    { dept: undefined, title: 'Geral', list: issues.filter((i) => !i.dept) },
  ].filter((g) => g.list.length);
  return (
    <div className="issue-groups">
      {groups.map((g) => (
        <div key={g.title} className="issue-group">
          <div className="issue-group-head">
            <strong>{g.title}</strong>
            <span className="muted small">{g.list.length} pendência(s)</span>
            {g.dept && onSkipDept && (
              <button type="button" className="btn ghost small" onClick={() => onSkipDept(g.dept!)} title="Os cadastros ficam guardados; é só incluir de novo depois.">
                Não gerar {g.title} agora
              </button>
            )}
          </div>
          <ul>
            {mergeSame(g.list).slice(0, limit).map((m, k) => (
              <li key={k}>
                <span>{m.where && <strong>{m.where}: </strong>}{m.first.message}</span>
                <button type="button" className="link" onClick={() => onGo(m.first)}>{labelFor ? labelFor(m.first) : m.first.section === 'identificacao' ? 'Preencher' : `Corrigir em ${SECTION_LABEL[m.first.section]}`}</button>
              </li>
            ))}
            {mergeSame(g.list).length > limit && <li className="muted small">e mais {mergeSame(g.list).length - limit}…</li>}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Junta numa linha só a mesma pendência de várias pessoas (ex.: "Colaborador 1, 2 e 3: Falta o nome completo."). */
function mergeSame(list: ConfigIssue[]): { first: ConfigIssue; where?: string }[] {
  const map = new Map<string, ConfigIssue[]>();
  for (const i of list) {
    const key = `${i.section}|${i.message}`;
    map.set(key, [...(map.get(key) ?? []), i]);
  }
  return [...map.values()].map((items) => ({ first: items[0], where: joinWhere(items.map((i) => i.where).filter((w): w is string => !!w)) }));
}

function joinWhere(names: string[]): string | undefined {
  if (!names.length) return undefined;
  // "Colaborador 1", "Colaborador 2" → "Colaboradores 1, 2 e 3"
  const m = names.map((n) => /^(.*) (\d+)$/.exec(n));
  if (names.length > 1 && m.every((x) => x && x[1] === m[0]![1])) {
    const nums = m.map((x) => x![2]);
    return `${plural(m[0]![1])} ${list(nums)}`;
  }
  return list(names);
}

const list = (xs: string[]) => (xs.length === 1 ? xs[0] : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`);
const plural = (w: string) => (/or$/.test(w) ? `${w}es` : `${w}s`); // Colaborador(es), Professor(es), Estagiário(s)
