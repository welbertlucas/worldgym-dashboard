import { UnitLink } from "@/components/UnitLink";
import { formatMonthLong } from "@/data/periods";
import { type AlertaVigente, type ResultadoVigente, type SeveridadeVigente } from "@/data/alertasVigentes";
import { DIAS_MINIMOS } from "@/data/vendasDia";
import { cn } from "@/lib/utils";

export const SEV_VIGENTE: Record<SeveridadeVigente, [string, string]> = {
  critical: ["Crítico", "bg-destructive/10 text-destructive"],
  attention: ["Atenção", "bg-warning/10 text-warning"],
  info: ["Para fazer", "bg-secondary text-muted-foreground"],
};

/** "novembro de 2026, até 14/11" (dias fechados na leitura do EVO). */
export const periodoVigente = (res: ResultadoVigente) =>
  res.month ? `${formatMonthLong(res.month)}${res.dias ? `, até ${res.dias}/${res.month.slice(5)}` : ""}` : "";

/** Nota que explica como inadimplência e cartões ganham nível. */
export const NOTA_SEM_NIVEL =
  "Inadimplência e cartões recusados são comparados com o mesmo dia dos 3 meses anteriores: no meio do mês o que está em aberto ainda inclui quem paga com alguns dias de atraso. Dentro do normal da unidade eles aparecem como “para fazer”, sem nível.";

/** Um alerta do mês vigente: unidade, nível, o fato, o que fazer e o atalho para a tela com o detalhe. */
export function ItemVigente({ a, comUnidade = true, onAbrirTela }: { a: AlertaVigente; comUnidade?: boolean; onAbrirTela?: (tela: string) => void }) {
  const [rot, cor] = SEV_VIGENTE[a.severity];
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", cor)}>{rot}</span>
        {comUnidade && <span className="text-sm font-semibold text-foreground">{a.unit === "Rede" ? "Rede" : <UnitLink name={a.unit} />}</span>}
        <span className="text-sm font-semibold text-foreground">{comUnidade ? `· ${a.title}` : a.title}</span>
      </div>
      <p className="text-sm text-foreground">{a.fact}</p>
      <p className="text-sm text-muted-foreground"><b className="font-medium text-foreground">O que fazer:</b> {a.action}</p>
      {onAbrirTela && (
        <button type="button" onClick={() => onAbrirTela(a.tela)} className="inline-flex items-center gap-1 text-xs font-medium text-primary-ink underline-offset-4 hover:underline">
          Ver o detalhe
        </button>
      )}
    </div>
  );
}

function Bloco({ titulo, descricao, itens, onAbrirTela, vazio }: { titulo: string; descricao: string; itens: AlertaVigente[]; onAbrirTela?: (t: string) => void; vazio: string }) {
  const comNivel = itens.filter((a) => a.severity !== "info");
  const info = itens.filter((a) => a.severity === "info");
  return (
    <section className="card-surface overflow-hidden">
      <div className="p-5">
        <h3 className="text-base font-semibold text-foreground">{titulo}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{descricao}</p>
      </div>
      {comNivel.length === 0 && info.length === 0 && <p className="border-t border-border p-5 text-sm text-muted-foreground">{vazio}</p>}
      {comNivel.length > 0 && (
        <ul className="divide-y divide-border border-t border-border">
          {comNivel.map((a) => <li key={a.id} className="p-5"><ItemVigente a={a} onAbrirTela={onAbrirTela} /></li>)}
        </ul>
      )}
      {info.length > 0 && (
        <details className="group border-t border-border" open={comNivel.length === 0 && info.length <= 6}>
          <summary className="cursor-pointer list-none px-5 py-3 text-sm font-medium text-foreground hover:bg-secondary/50 [&::-webkit-details-marker]:hidden">
            {info.length} {info.length === 1 ? "item para fazer" : "itens para fazer"} sem nível de alerta <span className="text-muted-foreground group-open:hidden">(mostrar)</span>
          </summary>
          <ul className="divide-y divide-border border-t border-border">
            {info.map((a) => <li key={a.id} className="p-5"><ItemVigente a={a} onAbrirTela={onAbrirTela} /></li>)}
          </ul>
        </details>
      )}
    </section>
  );
}

/** Tela Alertas → Mês em andamento: pendências (desde o dia 1) e ritmo (a partir do dia 10). */
export function AlertasVigentesLista({ res, unit = null, onAbrirTela }: { res: ResultadoVigente; unit?: string | null; onAbrirTela?: (tela: string) => void }) {
  if (!res.month) return <p className="card-surface p-6 text-sm text-muted-foreground">O mês atual ainda não foi lido do EVO. Os alertas aparecem depois da primeira leitura (de madrugada).</p>;
  const todos = unit ? res.alertas.filter((a) => a.unit === unit) : res.alertas;
  const pend = todos.filter((a) => a.tipo === "pendencia"), ritmo = todos.filter((a) => a.tipo === "ritmo");
  const n = (s: SeveridadeVigente) => todos.filter((a) => a.severity === s).length;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Dados do EVO de {periodoVigente(res)} (o EVO é lido de madrugada; o dia de hoje entra amanhã).{" "}
        <b className="text-foreground">{n("critical")} {n("critical") === 1 ? "crítico" : "críticos"}</b>, <b className="text-foreground">{n("attention")} em atenção</b> e {n("info")} para fazer.
      </p>
      <Bloco
        titulo="Resolver agora"
        descricao="O que está em aberto e dá para resolver já: cobrança, cartões, retorno aos detratores, renovações (as que venceram e as que vencem em 7 dias), alunos que pararam de vir e liberações na catraca."
        itens={pend}
        onAbrirTela={onAbrirTela}
        vazio="Nada em aberto que peça ação agora."
      />
      <Bloco
        titulo="Acelerar o mês"
        descricao={res.comRitmo ? "Se o mês vai fechar bem: a projeção de faturamento e de novos contratos contra a meta (ou contra a média dos 3 meses anteriores, sem meta) e os cancelamentos e a conversão das oportunidades até agora contra o mesmo dia dos meses anteriores." : `As regras de ritmo começam no dia ${DIAS_MINIMOS}: antes disso a projeção do mês erra demais.`}
        itens={ritmo}
        onAbrirTela={onAbrirTela}
        vazio={res.comRitmo ? "Nenhuma unidade fora do ritmo." : `Aparecem a partir do dia ${DIAS_MINIMOS}.`}
      />
      <p className="text-xs text-muted-foreground">{NOTA_SEM_NIVEL}</p>
    </div>
  );
}
