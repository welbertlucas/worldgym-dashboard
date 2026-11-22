import { describe, expect, it } from "vitest";
import { ID_BIG, ID_COMPL, ID_FREQ, ID_METAS, ID_SATISF, INDICADORES_PADRAO, RANKINGS, mesDoAnoAnterior, rotuloDoPeriodo, serieMensal, mesesParaRelatorio, montarRelatorio, resumoDosSlides } from "@/data/relatorio";
import { month, unit } from "./helpers";

const dados = [
  month("2025-10", [unit("Asa Sul", { faturamento: 100000 }), unit("Gama", { faturamento: 50000 })]),
  month("2026-10", [unit("Asa Sul", { faturamento: 120000, nps: 80, notaGoogle: 4.6 }), unit("Gama", { faturamento: 40000 }), unit("Nova", { faturamento: 30000 })]),
];

describe("relatório", () => {
  it("mês do ano anterior e meses fechados", () => {
    expect(mesDoAnoAnterior("2026-10")).toBe("2025-10");
    expect(rotuloDoPeriodo("2026-11")).toBe("1-30 nov/26");
    expect(rotuloDoPeriodo("2026-02")).toBe("1-28 fev/26");
    expect(mesesParaRelatorio(["2026-09", "2026-10", "2026-11"], new Date(2026, 10, 17))).toEqual(["2026-10", "2026-09"]);
  });

  it("ranking de faturamento em ordem e crescimento só das unidades com base", () => {
    const m = montarRelatorio(dados, "2026-10", ["fat", "cresc"], null)!;
    expect(m.rankings[0].itens.map((i) => i[0])).toEqual(["Asa Sul", "Gama", "Nova"]);
    const c = m.rankings[1];
    expect(c.itens).toEqual([["Asa Sul", 20], ["Gama", -20]]);
    expect(c.nota).toContain("Nova");
  });

  it("notas zeradas ficam de fora e o escopo restringe as unidades", () => {
    const m = montarRelatorio(dados, "2026-10", [ID_SATISF], ["Asa Sul", "Gama"])!;
    // NPS, Google e Reclame Aqui num slide só: só as notas que alguma unidade tem (Gama sem nota fica fora da média)
    expect(m.rankings).toEqual([]);
    expect(m.satisfacao!.notas.map((n) => [n.nome, n.valor, n.base])).toEqual([["NPS", "80", "média de 1 unidade com nota"], ["Google", "4,6", "média de 1 unidade com nota"]]);
    expect(m.nUnidades).toBe(2);
    expect(m.escopo).toBe("2 unidades");
  });

  it("números gerais comparam com o ano anterior e o resumo lista os slides", () => {
    const m = montarRelatorio(dados, "2026-10", [ID_BIG, "fat"], ["Asa Sul", "Gama"])!;
    const fat = m.big![0];
    expect(fat.variacao).toBeCloseTo(6.67, 1);
    expect(fat.anterior).toContain("150");
    expect(resumoDosSlides(m)).toEqual(["Capa", "Overview", "Faturamento", "Encerramento"]);
  });

  it("sem o mês no painel ou sem unidade no escopo devolve nada; sem ano anterior não há crescimento", () => {
    expect(montarRelatorio(dados, "2024-01", ["fat"], null)).toBeNull();
    expect(montarRelatorio(dados, "2026-10", ["fat"], ["Inexistente"])).toBeNull();
    expect(montarRelatorio([dados[1]], "2026-10", ["cresc"], null)!.rankings).toHaveLength(0);
  });

  it("uma unidade só vira cartão de destaque, com variação e ano anterior", () => {
    const m = montarRelatorio(dados, "2026-10", ["fat", "inad", "cresc", ID_SATISF], ["Asa Sul"])!;
    const [fat, cresc, inad] = m.rankings;
    expect(fat.itens).toEqual([]);
    expect(fat.cartao!.valor).toBe("R$ 120.000");
    expect(fat.cartao!.variacao).toBeCloseTo(20, 5);
    expect(fat.cartao!.anterior).toContain("100.000");
    expect(inad.cartao!.emPontos).toBe(true);
    expect(inad.cartao!.menorMelhor).toBe(true);
    expect(cresc.cartao!.valor).toBe("+20,0%");
    expect(m.satisfacao!.notas[0]).toMatchObject({ nome: "NPS", valor: "80", anterior: null, variacao: null, base: "nota da unidade" }); // sem nota no ano anterior
    expect(montarRelatorio(dados, "2026-10", ["inad"], ["Nova"])!.rankings[0].cartao!.variacao).toBeNull(); // sem mês igual no ano anterior
    expect(montarRelatorio(dados, "2026-10", ["fat", "cresc"], ["Nova"])!.rankings.map((r) => r.id)).toEqual(["fat"]); // sem base: sem crescimento
  });

  it("cartão de uma unidade traz a barra da meta (nível mais alto cadastrado); inadimplência só diz se atingiu", () => {
    const metas = [
      { month: "2026-10", unit: "Asa Sul", key: "faturamento", bronze: 100000, ouro: 200000 },
      { month: "2026-10", unit: "Asa Sul", key: "inadimplenciaPerc", ouro: 5 },
    ] as never[];
    const m = montarRelatorio(dados, "2026-10", ["fat", "inad", "nc"], ["Asa Sul"], metas)!;
    const [fat, nc, inad] = m.rankings;
    expect(fat.cartao!.meta!.pct).toBeCloseTo(60, 5);
    expect(fat.cartao!.meta!.texto).toBe("60% da meta ouro · R$ 200.000");
    expect(inad.cartao!.meta!.texto).toBe("Meta ouro: 5,0% · atingida"); // 4% <= 5%
    expect(nc.cartao!.meta).toBeUndefined(); // sem meta cadastrada
    expect(montarRelatorio(dados, "2026-10", ["fat"], ["Asa Sul"])!.rankings[0].cartao!.meta).toBeUndefined();
  });

  it("evolução: até 6 meses terminando no do relatório, pulando mês sem dado, com a meta como linha", () => {
    const meses = ["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"].map((m, i) =>
      month(m, [unit("Asa Sul", { faturamento: 100000 + i * 10000, ticketMedio: m === "2026-07" ? 0 : 130 })]));
    const fat = RANKINGS.find((r) => r.id === "fat")!;
    const s = serieMensal(meses, "2026-10", "Asa Sul", fat)!;
    expect(s.rotulos).toEqual(["mai/26", "jun/26", "jul/26", "ago/26", "set/26", "out/26"]);
    expect(s.valores.at(-1)).toBe(170000);
    expect(s.destaque).toBe(5);
    const tk = RANKINGS.find((r) => r.id === "tk")!;
    expect(serieMensal(meses, "2026-10", "Asa Sul", tk)!.rotulos).not.toContain("jul/26"); // ticket zerado = sem dado
    expect(serieMensal([meses[7]], "2026-10", "Asa Sul", fat)).toBeUndefined(); // um período só não é evolução
    const metas = [{ month: "2026-10", unit: "Asa Sul", key: "faturamento", prata: 150000, ouro: 220000 }] as never[];
    const m = montarRelatorio(meses, "2026-10", ["fat"], ["Asa Sul"], metas)!;
    expect(m.rankings[0].cartao!.serie!.metaLinha).toEqual({ valor: 220000, rotulo: "Meta ouro: R$ 220.000" });
    expect(montarRelatorio(meses, "2026-10", ["fat"], ["Asa Sul"])!.rankings[0].cartao!.serie!.metaLinha).toBeUndefined();
  });

  it("escopo da capa: rede só quando é a rede; uma unidade leva o nome dela, mesmo que seja a única da lista", () => {
    expect(montarRelatorio(dados, "2026-10", ["fat"], null)!.escopo).toBe("Rede");
    expect(montarRelatorio(dados, "2026-10", ["fat"], ["Asa Sul"])!.escopo).toBe("Asa Sul");
    const so = [month("2026-10", [unit("Itapoã")])];
    expect(montarRelatorio(so, "2026-10", ["fat"], ["Itapoã"])!.escopo).toBe("Itapoã"); // quem vê uma unidade só
    expect(montarRelatorio(dados, "2026-10", ["fat"], ["Asa Sul", "Gama"])!.escopo).toBe("2 unidades");
    expect(montarRelatorio(dados, "2026-10", ["fat"], ["Asa Sul", "Gama", "Nova"])!.escopo).toBe("Rede"); // todas as do mês
  });
});

