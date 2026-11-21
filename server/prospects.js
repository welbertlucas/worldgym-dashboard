// Conversão de cadastros, como no relatório Gerencial > Prospects > "Cadastro/conversão de oportunidade" do EVO
// (com "Contabilizar especiais" e "Contabilizar conversões sem venda" marcadas, o padrão):
//  - oportunidades = prospects cadastrados no mês;
//  - conversões = desses, os que viraram cliente dentro do mesmo mês ("Convertido no período");
//  - origens = cadastradas e convertidas por origem do cadastro (coluna Marketing).
// Conferido contra a tela do EVO em Valparaíso/out-2026: 295 cadastrados e 257 convertidos.
// O relatório vem em Excel (todas as unidades de uma vez); as datas vêm em DD/MM/AAAA.
import { evoBuffer, fetchAll } from "./evo.js";
import { diaDeCorte } from "./ativos.js";
import { lerXlsx } from "./xlsx.js";
import { UNIT_NAMES } from "./units.js";
import { datasDaSemana, semanasNoMes, semanasVazias } from "./semanas.js";

/** "TOTEM/SITE/ " → "Totem/Site"; vazio → "Sem origem". */
export function origemDaOportunidade(marketing) {
  const t = String(marketing ?? "").replace(/\/+\s*$/, "").trim();
  if (!t) return "Sem origem";
  return t.toLowerCase().replace(/(^|[\s/])(\p{L})/gu, (_m, sep, c) => sep + c.toUpperCase());
}

/** Faixas do tempo entre o cadastro e a conversão, em dias: mesmo dia, 1 a 3, 4 a 7, 8 a 30 e mais de 30. */
export const FAIXAS_TEMPO = ["No mesmo dia", "1 a 3 dias", "4 a 7 dias", "8 a 30 dias", "Mais de 30 dias"];
const faixaDoTempo = (dias) => (dias <= 0 ? 0 : dias <= 3 ? 1 : dias <= 7 ? 2 : dias <= 30 ? 3 : 4);
const diasEntre = (de, ate) => Math.round((new Date(`${ate}T00:00:00Z`) - new Date(`${de}T00:00:00Z`)) / 86400000);
const MAX_CONSULTORES = 10;

const iso = (d) => (/^\d\d\/\d\d\/\d{4}$/.test(d) ? d.split("/").reverse().join("-") : "");

/**
 * Resume as linhas do relatório: { [unidade]: { oportunidades, conversoes, origens, consultores, tempoConversao } } para o período [de, ate].
 *  - consultores = [[nome, convertidas]] de quem converteu (coluna "ConvertidoPor": o relatório não diz quem cadastrou), os 10 maiores;
 *  - tempoConversao = { n, soma, f } dos que viraram cliente no período: quantos, soma dos dias do cadastro à conversão e a contagem por faixa.
 * Só entram os cadastrados no período, então o tempo é o das oportunidades do mês que converteram no próprio mês.
 *  - conversoesAntigas = quem se cadastrou ANTES do período e virou cliente dentro dele. Não entra em oportunidades, conversões nem na taxa
 *    (que seguem o relatório do EVO); serve para explicar a diferença para o "visitantes/conversão" do Resumo gerencial do EVO.
 */
export function resumirProspects(rows, de, ate) {
  const por = {};
  for (const r of rows) {
    const nome = UNIT_NAMES[Number(r.IdFilial)];
    if (!nome) continue;
    const cad = iso(r.DtCadastro);
    if (!cad || cad > ate) continue;
    const u = (por[nome] ??= { oportunidades: 0, conversoes: 0, conversoesAntigas: 0, origens: {}, _consultores: new Map(), tempoConversao: { n: 0, soma: 0, f: FAIXAS_TEMPO.map(() => 0) } });
    if (cad < de) {
      const c = iso(r.DtConversao);
      if (c && c >= de && c <= ate) u.conversoesAntigas += 1;
      continue;
    }
    u.oportunidades += 1;
    const o = (u.origens[origemDaOportunidade(r.Marketing)] ??= [0, 0]); // [cadastradas, convertidas no mês]
    o[0] += 1;
    const conv = iso(r.DtConversao);
    if (conv && conv >= de && conv <= ate) {
      u.conversoes += 1; o[1] += 1;
      const quem = String(r.ConvertidoPor ?? "").replace(/\s+/g, " ").trim();
      if (quem) u._consultores.set(quem, (u._consultores.get(quem) ?? 0) + 1);
      const dias = Math.max(0, diasEntre(cad, conv));
      u.tempoConversao.n += 1; u.tempoConversao.soma += dias; u.tempoConversao.f[faixaDoTempo(dias)] += 1;
    }
  }
  for (const u of Object.values(por)) {
    u.consultores = [...u._consultores].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR")).slice(0, MAX_CONSULTORES);
    delete u._consultores;
  }
  return por;
}

