// E-mail de acesso ao Atlas: sai pelo Zoho quando o dono cria um acesso ou gera uma senha nova.
// A senha provisória vai no corpo do e-mail e nunca aparece em log nem em mensagem de erro.
import { enviarEmail, smtpConfigurado } from "./resumo.js";

const URL_ATLAS = "https://atlas.worldgymacademia.com.br";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const sans = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const mono = "'SFMono-Regular',Menlo,Consolas,'Liberation Mono',monospace";
const VERMELHO = "#C41230", TINTA = "#3a3a42", TEXTO = "#484850", SUAVE = "#74747f", FUNDO = "#eeeef1", CAIXA = "#f4f4f6";

/** Assunto e HTML do e-mail. `novo` = acesso criado agora; senão, senha refeita. */
export function emailDeAcesso(usuario, senha, { novo = true, url = URL_ATLAS } = {}) {
  const primeiro = esc(String(usuario.nome ?? "").trim().split(/\s+/)[0] || "");
  const assunto = novo ? "Seu acesso ao World Gym Atlas" : "Sua nova senha do World Gym Atlas";
  const p = (txt, extra = "") => `<p style="margin:0 0 16px;font-family:${sans};font-size:15px;line-height:1.6;color:${TEXTO};${extra}">${txt}</p>`;
  const rotulo = (txt) => `<p style="margin:0 0 4px;font-family:${sans};font-size:12px;line-height:1.4;color:${SUAVE};text-transform:uppercase;letter-spacing:.06em">${txt}</p>`;
  const abertura = novo ? "Você está recebendo o seu acesso ao World Gym Atlas." : "Você está recebendo uma nova senha do World Gym Atlas. A anterior deixou de valer.";
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(assunto)}</title></head>
<body style="margin:0;padding:0;background:${FUNDO}">
<table role="presentation" width="100%" style="border-collapse:collapse;background:${FUNDO}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;border-collapse:collapse;background:#ffffff;border-radius:12px"><tr><td style="padding:32px">
${p(`Olá${primeiro ? `, ${primeiro}` : ""}!`)}
${p(esc(abertura))}
<table role="presentation" width="100%" style="margin:8px 0 24px;border-collapse:collapse;background:${CAIXA};border-radius:10px"><tr><td style="padding:18px 20px">
${rotulo("E-mail de login")}
<p style="margin:0 0 14px;font-family:${sans};font-size:15px;line-height:1.5;color:${TINTA};font-weight:600">${esc(usuario.email)}</p>
${rotulo("Senha provisória")}
<p style="margin:0;font-family:${mono};font-size:18px;line-height:1.5;color:${TINTA};font-weight:700;letter-spacing:.08em">${esc(senha)}</p>
</td></tr></table>
<table role="presentation" style="margin:0;border-collapse:collapse"><tr><td style="border-radius:8px;background:${VERMELHO}">
<a href="${esc(url)}" style="display:inline-block;padding:12px 22px;font-family:${sans};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">Entrar no Atlas</a>
</td></tr></table>
</td></tr></table>
</td></tr></table>
</body></html>`;
  return { assunto, html };
}

/**
 * Manda o e-mail de acesso. Nunca lança: devolve { enviado, para, erro? } para a tela mostrar.
 * Sem Zoho configurado (SMTP_USUARIO e SMTP_SENHA), não envia e avisa.
 */
export async function enviarAcesso(usuario, senha, { novo = true, env = process.env, enviar = enviarEmail } = {}) {
  const para = usuario.email;
  if (!smtpConfigurado(env)) return { enviado: false, para, erro: "envio de e-mail não configurado no servidor" };
  try {
    const { assunto, html } = emailDeAcesso(usuario, senha, { novo });
    await enviar({ para, assunto, html }, { env, tentativas: 2 });
    return { enviado: true, para };
  } catch (e) {
    const msg = String(e?.message ?? e).split(senha).join("•••"); // por garantia: a senha nunca volta na mensagem
    return { enviado: false, para, erro: msg.slice(0, 200) };
  }
}
