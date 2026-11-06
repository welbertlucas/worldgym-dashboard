// Motivos de cancelamento por unidade e mês, do endpoint de contratos cancelados do EVO (/api/v3/membermembership).
// A rota devolve as unidades de uma vez; conta-se cada aluno uma vez por mês (o primeiro motivo registrado).
// Confere com os cancelados que já calculamos (out/2026: 2.929 contra 2.962).
import { fetchAll } from "./evo.js";
import { diaDeCorte } from "./ativos.js";
import { UNIT_NAMES } from "./units.js";

/** Agrupa o texto livre do EVO em poucas categorias comparáveis. */
export function categoriaMotivo(texto) {
  const t = String(texto ?? "").trim();
  if (!t) return "Sem motivo informado";
  if (/inadimpl/i.test(t)) return "Inadimplência (cancelamento automático)";
  if (/^outros/i.test(t)) return "Outros";
  return t.replace(/\s+/g, " ");
}

/** { [unidade]: { [motivo]: alunos } } a partir das linhas de contratos cancelados. */
export function resumirMotivos(rows) {
  const por = {};
  const vistos = new Set();
  for (const r of rows) {
    const nome = UNIT_NAMES[r.idBranch];
    if (!nome) continue;
    const chave = `${r.idBranch}:${r.idMember}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const m = (por[nome] ??= {});
    const c = categoriaMotivo(r.reasonCancellation);
    m[c] = (m[c] ?? 0) + 1;
  }
  return por;
}

export async function motivosDoMes(ym, hoje) {
  const rows = await fetchAll(`/api/v3/membermembership?cancelDateStart=${ym}-01&cancelDateEnd=${diaDeCorte(ym, hoje)}`);
  return resumirMotivos(rows);
}
