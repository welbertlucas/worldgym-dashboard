// Semanas fixas do mês, para os relatórios semanais: semana 1 = dias 1 a 7, 2 = 8 a 14, 3 = 15 a 21, 4 = 22 a 28 e
// semana 5 = 29 até o fim do mês (só existe em mês com mais de 28 dias). Cada leitura do EVO que já acontece (títulos, vendas,
// prospects, cancelamentos) separa os números por semana, pelas datas que o EVO devolve. Só totais; nada de aluno.
// Em cada unidade o mês guarda `semanas`: uma lista (uma posição por semana) de { faturamento, recebimento, novosContratos,
// vendasOnline, diarias, camisetas, coqueteleiras, personal, oportunidades, conversoes, cancelados }, cada rotina preenchendo a sua parte.

const round2 = (n) => Math.round(n * 100) / 100;
const dd = (n) => String(n).padStart(2, "0");

export const diasDoMes = (ym) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
/** Mês com mais de 28 dias tem a semana 5 (de 1 a 3 dias). */
export const semanasNoMes = (ym) => (diasDoMes(ym) > 28 ? 5 : 4);
/** Semana (1 a 5) de um dia do mês. */
export const semanaDoDia = (dia) => Math.min(5, Math.ceil(dia / 7));
/** Primeiro e último dia (números) da semana `n` do mês, ou null se o mês não tem essa semana. */
export function limitesDaSemana(ym, n) {
  if (!Number.isInteger(n) || n < 1 || n > semanasNoMes(ym)) return null;
  return { de: (n - 1) * 7 + 1, ate: n === 5 ? diasDoMes(ym) : n * 7 };
}
/** Os mesmos limites como datas AAAA-MM-DD. */
export function datasDaSemana(ym, n) {
  const l = limitesDaSemana(ym, n);
  return l && { de: `${ym}-${dd(l.de)}`, ate: `${ym}-${dd(l.ate)}` };
}
/** Semana (1 a 5) de uma data AAAA-MM-DD dentro do mês `ym`, ou null se a data é de outro mês. */
export function semanaDaData(data, ym) {
  const d = String(data ?? "").slice(0, 10);
  return d.slice(0, 7) === ym ? semanaDoDia(Number(d.slice(8, 10))) : null;
}
export const semanasVazias = (ym, molde = {}) => Array.from({ length: semanasNoMes(ym) }, () => ({ ...molde }));

/** Junta duas listas de semanas posição a posição (os campos novos ganham dos antigos de mesmo nome). */
export function mesclarSemanas(antigas, novas) {
  const n = Math.max(antigas?.length ?? 0, novas?.length ?? 0);
  return Array.from({ length: n }, (_, i) => ({ ...(antigas?.[i] ?? {}), ...(novas?.[i] ?? {}) }));
}

/**
 * Faturamento (títulos que venceram na semana, `titulosVencidos` = os já vencidos no mês) e recebimento (títulos pagos na semana)
 * de uma unidade. Mesmas definições do mês (evo.js unitMonth): a soma das semanas fecha com o total do mês.
 */
export function semanasFinanceiro(titulosVencidos, titulosPagos, ym) {
  const sem = semanasVazias(ym, { faturamento: 0, recebimento: 0 });
  for (const r of titulosVencidos) { const s = semanaDaData(r.dueDate, ym); if (s) sem[s - 1].faturamento += r.ammount || 0; }
  for (const r of titulosPagos) { const s = semanaDaData(r.chargeDate, ym); if (s) sem[s - 1].recebimento += r.ammountPaid || 0; }
  return sem.map((x) => ({ faturamento: round2(x.faturamento), recebimento: round2(x.recebimento) }));
}

/** Cancelamentos da semana por unidade: alunos diferentes com contrato cancelado na semana (pela data do cancelamento). */
export function semanasDeCancelados(rows, ym, nomeDaUnidade) {
  const por = {};
  const vistos = new Set();
  for (const r of rows) {
    const nome = nomeDaUnidade(r.idBranch);
    const s = semanaDaData(r.cancelDate, ym);
    if (!nome || !s) continue;
    const chave = `${s}:${r.idBranch}:${r.idMember}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    (por[nome] ??= semanasVazias(ym, { cancelados: 0 }))[s - 1].cancelados += 1;
  }
  return por;
}
