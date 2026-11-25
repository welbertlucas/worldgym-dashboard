// Ficha da unidade: contas da tela (sem React). Aluguel por m², peso do aluguel nas vendas, contrato a vencer e o resumo por modelo.
export type FichaSalva = { aluguel: number | null; contratoAte: string | null; obs: string; atualizadoEm?: string };
export type UnidadeFicha = { nome: string; modelo: "low" | "pro"; m2: number | null; abertura: string | null; madura: boolean; vendas: number | null; alunos: number | null; ficha: FichaSalva | null };

const dia = (s: string) => Math.round(Date.parse(`${s}T12:00:00Z`) / 86400000);
export const aluguelPorM2 = (u: UnidadeFicha) => (u.ficha?.aluguel && u.m2 ? u.ficha.aluguel / u.m2 : null);
/** Parte das vendas mensais (média dos últimos meses fechados) que o aluguel representa. */
export const pesoDoAluguel = (u: UnidadeFicha) => (u.ficha?.aluguel && u.vendas ? u.ficha.aluguel / u.vendas : null);
/** Dias até o fim do contrato (negativo se já passou); null sem data. */
export const diasParaFimDoContrato = (u: UnidadeFicha, hoje: string) => (u.ficha?.contratoAte ? dia(u.ficha.contratoAte) - dia(hoje) : null);
export const contratoAVencer = (u: UnidadeFicha, hoje: string, janelaDias = 180) => { const d = diasParaFimDoContrato(u, hoje); return d !== null && d <= janelaDias; };

const mediana = (v: number[]) => { const s = [...v].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export type ResumoAluguel = { levantadas: number; total: number; porModelo: { modelo: "low" | "pro"; n: number; mediana: number; minimo: number; maximo: number }[] };
/** Quantas unidades já têm aluguel e o R$/m² (mediana, menor e maior) de cada modelo. */
export function resumoDoAluguel(unidades: UnidadeFicha[]): ResumoAluguel {
  const porModelo = (["low", "pro"] as const).map((modelo) => {
    const v = unidades.filter((u) => u.modelo === modelo).map(aluguelPorM2).filter((x): x is number => x !== null);
    return v.length ? { modelo, n: v.length, mediana: mediana(v), minimo: Math.min(...v), maximo: Math.max(...v) } : null;
  }).filter((x): x is NonNullable<typeof x> => !!x);
  return { levantadas: unidades.filter((u) => u.ficha?.aluguel).length, total: unidades.length, porModelo };
}
export const ordenarFichas = (us: UnidadeFicha[]) => [...us].sort((a, b) => Number(!!a.ficha?.aluguel) - Number(!!b.ficha?.aluguel) || a.nome.localeCompare(b.nome, "pt-BR"));
