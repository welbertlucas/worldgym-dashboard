// Senha do dashboard: o token vem de /api/login e segue em toda chamada de dados.
const API = "https://worldgym-dashboard-sigma.vercel.app/api";
const KEY = "wg-dashboard-token";

export const AUTH_REQUIRED_EVENT = "wg-auth-required";

export function getToken(): string {
  try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; }
}
function setToken(t: string) {
  try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* navegação privada: vale só nesta aba */ }
}
export const logout = () => setToken("");

/** Botão "Sair": apaga o token deste navegador e volta para a tela de senha. */
export function sair() {
  logout();
  window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
}

/** fetch com o token; se o servidor recusar (senha trocada ou token vencido), pede o login de novo. */
export async function authFetch(url: string): Promise<Response> {
  const token = getToken();
  const res = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
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
    const j = (await res.json()) as { protegido: boolean; logado: boolean };
    return j.protegido && !j.logado;
  } catch {
    return false;
  }
}

export async function entrar(senha: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    const res = await fetch(`${API}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ senha }) });
    if (res.status === 401) return { ok: false, erro: "Senha incorreta." };
    if (!res.ok) return { ok: false, erro: "Não consegui entrar agora. Tente de novo em instantes." };
    const { token } = (await res.json()) as { token: string };
    setToken(token);
    return { ok: true };
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor." };
  }
}
