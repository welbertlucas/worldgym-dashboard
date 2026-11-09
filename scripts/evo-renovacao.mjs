// Regrava só `naoRenovados` e o detalhe por tipo e por plano (relatório de gestão do EVO) nos meses indicados, sem baixar os contratos de novo.
// Uso: node --env-file=.env.local scripts/evo-renovacao.mjs 2026-10 2026-11
import { hojeBR } from "../server/evo.js";
import { relatorioNaoRenovados } from "../server/renovacao.js";
import { UNIDADES } from "../server/ativos.js";
import { loadMonth, saveMonth } from "../server/store.js";

const hoje = hojeBR();
for (const ym of process.argv.slice(2)) {
  const blob = await loadMonth(ym);
  if (!blob) { console.log(`${ym}: mês não calculado`); continue; }
  const por = await relatorioNaoRenovados(ym, hoje);
  let mudou = 0;
  for (const [id, nome] of Object.entries(UNIDADES)) {
    const u = blob.units.find((x) => x.name === nome);
    if (!u) continue;
    const r = por.get(Number(id));
    const novo = r?.n ?? 0;
    if (u.naoRenovados !== undefined && u.naoRenovados !== novo) mudou++;
    u.naoRenovados = novo;
    u.naoRenovadosTipos = r?.tipos ?? {};
    u.naoRenovadosPlanos = r?.planos ?? [];
  }
  await saveMonth(blob);
  console.log(`${ym}: ${mudou} unidades com valor diferente do gravado`);
}
