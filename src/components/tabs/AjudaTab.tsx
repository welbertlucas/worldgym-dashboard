import { useEffect, useState } from "react";
import { lerVistas, marcarVistas } from "@/lib/novidadesVistas";
import { novidadesPara, type Novidade } from "@/data/novidades";
import { cn } from "@/lib/utils";
import { ArrowLeft, ImageIcon, Search } from "lucide-react";
import { SectionTitle } from "@/components/SectionTitle";
import { API_BASE, authFetch, ehDono } from "@/lib/auth";
import { artigosPara, buscarAjuda, secoesPara, type ArtigoAjuda } from "@/data/ajuda";

const imagens = new Map<string, Promise<string | null>>();
/** Print da tela (a rota exige login, então vem por fetch e vira um endereço local do navegador). */
function imagemAjuda(nome: string): Promise<string | null> {
  if (!imagens.has(nome)) {
    imagens.set(nome, authFetch(`${API_BASE}/ajuda?imagem=${encodeURIComponent(nome)}`)
      .then(async (r) => (r.ok ? URL.createObjectURL(await r.blob()) : null))
      .catch(() => null));
  }
  return imagens.get(nome)!;
}

function Print({ nome, titulo }: { nome: string; titulo: string }) {
  const [src, setSrc] = useState<string | null | undefined>(undefined);
  useEffect(() => { let vivo = true; imagemAjuda(nome).then((u) => vivo && setSrc(u)); return () => { vivo = false; }; }, [nome]);
  if (src === null) return null; // sem imagem guardada: o artigo segue só com o texto
  return (
    <figure className="space-y-1.5">
      <div className="overflow-hidden rounded-xl border border-border bg-secondary">
        {src ? <img src={src} alt={`Tela ${titulo}`} className="w-full" /> : <span className="flex aspect-[16/9] items-center justify-center text-muted-foreground/50"><ImageIcon className="h-6 w-6" aria-hidden /></span>}
      </div>
      <figcaption className="text-xs text-muted-foreground">Imagem ilustrativa, com números fictícios.</figcaption>
    </figure>
  );
}

const dataLonga = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

function Artigo({ artigo, onVoltar, onAbrirTela }: { artigo: ArtigoAjuda; onVoltar: () => void; onAbrirTela: (destino: string) => void }) {
  return (
    <article className="max-w-3xl space-y-4">
      <button type="button" onClick={onVoltar} className="inline-flex items-center gap-1.5 rounded text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Ajuda e novidades
      </button>
      <header className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{artigo.titulo}</h2>
        <p className="text-sm text-muted-foreground">
          Por {artigo.autora} · atualizado em {dataLonga(artigo.atualizadoEm)}
          {artigo.publico === "dono" && <span className="ml-2 rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium">Só você vê</span>}
        </p>
      </header>
      {artigo.imagem && <Print nome={artigo.imagem} titulo={artigo.titulo} />}
      <div className="space-y-3 text-[15px] leading-relaxed text-foreground">
        {artigo.paragrafos.map((p, i) => <p key={i}>{p}</p>)}
      </div>
      {artigo.tela && (
        <button type="button" onClick={() => onAbrirTela(artigo.tela!)} className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-primary-ink shadow-sm hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Abrir esta tela →
        </button>
      )}
    </article>
  );
}

function ItemDaLista({ x, onAbrir }: { x: ArtigoAjuda; onAbrir: (id: string) => void }) {
  return (
    <li>
      <button type="button" onClick={() => onAbrir(x.id)} className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="block text-sm font-medium text-foreground">{x.titulo}</span>
        <span className="block text-xs text-muted-foreground line-clamp-2">{x.resumo}</span>
      </button>
    </li>
  );
}

const dataCurta = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
const MOSTRAR = 4;

