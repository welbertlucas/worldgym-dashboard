// Rotina diária: lê os alunos de cada unidade UMA vez e calcula, com a mesma leitura,
//  - os ativos de cada mês (ativosFim, ativosIni, cancelados, fluxo, permanência) e a renovação (como evo-ativos.mjs);
//  - a foto de hoje: bairros, quem saiu, último acesso e perfil (como evo-bairros.mjs);
//  - os contratos ativos de hoje: especiais/VIP, personal, local × rede (como evo-contratos.mjs);
//  - o saldo devedor em aberto no fim de cada mês (títulos "Balance due", cruzados com quem é aluno ativo);
//  - o ritmo do mês em andamento (cancelados e renovações até hoje, o mesmo dia dos 3 meses anteriores e o que vence em 7 dias);
//  - o mapa temporário "aluno → unidade de origem" para a etapa das entradas (server/origem.js; não vai para o painel);
//  - a contagem de alunos ativos por hexágono do Censo, pelo CEP (server/alunosHex.js): só contagens; sem as tabelas de CEP no Blob (rotina cep-posicoes.yml), é pulada.
// Antes eram duas varreduras completas dos alunos (cerca de 75 minutos cada).
// Uso: node --env-file=.env.local scripts/evo-alunos.mjs 2026-10 2026-11
import { consumoEntre, consumoEvo, fetchAll, hojeBR, listBranches } from "../server/evo.js";
import { ativoNoDia, ativosDaUnidade, resumoAluno, UNIDADES } from "../server/ativos.js";
import { inadimplenciaPorPerfil, lerPagadores } from "../server/inadPerfil.js";
import { titulosDeSaldo } from "../server/saldo.js";
import { anotarOrigem, salvarMapa } from "../server/origem.js";
import { aplicarBairros, fotoDosAlunos, saiuNosUltimos12Meses } from "../server/bairros.js";
import { arquivoAlunosHex, contarAlunosPorHexagono, indiceDeHexagonos, lerTabelasCep } from "../server/alunosHex.js";
import { gravarJson, lerJson } from "../server/armazem.js";
import { ARQUIVO_CENSO } from "../server/estudos.js";
import { contratosUnidade } from "../server/contratos.js";
import { relatorioNaoRenovados } from "../server/renovacao.js";
import { ritmoAlunosDoMes } from "../server/ritmoAlunos.js";
import { loadGeo, loadMonth, saveGeo, saveMonth } from "../server/store.js";
import { criarTrava, executarComLimite, ordenarPorAntiguidade } from "../server/filaAlunos.js";

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
// Mapa de alunos por CEP: precisa das tabelas CEP -> posição dos estados (rotina cep-posicoes.yml) e da malha do Censo; sem elas, a etapa é pulada.
const tabelasCep = await lerTabelasCep(["DF", "GO", "BA"]);
const censoDosHexagonos = Object.keys(tabelasCep).length ? await lerJson(ARQUIVO_CENSO) : null;
const indiceHex = censoDosHexagonos?.celulas?.length ? indiceDeHexagonos(censoDosHexagonos.celulas) : null;
console.log(indiceHex ? `Mapa por CEP: tabelas de ${Object.keys(tabelasCep).join(", ")}` : "Mapa por CEP: sem tabelas de CEP no Blob (etapa pulada)");

const mapaOrigem = {};
// Gravações (meses e mapa de bairros) uma de cada vez: com várias unidades lendo juntas, duas não gravam o mesmo arquivo ao mesmo tempo.
const trava = criarTrava();
const salvarParcial = () => trava(async () => { for (const ym of Object.keys(blobs)) if (blobs[ym] && (meses.includes(ym) || ym === ymHoje)) await saveMonth(blobs[ym]); });

