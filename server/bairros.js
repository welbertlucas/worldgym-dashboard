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

const UFS = { "DISTRITO FEDERAL": "DF", GOIAS: "GO", BAHIA: "BA", "MINAS GERAIS": "MG", "SAO PAULO": "SP", TOCANTINS: "TO", "MATO GROSSO": "MT", "MATO GROSSO DO SUL": "MS" };
/** Sigla da UF do cadastro ("Goiás", "go", "GO" -> "GO"); vazio quando não dá para saber. */
export function normalizarUF(s) {
  const t = semAcento(String(s || "")).toUpperCase().replace(/\s+/g, " ").trim();
  return /^[A-Z]{2}$/.test(t) ? t : UFS[t] ?? "";
}
/** UF da unidade pelo nome do painel ("Planaltina-GO" -> "GO"; sem sufixo é do DF). */
export const ufDaUnidade = (nome) => String(nome || "").match(/-(GO|BA|MG|SP)$/)?.[1] ?? "DF";
/** UF em que o bairro deve estar: Brasília é sempre DF; senão a do cadastro; sem ela, a da unidade. */
export const ufEsperada = (cidade, uf, nomeUnidade) => (/^bras[ií]lia$/i.test(String(cidade || "").trim()) ? "DF" : uf || ufDaUnidade(nomeUnidade));

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
    const uf = normalizarUF(m.state); // vazio quando o cadastro não diz: quem aplica completa com a UF da unidade
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

