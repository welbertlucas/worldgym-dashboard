import { authFetch, API_BASE } from "@/lib/auth";

/** Quem marcou o item como feito e quando. */
export interface Feito { por: string; em: string }
/** Chave do item dentro do mês: "Unidade|tipo de alerta". */
export const chaveFeito = (unidade: string, tipo: string) => `${unidade}|${tipo}`;

/** Feitos do mês avaliado (só das unidades que a pessoa vê). Falha = nenhum (a tela continua funcionando). */
export async function carregarFeitos(mes: string): Promise<Record<string, Feito>> {
  try {
    const r = await authFetch(`${API_BASE}/plano?mes=${encodeURIComponent(mes)}`, { cache: "no-store" });
    return r.ok ? ((await r.json()) as { feitos: Record<string, Feito> }).feitos ?? {} : {};
  } catch { return {}; }
}

/** Marca ou desmarca. Devolve o registro novo (null ao desmarcar) ou um erro em texto. */
export async function marcarFeito(mes: string, unidade: string, tipo: string, feito: boolean): Promise<{ ok: true; item: Feito | null } | { ok: false; erro: string }> {
  try {
    const r = await authFetch(`${API_BASE}/plano`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mes, unidade, tipo, feito }) });
    const j = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, item: (j as { item: Feito | null }).item } : { ok: false, erro: (j as { error?: string }).error ?? "Não consegui salvar." };
  } catch { return { ok: false, erro: "Sem conexão com o servidor." }; }
}
