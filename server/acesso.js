// Usuários do dashboard: quem pode entrar, com que nível e em quais unidades.
//
// Níveis:
//   dono      -> tudo, inclusive criar e mexer em acessos (só existe um, criado uma vez)
//   master    -> todos os dados, sem a tela de acessos
//   unidades  -> só as unidades escolhidas; o benchmark da rede vem com os nomes escondidos
//
// As senhas nunca são guardadas: só uma versão embaralhada (scrypt) que não dá para desfazer.
import { randomBytes, randomInt, scryptSync, timingSafeEqual, randomUUID } from "node:crypto";
import { lerJson, gravarJson, listarCaminhos, apagarCaminho } from "./armazem.js";
import { UNIT_NAMES } from "./units.js";

export const PAPEIS = ["dono", "master", "unidades"];
export const UNIDADES_DA_REDE = Object.values(UNIT_NAMES);

const ARQUIVO = "acesso/usuarios.json";
const TTL_MS = 60 * 1000;
/** Espera antes de reler uma lista de usuários que voltou vazia. */
const ESPERA_RELEITURA_MS = 300;
let memo = null;

export class ErroAcesso extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

export const normalizarEmail = (e) => String(e ?? "").trim().toLowerCase();
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 120;

/** Lista de usuários (com cache de 1 minuto por instância: abrir o painel não lê o Blob toda vez). */
export async function listarUsuarios(agora = Date.now()) {
  if (memo && agora - memo.em < TTL_MS) return memo.lista;
  let lista = await lerJson(ARQUIVO);
  // Uma leitura que volta vazia, com acessos já criados, não é "não há ninguém": o armazenamento às vezes diz "não achei" por um instante
  // (instância nova, falha passageira) e isso derrubava o login de quem estava usando o Atlas. Confere de novo; se ainda vier vazio e já
  // havia lista, segue com a anterior e tenta outra vez em instantes.
  if (!lista || lista.length === 0) {
    await new Promise((r) => setTimeout(r, ESPERA_RELEITURA_MS));
    lista = await lerJson(ARQUIVO);
    if ((!lista || lista.length === 0) && memo?.lista?.length) {
      console.warn("acesso: a lista de usuários veio vazia; mantida a anterior");
      memo = { em: agora - TTL_MS + 10_000, lista: memo.lista }; // vale por mais 10 s e tenta de novo
      return memo.lista;
    }
  }
  lista = lista ?? [];
  memo = { em: agora, lista };
  return lista;
}

async function salvar(lista) {
  await gravarJson(ARQUIVO, lista);
  memo = { em: Date.now(), lista };
}

export const limparCache = () => { memo = null; };

/** O que sai para a tela: nunca o hash da senha. */
/** `resumo`: recebe o resumo diário por e-mail (quem foi criado antes da opção recebe, como sempre recebeu). */
export const recebeResumo = (u) => u.ativo !== false && u.resumo !== false;
/** Master a quem o dono liberou criar e alterar acessos (só vale para Master). */
export const gerenciaAcessos = (u) => u?.papel === "master" && u.gerenciaAcessos === true;
/** Quem gera apresentações no menu Relatórios: o dono e quem ele liberou (qualquer nível). */
export const geraRelatorios = (u) => u?.papel === "dono" || u?.papel === "master" || u?.geraRelatorios === true;
/** Menu Royalties (recebimentos da marca, dado financeiro da rede): o dono e todo Master veem; quem tem acesso só a unidades vê se o dono liberou. */
export const verRoyalties = (u) => u?.papel === "dono" || u?.papel === "master" || u?.verRoyalties === true;
/**
 * Quem ainda usa a senha provisória precisa escolher uma só sua. Vale para toda senha gerada pelo sistema (acesso novo ou "nova senha") e,
 * como migração, para os acessos criados antes desta regra (sem o campo), exceto o dono, que escolheu a própria senha ao criar a conta.
 */
