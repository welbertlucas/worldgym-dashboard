import { Delta, Sparkline } from "@/components/FaixaKpi";
import { Avatar } from "@/components/instagram/Midia";
import type { CartaoConta } from "@/data/instagramPainel";
import { cn } from "@/lib/utils";

const int = (n: number | null | undefined) => (n == null ? "—" : Math.round(n).toLocaleString("pt-BR"));

/** "Postou hoje", "Postou ontem", "Sem postar há 9 dias" (mais de 7 dias fica em vermelho). */
export function situacaoDoUltimoPost(dias: number | null): { texto: string; alerta: boolean } {
  if (dias == null) return { texto: "Sem posts guardados", alerta: false };
  if (dias <= 0) return { texto: "Postou hoje", alerta: false }; // relógio um pouco adiantado também vale como hoje
  if (dias === 1) return { texto: "Postou ontem", alerta: false };
  return { texto: dias > 7 ? `Sem postar há ${dias} dias` : `Postou há ${dias} dias`, alerta: dias > 7 };
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] text-muted-foreground">{rotulo}</p>
      <p className="mt-0.5 font-display text-xl font-semibold leading-none tabular-nums text-foreground">{valor}</p>
    </div>
  );
}

/**
 * Uma conta do Instagram: foto, @, seguidores em destaque com o ganho e a evolução, e os números dos últimos 30 dias.
 * `maior` = seguidores da maior conta da lista: a barra fina mostra o tamanho de cada uma frente à maior.
 */
export function CartaoDaConta({ c, maior, mostrarBarra }: { c: CartaoConta; maior: number; mostrarBarra: boolean }) {
  const sit = situacaoDoUltimoPost(c.diasSemPost);
  const seg = c.conta.seguidores;
  return (
    <li className="card-surface flex min-w-0 flex-col gap-4 p-4">
      <div className="flex items-start gap-3">
        <Avatar foto={c.conta.foto} nome={c.conta.unidade ?? c.conta.usuario} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">@{c.conta.usuario}</p>
          <p className="truncate text-xs text-muted-foreground">{c.conta.unidade ?? "Institucional (conta da rede)"}</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", sit.alerta ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground")}>{sit.texto}</span>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[2rem] font-semibold leading-none tracking-tight tabular-nums text-foreground">{int(seg)}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            seguidores <Delta valor={c.ganhoSeguidores} titulo="Variação de seguidores nos últimos 30 dias" semHistorico="" />
          </p>
        </div>
        <Sparkline valores={c.serie} rotulo={`Evolução dos seguidores de @${c.conta.usuario}`} className="w-24 shrink-0" />
      </div>

      {mostrarBarra && (
        <div className="h-1.5 rounded-full bg-secondary" aria-hidden>
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(((seg ?? 0) / Math.max(maior, 1)) * 100, 2)}%` }} />
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 border-t border-border pt-3">
        <Numero rotulo="Posts" valor={int(c.postsNoPeriodo)} />
        <Numero rotulo="Stories" valor={int(c.storiesNoPeriodo)} />
        <Numero rotulo="Interações/post" valor={int(c.interacoesPorPost)} />
        <Numero rotulo="Views/post" valor={int(c.mediaVisualizacoes)} />
      </div>
    </li>
  );
}
