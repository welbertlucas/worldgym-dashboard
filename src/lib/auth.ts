// Senha do dashboard: o token vem de /api/login e segue em toda chamada de dados.
const API = "https://worldgym-dashboard-sigma.vercel.app/api";
export const API_BASE = API;
const KEY = "wg-dashboard-token";

export const AUTH_REQUIRED_EVENT = "wg-auth-required";

export type Papel = "dono" | "master" | "unidades";
export interface Usuario { nome: string; email: string; papel: Papel; unidades: string[]; legado?: boolean }

// Quem está logado e se o login pede e-mail (só depois que o dono cria o primeiro acesso). Vem de GET /api/login.
let usuario: Usuario | null = null;
let comEmail = false;
export const getUsuario = () => usuario;
export const loginComEmail = () => comEmail;
/** Sem informação (sem senha ligada ou API fora do ar) vale como dono: o servidor é quem filtra os dados de verdade. */
export const papelAtual = (): Papel => usuario?.papel ?? "dono";
export const ehDono = () => papelAtual() === "dono";
/** Só o dono atualiza da planilha e gerencia acessos; sem sessão identificada (sem senha ligada) segue como hoje. */
export const podeAtualizar = () => ehDono();
export const podeGerirAcessos = () => usuario?.papel === "dono";
/** Unidades de quem tem acesso só a algumas; null = enxerga todas. */
export const unidadesProprias = (): string[] | null => (usuario?.papel === "unidades" ? usuario.unidades : null);

export function getToken(): string {
  try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; }
}
function setToken(t: string) {
  try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* navegação privada: vale só nesta aba */ }
}
export const logout = () => { setToken(""); usuario = null; };

/** Botão "Sair": apaga o token deste navegador e volta para a tela de senha. */
export function sair() {
  logout();
  window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
}

/** fetch com o token; se o servidor recusar (senha trocada ou token vencido), pede o login de novo. */
export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = getToken();
  const headers = { ...(init?.headers as Record<string, string> | undefined), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const res = await fetch(url, init || token ? { ...init, headers } : undefined);
  if (res.status === 401) {
    logout();
    window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
  }
  return res;
}

/** true = pode entrar (sem senha configurada ou já logado). */
export async function precisaDeLogin(): Promise<boolean> {
  try {
    const token = getToken();
    const res = await fetch(`${API}/login`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
    if (!res.ok) return false; // API fora do ar: deixa abrir; os dados é que não vão carregar
    const j = (await res.json()) as { protegido: boolean; logado: boolean; comEmail?: boolean; usuario?: Usuario | null };
    comEmail = Boolean(j.comEmail);
    usuario = j.logado ? j.usuario ?? null : null;
    return j.protegido && !j.logado;
  } catch {
    return false;
  }
}

export async function entrar(senha: string, email?: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    const res = await fetch(`${API}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(comEmail ? { email, senha } : { senha }) });
    if (res.status === 401) return { ok: false, erro: comEmail ? "E-mail ou senha incorretos." : "Senha incorreta." };
    if (!res.ok) return { ok: false, erro: "Não consegui entrar agora. Tente de novo em instantes." };
    const j = (await res.json()) as { token: string; usuario?: Usuario };
    setToken(j.token);
    usuario = j.usuario ?? null;
    return { ok: true };
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor." };
  }
}
