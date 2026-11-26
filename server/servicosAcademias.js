// Horários, reputação e serviços das academias concorrentes (Estudos de ponto). Só sob pedido, academia por academia, guardado por 90 dias.
// Fontes, cada serviço com a sua: o NOME da academia ("Crossfit…", "…Jitsu") e o SITE quando dá para ler (Instagram e afins não dão).
// Nas grandes redes o site não é lido: ele lista o que a rede tem no país, não o da unidade. Sem lista manual (pedido do dono, 26/11/2026):
// o que não for encontrado aparece como "não foi possível encontrar outras modalidades".
// Do Google vêm o horário (24 horas, domingo), a nota e o número de avaliações. Avaliações escritas não entram: "não tem piscina" viraria piscina.
// Medição em 26/11/2026 (25 academias em volta da World Gym Gama): nenhuma com resumo do Google, tipos genéricos, só ~3 sites independentes úteis.
import { lerJson, gravarJson } from "./armazem.js";
import { redeDe } from "./pois.js";

export class ErroServicos extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }

export const VALIDADE_DIAS = 90, MAX_POR_PEDIDO = 15;
/**
 * Versão da leitura de site: 2 = também as páginas de aulas, modalidades e grade; 3 = nas grandes redes, a página da UNIDADE quando o Google
 * aponta para ela (só essa página, sem as gerais da rede) (26/11/2026). Guardado com versão menor é relido; nas redes isso pede o Google de novo.
 */
export const LEITURA_SITE = 3;
/**
 * Grandes redes cuja página da UNIDADE traz a grade de aulas no próprio conteúdo (conferido em 26/11/2026). As outras ficam de fora: a Smart Fit
 * monta as aulas só no navegador e a página traz blog e planos (pilates, nutricionista) que dariam falso positivo; SkyFit, Evolve e Corpo e
 * Saúde apontam para páginas gerais da rede.
 */
export const REDES_COM_GRADE_NA_PAGINA = [{ rede: "Ultra", endereco: /[?&]AC=Unidade\b/i }];
export const paginaDeUnidade = (rede, url) => REDES_COM_GRADE_NA_PAGINA.some((r) => r.rede === rede && r.endereco.test(String(url ?? "")));
/**
 * Trava de custo (pedido do dono, 26/11/2026): o Google dá 1.000 consultas completas (nota, avaliações, site) grátis por mês; o Atlas para em 900,
 * com folga para outros usos da mesma chave. A conta é por mês de Brasília, guardada no Blob; o que já está guardado não conta.
 */
export const LIMITE_MENSAL = 900;
export const mesDeBrasilia = (agora) => new Date(agora - 3 * 3600e3).toISOString().slice(0, 7);
const caminhoCota = (mes) => `estudos/servicos-cota/${mes}.json`;
export async function consultasDoMes(agora = Date.now()) { const d = await lerJson(caminhoCota(mesDeBrasilia(agora))); return Number(d?.usadas ?? 0); }
// nas redes com grade na página guardadas antes da leitura 3 o endereço da unidade não foi guardado: refaz com o Google (conta na cota)
const guardadoValido = (g, agora) => g && agora - Date.parse(g.em) < VALIDADE_DIAS * 864e5 && !(REDES_COM_GRADE_NA_PAGINA.some((r) => r.rede === g.rede) && (g.leituraSite ?? 1) < LEITURA_SITE);
/** Lê o site e devolve as modalidades dele ("personal" no site aparece em qualquer academia: só vale pelo nome). */
async function lerSite(url, fetcher, soEstaPagina = false) {
  try { const t = await textoDoSite(url, fetcher, 8000, { soEstaPagina }); return { doSite: t ? servicosNoTexto(t).filter((x) => x !== "personal") : [], siteFalhou: false }; }
  catch { return { doSite: [], siteFalhou: true }; }
}
const caminho = (id) => `estudos/servicos/${id.replace(/^places\//, "")}.json`;
const ID_OK = /^places\/[A-Za-z0-9_-]{10,200}$/;

