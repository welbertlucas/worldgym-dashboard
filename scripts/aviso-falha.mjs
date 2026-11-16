// Avisa o dono por e-mail quando uma rotina do GitHub falha (disparado por .github/workflows/aviso-falha.yml).
// Uso: ROTINA="Atualizar indicadores do EVO" CONCLUSAO=failure LINK=https://... INICIO=2026-11-16T03:37:00Z RODADA=123 node scripts/aviso-falha.mjs
import { listarUsuarios } from "../server/acesso.js";
import { enviarEmail, envioConfigurado } from "../server/resumo.js";
import { textoDoAviso } from "../server/avisoFalha.js";

const { ROTINA = "rotina", CONCLUSAO = "failure", LINK = "", INICIO = "", RODADA = String(Date.now()) } = process.env;
if (!envioConfigurado()) { console.log("envio de e-mail não configurado: aviso não enviado"); process.exit(0); }
const donos = (await listarUsuarios()).filter((u) => u.papel === "dono" && u.ativo !== false);
if (!donos.length) { console.log("nenhum dono cadastrado"); process.exit(0); }
const { assunto, html } = textoDoAviso({ rotina: ROTINA, conclusao: CONCLUSAO, link: LINK, inicio: INICIO });
for (const u of donos) {
  await enviarEmail({ para: u.email, assunto, html, chaveUnica: `aviso-falha/${RODADA}/${u.email}` });
  console.log("aviso enviado ao dono");
}
