import type { ModeloRoyalties } from "@/data/royalties";

/** Modelo pequeno e fictício (nenhum número real): A e B pagam taxa fixa, C e D pagam royalties; abr/26 é parcial. */
export const MODELO: ModeloRoyalties = {
  meses: [{ key: "2026-01", label: "jan/26" }, { key: "2026-02", label: "fev/26" }, { key: "2026-03", label: "mar/26" }, { key: "2026-04", label: "abr/26" }],
  unidades: [{ nome: "Alfa", tipo: "fixa" }, { nome: "Beta", tipo: "fixa" }, { nome: "Gama", tipo: "royalties" }, { nome: "Delta", tipo: "royalties" }, { nome: "Sigma", tipo: "fixa" }],
  recebido: {
    Alfa: { "2026-01": 100, "2026-02": 100, "2026-03": 0, "2026-04": 0 },
    Beta: { "2026-01": 50, "2026-02": 50, "2026-03": 50, "2026-04": 50 },
    Gama: { "2026-01": 10, "2026-02": 20, "2026-03": 30, "2026-04": 5 },
    Delta: { "2026-01": 1, "2026-02": 1, "2026-03": 1, "2026-04": 1 },
    Sigma: { "2026-01": 7, "2026-02": 0, "2026-03": 0, "2026-04": 0 },
  },
  naoMapeado: { porMes: { "2026-01": 3, "2026-02": 0, "2026-03": 0, "2026-04": 0 }, itens: [{ mes: "2026-01" }] },
  pendencias: {
    apuracao: "2026-04", dia: 10,
    linhas: [
      { unidade: "Alfa", variavel: false, valorMensal: 100, inicio: "2026-01", vencimento: 10, devido: 400, recebido: 200, saldoApuracao: 150, dividaAnterior: 50, saldoTotal: 200, mesesSemRecebimento: ["2026-03", "2026-04"], obs: "Acordo em duas parcelas." },
      { unidade: "Beta", variavel: false, valorMensal: 50, inicio: "2026-01", vencimento: 10, devido: 200, recebido: 200, saldoApuracao: 0, dividaAnterior: 0, saldoTotal: 0, mesesSemRecebimento: [], obs: "" },
      { unidade: "Gama", variavel: true, valorMensal: null, inicio: "2026-01", vencimento: 10, devido: 80, recebido: 65, saldoApuracao: 15, dividaAnterior: 0, saldoTotal: 15, mesesSemRecebimento: [], obs: "" },
    ],
  },
  devido: { Alfa: { "2026-01": 100, "2026-02": 100, "2026-03": 100, "2026-04": 100 }, Beta: { "2026-01": 50, "2026-02": 50, "2026-03": 50, "2026-04": 50 }, Gama: { "2026-01": 20, "2026-02": 20, "2026-03": 20, "2026-04": 20 } },
  situacao: {
    Alfa: { "2026-01": "pago", "2026-02": "pago", "2026-03": "naopago", "2026-04": "naopago" },
    Beta: { "2026-01": "pago", "2026-02": "pago", "2026-03": "pago", "2026-04": "pago" },
    Gama: { "2026-01": "pago", "2026-02": "pago", "2026-03": "pago", "2026-04": "naopago" },
    Delta: { "2026-01": "na", "2026-02": "na", "2026-03": "na", "2026-04": "na" },
    Oculta: { "2026-01": "naopago", "2026-02": "naopago", "2026-03": "naopago", "2026-04": "naopago" },
  },
  situacaoNaoPagos: { Alfa: 2, Beta: 0, Gama: 1 },
  mesesComplemento: ["2026-04"],
  matrizOcultas: ["Oculta"],
  situacaoAjustes: [{ unidade: "Beta", mes: "2026-02", planilha: "Não pago", exibido: "Pago" }],
  notasExtra: ["Nota de teste."],
  premissas: ["Premissa de teste."],
  meta: { geradoEm: "20/11/2026 13:30", planilha: "teste", stale: null },
};