/** Serviços reconhecidos. `re` procura no texto já sem acento e em minúsculas. */
export const SERVICOS = [
  { id: "musculacao", rotulo: "Musculação", re: /musculac/ },
  { id: "cross", rotulo: "Cross", re: /cross\s?(fit|training|train)|\bcrossfit\b|\bcf\b|\bwod\b/ },
  { id: "lutas", rotulo: "Lutas", re: /\b(muay\s?thai|jiu.?jitsu|jiujitsu|jitsu|boxe|boxing|kick\s?boxing|karate|judo|mma|taekwondo|hapkido|defesa pessoal|lutas?)\b/ },
  { id: "danca", rotulo: "Dança", re: /\b(danca|dance|fit\s?dance|zumba|ritmos|ritbox|forro|lets?\s?danc\w*|ballet|bale)\b/ },
  { id: "pilates", rotulo: "Pilates", re: /pilates/ },
  { id: "yoga", rotulo: "Yoga", re: /\byoga\b/ },
  { id: "bike", rotulo: "Bike / spinning", re: /spinning|bike indoor|smart\s?bike|\bcycling\b|\bciclismo indoor/ },
  { id: "funcional", rotulo: "Funcional", re: /\bfuncional\b|\bhiit\b|bootcamp/ },
  { id: "coletivas", rotulo: "Aulas coletivas", re: /aulas? coletivas?|les mills|body\s?(pump|combat|balance)|\bjump\b|\bstep\b|alongamento|ginastica localizada|\blocalizada\b|\babdominal\b/ },
  { id: "natacao", rotulo: "Piscina / natação", re: /piscina|natacao|hidroginastica/ },
  // "studio" sozinho não basta ("Studio de Estética"): vale com sinal de treino no mesmo texto
  { id: "personal", rotulo: "Studio / personal", re: /personal|treinamento personalizado|\b(studio|estudio)\b(?=.*\b(fit|fitness|treino|training|gym|academia|workout|funcional|forca|movimento|corpo|corps)\b)|\b(fit|fitness|treino|training|gym|academia|workout|funcional|forca|movimento|corpo|corps)\b.*\b(studio|estudio)\b/ },
  { id: "kids", rotulo: "Espaço kids", re: /espaco kids|\bkids\b|brinquedoteca/ },
  { id: "avaliacao", rotulo: "Avaliação física", re: /avaliacao fisica|bioimpedancia/ },
  { id: "nutricao", rotulo: "Nutricionista", re: /nutricionista|nutricao/ },
  { id: "wellhub", rotulo: "Wellhub / Gympass", re: /wellhub|gympass/ },
  { id: "totalpass", rotulo: "TotalPass", re: /total\s?pass/ },
];
const IDS = new Set(SERVICOS.map((s) => s.id));
export const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Serviços citados num texto (nome ou site). */
export const servicosNoTexto = (texto) => { const t = semAcento(texto); return SERVICOS.filter((s) => s.re.test(t)).map((s) => s.id); };

// ---------- horário ----------
const hhmm = (p) => `${String(p?.hour ?? 0).padStart(2, "0")}:${String(p?.minute ?? 0).padStart(2, "0")}`;
/** Do horário do Google: abre 24 horas, abre no domingo, horário de abertura mais cedo e de fechamento mais tarde. */
export function resumoHorario(regular) {
  const periodos = Array.isArray(regular?.periods) ? regular.periods : [];
  if (!periodos.length) return null;
  // 24 horas: um período aberto sem fechamento (como o Google descreve "aberto 24 horas")
  const h24 = periodos.some((p) => p.open && !p.close) || periodos.filter((p) => p.open && p.close && p.open.hour === 0 && p.open.minute === 0 && (p.close.day !== p.open.day) && p.close.hour === 0).length >= 7;
  const domingo = periodos.some((p) => p.open?.day === 0);
  if (h24) return { h24: true, domingo: true, abre: "00:00", fecha: "24:00" };
  const abre = periodos.map((p) => hhmm(p.open)).sort()[0];
  const fecha = periodos.map((p) => (p.close && p.close.day !== p.open?.day ? "24:00" : hhmm(p.close))).sort().at(-1);
  return { h24: false, domingo, abre, fecha };
}

