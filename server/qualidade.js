// Qualidade: checklists da franqueadora e as visitas às unidades (limpeza, uniforme, conservação...).
// Os modelos (listas de itens) e as visitas (respostas conforme/não conforme, comentário e fotos) ficam no Blob privado; só quem o dono
// liberou usa o menu (verQualidade). A foto é redimensionada no celular antes de subir; aqui só se confere que é um JPEG de tamanho razoável.
import { randomUUID } from "node:crypto";
import { apagarCaminho, gravarBytes, gravarJson, lerBytes, lerJson, listarCaminhos } from "./armazem.js";
import { UNIDADES_DA_REDE } from "./acesso.js";

export const ARQUIVO_MODELOS = "qualidade/modelos.json";
export const PASTA_VISITAS = "qualidade/visitas";
export const PASTA_FOTOS = "qualidade/fotos";
/** Envios dos checklists que a própria unidade preenche (abertura etc.): ficam à parte das visitas da franqueadora e não entram na nota nem no ranking. */
export const PASTA_ENVIOS = "qualidade/envios";
export const MAX_ENVIOS_POR_DIA = 5;
export const FREQUENCIAS = ["visita", "diaria", "semanal", "mensal"];
/** Quando o item pede foto: nunca, só se for não conforme (a evidência) ou sempre que for respondido. */
export const FOTOS = ["nenhuma", "nao_conforme", "sempre"];
/** Tipo do item: o comum (conforme ou não), a lista de equipamentos parados (um registro por equipamento: código, descrição e fotos) ou a data de vencimento
 *  de um documento (o item fica conforme se a data é igual ou depois da data da visita; sem data = não se aplica). */
export const TIPOS = ["conforme", "equipamentos", "vencimento"];
export const MAX_EQUIPAMENTOS = 30;
export const MAX_FOTOS_POR_EQUIPAMENTO = 3;
export const MAX_MODELOS = 40;
export const MAX_ITENS = 80;
export const MAX_FOTOS_POR_ITEM = 10;
export const MAX_FOTOS_POR_VISITA = 100;
export const MAX_COMENTARIO = 1000;
export const MAX_BYTES_FOTO = 700 * 1024;

export class ErroQualidade extends Error {
  constructor(msg, status = 400) { super(msg); this.status = status; }
}

/** O checklist pede uma selfie no check-in? Por padrão a visita da franqueadora pede e o checklist da unidade não; o dono muda no editor. */
export const pedeSelfie = (modelo) => (typeof modelo?.selfie === "boolean" ? modelo.selfie : modelo?.frequencia === "visita");
/** Texto com quebras de linha (instruções): tira espaços sobrando, mantém no máximo uma linha em branco e corta no limite. */
const textoLongo = (v, max) => String(v ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
export const MAX_INSTRUCAO = 600;
/** O item não conforme pede um plano de ação (o quê, até quando, quem)? Por padrão a visita da franqueadora pede e o checklist da unidade não; o dono muda no editor. */
export const exigePlano = (modelo) => (typeof modelo?.plano === "boolean" ? modelo.plano : modelo?.frequencia === "visita");
const texto = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const ehData = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const dataDeVencimento = (s) => { const t = String(s ?? ""); return ehData(t) && t >= "2000-01-01" && t <= "2100-12-31" ? t : ""; };
const horaValida = (h) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(h ?? "")) ? h : "");
const ehMes = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

/** Valida e normaliza um modelo vindo da tela. Item novo ganha id; item que já tinha id o mantém (as visitas antigas guardam o texto de cada item). */
export function normalizarModelo(bruto, agora = new Date()) {
  const nome = texto(bruto?.nome, 80);
  if (!nome) throw new ErroQualidade("Dê um nome ao checklist.");
  const frequencia = FREQUENCIAS.includes(bruto?.frequencia) ? bruto.frequencia : "visita";
  if (!Array.isArray(bruto?.itens) || bruto.itens.length === 0) throw new ErroQualidade("Coloque pelo menos um item no checklist.");
  if (bruto.itens.length > MAX_ITENS) throw new ErroQualidade(`Um checklist tem no máximo ${MAX_ITENS} itens.`);
  const ids = new Set();
  const itens = bruto.itens.map((i) => {
    const t = texto(i?.texto, 200);
    if (!t) throw new ErroQualidade("Todo item precisa de um texto.");
    let id = typeof i?.id === "string" && /^[a-z0-9-]{4,40}$/.test(i.id) && !ids.has(i.id) ? i.id : randomUUID().slice(0, 8);
    ids.add(id);
    const peso = Math.min(10, Math.max(1, Math.round(Number(i?.peso) || 1)));
    const foto = FOTOS.includes(i?.foto) ? i.foto : "nenhuma";
    const tipo = TIPOS.includes(i?.tipo) ? i.tipo : "conforme";
    // Unidades em que o item NÃO vale (a unidade nova já nasce com todos os itens); só nomes de unidades da rede, sem repetir.
    const foraDe = [...new Set((Array.isArray(i?.foraDe) ? i.foraDe : []).filter((u) => UNIDADES_DA_REDE.includes(u)))];
    // Unidades em que o item SÓ vale (o item que a unidade pediu e o dono liberou só para ela); sem a marca, vale para todas.
    const soEm = [...new Set((Array.isArray(i?.soEm) ? i.soEm : []).filter((u) => UNIDADES_DA_REDE.includes(u)))];
    const instrucao = textoLongo(i?.instrucao, MAX_INSTRUCAO);
    return { id, grupo: texto(i?.grupo, 60), texto: t, peso, foto, tipo, ...(instrucao ? { instrucao } : {}), ...(foraDe.length ? { foraDe } : {}), ...(soEm.length ? { soEm } : {}) };
  });
  const id = typeof bruto?.id === "string" && /^[a-z0-9-]{4,40}$/.test(bruto.id) ? bruto.id : randomUUID().slice(0, 8);
  return { id, nome, descricao: texto(bruto?.descricao, 200), frequencia, itens, ativo: bruto?.ativo !== false, ...(typeof bruto?.selfie === "boolean" ? { selfie: bruto.selfie } : {}), ...(typeof bruto?.plano === "boolean" ? { plano: bruto.plano } : {}), atualizadoEm: agora.toISOString() };
}