/** Novidades no topo da Ajuda: as não vistas ficam marcadas como "Nova" enquanto a tela está aberta, e o número do menu some. */
function Novidades({ lista, onAbrirTela }: { lista: Novidade[]; onAbrirTela: (destino: string) => void }) {
  const [novas] = useState(() => { const v = new Set(lerVistas()); return new Set(lista.filter((n) => !v.has(n.id)).map((n) => n.id)); });
  const [todas, setTodas] = useState(false);
  useEffect(() => { marcarVistas(lista.map((n) => n.id)); }, [lista]);
  if (!lista.length) return null;
  const mostradas = todas ? lista : lista.slice(0, Math.max(MOSTRAR, novas.size));
  return (
    <section className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <h3 className="px-3 pb-1 pt-1 text-sm font-semibold text-foreground">Novidades</h3>
      <ul className="grid gap-1 md:grid-cols-2">
        {mostradas.map((n) => (
          <li key={n.id} className={cn("rounded-lg px-3 py-2.5", novas.has(n.id) && "bg-primary/5")}>
            <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
              <span className="tabular-nums">{dataCurta(n.data)}</span>
              <span>· {n.autora}</span>
              {novas.has(n.id) && <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">Nova</span>}
              {n.publico === "dono" && <span className="rounded-md bg-secondary px-1.5 font-medium">Só você vê</span>}
            </p>
            <p className="mt-0.5 text-sm font-medium text-foreground">{n.titulo}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{n.texto}</p>
            {n.tela && n.tela !== "ajuda" && (
              <button type="button" onClick={() => onAbrirTela(n.tela!)} className="mt-1 rounded text-xs font-semibold text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Ver na tela →
              </button>
            )}
          </li>
        ))}
      </ul>
      {lista.length > mostradas.length && (
        <button type="button" onClick={() => setTodas(true)} className="mx-3 mt-1 rounded text-xs font-semibold text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Ver todas as novidades ({lista.length})
        </button>
      )}
    </section>
  );
}

/** Central de ajuda: artigos por seção, com busca. `aba` é o artigo aberto (#ajuda/<artigo>). */
export function AjudaTab({ aba, onAba, onAbrirTela }: { aba: string | null; onAba: (id: string | null) => void; onAbrirTela: (destino: string) => void }) {
  const dono = ehDono();
  const artigos = artigosPara(dono);
  const [consulta, setConsulta] = useState("");
  const [novidades] = useState(() => novidadesPara(dono));
  const aberto = aba ? artigos.find((x) => x.id === aba) : undefined;
  if (aberto) return <Artigo artigo={aberto} onVoltar={() => onAba(null)} onAbrirTela={onAbrirTela} />;

  const achados = buscarAjuda(artigos, consulta);
  return (
    <div className="space-y-5">
      <SectionTitle level="page" hint="O que mudou no Atlas, como usar cada tela, o que significa cada número e as dúvidas mais comuns.">Ajuda e novidades</SectionTitle>
      <label className="flex max-w-xl items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-ring">
        <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Buscar na ajuda: churn, senha, alerta…"
          aria-label="Buscar na ajuda"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>
      {consulta.trim() ? (
        achados.length ? (
          <ul className="max-w-3xl rounded-xl border border-border bg-card p-1">{achados.map((x) => <ItemDaLista key={x.id} x={x} onAbrir={onAba} />)}</ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nada encontrado para "{consulta}". Tente outra palavra.</p>
        )
      ) : (
        <>
        <Novidades lista={novidades} onAbrirTela={onAbrirTela} />
        <div className="grid gap-4 lg:grid-cols-2">
          {secoesPara(dono).map((s) => {
            const lista = artigos.filter((x) => x.secao === s.id);
            if (!lista.length) return null;
            return (
              <section key={s.id} className="rounded-xl border border-border bg-card p-3 shadow-sm">
                <h3 className="flex items-center gap-2 px-3 pb-1 pt-1 text-sm font-semibold text-foreground">
                  {s.titulo}
                  {s.publico === "dono" && <span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-muted-foreground">Só você vê</span>}
                </h3>
                <ul className={s.id === "indicadores" ? "max-h-[22rem] overflow-y-auto" : undefined}>{lista.map((x) => <ItemDaLista key={x.id} x={x} onAbrir={onAba} />)}</ul>
              </section>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}
