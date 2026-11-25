// E-mail de comunicado (novidade do Atlas), no mesmo visual do resumo diário das 6h47: banner, caixa de destaques,
// seções separadas por pontos vermelhos, botão, assinatura e rodapé. Só monta o HTML; quem envia é outro passo, sempre depois da aprovação do dono.
import { ASSINATURA, CONTATO_PADRAO, ESTILO, blocoAssinatura } from "./resumo.js";

const { sans, VERMELHO, TINTA, TEXTO, SUAVE, FUNDO, CAIXA, TRACO, P, b, esc, secao, tituloSecao } = ESTILO;
const DIAS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

/** `texto` aceita <strong> pelo helper `b`; o restante é escapado por quem monta o conteúdo. */
export function renderizarComunicado({ nome = "", intro, destaquesTitulo = "Em resumo", destaques = [], secoes = [], botao, data = new Date(), url = "https://atlas.worldgymacademia.com.br", banner = "banner-resumo.png", assinatura = ASSINATURA.imagens, contato = CONTATO_PADRAO, previa = "" }) {
  const primeiro = esc(String(nome).trim().split(/\s+/)[0] || "");
  const dt = new Date(data);
  const rotuloData = `${DIAS[dt.getUTCDay()]} | ${String(dt.getUTCDate()).padStart(2, "0")} DE ${MESES[dt.getUTCMonth()]}`;
  const caixa = destaques.length ? `${tituloSecao(destaquesTitulo, TINTA, 34)}
<table role="presentation" width="100%" style="margin:0 0 14px;border-collapse:separate;background:${CAIXA};border-radius:14px"><tr><td style="padding:20px 22px 8px">
${destaques.map(([e, txt]) => `<p style="margin:0 0 12px;font-family:${sans};font-size:15px;line-height:1.55;color:${TEXTO}">${e}&nbsp; ${txt}</p>`).join("")}
</td></tr></table>` : "";
  const figura = (i) => `<table role="presentation" width="100%" style="margin:6px 0 20px;border-collapse:collapse"><tr><td style="padding:0"><img src="${esc(i.src)}" alt="${esc(i.alt)}" width="${i.largura ?? 504}" style="display:block;width:100%;max-width:${i.largura ?? 504}px;height:auto;border:1px solid ${TRACO};border-radius:12px;margin:0 auto"></td></tr>${i.legenda ? `<tr><td style="padding:8px 4px 0;font-family:${sans};font-size:13px;line-height:1.5;color:${SUAVE};text-align:center">${i.legenda}</td></tr>` : ""}</table>`;
  const corpo = secoes.map((x) => secao(x.titulo, x.emoji, [...(x.paragrafos ?? []).map((t) => `<p style="${P}">${t}</p>`), ...(x.imagens ?? []).map(figura)].join("\n"))).join("\n");
  const rodape = ["Você recebe este e-mail porque tem acesso ao World Gym Atlas.", contato ? `Dúvidas ou sugestões: <a href="mailto:${esc(contato)}" style="color:#7a7a85">${esc(contato)}</a>.` : ""].filter(Boolean).join("<br>");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"><style>@media (max-width:520px){.miolo{padding:26px 20px 34px!important}.as-logo{padding-right:10px!important}.as-logo img{width:56px!important}.as-texto{padding-left:10px!important}.as-linha{padding-right:8px!important}.as-site{font-size:12px!important}.as-selo{padding-left:8px!important}.as-selo img{width:44px!important}}</style></head>
<body style="margin:0;background:${FUNDO}">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${FUNDO};mso-hide:all">${esc(previa)}${"&#847;&zwnj;&nbsp;".repeat(90)}</div>
<table role="presentation" width="100%" style="background:${FUNDO}"><tr><td align="center" style="padding:28px 12px 36px">
<table role="presentation" width="100%" style="max-width:600px;border-collapse:collapse">
<tr><td style="padding:0;font-size:0;line-height:0"><img src="${esc(banner)}" width="600" alt="World Gym" style="display:block;width:100%;max-width:600px;height:auto;border-radius:30px 30px 0 0"></td></tr>
<tr><td class="miolo" style="background:#ffffff;padding:30px 48px 42px;border-radius:0 0 18px 18px">
<p style="${P}">Olá${primeiro ? ", " + primeiro : ""}! ${intro}</p>
<p style="margin:26px 0 0;padding:12px 0;border-top:1px solid ${TRACO};border-bottom:1px solid ${TRACO};text-align:center;font-family:${sans};font-size:14px;letter-spacing:.6px;color:${SUAVE}">${rotuloData}</p>
${caixa}
${corpo}
${botao ? `<p style="margin:36px 0 0" align="center"><a href="${esc(botao.url)}" style="display:inline-block;background:${VERMELHO};color:#ffffff;text-decoration:none;font-family:${sans};font-size:15px;font-weight:600;padding:14px 30px;border-radius:999px">${esc(botao.texto)}</a></p>` : ""}
${blocoAssinatura(assinatura)}
</td></tr>
<tr><td style="padding:22px 8px 0;font-family:${sans};font-size:12px;line-height:1.7;color:#9a9aa5;text-align:center">${rodape}</td></tr>
</table></td></tr></table></body></html>`;
}

/** O comunicado do Gerador de escalas dentro do Atlas (25/11/2026). */
export function comunicadoEscalas({ nome, data, url, fontes = {} } = {}) {
  const base = url ?? "https://atlas.worldgymacademia.com.br";
  return {
    assunto: "O Gerador de escalas agora fica dentro do Atlas",
    html: renderizarComunicado({
      nome, data, url: base,
      ...(fontes.banner ? { banner: fontes.banner } : {}), ...(fontes.logo ? { assinatura: { logo: fontes.logo, selo: fontes.selo } } : {}),
      previa: "O site das escalas foi para dentro do Atlas: sem login à parte, com escala livre, histórico e avisos.",
      intro: `O ${b("Gerador de escalas")} agora faz parte do Atlas. Você o encontra no menu lateral, sem precisar de outro login, e tudo o que já estava no sistema antigo veio junto: as escalas, as equipes e as regras de cada unidade.`,
      destaquesTitulo: "Na novidade de hoje",
      destaques: [
        ["📅", `Menu ${b("Gerador de escalas")} no lado esquerdo do Atlas`],
        ["🔑", `${b("Sem login à parte")}: quem entra no Atlas já está dentro`],
        ["✏️", `${b("Escala livre")}, histórico de versões e avisos de prazo`],
        ["📦", `${b("Nada a cadastrar de novo")}: escalas e equipes foram trazidas`],
      ],
      secoes: [
        { titulo: "Veja como ficou", emoji: "👀", paragrafos: [`Um passeio rápido: do menu lateral até o exemplo de um modelo de escala, com nomes fictícios.`], imagens: [
          { src: fontes.gif ?? "escalas-passeio.gif", alt: "Passeio animado pelo Gerador de escalas: o menu lateral, as abas, os modelos de escala e o exemplo de um modelo", legenda: "Do menu ao exemplo de um modelo, em poucos segundos" },
        ] },
        { titulo: "O que melhorou", emoji: "✨", paragrafos: [
          `${b("Escala livre")}: para quando as regras do 5x2 não servem. Você monta a grade à mão e troca qualquer dia e horário. A única trava é o limite de horas por semana: ${b("42 horas")} para cada pessoa e ${b("30 horas")} para estagiários, pela Lei do Estágio.`,
          `${b("Modelos prontos")} em cards, com ver exemplo e usar o modelo em um clique, e o ${b("histórico de versões")}: cada escala guarda o que foi feito, quem elaborou e quem alterou por último, e deixa voltar a uma versão anterior.`,
          `Um botão de ${b("Avisos")} lembra do prazo da rede, das escalas que ainda não foram criadas ou confirmadas e das alterações feitas por outras pessoas.`,
          `${b("PDF de vários meses")} em um único arquivo, PDF individual de cada colaborador, exportação em Excel e o ${b("Relatório do mês")}, com as horas e os dias de cada pessoa, para enviar à contabilidade. Dono e Master também têm o ${b("Painel da rede")}, que mostra quais unidades já confirmaram a escala do mês.`,
        ] },
        { titulo: "Como começar", emoji: "🚀", paragrafos: [
          `Entre no Atlas, abra ${b("Gerador de escalas")} no menu lateral e escolha a unidade. Na Central de ajuda há uma seção só sobre o gerador, com o passo a passo.`,
        ] },
      ],
      botao: { texto: "Abrir o Gerador de escalas", url: `${base}/#escalas` },
    }),
  };
}
