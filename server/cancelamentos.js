// Motivos de cancelamento por unidade e mês, do endpoint de contratos cancelados do EVO (/api/v3/membermembership).
// A rota devolve as unidades de uma vez; conta-se cada aluno uma vez por mês (o primeiro motivo registrado).
// Confere com os cancelados que já calculamos (out/2026: 2.929 contra 2.962).
import { fetchAll } from "./evo.js";
import { diaDeCorte } from "./ativos.js";
import { UNIT_NAMES } from "./units.js";
import { tipoContrato } from "./vendas.js";

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
  for (const [nome, u] of Object.entries(resumirCancelados(rows))) por[nome] = u.motivos;
  return por;
}

/**
 * Por unidade: motivos (alunos), contratos cancelados por tipo e os planos com mais cancelamentos (nome do contrato no EVO,
 * os 10 maiores). Cada aluno conta uma vez no mês, pelo primeiro contrato cancelado. Só contagens: nenhum dado do aluno sai daqui.
 */
export function resumirCancelados(rows) {
  const por = {};
  const vistos = new Set();
  for (const r of rows) {
    const nome = UNIT_NAMES[r.idBranch];
    if (!nome) continue;
    const chave = `${r.idBranch}:${r.idMember}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const u = (por[nome] ??= { motivos: {}, tipos: {}, planos: new Map() });
    const c = categoriaMotivo(r.reasonCancellation);
    u.motivos[c] = (u.motivos[c] ?? 0) + 1;
    const plano = String(r.nameMembership || "Sem nome").trim().replace(/\s+/g, " ");
    const tipo = tipoContrato(plano);
    u.tipos[tipo] = (u.tipos[tipo] ?? 0) + 1;
    u.planos.set(plano, (u.planos.get(plano) ?? 0) + 1);
  }
  for (const u of Object.values(por)) u.planos = [...u.planos].sort((a, b) => b[1] - a[1]).slice(0, 10);
  return por;
}

export async function canceladosDoMes(ym, hoje) {
  const rows = await fetchAll(`/api/v3/membermembership?cancelDateStart=${ym}-01&cancelDateEnd=${diaDeCorte(ym, hoje)}`);
  return resumirCancelados(rows);
}

export async function motivosDoMes(ym, hoje) {
  const rows = await fetchAll(`/api/v3/membermembership?cancelDateStart=${ym}-01&cancelDateEnd=${diaDeCorte(ym, hoje)}`);
  return resumirMotivos(rows);
}
