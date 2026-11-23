// PDF do estudo de ponto novo, no mesmo roteiro do estudo de geomarketing da rede (e do PDF da unidade): objetivo, metodologia,
// resumo de cada ponto e, do ponto aberto na tela, captação, faixa etária, domicílios, perfil socioeconômico, potencial de consumo,
// concorrência, canibalização, cenários de faturamento, o imóvel, a recomendação de localização, unidades parecidas e a conclusão.
// Os textos são montados por regras fixas a partir dos números da tela; o que é estimativa ou premissa aparece escrito como tal.
import type { ConteudoPdf, PaginaDoEstudo, Secao } from "@/lib/estudoPdf";
import { nomeDoArquivo } from "@/lib/estudoPdf";
import { DECISAO_ROTULO, VEREDITO_ROTULO, meses, reais, type Captacao, type Fator, type Ponto, type Premissas, type Resultado, type UnidadeEstudo } from "@/lib/estudoPonto";
import { PENETRACAO_MERCADO, resumoMercado, secoesDeMercado, type DadosMercado } from "@/components/estudos/pdfUnidade";
import { LIMITES_SUGESTAO, linhasSugestoes, textoSugestoes, type ResultadoSugestoes } from "@/components/estudos/sugestoes";

const pct = (x: number | null | undefined, casas = 0) => (x == null ? "—" : `${(x * 100).toLocaleString("pt-BR", { maximumFractionDigits: casas })}%`);
const num = (x: number) => Math.round(x).toLocaleString("pt-BR");
const mil = (x: number | null | undefined) => (x == null ? "—" : x >= 10000 ? `${Math.round(x / 1000).toLocaleString("pt-BR")} mil` : num(x));

