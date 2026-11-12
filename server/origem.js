// Mapa "aluno → unidade de origem" (a unidade do cadastro do aluno no EVO), para contar quem treina em outra unidade.
// Fica SÓ num arquivo temporário da própria rotina (pasta temporária do GitHub Actions ou do computador): nunca é gravado
// no armazenamento do painel e só tem números de cadastro, sem nome. A leitura dos alunos (evo-alunos.mjs ou
// evo-origem.mjs) grava; a leitura das entradas (evo-entradas.mjs) lê, na mesma rotina.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchAll } from "./evo.js";
import { UNIT_NAMES } from "./units.js";

export const caminhoDoMapa = () => process.env.MAPA_ORIGEM || join(tmpdir(), "atlas-origem-alunos.json");

/** Grava o mapa { idMember: idBranch }. */
export function salvarMapa(mapa) {
  writeFileSync(caminhoDoMapa(), JSON.stringify(mapa));
}

/** Lê o mapa como Map<idMember, idBranch>, ou null se a leitura dos alunos não rodou antes. */
export function lerMapa() {
  const p = caminhoDoMapa();
  if (!existsSync(p)) return null;
  return new Map(Object.entries(JSON.parse(readFileSync(p, "utf8"))).map(([k, v]) => [Number(k), Number(v)]));
}

/** Acrescenta ao mapa os alunos de uma unidade (a unidade do cadastro; sem ela, a unidade da lista). */
export function anotarOrigem(mapa, membros, idBranch) {
  for (const m of membros) if (m.idMember) mapa[m.idMember] = Number(m.idBranch ?? idBranch);
  return mapa;
}

/** Lê os alunos de todas as unidades só para montar o mapa (recarga do histórico das entradas). */
export async function montarMapa() {
  const mapa = {};
  for (const id of Object.keys(UNIT_NAMES)) anotarOrigem(mapa, await fetchAll(`/members?idBranch=${id}`), id);
  salvarMapa(mapa);
  return mapa;
}
