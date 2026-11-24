// Malha do Censo por município (Estudos de ponto fora da região das unidades). A malha principal (estudos/censo.json) cobre só a região das
// unidades; cada município de fora tem o seu arquivo em estudos/censo-mun/<código IBGE>.json (gerado por scripts/censo-municipio.py e
// gravado por scripts/censo-municipio-gravar.mjs) e uma linha no índice estudos/censo-mun/indice.json, com a caixa onde ele tem hexágonos.
// A tela pede os hexágonos do ponto quando ele está fora da malha principal: o servidor devolve os municípios que têm cidade (blocos de
// 0,1 grau do índice) no bloco do ponto ou ao lado. Dado público do IBGE (Censo 2022), mas é estratégia comercial saber onde o dono estuda: sem cache
// e fora do acesso de unidade (api/royalties.js).
import { lerJson } from "./armazem.js";

export const ARQUIVO_INDICE_CENSO_MUN = "estudos/censo-mun/indice.json";
export const arquivoCensoMun = (cod) => `estudos/censo-mun/${cod}.json`;
/** Folga em volta da caixa do município, em km: a área de 10 min de carro passa um pouco da divisa. */
export const FOLGA_KM = 12;

export class ErroCensoMun extends Error {
  constructor(mensagem, status = 400) { super(mensagem); this.status = status; }
}

/**
 * Blocos de 0,1 grau (uns 11 km) onde o município tem cidade: pelo menos 4 hexágonos com 40 moradores ou mais no bloco. A zona rural não
 * entra: cada setor rural vira um hexágono isolado com a população toda, e a caixa do município inteiro cobriria a cidade do vizinho.
 */
const BLOCO = 0.1;
export function blocosUrbanos(celulas) {
  const cont = new Map();
  for (const c of celulas) if (c[2] >= 40) { const k = `${Math.floor(c[0] / BLOCO)},${Math.floor(c[1] / BLOCO)}`; cont.set(k, (cont.get(k) ?? 0) + 1); }
  return [...cont].filter(([, n]) => n >= 4).map(([k]) => k);
}
/** O ponto está num bloco urbano do município ou ao lado de um (a área de 10 min de carro passa um pouco do bloco)? */
export function pertoDosBlocos(c, blocos) {
  const a = Math.floor(c[0] / BLOCO), b = Math.floor(c[1] / BLOCO), s = new Set(blocos);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if (s.has(`${a + i},${b + j}`)) return true;
  return false;
}

/** O ponto [lat, lng] está dentro da caixa [latMin, latMax, lngMin, lngMax], com a folga em km? */
export function dentroDaCaixa(c, caixa, folgaKm = FOLGA_KM) {
  const [la0, la1, ln0, ln1] = caixa;
  const dLat = folgaKm / 110.6, dLng = folgaKm / (111.32 * Math.cos((c[0] * Math.PI) / 180));
  return c[0] >= la0 - dLat && c[0] <= la1 + dLat && c[1] >= ln0 - dLng && c[1] <= ln1 + dLng;
}

/** Hexágonos dos municípios que cobrem o ponto: { municipios: [{ cod, nome, uf, celulas, fatorPadrao? }] } (vazio quando nenhum foi gerado). */
export async function censoDoPonto(pedido) {
  const c = Array.isArray(pedido?.c) ? pedido.c.map(Number) : [];
  if (c.length !== 2 || !c.every(Number.isFinite) || Math.abs(c[0]) > 90 || Math.abs(c[1]) > 180) throw new ErroCensoMun("Posição inválida.");
  const indice = await lerJson(ARQUIVO_INDICE_CENSO_MUN);
  const alvos = (indice?.municipios ?? []).filter((m) => (Array.isArray(m.blocos) ? pertoDosBlocos(c, m.blocos) : Array.isArray(m.caixa) && dentroDaCaixa(c, m.caixa)));
  const municipios = [];
  for (const m of alvos) {
    const arq = await lerJson(arquivoCensoMun(m.cod));
    if (arq?.celulas?.length) municipios.push({ cod: m.cod, nome: m.nome, uf: m.uf, celulas: arq.celulas, ...(m.fatorPadrao ? { fatorPadrao: m.fatorPadrao } : {}) });
  }
  return { municipios };
}
