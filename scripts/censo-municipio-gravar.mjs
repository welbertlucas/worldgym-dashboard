// Grava no Blob privado a malha do Censo de um ou mais municípios (gerada por scripts/censo-municipio.py) e atualiza o índice
// estudos/censo-mun/indice.json, que diz à API de estudos qual município cobre cada ponto (server/censoMunicipio.js).
// Cada município tem o seu arquivo (estudos/censo-mun/<código IBGE>.json); gravar de novo o mesmo município troca só o arquivo dele.
// NÃO mexe na malha principal (estudos/censo.json). Só grava com a confirmação do dono (regra: gravação no Blob é caso a caso).
//
// Uso: node --env-file=.env.local scripts/censo-municipio-gravar.mjs [--simular] malha1.json [malha2.json ...]
import { readFileSync } from "node:fs";
import { lerJson, gravarJson } from "../server/armazem.js";
import { ARQUIVO_INDICE_CENSO_MUN, arquivoCensoMun, blocosUrbanos } from "../server/censoMunicipio.js";

const args = process.argv.slice(2);
const simular = args.includes("--simular");
const arquivos = args.filter((a) => !a.startsWith("--"));
if (!arquivos.length) { console.error("Uso: node --env-file=.env.local scripts/censo-municipio-gravar.mjs [--simular] malha.json [...]"); process.exit(1); }

const indice = (await lerJson(ARQUIVO_INDICE_CENSO_MUN)) ?? { municipios: [] };
for (const arq of arquivos) {
  const m = JSON.parse(readFileSync(arq, "utf8"));
  const cod = String(m?.municipio?.cod ?? "");
  if (!/^\d{7}$/.test(cod) || !Array.isArray(m.celulas) || !m.celulas.length) { console.error(`${arq}: sem código de município ou sem hexágonos; pulei.`); continue; }
  if (m.rk !== 0.2 || m.lat0 !== -15.8 || m.lng0 !== -47.9) { console.error(`${arq}: reticulado diferente da malha principal; pulei.`); continue; }
  const lats = m.celulas.map((c) => c[0]), lngs = m.celulas.map((c) => c[1]);
  const linha = {
    cod, nome: m.municipio.nome, uf: m.municipio.uf, celulas: m.celulas.length, versao: m.versao,
    caixa: [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)], blocos: blocosUrbanos(m.celulas), em: new Date().toISOString(),
  };
  const moradores = m.celulas.reduce((a, c) => a + c[2], 0);
  console.log(`${simular ? "[simulação] " : ""}${linha.nome}/${linha.uf} (${cod}): ${linha.celulas} hexágonos, ${moradores.toLocaleString("pt-BR")} moradores, ${Math.round(readFileSync(arq).length / 1024)} KB`);
  if (simular) continue;
  await gravarJson(arquivoCensoMun(cod), { rk: m.rk, lat0: m.lat0, lng0: m.lng0, kLat: m.kLat, kLng: m.kLng, versao: m.versao, municipio: m.municipio, celulas: m.celulas });
  indice.municipios = [...indice.municipios.filter((x) => x.cod !== cod), linha].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
if (!simular) {
  await gravarJson(ARQUIVO_INDICE_CENSO_MUN, indice);
  console.log(`índice com ${indice.municipios.length} município(s): ${indice.municipios.map((x) => `${x.nome}/${x.uf}`).join(", ")}`);
}
