// Restaura a lista de usuários a partir de um backup criptografado.
// Uso: BLOB_READ_WRITE_TOKEN=... BACKUP_SENHA=... node scripts/restaurar-usuarios.mjs <arquivo.json.enc> [--gravar]
// Sem --gravar só confere o arquivo e mostra o que seria restaurado (não altera nada).
import { readFileSync } from "node:fs";
import { gravarJson, lerJson } from "../server/armazem.js";
import { decifrarBackup } from "../server/backup.js";

const [arquivo, ...flags] = process.argv.slice(2);
if (!arquivo) throw new Error("Informe o arquivo de backup.");
const lista = decifrarBackup(JSON.parse(readFileSync(arquivo, "utf8")), process.env.BACKUP_SENHA);
if (!Array.isArray(lista) || !lista.some((u) => u.papel === "dono")) throw new Error("Backup inválido: sem lista ou sem dono.");
const atual = (await lerJson("acesso/usuarios.json")) ?? [];
console.log(`Backup: ${lista.length} usuários. Lista atual no servidor: ${atual.length}.`);
if (!flags.includes("--gravar")) { console.log("Nada foi alterado. Rode de novo com --gravar para restaurar."); process.exit(0); }
await gravarJson("acesso/usuarios.json", lista);
console.log("Lista restaurada. O servidor enxerga a mudança em até 1 minuto.");