/** Nota da visita: % dos pontos conseguidos entre os itens que se aplicam, cada item com o seu peso (os "não se aplica" ficam fora). null se nenhum se aplica. */
export function notaDaVisita(respostas) {
  const validas = respostas.filter((r) => r.conforme === true || r.conforme === false);
  const total = validas.reduce((t, r) => t + (r.peso ?? 1), 0);
  if (!total) return null;
  const ganhos = validas.filter((r) => r.conforme).reduce((t, r) => t + (r.peso ?? 1), 0);
  return Math.round((ganhos / total) * 1000) / 10;
}

/** Valida a visita contra o modelo (os itens e o texto vêm do modelo, não da tela) e monta o registro gravado. */
export function montarVisita(bruto, modelo, avaliador, agora = new Date()) {
  if (!modelo) throw new ErroQualidade("Esse checklist não existe mais.", 404);
  const unidade = texto(bruto?.unidade, 80);
  if (!UNIDADES_DA_REDE.includes(unidade)) throw new ErroQualidade("Escolha uma unidade da rede.");
  const data = texto(bruto?.data, 10);
  if (!ehData(data)) throw new ErroQualidade("Data inválida.");
  if (Date.parse(`${data}T00:00:00Z`) > agora.getTime() + 36 * 3600 * 1000) throw new ErroQualidade("A data da visita não pode ser no futuro.");
  const enviadas = new Map((Array.isArray(bruto?.respostas) ? bruto.respostas : []).map((r) => [r?.itemId, r]));
  // Só entram os itens que valem para esta unidade: o que não vale nem é perguntado nem conta na nota.
  const itensDaUnidade = modelo.itens.filter((i) => !(i.foraDe ?? []).includes(unidade) && (!(i.soEm ?? []).length || i.soEm.includes(unidade)));
  if (!itensDaUnidade.length) throw new ErroQualidade("Nenhum item deste checklist vale para essa unidade.");
  const respostas = itensDaUnidade.map((item) => {
    const r = enviadas.get(item.id);
    const tipo = item.tipo ?? "conforme";
    // Documento com validade: a pessoa informa só a data; o Atlas decide se está em dia (vencimento igual ou depois da data da visita).
    const vencimento = tipo === "vencimento" ? dataDeVencimento(r?.vencimento) : "";
    const conforme = tipo === "vencimento" ? (vencimento ? vencimento >= data : null) : r?.conforme === true ? true : r?.conforme === false ? false : null;
    const fotos = Array.isArray(r?.fotos) ? r.fotos.filter((f) => typeof f === "string" && /^[0-9a-f-]{36}$/.test(f)).slice(0, MAX_FOTOS_POR_ITEM) : [];
    const comentario = texto(r?.comentario, MAX_COMENTARIO);
    const idsDeFoto = (lista, max) => (Array.isArray(lista) ? lista.filter((f) => typeof f === "string" && /^[0-9a-f-]{36}$/.test(f)).slice(0, max) : []);
    let equipamentos = [];
    if (tipo === "equipamentos" && conforme === false) {
      equipamentos = (Array.isArray(r?.equipamentos) ? r.equipamentos : []).slice(0, MAX_EQUIPAMENTOS)
        .map((e) => ({ codigo: texto(e?.codigo, 40), descricao: texto(e?.descricao, 200), fotos: idsDeFoto(e?.fotos, MAX_FOTOS_POR_EQUIPAMENTO) }))
        .filter((e) => e.codigo);
      if (!equipamentos.length) throw new ErroQualidade(`Registre o código de cada equipamento parado em "${item.texto}".`);
      if (item.foto !== "nenhuma" && equipamentos.some((e) => e.fotos.length === 0)) throw new ErroQualidade(`Cada equipamento parado pede uma foto (${equipamentos.find((e) => e.fotos.length === 0).codigo}).`);
    } else {
      // "Plano de ação obrigatório" do roteiro antigo: item não conforme precisa dizer o que corrigir (o documento vencido se explica pela data).
      if (conforme === false && !comentario && tipo !== "vencimento" && !exigePlano(modelo)) throw new ErroQualidade(`Diga o que precisa ser corrigido em "${item.texto}".`);
      if ((item.foto === "sempre" && conforme !== null && fotos.length === 0) || (item.foto === "nao_conforme" && conforme === false && fotos.length === 0)) throw new ErroQualidade(`O item "${item.texto}" pede uma foto.`);
    }
    return { itemId: item.id, grupo: item.grupo, texto: item.texto, peso: item.peso ?? 1, tipo, conforme, comentario, fotos, ...(tipo === "equipamentos" ? { equipamentos } : {}), ...(tipo === "vencimento" ? { vencimento } : {}) };
  });
  if (respostas.every((r) => r.conforme === null)) throw new ErroQualidade("Responda pelo menos um item.");
  if (respostas.reduce((t, r) => t + r.fotos.length + (r.equipamentos ?? []).reduce((u, e) => u + e.fotos.length, 0), 0) > MAX_FOTOS_POR_VISITA) throw new ErroQualidade(`Uma visita aceita até ${MAX_FOTOS_POR_VISITA} fotos.`);
  return {
    id: randomUUID(), modeloId: modelo.id, modeloNome: modelo.nome, unidade, data, mes: data.slice(0, 7),
    avaliador: { nome: texto(avaliador?.nome, 80), email: texto(avaliador?.email, 120) },
    chegada: horaValida(bruto?.chegada), saida: horaValida(bruto?.saida),
    respostas, observacao: texto(bruto?.observacao, 500), nota: notaDaVisita(respostas), criadoEm: agora.toISOString(),
  };
}

