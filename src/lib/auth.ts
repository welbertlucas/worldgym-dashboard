// Senha do dashboard: o token vem de /api/login e segue em toda chamada de dados.
/** No domínio do Atlas o servidor responde no mesmo endereço (/api); fora dele (GitHub Pages, testes locais) usa o endereço da Vercel. */
const NO_DOMINIO_DO_ATLAS = typeof location !== "undefined" && location.hostname === "atlas.worldgymacademia.com.br";
/** VITE_API_BASE: só para revisar o painel local contra outra API (ex.: uma API de leitura na própria máquina). */
const API_LOCAL = (import.meta.env?.VITE_API_BASE as string | undefined) || "";
export const API_BASE = API_LOCAL || (NO_DOMINIO_DO_ATLAS ? "/api" : "https://worldgym-dashboard-sigma.vercel.app/api");
const API = API_BASE;
const KEY = "wg-dashboard-token";

export const AUTH_REQUIRED_EVENT = "wg-auth-required";

export type Papel = "dono" | "master" | "unidades";
/** `papelReal` só vem quando o dono está simulando outro nível ("ver como"). `gerenciaAcessos`: Master liberado pelo dono a criar acessos. */
export interface Usuario { nome: string; email: string; papel: Papel; unidades: string[]; legado?: boolean; papelReal?: Papel; gerenciaAcessos?: boolean; /** Liberado pelo dono a gerar apresentações no menu Relatórios (o dono sempre gera). */ geraRelatorios?: boolean; /** Vê o menu Royalties: dono e Master sempre; quem tem acesso só a unidades, se o dono liberou. O servidor já manda o valor final. */ verRoyalties?: boolean; /** Vê o menu Jurídico: o dono, e quem ele liberou (qualquer nível). */ verJuridico?: boolean; /** Usa o menu Qualidade: o dono, e quem ele liberou (qualquer nível). */ verQualidade?: boolean; /** Preenche o checklist da própria unidade (só quem tem acesso a unidades e o dono liberou; o dono sempre). */ preencheChecklist?: boolean; /** Edita a qualidade (cria checklists, registra visitas): o dono e quem ele liberou; Master só consulta. */ editaQualidade?: boolean; /** Ainda usa a senha provisória: precisa escolher a própria antes de ver dados. */ trocarSenha?: boolean }

// Quem está logado e se o login pede e-mail (só depois que o dono cria o primeiro acesso). Vem de GET /api/login.
let usuario: Usuario | null = null;
let comEmail = false;
export const getUsuario = () => usuario;
export const loginComEmail = () => comEmail;
/** Quem entrou com a senha provisória só vê a tela de escolher a própria senha. */
export const precisaTrocarSenha = () => usuario?.trocarSenha === true;
/** Sem informação (sem senha ligada ou API fora do ar) vale como dono: o servidor é quem filtra os dados de verdade. */
export const papelAtual = (): Papel => usuario?.papel ?? "dono";
export const ehDono = () => papelAtual() === "dono";
/** Só o dono atualiza da planilha; acessos, o dono e o Master que ele liberou. Sem sessão identificada (sem senha ligada) segue como hoje. */
export const podeAtualizar = () => ehDono();
/** Menu Relatórios: só o dono e quem ele liberou. */
export const podeGerarRelatorios = () => usuario?.papel === "dono" || usuario?.geraRelatorios === true;
/** Menu Royalties (recebimentos da marca): só quem o servidor diz que pode; o servidor confere de novo a cada pedido. */
export const podeVerRoyalties = () => usuario?.verRoyalties === true;
/** Menu Jurídico (processos da rede): só o dono e quem ele liberou; o servidor confere de novo a cada pedido. */
export const podeVerJuridico = () => usuario?.verJuridico === true;
/** Menu Qualidade (checklists e visitas): só o dono e quem ele liberou; o servidor confere de novo a cada pedido. */
export const podeVerQualidade = () => usuario?.verQualidade === true;
/** Checklist da unidade (abertura etc.): quem foi liberado a preencher; o servidor confere de novo. */
export const podePreencherChecklist = () => usuario?.preencheChecklist === true;
/** Comparar a taxa de cartão entre as unidades: só o dono (nem Master nem quem tem acesso a algumas unidades vê). */
export const podeCompararTaxasCartao = () => usuario?.papel === "dono";
/** Editar a qualidade (o servidor confere de novo): sem login (testes e tela aberta) vale como dono. */
export const podeEditarQualidade = () => (usuario ? usuario.editaQualidade === true : true);
export const podeGerirAcessos = () => usuario?.papel === "dono" || usuario?.gerenciaAcessos === true;
/** Unidades de quem tem acesso só a algumas; null = enxerga todas. */
export const unidadesProprias = (): string[] | null => (usuario?.papel === "unidades" ? usuario.unidades : null);

