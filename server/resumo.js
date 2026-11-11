// Resumo diário por e-mail: cada acesso recebe só as unidades que pode ver.
//   dono e master -> a rede inteira (cartões + alertas + tabela com todas as unidades)
//   unidades      -> só as unidades dele (uma: cartões; várias: totais + tabela)
// Os números vêm do mesmo arquivo consolidado que o painel usa; às 7h o dia anterior já está fechado.
// A comparação é com o MESMO DIA do mês passado, a partir de uma foto que o próprio envio grava todo dia
// (o consolidado só guarda totais do mês inteiro). Sem foto do dia de referência, o cartão não mostra comparação.
import { UNIDADES_DA_REDE } from "./acesso.js";
import { hojeBR } from "./evo.js";
import { lerJson, gravarJson } from "./armazem.js";
import { INDICADORES_META, situacaoMeta, formatarMeta } from "./metas.js";

export const unidadesDoUsuario = (u) => (u.papel === "unidades" ? (u.unidades ?? []) : UNIDADES_DA_REDE);

// ---------- números ----------
const SOMAS = ["faturamento", "recebimento", "vendasOnline", "complementar", "adimplentes", "inadimplentes", "pagantes", "cancelados", "aVencer", "naoRenovados", "renovados", "recuperadas", "ativos", "ativosIni", "novosContratos", "oportunidades", "conversoes", "npsPromotores", "npsDetratores", "npsRespostas"];
const num = (v) => Number(v) || 0;

/** Receitas complementares: diárias, personal, kids, WG Plus, Pro+, camisetas e coqueteleiras (mesma regra do painel). */
export const complementar = (x) => ["diarias", "personal", "camisetas", "coqueteleiras", "kids", "plus", "proMais"].reduce((s, k) => s + num(x[k]), 0);

/** O que interessa de uma unidade no mês (e que a foto diária guarda). */
export function indicadores(x) {
  const o = {
    faturamento: num(x.faturamento), recebimento: num(x.recebimento), vendasOnline: num(x.vendasOnline), complementar: complementar(x),
    adimplentes: num(x.adimplentes), inadimplentes: num(x.inadimplentes), pagantes: num(x.pagantes) || num(x.adimplentes) + num(x.inadimplentes),
    cancelados: num(x.cancelados), aVencer: num(x.aVencer), naoRenovados: num(x.naoRenovados),
    renovados: Math.max(0, num(x.aVencer) - num(x.naoRenovados)), recuperadas: num(x.cobrancas?.recuperadas ?? x.recuperadas),
    ativos: num(x.ativosFim ?? x.alunosAtivos), ativosIni: num(x.ativosIni), novosContratos: num(x.novosContratos), oportunidades: num(x.oportunidades), conversoes: num(x.conversoes),
    npsPromotores: num(x.npsPromotores), npsDetratores: num(x.npsDetratores), npsRespostas: num(x.npsRespostas),
  };
  if (Array.isArray(x.contratosVendidos)) o.contratosVendidos = x.contratosVendidos;
  return o;
}

export const taxaConversao = (op, conv) => (op > 0 ? Math.round((conv / op) * 1000) / 10 : null);
export const taxaChurn = (canc, ini) => (ini > 0 ? Math.round((canc / ini) * 1000) / 10 : 0);

export const taxaRenovacao = (aVencer, naoRenovados) => (aVencer > 0 ? Math.round((Math.max(0, aVencer - naoRenovados) / aVencer) * 1000) / 10 : null);
export const npsDe = (x) => (x.npsRespostas > 0 ? Math.round(((x.npsPromotores - x.npsDetratores) / x.npsRespostas) * 100) : null);
const pctInad = (x) => (x.pagantes ? Math.round((x.inadimplentes / x.pagantes) * 1000) / 10 : 0);

/** Soma o que for somável; percentuais e NPS saem do total, nunca da soma de percentuais. */
export function totalizar(lista) {
  const t = Object.fromEntries(SOMAS.map((k) => [k, lista.reduce((s, x) => s + num(x[k]), 0)]));
  t.renovacao = taxaRenovacao(t.aVencer, t.naoRenovados);
  t.nps = npsDe(t);
  t.inadimplenciaPerc = pctInad(t);
  t.conversao = taxaConversao(t.oportunidades, t.conversoes);
  t.contratos = somarContratos(lista);
  return t;
}

/** Soma os contratos vendidos de várias unidades por nome: [nome, quantidade, valor], mais vendidos primeiro. */
export function somarContratos(lista) {
  const por = new Map();
  for (const x of lista) for (const [nome, q, v] of x.contratosVendidos ?? []) { const a = por.get(nome) ?? [0, 0]; a[0] += num(q); a[1] += num(v); por.set(nome, a); }
  return [...por].map(([nome, [q, v]]) => [nome, q, Math.round(v * 100) / 100]).sort((a, b) => b[1] - a[1] || b[2] - a[2]);
}

// ---------- o dia (diferença entre a foto de ontem e os números de hoje) ----------
const ADITIVOS = ["faturamento", "vendasOnline", "novosContratos", "complementar", "cancelados", "renovados", "recuperadas", "oportunidades", "conversoes", "npsPromotores", "npsDetratores", "npsRespostas"];

/** O que aconteceu no dia: acumulado de hoje menos o da foto anterior. `base` null = não há foto para comparar. Negativos (correções do EVO) viram 0. */
export function valoresDoDia(atual, base) {
  if (!base) return null;
  const d = Object.fromEntries(ADITIVOS.map((k) => [k, Math.max(0, num(atual[k]) - num(base[k]))]));
  d.conversao = taxaConversao(d.oportunidades, d.conversoes);
  d.nps = d.npsRespostas > 0 ? Math.round(((d.npsPromotores - d.npsDetratores) / d.npsRespostas) * 100) : null;
  d.adimplentes = base.zero ? null : num(atual.adimplentes) - num(base.adimplentes);
  return d;
}

// ---------- foto diária (base da comparação com o mesmo dia do mês passado) ----------
const pad = (n) => String(n).padStart(2, "0");
export const caminhoFoto = (dia) => `resumo/fotos/${dia}.json`;

