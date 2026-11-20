import { useEffect, useMemo, useState } from "react";
import { Scale } from "lucide-react";
import { SectionTitle } from "@/components/SectionTitle";
import { ChartCard, ChartEmpty } from "@/components/ChartCard";
import { Select } from "@/components/ui/select";
import { API_BASE, authFetch } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { type FiltroJuridico, type ModeloJuridico, type RespostaJuridico, agrupar, empresasDe, filtrar, filtroInicial, resumo } from "@/data/juridico";
import { ResumoJuridico } from "@/components/juridico/ResumoJuridico";
import { Ranking } from "@/components/juridico/Ranking";
import { ListaProcessos } from "@/components/juridico/ListaProcessos";

type Estado = { fase: "carregando" } | { fase: "erro"; motivo: "permissao" | "falha" } | { fase: "pronto"; dados: RespostaJuridico };

/** Pede o jurídico à API. A permissão é conferida no servidor a cada pedido; esta tela só mostra o que ele liberar. */
export async function carregarJuridico(): Promise<Estado> {
  try {
    const res = await authFetch(`${API_BASE}/juridico`);
    if (res.status === 403) return { fase: "erro", motivo: "permissao" };
    if (!res.ok) return { fase: "erro", motivo: "falha" };
    return { fase: "pronto", dados: (await res.json()) as RespostaJuridico };
  } catch {
    return { fase: "erro", motivo: "falha" };
  }
}

const botao = (ativo: boolean) =>
  cn("rounded-lg px-3 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", ativo ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground");

/** Visão de um estado (separada para os testes, que não rodam o carregamento). */
export function JuridicoConteudo({ estado, hoje = new Date().toISOString().slice(0, 10) }: { estado: Estado; hoje?: string }) {
  if (estado.fase === "carregando") return <ChartCard title="Jurídico"><ChartEmpty>Carregando…</ChartEmpty></ChartCard>;
  if (estado.fase === "erro") {
    return <ChartCard title="Jurídico"><ChartEmpty>{estado.motivo === "permissao" ? "Você não tem acesso a esta tela." : "Não consegui carregar o jurídico agora. Tente de novo em instantes."}</ChartEmpty></ChartCard>;
  }
  const d = estado.dados;
  if (!d.disponivel) {
    return <ChartCard title="Jurídico" subtitle="Processos judiciais e extrajudiciais da rede"><ChartEmpty>Os processos ainda não foram enviados. Eles chegam com a próxima leitura da planilha do jurídico.</ChartEmpty></ChartCard>;
  }
  return <PainelJuridico modelo={d} hoje={hoje} />;
}

export function PainelJuridico({ modelo, hoje }: { modelo: ModeloJuridico; hoje: string }) {
  const [f, setF] = useState<FiltroJuridico>(filtroInicial);
  const empresas = useMemo(() => empresasDe(modelo.processos), [modelo]);
  const lista = useMemo(() => filtrar(modelo.processos, f), [modelo, f]);
  const arquivados = modelo.processos.filter((p) => p.arquivado).length;
  const atualizado = new Date(modelo.atualizadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const mudou = JSON.stringify(f) !== JSON.stringify(filtroInicial);
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Planilha do jurídico lida em <b className="font-semibold text-foreground">{atualizado}</b>. O nome da parte contrária e os textos do processo não entram no Atlas.</p>
      <div className="card-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <div role="group" aria-label="Situação" className="flex rounded-xl border border-border bg-white p-0.5">
            {([["ativos", "Ativos"], ["arquivados", "Arquivados"], ["todos", "Todos"]] as const).map(([v, r]) => <button key={v} type="button" aria-pressed={f.situacao === v} className={botao(f.situacao === v)} onClick={() => setF({ ...f, situacao: v })}>{r}</button>)}
          </div>
          <div role="group" aria-label="Natureza" className="flex rounded-xl border border-border bg-white p-0.5">
            {([["todas", "Todas"], ["judicial", "Judiciais"], ["extrajudicial", "Extrajudiciais"]] as const).map(([v, r]) => <button key={v} type="button" aria-pressed={f.natureza === v} className={botao(f.natureza === v)} onClick={() => setF({ ...f, natureza: v })}>{r}</button>)}
          </div>
          <label className="text-xs text-muted-foreground">Empresa
            <Select aria-label="Empresa" className="mt-1 h-9 w-72 max-w-full" value={f.empresa} onChange={(e) => setF({ ...f, empresa: e.target.value })}>
              <option value="">Todas as empresas</option>
              {empresas.map((e) => <option key={e} value={e}>{e}</option>)}
            </Select>
          </label>
          {mudou && <button type="button" onClick={() => setF(filtroInicial)} className="pb-2 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">Limpar filtros</button>}
        </div>
      </div>
      <ResumoJuridico r={resumo(lista, hoje)} arquivados={f.situacao === "arquivados" ? 0 : arquivados} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Ranking titulo="Por empresa" subtitulo="Processos e valor em causa de cada razão social" grupos={agrupar(lista, "empresa")} />
        <Ranking titulo="Por órgão" subtitulo="Tribunal, Procon ou Ministério Público" grupos={agrupar(lista, "orgao")} />
      </div>
      <Ranking titulo="Por tipo de ação" grupos={agrupar(lista, "tipo")} />
      <ListaProcessos processos={lista} hoje={hoje} />
    </div>
  );
}

/** Menu Jurídico: só o dono e quem ele liberou (o servidor confere de novo). */
export function JuridicoTab() {
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  useEffect(() => {
    let vivo = true;
    carregarJuridico().then((e) => { if (vivo) setEstado(e); });
    return () => { vivo = false; };
  }, []);
  return (
    <section className="space-y-4">
      <SectionTitle level="page"><span className="inline-flex items-center gap-2"><Scale className="h-6 w-6" aria-hidden />Jurídico</span></SectionTitle>
      <JuridicoConteudo estado={estado} />
    </section>
  );
}
