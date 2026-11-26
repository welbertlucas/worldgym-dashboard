// Documentos das unidades: tipos, pedidos à API e as contas da tela. A permissão é conferida no servidor a cada pedido.
import { API_BASE, authFetch } from "@/lib/auth";

export interface Pasta { id: string; nome: string; paiId: string | null; criadoPor: string; criadoEm: string }
export interface Arquivo { id: string; nome: string; pastaId: string | null; tamanho: number; tipo: string; enviadoPor: string; enviadoEm: string }
export interface UnidadeDocumentos { nome: string; pastas: Pasta[]; arquivos: Arquivo[]; usado: number }
export interface Limites { arquivo: number; unidade: number; niveis: number }
export interface DadosDocumentos { unidades: UnidadeDocumentos[]; limites: Limites; podeApagar: boolean }

export const EXTENSOES = [".pdf", ".jpg", ".jpeg", ".png", ".docx", ".xlsx"];
const MB = 1024 * 1024;

export const tamanhoLegivel = (b: number) => (b >= MB ? `${(b / MB).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024)).toLocaleString("pt-BR")} KB`);

/** Do começo da unidade até a pasta aberta, para o caminho no alto da tela. */
export function caminhoDaPasta(pastas: Pasta[], id: string | null): Pasta[] {
  const out: Pasta[] = [];
  for (let atual = id; atual && out.length < 10;) {
    const p = pastas.find((x) => x.id === atual);
    if (!p) break;
    out.unshift(p);
    atual = p.paiId;
  }
  return out;
}

const emOrdem = <T extends { nome: string }>(lista: T[]) => [...lista].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
export function conteudoDaPasta(u: UnidadeDocumentos, id: string | null) {
  return { pastas: emOrdem(u.pastas.filter((p) => p.paiId === id)), arquivos: emOrdem(u.arquivos.filter((a) => a.pastaId === id)) };
}

/** Por que o arquivo não pode subir (ou null). O servidor confere de novo. */
export function problemaDoArquivo(f: { name: string; size: number }, u: UnidadeDocumentos, limites: Limites): string | null {
  if (!EXTENSOES.some((e) => f.name.toLowerCase().endsWith(e))) return `"${f.name}": só entram PDF, JPG, PNG, Word (.docx) e Excel (.xlsx).`;
  if (f.size > limites.arquivo) return `"${f.name}" tem ${tamanhoLegivel(f.size)}; o limite é ${tamanhoLegivel(limites.arquivo)} por arquivo. Reduza o PDF e envie de novo.`;
  if (u.usado + f.size > limites.unidade) return `"${f.name}" não cabe: a unidade usa ${tamanhoLegivel(u.usado)} de ${tamanhoLegivel(limites.unidade)}.`;
  return null;
}

async function erroDe(res: Response, padrao: string) {
  return new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? padrao);
}

export async function carregarDocumentos(): Promise<DadosDocumentos> {
  const res = await authFetch(`${API_BASE}/documentos`);
  if (!res.ok) throw await erroDe(res, "Não consegui carregar os documentos agora.");
  return (await res.json()) as DadosDocumentos;
}

async function pedir(corpo: Record<string, unknown>) {
  const res = await authFetch(`${API_BASE}/documentos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  if (!res.ok) throw await erroDe(res, "Não consegui salvar agora.");
}
export const criarPasta = (unidade: string, nome: string, pastaId: string | null) => pedir({ acao: "pasta", unidade, nome, pastaId });
export const apagarDocumento = (unidade: string, id: string) => pedir({ acao: "apagar", unidade, id });

export async function enviarArquivo(unidade: string, pastaId: string | null, arquivo: File) {
  const dados = encodeURIComponent(JSON.stringify({ unidade, pastaId, nome: arquivo.name }));
  const res = await authFetch(`${API_BASE}/documentos`, { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Atlas-Documento": dados }, body: arquivo });
  if (!res.ok) throw await erroDe(res, `Não consegui enviar "${arquivo.name}".`);
}

export async function baixarArquivo(unidade: string, a: Arquivo): Promise<Blob> {
  const res = await authFetch(`${API_BASE}/documentos?unidade=${encodeURIComponent(unidade)}&arquivo=${encodeURIComponent(a.id)}`);
  if (!res.ok) throw await erroDe(res, "Não consegui baixar o arquivo agora.");
  return new Blob([await res.arrayBuffer()], { type: a.tipo });
}
