import { describe, expect, it, vi } from "vitest";
// @ts-expect-error módulo JS do servidor
import { alcance, contratosUnidade, ehUnidadePro } from "../../../server/contratos.js";

const chamadas: string[] = [];
vi.mock("../../../server/evo.js", () => ({
  fetchAll: async (path: string) => { chamadas.push(path); return path.startsWith("/membership") ? [{ idMembership: 7, value: 100, accessBranches: [] }] : []; },
}));

const plano = (n: number) => ({ accessBranches: Array.from({ length: n }, (_, i) => ({ idBranch: i })) });

describe("alcance do plano", () => {
  it("fora das Pro, vale a lista de unidades do cadastro", () => {
    expect(alcance(plano(1))).toBe("local");
    expect(alcance(plano(0))).toBe("local");
    expect(alcance(plano(5))).toBe("local");
    expect(alcance(plano(9))).toBe("local");
    expect(alcance(plano(10))).toBe("rede");
  });

  it("nas unidades Pro todo plano é de rede", () => {
    expect(alcance(plano(1), true)).toBe("rede");
    expect(alcance(undefined, true)).toBe("rede");
  });

  it("reconhece as unidades Pro pelo nome", () => {
    expect(["Águas Claras Pro", "Goiânia Pro-GO", "Salvador Pro-BA"].every(ehUnidadePro)).toBe(true);
    expect(["Gama", "Águas Claras Metrópole", "Sobradinho"].some(ehUnidadePro)).toBe(false);
  });
});

describe("contratos a partir da lista de alunos já baixada", () => {
  it("conta só os alunos com status Active e não baixa os alunos de novo", async () => {
    const contrato = (membershipStatus: string, name = "MENSAL") => ({ idMembership: 7, membershipStatus, name });
    const membros = [
      { status: "Active", memberships: [contrato("active"), contrato("active", "PERSONAL X"), contrato("expired")] },
      { status: "Active", memberships: [contrato("active")] },
      { status: "Inactive", memberships: [contrato("active")] },
    ];
    chamadas.length = 0;
    const r = await contratosUnidade(5, membros);
    expect(r).toMatchObject({ alunosAtivos: 2, contratosAtivos: 3, contratosPersonal: 1, contratosLocal: 3, contratosRede: 0 });
    expect(chamadas.some((c) => c.startsWith("/members?"))).toBe(false);
  });
});
