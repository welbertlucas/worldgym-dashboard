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
export const gravarJson = (caminho, dados) => { guardados.delete(caminho); return atual.gravar(caminho, dados); };

// Leitura guardada na memória do servidor por alguns minutos, para arquivos grandes que quase não mudam (Censo, premissas, áreas de
// deslocamento): enquanto a função está aquecida, abrir o menu de novo não relê do Blob. Gravar pelo próprio servidor limpa o guardado;
// o que um script grava direto no Blob aparece em até `validadeMs`. Arquivo ausente não fica guardado (pode passar a existir).
const guardados = new Map();
export function lerJsonGuardado(caminho, validadeMs) {
  const agora = Date.now(), g = guardados.get(caminho);
  if (g && agora - g.em < validadeMs) return g.valor;
  const valor = atual.ler(caminho).then((v) => { if (v == null) guardados.delete(caminho); return v; }, (e) => { guardados.delete(caminho); throw e; });
  guardados.set(caminho, { em: agora, valor });
  return valor;
}
export const limparGuardados = () => guardados.clear();
/** Listar e apagar são opcionais na troca de implementação dos testes (quem não define, não lista nem apaga). */
export const listarCaminhos = async (prefixo) => (atual.listar ? atual.listar(prefixo) : []);
export const apagarCaminho = async (caminho) => { if (atual.apagar) await atual.apagar(caminho); };
/** Bytes (fotos): opcionais na troca de implementação dos testes, como listar e apagar. */
export const gravarBytes = async (caminho, bytes, tipo = "image/jpeg") => { if (atual.gravarBytes) await atual.gravarBytes(caminho, bytes, tipo); };
export const lerBytes = (caminho) => (atual.lerBytes ? atual.lerBytes(caminho) : null);
export const definirArmazem = (impl) => { atual = impl ?? real; guardados.clear(); };
