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
export function contarPorBairro(membros, hoje, entra = ativoNoDia) {
  const por = new Map();
  let semBairro = 0, ativos = 0;
  for (const m of membros) {
    if (!entra(resumoAluno(m).c, hoje)) continue;
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

/** Mesmo dia, um ano antes (AAAA-MM-DD). */
export const umAnoAntes = (dia) => `${Number(dia.slice(0, 4)) - 1}${dia.slice(4)}`;

/**
 * Aluno que saiu nos últimos 12 meses: não está ativo hoje, já teve contrato e o último contrato terminou
 * (ou foi cancelado) de 12 meses atrás até ontem. Quem tem contrato futuro ainda não começado fica de fora.
 */
export function saiuNosUltimos12Meses(contratos, hoje) {
  if (ativoNoDia(contratos, hoje) || contratos.some(([ini]) => ini && ini > hoje)) return false;
  let ultima = "";
  for (const [ini, fim, cancel] of contratos) {
    if (!ini) continue;
    const saida = cancel && (!fim || cancel < fim) ? cancel : fim;
    if (saida && saida > ultima) ultima = saida;
  }
  return ultima >= umAnoAntes(hoje) && ultima < hoje;
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
export async function fotoDosAlunos(idBranch, hoje, jaBaixados = null) {
  const membros = jaBaixados ?? (await fetchAll(`/members?idBranch=${idBranch}`));
  const ativos = membros.filter((m) => ativoNoDia(resumoAluno(m).c, hoje));
  const { lista: inativos, semBairro: semBairroInativos } = contarPorBairro(membros, hoje, saiuNosUltimos12Meses);
  return { ...contarPorBairro(membros, hoje), inativos, semBairroInativos, acessos: contarUltimoAcesso(membros, hoje), perfil: perfilDosAlunos(ativos, hoje) };
}

const UA = "worldgym-dashboard/1.0 (geocodificacao de bairros, uso interno)";
let ultimo = 0;
async function nominatim(q) {
  const espera = ultimo + 1100 - Date.now();
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultimo = Date.now();
  let res;
  for (let t = 1; t <= 5; t++) { // 429/503 do Nominatim são passageiros: espera e tenta de novo
    res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`, { headers: { "User-Agent": UA } });
    if (res.ok || ![429, 502, 503, 504].includes(res.status)) break;
    await new Promise((r) => setTimeout(r, 8000 * t));
    ultimo = Date.now();
  }
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

/**
 * Aplica a foto dos alunos de uma unidade no mês (`u`): geocodifica os bairros novos (guardando em `geo`) e grava
 * bairros, quem saiu, acessos e perfil. Devolve { novos, falhou }: com falha na geocodificação a unidade fica como estava.
 */
export async function aplicarBairros(u, foto, geo, local) {
  const { lista, semBairro, inativos, semBairroInativos, acessos, perfil } = foto;
  let novos = 0;
  let falhou = false;
  // Ativos e quem saiu nos últimos 12 meses: mesma lista de coordenadas (cada bairro é geocodificado uma vez só).
  const localizar = async (itens) => {
    const saida = [];
    for (const b of itens) {
      if (falhou) break;
      const k = chaveBairro(b.bairro, b.cidade);
      if (!geo[k]) {
        try { geo[k] = await coordenadasDoBairro(b); novos++; } catch (e) { falhou = e.message; break; } // não guarda a falha: a próxima carga tenta de novo
      }
      if (geo[k]) saida.push([b.bairro, b.cidade, b.n, geo[k][0], geo[k][1], ...(geo[k][2] ? [1] : [])]);
    }
    return saida;
  };
  const bairros = await localizar(lista);
  const bairrosInativos = await localizar(inativos);
  if (falhou) return { novos, falhou };
  if (local && Number.isFinite(local[0]) && Number.isFinite(local[1]) && (local[0] || local[1])) u.local = local;
  u.bairros = bairros;
  u.bairrosInativos = bairrosInativos;
  u.semBairroInativos = semBairroInativos + inativos.filter((b) => !geo[chaveBairro(b.bairro, b.cidade)]).reduce((s, b) => s + b.n, 0);
  u.acessos = acessos;
  u.perfil = perfil;
  u.semBairro = semBairro + lista.filter((b) => !geo[chaveBairro(b.bairro, b.cidade)]).reduce((s, b) => s + b.n, 0);
  return { novos, falhou };
}
