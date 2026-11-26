// Autenticação do dashboard. O prefixo "_" faz a Vercel NÃO expor este arquivo como rota.
//
// Como funciona: quem entra em /api/login (e-mail + senha) recebe um token assinado (HMAC) que só diz QUEM é a pessoa
// e vence após um tempo SEM USO (12 horas para dono e Master, 4 horas para quem vê só algumas unidades): cada pedido aceito
// devolve um token novo no cabeçalho X-Atlas-Token (no máximo a cada 5 minutos), e o navegador troca o seu. Além disso há um
// teto de 7 dias desde a entrada: mesmo usando todo dia, depois disso a pessoa entra de novo. O nível e as unidades vêm da lista de usuários a cada pedido, então desativar um acesso ou
// trocar o nível vale na hora (até 1 minuto por instância, por causa do cache).
//
// Transição: enquanto NÃO existe nenhum usuário, continua valendo a senha única (DASHBOARD_PASSWORD) e os tokens
// antigos, que contam como dono. Criado o dono, a senha única e os tokens antigos deixam de valer.
//
// Segredo de assinatura: SESSAO_SEGREDO (Vercel); se não existir, deriva de DASHBOARD_PASSWORD. Sem nenhum dos dois a
// proteção fica desligada, MAS se já existem usuários o servidor recusa tudo (nunca abre por esquecimento de variável).
import { createHmac, timingSafeEqual } from "node:crypto";
import { listarUsuarios, gerenciaAcessos, geraRelatorios, verRoyalties, verJuridico, verQualidade, editaQualidade, preencheChecklist, verEstudos, verObras, verEscalas, verDocumentos, precisaTrocarSenha } from "../server/acesso.js";
import { UNIT_NAMES } from "../server/units.js";

/** Tempo sem uso até o login cair: 12 horas para dono e Master (aparelho próprio), 4 horas para quem vê só algumas unidades (computador de recepção, em geral compartilhado). */
export const INATIVIDADE_MS = 12 * 3600 * 1000;
export const INATIVIDADE_UNIDADES_MS = 4 * 3600 * 1000;
/** Desde a entrada, mesmo usando sem parar: depois disso entra de novo (limita o estrago de um token roubado). */
export const TETO_SESSAO_MS = 7 * 24 * 3600 * 1000;
export const inatividadeDe = (papel) => (papel === "unidades" ? INATIVIDADE_UNIDADES_MS : INATIVIDADE_MS);
/** Só troca o token se o atual tiver mais que isto (evita gerar um token a cada pedido). */
const RENOVAR_APOS_MS = 5 * 60 * 1000;
export const CABECALHO_TOKEN = "X-Atlas-Token";

export const protegido = () => Boolean(process.env.DASHBOARD_PASSWORD);
const segredo = () => process.env.SESSAO_SEGREDO || process.env.DASHBOARD_PASSWORD || "";
export const temSegredo = () => Boolean(segredo());

// A chave derivada do segredo faz todos os tokens morrerem quando ele é trocado.
const chaveLegado = () => createHmac("sha256", "worldgym-dashboard").update(process.env.DASHBOARD_PASSWORD ?? "").digest();
const chaveUsuario = () => createHmac("sha256", "worldgym-dashboard-v2").update(segredo()).digest();
const assinar = (chave, corpo) => createHmac("sha256", chave).update(corpo).digest("base64url");

const iguais = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

export const senhaCorreta = (senha) => protegido() && typeof senha === "string" && iguais(senha, process.env.DASHBOARD_PASSWORD);

/** Token da senha única (transição). */
export function criarToken(agora = Date.now()) {
  const exp = agora + INATIVIDADE_MS;
  const corpo = String(exp);
  return { token: `${corpo}.${assinar(chaveLegado(), corpo)}`, expiraEm: exp };
}

/**
 * Token de uma pessoa: guarda quem é (id), quando vence por falta de uso (e) e quando a sessão começou (c, para o teto de 7 dias).
 * `papel` define o tempo sem uso; `desde` é o início da sessão (na renovação continua o mesmo; no login é agora).
 */
export function criarTokenUsuario(usuarioId, agora = Date.now(), { papel, desde } = {}) {
  const c = desde ?? agora;
  const exp = Math.min(agora + inatividadeDe(papel), c + TETO_SESSAO_MS);
  const corpo = Buffer.from(JSON.stringify({ u: usuarioId, e: exp, c })).toString("base64url");
  return { token: `v2.${corpo}.${assinar(chaveUsuario(), corpo)}`, expiraEm: exp };
}

