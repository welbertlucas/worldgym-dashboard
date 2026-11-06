import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList } from "recharts";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { AXIS_TICK, GRID, TOOLTIP_STYLE } from "@/components/chartTheme";
import { type UnitData } from "@/data/dashboardData";

const TOTAL = "hsl(222 25% 22%)";
const GOOD = "hsl(142 71% 45%)";
const BAD = "hsl(0 72% 51%)";
const int = (n: number) => Math.round(n).toLocaleString("pt-BR");

interface Passo { nome: string; base: number; valor: number; cor: string; texto: string; detalhe: string }

/** Cascata do mês: alunos no início, + novos e retornos, − cancelados e vencidos, = alunos no fim. */
export function passosDoFluxo(t: UnitData): Passo[] | null {
  if (t.fluxoNovos === undefined || t.ativosIni === undefined) return null;
  const novos = t.fluxoNovos, ret = t.fluxoRetornos ?? 0, canc = t.fluxoCancelados ?? 0, venc = t.fluxoVencidos ?? 0;
  const ini = t.ativosIni;
  const aposNovos = ini + novos, aposRet = aposNovos + ret, aposCanc = aposRet - canc, fim = aposCanc - venc;
  return [
    { nome: "Início do mês", base: 0, valor: ini, cor: TOTAL, texto: int(ini), detalhe: "Alunos ativos no último dia do mês anterior" },
    { nome: "Novos", base: ini, valor: novos, cor: GOOD, texto: `+${int(novos)}`, detalhe: "Primeiro contrato do aluno começou no mês" },
    { nome: "Retornos", base: aposNovos, valor: ret, cor: GOOD, texto: `+${int(ret)}`, detalhe: "Alunos que já tiveram contrato e voltaram" },
    { nome: "Cancelados", base: aposCanc, valor: canc, cor: BAD, texto: `−${int(canc)}`, detalhe: "Estavam ativos no início e cancelaram no mês" },
    { nome: "Vencidos", base: fim, valor: venc, cor: BAD, texto: `−${int(venc)}`, detalhe: "Estavam ativos no início e o contrato acabou sem renovar" },
    { nome: "Fim do mês", base: 0, valor: fim, cor: TOTAL, texto: int(fim), detalhe: "Alunos ativos no último dia do mês" },
  ];
}

export function FluxoClientesChart({ total, monthLabel, partial, unitLabel }: { total: UnitData; monthLabel: string; partial: boolean; unitLabel: string }) {
  const passos = passosDoFluxo(total);
  const subtitle = <>{unitLabel} • {monthLabel}{partial && " (mês em andamento: valores parciais)"}</>;
  if (!passos) return <ChartCard title="Fluxo de clientes" subtitle={subtitle}><ChartEmpty>Sem o fluxo de alunos do EVO para este mês.</ChartEmpty></ChartCard>;

  // A escala começa perto do menor nível para as variações (centenas) aparecerem sobre milhares de alunos.
  const niveis = passos.flatMap((p) => [p.base, p.base + p.valor]).filter((n) => n > 0);
  const minimo = Math.min(...niveis);
  const maxVar = Math.max(...passos.filter((p) => p.cor !== TOTAL).map((p) => p.valor), 1);
  const piso = Math.max(0, Math.floor((minimo - maxVar * 1.5) / 100) * 100);
  const dados = passos.map((p) => ({ ...p, base: p.cor === TOTAL ? 0 : p.base, visivel: p.valor }));

  return (
    <ChartCard title="Fluxo de clientes" subtitle={subtitle}>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={dados} margin={{ top: 22, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="nome" tick={AXIS_TICK} interval={0} />
          <YAxis tick={AXIS_TICK} width={48} domain={[piso, "dataMax"]} tickFormatter={(v) => int(v)} allowDataOverflow />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(222 16% 96%)" }} formatter={(_v: number, _n: string, ctx) => [ctx.payload.texto, ctx.payload.nome]} labelFormatter={() => ""} />
          <Bar dataKey="base" stackId="f" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="visivel" stackId="f" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {dados.map((d) => <Cell key={d.nome} fill={d.cor} />)}
            <LabelList dataKey="texto" position="top" style={{ fontSize: 11, fontWeight: 600, fill: "hsl(222 25% 14%)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-muted-foreground">Escala a partir de {int(piso)} alunos, para destacar as variações. Início + novos + retornos − cancelados − vencidos = fim do mês.</p>
    </ChartCard>
  );
}