// Tempo: o EVO lento fez esta etapa passar de 4h em 17/11/2026 e estourar o limite de 150 min em 18/11 (10 de 23 unidades lidas).
// Quando passa de INICIO_MIN não começa unidade nova (as que faltam são as primeiras da fila na noite seguinte);
// em FIM_MIN grava o que já leu e encerra com sucesso, em vez de a etapa ser cortada e aparecer como falha.
const INICIO_MIN = Number(process.env.ALUNOS_INICIO_MIN ?? 125);
const FIM_MIN = Number(process.env.ALUNOS_FIM_MIN ?? 143);
const LEITURAS_JUNTAS = Number(process.env.ALUNOS_EM_PARALELO ?? 3); // o cálculo mensal já usa 3 em paralelo no EVO
const t0 = Date.now();
const minutos = () => Math.round((Date.now() - t0) / 60000);
const SALVAR_A_CADA = 4;
let lidas = 0;

// Quem ficou há mais tempo sem leitura vai primeiro (`alunosEm` por unidade, gravado a cada unidade lida).
const base = blobs[ymHoje] ?? blobs[meses[meses.length - 1]];
const estampa = ([, nome]) => base?.units.find((x) => x.name === nome)?.alunosEm;
const fila = ordenarPorAntiguidade(Object.entries(UNIDADES), estampa);
console.log(`Fila (${LEITURAS_JUNTAS} ao mesmo tempo, não começa unidade nova depois de ${INICIO_MIN} min, grava e encerra em ${FIM_MIN} min): ${fila.map(([, n]) => n).join(", ")}`);

async function lerUnidade([id, nome]) {
  // Cronômetro por fase e consumo do EVO de cada unidade, para o log dizer onde o tempo vai (membros, saldo, contratos, bairros...).
  // Com unidades lendo juntas, o "EVO N chamadas" de cada linha inclui as chamadas das outras que rodaram no mesmo intervalo.
  const inicioUnidade = Date.now(), consumoAntes = consumoEvo(), fases = [];
  let inicioFase = Date.now();
  const fase = (rotulo) => { fases.push(`${rotulo} ${Math.round((Date.now() - inicioFase) / 1000)}s`); inicioFase = Date.now(); };
  const fim = () => console.log(`${nome} · ${Math.round((Date.now() - inicioUnidade) / 1000)}s · ${fases.join(", ")} · EVO ${consumoEntre(consumoAntes)} (com as unidades em paralelo)`);
  const membros = await fetchAll(`/members?idBranch=${id}`);
  fase(`membros (${membros.length})`);
  anotarOrigem(mapaOrigem, membros, id);
  // Saldo devedor: se a leitura falhar, os ativos seguem sem ele (a próxima noite tenta de novo).
  const titulos = await titulosDeSaldo(Number(id)).catch((e) => { console.log(nome, `saldo devedor com erro: ${e.message}`); return null; });

  fase("saldo devedor");
  const por = await ativosDaUnidade(Number(id), meses, hoje, membros, titulos);
  fase("ativos");
  const lidaEm = new Date().toISOString();
  for (const ym of meses) {
    const u = blobs[ym].units.find((x) => x.name === nome);
    const r = naoRenov[ym].get(Number(id));
    if (u) Object.assign(u, por[ym], { naoRenovados: r?.n ?? 0, naoRenovadosTipos: r?.tipos ?? {}, naoRenovadosPlanos: r?.planos ?? [], alunosEm: lidaEm });
    const pag = pagadores[ym]?.[nome];
    if (u && pag) u.inadPerfil = inadimplenciaPorPerfil(membros.map(resumoAluno), pag, ym);
  }
  console.log(nome, JSON.stringify(por));

  const u = fotoHoje?.units.find((x) => x.name === nome);
  if (!u) { fim(); return; }
  u.alunosEm = lidaEm;
  try {
    u.ritmoAlunos = ritmoAlunosDoMes(membros.map(resumoAluno), hoje);
  } catch (e) {
    console.log(nome, `ritmo com erro: ${e.message}`);
  }
  fase("ritmo");
  try {
    const c = await contratosUnidade(Number(id), membros);
    Object.assign(u, c);
    const { contratosPlanos, ...resumo } = c;
    console.log(nome, JSON.stringify(resumo), `${contratosPlanos.length} planos`);
  } catch (e) {
    console.log(nome, `contratos com erro: ${e.message}`); // não derruba os ativos nem os bairros
  }
  try {
    const { novos, falhou } = await aplicarBairros(u, await fotoDosAlunos(Number(id), hoje, membros), geo, locais.get(Number(id)));
    if (novos) await trava(() => saveGeo(geo)); // uma gravação por unidade: o Blob cobra por operação
    console.log(nome, falhou ? `bairros PULADOS — ${falhou} (a próxima carga tenta de novo)` : `${u.bairros.length} bairros, ${u.semBairro} sem localização`);
  } catch (e) {
    console.log(nome, `bairros com erro: ${e.message}`); // não derruba os ativos
  }
  try {
    if (indiceHex) {
      // só contagens por hexágono; nenhum CEP, nome ou endereço de aluno é guardado nem impresso
      const r = contarAlunosPorHexagono(membros.filter((m) => ativoNoDia(resumoAluno(m).c, hoje)), tabelasCep, indiceHex);
      // quem saiu nos últimos 12 meses (mesma regra dos bairros dos inativos): também só a contagem por hexágono
      const ri = contarAlunosPorHexagono(membros.filter((m) => saiuNosUltimos12Meses(resumoAluno(m).c, hoje)), tabelasCep, indiceHex);
      await trava(() => gravarJson(arquivoAlunosHex(id), { em: lidaEm, ...r, inativos: { total: ri.total, comPosicao: ri.comPosicao, celulas: ri.celulas } }));
      console.log(nome, `mapa por CEP: ${r.comPosicao}/${r.total} alunos em ${r.celulas.length} hexágonos (${r.foraDaTabela} fora da tabela, ${r.baixaPrecisao} de CEP rural, ${r.semCep} sem CEP); inativos 12 meses: ${ri.comPosicao}/${ri.total}`);
    }
  } catch (e) {
    console.log(nome, `mapa por CEP com erro: ${e.message}`); // não derruba o resto
  }
  fase("contratos e bairros");
  fim();
  if (++lidas % SALVAR_A_CADA === 0) await salvarParcial();
}

