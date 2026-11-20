// Leitura e gravação de JSON privado no Vercel Blob (usuários e registro de acessos).
// `definirArmazem` troca a implementação nos testes, para não depender de rede.
import { put, get, list, del } from "@vercel/blob";

const real = {
  async ler(caminho) {
    const r = await get(caminho, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200) return null;
    return JSON.parse(await new Response(r.stream).text());
  },
  async gravar(caminho, dados) {
    await put(caminho, JSON.stringify(dados), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });
  },
  /** Arquivo binário (foto) no Blob privado. */
  async gravarBytes(caminho, bytes, tipo) {
    await put(caminho, bytes, { access: "private", contentType: tipo, addRandomSuffix: false, allowOverwrite: true });
  },
  async lerBytes(caminho) {
    const r = await get(caminho, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200) return null;
    return Buffer.from(await new Response(r.stream).arrayBuffer());
  },
  /** Caminhos guardados que começam com `prefixo`. */
  async listar(prefixo) {
    const out = [];
    let cursor;
    do {
      const r = await list({ prefix: prefixo, cursor, limit: 1000 });
      out.push(...r.blobs.map((b) => b.pathname));
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor);
    return out;
  },
  async apagar(caminho) {
    await del(caminho);
  },
};

let atual = real;

export const lerJson = (caminho) => atual.ler(caminho);
export const gravarJson = (caminho, dados) => atual.gravar(caminho, dados);
/** Listar e apagar são opcionais na troca de implementação dos testes (quem não define, não lista nem apaga). */
export const listarCaminhos = async (prefixo) => (atual.listar ? atual.listar(prefixo) : []);
export const apagarCaminho = async (caminho) => { if (atual.apagar) await atual.apagar(caminho); };
/** Bytes (fotos): opcionais na troca de implementação dos testes, como listar e apagar. */
export const gravarBytes = async (caminho, bytes, tipo = "image/jpeg") => { if (atual.gravarBytes) await atual.gravarBytes(caminho, bytes, tipo); };
export const lerBytes = (caminho) => (atual.lerBytes ? atual.lerBytes(caminho) : null);
export const definirArmazem = (impl) => { atual = impl ?? real; };