// "Ver como": o dono olha o painel como Master ou como o acesso de algumas unidades. Vale só nesta aba do navegador
// (sessionStorage) e vai em cada pedido no cabeçalho X-Atlas-Ver-Como; quem decide o que aparece é o servidor.
const VER_COMO_KEY = "atlas-ver-como";
export type VerComo = { papel: "master" } | { papel: "unidades"; unidades: string[] } | { papel: "pessoa"; id: string; nome: string };
export function getVerComo(): VerComo | null {
  try { const v = sessionStorage.getItem(VER_COMO_KEY); return v ? (JSON.parse(v) as VerComo) : null; } catch { return null; }
}
/** Troca a simulação (null = voltar a ser dono) e recarrega a página, para todos os dados virem com o novo nível. */
export function definirVerComo(v: VerComo | null) {
  try { v ? sessionStorage.setItem(VER_COMO_KEY, JSON.stringify(v)) : sessionStorage.removeItem(VER_COMO_KEY); } catch { /* sem armazenamento: não simula */ }
  window.location.reload();
}
export const cabecalhoVerComo = (v: VerComo | null = getVerComo()): Record<string, string> =>
  !v ? {} : { "X-Atlas-Ver-Como": v.papel === "master" ? "master" : v.papel === "pessoa" ? `pessoa:${v.id}` : `unidades:${encodeURIComponent(v.unidades.join("|"))}` };
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

// Login por inatividade: o token vence 12 horas depois do último uso (4 horas para quem vê só algumas unidades) e, de qualquer jeito, 7 dias depois da entrada. O servidor manda um token novo neste cabeçalho
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
 * 10 minutos; e, se o token vencer (sem uso por 12 horas, ou 4 para unidades; ou 7 dias desde a entrada), volta sozinho para a tela de login, mesmo sem nenhum clique.
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

/** Espera antes de repetir um pedido recusado com 401, para não derrubar o login por uma falha passageira. */
export const ESPERA_401_MS = 800;

/** O 401 é de "login necessário" (e não, por exemplo, de senha atual errada). */
const recusouPorLogin = async (r: Response) => { try { return ((await r.clone().json()) as { error?: string }).error === "login necessário"; } catch { return false; } };

/** fetch com o token; se o servidor recusar (senha trocada ou token vencido), pede o login de novo. */
export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = getToken();
  const headers = { ...(init?.headers as Record<string, string> | undefined), ...(token ? { Authorization: `Bearer ${token}`, ...cabecalhoVerComo() } : {}) };
  const enviar = () => fetch(url, init || token ? { ...init, headers } : undefined);
  let res = await enviar();
  // Um 401 pode ser passageiro (o servidor falhou um instante ao conferir o acesso). Antes de derrubar o login, e o das outras abas, tenta de novo uma vez.
  if (res.status === 401 && token && (await recusouPorLogin(res))) {
    await new Promise((r) => setTimeout(r, ESPERA_401_MS));
    if (getToken() === token) {
      const de_novo = await enviar();
      if (de_novo.status !== 401) res = de_novo;
    }
  }
  guardarRenovado(res);
  if (res.status === 401) {
    logout();
    window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
  }
  return res;
}

