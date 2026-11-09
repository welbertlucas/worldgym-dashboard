// Uso: node --env-file=.env.local scripts/evo-backfill.mjs 2026-09 [2026-10 ...]
// (EVO_DNS e EVO_TOKEN no ambiente; BLOB_READ_WRITE_TOKEN vem do .env.local)
import { computeMonth } from "../server/evo.js";
import { loadMonth, saveMonth } from "../server/store.js";

// Campos que não vêm desta rotina (foto de contratos de evo-contratos.mjs): preserva ao regravar o mês.
const CONTRATOS = ["alunosAtivos", "contratosAtivos", "contratosEspeciais", "contratosPersonal", "contratosLocal", "contratosParcial", "contratosRede", "ativosFim", "ativosIni", "cancelados", "aVencer", "naoRenovados", "naoRenovadosTipos", "naoRenovadosPlanos", "npsPromotores", "npsDetratores", "npsRespostas", "novosContratos", "vendasOnline", "diarias", "camisetas", "coqueteleiras", "personal", "oportunidades", "conversoes", "fluxoNovos", "fluxoRetornos", "fluxoCancelados", "fluxoVencidos", "permanenciaMeses", "motivosCancel", "canceladosTipos", "canceladosPlanos", "origens", "cobrancas", "recusaMotivos", "treinoAtivo", "treinoVencido", "treinoFuturo"];

const falhas = [];
for (const ym of process.argv.slice(2)) {
  const t0 = Date.now();
  let data;
  try {
    data = await computeMonth(ym);
  } catch (e) {
    console.log(`${ym}: FALHOU — ${e.message}`);
    falhas.push(ym);
    continue;
  }
  const antes = await loadMonth(ym).catch(() => null);
  if (antes?.ativosEm) data.ativosEm = antes.ativosEm;
  if (antes?.vendasEm) data.vendasEm = antes.vendasEm;
  if (antes?.contratosEm) data.contratosEm = antes.contratosEm;
  if (antes?.npsEm) data.npsEm = antes.npsEm;
  if (antes?.prospectsEm) data.prospectsEm = antes.prospectsEm;
  if (antes?.cancelEm) data.cancelEm = antes.cancelEm;
  if (antes?.cobrancasEm) data.cobrancasEm = antes.cobrancasEm;
  if (antes?.treinosEm) data.treinosEm = antes.treinosEm;
  for (const u of data.units) {
    const old = antes?.units.find((x) => x.name === u.name);
    if (old) for (const k of CONTRATOS) if (old[k] !== undefined) u[k] = old[k];
  }
  await saveMonth(data);
  const fat = data.units.reduce((s, u) => s + u.faturamento, 0);
  const rec = data.units.reduce((s, u) => s + u.recebimento, 0);
  console.log(`${ym}: ${data.units.length} unidades | faturamento ${fat.toFixed(0)} | recebimento ${rec.toFixed(0)} | ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

if (falhas.length) {
  console.log(`Meses com falha (rodar de novo): ${falhas.join(" ")}`);
  process.exitCode = 1;
}
