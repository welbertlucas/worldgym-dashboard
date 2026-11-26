// Royalties, Jurídico, Qualidade, Estudos de ponto, Escalas e Obras (passam por aqui para caber no limite de funções da Vercel; /api/juridico, /api/qualidade,
// /api/estudos, /api/escalas e /api/obras e /api/fichas são rewrites).
//   GET /api/documentos -> { unidades: [{ nome, pastas, arquivos, usado }], limites, podeApagar }; GET ?unidade=&arquivo=<id> -> o arquivo.
//     POST (application/octet-stream, cabeçalho X-Atlas-Documento com { unidade, nome, pastaId }) -> envia; POST { acao: "pasta" | "apagar", ... }.
//     Dono e Master, todas as unidades; unidades só com a permissão "acessar documentos" e só as suas (server/documentos.js).
//   GET /api/fichas -> { unidades: [{ nome, modelo, m2, abertura, vendas, alunos, ficha }] }; POST { acao: "salvar", unidade, ficha } (só o dono: aluguel é dado comercial).
//   GET /api/obras -> { obras, podeEditar, podeApagar, modelos? }; POST { acao: "salvar", obra } | { acao: "apagar", id } | fases e tarefas: "tarefas", "aplicar-modelo", "tarefa-salvar", "tarefa-apagar", "fase-salvar", "fase-apagar" (dono e Master cadastram e mudam, só o dono apaga; quem tem acesso a unidades e foi liberado em verObras consulta).
//   GET /api/escalas -> { unidades, prazo, mudaRegras, papel }: as unidades que a pessoa enxerga (dono e Master, todas; unidades, só as suas, e só com a marca verEscalas).
//   POST /api/escalas { acao: "listar" | "ler" | "achar" | "ultima" | "mes" | "salvar" | "apagar" | "versoes" | "restaurar" | "equipe-ler" | "equipe-salvar" |
//     "config-ler" | "config-salvar" | "prazo-ler" | "prazo-salvar" | "importar", ... } -> escalas da equipe (nomes de colaboradores: Blob privado, permissão por unidade a cada pedido).
//   GET /api/royalties -> { disponivel: false } enquanto a rotina de royalties não enviar dados, ou { disponivel: true, ...modelo }. Só dono, Master e liberados.
//   GET /api/juridico  -> { disponivel: false } ou { disponivel: true, ...modelo }. Só o dono e quem ele liberou (modelo sem nome de parte contrária).
//   GET /api/qualidade -> { modo, unidades, modelos, visitas, envios }; GET ?foto=<id> -> a foto (JPEG).
//     modo "completo" (dono e liberados): tudo; modo "unidade" (quem foi liberado a preencher): só os checklists da unidade e os próprios envios.
//   POST /api/qualidade { acao: "modelo" | "modelo-apagar" | "foto" | "visita" | "visita-apagar" | "envio" | "envio-apagar" | "pedido" | "pedido-decidir" | "plano-feito" | "plano-validar", ... }.
//   GET /api/estudos -> { disponivel, modo, premissas, vendasPorM2, unidades, censo, pontos }, cortado pelo modo (server/estudos.js modoDe):
//     o dono e os liberados veem tudo e salvam (POST { acao: "pontos", pontos }); Master consulta tudo; unidades veem só a própria.
//     POST { acao: "pois", c, raioKm, categoria } -> pontos de interesse do Google (todos; unidade só em volta da própria).
//     POST { acao: "deslocamento", c, modo: "carro" | "pe" } -> áreas de deslocamento do Mapbox (mesma regra de acesso dos pois).
//     POST { acao: "contar-academias", c, raioKm } -> quantas academias (categoria principal) no raio; fora do modo unidade.
//     POST { acao: "fotos-rua", c } -> fotos do Street View em volta da posição, para o último slide do PDF (mesma regra de acesso dos pois).
//     POST { acao: "alunos-hex", unidade } -> alunos ativos da unidade por hexágono do Censo, só contagens (do CEP); unidade só a própria.
//     POST { acao: "censo-municipio", c } -> hexágonos do Censo dos municípios gerados que cobrem a posição (pontos fora da malha principal); fora do modo unidade.
//     POST { acao: "pedir-censo", c } -> pede a geração do Censo do município do ponto (rotina do GitHub; só quem edita estudos); { estado: "pronto" | "em-andamento" | "pedido" }.
//     POST { acao: "endereco", q, perto } -> busca de endereço (Mapbox), para quem vê estudos de pontos novos (não para unidades).
// Dado sensível: sem cache no navegador e permissão conferida a cada pedido.
import { lerRoyalties } from "../server/royalties.js";
import { lerJuridico } from "../server/juridico.js";
import { ErroQualidade, apagarAgenda, lerAgenda, salvarAgenda, comNotasPorGrupo, semPesosNaVisita, semPesosNoModelo, apagarLocal, criarCheckin, lerLocais, salvarLocal, apagarEnvio, apagarModelo, apagarVisita, criarPedido, decidirPedido, enviosRecentes, lerPedidos, lerPlanos, marcarPlanoFeito, validarPlano, lerSelfie, fotoDeEnvioDe, lerFoto, lerModelos, modelosDaUnidade, salvarEnvio, salvarFoto, salvarModelo, salvarVisita, visitasRecentes } from "../server/qualidade.js";
import { UNIDADES_DA_REDE } from "../server/acesso.js";
import { cors, exigirLogin } from "./_auth.js";
import { enderecoDe } from "../server/freio.js";
import { ErroEstudos, lerEstudos, modoDe, podeEditar, salvarPontos } from "../server/estudos.js";
import { ErroPois, buscarPois, contarAcademias } from "../server/pois.js";
import { lerAlunosHex } from "../server/alunosHex.js";
import { ErroFichas, lerFichas, salvarFicha } from "../server/fichas.js";
import { ErroDocumentos, apagarDocumento, baixarArquivo, criarPasta, enviarArquivo, lerDocumentos } from "../server/documentos.js";
import { ErroObras, apagarFase, apagarObra, apagarTarefa, aplicarModelo, lerModelos as lerModelosDeObra, lerObras, lerTarefas, resumoDosModelos, salvarFase, salvarObra, salvarTarefa } from "../server/obras.js";
import { ErroEscalas, UNIDADES_ESCALA, acharEscala, apagarEscala, escalasDoMes, importarDoSistemaAntigo, lerConfigUnidade, lerEquipe, lerEscala, lerPrazo, listarEscalas, restaurarVersao, salvarConfigUnidade, salvarEquipe, salvarEscala, salvarPrazo, ultimaEscala, unidadesDaSessao, versoesDaEscala } from "../server/escalas.js";
import { ErroFotosRua, fotosDaRua } from "../server/fotosRua.js";
import { ErroCensoMun, censoDoPonto } from "../server/censoMunicipio.js";
import { ErroCensoPedido, pedirCenso } from "../server/censoPedido.js";
import { ErroDeslocamento, buscarDeslocamento, buscarEndereco, enderecoDaPosicao, geocodificarLote } from "../server/deslocamento.js";
import { COORDENADAS_UNIDADES, UNIT_NAMES } from "../server/units.js";
const COORDENADAS_POR_NOME = Object.fromEntries(Object.entries(UNIT_NAMES).map(([id, n]) => [n, COORDENADAS_UNIDADES[id]]));
import { loadAll } from "../server/store.js";