export const precisaTrocarSenha = (u) => u?.trocarSenha === true || (u?.trocarSenha === undefined && u?.papel !== "dono");
/** Menu Jurídico (processos da rede, dado sensível): o dono vê; qualquer outro nível só se o dono liberou. */
export const verJuridico = (u) => u?.papel === "dono" || u?.papel === "master" || u?.verJuridico === true;
/** Menu Qualidade, só para ver (checklists, visitas, notas): o dono e todo Master; quem tem acesso a unidades, se o dono liberou. */
export const verQualidade = (u) => u?.papel === "dono" || u?.papel === "master" || u?.verQualidade === true;
/** Editar a qualidade (criar checklists, registrar visitas com check-in e assinatura): o dono e quem ele liberou (a marca `verQualidade` guardada na pessoa); Master sem a liberação só consulta. */
export const editaQualidade = (u) => u?.papel === "dono" || u?.verQualidade === true;
/** Preencher o checklist da própria unidade (abertura etc.): o dono, ou quem tem acesso a unidades e o dono liberou. Só vê e envia o que é da sua unidade. */
export const preencheChecklist = (u) => u?.papel === "dono" || (u?.papel === "unidades" && u.preencheChecklist === true);
/** Menus ainda "Em breve" (Estudos de ponto, Unidades em obra): o dono vê; qualquer outro nível só se o dono liberou. */
// "Faz estudos de ponto" fica gravado em `fazEstudos`. O campo antigo `verEstudos` (que só mostrava o menu "Em breve") NÃO vale mais:
// quem o tinha não ganha a visão completa dos estudos. A sessão e a tela continuam chamando a permissão de `verEstudos`.
export const verEstudos = (u) => u?.papel === "dono" || u?.fazEstudos === true;
export const verObras = (u) => u?.papel === "dono" || u?.verObras === true;
/** Menu Escalas (escala 5x2 da equipe, com nomes de colaboradores): o dono e todo Master; quem tem acesso a unidades, só se o dono liberou (`verEscalas` na pessoa); vê só as suas unidades. */
export const verEscalas = (u) => u?.papel === "dono" || u?.papel === "master" || u?.verEscalas === true;
/** Menu Documentos (contrato social, alvarás e outros arquivos das unidades): o dono e todo Master veem todas as unidades; quem tem acesso a unidades, só com a permissão "acessar documentos" (`acessaDocumentos`, campo próprio) e só as suas. */
export const verDocumentos = (u) => u?.papel === "dono" || u?.papel === "master" || (u?.papel === "unidades" && u.acessaDocumentos === true);
export const publico = (u) => ({ id: u.id, nome: u.nome, email: u.email, papel: u.papel, unidades: u.unidades ?? [], ativo: u.ativo !== false, resumo: u.resumo !== false, gerenciaAcessos: gerenciaAcessos(u), geraRelatorios: u.papel === "unidades" && u.geraRelatorios === true, verRoyalties: verRoyalties(u), verJuridico: u.papel === "unidades" && u.verJuridico === true, verQualidade: u.papel !== "dono" && u.verQualidade === true, preencheChecklist: preencheChecklist(u), verEstudos: u.papel !== "dono" && u.fazEstudos === true, verObras: u.papel !== "dono" && u.verObras === true, verEscalas: u.papel === "unidades" && u.verEscalas === true, acessaDocumentos: u.papel === "unidades" && u.acessaDocumentos === true, trocarSenha: precisaTrocarSenha(u), criadoEm: u.criadoEm });

/**
 * Quem não é dono, mas gerencia acessos (ator com gerenciaAcessos), não mexe na conta do dono nem na de outro que
 * também gerencia, não dá nem tira essa permissão e não muda o próprio nível nem se desativa. Sem ator = dono.
 */
