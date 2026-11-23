// Alertas do mês VIGENTE (em andamento): o que fazer agora. Os alertas do mês fechado (src/data/alerts.ts) ficam para o
// "Fechamento", que explica o que aconteceu. Dois tipos:
//  - pendência: algo em aberto agora (cobrar, trocar cartão, dar retorno), vale desde o dia 1;
//  - ritmo: se o mês vai fechar bem (projeção contra a meta ou contra os meses anteriores), só a partir do dia 10.
// Limiares aprovados pelo dono em 15/11/2026, calibrados com mai–out/2026 (23 unidades). Ajuste só aqui.
import { nomeDoPonto, npsDoPonto, somarPontos } from "@/data/npsPontos";
import { type MonthData, type UnitData } from "@/data/dashboardData";
import { formatMetaValue, getMeta, lowestTier, TIER_LABEL, type Meta, type MetaKey } from "@/data/metas";
import { monthKey } from "@/data/periods";
import { projecaoContratos, projecaoFaturamento } from "@/data/projecaoMes";
import { DIAS_MINIMOS, diasFechados, diasNoMes } from "@/data/vendasDia";
import { liberacoesDeReceita, liberacoesSemPagamento, LIMITES_LIBERACOES } from "../../server/alertasLiberacoes.js";

export const LIMIARES_VIGENTES = {
  /** Meses fechados usados como "normal da unidade" (mediana). */
  mesesBase: 6,
  /** Meses fechados para a média de comparação do ritmo sem meta. */
  mesesMedia: 3,
  // Inadimplência e cartões comparam com o MESMO DIA dos 3 meses anteriores (u.mesmoDia, server/mesmoDia.js):
  // no meio do mês o "em aberto" ainda inclui quem paga com alguns dias de atraso, então o fechamento não serve de régua.
  // Sem a base do mesmo dia, ficam só informativos. O recebido não vira alerta: inclui cobranças antecipadas do cartão e
  // atrasados do mês anterior, então passa de 100% em algumas unidades e muda com o dia da recorrência (decisão do dono, 15/11/2026).
  // Calibrado em 15/11/2026 com ago–out/2026 no dia 15: a variação típica de uma unidade entre meses é de 2 p.p. na
  // inadimplência (10% das vezes passa de 4) e 1,2 p.p. nos cartões (2,3).
  inadimplencia: { atencaoPP: 3, minimoPct: 4, criticoPP: 5, criticoMinPct: 8 },
  cartao: { minimoValor: 1000, atencaoPP: 2, criticoPP: 4 },
  detratores: { minRespostas: 10, minDetratores: 3, atencaoPct: 17, criticoPct: 25 },
  // Ponto de contato do NPS (Recepção, Limpeza, professores...) bem abaixo do NPS da rede nesse mesmo ponto, nos últimos 2 meses (o anterior mais o atual).
  // Calibrado em 21/11/2026 com out/2024 a out/2026 (373 unidades-mês, só pontos com 20+ respostas): o pior ponto da unidade fica 37 p.p. ou mais abaixo da rede
  // em 15% das vezes e 48 ou mais em 5%. Só vale se o NPS do ponto na unidade está abaixo de 50 (faixa "melhorar" do WeHelp).
  pontoFraco: { minRespostas: 20, minRede: 100, npsMaximo: 50, atencaoPP: 37, criticoPP: 48 },
  /** Ritmo com meta: abaixo do nível mais baixo = atenção; abaixo desta fração dele = crítico. */
  meta: { criticoFracao: 0.75 },
  faturamentoSemMeta: { atencaoPct: -7, criticoPct: -12 },
  contratosSemMeta: { atencaoPct: -20, criticoPct: -35 },
  // Cancelamentos e renovação contra o mesmo dia dos 3 meses anteriores (u.ritmoAlunos). Calibrado em 16/11/2026 com mai–out/2026
  // no dia 15 (23 unidades): o churn até o dia sobe mais de 1,5 p.p. sobre a média em 10% das vezes e mais de 2,2 em 5%;
  // os não renovados (% dos que venceram), mais de 14 p.p. em 10% das vezes e mais de 17 em 5%.
  /** Sem a base do mesmo dia, a regra antiga (já passou do churn de um mês inteiro típico). */
  cancelamentos: { criticoPct: 8, atencaoPP: 1.5, criticoPP: 2.2 },
  /** Só com 10 ou mais contratos vencidos no mês. */
  renovacao: { minVenceram: 10, atencaoPP: 14, criticoPP: 20 },
  // Conversão de visitantes (como no cartão do EVO: convertidos com contrato, sem VIP, ÷ visitantes presenciais) contra o mesmo dia dos 3 meses anteriores (u.ritmoConversao).
  // Calibrado em 21/11/2026 com jan/2025 a out/2026 nos dias 7 a 25 (7.233 casos, só unidades com 40+ visitantes): cai 11 p.p. ou mais em 10% das vezes e 16 ou mais em 5%.
  /** Só com 40 ou mais visitantes no mês até o dia (com menos, um aluno muda a taxa em vários pontos). */
  conversao: { minOportunidades: 40, atencaoPP: 11, criticoPP: 16 },
  /** Alunos ativos que não vêm há 16 a 60 dias (último acesso): ainda dá para trazer de volta. Informativo até haver histórico. */
  sumidos: { minimo: 10 },
} as const;

