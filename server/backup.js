// Backup da lista de usuários: a cópia sai criptografada (AES-256-GCM, chave derivada da senha de backup com scrypt),
// porque a lista tem e-mails e hashes de senha e o repositório é público. Formato do arquivo (JSON):
//   { v: 1, salt, iv, tag, dados }  (tudo em base64)
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const chave = (senha, salt) => scryptSync(String(senha), salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });

export function cifrarBackup(lista, senha) {
  if (!senha || String(senha).length < 16) throw new Error("senha de backup curta demais (mínimo 16 caracteres)");
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(senha, salt), iv);
  const dados = Buffer.concat([c.update(JSON.stringify(lista), "utf8"), c.final()]);
  return { v: 1, salt: salt.toString("base64"), iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), dados: dados.toString("base64") };
}

export function decifrarBackup(arquivo, senha) {
  if (arquivo?.v !== 1) throw new Error("formato de backup desconhecido");
  const d = createDecipheriv("aes-256-gcm", chave(senha, Buffer.from(arquivo.salt, "base64")), Buffer.from(arquivo.iv, "base64"));
  d.setAuthTag(Buffer.from(arquivo.tag, "base64"));
  try {
    return JSON.parse(Buffer.concat([d.update(Buffer.from(arquivo.dados, "base64")), d.final()]).toString("utf8"));
  } catch {
    throw new Error("senha de backup errada ou arquivo corrompido");
  }
}
