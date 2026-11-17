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
    // Capa: REPORT, o nome da unidade (ou da rede) em destaque e o período escolhido logo abaixo.
    const nome = (m.escopo === "Rede" ? "Rede World Gym" : m.escopo).toUpperCase();
    const tam = Math.min(130, Math.floor((12.3 * 72) / (nome.length * 0.56))); // nomes longos encolhem para caber na largura
    s.addText(nome, { x: 0.5, y: 2.1, w: 12.33, h: 2.2, fontFace: TIT, fontSize: tam, color: "A50001", align: "center", valign: "middle" });
    s.addText(m.periodo, { x: 0, y: 4.35, w: 13.33, h: 0.7, fontFace: TIT, fontSize: 40, color: "FFFFFF", align: "center" });
    s.addImage({ data: logo, x: 5.3, y: 6.5, w: 2.72, h: 0.63 });
  }

  // Números gerais
  if (m.big) {
    const s = slideDeDados();
    m.big.forEach((k, i) => {
      const col = i % 3, lin = Math.floor(i / 3);
      const x = 0.5 + col * 3.15, y = 1.35 + lin * 2.8;
      // valores longos (R$ 7.021.350) encolhem para caber na coluna
      const tam = k.valor.length > 11 ? 36 : k.valor.length > 9 ? 42 : 48;
      s.addText(k.valor, { x, y, w: 3.1, h: 1.0, fontFace: TIT, fontSize: tam, color: PRETO, valign: "middle" });
      s.addText(k.nome, { x, y: y + 0.95, w: 3.1, h: 0.5, fontFace: TIT, fontSize: 24, color: VINHO });
      if (k.variacao !== null) {
        const bom = k.menorMelhor ? k.variacao <= 0 : k.variacao >= 0;
        const txt = k.emPontos ? `${k.variacao >= 0 ? "+" : ""}${k.variacao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.` : sinal(k.variacao);
        s.addText(txt, { x, y: y + 1.45, w: 3.1, h: 0.45, fontFace: TXT, fontSize: 20, bold: true, color: bom ? VERDE : VERM });
      }
      if (k.anterior && m.mesAnteriorCurto) s.addText(`${k.anterior}  ·  ${m.mesAnteriorCurto}`, { x, y: y + 1.9, w: 3.1, h: 0.4, fontFace: TXT, fontSize: 15, color: CINZA });
    });
    s.addText(`${m.nUnidades} ${m.nUnidades === 1 ? "unidade" : "unidades"}`, { x: 10.0, y: 1.35, w: 3.2, h: 0.9, fontFace: TIT, fontSize: 48, color: VINHO });
    s.addText(m.escopo === "Rede" ? "na rede World Gym" : m.escopo, { x: 10.0, y: 2.2, w: 3.2, h: 0.5, fontFace: TXT, fontSize: 16, color: PRETO });
    if (m.conversao !== null) {
      const cv = Math.round(m.conversao);
      s.addChart(pptx.ChartType.doughnut, [{ name: "Conversão", labels: ["Convertidas", "Demais"], values: [cv, 100 - cv] }],
        { x: 10.0, y: 2.85, w: 3.1, h: 2.6, holeSize: 62, chartColors: [VINHO, "D9D3CF"], showLegend: false, showLabel: false, showValue: false, showPercent: false });
      s.addText(`${cv}%`, { x: 10.0, y: 3.8, w: 3.1, h: 0.7, fontFace: TIT, fontSize: 40, color: VINHO, align: "center" });
      s.addText("Índice de conversão de vendas", { x: 9.9, y: 5.5, w: 3.3, h: 0.4, fontFace: TXT, fontSize: 14, italic: true, color: PRETO, align: "center" });
      if (m.oportunidades !== null) s.addText(`${m.oportunidades.toLocaleString("pt-BR")} oportunidades cadastradas`, { x: 9.9, y: 5.9, w: 3.3, h: 0.7, fontFace: TXT, fontSize: 16, bold: true, color: VINHO, align: "center", valign: "top" });
    }
    rodape(s);
  }

  // Rankings (gráfico de barras nativo)
  for (const r of m.rankings) {
    const s = slideDeDados();
    s.addText(r.titulo.toUpperCase(), { x: 2.6, y: 0.08, w: 8.2, h: 0.8, fontFace: TIT, fontSize: 34, color: TEXTO, align: "center" });
    s.addText(r.subtitulo, { x: 2.6, y: 0.82, w: 8.2, h: 0.3, fontFace: TXT, fontSize: 10, color: CINZA, align: "center" });
    if (r.cartao) {
      // Uma unidade só: valor em destaque, variação e o valor do ano anterior
      const c = r.cartao;
      const tam = c.valor.length > 11 ? 72 : c.valor.length > 8 ? 88 : 110;
      s.addText(c.valor, { x: 0.8, y: 1.9, w: 11.7, h: 1.9, fontFace: TIT, fontSize: tam, color: VINHO, align: "center", valign: "middle" });
      if (c.variacao !== null) {
        const bom = c.menorMelhor ? c.variacao <= 0 : c.variacao >= 0;
        const txt = c.emPontos ? `${c.variacao >= 0 ? "+" : ""}${c.variacao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.` : sinal(c.variacao);
        s.addText(txt, { x: 0.8, y: 4.0, w: 11.7, h: 0.8, fontFace: TXT, fontSize: 40, bold: true, color: bom ? VERDE : VERM, align: "center" });
      }
      if (c.anterior) s.addText(c.anterior, { x: 0.8, y: 4.9, w: 11.7, h: 0.6, fontFace: TXT, fontSize: 24, color: CINZA, align: "center" });
      rodape(s);
      continue;
    }
    const ord = [...r.itens].sort((a, b) => a[1] - b[1]); // a barra horizontal desenha de baixo para cima
    s.addChart(pptx.ChartType.bar, [{ name: r.titulo, labels: ord.map((x) => x[0]), values: ord.map((x) => x[1]) }], {
      x: 0.5, y: 1.15, w: r.nota ? 9.6 : 12.3, h: 5.9, barDir: "bar", chartColors: [VINHO], showValue: true, dataLabelFormatCode: FORMATO_EXCEL[r.formato],
      dataLabelColor: "FFFFFF", dataLabelFontSize: 9, dataLabelFontFace: TXT, dataLabelPosition: "inEnd", catAxisLabelFontSize: 10, catAxisLabelFontFace: TXT,
      valAxisHidden: true, valGridLine: { color: "DDD6D1", size: 0.5 }, catGridLine: { style: "none" }, barGapWidthPct: r.itens.length <= 3 ? 220 : r.itens.length <= 6 ? 120 : 35, showLegend: false,
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
