// Avisos de segurança por e-mail (Zoho): acesso de um aparelho novo, conta bloqueada por tentativas erradas e senha alterada.
//  - aparelho novo   -> a própria pessoa; para contas de dono e Master, o dono também recebe (privilégio alto)
//  - conta bloqueada -> a própria pessoa e o dono
//  - senha alterada  -> a própria pessoa
//  - primeiro acesso de uma conta criada há pouco -> o dono (informativo)
// O aparelho é reconhecido por um código aleatório guardado no navegador (nunca por IP). Falha de e-mail nunca derruba o login.
import { createHash } from "node:crypto";
import { lerJson, gravarJson } from "./armazem.js";
import { enviarEmail, smtpConfigurado } from "./resumo.js";
import { listarUsuarios } from "./acesso.js";

const URL_ATLAS = "https://atlas.worldgymacademia.com.br";
const MAX_APARELHOS = 25;
const CONTA_NOVA_DIAS = 7;
const INTERVALO_AVISOS_MS = 30 * 60_000;
const TEMPO_ENVIO_MS = 5000;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const sans = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const VERMELHO = "#C41230", TINTA = "#3a3a42", TEXTO = "#484850", SUAVE = "#74747f", FUNDO = "#eeeef1", CAIXA = "#f4f4f6";

/** "Chrome em macOS", "Safari em iPhone"... a partir do user-agent (só para a pessoa reconhecer o aparelho). */
export function resumoDoNavegador(ua) {
  const t = String(ua ?? "");
  const nav = /Edg\//.test(t) ? "Edge" : /OPR\/|Opera/.test(t) ? "Opera" : /Firefox\//.test(t) ? "Firefox" : /Chrome\/|CriOS\//.test(t) ? "Chrome" : /Safari\//.test(t) ? "Safari" : "navegador";
  const so = /iPhone|iPad|iPod/.test(t) ? "iPhone/iPad" : /Android/.test(t) ? "Android" : /Windows/.test(t) ? "Windows" : /Mac OS X|Macintosh/.test(t) ? "macOS" : /Linux/.test(t) ? "Linux" : "sistema desconhecido";
  return `${nav} em ${so}`;
}

/** Cidade e estado aproximados que a Vercel informa pelo endereço (sem serviço externo). */
export function localAproximado(headers = {}) {
  const dec = (v) => { try { return decodeURIComponent(String(v ?? "")).trim(); } catch { return ""; } };
  const cidade = dec(headers["x-vercel-ip-city"]), uf = dec(headers["x-vercel-ip-country-region"]), pais = dec(headers["x-vercel-ip-country"]);
  const partes = [cidade, uf].filter(Boolean);
  return partes.length ? `${partes.join(", ")}${pais && pais !== "BR" ? ` (${pais})` : ""}` : null;
}

const hashAparelho = (userId, aparelho) => createHash("sha256").update(`${userId}|${aparelho}`).digest("hex").slice(0, 24);
const arquivoDe = (userId) => `acessos/aparelhos/${String(userId).replace(/[^a-z0-9-]/gi, "")}.json`;
const quando = (agora) => new Date(agora).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

/**
 * Registra o aparelho da pessoa. Devolve { novo, primeiro, throttled }:
 *  - novo: não estava na lista; primeiro: a lista estava vazia (conta que nunca tinha entrado ou de antes deste recurso);
 *  - throttled: já houve aviso nos últimos 30 minutos.
 * Sem código de aparelho legível, não dá para saber: devolve { novo: false }.
 */
