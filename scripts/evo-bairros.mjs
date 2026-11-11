// Foto de hoje dos alunos ativos (só contagens): por bairro, por faixa do último acesso e perfil (gênero, idade, estado civil), gravada no mês corrente.
// A rotina diária usa scripts/evo-alunos.mjs (lê os alunos uma vez só para isto e para os ativos); este fica para rodar sozinho.
// Uso: node --env-file=.env.local scripts/evo-bairros.mjs
import { hojeBR, listBranches } from "../server/evo.js";
import { aplicarBairros, fotoDosAlunos } from "../server/bairros.js";
import { UNIDADES } from "../server/ativos.js";
import { loadGeo, loadMonth, saveGeo, saveMonth } from "../server/store.js";

const hoje = hojeBR();
const ym = hoje.slice(0, 7);
const blob = await loadMonth(ym);
if (!blob) throw new Error(`Mês ${ym} ainda não foi calculado; rode evo-backfill antes.`);
const geo = await loadGeo();
const locais = new Map((await listBranches()).map((b) => [b.idBranch, [b.latitude, b.longitude]]));
for (const [id, nome] of Object.entries(UNIDADES)) {
  const u = blob.units.find((x) => x.name === nome);
  if (!u) continue;
  const { novos, falhou } = await aplicarBairros(u, await fotoDosAlunos(Number(id), hoje), geo, locais.get(Number(id)));
  if (novos) await saveGeo(geo); // uma gravação por unidade (não por bairro): o Blob cobra por operação
  if (falhou) { console.log(nome, "PULADA —", falhou, "(rode de novo depois)"); continue; }
  console.log(nome, u.bairros.length, "bairros", u.semBairro, "sem localização");
}
blob.bairrosEm = new Date().toISOString();
await saveMonth(blob);
console.log(`Gravado: ${ym}`);
