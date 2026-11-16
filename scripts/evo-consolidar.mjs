// Junta todos os meses em um único arquivo no Blob (o painel lê esse arquivo: 1 operação em vez de ~37 por abertura).
// Rodar sempre depois de qualquer carga que altere os meses.
import { listMonths, loadMonth, saveAll } from "../server/store.js";
import { hojeBR } from "../server/evo.js";
import { gravarFoto } from "../server/fotoDiaria.js";
import { baseDoDia, lerSerie, mesesAnteriores } from "../server/mesmoDia.js";

const meses = await listMonths();
const dados = [];
for (const ym of meses) {
  const m = await loadMonth(ym);
  if (m) dados.push(m);
}
// Mês em andamento: junta em cada unidade a média do mesmo dia dos 3 meses anteriores (inadimplência, recebido e cartões),
// para os alertas compararem o mês parcial com o mesmo ponto dos outros meses. Sem a série, o mês segue sem esse campo.
const hojeLeitura = hojeBR();
const doMes = dados.find((m) => m.month === hojeLeitura.slice(0, 7));
if (doMes) {
  try {
    const series = (await Promise.all(mesesAnteriores(doMes.month, 3).map((ym) => lerSerie(ym)))).filter(Boolean);
    let n = 0;
    for (const u of doMes.units ?? []) {
      const b = series.length ? baseDoDia(series, u.name, Number(hojeLeitura.slice(8))) : null;
      if (b) { u.mesmoDia = b; n++; } else delete u.mesmoDia;
    }
    console.log(`mesmo dia: base de ${series.length} meses em ${n} unidades`);
  } catch (e) {
    console.log(`mesmo dia: FALHOU — ${e.message}`);
  }
}
await saveAll(dados);
console.log(`consolidado: ${dados.length} meses`);

// Foto diária do mês em andamento (para comparar com o mesmo dia dos meses anteriores). Falhar aqui não derruba a consolidação.
const hoje = hojeBR();
const corrente = dados.find((m) => m.month === hoje.slice(0, 7));
if (corrente) {
  try {
    const f = await gravarFoto(corrente, hoje);
    console.log(`foto do dia ${hoje}: ${Object.keys(f.units).length} unidades`);
  } catch (e) {
    console.log(`foto do dia ${hoje}: FALHOU — ${e.message}`);
  }
}
