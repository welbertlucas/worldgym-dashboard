// Ranking do Plano de ação (só o dono vê, em teste por um mês a partir de 16/11/2026; liberar para a rede só com decisão dele).
// Mede quanto do plano a unidade RESOLVEU no mês, não quantos itens ela tinha: unidade sem pendência não fica atrás de quem tem muitas.
// Tudo sai do que já existe (os alertas de agora + os "feitos" do mês); nada novo é gravado.
import { continuaFeito, type GrupoVigente } from "@/data/planoVigente";

/** Só entra na disputa quem teve pelo menos este tanto de itens no mês (com 1 de 1 todo mundo empata em 100%). */
export const MIN_ITENS_NA_DISPUTA = 3;

export interface PosicaoPlano {
  unit: string;
  /** Marcado como feito e o alerta saiu da leitura mais nova do EVO: o EVO confirmou. */
  resolvidos: number;
  /** Alerta ainda na leitura do EVO e sem marcação, ou marcado antes da leitura e o alerta continuou. */
  pendentes: number;
  /** Marcado depois da última leitura do EVO: ainda não dá para confirmar, fica fora da conta até a leitura seguinte. */
  aguardando: number;
  /** resolvidos + pendentes: o que entra na porcentagem. */
  total: number;
  /** resolvidos / total, 0 a 100 (null sem itens). */
  pct: number | null;
  /** Posição na disputa (empates dividem a posição); null fora dela. */
  posicao: number | null;
}

export interface RankingDoPlano {
  /** Na disputa (3 ou mais itens), da maior para a menor porcentagem. */
  disputa: PosicaoPlano[];
  /** Com poucos itens (fora da disputa) ou só aguardando a leitura do EVO. */
  poucos: PosicaoPlano[];
  /** Nenhum item no mês: o melhor resultado, reconhecido à parte. */
  limpas: PosicaoPlano[];
}

/**
 * `unidades`: todas as unidades do mês (a sem item no plano precisa aparecer como "plano limpo").
 * `grupos`: os alertas de agora por unidade. `feitos`: os marcados do mês ("Unidade|tipo"), que ficam gravados mesmo depois
 * que o alerta some do plano, e por isso é daí que sai o "resolvido".
 * Item que sumiu sem ninguém marcar não entra na conta: a unidade não é premiada nem punida por ele.
 */
export function rankingDoPlano(
  unidades: string[], grupos: GrupoVigente[], feitos: Record<string, { por: string; em: string }>, atualizadoEm: string | null,
): RankingDoPlano {
  const posicoes = unidades.filter((u) => u !== "Rede").map((unit): PosicaoPlano => {
    const agora = new Set<string>(grupos.find((g) => g.unit === unit)?.itens.map((a) => a.kind) ?? []);
    const marcados = Object.keys(feitos).filter((k) => k.startsWith(`${unit}|`)).map((k) => k.slice(unit.length + 1));
    let resolvidos = 0, pendentes = 0, aguardando = 0;
    for (const kind of new Set([...agora, ...marcados])) {
      const f = feitos[`${unit}|${kind}`];
      if (!agora.has(kind)) resolvidos++; // só chega aqui se foi marcado (o alerta saiu)
      else if (!f) pendentes++;
      else if (continuaFeito(f.em, atualizadoEm)) aguardando++;
      else pendentes++; // marcado, mas o alerta continuou na leitura seguinte
    }
    const total = resolvidos + pendentes;
    return { unit, resolvidos, pendentes, aguardando, total, pct: total ? (resolvidos / total) * 100 : null, posicao: null };
  });

  const disputa = posicoes.filter((p) => p.total >= MIN_ITENS_NA_DISPUTA)
    .sort((a, b) => b.pct! - a.pct! || b.resolvidos - a.resolvidos || a.unit.localeCompare(b.unit, "pt-BR"));
  disputa.forEach((p, i) => { const ant = disputa[i - 1]; p.posicao = ant && ant.pct === p.pct && ant.resolvidos === p.resolvidos ? ant.posicao : i + 1; });
  const resto = posicoes.filter((p) => p.total < MIN_ITENS_NA_DISPUTA).sort((a, b) => a.unit.localeCompare(b.unit, "pt-BR"));
  return {
    disputa,
    poucos: resto.filter((p) => p.total > 0 || p.aguardando > 0),
    limpas: resto.filter((p) => p.total === 0 && p.aguardando === 0),
  };
}
