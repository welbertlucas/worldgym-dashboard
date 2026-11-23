// PDF dos estudos de ponto (estudo de uma unidade em operação e estudo de pontos novos), no padrão do Estudo de Geomarketing da
// World Gym feito no Canva pelo designer da rede: a mesma capa (imagem da capa, sem o endereço, que é escrito por cima), títulos
// em Saira Condensed Black com o alvo vermelho, texto em Open Sans, números grandes em vermelho, notas em caixa rosada, faixa com
// o veredito e o rodapé "World Gym Brasil | Departamento de Expansão". As fontes (licença livre OFL, Google Fonts) e o jsPDF só
// são baixados quando a pessoa clica em "Exportar PDF". O conteúdo é o mesmo da tela: nada que a pessoa não veja.
import capaUrl from "@/assets/estudo-pdf/capa-fundo.jpg";
import pinoUrl from "@/assets/estudo-pdf/pino.png";
import sairaUrl from "@/assets/estudo-pdf/SairaCondensed-Black.ttf?url";
import openUrl from "@/assets/estudo-pdf/OpenSans-Regular.ttf?url";
import openNegritoUrl from "@/assets/estudo-pdf/OpenSans-Bold.ttf?url";

/** Altura das fotos de mapa (quadradas) no PDF, em mm: o mesmo tamanho em todos os temas, grande o bastante para ler o mapa. */
export const ALT_FOTO_MAPA = 128;
const VERMELHO: [number, number, number] = [196, 18, 48];
const TEXTO: [number, number, number] = [27, 33, 48];
const CINZA: [number, number, number] = [120, 124, 132];
const CINZA_CAPA: [number, number, number] = [85, 85, 85];
const LINHA: [number, number, number] = [228, 231, 236];
const ROSA: [number, number, number] = [253, 242, 243];
const ROSA_BORDA: [number, number, number] = [240, 196, 202];
const VERDE: [number, number, number] = [18, 122, 58];
const LARANJA: [number, number, number] = [180, 100, 10];

type Tom = "bom" | "atencao" | "ruim";
/** Imagem do mapa (data URL) com a legenda embaixo. */
export interface Figura { dados: string | null; legenda?: string }
export interface Numero { rotulo: string; valor: string; nota?: string }
export interface Secao {
  titulo: string; linhas: { texto: string; valor?: string; tom?: "bom" | "ruim" | "neutro" }[]; paragrafo?: string; nota?: string;
  /** Mapa da seção, logo abaixo do título. */
  foto?: Figura;
  /** Começa numa página nova (como cada tema do estudo do Canva). */
  novaPagina?: boolean;
  /** Altura máxima do mapa da seção, em mm (padrão 120). */
  altFoto?: number;
  /** Legenda de cores do mapa (quadradinho colorido + texto). */
  legenda?: { cor: string; texto: string }[];
  /** Números de destaque da seção (como na página principal). */
  destaques?: { valor: string; rotulo: string }[];
  /** Análise escrita (texto corrido e justificado, como no estudo do Canva), logo abaixo do título. */
  texto?: string[];
  /** Itens com marcador, depois do texto. */
  lista?: string[];
  /** Faixa vermelha logo abaixo do título (ex.: a recomendação da conclusão). */
  faixa?: string;
  /** Gráfico da seção (rosca com legenda ou barras horizontais). */
  grafico?: Grafico;
  /** Tabela compacta; `blocos` divide as linhas em colunas lado a lado para economizar espaço. */
  tabela?: { colunas: string[]; linhas: string[][]; larguras?: number[]; blocos?: number };
}
export type Grafico =
  | { tipo: "rosca"; titulo?: string; fatias: { rotulo: string; valor: number; cor: string }[]; centro?: string; rotuloCentro?: string }
  | { tipo: "barras"; titulo?: string; itens: { rotulo: string; valor: number; texto: string; destaque?: boolean }[] };
