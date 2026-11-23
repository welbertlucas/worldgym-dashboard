// Pontos de interesse em volta de um ponto (academias, escolas, supermercados...), como no Mapfry: busca no Google só a área e a
// categoria pedidas. Places Aggregate (lista dos lugares no círculo; divide a área quando passa de 100) + Place Details (nome,
// endereço e posição). O resultado fica guardado no Blob (estudos/pois/...) por 90 dias: a mesma busca não é cobrada de novo.
// A chave do servidor (GOOGLE_PLACES_KEY) nunca vai para o navegador.
import { lerJson, gravarJson } from "./armazem.js";

export class ErroPois extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }

export const CATEGORIAS = {
  academias: { rotulo: "Academias", tipos: ["gym", "fitness_center"] },
  escolas: { rotulo: "Escolas e faculdades", tipos: ["school", "university", "secondary_school", "primary_school"] },
  supermercados: { rotulo: "Supermercados", tipos: ["supermarket", "grocery_store"] },
  shoppings: { rotulo: "Shoppings", tipos: ["shopping_mall"] },
  transporte: { rotulo: "Ônibus, metrô e estações", tipos: ["bus_station", "transit_station", "subway_station", "train_station", "light_rail_station"] },
  hospitais: { rotulo: "Hospitais", tipos: ["hospital"] },
};
export const RAIO_MIN_KM = 0.3, RAIO_MAX_KM = 5, MAX_LUGARES = 220, VALIDADE_DIAS = 90;

/** Grandes redes de academia (para destacar); a World Gym aparece como "World Gym". */
const REDES = [
  [/smart\s*fit/i, "Smart Fit"], [/blue\s*fit/i, "Bluefit"], [/selfit/i, "Selfit"], [/panobianco/i, "Panobianco"], [/bodytech/i, "Bodytech"],
  [/bio\s*ritmo/i, "Bio Ritmo"], [/sky\s*fit/i, "Skyfit"], [/pratique/i, "Pratique"], [/contorno do corpo/i, "Contorno do Corpo"],
  [/just\s*fit/i, "Justfit"], [/i9\s*fit/i, "i9 Fit"], [/world\s*gym/i, "World Gym"],
];
export const redeDe = (nome) => REDES.find(([r]) => r.test(String(nome ?? "")))?.[1] ?? null;

const km = (a, b) => Math.hypot((a[0] - b[0]) * 110.6, (a[1] - b[1]) * 111.32 * Math.cos(((a[0] + b[0]) / 2) * Math.PI / 180));
export const chaveDaBusca = (c, raioKm, categoria) => `estudos/pois/${categoria}-${c[0].toFixed(4)}_${c[1].toFixed(4)}-${Math.round(raioKm * 10)}.json`;

/** Confere o pedido: posição no Brasil, raio entre 0,3 e 5 km, categoria conhecida. */
export function pedidoValido(p) {
  const c = Array.isArray(p?.c) ? p.c.map(Number) : [];
  if (c.length !== 2 || !c.every(Number.isFinite) || c[0] < -34 || c[0] > 6 || c[1] < -75 || c[1] > -32) throw new ErroPois("Posição inválida.");
  const raioKm = Math.round(Number(p?.raioKm) * 10) / 10;
  if (!Number.isFinite(raioKm) || raioKm < RAIO_MIN_KM || raioKm > RAIO_MAX_KM) throw new ErroPois(`Raio entre ${RAIO_MIN_KM} e ${RAIO_MAX_KM} km.`);
  const categoria = String(p?.categoria ?? "academias");
  if (!CATEGORIAS[categoria]) throw new ErroPois("Categoria desconhecida.");
  return { c, raioKm, categoria };
}

async function lugaresNoCirculo(chave, c, raioM, tipos, fetcher, nivel = 0) {
  const r = await fetcher("https://areainsights.googleapis.com/v1:computeInsights", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": chave },
    body: JSON.stringify({ insights: ["INSIGHT_PLACES"], filter: { locationFilter: { circle: { latLng: { latitude: c[0], longitude: c[1] }, radius: Math.round(raioM) } }, typeFilter: { includedTypes: tipos }, operatingStatus: ["OPERATING_STATUS_OPERATIONAL"] } }),
  });
  const j = await r.json();
  if (j.error && /maximum number of allowed places/i.test(j.error.message ?? "") && nivel < 2) {
    // mais de 100 lugares: divide em 7 círculos menores que cobrem o original
    const d = raioM * 0.55, out = [];
    for (const [dx, dy] of [[0, 0], ...Array.from({ length: 6 }, (_, k) => [Math.cos(k * Math.PI / 3), Math.sin(k * Math.PI / 3)])])
      out.push(...await lugaresNoCirculo(chave, [c[0] + dy * d / 110600, c[1] + dx * d / (111320 * Math.cos(c[0] * Math.PI / 180))], raioM * 0.55, tipos, fetcher, nivel + 1));
    return out;
  }
  if (j.error) throw new ErroPois("O Google não respondeu à busca agora.", 502);
  return (j.placeInsights ?? []).map((p) => p.place);
}

/** Busca (ou lê do Blob) os pontos de interesse. `fetcher` e `agora` são injetáveis para os testes. */
export async function buscarPois(pedido, { chave = process.env.GOOGLE_PLACES_KEY, fetcher = fetch, agora = Date.now() } = {}) {
  const { c, raioKm, categoria } = pedidoValido(pedido);
  const arquivo = chaveDaBusca(c, raioKm, categoria);
  const guardado = await lerJson(arquivo);
  if (guardado && agora - Date.parse(guardado.em) < VALIDADE_DIAS * 864e5) return { ...guardado, doCache: true };
  if (!chave) throw new ErroPois("A busca de pontos de interesse ainda não foi configurada no servidor.", 503);
  const ids = [...new Set(await lugaresNoCirculo(chave, c, raioKm * 1000, CATEGORIAS[categoria].tipos, fetcher))];
  const lugares = [];
  for (let i = 0; i < Math.min(ids.length, MAX_LUGARES); i += 10) {
    const lote = await Promise.all(ids.slice(i, i + 10).map(async (id) => {
      try {
        const r = await fetcher(`https://places.googleapis.com/v1/${id}`, { headers: { "X-Goog-Api-Key": chave, "X-Goog-FieldMask": "displayName,location,formattedAddress", "Accept-Language": "pt-BR" } });
        const j = await r.json();
        if (!j.location) return null;
        const pc = [j.location.latitude, j.location.longitude];
        return { nome: j.displayName?.text ?? "Sem nome", endereco: j.formattedAddress ?? "", c: pc, km: Math.round(km(c, pc) * 100) / 100, rede: categoria === "academias" ? redeDe(j.displayName?.text) : null };
      } catch { return null; }
    }));
    lugares.push(...lote.filter((x) => x && x.km <= raioKm + 0.05));
  }
  lugares.sort((a, b) => a.km - b.km);
  const resultado = { em: new Date(agora).toISOString(), categoria, rotulo: CATEGORIAS[categoria].rotulo, c, raioKm, total: lugares.length, cortado: ids.length > MAX_LUGARES, lugares };
  await gravarJson(arquivo, resultado);
  return { ...resultado, doCache: false };
}
