// "Feito" do Plano de ação: quem marcou cada item como feito, e quando. Um arquivo só no Blob (plano/feitos.json).
// A chave é mês avaliado + unidade + tipo de alerta: se o mesmo alerta aparecer no mês seguinte, é outra chave e o item
// volta a ficar pendente. Guarda só os últimos meses para o arquivo não crescer.
import { lerJson, gravarJson } from "./armazem.js";
import { propria, veTudo } from "./visibilidade.js";

const CAMINHO = "plano/feitos.json";
const MESES_GUARDADOS = 6;
export const chaveDoItem = (mes, unidade, tipo) => `${mes}|${unidade}|${tipo}`;
const mesValido = (m) => typeof m === "string" && /^\d{4}-\d{2}$/.test(m);
const textoValido = (t) => typeof t === "string" && t.length > 0 && t.length <= 80 && !t.includes("|");

/** A pessoa pode ver (e marcar) itens desta unidade? "Rede" só para quem vê a rede. */
export const podeMarcar = (sessao, unidade) => (unidade === "Rede" ? veTudo(sessao) : veTudo(sessao) || propria(sessao, unidade));

/** Feitos de um mês, só das unidades que a pessoa vê: { [unidade|tipo]: { por, em } }. */
export async function feitosDoMes(mes, sessao) {
  if (!mesValido(mes)) return {};
  const todos = (await lerJson(CAMINHO)) ?? {};
  const out = {};
  for (const [k, v] of Object.entries(todos)) {
    const [m, unidade, tipo] = k.split("|");
    if (m === mes && podeMarcar(sessao, unidade)) out[`${unidade}|${tipo}`] = v;
  }
  return out;
}

export class ErroPlano extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }

/** Marca ou desmarca um item. Devolve o registro gravado (ou null ao desmarcar). */
export async function marcarItem({ mes, unidade, tipo, feito }, sessao, agora = new Date()) {
  if (!mesValido(mes) || !textoValido(unidade) || !textoValido(tipo)) throw new ErroPlano("Item inválido.");
  if (!podeMarcar(sessao, unidade)) throw new ErroPlano("Sem acesso a esta unidade.", 403);
  const todos = (await lerJson(CAMINHO)) ?? {};
  const k = chaveDoItem(mes, unidade, tipo);
  if (feito) todos[k] = { por: sessao.nome || sessao.email || "Alguém", em: agora.toISOString() };
  else delete todos[k];
  // Mantém só os meses mais recentes.
  const meses = [...new Set(Object.keys(todos).map((x) => x.split("|")[0]))].sort().reverse();
  const ficam = new Set(meses.slice(0, MESES_GUARDADOS));
  for (const x of Object.keys(todos)) if (!ficam.has(x.split("|")[0])) delete todos[x];
  await gravarJson(CAMINHO, todos);
  return feito ? todos[k] : null;
}