/** A pessoa escolhe a própria senha (`atual` = a provisória na primeira vez). Devolve o erro em português, ou ok. */
export async function trocarMinhaSenha(atual: string, nova: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    const res = await authFetch(`${API}/senha`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ atual, nova }) });
    if (res.status === 429) {
      const { minutos } = (await res.json().catch(() => ({}))) as { minutos?: number };
      return { ok: false, erro: `Muitas tentativas. Tente de novo em ${minutos ?? 15} ${minutos === 1 ? "minuto" : "minutos"}.` };
    }
    const j = (await res.json().catch(() => ({}))) as { error?: string; usuario?: Usuario };
    if (!res.ok) return { ok: false, erro: res.status === 401 && j.error?.includes("atual") ? "A senha atual não confere." : j.error ?? "Não consegui trocar a senha agora." };
    if (usuario) usuario = { ...usuario, trocarSenha: false };
    return { ok: true };
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor." };
  }
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

/** Código aleatório deste navegador (nunca sai de lá a não ser no login), para o aviso de "aparelho novo" por e-mail. */
function idDoAparelho(): string {
  try {
    const k = "atlas-aparelho";
    let v = localStorage.getItem(k);
    if (!v || v.length < 16) { v = crypto.randomUUID(); localStorage.setItem(k, v); }
    return v;
  } catch { return ""; }
}

const TEMPO_DEMAIS = (m?: number) => `Muitas tentativas. Tente de novo em ${m ?? 15} ${m === 1 ? "minuto" : "minutos"}.`;

/** "Esqueci minha senha": o servidor responde sempre igual, tenha o e-mail acesso ou não. */
export async function pedirRedefinicaoDeSenha(email: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    const res = await fetch(`${API}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "esqueci", email }) });
    if (res.status === 429) return { ok: false, erro: TEMPO_DEMAIS(((await res.json().catch(() => ({}))) as { minutos?: number }).minutos) };
    if (!res.ok) return { ok: false, erro: "Não consegui enviar agora. Tente de novo em instantes." };
    return { ok: true };
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor." };
  }
}

/** Escolhe a nova senha com o código do link recebido por e-mail. */
export async function redefinirSenhaComLink(token: string, nova: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    const res = await fetch(`${API}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "redefinir", token, nova }) });
    if (res.status === 429) return { ok: false, erro: TEMPO_DEMAIS(((await res.json().catch(() => ({}))) as { minutos?: number }).minutos) };
    if (!res.ok) return { ok: false, erro: ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Não consegui trocar a senha agora." };
    return { ok: true };
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor." };
  }
}

/** Código do link "#redefinir=..." do e-mail. Sai do endereço na hora (não fica no histórico nem na barra do navegador). */
let tokenLido: string | null | undefined; // lido uma vez por carregamento da página (o React pode chamar duas vezes, e na segunda o endereço já está limpo)
export function tokenDeRedefinicaoNaUrl(): string | null {
  if (tokenLido !== undefined) return tokenLido;
  if (typeof location === "undefined") return null;
  const m = /^#redefinir=([^&]+)/.exec(location.hash);
  if (!m) return (tokenLido = null);
  try { history.replaceState(null, "", location.pathname + location.search); } catch { /* nada */ }
  try { tokenLido = decodeURIComponent(m[1]); } catch { tokenLido = null; }
  return tokenLido;
}

export async function entrar(senha: string, email?: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    const res = await fetch(`${API}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(comEmail ? { email, senha, aparelho: idDoAparelho() } : { senha }) });
    if (res.status === 401) return { ok: false, erro: comEmail ? "E-mail ou senha incorretos." : "Senha incorreta." };
    if (res.status === 429) {
      const { minutos } = (await res.json().catch(() => ({}))) as { minutos?: number };
      return { ok: false, erro: `Muitas tentativas de entrada. Tente de novo em ${minutos ?? 15} ${minutos === 1 ? "minuto" : "minutos"}.` };
    }
    if (!res.ok) return { ok: false, erro: "Não consegui entrar agora. Tente de novo em instantes." };
    const j = (await res.json()) as { token: string; usuario?: Usuario };
    setToken(j.token);
    usuario = j.usuario ?? null;
    return { ok: true };
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor." };
  }
}
