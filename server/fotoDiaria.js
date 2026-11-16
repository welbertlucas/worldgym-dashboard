// Foto diária do mês em andamento: poucos números por unidade, guardados uma vez por dia depois da leitura do EVO.
// Serve para comparar "hoje" com "o mesmo dia dos meses anteriores" (inadimplência, cartões, recebimento...), porque cada
// leitura do EVO sobrescreve o mês. Poucos KB por dia; fica em fotos/AAAA-MM-DD.json (o dia da leitura; os dados vão até a véspera).
import { gravarJson } from "./armazem.js";

export const CAMPOS_DA_FOTO = [
  "faturamento", "previsaoFaturamento", "recebimento", "inadimplentes", "inadimplenciaPerc", "pagantes",
  "novosContratos", "vendasOnline", "cancelados", "ativosIni", "aVencer", "naoRenovados",
  "oportunidades", "conversoes", "npsDetratores", "npsRespostas", "liberacoes",
];

/** Monta a foto de um mês: { mes, dia, units: { [nome]: { campo: valor } } }, com o valor aberto dos cartões recusados. */
export function montarFoto(mes, dia) {
  const units = {};
  for (const u of mes.units ?? []) {
    const f = {};
    for (const c of CAMPOS_DA_FOTO) if (typeof u[c] === "number") f[c] = u[c];
    if (u.cobrancas) { f.cartaoAbertas = u.cobrancas.abertas; f.cartaoValorAberto = u.cobrancas.valorAberto; }
    // Último acesso dos ativos (faixas de server/bairros.js): sem histórico no EVO, a foto é a única forma de comparar depois.
    if (Array.isArray(u.acessos)) f.acessos = u.acessos;
    units[u.name] = f;
  }
  return { mes: mes.month, dia, units };
}

export async function gravarFoto(mes, dia) {
  const foto = montarFoto(mes, dia);
  await gravarJson(`fotos/${dia}.json`, foto);
  return foto;
}
