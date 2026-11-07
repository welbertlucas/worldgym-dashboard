// Junta todos os meses em um único arquivo no Blob (o painel lê esse arquivo: 1 operação em vez de ~37 por abertura).
// Rodar sempre depois de qualquer carga que altere os meses.
import { listMonths, loadMonth, saveAll } from "../server/store.js";

const meses = await listMonths();
const dados = [];
for (const ym of meses) {
  const m = await loadMonth(ym);
  if (m) dados.push(m);
}
await saveAll(dados);
console.log(`consolidado: ${dados.length} meses`);
