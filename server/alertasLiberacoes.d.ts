// Tipos do módulo JS compartilhado entre o servidor (resumo diário) e o painel.
export const MOTIVOS_DE_RECEITA: string[];
export interface LimitesLiberacoes { por100: number; minNivel: number; vezes: number; baseMeses: number; minAlta: number }
export const LIMITES_LIBERACOES: LimitesLiberacoes;
export interface AlertaLiberacao {
  quem: string; gravidade: "atencao"; titulo: string; fato: string; acao: string;
  taxa: number; rede: number; quantidade: number; alta: boolean; nivel: boolean;
}
export function liberacoesDeReceita(u: { liberacoes?: number; liberacoesMotivos?: [string, number][] } | undefined): number | null;
export function alertasLiberacoes(
  meses: { month: string; units?: { name: string; entradas?: number; liberacoes?: number; liberacoesMotivos?: [string, number][] }[] }[],
  ym: string, nomes?: Set<string> | null, L?: LimitesLiberacoes,
): AlertaLiberacao[];