describe("relatório: contratos vendidos, motivos e frequência", () => {
  const calor = Array.from({ length: 168 }, (_, k) => (k % 24 === 18 ? 10 : 1)); // pico às 18h
  const mk = (extra: Record<string, unknown> = {}) => [
    month("2025-10", [unit("Asa Sul", { vendasContratos: 80 }), unit("Gama", { vendasContratos: 40 })]),
    month("2026-10", [
      unit("Asa Sul", { vendasContratos: 100, cancelados: 7, churn: 3.5, inadimplenciaPerc: 8, motivosCancel: { Mudança: 4, Financeiro: 3 }, recusaMotivos: { "Sem saldo": { n: 6, abertas: 2, valorAberto: 300 } }, calor, entradas: 1000, frequentadores: 200, ...extra }),
      unit("Gama", { vendasContratos: 60, cancelados: 3, churn: 2, inadimplenciaPerc: 5, motivosCancel: { Mudança: 1, Saúde: 2 }, recusaMotivos: { "Sem saldo": { n: 2, abertas: 0, valorAberto: 0 }, "Cartão vencido": { n: 3, abertas: 1, valorAberto: 99.5 } }, calor, entradas: 500, frequentadores: 100 }),
    ]),
  ];

  it("contratos vendidos entra nos números gerais e vira um ranking", () => {
    const m = montarRelatorio(mk(), "2026-10", [ID_BIG, "cv"], null)!;
    const cv = m.big!.find((b) => b.nome === "Contratos vendidos")!;
    expect(cv.valor).toBe("160");
    expect(cv.variacao).toBeCloseTo(33.3, 1);
    expect(m.rankings[0].itens).toEqual([["Asa Sul", 100], ["Gama", 60]]);
    expect(RANKINGS.map((r) => r.id)).toContain("canc");
  });

  it("cancelamentos e churn trazem os motivos somados; inadimplência traz os motivos de recusa", () => {
    const m = montarRelatorio(mk(), "2026-10", ["canc", "churn", "inad"], null)!;
    const canc = m.rankings.find((r) => r.id === "canc")!;
    expect(canc.itens).toEqual([["Asa Sul", 7], ["Gama", 3]]);
    // os motivos são os mesmos para Churn e Cancelamentos: ficam no primeiro dos dois na ordem dos slides (Churn)
    const churn = m.rankings.find((r) => r.id === "churn")!;
    expect(churn.motivos).toMatchObject({ titulo: "Cancelamentos: motivos", total: 10 });
    expect(churn.motivos!.itens).toEqual([["Mudança", 5], ["Financeiro", 3], ["Saúde", 2]]);
    expect(canc.motivos).toBeUndefined();
    const inad = m.rankings.find((r) => r.id === "inad")!.motivos!;
    expect(inad.titulo).toBe("Inadimplência: motivos de recusa");
    expect(inad.itens).toEqual([["Sem saldo", 8], ["Cartão vencido", 3]]);
    expect(inad.nota).toContain("3 ainda em aberto");
    expect(resumoDosSlides(m).filter((x) => x.includes("motivos"))).toEqual(["Inadimplência: motivos de recusa", "Cancelamentos: motivos"]); // um slide de motivos logo depois do ranking
  });

  it("churn e cancelamentos pedidos juntos: os motivos aparecem uma vez só", () => {
    const m = montarRelatorio(mk(), "2026-10", ["churn", "canc"], null)!;
    expect(m.rankings.filter((r) => r.motivos).map((r) => r.id)).toEqual(["churn"]);
    expect(resumoDosSlides(m).filter((x) => x.includes("motivos"))).toHaveLength(1);
  });

  it("sem motivos guardados o slide de motivos não aparece, e só os 8 maiores entram (o resto vira Outros)", () => {
    const sem = montarRelatorio([month("2026-10", [unit("A", { cancelados: 2 })])], "2026-10", ["canc"], null)!;
    expect(sem.rankings[0].motivos).toBeUndefined();
    const muitos = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`M${i}`, 11 - i]));
    const m = montarRelatorio([month("2026-10", [unit("A", { cancelados: 66, motivosCancel: muitos })])], "2026-10", ["canc"], null)!;
    expect(m.rankings[0].motivos!.itens).toHaveLength(9);
    expect(m.rankings[0].motivos!.itens[8]).toEqual(["Outros", 6]); // 3 + 2 + 1
  });

  it("frequência: mapa de calor do período somado nas unidades e o último check-in da leitura mais recente", () => {
    const acessos = [50, 20, 10, 5, 3, 2];
    const dadosF = [...mk(), month("2026-11", [unit("Asa Sul", { acessos }), unit("Gama", { acessos: [30, 10, 5, 3, 1, 1] })])];
    const m = montarRelatorio(dadosF, "2026-10", [ID_FREQ], null)!;
    expect(m.frequencia!.calor).toHaveLength(168);
    expect(m.frequencia!.calor[18]).toBe(20); // pico das duas unidades
    expect(m.frequencia).toMatchObject({ entradas: 1500, frequentadores: 300, periodo: "1-31 out/26" });
    expect(m.frequencia!.ultimoCheckin).toMatchObject({ valores: [80, 30, 15, 8, 4, 3], total: 140 });
    expect(m.frequencia!.ultimoCheckin!.posicao).toMatch(/^posição/);
    expect(resumoDosSlides(m)).toContain("Frequência dos alunos");
    expect(montarRelatorio(mk(), "2026-10", ["fat"], null)!.frequencia).toBeNull(); // só vem quando foi pedido
    expect(montarRelatorio(mk(), "2026-10", [ID_FREQ], ["Gama"])!.frequencia!.entradas).toBe(500); // respeita as unidades escolhidas
    expect(montarRelatorio([month("2026-10", [unit("A")])], "2026-10", [ID_FREQ], null)!.frequencia).toBeNull(); // sem catraca nem último acesso
  });
});