export interface PaginaDoEstudo {
  titulo: string; subtitulo: string;
  /** Faixa colorida com o veredito (estudo de ponto novo). */
  faixa?: { texto: string; tom: Tom };
  /** Números de destaque: grandes, em vermelho, com o rótulo embaixo. */
  destaques?: { valor: string; rotulo: string }[];
  frase?: string; tomFrase?: Tom;
  /** Mapa da página (logo depois da faixa). */
  foto?: Figura;
  /** Análise escrita, lista, destaque (caixa rosada) e gráfico logo depois dos destaques. */
  texto?: string[]; lista?: string[]; destaque?: string; grafico?: Grafico;
  numeros: Numero[]; secoes: Secao[];
}
export interface ConteudoPdf {
  arquivo: string; cabecalho: string;
  /** Mapa da primeira página (mantido para os estudos que não usam `foto` por página). */
  foto: string | null; legendaFoto?: string;
  /** Capa: `linha` ao lado do pino ("Avaliação de Ponto" / "Estudo da Unidade") e o subtítulo em vermelho (endereço ou unidade). */
  capa?: { titulo: string; linha: string; subtitulo: string };
  paginas: PaginaDoEstudo[];
  /** Tabela de comparação (estudo de vários pontos): cabeçalho e linhas. */
  comparacao?: { colunas: string[]; linhas: string[][] };
  /** Mapa com todos os pontos, na página da comparação. */
  fotoComparacao?: Figura;
}

async function comoDados(url: string): Promise<string | null> {
  if (typeof fetch === "undefined" || typeof FileReader === "undefined") return null;
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise<string>((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => falha(r.error); r.readAsDataURL(blob); });
  } catch { return null; }
}
const base64 = (dataUrl: string | null) => (dataUrl ? dataUrl.slice(dataUrl.indexOf(",") + 1) : null);

