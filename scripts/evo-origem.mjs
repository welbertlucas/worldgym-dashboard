// Monta o mapa temporário "aluno → unidade de origem" (server/origem.js) lendo os alunos de todas as unidades.
// Só para a recarga do histórico das entradas: na rotina diária, evo-alunos.mjs já grava o mapa com a leitura que faz.
// Uso: node --env-file=.env.local scripts/evo-origem.mjs
import { montarMapa, caminhoDoMapa } from "../server/origem.js";

const t0 = Date.now();
const mapa = await montarMapa();
console.log(`Mapa de origem: ${Object.keys(mapa).length.toLocaleString("pt-BR")} alunos | ${((Date.now() - t0) / 60000).toFixed(0)} min (${caminhoDoMapa()})`);
