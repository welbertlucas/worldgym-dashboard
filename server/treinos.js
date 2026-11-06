// Situação dos treinos dos alunos ativos, por unidade (EVO /api/v2/workout/management-workouts, uma linha por aluno
// com o treino mais recente). workoutStatus: 0 = sem treino, 1 = vencido, 2 = ativo, 4 = começa no futuro.
// A rota pagina de 50 em 50; contamos só as situações com treino (vencido, ativo, futuro) e o "sem treino" sai da
// diferença para os alunos ativos, o que evita varrer todos os alunos.
import { evoGet } from "./evo.js";

const PAGINA = 50;
export const SITUACOES = { treinoAtivo: 2, treinoVencido: 1, treinoFuturo: 4 };

async function contar(idBranch, status) {
  let n = 0;
  for (let skip = 0; skip < 200000; skip += PAGINA) {
    const rows = await evoGet(`/api/v2/workout/management-workouts?idBranch=${idBranch}&workoutStatus=${status}&take=${PAGINA}&skip=${skip}`);
    n += rows.length;
    if (rows.length < PAGINA) break;
  }
  return n;
}

export async function treinosDaUnidade(idBranch) {
  const out = {};
  for (const [campo, status] of Object.entries(SITUACOES)) out[campo] = await contar(idBranch, status);
  return out;
}