/** { tipo: "legado" } | { tipo: "usuario", uid, exp, desde } | null (assinatura errada, vencido, passou do teto ou lixo). */
export function lerToken(token, agora = Date.now()) {
  if (typeof token !== "string") return null;
  const partes = token.split(".");
  if (partes[0] === "v2") {
    const [, corpo, assinatura] = partes;
    if (!corpo || !assinatura || !segredo() || !iguais(assinatura, assinar(chaveUsuario(), corpo))) return null;
    try {
      const { u, e, c } = JSON.parse(Buffer.from(corpo, "base64url").toString());
      const desde = Number(c) || null; // tokens de antes do teto não têm início: o relógio de 7 dias começa na primeira renovação
      if (desde && agora >= desde + TETO_SESSAO_MS) return null;
      return u && Number(e) > agora ? { tipo: "usuario", uid: u, exp: Number(e), desde } : null;
    } catch {
      return null;
    }
  }
  const [corpo, assinatura] = partes;
  if (!corpo || !assinatura || !protegido() || !iguais(assinatura, assinar(chaveLegado(), corpo))) return null;
  return Number(corpo) > agora ? { tipo: "legado" } : null;
}

export const tokenValido = (token, agora = Date.now()) => lerToken(token, agora) !== null;

export const tokenDaRequisicao = (req) => String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");

const SESSAO_LEGADO = Object.freeze({ id: "legado", nome: "Senha única", email: "", papel: "dono", unidades: [], verRoyalties: true, verJuridico: true, verQualidade: true, editaQualidade: true, preencheChecklist: true, verEstudos: true, verObras: true, verEscalas: true, verDocumentos: true, legado: true });
const SESSAO_ABERTA = Object.freeze({ id: "aberto", nome: "Sem proteção", email: "", papel: "dono", unidades: [], verRoyalties: true, verJuridico: true, verQualidade: true, editaQualidade: true, preencheChecklist: true, verEstudos: true, verObras: true, verEscalas: true, verDocumentos: true, legado: true });

export const sessaoDe = (u) => ({ id: u.id, nome: u.nome, email: u.email, papel: u.papel, unidades: u.unidades ?? [], gerenciaAcessos: gerenciaAcessos(u), geraRelatorios: geraRelatorios(u), verRoyalties: verRoyalties(u), verJuridico: verJuridico(u), verQualidade: verQualidade(u), editaQualidade: editaQualidade(u), preencheChecklist: preencheChecklist(u), verEstudos: verEstudos(u), verObras: verObras(u), verEscalas: verEscalas(u), verDocumentos: verDocumentos(u), trocarSenha: precisaTrocarSenha(u), legado: false });

/**
 * "Ver como": o dono pode olhar o painel como Master ou como o acesso de algumas unidades, para conferir o que cada
 * nível enxerga. O pedido vem no cabeçalho X-Atlas-Ver-Como ("master" ou "unidades:<nomes separados por |>", com
 * encodeURIComponent). Só vale para quem É dono; para qualquer outro nível o cabeçalho é ignorado. Durante a simulação
 * a sessão é a do nível escolhido (os filtros do servidor valem de verdade) e leva papelReal = "dono" para o painel
 * mostrar o aviso e o botão de voltar.
 */
export const CABECALHO_VER_COMO = "X-Atlas-Ver-Como";
// A permissão de gerar relatórios (do dono) vale também na simulação: o dono testa o relatório com os dados do nível que está vendo.
export function aplicarVerComo(sessao, pedido, nomesValidos = Object.values(UNIT_NAMES)) {
  if (!sessao || sessao.papel !== "dono" || typeof pedido !== "string" || !pedido) return sessao;
  if (pedido === "master") return { ...sessao, papel: "master", unidades: [], gerenciaAcessos: false, verJuridico: true, verQualidade: true, editaQualidade: false, preencheChecklist: false, verEstudos: false, verObras: true, verEscalas: true, verDocumentos: true, papelReal: "dono" };
  if (!pedido.startsWith("unidades:")) return sessao;
  let nomes = [];
  try { nomes = decodeURIComponent(pedido.slice(9)).split("|").map((n) => n.trim()); } catch { return sessao; }
  const unidades = [...new Set(nomes.filter((n) => nomesValidos.includes(n)))];
  // Como quem vê só algumas unidades, os royalties ficam fechados (a marca de liberação é de cada pessoa, não do nível).
  return unidades.length ? { ...sessao, papel: "unidades", unidades, gerenciaAcessos: false, verRoyalties: false, verJuridico: false, verQualidade: false, editaQualidade: false, preencheChecklist: false, verEstudos: false, verObras: false, verEscalas: false, verDocumentos: false, papelReal: "dono" } : sessao;
}
const pedidoVerComo = (req) => req.headers?.[CABECALHO_VER_COMO.toLowerCase()];

/**
 * "Ver como uma pessoa" ("pessoa:<id>"): o dono vê o Atlas exatamente como aquela pessoa vê, com o nível, as unidades e as liberações dela (royalties,
 * jurídico, qualidade, checklist da unidade...). Só vale para o dono e para uma pessoa ativa que não seja o dono. É SOMENTE CONSULTA: qualquer
 * pedido que grave algo (enviar checklist, trocar senha, criar acesso...) é recusado enquanto a simulação está ligada.
 */
export function sessaoComoPessoa(sessao, pedido, lista) {
  if (!sessao || sessao.papel !== "dono" || typeof pedido !== "string" || !pedido.startsWith("pessoa:")) return null;
  const alvo = lista.find((x) => x.id === pedido.slice(7) && x.ativo !== false && x.papel !== "dono");
  return alvo ? { ...sessaoDe(alvo), trocarSenha: false, papelReal: "dono", somenteLeitura: true, simulaNome: alvo.nome } : null;
}

