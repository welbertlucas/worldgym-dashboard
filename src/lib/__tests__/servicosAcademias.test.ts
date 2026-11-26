import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error módulo JS do servidor
import * as S from "../../../server/servicosAcademias.js";
// @ts-expect-error módulo JS do servidor
import { definirArmazem } from "../../../server/armazem.js";
import { linhaInfo, resumoServicos, type InfoAcademia } from "@/lib/servicosAcademias";
import { secoesDeMercado, TITULO_SERVICOS, type DadosMercado } from "@/components/estudos/pdfUnidade";

// Academias, sites e horários INVENTADOS.
const resp = (corpo: unknown, extra: { status?: number; headers?: Record<string, string> } = {}) =>
  ({ ok: (extra.status ?? 200) < 300, status: extra.status ?? 200, headers: { get: (k: string) => extra.headers?.[k.toLowerCase()] ?? null }, json: async () => corpo, text: async () => String(corpo) });
const ID = (n: string) => `places/Exemplo${n}Abcdefgh`;

describe("serviços pelo texto e horário", () => {
  it("reconhece serviços pelo nome, sem acento e sem diferenciar maiúsculas", () => {
    expect(S.servicosNoTexto("Crossfit Exemplo Sul")).toContain("cross");
    expect(S.servicosNoTexto("CT Jiu-Jitsu e Muay Thai")).toContain("lutas");
    expect(S.servicosNoTexto("Studio Dança Exemplo")).toEqual(expect.arrayContaining(["danca", "personal"]));
    expect(S.servicosNoTexto("Academia Exemplo")).toEqual([]);
  });
  it("horário: 24 horas, domingo, abertura mais cedo e fechamento mais tarde", () => {
    expect(S.resumoHorario({ periods: [{ open: { day: 0, hour: 0, minute: 0 } }] })).toEqual({ h24: true, domingo: true, abre: "00:00", fecha: "24:00" });
    const semana = [1, 2, 3, 4, 5].map((d) => ({ open: { day: d, hour: 6, minute: 0 }, close: { day: d, hour: 22, minute: 30 } }));
    expect(S.resumoHorario({ periods: [...semana, { open: { day: 6, hour: 8, minute: 0 }, close: { day: 6, hour: 14, minute: 0 } }] })).toEqual({ h24: false, domingo: false, abre: "06:00", fecha: "22:30" });
    expect(S.resumoHorario({ periods: [...semana, { open: { day: 0, hour: 9, minute: 0 }, close: { day: 0, hour: 13, minute: 0 } }] })?.domingo).toBe(true);
    expect(S.resumoHorario(undefined)).toBeNull();
  });
});

describe("leitura de site com segurança", () => {
  it("só http/https com nome de domínio público; sem IP, localhost, rede interna ou redes sociais", () => {
    expect(S.siteLegivel("https://academiaexemplo.com.br/")).toBeTruthy();
    for (const u of ["http://127.0.0.1/", "http://10.0.0.5/x", "http://localhost:3000", "http://servidor.internal/", "ftp://exemplo.com/", "https://www.instagram.com/exemplo", "https://linktr.ee/exemplo", "https://heylink.me/exemplo", "https://user:senha@exemplo.com/", "nada"])
      expect(S.siteLegivel(u)).toBeNull();
  });
  it("redirecionamento para endereço interno é recusado; página quase vazia não conta como lida", async () => {
    const f = async (url: string) => (url.includes("redireciona") ? resp("", { status: 302, headers: { location: "http://169.254.169.254/latest" } }) : resp("<html><body>oi</body></html>", { headers: { "content-type": "text/html" } }));
    expect(await S.textoDoSite("https://redireciona.exemplo.com/", f)).toBeNull();
    expect(await S.textoDoSite("https://vazio.exemplo.com/", f)).toBeNull();
    const longo = `<html><script>var x="piscina"</script><body>${"Nossa academia tem musculação, pilates e aulas coletivas. ".repeat(6)}</body></html>`;
    const t = await S.textoDoSite("https://cheio.exemplo.com/", async () => resp(longo, { headers: { "content-type": "text/html" } }));
    expect(S.servicosNoTexto(t)).toEqual(expect.arrayContaining(["musculacao", "pilates", "coletivas"]));
    expect(S.servicosNoTexto(t)).not.toContain("natacao"); // o que está dentro de <script> não conta
  });
});

