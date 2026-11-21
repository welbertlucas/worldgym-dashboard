import { API_BASE, authFetch } from "@/lib/auth";
import type { AgendaVisita, DadosQualidade, LocalUnidade, ModeloChecklist, PedidoItem, PlanoAcao, Visita } from "@/data/qualidade";

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
export const pedirItem = (pedido: { modeloId: string; unidade: string; texto: string; motivo: string }) => post<{ pedido: PedidoItem }>({ acao: "pedido", pedido });
export const decidirPedido = (id: string, decisao: { decisao: "aprovar" | "recusar"; resposta?: string; escopo?: "unidade" | "todas"; item?: { texto: string; grupo: string; peso: number; foto: string } }) => post<{ pedido: PedidoItem }>({ acao: "pedido-decidir", id, decisao });
export const salvarAgendamento = (agenda: { id?: string; unidade: string; data: string; modeloId: string; responsavel?: string; observacao?: string }) => post<{ agenda: AgendaVisita }>({ acao: "agenda", agenda });
export const apagarAgendamento = (id: string) => post<{ ok: true }>({ acao: "agenda-apagar", id });
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

export interface Localizacao { lat: number; lng: number; precisao: number }
/** Pede a localização ao aparelho (o navegador pergunta à pessoa). Sem permissão, sem sinal ou sem suporte devolve null: o registro fica só com o horário e o IP. */
export function lerLocalizacao(timeoutMs = 10000): Promise<Localizacao | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    const limite = setTimeout(() => resolve(null), timeoutMs + 1000);
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(limite); resolve({ lat: p.coords.latitude, lng: p.coords.longitude, precisao: Math.round(p.coords.accuracy) }); },
      () => { clearTimeout(limite); resolve(null); },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}
export interface RespostaCheckin { id: string; em: string; comLocalizacao: boolean; comSelfie?: boolean; distanciaM?: number; foraDoLocal?: boolean }
export const fazerCheckin = (checkin: { unidade: string; modeloId: string; loc: Localizacao | null; selfie?: string }) => post<{ checkin: RespostaCheckin }>({ acao: "checkin", checkin });
export const salvarLocalDaUnidade = (unidade: string, local: { lat: number; lng: number; raio: number }) => post<{ local: LocalUnidade }>({ acao: "local", unidade, local });
export const apagarLocalDaUnidade = (unidade: string) => post<{ ok: true }>({ acao: "local", unidade, apagar: true });

/** Reduz a selfie para uma imagem pequena (lado maior de 480 px, JPEG): uns 30 a 60 KB, para o armazenamento ficar leve e barato. */
export const reduzirSelfie = (arquivo: File) => reduzirFoto(arquivo, 480, 100 * 1024);
/** Baixa a selfie (só dono e quem edita a qualidade) e devolve um endereço local para exibir. */
export async function baixarSelfie(codigo: string): Promise<string | null> {
  try {
    const res = await authFetch(`${API_BASE}/qualidade?selfie=${encodeURIComponent(codigo)}`);
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  } catch {
    return null;
  }
}

export const marcarPlanoFeito = (id: string, plano: { texto: string; fotos: string[] }) => post<{ plano: PlanoAcao }>({ acao: "plano-feito", id, plano });
export const validarPlano = (id: string, decisao: { decisao: "confirmar" | "devolver"; texto?: string }) => post<{ plano: PlanoAcao }>({ acao: "plano-validar", id, decisao });