// ---------- site ----------
const SOCIAIS = /(^|\.)(instagram|facebook|fb|wa|whatsapp|linktr|heylink|tiktok|youtube|youtu|twitter|x|linkedin|bio|beacons)\.(com|me|ee|be|site|link)(\.br)?$/i;
/** Endereço que dá para ler com segurança: http/https, nome de domínio público (sem IP, localhost ou rede interna) e não rede social. */
export function siteLegivel(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password) return null;
  const h = u.hostname.toLowerCase();
  if (!h.includes(".") || /^[\d.]+$/.test(h) || h.includes(":") || /(^|\.)(localhost|local|internal|lan|home|corp)$/.test(h)) return null;
  if (SOCIAIS.test(h) || /^(www\.)?(instagram|facebook|linktr|heylink)\./.test(h)) return null;
  return u;
}
/** Navegador comum: o site do concorrente não deve ver quem está olhando. */
const NAVEGADOR = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
/** Uma página: segue até 3 redirecionamentos (cada um conferido), lê até 800 KB. Devolve o HTML e o endereço final, ou null. */
async function pagina(url, fetcher, sinal) {
  let u = siteLegivel(url);
  for (let i = 0; u && i < 4; i++) {
    const r = await fetcher(u.href, { redirect: "manual", signal: sinal, headers: { "User-Agent": NAVEGADOR, Accept: "text/html", "Accept-Language": "pt-BR" } });
    if (r.status >= 300 && r.status < 400) { const prox = r.headers.get("location"); u = prox ? siteLegivel(new URL(prox, u).href) : null; continue; }
    if (!r.ok || !/html/i.test(r.headers.get("content-type") ?? "html")) return null;
    const leitor = r.body?.getReader?.();
    let html = "";
    if (leitor) {
      const dec = new TextDecoder();
      for (let lido = 0; lido < 800_000;) { const { done, value } = await leitor.read(); if (done) break; lido += value.length; html += dec.decode(value, { stream: true }); }
      leitor.cancel().catch(() => {});
    } else html = (await r.text()).slice(0, 800_000);
    return { html, url: u };
  }
  return null;
}
const textoDoHtml = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
/** Links do mesmo site que parecem levar às aulas, modalidades, grade ou serviços (até 3). */
export function linksDeAulas(html, base) {
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const alvo = `${m[1]} ${semAcento(textoDoHtml(m[2]))}`;
    if (!/aula|grade|modalidad|servico|atividade|horario|estrutura|treino/.test(semAcento(alvo))) continue;
    let u; try { u = new URL(m[1], base); } catch { continue; }
    if (u.hostname !== base.hostname || !siteLegivel(u.href) || /\.(png|jpe?g|gif|webp|pdf|svg)$/i.test(u.pathname) || u.href === base.href) continue;
    if (!out.includes(u.href)) out.push(u.href);
    if (out.length >= 3) break;
  }
  return out;
}
/**
 * Lê o texto do site: a página inicial e até 3 páginas do mesmo site com cara de aulas, modalidades, grade ou serviços. 8 s no total.
 * Devolve null quando não deu para ler (página quase vazia, montada no navegador, não conta). Grade de aulas em imagem não dá para ler.
 */