describe("páginas de aulas do site", () => {
  it("acha links do mesmo site para aulas, modalidades, grade ou serviços (sem imagens nem outros sites)", () => {
    const html = `<a href="/aulas">Nossas aulas</a><a href="https://outro.com/aulas">Aulas</a><a href="/grade.png">Grade</a><a href="/contato">Contato</a><a href="modalidades/">Ver</a>`;
    expect(S.linksDeAulas(html, new URL("https://academia.exemplo.com.br/"))).toEqual(["https://academia.exemplo.com.br/aulas", "https://academia.exemplo.com.br/modalidades/"]);
  });
  it("lê também a página de aulas", async () => {
    const f = async (url: string) => resp(url.endsWith("/aulas") ? `<html><body>${"Grade com pilates, zumba e spinning. ".repeat(8)}</body></html>` : `<html><body>${"Bem-vindo à academia exemplo. ".repeat(10)}<a href="/aulas">Aulas</a></body></html>`, { headers: { "content-type": "text/html" } });
    expect(S.servicosNoTexto(await S.textoDoSite("https://academia.exemplo.com.br/", f))).toEqual(expect.arrayContaining(["pilates", "danca", "bike"]));
  });
});

describe("servidor: academias, redes e cache", () => {
  let mem: Map<string, unknown>;
  beforeEach(() => {
    mem = new Map();
    definirArmazem({ async ler(c: string) { return mem.has(c) ? JSON.parse(JSON.stringify(mem.get(c))) : null; }, async gravar(c: string, d: unknown) { mem.set(c, JSON.parse(JSON.stringify(d))); } });
  });
  afterEach(() => definirArmazem(null));
  const google: Record<string, unknown> = {
    [ID("A")]: { displayName: { text: "CT Exemplo Muay Thai" }, rating: 4.8, userRatingCount: 40, regularOpeningHours: { periods: [{ open: { day: 0, hour: 0, minute: 0 } }] }, websiteUri: "https://ctexemplo.com.br/" },
    [ID("B")]: { displayName: { text: "Academia Smart Fit - Exemplo" }, rating: 4.5, userRatingCount: 300, websiteUri: "https://www.smartfit.com.br/" },
    [ID("C")]: { displayName: { text: "Academia Sem Site" }, userRatingCount: 0 },
  };
  let chamadas: string[] = [];
  const fetcher = async (url: string) => {
    chamadas.push(url);
    if (url.startsWith("https://places.googleapis.com/v1/")) return resp(google[url.slice("https://places.googleapis.com/v1/".length)] ?? { error: { message: "não achei" } });
    if (url.includes("ctexemplo")) return resp(`<html><body>${"Aulas de pilates e natação na piscina aquecida, avaliação física. ".repeat(5)}</body></html>`, { headers: { "content-type": "text/html" } });
    throw new Error("site não deveria ser lido: " + url);
  };
  beforeEach(() => { chamadas = []; });

  it("junta as fontes: nome e site; na grande rede o site não é lido e não há lista manual", async () => {
    const { porId } = await S.servicosDasAcademias({ ids: [ID("A"), ID("B"), ID("C")] }, { chave: "k", fetcher });
    expect(porId[ID("A")]).toMatchObject({ nota: 4.8, avaliacoes: 40, horario: { h24: true }, site: "ctexemplo.com.br" });
    expect(porId[ID("A")].servicos).toEqual(expect.arrayContaining([{ id: "lutas", fonte: "nome" }, { id: "pilates", fonte: "site" }, { id: "natacao", fonte: "site" }, { id: "avaliacao", fonte: "site" }]));
    expect(porId[ID("B")].servicos).toEqual([]);
    expect(chamadas.some((u) => u.includes("smartfit"))).toBe(false);
    expect(porId[ID("C")]).toMatchObject({ nota: null, horario: null, servicos: [] });
  });
  it("guarda por 90 dias: a segunda consulta não chama o Google", async () => {
    await S.servicosDasAcademias({ ids: [ID("C")] }, { chave: "k", fetcher, agora: Date.parse("2026-11-26T10:00:00Z") });
    chamadas = [];
    await S.servicosDasAcademias({ ids: [ID("C")] }, { chave: "k", fetcher, agora: Date.parse("2027-01-10T10:00:00Z") });
    expect(chamadas).toEqual([]);
  });
  it("trava mensal: para em 900 consultas no mês (as guardadas não contam) e volta no mês seguinte", async () => {
    const nov = Date.parse("2026-11-20T15:00:00Z");
    mem.set("estudos/servicos-cota/2026-11.json", { usadas: S.LIMITE_MENSAL - 1 });
    const r = await S.servicosDasAcademias({ ids: [ID("A"), ID("C")] }, { chave: "k", fetcher, agora: nov });
    expect(r.semCota).toBe(1);
    expect(r.limiteAtingido).toBe(true);
    expect(Object.values(r.porId).filter(Boolean)).toHaveLength(1);
    expect(await S.consultasDoMes(nov)).toBe(S.LIMITE_MENSAL);
    // a que já foi buscada continua saindo do guardado, sem gastar cota
    const guardada = Object.keys(r.porId).find((k) => r.porId[k])!;
    chamadas = [];
    expect((await S.servicosDasAcademias({ ids: [guardada] }, { chave: "k", fetcher, agora: nov })).porId[guardada]).toBeTruthy();
    expect(chamadas).toEqual([]);
    // dezembro (horário de Brasília): cota nova
    const dez = Date.parse("2026-12-01T04:00:00Z");
    expect(S.mesDeBrasilia(Date.parse("2026-12-01T02:00:00Z"))).toBe("2026-11");
    const r2 = await S.servicosDasAcademias({ ids: [ID("A"), ID("C")] }, { chave: "k", fetcher, agora: dez });
    expect(r2.semCota).toBeUndefined();
    expect(await S.consultasDoMes(dez)).toBe(1);
  });
  it("site que falhou é lido de novo sem consultar o Google, no máximo uma vez por dia", async () => {
    const t0 = Date.parse("2026-11-20T10:00:00Z");
    mem.set("estudos/servicos/ExemploDAbcdefgh.json", { em: new Date(t0).toISOString(), id: ID("D"), nome: "Academia D", rede: null, nota: 4, avaliacoes: 9, horario: null, site: "ctexemplo.com.br", siteFalhou: true, doNome: [], doSite: [] });
    chamadas = [];
    const r = await S.servicosDasAcademias({ ids: [ID("D")] }, { chave: "k", fetcher, agora: t0 + 2 * 864e5 });
    expect(r.porId[ID("D")].servicos.map((x: { id: string }) => x.id)).toEqual(expect.arrayContaining(["pilates", "natacao"]));
    expect(chamadas.some((u) => u.includes("places.googleapis"))).toBe(false);
    expect(await S.consultasDoMes(t0 + 2 * 864e5)).toBe(0);
  });
  it("site lido na versão antiga é relido uma vez, sem o Google", async () => {
    const t0 = Date.parse("2026-11-26T10:00:00Z");
    mem.set("estudos/servicos/ExemploEAbcdefgh.json", { em: new Date(t0).toISOString(), id: ID("E"), nome: "Academia E", rede: null, nota: null, avaliacoes: 0, horario: null, site: "ctexemplo.com.br", siteFalhou: false, doNome: [], doSite: [] });
    chamadas = [];
    const r = await S.servicosDasAcademias({ ids: [ID("E")] }, { chave: "k", fetcher, agora: t0 + 3600e3 });
    expect(r.porId[ID("E")].servicos.length).toBeGreaterThan(0);
    expect(chamadas.some((u) => u.includes("places.googleapis"))).toBe(false);
    chamadas = [];
    await S.servicosDasAcademias({ ids: [ID("E")] }, { chave: "k", fetcher, agora: t0 + 7200e3 });
    expect(chamadas).toEqual([]); // já relido: não lê de novo
  });
  it("só aceita academias da busca da área", async () => {
    await expect(S.servicosDasAcademias({ ids: [ID("A")] }, { chave: "k", fetcher, permitidos: async () => new Set([ID("B")]) })).rejects.toMatchObject({ status: 400 });
    expect((await S.servicosDasAcademias({ ids: [ID("B")] }, { chave: "k", fetcher, permitidos: async () => new Set([ID("B")]) })).porId[ID("B")]).toBeTruthy();
  });
  it("o site é lido como um navegador comum, sem o nome do Atlas", async () => {
    let ua = "";
    await S.textoDoSite("https://cheio.exemplo.com/", async (_u: string, o: { headers: Record<string, string> }) => { ua = o.headers["User-Agent"]; return resp("x".repeat(300), { headers: { "content-type": "text/html" } }); });
    expect(ua).toMatch(/Mozilla/); expect(ua).not.toMatch(/atlas|world/i);
  });
  it("recusa id fora do formato, lote vazio ou grande demais", async () => {
    await expect(S.servicosDasAcademias({ ids: ["https://exemplo.com"] }, { chave: "k", fetcher })).rejects.toMatchObject({ status: 400 });
    await expect(S.servicosDasAcademias({ ids: [] }, { chave: "k", fetcher })).rejects.toMatchObject({ status: 400 });
    await expect(S.servicosDasAcademias({ ids: Array.from({ length: 16 }, (_, i) => ID(String(i))) }, { chave: "k", fetcher })).rejects.toMatchObject({ status: 400 });
  });
});

