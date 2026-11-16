// Texto do e-mail que avisa o dono quando uma rotina automática falha (scripts/aviso-falha.mjs).

/** O que cada rotina deixa de fazer quando falha, em linguagem de quem usa o Atlas. */
export const EFEITO_DA_FALHA = {
  "Atualizar indicadores do EVO": "Os números do Atlas e do e-mail de amanhã podem ficar com os dados de ontem.",
  "Resumo diário por e-mail": "Algumas pessoas podem não ter recebido o resumo de hoje. Rodar de novo só manda para quem ficou de fora.",
  "Backup dos usuários": "A cópia de segurança dos acessos de hoje não foi feita.",
  "Atualizar campanhas do Meta": "O tráfego pago no Atlas fica com os números da última leitura.",
  "Atualizar Instagram das unidades": "Os números do Instagram ficam com a última leitura (ela roda de novo em 4 horas).",
  "Deploy para GitHub Pages": "A última mudança do Atlas não foi publicada; o site continua na versão anterior.",
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Hora de Brasília (dd/mm às hh:mm) de um instante ISO; "" se inválido. */
export function horaBR(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = Object.fromEntries(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month} às ${p.hour}h${p.minute}`;
}

export function textoDoAviso({ rotina, conclusao, link, inicio }) {
  const quando = horaBR(inicio);
  const como = conclusao === "timed_out" ? "passou do tempo limite e foi interrompida" : "falhou";
  const efeito = EFEITO_DA_FALHA[rotina] ?? "";
  const assunto = `World Gym Atlas · falha: ${rotina}`;
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:560px">
<p>A rotina <strong>${esc(rotina)}</strong>${quando ? `, que começou em ${quando},` : ""} ${como}.</p>
${efeito ? `<p>${esc(efeito)}</p>` : ""}
${link ? `<p><a href="${esc(link)}" style="color:#C41230">Ver o registro da rodada no GitHub</a></p>` : ""}
<p style="color:#666;font-size:13px">Aviso automático do Atlas. Só chega quando alguma rotina dá errado.</p>
</div>`;
  return { assunto, html };
}
