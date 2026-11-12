import { authFetch, unidadesProprias, API_BASE } from "@/lib/auth";
// A planilha deixou de ser pública — os dados agora passam por uma função na Vercel
// (api/sheet-data.js) que lê com uma conta de serviço do Google, pra não depender de
// "qualquer pessoa com o link" conseguir ver os dados direto na planilha.
const CSV_URL = `${API_BASE}/sheet-data`;
// Faturamento e recebimento vêm do EVO (api/indicadores); o resto ainda vem da planilha.
const EVO_URL = `${API_BASE}/indicadores`;

export interface Cobrancas { falhas: number; recuperadas: number; abertas: number; valorAberto: number; valorRecuperado: number }
export interface MotivoRecusa { n: number; abertas: number; valorAberto: number }

/**
 * Saldo devedor em aberto num dia: valor, títulos e pessoas; por faixa de atraso (no prazo, até 30 dias, 31–90,
 * 91 dias a 1 ano, mais de 1 ano) [valor, pessoas]; e a parte de quem era aluno ativo no dia [valor, pessoas].
 */
export interface SaldoDevedor { valor: number; titulos: number; pessoas: number; faixas: [number, number][]; ativos?: [number, number] }

/**
 * Notas fiscais de um mês: autorizadas emitidas no mês [quantidade, valor], ISS, canceladas e negadas (quantidade),
 * notas do mês que cobrem pagamentos de outros meses [quantidade, valor] e cobertura em R$
 * [recebido no mês com nota emitida no mês ou no seguinte, recebido no mês].
 */
export interface NotasMes { emitidas: [number, number]; iss: number; canceladas: number; negadas: number; outrosMeses: [number, number]; cobertura: [number, number] }

export interface UnitData {
  name: string;
  faturamento: number;
  recebimento: number;
  ticketMedio: number;
  novosContratos: number;
  adimplentes: number;
  inadimplentes: number;
  inadimplenciaPerc: number;
  churn: number;
  renovacoes: number;
  icv: number;
  vendasOnline: number;
  cancelados: number;
  cac: number;
  lifetime: number;
  oportunidades: number;
  conversoes: number;
  diarias: number;
  personal: number;
  camisetas: number;
  coqueteleiras: number;
  notaGoogle: number;
  nps: number;
  reclameAqui: number;
  /** Inadimplência calculada pelo EVO (e não vinda da planilha). */
  inadimplenciaEvo?: boolean;
  /** Alunos ativos no fim do mês (reconstruídos do histórico de contratos do EVO). Base de ticket médio e adimplentes. */
  ativosFim?: number;
  /** Dos ativos no fim do mês, quantos estavam com o contrato trancado (suspenso) — EVO, campo freezes. */
  suspensosFim?: number;
  /** Cancelamentos do mês por gênero [fem, masc, outros] e por faixa de idade (as 8 do perfil): [ativos no início, cancelados]. */
  cancelPerfil?: { g: [number, number][]; i: [number, number][] };
  /** Saldo devedor em aberto no fim do mês (ou hoje): títulos "Balance due" do EVO não cancelados. */
  saldoDevedor?: SaldoDevedor;
  /** Alunos ativos no início do mês (base do churn). */
  ativosIni?: number;
  /** Conversão de cadastros calculada pelo EVO (cadastrados no mês que viraram cliente no mesmo mês). */
  icvEvo?: boolean;
  /** NPS do WeHelp: promotores, detratores e respostas do mês (somando as pesquisas Qrcode e Relacionamento). */
  npsPromotores?: number;
  npsDetratores?: number;
  npsRespostas?: number;
  /** NPS calculado a partir das respostas do WeHelp. */
  npsEvo?: boolean;
  /** Renovação: contratos de prazo fixo que vencem no mês e os que não foram renovados (EVO). */
  aVencer?: number;
  naoRenovados?: number;
  /** Contratos vencidos e não renovados no mês por tipo (Diárias, WG 30, WG Local...), do relatório do EVO. */
  naoRenovadosTipos?: Record<string, number>;
  /** Planos com mais contratos não renovados no mês, pelo nome no EVO: [nome, quantidade]. */
  naoRenovadosPlanos?: [string, number][];
  /** Não renovados de diária, free pass e experimental: contam na taxa, mas ficam fora da lista. */
  naoRenovadosFora?: number;
  /** Taxa de renovação calculada a partir dos contratos do EVO. */
  renovacoesEvo?: boolean;
  /** Fluxo de alunos no mês (EVO): entradas (novos e retornos) e saídas (cancelados e vencidos) que levam de ativosIni a ativosFim. */
  fluxoNovos?: number;
  fluxoRetornos?: number;
  fluxoCancelados?: number;
  fluxoVencidos?: number;
  /** Tempo médio, em meses, desde o primeiro contrato dos alunos ativos no fim do mês. */
  permanenciaMeses?: number;
  /** Alunos que cancelaram no mês, por motivo (categorias de texto → quantidade). */
  motivosCancel?: Record<string, number>;
  /** Alunos que cancelaram no mês pelo tipo do contrato cancelado (WG Local, WG 30, Promoções...). */
  canceladosTipos?: Record<string, number>;
  /** Planos com mais cancelamentos no mês, pelo nome no EVO: [nome, alunos]. */
  canceladosPlanos?: [string, number][];
  /** Origem das oportunidades do mês: [cadastradas, convertidas no mês] por origem (EVO). */
  origens?: Record<string, [number, number]>;
  /** Cobranças que falharam no vencimento (mês do vencimento): recuperadas e em aberto, com valores (EVO). */
  cobrancas?: Cobrancas;
  /** Motivo da última recusa do cartão nessas cobranças: total e ainda em aberto. */
  recusaMotivos?: Record<string, MotivoRecusa>;
  /** Treinos dos alunos ativos hoje (foto do EVO, só no mês corrente): ativo, vencido e com início no futuro. */
  treinoAtivo?: number;
  treinoVencido?: number;
  treinoFuturo?: number;
  /** Onde moram os alunos ativos hoje (foto do EVO, só no mês corrente): [bairro, cidade, alunos, lat, lng, 1 se a posição é só o centro da cidade]. `semBairro` = ativos sem endereço localizável. */
  bairros?: [string, string, number, number, number, number?][];
  semBairro?: number;
  /** Quem saiu nos últimos 12 meses (mesma foto e mesmo formato de `bairros`). */
  bairrosInativos?: [string, string, number, number, number, number?][];
  semBairroInativos?: number;
  /** Posição da unidade no mapa [lat, lng], do cadastro da filial no EVO. */
  local?: [number, number];
  /** Alunos ativos hoje por faixa do último acesso: até 7 dias, 8–14, 15–30, 31–60, mais de 60, nunca (foto do EVO, só no mês corrente). */
  acessos?: number[];
  /** Perfil dos alunos ativos hoje (foto do EVO, só no mês corrente): gênero [fem, masc, outros], 8 faixas de idade (até 17, 18–24, 25–34, 35–44, 45–54, 55–64, 65+, sem data) e estado civil. */
  perfil?: Perfil;
  /** Perfil das oportunidades cadastradas no mês: [cadastradas, convertidas no mês] por gênero e por faixa de idade. */
  perfilOport?: PerfilOport;
  /** Brinquedoteca (diária kids, brinquedoteca, mensalidades kids), das vendas do EVO. */
  kids?: number;
  /** WG Plus (contratos e itens com PLUS no nome), das vendas do EVO. */
  plus?: number;
  /** Pro+ (contratos e itens com PRO+ no nome), das vendas do EVO. */
  proMais?: number;
  /** Taxa de personal (valor dos contratos de personal vendidos) calculada a partir das vendas do EVO. */
  personalEvo?: boolean;
  /** Novos contratos, vendas online e receitas avulsas vindos das vendas do EVO. */
  vendasEvo?: boolean;
  /** Ticket médio e adimplentes calculados a partir dos ativos do EVO. */
  ativosEvo?: boolean;
  /** Mês em andamento: o que ainda vai vencer até o fim do mês + o já vencido (vem do EVO). */
  previsaoFaturamento?: number;
  /** Contratos ativos hoje (foto do EVO; só existe no mês corrente). */
  alunosAtivos?: number;
  contratosAtivos?: number;
  contratosEspeciais?: number;
  contratosPersonal?: number;
  /** Contratos por alcance do plano (accessBranches do EVO): 1 unidade / 2 a 9 / 10 ou mais. */
  contratosLocal?: number;
  contratosParcial?: number;
  contratosRede?: number;
  /** Planos mais vendidos no mês a alunos novos e rematrículas (sem diárias, brinquedoteca e personal): [plano, vendas, valor]. */
  contratosVendidos?: [string, number, number][];
  /** Os mesmos planos agrupados por família (WG Local, WG 30, WG Rede...), para comparar a rede: [família, vendas, valor]. */
  familiasVendidas?: [string, number, number][];
  /** Vendas de planos por tipo: [quantidade, valor] de matrículas novas, rematrículas e renovações. */
  tipoVenda?: TipoVenda;
  /** Duração dos planos vendidos a novos e rematrículas: mensal, trimestral, semestral, anual, outra. */
  duracaoVenda?: number[];
  /** Produtos e serviços avulsos mais vendidos no mês (pelo valor): [nome, quantidade, valor]. */
  produtosVendidos?: [string, number, number][];
  /** Multas, taxas, pró-rata e ajustes cobrados no mês fora de contrato (pelo valor): [nome, quantidade, valor]. */
  taxasCobradas?: [string, number, number][];
  /** Todas as cobranças avulsas do mês: [valor total, multas de cancelamento (quantidade), multas (valor)]. */
  taxasResumo?: number[];
  /** Entradas na catraca no mês por dia da semana × hora (7 × 24, domingo primeiro), entradas por dia do mês, total e pessoas diferentes. */
  calor?: number[];
  entradasDia?: number[];
  entradas?: number;
  frequentadores?: number;
  /** Liberações manuais na catraca no mês (a recepção libera quem a catraca barrou) e quantas por motivo do bloqueio anterior: [motivo, quantidade]. */
  liberacoes?: number;
  liberacoesMotivos?: [string, number][];
  /** Novos contratos em cada dia do mês (índice 0 = dia 1), pelo dia da venda no EVO. */
  vendasDia?: number[];
  /** Recebido no mês por forma de pagamento (nome → valor), pela data do pagamento. */
  formasPagamento?: Record<string, number>;
  /** Notas fiscais do mês (EVO): emitidas, ISS, canceladas/negadas, notas de pagamentos de outros meses e cobertura do recebido. */
  notas?: NotasMes;
  /** Recebido no mês em cartão (crédito e débito) por bandeira (Visa → valor). */
  bandeirasCartao?: Record<string, number>;
  /** Recebido no mês em cartão por gateway / adquirente (Stone → valor). */
  gatewaysCartao?: Record<string, number>;
}