function conferirAtor(ator, alvo, campos = {}) {
  if (!ator || ator.papel === "dono") return;
  if (alvo?.papel === "dono") throw new ErroAcesso("Só o dono altera a conta do dono.", 403);
  if (alvo && alvo.id !== ator.id && gerenciaAcessos(alvo)) throw new ErroAcesso("Só o dono altera quem também gerencia acessos.", 403);
  if (campos.gerenciaAcessos !== undefined) throw new ErroAcesso("Só o dono dá ou tira a permissão de gerenciar acessos.", 403);
  if (campos.geraRelatorios !== undefined) throw new ErroAcesso("Só o dono dá ou tira a permissão de gerar relatórios.", 403);
  if (campos.verRoyalties !== undefined) throw new ErroAcesso("Só o dono dá ou tira a permissão de ver royalties.", 403);
  if (campos.verJuridico !== undefined) throw new ErroAcesso("Só o dono dá ou tira a permissão de ver o jurídico.", 403);
  if (campos.verQualidade !== undefined) throw new ErroAcesso("Só o dono dá ou tira a permissão de usar a qualidade.", 403);
  if (campos.verEscalas !== undefined) throw new ErroAcesso("Só o dono dá ou tira a permissão de usar as escalas.", 403);
  if (campos.verEstudos !== undefined || campos.verObras !== undefined) throw new ErroAcesso("Só o dono dá ou tira a permissão de fazer Estudos de ponto e de ver Unidades em obra.", 403);
  if (campos.acessaDocumentos !== undefined) throw new ErroAcesso("Só o dono dá ou tira a permissão de acessar documentos.", 403);
  if (campos.preencheChecklist !== undefined) throw new ErroAcesso("Só o dono dá ou tira a permissão de preencher o checklist da unidade.", 403);
  if (alvo?.id === ator.id && ((campos.papel !== undefined && campos.papel !== alvo.papel) || campos.ativo === false)) {
    throw new ErroAcesso("Você não pode mudar o seu próprio nível nem se desativar.", 403);
  }
}

export function hashSenha(senha) {
  const sal = randomBytes(16);
  const h = scryptSync(String(senha), sal, 64);
  return `scrypt$${sal.toString("base64url")}$${h.toString("base64url")}`;
}

export function conferirSenha(senha, guardado) {
  const [tipo, sal, h] = String(guardado ?? "").split("$");
  if (tipo !== "scrypt" || !sal || !h) return false;
  const esperado = Buffer.from(h, "base64url");
  const obtido = scryptSync(String(senha ?? ""), Buffer.from(sal, "base64url"), esperado.length);
  return obtido.length === esperado.length && timingSafeEqual(obtido, esperado);
}

