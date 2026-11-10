import { useEffect, useMemo, useState } from "react";
import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import { campanhasDaUnidade, carregarCampanhas, custoPorContato, nomeDoObjetivo, type Campanha, type FotoCampanhas } from "@/data/campanhas";

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const reais2 = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dia = (iso: string | null) => (iso ? iso.split("-").reverse().slice(0, 2).join("/") : null);

function Linha({ c, mostrarUnidade }: { c: Campanha; mostrarUnidade: boolean }) {
  const contatos = c.leads7d + c.conversas7d;
  const custo = custoPorContato(c);
  const periodo = c.fim ? `${dia(c.inicio) ?? "?"} a ${dia(c.fim)}` : c.inicio ? `desde ${dia(c.inicio)}` : "sem data";
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-0.5 rounded-lg border border-border bg-card px-3 py-2.5">
      <span className="truncate text-sm font-medium text-foreground" title={c.nome}>{c.nome}</span>
      <span className="text-sm font-semibold tabular-nums text-foreground">{reais(c.gasto7d)} <span className="font-normal text-muted-foreground">em 7 dias</span></span>
      <span className="truncate text-xs text-muted-foreground">{mostrarUnidade && <>{c.unidade ?? "Institucional"} · </>}{nomeDoObjetivo(c.objetivo)} · {periodo}{c.orcamentoDiario ? ` · ${reais(c.orcamentoDiario)}/dia` : ""}</span>
      <span className="text-xs tabular-nums text-muted-foreground">{contatos > 0 ? <>{contatos.toLocaleString("pt-BR")} contatos{custo !== null && <> · {reais2(custo)} cada</>}</> : "sem contatos ainda"}</span>
    </li>
  );
}

/** Campanhas de anúncio ativas hoje no Meta (Facebook e Instagram): da unidade escolhida e da rede. Foto diária, só leitura. */
export function CampanhasNoAr({ unit }: { unit: string | null }) {
  const [foto, setFoto] = useState<FotoCampanhas | null | undefined>(undefined);
  useEffect(() => { let vivo = true; carregarCampanhas().then((f) => vivo && setFoto(f)); return () => { vivo = false; }; }, []);
  const lista = useMemo(() => (foto ? campanhasDaUnidade(foto.campanhas, unit) : []), [foto, unit]);
  const subtitle = <>{unit ?? "Rede"} • foto de hoje{foto?.geradoEm ? ` (${new Date(foto.geradoEm).toLocaleDateString("pt-BR")})` : ""}</>;
  if (foto === undefined) return <ChartCard title="Campanhas no ar" subtitle={subtitle}><ChartEmpty>Carregando…</ChartEmpty></ChartCard>;
  if (!foto?.geradoEm) return <ChartCard title="Campanhas no ar" subtitle={subtitle}><ChartEmpty>As campanhas do Meta aparecem aqui depois da primeira leitura diária.</ChartEmpty></ChartCard>;
  if (lista.length === 0) return <ChartCard title="Campanhas no ar" subtitle={subtitle}><ChartEmpty>{unit ? `Nenhuma campanha veiculando ${unit === "Institucional" ? "na conta Institucional" : `para ${unit}`} no Meta hoje.` : "Nenhuma campanha veiculando no Meta hoje."}</ChartEmpty></ChartCard>;
  const gasto = lista.reduce((s, c) => s + c.gasto7d, 0);
  const contatos = lista.reduce((s, c) => s + c.leads7d + c.conversas7d, 0);
  return (
    <ChartCard
      title="Campanhas no ar"
      subtitle={subtitle}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label="Campanhas no ar" value={lista.length.toLocaleString("pt-BR")} swatch={<span className="h-2 w-2 rounded-full bg-success" />} />
          <HeadlineStat label="Investido em 7 dias" value={reais(gasto)} swatch={<span className="h-2 w-2 rounded-full bg-foreground" />} />
          <HeadlineStat label="Custo por contato" value={contatos > 0 ? reais2(gasto / contatos) : "—"} swatch={<span className="h-2 w-2 rounded-full bg-[#3b82f6]" />} />
        </div>
      }
    >
      <ul className="space-y-2" aria-label="Campanhas no ar, das que mais gastam para as que menos gastam">
        {lista.map((c) => <Linha key={c.id} c={c} mostrarUnidade={!unit} />)}
      </ul>
      {foto.erros.length > 0 && <p className="mt-3 text-xs text-warning">{foto.erros.length} {foto.erros.length === 1 ? "conta não pôde" : "contas não puderam"} ser lida{foto.erros.length === 1 ? "" : "s"} na última atualização; as campanhas dela{foto.erros.length === 1 ? "" : "s"} podem faltar.</p>}
      <p className="mt-3 text-xs text-muted-foreground">Campanhas veiculando no Meta (Facebook e Instagram): ativas, não encerradas e com entrega nos últimos 7 dias (ou começadas nesta semana). Campanhas antigas que o Meta ainda marca como ativas ficam de fora. Contato = lead ou conversa iniciada. A unidade vem da conta de anúncio; a conta Institucional aparece só quando escolhida, separada das unidades.</p>
    </ChartCard>
  );
}
