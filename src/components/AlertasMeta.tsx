import { useEffect, useMemo, useState } from "react";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { carregarCampanhas, INSTITUCIONAL, type FotoCampanhas } from "@/data/campanhas";
import { getDataByMonth } from "@/data/dashboardData";
import { alertasMeta, LIMITES_META, type AlertaMeta } from "../../server/alertasMeta.js";

const hojeBrasilia = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const mesAnterior = (ym: string) => { const [a, m] = ym.split("-").map(Number); return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`; };

/** Só os alertas da escolha: a unidade, a conta Institucional ou, na rede, todas as unidades (sem a Institucional). */
export const alertasDaEscolha = (lista: AlertaMeta[], unit: string | null) =>
  lista.filter((a) => (unit === INSTITUCIONAL ? a.quem === INSTITUCIONAL : unit ? a.quem === unit : a.quem !== INSTITUCIONAL));

const L = LIMITES_META;
/** As regras que disparam os alertas (iguais para todas as unidades). Ficam recolhidas no fim do cartão. */
const REGRAS = [
  `Campanha que gastou R$ ${L.gastoSemContato} em 7 dias sem trazer nenhum contato.`,
  `Custo por contato ${Math.round((L.custoAltoFator - 1) * 100)}% acima da mediana das campanhas da rede.`,
  `A mesma pessoa vendo o anúncio ${L.frequenciaAlta} vezes ou mais na semana.`,
  `Campanha terminando em até ${L.terminaEmDias} dias.`,
  `Menos de ${Math.round(L.conversaoBaixa * 100)}% dos contatos do mês virando aluno (a partir de ${L.conversaoMinContatos} contatos).`,
  `Origem não marcada no EVO: ${Math.round(L.semOrigemAlta * 100)}% ou mais dos cadastros do mês sem origem.`,
  "Unidade que anunciou no mês passado e está sem campanha no ar.",
];

/** Alertas de melhoria do tráfego pago: campanhas (foto de hoje) e unidades (mês corrente contra o anterior, com os alunos do EVO). */
export function AlertasMeta({ unit }: { unit: string | null }) {
  const [foto, setFoto] = useState<FotoCampanhas | null | undefined>(undefined);
  useEffect(() => { let vivo = true; carregarCampanhas().then((f) => vivo && setFoto(f)); return () => { vivo = false; }; }, []);
  const lista = useMemo(() => {
    if (!foto?.geradoEm) return [];
    const hoje = hojeBrasilia();
    const ym = hoje.slice(0, 7), ant = mesAnterior(ym);
    const todos = alertasMeta({ campanhas: foto.campanhas, metaMes: foto.meses?.[ym], metaAnterior: foto.meses?.[ant], evoMes: getDataByMonth(ym), evoAnterior: getDataByMonth(ant), hoje });
    return alertasDaEscolha(todos, unit).sort((a, b) => (a.gravidade === b.gravidade ? a.quem.localeCompare(b.quem, "pt-BR") : a.gravidade === "critico" ? -1 : 1));
  }, [foto, unit]);
  const titulo = "Alertas do tráfego pago";
  const subtitle = <>{unit ?? "Rede"} • hoje</>;
  if (foto === undefined) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>Carregando…</ChartEmpty></ChartCard>;
  if (!foto?.geradoEm) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>Os alertas aparecem depois da primeira leitura diária do Meta.</ChartEmpty></ChartCard>;
  return (
    <ChartCard title={titulo} subtitle={subtitle}>
      {lista.length === 0 ? (
        <p className="rounded-lg bg-success/10 px-3 py-2.5 text-sm text-foreground">Nenhum alerta no tráfego pago {unit ? (unit === INSTITUCIONAL ? "da conta Institucional" : `de ${unit}`) : "da rede"} hoje.</p>
      ) : (
        <ul className="space-y-2" aria-label="Alertas do tráfego pago, os críticos primeiro">
          {lista.map((a, i) => (
            <li key={`${a.quem}-${a.titulo}-${a.campanha ?? ""}-${i}`} className="rounded-lg border border-border bg-card px-3 py-2.5">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${a.gravidade === "critico" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>{a.gravidade === "critico" ? "Crítico" : "Atenção"}</span>
                <span className="font-medium text-foreground">{a.titulo}</span>
                {!unit && <span className="text-xs text-muted-foreground">· {a.quem}</span>}
              </p>
              <p className="mt-1 text-sm text-foreground">{a.fato}</p>
              <p className="mt-0.5 text-xs text-muted-foreground"><span className="font-medium">O que fazer:</span> {a.acao}</p>
            </li>
          ))}
        </ul>
      )}
      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none hover:text-foreground">Como os alertas são calculados</summary>
        <ul className="mt-2 list-disc space-y-0.5 pl-4">
          {REGRAS.map((r) => <li key={r}>{r}</li>)}
        </ul>
        <p className="mt-2">As regras são as mesmas para todas as unidades. Os alertas só leem o Meta; nada é alterado nas campanhas.</p>
      </details>
    </ChartCard>
  );
}
