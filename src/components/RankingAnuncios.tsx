import { useEffect, useMemo, useState } from "react";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { anunciosDaUnidade, carregarCampanhas, contatosDoAnuncio, ctr, rankingDeAnuncios, type Anuncio, type FotoCampanhas } from "@/data/campanhas";

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const reais2 = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const MIN_CONTATOS = 5;
const GASTO_SEM_CONTATO = 100;

function Miniatura({ src, nome }: { src: string | null; nome: string }) {
  const [erro, setErro] = useState(false);
  if (!src || erro) return <div className="h-14 w-14 shrink-0 rounded-md bg-secondary" aria-hidden />;
  return <img src={src} alt={`Criativo do anúncio ${nome}`} loading="lazy" referrerPolicy="no-referrer" onError={() => setErro(true)} className="h-14 w-14 shrink-0 rounded-md object-cover bg-secondary" />;
}

function Item({ a, pos, mostrarUnidade, destaque }: { a: Anuncio; pos?: number; mostrarUnidade: boolean; destaque: string }) {
  const contatos = contatosDoAnuncio(a);
  const taxa = ctr(a.cliques30d, a.impressoes30d);
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
      {pos !== undefined && <span className="w-5 shrink-0 text-center text-sm font-semibold tabular-nums text-muted-foreground">{pos}</span>}
      <Miniatura src={a.imagem} nome={a.nome} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground" title={a.nome}>{a.nome || "Anúncio sem nome"}</p>
        <p className="truncate text-xs text-muted-foreground" title={a.campanha}>{mostrarUnidade && <>{a.unidade ?? "Institucional"} · </>}{a.campanha}</p>
        <p className="text-xs tabular-nums text-muted-foreground">{reais(a.gasto30d)} gastos · {contatos.toLocaleString("pt-BR")} contatos{taxa !== null && <> · CTR {taxa.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</>}</p>
      </div>
      <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">{destaque}</span>
    </li>
  );
}

/** Ranking dos anúncios dos últimos 30 dias: os que trazem contato mais barato e os que gastaram sem trazer contato. */
export function RankingAnuncios({ unit }: { unit: string | null }) {
  const [foto, setFoto] = useState<FotoCampanhas | null | undefined>(undefined);
  useEffect(() => { let vivo = true; carregarCampanhas().then((f) => vivo && setFoto(f)); return () => { vivo = false; }; }, []);
  const r = useMemo(() => rankingDeAnuncios(anunciosDaUnidade(foto?.anuncios, unit), { minContatos: MIN_CONTATOS, gastoSemContato: GASTO_SEM_CONTATO, limite: unit ? 5 : 10 }), [foto, unit]);
  const titulo = "Ranking dos anúncios";
  const subtitle = <>{unit ?? "Rede"} • últimos 30 dias</>;
  if (foto === undefined) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>Carregando…</ChartEmpty></ChartCard>;
  if (!foto?.anuncios) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>O ranking aparece depois da próxima leitura diária do Meta.</ChartEmpty></ChartCard>;
  if (r.total === 0) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>Nenhum anúncio com gasto nos últimos 30 dias.</ChartEmpty></ChartCard>;
  return (
    <ChartCard title={titulo} subtitle={subtitle}>
      <h4 className="mb-2 text-sm font-semibold text-foreground">Contato mais barato</h4>
      {r.melhores.length ? (
        <ol className="space-y-2" aria-label="Anúncios com o contato mais barato, do mais barato para o mais caro">
          {r.melhores.map((a, i) => <Item key={a.id} a={a} pos={i + 1} mostrarUnidade={!unit} destaque={`${reais2(a.custo)} por contato`} />)}
        </ol>
      ) : <p className="text-sm text-muted-foreground">Nenhum anúncio com {MIN_CONTATOS} contatos ou mais no período.</p>}
      {r.semContato.length > 0 && (
        <>
          <h4 className="mb-2 mt-5 text-sm font-semibold text-foreground">Gastaram sem trazer contato</h4>
          <ul className="space-y-2" aria-label="Anúncios que gastaram sem trazer contato">
            {r.semContato.map((a) => <Item key={a.id} a={a} mostrarUnidade={!unit} destaque={reais(a.gasto30d)} />)}
          </ul>
        </>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        {r.total} {r.total === 1 ? "anúncio gastou" : "anúncios gastaram"} nos últimos 30 dias; entram no ranking os com {MIN_CONTATOS} contatos ou mais ({r.avaliados}). Contato = lead ou conversa iniciada; inclui anúncios já pausados. Use os do topo como referência para os próximos criativos.
      </p>
    </ChartCard>
  );
}
