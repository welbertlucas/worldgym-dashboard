// Tipos do módulo JS compartilhado entre o servidor (resumo diário) e o painel.
export type Gravidade = "critico" | "atencao";
export interface AlertaMeta { quem: string; gravidade: Gravidade; titulo: string; fato: string; acao: string; campanha?: string }
export interface LimitesMeta {
  gastoSemContato: number; custoAltoFator: number; custoAltoMinContatos: number; frequenciaAlta: number; terminaEmDias: number;
  conversaoMinContatos: number; conversaoBaixa: number; semOrigemAlta: number;
}
export const LIMITES_META: LimitesMeta;
export const ORIGEM_META: RegExp;
export function origemMetaDe(origens: Record<string, [number, number]> | undefined): { cadastradas: number; convertidas: number };
type CampanhaFoto = { unidade: string | null; nome: string; objetivo: string | null; fim: string | null; gasto7d: number; leads7d: number; conversas7d: number; frequencia7d?: number };
type MesMetaJs = { unidades: Record<string, { investimento: number; leads: number; conversas: number }> } | undefined;
type MesEvoJs = { units: { name: string; origens?: Record<string, [number, number]> }[] } | undefined;
export function buscaContato(c: { objetivo: string | null; nome: string }): boolean;
export function alertasDeCampanhas(campanhas: CampanhaFoto[], opts?: { hoje?: string; limites?: LimitesMeta }): AlertaMeta[];
export function alertasDeUnidades(a: { metaMes: MesMetaJs; metaAnterior: MesMetaJs; evoMes: MesEvoJs; evoAnterior: MesEvoJs; campanhas?: CampanhaFoto[]; limites?: LimitesMeta }): AlertaMeta[];
export function alertasMeta(a: { campanhas?: CampanhaFoto[]; metaMes: MesMetaJs; metaAnterior: MesMetaJs; evoMes: MesEvoJs; evoAnterior: MesEvoJs; hoje?: string; limites?: LimitesMeta }): AlertaMeta[];