/** Mesmo dia do mês anterior (dia 31 em mês curto vira o último dia). */
export function mesmoDiaMesAnterior(dia) {
  const [a, m, d] = dia.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m - 1, 0)).getUTCDate();
  const ref = new Date(Date.UTC(a, m - 2, 1));
  return `${ref.getUTCFullYear()}-${pad(ref.getUTCMonth() + 1)}-${pad(Math.min(d, ultimo))}`;
}

export const diaAnterior = (hoje) => new Date(new Date(hoje + "T12:00:00Z").getTime() - 86400000).toISOString().slice(0, 10);

/** Os dados do mês foram recalculados esta madrugada? Se o EVO falhou, os números são de ontem e não viram foto. */
export const dadosDeHoje = (mes, hoje) => !!mes?.generatedAt && hojeBR(new Date(mes.generatedAt).getTime()) === hoje;

export const fotoDe = (mes, dia) => ({ dia, gravadaEm: new Date().toISOString(), units: Object.fromEntries((mes.units ?? []).map((u) => [u.name, indicadores(u)])) });

export const salvarFoto = (foto) => gravarJson(caminhoFoto(foto.dia), foto);
export const lerFoto = (dia) => lerJson(caminhoFoto(dia));

// ---------- alertas e sugestões ----------
const LIM = { fatAtencao: -7, fatCritico: -12, inadNivel: 8, inadDelta: 1.5, onlineQueda: -30, renovQueda: -8, npsQueda: -10, npsBaixo: 30, cancelAlta: 25 };
const variacao = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null);

/** Regras do resumo. `atual` e `ref` são totais de `indicadores`; `ref` pode ser null (sem foto do mesmo dia). */
export function alertasDe(atual, ref, quem) {
  const out = [];
  const add = (gravidade, titulo, fato, acao) => out.push({ quem, gravidade, titulo, fato, acao });
  const fv = ref ? variacao(atual.faturamento, ref.faturamento) : null;
  if (fv !== null && fv <= LIM.fatAtencao) add(fv <= LIM.fatCritico ? "critico" : "atencao", "Faturamento abaixo do mesmo dia", `${Math.abs(Math.round(fv))}% abaixo do mesmo dia do mês passado.`, "Conferir vencimentos concentrados e contratos que não renovaram; acionar a recepção para a régua de cobrança da semana.");
  const inad = pctInad(atual), inadRef = ref ? pctInad(ref) : null;
  if (inad >= LIM.inadNivel) add("critico", "Inadimplência alta", `${String(inad).replace(".", ",")}% dos pagantes estão em atraso.`, "Priorizar contato com quem tem cobrança recusada (cartão vencido, saldo) e oferecer troca de forma de pagamento.");
  else if (inadRef !== null && inad - inadRef >= LIM.inadDelta) add("atencao", "Inadimplência subiu", `${String(inad).replace(".", ",")}%, contra ${String(inadRef).replace(".", ",")}% no mesmo dia do mês passado.`, "Rodar a lista de cobranças com falha e tentar nova cobrança ou contato direto nos próximos dias.");
  const cv = ref ? variacao(atual.cancelados, ref.cancelados) : null;
  if (cv !== null && cv >= LIM.cancelAlta && atual.cancelados - ref.cancelados >= 3) add("atencao", "Cancelamentos em alta", `${atual.cancelados} no mês, ${Math.round(cv)}% acima do mesmo dia do mês passado.`, "Ler os motivos de cancelamento da unidade e abordar quem está perto do vencimento com proposta de retenção.");
  const rn = atual.renovacao, rr = ref ? taxaRenovacao(ref.aVencer, ref.naoRenovados) : null;
  if (rn !== null && rr !== null && rn - rr <= LIM.renovQueda) add("atencao", "Renovação em queda", `${String(rn).replace(".", ",")}%, contra ${String(rr).replace(".", ",")}% no mesmo dia do mês passado.`, "Ligar para os contratos a vencer desta semana antes do vencimento, com condição de renovação antecipada.");
  const ov = ref ? variacao(atual.vendasOnline, ref.vendasOnline) : null;
  if (ov !== null && ref.vendasOnline >= 500 && ov <= LIM.onlineQueda) add("atencao", "Vendas online em queda", `${Math.abs(Math.round(ov))}% abaixo do mesmo dia do mês passado.`, "Revisar as campanhas ativas e o link de venda online; testar uma oferta de curta duração.");
  const nn = atual.nps, nr = ref ? npsDe(ref) : null;
  if (nn !== null && (nn < LIM.npsBaixo || (nr !== null && nn - nr <= LIM.npsQueda))) add("atencao", "NPS pede atenção", nr !== null && nn - nr <= LIM.npsQueda ? `${nn}, contra ${nr} no mesmo dia do mês passado.` : `${nn}, abaixo de ${LIM.npsBaixo}.`, "Ler os comentários das notas baixas e falar com os detratores recentes.");
  return out;
}

const ORDEM = { critico: 0, atencao: 1 };
export const ordenarAlertas = (l) => [...l].sort((a, b) => ORDEM[a.gravidade] - ORDEM[b.gravidade]);

/** Os 3 contratos mais vendidos no mês (pelo nome no EVO), cada um com o que vendeu no dia e a comparação com o mesmo dia do mês passado. */
export function topContratos(contratos, base, contratosRef) {
  const q = (lista, nome) => (lista ?? []).find((c) => c[0] === nome)?.[1] ?? 0;
  return contratos.slice(0, 3).map(([nome, acum]) => ({
    nome, acum,
    dia: base ? Math.max(0, acum - q(base.contratos, nome)) : null,
    ref: contratosRef ? q(contratosRef, nome) : null,
  }));
}

// ---------- metas ----------
/** Valores do mês que as metas acompanham, a partir de um total (ou de uma unidade). */
export const valoresParaMeta = (x) => ({
  faturamento: x.faturamento, recebimento: x.recebimento, vendasOnline: x.vendasOnline, novosContratos: x.novosContratos,
  churn: taxaChurn(x.cancelados, x.ativosIni), inadimplenciaPerc: pctInad(x), renovacoes: taxaRenovacao(x.aVencer, x.naoRenovados) ?? 0, icv: taxaConversao(x.oportunidades, x.conversoes) ?? 0,
});

/** Metas por indicador. Sem meta na planilha (ou planilha que não pôde ser lida, `metas === null`), o e-mail diz que a meta não foi cadastrada.
 *  Rede (master/dono): meta "TOTAL". Gestor/sócio: a meta da unidade do e-mail. */
