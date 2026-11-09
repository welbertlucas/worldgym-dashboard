// Leitura e gravação de JSON privado no Vercel Blob (usuários e registro de acessos).
// `definirArmazem` troca a implementação nos testes, para não depender de rede.
import { put, get } from "@vercel/blob";

const real = {
  async ler(caminho) {
    const r = await get(caminho, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200) return null;
    return JSON.parse(await new Response(r.stream).text());
  },
  async gravar(caminho, dados) {
    await put(caminho, JSON.stringify(dados), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });
  },
};

let atual = real;

export const lerJson = (caminho) => atual.ler(caminho);
export const gravarJson = (caminho, dados) => atual.gravar(caminho, dados);
export const definirArmazem = (impl) => { atual = impl ?? real; };
