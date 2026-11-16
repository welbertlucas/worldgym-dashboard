// Junta todos os meses em um único arquivo no Blob (o painel lê esse arquivo: 1 operação em vez de ~37 por abertura).
// Rodar sempre depois de qualquer carga que altere os meses.
import { listMonths, loadMonth, saveAll } from "../server/store.js";
import { hojeBR } from "../server/evo.js";
import { gravarFoto } from "../server/fotoDiaria.js";

const meses = await listMonths();
const dados = [];
for (const ym of meses) {
  const m = await loadMonth(ym);
  if (m) dados.push(m);
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
