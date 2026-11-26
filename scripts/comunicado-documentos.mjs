// Comunicado "Documentos das unidades".
//   node scripts/comunicado-documentos.mjs [dir]                          -> PRÉVIA: grava dir/comunicado-documentos.html. NÃO envia, não lê usuários, não usa segredo.
//   node --env-file=.env.local scripts/comunicado-documentos.mjs --testar=email@x.com  -> manda UM e-mail de teste só para esse endereço (assunto com [TESTE]).
//   node --env-file=.env.local scripts/comunicado-documentos.mjs --todos               -> ENSAIO: só conta quantos usuários ativos receberiam (não envia, não imprime e-mails).
//   node --env-file=.env.local scripts/comunicado-documentos.mjs --todos --confirmar   -> ENVIA para todos os usuários ativos (só depois do "Pode enviar" do dono). Quem já recebeu fica de fora se rodar de novo.
import { mkdirSync, writeFileSync, copyFileSync, readFileSync } from "node:fs";
import { comunicadoDocumentos } from "../server/comunicado.js";
import { enviarEmail, envioConfigurado, smtpConfigurado, lerEnviados, salvarEnviados } from "../server/resumo.js";
import { listarUsuarios } from "../server/acesso.js";

const args = process.argv.slice(2);
const teste = args.find((a) => a.startsWith("--testar="))?.slice("--testar=".length);
const IMG = ["banner-resumo.png", "assinatura-logo.png", "assinatura-selo.png"];
const arquivo = (f) => new URL(`../public/email/${f}`, import.meta.url);

const todos = args.includes("--todos"), confirmar = args.includes("--confirmar");
const IMG_CID = () => IMG.map((f) => ({ filename: f, content: readFileSync(arquivo(f)).toString("base64"), content_id: f.replace(/\.(png|gif)$/, "") }));
const CID = { banner: "cid:banner-resumo", logo: "cid:assinatura-logo", selo: "cid:assinatura-selo" };

if (todos) {
  const usuarios = (await listarUsuarios()).filter((u) => u.ativo !== false && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(u.email ?? "")));
  const REGISTRO = "comunicado-documentos-2026-11-26";
  const ja = confirmar ? await lerEnviados(REGISTRO) : new Set();
  const falta = usuarios.filter((u) => !ja.has(String(u.email).toLowerCase()));
  console.log(`usuários ativos: ${usuarios.length} | já receberam: ${usuarios.length - falta.length} | a enviar: ${falta.length}`);
  if (!confirmar) { console.log("ENSAIO: nada foi enviado. Para enviar: acrescente --confirmar"); process.exit(0); }
  if (!envioConfigurado()) { console.log("envio desligado: Zoho/Resend não configurados neste ambiente"); process.exit(1); }
  const anexos = IMG_CID(); let ok = 0, falhas = 0;
  for (const u of falta) {
    const email = String(u.email).toLowerCase();
    try {
      const { assunto, html } = comunicadoDocumentos({ nome: u.nome, data: new Date(), fontes: CID });
      await enviarEmail({ para: u.email, assunto, html, anexos, chaveUnica: `${REGISTRO}/${email}` });
      ja.add(email); ok++;
      await new Promise((fim) => setTimeout(fim, smtpConfigurado() ? 2000 : 300));
    } catch (e) { falhas++; console.log(`falha para um destinatário: ${e.message}`); }
  }
  await salvarEnviados(REGISTRO, ja).catch((e) => console.log(`registro de enviados não gravado: ${e.message}`));
  console.log(`enviados: ${ok} | falhas: ${falhas}`);
} else if (teste) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teste)) { console.log("endereço de teste inválido"); process.exit(1); }
  if (!envioConfigurado()) { console.log("envio desligado: Zoho/Resend não configurados neste ambiente"); process.exit(1); }
  const { assunto, html } = comunicadoDocumentos({ nome: "", data: new Date(), fontes: CID });
  await enviarEmail({ para: teste, assunto: `[TESTE] ${assunto}`, html, anexos: IMG_CID(), chaveUnica: `teste-comunicado-documentos/${Date.now()}` });
  console.log(`teste enviado para ${teste}`);
} else {
  const dir = args[0] ?? "previa-comunicado";
  mkdirSync(dir, { recursive: true });
  for (const f of IMG) copyFileSync(arquivo(f), `${dir}/${f}`);
  const { assunto, html } = comunicadoDocumentos({ nome: "Maria Souza", data: new Date() });
  writeFileSync(`${dir}/comunicado-documentos.html`, `<!-- assunto: ${assunto} -->\n${html}`);
  console.log(`prévia gravada em ${dir}/comunicado-documentos.html | assunto: ${assunto}`);
}
