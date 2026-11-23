// Estudos de ponto: o que a tela precisa para estimar vendas, payback e captação de um ponto candidato.
// As premissas (custos, investimento, régua de payback, m² e abertura das unidades) e a grade do Censo ficam no Blob privado
// (estudos/premissas.json e estudos/censo.json), nunca no repositório: são estratégia comercial. O código só tem as contas.
// Os pontos estudados ficam no Blob, um arquivo por autor (estudos/pontos/<id>.json): o dono lê todos; os outros, só os próprios.
// Só quem pode ver Estudos de ponto (dono e liberados) chega aqui.
import { lerJson, gravarJson, listarCaminhos } from "./armazem.js";
import { COORDENADAS_UNIDADES, UNIT_NAMES } from "./units.js";

export const ARQUIVO_PREMISSAS = "estudos/premissas.json";
export const ARQUIVO_CENSO = "estudos/censo.json";
export const PASTA_PONTOS = "estudos/pontos/";
const idSeguro = (id) => String(id ?? "").replace(/[^a-z0-9_-]/gi, "").slice(0, 60) || "sem-id";
export const arquivoDePontos = (autorId) => `${PASTA_PONTOS}${idSeguro(autorId)}.json`;
export const MAX_PONTOS = 30;

export class ErroEstudos extends Error {
  constructor(msg, status = 400) { super(msg); this.status = status; }
}

/** Meses entre "AAAA-MM" e "AAAA-MM". */
export const mesesEntre = (de, ate) => {
  const [a1, m1] = de.split("-").map(Number), [a2, m2] = ate.split("-").map(Number);
  return (a2 - a1) * 12 + (m2 - m1);
};

/** Total de vendas do EVO (o "Faturamento" do painel): manuais + recorrentes + online. Null quando o mês não tem esse dado. */
export const totalDeVendas = (u) =>
  u?.vendasManuais === undefined && u?.vendasRecorrentes === undefined && u?.vendasOnlineContratos === undefined
    ? null
    : (u.vendasManuais ?? 0) + (u.vendasRecorrentes ?? 0) + (u.vendasOnlineContratos ?? 0);

