// Royalties, Jurídico e Qualidade (as três telas passam por aqui para caber no limite de funções da Vercel; /api/juridico e /api/qualidade são rewrites).
//   GET /api/royalties -> { disponivel: false } enquanto a rotina de royalties não enviar dados, ou { disponivel: true, ...modelo }. Só dono, Master e liberados.
//   GET /api/juridico  -> { disponivel: false } ou { disponivel: true, ...modelo }. Só o dono e quem ele liberou (modelo sem nome de parte contrária).
//   GET /api/qualidade -> { modo, unidades, modelos, visitas, envios }; GET ?foto=<id> -> a foto (JPEG).
//     modo "completo" (dono e liberados): tudo; modo "unidade" (quem foi liberado a preencher): só os checklists da unidade e os próprios envios.
//   POST /api/qualidade { acao: "modelo" | "modelo-apagar" | "foto" | "visita" | "visita-apagar" | "envio" | "envio-apagar", ... }.
// Dado sensível: sem cache no navegador e permissão conferida a cada pedido.
import { lerRoyalties } from "../server/royalties.js";
import { lerJuridico } from "../server/juridico.js";
import { ErroQualidade, apagarEnvio, apagarModelo, apagarVisita, enviosRecentes, fotoDeEnvioDe, lerFoto, lerModelos, modelosDaUnidade, salvarEnvio, salvarFoto, salvarModelo, salvarVisita, visitasRecentes } from "../server/qualidade.js";
import { UNIDADES_DA_REDE } from "../server/acesso.js";
import { cors, exigirLogin } from "./_auth.js";

const doCorpo = (req) => {
  if (typeof req.body !== "string") return req.body ?? {};
  try { return JSON.parse(req.body); } catch { return {}; }
};

async function qualidade(req, res, sessao) {
  // Dois acessos: o completo (dono e liberados: checklists, visitas, notas e o que as unidades enviam) e o da unidade (só preencher o checklist da própria
  // unidade e ver os próprios envios). O dono tem os dois.
  const completo = sessao.verQualidade === true;
  const proprias = sessao.papel === "unidades" ? sessao.unidades.filter((u) => UNIDADES_DA_REDE.includes(u)) : UNIDADES_DA_REDE;
  if (req.method === "GET") {
    if (req.query?.foto) {
      const id = String(req.query.foto);
      if (!completo && !(await fotoDeEnvioDe(id, proprias))) return res.status(404).json({ error: "Foto não encontrada." });
      const bytes = await lerFoto(id);
      res.setHeader("Content-Type", "image/jpeg");
      return res.status(200).send(bytes);
    }
    if (completo) return res.status(200).json({ modo: "completo", unidades: UNIDADES_DA_REDE, modelos: await lerModelos(), visitas: await visitasRecentes(), envios: await enviosRecentes(45) });
    return res.status(200).json({ modo: "unidade", unidades: proprias, modelos: modelosDaUnidade(await lerModelos()), visitas: [], envios: await enviosRecentes(30, new Date(), proprias) });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "método não permitido" });
  const { acao, ...c } = doCorpo(req);
  if (acao === "foto") return res.status(200).json({ id: await salvarFoto(c.dados) });
  if (acao === "envio") {
    if (!sessao.preencheChecklist) return res.status(403).json({ error: "sem permissão" });
    return res.status(200).json({ envio: await salvarEnvio(c.envio, { nome: sessao.nome, email: sessao.email }, proprias) });
  }
  if (!completo) return res.status(403).json({ error: "sem permissão" });
  if (acao === "modelo") return res.status(200).json({ modelo: await salvarModelo(c.modelo) });
  if (acao === "modelo-apagar") { await apagarModelo(String(c.id ?? "")); return res.status(200).json({ ok: true }); }
  if (acao === "visita") return res.status(200).json({ visita: await salvarVisita(c.visita, { nome: sessao.nome, email: sessao.email }) });
  if (acao === "visita-apagar") { await apagarVisita(String(c.id ?? ""), String(c.mes ?? "")); return res.status(200).json({ ok: true }); }
  if (acao === "envio-apagar") { await apagarEnvio(String(c.id ?? ""), String(c.mes ?? "")); return res.status(200).json({ ok: true }); }
  return res.status(400).json({ error: "ação inválida" });
}

export default async function handler(req, res) {
  cors(req, res);
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  const modulo = req.query?.modulo;
  if (modulo !== "qualidade" && req.method !== "GET") return res.status(405).json({ error: "método não permitido" });
  const sessao = await exigirLogin(req, res);
  if (!sessao) return;
  const permitido = modulo === "juridico" ? sessao.verJuridico : modulo === "qualidade" ? sessao.verQualidade || sessao.preencheChecklist : sessao.verRoyalties;
  if (!permitido) return res.status(403).json({ error: "sem permissão" });
  try {
    if (modulo === "qualidade") return await qualidade(req, res, sessao);
    const juridico = modulo === "juridico";
    const dados = await (juridico ? lerJuridico() : lerRoyalties());
    if (!dados) return res.status(200).json({ disponivel: false });
    return res.status(200).json({ disponivel: true, ...dados });
  } catch (e) {
    if (e instanceof ErroQualidade) return res.status(e.status).json({ error: e.message });
    return res.status(503).json({ error: `não consegui ler ${modulo === "juridico" ? "o jurídico" : modulo === "qualidade" ? "a qualidade" : "os royalties"} agora` });
  }
}
