// Desenha a apresentação (.pptx editável) do Relatório a partir do modelo montado em src/data/relatorio.ts.
// Gráficos nativos do PowerPoint (dá para editar os números), cores e disposição do Report Operacional da rede.
// O pptxgenjs só é baixado quando a pessoa clica em "Gerar" (import dinâmico).
import type { Formato, ModeloRelatorio } from "@/data/relatorio";
import { paginasDoPlano } from "@/data/relatorioPlano";
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
  const rodape = (s: ReturnType<typeof pptx.addSlide>) => s.addText(`Fonte: ABC EVO · gerado pelo Atlas por ${op.email || "usuário"} em ${dataBR(quando)} · ${m.periodo}${m.parcialAte ? ` (semana em andamento, dados até ${m.parcialAte})` : ""}   ${n}`, { x: 0.4, y: 7.1, w: 12.5, h: 0.3, fontFace: TXT, fontSize: 9, color: CINZA });
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
      if (m.oportunidades !== null) s.addText(`${m.oportunidades.toLocaleString("pt-BR")} oportunidades cadastradas${m.convertidas !== null ? `\n${m.convertidas.toLocaleString("pt-BR")} convertidas` : ""}`, { x: 9.9, y: 5.9, w: 3.3, h: 0.7, fontFace: TXT, fontSize: 16, bold: true, color: VINHO, align: "center", valign: "top" });
    }
    rodape(s);
  }

  // O mês até aqui (relatório semanal): acumulado do mês contra a meta e contra o mesmo ponto do mês anterior
  if (m.mesAteAqui) {
    const a = m.mesAteAqui;
    const s = slideDeDados();
    s.addText("O MÊS ATÉ AQUI", { x: 2.6, y: 0.08, w: 8.2, h: 0.8, fontFace: TIT, fontSize: 34, color: TEXTO, align: "center" });
    s.addText(`acumulado de ${a.periodo}${m.parcialAte ? ` (dados até ${m.parcialAte})` : ""} · ${Math.round(a.ritmo)}% do mês já passou`, { x: 2.6, y: 0.82, w: 8.2, h: 0.3, fontFace: TXT, fontSize: 10, color: CINZA, align: "center" });
    a.itens.forEach((it, i) => {
      const x = 0.7 + (i % 2) * 6.2, y = 1.4 + Math.floor(i / 2) * 2.8, larg = 5.6;
      s.addText(it.nome, { x, y, w: larg, h: 0.45, fontFace: TIT, fontSize: 22, color: VINHO });
      s.addText(it.valor, { x, y: y + 0.4, w: larg, h: 0.85, fontFace: TIT, fontSize: it.valor.length > 11 ? 36 : 44, color: PRETO, valign: "middle" });
      if (it.variacao !== null) s.addText(sinal(it.variacao), { x, y: y + 1.2, w: 1.6, h: 0.4, fontFace: TXT, fontSize: 16, bold: true, color: it.variacao >= 0 ? VERDE : VERM });
      if (it.anterior) s.addText(it.anterior, { x: x + (it.variacao !== null ? 1.6 : 0), y: y + 1.2, w: larg - (it.variacao !== null ? 1.6 : 0), h: 0.4, fontFace: TXT, fontSize: 12, color: CINZA, valign: "middle" });
      if (it.meta) {
        s.addShape(pptx.ShapeType.roundRect, { x, y: y + 1.75, w: larg, h: 0.18, fill: { color: "D9D3CF" }, line: { color: "D9D3CF", width: 0 }, rectRadius: 0.08 });
        const w = Math.max(0, Math.min(1, it.meta.pct / 100)) * larg;
        if (w > 0.05) s.addShape(pptx.ShapeType.roundRect, { x, y: y + 1.75, w, h: 0.18, fill: { color: VINHO }, line: { color: VINHO, width: 0 }, rectRadius: 0.08 });
        // traço do ritmo esperado (onde o acumulado estaria se o mês fosse linear)
        s.addShape(pptx.ShapeType.rect, { x: x + (it.meta.ritmo / 100) * larg - 0.015, y: y + 1.68, w: 0.03, h: 0.32, fill: { color: PRETO }, line: { color: PRETO, width: 0 } });
        s.addText(`${it.meta.texto}  ·  traço: ritmo esperado`, { x, y: y + 2.0, w: larg, h: 0.35, fontFace: TXT, fontSize: 12, color: CINZA });
      } else s.addText("Meta do mês não cadastrada", { x, y: y + 1.75, w: larg, h: 0.35, fontFace: TXT, fontSize: 12, italic: true, color: CINZA });
    });
    rodape(s);
  }

  // Rankings (gráfico de barras nativo)
  for (const r of m.rankings) {
    const s = slideDeDados();
    s.addText(r.titulo.toUpperCase(), { x: 2.6, y: 0.08, w: 8.2, h: 0.8, fontFace: TIT, fontSize: 34, color: TEXTO, align: "center" });
    s.addText(r.subtitulo, { x: 2.6, y: 0.82, w: 8.2, h: 0.3, fontFace: TXT, fontSize: 10, color: CINZA, align: "center" });
    if (r.cartao?.serie) {
      // Uma unidade só: valor e variação em cima, evolução dos últimos períodos embaixo (coluna do período em vinho; meta como linha)
      const c = r.cartao, sr = c.serie!;
      const tam = c.valor.length > 11 ? 56 : c.valor.length > 8 ? 66 : 80;
      s.addText(c.valor, { x: 0.8, y: 1.2, w: 11.7, h: 1.3, fontFace: TIT, fontSize: tam, color: VINHO, align: "center", valign: "middle" });
      if (c.variacao !== null) {
        const bom = c.menorMelhor ? c.variacao <= 0 : c.variacao >= 0;
        const txt = c.emPontos ? `${c.variacao >= 0 ? "+" : ""}${c.variacao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.` : sinal(c.variacao);
        s.addText(txt, { x: 0.8, y: 2.5, w: 11.7, h: 0.55, fontFace: TXT, fontSize: 28, bold: true, color: bom ? VERDE : VERM, align: "center" });
      }
      if (c.anterior) s.addText(c.anterior, { x: 0.8, y: 3.05, w: 11.7, h: 0.4, fontFace: TXT, fontSize: c.anterior.length > 60 ? 14 : 18, color: CINZA, align: "center" });
      const rotulos = sr.rotulos.map((x, i) => (sr.parcial && i === sr.destaque ? `${x} (em andamento)` : x));
      const cores = sr.valores.map((_, i) => (i === sr.destaque ? VINHO : i === sr.comparada ? "B98A8A" : "C9C3BF"));
      const comuns = { x: 1.2, y: 3.55, w: 10.9, h: 3.4 };
      const colunas = { type: pptx.ChartType.bar, data: [{ name: r.titulo, labels: rotulos, values: sr.valores }], options: { chartColors: cores, barGapWidthPct: 55, showValue: true, dataLabelFormatCode: FORMATO_EXCEL[r.formato], dataLabelFontSize: 11, dataLabelFontFace: TXT, dataLabelColor: TEXTO, dataLabelPosition: "outEnd" } };
      const opcoes = { ...comuns, barDir: "col", catAxisLabelFontSize: 11, catAxisLabelFontFace: TXT, valAxisHidden: true, valAxisMinVal: 0, valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false };
      if (sr.metaLinha) {
        const linha = { type: pptx.ChartType.line, data: [{ name: sr.metaLinha.rotulo, labels: rotulos, values: sr.valores.map(() => sr.metaLinha!.valor) }], options: { chartColors: ["111111"], lineSize: 2, lineDash: "dash", lineDataSymbol: "none" } };
        s.addChart([colunas, linha] as never, { ...opcoes, showLegend: true, legendPos: "b", legendFontSize: 11, legendFontFace: TXT } as never);
      } else s.addChart([colunas] as never, opcoes as never);
      rodape(s);
      continue;
    }
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
      if (c.anterior) s.addText(c.anterior, { x: 0.8, y: 4.9, w: 11.7, h: 0.6, fontFace: TXT, fontSize: c.anterior.length > 60 ? 18 : 24, color: CINZA, align: "center" });
      if (c.meta) {
        // Barra de progresso da meta do mês (como no esboço aprovado): trilho cinza e preenchimento vinho
        const x0 = 2.17, larg = 9;
        s.addShape(pptx.ShapeType.roundRect, { x: x0, y: 5.85, w: larg, h: 0.22, fill: { color: "D9D3CF" }, line: { color: "D9D3CF", width: 0 }, rectRadius: 0.1 });
        const w = Math.max(0, Math.min(1, c.meta.pct / 100)) * larg;
        if (w > 0.05) s.addShape(pptx.ShapeType.roundRect, { x: x0, y: 5.85, w, h: 0.22, fill: { color: VINHO }, line: { color: VINHO, width: 0 }, rectRadius: 0.1 });
        s.addText(c.meta.texto, { x: x0, y: 6.15, w: larg, h: 0.45, fontFace: TXT, fontSize: 18, color: CINZA, align: "center" });
      }
      rodape(s);
      continue;
    }
    const ord = [...r.itens].sort((a, b) => a[1] - b[1]); // a barra horizontal desenha de baixo para cima
    const nomes = ord.map((x) => (r.bases?.[x[0]] ? `${x[0]} (${r.bases[x[0]]})` : x[0]));
    s.addChart(pptx.ChartType.bar, [{ name: r.titulo, labels: nomes, values: ord.map((x) => x[1]) }], {
      x: 0.5, y: 1.15, w: r.nota ? 9.6 : 12.3, h: 5.9, barDir: "bar", chartColors: [VINHO], showValue: true, dataLabelFormatCode: FORMATO_EXCEL[r.formato],
      dataLabelColor: "FFFFFF", dataLabelFontSize: 9, dataLabelFontFace: TXT, dataLabelPosition: "inEnd", catAxisLabelFontSize: 10, catAxisLabelFontFace: TXT,
      valAxisHidden: true, valGridLine: { color: "DDD6D1", size: 0.5 }, catGridLine: { style: "none" }, barGapWidthPct: r.itens.length <= 3 ? 220 : r.itens.length <= 6 ? 120 : 35, showLegend: false,
    });
    if (r.nota) s.addText(r.nota, { x: 10.2, y: 5.0, w: 2.9, h: 1.8, fontFace: TXT, fontSize: 10, color: PRETO, valign: "top" });
    rodape(s);
  }

  // Plano de ação da unidade (relatório semanal de uma unidade): o que está em aberto no plano do mês, para a reunião
  if (m.plano) {
    const p = m.plano;
    const { paginas, excedente } = paginasDoPlano(p);
    const cabecalho = (s: ReturnType<typeof pptx.addSlide>, parte: string) => {
      s.addText("PLANO DE AÇÃO", { x: 2.6, y: 0.08, w: 8.2, h: 0.8, fontFace: TIT, fontSize: 34, color: TEXTO, align: "center" });
      s.addText(`${p.unidade} · plano de ${p.mes.slice(5)}/${p.mes.slice(0, 4)} (mês em andamento) · dados até ${p.dias}/${p.mes.slice(5)}${parte}`, { x: 2.6, y: 0.82, w: 8.2, h: 0.3, fontFace: TXT, fontSize: 10, color: CINZA, align: "center" });
    };
    const rodapeFeitos = (s: ReturnType<typeof pptx.addSlide>) => {
      const extra = [excedente ? `+${excedente} ${excedente === 1 ? "item" : "itens"} no plano do Atlas` : "", p.feitos.length ? `Já feito: ${p.feitos.join("; ")}` : ""].filter(Boolean).join("   ·   ");
      if (extra) s.addText(extra, { x: 0.7, y: 6.6, w: 11.9, h: 0.4, fontFace: TXT, fontSize: 11, italic: true, color: CINZA });
    };
    if (!paginas.length) {
      const s = slideDeDados();
      cabecalho(s, "");
      s.addText("Nenhum item pendente", { x: 0.8, y: 2.4, w: 11.7, h: 1.4, fontFace: TIT, fontSize: 64, color: VINHO, align: "center", valign: "middle" });
      s.addText("O plano de ação do mês está em dia.", { x: 0.8, y: 3.9, w: 11.7, h: 0.6, fontFace: TXT, fontSize: 22, color: CINZA, align: "center" });
      rodapeFeitos(s);
      rodape(s);
    }
    paginas.forEach((itens, pg) => {
      const s = slideDeDados();
      cabecalho(s, paginas.length > 1 ? ` · ${pg + 1} de ${paginas.length}` : "");
      itens.forEach((it, i) => {
        const y = 1.35 + i * 1.75;
        const cor = it.gravidade === "critico" ? VERM : it.gravidade === "atencao" ? "E58A00" : "9A9A9A";
        s.addShape(pptx.ShapeType.ellipse, { x: 0.75, y: y + 0.06, w: 0.2, h: 0.2, fill: { color: cor }, line: { color: cor, width: 0 } });
        s.addText(it.grupo.toUpperCase(), { x: 1.1, y, w: 4, h: 0.3, fontFace: TXT, fontSize: 10, bold: true, color: cor });
        s.addText(it.titulo, { x: 1.1, y: y + 0.28, w: 11.4, h: 0.4, fontFace: TXT, fontSize: 17, bold: true, color: TEXTO });
        s.addText(it.fato, { x: 1.1, y: y + 0.68, w: 11.4, h: 0.5, fontFace: TXT, fontSize: 12, color: TEXTO, valign: "top" });
        s.addText(`Fazer: ${it.acao}`, { x: 1.1, y: y + 1.15, w: 11.4, h: 0.5, fontFace: TXT, fontSize: 12, bold: true, color: VINHO, valign: "top" });
      });
      if (pg === paginas.length - 1) rodapeFeitos(s);
      rodape(s);
    });
  }

  // Encerramento
  {
    n++;
    const s = pptx.addSlide(); s.background = { color: VINHO };
    s.addImage({ data: fecho, x: 0, y: 0, w: 13.333, h: 7.5 });
  }

  await pptx.writeFile({ fileName: `${nomeDoArquivo(m)}.pptx` });
}
