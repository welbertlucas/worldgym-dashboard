import { describe, expect, it } from "vitest";
import { contexto, filtroInicial, type ModeloRoyalties } from "@/data/royalties";
import { MODELO as MODELO_BASE } from "./royalties-fixture";
import {
  alertasDeRoyalties, detalheDaUnidade, marcacoesDeRoyalties, mostraRoyalties, primeiroRecebimento, quadrosDeEsperado, semEsperado, serieDeRoyalties, textoDaMarcacao, unidadesDeRoyalties,
} from "@/data/royaltiesUnidades";

/** Nove meses fictícios: Zeta (royalties sem valor esperado) cai, para, é compensada e depois "sobe"; Eta (com valor esperado) abre em mar/26. */
const meses = Array.from({ length: 9 }, (_, i) => ({ key: `2026-${String(i + 1).padStart(2, "0")}`, label: `m${i + 1}/26` }));
const porMes = (valores: number[]) => Object.fromEntries(meses.map((m, i) => [m.key, valores[i]]));
const MODELO: ModeloRoyalties = {
  meses,
  unidades: [{ nome: "Zeta", tipo: "royalties" }, { nome: "Eta", tipo: "royalties" }, { nome: "Vazia", tipo: "royalties" }, { nome: "Fixa", tipo: "fixa" }],
  recebido: {
    Zeta: porMes([10, 10, 10, 10, 10, 10, 4, 0, 40]),
    Eta: porMes([0, 0, 20, 20, 0, 5, 20, 20, 20]),
    Vazia: porMes([0, 0, 0, 0, 0, 0, 0, 0, 0]),
    Fixa: porMes([1, 1, 1, 1, 1, 1, 1, 1, 1]),
  },
  naoMapeado: { porMes: porMes([0, 0, 0, 0, 0, 0, 0, 0, 0]), itens: [] },
  pendencias: { apuracao: "2026-09", dia: 10, linhas: [{ unidade: "Eta", variavel: true, valorMensal: null, inicio: "2026-03", vencimento: 10, devido: 140, recebido: 125, saldoApuracao: 15, dividaAnterior: 0, saldoTotal: 15, mesesSemRecebimento: [], obs: "" }] },
  devido: { Eta: porMes([0, 0, 20, 20, 20, 20, 20, 20, 20]), Vazia: porMes([0, 0, 0, 0, 0, 0, 0, 0, 0]) },
  situacao: {},
  situacaoNaoPagos: {},
  mesesComplemento: ["2026-09"],
  aberturas: { Eta: "inaugurada em mar/26" },
  meta: { geradoEm: "teste" },
};
const c = contexto(MODELO);
const f0 = filtroInicial(c);

describe("royalties por unidade: marcações", () => {
  it("queda abaixo de metade da média, mês sem pagamento (com compensação) e recuperação que não vira dividendo", () => {
    const m = marcacoesDeRoyalties(c).Zeta;
    expect(m["2026-07"]).toMatchObject({ t: "queda", val: 4, avg: 10 });
    expect(m["2026-08"]).toMatchObject({ t: "zero", esp: 0, comp: "2026-09" });
    expect(m["2026-09"]).toBeUndefined(); // 40 logo depois de mês sem pagamento é recuperação, não dividendo
    expect(semEsperado(c, "Zeta")).toBe(true);
    expect(semEsperado(c, "Eta")).toBe(false);
    expect(textoDaMarcacao(c, "Zeta", m["2026-07"])).toBe("-60% vs média, possível rateio");
    expect(textoDaMarcacao(c, "Zeta", m["2026-08"])).toBe("sem pagamento");
  });

  it("pico só conta com valor esperado ausente, 6 meses de história e sem recuperação", () => {
    const longo: ModeloRoyalties = { ...MODELO, recebido: { ...MODELO.recebido, Zeta: porMes([10, 10, 10, 10, 10, 10, 10, 10, 40]) } };
    const m = marcacoesDeRoyalties(contexto(longo)).Zeta["2026-09"];
    expect(m).toMatchObject({ t: "pico", val: 40, avg: 10 });
    expect(textoDaMarcacao(contexto(longo), "Zeta", m)).toBe("+300% vs média, possível dividendo");
  });

  it("unidade só aparece na seção de royalties quando há unidade dessa modalidade no filtro", () => {
    expect(unidadesDeRoyalties(c)).toEqual(["Zeta", "Eta", "Vazia"]);
    expect(mostraRoyalties(c, f0)).toBe(true);
    expect(mostraRoyalties(c, { ...f0, tipo: "fixa" })).toBe(false);
    expect(mostraRoyalties(c, { ...f0, unidades: ["Fixa"] })).toBe(false);
    expect(mostraRoyalties(c, { ...f0, unidades: ["Eta"] })).toBe(true);
  });
});