describe("relatório do mês: receitas complementares num slide só", () => {
  const dadosC = [
    month("2025-10", [unit("Asa Sul", { faturamento: 1000, diarias: 100, personal: 50 })]),
    month("2026-10", [
      unit("Asa Sul", { faturamento: 1000, diarias: 120, personal: 60, kids: 20, plus: 10, proMais: 5, camisetas: 8, coqueteleiras: 7 }),
      unit("Gama", { faturamento: 500, diarias: 40 }),
    ]),
  ];
  it("soma as sete receitas, mostra o peso no faturamento e a variação contra o ano anterior; os itens soltos saíram dos rankings", () => {
    const m = montarRelatorio(dadosC, "2026-10", [ID_COMPL], ["Asa Sul"])!;
    const c = m.complementares!;
    expect(c.total).toBe(230);
    expect(c.itens).toEqual([["Diárias", 120], ["Taxa de personal", 60], ["Brinquedoteca", 20], ["WG Plus", 10], ["Camisetas", 8], ["Coqueteleiras", 7], ["Pro+", 5]]);
    expect(c.participacao).toBeCloseTo(23, 1);
    expect(c.variacao).toBeCloseTo(53.3, 1); // contra 150 em out/2025
    expect(c.legenda).toContain("além dos planos");
    expect(resumoDosSlides(m)).toContain("Receitas complementares");
    expect(RANKINGS.map((r) => r.id)).not.toEqual(expect.arrayContaining(["di"]));
    for (const id of ["di", "pers", "cam", "coq"]) expect(RANKINGS.some((r) => r.id === id)).toBe(false);
    expect(montarRelatorio(dadosC, "2026-10", ["fat"], null)!.complementares).toBeNull(); // só quando pedido
    expect(montarRelatorio([month("2026-10", [unit("A", { faturamento: 10 })])], "2026-10", [ID_COMPL], null)!.complementares).toBeNull(); // sem nenhuma receita, sem slide
  });
  it("o relatório do mês traz contratos vendidos já na seleção padrão", () => {
    expect(INDICADORES_PADRAO).toContain("cv");
  });

  it("satisfação: variação em pontos contra o ano anterior, maiores e menores notas e entrada no resumo", () => {
    const antes = [month("2025-10", [unit("A", { nps: 60 }), unit("B", { nps: 40 })]), month("2026-10", [unit("A", { nps: 70 }), unit("B", { nps: 50 }), unit("C", { nps: 90 })])];
    const m = montarRelatorio(antes, "2026-10", [ID_SATISF], null)!;
    const nps = m.satisfacao!.notas[0];
    expect(nps.valor).toBe("70");
    expect(nps.variacao).toBeCloseTo(20, 5); // média 70 contra 50
    expect(nps.topo.map((x) => x[0])).toEqual(["C", "A", "B"]); // poucas unidades: lista inteira, sem "menores"
    expect(nps.fundo).toEqual([]);
    expect(resumoDosSlides(m)).toEqual(["Capa", "Satisfação", "Encerramento"]);
  });

  it("metas do mês: rede usa a meta da rede, uma unidade a dela, várias unidades contam quantas atingiram", () => {
    const base = [month("2026-10", [unit("Asa Sul", { faturamento: 120000 }), unit("Gama", { faturamento: 40000 })])];
    const metas = [
      { month: "2026-10", unit: "Asa Sul", key: "faturamento", bronze: 100000, ouro: 200000 },
      { month: "2026-10", unit: "Gama", key: "faturamento", bronze: 60000, ouro: 80000 },
      { month: "2026-10", unit: "TOTAL", key: "faturamento", bronze: 150000, ouro: 300000 },
    ] as never[];
    const um = montarRelatorio(base, "2026-10", [ID_METAS], ["Asa Sul"], metas)!.metas!;
    expect(um.linhas[0]).toMatchObject({ nome: "Faturamento", nivel: "bronze", meta: expect.stringContaining("ouro") });
    expect(um.linhas[0].pct).toBeCloseTo(60, 5);
    const varias = montarRelatorio(base, "2026-10", [ID_METAS], ["Asa Sul", "Gama"], metas)!.metas!; // as duas = a rede inteira
    expect(varias.escopoTexto).toBe("meta da rede");
    expect(montarRelatorio(base, "2026-10", [ID_METAS], ["Asa Sul"], [])!.metas).toBeNull(); // sem meta cadastrada, sem slide
    expect(resumoDosSlides(montarRelatorio(base, "2026-10", [ID_METAS], ["Asa Sul"], metas)!)).toContain("Metas do mês");
  });

  it("renovação entra como ranking e as observações viram um slide no resumo", () => {
    const base = [month("2026-10", [unit("Asa Sul", { renovacoes: 60 }), unit("Gama", { renovacoes: 50 })])];
    const m = montarRelatorio(base, "2026-10", ["ren"], null)!;
    expect(m.rankings[0].itens).toEqual([["Asa Sul", 60], ["Gama", 50]]);
    expect(RANKINGS.some((r) => ["nps", "google", "ra"].includes(r.id))).toBe(false); // as três notas agora são o slide de Satisfação
    expect(resumoDosSlides({ ...m, observacoes: "  Reforçar cobrança  " })).toContain("Observações");
    expect(resumoDosSlides({ ...m, observacoes: "   " })).not.toContain("Observações");
  });

  it("o Overview diz quantos dos contratos vendidos são especiais", () => {
    const base = [month("2026-10", [unit("Asa Sul", { vendasContratos: 50, vendasContratosEspeciais: 3 } as never), unit("Gama", { vendasContratos: 10, vendasContratosEspeciais: 0 } as never)])];
    const cv = montarRelatorio(base, "2026-10", [ID_BIG], null)!.big!.find((k) => k.nome === "Contratos vendidos")!;
    expect(cv.valor).toBe("60");
    expect(cv.nota).toBe("dos quais 3 são especiais");
    expect(montarRelatorio([month("2026-10", [unit("Gama", { vendasContratos: 10 } as never)])], "2026-10", [ID_BIG], null)!.big!.find((k) => k.nome === "Contratos vendidos")!.nota).toBeUndefined();
  });

  it("mês fechado compara com o mesmo mês do ano anterior (se a unidade existia) e com o mês anterior; sem o ano anterior, só com o mês anterior", () => {
    const base = [
      month("2025-10", [unit("Antiga", { faturamento: 100000 })]),
      month("2026-09", [unit("Antiga", { faturamento: 150000 }), unit("Nova", { faturamento: 20000 })]),
      month("2026-10", [unit("Antiga", { faturamento: 120000 }), unit("Nova", { faturamento: 30000 })]),
    ];
    // unidade antiga: as duas comparações
    const a = montarRelatorio(base, "2026-10", ["fat"], ["Antiga"])!;
    expect(a.rankings[0].cartao).toMatchObject({ valor: "R$ 120.000", anterior: "R$ 100.000  ·  out/2025", anteriorMes: "R$ 150.000  ·  set/2026" });
    expect(a.rankings[0].cartao!.variacao).toBeCloseTo(20, 5); // contra out/2025
    expect(a.rankings[0].cartao!.variacaoMes).toBeCloseTo(-20, 5); // contra set/2026
    expect(a.mesAnteriorCurto).toBe("out/2025");
    expect(a.mesPassadoCurto).toBe("set/2026");
    // unidade aberta depois: sem o ano anterior, só o mês anterior
    const n = montarRelatorio(base, "2026-10", ["fat"], ["Nova"])!.rankings[0].cartao!;
    expect(n.variacao).toBeNull();
    expect(n.anterior).toBeNull();
    expect(n.variacaoMes).toBeCloseTo(50, 5); // 20.000 → 30.000
    expect(n.anteriorMes).toBe("R$ 20.000  ·  set/2026");
    // os números gerais da rede trazem as duas variações
    const g = montarRelatorio(base, "2026-10", [ID_BIG], null)!.big![0];
    expect(g.variacao).toBeCloseTo(50, 5); // 150.000 contra 100.000 (as duas unidades no mês; só uma existia no ano anterior)
    expect(g.variacaoMes).toBeCloseTo(-11.76, 1); // 150.000 contra 170.000
    // várias unidades: aviso de que a comparação inclui a unidade aberta depois
    const nota = montarRelatorio(base, "2026-10", [ID_BIG], null)!.notaComparacao;
    expect(nota).toBe("As comparações incluem unidades abertas depois do período comparado (1 unidade sem out/2025).");
    expect(montarRelatorio(base, "2026-10", [ID_BIG], ["Antiga"])!.notaComparacao).toBeNull(); // uma unidade que existia: sem aviso
    // sem o mês anterior guardado: só o ano anterior
    expect(montarRelatorio([base[0], base[2]], "2026-10", ["fat"], ["Antiga"])!.rankings[0].cartao!.variacaoMes).toBeNull();
  });
});

