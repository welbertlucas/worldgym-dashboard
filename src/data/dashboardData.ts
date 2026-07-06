const SHEET_ID = "1TGh4MEDDbuRgJMkfYltP6II2s42z7L2Gv6RV7X9K1kg";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;

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
}

export interface MonthData {
  month: string;
  units: UnitData[];
  total: UnitData;
}

export let dashboardData: MonthData[] = [];

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

function parseCSV(csv: string): MonthData[] {
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

  const monthMap = new Map<string, { units: UnitData[]; total: UnitData | null }>();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 3) continue;

    const month = normalizeMonth(cols[iMes]?.trim() ?? "");
    const unit = cols[iUnidade]?.trim() ?? "";
    if (!month || !unit) continue;

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
    const total = entry.total ?? buildTotal(month, units);
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
    notaGoogle: avg("notaGoogle"),
    nps: avg("nps"),
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
    const res = await fetch(CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csv = await res.text();
    const parsed = parseCSV(csv);
    if (parsed.length === 0) throw new Error("Nenhum dado encontrado na planilha.");
    dashboardData.length = 0;
    dashboardData.push(...parsed);
    return { ok: true, count: parsed.length };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export function getLatestData(): MonthData {
  return dashboardData[dashboardData.length - 1] ?? { month: "", units: [], total: buildTotal("", []) };
}

export function getDataByMonth(month: string): MonthData | undefined {
  return dashboardData.find((d) => d.month === month);
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