/** Plano VIP (cortesia da unidade): o cartão do EVO não o conta como conversão. */
export const ehPlanoVip = (nome) => /\bV\.?\s?I\.?\s?P\b/i.test(String(nome ?? ""));

/**
 * Conversões como no cartão "Visitantes x conversões" do Dashboard do EVO: quem virou aluno no período (inclusive quem se cadastrou antes)
 * com ao menos um contrato vendido, sem plano VIP. `todos` = todos os que viraram aluno no período (com ou sem contrato, VIP ou não):
 * contam como visita, mas só os `convertidos` contam como conversão. { [unidade]: { todos, convertidos } }
 */
export function convertidosDoCartao(rows, de, ate) {
  const por = {};
  for (const r of rows) {
    const nome = UNIT_NAMES[Number(r.IdFilial)];
    const conv = iso(r.DtConversao);
    if (!nome || !conv || conv < de || conv > ate) continue;
    const u = (por[nome] ??= { todos: 0, convertidos: 0 });
    u.todos += 1;
    const contrato = String(r.PrimeiroContrato ?? "").trim();
    if (contrato && !ehPlanoVip(contrato)) u.convertidos += 1;
  }
  return por;
}

/**
 * Cadastros presenciais que ainda não viraram aluno, por dia do cadastro: { [unidade]: [n do dia 1, n do dia 2, ...] }.
 * A rota /prospects do EVO só lista quem ainda é prospect e traz o tipo do cadastro (signupType "Personal" = presencial).
 */
export async function presenciaisNaoConvertidos(ym, ate) {
  const [y, m] = ym.split("-").map(Number);
  const dias = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const por = {};
  for (const [id, nome] of Object.entries(UNIT_NAMES)) {
    const lista = await fetchAll(`/prospects?idBranch=${id}&registerDateStart=${ym}-01&registerDateEnd=${ate}`, 100);
    const d = (por[nome] = Array(dias).fill(0));
    for (const p of lista) {
      const dia = String(p.registerDate ?? "").slice(0, 10);
      if (p.signupType === "Personal" && dia >= `${ym}-01` && dia <= ate) d[Number(dia.slice(8, 10)) - 1] += 1;
    }
  }
  return por;
}

/**
 * Visitantes x convertidos do mês e de cada semana, como no cartão do EVO:
 *  - visitantes = cadastros presenciais ainda não convertidos + todos os que viraram aluno no período;
 *  - convertidos = os que viraram aluno com contrato vendido, sem VIP.
 * `naoConv` vem de presenciaisNaoConvertidos. Devolve { [unidade]: { visitantes, convertidos, semanas: [{ visitantes, convertidos }] } }.
 */
export function visitantesDoCartao(rows, naoConv, ym, ate) {
  const soma = (a, de, fim) => a.slice(de - 1, fim).reduce((n, x) => n + x, 0);
  const diaAte = Number(ate.slice(8, 10));
  const mes = convertidosDoCartao(rows, `${ym}-01`, ate);
  const semanas = [];
  for (let n = 1; n <= semanasNoMes(ym); n++) {
    const { de, ate: fim } = datasDaSemana(ym, n);
    if (de > ate) break;
    semanas.push({ n, de: Number(de.slice(8, 10)), fim: Math.min(Number(fim.slice(8, 10)), diaAte), conv: convertidosDoCartao(rows, de, fim < ate ? fim : ate) });
  }
  const out = {};
  for (const nome of new Set([...Object.keys(naoConv), ...Object.keys(mes)])) {
    const d = naoConv[nome] ?? [];
    const c = mes[nome] ?? { todos: 0, convertidos: 0 };
    out[nome] = {
      visitantes: soma(d, 1, diaAte) + c.todos, convertidos: c.convertidos,
      semanas: semanasVazias(ym).map((_, i) => {
        const w = semanas[i];
        if (!w) return {};
        const cw = w.conv[nome] ?? { todos: 0, convertidos: 0 };
        return { visitantes: soma(d, w.de, w.fim) + cw.todos, convertidos: cw.convertidos };
      }),
    };
  }
  return out;
}