/** "AAAA-MM" de hoje em Brasília. */
const mesDeHoje = () => new Date().toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);

async function estudos(req, res, sessao) {
  if (req.method === "GET") return res.status(200).json(await lerEstudos(loadAll, mesDeHoje(), sessao));
  const c = doCorpo(req);
  // Pontos de interesse e áreas de deslocamento: todos os perfis buscam; quem tem acesso a unidades, só em volta das próprias unidades.
  if (c.acao === "endereco") {
    if (modoDe(sessao) === "unidade") return res.status(403).json({ error: "busca de endereço só nos estudos de pontos novos" });
    return res.status(200).json(await buscarEndereco(c));
  }
  // Posição de vários endereços de uma planilha de imóveis (importação em lote): só estudos de pontos novos
  if (c.acao === "geocodificar-lote") {
    if (modoDe(sessao) !== "completo") return res.status(403).json({ error: "importar imóveis é só para quem faz estudos" });
    return res.status(200).json(await geocodificarLote(c));
  }
  // Endereço aproximado de uma posição sugerida (nova unidade, posição melhor): estratégia de expansão, fora do modo unidade
  if (c.acao === "endereco-posicao") {
    if (modoDe(sessao) === "unidade") return res.status(403).json({ error: "sem permissão" });
    return res.status(200).json(await enderecoDaPosicao(c));
  }
  // Contagem de academias em volta de uma posição sugerida para nova unidade: estratégia de expansão, fora do modo unidade
  if (c.acao === "contar-academias") {
    if (modoDe(sessao) === "unidade") return res.status(403).json({ error: "sem permissão" });
    return res.status(200).json(await contarAcademias(c));
  }
  // Alunos por hexágono de uma unidade (só contagens, do CEP): dono e Master veem qualquer unidade; quem tem acesso a unidades, só as próprias
  if (c.acao === "alunos-hex") {
    const minhas = new Set(sessao?.unidades ?? []);
    const d = await lerAlunosHex(String(c.unidade ?? ""), (nome) => modoDe(sessao) !== "unidade" || minhas.has(nome));
    return res.status(200).json(d ?? { celulas: [], ausente: true });
  }
  // Censo de um município de fora da malha principal: estudos de pontos novos, fora do modo unidade
  if (c.acao === "censo-municipio") {
    if (modoDe(sessao) === "unidade") return res.status(403).json({ error: "sem permissão" });
    return res.status(200).json(await censoDoPonto(c));
  }
  if (c.acao === "pois" || c.acao === "deslocamento" || c.acao === "fotos-rua") {
    if (modoDe(sessao) === "unidade") {
      const p = Array.isArray(c.c) ? c.c.map(Number) : [];
      const perto = (sessao.unidades ?? []).some((n) => { const u = COORDENADAS_POR_NOME[n]; return u && Math.hypot((u[0] - p[0]) * 110.6, (u[1] - p[1]) * 107) <= 1; });
      if (!perto) return res.status(403).json({ error: "busca só em volta da sua unidade" });
    }
    return res.status(200).json(c.acao === "pois" ? await buscarPois(c) : c.acao === "fotos-rua" ? await fotosDaRua(c) : await buscarDeslocamento(c));
  }
  if (!podeEditar(sessao)) return res.status(403).json({ error: "só quem faz estudos de ponto pode salvar" });
  if (c.acao === "pontos") return res.status(200).json({ ok: true, pontos: await salvarPontos(c.pontos, sessao) });
  // Pede o Censo do município do ponto (aciona a rotina censo-municipio.yml no GitHub): só quem faz estudos de ponto
  if (c.acao === "pedir-censo") return res.status(200).json(await pedirCenso(c));
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

async function fichas(req, res, sessao) {
  if (req.method === "GET") return res.status(200).json(await lerFichas(sessao, loadAll, mesDeHoje()));
  if (req.method !== "POST") return res.status(405).json({ error: "método não permitido" });
  const { acao, ...c } = doCorpo(req);
  if (acao === "salvar") return res.status(200).json({ ficha: await salvarFicha(sessao, String(c.unidade ?? ""), c.ficha) });
  return res.status(400).json({ error: "ação inválida" });
}

async function obras(req, res, sessao) {
  const edita = sessao.papel === "dono" || sessao.papel === "master";
  if (req.method === "GET") return res.status(200).json({ obras: await lerObras(), podeEditar: edita, podeApagar: sessao.papel === "dono", ...(edita ? { modelos: resumoDosModelos(await lerModelosDeObra()) } : {}) });
  if (req.method !== "POST") return res.status(405).json({ error: "método não permitido" });
  const { acao, ...c } = doCorpo(req);
  if (acao === "salvar") return res.status(200).json({ obra: await salvarObra(sessao, c.obra) });
  if (acao === "apagar") { await apagarObra(sessao, String(c.id ?? "")); return res.status(200).json({ ok: true }); }
  // fases e tarefas (só dono e Master; conferido em server/obras.js)
  if (acao === "tarefas") return res.status(200).json(await lerTarefas(sessao, c.obraId));
  if (acao === "aplicar-modelo") return res.status(200).json(await aplicarModelo(sessao, c.obraId, String(c.modelo ?? "")));
  if (acao === "tarefa-salvar") return res.status(200).json(await salvarTarefa(sessao, { obraId: c.obraId, faseId: c.faseId, tarefa: c.tarefa }));
  if (acao === "tarefa-apagar") return res.status(200).json(await apagarTarefa(sessao, { obraId: c.obraId, faseId: c.faseId, tarefaId: c.tarefaId }));
  if (acao === "fase-salvar") return res.status(200).json(await salvarFase(sessao, { obraId: c.obraId, fase: c.fase }));
  if (acao === "fase-apagar") return res.status(200).json(await apagarFase(sessao, { obraId: c.obraId, faseId: c.faseId }));
  return res.status(400).json({ error: "ação inválida" });
}

async function escalas(req, res, sessao) {
  if (req.method === "GET") {
    const ids = unidadesDaSessao(sessao);
    return res.status(200).json({ unidades: UNIDADES_ESCALA.filter((u) => ids.includes(u.id)), prazo: await lerPrazo(), mudaRegras: sessao.papel === "dono" || sessao.papel === "master", papel: sessao.papel, nome: sessao.nome });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "método não permitido" });
  const { acao, ...c } = doCorpo(req);
  const ok = (o = {}) => res.status(200).json(o);
  switch (acao) {
    case "listar": return ok({ escalas: await listarEscalas(sessao, c.unidade) });
    case "ler": return ok({ escala: await lerEscala(sessao, c.id) });
    case "achar": return ok({ escala: await acharEscala(sessao, c) });
    case "ultima": return ok({ escala: await ultimaEscala(sessao, c) });
    case "mes": return ok({ escalas: await escalasDoMes(sessao, c.ano, c.mes) });
    case "salvar": await salvarEscala(sessao, c.escala, { marco: ["criada", "gerada", "confirmada", "restaurada"].includes(c.marco) ? c.marco : null }); return ok();
    case "apagar": await apagarEscala(sessao, c.id); return ok();
    case "versoes": return ok({ versoes: await versoesDaEscala(sessao, c.id) });
    case "restaurar": return ok({ escala: await restaurarVersao(sessao, c.id, c.versao) });
    case "equipe-ler": return ok({ equipe: await lerEquipe(sessao, c.unidade, c.equipe) });
    case "equipe-salvar": await salvarEquipe(sessao, c.unidade, c.equipe, c.roster); return ok();
    case "config-ler": return ok({ config: await lerConfigUnidade(sessao, c.unidade) });
    case "config-salvar": await salvarConfigUnidade(sessao, c.unidade, c.settings, { incluirJornada: c.incluirJornada === true }); return ok();
    case "prazo-ler": return ok({ prazo: await lerPrazo() });
    case "prazo-salvar": await salvarPrazo(sessao, c.dia); return ok({ prazo: await lerPrazo() });
    case "importar": return ok({ importado: await importarDoSistemaAntigo(sessao, c.backup) });
    default: return res.status(400).json({ error: "ação inválida" });
  }
}

