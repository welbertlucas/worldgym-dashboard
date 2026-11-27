import { describe, expect, it } from "vitest";
import { ehAcademiaConcorrente } from "@/components/estudos/pois";

describe("academias concorrentes", () => {
  it("tira da conta o que o Google chama de academia mas não é (nomes inventados)", () => {
    for (const n of ["Quadra Esportiva Teste", "campo sintetico do bairro", "Parquinho", "Instituto cultural X", "Associação dos Moradores", "Studio de Pilates", "Capoeira Raiz"]) expect(ehAcademiaConcorrente(n)).toBe(false);
    for (const n of ["Academia Campos", "Smart Fit", "Fitness Center Parque", "Iron Gym", "Academia Brasil", "Box CrossFit Leste"]) expect(ehAcademiaConcorrente(n)).toBe(true);
    // nunca concorrentes, mesmo com "academia" ou "fitness" no nome (nomes inventados, no padrão dos que o Google trouxe)
    for (const n of ["Academia do Idoso ao ar livre - Quadra 100", "Academia ao Ar Livre", "Academia Coberta Melhor Idade QC 9", "Academia do Idoso (ponto comunitário) do Bairro", "Studio X Estética e Esmalteria", "Exemplo Moda Fitness e Beachwear", "LOJÃO", "Pista skate", "ESCOLINHA DE FUTSAL EXEMPLO", "SLAM UNIDADE EXEMPLO"]) expect(ehAcademiaConcorrente(n)).toBe(false);
    for (const n of ["Academia Lojista Fit", "Studio Corps", "Academia Exemplo Fitness"]) expect(ehAcademiaConcorrente(n)).toBe(true);
  });
});
