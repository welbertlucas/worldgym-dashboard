// Lembra a última escolha de cada pessoa no menu Relatórios (neste navegador, por e-mail). Tudo em try/catch: sem armazenamento, o menu abre como sempre.
import { TODOS_OS_IDS } from "@/data/relatorioOpcoes";

export interface Escolhas {
  tipo?: "mes" | "semana";
  escopo?: "todas" | "algumas";
  marcadas?: string[];
  indMes?: string[];
  indSem?: string[];
}

const chave = (email: string) => `atlas.relatorios.escolhas:${email.toLowerCase()}`;
const lista = (v: unknown): string[] | undefined => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : undefined);

/** Lê o que ficou guardado; ids que não existem mais (indicador que saiu do menu) são descartados. */
export function lerEscolhas(email: string, armazem: Pick<Storage, "getItem"> | null = typeof localStorage === "undefined" ? null : localStorage): Escolhas {
  try {
    const j = JSON.parse(armazem?.getItem(chave(email)) ?? "null");
    if (!j || typeof j !== "object") return {};
    const ids = (v: unknown) => lista(v)?.filter((id) => TODOS_OS_IDS.has(id));
    return {
      tipo: j.tipo === "mes" || j.tipo === "semana" ? j.tipo : undefined,
      escopo: j.escopo === "todas" || j.escopo === "algumas" ? j.escopo : undefined,
      marcadas: lista(j.marcadas), indMes: ids(j.indMes), indSem: ids(j.indSem),
    };
  } catch { return {}; }
}

export function salvarEscolhas(email: string, e: Escolhas, armazem: Pick<Storage, "setItem"> | null = typeof localStorage === "undefined" ? null : localStorage): void {
  try { armazem?.setItem(chave(email), JSON.stringify(e)); } catch { /* sem armazenamento: segue sem lembrar */ }
}