export type TipoVigente = "pendencia" | "ritmo";
export type SeveridadeVigente = "critical" | "attention" | "info";
export type KindVigente =
  | "inadAberta" | "cartaoRecusado" | "detratores" | "liberacoes" | "renovacao" | "sumidos"
  | "fatRitmo" | "contratosRitmo" | "cancelRitmo" | "conversao" | "pontoFraco";

export interface AlertaVigente {
  id: string;
  unit: string;
  kind: KindVigente;
  tipo: TipoVigente;
  severity: SeveridadeVigente;
  month: string;
  title: string;
  /** O que os números mostram. */
  fact: string;
  /** O que fazer. */
  action: string;
  /** Tela do Atlas com o detalhe (endereço do menu, ex.: "gerencial/cobranca"). */
  tela: string;
  /** Peso da unidade na rede (previsão de faturamento), para ordenar. */
  weight: number;
}

export const TITULO_VIGENTE: Record<KindVigente, string> = {
  inadAberta: "Inadimplência em aberto",
  cartaoRecusado: "Cartões recusados em aberto",
  detratores: "Detratores do NPS",
  liberacoes: "Liberações sem pagamento",
  renovacao: "Renovações do mês",
  sumidos: "Alunos sem vir",
  fatRitmo: "Faturamento no ritmo do mês",
  contratosRitmo: "Novos contratos no ritmo do mês",
  cancelRitmo: "Cancelamentos acima do normal",
  conversao: "Conversão de visitantes abaixo do normal",
  pontoFraco: "Ponto de contato abaixo da rede",
};

const brl = (v: number) => formatMetaValue("faturamento", v);
const pct = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const int = (v: number) => Math.round(v).toLocaleString("pt-BR");
const mediana = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const ordemSev: Record<SeveridadeVigente, number> = { critical: 0, attention: 1, info: 2 };

export interface ResultadoVigente {
  /** Mês avaliado (o corrente) ou null se ainda não há dados dele. */
  month: string | null;
  /** Dias já fechados na leitura do EVO. */
  dias: number;
  /** Se as regras de ritmo já valem (a partir do dia 10). */
  comRitmo: boolean;
  alertas: AlertaVigente[];
}

/**
 * Alertas do mês corrente para as unidades de `data` (e para a rede, se `incluirRede` e houver meta da rede).
 * `atualizadoEm` = quando o EVO foi lido (define os dias fechados). `now` é injetável para teste.
 */
