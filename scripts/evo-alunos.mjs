// Rotina diária: lê os alunos de cada unidade UMA vez e calcula, com a mesma leitura,
//  - os ativos de cada mês (ativosFim, ativosIni, cancelados, fluxo, permanência) e a renovação (como evo-ativos.mjs);
//  - a foto de hoje: bairros, quem saiu, último acesso e perfil (como evo-bairros.mjs);
//  - os contratos ativos de hoje: especiais/VIP, personal, local × rede (como evo-contratos.mjs).
// Antes eram duas varreduras completas dos alunos (cerca de 75 minutos cada).
// Uso: node --env-file=.env.local scripts/evo-alunos.mjs 2026-10 2026-11
import { fetchAll, hojeBR, listBranches } from "../server/evo.js";
import { ativosDaUnidade, UNIDADES } from "../server/ativos.js";
import { aplicarBairros, fotoDosAlunos } from "../server/bairros.js";
import { contratosUnidade } from "../server/contratos.js";
import { relatorioNaoRenovados } from "../server/renovacao.js";
import { loadGeo, loadMonth, saveGeo, saveMonth } from "../server/store.js";

const meses = process.argv.slice(2);
if (!meses.length) throw new Error("Informe os meses AAAA-MM.");
const hoje = hojeBR();
const ymHoje = hoje.slice(0, 7);
// Um objeto por mês: o mês corrente recebe ativos E bairros no mesmo objeto (gravado uma vez no fim).
const blobs = Object.fromEntries(await Promise.all([...new Set([...meses, ymHoje])].map(async (ym) => [ym, await loadMonth(ym)])));
for (const ym of meses) if (!blobs[ym]) throw new Error(`Mês ${ym} ainda não foi calculado; rode evo-backfill antes.`);
const fotoHoje = blobs[ymHoje]; // sem o mês corrente calculado, só os ativos são gravados

const naoRenov = Object.fromEntries(await Promise.all(meses.map(async (ym) => [ym, await relatorioNaoRenovados(ym, hoje)])));
const geo = await loadGeo();
const locais = new Map((await listBranches()).map((b) => [b.idBranch, [b.latitude, b.longitude]]));

for (const [id, nome] of Object.entries(UNIDADES)) {
  const membros = await fetchAll(`/members?idBranch=${id}`);

  const por = await ativosDaUnidade(Number(id), meses, hoje, membros);
  for (const ym of meses) {
    const u = blobs[ym].units.find((x) => x.name === nome);
    const r = naoRenov[ym].get(Number(id));
    if (u) Object.assign(u, por[ym], { naoRenovados: r?.n ?? 0, naoRenovadosTipos: r?.tipos ?? {}, naoRenovadosPlanos: r?.planos ?? [] });
  }
  console.log(nome, JSON.stringify(por));

  const u = fotoHoje?.units.find((x) => x.name === nome);
  if (!u) continue;
  try {
    const c = await contratosUnidade(Number(id), membros);
    Object.assign(u, c);
    console.log(nome, JSON.stringify(c));
  } catch (e) {
    console.log(nome, `contratos com erro: ${e.message}`); // não derruba os ativos nem os bairros
  }
  try {
    const { novos, falhou } = await aplicarBairros(u, await fotoDosAlunos(Number(id), hoje, membros), geo, locais.get(Number(id)));
    if (novos) await saveGeo(geo); // uma gravação por unidade: o Blob cobra por operação
    console.log(nome, falhou ? `bairros PULADOS — ${falhou} (a próxima carga tenta de novo)` : `${u.bairros.length} bairros, ${u.semBairro} sem localização`);
  } catch (e) {
    console.log(nome, `bairros com erro: ${e.message}`); // não derruba os ativos
  }
}

const agora = new Date().toISOString();
for (const ym of meses) blobs[ym].ativosEm = agora;
if (fotoHoje) fotoHoje.bairrosEm = fotoHoje.contratosEm = agora;
for (const ym of Object.keys(blobs)) if (blobs[ym] && (meses.includes(ym) || ym === ymHoje)) await saveMonth(blobs[ym]);
console.log(`Gravado: ${[...new Set([...meses, ...(fotoHoje ? [ymHoje] : [])])].join(", ")}`);