export interface PontoNoPdf {
  ponto: Ponto; letra: string; regiao: string; resultado: Resultado | null; captacao: Captacao; fatores: Fator[];
  parecidas: UnidadeEstudo[]; foto: string | null;
}
export interface DadosPdfPonto {
  pontos: PontoNoPdf[]; premissas: Premissas; minutos: number; temArea: boolean;
  /** Só do ponto aberto na tela (as buscas e fotos da área são dele). */
  atualId: string | null; mercado: Omit<DadosMercado, "tipo" | "nome" | "area" | "vendas" | "alunosNaArea"> | null;
  fotoCaptacao: string | null; fotoRede: string | null; sugestoes: ResultadoSugestoes | null;
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
      paragrafo: "Os dados do Censo são agregados em hexágonos de cerca de 300 m e contados quando o centro do hexágono cai dentro da área.",
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
          foto: { dados: d.fotoCaptacao, legenda: `Mais escuro = onde o modelo espera mais alunos.${d.temArea ? ` Linha verde: área de até ${d.minutos} min de carro.` : ""}` }, altFoto: 110,
        });
      }
      if (merc) secoes.push(...secoesDeMercado({ ...merc, tipo: "ponto", nome: p.nome, area, vendas: r?.meta ?? null, alunosNaArea: null }));
      secoes.push({
        titulo: "Canibalização com a Rede", novaPagina: true, linhas: [],
        texto: [cap.divideCom.length
          ? `A área do ponto se sobrepõe à de unidades World Gym. Pelo modelo de captação, ${cap.divideCom.map((x) => `${pct(x.parte)} do público seria dividido com a ${x.nome}`).join(", ")}. ${cap.divideCom.reduce((a, x) => a + x.parte, 0) >= 0.25 ? "É uma sobreposição alta: a nova unidade tiraria alunos da rede, o que precisa entrar na decisão." : "É uma sobreposição moderada, aceitável em redes adensadas."}`
          : "Nenhuma World Gym divide de forma relevante a área do ponto: a nova unidade não tiraria alunos da rede."],
        ...(d.fotoRede ? { foto: { dados: d.fotoRede, legenda: "Bolinhas vermelhas: World Gym em operação. Círculos: área de cada uma." }, altFoto: 95 } : {}),
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
      secoes.push({
        titulo: "O Imóvel e a Decisão", novaPagina: true, linhas: [],
        lista: [...d.itensImovel.map((it) => `${it.rotulo}: ${p.imovel[it.k] ? "sim" : "não"}`), `Decisão: ${DECISAO_ROTULO[p.decisao?.status ?? "analise"]}${p.decisao?.unidade ? ` (${p.decisao.unidade})` : ""}${p.decisao?.em ? `, em ${new Date(p.decisao.em).toLocaleDateString("pt-BR")}` : ""}`],
        ...(p.decisao?.comentario ? { nota: p.decisao.comentario } : {}),
        paragrafo: "Os itens do imóvel ficam registrados no estudo e ainda não mudam a conta: o peso de cada um será medido com as unidades da rede.",
      });
      if (d.sugestoes) secoes.push({
        titulo: "Recomendação de Localização", novaPagina: true, linhas: [], texto: [textoSugestoes(d.sugestoes, "ponto", p.nome)], nota: LIMITES_SUGESTAO,
        ...(d.sugestoes.sugestoes.length ? { tabela: { colunas: ["Posição", "Distância", "Público", "Renda média", "Divide com a rede"], larguras: [0.6, 0.8, 0.8, 1, 2.2], linhas: linhasSugestoes(d.sugestoes) } } : {}),
      });
      if (pt.parecidas.length) secoes.push({
        titulo: "Unidades Parecidas na Rede", linhas: [],
        texto: ["Unidades maduras do mesmo modelo com quantidade de moradores e renda parecidas a até 2 km: são a referência real do que um ponto assim costuma vender."],
        tabela: { colunas: ["Unidade", "Tamanho", "Vendas por mês"], larguras: [2, 1, 1], linhas: pt.parecidas.map((u) => [u.nome, u.m2 ? `${num(u.m2)} m²` : "—", u.vendas ? reais(u.vendas) : "—"]) },
      });
      // conclusão
      const m = merc ? resumoMercado({ perfil: merc.perfil, renda: merc.renda, pois: merc.pois, alunosNaArea: null }) : null;
      const fatia = r && merc?.potencial?.total ? r.meta / merc.potencial.total : null;
      const conc: string[] = [];
      if (merc?.renda || merc?.perfil) conc.push(`O território ${area} tem ${merc?.perfil ? `${mil(merc.perfil.moradores)} moradores` : "população não medida"}${merc?.perfil?.domicilios ? ` em ${mil(merc.perfil.domicilios)} domicílios` : ""}${m?.perfilRenda ? `, com perfil socioeconômico ${m.perfilRenda}${merc?.renda ? ` (${pct(merc.renda.cde)} nas classes C, D e E)` : ""}` : ""}${merc?.perfil?.parte20a49 != null ? ` e ${pct(merc.perfil.parte20a49)} da população com 20 a 49 anos` : ""}. ${merc?.renda && merc.renda.cde >= 0.75 ? "É um mercado de volume, sensível a preço, que favorece o modelo Low Cost." : merc?.renda && merc.renda.ab >= 0.4 ? "A renda mais alta abre espaço para o modelo Pro e serviços de maior valor." : "O público combina faixas de renda diferentes."}`);
      if (m?.conc && m.habPorAcademia != null) conc.push(`Sob a ótica competitiva, há ${m.conc.diretos} concorrentes diretos${m.conc.nomesRedes.length ? `, entre eles ${m.conc.nomesRedes.map((x) => x.rede).join(", ")}` : ""}, e ${num(m.habPorAcademia)} habitantes por academia: concorrência ${m.nivelConcorrencia}. Pela premissa de penetração de ${pct(PENETRACAO_MERCADO)}, a área tem cerca de ${mil(m.praticantes)} praticantes.`);
      else conc.push("A concorrência não entrou neste estudo porque as academias concorrentes não foram buscadas antes de exportar; recomenda-se gerar o PDF com a busca feita.");
      if (fatia != null) conc.push(`Para chegar à meta, o ponto precisaria capturar ${pct(fatia)} do potencial de consumo da área em recreações e esportes, ${fatia >= 0.36 ? "acima do que os estudos da rede consideram viável (~36%)" : fatia >= 0.33 ? "na zona de atenção dos estudos da rede (33% a 35%)" : "dentro do que os estudos da rede consideram capturável (até ~32%)"}.`);
      if (cap.divideCom.length) conc.push(`Dentro da rede, o ponto dividiria ${pct(cap.divideCom.reduce((a, x) => a + x.parte, 0))} do público com ${cap.divideCom.map((x) => x.nome).join(" e ")}.`);
      if (r) conc.push(`Diante desse cenário, o modelo ${r.veredito === "aprovado" ? "aprova" : r.veredito === "atencao" ? "coloca em atenção" : "não aprova"} o ponto para o ${modelo}: vendas previstas de ${reais(r.provavel)} por mês, lucro de ${r.lucro > 0 ? reais(r.lucro) : "prejuízo"} e payback de ${meses(r.payback)}.${d.sugestoes?.sugestoes.length ? ` Há posições até ${pct(d.sugestoes.sugestoes[0].ganho)} melhores em público a até ${d.sugestoes.sugestoes[0].distanciaKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km, que valem uma busca de imóveis antes de fechar.` : ""} O estacionamento e a visibilidade do imóvel precisam ser conferidos na visita.`);
      secoes.push({
        titulo: "Conclusão e Recomendação Final", novaPagina: true, linhas: [],
        faixa: r ? `${r.veredito === "aprovado" ? "Recomendado" : r.veredito === "atencao" ? "Atenção" : "Não recomendado"}: modelo ${modelo}` : undefined,
        texto: conc,
        paragrafo: `Premissas: vendas por m² das unidades maduras da rede, penetração de mercado de ${pct(PENETRACAO_MERCADO)}, classes estimadas pela renda média do Censo e gasto da POF corrigido pela inflação. Os números de mercado devem ser lidos como ordem de grandeza.`,
      });
    }
    paginas.push({
      titulo: `${pt.letra}. ${p.nome}`, subtitulo: `${pt.regiao} · ${modelo} · ${num(p.m2)} m²`,
      foto: { dados: pt.foto, legenda: "O ponto visto de cima (imagem de satélite)." },
      destaques: r ? [{ valor: reais(r.provavel), rotulo: "vendas por mês previstas" }, { valor: r.lucro > 0 ? reais(r.lucro) : "prejuízo", rotulo: "lucro por mês" }, { valor: meses(r.payback), rotulo: `payback (${VEREDITO_ROTULO[r.veredito].toLowerCase()})` }] : undefined,
      texto, numeros: [], secoes,
    });
  }

  return {
    arquivo: nomeDoArquivo(d.pontos.length === 1 ? `estudo-de-ponto-${d.pontos[0].ponto.nome}` : "estudos-de-ponto"), cabecalho: "Estudo de ponto", foto: null,
    capa: { titulo: "Estudo de Geomarketing", linha: "Avaliação de Ponto", subtitulo: d.pontos.map((x) => `${x.ponto.nome}${x.ponto.regiao ? ` | ${x.ponto.regiao}` : ""}`).join(" · ") },
    paginas,
    ...(d.pontos.length > 1 ? {
      fotoComparacao: { dados: d.comparacao?.foto ?? null, legenda: "Letras: os pontos estudados; bolinhas vermelhas: unidades World Gym." },
      comparacao: {
        colunas: ["Ponto", "Modelo e m²", "Vendas previstas", "Payback", "Veredito", "Decisão"],
        linhas: d.pontos.map((x) => [`${x.letra}. ${x.ponto.nome}`, `${pr.modelos[x.ponto.modelo].nome}, ${num(x.ponto.m2)} m²`, x.resultado ? reais(x.resultado.provavel) : "—", x.resultado ? meses(x.resultado.payback) : "—", x.resultado ? VEREDITO_ROTULO[x.resultado.veredito] : "—", DECISAO_ROTULO[x.ponto.decisao?.status ?? "analise"]]),
      },
    } : {}),
  };
}
