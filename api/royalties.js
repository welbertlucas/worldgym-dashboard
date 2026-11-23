// Royalties, Jurídico, Qualidade e Estudos de ponto (passam por aqui para caber no limite de funções da Vercel; /api/juridico, /api/qualidade e
// /api/estudos são rewrites).
//   GET /api/royalties -> { disponivel: false } enquanto a rotina de royalties não enviar dados, ou { disponivel: true, ...modelo }. Só dono, Master e liberados.
//   GET /api/juridico  -> { disponivel: false } ou { disponivel: true, ...modelo }. Só o dono e quem ele liberou (modelo sem nome de parte contrária).
//   GET /api/qualidade -> { modo, unidades, modelos, visitas, envios }; GET ?foto=<id> -> a foto (JPEG).
//     modo "completo" (dono e liberados): tudo; modo "unidade" (quem foi liberado a preencher): só os checklists da unidade e os próprios envios.
//   POST /api/qualidade { acao: "modelo" | "modelo-apagar" | "foto" | "visita" | "visita-apagar" | "envio" | "envio-apagar" | "pedido" | "pedido-decidir" | "plano-feito" | "plano-validar", ... }.
//   GET /api/estudos -> { disponivel, modo, premissas, vendasPorM2, unidades, censo, pontos }, cortado pelo modo (server/estudos.js modoDe):
//     o dono e os liberados veem tudo e salvam (POST { acao: "pontos", pontos }); Master consulta tudo; unidades veem só a própria.
// Dado sensível: sem cache no navegador e permissão conferida a cada pedido.
import { lerRoyalties } from "../server/royalties.js";
import { lerJuridico } from "../server/juridico.js";
import { ErroQualidade, apagarAgenda, lerAgenda, salvarAgenda, comNotasPorGrupo, semPesosNaVisita, semPesosNoModelo, apagarLocal, criarCheckin, lerLocais, salvarLocal, apagarEnvio, apagarModelo, apagarVisita, criarPedido, decidirPedido, enviosRecentes, lerPedidos, lerPlanos, marcarPlanoFeito, validarPlano, lerSelfie, fotoDeEnvioDe, lerFoto, lerModelos, modelosDaUnidade, salvarEnvio, salvarFoto, salvarModelo, salvarVisita, visitasRecentes } from "../server/qualidade.js";
import { UNIDADES_DA_REDE } from "../server/acesso.js";
import { cors, exigirLogin } from "./_auth.js";
import { enderecoDe } from "../server/freio.js";
import { ErroEstudos, lerEstudos, podeEditar, salvarPontos } from "../server/estudos.js";
import { loadAll } from "../server/store.js";

/** "AAAA-MM" de hoje em Brasília. */
const mesDeHoje = () => new Date().toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);

async function estudos(req, res, sessao) {
  if (req.method === "GET") return res.status(200).json(await lerEstudos(loadAll, mesDeHoje(), sessao));
  if (!podeEditar(sessao)) return res.status(403).json({ error: "só quem faz estudos de ponto pode salvar" });
  const c = doCorpo(req);
  if (c.acao === "pontos") return res.status(200).json({ ok: true, pontos: await salvarPontos(c.pontos, sessao) });
  return res.status(400).json({ error: "ação inválida" });
}

const doCorpo = (req) => {
  if (typeof req.body !== "string") return req.body ?? {};
  try { return JSON.parse(req.body); } catch { return {}; }
};

