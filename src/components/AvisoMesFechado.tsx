import { Notice } from "@/components/Notice";
import { formatMonthLong, monthKey } from "@/data/periods";

/**
 * Deixa claro que o Fechamento olha o último mês FECHADO (o que aconteceu), não o mês em andamento (o que fazer agora,
 * na aba Mês em andamento e no Plano de ação).
 */
export function AvisoMesFechado({ evalMonth, agora = new Date() }: { evalMonth: string; agora?: Date }) {
  const atual = monthKey(agora);
  const emAndamento = atual > evalMonth ? formatMonthLong(atual) : null;
  return (
    <Notice>
      <b>Estes alertas são de {formatMonthLong(evalMonth)}, o último mês fechado.</b> Servem para entender o que aconteceu: comparação com o mês anterior e com o mesmo mês do ano passado, e as hipóteses.
      {emAndamento && <> O que fazer em <b>{emAndamento}</b> está na aba Mês em andamento e no Plano de ação.</>}
    </Notice>
  );
}
