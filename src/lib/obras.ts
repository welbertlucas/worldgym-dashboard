// Unidades em obra: tipos e contas da tela (sem React). A obra anda por marcos; cada marco tem data prevista e, quando acontece, a data real.
export type Marco = { id: string; nome: string; previsto: string | null; real: string | null };
export type Obra = { id: string; nome: string; cidade: string; modelo: "low" | "pro"; m2: number | null; responsavel: string; obs: string; marcos: Marco[]; criadoEm?: string; atualizadoEm?: string };
export type SituacaoObra = "concluida" | "atrasada" | "no-prazo";

/** Marcos de partida de uma obra nova (o dono muda, apaga e acrescenta na própria obra). */
export const MARCOS_PADRAO = [
  "Contrato do ponto assinado", "Projeto aprovado", "Alvará", "Início da obra", "Fim da obra",
  "Equipamentos instalados", "Vistoria da franqueadora", "Inauguração",
] as const;

const pad = (n: number) => String(n).padStart(2, "0");
export const hojeLocal = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dia = (s: string) => Math.round(Date.parse(`${s}T12:00:00Z`) / 86400000);
/** Dias de `de` até `ate` (positivo quando `ate` vem depois). */
export const diasEntre = (de: string, ate: string) => dia(ate) - dia(de);
export const dataBR = (s: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "—");
export const dataCurta = (s: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : "sem data");

export const novoId = (p = "o") => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const obraNova = (): Obra => ({ id: novoId("o"), nome: "", cidade: "", modelo: "low", m2: null, responsavel: "", obs: "", marcos: MARCOS_PADRAO.map((nome) => ({ id: novoId("m"), nome, previsto: null, real: null })) });

export const pendentes = (o: Obra) => o.marcos.filter((m) => !m.real);
export const progresso = (o: Obra) => (o.marcos.length ? Math.round(((o.marcos.length - pendentes(o).length) / o.marcos.length) * 100) : 0);
/** O próximo marco a acontecer: o primeiro da lista que ainda não tem data real. */
export const proximoMarco = (o: Obra) => pendentes(o)[0] ?? null;
/** Marcos atrasados: previstos para antes de hoje e sem data real. */
export const atrasados = (o: Obra, hoje = hojeLocal()) => pendentes(o).filter((m) => m.previsto && m.previsto < hoje);
export function situacao(o: Obra, hoje = hojeLocal()): SituacaoObra {
  if (!pendentes(o).length) return "concluida";
  return atrasados(o, hoje).length ? "atrasada" : "no-prazo";
}
/** Maior atraso em dias (o marco pendente mais antigo vencido); 0 se não há atraso. */
export function diasDeAtraso(o: Obra, hoje = hojeLocal()) {
  const a = atrasados(o, hoje).map((m) => diasEntre(m.previsto as string, hoje));
  return a.length ? Math.max(...a) : 0;
}
/** Inauguração prevista: a data do último marco (a real, se ele já aconteceu). */
export const inauguracao = (o: Obra) => { const u = o.marcos[o.marcos.length - 1]; return u ? u.real ?? u.previsto : null; };

export type ResumoObras = { emObra: number; atrasadas: number; inauguramEm90: number; concluidas: number };
export function resumoDasObras(obras: Obra[], hoje = hojeLocal()): ResumoObras {
  const r = { emObra: 0, atrasadas: 0, inauguramEm90: 0, concluidas: 0 };
  for (const o of obras) {
    const s = situacao(o, hoje);
    if (s === "concluida") { r.concluidas++; continue; }
    r.emObra++;
    if (s === "atrasada") r.atrasadas++;
    const i = inauguracao(o);
    if (i && i >= hoje && diasEntre(hoje, i) <= 90) r.inauguramEm90++;
  }
  return r;
}

/** Ordem da lista: atrasadas primeiro, depois as que inauguram antes, concluídas por último. */
export function ordenar(obras: Obra[], hoje = hojeLocal()): Obra[] {
  const peso = (o: Obra) => ({ atrasada: 0, "no-prazo": 1, concluida: 2 })[situacao(o, hoje)];
  return [...obras].sort((a, b) => peso(a) - peso(b) || (inauguracao(a) ?? "9999").localeCompare(inauguracao(b) ?? "9999") || a.nome.localeCompare(b.nome, "pt-BR"));
}
