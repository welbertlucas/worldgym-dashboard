// Lê as campanhas ativas do Meta (só leitura) e grava a foto do dia no Blob.
// Também grava o investimento e os resultados de cada unidade por mês (todas as campanhas, inclusive as pausadas),
// que o painel mostra por mês e os alertas usam. Por padrão refaz o mês anterior e o corrente;
// META_MESES="2025-01..2026-11" refaz outros meses (carga histórica).
// Uso: META_TOKEN_DFGO=... node --env-file=.env.local scripts/meta-campanhas.mjs
import { anunciosDaRede, calorDaRede, campanhasDaRede, listaDeMeses, mesesDaRede, mesesDaRotina } from "../server/meta.js";
import { saveCampanhas, saveMetaMeses } from "../server/store.js";

const tokens = { DFGO: process.env.META_TOKEN_DFGO, BR01: process.env.META_TOKEN_BR01 };
// Sem nenhuma chave cadastrada a rotina fica desligada e termina sem erro (em vez de falhar e mandar e-mail todo dia);
// cadastradas META_TOKEN_DFGO / META_TOKEN_BR01 nos segredos do GitHub, ela passa a gravar sozinha.
if (!tokens.DFGO && !tokens.BR01) {
  console.log("Campanhas do Meta desligadas: nenhuma chave cadastrada (META_TOKEN_DFGO / META_TOKEN_BR01). A foto anterior foi mantida.");
  process.exit(0);
}
const { campanhas, erros } = await campanhasDaRede(tokens);
for (const e of erros) console.log(`ERRO ${e.conta}: ${e.erro}`);
const contasLidas = new Set(campanhas.map((c) => c.conta)).size;
console.log(`${campanhas.length} campanhas ativas em ${contasLidas} contas; ${erros.length} contas com erro`);
if (!campanhas.length && erros.length) throw new Error("Nada foi lido; a foto anterior foi mantida.");
// Ranking dos anúncios (últimos 30 dias). Se falhar, a foto sai sem ele e o painel avisa.
let anuncios = null;
try {
  const r = await anunciosDaRede(tokens);
  for (const e of r.erros) console.log(`ERRO anúncios ${e.conta}: ${e.erro}`);
  anuncios = r.anuncios;
  console.log(`${anuncios.length} anúncios com gasto nos últimos 30 dias (${anuncios.filter((a) => a.imagem).length} com miniatura)`);
} catch (e) { console.log(`anúncios indisponíveis: ${e.message}`); }
// Contatos por dia da semana e hora (últimos 28 dias). Se falhar, a foto sai sem ele.
let calor = null;
try {
  calor = await calorDaRede(tokens);
  for (const e of calor.erros) console.log(`ERRO horários ${e.conta}: ${e.erro}`);
  const total = Object.values(calor.unidades).reduce((s, c) => s + c.reduce((a, b) => a + b, 0), 0);
  const geral = Object.values(calor.totais).reduce((s, n) => s + n, 0);
  console.log(`horários dos contatos: ${total} de ${geral} contatos com horário (${geral ? Math.round((total / geral) * 100) : 0}%), de ${calor.de} a ${calor.ate}, em ${Object.keys(calor.unidades).length} unidades`);
  for (const [u, c] of Object.entries(calor.unidades)) { const t = calor.totais[u] ?? 0; const h = c.reduce((s, n) => s + n, 0); console.log(`  ${u}: ${h} de ${t}`); }
  delete calor.erros;
} catch (e) { console.log(`horários indisponíveis: ${e.message}`); }
await saveCampanhas({ geradoEm: new Date().toISOString(), campanhas, erros, ...(anuncios ? { anuncios } : {}), ...(calor ? { calor } : {}) });
console.log("Gravado: campanhas/atual.json");

const meses = process.env.META_MESES ? listaDeMeses(process.env.META_MESES) : mesesDaRotina();
const porMes = await mesesDaRede(tokens, meses);
for (const [ym, m] of Object.entries(porMes)) {
  const inv = Object.values(m.unidades).reduce((s, u) => s + u.investimento, 0);
  console.log(`${ym}: R$ ${inv.toFixed(2)} investidos em ${Object.keys(m.unidades).length} unidades; ${m.erros.length} contas com erro`);
  const comCompra = Object.entries(m.unidades).filter(([, u]) => u.compras > 0);
  console.log(`  compras pelo pixel: ${comCompra.length ? comCompra.map(([n, u]) => `${n} ${u.compras} (R$ ${u.valorCompras.toFixed(2)})`).join("; ") : "nenhuma conta registrou compra"}`);
}
if (Object.values(porMes).some((m) => Object.keys(m.unidades).length)) {
  await saveMetaMeses(Object.fromEntries(Object.entries(porMes).filter(([, m]) => Object.keys(m.unidades).length)));
  console.log("Gravado: campanhas/meses.json");
}
