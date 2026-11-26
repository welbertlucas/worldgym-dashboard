// Unidades em obra (menu "Unidades em obra"): acompanhamento das unidades em implantação até a inauguração.
// Duas camadas:
//   - a obra, com os marcos (datas-chave: previsto e real), em `obras/obras.json`. É dela que saem a situação (atrasada/no prazo), o mapa e os números do topo;
//   - as fases e tarefas da implantação, num arquivo por obra (`obras/tarefas/<id>.json`), copiadas de um modelo (`obras/modelos.json`).
// Tudo fica no Blob privado; o repositório é público, então nada daqui vai para o código (nem a lista real de tarefas dos modelos).
// Quem vê a obra e os marcos: dono, Master e quem tem acesso a unidades e foi liberado (`verObras`, conferido na API).
// Quem vê e mexe nas fases e tarefas: só dono e Master (trazem contrato, taxa da franquia, aporte dos sócios). Quem cadastra e muda a obra: dono e Master; apagar a obra, só o dono.
import { apagarCaminho, gravarJson, lerJson } from "./armazem.js";

export const CAMINHO_OBRAS = "obras/obras.json";
export const CAMINHO_MODELOS = "obras/modelos.json";
export const caminhoTarefas = (id) => `obras/tarefas/${id}.json`;
export const MAX_OBRAS = 60;
export const MAX_MARCOS = 24;
export const MAX_FASES = 60;
export const MAX_TAREFAS = 600;
export const MAX_DIAS = 999;
/** Modelos de unidade (o mesmo id liga a obra ao modelo de fases e tarefas). */
export const MODELOS = Object.freeze(["low", "prime", "pro", "pro-recovery"]);
const ID_OK = /^[A-Za-z0-9_-]{1,40}$/;
const DATA_OK = /^\d{4}-\d{2}-\d{2}$/;
const MARCOS_DA_FASE = new Set(["Iniciação", "Planejamento", "Execução"]);

export class ErroObras extends Error {
  constructor(msg, status = 400) { super(msg); this.status = status; }
}

