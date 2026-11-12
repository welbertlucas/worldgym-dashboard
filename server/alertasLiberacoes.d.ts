// Tipos do módulo JS compartilhado entre o servidor (resumo diário) e o painel.
export const MOTIVOS_DE_RECEITA: string[];
export interface LimitesLiberacoes { minNivel: number; vezes: number; baseMeses: number; minAlta: number }
export const LIMITES_LIBERACOES: LimitesLiberacoes;
export interface AlertaLiberacao {
  quem: string; gravidade: "atencao"; titulo: string; fato: string; acao: string;
  quantidade: number; devendo: number; visitante: number; total: number; media: number | null; alta: boolean; nivel: boolean;
}
type ComLiberacoes = { liberacoes?: number; liberacoesMotivos?: [string, number][]; liberacoesGrupos?: [number, number, number, number] };
export function liberacoesDeReceita(u: ComLiberacoes | undefined): number | null;
export function liberacoesSemPagamento(u: ComLiberacoes | undefined): [number, number, number] | null;
export function alertasLiberacoes(
  meses: { month: string; units?: ({ name: string; entradas?: number } & ComLiberacoes)[] }[],
  ym: string, nomes?: Set<string> | null, L?: LimitesLiberacoes,
): AlertaLiberacao[];
