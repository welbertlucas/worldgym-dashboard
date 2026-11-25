import { useCallback, useEffect, useMemo, useState } from "react";
import { Landmark } from "lucide-react";
import { SectionTitle } from "@/components/SectionTitle";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { Notice } from "@/components/Notice";
import { API_BASE, authFetch } from "@/lib/auth";
import { contexto, filtroInicial, type FiltroRoyalties, type ModeloRoyalties } from "@/data/royalties";
import { FiltrosRoyalties } from "@/components/royalties/FiltrosRoyalties";
import { ResumoRoyalties } from "@/components/royalties/ResumoRoyalties";
import { QuemDeve } from "@/components/royalties/QuemDeve";
import { Recolhivel } from "@/components/royalties/Recolhivel";
import { RoyaltiesPorUnidade } from "@/components/royalties/RoyaltiesPorUnidade";
import { EsperadoRecebido } from "@/components/royalties/EsperadoRecebido";
import { MatrizSituacao } from "@/components/royalties/MatrizSituacao";
import { NotasRoyalties } from "@/components/royalties/NotasRoyalties";
import { DetalheDaUnidade } from "@/components/royalties/DetalheDaUnidade";

/** O que a API de royalties devolve: `disponivel: false` até a rotina de royalties enviar o primeiro modelo. */
export type RespostaRoyalties = { disponivel: false } | ({ disponivel: true } & ModeloRoyalties);

type Estado = { fase: "carregando" } | { fase: "erro"; motivo: "permissao" | "falha" } | { fase: "pronto"; dados: RespostaRoyalties };

/** Pede os royalties à API. A permissão é conferida no servidor a cada pedido; esta tela só mostra o que ele liberar. */
export async function carregarRoyalties(): Promise<Estado> {
  try {
    const res = await authFetch(`${API_BASE}/royalties`);
    if (res.status === 403) return { fase: "erro", motivo: "permissao" };
    if (!res.ok) return { fase: "erro", motivo: "falha" };
    return { fase: "pronto", dados: (await res.json()) as RespostaRoyalties };
  } catch {
    return { fase: "erro", motivo: "falha" };
  }
}

/** Visão de um estado (separada para os testes, que não rodam o carregamento). */
export function RoyaltiesConteudo({ estado }: { estado: Estado }) {
  if (estado.fase === "carregando") return <ChartCard title="Royalties"><ChartEmpty>Carregando…</ChartEmpty></ChartCard>;
  if (estado.fase === "erro") {
    return (
      <ChartCard title="Royalties">
        <ChartEmpty>{estado.motivo === "permissao" ? "Você não tem acesso a esta tela." : "Não consegui carregar os royalties agora. Tente de novo em instantes."}</ChartEmpty>
      </ChartCard>
    );
  }
  const d = estado.dados;
  if (!d.disponivel) {
    return (
      <ChartCard title="Royalties" subtitle="Recebimentos da marca (taxa fixa e royalties) e inadimplência por unidade">
        <ChartEmpty>Os dados de royalties ainda não foram enviados. Eles chegam com a próxima atualização da planilha.</ChartEmpty>
      </ChartCard>
    );
  }
  return <PainelRoyalties modelo={d} />;
}

/** Os painéis, com os filtros do topo valendo para todos eles. */
export function PainelRoyalties({ modelo }: { modelo: ModeloRoyalties }) {
  const c = useMemo(() => contexto(modelo), [modelo]);
  const [f, setF] = useState<FiltroRoyalties>(() => filtroInicial(c));
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const fechar = useCallback(() => setDetalhe(null), []);
  return (
    <div className="space-y-4">
      {modelo.meta.stale && (
        <Notice icon="alert">A leitura da planilha falhou em {modelo.meta.stale.tentativa}. Você está vendo a última versão conferida, de {modelo.meta.geradoEm}.</Notice>
      )}
      <p className="text-xs text-muted-foreground">Dados de <b className="font-semibold text-foreground">{modelo.meta.geradoEm}</b>, recebimentos até {c.rotulo[c.keys[c.keys.length - 1]]}.</p>
      <FiltrosRoyalties c={c} f={f} onChange={setF} />
      <ResumoRoyalties c={c} f={f} onUnidade={setDetalhe} />
      <QuemDeve c={c} f={f} onUnidade={setDetalhe} />
      <MatrizSituacao c={c} f={f} onUnidade={setDetalhe} />
      <Recolhivel titulo="Mais análises" apoio="Royalties por unidade, com as marcações de mês sem pagamento e queda, e o esperado contra o recebido">
        <RoyaltiesPorUnidade c={c} f={f} onUnidade={setDetalhe} />
        <EsperadoRecebido c={c} f={f} onUnidade={setDetalhe} />
      </Recolhivel>
      <Recolhivel titulo="Notas e premissas" apoio="O que a planilha e a diretoria definiram e muda a leitura dos números">
        <NotasRoyalties c={c} />
      </Recolhivel>
      {detalhe && <DetalheDaUnidade c={c} unidade={detalhe} onFechar={fechar} />}
    </div>
  );
}

/** Menu Royalties: só aparece para dono, Master e quem o dono liberou (o servidor confere de novo). */
export function RoyaltiesTab({ semTitulo = false }: { semTitulo?: boolean } = {}) {
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  useEffect(() => {
    let vivo = true;
    carregarRoyalties().then((e) => { if (vivo) setEstado(e); });
    return () => { vivo = false; };
  }, []);
  return (
    <section className="space-y-4">
      {!semTitulo && (
      <SectionTitle level="page">
        <span className="inline-flex items-center gap-2"><Landmark className="h-6 w-6" aria-hidden />Royalties</span>
      </SectionTitle>
      )}
      <RoyaltiesConteudo estado={estado} />
    </section>
  );
}
