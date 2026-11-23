// PDF dos estudos de ponto (estudo de uma unidade em operação e estudo de pontos novos), no padrão do estudo de geomarketing da
// World Gym: capa com o logo, títulos de seção com marca vermelha, números grandes em vermelho, notas em caixa rosada, faixa com o
// veredito e o rodapé "World Gym Brasil | Departamento de Expansão". O jsPDF só é baixado quando a pessoa clica em "Exportar PDF".
// O conteúdo é o mesmo da tela: nada que a pessoa não veja.
import logoUrl from "@/assets/wg-logo.png";

const VERMELHO: [number, number, number] = [196, 18, 48];
const TEXTO: [number, number, number] = [27, 33, 48];
const CINZA: [number, number, number] = [120, 124, 132];
const LINHA: [number, number, number] = [228, 231, 236];
const ROSA: [number, number, number] = [253, 242, 243];
const ROSA_BORDA: [number, number, number] = [240, 196, 202];
const VERDE: [number, number, number] = [18, 122, 58];
const LARANJA: [number, number, number] = [180, 100, 10];

type Tom = "bom" | "atencao" | "ruim";
export interface Numero { rotulo: string; valor: string; nota?: string }
export interface Secao { titulo: string; linhas: { texto: string; valor?: string; tom?: "bom" | "ruim" | "neutro" }[]; paragrafo?: string; nota?: string }
export interface PaginaDoEstudo {
  titulo: string; subtitulo: string;
  /** Faixa colorida com o veredito (estudo de ponto novo). */
  faixa?: { texto: string; tom: Tom };
  /** Números de destaque: grandes, em vermelho, com o rótulo embaixo. */
  destaques?: { valor: string; rotulo: string }[];
  frase?: string; tomFrase?: Tom;
  numeros: Numero[]; secoes: Secao[];
}
export interface ConteudoPdf {
  arquivo: string; cabecalho: string; foto: string | null; legendaFoto?: string;
  /** Capa: tipo do estudo ("Estudo de ponto" / "Estudo da unidade"), linha com o pino e o subtítulo em vermelho. */
  capa?: { titulo: string; linha: string; subtitulo: string };
  paginas: PaginaDoEstudo[];
  /** Tabela de comparação (estudo de vários pontos): cabeçalho e linhas. */
  comparacao?: { colunas: string[]; linhas: string[][] };
}

async function imagemComoDados(url: string): Promise<string | null> {
  if (typeof fetch === "undefined" || typeof FileReader === "undefined") return null;
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise<string>((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => falha(r.error); r.readAsDataURL(blob); });
  } catch { return null; }
}

