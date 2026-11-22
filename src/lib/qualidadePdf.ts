// Desenha o PDF de uma visita (ou envio) da Qualidade a partir do conteúdo montado em src/data/qualidadeRelatorio.ts.
// O jsPDF só é baixado quando a pessoa clica em "Baixar PDF" (import dinâmico). Fotos e assinatura vêm do servidor com a sessão da pessoa.
import type { PlanoAcao, Visita } from "@/data/qualidade";
import { montarRelatorioDaVisita, nomeDoPdf, type Situacao } from "@/data/qualidadeRelatorio";
import { baixarFoto } from "@/lib/qualidade";

const VINHO: [number, number, number] = [112, 14, 14];
const TEXTO: [number, number, number] = [43, 43, 43];
const CINZA: [number, number, number] = [107, 107, 107];
const COR: Record<Situacao, { rotulo: string; cor: [number, number, number] }> = {
  conforme: { rotulo: "Conforme", cor: [30, 142, 62] },
  "nao-conforme": { rotulo: "Não conforme", cor: [209, 20, 27] },
  "nao-se-aplica": { rotulo: "Não se aplica", cor: [107, 107, 107] },
};

/** Reduz a imagem para o lado maior caber em `lado` px e a devolve em JPEG; null fora do navegador ou se a imagem não abrir. */
async function reduzir(dados: string, lado: number): Promise<{ dados: string; formato: "JPEG" } | null> {
  if (typeof document === "undefined" || typeof Image === "undefined") return null;
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => falha(new Error("imagem")); i.src = dados; });
    const esc = Math.min(1, lado / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * esc)); c.height = Math.max(1, Math.round(img.height * esc));
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
    return { dados: c.toDataURL("image/jpeg", 0.78), formato: "JPEG" };
  } catch { return null; }
}

/** Baixa uma foto do servidor e devolve o texto base64 (data URL) e o formato, ou null se não der. */
async function fotoComoDados(id: string): Promise<{ dados: string; formato: "JPEG" | "PNG" } | null> {
  const url = await baixarFoto(id);
  if (!url) return null;
  try {
    const blob = await (await fetch(url)).blob();
    const dados = await new Promise<string>((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => falha(r.error); r.readAsDataURL(blob); });
    // Foto do celular pode ter 600 KB: com dezenas de fotos o PDF ficaria enorme. Reduz para 900 px (JPEG) quando o navegador permite; senão usa a original.
    const reduzida = await reduzir(dados, 900);
    return reduzida ?? { dados, formato: /^data:image\/png/.test(dados) ? "PNG" : "JPEG" };
  } catch { return null; } finally { URL.revokeObjectURL(url); }
}