/** Quem está fazendo o pedido, ou null. Confere o usuário na lista a cada vez (desativado = fora).
 *  Com `res`, renova o login (mais o tempo sem uso do nível, a partir de agora, até o teto) mandando o token novo no cabeçalho X-Atlas-Token. */
export async function sessaoDaRequisicao(req, res = null, agora = Date.now()) {
  const t = lerToken(tokenDaRequisicao(req), agora);
  if (!t) return null;
  const lista = await listarUsuarios();
  if (t.tipo === "legado") return lista.length === 0 ? SESSAO_LEGADO : null;
  const u = lista.find((x) => x.id === t.uid && x.ativo !== false);
  if (!u) return null;
  // Senha redefinida pelo "esqueci minha senha": as sessões que começaram antes disso caem (quem entrou com a senha esquecida não segue logado).
  if (u.senhaEm && !(t.desde > u.senhaEm)) return null;
  // Renova quando o token tem mais de 5 minutos (e o teto ainda não limitou o vencimento). Tokens mais longos que o devido (antigos de 30 dias, ou de
  // quem passou a ver só algumas unidades) são encurtados no primeiro uso. O início da sessão (desde) segue o mesmo na renovação.
  const inat = inatividadeDe(u.papel);
  const desde = t.desde ?? agora;
  const noTeto = t.exp >= desde + TETO_SESSAO_MS;
  const resta = t.exp - agora;
  if (res && !noTeto && (resta <= inat - RENOVAR_APOS_MS || resta > inat || !t.desde)) res.setHeader(CABECALHO_TOKEN, criarTokenUsuario(u.id, agora, { papel: u.papel, desde }).token);
  const base = sessaoDe(u);
  return sessaoComoPessoa(base, pedidoVerComo(req), lista) ?? aplicarVerComo(base, pedidoVerComo(req));
}

/**
 * Barra o pedido (401 sem login, 403 sem permissão) e devolve a sessão quando pode seguir; false quando já respondeu.
 * `papeis`: níveis aceitos (padrão: todos).
 */
/** Pedido POST que só consulta (não grava nada em nome da pessoa): academias concorrentes e área de deslocamento dos Estudos de ponto. */
export function ehSoConsulta(req) {
  if (req.query?.modulo !== "estudos") return false;
  let corpo = req.body;
  if (typeof corpo === "string") { try { corpo = JSON.parse(corpo); } catch { return false; } }
  return corpo?.acao === "pois" || corpo?.acao === "deslocamento" || corpo?.acao === "endereco" || corpo?.acao === "endereco-posicao" || corpo?.acao === "contar-academias" || corpo?.acao === "fotos-rua" || corpo?.acao === "censo-municipio";
}

export async function exigirLogin(req, res, { papeis } = {}) {
  try {
    if (!segredo()) {
      if ((await listarUsuarios()).length > 0) {
        res.setHeader("Cache-Control", "no-store");
        res.status(503).json({ error: "servidor sem a chave de acesso configurada" });
        return false;
      }
      return SESSAO_ABERTA;
    }
    const sessao = await sessaoDaRequisicao(req, res);
    if (!sessao) {
      res.setHeader("Cache-Control", "no-store");
      res.status(401).json({ error: "login necessário" });
      return false;
    }
    // Senha provisória: nada de dados até a pessoa escolher a própria (só o login e a troca de senha respondem).
    if (sessao.trocarSenha) {
      res.setHeader("Cache-Control", "no-store");
      res.status(403).json({ error: "troque a senha para continuar", trocarSenha: true });
      return false;
    }
    // Vendo como outra pessoa: só consulta. Nada é gravado em nome dela.
    // Exceção: a busca de academias concorrentes dos Estudos de ponto é POST, mas só consulta (não grava nada em nome da pessoa).
    if (sessao.somenteLeitura && !["GET", "HEAD", "OPTIONS"].includes(req.method) && !ehSoConsulta(req)) {
      res.setHeader("Cache-Control", "no-store");
      res.status(403).json({ error: `Você está vendo o Atlas como ${sessao.simulaNome}: só consulta. Volte a ver como dono para fazer alterações.` });
      return false;
    }
    if (papeis && !papeis.includes(sessao.papel)) {
      res.setHeader("Cache-Control", "no-store");
      res.status(403).json({ error: "sem permissão" });
      return false;
    }
    return sessao;
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({ error: "não consegui conferir o acesso agora" });
    return false;
  }
}

const ORIGENS = new Set(["https://welbertlucas.github.io", "https://atlas.worldgymacademia.com.br", "http://localhost:5173"]);
export function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && ORIGENS.has(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", `Origin, Authorization, ${CABECALHO_VER_COMO}`);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", `Authorization, Content-Type, ${CABECALHO_VER_COMO}, X-Atlas-Documento`);
  res.setHeader("Access-Control-Expose-Headers", CABECALHO_TOKEN);
}
