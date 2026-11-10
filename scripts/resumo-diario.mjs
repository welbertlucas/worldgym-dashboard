// Resumo diário por e-mail para todos os acessos ativos.
// Uso:  node --env-file=.env.local scripts/resumo-diario.mjs            -> envia (precisa de RESEND_API_KEY e RESUMO_REMETENTE)
//       node --env-file=.env.local scripts/resumo-diario.mjs --previa [dir]  -> grava um .html por usuário em `dir` e NÃO envia
//       acrescente --so=email@x.com para limitar a uma pessoa; --reenviar manda de novo para quem já recebeu hoje.
//       --para=teste@x.com (TESTE): manda os resumos para esse endereço, com "[TESTE]" no assunto; não grava foto nem o registro de enviados.
// Todo dia, antes de enviar, grava a "foto" dos números até ontem (base da comparação com o mesmo dia do mês seguinte).
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadAll } from "../server/store.js";
import { listarUsuarios } from "../server/acesso.js";
import { hojeBR } from "../server/evo.js";
import { lerMetasPlanilha } from "../server/metas.js";
import { montarResumo, renderizarEmail, assunto, enviarEmail, lerEnviados, salvarEnviados, chaveDoEnvio, diaAnterior, mesmoDiaMesAnterior, lerFoto, salvarFoto, fotoDe, dadosDeHoje } from "../server/resumo.js";

const args = process.argv.slice(2);
const previa = args.includes("--previa");
const dir = args.find((a, i) => args[i - 1] === "--previa" && !a.startsWith("--")) ?? "previa-resumo";
const so = args.find((a) => a.startsWith("--so="))?.slice(5).toLowerCase();
const reenviar = args.includes("--reenviar"); // manda de novo mesmo para quem já recebeu hoje (testes)
const para = args.find((a) => a.startsWith("--para="))?.slice(7).trim(); // teste: todos os resumos vão para este endereço
const teste = !!para;
const hoje = hojeBR();
const ateDia = diaAnterior(hoje);

const meses = (await loadAll()) ?? [];
const mes = meses.find((m) => m.month === ateDia.slice(0, 7));
const ref = await lerFoto(mesmoDiaMesAnterior(ateDia)).catch(() => null);
const ontem = await lerFoto(diaAnterior(ateDia)).catch(() => null); // base dos números "do dia"
console.log(`dia dos números: ${ateDia} | foto de referência (${mesmoDiaMesAnterior(ateDia)}): ${ref ? "ok" : "ainda não existe"}`);

// A foto de hoje só vale se o EVO terminou esta madrugada; senão ela ficaria com números velhos e enganaria a comparação do mês seguinte.
if (!previa && !teste && mes) {
  if (dadosDeHoje(mes, hoje)) { await salvarFoto(fotoDe(mes, ateDia)); console.log(`foto de ${ateDia} gravada`); }
  else console.log("EVO ainda não atualizou os dados de hoje: foto não gravada, e-mail leva o aviso de dados antigos");
}

// Metas vêm da aba "Metas" da planilha (precisa de GOOGLE_SERVICE_ACCOUNT_KEY). Sem meta para a unidade, o e-mail diz que ela não cadastrou meta.
let metas = null; // null = não deu para ler: o e-mail trata como meta não cadastrada
try { metas = await lerMetasPlanilha(); console.log(`metas lidas: ${metas.length}`); } catch (e) { console.log(`metas indisponíveis: ${e.message}`); }

const bannerArquivo = new URL("../server/assets/banner-resumo.png", import.meta.url);
const anexos = previa ? null : [{ filename: "banner-atlas.png", content: readFileSync(bannerArquivo).toString("base64"), content_id: "banner-atlas" }];
const usuarios = (await listarUsuarios()).filter((u) => u.ativo !== false && (!so || u.email === so));
if (previa) { mkdirSync(dir, { recursive: true }); copyFileSync(bannerArquivo, `${dir}/banner-resumo.png`); }

// Sem RESEND_API_KEY/RESUMO_REMETENTE o envio fica desligado: a foto do dia já foi gravada acima (o histórico das
// comparações começa a se formar) e o job termina sem erro, em vez de falhar todo dia até o Resend ser configurado.
if (!previa && !(process.env.RESEND_API_KEY && process.env.RESUMO_REMETENTE)) {
  console.log("envio desligado: RESEND_API_KEY e RESUMO_REMETENTE ainda não configurados (só a foto do dia foi gravada)");
  process.exit(0);
}

// Quem já recebeu o resumo deste dia fica de fora (rodar de novo depois de uma falha só completa o que faltou). --reenviar ignora o registro.
const enviados = previa || reenviar || teste ? new Set() : await lerEnviados(ateDia);
const PAUSA_MS = 300; // o Resend aceita 10 envios por segundo; a pausa deixa folga

let ok = 0, falhas = 0, sem = 0, ja = 0;
try {
  for (const u of usuarios) {
    const email = String(u.email).toLowerCase();
    if (enviados.has(email)) { ja++; console.log(`já enviado hoje: ${u.email}`); continue; }
    const r = montarResumo(meses, u, hoje, ref, metas, ontem);
    if (!r) { sem++; console.log(`sem dados: ${u.email}`); continue; }
    const html = renderizarEmail(r, u, { url: process.env.ATLAS_URL || undefined, urlWehelp: process.env.WEHELP_URL || undefined, contato: process.env.RESUMO_CONTATO || undefined, banner: previa ? "banner-resumo.png" : "cid:banner-atlas" });
    try {
      if (previa) writeFileSync(`${dir}/${u.email.replace(/[^a-z0-9@.]/g, "_")}.html`, `<!-- assunto: ${assunto(r).replace(/--/g, "- -")} -->\n${html}`);
      else {
        // --reenviar usa outra chave, senão o Resend devolveria o envio anterior sem mandar de novo
        const destino = teste ? para : u.email;
        const titulo = teste ? `[TESTE] ${assunto(r)} (resumo de ${u.email})` : assunto(r);
        const chave = teste ? `teste/${ateDia}/${email}/${Date.now()}` : chaveDoEnvio(ateDia, email) + (reenviar ? `/${Date.now()}` : "");
        const { repetido } = await enviarEmail({ para: destino, assunto: titulo, html, anexos, chaveUnica: chave });
        if (!teste) enviados.add(email);
        if (teste) console.log(`teste: resumo de ${u.email} enviado para ${para}`);
        if (repetido) { ja++; console.log(`já enviado hoje (confirmado pelo Resend): ${u.email}`); continue; }
        await new Promise((fim) => setTimeout(fim, PAUSA_MS));
      }
      ok++;
    } catch (e) {
      falhas++;
      console.log(`FALHOU ${u.email}: ${e.message}`);
    }
  }
} finally {
  if (!previa && !teste && enviados.size) await salvarEnviados(ateDia, enviados).catch((e) => console.log(`registro de enviados não gravado: ${e.message}`));
}
console.log(`${previa ? "prévias" : "enviados"}: ${ok} | já enviados antes: ${ja} | sem dados: ${sem} | falhas: ${falhas}`);
if (falhas) process.exitCode = 1;