async function qualidade(req, res, sessao) {
  // Dois acessos: o completo (dono, todo Master e liberados: checklists, visitas, notas e o que as unidades enviam) e o da unidade (só preencher o checklist da
  // própria unidade e ver os próprios envios). O dono tem os dois. Ver é diferente de editar: só o dono e quem ele liberou (editaQualidade) escrevem; o Master só consulta.
  const completo = sessao.verQualidade === true;
  const edita = sessao.editaQualidade === true;
  const ehDono = sessao.papel === "dono";
  const proprias = sessao.papel === "unidades" ? sessao.unidades.filter((u) => UNIDADES_DA_REDE.includes(u)) : UNIDADES_DA_REDE;
  // O peso de cada item é só do dono: para os outros níveis ele nem sai do servidor.
  const modelosPara = (ms) => (ehDono ? ms : ms.map(semPesosNoModelo));
  const registrosPara = (vs) => (ehDono ? vs.map(comNotasPorGrupo) : vs.map(semPesosNaVisita));
  if (req.method === "GET") {
    if (req.query?.selfie) {
      // A selfie é dado pessoal: só o dono e quem edita a qualidade a veem (Master que só consulta, não).
      if (!ehDono && !edita) return res.status(403).json({ error: "sem permissão" });
      const bytes = await lerSelfie(String(req.query.selfie));
      res.setHeader("Content-Type", "image/jpeg");
      return res.status(200).send(bytes);
    }
    if (req.query?.foto) {
      const id = String(req.query.foto);
      if (!completo && !(await fotoDeEnvioDe(id, proprias))) return res.status(404).json({ error: "Foto não encontrada." });
      const bytes = await lerFoto(id);
      res.setHeader("Content-Type", "image/jpeg");
      return res.status(200).send(bytes);
    }
    // Pedidos de item novo: o dono vê todos; a unidade, só os dela. O local das unidades é do dono.
    if (completo) return res.status(200).json({ modo: "completo", agenda: await lerAgenda(), unidades: UNIDADES_DA_REDE, modelos: modelosPara(await lerModelos()), visitas: registrosPara(await visitasRecentes()), envios: registrosPara(await enviosRecentes(45)), pedidos: ehDono ? await lerPedidos() : [], locais: ehDono ? await lerLocais() : {}, planos: await lerPlanos() });
    return res.status(200).json({ modo: "unidade", unidades: proprias, modelos: modelosPara(modelosDaUnidade(await lerModelos())), visitas: [], envios: registrosPara(await enviosRecentes(30, new Date(), proprias)), pedidos: (await lerPedidos()).filter((p) => proprias.includes(p.unidade)), planos: (await lerPlanos()).filter((p) => proprias.includes(p.unidade)) });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "método não permitido" });
  const { acao, ...c } = doCorpo(req);
  if (acao === "foto") {
    if (!completo && !sessao.preencheChecklist) return res.status(403).json({ error: "sem permissão" });
    return res.status(200).json({ id: await salvarFoto(c.dados) });
  }
  if (acao === "checkin") {
    // Franqueadora (quem usa o menu completo, inclusive o Master): check-in de visita. Quem só preenche pela unidade: check-in do checklist da própria unidade.
    const tipo = completo ? "visita" : sessao.preencheChecklist ? "unidade" : null;
    if (!tipo) return res.status(403).json({ error: "sem permissão" });
    return res.status(200).json({ checkin: await criarCheckin(c.checkin, { autor: { nome: sessao.nome, email: sessao.email }, tipo, ip: enderecoDe(req), unidadesPermitidas: proprias }) });
  }
  if (acao === "envio") {
    if (!sessao.preencheChecklist) return res.status(403).json({ error: "sem permissão" });
    return res.status(200).json({ envio: registrosPara([await salvarEnvio(c.envio, { nome: sessao.nome, email: sessao.email }, proprias, new Date(), { ip: enderecoDe(req) })])[0] });
  }
  if (acao === "plano-feito") {
    if (!sessao.preencheChecklist) return res.status(403).json({ error: "sem permissão" });
    return res.status(200).json({ plano: await marcarPlanoFeito(String(c.id ?? ""), c.plano, { nome: sessao.nome, email: sessao.email }, proprias) });
  }
  if (acao === "pedido") {
    if (!sessao.preencheChecklist) return res.status(403).json({ error: "sem permissão" });
    return res.status(200).json({ pedido: await criarPedido(c.pedido, { nome: sessao.nome, email: sessao.email }, proprias) });
  }
  // Aplicar o checklist da franqueadora (registrar a visita e confirmar os planos de quem visitou) é de todo o menu completo, Master inclusive.
  if (completo && acao === "visita") return res.status(200).json({ visita: registrosPara([await salvarVisita(c.visita, { nome: sessao.nome, email: sessao.email }, new Date(), { ip: enderecoDe(req) })])[0] });
  if (completo && acao === "plano-validar") {
    // Quem criou o plano confirma (ou devolve); o dono também pode. A regra fina está em validarPlano.
    return res.status(200).json({ plano: await validarPlano(String(c.id ?? ""), c.decisao, { nome: sessao.nome, email: sessao.email, ehDono }) });
  }
  // Daqui para a frente, só quem edita a qualidade (o dono e os liberados): checklists, local, apagar. Master sem liberação aplica, mas não edita.
  if (!edita) return res.status(403).json({ error: "sem permissão" });
  if (acao === "pedido-decidir") {
    if (!ehDono) return res.status(403).json({ error: "Só o dono responde os pedidos." });
    return res.status(200).json({ pedido: await decidirPedido(String(c.id ?? ""), c.decisao, { nome: sessao.nome }) });
  }
  if (acao === "modelo") {
    const modelo = await salvarModelo(c.modelo, { preservarPesos: !ehDono });
    return res.status(200).json({ modelo: ehDono ? modelo : semPesosNoModelo(modelo) });
  }
  if (acao === "local") {
    if (!ehDono) return res.status(403).json({ error: "Só o dono marca o local das unidades." });
    if (c.apagar) { await apagarLocal(String(c.unidade ?? "")); return res.status(200).json({ ok: true }); }
    return res.status(200).json({ local: await salvarLocal(String(c.unidade ?? ""), c.local) });
  }
  if (acao === "agenda") return res.status(200).json({ agenda: await salvarAgenda(c.agenda, { nome: sessao.nome, email: sessao.email }) });
  if (acao === "agenda-apagar") { await apagarAgenda(String(c.id ?? "")); return res.status(200).json({ ok: true }); }
  if (acao === "modelo-apagar") { await apagarModelo(String(c.id ?? "")); return res.status(200).json({ ok: true }); }
  if (acao === "visita-apagar") { await apagarVisita(String(c.id ?? ""), String(c.mes ?? "")); return res.status(200).json({ ok: true }); }
  if (acao === "envio-apagar") { await apagarEnvio(String(c.id ?? ""), String(c.mes ?? "")); return res.status(200).json({ ok: true }); }
  return res.status(400).json({ error: "ação inválida" });
}

