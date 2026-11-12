import { SectionTitle } from "@/components/SectionTitle";
import type { KpiContext } from "@/components/kpi/KpiGrid";
import { AcessosCard } from "@/components/clientes/AcessosCard";
import { MapaCalorEntradas } from "@/components/clientes/MapaCalorEntradas";
import { LiberacoesCard } from "@/components/clientes/LiberacoesCard";
import { OutrasUnidadesCard } from "@/components/clientes/OutrasUnidadesCard";
import { Secao } from "@/components/unidades/Secao";
import { Abas, abaAtiva } from "@/components/Abas";
import { SUBMENUS } from "@/components/nav";
import { formatMonthLong, isPartialMonth } from "@/data/periods";

interface Props { ctx: KpiContext; month: string; unit: string | null; aba?: string | null; onAba?: (id: string) => void }

const ABAS_CATRACA = SUBMENUS.catraca;

/** Acessos na catraca: quando os alunos treinam, quem sumiu, as liberações feitas na mão pela recepção e quem treina em outra unidade. */
export function CatracaTab({ ctx, month, unit, aba: pedida = null, onAba = () => {} }: Props) {
  const aba = abaAtiva(ABAS_CATRACA, pedida);
  const total = ctx.cur.total;
  const monthLabel = formatMonthLong(month);
  const partial = isPartialMonth(month);
  const unitLabel = unit ?? "Rede";
  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <SectionTitle hint={`${unitLabel} • ${monthLabel}${partial ? " (mês em andamento: valores parciais)" : ""}`}>Acessos na catraca</SectionTitle>
        <Abas tela="catraca" titulo="Acessos na catraca" abas={ABAS_CATRACA} ativa={aba} onChange={onAba} />
      </div>

      {aba === "frequencia" && <Secao id="ca-frequencia" titulo="Frequência" descricao="Em que dias e horários os alunos treinam e quando vieram pela última vez. Quem some costuma cancelar depois.">
        <MapaCalorEntradas total={total} month={month} monthLabel={monthLabel} partial={partial} unitLabel={unitLabel} />
        <AcessosCard total={total} month={month} monthLabel={monthLabel} unit={unit} />
      </Secao>}

      {aba === "liberacoes" && <Secao id="ca-liberacoes" titulo="Liberações" descricao="Quantas vezes a recepção liberou a catraca na mão, para quem e por quê, e quantas dessas entradas não têm pagamento registrado.">
        <LiberacoesCard total={total} month={month} monthLabel={monthLabel} partial={partial} unit={unit} />
      </Secao>}

      {aba === "outras-unidades" && <Secao id="ca-outras" titulo="Outras unidades" descricao="Alunos que treinam numa unidade diferente da do cadastro: de onde vêm e para onde vão.">
        <OutrasUnidadesCard total={total} month={month} monthLabel={monthLabel} partial={partial} unit={unit} />
      </Secao>}
    </div>
  );
}
