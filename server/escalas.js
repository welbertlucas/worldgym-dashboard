// Escalas 5x2 da equipe das unidades (menu "Escalas"; veio do gerador de escalas que tinha banco e login próprios, 25/11/2026).
// Tudo fica no Blob privado (nomes de colaboradores são dado pessoal: nunca vão para o repositório, que é público). O servidor não entende o miolo da escala
// (`dados` é o objeto que a tela monta); ele guarda, confere quem pode ver cada unidade e mantém o histórico de versões, como o banco antigo fazia.
//   escalas/escalas/<id>.json        a escala completa + resumo
//   escalas/indice/<unidade>.json    resumos das escalas da unidade (para listar sem abrir uma por uma)
//   escalas/versoes/<id>.json        histórico de versões da escala
//   escalas/equipes/<unidade>__<equipe>.json   cadastro da equipe
//   escalas/config/<unidade>.json    horário de funcionamento e regras de jornada
//   escalas/rede.json                prazo da rede
// Quem vê o quê: dono e Master, todas as unidades; quem tem acesso a unidades, só as suas. Só dono e Master mudam as regras de jornada e o prazo da rede.
import { apagarCaminho, gravarJson, lerJson } from "./armazem.js";

/** Unidades que usam as escalas: o `id` é o do sistema antigo (as escalas guardadas ficam ligadas a ele) e `nome` é o da unidade no Atlas (UNIT_NAMES). */
export const UNIDADES_ESCALA = [
  { id: "asa-norte", nome: "Asa Norte" },
  { id: "gama", nome: "Gama" },
  { id: "itapoa", nome: "Itapoã" },
  { id: "aguas-lindas", nome: "Águas Lindas-GO" },
  { id: "ponte-alta", nome: "Ponte Alta" },
  { id: "goiania-pro", nome: "Goiânia Pro-GO" },
  { id: "salvador-pro", nome: "Salvador Pro-BA" },
  { id: "jardim-inga", nome: "Jardim Ingá-GO" },
  { id: "santa-maria", nome: "Santa Maria" },
];
export const EQUIPES = ["administrativa", "tecnica"];
export const MAX_BYTES_ESCALA = 400 * 1024;
export const JANELA_EDICAO_MS = 15 * 60 * 1000;

export class ErroEscalas extends Error {
  constructor(msg, status = 400) { super(msg); this.status = status; }
}

const ID_OK = /^[A-Za-z0-9_-]{1,80}$/;
const idsDasUnidades = new Set(UNIDADES_ESCALA.map((u) => u.id));
const ehDonoOuMaster = (s) => s?.papel === "dono" || s?.papel === "master";
const autorDe = (s) => ({ nome: String(s?.nome ?? "").slice(0, 80), email: String(s?.email ?? "").slice(0, 120) });

/** Ids das unidades que a pessoa enxerga. */
export function unidadesDaSessao(sessao) {
  if (ehDonoOuMaster(sessao)) return UNIDADES_ESCALA.map((u) => u.id);
  const nomes = new Set(sessao?.unidades ?? []);
  return UNIDADES_ESCALA.filter((u) => nomes.has(u.nome)).map((u) => u.id);
}
const podeUnidade = (sessao, unidade) => unidadesDaSessao(sessao).includes(unidade);
function exigirUnidade(sessao, unidade) {
  if (!idsDasUnidades.has(unidade)) throw new ErroEscalas("Unidade desconhecida.", 400);
  if (!podeUnidade(sessao, unidade)) throw new ErroEscalas("Sem permissão para esta unidade.", 403);
}
const exigirId = (id) => { if (!ID_OK.test(String(id ?? ""))) throw new ErroEscalas("Identificador de escala inválido.", 400); return String(id); };
const exigirEquipe = (e) => { if (!EQUIPES.includes(e)) throw new ErroEscalas("Equipe inválida.", 400); return e; };

const caminhos = {
  escala: (id) => `escalas/escalas/${id}.json`,
  indice: (unidade) => `escalas/indice/${unidade}.json`,
  versoes: (id) => `escalas/versoes/${id}.json`,
  equipe: (unidade, equipe) => `escalas/equipes/${unidade}__${equipe}.json`,
  config: (unidade) => `escalas/config/${unidade}.json`,
  rede: "escalas/rede.json",
};

