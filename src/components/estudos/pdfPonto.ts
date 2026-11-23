// PDF do estudo de ponto novo, no mesmo roteiro do estudo de geomarketing da rede (e do PDF da unidade): objetivo, metodologia,
// resumo de cada ponto e, do ponto aberto na tela, captação, faixa etária, domicílios, perfil socioeconômico, potencial de consumo,
// concorrência, canibalização, cenários de faturamento, o imóvel, a recomendação de localização, unidades parecidas e a conclusão.
// Os textos são montados por regras fixas a partir dos números da tela; o que é estimativa ou premissa aparece escrito como tal.
import type { ConteudoPdf, PaginaDoEstudo, Secao } from "@/lib/estudoPdf";
import { nomeDoArquivo, ALT_FOTO_MAPA } from "@/lib/estudoPdf";
import { DECISAO_ROTULO, PARECER_ROTULO, vereditoComFatia, compararComParecidas, leituraParecidas, ESTACIONAMENTO, PARTICIPACAO_CANVA, SITUACAO_POPULACAO, SITUACAO_VAGAS, VEREDITO_ROTULO, meses, populacaoCanva, reais, vereditoFinal, type Captacao, type Fator, type Ponto, type Premissas, type Resultado, type SituacaoPopulacao, type SituacaoVagas, type UnidadeEstudo } from "@/lib/estudoPonto";
import { PENETRACAO_MERCADO, resumoMercado, secoesDeMercado, type DadosMercado } from "@/components/estudos/pdfUnidade";
import { LIMITES_SUGESTAO, linhasSugestoes, textoSugestoes, type ResultadoSugestoes } from "@/components/estudos/sugestoes";