// Sem caracteres que se confundem (0/O, 1/l/I) para a senha provisória ser fácil de ditar.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
export const gerarSenhaProvisoria = () => Array.from({ length: 12 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");

function validarBasico({ nome, email }, lista, ignorarId) {
  const n = String(nome ?? "").trim();
  const e = normalizarEmail(email);
  if (n.length < 2 || n.length > 80) throw new ErroAcesso("Informe o nome da pessoa.");
  if (!emailValido(e)) throw new ErroAcesso("E-mail inválido.");
  if (lista.some((u) => u.email === e && u.id !== ignorarId)) throw new ErroAcesso("Já existe um acesso com esse e-mail.", 409);
  return { nome: n, email: e };
}

function validarUnidades(unidades) {
  const lista = Array.isArray(unidades) ? [...new Set(unidades.map((x) => String(x).trim()))] : [];
  if (lista.length === 0) throw new ErroAcesso("Escolha ao menos uma unidade.");
  const fora = lista.find((n) => !UNIDADES_DA_REDE.includes(n));
  if (fora) throw new ErroAcesso(`Unidade desconhecida: ${fora}.`);
  return lista;
}

/** Primeira conta do sistema: o dono. Só vale enquanto não existe nenhum usuário. */
export async function criarDono({ nome, email, senha }) {
  const lista = await lerFresco();
  if (lista.length > 0) throw new ErroAcesso("O dono já foi criado.", 409);
  const dados = validarBasico({ nome, email }, lista);
  if (String(senha ?? "").length < 10) throw new ErroAcesso("A senha precisa ter pelo menos 10 caracteres.");
  const u = { id: randomUUID(), ...dados, papel: "dono", unidades: [], ativo: true, hash: hashSenha(senha), criadoEm: new Date().toISOString() };
  await salvar([u]);
  return publico(u);
}

/** Cria um acesso com senha provisória (mostrada uma única vez ao dono). */
export async function criarUsuario({ nome, email, papel, unidades, resumo = true, gerenciaAcessos: gerencia, geraRelatorios: relatorios, verRoyalties: royalties, verJuridico: juridico, verQualidade: qualidade, preencheChecklist: preenche, verEstudos: estudos, verObras: obras, verEscalas: escalas, acessaDocumentos: documentos }, ator = null) {
  const lista = await lerFresco();
  if (papel === "dono" || !PAPEIS.includes(papel)) throw new ErroAcesso("Nível inválido.");
  conferirAtor(ator, null, { gerenciaAcessos: gerencia || undefined, geraRelatorios: relatorios || undefined, verRoyalties: royalties || undefined, verJuridico: juridico || undefined, verQualidade: qualidade || undefined, preencheChecklist: preenche || undefined, verEstudos: estudos || undefined, verObras: obras || undefined, verEscalas: escalas || undefined, acessaDocumentos: documentos || undefined });
  const dados = validarBasico({ nome, email }, lista);
  const senhaProvisoria = gerarSenhaProvisoria();
  const u = {
    id: randomUUID(), ...dados, papel,
    unidades: papel === "unidades" ? validarUnidades(unidades) : [],
    ativo: true, resumo: resumo !== false, ...(papel === "master" && gerencia === true ? { gerenciaAcessos: true } : {}), ...(relatorios === true ? { geraRelatorios: true } : {}), ...(papel === "unidades" && royalties === true ? { verRoyalties: true } : {}), ...(juridico === true ? { verJuridico: true } : {}), ...(qualidade === true ? { verQualidade: true } : {}), ...(papel === "unidades" && preenche === true ? { preencheChecklist: true } : {}), ...(estudos === true ? { fazEstudos: true } : {}), ...(obras === true ? { verObras: true } : {}), ...(papel === "unidades" && escalas === true ? { verEscalas: true } : {}), ...(papel === "unidades" && documentos === true ? { acessaDocumentos: true } : {}),
    hash: hashSenha(senhaProvisoria), trocarSenha: true, criadoEm: new Date().toISOString(),
  };
  await salvar([...lista, u]);
  return { usuario: publico(u), senhaProvisoria };
}

export async function redefinirSenha(id, ator = null) {
  const lista = await lerFresco();
  const u = lista.find((x) => x.id === id);
  if (!u) throw new ErroAcesso("Acesso não encontrado.", 404);
  conferirAtor(ator, u);
  const senhaProvisoria = gerarSenhaProvisoria();
  u.hash = hashSenha(senhaProvisoria);
  u.trocarSenha = true;
  await salvar(lista);
  return { usuario: publico(u), senhaProvisoria };
}

/**
 * Muda nome, nível, unidades, se recebe o resumo diário, se gerencia acessos (só o dono decide, só para Master), ou
 * desativa/reativa. O dono não pode ser rebaixado nem desativado. `ator`: quem pede, quando não é o dono.
 */
export async function atualizarUsuario(id, campos, ator = null) {
  const lista = await lerFresco();
  const u = lista.find((x) => x.id === id);
  if (!u) throw new ErroAcesso("Acesso não encontrado.", 404);
  conferirAtor(ator, u, campos);
  if (u.papel === "dono" && (campos.papel !== undefined && campos.papel !== "dono" || campos.ativo === false)) {
    throw new ErroAcesso("O dono não pode ser rebaixado nem desativado.", 403);
  }
  if (campos.nome !== undefined || campos.email !== undefined) {
    const d = validarBasico({ nome: campos.nome ?? u.nome, email: campos.email ?? u.email }, lista, u.id);
    u.nome = d.nome;
    u.email = d.email;
  }
  if (campos.papel !== undefined) {
    if (u.papel !== "dono") {
      if (campos.papel === "dono" || !PAPEIS.includes(campos.papel)) throw new ErroAcesso("Nível inválido.");
      u.papel = campos.papel;
    }
  }
  if (u.papel === "unidades") u.unidades = validarUnidades(campos.unidades ?? u.unidades);
  else u.unidades = [];
  if (campos.ativo !== undefined) u.ativo = Boolean(campos.ativo);
  if (campos.resumo !== undefined) u.resumo = Boolean(campos.resumo);
  if (campos.gerenciaAcessos !== undefined) u.gerenciaAcessos = Boolean(campos.gerenciaAcessos);
  if (u.papel !== "master") delete u.gerenciaAcessos; // a permissão só vale para Master
  if (campos.geraRelatorios !== undefined) u.geraRelatorios = Boolean(campos.geraRelatorios);
  if (u.papel === "dono") delete u.geraRelatorios; // o dono sempre gera
  if (campos.verRoyalties !== undefined) u.verRoyalties = Boolean(campos.verRoyalties);
  if (u.papel !== "unidades") delete u.verRoyalties; // dono e Master sempre veem; a marca só vale para quem tem acesso a unidades
  if (campos.verJuridico !== undefined) u.verJuridico = Boolean(campos.verJuridico);
  if (u.papel === "dono") delete u.verJuridico; // o dono sempre vê
  if (campos.preencheChecklist !== undefined) u.preencheChecklist = Boolean(campos.preencheChecklist);
  if (u.papel !== "unidades") delete u.preencheChecklist; // a marca só vale para quem tem acesso a unidades (o dono sempre pode)
  if (campos.verQualidade !== undefined) u.verQualidade = Boolean(campos.verQualidade);
  if (u.papel === "dono") delete u.verQualidade;
  if (campos.verEstudos !== undefined) { u.fazEstudos = Boolean(campos.verEstudos); delete u.verEstudos; }
  if (campos.verObras !== undefined) u.verObras = Boolean(campos.verObras);
  if (campos.verEscalas !== undefined) u.verEscalas = Boolean(campos.verEscalas);
  if (u.papel !== "unidades") delete u.verEscalas; // dono e Master sempre veem; a marca só vale para quem tem acesso a unidades
  if (u.papel === "dono") { delete u.verEstudos; delete u.fazEstudos; delete u.verObras; } // o dono sempre vê
  if (campos.acessaDocumentos !== undefined) u.acessaDocumentos = Boolean(campos.acessaDocumentos);
  if (u.papel !== "unidades") delete u.acessaDocumentos; // dono e Master sempre acessam; a marca só vale para quem tem acesso a unidades
  await salvar(lista);
  return publico(u);
}

const SENHAS_FRACAS = new Set(["1234567890", "0123456789", "senha12345", "senha123456", "password123", "qwerty12345", "abcdefghij", "worldgym123", "worldgym2026", "atlas12345"]);

/** Regras da senha nova (a mesma exigência do dono ao criar a conta: 10 caracteres), mais as que impedem as escolhas óbvias. Devolve o motivo ou null. */
export function motivoSenhaFraca(nova, u, atual = "") {
  const n = String(nova ?? "");
  if (n.length < 10) return "A senha precisa ter pelo menos 10 caracteres.";
  if (n.length > 128) return "A senha pode ter no máximo 128 caracteres.";
  if (n === String(atual ?? "")) return "A senha nova precisa ser diferente da provisória.";
  if (new Set(n).size < 4) return "Use caracteres mais variados.";
  const baixa = n.toLowerCase();
  if (SENHAS_FRACAS.has(baixa)) return "Essa senha é fácil de adivinhar. Escolha outra.";
  const local = String(u?.email ?? "").split("@")[0].toLowerCase();
  if (local.length >= 4 && baixa.includes(local)) return "A senha não pode conter o seu e-mail.";
  return null;
}

/** A pessoa escolhe a própria senha: confere a atual (a provisória, na primeira vez), valida a nova e grava. */
export async function definirNovaSenha(id, atual, nova) {
  const lista = await lerFresco();
  const u = lista.find((x) => x.id === id && x.ativo !== false);
  if (!u) throw new ErroAcesso("Acesso não encontrado.", 404);
  if (!conferirSenha(atual, u.hash)) throw new ErroAcesso("A senha atual não confere.", 401);
  const motivo = motivoSenhaFraca(nova, u, atual);
  if (motivo) throw new ErroAcesso(motivo, 400);
  u.hash = hashSenha(nova);
  u.trocarSenha = false;
  await salvar(lista);
  return publico(u);
}

/**
 * "Esqueci minha senha": a pessoa provou ter o e-mail (link de uso único), então não há senha atual para conferir.
 * Grava `senhaEm`: as sessões abertas antes deste instante deixam de valer (ver sessaoDaRequisicao).
 */
export async function definirSenhaPorRedefinicao(id, nova, agora = Date.now()) {
  const lista = await lerFresco();
  const u = lista.find((x) => x.id === id && x.ativo !== false);
  if (!u) throw new ErroAcesso("Link inválido ou vencido. Peça um novo.", 400);
  const motivo = motivoSenhaFraca(nova, u);
  if (motivo) throw new ErroAcesso(motivo, 400);
  u.hash = hashSenha(nova);
  u.trocarSenha = false;
  u.senhaEm = agora;
  await salvar(lista);
  return publico(u);
}

/** Confere e-mail e senha. Devolve o usuário ativo ou null (sem dizer qual dos dois errou). */
export async function autenticar(email, senha) {
  const lista = await listarUsuarios();
  const u = lista.find((x) => x.email === normalizarEmail(email));
  // Gasta o mesmo tempo quando o e-mail não existe, para não revelar quem tem acesso.
  const ok = conferirSenha(senha, u?.hash ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAA");
  return u && ok && u.ativo !== false ? u : null;
}

// Antes de gravar, relê do Blob (ignora o cache) para não sobrescrever uma mudança feita por outra instância.
async function lerFresco() {
  limparCache();
  return structuredClone(await listarUsuarios());
}

// ----- Registro de acessos (um arquivo por mês) -----
const arquivoLog = (ym) => `acesso/log-${ym}.json`;
const LIMITE_LOG = 3000;
const ultimaFalha = new Map();
export const limparFreio = () => ultimaFalha.clear();

const mesDe = (d) => new Date(d).toISOString().slice(0, 7);

/**
 * Anota uma entrada (ok) ou tentativa errada de um e-mail que existe. Falhas de e-mails que não existem não são gravadas.
 * `evento` ("redefinicao-pedida" | "senha-redefinida"): marca o "esqueci minha senha"; entra com ok=false (não conta como entrada) e sem o freio de 1 por minuto.
 */
export async function registrarAcesso({ email, usuarioId = null, nome = null, ok, evento = null }, agora = Date.now()) {
  if (!ok && !evento) {
    const chave = normalizarEmail(email);
    if (agora - (ultimaFalha.get(chave) ?? 0) < 60_000) return; // freia quem insiste: no máximo 1 registro por minuto
    ultimaFalha.set(chave, agora);
  }
  const arq = arquivoLog(mesDe(agora));
  const atual = (await lerJson(arq)) ?? [];
  atual.push({ em: new Date(agora).toISOString(), email: normalizarEmail(email), usuarioId, nome, ok, ...(evento ? { evento } : {}) });
  await gravarJson(arq, atual.slice(-LIMITE_LOG));
  if (atual.length === 1) await limparRegistrosAntigos(agora); // primeiro registro do mês: aproveita para apagar os antigos
}

/** Entradas mais recentes primeiro (os últimos 4 meses, que cobrem os 90 dias guardados). */
export async function lerRegistro(agora = Date.now(), limite = 1000) {
  const d = new Date(agora);
  const meses = [0, 1, 2, 3].map((k) => mesDe(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - k, 1)));
  const lidos = await Promise.all(meses.map((m) => lerJson(arquivoLog(m))));
  return lidos.reverse().flatMap((l) => l ?? []).reverse().slice(0, limite);
}

// ----- Registro de atividade: quais telas cada pessoa abre e quem exporta (um arquivo por dia) -----
const arquivoAtividade = (dia) => `acesso/atividade-${dia}.json`;
const LIMITE_ATIVIDADE_DIA = 2000;
export const EVENTOS_ATIVIDADE = ["tela", "exportar"];
/** Endereço de tela válido: letras minúsculas, números, "/" e "-" (ex.: "gerencial/vendas"). */
export const telaValida = (t) => typeof t === "string" && /^[a-z0-9][a-z0-9/-]{0,39}$/.test(t);
/** Mês AAAA-MM e unidade da rede (ou null = a rede toda): o que a pessoa estava vendo. Valor inválido vira null. */
export const mesValido = (m) => (typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : null);
export const unidadeValida = (u) => (typeof u === "string" && UNIDADES_DA_REDE.includes(u) ? u : null);
/** Dia no horário de Brasília (UTC−3), para o arquivo bater com o dia que a equipe vê. */
const diaBR = (agora) => new Date(agora - 3 * 3600 * 1000).toISOString().slice(0, 10);

export const MAX_EVENTOS_POR_LOTE = 50;
const DIA_MS = 24 * 3600 * 1000;

/**
 * Anota as telas que a pessoa abriu ("tela") e as exportações/impressões ("exportar"), todas de uma vez (uma leitura e uma gravação).
 * `eventos`: [{ tela, evento, unidade, mes, em }]. O horário `em` (ms) vem do navegador, mas só vale até 24 horas para trás e nunca no futuro.
 * Evento inválido é ignorado. Devolve quantos entraram. No primeiro registro do dia apaga os arquivos com mais de 90 dias.
 */
export async function registrarAtividade({ usuario, eventos }, agora = Date.now()) {
  if (!usuario?.id || usuario.legado || !Array.isArray(eventos)) return 0;
  const novos = eventos.slice(0, MAX_EVENTOS_POR_LOTE)
    .filter((e) => e && telaValida(e.tela) && EVENTOS_ATIVIDADE.includes(e.evento ?? "tela"))
    .map((e) => {
      const quando = Number.isFinite(Number(e.em)) ? Math.min(agora, Math.max(agora - DIA_MS, Number(e.em))) : agora;
      return { em: new Date(quando).toISOString(), usuarioId: usuario.id, nome: usuario.nome, email: usuario.email, tela: e.tela, evento: e.evento ?? "tela", unidade: unidadeValida(e.unidade), mes: mesValido(e.mes) };
    });
  if (!novos.length) return 0;
  const arq = arquivoAtividade(diaBR(agora));
  const atual = (await lerJson(arq)) ?? [];
  await gravarJson(arq, [...atual, ...novos].slice(-LIMITE_ATIVIDADE_DIA));
  if (atual.length === 0) await limparRegistrosAntigos(agora);
  return novos.length;
}

/** Atividade dos últimos `dias` dias (hoje e os anteriores), das mais novas para as mais antigas. */
export async function lerAtividade(agora = Date.now(), dias = 7, limite = 600) {
  const arquivos = Array.from({ length: dias }, (_, i) => arquivoAtividade(diaBR(agora - i * DIA_MS)));
  const lidos = await Promise.all(arquivos.map((a) => lerJson(a)));
  return lidos.flatMap((l) => (l ?? []).slice().sort((a, b) => (a.em < b.em ? 1 : -1))).slice(0, limite);
}

// ----- Retenção: o registro de entradas e a atividade ficam 90 dias -----
export const RETENCAO_DIAS = 90;

/**
 * Apaga os arquivos de atividade (um por dia) e de entradas (um por mês) mais antigos que 90 dias. Só mexe nesses dois tipos de arquivo
 * (nunca na lista de usuários nem nos backups). Chamada sozinha no primeiro registro de cada dia/mês; custa uma listagem por vez.
 * Devolve os caminhos apagados.
 */
export async function limparRegistrosAntigos(agora = Date.now()) {
  const corteDia = diaBR(agora - RETENCAO_DIAS * DIA_MS);
  const apagados = [];
  try {
    for (const caminho of await listarCaminhos("acesso/")) {
      const dia = caminho.match(/^acesso\/atividade-(\d{4}-\d{2}-\d{2})\.json$/)?.[1];
      const mes = caminho.match(/^acesso\/log-(\d{4}-\d{2})\.json$/)?.[1];
      // O mês de entradas só sai quando ele inteiro é anterior ao corte (o mês do corte ainda tem dias dentro dos 90).
      if ((dia && dia < corteDia) || (mes && mes < corteDia.slice(0, 7))) {
        await apagarCaminho(caminho);
        apagados.push(caminho);
      }
    }
  } catch {
    /* limpar é um favor: se falhar, tenta de novo no próximo dia */
  }
  return apagados;
}
