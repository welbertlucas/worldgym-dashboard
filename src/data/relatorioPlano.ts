// Slide "Plano de ação da unidade" do relatório semanal: os itens em aberto do plano do mês em andamento (os mesmos da tela Plano de ação),
// para a equipe discutir na reunião. Só faz sentido quando o relatório é do mês em andamento e de uma unidade só.
import type { ResultadoVigente } from "@/data/alertasVigentes";
import { chaveFeito, type Feito } from "@/data/planoFeitos";
import { continuaFeito } from "@/data/planoVigente";

export interface ItemDoPlano {
  /** "Resolver agora" (pendência) ou "Acelerar o mês" (ritmo). */
  grupo: "Resolver agora" | "Acelerar o mês";
  gravidade: "critico" | "atencao" | "info";
  titulo: string;
  /** O que os números mostram. */
  fato: string;
  /** O que fazer. */
  acao: string;
}

export interface PlanoDaUnidade {
  unidade: string;
  /** Mês do plano (AAAA-MM). */
  mes: string;
  /** Dias do mês já lidos no EVO. */
  dias: number;
  pendentes: ItemDoPlano[];
  /** Itens marcados como feitos (e que o EVO não voltou a mostrar). */
  feitos: string[];
}

/** Itens por slide e máximo de slides: o que passar disso fica no Atlas ("+N itens"). */
export const ITENS_POR_SLIDE = 3;
export const MAX_SLIDES_PLANO = 2;

const GRAVIDADE = { critical: "critico", attention: "atencao", info: "info" } as const;
const PESO = { critico: 0, atencao: 1, info: 2 } as const;

/**
 * Plano de uma unidade. `mes`: o mês do relatório; só vale se for o mês do plano (o plano é do mês em andamento). Devolve null quando não é.
 * Item marcado como feito conta como feito só se a marcação é mais nova que a leitura do EVO (a mesma regra da tela do plano).
 */
export function planoDaUnidade(res: ResultadoVigente, unidade: string, mes: string, feitos: Record<string, Feito>, atualizadoEm: string | null): PlanoDaUnidade | null {
  if (!res.month || res.month !== mes) return null;
  const doGrupo = res.alertas.filter((a) => a.unit === unidade);
  const ehFeito = (kind: string) => { const f = feitos[chaveFeito(unidade, kind)]; return !!f && continuaFeito(f.em, atualizadoEm); };
  const pendentes = doGrupo.filter((a) => !ehFeito(a.kind))
    .map((a): ItemDoPlano => ({ grupo: a.tipo === "pendencia" ? "Resolver agora" : "Acelerar o mês", gravidade: GRAVIDADE[a.severity], titulo: a.title, fato: a.fact, acao: a.action }))
    .sort((x, y) => (x.grupo === y.grupo ? 0 : x.grupo === "Resolver agora" ? -1 : 1) || PESO[x.gravidade] - PESO[y.gravidade]);
  return { unidade, mes, dias: res.dias, pendentes, feitos: doGrupo.filter((a) => ehFeito(a.kind)).map((a) => a.title) };
}

/** Divide os pendentes em slides de ITENS_POR_SLIDE; devolve também quantos ficaram de fora. */
export function paginasDoPlano(p: PlanoDaUnidade): { paginas: ItemDoPlano[][]; excedente: number } {
  const maximo = ITENS_POR_SLIDE * MAX_SLIDES_PLANO;
  const mostrados = p.pendentes.slice(0, maximo);
  const paginas: ItemDoPlano[][] = [];
  for (let i = 0; i < mostrados.length; i += ITENS_POR_SLIDE) paginas.push(mostrados.slice(i, i + ITENS_POR_SLIDE));
  return { paginas, excedente: Math.max(0, p.pendentes.length - maximo) };
}
