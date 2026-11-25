// Ficha da unidade (aba "Unidades" do menu Franqueadora; só o dono): o que o Atlas ainda não sabia de cada unidade em operação.
// Hoje: aluguel mensal, fim do contrato de locação e observações. O m², o modelo e a abertura já ficam nas premissas dos Estudos de ponto
// (Blob privado) e aparecem aqui só para leitura; as vendas e os alunos vêm do EVO. Tudo no Blob privado (`unidades/fichas.json`): aluguel é
// dado comercial, nunca vai para o repositório (que é público).
import { gravarJson, lerJson } from "./armazem.js";
import { ARQUIVO_PREMISSAS, unidadesDoEstudo } from "./estudos.js";
import { UNIT_NAMES } from "./units.js";

export const ARQUIVO_FICHAS = "unidades/fichas.json";
export class ErroFichas extends Error {
  constructor(msg, status = 400) { super(msg); this.status = status; }
}
const DATA_OK = /^\d{4}-\d{2}-\d{2}$/;
const exigirDono = (s) => { if (s?.papel !== "dono") throw new ErroFichas("só o dono vê e muda as fichas das unidades", 403); };

/** Confere e limpa a ficha que veio da tela: só os campos conhecidos. */
export function limparFicha(f) {
  if (!f || typeof f !== "object") throw new ErroFichas("ficha inválida");
  const aluguel = f.aluguel === null || f.aluguel === undefined || f.aluguel === "" ? null : Number(f.aluguel);
  if (aluguel !== null && !(aluguel > 0 && aluguel <= 2_000_000)) throw new ErroFichas("aluguel inválido (informe o valor mensal em reais)");
  const contratoAte = f.contratoAte ? String(f.contratoAte) : null;
  if (contratoAte && (!DATA_OK.test(contratoAte) || Number.isNaN(Date.parse(`${contratoAte}T12:00:00Z`)))) throw new ErroFichas("data do fim do contrato inválida");
  return { aluguel: aluguel === null ? null : Math.round(aluguel * 100) / 100, contratoAte, obs: String(f.obs ?? "").trim().slice(0, 600) };
}

export async function lerFichasSalvas() {
  const d = await lerJson(ARQUIVO_FICHAS);
  return d?.fichas && typeof d.fichas === "object" ? d.fichas : {};
}

/** As unidades da rede com o que o Atlas já sabe (premissas e EVO) e a ficha guardada. `carregarMeses` devolve o consolidado (injetado nos testes). */
export async function lerFichas(sessao, carregarMeses, mesAtual) {
  exigirDono(sessao);
  const [premissas, meses, fichas] = await Promise.all([lerJson(ARQUIVO_PREMISSAS), carregarMeses(), lerFichasSalvas()]);
  const base = unidadesDoEstudo(meses, premissas ?? {}, mesAtual);
  return { unidades: base.map((u) => ({ nome: u.nome, modelo: u.modelo, m2: u.m2, abertura: u.abertura, madura: u.madura, vendas: u.vendas, alunos: u.alunos, ficha: fichas[u.nome] ?? null })) };
}

export async function salvarFicha(sessao, nome, ficha, { agora = new Date() } = {}) {
  exigirDono(sessao);
  if (!Object.values(UNIT_NAMES).includes(nome)) throw new ErroFichas("unidade desconhecida", 404);
  const nova = { ...limparFicha(ficha), atualizadoEm: agora.toISOString() };
  const fichas = await lerFichasSalvas();
  const vazia = nova.aluguel === null && !nova.contratoAte && !nova.obs;
  if (vazia) delete fichas[nome]; else fichas[nome] = nova;
  await gravarJson(ARQUIVO_FICHAS, { fichas });
  return vazia ? null : nova;
}