/** Linhas do relatório do EVO (todas as unidades) com cadastro entre o dia 1 do mês e `ate`. */
export async function linhasDoMes(ym, ate) {
  return lerXlsx(await evoBuffer(`/api/v2/management/prospects?dtStart=${ym}-01&dtEnd=${ate}`));
}

/** Oportunidades e conversões de cada semana do mês, por unidade (cadastradas na semana e convertidas na própria semana). Semana ainda não começada fica de fora. */
export function semanasDeProspects(rows, ym, ate) {
  const por = {};
  for (const nome of Object.keys(resumirProspects(rows, `${ym}-01`, ate))) por[nome] = semanasVazias(ym);
  for (let n = 1; n <= semanasNoMes(ym); n++) {
    const { de, ate: fim } = datasDaSemana(ym, n);
    if (de > ate) break;
    const r = resumirProspects(rows, de, fim < ate ? fim : ate);
    // semana já começada: quem não teve cadastro nela fica com 0 (semana que não começou fica sem número)
    for (const nome of Object.keys(por)) por[nome][n - 1] = { oportunidades: r[nome]?.oportunidades ?? 0, conversoes: r[nome]?.conversoes ?? 0, conversoesAntigas: r[nome]?.conversoesAntigas ?? 0 };
  }
  return por;
}

export async function prospectsDoMes(ym, hoje) {
  const ate = diaDeCorte(ym, hoje);
  const rows = await linhasDoMes(ym, ate);
  const por = resumirProspects(rows, `${ym}-01`, ate);
  const sem = semanasDeProspects(rows, ym, ate);
  for (const [nome, u] of Object.entries(por)) u.semanas = sem[nome] ?? semanasVazias(ym);
  // Visitantes x convertidos como no cartão do EVO (se a rota de prospects falhar, o mês segue sem esses campos)
  try {
    const cartao = visitantesDoCartao(rows, await presenciaisNaoConvertidos(ym, ate), ym, ate);
    for (const [nome, c] of Object.entries(cartao)) {
      const u = (por[nome] ??= { oportunidades: 0, conversoes: 0, conversoesAntigas: 0, origens: {}, consultores: [], tempoConversao: { n: 0, soma: 0, f: FAIXAS_TEMPO.map(() => 0) }, semanas: semanasVazias(ym) });
      u.visitantes = c.visitantes; u.convertidos = c.convertidos;
      u.semanas = u.semanas.map((w, i) => ({ ...w, ...c.semanas[i] }));
    }
  } catch (e) { console.warn(`${ym}: visitantes do cartão do EVO indisponíveis (${e.message})`); }
  return por;
}

/** Dia `dia` do mês `ym`, limitado ao último dia do mês (dia 31 em fevereiro vira 28/29). */
const diaNoMes = (ym, dia) => {
  const [y, m] = ym.split("-").map(Number);
  return `${ym}-${String(Math.min(dia, new Date(Date.UTC(y, m, 0)).getUTCDate())).padStart(2, "0")}`;
};

/**
 * Conversão até o dia `dia` no mês em andamento, contra o mesmo dia dos meses anteriores:
 * { [unidade]: { dia, oportunidades, conversoes, taxa, base: { meses, taxa } } }.
 * `atual` = linhas do mês em andamento; `anteriores` = [[ym, linhas]] dos meses fechados. Na base só entram os meses em que a
 * unidade tinha ao menos `minimo` cadastros até o dia (com poucos cadastros, um aluno muda a taxa em vários pontos).
 */
export function ritmoConversao(ym, atual, anteriores, dia, minimo = 20) {
  const ate = diaNoMes(ym, dia);
  const agora = resumirProspects(atual, `${ym}-01`, ate);
  const antes = anteriores.map(([m, linhas]) => resumirProspects(linhas, `${m}-01`, diaNoMes(m, dia)));
  const taxa = (x) => Math.round((x.conversoes / x.oportunidades) * 1000) / 10;
  const out = {};
  for (const [nome, u] of Object.entries(agora)) {
    const base = antes.map((p) => p[nome]).filter((x) => x && x.oportunidades >= minimo).map(taxa);
    out[nome] = {
      dia, oportunidades: u.oportunidades, conversoes: u.conversoes, taxa: u.oportunidades ? taxa(u) : 0,
      base: { meses: base.length, taxa: base.length ? Math.round((base.reduce((a, b) => a + b, 0) / base.length) * 10) / 10 : 0 },
    };
  }
  return out;
}
