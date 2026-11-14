import { afterEach, describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { OrigemOportunidades, origensOrdenadas } from "@/components/OrigemOportunidades";
import { CobrancasRecusa, recusaOrdenada } from "@/components/CobrancasRecusa";
import { TreinosCard, situacaoDosTreinos } from "@/components/clientes/TreinosCard";
import { dashboardData } from "@/data/dashboardData";
import { unit } from "@/data/__tests__/helpers";

afterEach(() => { dashboardData.length = 0; });
const limpo = (h: string) => h.replace(/<!-- -->/g, "");

describe("origem das oportunidades", () => {
  it("ordena do maior para o menor e junta a cauda", () => {
    const o = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`O${i}`, [100 - i, 10] as [number, number]]));
    const l = origensOrdenadas(o);
    expect(l).toHaveLength(9);
    expect(l[8][0]).toBe("Demais origens");
    expect(l[8][1]).toBe(92 + 91);
  });
  it("mostra total, conversão e a conversão de cada origem; vazio sem dado", () => {
    const html = limpo(renderToString(<OrigemOportunidades total={unit("A", { origens: { Convite: [10, 5], "Totem/Site": [30, 3] } })} monthLabel="outubro de 2026" partial={false} unitLabel="Rede" />));
    expect(html).toContain("Oportunidades cadastradas");
    expect(html).toContain("20,0%"); // 8 de 40
    expect(html).toContain("50,0% convertem");
    expect(limpo(renderToString(<OrigemOportunidades total={unit("A")} monthLabel="x" partial={false} unitLabel="Rede" />))).toContain("Sem oportunidades do EVO");
  });
  it("separa as vindas do Meta (Instagram, Facebook, anúncio)", () => {
    const html = limpo(renderToString(<OrigemOportunidades total={unit("A", { origens: { Instagram: [20, 4], "Facebook Ads": [10, 1], "Totem/Site": [70, 5] } })} monthLabel="x" partial={false} unitLabel="Rede" />));
    expect(html).toContain("Vindas do Meta");
    expect(html).toMatch(/30<\/span> cadastradas · 30,0% do total · <span[^>]*>5<\/span> convertidas \(16,7%\)/);
    const sem = limpo(renderToString(<OrigemOportunidades total={unit("A", { origens: { "Totem/Site": [70, 5] } })} monthLabel="x" partial={false} unitLabel="Rede" />));
    expect(sem).toContain("Nenhuma oportunidade com origem Instagram");
  });
});

describe("cobranças com falha", () => {
  it("lista só motivos com cobranças em aberto, do maior para o menor", () => {
    const l = recusaOrdenada({ A: { n: 9, abertas: 0, valorAberto: 0 }, B: { n: 5, abertas: 2, valorAberto: 100 }, C: { n: 7, abertas: 5, valorAberto: 300 } });
    expect(l.map(([k]) => k)).toEqual(["C", "B"]);
  });
  it("mostra recuperação e valor em aberto", () => {
    const t = unit("A", { cobrancas: { falhas: 200, recuperadas: 150, abertas: 50, valorAberto: 12345, valorRecuperado: 20000 }, recusaMotivos: { "Não autorizada pelo emissor": { n: 80, abertas: 30, valorAberto: 5000 } } });
    const html = limpo(renderToString(<CobrancasRecusa total={t} monthLabel="outubro de 2026" partial={false} unitLabel="Rede" />)).replace(/\u00a0/g, " ");
    expect(html).toContain("75,0%");
    expect(html).toContain("Não autorizada pelo emissor");
    expect(limpo(renderToString(<CobrancasRecusa total={unit("A")} monthLabel="x" partial={false} unitLabel="Rede" />))).toContain("Sem cobranças com falha");
  });
});

describe("treinos dos alunos", () => {
  it("sem treino é a diferença para os alunos ativos", () => {
    expect(situacaoDosTreinos(unit("A", { treinoAtivo: 100, treinoVencido: 300, treinoFuturo: 10, ativosFim: 1000 }))).toEqual({ ativo: 100, vencido: 300, futuro: 10, sem: 590, alunos: 1000 });
    expect(situacaoDosTreinos(unit("A"))).toBeNull();
  });
  it("mostra os percentuais; sem foto de treinos, explica que só existe no mês corrente", () => {
    const t = unit("A", { treinoAtivo: 100, treinoVencido: 300, treinoFuturo: 0, ativosFim: 1000 });
    const html = limpo(renderToString(<TreinosCard total={t} month="2026-11" monthLabel="novembro de 2026" unit="A" />));
    expect(html).toContain("10,0%");
    expect(html).toContain("30,0%");
    expect(limpo(renderToString(<TreinosCard total={unit("A")} month="2026-10" monthLabel="outubro" unit={null} />))).toContain("foto de hoje");
  });
});
