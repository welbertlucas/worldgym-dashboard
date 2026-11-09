import { authFetch, API_BASE, type Papel } from "@/lib/auth";

export interface UsuarioApi { id: string; nome: string; email: string; papel: Papel; unidades: string[]; ativo: boolean; criadoEm: string }
export interface EntradaRegistro { em: string; email: string; usuarioId: string | null; nome: string | null; ok: boolean }
export type Resposta<T> = { ok: true; dados: T } | { ok: false; erro: string };

async function chamar<T>(url: string, init?: RequestInit): Promise<Resposta<T>> {
  try {
    const res = await authFetch(url, init);
    const corpo = (await res.json().catch(() => ({}))) as { error?: string } & T;
    if (!res.ok) return { ok: false, erro: corpo.error ?? "Não consegui concluir agora. Tente de novo." };
    return { ok: true, dados: corpo };
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor." };
  }
}

const enviar = <T>(corpo: object) => chamar<T>(`${API_BASE}/usuarios`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });

export const listarAcessos = () => chamar<{ usuarios: UsuarioApi[]; unidades: string[]; legado: boolean }>(`${API_BASE}/usuarios`);
export const lerRegistro = () => chamar<{ registro: EntradaRegistro[] }>(`${API_BASE}/usuarios?registro=1`);
export const criarDono = (c: { nome: string; email: string; senha: string }) => enviar<{ usuario: UsuarioApi }>({ acao: "primeiro-dono", ...c });
export const criarAcesso = (c: { nome: string; email: string; papel: Papel; unidades: string[] }) => enviar<{ usuario: UsuarioApi; senhaProvisoria: string }>({ acao: "criar", ...c });
export const atualizarAcesso = (id: string, c: Partial<Pick<UsuarioApi, "nome" | "email" | "papel" | "unidades" | "ativo">>) => enviar<{ usuario: UsuarioApi }>({ acao: "atualizar", id, ...c });
export const redefinirSenha = (id: string) => enviar<{ usuario: UsuarioApi; senhaProvisoria: string }>({ acao: "redefinir", id });
