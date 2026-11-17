// Rotina diária: lê os alunos de cada unidade UMA vez e calcula, com a mesma leitura,
//  - os ativos de cada mês (ativosFim, ativosIni, cancelados, fluxo, permanência) e a renovação (como evo-ativos.mjs);
//  - a foto de hoje: bairros, quem saiu, último acesso e perfil (como evo-bairros.mjs);
//  - os contratos ativos de hoje: especiais/VIP, personal, local × rede (como evo-contratos.mjs);
//  - o saldo devedor em aberto no fim de cada mês (títulos "Balance due", cruzados com quem é aluno ativo);
//  - o ritmo do mês em andamento (cancelados e renovações até hoje, o mesmo dia dos 3 meses anteriores e o que vence em 7 dias);
//  - o mapa temporário "aluno → unidade de origem" para a etapa das entradas (server/origem.js; não vai para o painel).
// Antes eram duas varreduras completas dos alunos (cerca de 75 minutos cada).
// Uso: node --env-file=.env.local scripts/evo-alunos.mjs 2026-10 2026-11
import { consumoEntre, consumoEvo, fetchAll, hojeBR, listBranches } from "../server/evo.js";
import { ativosDaUnidade, resumoAluno, UNIDADES } from "../server/ativos.js";
import { inadimplenciaPorPerfil, lerPagadores } from "../server/inadPerfil.js";
import { titulosDeSaldo } from "../server/saldo.js";
import { anotarOrigem, salvarMapa } from "../server/origem.js";
import { aplicarBairros, fotoDosAlunos } from "../server/bairros.js";
import { contratosUnidade } from "../server/contratos.js";
import { relatorioNaoRenovados } from "../server/renovacao.js";
import { ritmoAlunosDoMes } from "../server/ritmoAlunos.js";
import { loadGeo, loadMonth, saveGeo, saveMonth } from "../server/store.js";

const meses = process.argv.slice(2);
if (!meses.length) throw new Error("Informe os meses AAAA-MM.");
const hoje = hojeBR();
const ymHoje = hoje.slice(0, 7);
// Um objeto por mês: o mês corrente recebe ativos E bairros no mesmo objeto (gravado uma vez no fim).
const blobs = Object.fromEntries(await Promise.all([...new Set([...meses, ymHoje])].map(async (ym) => [ym, await loadMonth(ym)])));
for (const ym of meses) if (!blobs[ym]) throw new Error(`Mês ${ym} ainda não foi calculado; rode evo-backfill antes.`);
const fotoHoje = blobs[ymHoje]; // sem o mês corrente calculado, só os ativos são gravados

// Pagadores de cada mês deixados pela etapa do faturamento nesta mesma rodada (sem eles, o perfil da inadimplência fica como estava).
const pagadores = Object.fromEntries(meses.map((ym) => [ym, lerPagadores(ym)]));
const naoRenov = Object.fromEntries(await Promise.all(meses.map(async (ym) => [ym, await relatorioNaoRenovados(ym, hoje)])));
const geo = await loadGeo();
const locais = new Map((await listBranches()).map((b) => [b.idBranch, [b.latitude, b.longitude]]));

const mapaOrigem = {};
// Grava os meses de vez em quando durante a rodada: se a etapa estourar o tempo (o EVO lento fez isso em 17/11/2026), as unidades já lidas não se perdem.
// Os `ativosEm`/`bairrosEm`/`contratosEm` só são marcados no fim, quando a leitura de todas as unidades termina.
const SALVAR_A_CADA = 4;
let lidas = 0;
const salvarParcial = async () => { for (const ym of Object.keys(blobs)) if (blobs[ym] && (meses.includes(ym) || ym === ymHoje)) await saveMonth(blobs[ym]); };
for (const [id, nome] of Object.entries(UNIDADES)) {
  // Cronômetro por fase e consumo do EVO de cada unidade, para o log dizer onde o tempo vai (membros, saldo, contratos, bairros...).
  const inicioUnidade = Date.now(), consumoAntes = consumoEvo(), fases = [];
  let inicioFase = Date.now();
  const fase = (rotulo) => { fases.push(`${rotulo} ${Math.round((Date.now() - inicioFase) / 1000)}s`); inicioFase = Date.now(); };
  const membros = await fetchAll(`/members?idBranch=${id}`);
  fase(`membros (${membros.length})`);
  anotarOrigem(mapaOrigem, membros, id);
  // Saldo devedor: se a leitura falhar, os ativos seguem sem ele (a próxima noite tenta de novo).
  const titulos = await titulosDeSaldo(Number(id)).catch((e) => { console.log(nome, `saldo devedor com erro: ${e.message}`); return null; });

  fase("saldo devedor");
  const por = await ativosDaUnidade(Number(id), meses, hoje, membros, titulos);
  fase("ativos");
  for (const ym of meses) {
    const u = blobs[ym].units.find((x) => x.name === nome);
    const r = naoRenov[ym].get(Number(id));
    if (u) Object.assign(u, por[ym], { naoRenovados: r?.n ?? 0, naoRenovadosTipos: r?.tipos ?? {}, naoRenovadosPlanos: r?.planos ?? [] });
    const pag = pagadores[ym]?.[nome];
    if (u && pag) u.inadPerfil = inadimplenciaPorPerfil(membros.map(resumoAluno), pag, ym);
  }
  console.log(nome, JSON.stringify(por));

  const u = fotoHoje?.units.find((x) => x.name === nome);
  if (!u) { console.log(`${nome} · ${Math.round((Date.now() - inicioUnidade) / 1000)}s · ${fases.join(", ")} · EVO ${consumoEntre(consumoAntes)}`); continue; }
  try {
    u.ritmoAlunos = ritmoAlunosDoMes(membros.map(resumoAluno), hoje);
  } catch (e) {
    console.log(nome, `ritmo com erro: ${e.message}`);
  }
  fase("ritmo");
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
  fase("contratos e bairros");
  console.log(`${nome} · ${Math.round((Date.now() - inicioUnidade) / 1000)}s · ${fases.join(", ")} · EVO ${consumoEntre(consumoAntes)}`);
  if (++lidas % SALVAR_A_CADA === 0) await salvarParcial();
}

salvarMapa(mapaOrigem);

const agora = new Date().toISOString();
for (const ym of meses) blobs[ym].ativosEm = agora;
if (fotoHoje) fotoHoje.bairrosEm = fotoHoje.contratosEm = agora;
for (const ym of Object.keys(blobs)) if (blobs[ym] && (meses.includes(ym) || ym === ymHoje)) await saveMonth(blobs[ym]);
console.log(`Gravado: ${[...new Set([...meses, ...(fotoHoje ? [ymHoje] : [])])].join(", ")}`);