describe("royalties por unidade: série, alertas e esperado", () => {
  it("a série deixa vazio o que vem antes de a unidade começar e ignora quem nunca recebeu", () => {
    const { pontos, unidades } = serieDeRoyalties(c, f0);
    expect(unidades).toEqual(["Zeta", "Eta"]); // Vazia nunca recebeu
    expect(pontos[0].Eta).toBeNull();
    expect(pontos[2].Eta).toBe(20);
    expect(pontos[8]).toMatchObject({ parcial: true, Zeta: 40 });
  });

  it("alertas: sem recebimento, sem pagamento com compensação, rateio e abertura, do mais recente para o mais antigo", () => {
    const a = alertasDeRoyalties(c, f0);
    expect(a[0]).toMatchObject({ tom: "bad", rotulo: "Sem recebimento", unidade: "Vazia" });
    const textos = a.map((x) => `${x.rotulo}|${x.unidade}`);
    expect(textos).toContain("Sem pagamento|Zeta");
    expect(textos).toContain("Possível rateio|Zeta");
    expect(textos).toContain("Abertura|Eta");
    expect(a.find((x) => x.rotulo === "Sem pagamento" && x.unidade === "Zeta")?.texto).toContain("Compensado em m9/26 com valor dobrado");
    expect(a.find((x) => x.rotulo === "Abertura")?.texto).toContain("(unidade inaugurada em mar/26)");
    expect(primeiroRecebimento(c, "Eta")).toBe(2);
  });

  it("esperado e recebido: só unidades com valor esperado; conta os meses a partir do início da cobrança", () => {
    const { quadros, maximo } = quadrosDeEsperado(c, f0);
    expect(quadros.map((q) => q.unidade)).toEqual(["Eta"]);
    const q = quadros[0];
    expect(q.meses[0].key).toBe("2026-03"); // antes de mar/26 a unidade nem começou
    expect(q.esperadoInformado).toBe(20 * 7);
    expect(q.recebidoNoPeriodo).toBe(20 + 20 + 0 + 5 + 20 + 20 + 20);
    expect(q.saldo).toBe(15);
    expect(maximo).toBe(20);
  });
});


/** O formato de moeda usa espaço não quebrável entre R$ e o número; os textos esperados aqui usam espaço comum. */
const n = (t: string) => t.replace(/\u00a0/g, " ");
const fatos = (d: { fatos: [string, string][] }) => Object.fromEntries(d.fatos.map(([k, v]) => [k, n(v)]));

describe("detalhe da unidade", () => {
  const cb = contexto(MODELO_BASE);

  it("unidade de taxa fixa com cobrança: dados da cobrança, progresso, meses sem recebimento e observação", () => {
    const d = detalheDaUnidade(cb, "Alfa")!;
    expect(d.tipo).toBe("fixa");
    expect(n(d.saldoTexto)).toBe("R$ 200,00");
    expect(fatos(d)).toMatchObject({ "Valor mensal": "R$ 100,00", "Início da cobrança": "jan/26", Vencimento: "Dia 10", "Último pagamento": "10/02/2026", "Total devido": "R$ 400,00", "Total recebido": "R$ 200,00" });
    expect(d.progresso?.percentual).toBe(50);
    expect(n(d.progresso!.texto)).toBe("Recebido R$ 200,00 de R$ 400,00 devidos até abr/26.");
    expect(d.mesesSemRecebimento).toEqual(["mar/26", "abr/26"]);
    expect(d.naoPagos).toBe(2);
    expect(d.obs).toBe("Acordo em duas parcelas.");
    expect(d.meses).toHaveLength(4);
    expect(d.meses[2].situacao).toBe("naopago");
  });

  it("taxa fixa fora de Pendências não tem cobrança; royalties sem valor esperado não têm saldo calculado", () => {
    const sem = detalheDaUnidade(cb, "Sigma")!;
    expect(sem.semCobranca).toBe(true);
    expect(sem.saldoTexto).toBe("Sem cobrança");
    expect(fatos(sem)).toMatchObject({ "Total recebido": "R$ 7,00", "Primeiro pagamento": "jan/26", "Último pagamento": "Nenhum", Cobrança: "Sem cobrança" });
    expect(sem.progresso).toBeNull();
    const delta = detalheDaUnidade(cb, "Delta")!;
    expect(delta.saldoTexto).toBe("Não calculado");
    expect(fatos(delta)).toMatchObject({ "Valor mensal": "Variável", "Esperado informado": "Não informado", "Saldo devedor": "Não calculado" });
  });

  it("royalties com valor esperado mostram o progresso do esperado; unidade desconhecida não tem detalhe", () => {
    const gama = detalheDaUnidade(cb, "Gama")!;
    expect(n(gama.saldoTexto)).toBe("R$ 15,00");
    expect(n(gama.progresso!.texto)).toBe("Recebido R$ 65,00 de R$ 80,00 devidos (esperado informado).");
    expect(detalheDaUnidade(cb, "Inexistente")).toBeNull();
  });
});