/** Percentil p (0 a 1) com interpolação, como a régua da rede. */
export function percentil(valores, p) {
  const v = [...valores].sort((a, b) => a - b);
  if (!v.length) return null;
  const i = (v.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return v[lo] + (v[hi] - v[lo]) * (i - lo);
}

/**
 * Unidades da rede com o que o estudo usa: posição, m², modelo, se é madura, vendas médias dos últimos meses fechados e alunos.
 * `meses` = consolidado (todos os meses); `mesAtual` = "AAAA-MM" de hoje (fica de fora por estar em andamento).
 */
export function unidadesDoEstudo(meses, premissas, mesAtual, janela = 4) {
  const fechados = (meses ?? []).filter((m) => m?.month && m.month < mesAtual).sort((a, b) => a.month.localeCompare(b.month)).slice(-janela);
  const atual = (meses ?? []).find((m) => m.month === mesAtual) ?? (meses ?? []).slice().sort((a, b) => b.month.localeCompare(a.month))[0];
  const maturidade = premissas?.regua?.maturidadeMeses ?? 12;
  return Object.entries(UNIT_NAMES).map(([id, nome]) => {
    const p = premissas?.unidades?.[nome] ?? {};
    const vendas = fechados.map((m) => totalDeVendas(m.units?.find((u) => u.name === nome))).filter((v) => v != null && v > 0);
    const ua = atual?.units?.find((u) => u.name === nome);
    const idade = p.abertura ? mesesEntre(p.abertura, mesAtual) : null;
    return {
      nome,
      c: COORDENADAS_UNIDADES[id] ?? null,
      m2: p.m2 ?? null,
      modelo: p.modelo ?? "low",
      abertura: p.abertura ?? null,
      madura: idade != null && idade >= maturidade,
      vendas: vendas.length ? Math.round(vendas.reduce((a, b) => a + b, 0) / vendas.length) : null,
      alunos: ua?.alunosAtivos ?? ua?.ativosFim ?? null,
      // ticket médio realizado no EVO (recebido ÷ pagantes), média dos meses fechados
      ticket: (() => { const t = fechados.map((m) => m.units?.find((u) => u.name === nome)?.ticketMedio).filter((v) => typeof v === "number" && v > 0); return t.length ? Math.round((t.reduce((a, b) => a + b, 0) / t.length) * 100) / 100 : null; })(),
      // onde moram os alunos ativos hoje: [bairro, lat, lng, alunos] (só os com posição de bairro; os do centro da cidade ficam de fora)
      bairros: (ua?.bairros ?? []).filter((x) => !x[5]).map((x) => [x[0], x[3], x[4], x[2]]),
    };
  });
}

/** Vendas por m² da rede madura (P25, mediana e P75), por modelo. A Pro usa a premissa enquanto não houver Pro madura suficiente. */
export function reguaPorM2(unidades, premissas) {
  const out = {};
  for (const modelo of ["low", "pro"]) {
    const vals = unidades.filter((u) => u.modelo === modelo && u.madura && u.vendas && u.m2).map((u) => u.vendas / u.m2);
    const fixo = premissas?.modelos?.[modelo]?.vendasPorM2;
    out[modelo] = vals.length >= 5
      ? { p25: Math.round(percentil(vals, 0.25)), mediana: Math.round(percentil(vals, 0.5)), p75: Math.round(percentil(vals, 0.75)), n: vals.length }
      : fixo ? { p25: Math.round(fixo * 0.8), mediana: fixo, p75: Math.round(fixo * 1.13), n: vals.length } : null;
  }
  return out;
}

/** Ponto estudado, conferido: nada de campo solto vindo do navegador. */
export function pontoValido(p) {
  const c = Array.isArray(p?.c) ? p.c.map(Number) : [];
  if (c.length !== 2 || !c.every(Number.isFinite) || c[0] < -34 || c[0] > 6 || c[1] < -75 || c[1] > -32) throw new ErroEstudos("Posição do ponto inválida.");
  const nome = String(p?.nome ?? "").replace(/\s+/g, " ").trim().slice(0, 80) || "Ponto sem nome";
  const modelo = p?.modelo === "pro" ? "pro" : "low";
  const m2 = Math.round(Number(p?.m2));
  if (!Number.isFinite(m2) || m2 < 300 || m2 > 8000) throw new ErroEstudos("Tamanho do imóvel fora do esperado (300 a 8.000 m²).");
  const imovel = {};
  for (const k of ["fachada", "estacionamento", "polo", "aPe"]) imovel[k] = p?.imovel?.[k] === true;
  // vagas: número inteiro de 0 a 2.000; vazio fica de fora (não informado)
  for (const k of ["vagas", "vagasPerto"]) {
    const v = p?.imovel?.[k];
    if (v === null || v === undefined || v === "") continue;
    const n = Math.round(Number(v));
    if (Number.isFinite(n) && n >= 0 && n <= 2000) imovel[k] = n;
  }
  if (imovel.vagas > 0) imovel.estacionamento = true;
  const id = String(p?.id ?? "").replace(/[^a-z0-9-]/gi, "").slice(0, 40) || `p${Date.now().toString(36)}`;
  const autor = p?.autor ? { id: idSeguro(p.autor.id), nome: String(p.autor.nome ?? "").slice(0, 80) } : null;
  const agora = new Date().toISOString();
  const regiao = String(p?.regiao ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  const out = { id, nome, ...(regiao ? { regiao } : {}), c: [Number(c[0].toFixed(6)), Number(c[1].toFixed(6))], modelo, m2, imovel,
    criadoEm: dataISO(p?.criadoEm) ?? agora, atualizadoEm: dataISO(p?.atualizadoEm) ?? agora, ...(autor ? { autor } : {}) };
  const d = decisaoValida(p?.decisao);
  if (d) out.decisao = d;
  return out;
}

const dataISO = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
export const DECISOES = ["analise", "aprovado", "recusado", "unidade"];
const numero = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);
/** Decisão do dono sobre o estudo; "unidade" = o ponto virou a unidade indicada. `previsao` congela a conta do dia da decisão. */
function decisaoValida(d) {
  if (!d || !DECISOES.includes(d.status)) return null;
  const out = { status: d.status, em: dataISO(d.em) ?? new Date().toISOString() };
  const comentario = String(d.comentario ?? "").trim().slice(0, 500);
  if (comentario) out.comentario = comentario;
  if (d.status === "unidade" && Object.values(UNIT_NAMES).includes(d.unidade)) out.unidade = d.unidade;
  const pv = d.previsao;
  if (pv && numero(pv.provavel) != null) out.previsao = { provavel: numero(pv.provavel), pessimista: numero(pv.pessimista), otimista: numero(pv.otimista) };
  return out;
}

const ehDono = (sessao) => (sessao?.papelReal ?? sessao?.papel) === "dono";
const autorDe = (sessao) => ({ id: idSeguro(sessao?.id), nome: String(sessao?.nome ?? "") });

/** Pontos que a sessão pode ver: o dono vê os de todos os autores; os outros, só os próprios. */
export async function lerPontos(sessao, todos = ehDono(sessao)) {
  const caminhos = todos ? (await listarCaminhos(PASTA_PONTOS)).filter((c) => c.endsWith(".json")) : [arquivoDePontos(autorDe(sessao).id)];
  const arquivos = await Promise.all(caminhos.map((c) => lerJson(c)));
  return arquivos.flatMap((d) => (Array.isArray(d?.pontos) ? d.pontos : []));
}

/**
 * Grava a lista que a tela mandou. Ponto sem autor é de quem salvou. Quem não é o dono só grava os próprios (o resto é ignorado);
 * o dono pode editar os de qualquer autor, e cada autor continua no próprio arquivo. Autor que ficou sem pontos tem o arquivo esvaziado.
 */
export async function salvarPontos(lista, sessao) {
  if (!Array.isArray(lista)) throw new ErroEstudos("Lista de pontos inválida.");
  if (lista.length > MAX_PONTOS) throw new ErroEstudos(`No máximo ${MAX_PONTOS} pontos.`);
  const eu = autorDe(sessao), dono = ehDono(sessao);
  const pontos = lista.map(pontoValido).map((p) => (p.autor && (dono || p.autor.id === eu.id) ? p : { ...p, autor: eu })).filter((p) => dono || p.autor.id === eu.id);
  const porAutor = new Map();
  for (const p of pontos) { if (!porAutor.has(p.autor.id)) porAutor.set(p.autor.id, []); porAutor.get(p.autor.id).push(p); }
  // autores que tinham pontos visíveis a esta sessão e ficaram sem nenhum: esvazia o arquivo deles
  const antes = new Set((await lerPontos(sessao)).map((p) => p.autor?.id).filter(Boolean));
  for (const a of antes) if (!porAutor.has(a) && (dono || a === eu.id)) porAutor.set(a, []);
  if (!porAutor.has(eu.id)) porAutor.set(eu.id, []);
  const em = new Date().toISOString();
  await Promise.all([...porAutor].map(([a, ps]) => gravarJson(arquivoDePontos(a), { pontos: ps, em, por: eu.id })));
  return pontos;
}

/**
 * Quem vê o quê no menu Estudos de ponto:
 * - "completo": o dono e quem ele liberou a fazer estudos (cria, edita, decide);
 * - "consulta": Master (vê tudo, inclusive os estudos de pontos novos, sem editar);
 * - "unidade": quem tem acesso a unidades: só o estudo das próprias unidades, sem premissas, custos, estudos nem vendas de outras.
 */
export function modoDe(sessao) {
  // vale o papel da sessão (no "Ver como" do dono, o papel visto), não o papel real
  if (sessao?.papel === "dono" || sessao?.verEstudos) return "completo";
  if (sessao?.papel === "master") return "consulta";
  return "unidade";
}
export const podeEditar = (sessao) => modoDe(sessao) === "completo";

/** O m² acima do limite conta só uma parte (mesma regra da tela). */
const m2Efetivo = (m2, p) => (!p?.limiteM2 || m2 <= p.limiteM2 ? m2 : p.limiteM2 + (m2 - p.limiteM2) * (p.pesoAcima ?? 1));
/** O que o modelo preveria para cada unidade em operação, pelo m² dela e as vendas por m² da rede. */
export function comPrevisao(unidades, faixas, premissas) {
  return unidades.map((u) => {
    const f = faixas?.[u.modelo], ef = u.m2 ? m2Efetivo(u.m2, premissas?.modelos?.[u.modelo]) : null;
    return f && ef ? { ...u, previsto: { pessimista: Math.round(f.p25 * ef), provavel: Math.round(f.mediana * ef), otimista: Math.round(f.p75 * ef) } } : u;
  });
}

/** Tudo o que a tela lê de uma vez, já cortado pelo modo de quem pede. `carregarMeses` devolve o consolidado (injetado nos testes). */
export async function lerEstudos(carregarMeses, mesAtual, sessao) {
  const modo = modoDe(sessao);
  const [premissas, censo, meses] = await Promise.all([lerJson(ARQUIVO_PREMISSAS), lerJson(ARQUIVO_CENSO), carregarMeses()]);
  if (!premissas) return { disponivel: false, modo };
  const base = unidadesDoEstudo(meses, premissas, mesAtual, premissas?.regua?.janelaMeses ?? 4);
  const vendasPorM2 = reguaPorM2(base, premissas);
  const unidades = comPrevisao(base, vendasPorM2, premissas);
  if (modo !== "unidade") {
    const pontos = await lerPontos(sessao, modo === "consulta" || sessao?.papel === "dono");
    return { disponivel: true, modo, premissas: { regua: premissas.regua, modelos: premissas.modelos, curva: premissas.curva }, vendasPorM2, unidades, censo: censo ?? null, pontos };
  }
  // unidade: as próprias completas; as outras só com nome, posição e m² (para a divisão da captação), sem vendas, alunos nem bairros
  const minhas = new Set(sessao?.unidades ?? []);
  const proprias = unidades.filter((u) => minhas.has(u.nome));
  const outras = unidades.filter((u) => !minhas.has(u.nome)).map((u) => ({ nome: u.nome, c: u.c, m2: u.m2, modelo: u.modelo, abertura: null, madura: false, vendas: null, alunos: null, bairros: [] }));
  const perto = (c) => proprias.some((u) => u.c && Math.hypot((u.c[0] - c[0]) * 110.6, (u.c[1] - c[1]) * 107) <= 15);
  return {
    disponivel: true, modo, minhas: proprias.map((u) => u.nome),
    premissas: { curva: premissas.curva },
    vendasPorM2: Object.fromEntries(Object.entries(vendasPorM2).map(([k, v]) => [k, v ? { mediana: v.mediana, n: v.n } : null])),
    unidades: [...proprias, ...outras],
    censo: censo ? { ...censo, celulas: (censo.celulas ?? []).filter(([la, ln]) => perto([la, ln])) } : null,
    pontos: [],
  };
}