export async function gerarPdfDoEstudo(conteudo: ConteudoPdf, saida: "baixar" | "blob" = "baixar"): Promise<Blob | void> {
  // A fonte padrão do PDF não tem o sinal de menos tipográfico (−): vira hífen, senão o texto sai espaçado e com aspas.
  const c: ConteudoPdf = JSON.parse(JSON.stringify(conteudo).replace(/\u2212/g, "-"));
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = 16, R = 194, W = R - L, FIM = 274;
  let y = 0;
  const hoje = new Date().toLocaleDateString("pt-BR");
  const cor = (t?: string): [number, number, number] => (t === "bom" ? VERDE : t === "ruim" ? VERMELHO : t === "atencao" ? LARANJA : TEXTO);
  const logo = await imagemComoDados(logoUrl);

  const rodape = () => {
    doc.setDrawColor(...LINHA); doc.line(L, 281, R, 281);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...CINZA);
    doc.text("World Gym Brasil | Departamento de Expansão", L, 287);
  };
  const topo = () => { y = 20; };
  const novaPagina = () => { doc.addPage(); topo(); };
  const cabe = (h: number) => { if (y + h > FIM) novaPagina(); };
  const titulo = (t: string) => {
    cabe(16);
    doc.setFillColor(...VERMELHO); doc.roundedRect(L, y - 1, 5, 5, 1, 1, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.setTextColor(...TEXTO); doc.text(t, L + 8, y + 3.6);
    y += 10;
  };
  const nota = (t: string) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    const ls = doc.splitTextToSize(t, W - 6); const h = ls.length * 4.3 + 4; cabe(h + 2);
    doc.setFillColor(...ROSA); doc.setDrawColor(...ROSA_BORDA); doc.rect(L, y, W, h, "FD");
    doc.setTextColor(...TEXTO); doc.text(ls, L + 3, y + 4.6); y += h + 4;
  };

  // capa
  if (c.capa) {
    if (logo) doc.addImage(logo, "PNG", 82.5, 38, 45, 45, undefined, "FAST");
    doc.setFont("helvetica", "bold"); doc.setFontSize(30); doc.setTextColor(...TEXTO); doc.text(c.capa.titulo, 105, 108, { align: "center" });
    doc.setFillColor(...VERMELHO); doc.rect(91, 115, 28, 1.2, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(15); doc.setTextColor(...CINZA); doc.text(c.capa.linha, 105, 128, { align: "center" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(...VERMELHO); doc.text(doc.splitTextToSize(c.capa.subtitulo, 160), 105, 138, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...TEXTO); doc.text(`World Gym Brasil | Departamento de Expansão · ${hoje}`, 105, 158, { align: "center" });
    novaPagina();
  } else topo();

  for (let i = 0; i < c.paginas.length; i++) {
    const p = c.paginas[i];
    if (i > 0) novaPagina();
    titulo(p.titulo);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...CINZA); doc.text(p.subtitulo, L, y); y += 6;
    if (p.faixa) {
      const fundo = p.faixa.tom === "bom" ? VERDE : p.faixa.tom === "atencao" ? LARANJA : VERMELHO;
      doc.setFillColor(...fundo); doc.rect(L, y, W, 9, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(255, 255, 255); doc.text(p.faixa.texto.toUpperCase(), L + 3, y + 6); y += 13;
    }
    if (i === 0 && c.foto) {
      const h = 96; cabe(h + 8);
      doc.addImage(c.foto, "JPEG", L, y, W, h, undefined, "FAST");
      doc.setDrawColor(...VERMELHO); doc.setLineWidth(0.4); doc.rect(L, y, W, h); doc.setLineWidth(0.2); y += h + 2;
      if (c.legendaFoto) { doc.setFontSize(8); doc.setTextColor(...CINZA); doc.text(c.legendaFoto, L, y + 3); y += 6; }
      y += 2;
    }
    if (p.destaques?.length) {
      const n = p.destaques.length, lw = W / n; cabe(26);
      p.destaques.forEach((d, j) => {
        const cx = L + lw * j + lw / 2;
        doc.setFont("helvetica", "bold"); doc.setFontSize(26); doc.setTextColor(...VERMELHO); doc.text(d.valor, cx, y + 10, { align: "center" });
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...CINZA); doc.text(doc.splitTextToSize(d.rotulo, lw - 6), cx, y + 16, { align: "center" });
      });
      y += 26;
    }
    if (p.frase) nota(p.frase);
    const n = p.numeros, larg = (W - 3 * 3) / 4;
    for (let k = 0; k < n.length; k += 4) {
      cabe(20);
      n.slice(k, k + 4).forEach((x, j) => {
        const bx = L + j * (larg + 3);
        doc.setDrawColor(...LINHA); doc.setFillColor(248, 249, 251); doc.roundedRect(bx, y, larg, 18, 2, 2, "FD");
        doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...CINZA); doc.text(doc.splitTextToSize(x.rotulo, larg - 4)[0], bx + 2.5, y + 5);
        doc.setFont("helvetica", "bold"); doc.setFontSize(12.5); doc.setTextColor(...TEXTO); doc.text(x.valor, bx + 2.5, y + 11.5);
        if (x.nota) { doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...CINZA); doc.text(doc.splitTextToSize(x.nota, larg - 4)[0], bx + 2.5, y + 15.5); }
      });
      y += 22;
    }
    for (const s of p.secoes) {
      y += 2; titulo(s.titulo);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
      for (const l of s.linhas) {
        const ls = doc.splitTextToSize(l.texto, l.valor ? W - 45 : W);
        cabe(ls.length * 4.6 + 2);
        doc.setTextColor(...cor(l.tom)); doc.text(ls, L, y + 3.5);
        if (l.valor) { doc.setTextColor(...TEXTO); doc.text(l.valor, R, y + 3.5, { align: "right" }); }
        y += ls.length * 4.6 + 1; doc.setDrawColor(...LINHA); doc.line(L, y, R, y); y += 1;
      }
      if (s.paragrafo) {
        doc.setFontSize(8.5); doc.setTextColor(...CINZA);
        const ls = doc.splitTextToSize(s.paragrafo, W); cabe(ls.length * 4 + 2); doc.text(ls, L, y + 3); y += ls.length * 4 + 2; doc.setFontSize(9.5);
      }
      if (s.nota) { y += 2; nota(s.nota); }
      y += 2;
    }
  }
  if (c.comparacao) {
    novaPagina(); titulo("Comparação dos pontos");
    const cols = c.comparacao.colunas, lw = W / cols.length;
    doc.setFillColor(...VERMELHO); doc.rect(L, y, W, 8, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(255, 255, 255);
    cols.forEach((t, j) => doc.text(doc.splitTextToSize(t, lw - 2)[0], L + j * lw + 1.5, y + 5.4)); y += 10;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...TEXTO);
    for (const linha of c.comparacao.linhas) {
      const alturas = linha.map((t) => doc.splitTextToSize(t, lw - 2).length);
      const h = Math.max(...alturas) * 4.4 + 2; cabe(h);
      linha.forEach((t, j) => doc.text(doc.splitTextToSize(t, lw - 2), L + j * lw + 1.5, y + 3.5));
      y += h; doc.setDrawColor(...LINHA); doc.line(L, y, R, y); y += 1;
    }
  }
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i); rodape();
    doc.setFontSize(8.5); doc.setTextColor(...CINZA); doc.text(`${i} de ${total}`, R, 287, { align: "right" });
  }
  if (saida === "blob") return doc.output("blob");
  doc.save(c.arquivo);
}

/** Nome de arquivo sem acento nem espaço. */
export const nomeDoArquivo = (base: string) => `${base.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/(^-|-$)/g, "").toLowerCase()}.pdf`;