/** Resumo de uma escala (o que a lista mostra), sem os dados pesados. */
const resumoDe = (r) => ({ id: r.id, unidade: r.unidade, equipe: r.equipe ?? null, ano: r.ano, mes: r.mes, status: r.status, confirmadaEm: r.confirmadaEm ?? null, gerada: !!r.gerada, elaboradaPor: r.elaboradaPor ?? null, atualizadaEm: r.atualizadaEm, atualizadaPorNome: r.atualizadaPor?.nome ?? null });
const chaveMes = (x) => x.ano * 12 + x.mes;

async function lerIndice(unidade) {
  const d = await lerJson(caminhos.indice(unidade));
  return Array.isArray(d) ? d : [];
}
async function gravarIndice(unidade, lista) { await gravarJson(caminhos.indice(unidade), lista); }

/** Campos do registro, tirados da escala que a tela mandou (como o banco antigo fazia). Confere unidade, mês e tamanho. */
function registroDaEscala(s) {
  if (!s || typeof s !== "object") throw new ErroEscalas("Escala inválida.", 400);
  const id = exigirId(s.id);
  const unidade = String(s.unitId ?? "");
  if (!idsDasUnidades.has(unidade)) throw new ErroEscalas("Escolha a unidade da escala.", 400);
  const ano = Number(s.year), mes = Number(s.month);
  if (!Number.isInteger(ano) || ano < 2020 || ano > 2100 || !Number.isInteger(mes) || mes < 1 || mes > 12) throw new ErroEscalas("Mês ou ano inválido.", 400);
  const equipe = s.config?.team ?? null;
  if (equipe !== null && !EQUIPES.includes(equipe)) throw new ErroEscalas("Equipe inválida.", 400);
  const status = String(s.status ?? "");
  if (!status || status.length > 30) throw new ErroEscalas("Situação da escala inválida.", 400);
  if (Buffer.byteLength(JSON.stringify(s)) > MAX_BYTES_ESCALA) throw new ErroEscalas("A escala é grande demais.", 413);
  return { id, unidade, equipe, ano, mes, status, confirmadaEm: s.confirmedAt ?? null, gerada: !!s.cells, elaboradaPor: s.managerName ? String(s.managerName).slice(0, 80) : null, dados: s };
}

// ---------- Histórico de versões ----------
/**
 * Registra uma versão como o banco antigo: marco (criada, gerada, confirmada, restaurada) abre uma versão nova; edição comum dentro de 15 minutos, da mesma
 * pessoa e logo depois de outra edição comum, só atualiza a última versão. Sem mudança nos dados nem na situação, não registra nada.
 */
export async function registrarVersao({ antes, depois, marco, autor, agora = new Date() }) {
  if (antes && JSON.stringify(antes.dados) === JSON.stringify(depois.dados) && antes.status === depois.status && !marco) return;
  let m = marco ?? null;
  if (!m) {
    if (!antes) m = "criada";
    else if (depois.status === "confirmada" && antes.status !== "confirmada") m = "confirmada";
    else if (depois.gerada && !antes.gerada) m = "gerada";
  }
  const lista = (await lerJson(caminhos.versoes(depois.id))) ?? [];
  const ultima = lista.length ? lista[lista.length - 1] : null;
  const instante = agora.toISOString();
  if (!m && ultima && !ultima.marco && ultima.autor?.email === autor.email && agora.getTime() - Date.parse(ultima.atualizadaEm) < JANELA_EDICAO_MS) {
    Object.assign(ultima, { dados: depois.dados, status: depois.status, gerada: depois.gerada, atualizadaEm: instante });
  } else {
    lista.push({ id: (ultima?.id ?? 0) + 1, status: depois.status, gerada: depois.gerada, dados: depois.dados, marco: m, autor, criadaEm: instante, atualizadaEm: instante });
  }
  await gravarJson(caminhos.versoes(depois.id), lista);
}

// ---------- Escalas ----------
/** Escala com o resumo (para a tela montar `Schedule`): devolve os dados prontos, sem os campos de controle. */
const semControle = (r) => r.dados;

export async function listarEscalas(sessao, unidade) {
  const unidades = unidade ? (exigirUnidade(sessao, unidade), [unidade]) : unidadesDaSessao(sessao);
  const listas = await Promise.all(unidades.map(lerIndice));
  return listas.flat().sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm));
}

