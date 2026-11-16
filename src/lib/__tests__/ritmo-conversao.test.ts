import { describe, expect, it } from "vitest";
// @ts-expect-error módulo JS do servidor
import { ritmoConversao } from "../../../server/prospects.js";

// Linha do relatório do EVO: unidade (IdFilial 5 = Asa Norte), cadastro e conversão em DD/MM/AAAA.
const l = (cad: string, conv = "") => ({ IdFilial: 5, DtCadastro: cad, DtConversao: conv });

describe("ritmo da conversão", () => {
  it("compara a taxa até o dia com a média do mesmo dia dos meses anteriores", () => {
    const atual = [l("02/11/2026", "03/11/2026"), l("05/11/2026"), l("10/11/2026", "16/11/2026"), l("16/11/2026", "16/11/2026")];
    // Outubro: até o dia 15, 2 cadastros e 2 convertidos (o do dia 20 fica de fora). Setembro: 2 cadastros, 1 convertido até o dia 15.
    const out = [l("01/10/2026", "02/10/2026"), l("14/10/2026", "15/10/2026"), l("20/10/2026", "20/10/2026")];
    const set = [l("03/09/2026", "04/09/2026"), l("10/09/2026", "20/09/2026")];
    const r = ritmoConversao("2026-11", atual, [["2026-10", out], ["2026-09", set]], 15, 2);
    const [x] = Object.values(r) as { dia: number; oportunidades: number; conversoes: number; taxa: number; base: { meses: number; taxa: number } }[];
    expect(x).toEqual({ dia: 15, oportunidades: 3, conversoes: 1, taxa: 33.3, base: { meses: 2, taxa: 75 } });
  });

  it("meses com poucos cadastros ficam fora da base; dia 31 vira o último dia do mês anterior", () => {
    const atual = [l("31/10/2026", "31/10/2026")];
    const set = [l("30/09/2026", "30/09/2026")];
    const r = ritmoConversao("2026-10", atual, [["2026-09", set]], 31, 1);
    expect((Object.values(r)[0] as { base: { meses: number; taxa: number } }).base).toEqual({ meses: 1, taxa: 100 });
    const r2 = ritmoConversao("2026-10", atual, [["2026-09", set]], 31, 5);
    expect((Object.values(r2)[0] as { base: { meses: number } }).base.meses).toBe(0);
  });
});