// Corte duro: grava o que já foi lido e encerra com sucesso (as unidades em andamento ficam para a próxima noite).
const corte = setTimeout(async () => {
  console.log(`Passou de ${FIM_MIN} min: gravando o que foi lido (${lidas} unidades) e encerrando; as outras entram primeiro na próxima noite.`);
  try { salvarMapa(mapaOrigem); await salvarParcial(); } catch (e) { console.log(`Gravação final com erro: ${e.message}`); }
  process.exit(0);
}, FIM_MIN * 60000);

const { puladas, falhas } = await executarComLimite(fila, LEITURAS_JUNTAS, lerUnidade, { podeIniciar: () => minutos() < INICIO_MIN });
clearTimeout(corte);
for (const f of falhas) console.log(`${f.item[1]} FALHOU: ${f.erro?.message ?? f.erro}`);
salvarMapa(mapaOrigem);

const completo = !puladas.length && !falhas.length;
if (completo) {
  const agora = new Date().toISOString();
  for (const ym of meses) blobs[ym].ativosEm = agora;
  if (fotoHoje) fotoHoje.bairrosEm = fotoHoje.contratosEm = agora;
} else {
  // Sem carimbo geral: o painel continua mostrando a data da última leitura completa; as unidades lidas guardam o próprio `alunosEm`.
  console.log(`Leitura incompleta aos ${minutos()} min: ${puladas.length} unidade(s) não começaram (${puladas.map(([, n]) => n).join(", ") || "nenhuma"}) e ${falhas.length} falharam. Entram primeiro na próxima noite.`);
}
await salvarParcial();
console.log(`Gravado: ${[...new Set([...meses, ...(fotoHoje ? [ymHoje] : [])])].join(", ")}`);
if (falhas.length) process.exitCode = 1;
