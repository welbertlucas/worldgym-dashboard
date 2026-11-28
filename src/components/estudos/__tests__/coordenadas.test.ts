import { describe, expect, it } from "vitest";
import { lerCoordenadas, textoDasCoordenadas } from "../mapaComum";

describe("coordenadas digitadas na busca de endereço", () => {
  it("aceita o formato do Google Maps e as variações comuns", () => {
    expect(lerCoordenadas("-12.255347, -38.976201")).toEqual([-12.255347, -38.976201]);
    expect(lerCoordenadas("  -12.255347,-38.976201 ")).toEqual([-12.255347, -38.976201]);
    expect(lerCoordenadas("-12.255347 -38.976201")).toEqual([-12.255347, -38.976201]);
    expect(lerCoordenadas("-12,255347; -38,976201")).toEqual([-12.255347, -38.976201]); // vírgula decimal
    expect(lerCoordenadas("-12,255347 -38,976201")).toEqual([-12.255347, -38.976201]);
  });

  it("endereço, número solto ou coordenada fora do mundo não viram posição", () => {
    expect(lerCoordenadas("Rua 10, 200")).toBeNull();
    expect(lerCoordenadas("10, 20")).toBeNull(); // sem casas decimais: pode ser pedaço de endereço
    expect(lerCoordenadas("-95.1, -38.9")).toBeNull();
    expect(lerCoordenadas("-12.2, -190.5")).toBeNull();
    expect(lerCoordenadas("QNN 2 Conjunto H")).toBeNull();
  });

  it("escreve as coordenadas como o cartão do pino copia", () => {
    expect(textoDasCoordenadas([-12.2553471, -38.9762])).toBe("-12.255347, -38.976200");
  });
});
