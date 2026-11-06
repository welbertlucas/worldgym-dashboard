// Leitor mínimo de .xlsx (só a primeira planilha, texto e números), sem dependências.
// Basta para os relatórios do EVO, que vêm como Excel simples.
import { inflateRawSync } from "node:zlib";

function entradas(zip) {
  // Diretório central: fim do arquivo (EOCD), depois uma ficha por arquivo.
  let eocd = -1;
  for (let i = zip.length - 22; i >= 0; i--) if (zip.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("xlsx inválido");
  const n = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  const out = {};
  for (let k = 0; k < n; k++) {
    const metodo = zip.readUInt16LE(p + 10), tam = zip.readUInt32LE(p + 20);
    const nomeLen = zip.readUInt16LE(p + 28), extraLen = zip.readUInt16LE(p + 30), comLen = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    const nome = zip.toString("utf8", p + 46, p + 46 + nomeLen);
    const ini = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const dados = zip.subarray(ini, ini + tam);
    out[nome] = metodo === 0 ? dados : inflateRawSync(dados);
    p += 46 + nomeLen + extraLen + comLen;
  }
  return out;
}

const texto = (s) => s.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** Linhas da primeira planilha como objetos `{ [cabeçalho]: texto }`. */
export function lerXlsx(buf) {
  const f = entradas(buf);
  const ss = f["xl/sharedStrings.xml"] ? [...f["xl/sharedStrings.xml"].toString("utf8").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texto(m[1])) : [];
  const xml = (f["xl/worksheets/sheet1.xml"] ?? Buffer.alloc(0)).toString("utf8");
  const linhas = [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((r) => {
    const cel = {};
    for (const [, ref, attr, corpo] of r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const v = corpo?.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      const inl = corpo?.match(/<is>([\s\S]*?)<\/is>/)?.[1];
      cel[ref] = attr.includes('t="s"') && v !== undefined ? ss[Number(v)] : inl !== undefined ? texto(inl) : v !== undefined ? texto(v) : "";
    }
    return cel;
  });
  const [cab, ...dados] = linhas;
  if (!cab) return [];
  return dados.map((l) => Object.fromEntries(Object.entries(cab).map(([col, nome]) => [nome, l[col] ?? ""])));
}
