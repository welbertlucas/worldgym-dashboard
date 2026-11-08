import { dashboardData, somarPerfil, type Perfil, type UnitData } from "@/data/dashboardData";

export interface Pino { nome: string; pos: [number, number] }
export type Bairros = NonNullable<UnitData["bairros"]>;
export interface MapaDados { bairros: Bairros; semBairro: number; inativos: Bairros; semBairroInativos: number; pinos: Pino[]; alunos: number }

/** Soma listas de bairros (o mesmo bairro de unidades diferentes, ou de ativos e inativos, vira uma bolha só). */
export function somarBairros(listas: Bairros[]): Bairros {
  const por = new Map<string, Bairros[number]>();
  for (const b of listas.flat()) {
    const k = `${b[0]}|${b[1]}`;
    const atual = por.get(k);
    if (atual) { atual[2] += b[2]; if (!b[5]) atual[5] = undefined; }
    else por.set(k, [...b] as Bairros[number]);
  }
  return [...por.values()];
}

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
  const fotos = alvo.map(ultimaFoto).filter((u): u is UnitData => !!u);
  const pinos: Pino[] = fotos.filter((u) => u.local).map((u) => ({ nome: u.name, pos: u.local! }));
  const bairros = somarBairros(fotos.map((u) => u.bairros ?? []));
  const inativos = somarBairros(fotos.map((u) => u.bairrosInativos ?? []));
  return {
    bairros, inativos, pinos,
    semBairro: fotos.reduce((s, u) => s + (u.semBairro ?? 0), 0),
    semBairroInativos: fotos.reduce((s, u) => s + (u.semBairroInativos ?? 0), 0),
    alunos: bairros.reduce((s, b) => s + b[2], 0),
  };
}

/** Perfil dos alunos da foto mais recente de cada unidade (a foto só existe no mês em que foi tirada): serve de reserva em meses fechados. */
export function perfilMaisRecente(unit: string | null, nomes: string[]): { perfil: Perfil; mes: string } | null {
  const us: UnitData[] = [];
  let mes = "";
  for (const nome of unit ? [unit] : nomes) {
    for (const d of [...dashboardData].reverse()) {
      const u = d.units.find((x) => x.name === nome);
      if (u?.perfil) { us.push(u); if (d.month > mes) mes = d.month; break; }
    }
  }
  return us.length ? { perfil: somarPerfil(us), mes } : null;
}

/** Último check-in da foto mais recente de cada unidade (reserva em meses fechados): total, mês mais novo e acessos por unidade. */
export function acessosMaisRecente(unit: string | null, nomes: string[]): { acessos: number[]; mes: string; unidades: { name: string; acessos: number[] }[] } | null {
  const unidades: { name: string; acessos: number[] }[] = [];
  let mes = "";
  for (const nome of unit ? [unit] : nomes) {
    for (const d of [...dashboardData].reverse()) {
      const u = d.units.find((x) => x.name === nome);
      if (u?.acessos) { unidades.push({ name: nome, acessos: u.acessos }); if (d.month > mes) mes = d.month; break; }
    }
  }
  if (!unidades.length) return null;
  return { acessos: [0, 1, 2, 3, 4, 5].map((i) => unidades.reduce((n, u) => n + (u.acessos[i] ?? 0), 0)), mes, unidades };
}

/** Treinos da foto mais recente de cada unidade (reserva em meses fechados): soma da rede ou da unidade, mês mais novo e unidades. */
export function treinosMaisRecente(unit: string | null, nomes: string[]): { total: UnitData; mes: string; unidades: UnitData[] } | null {
  const unidades: UnitData[] = [];
  let mes = "";
  for (const nome of unit ? [unit] : nomes) {
    for (const d of [...dashboardData].reverse()) {
      const u = d.units.find((x) => x.name === nome);
      if (u?.treinoAtivo !== undefined) { unidades.push(u); if (d.month > mes) mes = d.month; break; }
    }
  }
  if (!unidades.length) return null;
  const soma = (f: (u: UnitData) => number) => unidades.reduce((n, u) => n + f(u), 0);
  const total = { treinoAtivo: soma((u) => u.treinoAtivo ?? 0), treinoVencido: soma((u) => u.treinoVencido ?? 0), treinoFuturo: soma((u) => u.treinoFuturo ?? 0), ativosFim: soma((u) => u.ativosFim ?? 0) } as UnitData;
  return { total, mes, unidades };
}
