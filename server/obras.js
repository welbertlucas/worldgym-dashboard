// Unidades em obra (menu "Unidades em obra"): acompanhamento das unidades em construção até a inauguração, por marcos com data prevista e data real.
// Tudo fica no Blob privado (`obras/obras.json`); o repositório é público, então nada daqui vai para o código.
// Quem vê: o dono e quem ele liberou (`verObras`, conferido na API). Quem muda: só o dono; quem foi liberado só consulta.
import { gravarJson, lerJson } from "./armazem.js";

export const CAMINHO_OBRAS = "obras/obras.json";
export const MAX_OBRAS = 60;
export const MAX_MARCOS = 24;
const ID_OK = /^[A-Za-z0-9_-]{1,40}$/;
const DATA_OK = /^\d{4}-\d{2}-\d{2}$/;

export class ErroObras extends Error {
  constructor(msg, status = 400) { super(msg); this.status = status; }
}

const texto = (v, max) => String(v ?? "").trim().slice(0, max);
function data(v, campo) {
  if (v == null || v === "") return null;
  if (typeof v !== "string" || !DATA_OK.test(v) || Number.isNaN(Date.parse(`${v}T12:00:00Z`))) throw new ErroObras(`${campo}: data inválida`);
  return v;
}

/** Confere e limpa a obra que veio da tela: só os campos conhecidos, com tamanho máximo. */
export function limparObra(o) {
  if (!o || typeof o !== "object") throw new ErroObras("obra inválida");
  if (!ID_OK.test(String(o.id ?? ""))) throw new ErroObras("identificador da obra inválido");
  const nome = texto(o.nome, 60);
  if (!nome) throw new ErroObras("informe o nome da unidade");
  const m2 = o.m2 === null || o.m2 === undefined || o.m2 === "" ? null : Number(o.m2);
  if (m2 !== null && !(m2 > 0 && m2 <= 20000)) throw new ErroObras("m² inválido");
  if (!Array.isArray(o.marcos) || o.marcos.length < 1 || o.marcos.length > MAX_MARCOS) throw new ErroObras(`a obra precisa de 1 a ${MAX_MARCOS} marcos`);
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
    id: o.id, nome, cidade: texto(o.cidade, 60), endereco: texto(o.endereco, 160), c, modelo: o.modelo === "pro" ? "pro" : "low", m2,
    responsavel: texto(o.responsavel, 60), obs: texto(o.obs, 600), marcos,
  };
}

export async function lerObras() {
  const d = await lerJson(CAMINHO_OBRAS);
  return Array.isArray(d?.obras) ? d.obras : [];
}

const exigirDono = (sessao) => { if (sessao?.papel !== "dono") throw new ErroObras("só o dono muda as obras", 403); };

/** Cria ou atualiza uma obra (pelo id). */
export async function salvarObra(sessao, obra, { agora = new Date() } = {}) {
  exigirDono(sessao);
  const nova = limparObra(obra);
  const obras = await lerObras();
  const i = obras.findIndex((x) => x.id === nova.id);
  if (i < 0 && obras.length >= MAX_OBRAS) throw new ErroObras(`o limite é de ${MAX_OBRAS} obras`);
  const registro = { ...nova, criadoEm: i >= 0 ? obras[i].criadoEm : agora.toISOString(), atualizadoEm: agora.toISOString() };
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
}