export function resumirMetas(metas, ym, usuario, total, atuais) {
  const doMes = (metas ?? []).filter((m) => m.mes === ym);
  const rede = usuario.papel !== "unidades";
  const aviso = rede ? "a rede não cadastrou meta" : "sua unidade não cadastrou meta";
  const por = {};
  for (const chave of Object.keys(INDICADORES_META)) {
    const alvo = rede ? "TOTAL" : atuais[0].nome;
    const m = doMes.find((x) => x.unidade === alvo && x.chave === chave);
    por[chave] = m ? { semMeta: false, ...situacaoMeta(chave, valoresParaMeta(rede ? total : atuais[0])[chave], m) } : { semMeta: true, aviso };
  }
  return por;
}

// ---------- o resumo de cada usuário ----------
/** `ref` = foto do mesmo dia do mês passado (ou null). */
/**
 * Meta (Facebook e Instagram) no mês para as unidades da pessoa: investimento, contatos, vendas online pelo pixel e
 * quanto do faturamento foi para o Meta. null sem investimento lido. A conta Institucional ("Rede") não entra.
 */
export function resumoDoMeta(metaMes, nomes, atuais) {
  if (!metaMes?.unidades) return null;
  let investimento = 0, contatos = 0, compras = 0, valorCompras = 0, faturamento = 0;
  for (const n of nomes) {
    const v = metaMes.unidades[n];
    if (!v || !(v.investimento > 0)) continue;
    investimento += v.investimento;
    contatos += (v.leads || 0) + (v.conversas || 0);
    compras += v.compras || 0;
    valorCompras += v.valorCompras || 0;
    faturamento += atuais.find((a) => a.nome === n)?.faturamento || 0;
  }
  if (!investimento) return null;
  return { investimento, contatos, compras, valorCompras, pctFaturamento: faturamento > 0 ? (investimento / faturamento) * 100 : null };
}

/** `alertasMeta`: alertas do tráfego pago (server/alertasMeta.js) da rede toda; cada pessoa recebe só os das unidades dela
 *  (e os da conta Institucional, se for dono ou master). */
export function montarResumo(meses, usuario, hoje = hojeBR(), ref = null, metas = null, ontem = null, alertasMeta = [], metaMeses = null) {
  const ateDia = diaAnterior(hoje);
  const ym = ateDia.slice(0, 7); // no dia 1º, o resumo é o fechamento do mês que acabou
  const mes = meses.find((x) => x.month === ym);
  if (!mes) return null;
  let nomes = new Set(unidadesDoUsuario(usuario));
  let atuais = (mes.units ?? []).filter((x) => nomes.has(x.name)).map((x) => ({ nome: x.name, ...indicadores(x) }));
  if (atuais.length === 0) return null;
  // Gestor ou sócio de mais de uma unidade: o e-mail é da unidade que mais faturou no mês; as demais ficam no Atlas.
  const maisDeUma = usuario.papel === "unidades" && atuais.length > 1;
  if (maisDeUma) {
    const [melhor] = [...atuais].sort((a, b) => b.faturamento - a.faturamento || a.nome.localeCompare(b.nome, "pt-BR"));
    atuais = [melhor];
    nomes = new Set([melhor.nome]);
  }
  const refs = ref ? Object.entries(ref.units ?? {}).filter(([n]) => nomes.has(n)).map(([nome, v]) => ({ nome, ...v })) : [];
  const total = totalizar(atuais);
  const totalRef = refs.length ? totalizar(refs) : null;
  const multi = atuais.length > 1;
  const alertas = alertasDe(total, totalRef, multi ? (usuario.papel === "unidades" ? "Suas unidades" : "A rede") : atuais[0].nome);
  if (multi) for (const u of atuais) alertas.push(...alertasDe({ ...u, renovacao: taxaRenovacao(u.aVencer, u.naoRenovados), nps: npsDe(u) }, refs.find((r) => r.nome === u.nome) ?? null, u.nome));
  alertas.push(...alertasMeta.filter((a) => nomes.has(a.quem) || (usuario.papel !== "unidades" && a.quem === "Institucional")));
  const linhas = atuais.map((x) => ({ nome: x.nome, recebimento: x.recebimento, faturamento: x.faturamento, inadimplenciaPerc: pctInad(x), ativos: x.ativos, aVencer: x.aVencer, cancelados: x.cancelados, novosContratos: x.novosContratos, nps: npsDe(x) })).sort((a, b) => b.faturamento - a.faturamento);
  // No dia 1º, o "dia" é o mês inteiro (base zero); nos outros, precisa da foto de anteontem.
  const ontemDoUsuario = ontem ? Object.entries(ontem.units ?? {}).filter(([n]) => nomes.has(n)).map(([nome, v]) => ({ nome, ...v })) : [];
  const base = ateDia.endsWith("-01") ? { ...totalizar([]), zero: true } : ontemDoUsuario.length ? totalizar(ontemDoUsuario) : null;
  const dia = valoresDoDia(total, base);
  const metasDoMes = resumirMetas(metas, ym, usuario, total, atuais);
  return { mes: ym, ateDia: new Date(ateDia + "T12:00:00Z").getTime(), papel: usuario.papel, total, totalRef, linhas, metas: metasDoMes, dia, maisDeUma, unidade: usuario.papel === "unidades" ? atuais[0].nome : null, top: topContratos(total.contratos, base, totalRef?.contratos), alertas: ordenarAlertas(alertas), desatualizado: !dadosDeHoje(mes, hoje), temRef: !!totalRef, meta: resumoDoMeta(metaMeses?.[ym], nomes, atuais) };
}

