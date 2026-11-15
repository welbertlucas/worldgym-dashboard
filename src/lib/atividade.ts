import { API_BASE, authFetch, getUsuario } from "@/lib/auth";

// Registro de atividade: o painel anota qual tela a pessoa abriu (com a unidade e o mês que ela via) e quando ela exporta/imprime.
// Para gravar pouco no servidor, os avisos são juntados e enviados de uma vez a cada 5 minutos, ou quando a aba é fechada ou escondida.
// Nunca atrapalha o uso: falha de rede é ignorada. A mesma tela, unidade e mês não são anotados de novo em menos de 5 minutos.
const REPETIR_APOS_MS = 5 * 60 * 1000;
export const ENVIAR_A_CADA_MS = 5 * 60 * 1000;
const MAX_POR_LOTE = 50;

const vistas = new Map<string, number>();
interface Evento { tela: string; evento: "tela" | "exportar"; unidade: string | null; mes: string | null; em: number }
let fila: Evento[] = [];
let relogio: ReturnType<typeof setTimeout> | null = null;
let ouvindo = false;

/** O que a pessoa estava vendo: a unidade do filtro (null = a rede toda) e o mês (AAAA-MM). */
export interface Vista { unidade?: string | null; mes?: string | null }

/** Manda o que está na fila (até 50 por vez). `keepalive` deixa o pedido terminar mesmo se a aba estiver fechando. */
export function enviarAgora() {
  if (relogio) { clearTimeout(relogio); relogio = null; }
  if (!fila.length) return;
  const lote = fila.slice(0, MAX_POR_LOTE);
  fila = fila.slice(MAX_POR_LOTE);
  if (!getUsuario() || getUsuario()?.legado) { fila = []; return; }
  authFetch(`${API_BASE}/atividade`, { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventos: lote }) }).catch(() => { /* sem rede: segue sem registrar */ });
  if (fila.length) enviarAgora();
}

function ouvirSaida() {
  if (ouvindo || typeof window === "undefined") return;
  ouvindo = true;
  window.addEventListener("pagehide", enviarAgora);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") enviarAgora(); });
}

function enfileirar(e: Evento) {
  fila.push(e);
  ouvirSaida();
  if (fila.length >= MAX_POR_LOTE) return enviarAgora();
  if (!relogio) relogio = setTimeout(enviarAgora, ENVIAR_A_CADA_MS);
}

/** Anota que a pessoa abriu a tela (ex.: "comercial/vendas"), com a unidade e o mês que ela via. Trocar a unidade ou o mês na mesma tela conta como outra vista. */
export function registrarTela(tela: string, vista: Vista = {}, agora: number = Date.now()) {
  const chave = `${tela}|${vista.unidade ?? ""}|${vista.mes ?? ""}`;
  if (!tela || !getUsuario() || agora - (vistas.get(chave) ?? -Infinity) < REPETIR_APOS_MS) return;
  vistas.set(chave, agora);
  enfileirar({ tela, evento: "tela", unidade: vista.unidade ?? null, mes: vista.mes ?? null, em: agora });
}

/** Anota que a pessoa exportou ou imprimiu (ex.: "benchmark/posicao"). Sempre registra, e envia na hora com o que já estava na fila. */
export function registrarExportacao(tela: string, vista: Vista = {}) {
  if (!getUsuario()) return;
  enfileirar({ tela, evento: "exportar", unidade: vista.unidade ?? null, mes: vista.mes ?? null, em: Date.now() });
  enviarAgora();
}

/** Só para os testes. */
export const _limpar = () => { vistas.clear(); fila = []; if (relogio) { clearTimeout(relogio); relogio = null; } };
