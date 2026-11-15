import { describe, expect, it } from "vitest";
// @ts-expect-error módulo JS do servidor
import { cifrarBackup, decifrarBackup } from "../../../server/backup.js";

const lista = [{ id: "1", nome: "Dono", email: "d@x.com", papel: "dono", senha: "hash:segredo" }];
const SENHA = "uma-senha-de-backup-bem-longa";

describe("backup criptografado dos usuários", () => {
  it("ida e volta devolve a lista igual, e o arquivo não mostra nada em texto aberto", () => {
    const arq = cifrarBackup(lista, SENHA);
    expect(JSON.stringify(arq)).not.toContain("d@x.com");
    expect(decifrarBackup(arq, SENHA)).toEqual(lista);
  });
  it("senha errada ou arquivo adulterado não abre", () => {
    const arq = cifrarBackup(lista, SENHA);
    expect(() => decifrarBackup(arq, "outra-senha-bem-longa-aqui")).toThrow(/senha de backup errada/);
    expect(() => decifrarBackup({ ...arq, dados: Buffer.from("x").toString("base64") }, SENHA)).toThrow();
  });
  it("recusa senha curta", () => {
    expect(() => cifrarBackup(lista, "curta")).toThrow(/curta/);
  });
});
