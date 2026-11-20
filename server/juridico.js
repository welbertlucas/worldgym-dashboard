// Jurídico: processos judiciais e extrajudiciais da rede, vindos da planilha que o escritório jurídico manda todo mês.
// A planilha tem o nome da parte contrária (pessoa física) e textos livres; aqui eles são DESCARTADOS na leitura: o Atlas guarda só o
// que identifica e mede o processo (número, empresa, órgão, tipo, polo, valor, status, última movimentação). O modelo fica no Blob
// privado (juridico/dados.json) e só quem o dono liberou o lê. Nada disso entra no repositório.
import { GoogleAuth } from "google-auth-library";
import { lerJson } from "./armazem.js";

export const ARQUIVO_JURIDICO = "juridico/dados.json";
export const PASTA_HISTORICO_JURIDICO = "juridico/historico";
export const ABAS_JURIDICO = { ativos: "ATIVOS", arquivados: "ARQUIVADOS" };

const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const texto = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

/** Colunas pelo nome do cabeçalho (sem acento e sem diferença de maiúscula), na ordem em que o jurídico manda. */
const COLUNAS = {
  ano: ["ano"],
  numero: ["numero do processo", "processo", "numero"],
  empresa: ["unidade", "empresa"],
  polo: ["polo da acao", "polo"],
  natureza: ["judicial / extrajudicial", "judicial/extrajudicial", "natureza"],
  orgao: ["tribunal", "orgao"],
  juizo: ["juizo"],
  tipo: ["tipo de acao", "tipo"],
  valor: ["valor da causa", "valor"],
  status: ["status do processo", "status"],
  ultimaMov: ["data da ultima movimentacao", "ultima movimentacao"],
};

/** "Flag Academias do Brasil Ldta" e "FLAG ACADEMIAS DO BRASIL LTDA" são a mesma empresa: uma grafia só (Ltda, EPP e artigos certos). */
export function nomeDaEmpresa(bruto) {
  const t = texto(bruto);
  if (!t) return "";
  const palavras = t.replace(/\bldta\b/gi, "Ltda").split(" ").map((p, i) => {
    const m = p.toLowerCase();
    if (["ltda", "ltda.", "epp", "epp.", "me"].includes(m)) return m === "ltda" || m === "ltda." ? "Ltda" : m.toUpperCase();
    if (i > 0 && ["de", "do", "da", "dos", "das", "e"].includes(m)) return m;
    return m.charAt(0).toUpperCase() + m.slice(1);
  });
  return palavras.join(" ").replace(/\s+-\s+EPP\.?$/i, " - EPP");
}
export const chaveDaEmpresa = (bruto) => semAcento(nomeDaEmpresa(bruto)).replace(/[^a-z0-9]+/g, " ").replace(/\bepp\b/g, "").trim();

const NOMES_POLO = { reu: "Réu", autor: "Autor", "terceiro interessado": "Terceiro interessado" };
export const poloDe = (bruto) => { const t = texto(bruto); return NOMES_POLO[semAcento(t)] ?? (t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : ""); };
export const naturezaDe = (bruto) => (semAcento(bruto).startsWith("extra") ? "extrajudicial" : "judicial");