/** Foto em base64 (JPEG já reduzido pelo celular) -> bytes, ou erro. */
export function decodificarFoto(base64, maxBytes = MAX_BYTES_FOTO) {
  const limpo = String(base64 ?? "").replace(/^data:image\/jpeg;base64,/, "");
  if (!/^[A-Za-z0-9+/=]+$/.test(limpo)) throw new ErroQualidade("Foto inválida.");
  const bytes = Buffer.from(limpo, "base64");
  if (bytes.length === 0 || bytes.length > maxBytes) throw new ErroQualidade("A foto é grande demais. Tire de novo ou reduza o tamanho.");
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) throw new ErroQualidade("Só aceito foto em JPEG.");
  return bytes;
}

export async function lerModelos() {
  const m = await lerJson(ARQUIVO_MODELOS);
  return Array.isArray(m) ? m : [];
}
/** Tira o peso de cada item (o peso é só do dono: nem Master nem quem edita a qualidade o vê). */
export const semPesosNoModelo = (m) => ({ ...m, itens: (m.itens ?? []).map(({ peso, ...i }) => i) });
/** Nota de cada grupo de itens da visita (mesma conta da nota geral, com os pesos), para filtrar e acompanhar por grupo sem expor o peso. */
export function notasPorGrupo(respostas) {
  const grupos = [...new Set((respostas ?? []).map((r) => r.grupo).filter(Boolean))];
  return Object.fromEntries(grupos.map((g) => [g, notaDaVisita((respostas ?? []).filter((r) => r.grupo === g))]));
}
export const comNotasPorGrupo = (v) => ({ ...v, notasPorGrupo: notasPorGrupo(v.respostas) });
export const semPesosNaVisita = (v) => { const { respostas, ...resto } = comNotasPorGrupo(v); return { ...resto, respostas: (respostas ?? []).map(({ peso, ...r }) => r) }; };

/**
 * `preservarPesos`: quem edita sem ser o dono não vê os pesos, então o que ele manda não os traz; os itens que já existem mantêm o peso guardado e os novos
 * começam em 1 (o dono ajusta depois).
 */
export async function salvarModelo(bruto, { preservarPesos = false } = {}) {
  const lista = await lerModelos();
  if (preservarPesos) {
    const guardado = lista.find((m) => m.id === bruto?.id);
    bruto = { ...bruto, itens: (Array.isArray(bruto?.itens) ? bruto.itens : []).map((i) => ({ ...i, peso: guardado?.itens.find((x) => x.id === i?.id)?.peso ?? 1 })) };
  }
  const novo = normalizarModelo(bruto);
  const i = lista.findIndex((m) => m.id === novo.id);
  if (i < 0 && lista.length >= MAX_MODELOS) throw new ErroQualidade(`O limite é de ${MAX_MODELOS} checklists.`);
  if (i >= 0) lista[i] = novo; else lista.push(novo);
  await gravarJson(ARQUIVO_MODELOS, lista);
  return novo;
}
export async function apagarModelo(id) {
  const lista = await lerModelos();
  if (!lista.some((m) => m.id === id)) throw new ErroQualidade("Checklist não encontrado.", 404);
  await gravarJson(ARQUIVO_MODELOS, lista.filter((m) => m.id !== id)); // as visitas já feitas guardam o próprio texto e continuam
}

