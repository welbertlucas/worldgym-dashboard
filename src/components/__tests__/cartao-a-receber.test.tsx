import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
// @ts-expect-error módulo JS do servidor
import { somarCartaoAReceber as somarDoServidor } from "../../../server/pagamentos.js";
import { somarCartaoAReceber } from "@/data/dashboardData";
import { cartaoAReceberPorUnidade, resumoCartaoAReceber } from "@/data/cartaoAReceber";
import { CartaoAReceber } from "@/components/CartaoAReceber";
import type { UnitData } from "@/data/dashboardData";

const limpo = (h: string) => h.replace(/<!-- -->/g, "").replace(/ /g, " ");

describe("cartão de crédito a receber", () => {
  const t = (nome: string | undefined, dia: string, v: number, o: Record<string, unknown> = {}) => ({ paymentType: nome ? { id: 1, name: nome } : null, receivingDate: `${dia}T00:00:00`, ammountPaid: v, idMemberPayer: 1, ...o });

  it("o servidor soma só crédito pago, por dia de recebimento dentro do mês, sem cancelados nem títulos sem pagador", () => {
    const r = somarDoServidor([
      t("Credit card", "2026-11-23", 100.5), t("Credit card", "2026-11-23", 49.5), t("Credit card", "2026-11-26", 200),
      t("Debit card", "2026-11-23", 999), t("Pix", "2026-11-23", 999), t("Credit card", "2026-12-02", 50), // débito, Pix e outro mês ficam de fora
      t("Credit card", "2026-11-24", 80, { cancellationDate: "2026-11-01" }), t("Credit card", "2026-11-24", 80, { idMemberPayer: null }), t("Credit card", "2026-11-24", 0),
    ], "2026-11");
    expect(r).toEqual({ "2026-11-23": [150, 2], "2026-11-26": [200, 1] });
  });

  it("a rede soma os dias das unidades, em ordem", () => {
    expect(somarCartaoAReceber([{ "2026-11-26": [200, 1], "2026-11-23": [150, 2] }, { "2026-11-23": [50.25, 1] }, undefined])).toEqual({ "2026-11-23": [200.25, 3], "2026-11-26": [200, 1] });
  });

  const mapa: UnitData["cartaoAReceber"] = { "2026-11-18": [100, 1], "2026-11-20": [300, 3], "2026-11-26": [500, 4] };
  it("separa o que já caiu do que ainda vai cair (hoje conta como a receber)", () => {
    const r = resumoCartaoAReceber(mapa, "2026-11-20");
    expect(r).toMatchObject({ aReceber: 800, jaCaiu: 100, total: 900, cobrancas: 7 });
    expect(r.proximo?.dia).toBe("2026-11-20");
    expect(r.maior?.dia).toBe("2026-11-26");
    expect(resumoCartaoAReceber(undefined, "2026-11-20")).toMatchObject({ aReceber: 0, proximo: null, maior: null });
  });

  it("a lista por unidade vem da maior para a menor e deixa de fora quem não tem nada a receber", () => {
    const l = cartaoAReceberPorUnidade([{ name: "Gama", cartaoAReceber: { "2026-11-25": [100, 1] } }, { name: "Asa Norte", cartaoAReceber: mapa }, { name: "Ceilândia", cartaoAReceber: { "2026-11-02": [900, 9] } }, { name: "Sem dado" }], "2026-11-20");
    expect(l.map((x) => x.unidade)).toEqual(["Asa Norte", "Gama"]);
    expect(l[0]).toMatchObject({ aReceber: 800, cobrancas: 7 });
  });

  it("o painel mostra o calendário, os totais e a lista por unidade na rede, e avisa quando ainda não carregou", () => {
    const total = { cartaoAReceber: mapa } as unknown as UnitData;
    const rede = limpo(renderToString(<CartaoAReceber total={total} units={[{ name: "Asa Norte", cartaoAReceber: mapa }]} month="2026-11" hoje="2026-11-20" unitLabel="Rede" porUnidade />));
    for (const x of ["Cartão de crédito a receber no mês", "Ainda vai cair até o fim do mês", "R$ 800", "Já caiu neste mês", "R$ 100", "A receber por unidade", "Asa Norte", "sem a taxa da operadora"]) expect(rede).toContain(x);
    expect(rede).not.toContain("taxas");
    const uma = limpo(renderToString(<CartaoAReceber total={total} units={[]} month="2026-11" hoje="2026-11-20" unitLabel="Asa Norte" porUnidade={false} />));
    expect(uma).not.toContain("A receber por unidade");
    expect(limpo(renderToString(<CartaoAReceber total={{} as UnitData} units={[]} month="2026-11" hoje="2026-11-20" unitLabel="Rede" porUnidade />))).toContain("ainda não foi carregado");
  });
});
