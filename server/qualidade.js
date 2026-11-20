// Qualidade: checklists da franqueadora e as visitas às unidades (limpeza, uniforme, conservação...).
// Os modelos (listas de itens) e as visitas (respostas conforme/não conforme, comentário e fotos) ficam no Blob privado; só quem o dono
// liberou usa o menu (verQualidade). A foto é redimensionada no celular antes de subir; aqui só se confere que é um JPEG de tamanho razoável.
import { randomUUID } from "node:crypto";
import { apagarCaminho, gravarBytes, gravarJson, lerBytes, lerJson } from "./armazem.js";
import { UNIDADES_DA_REDE } from "./acesso.js";

export const ARQUIVO_MODELOS = "qualidade/modelos.json";
export const PASTA_VISITAS = "qualidade/visitas";
export const PASTA_FOTOS = "qualidade/fotos";
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
    return { id, grupo: texto(i?.grupo, 60), texto: t, peso, foto, tipo };
  });
  const id = typeof bruto?.id === "string" && /^[a-z0-9-]{4,40}$/.test(bruto.id) ? bruto.id : randomUUID().slice(0, 8);
  return { id, nome, descricao: texto(bruto?.descricao, 200), frequencia, itens, ativo: bruto?.ativo !== false, atualizadoEm: agora.toISOString() };
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
  const respostas = modelo.itens.map((item) => {
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
      if (conforme === false && !comentario && tipo !== "vencimento") throw new ErroQualidade(`Diga o que precisa ser corrigido em "${item.texto}".`);
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
export function decodificarFoto(base64) {
  const limpo = String(base64 ?? "").replace(/^data:image\/jpeg;base64,/, "");
  if (!/^[A-Za-z0-9+/=]+$/.test(limpo)) throw new ErroQualidade("Foto inválida.");
  const bytes = Buffer.from(limpo, "base64");
  if (bytes.length === 0 || bytes.length > MAX_BYTES_FOTO) throw new ErroQualidade("A foto é grande demais. Tire de novo ou reduza o tamanho.");
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) throw new ErroQualidade("Só aceito foto em JPEG.");
  return bytes;
}

export async function lerModelos() {
  const m = await lerJson(ARQUIVO_MODELOS);
  return Array.isArray(m) ? m : [];
}
export async function salvarModelo(bruto) {
  const lista = await lerModelos();
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
export async function salvarVisita(bruto, avaliador, agora = new Date()) {
  const modelo = (await lerModelos()).find((m) => m.id === bruto?.modeloId);
  const visita = montarVisita(bruto, modelo, avaliador, agora);
  const lista = await lerVisitas(visita.mes);
  await gravarJson(`${PASTA_VISITAS}/${visita.mes}.json`, [...lista, visita]);
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
