import { useMemo, useState } from "react";
import { Eye, Reply } from "lucide-react";
import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import { Miniatura } from "@/components/instagram/Midia";
import { storiesDasUltimas, storiesPorDia, type StoryInstagram } from "@/data/instagram";
import { storiesPorDiaContagem } from "@/data/instagramPainel";
import { cn } from "@/lib/utils";

const int = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("pt-BR"));
const hora = (iso: string | null) => (iso ? new Date(iso.replace(/([+-]\d{2})(\d{2})$/, "$1:$2")).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");
const diaLongo = (ymd: string) => { const [y, m, d] = ymd.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" }); };
const diaCurto = (ymd: string) => { const [y, m, d] = ymd.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }); };

export const JANELA_STORIES = { 24: "últimas 24 horas", 168: "últimos 7 dias", 720: "últimos 30 dias" } as const;
type Janela = keyof typeof JANELA_STORIES;
const ROTULO_JANELA: Record<Janela, string> = { 24: "24 horas", 168: "7 dias", 720: "30 dias" };

function Story({ s, mostrarConta }: { s: StoryInstagram; mostrarConta: boolean }) {
  return (
    <li className="w-24 shrink-0">
      <a href={s.link ?? undefined} target="_blank" rel="noreferrer" className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Miniatura id={s.id} temMidia={s.midia} className="aspect-[9/16] w-24 rounded-xl border border-border" alt={`Story de @${s.conta}`} />
      </a>
      {mostrarConta && <p className="mt-1 truncate text-[11px] font-medium text-foreground" title={`@${s.conta}`}>{s.unidade ?? "Institucional"}</p>}
      <p className={cn("flex gap-2 text-[11px] tabular-nums text-foreground", !mostrarConta && "mt-1")}>
        <span className="text-muted-foreground">{hora(s.data)}</span>
        <span className="inline-flex items-center gap-0.5" title="Visualizações"><Eye className="h-3 w-3 text-muted-foreground" aria-hidden />{int(s.visualizacoes)}</span>
        {(s.respostas ?? 0) > 0 && <span className="inline-flex items-center gap-0.5" title="Respostas"><Reply className="h-3 w-3 text-muted-foreground" aria-hidden />{int(s.respostas)}</span>}
      </p>
    </li>
  );
}

/** Stories por dia nos últimos 14 dias: uma barra por dia, a de hoje em vermelho cheio. */
function BarrasPorDia({ stories }: { stories: StoryInstagram[] }) {
  const dias = useMemo(() => storiesPorDiaContagem(stories, 14), [stories]);
  const maior = Math.max(1, ...dias.map((d) => d.n));
  return (
    <div>
      <ul className="flex h-20 items-end gap-1.5" aria-label="Stories por dia, nos últimos 14 dias">
        {dias.map((d, i) => (
          <li key={d.dia} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${diaCurto(d.dia)}: ${d.n} ${d.n === 1 ? "story" : "stories"}`}>
            <span className="mb-1 text-center text-[10px] tabular-nums text-muted-foreground">{d.n || ""}</span>
            <span className={cn("block w-full rounded-t-sm", d.n === 0 ? "h-0.5 bg-border" : i === dias.length - 1 ? "bg-primary" : "bg-primary/45")} style={d.n ? { height: `${Math.max((d.n / maior) * 100 - 18, 6)}%` } : undefined} />
          </li>
        ))}
      </ul>
      <ul className="mt-1 flex gap-1.5" aria-hidden>
        {dias.map((d) => <li key={d.dia} className="min-w-0 flex-1 text-center text-[10px] tabular-nums text-muted-foreground">{d.dia.slice(8)}</li>)}
      </ul>
    </div>
  );
}

/** Stories: quantos, quanto foram vistos, o ritmo dos últimos 14 dias e a lista do que o painel guardou (o Meta só entrega enquanto estão no ar). */
export function StoriesSecao({ stories, quem, mostrarConta }: { stories: StoryInstagram[]; quem: string; mostrarConta: boolean }) {
  const [janela, setJanela] = useState<Janela>(24);
  const naJanela = useMemo(() => storiesDasUltimas(stories, janela), [stories, janela]);
  const dias = useMemo(() => storiesPorDia(naJanela), [naJanela]);
  const comViews = naJanela.map((s) => s.visualizacoes).filter((n): n is number => n != null);
  const media = comViews.length ? Math.round(comViews.reduce((s, n) => s + n, 0) / comViews.length) : null;
  return (
    <ChartCard
      title="Stories"
      subtitle={<>{quem} • {JANELA_STORIES[janela]}</>}
      headline={stories.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <HeadlineStat label={`Stories ${janela === 24 ? "nas" : "nos"} ${JANELA_STORIES[janela]}`} value={int(naJanela.length)} swatch={<span className="h-2 w-2 rounded-full bg-primary" />} />
          <HeadlineStat label="Visualizações por story" value={int(media)} swatch={<span className="h-2 w-2 rounded-full bg-foreground/40" />} />
        </div>
      )}
      legend={stories.length > 0 && (
        <div role="group" aria-label="Período dos stories" className="inline-flex max-w-full overflow-x-auto rounded-full border border-border p-0.5">
          {(Object.keys(JANELA_STORIES).map(Number) as Janela[]).map((h) => (
            <button key={h} type="button" aria-pressed={h === janela} onClick={() => setJanela(h)} className={cn("shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", h === janela ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              {ROTULO_JANELA[h]}
            </button>
          ))}
        </div>
      )}
    >
      {stories.length === 0 ? <ChartEmpty>Nenhum story guardado ainda.</ChartEmpty> : (
        <div className="space-y-5">
          <BarrasPorDia stories={stories} />
          {dias.length === 0 ? <ChartEmpty>Nenhum story {janela === 24 ? "nas últimas 24 horas" : `nos ${JANELA_STORIES[janela]}`}.</ChartEmpty>
            : dias.map(([dia, lista]) => (
              <section key={dia} aria-label={`Stories de ${diaLongo(dia)}`}>
                <h4 className="mb-2 text-xs font-medium text-muted-foreground first-letter:uppercase">{diaLongo(dia)} · {lista.length} {lista.length === 1 ? "story" : "stories"}</h4>
                <ul className="flex gap-3 overflow-x-auto pb-1">{lista.map((s) => <Story key={s.id} s={s} mostrarConta={mostrarConta} />)}</ul>
              </section>
            ))}
          <p className="text-xs text-muted-foreground">Stories contam só a partir do dia em que o painel começou a guardá-los: o Meta só os entrega enquanto estão no ar, por 24 horas.</p>
        </div>
      )}
    </ChartCard>
  );
}
