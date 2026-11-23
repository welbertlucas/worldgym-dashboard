import { describe, expect, it } from "vitest";
import { ehAcademiaConcorrente } from "@/components/estudos/pois";

describe("academias concorrentes", () => {
  it("tira da conta o que o Google chama de academia mas não é (nomes inventados)", () => {
    for (const n of ["Quadra Esportiva Teste", "campo sintetico do bairro", "Parquinho", "Instituto cultural X", "Associação dos Moradores", "Studio de Pilates", "Capoeira Raiz"]) expect(ehAcademiaConcorrente(n)).toBe(false);
    for (const n of ["Academia Campos", "Smart Fit", "Fitness Center Parque", "Iron Gym", "Academia Brasil", "Box CrossFit Leste"]) expect(ehAcademiaConcorrente(n)).toBe(true);
  });
});