export async function registrarAparelho(userId, aparelho, ua, agora = Date.now()) {
  const id = String(aparelho ?? "");
  if (!userId || id.length < 16 || id.length > 100) return { novo: false, primeiro: false, throttled: false };
  const h = hashAparelho(userId, id);
  try {
    const reg = (await lerJson(arquivoDe(userId))) ?? { lista: [], ultimoAviso: 0 };
    const conhecido = reg.lista.some((a) => a.h === h);
    const primeiro = reg.lista.length === 0;
    const throttled = agora - (reg.ultimoAviso ?? 0) < INTERVALO_AVISOS_MS;
    if (conhecido) return { novo: false, primeiro: false, throttled };
    reg.lista = [...reg.lista, { h, em: new Date(agora).toISOString(), ua: resumoDoNavegador(ua) }].slice(-MAX_APARELHOS);
    await gravarJson(arquivoDe(userId), reg);
    return { novo: true, primeiro, throttled };
  } catch {
    return { novo: false, primeiro: false, throttled: false }; // sem armazém: sem aviso, o login segue
  }
}

async function marcarAviso(userId, agora) {
  try {
    const reg = (await lerJson(arquivoDe(userId))) ?? { lista: [], ultimoAviso: 0 };
    reg.ultimoAviso = agora;
    await gravarJson(arquivoDe(userId), reg);
  } catch { /* idem */ }
}

function moldura({ titulo, paragrafos, linhas = [], rodape, botao }) {
  const p = (t) => `<p style="margin:0 0 16px;font-family:${sans};font-size:15px;line-height:1.6;color:${TEXTO}">${t}</p>`;
  const rotulo = (t) => `<p style="margin:0 0 2px;font-family:${sans};font-size:12px;line-height:1.4;color:${SUAVE};text-transform:uppercase;letter-spacing:.06em">${t}</p>`;
  const caixa = linhas.length
    ? `<table role="presentation" width="100%" style="margin:8px 0 20px;border-collapse:collapse;background:${CAIXA};border-radius:10px"><tr><td style="padding:16px 20px">${linhas.map(([r, v]) => `${rotulo(esc(r))}<p style="margin:0 0 12px;font-family:${sans};font-size:15px;line-height:1.5;color:${TINTA};font-weight:600">${esc(v)}</p>`).join("")}</td></tr></table>`
    : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)}</title></head>
