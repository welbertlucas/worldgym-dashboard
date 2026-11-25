// Prazo da rede para confirmar a escala de cada mês: um dia do mês anterior (padrão: dia 20).
// Ex.: com dia 20, a escala de dezembro deve estar confirmada até 20/11.
import { isoDate } from './calendar';

export const PRAZO_PADRAO = 20;

/** Data limite (AAAA-MM-DD) para confirmar a escala do mês informado. */
export function prazoDaEscala(ano: number, mes: number, dia: number): string {
  const y = mes === 1 ? ano - 1 : ano;
  const m = mes === 1 ? 12 : mes - 1;
  return isoDate(y, m, Math.min(Math.max(1, dia), 28));
}

/** Dias até o prazo: positivo = faltam, 0 = é hoje, negativo = venceu há tantos dias. */
export function diasAtePrazo(prazo: string, hoje = new Date()): number {
  const [y, m, d] = prazo.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) / 86400000);
}

/** "faltam 8 dias" / "é hoje" / "venceu há 3 dias". */
export function textoDias(dias: number): string {
  if (dias > 1) return `faltam ${dias} dias`;
  if (dias === 1) return 'falta 1 dia';
  if (dias === 0) return 'é hoje';
  return dias === -1 ? 'venceu ontem' : `venceu há ${-dias} dias`;
}
