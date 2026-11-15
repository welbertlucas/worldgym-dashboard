// Freio de tentativas de login: depois de várias senhas erradas seguidas, o e-mail (e o endereço de onde vieram) ficam
// bloqueados por um tempo. O contador fica no armazém (Vercel Blob), não na memória, porque cada pedido pode cair em
// uma instância diferente. Se o armazém falhar, o login segue sem o freio (nunca trava quem tem a senha certa por falha nossa).
import { createHash } from "node:crypto";
import { lerJson, gravarJson } from "./armazem.js";

export const LIMITES = { email: 5, ip: 20 };
export const JANELA_MS = 15 * 60_000;
export const TRAVA_MS = 15 * 60_000;

const caminho = (chave) => `acessos/freio/${createHash("sha256").update(chave).digest("hex").slice(0, 32)}.json`;
const recentes = (reg, agora) => (reg?.erros ?? []).filter((t) => agora - t < JANELA_MS);

/** Minutos que faltam para liberar, ou 0 se não está bloqueado. */
export async function bloqueadoPor(chave, agora = Date.now()) {
  try {
    const reg = await lerJson(caminho(chave));
    return reg?.ate > agora ? Math.ceil((reg.ate - agora) / 60_000) : 0;
  } catch { return 0; }
}

/** Anota uma senha errada; ao passar do limite, bloqueia por TRAVA_MS. */
export async function anotarErro(chave, tipo, agora = Date.now()) {
  try {
    const reg = await lerJson(caminho(chave));
    const erros = [...recentes(reg, agora), agora];
    const ate = erros.length >= LIMITES[tipo] ? agora + TRAVA_MS : reg?.ate > agora ? reg.ate : 0;
    await gravarJson(caminho(chave), { erros: ate && ate > agora && erros.length >= LIMITES[tipo] ? [] : erros, ate });
  } catch { /* sem armazém: sem freio */ }
}

/** Entrou com sucesso: zera os erros do e-mail. */
export async function zerarErros(chave) {
  try {
    const reg = await lerJson(caminho(chave));
    if (reg && (reg.erros?.length || reg.ate)) await gravarJson(caminho(chave), { erros: [], ate: 0 });
  } catch { /* idem */ }
}

/** Endereço de quem chamou (a Vercel preenche x-forwarded-for; o cliente não consegue forjar o primeiro valor dela). */
export const enderecoDe = (req) => String(req.headers?.["x-real-ip"] ?? req.headers?.["x-forwarded-for"] ?? "").split(",")[0].trim() || "desconhecido";