export async function textoDoSite(url, fetcher = fetch, prazoMs = 8000, { soEstaPagina = false } = {}) {
  const sinal = AbortSignal.timeout(prazoMs);
  const inicio = await pagina(url, fetcher, sinal);
  if (!inicio) return null;
  let texto = textoDoHtml(inicio.html);
  for (const link of soEstaPagina ? [] : linksDeAulas(inicio.html, inicio.url)) {
    try { const p = await pagina(link, fetcher, sinal); if (p) texto += ` ${textoDoHtml(p.html)}`; } catch { break; } // estourou o tempo: fica com o que já leu
  }
  return texto.length >= 200 ? texto : null;
}

// ---------- uma academia ----------
/** Busca (ou lê do Blob) o que dá para saber de uma academia: nome, horário, nota, avaliações e serviços pelo nome e pelo site. */
export async function infoDaAcademia(id, { chave, fetcher = fetch, agora = Date.now() } = {}) {
  const arquivo = caminho(id);
  const guardado = await lerJson(arquivo);
  if (guardadoValido(guardado, agora)) {
    // o site que falhou (fora do ar, lento) é lido de novo, sem consultar o Google, no máximo uma vez por dia
    // e o site lido antes da leitura das páginas de aulas (versão 2, 26/11/2026) é relido uma vez, também sem o Google
    const velho = guardado.site && (guardado.leituraSite ?? 1) < LEITURA_SITE;
    if (!velho && (!guardado.siteFalhou || !guardado.site || agora - Date.parse(guardado.siteTentouEm ?? guardado.em) < 864e5)) return guardado;
    const novo = { ...guardado, ...(await lerSite(guardado.siteUrl ?? `https://${guardado.site}/`, fetcher, Boolean(guardado.rede))), siteTentouEm: new Date(agora).toISOString(), leituraSite: LEITURA_SITE };
    await gravarJson(arquivo, novo);
    return novo;
  }
  const r = await fetcher(`https://places.googleapis.com/v1/${id}`, { headers: { "X-Goog-Api-Key": chave, "X-Goog-FieldMask": "displayName,regularOpeningHours,rating,userRatingCount,websiteUri", "Accept-Language": "pt-BR" } });
  const j = await r.json();
  if (j.error || !j.displayName) throw new ErroServicos("O Google não respondeu agora.", 502);
  const nome = j.displayName.text ?? "";
  const rede = redeDe(nome);
  let site = null, siteUrl = null, siteFalhou = false, doSite = [];
  // grandes redes: só a página da UNIDADE, quando o Google aponta para ela, e só essa página (as gerais falam de todas as unidades da rede)
  const ehRede = rede && rede !== "World Gym";
  if (j.websiteUri && siteLegivel(j.websiteUri) && (!ehRede || paginaDeUnidade(rede, j.websiteUri))) {
    site = siteLegivel(j.websiteUri).hostname; siteUrl = j.websiteUri;
    ({ doSite, siteFalhou } = await lerSite(j.websiteUri, fetcher, Boolean(ehRede)));
  }
  const info = {
    em: new Date(agora).toISOString(), id, nome, rede,
    nota: typeof j.rating === "number" ? j.rating : null, avaliacoes: Number(j.userRatingCount ?? 0),
    horario: resumoHorario(j.regularOpeningHours), site, siteUrl, siteFalhou, leituraSite: LEITURA_SITE,
    doNome: servicosNoTexto(nome), doSite,
  };
  await gravarJson(arquivo, info);
  return info;
}

// ---------- aulas informadas pelo dono ----------
/** Aulas que o dono pesquisou e informou para uma unidade específica (pelo id do Google). Guardadas no Blob, nunca no repositório. */
export const CAMINHO_INFORMADOS = "estudos/servicos-informados.json";
export async function lerInformados() { const d = await lerJson(CAMINHO_INFORMADOS); return d && typeof d.porId === "object" ? d.porId : {}; }
/** Grava as aulas informadas (script do dono): `porId` = { "places/...": { nome, aulas: "FitDance, Zumba…" } }; as modalidades saem do texto das aulas. */
export async function gravarInformados(porId, agora = new Date()) {
  const atual = await lerInformados();
  for (const [id, v] of Object.entries(porId ?? {})) {
    if (!ID_OK.test(id) || !v?.aulas) continue;
    const aulas = String(v.aulas).slice(0, 600);
    atual[id] = { nome: String(v.nome ?? "").slice(0, 120), aulas, servicos: servicosNoTexto(aulas).filter((x) => x !== "musculacao"), informadoEm: agora.toISOString() };
  }
  await gravarJson(CAMINHO_INFORMADOS, { porId: atual });
  return atual;
}

