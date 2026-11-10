import { describe, expect, it } from "vitest";
// @ts-expect-error módulos JS do servidor
import { parseMetas, situacaoMeta } from "../../../server/metas.js";
// @ts-expect-error módulos JS do servidor
import { valoresDoDia, montarResumo, renderizarEmail, totalizar, unidadesDoUsuario, alertasDe, mesmoDiaMesAnterior, diaAnterior, dadosDeHoje, fotoDe, assunto, textoPrevia, enviarEmail, chaveDoEnvio } from "../../../server/resumo.js";

const un = (name: string, o: any = {}) => ({ name, faturamento: 1000, recebimento: 800, vendasOnline: 600, diarias: 100, personal: 50, pagantes: 100, adimplentes: 90, inadimplentes: 10, oportunidades: 50, conversoes: 10, ativosIni: 110, contratosVendidos: [["Anual", 6, 3000], ["Mensal", 9, 1800], ["Semestral", 2, 1600], ["Trimestral", 1, 400]], ativosFim: 120, aVencer: 10, naoRenovados: 2, cancelados: 3, novosContratos: 7, npsPromotores: 8, npsDetratores: 2, npsRespostas: 10, ...o });
const agora = "2026-11-10T04:00:00.000Z";
const meses = [{ month: "2026-11", generatedAt: agora, units: [un("Asa Norte", { faturamento: 500 }), un("Gama", { faturamento: 900 }), un("Itapoã")] }];
const ref = { dia: "2026-10-09", units: { "Asa Norte": fotoDe({ units: [un("Asa Norte")] }, "x").units["Asa Norte"], Gama: fotoDe({ units: [un("Gama")] }, "x").units["Gama"] } };