export async function gerarPdfDoEstudo(conteudo: ConteudoPdf, saida: "baixar" | "blob" = "baixar"): Promise<Blob | void> {
  const c: ConteudoPdf = conteudo;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = 18, R = 192, W = R - L, FIM = 272;
  let y = 0;
  const hoje = new Date().toLocaleDateString("pt-BR");
  const cor = (t?: string): [number, number, number] => (t === "bom" ? VERDE : t === "ruim" ? VERMELHO : t === "atencao" ? LARANJA : TEXTO);

  // fontes do Canva; se não carregarem, o PDF sai com a Helvetica (sem quebrar a exportação)
  const [capa, pino, saira, open, openNegrito] = await Promise.all([comoDados(capaUrl), comoDados(pinoUrl), comoDados(sairaUrl), comoDados(openUrl), comoDados(openNegritoUrl)]);
  let TIT = "helvetica", CORPO = "helvetica";
  try {
    if (saira) { doc.addFileToVFS("Saira.ttf", base64(saira)!); doc.addFont("Saira.ttf", "Saira", "normal"); TIT = "Saira"; }
    if (open && openNegrito) {
      doc.addFileToVFS("OpenSans.ttf", base64(open)!); doc.addFont("OpenSans.ttf", "OpenSans", "normal");
      doc.addFileToVFS("OpenSansB.ttf", base64(openNegrito)!); doc.addFont("OpenSansB.ttf", "OpenSans", "bold");
      CORPO = "OpenSans";
    }
  } catch { TIT = "helvetica"; CORPO = "helvetica"; }
  // a Helvetica do PDF não tem o sinal de menos tipográfico (−); a Open Sans tem, mas o hífen funciona nas duas
  const t = (s: string) => s.replace(/−/g, "-");
  const fonte = (tipo: "tit" | "corpo" | "negrito", tam: number) => { doc.setFont(tipo === "tit" ? TIT : CORPO, tipo === "negrito" ? "bold" : tipo === "tit" && TIT === "helvetica" ? "bold" : "normal"); doc.setFontSize(tam); };

  const rodape = () => {
    doc.setDrawColor(190, 190, 190); doc.setLineWidth(0.3); doc.line(L, 281, R, 281); doc.setLineWidth(0.2);
    fonte("corpo", 8.5); doc.setTextColor(150, 150, 150);
    doc.text("World Gym Brasil | Departamento de Expansão", L + 2, 288);
  };
  const topo = () => { y = 22; };
  const novaPagina = () => { doc.addPage(); topo(); };
  const cabe = (h: number) => { if (y + h > FIM) novaPagina(); };
  // alvo vermelho (como o ícone dos títulos do Canva) + título condensado
  const titulo = (s: string, tam = 22) => {
    cabe(18);
    const cx = L + 3.2, cy = y + 1.2;
    doc.setDrawColor(...VERMELHO); doc.setFillColor(...VERMELHO);
    doc.setLineWidth(0.9); doc.circle(cx, cy, 3, "S"); doc.setLineWidth(0.6); doc.circle(cx, cy, 1.7, "S"); doc.circle(cx, cy, 0.55, "F"); doc.setLineWidth(0.2);
    fonte("tit", tam); doc.setTextColor(10, 10, 10); doc.text(t(s), L + 9, y + 3.6);
    y += 11;
  };
  const nota = (s: string) => {
    fonte("corpo", 9.5);
    const ls = doc.splitTextToSize(t(s), W - 6); const h = ls.length * 4.6 + 4; cabe(h + 2);
    doc.setFillColor(...ROSA); doc.setDrawColor(...ROSA_BORDA); doc.rect(L, y, W, h, "FD");
    doc.setTextColor(...TEXTO); doc.text(ls, L + 3, y + 5); y += h + 4;
  };
  // imagem sem distorcer: ocupa a largura e, se for alta demais, diminui mantendo a proporção (centralizada)
  const medida = (f: Figura | undefined, altMax: number) => {
    if (!f?.dados) return { w: 0, h: 0 };
    let w = W, h = W * 0.6;
    try { const p = doc.getImageProperties(f.dados); h = (W * p.height) / p.width; } catch { /* mantém 0,6 */ }
    if (h > altMax) { w = (w * altMax) / h; h = altMax; }
    return { w, h };
  };
  const figura = (f: Figura | undefined, altMax = 120) => {
    if (!f?.dados) return;
    const { w, h } = medida(f, altMax);
    cabe(h + (f.legenda ? 9 : 4));
    const x = L + (W - w) / 2;
    doc.addImage(f.dados, f.dados.startsWith("data:image/png") ? "PNG" : "JPEG", x, y, w, h, undefined, "FAST");
    doc.setDrawColor(...VERMELHO); doc.setLineWidth(0.5); doc.rect(x, y, w, h); doc.setLineWidth(0.2); y += h + 2;
    if (f.legenda) { fonte("corpo", 8); doc.setTextColor(...CINZA); const ls = doc.splitTextToSize(t(f.legenda), W); doc.text(ls, L, y + 3); y += ls.length * 3.6 + 3; }
    y += 3;
  };

  const destaques = (ds?: { valor: string; rotulo: string }[]) => {
    if (!ds?.length) return;
    const n = ds.length, lw = W / n; cabe(30);
    ds.forEach((d, j) => {
      const cx = L + lw * j + lw / 2;
      doc.setDrawColor(...ROSA_BORDA); doc.setFillColor(255, 255, 255); doc.rect(L + lw * j + 1.5, y, lw - 3, 27, "FD");
      fonte("tit", 28); doc.setTextColor(...VERMELHO); doc.text(t(d.valor), cx, y + 12.5, { align: "center" });
      fonte("corpo", 8.5); doc.setTextColor(...CINZA); doc.text(doc.splitTextToSize(t(d.rotulo), lw - 8), cx, y + 18.5, { align: "center" });
    });
    y += 31;
  };
  // legenda de cores em duas colunas
  const legenda = (itens?: { cor: string; texto: string }[]) => {
    if (!itens?.length) return;
    const metade = Math.ceil(itens.length / 2); cabe(metade * 5.5 + 3);
    itens.forEach((it, k) => {
      const col = k < metade ? 0 : 1, lin = k < metade ? k : k - metade, x = L + col * (W / 2), yy = y + lin * 5.5;
      const hex = it.cor.replace("#", ""), rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
      doc.setFillColor(...rgb); doc.rect(x, yy, 3.6, 3.6, "F");
      fonte("corpo", 8.8); doc.setTextColor(...TEXTO); doc.text(t(it.texto), x + 5.5, yy + 3);
    });
    y += metade * 5.5 + 3;
  };

  const rgb = (hex: string) => { const h = hex.replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]; };
  // análise escrita: texto corrido e justificado, sem caixa (padrão do Canva); a caixa rosada fica só para o destaque (nota)
  const textoAnalise = (ps?: string[]) => {
    if (!ps?.length) return;
    const lh = 4.7;
    ps.forEach((p, i) => {
      fonte("corpo", 9.8);
      const ls = doc.splitTextToSize(t(p), W) as string[];
      ls.forEach((l, k) => {
        if (y + lh > FIM) novaPagina();
        fonte("corpo", 9.8); doc.setTextColor(...TEXTO);
        doc.text(l, L, y + 3.6, k === ls.length - 1 ? undefined : { align: "justify", maxWidth: W });
        y += lh;
      });
      y += i < ps.length - 1 ? 2.6 : 3.5;
    });
  };
  // lista com marcador (como no Objetivo e na Metodologia do Canva)
  const lista = (itens?: string[]) => {
    if (!itens?.length) return;
    for (const it of itens) {
      fonte("corpo", 9.8);
      const ls = doc.splitTextToSize(t(it), W - 7) as string[];
      cabe(ls.length * 4.7 + 1);
      doc.setFillColor(...TEXTO); doc.circle(L + 2, y + 2.4, 0.8, "F");
      doc.setTextColor(...TEXTO); doc.text(ls, L + 6, y + 3.6); y += ls.length * 4.7 + 1;
    }
    y += 3;
  };
  // faixa vermelha com o texto em caixa alta (como a da Conclusão do Canva)
  const faixaVermelha = (txt?: string) => {
    if (!txt) return;
    cabe(12);
    doc.setFillColor(...VERMELHO); doc.rect(L, y, W, 8.5, "F");
    fonte("negrito", 9.5); doc.setTextColor(255, 255, 255); doc.text(t(txt).toUpperCase(), L + 3, y + 5.7); y += 12;
  };
  // gráfico de rosca (fatias em polígonos) com a legenda e o percentual ao lado
  const rosca = (g: Extract<Grafico, { tipo: "rosca" }>) => {
    const total = g.fatias.reduce((a, f) => a + Math.max(0, f.valor), 0);
    if (!total) return;
    const alto = Math.max(56, g.fatias.length * 7 + 10);
    cabe(alto + (g.titulo ? 7 : 0));
    if (g.titulo) { fonte("negrito", 10); doc.setTextColor(...TEXTO); doc.text(t(g.titulo), L, y + 3.5); y += 7; }
    const cx = L + 30, cy = y + alto / 2, ro = 26, ri = 15.5;
    let a0 = -Math.PI / 2;
    for (const f of g.fatias) {
      if (f.valor <= 0) continue;
      const a1 = a0 + (f.valor / total) * Math.PI * 2, n = Math.max(4, Math.ceil(((a1 - a0) / (Math.PI * 2)) * 90));
      const pts: [number, number][] = [];
      for (let k = 0; k <= n; k++) { const a = a0 + ((a1 - a0) * k) / n; pts.push([cx + ro * Math.cos(a), cy + ro * Math.sin(a)]); }
      for (let k = n; k >= 0; k--) { const a = a0 + ((a1 - a0) * k) / n; pts.push([cx + ri * Math.cos(a), cy + ri * Math.sin(a)]); }
      const rel = pts.slice(1).map((p, k) => [p[0] - pts[k][0], p[1] - pts[k][1]]);
      doc.setFillColor(...rgb(f.cor)); doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.5);
      doc.lines(rel, pts[0][0], pts[0][1], [1, 1], "FD", true);
      a0 = a1;
    }
    doc.setLineWidth(0.2);
    if (g.centro) { fonte("tit", 15); doc.setTextColor(...TEXTO); doc.text(t(g.centro), cx, cy + 1.5, { align: "center" }); }
    if (g.rotuloCentro) { fonte("corpo", 7); doc.setTextColor(...CINZA); doc.text(t(g.rotuloCentro), cx, cy + 6, { align: "center" }); }
    // legenda
    const lx = L + 66, passo = 7, ly0 = cy - ((g.fatias.length - 1) * passo) / 2;
    g.fatias.forEach((f, k) => {
      const yy = ly0 + k * passo;
      doc.setFillColor(...rgb(f.cor)); doc.circle(lx + 1.8, yy - 1.2, 1.8, "F");
      fonte("corpo", 9.5); doc.setTextColor(...TEXTO); doc.text(t(f.rotulo), lx + 6, yy);
      fonte("negrito", 9.5); doc.text(`${((f.valor / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`, R, yy, { align: "right" });
    });
    y += alto + 3;
  };
  // barras horizontais com o valor escrito na ponta
  const barras = (g0: Extract<Grafico, { tipo: "barras" }>) => {
    const g = { ...g0, itens: g0.itens.filter((i) => Number.isFinite(i.valor) && i.valor >= 0) };
    if (!g.itens.length) return;
    const mx = Math.max(...g.itens.map((i) => i.valor), 1e-9), h = 6.2, gap = 2.4;
    cabe(g.itens.length * (h + gap) + (g.titulo ? 9 : 3));
    if (g.titulo) { fonte("negrito", 10); doc.setTextColor(...TEXTO); doc.text(t(g.titulo), L, y + 3.5); y += 8; }
    const lx = L + 42, lw = W - 42 - 30;
    for (const it of g.itens) {
      fonte("corpo", 9); doc.setTextColor(...TEXTO); doc.text(t(it.rotulo), L, y + h - 1.6);
      doc.setFillColor(...(it.destaque ? VERMELHO : ([214, 217, 224] as [number, number, number]))); doc.rect(lx, y, Math.max(0.6, (it.valor / mx) * lw), h, "F");
      fonte(it.destaque ? "negrito" : "corpo", 9); doc.text(t(it.texto), lx + (it.valor / mx) * lw + 2, y + h - 1.6);
      y += h + gap;
    }
    y += 2;
  };
  // tabela compacta (em blocos lado a lado)
  const tabela = (tb: NonNullable<Secao["tabela"]>) => {
    const blocos = Math.max(1, tb.blocos ?? 1), gapB = 6, bw = (W - gapB * (blocos - 1)) / blocos;
    const fr = tb.larguras ?? tb.colunas.map(() => 1), soma = fr.reduce((a, b) => a + b, 0), cw = fr.map((x) => (x / soma) * bw);
    const porBloco = Math.ceil(tb.linhas.length / blocos), hl = 5.2;
    // a última coluna vai à direita só quando é número (km, %, contagem)
    const numerica = tb.linhas.length > 0 && tb.linhas.every((l) => /^[\d.,%\s\u2212-]*$/.test(l[l.length - 1] ?? ""));
    const cab = () => {
      for (let b = 0; b < blocos; b++) {
        const x0 = L + b * (bw + gapB);
        doc.setFillColor(...VERMELHO); doc.rect(x0, y, bw, 6.4, "F");
        fonte("negrito", 8); doc.setTextColor(255, 255, 255);
        let x = x0; tb.colunas.forEach((c, j) => { const dir = numerica && j === tb.colunas.length - 1 && j > 0; doc.text(t(c), dir ? x + cw[j] - 1.5 : x + 1.5, y + 4.4, dir ? { align: "right" } : undefined); x += cw[j]; });
      }
      y += 7.4;
    };
    let i = 0;
    while (i < porBloco) {
      const cabem = Math.max(1, Math.floor((FIM - y - 8) / hl));
      if (cabem < 3) { novaPagina(); continue; }
      cab();
      const fim = Math.min(porBloco, i + cabem);
      for (let r = i; r < fim; r++) {
        for (let b = 0; b < blocos; b++) {
          const linha = tb.linhas[b * porBloco + r];
          if (!linha) continue;
          const x0 = L + b * (bw + gapB);
          if (r % 2) { doc.setFillColor(248, 249, 251); doc.rect(x0, y - 0.2, bw, hl, "F"); }
          fonte("corpo", 8); doc.setTextColor(...TEXTO);
          let x = x0;
          linha.forEach((c, j) => {
            const dir = numerica && j === linha.length - 1 && j > 0, txt = doc.splitTextToSize(t(c), cw[j] - 2)[0] as string;
            doc.text(txt, dir ? x + cw[j] - 1.5 : x + 1.5, y + 3.5, dir ? { align: "right" } : undefined); x += cw[j];
          });
        }
        y += hl;
      }
      i = fim;
      if (i < porBloco) novaPagina();
    }
    y += 3;
  };

  // capa: a imagem da capa do Canva e, por cima, o pino + tipo do estudo e o subtítulo em vermelho
  const temCapa = Boolean(c.capa);
  if (c.capa) {
    if (capa) doc.addImage(capa, "JPEG", 0, 0, 210, 297, undefined, "FAST");
    else { fonte("tit", 40); doc.setTextColor(10, 10, 10); doc.text("Estudo de Geomarketing", 105, 66, { align: "center" }); doc.setFillColor(...VERMELHO); doc.rect(90, 77, 30, 1, "F"); }
    fonte("corpo", 25); doc.setTextColor(...CINZA_CAPA);
    const linha = t(c.capa.linha), lw = doc.getTextWidth(linha), pw = pino ? 9.5 : 0, gap = pino ? 2.5 : 0;
    const x0 = 105 - (lw + pw + gap) / 2;
    if (pino) doc.addImage(pino, "PNG", x0, 92.5, pw, pw * (106 / 87), undefined, "FAST");
    doc.text(linha, x0 + pw + gap, 103.5);
    fonte("negrito", 13.5); doc.setTextColor(...VERMELHO);
    doc.text(doc.splitTextToSize(t(c.capa.subtitulo), 170), 105, 116, { align: "center" });
    fonte("corpo", 9.5); doc.setTextColor(...CINZA); doc.text(hoje, 105, 147, { align: "center" });
    novaPagina();
  } else topo();

  for (let i = 0; i < c.paginas.length; i++) {
    const p = c.paginas[i];
    if (i > 0) novaPagina();
    titulo(p.titulo, 26);
    if (p.subtitulo) { fonte("corpo", 10); doc.setTextColor(...CINZA); doc.text(t(p.subtitulo), L, y); y += 7; } else y += 2;
    if (p.faixa) {
      const fundo = p.faixa.tom === "bom" ? VERDE : p.faixa.tom === "atencao" ? LARANJA : VERMELHO;
      doc.setFillColor(...fundo); doc.rect(L, y, W, 9, "F");
      fonte("negrito", 10); doc.setTextColor(255, 255, 255); doc.text(t(p.faixa.texto).toUpperCase(), L + 3, y + 6); y += 13;
    }
    figura(p.foto ?? (i === 0 && c.foto ? { dados: c.foto, legenda: c.legendaFoto } : undefined), p.grafico || p.texto?.length ? 100 : ALT_FOTO_MAPA);
    destaques(p.destaques);
    if (p.frase) nota(p.frase);
    textoAnalise(p.texto);
    lista(p.lista);
    if (p.destaque) nota(p.destaque);
    if (p.grafico?.tipo === "rosca") rosca(p.grafico); else if (p.grafico?.tipo === "barras") barras(p.grafico);
    const n = p.numeros, larg = (W - 3 * 3) / 4;
    for (let k = 0; k < n.length; k += 4) {
      cabe(20);
      n.slice(k, k + 4).forEach((x, j) => {
        const bx = L + j * (larg + 3);
        doc.setDrawColor(...LINHA); doc.setFillColor(248, 249, 251); doc.roundedRect(bx, y, larg, 18, 2, 2, "FD");
        fonte("corpo", 7.5); doc.setTextColor(...CINZA); doc.text(doc.splitTextToSize(t(x.rotulo), larg - 4)[0], bx + 2.5, y + 5);
        fonte("negrito", 12); doc.setTextColor(...TEXTO); doc.text(t(x.valor), bx + 2.5, y + 11.5);
        if (x.nota) { fonte("corpo", 7); doc.setTextColor(...CINZA); doc.text(doc.splitTextToSize(t(x.nota), larg - 4)[0], bx + 2.5, y + 15.5); }
      });
      y += 22;
    }
    for (const s of p.secoes) {
      if (s.novaPagina) novaPagina(); else y += 3;
      // título não fica sozinho no pé da página: precisa caber junto com o mapa (ou com a primeira linha)
      cabe(14 + (s.foto?.dados ? medida(s.foto, s.altFoto ?? 120).h + 9 : 10));
      if (s.titulo) titulo(s.titulo);
      faixaVermelha(s.faixa);
      textoAnalise(s.texto);
      lista(s.lista);
      figura(s.foto, s.altFoto ?? 120);
      legenda(s.legenda);
      destaques(s.destaques);
      if (s.grafico?.tipo === "rosca") rosca(s.grafico); else if (s.grafico?.tipo === "barras") barras(s.grafico);
      if (s.tabela) tabela(s.tabela);
      fonte("corpo", 9.5);
      for (const l of s.linhas) {
        const ls = doc.splitTextToSize(t(l.texto), l.valor ? W - 45 : W);
        cabe(ls.length * 4.8 + 2);
        fonte("corpo", 9.5); doc.setTextColor(...cor(l.tom)); doc.text(ls, L, y + 3.6);
        if (l.valor) { fonte("negrito", 9.5); doc.setTextColor(...TEXTO); doc.text(t(l.valor), R, y + 3.6, { align: "right" }); }
        y += ls.length * 4.8 + 1; doc.setDrawColor(...LINHA); doc.line(L, y, R, y); y += 1;
      }
      if (s.paragrafo) {
        fonte("corpo", 8.5); doc.setTextColor(...CINZA);
        const ls = doc.splitTextToSize(t(s.paragrafo), W); cabe(ls.length * 4 + 2); doc.text(ls, L, y + 3.5); y += ls.length * 4 + 2;
      }
      if (s.nota) { y += 2; nota(s.nota); }
    }
  }
  if (c.comparacao) {
    novaPagina(); titulo("Comparação dos pontos");
    figura(c.fotoComparacao, 110);
    const cols = c.comparacao.colunas, lw = W / cols.length;
    doc.setFillColor(...VERMELHO); doc.rect(L, y, W, 8, "F");
    fonte("negrito", 8.5); doc.setTextColor(255, 255, 255);
    cols.forEach((s, j) => doc.text(doc.splitTextToSize(t(s), lw - 2)[0], L + j * lw + 1.5, y + 5.4)); y += 10;
    fonte("corpo", 9); doc.setTextColor(...TEXTO);
    for (const linha of c.comparacao.linhas) {
      const alturas = linha.map((s) => doc.splitTextToSize(t(s), lw - 2).length);
      const h = Math.max(...alturas) * 4.4 + 2; cabe(h);
      fonte("corpo", 9); doc.setTextColor(...TEXTO);
      linha.forEach((s, j) => doc.text(doc.splitTextToSize(t(s), lw - 2), L + j * lw + 1.5, y + 3.5));
      y += h; doc.setDrawColor(...LINHA); doc.line(L, y, R, y); y += 1;
    }
  }
  // rodapé e número da página (a capa do Canva já tem o rodapé dela e não leva número)
  const total = doc.getNumberOfPages(), primeira = temCapa ? 2 : 1;
  for (let i = primeira; i <= total; i++) {
    doc.setPage(i); rodape();
    fonte("corpo", 8.5); doc.setTextColor(150, 150, 150); doc.text(`${i - primeira + 1} de ${total - primeira + 1}`, R, 288, { align: "right" });
  }
  if (saida === "blob") return doc.output("blob");
  doc.save(c.arquivo);
}

/** Nome de arquivo sem acento nem espaço. */
export const nomeDoArquivo = (base: string) => `${base.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/(^-|-$)/g, "").toLowerCase()}.pdf`;
