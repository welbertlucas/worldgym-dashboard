// Importação de imóveis candidatos por planilha (CSV), como o "Meus dados" do Mapfry. Tudo aqui é puro e testado: ler o CSV, achar as colunas
// pelo cabeçalho, montar a lista de imóveis e tirar os repetidos. A busca da posição (geocodificação) e a criação dos estudos ficam na tela.
import type { Modelo } from "@/lib/estudoPonto";

export const MAX_IMOVEIS_POR_IMPORTACAO = 40;

/** Lê um CSV (BOM, separador ; , ou tabulação, aspas com "" dentro, quebras de linha dentro de aspas). Linhas totalmente vazias somem. */
export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, "");
  const primeira = t.split(/\r?\n/, 1)[0] ?? "";
  const cont = (c: string) => primeira.split(c).length - 1;
  const sep = ([";", "\t", ","] as const).reduce((a, b) => (cont(b) > cont(a) ? b : a), ",");
  const linhas: string[][] = [];
  let campo = "", linha: string[] = [], aspas = false;
  const fechaCampo = () => { linha.push(campo.trim()); campo = ""; };
  const fechaLinha = () => { fechaCampo(); if (linha.some((c) => c !== "")) linhas.push(linha); linha = []; };
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (aspas) {
      if (ch === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) fechaCampo();
    else if (ch === "\n") fechaLinha();
    else if (ch !== "\r") campo += ch;
  }
  if (campo !== "" || linha.length) fechaLinha();
  return linhas;
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export type CampoImovel = "nome" | "endereco" | "m2" | "aluguel" | "lat" | "lng" | "link" | "obs" | "modelo";
const SINONIMOS: Record<CampoImovel, string[]> = {
  nome: ["nome", "imovel", "ponto", "codigo", "cod", "ref", "referencia", "titulo", "id"],
  endereco: ["endereco", "endereço", "logradouro", "rua", "localizacao", "local", "address"],
  m2: ["m2", "area", "metragem", "tamanho", "area m2", "area total", "area util"],
  aluguel: ["aluguel", "valor", "preco", "locacao", "valor aluguel", "valor do aluguel", "mensal"],
  lat: ["lat", "latitude"],
  lng: ["lng", "lon", "long", "longitude"],
  link: ["link", "url", "anuncio", "site"],
  obs: ["obs", "observacao", "observacoes", "notas", "nota", "comentario", "comentarios"],
  modelo: ["modelo", "tipo de unidade", "formato"],
};

/** Índice da coluna de cada campo, pelo cabeçalho (sem acento e sem diferença de maiúscula); -1 quando não há. */
export function mapearColunas(cabecalho: string[]): Record<CampoImovel, number> {
  const norm = cabecalho.map(semAcento);
  const out = {} as Record<CampoImovel, number>;
  const usadas = new Set<number>();
  for (const campo of Object.keys(SINONIMOS) as CampoImovel[]) {
    const nomes = SINONIMOS[campo].map(semAcento);
    let i = norm.findIndex((h, k) => !usadas.has(k) && nomes.includes(h));
    if (i < 0) i = norm.findIndex((h, k) => !usadas.has(k) && h !== "" && nomes.some((n) => n.length >= 4 && h.includes(n)));
    out[campo] = i;
    if (i >= 0) usadas.add(i);
  }
  return out;
}

/** "1.234,56", "R$ 12.000", "850 m²", "850,5" -> número; vazio ou ilegível -> null. */
export function numeroBr(v: string | undefined): number | null {
  if (!v) return null;
  let s = v.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(s)) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export interface ImovelImportado {
  /** Linha na planilha (a 1ª linha de dados é a 2), para o aviso apontar onde está o problema. */
  linha: number;
  nome: string;
  /** Texto para buscar a posição; vazio quando a planilha já traz latitude e longitude. */
  endereco: string;
  c: [number, number] | null;
  m2: number | null;
  aluguel: number | null;
  link: string;
  obs: string;
  modelo: Modelo | null;
}

export interface LeituraDaPlanilha { imoveis: ImovelImportado[]; colunas: Record<CampoImovel, number>; avisos: string[]; truncado: boolean }

const dentroDoBrasil = (la: number, ln: number) => la >= -34 && la <= 6 && ln >= -75 && ln <= -32;

/** Transforma o CSV lido em imóveis. Linha sem endereço e sem coordenadas é pulada com aviso. */
export function lerImoveis(linhas: string[][], limite = MAX_IMOVEIS_POR_IMPORTACAO): LeituraDaPlanilha {
  const avisos: string[] = [];
  const colunas = mapearColunas(linhas[0] ?? []);
  const temPosicao = colunas.endereco >= 0 || (colunas.lat >= 0 && colunas.lng >= 0);
  if (!temPosicao) return { imoveis: [], colunas, avisos: ["Não achei a coluna de endereço (ou latitude e longitude) no cabeçalho."], truncado: false };
  const imoveis: ImovelImportado[] = [];
  let truncado = false;
  for (let i = 1; i < linhas.length; i++) {
    const l = linhas[i];
    const pega = (c: CampoImovel) => (colunas[c] >= 0 ? (l[colunas[c]] ?? "").trim() : "");
    const la = numeroBr(pega("lat")), ln = numeroBr(pega("lng"));
    const c: [number, number] | null = la !== null && ln !== null && dentroDoBrasil(la, ln) ? [la, ln] : null;
    const endereco = pega("endereco").slice(0, 160);
    if (!c && endereco.length < 5) { avisos.push(`Linha ${i + 1}: sem endereço nem coordenadas; pulada.`); continue; }
    if (imoveis.length >= limite) { truncado = true; break; }
    const m2 = numeroBr(pega("m2"));
    const modeloTxt = semAcento(pega("modelo"));
    imoveis.push({
      linha: i + 1,
      nome: (pega("nome") || endereco).replace(/\s+/g, " ").slice(0, 60),
      endereco, c, m2: m2 !== null && m2 >= 300 && m2 <= 8000 ? Math.round(m2) : null,
      aluguel: numeroBr(pega("aluguel")), link: /^https?:\/\//i.test(pega("link")) ? pega("link").slice(0, 300) : "",
      obs: pega("obs").slice(0, 300), modelo: modeloTxt === "pro" ? "pro" : modeloTxt.startsWith("low") ? "low" : null,
    });
    if (m2 !== null && (m2 < 300 || m2 > 8000)) avisos.push(`Linha ${i + 1}: m² fora de 300 a 8.000; usei o padrão do modelo.`);
  }
  return { imoveis, colunas, avisos, truncado };
}

const km = (a: [number, number], b: [number, number]) => Math.hypot((a[0] - b[0]) * 110.6, (a[1] - b[1]) * 111.32 * Math.cos((a[0] * Math.PI) / 180));

/** Posições (de imóveis ou de estudos que já existem) a até `distKm` de outra já vista: a repetida sai. Devolve os índices que ficam e os que saíram. */
export function tirarRepetidos(novos: { c: [number, number] }[], existentes: [number, number][], distKm = 0.03): { ficam: number[]; repetidos: number[] } {
  const vistos = [...existentes];
  const ficam: number[] = [], repetidos: number[] = [];
  novos.forEach((n, i) => {
    if (vistos.some((v) => km(v, n.c) <= distKm)) repetidos.push(i);
    else { ficam.push(i); vistos.push(n.c); }
  });
  return { ficam, repetidos };
}
