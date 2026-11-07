import { dashboardData, type UnitData } from "@/data/dashboardData";

export interface Pino { nome: string; pos: [number, number] }
export interface MapaDados { bairros: NonNullable<UnitData["bairros"]>; semBairro: number; pinos: Pino[]; alunos: number }

/** Última foto de bairros de cada unidade (a mais recente que tem a foto). */
function ultimaFoto(name: string): UnitData | undefined {
  return [...dashboardData].reverse().map((d) => d.units.find((u) => u.name === name)).find((u) => u?.bairros !== undefined);
}

/**
 * Dados do mapa dos alunos: de uma unidade ou, com `unit` null, da rede (bairros iguais de unidades diferentes se somam).
 * Cada unidade com a foto e a posição vira um pino.
 */
export function dadosDoMapa(unit: string | null, nomes: string[]): MapaDados {
  const alvo = unit ? [unit] : nomes;
  const por = new Map<string, NonNullable<UnitData["bairros"]>[number]>();
  const pinos: Pino[] = [];
  let semBairro = 0;
  for (const nome of alvo) {
    const u = ultimaFoto(nome);
    if (!u) continue;
    semBairro += u.semBairro ?? 0;
    if (u.local) pinos.push({ nome, pos: u.local });
    for (const b of u.bairros ?? []) {
      const k = `${b[0]}|${b[1]}`;
      const atual = por.get(k);
      if (atual) { atual[2] += b[2]; if (!b[5]) atual[5] = undefined; }
      else por.set(k, [...b] as NonNullable<UnitData["bairros"]>[number]);
    }
  }
  const bairros = [...por.values()];
  return { bairros, semBairro, pinos, alunos: bairros.reduce((s, b) => s + b[2], 0) };
}
