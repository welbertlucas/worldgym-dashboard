import { API_BASE, authFetch } from "@/lib/auth";
import type { DadosQualidade, ModeloChecklist, Visita } from "@/data/qualidade";

type Retorno<T> = { ok: true; dados: T } | { ok: false; erro: string; status: number };

async function chamar<T>(url: string, init?: RequestInit): Promise<Retorno<T>> {
  try {
    const res = await authFetch(url, init);
    const corpo = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, erro: corpo.error ?? "Não consegui concluir agora. Tente de novo.", status: res.status };
    return { ok: true, dados: corpo as T };
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor. Tente de novo.", status: 0 };
  }
}
const post = <T>(corpo: unknown) => chamar<T>(`${API_BASE}/qualidade`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });

export const lerQualidade = () => chamar<DadosQualidade>(`${API_BASE}/qualidade`);
export const salvarModelo = (modelo: Partial<ModeloChecklist>) => post<{ modelo: ModeloChecklist }>({ acao: "modelo", modelo });
export const apagarModelo = (id: string) => post<{ ok: true }>({ acao: "modelo-apagar", id });
export const salvarVisita = (visita: unknown) => post<{ visita: Visita }>({ acao: "visita", visita });
export const salvarEnvio = (envio: unknown) => post<{ envio: Visita }>({ acao: "envio", envio });
export const apagarEnvio = (id: string, mes: string) => post<{ ok: true }>({ acao: "envio-apagar", id, mes });
export const apagarVisita = (id: string, mes: string) => post<{ ok: true }>({ acao: "visita-apagar", id, mes });
export const enviarFoto = (dados: string) => post<{ id: string }>({ acao: "foto", dados });

/** Baixa a foto (a rota exige login, então não dá para usar <img src> direto) e devolve um endereço local para exibir. */
export async function baixarFoto(id: string): Promise<string | null> {
  try {
    const res = await authFetch(`${API_BASE}/qualidade?foto=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  } catch {
    return null;
  }
}

/** Reduz a foto do celular (lado maior de 1280 px, JPEG) até caber no limite do servidor. Devolve o texto base64 sem o prefixo. */
export async function reduzirFoto(arquivo: File, ladoMax = 1280, maxBytes = 600 * 1024): Promise<string> {
  const bmp = await createImageBitmap(arquivo);
  const k = Math.min(1, ladoMax / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  for (let q = 0.78; q >= 0.4; q -= 0.12) {
    const dados = canvas.toDataURL("image/jpeg", q).split(",")[1];
    if (dados.length * 0.75 <= maxBytes) return dados;
  }
  throw new Error("A foto ficou grande demais.");
}
