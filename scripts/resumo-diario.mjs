// Resumo diário por e-mail para todos os acessos ativos.
// Uso:  node --env-file=.env.local scripts/resumo-diario.mjs            -> envia (pelo Zoho com SMTP_USUARIO + SMTP_SENHA, ou pelo Resend com RESEND_API_KEY + RESUMO_REMETENTE)
//       node --env-file=.env.local scripts/resumo-diario.mjs --previa [dir]  -> grava um .html por usuário em `dir` e NÃO envia
//       acrescente --so=email@x.com para limitar a uma pessoa; --reenviar manda de novo para quem já recebeu hoje.
//       --para=teste@x.com (TESTE): manda os resumos para esse endereço, com "[TESTE]" no assunto; não grava foto nem o registro de enviados.
// Todo dia, antes de enviar, grava a "foto" dos números até ontem (base da comparação com o mesmo dia do mês seguinte).
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { loadAll, loadCampanhas, loadMetaMeses } from "../server/store.js";
import { alertasMeta } from "../server/alertasMeta.js";
import { listarUsuarios } from "../server/acesso.js";
import { hojeBR } from "../server/evo.js";
import { lerMetasPlanilha } from "../server/metas.js";
import { montarResumo, renderizarEmail, assunto, enviarEmail, envioConfigurado, smtpConfigurado, lerEnviados, salvarEnviados, chaveDoEnvio, diaAnterior, mesmoDiaMesAnterior, lerFoto, salvarFoto, fotoDe, dadosDeHoje } from "../server/resumo.js";

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

// Alertas do tráfego pago (Meta): campanhas da foto do dia e unidades no mês, cruzadas com os alunos do EVO.
let alertasDoMeta = [];
let metaMesesDoResumo = null; // investimento, contatos e vendas pelo pixel do mês (parágrafo "Tráfego pago")
try {
  const [foto, metaMeses] = await Promise.all([loadCampanhas(), loadMetaMeses()]);
  metaMesesDoResumo = metaMeses;
  const ym = ateDia.slice(0, 7), [a, m] = ym.split("-").map(Number), ant = m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
  alertasDoMeta = alertasMeta({ campanhas: foto?.campanhas ?? [], metaMes: metaMeses?.[ym], metaAnterior: metaMeses?.[ant], evoMes: mes, evoAnterior: meses.find((x) => x.month === ant), hoje, historico: metaMeses ?? undefined });
  console.log(`alertas do Meta: ${alertasDoMeta.length}`);
} catch (e) { console.log(`alertas do Meta indisponíveis: ${e.message}`); }

// Imagens publicadas no site do Atlas (public/email): o e-mail só aponta para elas, sem anexos (o Gmail mostrava cada imagem como anexo).
const asset = (nome) => new URL(`../public/email/${nome}`, import.meta.url);
const IMAGENS = `${(process.env.ATLAS_URL || "https://atlas.worldgymacademia.com.br").replace(/\/$/, "")}/email`;
const usuarios = (await listarUsuarios()).filter((u) => u.ativo !== false && (!so || u.email === so));
if (previa) { mkdirSync(dir, { recursive: true }); for (const f of ["banner-resumo.png", "assinatura-logo.png", "assinatura-selo.png"]) copyFileSync(asset(f), `${dir}/${f}`); }

// Sem Zoho (SMTP_USUARIO/SMTP_SENHA) nem Resend (RESEND_API_KEY/RESUMO_REMETENTE) o envio fica desligado: a foto do dia já foi
// gravada acima (o histórico das comparações começa a se formar) e o job termina sem erro, em vez de falhar todo dia.
if (!previa && !envioConfigurado()) {
  console.log("envio desligado: nem o Zoho (SMTP_USUARIO/SMTP_SENHA) nem o Resend estão configurados (só a foto do dia foi gravada)");
  process.exit(0);
}
if (!previa) console.log(`envio pelo ${smtpConfigurado() ? "Zoho" : "Resend"}`);

// Quem já recebeu o resumo deste dia fica de fora (rodar de novo depois de uma falha só completa o que faltou). --reenviar ignora o registro.
const enviados = previa || reenviar || teste ? new Set() : await lerEnviados(ateDia);
const PAUSA_MS = smtpConfigurado() ? 2000 : 300; // Resend: 10 por segundo; Zoho limita envios em rajada, então vai com calma

let ok = 0, falhas = 0, sem = 0, ja = 0;
try {
  for (const u of usuarios) {
    const email = String(u.email).toLowerCase();
    if (enviados.has(email)) { ja++; console.log(`já enviado hoje: ${u.email}`); continue; }
    const r = montarResumo(meses, u, hoje, ref, metas, ontem, alertasDoMeta, metaMesesDoResumo);
    if (!r) { sem++; console.log(`sem dados: ${u.email}`); continue; }
    const html = renderizarEmail(r, u, { url: process.env.ATLAS_URL || undefined, urlWehelp: process.env.WEHELP_URL || undefined, contato: process.env.RESUMO_CONTATO || undefined, banner: previa ? "banner-resumo.png" : `${IMAGENS}/banner-resumo.png`, assinatura: previa ? undefined : { logo: `${IMAGENS}/assinatura-logo.png`, selo: `${IMAGENS}/assinatura-selo.png` } });
    try {
      if (previa) writeFileSync(`${dir}/${u.email.replace(/[^a-z0-9@.]/g, "_")}.html`, `<!-- assunto: ${assunto(r).replace(/--/g, "- -")} -->\n${html}`);
      else {
        // --reenviar usa outra chave, senão o Resend devolveria o envio anterior sem mandar de novo
        const destino = teste ? para : u.email;
        const titulo = teste ? `[TESTE] ${assunto(r)} (resumo de ${u.email})` : assunto(r);
        const chave = teste ? `teste/${ateDia}/${email}/${Date.now()}` : chaveDoEnvio(ateDia, email) + (reenviar ? `/${Date.now()}` : "");
        const { repetido } = await enviarEmail({ para: destino, assunto: titulo, html, chaveUnica: chave });
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
