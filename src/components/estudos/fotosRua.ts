// Fotos de rua (Google Street View) para o último slide do PDF dos estudos (pedido do dono, 23/11/2026). O servidor busca na hora de exportar
// e não guarda nada. Pontos novos são estratégia comercial: pergunta uma vez por sessão antes de mandar a posição ao Google (unidades em
// operação têm endereço público e não perguntam).
import { API_BASE, authFetch } from "@/lib/auth";
import type { ConteudoPdf } from "@/lib/estudoPdf";

export interface FotosDaRua { fotos: { rotulo: string; dados: string }[]; data: string | null; distanciaM: number | null; motivo: "sem-imagem" | "indisponivel" | "limite" | null }
type PaginaFotos = NonNullable<ConteudoPdf["fotosDaRegiao"]>[number];

let liberado = false;
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** "2024-03" → "mar/2024". */
export const mesAno = (d: string | null) => {
  const m = d?.match(/^(\d{4})-(\d{2})/);
  return m ? `${MESES[Number(m[2]) - 1] ?? m[2]}/${m[1]}` : null;
};

/** Busca as fotos; null quando a pessoa não autorizou mandar a posição ou o servidor falhou (o PDF sai sem o slide). */
export async function buscarFotosDaRua(c: [number, number], pontoNovo: boolean): Promise<FotosDaRua | null> {
  if (pontoNovo && !liberado) {
    if (typeof window === "undefined" || !window.confirm("Para as fotos da rua no PDF, a posição do ponto será enviada ao Google (Street View). Continuar?")) return null;
    liberado = true;
  }
  try {
    const r = await authFetch(`${API_BASE}/estudos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "fotos-rua", c }) });
    if (!r.ok) return null;
    return (await r.json()) as FotosDaRua;
  } catch { return null; }
}

/** Página do PDF com as fotos (ou o aviso de que não há foto de rua perto). */
export function paginaDeFotos(f: FotosDaRua | null, titulo: string, subtitulo?: string): PaginaFotos | null {
  if (!f) return null;
  if (!f.fotos.length) {
    if (f.motivo !== "sem-imagem") return null; // API desligada ou trava do mês atingida: sai sem o slide, sem alarde
    return { titulo, subtitulo, fotos: [], nota: "O Google não tem fotos de rua oficiais (Street View) perto deste lugar. Vale uma visita ou fotos do local." };
  }
  const quando = mesAno(f.data);
  return {
    titulo, subtitulo,
    fotos: f.fotos.map((x) => ({ dados: x.dados, legenda: x.rotulo })),
    nota: `Imagens © Google Street View${quando ? `, de ${quando}` : ""}: podem não mostrar a situação de hoje. Fotos tiradas da rua mais próxima${f.distanciaM != null ? `, a ${f.distanciaM.toLocaleString("pt-BR")} m do lugar` : ""}; a direção da primeira é calculada e pode não pegar a fachada exata.`,
  };
}

/** Junta as páginas de fotos (as que existem) ao conteúdo do PDF. */
export const comFotosDaRegiao = (c: ConteudoPdf, ...paginas: (PaginaFotos | null)[]): ConteudoPdf => {
  const ps = paginas.filter((x): x is PaginaFotos => !!x);
  return ps.length ? { ...c, fotosDaRegiao: ps } : c;
};