export type TipoVenda = { novo: [number, number]; remat: [number, number]; renov: [number, number] };

export interface MonthData {
  month: string;
  units: UnitData[];
  total: UnitData;
}

export let dashboardData: MonthData[] = [];
/**
 * A rede inteira (com os nomes das unidades de outras pessoas escondidos pelo servidor). Só a Visão Executiva e o Benchmark usam.
 * Para dono e master é igual a `dashboardData`; para quem tem acesso só a algumas unidades, `dashboardData` traz só as
 * unidades dele (e o total é a soma delas), e aqui fica a rede, para o benchmark.
 */
export const dashboardDataRede: MonthData[] = [];
/** Quando o EVO foi consultado pela última vez pela rotina diária (ISO), ou null se o EVO não respondeu. */
export let evoAtualizadoEm: string | null = null;

function parseBR(s: string | undefined): number {
  if (!s || s.trim() === "") return 0;
  let cleaned = s.replace(/"/g, "").trim();
  // Strip BRL currency prefix (R$)
  cleaned = cleaned.replace(/^R\$\s*/, "");
  // Strip percent suffix — do NOT divide by 100 here; column context handles scaling
  cleaned = cleaned.replace(/%\s*$/, "").trim();
  // Brazilian number format: period = thousands separator, comma = decimal
  cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

function normalizeMonth(raw: string): string {
  // Normalize "yyyy-M" → "yyyy-MM" (Google Sheets sometimes omits leading zero)
  return raw.replace(/^(\d{4})-(\d)$/, "$1-0$2");
}

/** `soUnidades`: lê só as linhas dessas unidades (o TOTAL da planilha fica de fora e é refeito pela soma delas). */
export function parseCSV(csv: string, soUnidades?: string[]): MonthData[] {
  const lines = csv
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  // Parse header to build column index map
  const header = parseCSVLine(lines[0]).map((h) =>
    h.toLowerCase().trim().replace(/["""]/g, "")
  );

  const col = (name: string) => header.indexOf(name);
  const iMes = col("mês") !== -1 ? col("mês") : col("mes");
  const iUnidade = col("unidade");
  const iFaturamento = col("faturamento");
  const iRecebimento = col("recebimento");
  const iTicketMedio = col("ticket médio") !== -1 ? col("ticket médio") : col("ticket medio");
  const iNovosContratos = col("novos contratos");
  const iAdimplentes = col("adimplentes");
  const iInadimplentes = col("inadimplentes");
  const iInadimplenciaPerc = col("inadimplência %") !== -1 ? col("inadimplência %") : col("inadimplencia %");
  const iChurn = col("churn");
  const iRenovacoes = col("renovações") !== -1 ? col("renovações") : col("renovacoes");
  const iIcv = col("icv");
  const iVendasOnline = col("vendas online");
  const iCancelados = col("cancelados");
  const iDiarias = col("diárias") !== -1 ? col("diárias") : col("diarias");
  const iPersonal = col("taxa de personal");
  const iCamisetas = col("camisetas");
  const iCoqueteleiras = col("coqueteleiras");
  const iNotaGoogle = col("nota google");
  const iNps = col("nps");
  const iReclameAqui = col("reclame aqui");

  const monthMap = new Map<string, { units: UnitData[]; total: UnitData | null }>();

  // Linhas com o mês em branco (já aconteceu com a 1ª linha da planilha) herdam o mês
  // da linha anterior; se ainda não houve nenhuma, o da primeira linha que tiver mês.
  const firstMonth = lines
    .slice(1)
    .map((l) => normalizeMonth(parseCSVLine(l)[iMes]?.trim() ?? ""))
    .find(Boolean);
  let lastMonth = "";

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 3) continue;

    const month = normalizeMonth(cols[iMes]?.trim() ?? "") || lastMonth || firstMonth || "";
    const unit = cols[iUnidade]?.trim() ?? "";
    if (!month || !unit) continue;
    lastMonth = month;
    if (soUnidades && !soUnidades.includes(unit)) continue;

    const row: UnitData = {
      name: unit,
      faturamento: parseBR(cols[iFaturamento]),
      recebimento: parseBR(cols[iRecebimento]),
      ticketMedio: parseBR(cols[iTicketMedio]),
      novosContratos: parseBR(cols[iNovosContratos]),
      adimplentes: parseBR(cols[iAdimplentes]),
      inadimplentes: parseBR(cols[iInadimplentes]),
      inadimplenciaPerc: parseBR(cols[iInadimplenciaPerc]),
      churn: parseBR(cols[iChurn]),
      renovacoes: parseBR(cols[iRenovacoes]),
      icv: parseBR(cols[iIcv]),
      vendasOnline: parseBR(cols[iVendasOnline]),
      cancelados: parseBR(cols[iCancelados]),
      cac: 0,
      lifetime: 0,
      oportunidades: 0,
      conversoes: 0,
      diarias: iDiarias >= 0 ? parseBR(cols[iDiarias]) : 0,
      personal: iPersonal >= 0 ? parseBR(cols[iPersonal]) : 0,
      camisetas: iCamisetas >= 0 ? parseBR(cols[iCamisetas]) : 0,
      coqueteleiras: iCoqueteleiras >= 0 ? parseBR(cols[iCoqueteleiras]) : 0,
      notaGoogle: iNotaGoogle >= 0 ? parseBR(cols[iNotaGoogle]) : 0,
      nps: iNps >= 0 ? parseBR(cols[iNps]) : 0,
      reclameAqui: iReclameAqui >= 0 ? parseBR(cols[iReclameAqui]) : 0,
    };

    if (!monthMap.has(month)) {
      monthMap.set(month, { units: [], total: null });
    }
    const entry = monthMap.get(month)!;

    if (unit.toUpperCase() === "TOTAL") {
      entry.total = row;
    } else {
      entry.units.push(row);
    }
  }

  const result: MonthData[] = [];
  for (const [month, entry] of monthMap.entries()) {
    const units = entry.units;
    // If there is no TOTAL row, compute it from individual units.
    // If there IS a TOTAL row but it has zero for the newer metric columns
    // (which happens when the spreadsheet's SUM formula was not updated to
    // include those columns), fall back to computing each field from units
    // so the dashboard shows the correct totals instead of zeros.
    const csvTotal = entry.total;
    const computed = buildTotal(month, units);
    const total: UnitData = csvTotal
      ? {
          ...csvTotal,
          personal:      csvTotal.personal      || computed.personal,
          camisetas:     csvTotal.camisetas      || computed.camisetas,
          coqueteleiras: csvTotal.coqueteleiras  || computed.coqueteleiras,
          notaGoogle:    csvTotal.notaGoogle     || computed.notaGoogle,
          nps:           csvTotal.nps            || computed.nps,
        }
      : computed;
    result.push({ month, units, total });
  }

  result.sort((a, b) => a.month.localeCompare(b.month));
  return result;
}

function buildTotal(month: string, units: UnitData[]): UnitData {
  const sum = (key: keyof UnitData) =>
    units.reduce((s, u) => s + (u[key] as number), 0);
  const avg = (key: keyof UnitData) =>
    units.length ? sum(key) / units.length : 0;
  // Average only over units that have submitted a value (non-zero),
  // so units without data don't pull the average toward zero.
  const avgNonZero = (key: keyof UnitData) => {
    const nonZero = units.filter((u) => (u[key] as number) > 0);
    return nonZero.length
      ? nonZero.reduce((s, u) => s + (u[key] as number), 0) / nonZero.length
      : 0;
  };
  return {
    name: "TOTAL",
    faturamento: sum("faturamento"),
    recebimento: sum("recebimento"),
    ticketMedio: avg("ticketMedio"),
    novosContratos: sum("novosContratos"),
    adimplentes: sum("adimplentes"),
    inadimplentes: sum("inadimplentes"),
    inadimplenciaPerc: avg("inadimplenciaPerc"),
    churn: avg("churn"),
    renovacoes: avg("renovacoes"),
    icv: avg("icv"),
    vendasOnline: sum("vendasOnline"),
    cancelados: sum("cancelados"),
    cac: 0,
    lifetime: 0,
    oportunidades: 0,
    conversoes: 0,
    diarias: sum("diarias"),
    personal: sum("personal"),
    camisetas: sum("camisetas"),
    coqueteleiras: sum("coqueteleiras"),
    notaGoogle: avgNonZero("notaGoogle"),
    nps: avgNonZero("nps"),
    reclameAqui: 0,
  };
}

// Minimal CSV line parser supporting quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let j = i + 1;
      while (j < line.length && !(line[j] === '"' && line[j + 1] !== '"')) {
        if (line[j] === '"') j++; // skip escaped quote
        j++;
      }
      result.push(line.slice(i + 1, j).replace(/""/g, '"'));
      i = j + 1;
      if (line[i] === ",") i++;
    } else {
      const j = line.indexOf(",", i);
      if (j === -1) {
        result.push(line.slice(i));
        break;
      }
      result.push(line.slice(i, j));
      i = j + 1;
    }
  }
  return result;
}

export async function syncDashboardDataFromSheets(): Promise<{
  ok: boolean;
  count?: number;
  error?: string;
}> {
  try {
    const res = await authFetch(CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csv = await res.text();
    const evoMonths = await fetchEvoMonths();
    evoAtualizadoEm = evoMonths.map((m) => m.generatedAt ?? "").sort().pop() || null;
    const parsed = mergeEvo(parseCSV(csv), evoMonths);
    if (parsed.length === 0) throw new Error("Nenhum dado encontrado na planilha.");
    // Acesso só a algumas unidades: o conjunto de trabalho tem só elas (e o total é a soma delas); a rede fica à parte, para o benchmark.
    const proprias = unidadesProprias();
    const escopo = proprias
      ? mergeEvo(parseCSV(csv, proprias), evoMonths.map((m) => ({ ...m, units: m.units.filter((u) => proprias.includes(u.name)) })))
      : parsed;
    if (escopo.length === 0) throw new Error("Nenhum dado das suas unidades.");
    dashboardData.length = 0;
    dashboardData.push(...escopo);
    dashboardDataRede.length = 0;
    dashboardDataRede.push(...parsed);
    return { ok: true, count: parsed.length };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export interface EvoMonth {
  month: string;
  generatedAt?: string;
  units: ({ name: string; faturamento: number; recebimento: number } & Partial<Pick<UnitData, "previsaoFaturamento" | "ativosFim" | "suspensosFim" | "cancelPerfil" | "saldoDevedor" | "ativosIni" | "cancelados" | "aVencer" | "naoRenovados" | "naoRenovadosTipos" | "naoRenovadosPlanos" | "fluxoNovos" | "fluxoRetornos" | "fluxoCancelados" | "fluxoVencidos" | "permanenciaMeses" | "motivosCancel" | "canceladosTipos" | "canceladosPlanos" | "origens" | "cobrancas" | "recusaMotivos" | "treinoAtivo" | "treinoVencido" | "treinoFuturo" | "bairros" | "semBairro" | "bairrosInativos" | "semBairroInativos" | "local" | "acessos" | "perfil" | "perfilOport" | "oportunidades" | "conversoes" | "npsPromotores" | "npsDetratores" | "npsRespostas" | "novosContratos" | "vendasOnline" | "diarias" | "camisetas" | "coqueteleiras" | "personal" | "kids" | "plus" | "proMais" | "vendasEvo" | "ticketMedio" | "adimplentes" | "inadimplentes" | "inadimplenciaPerc" | "alunosAtivos" | "contratosAtivos" | "contratosEspeciais" | "contratosPersonal" | "contratosLocal" | "contratosParcial" | "contratosRede" | "contratosVendidos" | "familiasVendidas" | "tipoVenda" | "duracaoVenda" | "produtosVendidos" | "taxasCobradas" | "taxasResumo" | "calor" | "entradasDia" | "entradas" | "frequentadores" | "liberacoes" | "liberacoesMotivos" | "vendasDia" | "formasPagamento" | "notas" | "bandeirasCartao" | "gatewaysCartao">>)[];
}

function emptyUnit(name: string): UnitData {
  return {
    name, faturamento: 0, recebimento: 0, ticketMedio: 0, novosContratos: 0, adimplentes: 0, inadimplentes: 0,
    inadimplenciaPerc: 0, churn: 0, renovacoes: 0, icv: 0, vendasOnline: 0, cancelados: 0, cac: 0, lifetime: 0,
    oportunidades: 0, conversoes: 0, diarias: 0, personal: 0, camisetas: 0, coqueteleiras: 0, notaGoogle: 0, nps: 0,
    reclameAqui: 0,
  };
}

// Aplica o EVO sobre os dados da planilha: faturamento e recebimento das unidades vêm do EVO,
// e o TOTAL desses dois campos é refeito como soma das unidades. Mês ou unidade que o EVO tem e
// a planilha ainda não (ninguém precisa criar a linha à mão) é criado aqui, com os demais
// indicadores zerados até serem migrados do EVO.
/** Soma das receitas complementares de uma unidade (ou da rede): diárias, taxa de personal, kids, WG Plus, Pro+, camisetas e coqueteleiras. */
export const receitaComplementar = (u: Pick<UnitData, "diarias" | "personal" | "camisetas" | "coqueteleiras" | "kids" | "plus" | "proMais">) =>
  (u.diarias || 0) + (u.personal || 0) + (u.camisetas || 0) + (u.coqueteleiras || 0) + (u.kids || 0) + (u.plus || 0) + (u.proMais || 0);

/** Saldo de alunos ativos no mês (fim − início); undefined quando o EVO ainda não calculou o mês. */
export const saldoAlunos = (u: Pick<UnitData, "ativosIni" | "ativosFim">) =>
  u.ativosIni !== undefined && u.ativosFim !== undefined ? u.ativosFim - u.ativosIni : undefined;

/** LTV = ticket médio × permanência média (meses); 0 quando falta um dos dois. */
export const ltv = (u: Pick<UnitData, "ticketMedio" | "permanenciaMeses">) =>
  u.ticketMedio > 0 && (u.permanenciaMeses ?? 0) > 0 ? Math.round(u.ticketMedio * (u.permanenciaMeses ?? 0)) : 0;

/** Soma dos motivos de cancelamento de várias unidades. */
export function somarMotivos(us: Pick<UnitData, "motivosCancel">[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const u of us) for (const [k, n] of Object.entries(u.motivosCancel ?? {})) out[k] = (out[k] ?? 0) + n;
  return out;
}

export type Perfil = { g: number[]; i: number[]; c: Record<string, number> };
export type PerfilOport = { g: [number, number][]; i: [number, number][] };

/** Soma o perfil dos alunos de várias unidades. */
export function somarPerfil(us: Pick<UnitData, "perfil">[]): Perfil {
  const out: Perfil = { g: [0, 0, 0], i: Array(8).fill(0), c: {} };
  for (const u of us) {
    if (!u.perfil) continue;
    u.perfil.g.forEach((v, k) => { out.g[k] += v; });
    u.perfil.i.forEach((v, k) => { out.i[k] += v; });
    for (const [k, v] of Object.entries(u.perfil.c ?? {})) out.c[k] = (out.c[k] ?? 0) + v;
  }
  return out;
}

/** Soma o perfil das oportunidades de várias unidades. */
export function somarPerfilOport(us: Pick<UnitData, "perfilOport">[]): PerfilOport {
  const out: PerfilOport = { g: [[0, 0], [0, 0], [0, 0]], i: Array.from({ length: 8 }, () => [0, 0] as [number, number]) };
  for (const u of us) {
    if (!u.perfilOport) continue;
    u.perfilOport.g.forEach(([c, v], k) => { out.g[k][0] += c; out.g[k][1] += v; });
    u.perfilOport.i.forEach(([c, v], k) => { out.i[k][0] += c; out.i[k][1] += v; });
  }
  return out;
}

/** Junta rankings [nome, quantidade, valor] de várias unidades pelo nome (os 10 primeiros, por quantidade ou por valor). */
function juntarRanking(listas: ([string, number, number][] | undefined)[], porValor = false, limite = 10): [string, number, number][] {
  const por = new Map<string, [number, number]>();
  for (const l of listas) for (const [n, q, v] of l ?? []) { const a = por.get(n) ?? [0, 0]; por.set(n, [a[0] + q, a[1] + v]); }
  const k = porValor ? 2 : 1, k2 = porValor ? 1 : 2;
  return [...por].map(([n, [q, v]]) => [n, q, Math.round(v * 100) / 100] as [string, number, number]).sort((a, b) => b[k] - a[k] || b[k2] - a[k2]).slice(0, limite);
}

/** Junta os planos mais vendidos de várias unidades pelo nome do plano. */
export const somarContratosVendidos = (us: Pick<UnitData, "contratosVendidos">[]) => juntarRanking(us.map((u) => u.contratosVendidos));
/** Meses gravados antes do agrupamento: junta Pro+, WG Plus e as diárias (e a diária kids na Brinquedoteca) que vieram uma por nome. */
export function reagruparProdutos(lista: [string, number, number][]): [string, number, number][] {
  const m = new Map<string, [number, number]>();
  for (const [n, q, v] of lista) {
    const t = n.toUpperCase();
    const k = /KIDS|BRINQUEDOTECA/.test(t) && (/DI[AÁ]RIA|BRINQUEDOTECA/.test(t)) ? "Brinquedoteca"
      : /\bPRO ?\+/.test(t) ? "Pro+" : /\bPLUS\b/.test(t) ? "WG Plus" : /DI[AÁ]RIA/.test(t) ? "Diária" : n;
    const a = m.get(k) ?? [0, 0];
    m.set(k, [a[0] + q, Math.round((a[1] + v) * 100) / 100]);
  }
  return [...m].map(([n, [q, v]]) => [n, q, v] as [string, number, number]).sort((a, b) => b[2] - a[2] || b[1] - a[1]);
}
/** Junta os produtos e serviços mais vendidos de várias unidades (pelo valor). */
export const somarProdutosVendidos = (us: Pick<UnitData, "produtosVendidos">[]) => juntarRanking(us.map((u) => u.produtosVendidos), true);
/** Junta as famílias de plano vendidas de várias unidades (todas, sem corte). */
/** Free pass, experimental, promoção de 1º mês, parcerias e militares: contam nos planos vendidos, mas não aparecem na lista por tipo. */
export const CORTESIAS = "Cortesias e promoções";
/** Grupos antigos gravados nos meses já carregados → grupos atuais (WG PRO em WG Rede). */
const FAMILIA_ATUAL: Record<string, string> = { "Free pass": CORTESIAS, Experimental: CORTESIAS, "Promoção 1º mês": CORTESIAS, "Parcerias e militares": CORTESIAS, "WG PRO": "WG Rede" };
export function reagruparFamilias(fs: [string, number, number][]): [string, number, number][] {
  const m = new Map<string, [number, number]>();
  for (const [n, q, v] of fs) { const k = FAMILIA_ATUAL[n] ?? n; const a = m.get(k) ?? [0, 0]; m.set(k, [a[0] + q, Math.round((a[1] + v) * 100) / 100]); }
  return [...m].map(([n, [q, v]]) => [n, q, v] as [string, number, number]).sort((a, b) => b[1] - a[1] || b[2] - a[2]);
}
/**
 * Meses gravados antes do WG 90 entrar em WG 30: o WG 90 ficava fora dos tipos e era exatamente a diferença entre os planos
 * vendidos (novos + rematrículas) e a soma dos tipos. Essa diferença vai para WG 30; nos meses novos ela é zero.
 */
export function incluirWg90(fs: [string, number, number][], tv: TipoVenda | undefined): [string, number, number][] {
  if (!tv) return fs;
  const q = tv.novo[0] + tv.remat[0] - fs.reduce((n, [, x]) => n + x, 0);
  const v = Math.round((tv.novo[1] + tv.remat[1] - fs.reduce((n, [, , x]) => n + x, 0)) * 100) / 100;
  if (q <= 0) return fs;
  const out = fs.map((r) => [...r] as [string, number, number]);
  const wg30 = out.find(([n]) => n === "WG 30");
  if (wg30) { wg30[1] += q; wg30[2] = Math.round((wg30[2] + Math.max(0, v)) * 100) / 100; } else out.push(["WG 30", q, Math.max(0, v)]);
  return out.sort((a, b) => b[1] - a[1] || b[2] - a[2]);
}
export const somarFamiliasVendidas = (us: Pick<UnitData, "familiasVendidas">[]) => juntarRanking(us.map((u) => u.familiasVendidas), false, Infinity);
/** Junta as multas, taxas e ajustes cobrados de várias unidades (pelo valor). */
export const somarTaxasCobradas = (us: Pick<UnitData, "taxasCobradas">[]) => juntarRanking(us.map((u) => u.taxasCobradas), true);

/** Soma o tipo de venda e a duração dos planos vendidos de várias unidades. */
export function somarTipoVenda(us: Pick<UnitData, "tipoVenda">[]): TipoVenda {
  const out: TipoVenda = { novo: [0, 0], remat: [0, 0], renov: [0, 0] };
  for (const u of us) if (u.tipoVenda) for (const k of ["novo", "remat", "renov"] as const) { out[k][0] += u.tipoVenda[k][0]; out[k][1] += u.tipoVenda[k][1]; }
  return out;
}

/** Soma dia a dia as vendas por dia de várias unidades (só as que têm o dado; sem nenhuma, undefined). */
export function somarVendasDia(us: Pick<UnitData, "vendasDia">[]): number[] | undefined {
  const com = us.filter((u) => u.vendasDia?.length);
  if (!com.length) return undefined;
  const n = Math.max(...com.map((u) => u.vendasDia!.length));
  return Array.from({ length: n }, (_, d) => com.reduce((s, u) => s + (u.vendasDia![d] ?? 0), 0));
}

/** Soma o saldo devedor de várias unidades (só as que têm o dado; sem nenhuma, undefined). Pessoas somam por unidade. */
export function somarSaldoDevedor(us: Pick<UnitData, "saldoDevedor">[]): SaldoDevedor | undefined {
  const com = us.map((u) => u.saldoDevedor).filter((s): s is SaldoDevedor => !!s);
  if (!com.length) return undefined;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const par = (get: (s: SaldoDevedor) => [number, number] | undefined): [number, number] =>
    [r2(com.reduce((n, s) => n + (get(s)?.[0] ?? 0), 0)), com.reduce((n, s) => n + (get(s)?.[1] ?? 0), 0)];
  return {
    valor: r2(com.reduce((n, s) => n + s.valor, 0)),
    titulos: com.reduce((n, s) => n + s.titulos, 0),
    pessoas: com.reduce((n, s) => n + s.pessoas, 0),
    faixas: com[0].faixas.map((_, k) => par((s) => s.faixas[k])),
    ...(com.every((s) => s.ativos) ? { ativos: par((s) => s.ativos) } : {}),
  };
}

/** Soma o perfil dos cancelamentos de várias unidades (só as que têm o dado; sem nenhuma, undefined). */
export function somarCancelPerfil(us: Pick<UnitData, "cancelPerfil">[]): UnitData["cancelPerfil"] {
  const com = us.filter((u) => u.cancelPerfil);
  if (!com.length) return undefined;
  const soma = (k: "g" | "i") => com[0].cancelPerfil![k].map((_, j) => [0, 1].map((x) => com.reduce((n, u) => n + (u.cancelPerfil![k][j]?.[x] ?? 0), 0)) as [number, number]);
  return { g: soma("g"), i: soma("i") };
}

/** Soma as entradas na catraca de várias unidades (mapa de calor, por dia, total e pessoas). */
export function somarEntradas(us: Pick<UnitData, "calor" | "entradasDia" | "entradas" | "frequentadores" | "liberacoes" | "liberacoesMotivos">[]) {
  const comDados = us.filter((u) => u.calor);
  const dias = Math.max(0, ...comDados.map((u) => u.entradasDia?.length ?? 0));
  const comLib = comDados.filter((u) => u.liberacoes !== undefined);
  const motivos = new Map<string, number>();
  for (const u of comLib) for (const [m, n] of u.liberacoesMotivos ?? []) motivos.set(m, (motivos.get(m) ?? 0) + n);
  return {
    ...(comLib.length ? { liberacoes: comLib.reduce((n, u) => n + (u.liberacoes ?? 0), 0), liberacoesMotivos: [...motivos].sort((a, b) => b[1] - a[1]) } : {}),
    calor: Array.from({ length: 168 }, (_, k) => comDados.reduce((n, u) => n + (u.calor?.[k] ?? 0), 0)),
    entradasDia: Array.from({ length: dias }, (_, k) => comDados.reduce((n, u) => n + (u.entradasDia?.[k] ?? 0), 0)),
    entradas: comDados.reduce((n, u) => n + (u.entradas ?? 0), 0),
    frequentadores: comDados.reduce((n, u) => n + (u.frequentadores ?? 0), 0),
  };
}

/** Soma o recebido por forma de pagamento de várias unidades. */
/** Soma as notas fiscais das unidades que têm o dado. */
export function somarNotas(us: Pick<UnitData, "notas">[]): NotasMes {
  const com = us.map((u) => u.notas).filter((n): n is NotasMes => !!n);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const par = (k: "emitidas" | "outrosMeses" | "cobertura"): [number, number] => [r2(com.reduce((s, n) => s + n[k][0], 0)), r2(com.reduce((s, n) => s + n[k][1], 0))];
  return {
    emitidas: par("emitidas"), outrosMeses: par("outrosMeses"), cobertura: par("cobertura"),
    iss: r2(com.reduce((s, n) => s + n.iss, 0)),
    canceladas: com.reduce((s, n) => s + n.canceladas, 0),
    negadas: com.reduce((s, n) => s + n.negadas, 0),
  };
}

export function somarFormas(us: Pick<UnitData, "formasPagamento">[]): Record<string, number> {
  return somarMapas(us.map((u) => u.formasPagamento));
}

const BANDEIRAS: [RegExp, string][] = [
  [/^visa/i, "Visa"], [/^master/i, "Mastercard"], [/^elo$/i, "Elo"], [/^(amex|american)/i, "Amex"], [/^hiper/i, "Hipercard"],
  [/^diners/i, "Diners"], [/^credz/i, "Credz"], [/^outras/i, "Outras bandeiras"],
];
/** Mesma bandeira escrita de jeitos diferentes no EVO (VISA, VISA ELETRON, AmericanExpress...) vira um nome só. */
export function nomeBandeira(n: string): string {
  return BANDEIRAS.find(([re]) => re.test(n.trim()))?.[1] ?? n;
}
/** Gateway (adquirente) com nome único; quando o EVO gravou uma bandeira no campo, vira "Não identificado". */
export function nomeGateway(n: string): string {
  const t = n.trim();
  if (/^rede(card)?$/i.test(t)) return "Rede";
  if (/^(stone|cielo|getnet|pagseguro)$/i.test(t)) return t[0].toUpperCase() + t.slice(1).toLowerCase().replace("seguro", "Seguro");
  if (/^outros$/i.test(t) || BANDEIRAS.some(([re]) => re.test(t))) return "Não identificado";
  return t;
}
export function normalizarNomes(m: Record<string, number>, f: (n: string) => string): Record<string, number> {
  return somarMapas(Object.entries(m).map(([k, v]) => ({ [f(k)]: v })));
}

/** Soma mapas nome → valor (formas de pagamento, bandeiras) de várias unidades. */
export function somarMapas(ms: (Record<string, number> | undefined)[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of ms) for (const [k, v] of Object.entries(m ?? {})) out[k] = Math.round(((out[k] ?? 0) + v) * 100) / 100;
  return out;
}

/** Soma as origens das oportunidades de várias unidades. */
export function somarOrigens(us: Pick<UnitData, "origens">[]): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {};
  for (const u of us) for (const [k, [c, v]] of Object.entries(u.origens ?? {})) { const o = (out[k] ??= [0, 0]); o[0] += c; o[1] += v; }
  return out;
}

export function somarCobrancas(us: Pick<UnitData, "cobrancas">[]): Cobrancas {
  const z: Cobrancas = { falhas: 0, recuperadas: 0, abertas: 0, valorAberto: 0, valorRecuperado: 0 };
  for (const u of us) if (u.cobrancas) {
    z.falhas += u.cobrancas.falhas; z.recuperadas += u.cobrancas.recuperadas; z.abertas += u.cobrancas.abertas;
    z.valorAberto += u.cobrancas.valorAberto; z.valorRecuperado += u.cobrancas.valorRecuperado;
  }
  z.valorAberto = Math.round(z.valorAberto * 100) / 100; z.valorRecuperado = Math.round(z.valorRecuperado * 100) / 100;
  return z;
}

export function somarRecusa(us: Pick<UnitData, "recusaMotivos">[]): Record<string, MotivoRecusa> {
  const out: Record<string, MotivoRecusa> = {};
  for (const u of us) for (const [k, m] of Object.entries(u.recusaMotivos ?? {})) {
    const o = (out[k] ??= { n: 0, abertas: 0, valorAberto: 0 });
    o.n += m.n; o.abertas += m.abertas; o.valorAberto = Math.round((o.valorAberto + m.valorAberto) * 100) / 100;
  }
  return out;
}

/** NPS em pontos (−100 a 100) com duas casas; 0 quando não há respostas. */
export const calcularNps = (promotores: number, detratores: number, respostas: number) =>
  respostas > 0 ? Math.round(((promotores - detratores) / respostas) * 10000) / 100 : 0;

/** Conversão de cadastros em % com uma casa; 0 quando não houve cadastros. */
export const taxaConversao = (oportunidades: number, conversoes: number) =>
  oportunidades > 0 ? Math.round((conversoes / oportunidades) * 1000) / 10 : 0;

/** Taxa de renovação em % com uma casa; 0 quando não há contratos a vencer. */
/** Diária, free pass e experimental: entram na taxa de renovação (como no EVO), mas não aparecem na lista de não renovados. */
export const FORA_DA_LISTA = ["Diárias", "Free pass e experimental"];
const FORA_RE = /DI[AÁ]RIA|FREE ?PASS|EXPERIMENTAL/i;
/**
 * Tira da lista de contratos não renovados a diária, o free pass e o experimental, guardando quantos foram (naoRenovadosFora).
 * Vencidos, não renovados e a taxa continuam os do EVO. Detalhe gravado antes da separação (free pass dentro de
 * "Cortesias e promoções") fica como veio.
 */
export function listaSemDiarias(u: Pick<UnitData, "naoRenovadosTipos" | "naoRenovadosPlanos">) {
  const t = u.naoRenovadosTipos;
  if (!t || "Cortesias e promoções" in t) return {};
  return {
    naoRenovadosFora: FORA_DA_LISTA.reduce((n, k) => n + (t[k] ?? 0), 0),
    naoRenovadosTipos: Object.fromEntries(Object.entries(t).filter(([k]) => !FORA_DA_LISTA.includes(k))),
    naoRenovadosPlanos: (u.naoRenovadosPlanos ?? []).filter(([n]) => !FORA_RE.test(n)),
  };
}

export const taxaRenovacao = (aVencer: number, naoRenovados: number) =>
  aVencer > 0 ? Math.round(((Math.max(0, aVencer - naoRenovados)) / aVencer) * 1000) / 10 : 0;

export function mergeEvo(data: MonthData[], evoMonths: EvoMonth[]): MonthData[] {
  for (const evo of evoMonths) {
    if (evo.units.length === 0) continue;
    let md = data.find((m) => m.month === evo.month);
    if (!md) {
      md = { month: evo.month, units: [], total: buildTotal(evo.month, []) };
      data.push(md);
    }
    for (const e of evo.units) {
      let unit = md.units.find((u) => u.name === e.name);
      // Unidade que ainda não operava no EVO naquele mês (sem faturamento nem recebimento lá) e tem números na
      // planilha: fica com a planilha, em vez de virar zero (meses antigos, antes da migração da unidade).
      if (unit && unit.faturamento > 0 && !e.faturamento && !e.recebimento) continue;
      if (!unit) {
        unit = emptyUnit(e.name);
        md.units.push(unit);
      }
      unit.faturamento = e.faturamento;
      unit.recebimento = e.recebimento;
      unit.previsaoFaturamento = e.previsaoFaturamento;
      // Etapa 2: inadimplência vem do EVO quando o mês já foi calculado com ela (bateu com a planilha em
      // 0,2 p.p. de diferença mediana).
      if (e.inadimplentes !== undefined) {
        unit.inadimplentes = e.inadimplentes;
        unit.inadimplenciaEvo = true;
        unit.inadimplenciaPerc = e.inadimplenciaPerc ?? unit.inadimplenciaPerc;
      }
      // Ticket médio = recebimento ÷ alunos ativos no fim do mês; adimplentes = ativos - inadimplentes.
      if (e.ativosFim !== undefined && e.ativosFim > 0) {
        unit.ativosFim = e.ativosFim;
        unit.ativosEvo = true;
        if (e.suspensosFim !== undefined) unit.suspensosFim = e.suspensosFim;
        if (e.saldoDevedor !== undefined) unit.saldoDevedor = e.saldoDevedor;
        unit.adimplentes = Math.max(0, e.ativosFim - unit.inadimplentes);
        // No mês em andamento o recebimento é parcial, e o ticket também (o card mostra quanto do mês anterior já foi alcançado).
        unit.ticketMedio = Math.round((unit.recebimento / e.ativosFim) * 100) / 100;
      }
      // Etapas 3 e 4: cancelados e churn (histórico de contratos) e vendas (novos contratos, online, avulsas).
      if (e.cancelados !== undefined && e.ativosIni !== undefined) {
        unit.cancelados = e.cancelados;
        unit.ativosIni = e.ativosIni;
        unit.churn = e.ativosIni > 0 ? Math.round((e.cancelados / e.ativosIni) * 1000) / 10 : 0;
        if (e.cancelPerfil !== undefined) unit.cancelPerfil = e.cancelPerfil;
      }
      // Renovação = (a vencer − não renovados) ÷ a vencer; só contratos de prazo fixo (os recorrentes se renovam sozinhos).
      if (e.aVencer !== undefined && e.naoRenovados !== undefined) {
        unit.aVencer = e.aVencer;
        unit.naoRenovados = e.naoRenovados;
        if (e.naoRenovadosTipos) unit.naoRenovadosTipos = e.naoRenovadosTipos;
        if (e.naoRenovadosPlanos) unit.naoRenovadosPlanos = e.naoRenovadosPlanos;
        unit.renovacoesEvo = true;
        unit.renovacoes = taxaRenovacao(e.aVencer, e.naoRenovados);
        Object.assign(unit, listaSemDiarias(unit));
      }
      // Fluxo de alunos, permanência e motivos de cancelamento (EVO).
      if (e.fluxoNovos !== undefined) {
        unit.fluxoNovos = e.fluxoNovos;
        unit.fluxoRetornos = e.fluxoRetornos ?? 0;
        unit.fluxoCancelados = e.fluxoCancelados ?? 0;
        unit.fluxoVencidos = e.fluxoVencidos ?? 0;
        unit.permanenciaMeses = e.permanenciaMeses ?? 0;
      }
      if (e.motivosCancel !== undefined) unit.motivosCancel = e.motivosCancel;
      if (e.canceladosTipos) unit.canceladosTipos = e.canceladosTipos;
      if (e.canceladosPlanos) unit.canceladosPlanos = e.canceladosPlanos;
      // Origem das oportunidades, cobranças com falha e treinos (EVO).
      if (e.origens !== undefined) unit.origens = e.origens;
      if (e.cobrancas !== undefined) { unit.cobrancas = e.cobrancas; unit.recusaMotivos = e.recusaMotivos ?? {}; }
      if (e.acessos !== undefined) unit.acessos = e.acessos;
      if (e.perfil !== undefined) unit.perfil = e.perfil;
      if (e.perfilOport !== undefined) unit.perfilOport = e.perfilOport;
      if (e.contratosVendidos !== undefined) { unit.contratosVendidos = e.contratosVendidos; unit.familiasVendidas = e.familiasVendidas && incluirWg90(reagruparFamilias(e.familiasVendidas), e.tipoVenda); unit.tipoVenda = e.tipoVenda; unit.duracaoVenda = e.duracaoVenda; }
      if (e.produtosVendidos !== undefined) { unit.produtosVendidos = reagruparProdutos(e.produtosVendidos); unit.taxasCobradas = e.taxasCobradas; unit.taxasResumo = e.taxasResumo; }
      if (e.formasPagamento !== undefined) unit.formasPagamento = e.formasPagamento;
      if (e.notas !== undefined) unit.notas = e.notas;
      if (e.bandeirasCartao !== undefined) unit.bandeirasCartao = normalizarNomes(e.bandeirasCartao, nomeBandeira);
      if (e.gatewaysCartao !== undefined) unit.gatewaysCartao = normalizarNomes(e.gatewaysCartao, nomeGateway);
      if (e.calor !== undefined) { unit.calor = e.calor; unit.entradasDia = e.entradasDia ?? []; unit.entradas = e.entradas ?? 0; unit.frequentadores = e.frequentadores ?? 0; if (e.liberacoes !== undefined) { unit.liberacoes = e.liberacoes; unit.liberacoesMotivos = e.liberacoesMotivos ?? []; } }
      if (e.bairros !== undefined) { unit.bairros = e.bairros; unit.semBairro = e.semBairro ?? 0; if (e.local) unit.local = e.local; }
      if (e.bairrosInativos !== undefined) { unit.bairrosInativos = e.bairrosInativos; unit.semBairroInativos = e.semBairroInativos ?? 0; }
      if (e.treinoAtivo !== undefined) { unit.treinoAtivo = e.treinoAtivo; unit.treinoVencido = e.treinoVencido ?? 0; unit.treinoFuturo = e.treinoFuturo ?? 0; }
      // Conversão = convertidos no mês ÷ cadastrados no mês (relatório de prospects do EVO).
      if (e.oportunidades !== undefined && e.conversoes !== undefined) {
        unit.oportunidades = e.oportunidades;
        unit.conversoes = e.conversoes;
        unit.icvEvo = true;
        unit.icv = taxaConversao(e.oportunidades, e.conversoes);
      }
      // NPS vem do WeHelp quando o mês tem respostas: (promotores − detratores) ÷ respostas.
      if (e.npsRespostas !== undefined && e.npsRespostas > 0) {
        unit.npsPromotores = e.npsPromotores ?? 0;
        unit.npsDetratores = e.npsDetratores ?? 0;
        unit.npsRespostas = e.npsRespostas;
        unit.npsEvo = true;
        unit.nps = calcularNps(unit.npsPromotores, unit.npsDetratores, e.npsRespostas);
      }
      if (e.novosContratos !== undefined) {
        unit.vendasEvo = true;
        unit.novosContratos = e.novosContratos;
        unit.vendasOnline = e.vendasOnline ?? 0;
        unit.diarias = e.diarias ?? 0;
        unit.camisetas = e.camisetas ?? 0;
        unit.coqueteleiras = e.coqueteleiras ?? 0;
        if (e.kids !== undefined) unit.kids = e.kids;
        if (e.plus !== undefined) unit.plus = e.plus;
        if (e.proMais !== undefined) unit.proMais = e.proMais;
        if (e.personal !== undefined) { unit.personal = e.personal; unit.personalEvo = true; }
        if (e.vendasDia !== undefined) unit.vendasDia = e.vendasDia;
      }
      if (e.alunosAtivos !== undefined) {
        unit.alunosAtivos = e.alunosAtivos;
        unit.contratosAtivos = e.contratosAtivos;
        unit.contratosEspeciais = e.contratosEspeciais;
        unit.contratosPersonal = e.contratosPersonal;
        unit.contratosLocal = e.contratosLocal;
        unit.contratosParcial = e.contratosParcial;
        unit.contratosRede = e.contratosRede;
      }
    }
    md.total = {
      ...md.total,
      faturamento: md.units.reduce((s, u) => s + u.faturamento, 0),
      recebimento: md.units.reduce((s, u) => s + u.recebimento, 0),
      ...(evo.units.some((e) => e.previsaoFaturamento !== undefined)
        ? { previsaoFaturamento: md.units.reduce((s, u) => s + (u.previsaoFaturamento ?? u.faturamento), 0) }
        : {}),
      ...(evo.units.some((e) => e.cancelados !== undefined && e.ativosIni !== undefined)
        ? (() => {
            const us = md.units.filter((u) => u.ativosIni !== undefined);
            const ini = us.reduce((s, u) => s + (u.ativosIni ?? 0), 0);
            const canc = us.reduce((s, u) => s + u.cancelados, 0);
            const cp = somarCancelPerfil(md.units);
            return { cancelados: md.units.reduce((s, u) => s + u.cancelados, 0), ativosIni: ini, churn: ini > 0 ? Math.round((canc / ini) * 1000) / 10 : 0, ...(cp ? { cancelPerfil: cp } : {}) };
          })()
        : {}),
      ...(evo.units.some((e) => e.aVencer !== undefined && e.naoRenovados !== undefined)
        ? (() => {
            const us = md.units.filter((u) => u.renovacoesEvo);
            return {
              aVencer: us.reduce((n, u) => n + (u.aVencer ?? 0), 0),
              naoRenovados: us.reduce((n, u) => n + (u.naoRenovados ?? 0), 0),
              ...(us.some((u) => u.naoRenovadosTipos) ? { naoRenovadosTipos: somarMapas(us.map((u) => u.naoRenovadosTipos)), naoRenovadosFora: us.reduce((n, u) => n + (u.naoRenovadosFora ?? 0), 0) } : {}),
              renovacoes: taxaRenovacao(us.reduce((n, u) => n + (u.aVencer ?? 0), 0), us.reduce((n, u) => n + (u.naoRenovados ?? 0), 0)),
              renovacoesEvo: true,
            };
          })()
        : {}),
      ...(md.units.some((u) => u.fluxoNovos !== undefined)
        ? (() => {
            const us = md.units.filter((u) => u.fluxoNovos !== undefined);
            const soma = (f: (u: UnitData) => number) => us.reduce((n, u) => n + f(u), 0);
            const ativos = soma((u) => u.ativosFim ?? 0);
            return {
              fluxoNovos: soma((u) => u.fluxoNovos ?? 0), fluxoRetornos: soma((u) => u.fluxoRetornos ?? 0),
              fluxoCancelados: soma((u) => u.fluxoCancelados ?? 0), fluxoVencidos: soma((u) => u.fluxoVencidos ?? 0),
              // média ponderada pelos alunos ativos de cada unidade
              permanenciaMeses: ativos ? Math.round((soma((u) => (u.permanenciaMeses ?? 0) * (u.ativosFim ?? 0)) / ativos) * 10) / 10 : 0,
            };
          })()
        : {}),
      ...(md.units.some((u) => u.motivosCancel !== undefined) ? { motivosCancel: somarMotivos(md.units) } : {}),
      ...(md.units.some((u) => u.canceladosTipos) ? { canceladosTipos: somarMapas(md.units.map((u) => u.canceladosTipos)) } : {}),
      ...(md.units.some((u) => u.origens !== undefined) ? { origens: somarOrigens(md.units) } : {}),
      ...(md.units.some((u) => u.cobrancas !== undefined) ? { cobrancas: somarCobrancas(md.units), recusaMotivos: somarRecusa(md.units) } : {}),
      ...(md.units.some((u) => u.acessos !== undefined)
        ? { acessos: [0, 1, 2, 3, 4, 5].map((i) => md.units.reduce((n, u) => n + (u.acessos?.[i] ?? 0), 0)) }
        : {}),
      ...(md.units.some((u) => u.perfil !== undefined) ? { perfil: somarPerfil(md.units) } : {}),
      ...(md.units.some((u) => u.perfilOport !== undefined) ? { perfilOport: somarPerfilOport(md.units) } : {}),
      ...(md.units.some((u) => u.contratosVendidos !== undefined)
        ? { contratosVendidos: somarContratosVendidos(md.units), ...(md.units.some((u) => u.familiasVendidas) ? { familiasVendidas: somarFamiliasVendidas(md.units) } : {}), tipoVenda: somarTipoVenda(md.units), duracaoVenda: [0, 1, 2, 3, 4].map((i) => md.units.reduce((n, u) => n + (u.duracaoVenda?.[i] ?? 0), 0)) }
        : {}),
      ...(md.units.some((u) => u.produtosVendidos !== undefined) ? { produtosVendidos: somarProdutosVendidos(md.units), ...(md.units.some((u) => u.taxasCobradas) ? { taxasCobradas: somarTaxasCobradas(md.units), taxasResumo: [0, 1, 2].map((i) => Math.round(md.units.reduce((n, u) => n + (u.taxasResumo?.[i] ?? 0), 0) * 100) / 100) } : {}) } : {}),
      ...(md.units.some((u) => u.calor !== undefined) ? somarEntradas(md.units) : {}),
      ...(md.units.some((u) => u.formasPagamento !== undefined) ? { formasPagamento: somarFormas(md.units) } : {}),
      ...(md.units.some((u) => u.notas !== undefined) ? { notas: somarNotas(md.units) } : {}),
      ...(md.units.some((u) => u.bandeirasCartao !== undefined) ? { bandeirasCartao: somarMapas(md.units.map((u) => u.bandeirasCartao)) } : {}),
      ...(md.units.some((u) => u.gatewaysCartao !== undefined) ? { gatewaysCartao: somarMapas(md.units.map((u) => u.gatewaysCartao)) } : {}),
      ...(md.units.some((u) => u.treinoAtivo !== undefined)
        ? { treinoAtivo: md.units.reduce((n, u) => n + (u.treinoAtivo ?? 0), 0), treinoVencido: md.units.reduce((n, u) => n + (u.treinoVencido ?? 0), 0), treinoFuturo: md.units.reduce((n, u) => n + (u.treinoFuturo ?? 0), 0) }
        : {}),
      ...(md.units.some((u) => u.icvEvo)
        ? (() => {
            const us = md.units.filter((u) => u.icvEvo);
            const o = us.reduce((n, u) => n + u.oportunidades, 0);
            const c = us.reduce((n, u) => n + u.conversoes, 0);
            return { oportunidades: o, conversoes: c, icv: taxaConversao(o, c), icvEvo: true };
          })()
        : {}),
      ...(md.units.some((u) => u.npsEvo)
        ? (() => {
            const us = md.units.filter((u) => u.npsEvo);
            const p = us.reduce((n, u) => n + (u.npsPromotores ?? 0), 0);
            const d = us.reduce((n, u) => n + (u.npsDetratores ?? 0), 0);
            const r = us.reduce((n, u) => n + (u.npsRespostas ?? 0), 0);
            return { nps: calcularNps(p, d, r), npsRespostas: r, npsEvo: true };
          })()
        : {}),
      ...(evo.units.some((e) => e.novosContratos !== undefined)
        ? (() => {
            const t = buildTotal(evo.month, md.units);
            const vd = somarVendasDia(md.units);
            return { novosContratos: t.novosContratos, vendasOnline: t.vendasOnline, diarias: t.diarias, camisetas: t.camisetas, coqueteleiras: t.coqueteleiras, kids: md.units.reduce((n, u) => n + (u.kids ?? 0), 0), plus: md.units.reduce((n, u) => n + (u.plus ?? 0), 0), proMais: md.units.reduce((n, u) => n + (u.proMais ?? 0), 0), vendasEvo: true, ...(md.units.some((u) => u.personalEvo) ? { personal: t.personal, personalEvo: true } : {}), ...(vd ? { vendasDia: vd } : {}) };
          })()
        : {}),
      ...(evo.units.some((e) => e.ativosFim)
        ? (() => {
            const comAtivos = md.units.filter((u) => u.ativosEvo);
            const sd = somarSaldoDevedor(md.units);
            const ativos = comAtivos.reduce((s, u) => s + (u.ativosFim ?? 0), 0);
            const rec = comAtivos.reduce((s, u) => s + u.recebimento, 0);
            return {
              adimplentes: md.units.reduce((s, u) => s + u.adimplentes, 0),
              ativosFim: ativos,
              ativosEvo: true,
              ...(comAtivos.some((u) => u.suspensosFim !== undefined) ? { suspensosFim: comAtivos.reduce((s, u) => s + (u.suspensosFim ?? 0), 0) } : {}),
              ...(sd ? { saldoDevedor: sd } : {}),
              ...(ativos ? { ticketMedio: Math.round((rec / ativos) * 100) / 100 } : {}),
            };
          })()
        : {}),
      ...(evo.units.some((e) => e.inadimplentes !== undefined)
        ? (() => {
            const t = buildTotal(evo.month, md.units);
            return { inadimplentes: t.inadimplentes, inadimplenciaPerc: t.inadimplenciaPerc, inadimplenciaEvo: true };
          })()
        : {}),
    };
  }
  data.sort((a, b) => a.month.localeCompare(b.month));
  return data;
}

async function fetchEvoMonths(): Promise<EvoMonth[]> {
  try {
    // Uma consulta só com todos os meses; se a rota nova não responder, cai para uma consulta por mês.
    const tudo = await authFetch(`${EVO_URL}?all=1`);
    if (tudo.ok) {
      const { months } = (await tudo.json()) as { months: unknown };
      if (Array.isArray(months) && months.every((m) => typeof m === "object" && m !== null)) return months as EvoMonth[];
    }
    const list = await authFetch(EVO_URL);
    if (!list.ok) return [];
    const { months } = (await list.json()) as { months: string[] };
    const all = await Promise.all(
      months.map(async (m) => {
        const r = await authFetch(`${EVO_URL}?month=${m}`);
        return r.ok ? ((await r.json()) as EvoMonth) : null;
      })
    );
    return all.filter((x): x is EvoMonth => x !== null);
  } catch {
    return []; // EVO fora do ar: o dashboard segue com os números da planilha
  }
}

export function getLatestData(): MonthData {
  return dashboardData[dashboardData.length - 1] ?? { month: "", units: [], total: buildTotal("", []) };
}

export function getDataByMonth(month: string): MonthData | undefined {
  return dashboardData.find((d) => d.month === month);
}

export function getDataByMonthRede(month: string): MonthData | undefined {
  return dashboardDataRede.find((d) => d.month === month);
}

export function getUnitData(month: string, unit: string): UnitData | undefined {
  const m = getDataByMonth(month);
  return m?.units.find((u) => u.name === unit);
}

export function getAvailableMonths(): string[] {
  return dashboardData.map((d) => d.month);
}

export function getAvailableUnits(): string[] {
  const unitSet = new Set<string>();
  for (const m of dashboardData) {
    for (const u of m.units) unitSet.add(u.name);
  }
  return Array.from(unitSet).sort();
}

export function getLast12MonthsAverage() {
  const last12 = dashboardData.slice(-12);
  if (!last12.length) return null;
  const avg = (key: keyof UnitData) =>
    last12.reduce((s, m) => s + (m.total[key] as number), 0) / last12.length;
  return {
    faturamento: avg("faturamento"),
    churn: avg("churn"),
    renovacoes: avg("renovacoes"),
    inadimplenciaPerc: avg("inadimplenciaPerc"),
    icv: avg("icv"),
  };
}

function diffPercent(v1: number, v2: number): number {
  if (v2 === 0) return 0;
  return ((v1 - v2) / Math.abs(v2)) * 100;
}

export function comparePeriods(
  month1: string,
  month2: string,
  unit?: string | null
) {
  const d1 = unit ? getUnitData(month1, unit) : getDataByMonth(month1)?.total;
  const d2 = unit ? getUnitData(month2, unit) : getDataByMonth(month2)?.total;
  if (!d1 || !d2) return null;

  const nc1 = unit
    ? d1.novosContratos
    : (getDataByMonth(month1)?.units.reduce((s, u) => s + u.novosContratos, 0) ?? 0);
  const nc2 = unit
    ? d2.novosContratos
    : (getDataByMonth(month2)?.units.reduce((s, u) => s + u.novosContratos, 0) ?? 0);

  return {
    month1,
    month2,
    faturamento: { month1: d1.faturamento, month2: d2.faturamento, diff: diffPercent(d1.faturamento, d2.faturamento) },
    ticketMedio: { month1: d1.ticketMedio, month2: d2.ticketMedio, diff: diffPercent(d1.ticketMedio, d2.ticketMedio) },
    adimplentes: { month1: d1.adimplentes, month2: d2.adimplentes, diff: diffPercent(d1.adimplentes, d2.adimplentes) },
    churn: { month1: d1.churn, month2: d2.churn, diff: d1.churn - d2.churn },
    icv: { month1: d1.icv, month2: d2.icv, diff: d1.icv - d2.icv },
    vendasOnline: { month1: d1.vendasOnline, month2: d2.vendasOnline, diff: diffPercent(d1.vendasOnline, d2.vendasOnline) },
    novosContratos: { month1: nc1, month2: nc2, diff: diffPercent(nc1, nc2) },
    saldoClientes: { month1: nc1 - d1.cancelados, month2: nc2 - d2.cancelados, diff: diffPercent(nc1 - d1.cancelados, nc2 - d2.cancelados) },
    inadimplenciaPerc: { month1: d1.inadimplenciaPerc, month2: d2.inadimplenciaPerc, diff: d1.inadimplenciaPerc - d2.inadimplenciaPerc },
    renovacoes: { month1: d1.renovacoes, month2: d2.renovacoes, diff: d1.renovacoes - d2.renovacoes },
  };
}