export async function lerVisitas(mes) {
  const v = await lerJson(`${PASTA_VISITAS}/${mes}.json`);
  return Array.isArray(v) ? v : [];
}
/** Visitas dos últimos `meses` meses (do mais novo para o mais velho), a partir de `agora`. */
export async function visitasRecentes(meses = 12, agora = new Date()) {
  const out = [];
  for (let i = 0; i < meses; i += 1) {
    const d = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - i, 1));
    out.push(...(await lerVisitas(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`)));
  }
  return out.sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm));
}
/**
 * Visita da franqueadora: exige o check-in feito antes (o horário e a localização vêm do servidor e do aparelho, não digitados, e a selfie da pessoa na unidade)
 * e registra o check-out no envio. A data da visita é sempre a do check-in: ninguém escolhe data, nem retroativa nem futura.
 */
export async function salvarVisita(bruto, avaliador, agora = new Date(), contexto = {}) {
  const modelo = (await lerModelos()).find((m) => m.id === bruto?.modeloId);
  if (!modelo) throw new ErroQualidade("Esse checklist não existe mais.", 404);
  const unidade = texto(bruto?.unidade, 80);
  const ck = await buscarCheckin(bruto?.checkinId, { unidade, modeloId: modelo.id, email: avaliador?.email, tipo: "visita" }, agora);
  const visita = montarVisita({ ...bruto, data: dataBrasilia(ck.em), chegada: "", saida: "" }, modelo, avaliador, agora);
  const planos = montarPlanos(bruto?.planos, visita, modelo, avaliador, agora);
  await anexarCheckInOut(visita, ck, bruto, contexto.ip, agora);
  const lista = await lerVisitas(visita.mes);
  await gravarJson(`${PASTA_VISITAS}/${visita.mes}.json`, [...lista, visita]);
  if (planos.length) await gravarJson(ARQUIVO_PLANOS, [...(await lerPlanos()), ...planos].slice(-MAX_PLANOS_GUARDADOS));
  await marcarCheckinUsado(ck.id);
  return visita;
}
export async function apagarVisita(id, mes) {
  if (!ehMes(String(mes))) throw new ErroQualidade("Mês inválido.");
  const lista = await lerVisitas(mes);
  const v = lista.find((x) => x.id === id);
  if (!v) throw new ErroQualidade("Visita não encontrada.", 404);
  await gravarJson(`${PASTA_VISITAS}/${mes}.json`, lista.filter((x) => x.id !== id));
  for (const r of v.respostas) {
    for (const f of r.fotos ?? []) await apagarCaminho(`${PASTA_FOTOS}/${f}.jpg`);
    for (const e of r.equipamentos ?? []) for (const f of e.fotos ?? []) await apagarCaminho(`${PASTA_FOTOS}/${f}.jpg`);
  }
}

export async function salvarFoto(base64) {
  const bytes = decodificarFoto(base64);
  const id = randomUUID();
  await gravarBytes(`${PASTA_FOTOS}/${id}.jpg`, bytes, "image/jpeg");
  return id;
}
export async function lerFoto(id) {
  if (!/^[0-9a-f-]{36}$/.test(String(id))) throw new ErroQualidade("Foto inválida.");
  const bytes = await lerBytes(`${PASTA_FOTOS}/${id}.jpg`);
  if (!bytes) throw new ErroQualidade("Foto não encontrada.", 404);
  return bytes;
}

/** Data de hoje em Brasília (AAAA-MM-DD). */
export const hojeBrasilia = (agora = new Date()) => new Date(agora.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);

/** Checklists que a unidade preenche: os em uso que não são "na visita da franqueadora". */
export const modelosDaUnidade = (modelos) => modelos.filter((m) => m.ativo !== false && m.frequencia !== "visita");

export async function lerEnvios(mes) {
  const v = await lerJson(`${PASTA_ENVIOS}/${mes}.json`);
  return Array.isArray(v) ? v : [];
}
/** Envios dos últimos `dias` dias (do mais novo para o mais velho), opcionalmente só de algumas unidades. */
export async function enviosRecentes(dias = 45, agora = new Date(), unidades = null) {
  const desde = new Date(agora.getTime() - dias * 86400000);
  const meses = new Set([hojeBrasilia(agora).slice(0, 7), hojeBrasilia(desde).slice(0, 7)]);
  const out = [];
  for (const mes of meses) out.push(...(await lerEnvios(mes)));
  const corte = hojeBrasilia(desde);
  return out.filter((e) => e.data >= corte && (!unidades || unidades.includes(e.unidade))).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

/**
 * Envio da unidade: valida como uma visita (mesmos itens, fotos e regras), mas a data é sempre a de hoje, a unidade tem de ser uma das da pessoa e
 * o checklist tem de ser um dos que a unidade preenche. Quem enviou fica no registro.
 */
export async function salvarEnvio(bruto, autor, unidadesPermitidas, agora = new Date(), contexto = {}) {
  const modelo = modelosDaUnidade(await lerModelos()).find((m) => m.id === bruto?.modeloId);
  if (!modelo) throw new ErroQualidade("Esse checklist não está disponível para a unidade.", 404);
  const unidade = texto(bruto?.unidade, 80);
  if (!unidadesPermitidas.includes(unidade)) throw new ErroQualidade("Você só envia o checklist da sua unidade.", 403);
  const ck = await buscarCheckin(bruto?.checkinId, { unidade, modeloId: modelo.id, email: autor?.email, tipo: "unidade" }, agora);
  const hoje = dataBrasilia(ck.em);
  const envio = { ...montarVisita({ ...bruto, unidade, data: hoje, chegada: "", saida: "" }, modelo, autor, agora), origem: "unidade" };
  await anexarCheckInOut(envio, ck, bruto, contexto.ip, agora);
  const lista = await lerEnvios(envio.mes);
  if (lista.filter((e) => e.unidade === unidade && e.data === hoje && e.modeloId === modelo.id).length >= MAX_ENVIOS_POR_DIA) throw new ErroQualidade(`O limite é de ${MAX_ENVIOS_POR_DIA} envios por dia deste checklist.`);
  await gravarJson(`${PASTA_ENVIOS}/${envio.mes}.json`, [...lista, envio]);
  await marcarCheckinUsado(ck.id);
  return envio;
}
export async function apagarEnvio(id, mes) {
  if (!ehMes(String(mes))) throw new ErroQualidade("Mês inválido.");
  const lista = await lerEnvios(mes);
  const e = lista.find((x) => x.id === id);
  if (!e) throw new ErroQualidade("Envio não encontrado.", 404);
  await gravarJson(`${PASTA_ENVIOS}/${mes}.json`, lista.filter((x) => x.id !== id));
  for (const r of e.respostas) {
    for (const f of r.fotos ?? []) await apagarCaminho(`${PASTA_FOTOS}/${f}.jpg`);
    for (const q of r.equipamentos ?? []) for (const f of q.fotos ?? []) await apagarCaminho(`${PASTA_FOTOS}/${f}.jpg`);
  }
}
/** A foto está num envio recente de uma das unidades? (a unidade só vê as fotos dos próprios envios) */
export async function fotoDeEnvioDe(id, unidades, agora = new Date()) {
  const envios = await enviosRecentes(90, agora, unidades);
  if (envios.some((e) => e.respostas.some((r) => (r.fotos ?? []).includes(id) || (r.equipamentos ?? []).some((q) => (q.fotos ?? []).includes(id))))) return true;
  // fotos de um plano de ação da unidade (o que ela mandou como prova de que corrigiu)
  return (await lerPlanos()).some((p) => unidades.includes(p.unidade) && (p.historico ?? []).some((h) => (h.fotos ?? []).includes(id)));
}

// ---------- pedidos de item novo (a unidade pede, o dono libera) ----------
export const ARQUIVO_PEDIDOS = "qualidade/pedidos.json";
export const MAX_PEDIDOS_PENDENTES_POR_UNIDADE = 5;
const MAX_PEDIDOS_GUARDADOS = 500;

export async function lerPedidos() {
  const p = await lerJson(ARQUIVO_PEDIDOS);
  return Array.isArray(p) ? p : [];
}

/** A unidade descreve o item que falta no checklist dela; o pedido fica pendente até o dono decidir. */
export async function criarPedido(bruto, autor, unidadesPermitidas, agora = new Date()) {
  const modelo = modelosDaUnidade(await lerModelos()).find((m) => m.id === bruto?.modeloId);
  if (!modelo) throw new ErroQualidade("Esse checklist não está disponível para a unidade.", 404);
  const unidade = texto(bruto?.unidade, 80);
  if (!unidadesPermitidas.includes(unidade)) throw new ErroQualidade("Você só pede item para a sua unidade.", 403);
  const item = texto(bruto?.texto, 200);
  if (!item) throw new ErroQualidade("Descreva o que precisa ser conferido.");
  const lista = await lerPedidos();
  if (lista.filter((p) => p.unidade === unidade && p.status === "pendente").length >= MAX_PEDIDOS_PENDENTES_POR_UNIDADE) throw new ErroQualidade(`Há ${MAX_PEDIDOS_PENDENTES_POR_UNIDADE} pedidos esperando resposta. Aguarde antes de enviar outro.`);
  const pedido = {
    id: randomUUID(), unidade, modeloId: modelo.id, modeloNome: modelo.nome, texto: item, motivo: texto(bruto?.motivo, 300),
    solicitante: { nome: texto(autor?.nome, 80), email: texto(autor?.email, 120) }, status: "pendente", criadoEm: agora.toISOString(),
  };
  await gravarJson(ARQUIVO_PEDIDOS, [...lista, pedido].slice(-MAX_PEDIDOS_GUARDADOS));
  return pedido;
}

/**
 * O dono decide um pedido. Aprovar põe o item no checklist (já pronto para a unidade, com os ajustes do dono: texto, grupo, peso e regra da foto) e vale
 * só para a unidade que pediu ou para todas. Recusar guarda a resposta, que a unidade vê. Pedido decidido não muda.
 */
export async function decidirPedido(id, bruto, decisor, agora = new Date()) {
  const lista = await lerPedidos();
  const i = lista.findIndex((p) => p.id === id);
  if (i < 0) throw new ErroQualidade("Pedido não encontrado.", 404);
  const pedido = lista[i];
  if (pedido.status !== "pendente") throw new ErroQualidade("Esse pedido já foi respondido.", 409);
  const resposta = texto(bruto?.resposta, 300);
  const decisao = { por: texto(decisor?.nome, 80), em: agora.toISOString(), resposta };
  if (bruto?.decisao === "recusar") {
    lista[i] = { ...pedido, status: "recusado", decisao };
  } else if (bruto?.decisao === "aprovar") {
    const modelo = (await lerModelos()).find((m) => m.id === pedido.modeloId);
    if (!modelo) throw new ErroQualidade("O checklist desse pedido não existe mais.", 409);
    const escopo = bruto?.escopo === "todas" ? "todas" : "unidade";
    const novo = { texto: bruto?.item?.texto || pedido.texto, grupo: bruto?.item?.grupo ?? "", peso: bruto?.item?.peso, foto: bruto?.item?.foto, tipo: "conforme", ...(escopo === "unidade" ? { soEm: [pedido.unidade] } : {}) };
    const salvo = await salvarModelo({ ...modelo, itens: [...modelo.itens, novo] });
    const criado = salvo.itens[salvo.itens.length - 1];
    lista[i] = { ...pedido, status: "aprovado", decisao: { ...decisao, escopo, itemId: criado.id } };
  } else {
    throw new ErroQualidade("Escolha aprovar ou recusar.");
  }
  await gravarJson(ARQUIVO_PEDIDOS, lista);
  return lista[i];
}

// ---------- check-in, check-out e local da unidade ----------
export const ARQUIVO_CHECKINS = "qualidade/checkins.json";
export const ARQUIVO_LOCAIS = "qualidade/locais.json";
/** Distância da unidade até a qual o check-in conta como "na unidade" (a precisão do aparelho, até 300 m, é descontada). */
export const RAIO_PADRAO_M = 300;
export const VALIDADE_CHECKIN_MS = 12 * 3600 * 1000;
/** Selfie do check-in: pequena (o aparelho a reduz) e guardada só por alguns meses, para o armazenamento ficar leve e barato. */
export const PASTA_SELFIES = "qualidade/selfies";
export const MAX_BYTES_SELFIE = 150 * 1024;
export const SELFIE_RETENCAO_MESES = 3;

const rad = (g) => (g * Math.PI) / 180;
/** Distância em metros entre dois pontos { lat, lng } (fórmula de haversine). */
export function distanciaM(a, b) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}
/** { lat, lng, precisao } do aparelho -> valores válidos (6 casas) ou null. Sem localização, o registro fica só com o horário e o IP. */
export function normalizarLocalizacao(l) {
  const lat = Number(l?.lat), lng = Number(l?.lng);
  if (!l || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const precisao = Math.min(Math.max(0, Math.round(Number(l?.precisao) || 0)), 100000);
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, precisao };
}
export const dataBrasilia = (iso) => new Date(Date.parse(iso) - 3 * 3600 * 1000).toISOString().slice(0, 10);
const horaBrasilia = (iso) => new Date(Date.parse(iso) - 3 * 3600 * 1000).toISOString().slice(11, 16);

export async function lerLocais() {
  const l = await lerJson(ARQUIVO_LOCAIS);
  return l && typeof l === "object" && !Array.isArray(l) ? l : {};
}
/** O dono marca onde cada unidade fica (latitude, longitude e o raio aceito), para comparar com o local dos check-ins. */
export async function salvarLocal(unidade, bruto) {
  if (!UNIDADES_DA_REDE.includes(unidade)) throw new ErroQualidade("Unidade inválida.");
  const loc = normalizarLocalizacao(bruto);
  if (!loc) throw new ErroQualidade("Coordenadas inválidas.");
  const raio = Math.min(2000, Math.max(50, Math.round(Number(bruto?.raio) || RAIO_PADRAO_M)));
  const locais = await lerLocais();
  locais[unidade] = { lat: loc.lat, lng: loc.lng, raio };
  await gravarJson(ARQUIVO_LOCAIS, locais);
  return locais[unidade];
}
export async function apagarLocal(unidade) {
  const locais = await lerLocais();
  delete locais[unidade];
  await gravarJson(ARQUIVO_LOCAIS, locais);
}

/** Distância até a unidade e se está fora do raio (a precisão do aparelho, até 300 m, é descontada); vazio sem localização ou sem o local da unidade marcado. */
function situacaoDoLocal(loc, unidade, locais) {
  const alvo = locais[unidade];
  if (!loc || !alvo) return {};
  const d = Math.round(distanciaM(loc, alvo));
  return { distanciaM: d, foraDoLocal: d - Math.min(loc.precisao || 0, 300) > (alvo.raio ?? RAIO_PADRAO_M) };
}

export async function lerCheckins() {
  const c = await lerJson(ARQUIVO_CHECKINS);
  return Array.isArray(c) ? c : [];
}

/**
 * Check-in: quando a pessoa começa o checklist. O horário é o do servidor (não dá para digitar) e a localização vem do aparelho, com a permissão dela; sem
 * localização fica o IP. `tipo` "visita" (franqueadora) ou "unidade" (o gestor da própria unidade).
 */
export async function criarCheckin(bruto, { autor, tipo, ip, unidadesPermitidas }, agora = new Date()) {
  const unidade = texto(bruto?.unidade, 80);
  if (!UNIDADES_DA_REDE.includes(unidade)) throw new ErroQualidade("Escolha uma unidade da rede.");
  if (tipo === "unidade" && !(unidadesPermitidas ?? []).includes(unidade)) throw new ErroQualidade("Você só faz o checklist da sua unidade.", 403);
  const modelos = await lerModelos();
  const modelo = (tipo === "unidade" ? modelosDaUnidade(modelos) : modelos.filter((m) => m.ativo !== false)).find((m) => m.id === bruto?.modeloId);
  if (!modelo) throw new ErroQualidade("Esse checklist não está disponível.", 404);
  const loc = normalizarLocalizacao(bruto?.loc);
  // Selfie da pessoa na unidade, quando o checklist pede: sem ela não há check-in.
  let selfie;
  if (pedeSelfie(modelo)) {
    if (!bruto?.selfie) throw new ErroQualidade("Este checklist pede uma selfie no check-in, tirada na unidade.");
    const bytes = decodificarFoto(bruto.selfie, MAX_BYTES_SELFIE);
    const mes = dataBrasilia(agora.toISOString()).slice(0, 7);
    const id = randomUUID();
    await gravarBytes(`${PASTA_SELFIES}/${mes}/${id}.jpg`, bytes, "image/jpeg");
    selfie = `${mes}_${id}`;
  }
  const registro = {
    id: randomUUID(), tipo, unidade, modeloId: modelo.id, ...(selfie ? { selfie } : {}), email: texto(autor?.email, 120), nome: texto(autor?.nome, 80), em: agora.toISOString(),
    ip: texto(ip, 64), loc, ...situacaoDoLocal(loc, unidade, await lerLocais()), usado: false,
  };
  const recentes = (await lerCheckins()).filter((c) => agora.getTime() - Date.parse(c.em) < 3 * 86400000);
  await gravarJson(ARQUIVO_CHECKINS, [...recentes, registro]);
  await podarSelfies(agora);
  return { id: registro.id, em: registro.em, comLocalizacao: Boolean(loc), comSelfie: Boolean(selfie), distanciaM: registro.distanciaM, foraDoLocal: registro.foraDoLocal };
}

/** Confere que o check-in existe, é da mesma pessoa, unidade, checklist e tipo, não foi usado e tem menos de 12 horas. */
async function buscarCheckin(id, { unidade, modeloId, email, tipo }, agora) {
  const c = (await lerCheckins()).find((x) => x.id === id);
  if (!c) throw new ErroQualidade("Faça o check-in antes de começar o checklist.");
  if (c.usado) throw new ErroQualidade("Esse check-in já foi usado: faça outro para um novo checklist.");
  if (c.tipo !== tipo || c.unidade !== unidade || c.modeloId !== modeloId || c.email !== texto(email, 120)) throw new ErroQualidade("Esse check-in é de outro checklist ou de outra pessoa.");
  if (agora.getTime() - Date.parse(c.em) > VALIDADE_CHECKIN_MS) throw new ErroQualidade("O check-in venceu (mais de 12 horas): faça outro.");
  return c;
}
async function marcarCheckinUsado(id) {
  const lista = await lerCheckins();
  await gravarJson(ARQUIVO_CHECKINS, lista.map((c) => (c.id === id ? { ...c, usado: true } : c)));
}

/** Grava no registro o check-in (do servidor e do aparelho) e o check-out (agora): horários, localização, IP, distância da unidade e a duração. */
async function anexarCheckInOut(registro, ck, bruto, ip, agora) {
  const locais = await lerLocais();
  const locSaida = normalizarLocalizacao(bruto?.localizacaoSaida);
  registro.checkin = { em: ck.em, loc: ck.loc ?? null, ip: ck.ip, ...(ck.selfie ? { selfie: ck.selfie } : {}), ...(ck.distanciaM !== undefined ? { distanciaM: ck.distanciaM, foraDoLocal: ck.foraDoLocal } : {}) };
  registro.checkout = { em: agora.toISOString(), loc: locSaida, ip: texto(ip, 64), ...situacaoDoLocal(locSaida, registro.unidade, locais) };
  registro.chegada = horaBrasilia(ck.em);
  registro.saida = horaBrasilia(registro.checkout.em);
  registro.duracaoMin = Math.max(0, Math.round((agora.getTime() - Date.parse(ck.em)) / 60000));
}

/** Apaga as selfies de meses fora do prazo (mês atual mais os 3 anteriores ficam), uma pasta por mês: poucas chamadas por check-in. */
export async function podarSelfies(agora = new Date()) {
  const hoje = dataBrasilia(agora.toISOString());
  const [a, m] = hoje.split("-").map(Number);
  for (let i = SELFIE_RETENCAO_MESES + 1; i <= SELFIE_RETENCAO_MESES + 3; i += 1) {
    const d = new Date(Date.UTC(a, m - 1 - i, 1));
    const mes = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    for (const caminho of await listarCaminhos(`${PASTA_SELFIES}/${mes}/`)) await apagarCaminho(caminho);
  }
}
/** Lê uma selfie pelo código "AAAA-MM_uuid" (só dono e quem edita a qualidade a veem). */
export async function lerSelfie(codigo) {
  const m = /^(\d{4}-\d{2})_([0-9a-f-]{36})$/.exec(String(codigo));
  if (!m) throw new ErroQualidade("Selfie inválida.");
  const bytes = await lerBytes(`${PASTA_SELFIES}/${m[1]}/${m[2]}.jpg`);
  if (!bytes) throw new ErroQualidade("Selfie não encontrada (guardamos por poucos meses).", 404);
  return bytes;
}

// ---------- planos de ação (o que corrigir depois de uma visita) ----------
export const ARQUIVO_PLANOS = "qualidade/planos.json";
const MAX_PLANOS_GUARDADOS = 2000;

export async function lerPlanos() {
  const p = await lerJson(ARQUIVO_PLANOS);
  return Array.isArray(p) ? p : [];
}

/**
 * Planos de ação da visita da franqueadora: um por item "não conforme" (o quê, até quando, quem). Se o checklist exige plano, todo item não conforme precisa
 * de um e não pode haver plano de item que não foi marcado como não conforme. Quem cria o plano é quem confirma a correção depois.
 */
export function montarPlanos(brutos, visita, modelo, autor, agora = new Date()) {
  const lista = Array.isArray(brutos) ? brutos : [];
  const naoConformes = visita.respostas.filter((r) => r.conforme === false);
  const porItem = new Map(lista.map((p) => [p?.itemId, p]));
  if (exigePlano(modelo)) {
    const falta = naoConformes.find((r) => !porItem.has(r.itemId));
    if (falta) throw new ErroQualidade(`Crie o plano de ação do item não conforme: "${falta.texto}".`);
  }
  const hoje = dataBrasilia(agora.toISOString());
  const limite = new Date(Date.parse(`${hoje}T00:00:00Z`) + 366 * 86400000).toISOString().slice(0, 10);
  const out = [];
  for (const r of naoConformes) {
    const p = porItem.get(r.itemId);
    if (!p) continue;
    const oQue = texto(p.oQue, 300);
    if (oQue.length < 3) throw new ErroQualidade(`Diga o que será feito no item "${r.texto}".`);
    const prazo = texto(p.prazo, 10);
    if (!ehData(prazo) || prazo < hoje || prazo > limite) throw new ErroQualidade(`Escolha um prazo de hoje até 1 ano para o item "${r.texto}".`);
    out.push({
      id: randomUUID(), unidade: visita.unidade, visitaId: visita.id, visitaMes: visita.mes, itemId: r.itemId, itemTexto: r.texto, modeloNome: visita.modeloNome,
      oQue, prazo, responsavel: texto(p.responsavel, 80), como: texto(p.como, 300), criadoPor: { nome: visita.avaliador.nome, email: visita.avaliador.email }, criadoEm: agora.toISOString(),
      status: "aberto", historico: [{ em: agora.toISOString(), por: { nome: visita.avaliador.nome, email: visita.avaliador.email }, acao: "criado", texto: oQue, fotos: [] }],
    });
  }
  for (const id of porItem.keys()) if (!naoConformes.some((r) => r.itemId === id)) throw new ErroQualidade("Só item marcado como não conforme tem plano de ação.");
  return out;
}

/** A unidade diz o que fez para corrigir (e manda foto, se quiser): o plano vai para a validação de quem o criou. */
export async function marcarPlanoFeito(id, bruto, autor, unidadesPermitidas, agora = new Date()) {
  const lista = await lerPlanos();
  const i = lista.findIndex((p) => p.id === id);
  if (i < 0) throw new ErroQualidade("Plano não encontrado.", 404);
  const p = lista[i];
  if (!unidadesPermitidas.includes(p.unidade)) throw new ErroQualidade("Esse plano é de outra unidade.", 403);
  if (p.status !== "aberto") throw new ErroQualidade("Esse plano não está esperando a correção da unidade.", 409);
  const t = texto(bruto?.texto, 300);
  if (t.length < 3) throw new ErroQualidade("Diga o que foi feito.");
  const fotos = (Array.isArray(bruto?.fotos) ? bruto.fotos : []).filter((f) => typeof f === "string" && /^[0-9a-f-]{36}$/.test(f)).slice(0, 3);
  lista[i] = { ...p, status: "validacao", historico: [...p.historico, { em: agora.toISOString(), por: { nome: texto(autor?.nome, 80), email: texto(autor?.email, 120) }, acao: "feito", texto: t, fotos }] };
  await gravarJson(ARQUIVO_PLANOS, lista);
  return lista[i];
}

/**
 * Quem criou o plano (ou o dono, se essa pessoa não estiver disponível) confirma a correção, e o plano conclui, ou devolve com um motivo, e ele volta para a
 * unidade. O gerente da unidade nunca valida o próprio plano.
 */
export async function validarPlano(id, bruto, decisor, agora = new Date()) {
  const lista = await lerPlanos();
  const i = lista.findIndex((p) => p.id === id);
  if (i < 0) throw new ErroQualidade("Plano não encontrado.", 404);
  const p = lista[i];
  if (p.status !== "validacao") throw new ErroQualidade("Esse plano não está esperando validação.", 409);
  if (!decisor?.ehDono && p.criadoPor.email !== texto(decisor?.email, 120)) throw new ErroQualidade("Quem confirma é quem criou o plano (ou o dono).", 403);
  const t = texto(bruto?.texto, 300);
  const por = { nome: texto(decisor?.nome, 80), email: texto(decisor?.email, 120) };
  if (bruto?.decisao === "devolver") {
    if (t.length < 3) throw new ErroQualidade("Diga o que ainda falta para devolver o plano à unidade.");
    lista[i] = { ...p, status: "aberto", historico: [...p.historico, { em: agora.toISOString(), por, acao: "devolvido", texto: t, fotos: [] }] };
  } else if (bruto?.decisao === "confirmar") {
    lista[i] = { ...p, status: "concluido", concluidoEm: agora.toISOString(), historico: [...p.historico, { em: agora.toISOString(), por, acao: "confirmado", texto: t, fotos: [] }] };
  } else {
    throw new ErroQualidade("Escolha confirmar ou devolver.");
  }
  await gravarJson(ARQUIVO_PLANOS, lista);
  return lista[i];
}
