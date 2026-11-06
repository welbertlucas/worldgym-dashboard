// NPS direto do WeHelp (API v2, documentada no "Guia de Integração da API WeHelp").
// Autentica com client_id/client_secret (token vale 2h), lista as unidades e pede o relatório de NPS agrupado por unidade.
// Cada unidade do WeHelp tem duas pesquisas filhas ("- Qrcode" e "- Relacionamento"); as respostas ficam nelas,
// então somamos promotores, detratores e respostas das duas. NPS = %promotores − %detratores.
// Só leitura; guarda apenas totais.
import { diaDeCorte } from "./ativos.js";

const BASE = "https://app.wehelpsoftware.com/api/v2";

// Nome da unidade no WeHelp (sem " - Qrcode"/" - Relacionamento") -> nome no dashboard.
export const UNIDADES_WEHELP = {
  "World Gym Águas Claras PRO": "Águas Claras Pro",
  "World Gym Águas Lindas": "Águas Lindas-GO",
  "World Gym Arniqueira": "Arniqueira",
  "World Gym Asa Norte": "Asa Norte",
  "World Gym Ceilândia": "Ceilândia",
  "World Gym Gama": "Gama",
  "World Gym Goiânia": "Goiânia Pro-GO",
  "World Gym Itapoã": "Itapoã",
  "World Gym Metrópole": "Águas Claras Metrópole",
  "World Gym Novo Gama": "Novo Gama-GO",
  "World Gym Planaltina DF": "Planaltina-DF",
  "World Gym Planaltina GO": "Planaltina-GO",
  "World Gym Ponte Alta": "Ponte Alta",
  "World Gym Pro Salvador": "Salvador Pro-BA",
  "World Gym Riacho Fundo II": "Riacho Fundo II",
  "World Gym Samambaia Norte": "Samambaia Norte",
  "World Gym Samambaia Sul": "Samambaia Sul",
  "World Gym Santa Maria": "Santa Maria",
  "World Gym São Sebastião": "São Sebastião",
  "World Gym Sobradinho": "Sobradinho",
  "World Gym Taguatinga Norte": "Taguatinga",
  "World Gym Valparaiso": "Valparaíso-GO",
};

const semSufixo = (nome) => String(nome).replace(/\s*-\s*(Qrcode|Relacionamento)\s*$/i, "").trim();

/** Soma as pesquisas filhas por unidade do dashboard: { [unidade]: { promotores, detratores, respostas } }. */
export function agregarNps(report) {
  const por = {};
  for (const linha of report) {
    const nome = UNIDADES_WEHELP[semSufixo(linha.key?.[0])];
    if (!nome) continue; // pesquisa de uma unidade que não está no dashboard
    const n = linha.nps ?? {};
    const a = (por[nome] ??= { promotores: 0, detratores: 0, respostas: 0 });
    a.promotores += n.total_promoters ?? 0;
    a.detratores += n.total_detractors ?? 0;
    a.respostas += n.total_responses ?? 0;
  }
  return por;
}

async function pegar(url, headers, tries = 4) {
  let last = "";
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) return await res.json();
      last = `${res.status}`;
      if (res.status < 500 && res.status !== 429) break;
    } catch (e) {
      last = `rede ${e.cause?.code || e.message}`;
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
  }
  throw new Error(`WeHelp ${last} em ${url.split("?")[0].replace(BASE, "")}`);
}

/** Abre uma sessão (token + ids das pesquisas filhas das unidades). Credenciais em WEHELP_CLIENT_ID / WEHELP_CLIENT_SECRET. */
export async function abrirSessao() {
  const { WEHELP_CLIENT_ID: id, WEHELP_CLIENT_SECRET: secret } = process.env;
  if (!id || !secret) throw new Error("WEHELP_CLIENT_ID / WEHELP_CLIENT_SECRET não configurados");
  const t = await pegar(`${BASE}/auth/access_token?${new URLSearchParams({ client_id: id, client_secret: secret })}`, {});
  const headers = { Authorization: `Bearer ${t.result.access_token}` };
  const unidades = (await pegar(`${BASE}/company-units`, headers)).result.company_units;
  const raizes = new Set(unidades.filter((u) => !u.parent_id).map((u) => u.id)); // "World Gym" e "LEGADO"
  const filhas = unidades.filter((u) => u.parent_id && !raizes.has(u.parent_id)).map((u) => u.id);
  return { headers, filhas };
}

/** NPS do mês por unidade (até hoje, se o mês está em andamento). */
export async function npsDoMes(sessao, ym, hoje) {
  const fim = diaDeCorte(ym, hoje);
  const q = `company_unit_ids=${sessao.filhas.join(",")}&period[start]=${ym}-01&period[end]=${fim}&group_by=COMPANY_UNIT`;
  const j = await pegar(`${BASE}/reports/nps-data/CUSTOMER?${q}`, sessao.headers);
  return agregarNps(j.result.report);
}
