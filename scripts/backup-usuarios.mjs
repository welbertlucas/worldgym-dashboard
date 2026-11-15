// Copia a lista de usuários (acesso/usuarios.json do Blob) para um arquivo criptografado.
// Uso: BLOB_READ_WRITE_TOKEN=... BACKUP_SENHA=... node scripts/backup-usuarios.mjs [pasta-de-saida]
// Recusa lista vazia ou sem dono: um backup assim esconderia o problema em vez de proteger.
import { mkdirSync, writeFileSync } from "node:fs";
import { lerJson } from "../server/armazem.js";
import { cifrarBackup } from "../server/backup.js";

const lista = await lerJson("acesso/usuarios.json");
if (!Array.isArray(lista) || lista.length === 0) throw new Error("Lista de usuários vazia ou ausente: backup NÃO criado.");
if (!lista.some((u) => u.papel === "dono")) throw new Error("A lista não tem o dono: backup NÃO criado.");
const pasta = process.argv[2] ?? "backup";
mkdirSync(pasta, { recursive: true });
const arquivo = `${pasta}/usuarios-${new Date().toISOString().slice(0, 10)}.json.enc`;
writeFileSync(arquivo, JSON.stringify(cifrarBackup(lista, process.env.BACKUP_SENHA)));
console.log(`Backup criado: ${arquivo} (${lista.length} usuários)`);
