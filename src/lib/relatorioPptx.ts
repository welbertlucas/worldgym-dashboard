// Desenha a apresentação (.pptx editável) do Relatório a partir do modelo montado em src/data/relatorio.ts.
// Gráficos nativos do PowerPoint (dá para editar os números), cores e disposição do Report Operacional da rede.
// O pptxgenjs só é baixado quando a pessoa clica em "Gerar" (import dinâmico).
import type { Formato, ModeloRelatorio } from "@/data/relatorio";
import capaFoto from "@/assets/relatorio/capa.jpg";
import fechoFoto from "@/assets/relatorio/fecho.jpg";
import logoImg from "@/assets/relatorio/logo.png";
import fundoImg from "@/assets/relatorio/fundo.jpg";

const VINHO = "700E0E", VERM = "D1141B", PRETO = "111111", TEXTO = "2B2B2B", CINZA = "6B6B6B", VERDE = "1E8E3E";
/** Títulos: Impact existe em todo Windows e Mac. A fonte do modelo (Gothiks) só vale se instalada em quem abre o arquivo. */
const TIT = "Impact", TXT = "Montserrat";

const FORMATO_EXCEL: Record<Formato, string> = { brl: '"R$ "#,##0', brl2: '"R$ "#,##0.00', int: "#,##0", pct: '0.0"%"', nota: "0.0" };

export interface OpcoesGeracao {
  /** E-mail de quem gera, para o rodapé (rastreio). */
  email: string;
  /** Palavra grande da capa (ex.: SEMANAL). */
  titulo?: string;
  /** Data e hora da geração. */
  em?: Date;
}

const dataBR = (d: Date) => d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const sinal = (n: number, d = 2) => (n >= 0 ? "+" : "") + n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) + "%";

/** Imagens do pacote viram texto base64 (o pptxgenjs embute no arquivo). */
async function comoDados(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return await new Promise<string>((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => falha(r.error); r.readAsDataURL(blob); });
}

export function nomeDoArquivo(m: ModeloRelatorio): string {
  const escopo = m.escopo.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `Atlas-Relatorio-${m.mes}-${escopo || "Rede"}`;
}