/** Faixas do último acesso (catraca) dos alunos ativos hoje: até 7 dias, 8–15, 16–30, 31–60, mais de 60 e nunca acessou (o corte de 15 dias é o de "sem vir há mais de 15 dias"). */
export const FAIXAS_ACESSO = 6;
export function contarUltimoAcesso(membros, hoje) {
  const faixas = Array(FAIXAS_ACESSO).fill(0);
  const t0 = new Date(`${hoje}T00:00:00Z`);
  for (const m of membros) {
    if (!ativoNoDia(resumoAluno(m).c, hoje)) continue;
    const a = m.lastAccessDate?.slice(0, 10);
    if (!a) { faixas[5]++; continue; }
    const dias = Math.max(0, Math.round((t0 - new Date(`${a}T00:00:00Z`)) / 86400000));
    faixas[dias <= 7 ? 0 : dias <= 15 ? 1 : dias <= 30 ? 2 : dias <= 60 ? 3 : 4]++;
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

/** Bairro mais longe que isto da unidade é engano da busca (nome repetido noutra cidade): fica sem localização. */
export const RAIO_MAX_KM = 40;
/** Meia-largura, em graus, da caixa de busca em volta da unidade (~44 km): o Nominatim só devolve o que cai dentro. */
const CAIXA_GRAUS = 0.4;

/** Distância em km entre [lat, lng] e [lat, lng]. */
export function distanciaKm(a, b) {
  const r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** [lat, lng] válido da unidade, ou null. */
export const ancoraValida = (p) => (p && Number.isFinite(p[0]) && Number.isFinite(p[1]) && (p[0] || p[1]) ? [p[0], p[1]] : null);

/** Coordenada guardada que está longe demais da unidade (geocodificada antes da caixa de busca, ou para outra unidade). */
export const longeDaUnidade = (c, ancora) => !!(c && ancora && distanciaKm(ancora, c) > RAIO_MAX_KM);

let ultimo = 0;
async function nominatim(q, ancora = null) {
  const espera = ultimo + 1100 - Date.now();
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultimo = Date.now();
  let res;
  for (let t = 1; t <= 5; t++) { // 429/503 do Nominatim são passageiros: espera e tenta de novo
    const caixa = ancora ? `&viewbox=${ancora[1] - CAIXA_GRAUS},${ancora[0] + CAIXA_GRAUS},${ancora[1] + CAIXA_GRAUS},${ancora[0] - CAIXA_GRAUS}&bounded=1` : "";
    res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&countrycodes=br${caixa}&q=${encodeURIComponent(q)}`, { headers: { "User-Agent": UA } });
    if (res.ok || ![429, 502, 503, 504].includes(res.status)) break;
    await new Promise((r) => setTimeout(r, 8000 * t));
    ultimo = Date.now();
  }
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const [r] = await res.json();
  // A UF do resultado (ISO "BR-GO") serve para recusar o bairro de mesmo nome do outro lado da divisa (Planaltina-DF x Planaltina-GO).
  // A cidade do resultado serve para recusar o bairro de mesmo nome noutra cidade (o "Setor Norte" de Formosa para Planaltina-GO).
  const a = r?.address ?? {};
  return r ? { c: [Math.round(Number(r.lat) * 1e5) / 1e5, Math.round(Number(r.lon) * 1e5) / 1e5], uf: String(a["ISO3166-2-lvl4"] || "").replace(/^BR-/, ""), cidade: a.city || a.town || a.village || a.municipality || "" } : null;
}

const semPrefixo = (b) => b.replace(/^(setor habitacional|setor de habitacoes|setor de habitações|setor de|setor|residencial|condominio|condomínio|parque|vila|jardim)\s+/i, "").replace(/\s+-\s+.*$/, "").replace(/\s+(i{1,3}|iv|v|vi{0,3}|ix|x|\d+)$/i, "").trim();

/**
 * Coordenadas do bairro: [lat, lng] ou, quando só o centro da cidade foi achado, [lat, lng, 1] (aproximado). null se nada serviu.
 * Tenta, em ordem: "bairro, cidade, UF"; bairro sem parênteses; o nome dentro dos parênteses; bairro sem prefixo/trecho;
 * bairro só com a UF (a cidade do cadastro costuma vir errada); e por último a cidade.
 * Com `ancora` ([lat, lng] da unidade), a busca fica numa caixa em volta dela e resultado a mais de RAIO_MAX_KM é descartado:
 * sem isso, "Setor Norte, GO" (Planaltina-GO não tem os setores no OpenStreetMap) caía num Setor Norte a 94 km.
 * Com `uf`, resultado noutra UF também é descartado (o "Setor Norte" de Planaltina-DF não serve para quem mora em Planaltina-GO).
 * E resultado noutra cidade também (o "Setor Norte" de Formosa não serve para Planaltina-GO); quem mora em "Brasília" pode estar em qualquer região do DF.
 * `busca` devolve [lat, lng] ou { c: [lat, lng], uf, cidade }.
 */
export async function coordenadasDoBairro({ bairro, cidade, uf }, busca = nominatim, ancora = null) {
  const limpo = bairro.replace(/\(.*?\)/g, "").trim();
  const dentro = bairro.match(/\((.*?)\)/)?.[1]?.trim();
  const base = semPrefixo(limpo);
  const consultas = [
    [bairro, cidade, uf], [limpo, cidade, uf], dentro && [dentro, cidade, uf], base.length > 3 && [base, cidade, uf],
    [limpo, uf], base.length > 3 && [base, uf],
  ].filter(Boolean);
  const vistas = new Set();
  const serve = (r) => {
    const c = Array.isArray(r) ? r : r?.c;
    if (!c || longeDaUnidade(c, ancora)) return null;
    if (uf && !Array.isArray(r) && r.uf && r.uf !== uf) return null;
    const cid = semAcento(String(cidade || "")).toLowerCase().trim();
    const cidR = Array.isArray(r) ? "" : semAcento(String(r.cidade || "")).toLowerCase().trim();
    if (cid && cidR && cid !== "brasilia" && cidR !== cid) return null;
    return [c[0], c[1]];
  };
  for (const partes of consultas) {
    const q = partes.filter(Boolean).join(", ");
    if (vistas.has(q)) continue;
    vistas.add(q);
    const c = serve(await busca(q, ancora));
    if (c) return c;
  }
  if (cidade) {
    const c = serve(await busca([cidade, uf].filter(Boolean).join(", "), ancora));
    if (c) return [c[0], c[1], 1];
  }
  return null;
}

/**
 * Aplica a foto dos alunos de uma unidade no mês (`u`): geocodifica os bairros novos (guardando em `geo`) e grava
 * bairros, quem saiu, acessos e perfil. Devolve { novos, falhou }: com falha na geocodificação a unidade fica como estava.
 */
export async function aplicarBairros(u, foto, geo, local, busca = nominatim) {
  const { lista, semBairro, inativos, semBairroInativos, acessos, perfil } = foto;
  let novos = 0;
  let falhou = false;
  const ancora = ancoraValida(local);
  // Ativos e quem saiu nos últimos 12 meses: mesma lista de coordenadas (cada bairro é geocodificado uma vez só).
  const localizar = async (itens) => {
    const saida = [];
    for (const b of itens) {
      if (falhou) break;
      const k = chaveBairro(b.bairro, b.cidade);
      // Coordenada longe da unidade (de antes da caixa de busca) é refeita; se continuar sem lugar perto, o bairro fica sem localização.
      if (!geo[k] || longeDaUnidade(geo[k], ancora)) {
        try { geo[k] = await coordenadasDoBairro({ ...b, uf: ufEsperada(b.cidade, b.uf, u.name) }, busca, ancora); novos++; } catch (e) { falhou = e.message; break; } // não guarda a falha: a próxima carga tenta de novo
      }
      if (geo[k]) saida.push([b.bairro, b.cidade, b.n, geo[k][0], geo[k][1], ...(geo[k][2] ? [1] : [])]);
    }
    return saida;
  };
  const bairros = await localizar(lista);
  const bairrosInativos = await localizar(inativos);
  if (falhou) return { novos, falhou };
  if (ancora) u.local = ancora;
  u.bairros = bairros;
  u.bairrosInativos = bairrosInativos;
  u.semBairroInativos = semBairroInativos + inativos.filter((b) => !geo[chaveBairro(b.bairro, b.cidade)]).reduce((s, b) => s + b.n, 0);
  u.acessos = acessos;
  u.perfil = perfil;
  u.semBairro = semBairro + lista.filter((b) => !geo[chaveBairro(b.bairro, b.cidade)]).reduce((s, b) => s + b.n, 0);
  return { novos, falhou };
}
