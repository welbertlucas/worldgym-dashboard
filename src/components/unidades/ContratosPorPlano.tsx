import { useMemo, useState } from "react";
import { type UnitData } from "@/data/dashboardData";
import { pctTexto, planosDeContratos } from "@/data/contratosAtivos";

const n = (v: number) => v.toLocaleString("pt-BR");
const PRIMEIROS = 10;

/**
 * Contratos ativos hoje por plano, do maior para o menor, como o relatório "Clientes por contratos" do EVO.
 * Com uma unidade em `foco`, só os planos dela; sem, a rede (planos de mesmo nome somam). Só totais: nenhum dado de aluno.
 */
export function ContratosPorPlano({ units, foco = null }: { units: UnitData[]; foco?: string | null }) {
  const [todos, setTodos] = useState(false);
  const [busca, setBusca] = useState("");
  const dados = useMemo(() => planosDeContratos(units, foco), [units, foco]);
  if (!dados || dados.planos.length === 0) return null;

  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const filtrados = termo ? dados.planos.filter(([nome]) => nome.toLocaleLowerCase("pt-BR").includes(termo)) : dados.planos;
  const visiveis = todos || termo ? filtrados : filtrados.slice(0, PRIMEIROS);
  const max = dados.planos[0][1];

  return (
    <section id="contratos-por-plano" aria-labelledby="contratos-plano-titulo" className="space-y-3">
      <div>
        <h3 id="contratos-plano-titulo" className="text-base font-semibold text-foreground">Contratos ativos por plano</h3>
        <p className="text-sm text-muted-foreground">
          Foto de hoje, direto do EVO{foco ? <> · <b className="font-semibold text-foreground">{foco}</b></> : " · rede"}. {n(dados.total)} contratos em {n(dados.planos.length)} planos; o percentual é sobre o total de contratos ativos. Uma pessoa com mais de um contrato ativo aparece em cada um deles.
        </p>
      </div>
      <div className="card-surface p-4">
        {dados.planos.length > PRIMEIROS && (
          <label className="mb-3 block">
            <span className="sr-only">Buscar plano</span>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar plano"
              className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-72"
            />
          </label>
        )}
        <ol className="space-y-3" aria-label="Planos com mais contratos ativos">
          {visiveis.map(([nome, q]) => (
            <li key={nome} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-medium text-foreground" title={nome}>{nome}</span>
                <span className="shrink-0 tabular-nums text-foreground">{n(q)} <span className="text-xs text-muted-foreground">({pctTexto((q / dados.total) * 100)})</span></span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden><div className="h-full rounded-full bg-[#3b82f6]/70" style={{ width: `${(q / max) * 100}%` }} /></div>
            </li>
          ))}
          {visiveis.length === 0 && <li className="text-sm text-muted-foreground">Nenhum plano com “{busca}”.</li>}
        </ol>
        {!termo && filtrados.length > PRIMEIROS && (
          <button type="button" onClick={() => setTodos((v) => !v)} aria-expanded={todos} className="mt-3 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            {todos ? `Mostrar só os ${PRIMEIROS} maiores` : `Ver os ${n(filtrados.length)} planos`}
          </button>
        )}
      </div>
    </section>
  );
}