const pct = (x: number | null | undefined, casas = 0) => (x == null ? "—" : `${(x * 100).toLocaleString("pt-BR", { maximumFractionDigits: casas })}%`);
const num = (x: number) => Math.round(x).toLocaleString("pt-BR");
const mil = (x: number | null | undefined) => (x == null ? "—" : x >= 10000 ? `${Math.round(x / 1000).toLocaleString("pt-BR")} mil` : num(x));
const preco = (x: number) => `R$ ${x.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface PontoNoPdf {
  ponto: Ponto; letra: string; regiao: string; resultado: Resultado | null; captacao: Captacao; fatores: Fator[];
  parecidas: ReturnType<typeof compararComParecidas>; foto: string | null;
}
export interface DadosPdfPonto {
  pontos: PontoNoPdf[]; premissas: Premissas; minutos: number; temArea: boolean;
  /** Só do ponto aberto na tela (as buscas e fotos da área são dele). */
  atualId: string | null; mercado: Omit<DadosMercado, "tipo" | "nome" | "area" | "vendas" | "alunosNaArea"> | null;
  fotoCaptacao: string | null; fotoRede: string | null; fotoSugestoes?: string | null; sugestoes: ResultadoSugestoes | null;
  /** População recomendada calibrada com a rede (só com a área de 10 min). */
  populacao?: { moradores: number; recomendada: number; minima: number; n: number; situacao: SituacaoPopulacao | null } | null;
  ticket?: { preco: number; realizado: number; p25: number; p75: number; n: number; dasParecidas: boolean } | null;
  alunos?: number | null;
  vagas?: { min: number; max: number; informadas: number | null; proprias: number | null; perto: number | null; situacao: SituacaoVagas } | null;
  /** Faixa da fatia do potencial de consumo nas unidades maduras do modelo (faixaDaFatia). */
  faixaFatia?: { comum: number; maxima: number; mediana: number; unidades: number } | null;
  comparacao?: { foto: string | null };
  itensImovel: { k: keyof Ponto["imovel"]; rotulo: string }[];
  hoje?: Date;
}

export function montarPdfPonto(d: DadosPdfPonto): ConteudoPdf {
  const { premissas: pr } = d;
  const area = d.temArea ? `na área de até ${d.minutos} minutos de carro` : "num raio de 5 km";
  const anos = pr.regua.mesesAprovado / 12;
  const paginas: PaginaDoEstudo[] = [];

  paginas.push({
    titulo: "Objetivo do Estudo", subtitulo: "", numeros: [], secoes: [],
    texto: [`O presente estudo de geomarketing tem como objetivo avaliar a viabilidade da implantação de uma unidade World Gym ${d.pontos.length > 1 ? `nos ${d.pontos.length} pontos estudados` : "no ponto estudado"}, considerando critérios demográficos, socioeconômicos, concorrenciais e operacionais alinhados ao modelo de negócio da rede, por meio da análise de:`],
    lista: ["Dados demográficos e domiciliares", "Indicadores socioeconômicos e potencial de consumo", "Análise concorrencial e sobreposição com a rede World Gym", "Premissas operacionais da rede (vendas por m², custos e retorno do investimento)", "Posições melhores na mesma região"],
    destaque: "O material foi desenvolvido para subsidiar decisões do comitê de expansão, alinhado ao modelo de negócio da World Gym.",
  });
  paginas.push({
    titulo: "Metodologia de Análise", subtitulo: "", numeros: [],
    secoes: [{
      titulo: "", linhas: [],
      texto: ["A análise foi realizada considerando os seguintes critérios e fontes de dados:"],
      lista: [
        d.temArea ? `Área de influência de até ${d.minutos} minutos de deslocamento de carro, calculada pelas ruas (Mapbox)` : "Área de influência num raio de 5 km",
        "População total, faixa etária e domicílios (Censo 2022, IBGE, por setor censitário)",
        "Renda média do responsável e classes de renda (Censo 2022)",
        "Potencial de consumo em recreações e esportes (POF 2017-2018, IBGE)",
        "Mapeamento das academias concorrentes (Google)",
        "Vendas previstas pelo tamanho do imóvel e pelas vendas por m² das unidades maduras da rede (EVO)",
        `Régua de retorno da rede: payback em até ${pr.regua.mesesAprovado} meses aprova; até ${pr.regua.mesesAtencao} meses pede atenção`,
      ],
      paragrafo: "Os dados do Censo são agregados em hexágonos de cerca de 200 m e contados quando o centro do hexágono cai dentro da área.",
    }],
  });

  for (const pt of d.pontos) {
    const { ponto: p, resultado: r, captacao: cap } = pt;
    const ehAtual = p.id === d.atualId;
    const modelo = pr.modelos[p.modelo].nome;
    const texto: string[] = [];
    if (r) {
      texto.push(`Pelo tamanho do imóvel (${num(p.m2)} m², modelo ${modelo}) e pelas vendas por m² das unidades maduras da rede, o ponto deve vender cerca de ${reais(r.provavel)} por mês depois de maduro, numa faixa de ${reais(r.pessimista)} a ${reais(r.otimista)}. Com investimento estimado de R$ ${(r.investimento / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} milhões e custo fixo de ${reais(r.custoFixo)} por mês, o lucro esperado é de ${r.lucro > 0 ? `${reais(r.lucro)} por mês` : "prejuízo"} e o investimento volta em ${meses(r.payback)}.`);
      texto.push(`Para pagar o investimento em ${anos} anos, o ponto precisa vender ${reais(r.meta)} por mês. ${r.veredito === "aprovado" ? "A previsão supera essa meta." : r.veredito === "atencao" ? `A previsão fica abaixo da meta, mas paga o investimento em até ${pr.regua.mesesAtencao} meses: é um ponto de atenção.` : `A previsão não paga o investimento em ${pr.regua.mesesAtencao} meses.`}${r.foraDaFaixa ? " O imóvel está fora da faixa de tamanho em que a rede tem experiência, então a previsão é menos segura." : ""}`);
    }
    const secoes: Secao[] = [];
    if (pt.fatores.length) secoes.push({ titulo: "O que Pesa", linhas: [], lista: pt.fatores.map((f) => `${f.positivo ? "A favor" : "Contra"}: ${f.texto}`) });

    if (ehAtual) {
      const merc = d.mercado;
      if (d.fotoCaptacao) {
        secoes.push({
          titulo: "Área de Captação", novaPagina: true, linhas: [],
          texto: [`O mapa mostra onde estariam os alunos do ponto: cada hexágono pesa pela quantidade de moradores e pela distância até o imóvel, já descontado o que as World Gym e os outros pontos em volta dividem. 80% dos alunos esperados morariam a até ${cap.raio80.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km${merc?.perfil ? `, e ${area} vivem ${mil(merc.perfil.moradores)} pessoas` : ""}.`],
          foto: { dados: d.fotoCaptacao, legenda: `Mais escuro = onde o modelo espera mais alunos.${d.temArea ? ` Linha verde: área de até ${d.minutos} min de carro.` : ""}` }, altFoto: ALT_FOTO_MAPA,
        });
      }
      const pp = d.populacao;
      if (pp && r) {
        const canva = d.alunos ? populacaoCanva(d.alunos, PENETRACAO_MERCADO) : null;
        secoes.push({
          titulo: "População Recomendada", linhas: [],
          texto: [`Para chegar à meta de ${reais(r.meta)} por mês vendendo por morador como a unidade típica da rede, o ponto precisaria de cerca de ${mil(pp.recomendada)} moradores ${area}; o mínimo, vendendo como as unidades que mais aproveitam a própria população, é de ${mil(pp.minima)}. A área tem ${mil(pp.moradores)} moradores: população ${pp.situacao ? SITUACAO_POPULACAO[pp.situacao] : "não medida"}.${pp.situacao === "abaixo" ? " Abaixo do mínimo, o ponto só bate a meta vendendo por morador mais que 3 de cada 4 unidades da rede." : pp.situacao === "limite" ? " O ponto depende de vender acima da média da rede por morador." : ""}`],
          tabela: {
            colunas: ["Referência", "Moradores"], larguras: [3, 1],
            linhas: [
              [`Área do ponto (${d.minutos} min de carro)`, mil(pp.moradores)],
              [`Recomendada pela rede (mediana de ${pp.n} unidades maduras)`, mil(pp.recomendada)],
              ["Mínima pela rede (quartil de cima)", mil(pp.minima)],
              ...(canva ? [[`Estudos antigos: ${num(d.alunos!)} alunos ÷ (${pct(PENETRACAO_MERCADO)} × ${pct(PARTICIPACAO_CANVA[0])} a ${pct(PARTICIPACAO_CANVA[1])})`, `${mil(canva.min)} a ${mil(canva.max)}`]] : []),
            ],
          },
          paragrafo: "A recomendação usa o que cada unidade madura do mesmo modelo vende por morador da própria área de 10 min de carro (EVO e Censo 2022). A conta dos estudos antigos aparece como referência: ela supõe uma participação de mercado fixa e costuma pedir mais gente do que as unidades da rede têm em volta.",
        });
      }
      if (merc) secoes.push(...secoesDeMercado({ ...merc, tipo: "ponto", nome: p.nome, area, vendas: r?.meta ?? null, alunosNaArea: null }));
      secoes.push({
        titulo: "Canibalização com a Rede", novaPagina: true, linhas: [],
        texto: [cap.divideCom.length
          ? `A área do ponto se sobrepõe à de unidades World Gym. Pelo modelo de captação, ${cap.divideCom.map((x) => `${pct(x.parte)} do público seria dividido com a ${x.nome}`).join(", ")}. ${cap.divideCom.reduce((a, x) => a + x.parte, 0) >= 0.25 ? "É uma sobreposição alta: a nova unidade tiraria alunos da rede, o que precisa entrar na decisão." : "É uma sobreposição moderada, aceitável em redes adensadas."}`
          : "Nenhuma World Gym divide de forma relevante a área do ponto: a nova unidade não tiraria alunos da rede."],
        ...(d.fotoRede ? { foto: { dados: d.fotoRede, legenda: "Pinos vermelhos pequenos: World Gym em operação. Círculos: área de cada uma." }, altFoto: ALT_FOTO_MAPA } : {}),
        ...(cap.divideCom.length ? { grafico: { tipo: "rosca" as const, titulo: "Público do ponto", fatias: [{ rotulo: "Só do ponto", valor: Math.max(0, 1 - cap.divideCom.reduce((a, x) => a + x.parte, 0)), cor: "#c41230" }, ...cap.divideCom.map((x, i) => ({ rotulo: `Dividido com ${x.nome}`, valor: x.parte, cor: ["#f0a0ad", "#e7c3ca", "#d6d9e0"][i] ?? "#d6d9e0" }))] } } : {}),
      });
      if (r) secoes.push({
        titulo: "Estimativa de Faturamento", novaPagina: true, linhas: [], faixa: `Modelo direcionado: ${modelo}`,
        texto: [`Os três cenários usam as vendas por m² das unidades maduras da rede: o pessimista é o quartil inferior, o provável é a mediana e o otimista é o quartil superior. A meta é o que paga o investimento em ${anos} anos.`],
        tabela: {
          colunas: ["Cenário", "Vendas por mês", "Lucro por mês", "Payback"], larguras: [1, 1, 1, 0.8],
          linhas: (["pessimista", "provavel", "otimista"] as const).map((k) => {
            const v = r[k], lucro = v * (1 - pr.modelos[p.modelo].variavel) - r.custoFixo, pb = lucro > 0 ? pr.regua.maturacaoMeses + r.investimento / lucro : null;
            return [k === "provavel" ? "Provável" : k === "pessimista" ? "Pessimista" : "Otimista", reais(v), lucro > 0 ? reais(lucro) : "prejuízo", pb ? meses(pb) : "não paga"];
          }).concat([["Meta da régua", reais(r.meta), "", `${pr.regua.mesesAprovado} meses`]]),
        },
      });
      const tk = d.ticket;
      if (r && tk) secoes.push({
        titulo: "Ticket Médio Sugerido", linhas: [],
        texto: [`Sugerimos trabalhar com ticket de ${preco(tk.preco)}: ${tk.dasParecidas ? "é o ticket realizado pelas unidades da rede com moradores e renda parecidos com os do ponto" : `é a mediana do ticket realizado pelas unidades maduras do modelo ${modelo}`} (${preco(tk.realizado)} no EVO, arredondado para o preço de tabela). Na rede, o ticket realizado do modelo vai de ${preco(tk.p25)} a ${preco(tk.p75)} (quartis de ${tk.n} unidades). Com esse ticket, a meta pede cerca de ${num(Math.ceil(r.meta / tk.preco))} alunos ativos e a previsão provável corresponde a ${num(Math.ceil(r.provavel / tk.preco))} alunos.`],
        tabela: {
          colunas: ["Ticket", "Alunos para a meta", "Alunos na previsão provável"], larguras: [1.2, 1, 1],
          linhas: [...new Set([tk.preco, Math.round(tk.p25 / 10) * 10 - 0.1, Math.round(tk.p75 / 10) * 10 - 0.1])].sort((a, b) => a - b)
            .map((t) => [`${preco(t)}${t === tk.preco ? " (sugerido)" : ""}`, num(Math.ceil(r.meta / t)), num(Math.ceil(r.provavel / t))]),
        },
        paragrafo: "Ticket realizado no EVO = recebido no mês ÷ clientes pagantes, média dos últimos meses fechados. O preço dos concorrentes da área não entra na conta e deve ser conferido em campo.",
      });
      const vg = d.vagas;
      secoes.push({
        titulo: "Infraestrutura e Estacionamento", novaPagina: true, linhas: [],
        texto: [vg && d.alunos
          ? `O estacionamento é critério eliminatório da rede. Para atender cerca de ${num(d.alunos)} alunos, considerando de ${pct(ESTACIONAMENTO.pico[0])} a ${pct(ESTACIONAMENTO.pico[1])} deles treinando no mesmo horário de pico e de ${pct(ESTACIONAMENTO.carro[0])} a ${pct(ESTACIONAMENTO.carro[1])} chegando de carro, o ponto precisa de ${vg.min} a ${vg.max} vagas. ${vg.situacao === "sem-dado" ? `As vagas do imóvel não foram informadas no estudo${p.imovel.estacionamento ? " (o imóvel foi marcado como tendo estacionamento)" : ""}: precisam ser levantadas antes da decisão.` : `Foram informadas ${vg.informadas} vagas${vg.perto ? ` (${vg.proprias ?? 0} do imóvel e ${vg.perto} por perto, na rua ou em parceria)` : ""}: estacionamento ${SITUACAO_VAGAS[vg.situacao]}.${vg.situacao === "insuficiente" ? " Pelo critério da rede, o ponto não é aprovado enquanto as vagas não chegarem ao mínimo." : vg.situacao === "limite" ? " Atende o mínimo, mas pode faltar vaga nos horários de pico." : ""}`}`
          : "O estacionamento é critério eliminatório da rede, mas o número de vagas necessárias depende do ticket realizado das unidades, que não está disponível neste estudo."],
        ...(vg ? { tabela: { colunas: ["Item", "Vagas"], larguras: [3, 1], linhas: [
          ["Necessárias (mínimo: 8% no pico × 20% de carro)", num(vg.min)],
          ["Necessárias (folga: 12% no pico × 30% de carro)", num(vg.max)],
          ["Do imóvel", vg.proprias == null ? "não informado" : num(vg.proprias)],
          ["Por perto (rua, parceria)", vg.perto == null ? "não informado" : num(vg.perto)],
        ] } } : {}),
        lista: d.itensImovel.map((it) => `${it.rotulo}: ${p.imovel[it.k] ? "sim" : "não"}`),
        paragrafo: "Os estudos antigos da rede supunham de 40% a 50% dos alunos de carro (80 a 120 vagas para cerca de 2.850 alunos); a regra atual usa 20% a 30%. Fachada, polo comercial e acesso a pé ficam registrados e devem ser conferidos na visita.",
      });
      if (d.sugestoes) secoes.push({
        titulo: "Recomendação de Localização", novaPagina: true, linhas: [], texto: [textoSugestoes(d.sugestoes, "ponto", p.nome)], nota: LIMITES_SUGESTAO,
        ...(d.fotoSugestoes ? { foto: { dados: d.fotoSugestoes, legenda: `Pino com letra: o ponto estudado. Pinos cinza numerados: posições sugeridas (mesma numeração da tabela). Pinos vermelhos pequenos: World Gym.${d.temArea ? ` Linha verde: área de até ${d.minutos} min de carro do ponto.` : ""}` }, altFoto: ALT_FOTO_MAPA } : {}),
        ...(d.sugestoes.sugestoes.length ? { tabela: { colunas: ["Posição", "Distância", "Público", "Renda média", "Divide com a rede"], larguras: [0.6, 0.8, 0.8, 1, 2.2], linhas: linhasSugestoes(d.sugestoes) } } : {}),
      });
      if (pt.parecidas.itens.length) secoes.push({
        titulo: "Unidades Parecidas na Rede", novaPagina: true, linhas: [],
        texto: [leituraParecidas(pt.parecidas), ...pt.parecidas.itens.map((it) => `${it.leitura} A WG ${it.u.nome} vende ${it.u.vendas ? reais(it.u.vendas) : "—"} por mês${it.parecida ? "." : " (vizinhança diferente: só referência)."}`)],
        tabela: { colunas: ["Unidade", "Vendas por mês", "Moradores (2 km)", "Renda média", "Parecida?"], larguras: [1.6, 1, 1, 1, 0.8], linhas: pt.parecidas.itens.map((it) => [it.u.nome, it.u.vendas ? reais(it.u.vendas) : "—", mil(it.moradores), it.renda ? `R$ ${num(it.renda)}` : "—", it.parecida ? "sim" : "não"]) },
        paragrafo: `Unidades maduras do mesmo modelo, comparadas pelos moradores e pela renda média a até 2 km (Censo 2022). O ponto: ${mil(pt.parecidas.alvo.pop)} moradores${pt.parecidas.alvo.renda ? ` e renda média de R$ ${num(pt.parecidas.alvo.renda)}` : ""}.`,
      });
      // conclusão
      const m = merc ? resumoMercado({ perfil: merc.perfil, renda: merc.renda, pois: merc.pois, alunosNaArea: null }) : null;
      // fatia do potencial que o ponto precisaria para as vendas previstas, contra a faixa das unidades da rede (decisão do dono, 23/11/2026)
      const fatia = r && merc?.potencial?.total ? r.provavel / merc.potencial.total : null;
      const ff = d.faixaFatia ?? null;
      const conc: string[] = [];
      if (merc?.renda || merc?.perfil) conc.push(`O território ${area} tem ${merc?.perfil ? `${mil(merc.perfil.moradores)} moradores` : "população não medida"}${merc?.perfil?.domicilios ? ` em ${mil(merc.perfil.domicilios)} domicílios` : ""}${m?.perfilRenda ? `, com perfil socioeconômico ${m.perfilRenda}${merc?.renda ? ` (${pct(merc.renda.cde)} nas classes C, D e E)` : ""}` : ""}${merc?.perfil?.parte20a49 != null ? ` e ${pct(merc.perfil.parte20a49)} da população com 20 a 49 anos` : ""}. ${merc?.renda && merc.renda.cde >= 0.75 ? "É um mercado de volume, sensível a preço, que favorece o modelo Low Cost." : merc?.renda && merc.renda.ab >= 0.4 ? "A renda mais alta abre espaço para o modelo Pro e serviços de maior valor." : "O público combina faixas de renda diferentes."}`);
      if (m?.conc && m.habPorAcademia != null) conc.push(`Sob a ótica competitiva, há ${m.conc.diretos} concorrentes diretos${m.conc.nomesRedes.length ? `, entre eles ${m.conc.nomesRedes.map((x) => x.rede).join(", ")}` : ""}, e ${num(m.habPorAcademia)} habitantes por academia: concorrência ${m.nivelConcorrencia}. Pela premissa de penetração de ${pct(PENETRACAO_MERCADO)}, a área tem cerca de ${mil(m.praticantes)} praticantes.`);
      else conc.push("A concorrência não entrou neste estudo porque as academias concorrentes não foram buscadas antes de exportar; recomenda-se gerar o PDF com a busca feita.");
      if (fatia != null) conc.push(`Para vender ${reais(r!.provavel)} por mês, o ponto precisaria de ${pct(fatia)} do potencial de consumo da área em recreações e esportes (${reais(merc!.potencial!.total)} por mês). ${ff ? (fatia > ff.maxima ? `Nenhuma unidade da rede tira tanto do seu mercado: a maior fica em ${pct(ff.maxima)}, a típica em ${pct(ff.mediana)}.` : fatia > ff.comum ? `É mais do que 3 em cada 4 unidades da rede conseguem (até ${pct(ff.comum)}); só as mais fortes chegam a isso.` : `Está dentro do que a rede já faz (3 em cada 4 unidades ficam até ${pct(ff.comum)}).`) : ""}`);
      if (cap.divideCom.length) conc.push(`Dentro da rede, o ponto dividiria ${pct(cap.divideCom.reduce((a, x) => a + x.parte, 0))} do público com ${cap.divideCom.map((x) => x.nome).join(" e ")}.`);
      if (pp?.situacao) conc.push(`A população da área (${mil(pp.moradores)} moradores) está ${SITUACAO_POPULACAO[pp.situacao]} para a meta: a rede recomendaria cerca de ${mil(pp.recomendada)}.`);
      if (d.ticket && d.alunos) conc.push(`Com ticket sugerido de ${preco(d.ticket.preco)}, o ponto precisa atender cerca de ${num(d.alunos)} alunos${d.vagas ? ` e de ${d.vagas.min} a ${d.vagas.max} vagas de estacionamento (${d.vagas.situacao === "sem-dado" ? "vagas ainda não informadas" : `informadas ${d.vagas.informadas}, ${SITUACAO_VAGAS[d.vagas.situacao]}`})` : ""}.`);
      const vfin = r ? vereditoComFatia(vereditoFinal(r.veredito, d.vagas ?? null), fatia, ff) : null;
      if (r) conc.push(`Diante desse cenário, o estudo ${vfin === "aprovado" ? "aprova" : vfin === "atencao" ? "aprova com condicionantes" : "não aprova"} o ponto para o ${modelo}: vendas previstas de ${reais(r.provavel)} por mês, lucro de ${r.lucro > 0 ? reais(r.lucro) : "prejuízo"} e payback de ${meses(r.payback)}${vfin !== r.veredito ? ", mas o estacionamento não atende o mínimo, critério eliminatório da rede" : ""}.${d.sugestoes?.sugestoes.length ? ` Há posições até ${pct(d.sugestoes.sugestoes[0].ganho)} melhores em público a até ${d.sugestoes.sugestoes[0].distanciaKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km, que valem uma busca de imóveis antes de fechar.` : ""} A visibilidade da fachada e o acesso devem ser conferidos na visita.`);
      conc.push(`Situação no comitê de expansão: ${DECISAO_ROTULO[p.decisao?.status ?? "analise"]}${p.decisao?.unidade ? ` (${p.decisao.unidade})` : ""}${p.decisao?.em ? `, em ${new Date(p.decisao.em).toLocaleDateString("pt-BR")}` : ""}.${p.decisao?.comentario ? ` Comentário: ${p.decisao.comentario}` : ""}`);
      secoes.push({
        titulo: "Conclusão e Recomendação Final", novaPagina: true, linhas: [],
        faixa: vfin ? `Parecer do Atlas: ${PARECER_ROTULO[vfin]} · modelo ${modelo}${vfin !== r?.veredito ? (d.vagas?.situacao === "insuficiente" ? " (estacionamento)" : " (mercado da região)") : ""}` : undefined,
        texto: conc,
        paragrafo: `Premissas: vendas por m² das unidades maduras da rede, penetração de mercado de ${pct(PENETRACAO_MERCADO)}, população recomendada e ticket calibrados com as unidades da rede, estacionamento com 8% a 12% no pico e 20% a 30% de carro, classes de renda estimadas pela média e pela variação da renda de cada setor do Censo e gasto da POF corrigido pela inflação. Os números de mercado devem ser lidos como ordem de grandeza.`,
      });
    }
    paginas.push({
      titulo: `${pt.letra}. ${p.nome}`, subtitulo: `${p.endereco ?? pt.regiao} · ${modelo} · ${num(p.m2)} m²`,
      foto: { dados: pt.foto, legenda: "O ponto visto de cima (imagem de satélite)." },
      destaques: r ? [{ valor: reais(r.provavel), rotulo: "vendas por mês previstas" }, { valor: r.lucro > 0 ? reais(r.lucro) : "prejuízo", rotulo: "lucro por mês" }, { valor: meses(r.payback), rotulo: `payback (${VEREDITO_ROTULO[r.veredito].toLowerCase()})` }] : undefined,
      texto, numeros: [], secoes,
    });
  }

  return {
    arquivo: nomeDoArquivo(d.pontos.length === 1 ? `estudo-de-ponto-${d.pontos[0].ponto.nome}` : "estudos-de-ponto"), cabecalho: "Estudo de ponto", foto: null,
    capa: { titulo: "Estudo de Geomarketing", linha: "Avaliação de Ponto", subtitulo: d.pontos.map((x) => x.ponto.endereco ?? `${x.ponto.nome}${x.ponto.regiao ? ` | ${x.ponto.regiao}` : ""}`).join(" · ") }, // capa com o endereço do ponto (pedido do dono, 23/11/2026)
    paginas,
    ...(d.pontos.length > 1 ? {
      fotoComparacao: { dados: d.comparacao?.foto ?? null, legenda: "Letras: os pontos estudados; pinos vermelhos pequenos: unidades World Gym." },
      comparacao: {
        colunas: ["Ponto", "Modelo e m²", "Vendas previstas", "Payback", "Veredito", "Decisão"],
        linhas: d.pontos.map((x) => [`${x.letra}. ${x.ponto.nome}`, `${pr.modelos[x.ponto.modelo].nome}, ${num(x.ponto.m2)} m²`, x.resultado ? reais(x.resultado.provavel) : "—", x.resultado ? meses(x.resultado.payback) : "—", x.resultado ? VEREDITO_ROTULO[x.resultado.veredito] : "—", DECISAO_ROTULO[x.ponto.decisao?.status ?? "analise"]]),
      },
    } : {}),
  };
}