const texto = (v, max) => String(v ?? "").trim().slice(0, max);
function data(v, campo) {
  if (v == null || v === "") return null;
  if (typeof v !== "string" || !DATA_OK.test(v) || Number.isNaN(Date.parse(`${v}T12:00:00Z`))) throw new ErroObras(`${campo}: data inválida`);
  return v;
}
function dias(v, campo) {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > MAX_DIAS) throw new ErroObras(`${campo}: duração inválida (1 a ${MAX_DIAS} dias)`);
  return n;
}
const exigirId = (v, oque) => { if (!ID_OK.test(String(v ?? ""))) throw new ErroObras(`identificador ${oque} inválido`); return String(v); };
const novoId = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
/** Fim da tarefa pelo início e pela duração em dias corridos, contando o dia do início (27/11 + 5 dias = 01/12, como no Sults). */
export function fimPelaDuracao(inicio, d) {
  if (!inicio || !d) return null;
  const t = new Date(`${inicio}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + d - 1);
  return t.toISOString().slice(0, 10);
}

/** Confere e limpa a obra que veio da tela: só os campos conhecidos, com tamanho máximo. */
export function limparObra(o) {
  if (!o || typeof o !== "object") throw new ErroObras("obra inválida");
  if (!ID_OK.test(String(o.id ?? ""))) throw new ErroObras("identificador da obra inválido");
  const nome = texto(o.nome, 60);
  if (!nome) throw new ErroObras("informe o nome da unidade");
  const m2 = o.m2 === null || o.m2 === undefined || o.m2 === "" ? null : Number(o.m2);
  if (m2 !== null && !(m2 > 0 && m2 <= 20000)) throw new ErroObras("m² inválido");
  // a obra com fases e tarefas (do modelo) não usa marcos: a lista pode vir vazia
  if (!Array.isArray(o.marcos) || o.marcos.length > MAX_MARCOS) throw new ErroObras(`a obra aceita até ${MAX_MARCOS} marcos`);
  const ids = new Set();
  const marcos = o.marcos.map((m, i) => {
    if (!m || !ID_OK.test(String(m.id ?? "")) || ids.has(m.id)) throw new ErroObras(`marco ${i + 1}: identificador inválido`);
    ids.add(m.id);
    const nomeMarco = texto(m.nome, 60);
    if (!nomeMarco) throw new ErroObras(`marco ${i + 1}: informe o nome`);
    return { id: m.id, nome: nomeMarco, previsto: data(m.previsto, `${nomeMarco} (previsto)`), real: data(m.real, `${nomeMarco} (realizado)`) };
  });
  // posição no mapa da rede (opcional): [lat, lng] dentro do Brasil
  let c = null;
  if (o.c !== null && o.c !== undefined) {
    if (!Array.isArray(o.c) || o.c.length !== 2 || !o.c.every((x) => Number.isFinite(Number(x)))) throw new ErroObras("posição da obra inválida");
    c = [Number(Number(o.c[0]).toFixed(6)), Number(Number(o.c[1]).toFixed(6))];
    if (c[0] < -34 || c[0] > 6 || c[1] < -74 || c[1] > -34) throw new ErroObras("posição da obra fora do Brasil");
  }
  return {
    id: o.id, nome, cidade: texto(o.cidade, 60), endereco: texto(o.endereco, 160), c, modelo: MODELOS.includes(o.modelo) ? o.modelo : "low", m2,
    responsavel: texto(o.responsavel, 60), obs: texto(o.obs, 600), marcos,
  };
}

export async function lerObras() {
  const d = await lerJson(CAMINHO_OBRAS);
  return Array.isArray(d?.obras) ? d.obras : [];
}

const podeEditar = (sessao) => sessao?.papel === "dono" || sessao?.papel === "master";
const exigirEditor = (sessao) => { if (!podeEditar(sessao)) throw new ErroObras("só o dono e o Master mudam as obras", 403); };
const exigirDono = (sessao) => { if (sessao?.papel !== "dono") throw new ErroObras("só o dono apaga obras", 403); };

/** Cria ou atualiza uma obra (pelo id). O resumo das tarefas é do servidor: a tela não muda. */
export async function salvarObra(sessao, obra, { agora = new Date() } = {}) {
  exigirEditor(sessao);
  const nova = limparObra(obra);
  const obras = await lerObras();
  const i = obras.findIndex((x) => x.id === nova.id);
  if (i < 0 && obras.length >= MAX_OBRAS) throw new ErroObras(`o limite é de ${MAX_OBRAS} obras`);
  const registro = { ...nova, ...(i >= 0 && obras[i].tarefas ? { tarefas: obras[i].tarefas } : {}), criadoEm: i >= 0 ? obras[i].criadoEm : agora.toISOString(), atualizadoEm: agora.toISOString() };
  if (i >= 0) obras[i] = registro; else obras.push(registro);
  await gravarJson(CAMINHO_OBRAS, { obras });
  return registro;
}

export async function apagarObra(sessao, id) {
  exigirDono(sessao);
  const obras = await lerObras();
  const resto = obras.filter((x) => x.id !== id);
  if (resto.length === obras.length) throw new ErroObras("obra não encontrada", 404);
  await gravarJson(CAMINHO_OBRAS, { obras: resto });
  await apagarCaminho(caminhoTarefas(exigirId(id, "da obra"))).catch(() => {});
}

// ---------- modelos de implantação ----------

/** Confere os modelos (vindos do script de carga): só nome, marco da fase, nome e duração das tarefas. */
export function limparModelos(lista) {
  if (!Array.isArray(lista) || !lista.length) throw new ErroObras("nenhum modelo");
  return lista.map((m, i) => {
    if (!MODELOS.includes(m?.id)) throw new ErroObras(`modelo ${i + 1}: id inválido (use ${MODELOS.join(", ")})`);
    const nome = texto(m.nome, 60);
    if (!nome) throw new ErroObras(`modelo ${m.id}: sem nome`);
    if (!Array.isArray(m.fases) || !m.fases.length || m.fases.length > MAX_FASES) throw new ErroObras(`modelo ${m.id}: fases inválidas`);
    let total = 0;
    const fases = m.fases.map((f, j) => {
      const nf = texto(f?.nome, 80);
      if (!nf) throw new ErroObras(`modelo ${m.id}, fase ${j + 1}: sem nome`);
      if (!Array.isArray(f.tarefas)) throw new ErroObras(`modelo ${m.id}, fase ${nf}: tarefas inválidas`);
      total += f.tarefas.length;
      return { nome: nf, marco: MARCOS_DA_FASE.has(f.marco) ? f.marco : null, tarefas: f.tarefas.map((t, k) => {
        const nt = texto(t?.nome, 120);
        if (!nt) throw new ErroObras(`modelo ${m.id}, fase ${nf}, tarefa ${k + 1}: sem nome`);
        return { nome: nt, dias: dias(t.dias, `${nf} / ${nt}`) };
      }) };
    });
    if (total > MAX_TAREFAS) throw new ErroObras(`modelo ${m.id}: mais de ${MAX_TAREFAS} tarefas`);
    return { id: m.id, nome, fases };
  });
}
export async function lerModelos() {
  const d = await lerJson(CAMINHO_MODELOS);
  return Array.isArray(d?.modelos) ? d.modelos : [];
}
export const gravarModelos = (modelos) => gravarJson(CAMINHO_MODELOS, { modelos: limparModelos(modelos) });
/** O que a tela precisa saber dos modelos para oferecer a escolha (sem a lista de tarefas). */
export const resumoDosModelos = (modelos) => modelos.map((m) => ({ id: m.id, nome: m.nome, fases: m.fases.length, tarefas: m.fases.reduce((a, f) => a + f.tarefas.length, 0) }));

// ---------- fases e tarefas de uma obra ----------

/** A tarefa que marca a inauguração da unidade (existe nos modelos, na fase de finalização). */
export const ehAbertura = (nome) => String(nome ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase() === "DATA DE ABERTURA";

/** Resumo guardado na obra: é dele que saem a situação, o progresso e a inauguração da obra que tem tarefas.
 * Totais; das pendentes com fim, quantas vencem em cada dia; a próxima a vencer; a tarefa "Data de abertura"; o último fim. */
export function resumoTarefas(fases, modelo = null) {
  let total = 0, concluidas = 0, proxima = null, abertura = null, ultimoFim = null;
  const fimPendente = {};
  for (const f of fases) for (const t of f.tarefas) {
    total += 1;
    if (t.fim && (!ultimoFim || t.fim > ultimoFim)) ultimoFim = t.fim;
    if (ehAbertura(t.nome) && !abertura) abertura = { fim: t.fim ?? null, feito: t.feito ?? null };
    if (t.feito) { concluidas += 1; continue; }
    if (t.fim) {
      fimPendente[t.fim] = (fimPendente[t.fim] ?? 0) + 1;
      if (!proxima || t.fim < proxima.fim) proxima = { nome: t.nome, fim: t.fim };
    }
  }
  return { modelo, total, concluidas, fimPendente, proxima, abertura, ultimoFim };
}

async function lerTarefasDe(obraId) {
  const d = await lerJson(caminhoTarefas(obraId));
  return d && Array.isArray(d.fases) ? d : null;
}
/** Lê a obra e as tarefas dela (só dono e Master). */
async function obraEtarefas(sessao, obraId) {
  exigirEditor(sessao);
  const id = exigirId(obraId, "da obra");
  const obras = await lerObras();
  const i = obras.findIndex((x) => x.id === id);
  if (i < 0) throw new ErroObras("obra não encontrada", 404);
  return { obras, i, id, doc: await lerTarefasDe(id) };
}
/** Grava as tarefas da obra e, só se o resumo mudou, o resumo na lista de obras (relida na hora, para não desfazer o que outra pessoa gravou em outra obra). */
async function gravarTarefas(obras, i, id, doc, agora) {
  doc.atualizadoEm = agora.toISOString();
  await gravarJson(caminhoTarefas(id), doc);
  const resumo = resumoTarefas(doc.fases, doc.modelo ?? null);
  if (JSON.stringify(resumo) !== JSON.stringify(obras[i].tarefas ?? null)) {
    const atual = await lerObras();
    const j = atual.findIndex((x) => x.id === id);
    if (j >= 0) { atual[j] = { ...atual[j], tarefas: resumo }; await gravarJson(CAMINHO_OBRAS, { obras: atual }); }
  }
  return { fases: doc.fases, modelo: doc.modelo ?? null, resumo };
}

/** As fases e tarefas da obra (vazio se ainda não aplicou um modelo). */
export async function lerTarefas(sessao, obraId) {
  const { doc } = await obraEtarefas(sessao, obraId);
  return { fases: doc?.fases ?? [], modelo: doc?.modelo ?? null, resumo: resumoTarefas(doc?.fases ?? [], doc?.modelo ?? null) };
}

/** Copia as fases e tarefas de um modelo para a obra. Só quando a obra ainda não tem tarefas (não apaga o que já foi feito). */
export async function aplicarModelo(sessao, obraId, modeloId, { agora = new Date(), modelos = null } = {}) {
  const { obras, i, id, doc } = await obraEtarefas(sessao, obraId);
  if (doc?.fases?.length) throw new ErroObras("esta obra já tem fases e tarefas", 409);
  const m = (modelos ?? (await lerModelos())).find((x) => x.id === modeloId);
  if (!m) throw new ErroObras("modelo não encontrado", 404);
  const fases = m.fases.map((f) => ({ id: novoId("f"), nome: f.nome, marco: f.marco ?? null, tarefas: f.tarefas.map((t) => ({ id: novoId("t"), nome: t.nome, dias: t.dias ?? null, resp: "", inicio: null, fim: null, feito: null })) }));
  return gravarTarefas(obras, i, id, { modelo: m.id, fases }, agora);
}

/** Confere uma tarefa vinda da tela. Sem fim informado, o fim sai do início + duração. */
export function limparTarefa(t) {
  if (!t || typeof t !== "object") throw new ErroObras("tarefa inválida");
  const nome = texto(t.nome, 120);
  if (!nome) throw new ErroObras("informe o nome da tarefa");
  const d = dias(t.dias, nome);
  const inicio = data(t.inicio, `${nome} (início)`);
  const fim = data(t.fim, `${nome} (fim)`) ?? fimPelaDuracao(inicio, d);
  if (inicio && fim && fim < inicio) throw new ErroObras(`${nome}: o fim vem antes do início`);
  return { nome, dias: d, resp: texto(t.resp, 60), inicio, fim, feito: data(t.feito, `${nome} (conclusão)`) };
}

const acharFase = (doc, faseId) => {
  const f = doc?.fases?.find((x) => x.id === faseId);
  if (!f) throw new ErroObras("fase não encontrada", 404);
  return f;
};

/** Cria (sem id ou id novo) ou atualiza uma tarefa da fase. */
export async function salvarTarefa(sessao, { obraId, faseId, tarefa }, { agora = new Date() } = {}) {
  const { obras, i, id, doc } = await obraEtarefas(sessao, obraId);
  const f = acharFase(doc, faseId);
  const limpa = limparTarefa(tarefa);
  const tid = tarefa?.id ? exigirId(tarefa.id, "da tarefa") : null;
  const j = tid ? f.tarefas.findIndex((x) => x.id === tid) : -1;
  if (j >= 0) f.tarefas[j] = { id: tid, ...limpa };
  else {
    if (doc.fases.reduce((a, x) => a + x.tarefas.length, 0) >= MAX_TAREFAS) throw new ErroObras(`o limite é de ${MAX_TAREFAS} tarefas por obra`);
    f.tarefas.push({ id: tid ?? novoId("t"), ...limpa });
  }
  return gravarTarefas(obras, i, id, doc, agora);
}

export async function apagarTarefa(sessao, { obraId, faseId, tarefaId }, { agora = new Date() } = {}) {
  const { obras, i, id, doc } = await obraEtarefas(sessao, obraId);
  const f = acharFase(doc, faseId);
  const antes = f.tarefas.length;
  f.tarefas = f.tarefas.filter((x) => x.id !== tarefaId);
  if (f.tarefas.length === antes) throw new ErroObras("tarefa não encontrada", 404);
  return gravarTarefas(obras, i, id, doc, agora);
}

/** Cria uma fase nova no fim da lista, ou renomeia uma que já existe. */
export async function salvarFase(sessao, { obraId, fase }, { agora = new Date() } = {}) {
  const { obras, i, id, doc: d } = await obraEtarefas(sessao, obraId);
  const doc = d ?? { modelo: null, fases: [] };
  const nome = texto(fase?.nome, 80);
  if (!nome) throw new ErroObras("informe o nome da fase");
  const fid = fase?.id ? exigirId(fase.id, "da fase") : null;
  const existente = fid ? doc.fases.find((x) => x.id === fid) : null;
  if (existente) existente.nome = nome;
  else {
    if (doc.fases.length >= MAX_FASES) throw new ErroObras(`o limite é de ${MAX_FASES} fases`);
    doc.fases.push({ id: fid ?? novoId("f"), nome, marco: null, tarefas: [] });
  }
  return gravarTarefas(obras, i, id, doc, agora);
}

export async function apagarFase(sessao, { obraId, faseId }, { agora = new Date() } = {}) {
  const { obras, i, id, doc } = await obraEtarefas(sessao, obraId);
  acharFase(doc, faseId);
  doc.fases = doc.fases.filter((x) => x.id !== faseId);
  return gravarTarefas(obras, i, id, doc, agora);
}
