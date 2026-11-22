// Com --uf, refaz também os bairros que estão perto mas fora da UF da unidade (Planaltina-GO com bairros caídos em Planaltina-DF).
// Refaz, sem ler o EVO, a localização dos bairros que ficaram longe da própria unidade (geocodificados antes da caixa de busca
// em volta da unidade: em Planaltina-GO, "Setor Norte" caía a 94 km) e põe a unidade no lugar do Google Maps.
// Mexe só no mês corrente (onde ficam os bairros) e no cache de coordenadas. Não roda junto com o evo-sync (00h37).
// Uso: node --env-file=.env.local scripts/bairros-relocalizar.mjs --previa   (só mostra o antes e o depois)
//      node --env-file=.env.local scripts/bairros-relocalizar.mjs            (grava; depois rode scripts/evo-consolidar.mjs)
import { hojeBR } from "../server/evo.js";
import { chaveBairro, coordenadasDoBairro, distanciaKm, longeDaUnidade, ufEsperada } from "../server/bairros.js";
import { COORDENADAS_UNIDADES, UNIT_NAMES } from "../server/units.js";
import { loadGeo, loadMonth, saveGeo, saveMonth } from "../server/store.js";

const previa = process.argv.includes("--previa");
const porUF = process.argv.includes("--uf");
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

/** Caixa do DF (aproximada, um pouco folgada): para achar bairro de unidade goiana caído do lado do DF. */
const dentroDoDF = ([lat, lng]) => lat <= -15.49 && lat >= -16.06 && lng <= -47.3 && lng >= -48.29;

/** % dos alunos (com localização) a até 5 km da unidade. */
const ate5 = (lista, ancora) => { const t = lista.reduce((s, b) => s + b[2], 0); return t ? (lista.filter((b) => distanciaKm(ancora, [b[3], b[4]]) <= 5).reduce((s, b) => s + b[2], 0) / t) * 100 : 0; };

const linhas = [];
let refeitos = 0;
const feitas = new Set();
for (const [id, nome] of Object.entries(UNIT_NAMES)) {
  const u = blob.units.find((x) => x.name === nome);
  const ancora = COORDENADAS_UNIDADES[id];
  if (!u?.bairros || !ancora) continue;
  const antes = mediana(u.bairros, ancora), perto = ate5(u.bairros, ancora);
  const longeAntes = u.bairros.filter((b) => longeDaUnidade([b[3], b[4]], ancora)).reduce((s, b) => s + b[2], 0);
  const refazer = async (lista, campoSem) => {
    const saida = [];
    for (const b of lista) {
      const k = chaveBairro(b[0], b[1]);
      const uf = ufEsperada(b[1], "", nome);
      // Sem --uf, só o que está longe; com --uf, também o bairro de goiano que caiu dentro do DF (nome repetido do outro lado da divisa).
      const conferir = longeDaUnidade([b[3], b[4]], ancora) || (porUF && uf === "GO" && dentroDoDF([b[3], b[4]]));
      if (!conferir) { saida.push(b); continue; }
      // A mesma chave pode já ter sido refeita para esta unidade nesta rodada.
      if (!feitas.has(k)) { geo[k] = await coordenadasDoBairro({ bairro: b[0], cidade: b[1], uf }, undefined, ancora); feitas.add(k); refeitos++; }
      if (geo[k]) saida.push([b[0], b[1], b[2], geo[k][0], geo[k][1], ...(geo[k][2] ? [1] : [])]);
      else u[campoSem] = (u[campoSem] ?? 0) + b[2]; // sem lugar perto da unidade: fica sem localização
    }
    return saida;
  };
  u.bairros = await refazer(u.bairros, "semBairro");
  if (u.bairrosInativos) u.bairrosInativos = await refazer(u.bairrosInativos, "semBairroInativos");
  u.local = ancora;
  linhas.push([nome, antes, mediana(u.bairros, ancora), longeAntes, u.semBairro ?? 0, perto, ate5(u.bairros, ancora)]);
}

console.log("unidade | mediana antes (km) | mediana depois (km) | até 5 km antes | até 5 km depois | alunos a mais de 40 km antes | sem localização agora");
for (const [n, a, d, l, s, p0, p1] of linhas.sort((x, y) => (y[6] - y[5]) - (x[6] - x[5]))) console.log(`${n} | ${a?.toFixed(1)} | ${d?.toFixed(1)} | ${p0.toFixed(0)}% | ${p1.toFixed(0)}% | ${l} | ${s}`);
console.log(`${refeitos} bairros geocodificados de novo.`);
if (previa) {
  console.log("Prévia: nada foi gravado.");
} else {
  await saveGeo(geo);
  blob.bairrosEm = new Date().toISOString();
  await saveMonth(blob);
  console.log(`Gravado: ${ym} e o cache de coordenadas. Agora rode scripts/evo-consolidar.mjs.`);
}
