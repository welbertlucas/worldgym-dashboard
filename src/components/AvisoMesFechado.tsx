import { Notice } from "@/components/Notice";
import { formatMonthLong, monthKey } from "@/data/periods";

/**
 * Deixa claro que alertas e plano de ação olham o último mês FECHADO (o que aconteceu), não o mês em andamento
 * (que se acompanha pelas Metas e pelas projeções). `oQue` muda só a primeira frase.
 */
export function AvisoMesFechado({ evalMonth, oQue, agora = new Date() }: { evalMonth: string; oQue: "alertas" | "plano"; agora?: Date }) {
  const fechado = formatMonthLong(evalMonth);
  const atual = monthKey(agora);
  const emAndamento = atual > evalMonth ? formatMonthLong(atual) : null;
  return (
    <Notice>
      <b>{oQue === "plano" ? `Este plano sai do que aconteceu em ${fechado}` : `Estes alertas são de ${fechado}`}, o último mês fechado.</b>{" "}
      Servem para entender o que aconteceu e corrigir o que ficou para trás.
      {emAndamento && <> Para acompanhar <b>{emAndamento}</b>, que está em andamento, use as <b>Metas</b> e as projeções (Comercial → Vendas e Financeiro → Resumo).</>}
    </Notice>
  );
}