/** O que vem no cabeçalho do envio de arquivo (o nome não vai no endereço, para não ficar em registro de acesso). */
const dadosDoEnvio = (req) => {
  try { return JSON.parse(decodeURIComponent(String(req.headers["x-atlas-documento"] ?? ""))) ?? {}; } catch { return {}; }
};

async function documentos(req, res, sessao) {
  if (req.method === "GET") {
    if (!req.query?.arquivo) return res.status(200).json(await lerDocumentos(sessao));
    const a = await baixarArquivo(sessao, { unidade: String(req.query.unidade ?? ""), id: String(req.query.arquivo) });
    res.setHeader("Content-Type", a.tipo);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(a.nome)}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(a.bytes);
  }
  if (req.method !== "POST") return res.status(405).json({ error: "método não permitido" });
  if (String(req.headers["content-type"] ?? "").startsWith("application/octet-stream")) {
    return res.status(200).json({ arquivo: await enviarArquivo(sessao, dadosDoEnvio(req), req.body) });
  }
  const c = doCorpo(req);
  if (c.acao === "pasta") return res.status(200).json({ pasta: await criarPasta(sessao, c) });
  if (c.acao === "apagar") { await apagarDocumento(sessao, c); return res.status(200).json({ ok: true }); }
  return res.status(400).json({ error: "ação inválida" });
}

