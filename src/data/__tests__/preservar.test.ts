import { describe, expect, it } from "vitest";
// @ts-expect-error módulo JS do servidor
import { preservarCampos } from "../../../server/preservar.js";

describe("recalcular o mês sem apagar o que as outras etapas gravaram", () => {
  const antiga = { name: "Goiânia Pro-GO", faturamento: 100, recebimento: 90, tipoVenda: { novo: [1, 2] }, vendasDia: [1, 0], formasPagamento: { Pix: 5 }, alunosAtivos: 1000, cancelados: 7 };
  it("o cálculo novo sobrescreve o que traz e o resto da unidade antiga fica", () => {
    const r = preservarCampos({ name: "Goiânia Pro-GO", faturamento: 120, recebimento: 95 }, antiga);
    expect(r).toMatchObject({ faturamento: 120, recebimento: 95, tipoVenda: { novo: [1, 2] }, vendasDia: [1, 0], formasPagamento: { Pix: 5 } });
  });
  it("campos de outra rotina (lista) continuam com o valor antigo, mesmo que o cálculo novo traga o seu", () => {
    const r = preservarCampos({ name: "x", cancelados: 99, alunosAtivos: 1 }, antiga, ["cancelados", "alunosAtivos"]);
    expect(r.cancelados).toBe(7);
    expect(r.alunosAtivos).toBe(1000);
  });
  it("unidade sem registro antigo vem como calculada", () => {
    const nova = { name: "Nova", faturamento: 1 };
    expect(preservarCampos(nova, undefined)).toBe(nova);
  });
  it("não muda a unidade antiga", () => {
    const copia = JSON.parse(JSON.stringify(antiga));
    preservarCampos({ faturamento: 1 }, antiga, ["cancelados"]);
    expect(antiga).toEqual(copia);
  });
});
