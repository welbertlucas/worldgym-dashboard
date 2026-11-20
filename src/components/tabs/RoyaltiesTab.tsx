import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import { SectionTitle } from "@/components/SectionTitle";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { API_BASE, authFetch } from "@/lib/auth";

/** O que a API de royalties devolve: `disponivel: false` até a rotina de royalties enviar o primeiro modelo. */
export type RespostaRoyalties =
  | { disponivel: false }
  | { disponivel: true; meses?: { key: string; label: string }[]; unidades?: { nome: string; tipo: string }[]; meta?: { geradoEm?: string; planilha?: string } };

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
  return (
    <ChartCard title="Royalties" subtitle="Recebimentos da marca (taxa fixa e royalties) e inadimplência por unidade">
      <p className="text-sm text-muted-foreground">
        Dados recebidos{d.meta?.geradoEm ? ` em ${d.meta.geradoEm}` : ""}: {d.meses?.length ?? 0} meses e {d.unidades?.length ?? 0} unidades. Os painéis chegam na próxima etapa.
      </p>
    </ChartCard>
  );
}

/** Menu Royalties: só aparece para dono, Master e quem o dono liberou (o servidor confere de novo). */
export function RoyaltiesTab() {
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  useEffect(() => {
    let vivo = true;
    carregarRoyalties().then((e) => { if (vivo) setEstado(e); });
    return () => { vivo = false; };
  }, []);
  return (
    <section className="space-y-4">
      <SectionTitle level="page" hint="Só para dono, Master e quem foi liberado em Usuários.">
        <span className="inline-flex items-center gap-2"><Landmark className="h-6 w-6" aria-hidden />Royalties</span>
      </SectionTitle>
      <RoyaltiesConteudo estado={estado} />
    </section>
  );
}