export default async function handler(req, res) {
  cors(req, res);
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  const modulo = req.query?.modulo;
  if (modulo !== "qualidade" && modulo !== "estudos" && req.method !== "GET") return res.status(405).json({ error: "método não permitido" });
  const sessao = await exigirLogin(req, res);
  if (!sessao) return;
  const permitido = modulo === "estudos" ? true : modulo === "juridico" ? sessao.verJuridico : modulo === "qualidade" ? sessao.verQualidade || sessao.preencheChecklist : sessao.verRoyalties;
  if (!permitido) return res.status(403).json({ error: "sem permissão" });
  try {
    if (modulo === "qualidade") return await qualidade(req, res, sessao);
    if (modulo === "estudos") return await estudos(req, res, sessao);
    const juridico = modulo === "juridico";
    const dados = await (juridico ? lerJuridico() : lerRoyalties());
    if (!dados) return res.status(200).json({ disponivel: false });
    return res.status(200).json({ disponivel: true, ...dados });
  } catch (e) {
    if (e instanceof ErroQualidade || e instanceof ErroEstudos) return res.status(e.status).json({ error: e.message });
    return res.status(503).json({ error: `não consegui ler ${modulo === "juridico" ? "o jurídico" : modulo === "qualidade" ? "a qualidade" : modulo === "estudos" ? "os estudos de ponto" : "os royalties"} agora` });
  }
}
