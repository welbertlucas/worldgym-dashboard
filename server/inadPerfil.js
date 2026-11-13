// Inadimplência por gênero e faixa de idade. Quem pagou e quem ficou devendo vem do cálculo do faturamento
// (scripts/evo-backfill.mjs); gênero e nascimento vêm da leitura dos alunos (scripts/evo-alunos.mjs). As duas etapas
// rodam no mesmo job, então a primeira deixa um arquivo TEMPORÁRIO no disco do runner (ids dos pagadores, nunca
// gravados no Blob) e a segunda só guarda as contagens: { g: [[pagantes, devendo] × 3], i: [[pagantes, devendo] × 8] }.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FAIXAS_IDADE, faixaDeIdade } from "./perfil.js";

const caminho = (ym) => join(process.env.PAGADORES_DIR || tmpdir(), `atlas-pagadores-${ym}.json`);

/** `porUnidade`: { [unidade]: { pagantes: number[], devendo: number[] } } (ids de alunos). */
export function salvarPagadores(ym, porUnidade) {
  writeFileSync(caminho(ym), JSON.stringify(porUnidade));
}

/** Pagadores do mês por unidade, ou null se a etapa do faturamento não deixou o arquivo nesta rodada. */
export function lerPagadores(ym) {
  const p = caminho(ym);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}

/**
 * Contagem por perfil: para cada gênero e faixa de idade (no dia 1º do mês), [pagantes, devendo]. Só entram os pagadores
 * que são alunos cadastrados na unidade (`alunos` = resumoAluno da unidade); `fora` = pagantes sem cadastro nela.
 */
export function inadimplenciaPorPerfil(alunos, pagadores, ym) {
  const porId = new Map(alunos.map((a) => [a.id, a]));
  const devendo = new Set(pagadores.devendo);
  const g = [0, 1, 2].map(() => [0, 0]), i = Array.from({ length: FAIXAS_IDADE }, () => [0, 0]);
  let fora = 0;
  for (const id of new Set(pagadores.pagantes)) {
    const a = porId.get(id);
    if (!a) { fora++; continue; }
    const deve = devendo.has(id) ? 1 : 0;
    const gi = a.g ?? 2, ii = faixaDeIdade(a.n, `${ym}-01`);
    g[gi][0]++; g[gi][1] += deve;
    i[ii][0]++; i[ii][1] += deve;
  }
  return { g, i, fora };
}
