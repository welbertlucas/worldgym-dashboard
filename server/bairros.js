// Onde moram os alunos ativos: contagem por bairro (nunca endereço de aluno) + coordenadas do bairro.
// As coordenadas vêm do Nominatim (OpenStreetMap, 1 consulta/s) e ficam num cache no Blob para não repetir.
import { fetchAll } from "./evo.js";
import { ativoNoDia, resumoAluno } from "./ativos.js";
import { perfilDosAlunos } from "./perfil.js";

const semAcento = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e"]);

/** "REGIÃO DOS LAGOS (SOBRADINHO)" -> "Região dos Lagos (Sobradinho)". */
export function tituloBairro(s) {
  return s.trim().replace(/\s+/g, " ").toLowerCase().replace(/(^|[\s(\-/])(\p{L})(\p{L}*)/gu, (m, sep, a, resto, off) => {
    const palavra = a + resto;
    return sep + (off > 0 && MINUSCULAS.has(palavra) ? palavra : a.toUpperCase() + resto);
  });
}

/** Chave para juntar variações de escrita do mesmo bairro (caixa, acento, espaços). */
export const chaveBairro = (bairro, cidade) => `${semAcento(bairro).toUpperCase().replace(/\s+/g, " ").trim()}|${semAcento(cidade || "").toUpperCase().replace(/\s+/g, " ").trim()}`;

/** Alunos ativos hoje por bairro: [{bairro, cidade, uf, n}], do maior para o menor. Alunos sem bairro ficam de fora (`semBairro`). */
export function contarPorBairro(membros, hoje) {
  const por = new Map();
  let semBairro = 0, ativos = 0;
  for (const m of membros) {
    if (!ativoNoDia(resumoAluno(m).c, hoje)) continue;
    ativos++;
    const bairro = (m.neighborhood || "").trim();
    if (!bairro) { semBairro++; continue; }
    const cidade = tituloBairro(m.city || "");
    const uf = (m.state || "DF").trim().toUpperCase();
    const k = chaveBairro(bairro, cidade);
    const o = por.get(k) ?? { bairro: tituloBairro(bairro), cidade, uf, n: 0 };
    o.n++;
    por.set(k, o);
  }
  return { lista: [...por.values()].sort((a, b) => b.n - a.n), ativos, semBairro };
}

/** Faixas do último acesso (catraca) dos alunos ativos hoje: até 7 dias, 8–14, 15–30, 31–60, mais de 60 e nunca acessou. */
export const FAIXAS_ACESSO = 6;
export function contarUltimoAcesso(membros, hoje) {
  const faixas = Array(FAIXAS_ACESSO).fill(0);
  const t0 = new Date(`${hoje}T00:00:00Z`);
  for (const m of membros) {
    if (!ativoNoDia(resumoAluno(m).c, hoje)) continue;
    const a = m.lastAccessDate?.slice(0, 10);
    if (!a) { faixas[5]++; continue; }
    const dias = Math.max(0, Math.round((t0 - new Date(`${a}T00:00:00Z`)) / 86400000));
    faixas[dias <= 7 ? 0 : dias <= 14 ? 1 : dias <= 30 ? 2 : dias <= 60 ? 3 : 4]++;
  }
  return faixas;
}

/** Uma única leitura dos alunos da unidade serve aos bairros, ao último acesso e ao perfil (gênero, idade, estado civil). */
export async function fotoDosAlunos(idBranch, hoje) {
  const membros = await fetchAll(`/members?idBranch=${idBranch}`);
  const ativos = membros.filter((m) => ativoNoDia(resumoAluno(m).c, hoje));
  return { ...contarPorBairro(membros, hoje), acessos: contarUltimoAcesso(membros, hoje), perfil: perfilDosAlunos(ativos, hoje) };
}

const UA = "worldgym-dashboard/1.0 (geocodificacao de bairros, uso interno)";
let ultimo = 0;
async function nominatim(q) {
  const espera = ultimo + 1100 - Date.now();
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultimo = Date.now();
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const [r] = await res.json();
  return r ? [Math.round(Number(r.lat) * 1e5) / 1e5, Math.round(Number(r.lon) * 1e5) / 1e5] : null;
}

const semPrefixo = (b) => b.replace(/^(setor habitacional|setor de habitacoes|setor de habitações|setor de|setor|residencial|condominio|condomínio|parque|vila|jardim)\s+/i, "").replace(/\s+-\s+.*$/, "").replace(/\s+(i{1,3}|iv|v|vi{0,3}|ix|x|\d+)$/i, "").trim();

/**
 * Coordenadas do bairro: [lat, lng] ou, quando só o centro da cidade foi achado, [lat, lng, 1] (aproximado). null se nada serviu.
 * Tenta, em ordem: "bairro, cidade, UF"; bairro sem parênteses; o nome dentro dos parênteses; bairro sem prefixo/trecho;
 * bairro só com a UF (a cidade do cadastro costuma vir errada); e por último a cidade.
 */
export async function coordenadasDoBairro({ bairro, cidade, uf }, busca = nominatim) {
  const limpo = bairro.replace(/\(.*?\)/g, "").trim();
  const dentro = bairro.match(/\((.*?)\)/)?.[1]?.trim();
  const base = semPrefixo(limpo);
  const consultas = [
    [bairro, cidade, uf], [limpo, cidade, uf], dentro && [dentro, cidade, uf], base.length > 3 && [base, cidade, uf],
    [limpo, uf], base.length > 3 && [base, uf],
  ].filter(Boolean);
  const vistas = new Set();
  for (const partes of consultas) {
    const q = partes.filter(Boolean).join(", ");
    if (vistas.has(q)) continue;
    vistas.add(q);
    const c = await busca(q);
    if (c) return c;
  }
  if (cidade) {
    const c = await busca([cidade, uf].filter(Boolean).join(", "));
    if (c) return [...c, 1];
  }
  return null;
}
