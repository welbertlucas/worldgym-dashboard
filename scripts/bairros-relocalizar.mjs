// Refaz, sem ler o EVO, a localização dos bairros que ficaram longe da própria unidade (geocodificados antes da caixa de busca
// em volta da unidade: em Planaltina-GO, "Setor Norte" caía a 94 km) e põe a unidade no lugar do Google Maps.
// Mexe só no mês corrente (onde ficam os bairros) e no cache de coordenadas. Não roda junto com o evo-sync (00h37).
// Uso: node --env-file=.env.local scripts/bairros-relocalizar.mjs --previa   (só mostra o antes e o depois)
//      node --env-file=.env.local scripts/bairros-relocalizar.mjs            (grava; depois rode scripts/evo-consolidar.mjs)
import { hojeBR } from "../server/evo.js";
import { chaveBairro, coordenadasDoBairro, distanciaKm, longeDaUnidade } from "../server/bairros.js";
import { COORDENADAS_UNIDADES, UNIT_NAMES } from "../server/units.js";
import { loadGeo, loadMonth, saveGeo, saveMonth } from "../server/store.js";

const previa = process.argv.includes("--previa");
const ym = hojeBR().slice(0, 7);
const blob = await loadMonth(ym);
if (!blob) throw new Error(`Mês ${ym} não encontrado.`);
const geo = await loadGeo();

/** Distância mediana (km) do aluno até a unidade, pesada pelo número de alunos de cada bairro. */
function mediana(lista, ancora) {
  const d = lista.map((b) => [distanciaKm(ancora, [b[3], b[4]]), b[2]]).sort((a, b) => a[0] - b[0]);
  const total = d.reduce((s, x) => s + x[1], 0);
  let acum = 0;
  for (const [km, n] of d) { acum += n; if (acum >= total / 2) return km; }
  return null;
}
const ufDe = (nome, cidade) => (/^bras[ií]lia$/i.test(cidade.trim()) ? "DF" : nome.match(/-(GO|BA)$/)?.[1] ?? "DF");

const linhas = [];
let refeitos = 0;
for (const [id, nome] of Object.entries(UNIT_NAMES)) {
  const u = blob.units.find((x) => x.name === nome);
  const ancora = COORDENADAS_UNIDADES[id];
  if (!u?.bairros || !ancora) continue;
  const antes = mediana(u.bairros, ancora);
  const longeAntes = u.bairros.filter((b) => longeDaUnidade([b[3], b[4]], ancora)).reduce((s, b) => s + b[2], 0);
  const refazer = async (lista, campoSem) => {
    const saida = [];
    for (const b of lista) {
      if (!longeDaUnidade([b[3], b[4]], ancora)) { saida.push(b); continue; }
      const k = chaveBairro(b[0], b[1]);
      // A mesma chave pode já ter sido refeita para esta unidade nesta rodada.
      if (!geo[k] || longeDaUnidade(geo[k], ancora)) { geo[k] = await coordenadasDoBairro({ bairro: b[0], cidade: b[1], uf: ufDe(nome, b[1]) }, undefined, ancora); refeitos++; }
      if (geo[k]) saida.push([b[0], b[1], b[2], geo[k][0], geo[k][1], ...(geo[k][2] ? [1] : [])]);
      else u[campoSem] = (u[campoSem] ?? 0) + b[2]; // sem lugar perto da unidade: fica sem localização
    }
    return saida;
  };
  u.bairros = await refazer(u.bairros, "semBairro");
  if (u.bairrosInativos) u.bairrosInativos = await refazer(u.bairrosInativos, "semBairroInativos");
  u.local = ancora;
  linhas.push([nome, antes, mediana(u.bairros, ancora), longeAntes, u.semBairro ?? 0]);
}

console.log("unidade | mediana antes (km) | mediana depois (km) | alunos a mais de 40 km antes | sem localização agora");
for (const [n, a, d, l, s] of linhas.sort((x, y) => (y[3] - x[3]))) console.log(`${n} | ${a?.toFixed(1)} | ${d?.toFixed(1)} | ${l} | ${s}`);
console.log(`${refeitos} bairros geocodificados de novo.`);
if (previa) {
  console.log("Prévia: nada foi gravado.");
} else {
  await saveGeo(geo);
  blob.bairrosEm = new Date().toISOString();
  await saveMonth(blob);
  console.log(`Gravado: ${ym} e o cache de coordenadas. Agora rode scripts/evo-consolidar.mjs.`);
}
