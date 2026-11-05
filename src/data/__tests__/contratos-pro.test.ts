import { describe, expect, it } from "vitest";
// @ts-expect-error módulo JS do servidor
import { alcance, ehUnidadePro } from "../../../server/contratos.js";

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