/** `saida` "baixar" salva o arquivo; "blob" devolve o PDF (para teste). */
export async function gerarPdfDaVisita(v: Visita, planos: PlanoAcao[], op: { email: string; em?: Date }): Promise<void>;
export async function gerarPdfDaVisita(v: Visita, planos: PlanoAcao[], op: { email: string; em?: Date }, saida: "blob"): Promise<Blob>;
export async function gerarPdfDaVisita(v: Visita, planos: PlanoAcao[], op: { email: string; em?: Date }, saida: "baixar" | "blob" = "baixar"): Promise<Blob | void> {
  const rel = montarRelatorioDaVisita(v, planos);
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  // Página A4 com margens de 12 mm; tudo em BLOCOS com borda, como no questionário exportado pelo Sults
  const L = 12, R = 198, W = R - L, FIM = 283;
  const BORDA: [number, number, number] = [205, 200, 196], ROTULO: [number, number, number] = [238, 236, 234], AZUL: [number, number, number] = [58, 96, 140];
  let y = 0;
  const quando = (op.em ?? new Date()).toLocaleString("pt-BR");

  // Fotos: todas de uma vez (em paralelo), para o desenho ser rápido
  const ids = new Set<string>();
  for (const g of rel.grupos) for (const i of g.itens) { i.fotos.forEach((f) => ids.add(f)); i.equipamentos.forEach((e) => e.fotos.forEach((f) => ids.add(f))); }
  if (rel.assinatura?.foto) ids.add(rel.assinatura.foto);
  const fotos = new Map<string, { dados: string; formato: "JPEG" | "PNG" } | null>();
  await Promise.all([...ids].map(async (id) => { fotos.set(id, await fotoComoDados(id)); }));

  // ---- utilidades de desenho -------------------------------------------------------------------------------------------------------------------------
  const fonte = (tam: number, negrito = false, cor: [number, number, number] = TEXTO) => { doc.setFont("helvetica", negrito ? "bold" : "normal"); doc.setFontSize(tam); doc.setTextColor(...cor); };
  const quebrar = (t: string, w: number, tam: number, negrito = false) => { fonte(tam, negrito); return doc.splitTextToSize(t, w) as string[]; };
  const novaPagina = () => { doc.addPage(); y = 14; };
  /** Garante `alt` mm livres na página; senão vai para a próxima. */
  const cabe = (alt: number) => { if (y + alt > FIM) novaPagina(); };
  const retangulo = (x: number, yy: number, w: number, h: number, preenche?: [number, number, number]) => { doc.setDrawColor(...BORDA); doc.setLineWidth(0.25); if (preenche) { doc.setFillColor(...preenche); doc.rect(x, yy, w, h, "FD"); } else doc.rect(x, yy, w, h); };

  /** Quadro de campo: uma tarja cinza com o nome e o valor embaixo (o "Questionário", "Unidade", "Nota"...). */
  const campo = (x: number, yy: number, w: number, rotulo: string, valor: string | null, h = 13, opc: { tam?: number; centro?: boolean; cor?: [number, number, number]; negrito?: boolean } = {}) => {
    retangulo(x, yy, w, h); retangulo(x, yy, w, 6, ROTULO);
    fonte(8.5, true); doc.text(rotulo, x + 2, yy + 4.2);
    if (valor === null) return; // só a moldura e o rótulo: o texto é desenhado por quem chamou
    fonte(opc.tam ?? 10, opc.negrito ?? false, opc.cor ?? TEXTO);
    const linhas = doc.splitTextToSize(valor || "—", w - 4) as string[];
    const base = yy + 6 + (h - 6) / 2 + (opc.tam ?? 10) * 0.12 - (linhas.length - 1) * 2;
    linhas.slice(0, 3).forEach((l, i) => doc.text(l, opc.centro ? x + w / 2 : x + 2, base + i * 4.2, opc.centro ? { align: "center" } : undefined));
  };
  /** Faixa de título de bloco (Check-In, Check-Out, Seção). */
  const faixa = (t: string, cor: [number, number, number], direita?: string) => {
    cabe(12); doc.setFillColor(...cor); doc.rect(L, y, W, 8, "F");
    fonte(11, true, [255, 255, 255]); doc.text(t, L + 3, y + 5.5);
    if (direita) doc.text(direita, R - 3, y + 5.5, { align: "right" });
    y += 11;
  };
  /** Grade de fotos (quadrados de 36 mm); foto que não veio vira um quadro de aviso. Mede (executa=false) ou desenha. */
  const LADO = 36, GAP = 3;
  const fotosEm = (lista: string[], x: number, larg: number, executa: boolean, topo: number): number => {
    if (!lista.length) return 0;
    const porLinha = Math.max(1, Math.floor((larg + GAP) / (LADO + GAP)));
    const linhas = Math.ceil(lista.length / porLinha);
    if (executa) {
      lista.forEach((id, k) => {
        const f = fotos.get(id), px = x + (k % porLinha) * (LADO + GAP), py = topo + Math.floor(k / porLinha) * (LADO + GAP);
        if (f) { try { doc.addImage(f.dados, f.formato, px, py, LADO, LADO, undefined, "FAST"); doc.setDrawColor(...BORDA); doc.rect(px, py, LADO, LADO); return; } catch { /* cai no aviso */ } }
        doc.setFillColor(240, 237, 234); doc.rect(px, py, LADO, LADO, "F"); fonte(8, false, CINZA); doc.text("foto indisponível", px + LADO / 2, py + LADO / 2, { align: "center" });
      });
    }
    return linhas * (LADO + GAP);
  };

  /** Bloco de um item: número e texto, a resposta marcada, o vencimento, o comentário, os equipamentos parados (blocos menores), as fotos e o plano de ação. */
  const bloco = (num: string, it: (typeof rel.grupos)[number]["itens"][number], executa: boolean, topo: number): number => {
    const PAD = 3, xi = L + PAD, wi = W - PAD * 2;
    let yy = topo + PAD;
    // título
    const linhasT = quebrar(`${num} ${it.texto}`, wi, 10, true);
    if (executa) { fonte(10, true); linhasT.forEach((l, k) => doc.text(l, xi, yy + 3.6 + k * 4.6)); }
    yy += linhasT.length * 4.6 + 2;
    // resposta: caixa com as três opções e a escolhida marcada
    const opcoes: { rotulo: string; sit: Situacao }[] = [{ rotulo: "Não conforme", sit: "nao-conforme" }, { rotulo: "Conforme", sit: "conforme" }, { rotulo: "Não se aplica", sit: "nao-se-aplica" }];
    if (executa) { fonte(8.5, false, CINZA); doc.text("Resposta:", xi, yy + 2.8); }
    yy += 4.2;
    const altCaixa = opcoes.length * 5.6 + 2;
    if (executa) {
      retangulo(xi, yy, wi, altCaixa);
      opcoes.forEach((o, k) => {
        const oy = yy + 1.5 + k * 5.6, marcada = o.sit === it.situacao, c = COR[o.sit].cor;
        doc.setDrawColor(...BORDA); doc.setLineWidth(0.3); doc.setFillColor(255, 255, 255); doc.roundedRect(xi + 2, oy, 4, 4, 0.8, 0.8, "FD");
        if (marcada) { doc.setFillColor(...c); doc.roundedRect(xi + 2, oy, 4, 4, 0.8, 0.8, "F"); doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.5);
          if (o.sit === "conforme") { doc.line(xi + 2.9, oy + 2.1, xi + 3.8, oy + 3), doc.line(xi + 3.8, oy + 3, xi + 5.3, oy + 1.1); }
          else if (o.sit === "nao-conforme") { doc.line(xi + 3, oy + 1.1, xi + 5, oy + 3.1); doc.line(xi + 5, oy + 1.1, xi + 3, oy + 3.1); }
          else doc.line(xi + 3, oy + 2.1, xi + 5, oy + 2.1); }
        fonte(9.5, marcada, marcada ? c : TEXTO); doc.text(o.rotulo, xi + 8.5, oy + 3.2);
      });
    }
    yy += altCaixa + 2;
    // vencimento
    if (it.vencimento) { if (executa) { fonte(9, false, CINZA); doc.text("Vencimento:", xi, yy + 3); fonte(9, true); doc.text(it.vencimento, xi + 20, yy + 3); } yy += 5.5; }
    // comentário
    if (it.comentario) {
      const lc = quebrar(it.comentario, wi - 4, 9.5);
      if (executa) { fonte(8.5, false, CINZA); doc.text("Comentário:", xi, yy + 2.8); }
      yy += 4.2;
      if (executa) { retangulo(xi, yy, wi, lc.length * 4.4 + 3); fonte(9.5); lc.forEach((l, k) => doc.text(l, xi + 2, yy + 4 + k * 4.4)); }
      yy += lc.length * 4.4 + 3 + 2;
    }
    // equipamentos parados: um bloco menor para cada
    for (const e of it.equipamentos) {
      const tituloE = `Equipamento parado: ${e.codigo}${e.descricao ? ` · ${e.descricao}` : ""}`;
      const lt = quebrar(tituloE, wi - 8, 9.5, true);
      const hf = fotosEm(e.fotos, xi + 4, wi - 8, false, 0);
      const hE = 3 + lt.length * 4.4 + (hf ? hf + 1 : 0) + 2;
      if (executa) {
        retangulo(xi, yy, wi, hE); doc.setFillColor(...COR["nao-conforme"].cor); doc.rect(xi, yy, 1.4, hE, "F");
        fonte(9.5, true, COR["nao-conforme"].cor); lt.forEach((l, k) => doc.text(l, xi + 4, yy + 4.6 + k * 4.4));
        fotosEm(e.fotos, xi + 4, wi - 8, true, yy + 3 + lt.length * 4.4);
      }
      yy += hE + 2;
    }
    // fotos do item
    if (it.fotos.length) {
      if (executa) { fonte(8.5, false, CINZA); doc.text("Fotos:", xi, yy + 2.8); }
      yy += 4.2;
      yy += fotosEm(it.fotos, xi, wi, executa, yy);
    }
    // plano de ação deste item
    if (it.plano) {
      const t = `Plano de ação: ${it.plano.oQue}`, sub = `Prazo ${it.plano.prazo} · responsável: ${it.plano.responsavel} · ${it.plano.status}`;
      const l1 = quebrar(t, wi - 6, 9.5, true), l2 = quebrar(sub, wi - 6, 9);
      const hP = 3 + l1.length * 4.4 + l2.length * 4.2 + 2;
      if (executa) {
        doc.setFillColor(252, 240, 238); doc.setDrawColor(...BORDA); doc.rect(xi, yy, wi, hP, "FD");
        fonte(9.5, true, VINHO); l1.forEach((l, k) => doc.text(l, xi + 3, yy + 4.6 + k * 4.4));
        fonte(9, false, CINZA); l2.forEach((l, k) => doc.text(l, xi + 3, yy + 4.6 + l1.length * 4.4 + k * 4.2));
      }
      yy += hP + 2;
    }
    return yy + PAD - topo;
  };

  // ---- cabeçalho -------------------------------------------------------------------------------------------------------------------------------------
  doc.setFillColor(...VINHO); doc.rect(0, 0, 210, 22, "F");
  fonte(18, true, [255, 255, 255]); doc.text("WORLD GYM", L, 11);
  fonte(10.5, false, [255, 255, 255]); doc.text(rel.titulo, L, 17.5);
  fonte(9, false, [255, 255, 255]); doc.text(`${rel.unidade} · ${rel.data}`, R, 11, { align: "right" });
  y = 28;
  campo(L, y, 140, "Questionário", rel.checklist, 15, { tam: 10.5 }); campo(L + 142, y, W - 142, "Data da avaliação", rel.data, 15, { centro: true, tam: 10.5 }); y += 17;
  const q = W / 4 - 1.5;
  campo(L, y, q, "Perguntas", String(rel.perguntas), 13, { centro: true, tam: 12 });
  campo(L + (q + 2), y, q, "Conformes", String(rel.contagem.conformes), 13, { centro: true, tam: 12, cor: COR.conforme.cor, negrito: true });
  campo(L + (q + 2) * 2, y, q, "Não conformes", String(rel.contagem.naoConformes), 13, { centro: true, tam: 12, cor: COR["nao-conforme"].cor, negrito: true });
  campo(L + (q + 2) * 3, y, q, "Nota", rel.nota, 13, { centro: true, tam: 13, cor: VINHO, negrito: true }); y += 15;
  campo(L, y, W, "Unidade", rel.unidade, 13); y += 15;
  campo(L, y, W, "Aplicado por", rel.avaliador, 13); y += 17;

  // ---- check-in e check-out --------------------------------------------------------------------------------------------------------------------------
  if (rel.checkin) {
    faixa("Check-In", AZUL);
    const meio = (W - 2) / 2;
    campo(L, y, meio, "Data", rel.checkin.data, 12, { centro: true }); campo(L + meio + 2, y, meio, "Hora", rel.checkin.hora, 12, { centro: true }); y += 14;
    campo(L, y, W, "Local", rel.checkin.local + (rel.marcas.find((m) => m.startsWith("Duração")) ? ` · ${rel.marcas.find((m) => m.startsWith("Duração"))!.toLowerCase()}` : ""), 12); y += 16;
  }

  // ---- seções: cada pergunta é um bloco --------------------------------------------------------------------------------------------------------------
  rel.grupos.forEach((grupo, gi) => {
    // a faixa da seção nunca fica sozinha no pé da página: vai junto com o primeiro bloco
    const h0 = grupo.itens.length ? bloco(`${gi + 1}.1.`, grupo.itens[0], false, 0) : 0;
    cabe(12 + Math.min(h0 + 3, FIM - 30));
    faixa(`Seção : ${gi + 1}.${grupo.nome}`, [0x1f, 0x2d, 0x45], grupo.nota ? `Nota ${grupo.nota}` : undefined);
    grupo.itens.forEach((it, ii) => {
      const h = bloco(`${gi + 1}.${ii + 1}.`, it, false, 0);
      cabe(Math.min(h + 3, FIM - 20));
      const topo = y;
      const hh = bloco(`${gi + 1}.${ii + 1}.`, it, true, topo);
      retangulo(L, topo, W, hh);
      y = topo + hh + 4;
    });
  });

  if (rel.observacao) {
    const lo = quebrar(rel.observacao, W - 4, 10);
    cabe(lo.length * 4.6 + 14); campo(L, y, W, "Observação", null, lo.length * 4.6 + 10);
    fonte(10); lo.forEach((l, k) => doc.text(l, L + 2, y + 10.5 + k * 4.6)); y += lo.length * 4.6 + 14;
  }
  if (rel.planos.length) {
    faixa(`Outros planos de ação (${rel.planos.length})`, AZUL);
    for (const p of rel.planos) {
      const l1 = quebrar(`${p.item}: ${p.oQue}`, W - 6, 9.5, true), l2 = quebrar(`Prazo ${p.prazo} · responsável: ${p.responsavel} · ${p.status}`, W - 6, 9);
      const h = 4 + l1.length * 4.4 + l2.length * 4.2;
      cabe(h + 3); retangulo(L, y, W, h);
      fonte(9.5, true); l1.forEach((l, k) => doc.text(l, L + 3, y + 5 + k * 4.4)); fonte(9, false, CINZA); l2.forEach((l, k) => doc.text(l, L + 3, y + 5 + l1.length * 4.4 + k * 4.2));
      y += h + 3;
    }
  }
  if (rel.checkout) {
    faixa("Check-Out", AZUL);
    const meio = (W - 2) / 2;
    cabe(16); campo(L, y, meio, "Data", rel.checkout.data, 12, { centro: true }); campo(L + meio + 2, y, meio, "Hora", rel.checkout.hora, 12, { centro: true }); y += 14;
  }
  if (rel.assinatura) {
    cabe(52); faixa("Recebido por", AZUL);
    campo(L, y, W, "Nome e cargo", `${rel.assinatura.nome}${rel.assinatura.cargo ? ` · ${rel.assinatura.cargo}` : ""}`, 12); y += 14;
    const a = fotos.get(rel.assinatura.foto);
    if (a) { cabe(34); retangulo(L, y, 70, 30); try { doc.addImage(a.dados, a.formato, L + 1, y + 1, 68, 28, undefined, "FAST"); } catch { /* segue */ } y += 32; }
  }

  // rodapé em todas as páginas
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) { doc.setPage(p); fonte(8, false, CINZA); doc.text(`Fonte: Atlas · gerado por ${op.email || "usuário"} em ${quando}`, L, 290); doc.text(`Página ${p} de ${n}`, R, 290, { align: "right" }); }
  if (saida === "blob") return doc.output("blob");
  doc.save(nomeDoPdf(v));
}
