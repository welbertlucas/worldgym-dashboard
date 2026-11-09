import { afterEach, describe, expect, it, vi } from "vitest";
import { dashboardData, dashboardDataRede, syncDashboardDataFromSheets } from "@/data/dashboardData";
import { metasData, metasRede, syncMetasFromSheets } from "@/data/metas";
import { logout, precisaDeLogin, unidadesProprias, podeAtualizar, podeGerirAcessos } from "@/lib/auth";

vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
vi.stubGlobal("window", { dispatchEvent: vi.fn() });

const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
const csv = ["Mês,Unidade,Faturamento,Recebimento", "2026-10,Itapoã,100,90", "2026-10,Gama,200,180", "2026-10,Unidade 05,300,270", "2026-10,TOTAL,600,540"].join("\n");
const metas = ["Mês,Unidade,Indicador,Ouro", "2026-10,Itapoã,Faturamento,150", "2026-10,REDE,Faturamento,900"].join("\n");

function rotas(usuario: unknown) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.includes("/login")) return json({ protegido: true, logado: true, comEmail: true, usuario });
    if (url.includes("sheet=Metas")) return new Response(metas, { status: 200 });
    if (url.includes("sheet-data")) return new Response(csv, { status: 200 });
    return json({ months: [] });
  }));
}

afterEach(() => { logout(); dashboardData.length = 0; dashboardDataRede.length = 0; });

describe("quem tem acesso só a algumas unidades", () => {
  it("o conjunto de trabalho tem só as unidades dele (e o total é a soma delas); a rede fica à parte para o benchmark", async () => {
    rotas({ nome: "João", email: "j@x.com", papel: "unidades", unidades: ["Itapoã"] });
    await precisaDeLogin();
    expect(unidadesProprias()).toEqual(["Itapoã"]);
    expect(podeAtualizar()).toBe(false);
    expect(podeGerirAcessos()).toBe(false);

    expect((await syncDashboardDataFromSheets()).ok).toBe(true);
    const meu = dashboardData[0];
    expect(meu.units.map((u) => u.name)).toEqual(["Itapoã"]);
    expect(meu.total.faturamento).toBe(100); // não os 600 da rede

    const rede = dashboardDataRede[0];
    expect(rede.units.map((u) => u.name).sort()).toEqual(["Gama", "Itapoã", "Unidade 05"]);
    expect(rede.total.faturamento).toBe(600);
  });

  it("metas da rede ficam de fora do conjunto de trabalho (comparariam a rede com o total só dele), mas seguem para a Visão Executiva", async () => {
    rotas({ nome: "João", email: "j@x.com", papel: "unidades", unidades: ["Itapoã"] });
    await precisaDeLogin();
    await syncMetasFromSheets();
    expect(metasData.map((m) => m.unit)).toEqual(["Itapoã"]);
    expect(metasRede.map((m) => m.unit).sort()).toEqual(["Itapoã", "TOTAL"]);
  });

  it("dono e master veem tudo: os dois conjuntos são iguais", async () => {
    rotas({ nome: "Maria", email: "m@x.com", papel: "master", unidades: [] });
    await precisaDeLogin();
    expect(unidadesProprias()).toBeNull();
    expect(podeAtualizar()).toBe(false); // master não atualiza
    await syncDashboardDataFromSheets();
    expect(dashboardData[0].units).toHaveLength(3);
    expect(dashboardData[0].total.faturamento).toBe(dashboardDataRede[0].total.faturamento);
  });

  it("só o dono atualiza e gerencia acessos", async () => {
    rotas({ nome: "Welbert", email: "w@x.com", papel: "dono", unidades: [] });
    await precisaDeLogin();
    expect(podeAtualizar()).toBe(true);
    expect(podeGerirAcessos()).toBe(true);
  });
});