async function registroPermitido(sessao, id) {
  const r = await lerJson(caminhos.escala(exigirId(id)));
  if (!r) return null;
  if (!podeUnidade(sessao, r.unidade)) throw new ErroEscalas("Sem permissão para esta unidade.", 403);
  return r;
}
export async function lerEscala(sessao, id) {
  const r = await registroPermitido(sessao, id);
  return r ? semControle(r) : null;
}

/** Escalas antigas, sem equipe, contam como da equipe administrativa. */
const daEquipe = (x, equipe) => !equipe || (equipe === "administrativa" ? x.equipe == null || x.equipe === "administrativa" : x.equipe === equipe);

export async function acharEscala(sessao, { ano, mes, unidade, equipe }) {
  const lista = (await listarEscalas(sessao, unidade)).filter((x) => x.ano === Number(ano) && x.mes === Number(mes) && daEquipe(x, equipe));
  const r = lista.sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm))[0];
  return r ? lerEscala(sessao, r.id) : null;
}
export async function ultimaEscala(sessao, { antes, unidade, equipe }) {
  const lista = (await listarEscalas(sessao, unidade)).filter((x) => daEquipe(x, equipe) && (!antes || chaveMes(x) < chaveMes({ ano: Number(antes.year), mes: Number(antes.month) })));
  const r = lista.sort((a, b) => chaveMes(b) - chaveMes(a) || b.atualizadaEm.localeCompare(a.atualizadaEm))[0];
  return r ? lerEscala(sessao, r.id) : null;
}
/** Escalas completas de um mês, de todas as unidades que a pessoa enxerga (painel da rede e relatório). */
export async function escalasDoMes(sessao, ano, mes) {
  const resumos = (await listarEscalas(sessao)).filter((x) => x.ano === Number(ano) && x.mes === Number(mes));
  const regs = await Promise.all(resumos.map((x) => lerJson(caminhos.escala(x.id))));
  return regs.filter(Boolean).map((r) => ({ schedule: r.dados, updatedAt: r.atualizadaEm, updatedBy: r.atualizadaPor?.nome ?? undefined }));
}

export async function salvarEscala(sessao, escala, { marco = null, agora = new Date() } = {}) {
  const novo = registroDaEscala(escala);
  exigirUnidade(sessao, novo.unidade);
  const antes = await lerJson(caminhos.escala(novo.id));
  if (antes && !podeUnidade(sessao, antes.unidade)) throw new ErroEscalas("Sem permissão para esta unidade.", 403);
  const autor = autorDe(sessao);
  const registro = { ...novo, criadaPor: antes?.criadaPor ?? autor, atualizadaPor: autor, atualizadaEm: agora.toISOString() };
  await gravarJson(caminhos.escala(novo.id), registro);
  // se a escala mudou de unidade, ela sai do índice antigo
  if (antes && antes.unidade !== novo.unidade) await gravarIndice(antes.unidade, (await lerIndice(antes.unidade)).filter((x) => x.id !== novo.id));
  await gravarIndice(novo.unidade, [...(await lerIndice(novo.unidade)).filter((x) => x.id !== novo.id), resumoDe(registro)]);
  await registrarVersao({ antes, depois: registro, marco, autor, agora });
}

export async function apagarEscala(sessao, id) {
  const r = await registroPermitido(sessao, id);
  if (!r) return;
  await apagarCaminho(caminhos.escala(r.id));
  await apagarCaminho(caminhos.versoes(r.id));
  await gravarIndice(r.unidade, (await lerIndice(r.unidade)).filter((x) => x.id !== r.id));
}