/** Valor da causa: número, "R$ 1.234,56" ou "Sigiloso"/vazio (sem valor). */
export function valorDaCausa(bruto) {
  if (typeof bruto === "number") return Number.isFinite(bruto) ? bruto : null;
  const t = texto(bruto);
  if (!t || /sigil/i.test(t)) return null;
  const n = Number(t.replace(/^R\$\s*/, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Data como número de série do Sheets/Excel, Date, "AAAA-MM-DD..." ou "DD/MM/AAAA" -> "AAAA-MM-DD" (ou null). */
export function dataDoProcesso(bruto) {
  if (bruto instanceof Date && !Number.isNaN(bruto.getTime())) return bruto.toISOString().slice(0, 10);
  if (typeof bruto === "number" && bruto > 20000 && bruto < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(bruto) * 86400000).toISOString().slice(0, 10);
  const t = texto(bruto);
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

/**
 * Uma aba (matriz de linhas) -> processos. O cabeçalho é achado pelo nome das colunas, na ordem que vier. Linhas sem número de processo
 * são ignoradas. A parte contrária, o objeto e o último andamento nunca são lidos.
 */
export function parseAba(linhas, arquivado = false) {
  if (!Array.isArray(linhas) || linhas.length < 2) return [];
  const cab = linhas[0].map(semAcento);
  const col = Object.fromEntries(Object.entries(COLUNAS).map(([k, nomes]) => [k, cab.findIndex((h) => nomes.includes(h))]));
  if (col.numero < 0) return [];
  const pega = (l, k) => (col[k] >= 0 ? l[col[k]] : undefined);
  const out = [];
  for (const l of linhas.slice(1)) {
    const numero = texto(pega(l, "numero"));
    if (!numero) continue;
    const bruto = pega(l, "valor");
    const valor = valorDaCausa(bruto);
    const ano = Number(texto(pega(l, "ano")));
    out.push({
      ano: Number.isInteger(ano) && ano > 1990 ? ano : null,
      numero,
      empresa: nomeDaEmpresa(pega(l, "empresa")),
      polo: poloDe(pega(l, "polo")),
      natureza: naturezaDe(pega(l, "natureza")),
      orgao: texto(pega(l, "orgao")).replace(/^—$/, ""),
      juizo: texto(pega(l, "juizo")).replace(/^—$/, ""),
      tipo: texto(pega(l, "tipo")),
      valor,
      sigiloso: valor === null && /sigil/i.test(texto(bruto)),
      status: texto(pega(l, "status")) || (arquivado ? "Arquivado" : "Ativo"),
      ultimaMov: dataDoProcesso(pega(l, "ultimaMov")),
      arquivado,
    });
  }
  return out;
}

/** As duas abas -> o modelo gravado. Número repetido fica uma vez só (vale o da aba de ativos). */
export function montarJuridico({ ativos, arquivados }, agora = new Date()) {
  const vistos = new Set();
  const processos = [];
  for (const p of [...parseAba(ativos, false), ...parseAba(arquivados, true)]) {
    if (vistos.has(p.numero)) continue;
    vistos.add(p.numero);
    processos.push(p);
  }
  return { atualizadoEm: agora.toISOString(), processos };
}

/** Totais do mês para o histórico (sem nenhum processo): serve à evolução mês a mês. */
export function resumoDoMes(modelo) {
  const ativos = modelo.processos.filter((p) => !p.arquivado);
  return {
    mes: modelo.atualizadoEm.slice(0, 7),
    atualizadoEm: modelo.atualizadoEm,
    ativos: ativos.length,
    arquivados: modelo.processos.length - ativos.length,
    valorEmRisco: ativos.reduce((t, p) => t + (p.valor ?? 0), 0),
    sigilosos: ativos.filter((p) => p.sigiloso).length,
    judiciais: ativos.filter((p) => p.natureza === "judicial").length,
    extrajudiciais: ativos.filter((p) => p.natureza === "extrajudicial").length,
  };
}

/** O modelo gravado pela rotina, ou null enquanto ela ainda não rodou. */
export async function lerJuridico() {
  const dados = await lerJson(ARQUIVO_JURIDICO);
  return dados && typeof dados === "object" && Array.isArray(dados.processos) ? dados : null;
}

/** Lê as duas abas da planilha do jurídico pela conta de serviço (somente leitura). Datas vêm como número de série, valores como número. */
export async function lerJuridicoPlanilha(idPlanilha = process.env.JURIDICO_PLANILHA_ID, chave = process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
  if (!idPlanilha) throw new Error("JURIDICO_PLANILHA_ID não configurada");
  if (!chave) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY não configurada");
  const auth = new GoogleAuth({ credentials: JSON.parse(chave), scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
  const { token } = await (await auth.getClient()).getAccessToken();
  const aba = async (nome) => {
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${idPlanilha}/values/${encodeURIComponent(`'${nome}'`)}!A1:Z2000?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 400) return []; // aba que não existe (ex.: ainda sem arquivados)
    if (!r.ok) throw new Error(`API do Sheets (${nome}): HTTP ${r.status}`);
    return (await r.json()).values ?? [];
  };
  return montarJuridico({ ativos: await aba(ABAS_JURIDICO.ativos), arquivados: await aba(ABAS_JURIDICO.arquivados) });
}