export default async function handler(req, res) {
  cors(req, res);
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  const modulo = req.query?.modulo;
  if (modulo !== "qualidade" && modulo !== "estudos" && modulo !== "escalas" && modulo !== "obras" && modulo !== "fichas" && modulo !== "documentos" && req.method !== "GET") return res.status(405).json({ error: "método não permitido" });
  const sessao = await exigirLogin(req, res);
  if (!sessao) return;
  const permitido = modulo === "documentos" ? sessao.verDocumentos : modulo === "estudos" ? true : modulo === "escalas" ? sessao.verEscalas : modulo === "obras" ? sessao.verObras : modulo === "fichas" ? sessao.papel === "dono" : modulo === "juridico" ? sessao.verJuridico : modulo === "qualidade" ? sessao.verQualidade || sessao.preencheChecklist : sessao.verRoyalties;
  if (!permitido) return res.status(403).json({ error: "sem permissão" });
  try {
    if (modulo === "qualidade") return await qualidade(req, res, sessao);
    if (modulo === "estudos") return await estudos(req, res, sessao);
    if (modulo === "escalas") return await escalas(req, res, sessao);
    if (modulo === "obras") return await obras(req, res, sessao);
    if (modulo === "fichas") return await fichas(req, res, sessao);
    if (modulo === "documentos") return await documentos(req, res, sessao);
    const juridico = modulo === "juridico";
    const dados = await (juridico ? lerJuridico() : lerRoyalties());
    if (!dados) return res.status(200).json({ disponivel: false });
    return res.status(200).json({ disponivel: true, ...dados });
  } catch (e) {
    if (e instanceof ErroQualidade || e instanceof ErroEscalas || e instanceof ErroObras || e instanceof ErroFichas || e instanceof ErroDocumentos || e instanceof ErroEstudos || e instanceof ErroPois || e instanceof ErroDeslocamento || e instanceof ErroFotosRua || e instanceof ErroCensoMun || e instanceof ErroCensoPedido) return res.status(e.status).json({ error: e.message });
    return res.status(503).json({ error: `não consegui ler ${modulo === "juridico" ? "o jurídico" : modulo === "qualidade" ? "a qualidade" : modulo === "estudos" ? "os estudos de ponto" : modulo === "escalas" ? "as escalas" : modulo === "obras" ? "as obras" : modulo === "fichas" ? "as fichas das unidades" : modulo === "documentos" ? "os documentos" : "os royalties"} agora` });
  }
}