export function computeAlertasVigentes(
  data: MonthData[], metas: Meta[], { atualizadoEm, now = new Date(), incluirRede = true }: { atualizadoEm: string | null; now?: Date; incluirRede?: boolean },
): ResultadoVigente {
  const L = LIMIARES_VIGENTES;
  const month = monthKey(now);
  const cur = data.find((d) => d.month === month);
  if (!cur) return { month: null, dias: 0, comRitmo: false, alertas: [] };
  const dias = diasFechados(month, true, atualizadoEm);
  const comRitmo = dias >= DIAS_MINIMOS;
  const fechados = data.filter((d) => d.month < month);
  const ultimos = (n: number) => fechados.slice(-n);
  const daUnidade = (d: MonthData, nome: string) => d.units.find((u) => u.name === nome);
  /** Valores do indicador nos últimos `n` meses fechados da unidade (só os que existem e são números). */
  const hist = (nome: string, n: number, f: (u: UnitData) => number | undefined | null) =>
    ultimos(n).map((d) => daUnidade(d, nome)).filter((u): u is UnitData => !!u).map(f).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const totalPrev = cur.units.reduce((s, u) => s + (u.previsaoFaturamento ?? u.faturamento ?? 0), 0) || 1;
  const fracaoDias = dias / diasNoMes(month);
  const alertas: AlertaVigente[] = [];
  const push = (a: Omit<AlertaVigente, "id" | "month" | "title" | "tipo"> & { tipo?: TipoVigente }) => {
    const tipo = a.tipo ?? (["fatRitmo", "contratosRitmo", "cancelRitmo", "conversao"].includes(a.kind) ? "ritmo" : "pendencia");
    alertas.push({ ...a, tipo, id: `${month}|${a.unit}|${a.kind}`, month, title: TITULO_VIGENTE[a.kind] });
  };

  /** Ritmo contra a meta (se houver) ou contra a média dos meses anteriores. */
  const ritmo = (nome: string, key: MetaKey, projetado: number, semMeta: { atencaoPct: number; criticoPct: number }, mediaAnterior: number | null, fmt: (v: number) => string, extra = "") => {
    const meta = getMeta(metas, month, nome, key);
    const piso = meta ? lowestTier(meta) : null;
    if (piso) {
      if (projetado >= piso.value) return null;
      const severity: SeveridadeVigente = projetado < piso.value * L.meta.criticoFracao ? "critical" : "attention";
      const nivel = meta && [meta.bronze, meta.prata, meta.ouro].filter((x) => x !== undefined).length === 1 ? "da meta" : `do ${TIER_LABEL[piso.tier]}`;
      return { severity, fact: `No ritmo atual, o mês fecha em ≈ ${fmt(projetado)}, abaixo ${nivel} (${fmt(piso.value)}).${extra}` };
    }
    if (mediaAnterior === null || mediaAnterior <= 0) return null;
    const dif = (projetado / mediaAnterior - 1) * 100;
    if (dif > semMeta.atencaoPct) return null;
    const severity: SeveridadeVigente = dif <= semMeta.criticoPct ? "critical" : "attention";
    return { severity, fact: `No ritmo atual, o mês fecha em ≈ ${fmt(projetado)}, ${pct(Math.abs(dif))} abaixo da média dos ${L.mesesMedia} meses anteriores (${fmt(mediaAnterior)}). A unidade não tem meta cadastrada.${extra}` };
  };

  for (const u of cur.units) {
    const nome = u.name;
    const weight = (u.previsaoFaturamento ?? u.faturamento ?? 0) / totalPrev;

    // ---------- pendências ----------
    // 1 e 2. Inadimplência e cartões recusados, contra o mesmo dia dos 3 meses anteriores.
    const md = u.mesmoDia && u.mesmoDia.meses.length ? u.mesmoDia : null;
    const noMesmoDia = md ? ` No dia ${md.dia} dos ${md.meses.length === 1 ? "mês anterior" : `${md.meses.length} meses anteriores`} a unidade costumava ter` : "";
    if (typeof u.inadimplenciaPerc === "number" && u.inadimplentes > 0) {
      const I = L.inadimplencia, p = u.inadimplenciaPerc;
      const severity: SeveridadeVigente = !md ? "info"
        : p >= md.inadimplenciaPerc + I.criticoPP && p >= I.criticoMinPct ? "critical"
        : p >= md.inadimplenciaPerc + I.atencaoPP && p >= I.minimoPct ? "attention" : "info";
      push({
        unit: nome, kind: "inadAberta", severity, weight, tela: "gerencial/cobranca",
        fact: `${int(u.inadimplentes)} ${u.inadimplentes === 1 ? "pessoa está" : "pessoas estão"} com mensalidade vencida neste mês e ainda não paga (${pct(p)} de quem tinha mensalidade vencida).${md ? `${noMesmoDia} ${pct(md.inadimplenciaPerc)}.` : ""}`,
        action: "Cobrar quem está com mensalidade vencida e não paga, começando por quem ainda treina. A lista com nomes está no relatório de inadimplentes do EVO.",
      });
    }
    const c = u.cobrancas;
    if (c && c.abertas > 0 && c.valorAberto >= L.cartao.minimoValor) {
      const motivo = Object.entries(u.recusaMotivos ?? {}).sort((x, y) => y[1].abertas - x[1].abertas)[0];
      const prev = u.previsaoFaturamento ?? 0, share = prev > 0 ? (c.valorAberto / prev) * 100 : null;
      const acima = md && share !== null ? share - md.cartaoSobrePrevisao : null;
      const severity: SeveridadeVigente = acima === null ? "info" : acima >= L.cartao.criticoPP ? "critical" : acima >= L.cartao.atencaoPP ? "attention" : "info";
      push({
        unit: nome, kind: "cartaoRecusado", severity, weight, tela: "gerencial/cobranca",
        fact: `${int(c.abertas)} ${c.abertas === 1 ? "cobrança recusada" : "cobranças recusadas"} no cartão ainda em aberto, ${brl(c.valorAberto)}${share !== null && md ? ` (${pct(share)} da previsão de faturamento do mês)` : ""}${motivo ? `. Motivo mais comum: “${motivo[0]}”` : ""}.${md && share !== null ? `${noMesmoDia} ${pct(md.cartaoSobrePrevisao)}.` : ""}`,
        action: "Falar com cada aluno para atualizar o cartão ou pagar por Pix. As cobranças recusadas, com nomes, estão no EVO.",
      });
    }

    // 3. Detratores do NPS
    const resp = u.npsRespostas ?? 0, det = u.npsDetratores ?? 0;
    if (det > 0) {
      const p = resp ? (det / resp) * 100 : 0;
      const alerta = resp >= L.detratores.minRespostas && det >= L.detratores.minDetratores && p >= L.detratores.atencaoPct;
      push({
        unit: nome, kind: "detratores", weight, tela: "retencao/satisfacao",
        severity: alerta ? (p >= L.detratores.criticoPct ? "critical" : "attention") : "info",
        fact: `${int(det)} ${det === 1 ? "aluno deu nota de detrator" : "alunos deram nota de detrator"} (0 a 6) no NPS neste mês, de ${int(resp)} ${resp === 1 ? "resposta" : "respostas"}${resp ? ` (${pct(p)})` : ""}.`,
        action: "Dar retorno a cada detrator em até 48 horas: entender o motivo e dizer o que vai mudar. Os comentários estão no WeHelp.",
      });
    }

    // 3b. Ponto de contato do NPS bem abaixo da rede (janela: mês anterior + mês atual, para ter respostas suficientes)
    {
      const V = L.pontoFraco;
      const janela = [fechados[fechados.length - 1], cur].filter((d): d is MonthData => !!d);
      const rede = somarPontos(janela.flatMap((d) => d.units));
      const meus = somarPontos(janela.flatMap((d) => d.units.filter((x) => x.name === nome)));
      const fracos = Object.entries(meus)
        .filter(([p, a]) => a.resp >= V.minRespostas && (rede[p]?.resp ?? 0) >= V.minRede)
        .map(([p, a]) => { const n = npsDoPonto(a), r = npsDoPonto(rede[p]); return { nome: nomeDoPonto(p), resp: a.resp, nps: n, rede: r, gap: n !== null && r !== null ? r - n : 0 }; })
        .filter((x) => x.nps !== null && x.nps < V.npsMaximo && x.gap >= V.atencaoPP)
        .sort((a, b) => b.gap - a.gap);
      if (fracos.length) {
        const f = (x: (typeof fracos)[number]) => `${x.nome}: NPS ${int(x.nps ?? 0)} contra ${int(x.rede ?? 0)} da rede (${int(x.resp)} respostas)`;
        push({
          unit: nome, kind: "pontoFraco", severity: fracos[0].gap >= V.criticoPP ? "critical" : "attention", weight, tela: "retencao/satisfacao",
          fact: `${fracos.length === 1 ? "Ponto de contato" : "Pontos de contato"} do NPS bem abaixo da rede nos últimos 2 meses: ${fracos.slice(0, 3).map(f).join("; ")}.`,
          action: "Conversar com a equipe do setor, ler os comentários desse ponto no WeHelp e combinar uma ação para a próxima semana. O mapa de unidades × pontos está em Retenção, aba Satisfação.",
        });
      }
    }

    // 4. Liberações sem pagamento (a regra do mês fechado, proporcional aos dias que já passaram)
    const q = liberacoesDeReceita(u) as number | null;
    if (q !== null && dias > 0) {
      const base = hist(nome, LIMITES_LIBERACOES.baseMeses, (x) => liberacoesDeReceita(x) as number | null);
      const med = base.length === LIMITES_LIBERACOES.baseMeses ? media(base)! : null;
      const nivel = q >= LIMITES_LIBERACOES.minNivel * fracaoDias && q >= LIMITES_LIBERACOES.minAlta;
      const alta = med !== null && q >= LIMITES_LIBERACOES.minAlta && q >= LIMITES_LIBERACOES.vezes * Math.max(med, 1) * fracaoDias;
      if (nivel || alta) {
        const [, devendo, visitante] = liberacoesSemPagamento(u) as [number, number, number];
        push({
          unit: nome, kind: "liberacoes", severity: "attention", weight, tela: "catraca/liberacoes",
          fact: `${int(q)} liberações manuais na catraca sem pagamento registrado até agora: ${int(devendo)} de alunos que não estavam em dia${u.liberacoesGrupos ? ` e ${int(visitante)} de visitantes sem venda no dia` : ""}${med !== null ? ` (num mês inteiro a unidade costuma ter ${int(med)})` : ""}.`,
          action: "Ver no EVO quem liberou (Controle de entradas, “Entrada manual”); orientar a recepção a cobrar ou regularizar o aluno e só liberar visitante com a diária ou a aula experimental registrada.",
        });
      }
    }

    // 5. Renovação: o que venceu sem renovar até hoje (contra o mesmo dia dos meses anteriores) e o que vence nos próximos 7 dias.
    const ra = u.ritmoAlunos;
    if (ra && (ra.naoRenovados > 0 || ra.vencem7 > 0)) {
      const R = L.renovacao, dif = ra.naoRenovadosPct - ra.base.naoRenovadosPct;
      const severity: SeveridadeVigente = ra.venceram < R.minVenceram || ra.base.meses === 0 ? "info" : dif >= R.criticoPP ? "critical" : dif >= R.atencaoPP ? "attention" : "info";
      const partes = [
        ra.naoRenovados > 0 ? `${int(ra.naoRenovados)} de ${int(ra.venceram)} ${ra.venceram === 1 ? "contrato que venceu" : "contratos que venceram"} neste mês ainda não renovaram (${pct(ra.naoRenovadosPct)}; no dia ${ra.dia} dos meses anteriores eram ${pct(ra.base.naoRenovadosPct)}).` : "",
        ra.vencem7 > 0 ? `${int(ra.vencem7)} ${ra.vencem7 === 1 ? "contrato vence" : "contratos vencem"} nos próximos 7 dias e ainda não ${ra.vencem7 === 1 ? "foi renovado" : "foram renovados"}.` : "",
      ].filter(Boolean);
      push({
        unit: nome, kind: "renovacao", severity, weight, tela: "retencao/renovacao", fact: partes.join(" "),
        action: "Ligar antes de vencer para quem vence nos próximos 7 dias e para quem já venceu e não renovou. As listas estão nos relatórios de contratos a vencer e não renovados do EVO.",
      });
    } else if (!ra && (u.aVencer ?? 0) > 0 && (u.naoRenovados ?? 0) > 0) push({
      unit: nome, kind: "renovacao", severity: "info", weight, tela: "retencao/renovacao",
      fact: `${int(u.naoRenovados!)} ${u.naoRenovados === 1 ? "contrato venceu" : "contratos venceram"} neste mês sem renovar, de ${int(u.aVencer!)} que vencem no mês.`,
      action: "Ligar para quem venceu e não renovou e para quem ainda vai vencer até o fim do mês. As listas estão nos relatórios de contratos a vencer e não renovados do EVO.",
    });

    // 6. Alunos sem vir: ativos com último acesso entre 16 e 60 dias (ainda dá para trazer de volta). Sem nível até haver histórico.
    const ac = u.acessos;
    if (ac && ac.length >= 4) {
      const sumidos = ac[2] + ac[3], total = ac.reduce((a, b) => a + b, 0);
      if (sumidos >= L.sumidos.minimo) push({
        unit: nome, kind: "sumidos", severity: "info", weight, tela: "catraca/frequencia",
        fact: `${int(sumidos)} alunos ativos não vêm à academia há 16 a 60 dias (${pct((sumidos / (total || 1)) * 100)} dos ativos)${ac[4] ? `; outros ${int(ac[4])} não vêm há mais de 60 dias` : ""}.`,
        action: "Mandar mensagem ou ligar convidando para voltar (aula, avaliação ou troca de horário). A lista sai no EVO pelo filtro de último acesso dos clientes ativos.",
      });
    }

    if (!comRitmo) continue;
    // ---------- ritmo (a partir do dia 10) ----------
    // 7. Faturamento
    const pf = projecaoFaturamento(u, month, true, nome, atualizadoEm);
    if (pf?.estimativa != null) {
      const r = ritmo(nome, "faturamento", pf.estimativa, L.faturamentoSemMeta, media(hist(nome, L.mesesMedia, (x) => x.faturamento)), brl);
      if (r) push({ unit: nome, kind: "fatRitmo", weight, tela: "gerencial/recebimento", ...r, action: "Puxar vendas e cobrança nos dias que faltam: matrículas, rematrículas de quem saiu e cobrança das mensalidades vencidas. A conta da projeção está em Gerencial, aba Recebimentos." });
    }
    // 8. Novos contratos
    const pc = projecaoContratos(u, month, true, nome, atualizadoEm);
    if (pc) {
      const meta = getMeta(metas, month, nome, "novosContratos");
      const piso = meta ? lowestTier(meta) : null;
      const restam = diasNoMes(month) - dias;
      const extra = piso && piso.value > u.novosContratos && restam > 0 ? ` Para chegar lá faltam ${int(piso.value - u.novosContratos)}, cerca de ${(Math.round(((piso.value - u.novosContratos) / restam) * 10) / 10).toLocaleString("pt-BR")} por dia.` : "";
      const r = ritmo(nome, "novosContratos", pc.valor, L.contratosSemMeta, media(hist(nome, L.mesesMedia, (x) => x.novosContratos)), int, extra);
      if (r) push({ unit: nome, kind: "contratosRitmo", weight, tela: "gerencial/vendas", ...r, action: "Reforçar a venda nos dias que faltam: retomar as oportunidades em aberto, ligar para ex-alunos e usar os dias que mais vendem (Gerencial, aba Vendas)." });
    }
    // 9. Cancelamentos: com o histórico de contratos, contra o mesmo dia dos 3 meses anteriores; sem ele, a regra antiga.
    const C = L.cancelamentos;
    if (ra && ra.base.meses > 0) {
      const dif = ra.churnPct - ra.base.churnPct;
      const critico = ra.churnPct >= C.criticoPct || dif >= C.criticoPP;
      if (critico || dif >= C.atencaoPP) push({
        unit: nome, kind: "cancelRitmo", severity: critico ? "critical" : "attention", weight, tela: "retencao/cancelamentos",
        fact: `${int(ra.cancelados)} cancelamentos até agora (${pct(ra.churnPct)} da base do início do mês). No dia ${ra.dia} dos ${ra.base.meses} meses anteriores a unidade costumava estar em ${pct(ra.base.churnPct)}.`,
        action: "Ver os motivos dos cancelamentos do mês (Retenção, aba Cancelamentos) e oferecer alternativa antes do cancelamento: troca de plano, suspensão ou horário.",
      });
    } else if (u.ativosIni && typeof u.churn === "number") {
      const med = mediana(hist(nome, L.mesesBase, (x) => (x.ativosIni ? x.churn : null)));
      const critico = u.churn >= C.criticoPct;
      if (critico || (med !== null && u.churn > med)) push({
        unit: nome, kind: "cancelRitmo", severity: critico ? "critical" : "attention", weight, tela: "retencao/cancelamentos",
        fact: `${int(u.cancelados)} cancelamentos até agora (${pct(u.churn)} da base do início do mês)${med !== null ? `: já passou do que a unidade costuma cancelar num mês inteiro (${pct(med)})` : ""}.`,
        action: "Ver os motivos dos cancelamentos do mês (Retenção, aba Cancelamentos) e oferecer alternativa antes do cancelamento: troca de plano, suspensão ou horário.",
      });
    }
    // 10. Conversão de visitantes (como no cartão do EVO) do mês contra o mesmo dia dos 3 meses anteriores.
    const rc = u.ritmoConversao, V = L.conversao;
    if (rc && rc.base.meses > 0 && rc.oportunidades >= V.minOportunidades) {
      const queda = rc.base.taxa - rc.taxa;
      if (queda >= V.atencaoPP) push({
        unit: nome, kind: "conversao", severity: queda >= V.criticoPP ? "critical" : "attention", weight, tela: "gerencial/oportunidades",
        fact: `${int(rc.conversoes)} de ${int(rc.oportunidades)} visitantes do mês viraram aluno com contrato até agora (${pct(rc.taxa)}). No dia ${rc.dia} dos ${rc.base.meses} meses anteriores a unidade convertia ${pct(rc.base.taxa)}.`,
        action: "Retomar os visitantes do mês que ainda não fecharam: ligar ou mandar mensagem, oferecer aula experimental e conferir se o cadastro está sendo convertido no EVO na hora da venda.",
      });
    }
  }

  // Rede: só o ritmo contra a meta própria da rede (TOTAL), quando existir.
  if (incluirRede && comRitmo) {
    const t = cur.total;
    const pf = projecaoFaturamento(t, month, true, null, atualizadoEm);
    const mf = getMeta(metas, month, "TOTAL", "faturamento");
    if (pf?.estimativa != null && mf) {
      const r = ritmo("TOTAL", "faturamento", pf.estimativa, L.faturamentoSemMeta, null, brl);
      if (r) push({ unit: "Rede", kind: "fatRitmo", weight: 1, tela: "gerencial/recebimento", ...r, action: "Ver quais unidades puxam a projeção para baixo (Metas, indicador Faturamento) e concentrar o esforço nelas." });
    }
    const pc = projecaoContratos(t, month, true, null, atualizadoEm);
    const mc = getMeta(metas, month, "TOTAL", "novosContratos");
    if (pc && mc) {
      const r = ritmo("TOTAL", "novosContratos", pc.valor, L.contratosSemMeta, null, int);
      if (r) push({ unit: "Rede", kind: "contratosRitmo", weight: 1, tela: "gerencial/vendas", ...r, action: "Ver quais unidades estão abaixo do ritmo (Metas, indicador Novos contratos) e reforçar a venda nelas." });
    }
  }

  alertas.sort((a, b) => ordemSev[a.severity] - ordemSev[b.severity] || (a.unit === "Rede" ? -1 : b.unit === "Rede" ? 1 : 0) || b.weight - a.weight || a.unit.localeCompare(b.unit, "pt-BR"));
  return { month, dias, comRitmo, alertas };
}

