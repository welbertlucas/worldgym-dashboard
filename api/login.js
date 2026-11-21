// GET  /api/login                   -> { protegido, logado, comEmail, usuario? }
// POST /api/login {email, senha}    -> { token, expiraEm, usuario } ou 401
// POST /api/login {senha}           -> só na transição (enquanto não existe nenhum usuário): senha única de antes
import {
  protegido, temSegredo, senhaCorreta, criarToken, criarTokenUsuario, sessaoDaRequisicao, cors,
} from "./_auth.js";
import { bloqueadoPor, anotarErro, zerarErros, enderecoDe } from "../server/freio.js";
import { avisarAcesso, avisarBloqueio } from "../server/avisos.js";
import { listarUsuarios, autenticar, publico, registrarAcesso, normalizarEmail, ErroAcesso } from "../server/acesso.js";
import { pedirRedefinicao, redefinirComToken, ErroLink } from "../server/redefinicao.js";

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
// Tempo mínimo da resposta do "esqueci": com e-mail que tem acesso o envio demora, sem acesso não; igualar não entrega quem tem acesso.
const ESPERA_ESQUECI_MS = () => Number(process.env.REDEFINICAO_ESPERA_MS ?? 2500);

/**
 * POST /api/login {acao:"esqueci", email}   -> sempre 200 {ok:true} (nunca diz se o e-mail tem acesso); 429 se o endereço pediu demais
 * POST /api/login {acao:"redefinir", token, nova} -> 200 {ok:true} | 400 (senha fraca ou link inválido/vencido) | 429
 */
async function tratarRedefinicao(req, res, { acao, comEmail, email, token, nova, ctx }) {
  if (!comEmail) return res.status(400).json({ error: "Ainda não há acessos por e-mail." });
  const chaveIp = `reset:ip:${enderecoDe(req)}`;
  const espera = await bloqueadoPor(chaveIp);
  if (espera > 0) {
    res.setHeader("Retry-After", String(espera * 60));
    return res.status(429).json({ error: "muitas tentativas", minutos: espera });
  }
  if (acao === "esqueci") {
    await anotarErro(chaveIp, "ip"); // cada pedido conta: 20 por endereço a cada 15 minutos
    const inicio = Date.now();
    await pedirRedefinicao(email, ctx).catch(() => {});
    const resta = ESPERA_ESQUECI_MS() - (Date.now() - inicio);
    if (resta > 0) await esperar(resta);
    return res.status(200).json({ ok: true });
  }
  try {
    await redefinirComToken(token, nova, ctx);
    return res.status(200).json({ ok: true });
  } catch (e) {
    if (e instanceof ErroLink) {
      await anotarErro(chaveIp, "ip");
      await esperar(1000);
    }
    if (e instanceof ErroAcesso) return res.status(e.status).json({ error: e.message });
    return res.status(500).json({ error: "não consegui redefinir a senha agora" });
  }
}
const doCorpo = (req) => (typeof req.body === "string" ? safeJson(req.body) : req.body ?? {});

export default async function handler(req, res) {
  cors(req, res);
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const lista = await listarUsuarios();
    const comEmail = lista.length > 0;
    const protege = comEmail || protegido() || temSegredo();

    if (req.method === "GET") {
      const sessao = protege ? await sessaoDaRequisicao(req, res) : null; // abrir o Atlas também renova o login
      const logado = !protege || Boolean(sessao);
      const usuario = sessao ? { nome: sessao.nome, email: sessao.email, papel: sessao.papel, unidades: sessao.unidades, legado: sessao.legado, gerenciaAcessos: Boolean(sessao.gerenciaAcessos), geraRelatorios: Boolean(sessao.geraRelatorios), verRoyalties: Boolean(sessao.verRoyalties), verJuridico: Boolean(sessao.verJuridico), verQualidade: Boolean(sessao.verQualidade), editaQualidade: Boolean(sessao.editaQualidade), preencheChecklist: Boolean(sessao.preencheChecklist), verEstudos: Boolean(sessao.verEstudos), verObras: Boolean(sessao.verObras), trocarSenha: Boolean(sessao.trocarSenha), ...(sessao.papelReal ? { papelReal: sessao.papelReal } : {}), ...(sessao.somenteLeitura ? { simulaNome: sessao.simulaNome } : {}) } : null;
      return res.status(200).json({ protegido: protege, logado, comEmail, usuario });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "método não permitido" });

    const { email, senha, aparelho, acao, token, nova } = doCorpo(req);
    const ctx = { aparelho, ua: req.headers?.["user-agent"], ip: enderecoDe(req), headers: req.headers ?? {} }; // para os avisos por e-mail
    if (acao === "esqueci" || acao === "redefinir") return await tratarRedefinicao(req, res, { acao, comEmail, email, token, nova, ctx });

    // Freio: muitas senhas erradas seguidas bloqueiam o e-mail (ou o endereço) por alguns minutos.
    const chaveIp = `ip:${enderecoDe(req)}`;
    const chaveEmail = `email:${normalizarEmail(email)}`;
    const espera = Math.max(await bloqueadoPor(chaveIp), comEmail ? await bloqueadoPor(chaveEmail) : 0);
    if (espera > 0) {
      res.setHeader("Retry-After", String(espera * 60));
      return res.status(429).json({ error: "muitas tentativas", minutos: espera });
    }

    if (!comEmail) {
      // Transição: ainda não existe nenhum usuário, vale a senha única.
      if (!senhaCorreta(senha)) {
        await esperar(1000); // freia tentativa em série
        await anotarErro(chaveIp, "ip");
        return res.status(401).json({ error: "senha incorreta" });
      }
      return res.status(200).json(criarToken());
    }

    if (!temSegredo()) return res.status(503).json({ error: "servidor sem a chave de acesso configurada" });
    const u = await autenticar(email, senha);
    if (!u) {
      const existe = lista.some((x) => x.email === normalizarEmail(email));
      if (existe) await registrarAcesso({ email, ok: false }).catch(() => {});
      await anotarErro(chaveIp, "ip");
      const bloqueou = await anotarErro(chaveEmail, "email");
      const alvo = lista.find((x) => x.email === normalizarEmail(email));
      if (bloqueou && alvo) await avisarBloqueio(alvo, ctx, 15); // só para e-mail que existe: não revela nem enche a caixa por tentativa em e-mail aleatório
      await esperar(1000);
      return res.status(401).json({ error: "e-mail ou senha incorretos" });
    }
    await zerarErros(chaveEmail);
    await avisarAcesso(u, ctx); // aparelho novo: avisa por e-mail (nunca derruba o login)
    await registrarAcesso({ email: u.email, usuarioId: u.id, nome: u.nome, ok: true }).catch(() => {}); // o registro não derruba o login
    return res.status(200).json({ ...criarTokenUsuario(u.id, Date.now(), { papel: u.papel }), usuario: publico(u) });
  } catch (e) {
    return res.status(500).json({ error: "não consegui entrar agora" });
  }
}

function safeJson(s) {
  try { return JSON.parse(s) ?? {}; } catch { return {}; }
}
