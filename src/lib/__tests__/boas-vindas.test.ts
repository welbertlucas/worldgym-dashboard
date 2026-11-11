import { describe, expect, it, vi } from "vitest";
// @ts-expect-error módulos JS do servidor
import { emailDeAcesso, enviarAcesso } from "../../../server/boasVindas.js";

const brenda = { nome: "Brenda Souza", email: "brenda@exemplo.com", papel: "unidades", unidades: ["Gama"] };
const zoho = { SMTP_USUARIO: "remetente@exemplo.com", SMTP_SENHA: "x" };

describe("e-mail de acesso", () => {
  it("acesso novo leva login, senha e link; senha nova muda o assunto", () => {
    const novo = emailDeAcesso(brenda, "ABCD2345EFGH");
    expect(novo.assunto).toBe("Seu acesso ao World Gym Atlas");
    expect(novo.html).toContain("Olá, Brenda!");
    expect(novo.html).toContain("brenda@exemplo.com");
    expect(novo.html).toContain("ABCD2345EFGH");
    expect(novo.html).toContain("https://atlas.worldgymacademia.com.br");
    expect(novo.html).toContain("Você está recebendo o seu acesso ao World Gym Atlas.");
    expect(novo.html).not.toContain("Lucas Lima");
    expect(emailDeAcesso(brenda, "x", { novo: false }).assunto).toBe("Sua nova senha do World Gym Atlas");
  });

  it("escapa o nome", () => {
    expect(emailDeAcesso({ ...brenda, nome: "<b>Ana</b>" }, "x").html).not.toContain("<b>Ana</b>");
  });

  it("envia pelo Zoho e devolve o endereço", async () => {
    const enviar = vi.fn().mockResolvedValue({ repetido: false });
    const r = await enviarAcesso(brenda, "ABCD2345EFGH", { env: zoho, enviar });
    expect(r).toEqual({ enviado: true, para: "brenda@exemplo.com" });
    expect(enviar.mock.calls[0][0].para).toBe("brenda@exemplo.com");
  });

  it("sem Zoho não envia; erro não derruba nem mostra a senha", async () => {
    expect(await enviarAcesso(brenda, "x", { env: {} })).toMatchObject({ enviado: false, erro: "envio de e-mail não configurado no servidor" });
    const enviar = vi.fn().mockRejectedValue(new Error("Zoho SMTP: falhou com ABCD2345EFGH"));
    const r = await enviarAcesso(brenda, "ABCD2345EFGH", { env: zoho, enviar });
    expect(r.enviado).toBe(false);
    expect(r.erro).not.toContain("ABCD2345EFGH");
  });
});