describe("tela e PDF", () => {
  const info = (extra: Partial<InfoAcademia>): InfoAcademia => ({ nota: 4.5, avaliacoes: 20, horario: { h24: false, domingo: false, abre: "06:00", fecha: "22:00" }, site: null, servicos: [], ...extra });
  it("resumo da área: 24h, domingo, horário, nota ponderada e serviços sem contar musculação", () => {
    const r = resumoServicos([
      info({ horario: { h24: true, domingo: true, abre: "00:00", fecha: "24:00" }, nota: 5, avaliacoes: 10, servicos: [{ id: "cross", fonte: "nome" }, { id: "musculacao", fonte: "site" }] }),
      info({ horario: { h24: false, domingo: true, abre: "05:00", fecha: "23:00" }, nota: 4, avaliacoes: 30 }),
      info({ nota: 3, avaliacoes: 2 }), null,
    ]);
    expect(r).toMatchObject({ consultadas: 3, semResposta: 1, h24: 1, domingo: 2, abreMaisCedo: "05:00", fechaMaisTarde: "23:00", comServico: 1, comNota: 2 });
    expect(r.notaMedia).toBeCloseTo(4.25);
    expect(r.porServico).toEqual([{ id: "cross", rotulo: "Cross", n: 1 }]);
    expect(linhaInfo(info({ servicos: [{ id: "musculacao", fonte: "site" }, { id: "lutas", fonte: "nome" }] }))).toBe("★ 4,5 (20 avaliações) · 06:00–22:00 · Lutas");
    expect(linhaInfo(info({ servicos: [{ id: "musculacao", fonte: "site" }] }))).toBe("★ 4,5 (20 avaliações) · 06:00–22:00 · não foi possível encontrar outras modalidades");
  });
  it("PDF: a página de serviços só entra quando os serviços foram buscados; o que não achou diz que não foi possível encontrar", () => {
    const l = (n: number, extra: object = {}) => ({ id: ID(String(n)), nome: `Academia Exemplo ${n}`, endereco: "", c: [-15.8, -47.9] as [number, number], km: n / 10, rede: null, ...extra });
    const pois = { categoria: "academias", rotulo: "Academias", c: [-15.8, -47.9] as [number, number], raioKm: 2, total: 2, lugares: [l(1, { info: info({ servicos: [{ id: "pilates", fonte: "site" }] }) }), l(2, { info: info({}) })] };
    const base = (p: typeof pois & { servicosCarregados?: boolean }): DadosMercado => ({ tipo: "ponto", nome: "Ponto Exemplo", area: "na área", vendas: null, alunosNaArea: null, perfil: { moradores: 50_000, domicilios: 18_000 } as never, renda: null, potencial: null, densidade: null, pois: p, fotos: { idade: null, domicilios: null, renda: null, consumo: null, pois: null } });
    expect(secoesDeMercado(base(pois)).map((s) => s.titulo)).not.toContain(TITULO_SERVICOS);
    const s = secoesDeMercado(base({ ...pois, servicosCarregados: true })).find((x) => x.titulo === TITULO_SERVICOS)!;
    expect(s.texto!.join(" ")).toContain("não foi possível encontrar outras modalidades");
    expect(s.tabela!.linhas[0]).toEqual(["1", "Academia Exemplo 1", "4,5 (20)", "06:00–22:00", "Pilates"]);
    expect(s.tabela!.linhas[1][4]).toBe("Não encontradas");
    // limite do mês: avisa quantas ficaram sem consulta; se nenhuma foi consultada, a página não entra
    const comLimite = secoesDeMercado(base({ ...pois, servicosCarregados: true, servicosSemCota: 3 } as never)).find((x) => x.titulo === TITULO_SERVICOS)!;
    expect(comLimite.texto!.join(" ")).toContain("limite gratuito mensal do Google");
    const nada = { ...pois, servicosCarregados: true, lugares: pois.lugares.map((x) => ({ ...x, info: undefined })) };
    expect(secoesDeMercado(base(nada as never)).map((x) => x.titulo)).not.toContain(TITULO_SERVICOS);
  });
});
