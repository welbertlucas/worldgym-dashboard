// Senha do dashboard: o token vem de /api/login e segue em toda chamada de dados.
/** No domínio do Atlas o servidor responde no mesmo endereço (/api); fora dele (GitHub Pages, testes locais) usa o endereço da Vercel. */
const NO_DOMINIO_DO_ATLAS = typeof location !== "undefined" && location.hostname === "atlas.worldgymacademia.com.br";
export const API_BASE = NO_DOMINIO_DO_ATLAS ? "/api" : "https://worldgym-dashboard-sigma.vercel.app/api";
const API = API_BASE;
const KEY = "wg-dashboard-token";

export const AUTH_REQUIRED_EVENT = "wg-auth-required";

export type Papel = "dono" | "master" | "unidades";
/** `papelReal` só vem quando o dono está simulando outro nível ("ver como"). */
export interface Usuario { nome: string; email: string; papel: Papel; unidades: string[]; legado?: boolean; papelReal?: Papel }

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

// "Ver como": o dono olha o painel como Master ou como o acesso de algumas unidades. Vale só nesta aba do navegador
// (sessionStorage) e vai em cada pedido no cabeçalho X-Atlas-Ver-Como; quem decide o que aparece é o servidor.
const VER_COMO_KEY = "atlas-ver-como";
export type VerComo = { papel: "master" } | { papel: "unidades"; unidades: string[] };
export function getVerComo(): VerComo | null {
  try { const v = sessionStorage.getItem(VER_COMO_KEY); return v ? (JSON.parse(v) as VerComo) : null; } catch { return null; }
}
/** Troca a simulação (null = voltar a ser dono) e recarrega a página, para todos os dados virem com o novo nível. */
export function definirVerComo(v: VerComo | null) {
  try { v ? sessionStorage.setItem(VER_COMO_KEY, JSON.stringify(v)) : sessionStorage.removeItem(VER_COMO_KEY); } catch { /* sem armazenamento: não simula */ }
  window.location.reload();
}
export const cabecalhoVerComo = (v: VerComo | null = getVerComo()): Record<string, string> =>
  !v ? {} : { "X-Atlas-Ver-Como": v.papel === "master" ? "master" : `unidades:${encodeURIComponent(v.unidades.join("|"))}` };
/** O dono está vendo o painel como outro nível. */
export const simulando = () => usuario?.papelReal === "dono";
/** Quem pode usar o "ver como": o dono de verdade (simulando ou não), com login por e-mail. */
export const podeVerComo = () => !usuario?.legado && (usuario?.papel === "dono" || simulando());

export function getToken(): string {
  try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; }
}
function setToken(t: string) {
  try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* navegação privada: vale só nesta aba */ }
}
export const logout = () => { setToken(""); usuario = null; try { sessionStorage.removeItem(VER_COMO_KEY); } catch { /* nada */ } };

/** Botão "Sair": apaga o token deste navegador e volta para a tela de senha. */
export function sair() {
  logout();
  window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
}

// Login por inatividade: o token vence 12 horas depois do último uso. O servidor manda um token novo neste cabeçalho
// (no máximo a cada 5 minutos) e o navegador troca o seu.
const CABECALHO_TOKEN = "X-Atlas-Token";
/** Troca o token pelo renovado, se veio um (e se a pessoa não saiu enquanto o pedido estava no ar). */
function guardarRenovado(res: Response) {
  const novo = res.headers?.get?.(CABECALHO_TOKEN);
  if (novo && getToken()) setToken(novo);
}

/** Quando o token vence (ms), ou null se não há token legível. */
export function vencimentoDoToken(t = getToken()): number | null {
  if (!t) return null;
  const p = t.split(".");
  try {
    const exp = p[0] === "v2" ? JSON.parse(atob(p[1].replace(/-/g, "+").replace(/_/g, "/"))).e : p[0];
    return Number(exp) || null;
  } catch {
    return null;
  }
}

const RENOVAR_POR_USO_MS = 10 * 60 * 1000;
/**
 * Enquanto o Atlas está aberto: mexer na tela (clique, tecla, rolagem) renova o login no servidor, no máximo a cada
 * 10 minutos; e, se o token vencer (12 horas sem uso), volta sozinho para a tela de login, mesmo sem nenhum clique.
 * Devolve a função que desliga a vigia.
 */
export function vigiarSessao(agora: () => number = Date.now): () => void {
  let ultima = agora();
  const venceu = () => {
    const v = vencimentoDoToken();
    if (v === null || v > agora()) return false;
    sair();
    return true;
  };
  const uso = () => {
    if (!getToken() || venceu() || agora() - ultima < RENOVAR_POR_USO_MS) return;
    ultima = agora();
    authFetch(`${API}/login`).catch(() => { /* sem rede: tenta no próximo uso */ });
  };
  const aoVoltar = () => { if (document.visibilityState === "visible") uso(); };
  const eventos = ["pointerdown", "keydown", "wheel", "touchmove"] as const;
  for (const e of eventos) window.addEventListener(e, uso, { passive: true });
  document.addEventListener("visibilitychange", aoVoltar);
  const relogio = setInterval(venceu, 60 * 1000);
  return () => {
    for (const e of eventos) window.removeEventListener(e, uso);
    document.removeEventListener("visibilitychange", aoVoltar);
    clearInterval(relogio);
  };
}

/** fetch com o token; se o servidor recusar (senha trocada ou token vencido), pede o login de novo. */
export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = getToken();
  const headers = { ...(init?.headers as Record<string, string> | undefined), ...(token ? { Authorization: `Bearer ${token}`, ...cabecalhoVerComo() } : {}) };
  const res = await fetch(url, init || token ? { ...init, headers } : undefined);
  guardarRenovado(res);
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
    const res = await fetch(`${API}/login`, token ? { headers: { Authorization: `Bearer ${token}`, ...cabecalhoVerComo() } } : undefined);
    if (!res.ok) return false; // API fora do ar: deixa abrir; os dados é que não vão carregar
    guardarRenovado(res);
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