describe("resumo diário", () => {
  it("master e dono recebem a rede; gestor só as unidades dele", () => {
    const rede = montarResumo(meses, { papel: "master", nome: "Ana" }, "2026-11-10");
    const gestor = montarResumo(meses, { papel: "unidades", unidades: ["Gama"], nome: "Beto" }, "2026-11-10");
    expect(rede.linhas.map((l: any) => l.nome)).toEqual(["Itapoã", "Gama", "Asa Norte"]);
    expect(gestor.linhas.map((l: any) => l.nome)).toEqual(["Gama"]);
    expect(unidadesDoUsuario({ papel: "dono" }).length).toBeGreaterThan(20);
  });

  it("NPS, renovação e inadimplência do total saem das somas, não de médias", () => {
    const t = totalizar([{ ...un("A"), complementar: 0 }, { ...un("B", { npsPromotores: 0, npsDetratores: 10 }), complementar: 0 }].map((x: any) => ({ ...x, ...{ ativos: 1 } })));
    expect(t.nps).toBe(Math.round(((8 - 2 + 0 - 10) / 20) * 100));
    expect(t.inadimplenciaPerc).toBe(10);
    expect(t.renovacao).toBe(80);
  });

  it("receitas complementares somam diárias, personal etc.", () => {
    const r = montarResumo(meses, { papel: "unidades", unidades: ["Gama"] }, "2026-11-10");
    expect(r.total.complementar).toBe(150);
  });

  it("datas: mesmo dia do mês passado, com 31 em mês curto e virada de ano", () => {
    expect(mesmoDiaMesAnterior("2026-11-09")).toBe("2026-10-09");
    expect(mesmoDiaMesAnterior("2026-03-31")).toBe("2026-02-28");
    expect(mesmoDiaMesAnterior("2026-01-15")).toBe("2025-12-15");
    expect(diaAnterior("2026-11-01")).toBe("2026-10-31");
  });

  it("dia 1º resume o fechamento do mês que acabou", () => {
    const m = [{ month: "2026-10", generatedAt: "2026-11-01T04:00:00.000Z", units: [un("Gama")] }];
    const r = montarResumo(m, { papel: "master" }, "2026-11-01");
    expect(r.mes).toBe("2026-10");
    expect(r.desatualizado).toBe(false);
  });

  it("detecta dados que não foram atualizados esta madrugada", () => {
    expect(dadosDeHoje({ generatedAt: "2026-11-09T04:00:00.000Z" }, "2026-11-10")).toBe(false);
    expect(dadosDeHoje({ generatedAt: agora }, "2026-11-10")).toBe(true);
    expect(montarResumo([{ ...meses[0], generatedAt: "2026-11-09T04:00:00.000Z" }], { papel: "master" }, "2026-11-10").desatualizado).toBe(true);
  });

  it("sem dados do mês não gera e-mail", () => {
    expect(montarResumo(meses, { papel: "master" }, "2026-12-05")).toBeNull();
  });

  it("alertas: faturamento caindo e inadimplência alta, cada um com ação sugerida", () => {
    const atual = { ...totalizar([{ ...un("A"), complementar: 0, faturamento: 800, inadimplentes: 12, pagantes: 100 }]) };
    const refT = { ...totalizar([{ ...un("A"), complementar: 0 }]) };
    const a = alertasDe(atual, refT, "A");
    expect(a.map((x: any) => x.titulo)).toEqual(expect.arrayContaining(["Faturamento abaixo do mesmo dia", "Inadimplência alta"]));
    expect(a.every((x: any) => x.acao.length > 10)).toBe(true);
    expect(alertasDe(atual, null, "A").map((x: any) => x.titulo)).toEqual(["Inadimplência alta"]);
  });

  it("e-mail em texto: todas as seções, variações escritas, alertas; escapa HTML", () => {
    const m = [{ month: "2026-11", generatedAt: agora, units: [un("<b>X</b>", { faturamento: 700 }), un("Y")] }];
    const refX = { dia: "d", units: { "<b>X</b>": fotoDe({ units: [un("<b>X</b>")] }, "x").units["<b>X</b>"], Y: fotoDe({ units: [un("Y")] }, "x").units["Y"] } };
    const usr = { papel: "unidades", unidades: ["<b>X</b>", "Y"], nome: "Zé <i>" };
    const html = renderizarEmail(montarResumo(m, usr, "2026-11-10", refX), usr);
    expect(html).not.toContain("<b>X</b>");
    expect(html).not.toContain("As comparações são sempre"); // frase tirada da saudação a pedido do dono
    for (const t of ["No resumo de hoje", "O faturamento do mês soma", "Vendas</h2>", "vendas online", "receitas complementares", "contratos vendidos", "conversão média", "Retenção</h2>", "cancelamentos", "O churn do mês está em", "renovados", "alunos adimplentes", "dos pagantes", "Contratos mais vendidos</h2>", "Satisfação</h2>", "O NPS do mês está em", "pesquisas", "neutros", "Alertas</h2>", "pedindo atenção", "Este é o resumo da World Gym", "sócio ou gestor de mais de uma unidade", "Ver as pesquisas no WeHelp", "https://app.wehelpsoftware.com"]) expect(html).toContain(t);
    const sem = renderizarEmail(montarResumo(m, usr, "2026-11-10", null), usr);
    expect(sem).not.toMatch(/(acima|abaixo)<\/span> do mês passado/);
    expect(sem).toContain("aparece quando");
  });

  it("faturamento sem 'recebido' e inadimplência em percentual dos pagantes", () => {
    const r = montarResumo(meses, { papel: "unidades", unidades: ["Gama"] }, "2026-11-10", ref);
    const html = renderizarEmail(r, { papel: "unidades", nome: "B" });
    expect(html).not.toContain("Recebido");
    expect(html).not.toContain("camisetas");
    expect(html).not.toContain("recuperadas");
    expect(html).toContain("10%");
    expect(html).toContain("10% dos pagantes");
  });

  it("conversão e top 3 contratos somando as unidades", () => {
    const usr = { papel: "master", nome: "A" };
    const r = montarResumo(meses, usr, "2026-11-10", ref);
    expect(r.total.conversao).toBe(20);
    expect(r.top.map((c: any) => c.nome)).toEqual(["Mensal", "Anual", "Semestral"]);
    expect(r.top[0].acum).toBe(27);
    const html = renderizarEmail(r, usr);
    expect(html).toContain("A conversão média está em <strong style=\"color:#3a3a42\">20%</strong>");
    expect(html).toContain("Contratos mais vendidos</h2>");
    expect(html).toContain("O mais vendido do mês é o <strong style=\"color:#3a3a42\">Mensal</strong>");
    expect(html).not.toContain("Contratos especiais");
  });

  it("metas: lê a planilha e mostra nível atingido e quanto falta", () => {
    const metas = parseMetas([["Mês", "Unidade", "Indicador", "Bronze", "Prata", "Ouro"], ["novembro/2026", "Gama", "Faturamento", "800", "1.200", "1.500"], ["2026-11", "Gama", "Churn", "5", "3", "2"], ["2026-11", "TOTAL", "Faturamento", "2.000", "3.000", "4.000"]], 2026);
    expect(metas).toHaveLength(3);
    expect(situacaoMeta("faturamento", 900, metas[0])).toMatchObject({ nivel: "bronze", proximo: { nivel: "prata", falta: 300 } });
    expect(situacaoMeta("churn", 2.7, metas[1]).nivel).toBe("prata");
    const usrG = { papel: "unidades", unidades: ["Gama"], nome: "B" };
    const gestor = montarResumo(meses, usrG, "2026-11-10", null, metas);
    expect(gestor.metas.faturamento).toMatchObject({ semMeta: false, nivel: "bronze" });
    expect(gestor.metas.churn.semMeta).toBe(false);
    expect(gestor.metas.renovacoes).toMatchObject({ semMeta: true, aviso: "sua unidade não cadastrou meta" });
    const html = renderizarEmail(gestor, usrG);
    expect(html).toContain("para a meta ouro.");
    expect(html).not.toContain("METAS DO MÊS");
    const rede = montarResumo(meses, { papel: "master", nome: "A" }, "2026-11-10", null, metas);
    expect(rede.metas.faturamento.semMeta).toBe(false);
    expect(rede.metas.icv.aviso).toBe("a rede não cadastrou meta");
    // sem meta na planilha (ou planilha indisponível): o e-mail sempre diz que a meta não foi cadastrada
    const sem = montarResumo(meses, { papel: "master" }, "2026-11-10", null, null);
    expect(sem.metas.faturamento.semMeta).toBe(true);
    expect(renderizarEmail(sem, { papel: "master" })).toContain("A rede não cadastrou meta para o faturamento.");
    const semUn = montarResumo(meses, { papel: "unidades", unidades: ["Gama"] }, "2026-11-10", null, null);
    expect(renderizarEmail(semUn, { papel: "unidades" })).toContain("Sua unidade não cadastrou meta para o faturamento.");
    expect(assunto(semUn)).toBe("Gama: R$ 900 no mês");
  });

  it("meta de faturamento: quanto falta em R$ para o ouro", () => {
    const metas = parseMetas([["Mês", "Unidade", "Indicador", "Bronze", "Prata", "Ouro"], ["2026-11", "Gama", "Faturamento", "800", "1.200", "1.500"], ["2026-11", "Itapoã", "Faturamento", "500", "800", "900"]], 2026);
    const um = renderizarEmail(montarResumo(meses, { papel: "unidades", unidades: ["Gama"] }, "2026-11-10", null, metas), { papel: "unidades" });
    expect(um).toContain("para a meta ouro.");
    expect(um).toContain("R$&nbsp;600");
    expect(um).not.toContain("faltam para");
    const nenhuma = renderizarEmail(montarResumo(meses, { papel: "unidades", unidades: ["Asa Norte"] }, "2026-11-10", null, metas), { papel: "unidades" });
    expect(nenhuma).toContain("Sua unidade não cadastrou meta");
    expect(nenhuma).toContain("O NPS do mês está em");
  });

  it("números do dia = acumulado de hoje menos a foto de ontem; sem foto não inventa", () => {
    const usr = { papel: "unidades", unidades: ["Gama"], nome: "B" };
    const ontem = { dia: "x", units: { Gama: fotoDe({ units: [un("Gama", { faturamento: 700, vendasOnline: 500, novosContratos: 5, cobrancas: { recuperadas: 4 } })] }, "x").units.Gama } };
    const r = montarResumo(meses, usr, "2026-11-10", null, null, ontem);
    expect(r.dia.faturamento).toBe(200); // 900 hoje - 700 ontem
    expect(r.dia.vendasOnline).toBe(100);
    expect(r.dia.novosContratos).toBe(2);
    const html = renderizarEmail(r, usr);
    expect(html).toContain("R$&nbsp;900");
    expect(html).not.toContain("segundo dia de histórico");
    const sem = montarResumo(meses, usr, "2026-11-10", null, null, null);
    expect(sem.dia).toBeNull();
    expect(sem.top.every((c: any) => c.dia === null)).toBe(true);
    // contratos mais vendidos seguem a regra dos cartões: vendidos no dia, acumulado embaixo
    const ontemC = { dia: "x", units: { Gama: fotoDe({ units: [un("Gama", { contratosVendidos: [["Anual", 5, 2500], ["Mensal", 7, 1400]] })] }, "x").units.Gama } };
    const comC = montarResumo(meses, usr, "2026-11-10", null, null, ontemC);
    expect(comC.top.find((c: any) => c.nome === "Mensal")).toMatchObject({ acum: 9, dia: 2 });
    expect(comC.top.find((c: any) => c.nome === "Anual")).toMatchObject({ acum: 6, dia: 1 });
    const h = renderizarEmail(comC, usr);
    expect(h).toContain("Mensal");
    expect(h).toContain("O mais vendido do mês é o");
    expect(h).toContain("com 9 no mês (2 ontem)");
    expect(renderizarEmail(sem, usr)).toContain("segundo dia de histórico");
    // dia 1º do mês: o dia é o acumulado inteiro
    const m1 = [{ month: "2026-11", generatedAt: "2026-11-02T04:00:00.000Z", units: [un("Gama")] }];
    expect(montarResumo(m1, usr, "2026-11-02", null, null, null).dia.faturamento).toBe(1000);
    expect(valoresDoDia({ faturamento: 5 }, { faturamento: 9 }).faturamento).toBe(0); // correção do EVO nunca vira dia negativo
  });

  it("gestor ou sócio de mais de uma unidade recebe só a de maior faturamento; o aviso do Atlas vai para todo dono de unidade e gestor", () => {
    const usr = { papel: "unidades", unidades: ["Asa Norte", "Gama", "Itapoã"], nome: "Carla Souza" };
    const r = montarResumo(meses, usr, "2026-11-10"); // faturamento: Asa 500, Gama 900, Itapoã 1000
    expect(r.unidade).toBe("Itapoã");
    expect(r.maisDeUma).toBe(true);
    expect(r.linhas.map((l: any) => l.nome)).toEqual(["Itapoã"]);
    expect(r.total.faturamento).toBe(1000);
    const html = renderizarEmail(r, usr);
    expect(html).toContain("Bom dia, Carla! Este é o resumo da World Gym Itapoã, com os números de ontem e do mês.");
    expect(html).toContain("Se você é sócio ou gestor de mais de uma unidade");
    // o aviso aparece para todo dono de unidade e gestor, mesmo com uma unidade só; o master recebe a rede e não vê o aviso
    const um = montarResumo(meses, { papel: "unidades", unidades: ["Gama"], nome: "B" }, "2026-11-10");
    expect(um.maisDeUma).toBe(false);
    expect(renderizarEmail(um, { papel: "unidades", nome: "B" })).toContain("Se você é sócio ou gestor de mais de uma unidade");
    const rede = montarResumo(meses, { papel: "master", nome: "Ana" }, "2026-11-10");
    expect(rede.unidade).toBeNull();
    const h = renderizarEmail(rede, { papel: "master", nome: "Ana" });
    expect(h).toContain("Este é o resumo da rede World Gym");
    expect(h).not.toContain("mais de uma unidade");
    // desempate: mesmo faturamento -> ordem alfabética
    const iguais = montarResumo([{ month: "2026-11", generatedAt: agora, units: [un("Zeta"), un("Alfa")] }], { papel: "unidades", unidades: ["Zeta", "Alfa"] }, "2026-11-10");
    expect(iguais.unidade).toBe("Alfa");
  });
  it("assunto traz o número do dia e a meta; a prévia completa com o mês e os alertas", () => {
    const usr = { papel: "unidades", unidades: ["Gama"], nome: "B" };
    const ontem = { dia: "x", units: { Gama: fotoDe({ units: [un("Gama", { faturamento: 700 })] }, "x").units.Gama } };
    const metas = parseMetas([["Mês", "Unidade", "Indicador", "Bronze", "Prata", "Ouro"], ["2026-11", "Gama", "Faturamento", "800", "1.200", "1.500"]], 2026);
    const r = montarResumo(meses, usr, "2026-11-10", ref, metas, ontem); // Gama: 900 no mês, 700 até anteontem, 1000 no mesmo dia do mês passado
    expect(assunto(r)).toBe("Gama: R$ 200 ontem · faltam R$ 600 para a meta ouro");
    expect(textoPrevia(r)).toBe("R$ 900 no mês (▼ 10% contra o mesmo dia do mês passado). 2 alertas pedem atenção.");
    expect(renderizarEmail(r, usr)).toContain("R$&nbsp;900 no mês (▼ 10% contra o mesmo dia do mês passado)"); // texto de prévia escondido no topo
    // sem foto de ontem e sem metas legíveis: só o acumulado, sem afirmar meta
    const simples = montarResumo(meses, { papel: "master" }, "2026-11-10");
    expect(assunto(simples)).toBe("Rede World Gym: R$ 2.400 no mês");
    expect(assunto(montarResumo(meses, { papel: "unidades", unidades: ["Itapoã"] }, "2026-11-10", null, parseMetas([["Mês", "Unidade", "Indicador", "Bronze", "Prata", "Ouro"], ["2026-11", "Itapoã", "Faturamento", "500", "800", "900"]], 2026)))).toBe("Itapoã: R$ 1.000 no mês · meta ouro atingida");
    // EVO não atualizou esta madrugada: o assunto não afirma número
    const velho = montarResumo([{ ...meses[0], generatedAt: "2026-11-09T04:00:00.000Z" }], usr, "2026-11-10", ref, metas, ontem);
    expect(assunto(velho)).toBe("World Gym Atlas · resumo de 09/11");
  });

  it("envio: chave única por pessoa e dia, nova tentativa em 429/5xx/rede e sem repetir em erro definitivo", async () => {
    const resp = (status: number, corpo = "{}", headers: Record<string, string> = {}) => ({ ok: status < 300, status, text: async () => corpo, headers: { get: (k: string) => headers[k] ?? null } });
    const cfg = (fila: any[], pausas: number[] = [], chamadas: any[] = []) => ({ chave: "k", de: "a@b.c", dormir: async (ms: number) => { pausas.push(ms); }, buscar: async (_u: string, o: any) => { chamadas.push(o); const x = fila.shift(); if (x instanceof Error) throw x; return x; } });
    const msg = { para: "x@y.z", assunto: "s", html: "<p>", chaveUnica: chaveDoEnvio("2026-11-09", "X@Y.z") };
    expect(msg.chaveUnica).toBe("resumo-diario/2026-11-09/x@y.z");

    const pausas: number[] = [], chamadas: any[] = [];
    expect(await enviarEmail(msg, cfg([resp(429, "limite", { "retry-after": "2" }), new Error("rede"), resp(200)], pausas, chamadas))).toEqual({ repetido: false });
    expect(pausas).toEqual([2000, 2000]); // 1ª: o que o Resend pediu; 2ª: espera padrão da segunda tentativa
    expect(chamadas).toHaveLength(3);
    expect(chamadas.every((c) => c.headers["Idempotency-Key"] === "resumo-diario/2026-11-09/x@y.z")).toBe(true);

    // o Resend reconheceu a chave: não mandou de novo
    expect(await enviarEmail(msg, cfg([resp(200, "{}", { "idempotent-replayed": "true" })]))).toEqual({ repetido: true });
    expect(await enviarEmail(msg, cfg([resp(409, '{"name":"invalid_idempotent_request"}')]))).toEqual({ repetido: true });

    // erro definitivo (remetente não verificado, por exemplo): uma tentativa só
    const c2: any[] = [];
    await expect(enviarEmail(msg, cfg([resp(403, "domínio não verificado"), resp(200)], [], c2))).rejects.toThrow("Resend HTTP 403");
    expect(c2).toHaveLength(1);
    // servidor fora do ar o tempo todo: desiste depois de 3
    const c3: any[] = [];
    await expect(enviarEmail(msg, cfg([resp(500), resp(502), resp(503), resp(200)], [], c3))).rejects.toThrow("Resend HTTP 503");
    expect(c3).toHaveLength(3);
  });
  it("texto: variação escrita junto do mês, sem 'igual', 'nenhum contrato novo', um botão só e rodapé com motivo", () => {
    const usr = { papel: "unidades", unidades: ["Gama"], nome: "B" };
    const ontem = { dia: "x", units: { Gama: fotoDe({ units: [un("Gama", { faturamento: 700 })] }, "x").units.Gama } };
    const r = montarResumo(meses, usr, "2026-11-10", ref, null, ontem);
    const html = renderizarEmail(r, usr, { contato: "atlas@worldgym.com.br" });
    expect(html).toMatch(/O faturamento de ontem foi de <strong[^>]*>R\$&nbsp;200<\/strong>, e o mês já soma <strong[^>]*>R\$&nbsp;900<\/strong> \(<span[^>]*>10% abaixo<\/span> do mês passado\)/);
    expect(html).not.toContain("igual");
    expect(html).toContain("nenhum contrato novo"); // contratos vendidos: 7 hoje e 7 na foto
    expect(html).toContain("Nenhum contrato vendido"); // destaque da caixa "No resumo de hoje"
    expect(html).toContain(">Ver alertas no Atlas<");
    expect(html).not.toContain("Ver alertas e ações sugeridas");
    expect(html).toContain("porque tem acesso ao World Gym Atlas");
    expect(html).not.toMatch(/R\$ \d/); // valor e "R$" nunca ficam em linhas diferentes
    expect(html).toContain("mailto:atlas@worldgym.com.br");
    const semAlerta = montarResumo([{ month: "2026-11", generatedAt: agora, units: [un("Itapoã", { inadimplentes: 2, adimplentes: 98 })] }], { papel: "unidades", unidades: ["Itapoã"] }, "2026-11-10", null, null, null);
    expect(semAlerta.alertas).toHaveLength(0);
    const h2 = renderizarEmail(semAlerta, { papel: "unidades" });
    expect(h2).toContain(">Abrir o Atlas<");
    expect(h2).toContain("mailto:lucas.lima@worldgymbrasil.com.br"); // sem configuração, vale o contato padrão
  });
});