<body style="margin:0;padding:0;background:${FUNDO}">
<table role="presentation" width="100%" style="border-collapse:collapse;background:${FUNDO}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;border-collapse:collapse;background:#ffffff;border-radius:12px"><tr><td style="padding:32px 32px 28px">
<p style="margin:0 0 20px;font-family:${sans};font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${VERMELHO}">World Gym Atlas</p>
<h1 style="margin:0 0 16px;font-family:${sans};font-size:21px;line-height:1.3;color:${TINTA}">${esc(titulo)}</h1>
${paragrafos.map(p).join("")}${botao ? `<p style="margin:4px 0 20px"><a href="${esc(botao.url)}" style="display:inline-block;padding:13px 22px;border-radius:10px;background:${VERMELHO};color:#ffffff;font-family:${sans};font-size:15px;font-weight:700;text-decoration:none">${esc(botao.texto)}</a></p>` : ""}${caixa}
${rodape ? `<p style="margin:0;font-family:${sans};font-size:13px;line-height:1.6;color:${SUAVE}">${rodape}</p>` : ""}
</td></tr></table>
</td></tr></table></body></html>`;
}

const primeiroNome = (u) => esc(String(u?.nome ?? "").trim().split(/\s+/)[0] || "");
const detalhes = (ctx, agora) => [
  ["Quando", quando(agora)],
  ["Aparelho", resumoDoNavegador(ctx.ua)],
  ...(localAproximado(ctx.headers) ? [["Local aproximado", localAproximado(ctx.headers)]] : []),
  ...(ctx.ip && ctx.ip !== "desconhecido" ? [["Endereço (IP)", ctx.ip]] : []),
];

/** Acesso de um aparelho que a pessoa ainda não tinha usado. */
export function emailAcessoNovo(u, ctx, agora = Date.now(), { paraDono = false } = {}) {
  const nome = esc(u.nome);
  if (paraDono) {
    return {
      assunto: `Acesso novo à conta de ${u.nome} no Atlas`,
      html: moldura({
        titulo: "Acesso de um aparelho novo",
        paragrafos: [`${nome} (${esc(u.papel)}) entrou no Atlas de um aparelho que ainda não tinha usado.`],
        linhas: detalhes(ctx, agora),
        rodape: `Se não reconhecer, entre em Usuários e gere uma nova senha para essa pessoa. Este aviso vai para o dono quando o acesso é de uma conta de dono ou Master.`,
      }),
    };
  }
  return {
    assunto: "Novo acesso à sua conta do Atlas",
    html: moldura({
      titulo: "Novo acesso à sua conta",
      paragrafos: [`Olá, ${primeiroNome(u)}.`, "Detectamos um acesso à sua conta do World Gym Atlas de um aparelho que ainda não tinha sido usado."],
      linhas: detalhes(ctx, agora),
      rodape: `Foi você? Então não precisa fazer nada. Se não foi, entre em <a href="${URL_ATLAS}" style="color:${VERMELHO}">${URL_ATLAS.replace("https://", "")}</a>, troque a sua senha (clique no seu nome, no alto da tela).`,
    }),
  };
}

/** Primeiro acesso de uma conta criada há pouco: só informa o dono. */
export function emailPrimeiroAcesso(u, ctx, agora = Date.now()) {
  return {
    assunto: `${u.nome} acessou o Atlas pela primeira vez`,
    html: moldura({
      titulo: "Primeiro acesso de uma conta nova",
      paragrafos: [`${esc(u.nome)} (${esc(u.papel)}) entrou no Atlas pela primeira vez.`],
      linhas: detalhes(ctx, agora),
      rodape: "Se você não esperava esse acesso, gere uma nova senha para essa pessoa em Usuários.",
    }),
  };
}

/** Conta bloqueada por várias senhas erradas seguidas. */
export function emailBloqueio(u, ctx, minutos, agora = Date.now(), { paraDono = false } = {}) {
  const intro = paraDono
    ? `A conta de ${esc(u.nome)} (${esc(u.email)}) foi bloqueada por ${minutos} minutos depois de várias senhas erradas seguidas.`
    : `Olá, ${primeiroNome(u)}. A sua conta do World Gym Atlas foi bloqueada por ${minutos} minutos depois de várias senhas erradas seguidas.`;
  return {
    assunto: paraDono ? `Conta de ${u.nome} bloqueada por tentativas erradas` : "Sua conta do Atlas foi bloqueada por tentativas erradas",
    html: moldura({
      titulo: "Tentativas de entrada com senha errada",
      paragrafos: [intro],
      linhas: detalhes(ctx, agora),
      rodape: paraDono
        ? "Pode ter sido só um esquecimento da pessoa. Se parecer ataque, gere uma nova senha em Usuários."
        : "Se foi você, espere o bloqueio passar e tente de novo. Se não foi, avise o dono do sistema: alguém pode estar tentando adivinhar a sua senha.",
    }),
  };
}

/** "Esqueci minha senha": o link de uso único (o código vai depois do "#", que o navegador não envia a nenhum servidor). */
export function linkDeRedefinicao(token) {
  return `${URL_ATLAS}/#redefinir=${encodeURIComponent(token)}`;
}
export const VALIDADE_LINK_MIN = 30;

export function emailRedefinicao(u, token, ctx, agora = Date.now()) {
  return {
    assunto: "Crie uma nova senha para o Atlas",
    html: moldura({
      titulo: "Criar uma nova senha",
      paragrafos: [
        `Olá, ${primeiroNome(u)}.`,
        `Recebemos um pedido para criar uma nova senha da sua conta do World Gym Atlas. O link abaixo vale por ${VALIDADE_LINK_MIN} minutos e só pode ser usado uma vez.`,
      ],
      botao: { texto: "Criar nova senha", url: linkDeRedefinicao(token) },
      linhas: detalhes(ctx, agora),
      rodape: "Não foi você? Ignore este e-mail: a sua senha atual continua valendo e nada muda. Se receber vários e-mails assim sem ter pedido, avise o dono do sistema.",
    }),
  };
}

