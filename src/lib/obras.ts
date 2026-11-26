// Unidades em obra: tipos e contas da tela (sem React). A obra anda por marcos; cada marco tem data prevista e, quando acontece, a data real.
export type Marco = { id: string; nome: string; previsto: string | null; real: string | null };
export type ModeloObra = "low" | "prime" | "pro" | "pro-recovery";
export const NOME_MODELO: Record<ModeloObra, string> = { low: "Low Cost", prime: "Prime", pro: "Pro", "pro-recovery": "Pro / Recovery" };
/** Resumo das tarefas guardado na obra (o servidor calcula): totais e, das pendentes com fim, quantas vencem em cada dia. */
export type ResumoTarefas = { modelo: ModeloObra | null; total: number; concluidas: number; fimPendente: Record<string, number> };
export type Obra = { id: string; nome: string; cidade: string; /** Endereço usado para achar a posição no mapa da rede. */ endereco?: string; /** Posição no mapa da rede [lat, lng]. */ c?: [number, number] | null; modelo: ModeloObra; m2: number | null; responsavel: string; obs: string; marcos: Marco[]; tarefas?: ResumoTarefas; criadoEm?: string; atualizadoEm?: string };
/** Tarefa da implantação: duração em dias corridos; o fim sai do início + duração (dá para mudar); concluída = tem data de conclusão. */
export type Tarefa = { id: string; nome: string; dias: number | null; resp: string; inicio: string | null; fim: string | null; feito: string | null };
export type Fase = { id: string; nome: string; marco: string | null; tarefas: Tarefa[] };
export type ResumoModelo = { id: ModeloObra; nome: string; fases: number; tarefas: number };
export type SituacaoTarefa = "feita" | "atrasada" | "andamento" | "a-fazer";
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
export const obraNova = (): Obra => ({ id: novoId("o"), nome: "", cidade: "", endereco: "", c: null, modelo: "low", m2: null, responsavel: "", obs: "", marcos: MARCOS_PADRAO.map((nome) => ({ id: novoId("m"), nome, previsto: null, real: null })) });

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

// ---------- fases e tarefas ----------

/** Fim pela duração em dias corridos, contando o dia do início (27/11 + 5 dias = 01/12, como no Sults). */
export function fimPelaDuracao(inicio: string | null, dias: number | null) {
  if (!inicio || !dias) return null;
  const t = new Date(`${inicio}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + dias - 1);
  return t.toISOString().slice(0, 10);
}
export function situacaoTarefa(t: Tarefa, hoje = hojeLocal()): SituacaoTarefa {
  if (t.feito) return "feita";
  if (t.fim && t.fim < hoje) return "atrasada";
  if (t.inicio && t.inicio <= hoje) return "andamento";
  return "a-fazer";
}
export const progressoFase = (f: Fase) => (f.tarefas.length ? Math.round((f.tarefas.filter((t) => t.feito).length / f.tarefas.length) * 100) : 0);
/** Tarefas pendentes com o fim antes de hoje, pelo resumo guardado na obra. */
export const tarefasAtrasadas = (r: ResumoTarefas | undefined, hoje = hojeLocal()) => Object.entries(r?.fimPendente ?? {}).reduce((a, [d, n]) => a + (d < hoje ? n : 0), 0);
export const progressoTarefas = (r: ResumoTarefas | undefined) => (r && r.total ? Math.round((r.concluidas / r.total) * 100) : null);
/** Filtro da lista de tarefas: todas, só as pendentes ou só as atrasadas, e busca pelo nome ou pelo responsável. */
export function filtrarFases(fases: Fase[], filtro: "todas" | "pendentes" | "atrasadas", busca = "", hoje = hojeLocal()): Fase[] {
  const q = busca.trim().toLocaleLowerCase("pt-BR");
  return fases.map((f) => ({ ...f, tarefas: f.tarefas.filter((t) => {
    const s = situacaoTarefa(t, hoje);
    if (filtro === "pendentes" && s === "feita") return false;
    if (filtro === "atrasadas" && s !== "atrasada") return false;
    return !q || t.nome.toLocaleLowerCase("pt-BR").includes(q) || t.resp.toLocaleLowerCase("pt-BR").includes(q) || f.nome.toLocaleLowerCase("pt-BR").includes(q);
  }) })).filter((f) => f.tarefas.length || (filtro === "todas" && !q));
}
