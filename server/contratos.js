// Contagem de contratos ATIVOS por unidade, com destaque para os especiais/VIP e os de personal.
// É uma foto do dia (o EVO não guarda histórico de "ativos em tal data"), por isso entra só no mês corrente.
//
// Regras (validadas com a contagem manual de Pro Águas Claras = 128 e Asa Norte = 28):
//  - especial/VIP: categoria VIP (idCategoryMembership = 1) OU plano com "VIP" no nome e valor zero.
//    (o checkbox "contrato especial" do plano não aparece na API; "INFLUENCER" e "PARCEIROS" não contam)
//  - personal: categoria Personal (3) OU "PERSONAL" no nome do plano.
import { fetchAll } from "./evo.js";
import { UNIT_NAMES } from "./units.js";

const isVip = (n) => /v\.?\s?i\.?\s?p/i.test(n);

// Alcance do plano pelo que o EVO libera de fato (campo accessBranches do plano), não pelo nome
// (o nome erra nos dois sentidos: há plano "REDE" liberado só numa unidade e plano de 10+ unidades sem "REDE" no nome):
//   local = 1 unidade (sem nenhuma unidade listada, como free pass, também conta como local)
//   parcial = de 2 a 9 unidades (a própria e algumas vizinhas)
//   rede = 10 ou mais unidades
export const REDE_MIN = 10;
export const alcance = (plano, unidadePro = false) => {
  if (unidadePro) return "rede"; // nas unidades Pro todos os planos são de rede, qualquer que seja a lista de unidades do cadastro
  const n = (plano?.accessBranches ?? []).length;
  return n >= REDE_MIN ? "rede" : n >= 2 ? "parcial" : "local";
};

/** Unidade Pro: o nome da unidade no dashboard tem "Pro" (Águas Claras Pro, Goiânia Pro-GO, Salvador Pro-BA). */
export const ehUnidadePro = (nomeDaUnidade) => /\bPro\b/.test(nomeDaUnidade ?? "");

export async function contratosUnidade(idBranch) {
  const plans = Object.fromEntries((await fetchAll(`/membership?idBranch=${idBranch}`)).map((p) => [p.idMembership, p]));
  const members = await fetchAll(`/members?idBranch=${idBranch}&status=1`);
  const pro = ehUnidadePro(UNIT_NAMES[idBranch]);
  const r = { alunosAtivos: members.length, contratosAtivos: 0, contratosEspeciais: 0, contratosPersonal: 0, contratosLocal: 0, contratosParcial: 0, contratosRede: 0 };
  for (const m of members) {
    for (const c of m.memberships || []) {
      if (c.membershipStatus !== "active") continue;
      r.contratosAtivos++;
      const nome = String(c.name || "").trim();
      const plano = plans[c.idMembership];
      const especial = c.idCategoryMembership === 1 || (isVip(nome) && plano && plano.value === 0);
      const a = alcance(plano, pro);
      if (a === "rede") r.contratosRede++;
      else if (a === "parcial") r.contratosParcial++;
      else r.contratosLocal++;
      const personal = c.idCategoryMembership === 3 || /personal/i.test(nome);
      if (especial) r.contratosEspeciais++;
      else if (personal) r.contratosPersonal++;
    }
  }
  return r;
}

// Devolve { "Nome da unidade": {...contagens} } para todas as unidades do dashboard.
export async function contratosTodas(log = () => {}) {
  const out = {};
  for (const [id, name] of Object.entries(UNIT_NAMES)) {
    out[name] = await contratosUnidade(id);
    log(name, out[name]);
  }
  return out;
}