/** A pessoa trocou a própria senha. */
export function emailSenhaAlterada(u, ctx, agora = Date.now()) {
  return {
    assunto: "A senha da sua conta do Atlas foi alterada",
    html: moldura({
      titulo: "Senha alterada",
      paragrafos: [`Olá, ${primeiroNome(u)}.`, "A senha da sua conta do World Gym Atlas acabou de ser alterada."],
      linhas: detalhes(ctx, agora),
      rodape: "Foi você? Então está tudo certo. Se não foi, avise o dono do sistema agora.",
    }),
  };
}

async function enviarSeguro(msg, { env = process.env, enviar = enviarEmail } = {}) {
  try {
    if (!msg.para || !smtpConfigurado(env)) return false;
    await Promise.race([
      enviar(msg, { env, tentativas: 1 }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("tempo esgotado")), TEMPO_ENVIO_MS)),
    ]);
    return true;
  } catch {
    return false; // o aviso é um extra: nunca derruba o login nem mostra erro
  }
}

async function emailDoDono(excetoId) {
  try {
    const d = (await listarUsuarios()).find((x) => x.papel === "dono" && x.ativo !== false);
    return d && d.id !== excetoId ? d.email : null;
  } catch { return null; }
}

/**
 * Depois de um login certo: se o aparelho é novo, avisa a pessoa (e o dono, quando a conta é de dono ou Master).
 * Conta criada há pouco entrando pela primeira vez avisa só o dono. Contas antigas, na primeira vez que este recurso as vê, só registram o aparelho.
 */
export async function avisarAcesso(u, ctx, { agora = Date.now(), ...opc } = {}) {
  const r = await registrarAparelho(u.id, ctx.aparelho, ctx.ua, agora);
  if (!r.novo) return { enviados: 0 };
  const contaNova = u.criadoEm && agora - Date.parse(u.criadoEm) < CONTA_NOVA_DIAS * 86400_000;
  if (r.primeiro && !contaNova) return { enviados: 0 }; // semeadura: conta antiga, sem aviso
  if (r.throttled) return { enviados: 0 };
  const envios = [];
  const dono = await emailDoDono(u.id);
  if (r.primeiro && contaNova) {
    if (dono) envios.push(enviarSeguro({ para: dono, ...emailPrimeiroAcesso(u, ctx, agora) }, opc));
  } else {
    envios.push(enviarSeguro({ para: u.email, ...emailAcessoNovo(u, ctx, agora) }, opc));
    if (dono && (u.papel === "dono" || u.papel === "master")) envios.push(enviarSeguro({ para: dono, ...emailAcessoNovo(u, ctx, agora, { paraDono: true }) }, opc));
  }
  const ok = (await Promise.all(envios)).filter(Boolean).length;
  if (ok > 0) await marcarAviso(u.id, agora);
  return { enviados: ok };
}

/** Conta bloqueada: avisa a pessoa e o dono. */
export async function avisarBloqueio(u, ctx, minutos, { agora = Date.now(), ...opc } = {}) {
  const dono = await emailDoDono(u.id);
  const envios = [enviarSeguro({ para: u.email, ...emailBloqueio(u, ctx, minutos, agora) }, opc)];
  if (dono) envios.push(enviarSeguro({ para: dono, ...emailBloqueio(u, ctx, minutos, agora, { paraDono: true }) }, opc));
  return { enviados: (await Promise.all(envios)).filter(Boolean).length };
}

/** Link de "esqueci minha senha" para a própria pessoa. `enviados` 0 = o e-mail não saiu (sem SMTP ou falha). */
export async function avisarRedefinicao(u, token, ctx, { agora = Date.now(), ...opc } = {}) {
  const ok = await enviarSeguro({ para: u.email, ...emailRedefinicao(u, token, ctx, agora) }, opc);
  return { enviados: ok ? 1 : 0 };
}

/** Senha alterada pela própria pessoa. */
export async function avisarSenhaAlterada(u, ctx, { agora = Date.now(), ...opc } = {}) {
  const ok = await enviarSeguro({ para: u.email, ...emailSenhaAlterada(u, ctx, agora) }, opc);
  return { enviados: ok ? 1 : 0 };
}