export async function versoesDaEscala(sessao, id) {
  const r = await registroPermitido(sessao, id);
  if (!r) return [];
  const lista = (await lerJson(caminhos.versoes(r.id))) ?? [];
  return lista.map((v) => ({ id: v.id, status: v.status, generated: v.gerada, milestone: v.marco ?? null, author: v.autor?.nome ?? null, createdAt: v.criadaEm, updatedAt: v.atualizadaEm }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id);
}

/** Torna uma versão antiga a escala atual (registrada como "restaurada") e devolve a escala restaurada. */
export async function restaurarVersao(sessao, id, versaoId, { agora = new Date() } = {}) {
  const r = await registroPermitido(sessao, id);
  if (!r) throw new ErroEscalas("Escala não encontrada.", 404);
  const v = ((await lerJson(caminhos.versoes(r.id))) ?? []).find((x) => x.id === Number(versaoId));
  if (!v) throw new ErroEscalas("Versão não encontrada.", 404);
  const autor = autorDe(sessao);
  const depois = { ...r, dados: v.dados, status: v.status, gerada: v.gerada, confirmadaEm: v.status === "confirmada" ? v.dados?.confirmedAt ?? null : null, elaboradaPor: v.dados?.managerName ?? null, atualizadaPor: autor, atualizadaEm: agora.toISOString() };
  await gravarJson(caminhos.escala(r.id), depois);
  await gravarIndice(r.unidade, [...(await lerIndice(r.unidade)).filter((x) => x.id !== r.id), resumoDe(depois)]);
  await registrarVersao({ antes: r, depois, marco: "restaurada", autor, agora });
  return depois.dados;
}

// ---------- Equipe, funcionamento da unidade e prazo da rede ----------
export async function lerEquipe(sessao, unidade, equipe) {
  exigirUnidade(sessao, unidade);
  const d = await lerJson(caminhos.equipe(unidade, exigirEquipe(equipe)));
  return d ? { roster: d.dados, updatedAt: d.atualizadaEm, updatedBy: d.atualizadaPor?.nome ?? undefined } : null;
}
export async function salvarEquipe(sessao, unidade, equipe, roster, { agora = new Date() } = {}) {
  exigirUnidade(sessao, unidade);
  if (!roster || typeof roster !== "object" || Buffer.byteLength(JSON.stringify(roster)) > MAX_BYTES_ESCALA) throw new ErroEscalas("Cadastro da equipe inválido.", 400);
  await gravarJson(caminhos.equipe(unidade, exigirEquipe(equipe)), { dados: roster, atualizadaPor: autorDe(sessao), atualizadaEm: agora.toISOString() });
}

export async function lerConfigUnidade(sessao, unidade) {
  exigirUnidade(sessao, unidade);
  const d = await lerJson(caminhos.config(unidade));
  return d ? { settings: { ...d.funcionamento, labor: d.jornada ?? null }, updatedAt: d.atualizadaEm, updatedBy: d.atualizadaPor?.nome ?? undefined } : null;
}
/** Só o dono e o Master mudam as regras de jornada; quem não é um deles manda só o funcionamento e a jornada fica como está. */
export async function salvarConfigUnidade(sessao, unidade, settings, { incluirJornada = false, agora = new Date() } = {}) {
  exigirUnidade(sessao, unidade);
  if (!settings || typeof settings !== "object") throw new ErroEscalas("Configuração inválida.", 400);
  const antes = await lerJson(caminhos.config(unidade));
  const funcionamento = { operatingHours: settings.operatingHours, holidayHours: settings.holidayHours, localHolidays: settings.localHolidays ?? [] };
  let jornada = antes?.jornada ?? null;
  if (incluirJornada && settings.labor) {
    if (!ehDonoOuMaster(sessao)) throw new ErroEscalas("Só o Dono ou o Master mudam as regras de jornada.", 403);
    jornada = settings.labor;
  }
  if (Buffer.byteLength(JSON.stringify({ funcionamento, jornada })) > MAX_BYTES_ESCALA) throw new ErroEscalas("Configuração grande demais.", 413);
  await gravarJson(caminhos.config(unidade), { funcionamento, jornada, atualizadaPor: autorDe(sessao), atualizadaEm: agora.toISOString() });
}

export async function lerPrazo() {
  const d = await lerJson(caminhos.rede);
  return d ? { day: d.prazoDia, updatedAt: d.atualizadaEm, updatedBy: d.atualizadaPor?.nome ?? undefined } : { day: 20 };
}
export async function salvarPrazo(sessao, dia, { agora = new Date() } = {}) {
  if (!ehDonoOuMaster(sessao)) throw new ErroEscalas("Só o Dono ou o Master mudam o prazo da rede.", 403);
  const n = Number(dia);
  if (!Number.isInteger(n) || n < 1 || n > 28) throw new ErroEscalas("O prazo é um dia de 1 a 28.", 400);
  await gravarJson(caminhos.rede, { prazoDia: n, atualizadaPor: autorDe(sessao), atualizadaEm: agora.toISOString() });
}

// ---------- Importação do sistema antigo (só o dono) ----------
/**
 * Grava no Atlas o que estava no banco do sistema antigo, na forma das linhas das tabelas (escalas, escalas_versoes, equipes, unidades_config, rede_config).
 * Refazer a importação é seguro: cada item é gravado pelo próprio id. Devolve só contagens (nomes não são impressos).
 */
export async function importarDoSistemaAntigo(sessao, backup) {
  if (sessao?.papel !== "dono") throw new ErroEscalas("Só o dono importa o sistema antigo.", 403);
  const b = backup ?? {};
  const cont = { escalas: 0, versoes: 0, equipes: 0, configs: 0, prazo: 0, ignoradas: 0 };
  const ator = (nome) => ({ nome: nome ?? "Sistema antigo", email: "" });
  const porUnidade = new Map();
  for (const l of b.escalas ?? []) {
    if (!idsDasUnidades.has(l.unidade) || !ID_OK.test(String(l.id ?? ""))) { cont.ignoradas++; continue; }
    const r = { id: l.id, unidade: l.unidade, equipe: l.equipe ?? null, ano: l.ano, mes: l.mes, status: l.status, confirmadaEm: l.confirmada_em ?? null, gerada: !!l.gerada, elaboradaPor: l.elaborada_por ?? null, dados: l.dados, criadaPor: ator(l.elaborada_por), atualizadaPor: ator(l.atualizada_por_nome), atualizadaEm: new Date(l.atualizada_em ?? Date.now()).toISOString() };
    await gravarJson(caminhos.escala(r.id), r);
    (porUnidade.get(r.unidade) ?? porUnidade.set(r.unidade, []).get(r.unidade)).push(resumoDe(r));
    cont.escalas++;
  }
  for (const [unidade, lista] of porUnidade) {
    const ids = new Set(lista.map((x) => x.id));
    await gravarIndice(unidade, [...(await lerIndice(unidade)).filter((x) => !ids.has(x.id)), ...lista]);
  }
  const versoes = new Map();
  for (const v of b.versoes ?? []) {
    if (!ID_OK.test(String(v.escala_id ?? ""))) { cont.ignoradas++; continue; }
    (versoes.get(v.escala_id) ?? versoes.set(v.escala_id, []).get(v.escala_id)).push(v);
  }
  for (const [id, lista] of versoes) {
    lista.sort((a, c) => String(a.criada_em).localeCompare(String(c.criada_em)));
    await gravarJson(caminhos.versoes(id), lista.map((v, i) => ({ id: i + 1, status: v.status, gerada: !!v.gerada, dados: v.dados, marco: v.marco ?? null, autor: ator(v.autor_nome), criadaEm: new Date(v.criada_em).toISOString(), atualizadaEm: new Date(v.atualizada_em ?? v.criada_em).toISOString() })));
    cont.versoes += lista.length;
  }
  for (const e of b.equipes ?? []) {
    if (!idsDasUnidades.has(e.unidade) || !EQUIPES.includes(e.equipe)) { cont.ignoradas++; continue; }
    await gravarJson(caminhos.equipe(e.unidade, e.equipe), { dados: e.dados, atualizadaPor: ator(e.atualizada_por_nome), atualizadaEm: new Date(e.atualizada_em ?? Date.now()).toISOString() });
    cont.equipes++;
  }
  for (const c of b.unidades_config ?? []) {
    if (!idsDasUnidades.has(c.unidade)) { cont.ignoradas++; continue; }
    await gravarJson(caminhos.config(c.unidade), { funcionamento: c.funcionamento, jornada: c.jornada ?? null, atualizadaPor: ator(c.atualizada_por_nome), atualizadaEm: new Date(c.atualizada_em ?? Date.now()).toISOString() });
    cont.configs++;
  }
  const rede = (b.rede_config ?? [])[0];
  if (rede && Number.isInteger(rede.prazo_dia) && rede.prazo_dia >= 1 && rede.prazo_dia <= 28) {
    await gravarJson(caminhos.rede, { prazoDia: rede.prazo_dia, atualizadaPor: ator(rede.atualizada_por_nome), atualizadaEm: new Date(rede.atualizada_em ?? Date.now()).toISOString() });
    cont.prazo++;
  }
  return cont;
}