// ---------- e-mail ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const brl = (n) => "R$ " + Math.round(n || 0).toLocaleString("pt-BR");
const int = (n) => Math.round(n || 0).toLocaleString("pt-BR");
const virg = (n) => String(n).replace(".", ",");
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const rotuloMes = (ym) => `${MESES[Number(ym.slice(5)) - 1]} de ${ym.slice(0, 4)}`;
const dataCurta = (ms) => { const d = new Date(ms); return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`; };
/** Assunto: o principal já na caixa de entrada ("Gama: R$ 5.400 ontem · faltam R$ 14.400 para a meta ouro").
 *  Se o EVO não atualizou esta madrugada, o assunto não afirma número nenhum. */
export function assunto(r) {
  if (r.desatualizado) return `World Gym Atlas · resumo de ${dataCurta(r.ateDia)}`;
  const quem = r.unidade ?? "Rede World Gym";
  const fat = r.dia ? `${brl(r.dia.faturamento)} ontem` : `${brl(r.total.faturamento)} no mês`;
  const m = r.metas?.faturamento;
  const meta = !m || m.semMeta ? "" : m.topo.falta > 0 ? ` · faltam ${brl(m.topo.falta)} para a meta ouro` : " · meta ouro atingida";
  return `${quem}: ${fat}${meta}`;
}

/** Texto de prévia (a linha cinza ao lado do assunto): completa o assunto com o acumulado do mês e os alertas. */
export function textoPrevia(r) {
  const d = r.desatualizado ? null : delta(r.total.faturamento, r.totalRef?.faturamento);
  const n = r.alertas.length;
  const mes = `${brl(r.total.faturamento)} no mês${d && d.curto !== "igual" ? ` (${d.curto} contra o mesmo dia do mês passado)` : ""}.`;
  return `${mes} ${n ? `${n} ${n === 1 ? "alerta pede" : "alertas pedem"} atenção.` : "Nenhum alerta hoje."}`;
}

// Fonte única no e-mail inteiro: Inter onde der (Apple Mail), senão a fonte do sistema (o Gmail ignora fontes baixadas).
// Aspas simples porque vai dentro de style="...".
const sans = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const VERMELHO = "#C41230", VERDE = "#15803d", AMBAR = "#b45309", RUIM = "#b91c1c";

/** Linha pequena do cartão: quanto está acima ou abaixo do mesmo dia do mês passado. `melhorSeSobe` define a cor. */
function delta(atual, ref, { melhorSeSobe = true, pp = false, pontos = false } = {}) {
  if (ref === null || ref === undefined || atual === null || atual === undefined) return null;
  let diff, txt;
  if (pp || pontos) {
    diff = Math.round((atual - ref) * 10) / 10;
    const un = pontos ? (Math.abs(diff) === 1 ? " ponto" : " pontos") : " p.p.";
    txt = diff === 0 ? "igual ao" : `${virg(Math.abs(diff))}${un} ${diff > 0 ? "acima do" : "abaixo do"}`;
  } else {
    if (!(ref > 0)) return null;
    diff = ((atual - ref) / ref) * 100;
    txt = Math.abs(diff) < 0.5 ? "igual ao" : `${virg(Math.round(Math.abs(diff) * 10) / 10)}% ${diff > 0 ? "acima do" : "abaixo do"}`;
  }
  const igual = diff === 0 || (!pp && !pontos && Math.abs(diff) < 0.5);
  const bom = igual ? null : (diff > 0) === melhorSeSobe;
  const n = pp || pontos ? virg(Math.abs(diff)) : virg(Math.round(Math.abs(diff) * 10) / 10);
  const curto = igual ? "igual" : `${diff > 0 ? "▲" : "▼"} ${n}${pontos ? " pts" : pp ? " p.p." : "%"}`;
  return { texto: `${igual ? "" : diff > 0 ? "▲ " : "▼ "}${txt} mesmo dia do mês passado`, curto, cor: bom === null ? "#8b8b96" : bom ? VERDE : RUIM };
}

/** Cartão da meta de faturamento: quanto falta, em R$, para o nível mais alto cadastrado (o ouro). */
function cartaoMeta(r) {
  if (!r.metas) return null;
  const m = r.metas.faturamento;
  const rotulo = "Falta para a meta ouro";
  if (m.semMeta) return { rotulo: "Meta de faturamento", valor: "–", corValor: "#8a8a95", sub: m.aviso };
  return m.topo.falta > 0 ? { rotulo, valor: brl(m.topo.falta), pct: Math.max(0, Math.min(100, Math.round(((m.topo.alvo - m.topo.falta) / m.topo.alvo) * 100))) } : { rotulo, valor: "Atingida", corValor: VERDE, pct: 100 };
}


// ---------- e-mail: texto corrido por seções (estilo newsletter: Resumo BP, the news) ----------
// Saudação, data entre linhas, caixa "No resumo de hoje" com os destaques e, em cada seção, título (com emoji) + parágrafos.
// As variações vêm escritas ("6,7% abaixo do mês passado"), em verde ou vermelho.
const DIAS_CURTOS = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];
// Texto e negritos um tom abaixo do preto.
const TINTA = "#3a3a42", TEXTO = "#484850", SUAVE = "#74747f", FUNDO = "#eeeef1", CAIXA = "#f4f4f6", TRACO = "#d9d9df";
const P = `margin:0 0 14px;font-family:${sans};font-size:15px;line-height:1.7;color:${TEXTO}`;
const b = (x) => `<strong style="color:${TINTA}">${esc(x)}</strong>`;

/** Variação em palavras, colorida: "6,7% abaixo do mês passado". `pp`/`pontos` para taxas. Igual ou sem base: "" */
function vari(atual, ref, { melhorSeSobe = true, pp = false, pontos = false } = {}) {
  if (ref == null || atual == null) return "";
  let diff, n;
  if (pp || pontos) { diff = Math.round((atual - ref) * 10) / 10; n = `${virg(Math.abs(diff))} ${pontos ? (Math.abs(diff) === 1 ? "ponto" : "pontos") : "p.p."}`; }
  else { if (!(ref > 0)) return ""; diff = ((atual - ref) / ref) * 100; if (Math.abs(diff) < 0.5) diff = 0; n = `${virg(Math.round(Math.abs(diff) * 10) / 10)}%`; }
  if (diff === 0) return "";
  const cor = (diff > 0) === melhorSeSobe ? VERDE : RUIM;
  return `<span style="color:${cor};font-weight:600">${n} ${diff > 0 ? "acima" : "abaixo"}</span> do mês passado`;
}
const entre = (v) => (v ? ` (${v})` : "");
const ontem = (v, fmt, zero) => (v == null ? null : v === 0 ? zero : fmt(v));

/** Título de seção (ou da caixa de destaques), centralizado, com o emoji embaixo. */
const tituloSecao = (txt, cor = TINTA, topo = 44, emoji = "") => `<h2 style="margin:${topo}px 0 ${emoji ? 8 : 16}px;text-align:center;font-family:${sans};font-size:20px;line-height:1.3;font-weight:700;letter-spacing:-.3px;color:${cor}">${esc(txt)}</h2>`
  + (emoji ? `<p style="margin:0 0 18px;text-align:center;font-size:14px;line-height:1.2">${emoji}</p>` : "");
/** Separador entre seções: quatro pontos vermelhos (o mesmo vermelho das variações no texto) ("...."), pequenos e juntos, centralizados (estilo the news).
 *  Texto em vez de imagem: aparece em qualquer programa de e-mail, mesmo com imagens bloqueadas.
 *  Georgia porque o ponto dela é redondo (o da Arial é quadrado); fonte maior e em negrito para o ponto ficar visível,
 *  espaçamento negativo para os pontos ficarem próximos. */
const SEPARADOR = `<p style="margin:16px 0 0;padding-left:1px;text-align:center;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;line-height:14px;letter-spacing:-1px;color:${RUIM}">....</p>`;
/** Seção: separador + título + emoji + texto corrido (o dado principal abre o primeiro parágrafo). */
const secao = (titulo, emoji, corpo, cor = TINTA) => `${SEPARADOR}${tituloSecao(titulo, cor, 28, emoji)}${corpo}`;

/** Endereço do rodapé ("Dúvidas ou sugestões"). Pode ser trocado pela variável RESUMO_CONTATO sem mexer no código. */
export const CONTATO_PADRAO = "lucas.lima@worldgymbrasil.com.br";

/** Assinatura no fim do e-mail (no celular, as classes as-* encolhem logo, selo e espaços), no mesmo estilo do resto (fundo claro, mesma fonte): logo do gorila em preto,
 *  um traço fino, e ao lado nome, cargo, empresa e site; embaixo do texto uma linha
 *  igual ao traço vertical (mesma espessura e cor) que vai até o selo de 50 anos, também em grafite, alinhado à margem direita do texto. Só a logo e o selo são imagem; o resto é texto. */
export const ASSINATURA = {
  nome: "Lucas Lima",
  cargo: "COO",
  empresa: "World Gym Brasil",
  site: ["www.worldgymacademia.com.br", "https://www.worldgymacademia.com.br"],
  imagens: { logo: "assinatura-logo.png", selo: "assinatura-selo.png" },
};
function blocoAssinatura(img = ASSINATURA.imagens) {
  const a = ASSINATURA, linha = `margin:0;font-size:13px;line-height:1.5;color:${SUAVE}`;
  return `<table role="presentation" width="100%" style="margin:40px 0 0;border-collapse:collapse"><tr>
<td class="as-logo" valign="middle" style="padding:0 16px 0 0"><img src="${esc(img.logo)}" width="94" alt="World Gym" style="display:block;width:94px;height:auto;border:0;outline:none"></td>
<td class="as-texto" width="100%" valign="middle" style="padding:0 0 0 16px;border-left:1px solid ${TRACO}">
<table role="presentation" width="100%" style="border-collapse:collapse"><tr>
<td class="as-linha" width="100%" valign="bottom" style="padding:0 18px 10px 0;border-bottom:1px solid ${TRACO};font-family:${sans}">
<p style="margin:0;font-size:15px;line-height:1.4;font-weight:700;color:${TINTA}">${esc(a.nome)}</p>
<p style="${linha}">${esc(a.cargo)}</p>
<p style="${linha}">${esc(a.empresa)}</p>
<p class="as-site" style="margin:4px 0 0;font-size:13px;line-height:1.5"><a href="${esc(a.site[1])}" style="color:${SUAVE};text-decoration:none">${esc(a.site[0])}</a></p>
</td>
<td class="as-selo" valign="bottom" style="padding:0 0 0 12px"><img src="${esc(img.selo)}" width="64" alt="50º aniversário World Gym" style="display:block;width:64px;height:auto;border:0;outline:none"></td>
</tr></table>
</td></tr></table>`;
}

/** Alertas agrupados pelo título (na ordem em que já vêm: críticos primeiro), com as unidades de cada um. */
export function gruposDeAlertas(alertas) {
  const grupos = new Map();
  for (const a of alertas ?? []) {
    const g = grupos.get(a.titulo) ?? { titulo: a.titulo, gravidade: a.gravidade, quem: [] };
    if (a.gravidade === "critico") g.gravidade = "critico";
    if (a.quem && !g.quem.includes(a.quem)) g.quem.push(a.quem);
    grupos.set(a.titulo, g);
  }
  return [...grupos.values()].sort((x, y) => (x.gravidade === y.gravidade ? 0 : x.gravidade === "critico" ? -1 : 1));
}
const juntar = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`);

