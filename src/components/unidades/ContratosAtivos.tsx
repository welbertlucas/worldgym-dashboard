import { type UnitData } from "@/data/dashboardData";
import { cn } from "@/lib/utils";

const n = (v: number) => v.toLocaleString("pt-BR");
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1).replace(".", ",")}%` : "—");

/** Contratos ativos por unidade, com os especiais/VIP e os de personal. Só aparece quando o EVO trouxe a foto do dia. */
export function ContratosAtivos({ units }: { units: UnitData[] }) {
  const rows = units
    .filter((u) => u.alunosAtivos !== undefined)
    .sort((a, b) => (b.contratosEspeciais ?? 0) - (a.contratosEspeciais ?? 0));
  if (rows.length === 0) return null;

  const sum = (k: "alunosAtivos" | "contratosAtivos" | "contratosEspeciais" | "contratosPersonal" | "contratosLocal" | "contratosParcial" | "contratosRede") => rows.reduce((s, u) => s + (u[k] ?? 0), 0);
  const total = { alunos: sum("alunosAtivos"), contratos: sum("contratosAtivos"), especiais: sum("contratosEspeciais"), personal: sum("contratosPersonal"), local: sum("contratosLocal"), parcial: sum("contratosParcial"), rede: sum("contratosRede") };

  return (
    <section aria-labelledby="contratos-titulo">
      <h3 id="contratos-titulo" className="text-base font-semibold text-foreground">Contratos ativos: especiais/VIP e personal</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Foto de hoje, direto do EVO. Especial/VIP = categoria VIP ou plano com “VIP” no nome e valor zero; personal = categoria ou nome “Personal”. Alcance do plano, conforme o EVO: local = 1 unidade; 2 a 9 = a própria e algumas vizinhas; rede = 10 ou mais.
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">Unidade</th>
              <th className="text-right font-medium px-3 py-2">Alunos ativos</th>
              <th className="text-right font-medium px-3 py-2">Especiais/VIP</th>
              <th className="text-right font-medium px-3 py-2">% do total</th>
              <th className="text-right font-medium px-3 py-2">Personal</th>
              <th className="text-right font-medium px-3 py-2">Plano local</th>
              <th className="text-right font-medium px-3 py-2">2 a 9 unidades</th>
              <th className="text-right font-medium px-3 py-2">Plano rede (10+)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.name} className="border-t border-border">
                <td className="px-3 py-2">{u.name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{n(u.alunosAtivos ?? 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{n(u.contratosEspeciais ?? 0)}</td>
                <td className={cn("px-3 py-2 text-right tabular-nums text-muted-foreground")}>{pct(u.contratosEspeciais ?? 0, u.contratosAtivos ?? 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{n(u.contratosPersonal ?? 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{n(u.contratosLocal ?? 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{n(u.contratosParcial ?? 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{n(u.contratosRede ?? 0)} <span className="text-muted-foreground">({pct(u.contratosRede ?? 0, u.contratosAtivos ?? 0)})</span></td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-border bg-muted/30 font-medium">
            <tr>
              <td className="px-3 py-2">Rede</td>
              <td className="px-3 py-2 text-right tabular-nums">{n(total.alunos)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{n(total.especiais)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{pct(total.especiais, total.contratos)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{n(total.personal)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{n(total.local)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{n(total.parcial)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{n(total.rede)} <span className="text-muted-foreground font-normal">({pct(total.rede, total.contratos)})</span></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
