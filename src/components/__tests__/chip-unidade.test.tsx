import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { ChipUnidade } from "@/components/DateFilter";
import { logout, precisaDeLogin } from "@/lib/auth";

vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
vi.stubGlobal("window", { dispatchEvent: vi.fn() });

const entrarComo = async (usuario: unknown) => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ protegido: true, logado: true, comEmail: true, usuario }), { status: 200 })));
  await precisaDeLogin();
};
const chip = (units: string[]) => renderToString(<ChipUnidade id="u" value={null} units={units} onChange={() => {}} extras={<option value="X">Institucional</option>} />);

afterEach(() => logout());

describe("filtro de unidade por perfil", () => {
  it("quem vê a rede tem 'Toda a rede' e as opções extras", async () => {
    await entrarComo({ nome: "Dono", email: "d@x.com", papel: "dono", unidades: [] });
    const html = chip(["Gama", "Itapoã"]);
    expect(html).toContain("Toda a rede");
    expect(html).toContain("Institucional");
  });

  it("perfil de uma unidade: só ela, sem 'rede' e sem botão de limpar", async () => {
    await entrarComo({ nome: "Paula", email: "p@x.com", papel: "unidades", unidades: ["Gama"] });
    const html = chip(["Gama"]);
    expect(html).toContain("Gama");
    expect(html).not.toMatch(/rede/i);
    expect(html).not.toContain("Institucional");
    expect(html).not.toContain("Limpar filtro");
  });

  it("perfil de várias unidades: 'Todas as suas unidades' no lugar da rede", async () => {
    await entrarComo({ nome: "Ana", email: "a@x.com", papel: "unidades", unidades: ["Gama", "Itapoã"] });
    const html = chip(["Gama", "Itapoã"]);
    expect(html).toContain("Todas as suas unidades");
    expect(html).not.toContain("Toda a rede");
    expect(html).not.toContain("Institucional");
  });
});