export async function gerarApresentacao(m: ModeloRelatorio, op: OpcoesGeracao): Promise<void> {
  const [{ default: PptxGenJS }, capa, fecho, logo, fundo] = await Promise.all([import("pptxgenjs"), comoDados(capaFoto), comoDados(fechoFoto), comoDados(logoImg), comoDados(fundoImg)]);
  const quando = op.em ?? new Date();
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13,33 x 7,5 pol.
  pptx.title = `World Gym · Report Operacional ${m.mesCurto}`;
  pptx.author = "World Gym Atlas";
  let n = 0;
  const rodape = (s: ReturnType<typeof pptx.addSlide>) => s.addText(`Fonte: ABC EVO · gerado pelo Atlas por ${op.email || "usuário"} em ${dataBR(quando)} · ${m.periodo}   ${n}`, { x: 0.4, y: 7.1, w: 12.5, h: 0.3, fontFace: TXT, fontSize: 9, color: CINZA });
  // O fundo (papel amassado, aba vinho com o logo no canto e pontos no rodapé) já vem pronto na imagem.
  const slideDeDados = () => { n++; const s = pptx.addSlide(); s.background = { data: fundo }; return s; };

  // Capa
  {
    n++;
    const s = pptx.addSlide(); s.background = { color: "000000" };
    s.addImage({ data: capa, x: 0, y: 0, w: 13.333, h: 7.5 });
    s.addText("REPORT", { x: 0, y: 1.65, w: 13.33, h: 0.7, fontFace: TIT, fontSize: 48, color: "FFFFFF", align: "center" });
    s.addText((op.titulo?.trim() || "SEMANAL").toUpperCase(), { x: 0, y: 2.1, w: 13.33, h: 2.2, fontFace: TIT, fontSize: 130, color: "A50001", align: "center" });
    s.addText(m.periodo, { x: 0, y: 4.15, w: 13.33, h: 0.7, fontFace: TIT, fontSize: 40, color: "FFFFFF", align: "center" });
    if (m.escopo !== "Rede") s.addText(m.escopo.toUpperCase(), { x: 0, y: 5.0, w: 13.33, h: 0.5, fontFace: TXT, fontSize: 20, color: "FFFFFF", align: "center" });
    s.addImage({ data: logo, x: 5.3, y: 6.5, w: 2.72, h: 0.63 });
  }

  // Números gerais
  if (m.big) {
    const s = slideDeDados();
    m.big.forEach((k, i) => {
      const col = i % 3, lin = Math.floor(i / 3);
      const x = 0.6 + col * 2.95, y = 1.5 + lin * 2.7;
      s.addText(k.valor, { x, y, w: 2.9, h: 0.9, fontFace: TIT, fontSize: 36, color: PRETO });
      s.addText(k.nome, { x, y: y + 0.85, w: 2.9, h: 0.45, fontFace: TIT, fontSize: 18, color: VINHO });
      if (k.variacao !== null) {
        const bom = k.menorMelhor ? k.variacao <= 0 : k.variacao >= 0;
        const txt = k.emPontos ? `${k.variacao >= 0 ? "+" : ""}${k.variacao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.` : sinal(k.variacao);
        s.addText(txt, { x, y: y + 1.3, w: 2.9, h: 0.3, fontFace: TXT, fontSize: 12, bold: true, color: bom ? VERDE : VERM });
      }
      if (k.anterior && m.mesAnteriorCurto) s.addText(`${k.anterior}  ·  ${m.mesAnteriorCurto}`, { x, y: y + 1.6, w: 2.9, h: 0.3, fontFace: TXT, fontSize: 11, color: CINZA });
    });
    s.addText(`${m.nUnidades} ${m.nUnidades === 1 ? "unidade" : "unidades"}`, { x: 9.4, y: 1.8, w: 3.8, h: 0.9, fontFace: TIT, fontSize: 44, color: VINHO });
    s.addText(m.escopo === "Rede" ? "na rede World Gym" : m.escopo, { x: 9.4, y: 2.75, w: 3.5, h: 0.5, fontFace: TXT, fontSize: 14, color: PRETO });
    if (m.conversao !== null) {
      const cv = Math.round(m.conversao);
      s.addChart(pptx.ChartType.doughnut, [{ name: "Conversão", labels: ["Convertidas", "Demais"], values: [cv, 100 - cv] }],
        { x: 9.6, y: 3.7, w: 3.2, h: 2.7, holeSize: 62, chartColors: [VINHO, "D9D3CF"], showLegend: false, showLabel: false, showValue: false, showPercent: false });
      s.addText(`${cv}%`, { x: 9.6, y: 4.65, w: 3.2, h: 0.7, fontFace: TIT, fontSize: 28, color: VINHO, align: "center" });
      s.addText("Índice de conversão de vendas", { x: 9.4, y: 6.4, w: 3.6, h: 0.35, fontFace: TXT, fontSize: 11, italic: true, color: PRETO, align: "center" });
    }
    rodape(s);
  }

  // Rankings (gráfico de barras nativo)
  for (const r of m.rankings) {
    const s = slideDeDados();
    s.addText(r.titulo.toUpperCase(), { x: 2.6, y: 0.08, w: 8.2, h: 0.8, fontFace: TIT, fontSize: 34, color: TEXTO, align: "center" });
    s.addText(r.subtitulo, { x: 2.6, y: 0.82, w: 8.2, h: 0.3, fontFace: TXT, fontSize: 10, color: CINZA, align: "center" });
    const ord = [...r.itens].sort((a, b) => a[1] - b[1]); // a barra horizontal desenha de baixo para cima
    s.addChart(pptx.ChartType.bar, [{ name: r.titulo, labels: ord.map((x) => x[0]), values: ord.map((x) => x[1]) }], {
      x: 0.5, y: 1.15, w: r.nota ? 9.6 : 12.3, h: 5.9, barDir: "bar", chartColors: [VINHO], showValue: true, dataLabelFormatCode: FORMATO_EXCEL[r.formato],
      dataLabelColor: "FFFFFF", dataLabelFontSize: 9, dataLabelFontFace: TXT, dataLabelPosition: "inEnd", catAxisLabelFontSize: 10, catAxisLabelFontFace: TXT,
      valAxisHidden: true, valGridLine: { color: "DDD6D1", size: 0.5 }, catGridLine: { style: "none" }, barGapWidthPct: 35, showLegend: false,
    });
    if (r.nota) s.addText(r.nota, { x: 10.2, y: 5.0, w: 2.9, h: 1.8, fontFace: TXT, fontSize: 10, color: PRETO, valign: "top" });
    rodape(s);
  }

  // Encerramento
  {
    n++;
    const s = pptx.addSlide(); s.background = { color: VINHO };
    s.addImage({ data: fecho, x: 0, y: 0, w: 13.333, h: 7.5 });
  }

  await pptx.writeFile({ fileName: `${nomeDoArquivo(m)}.pptx` });
}