/** Junta as fontes: o que o dono informou, o nome e o site (nas grandes redes, só a página da unidade). Cada serviço diz de onde veio. */
export function servicosFinais(info, informado = null) {
  const fonte = new Map();
  for (const s of informado?.servicos ?? []) fonte.set(s, "informado");
  for (const s of servicosNoTexto(info.nome)) if (!fonte.has(s)) fonte.set(s, "nome"); // recalculado: a regra do nome pode mudar depois de guardar
  for (const s of info.doSite ?? []) if (!fonte.has(s)) fonte.set(s, "site"); // nas redes, o site só é lido na página da unidade
  return SERVICOS.filter((s) => fonte.has(s.id)).map((s) => ({ id: s.id, fonte: fonte.get(s.id) }));
}

/**
 * Até 15 academias por pedido (a tela manda em lotes). Ids conferidos e só os que estão na busca de academias da mesma área (`permitidos`);
 * nada de endereço vindo da tela. `permitidos`: função que devolve o conjunto de ids da busca da área (chamada depois de conferir o formato).
 */
export async function servicosDasAcademias(pedido, { chave = process.env.GOOGLE_PLACES_KEY, fetcher = fetch, agora = Date.now(), permitidos = null } = {}) {
  const ids = Array.isArray(pedido?.ids) ? [...new Set(pedido.ids.map(String))] : [];
  if (!ids.length || ids.length > MAX_POR_PEDIDO || !ids.every((x) => ID_OK.test(x))) throw new ErroServicos(`Mande de 1 a ${MAX_POR_PEDIDO} academias.`);
  if (permitidos) { const ok = await permitidos(); if (!ids.every((x) => ok.has(x))) throw new ErroServicos("Academia fora da busca desta área."); }
  if (!chave) throw new ErroServicos("A busca no Google ainda não foi configurada no servidor.", 503);
  // quais precisam do Google (as guardadas não contam); reserva na cota do mês antes de consultar e corta o que passaria do limite
  const novas = (await Promise.all(ids.map(async (id) => (guardadoValido(await lerJson(caminho(id)), agora) ? null : id)))).filter(Boolean);
  const mes = mesDeBrasilia(agora), usadas = await consultasDoMes(agora);
  const cabem = Math.max(0, LIMITE_MENSAL - usadas), barradas = new Set(novas.slice(cabem));
  if (novas.length - barradas.size > 0) await gravarJson(caminhoCota(mes), { usadas: usadas + novas.length - barradas.size, limite: LIMITE_MENSAL, atualizadoEm: new Date(agora).toISOString() });
  const porId = {}, informados = await lerInformados();
  await Promise.all(ids.map(async (id) => {
    if (barradas.has(id)) { porId[id] = informados[id] ? { nota: null, avaliacoes: 0, horario: null, site: null, servicos: servicosFinais({ nome: "" }, informados[id]), aulas: informados[id].aulas } : null; return; }
    try {
      const info = await infoDaAcademia(id, { chave, fetcher, agora });
      porId[id] = { nota: info.nota, avaliacoes: info.avaliacoes, horario: info.horario, site: info.site, servicos: servicosFinais(info, informados[id]), ...(informados[id] ? { aulas: informados[id].aulas } : {}) };
    } catch { porId[id] = null; }
  }));
  return { porId, ...(barradas.size ? { limiteAtingido: true, semCota: barradas.size } : {}) };
}
