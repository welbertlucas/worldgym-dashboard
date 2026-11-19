// Conversão de cadastros, como no relatório Gerencial > Prospects > "Cadastro/conversão de oportunidade" do EVO
// (com "Contabilizar especiais" e "Contabilizar conversões sem venda" marcadas, o padrão):
//  - oportunidades = prospects cadastrados no mês;
//  - conversões = desses, os que viraram cliente dentro do mesmo mês ("Convertido no período");
//  - origens = cadastradas e convertidas por origem do cadastro (coluna Marketing).
// Conferido contra a tela do EVO em Valparaíso/out-2026: 295 cadastrados e 257 convertidos.
// O relatório vem em Excel (todas as unidades de uma vez); as datas vêm em DD/MM/AAAA.
import { evoBuffer } from "./evo.js";
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
/** Usuário interno do suporte do EVO: faz conversões por baixo dos panos e não é consultor da unidade, então não entra no ranking. */
export const ehUsuarioDeSistema = (nome) => /^suporte\s*evo$/i.test(String(nome ?? "").trim());

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
      if (quem && !ehUsuarioDeSistema(quem)) u._consultores.set(quem, (u._consultores.get(quem) ?? 0) + 1);
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