export function renderizarEmail(r, usuario, { url = "https://atlas.worldgymacademia.com.br", banner = "banner-resumo.png", assinatura = ASSINATURA.imagens, urlWehelp = "https://app.wehelpsoftware.com", contato = CONTATO_PADRAO } = {}) {
  const t = r.total, f = r.totalRef, d = r.dia;
  const primeiro = esc(String(usuario.nome ?? "").trim().split(/\s+/)[0] || "");
  const quem = r.unidade ? `da World Gym ${esc(r.unidade)}` : "da rede World Gym";
  const dt = new Date(r.ateDia + 86400000);
  const data = `${DIAS_CURTOS[dt.getUTCDay()]} | ${pad(dt.getUTCDate())} DE ${MESES[dt.getUTCMonth()].toUpperCase()}`;
  const m = r.metas?.faturamento;
  const metaTxt = !m ? "" : m.semMeta ? `${m.aviso.charAt(0).toUpperCase() + m.aviso.slice(1)} para o faturamento.` : m.topo.falta > 0 ? `Faltam ${b(brl(m.topo.falta))} para a meta ouro.` : "A meta ouro de faturamento já foi atingida.";
  const churn = t.ativosIni > 0 ? Math.round((t.cancelados / t.ativosIni) * 1000) / 10 : 0;
  const churnRef = f && f.ativosIni > 0 ? Math.round((f.cancelados / f.ativosIni) * 1000) / 10 : null;
  const convRef = f?.oportunidades ? Math.round((f.conversoes / f.oportunidades) * 1000) / 10 : null;
  const n = r.alertas.length, crit = r.alertas.filter((a) => a.gravidade === "critico").length;
  const nota = (txt) => `<p style="margin:0 0 10px;font-family:${sans};font-size:14px;line-height:1.6;color:${SUAVE}">${txt}</p>`;
  const avisos = (r.desatualizado ? nota("A atualização do EVO desta madrugada não terminou: os números podem ser de anteontem.") : "")
    + (r.dia ? "" : nota("Os números de ontem aparecem a partir do segundo dia de histórico do Atlas; por enquanto vale o acumulado do mês."))
    + (r.temRef ? "" : nota("A comparação com o mês passado aparece quando o Atlas tiver um mês de histórico."));

  // ---- caixa "No resumo de hoje" (como o "Na edição de hoje" do Resumo BP)
  const destaques = [
    ["💰", d ? `${b(brl(d.faturamento))} de faturamento ontem` : `${b(brl(t.faturamento))} de faturamento no mês`],
    ["🛒", d ? `${d.novosContratos ? b(`${int(d.novosContratos)} ${d.novosContratos === 1 ? "contrato vendido" : "contratos vendidos"}`) : "Nenhum contrato vendido"} e ${b(brl(d.vendasOnline))} em vendas online ontem` : `${b(int(t.novosContratos))} contratos vendidos no mês`],
    ["🤝", `${d ? (d.cancelados ? `${b(int(d.cancelados))} ${d.cancelados === 1 ? "cancelamento" : "cancelamentos"} ontem` : "Nenhum cancelamento ontem") : `${b(int(t.cancelados))} cancelamentos no mês`}; inadimplência em ${b(`${virg(t.inadimplenciaPerc)}%`)}`],
    ...(t.nps !== null ? [["⭐", `NPS ${b(String(t.nps))} no mês`]] : []),
    [n ? "🚨" : "✅", n ? `${b(`${n} ${n === 1 ? "alerta" : "alertas"}`)}${crit ? ` (${crit} ${crit === 1 ? "crítico" : "críticos"})` : ""} pedindo atenção` : "Nenhum alerta hoje"],
  ];
  const caixa = `${tituloSecao("No resumo de hoje", TINTA, 34)}
<table role="presentation" width="100%" style="margin:0 0 14px;border-collapse:separate;background:${CAIXA};border-radius:14px"><tr><td style="padding:20px 22px 8px">
${destaques.map(([e, txt]) => `<p style="margin:0 0 12px;font-family:${sans};font-size:15px;line-height:1.55;color:${TEXTO}">${e}&nbsp; ${txt}</p>`).join("")}
</td></tr></table>`;

  // ---- Vendas
  const vOnline = ontem(d?.vendasOnline, brl, null);
  const vContr = ontem(d?.novosContratos, (x) => `${int(x)} ${x === 1 ? "contrato novo" : "contratos novos"}`, "nenhum contrato novo");
  const fatMes = `${b(brl(t.faturamento))}${entre(vari(t.faturamento, f?.faturamento))}`;
  const vendas = secao("Vendas", "💰", `
<p style="${P}">${d ? `O faturamento de ontem foi de ${b(brl(d.faturamento))}, e o mês já soma ${fatMes}.` : `O faturamento do mês soma ${fatMes}.`} ${metaTxt}</p>
<p style="${P}">${d ? `Ontem entraram ${vOnline ? `${b(vOnline)} em vendas online` : "nenhuma venda online"} e ${b(vContr)}. ` : ""}No mês, são ${b(`${int(t.novosContratos)} contratos vendidos`)}${entre(vari(t.novosContratos, f?.novosContratos))} e ${b(brl(t.vendasOnline))} em vendas online${entre(vari(t.vendasOnline, f?.vendasOnline))}.</p>
<p style="${P}">As receitas complementares somaram ${d ? `${b(brl(d.complementar))} ontem e ` : ""}${b(brl(t.complementar))} no mês${entre(vari(t.complementar, f?.complementar))}. A conversão média está em ${b(`${virg(t.conversao ?? 0)}%`)}${entre(vari(t.conversao, convRef, { pp: true }))}.</p>`);

  // ---- Retenção
  const canc = d ? (d.cancelados ? `Foram ${b(`${int(d.cancelados)} ${d.cancelados === 1 ? "cancelamento" : "cancelamentos"}`)} ontem.` : "Não houve cancelamentos ontem.") : "";
  const retencao = secao("Retenção", "🤝", `
<p style="${P}">O churn do mês está em ${b(`${virg(churn)}%`)}${entre(vari(churn, churnRef, { melhorSeSobe: false, pp: true }))}. ${canc} No mês, são ${b(`${int(t.cancelados)} cancelamentos`)}${entre(vari(t.cancelados, f?.cancelados, { melhorSeSobe: false }))}, e ${b(`${int(t.renovados)} contratos`)} foram renovados${entre(vari(t.renovados, f?.renovados))}.</p>
<p style="${P}">A inadimplência está em ${b(`${virg(t.inadimplenciaPerc)}% dos pagantes`)}${entre(vari(t.inadimplenciaPerc, f?.inadimplenciaPerc, { melhorSeSobe: false, pp: true }))}.</p>`);

  // ---- Contratos mais vendidos
  const top = r.top ?? [];
  const desc = (c) => `${b(c.nome)}, com ${int(c.acum)} no mês${c.dia == null ? "" : c.dia ? ` (${int(c.dia)} ontem)` : " (nenhum ontem)"}`;
  const topo = top.length ? secao("Contratos mais vendidos", "📝", `
<p style="${P}">O mais vendido do mês é o ${desc(top[0])}${top[1] ? `, seguido do ${desc(top[1])}` : ""}${top[2] ? ` e do ${desc(top[2])}` : ""}.</p>`) : "";

  // ---- Satisfação
  const neutros = Math.max(0, t.npsRespostas - t.npsPromotores - t.npsDetratores);
  const vn = vari(t.nps, f?.nps, { pontos: true });
  const nps = t.nps === null ? "" : secao("Satisfação", "⭐", `
<p style="${P}">O NPS do mês está em ${b(String(t.nps))}${entre(vn)}.${d && d.nps !== null ? ` A nota de ontem foi ${b(String(d.nps))}.` : ""} No mês, ${b(`${int(t.npsRespostas)} pesquisas`)} foram respondidas: ${int(t.npsPromotores)} promotores, ${int(neutros)} neutros e ${int(t.npsDetratores)} detratores. <a href="${esc(urlWehelp)}" style="color:${TEXTO};text-decoration:underline">Ver as pesquisas no WeHelp</a>.</p>`);

  // ---- Tráfego pago (Meta)
  const mt = r.meta;
  const reais2 = (x) => `R$ ${x.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const pct1 = (x) => `${x.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  const trafego = !mt ? "" : secao("Tráfego pago", "📣", `
<p style="${P}">${r.unidade ? "A unidade investiu" : "As unidades investiram"} ${b(brl(mt.investimento))} no Meta no mês${mt.pctFaturamento !== null ? `, ${b(`${pct1(mt.pctFaturamento)} do faturamento`)},` : ""} e ${r.unidade ? "recebeu" : "receberam"} ${b(`${int(mt.contatos)} ${mt.contatos === 1 ? "contato" : "contatos"}`)}${mt.contatos > 0 ? `, a ${reais2(mt.investimento / mt.contatos)} por contato` : ""}.${mt.compras > 0 ? ` O pixel do site marcou ${b(`${int(mt.compras)} ${mt.compras === 1 ? "venda online" : "vendas online"}`)}, a ${reais2(mt.investimento / mt.compras)} por venda.` : ""}</p>`);

  // ---- Alertas: a contagem e quais são, no mesmo parágrafo (título e onde); o detalhe e a ação ficam no Atlas.
  const quaisAlertas = gruposDeAlertas(r.alertas).map((g, i, todos) => {
    const geral = g.quem.filter((q) => q === "A rede" || q === "Suas unidades");
    const unidades = g.quem.filter((q) => !geral.includes(q));
    const onde = [
      ...geral.map((q) => (q === "A rede" ? "na rede" : "nas suas unidades")),
      ...(unidades.length ? [`em ${unidades.length <= 4 ? juntar(unidades) : `${unidades.slice(0, 3).join(", ")} e mais ${unidades.length - 3} unidades`}`] : []),
    ];
    // Siglas (NPS, CAC) ficam como estão: só baixa a inicial quando a segunda letra não é maiúscula
    const titulo = /^\p{Lu}\p{Lu}/u.test(g.titulo) ? g.titulo : g.titulo.charAt(0).toLowerCase() + g.titulo.slice(1);
    return `${i > 0 && i === todos.length - 1 ? "e " : ""}${b(titulo)}${onde.length ? ` ${esc(juntar(onde))}` : ""}`;
  });
  const alertas = n
    ? secao("Alertas", "🚨", `<p style="${P}">Você tem ${b(`${n} ${n === 1 ? "alerta" : "alertas"}`)} pedindo atenção${crit ? (crit === n ? (n === 1 ? ", e ele é crítico" : ", todos críticos") : `, ${crit} ${crit === 1 ? "crítico" : "críticos"}`) : ""}: ${quaisAlertas.join("; ")}. Os detalhes e as ações sugeridas estão no Atlas.</p>`)
    : secao("Alertas", "✅", `<p style="${P}">Nenhum alerta hoje: os indicadores estão dentro do esperado.</p>`);

  // Dono de unidade e gestor (papel "unidades"): o aviso aparece para todos; master e dono da rede já recebem a rede inteira.
  const maisUnidades = r.papel === "unidades" ? `<p style="${P};margin-top:32px;font-size:13px;line-height:1.6;color:${SUAVE}">Se você é sócio ou gestor de mais de uma unidade, <a href="${esc(url)}" style="color:${VERMELHO};font-weight:600">acesse o Atlas</a> para ver todos os indicadores.</p>` : "";
  const rodape = ["Você recebe este e-mail porque tem acesso ao World Gym Atlas.", contato ? `Dúvidas ou sugestões: <a href="mailto:${esc(contato)}" style="color:#7a7a85">${esc(contato)}</a>.` : ""].filter(Boolean).join("<br>");

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"><style>@media (max-width:520px){.miolo{padding:26px 20px 34px!important}.as-logo{padding-right:10px!important}.as-logo img{width:56px!important}.as-texto{padding-left:10px!important}.as-linha{padding-right:8px!important}.as-site{font-size:12px!important}.as-selo{padding-left:8px!important}.as-selo img{width:44px!important}}</style></head>
<body style="margin:0;background:${FUNDO}">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${FUNDO};mso-hide:all">${esc(textoPrevia(r))}${"&#847;&zwnj;&nbsp;".repeat(90)}</div>
<table role="presentation" width="100%" style="background:${FUNDO}"><tr><td align="center" style="padding:28px 12px 36px">
<table role="presentation" width="100%" style="max-width:600px;border-collapse:collapse">
<tr><td style="padding:0;font-size:0;line-height:0"><img src="${esc(banner)}" width="600" alt="World Gym" style="display:block;width:100%;max-width:600px;height:auto;border-radius:30px 30px 0 0"></td></tr>
<tr><td class="miolo" style="background:#ffffff;padding:30px 48px 42px;border-radius:0 0 18px 18px">
<p style="${P}">Bom dia${primeiro ? ", " + primeiro : ""}! Este é o resumo ${quem}, com os números de ontem e do mês.</p>
${avisos}
<p style="margin:26px 0 0;padding:12px 0;border-top:1px solid ${TRACO};border-bottom:1px solid ${TRACO};text-align:center;font-family:${sans};font-size:14px;letter-spacing:.6px;color:${SUAVE}">${data}</p>
${caixa}
${vendas}
${retencao}
${topo}
${nps}
${trafego}
${alertas}
<p style="margin:36px 0 0" align="center"><a href="${esc(url)}" style="display:inline-block;background:${VERMELHO};color:#ffffff;text-decoration:none;font-family:${sans};font-size:15px;font-weight:600;padding:14px 34px;border-radius:10px">${n ? "Ver alertas no Atlas" : "Abrir o Atlas"}</a></p>
${maisUnidades}
${blocoAssinatura(assinatura)}
</td></tr>
<tr><td style="padding:22px 8px 0;font-family:${sans};font-size:12px;line-height:1.7;color:#9a9aa5;text-align:center">${rodape}</td></tr>
</table></td></tr></table></body></html>`
    .replace(/R\$ (?=\d)/g, () => "R$&nbsp;").replace(/(\d) (p\.p\.|pontos?\b)/g, "$1&nbsp;$2"); // valor e unidade nunca quebram de linha
}

// ---------- envio ----------
/** Registro de quem já recebeu o resumo de cada dia: rodar de novo (falha parcial, disparo manual) não repete e-mail. */
export const caminhoEnviados = (dia) => `resumo/enviados/${dia}.json`;
export const lerEnviados = async (dia) => new Set((await lerJson(caminhoEnviados(dia)).catch(() => null))?.emails ?? []);
export const salvarEnviados = (dia, emails) => gravarJson(caminhoEnviados(dia), { dia, emails: [...emails].sort() });
/** Chave única do envio (uma por pessoa e dia): o Resend recusa um segundo envio com a mesma chave por 24 horas. */
export const chaveDoEnvio = (dia, email) => `resumo-diario/${dia}/${String(email).toLowerCase()}`.slice(0, 256);

const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** Envio pela caixa do Zoho (SMTP) quando SMTP_USUARIO e SMTP_SENHA (senha de aplicativo) existem; senão, pelo Resend. */
export const smtpConfigurado = (env = process.env) => Boolean(env.SMTP_USUARIO && env.SMTP_SENHA);
export const envioConfigurado = (env = process.env) => smtpConfigurado(env) || Boolean(env.RESEND_API_KEY && env.RESUMO_REMETENTE);
/** Remetente. No Zoho o endereço é sempre o da conta (o Zoho recusa outro); de RESUMO_REMETENTE só vale o nome. */
export function remetente(env = process.env) {
  if (!env.SMTP_USUARIO) return env.RESUMO_REMETENTE || "";
  const nome = String(env.RESUMO_REMETENTE ?? "").match(/^\s*"?([^"<]+?)"?\s*</)?.[1] || "Lucas | World Gym";
  return `${nome} <${env.SMTP_USUARIO}>`;
}

let transporte = null;
async function transporteSmtp(env) {
  if (!transporte) {
    const { default: nodemailer } = await import("nodemailer");
    transporte = nodemailer.createTransport({
      host: env.SMTP_HOST || "smtp.zoho.com", port: Number(env.SMTP_PORTA || 465), secure: Number(env.SMTP_PORTA || 465) === 465,
      auth: { user: env.SMTP_USUARIO, pass: env.SMTP_SENHA },
    });
  }
  return transporte;
}

/** Anexos no formato do Resend ({ filename, content em base64, content_id }) -> formato do nodemailer (imagens embutidas por cid). */
export const anexosSmtp = (anexos) => (anexos ?? []).map((a) => ({ filename: a.filename, content: a.content, encoding: "base64", ...(a.content_id ? { cid: a.content_id } : {}) }));

/** Envia pelo Zoho (SMTP). Erro de senha/permissão (5xx do SMTP) não adianta repetir; queda de conexão e limite temporário (4xx), sim. */
export async function enviarSmtp({ para, assunto: subject, html, anexos, chaveUnica }, { env = process.env, transportar, dormir = esperar, tentativas = 3 } = {}) {
  const t = transportar ?? (await transporteSmtp(env));
  const dominio = String(env.SMTP_USUARIO).split("@")[1] || "worldgymacademia.com.br";
  const messageId = chaveUnica ? `<${chaveUnica.replace(/[^a-z0-9.-]/gi, ".")}@${dominio}>` : undefined;
  let erro;
  for (let i = 1; i <= tentativas; i++) {
    try {
      await t.sendMail({ from: remetente(env), to: para, subject, html, attachments: anexosSmtp(anexos), ...(messageId ? { messageId } : {}) });
      return { repetido: false };
    } catch (e) {
      erro = new Error(`Zoho SMTP: ${String(e?.response || e?.message || e).slice(0, 200)}`);
      if (e?.responseCode >= 500 || e?.code === "EAUTH") throw erro;
    }
    if (i < tentativas) await dormir(1000 * 2 ** i);
  }
  throw erro;
}

/** Envia por Resend. Tenta de novo em limite de envios (429), erro do servidor (5xx) e falha de rede; os demais erros não adiantam repetir.
 *  Devolve `{ repetido }`: true quando o Resend reconheceu a chave e não mandou outro e-mail. Com o Zoho configurado, envia por ele. */
export async function enviarEmail(msg, { chave = process.env.RESEND_API_KEY, de = process.env.RESUMO_REMETENTE, buscar = fetch, dormir = esperar, tentativas = 3, env = process.env } = {}) {
  if (smtpConfigurado(env)) return enviarSmtp(msg, { env, dormir, tentativas });
  const { para, assunto: subject, html, anexos, chaveUnica } = msg;
  if (!chave || !de) throw new Error("RESEND_API_KEY e RESUMO_REMETENTE são obrigatórios para enviar.");
  const body = JSON.stringify({ from: de, to: [para], subject, html, ...(anexos ? { attachments: anexos } : {}) });
  const headers = { Authorization: `Bearer ${chave}`, "Content-Type": "application/json", ...(chaveUnica ? { "Idempotency-Key": chaveUnica } : {}) };
  let erro;
  for (let i = 1; i <= tentativas; i++) {
    let pausa = 1000 * 2 ** (i - 1);
    try {
      const res = await buscar("https://api.resend.com/emails", { method: "POST", headers, body });
      if (res.ok) return { repetido: res.headers?.get?.("idempotent-replayed") === "true" };
      const texto = (await res.text()).slice(0, 200);
      // Mesma chave com conteúdo diferente: este e-mail já saiu hoje (os números mudaram entre uma rodada e outra). Não é falha.
      if (res.status === 409 && texto.includes("invalid_idempotent_request")) return { repetido: true };
      erro = new Error(`Resend HTTP ${res.status}: ${texto}`);
      if (!(res.status === 429 || res.status === 409 || res.status >= 500)) throw Object.assign(erro, { definitivo: true });
      const pedido = Number(res.headers?.get?.("retry-after"));
      if (pedido > 0) pausa = Math.min(pedido * 1000, 30000);
    } catch (e) {
      if (e.definitivo) throw e;
      erro = e;
    }
    if (i < tentativas) await dormir(pausa);
  }
  throw erro;
}
