import { useEffect, useState } from "react";
import { BookOpen, ChevronRight, CircleHelp, ImageIcon, KeyRound, LayoutDashboard, MapPin, Rocket, Search, ShieldAlert, type LucideIcon } from "lucide-react";
import { lerVistas, marcarVistas } from "@/lib/novidadesVistas";
import { buscarNovidades, novidadesPara, type Novidade } from "@/data/novidades";
import { cn } from "@/lib/utils";
import { SectionTitle } from "@/components/SectionTitle";
import { ondeFica } from "@/components/nav";
import { API_BASE, authFetch, ehDono } from "@/lib/auth";
import { artigosPara, buscarAjuda, secoesPara, SECOES, type ArtigoAjuda, type SecaoAjuda } from "@/data/ajuda";

const imagens = new Map<string, Promise<string | null>>();
/** Print da tela ou foto de quem escreve (a rota exige login, então vem por fetch e vira um endereço local do navegador). */
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

/** Foto de perfil de quem escreve (guardada com os prints, só com login). Sem foto: as iniciais. */
const FOTO_DA_AUTORA: Record<string, string> = { "Ana Júlia": "ana-julia" };
const iniciais = (nome: string) => nome.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

function Avatar({ autora, tamanho }: { autora: string; tamanho: "p" | "g" }) {
  const foto = FOTO_DA_AUTORA[autora];
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { if (!foto) return; let vivo = true; imagemAjuda(foto).then((u) => vivo && setSrc(u)); return () => { vivo = false; }; }, [foto]);
  const medida = tamanho === "g" ? "h-10 w-10 text-sm" : "h-6 w-6 text-[10px]";
  return src
    ? <img src={src} alt="" aria-hidden className={cn("shrink-0 rounded-full object-cover ring-2 ring-white", medida)} />
    : <span aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-muted-foreground ring-2 ring-white", medida)}>{iniciais(autora)}</span>;
}

const dataLonga = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
const foco = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const ICONE_DA_SECAO: Record<SecaoAjuda, LucideIcon> = { comecando: Rocket, telas: LayoutDashboard, alertas: ShieldAlert, duvidas: CircleHelp, indicadores: BookOpen, dono: KeyRound };
const secao = (id: SecaoAjuda) => SECOES.find((s) => s.id === id)!;

/** Caminho no topo: Central de ajuda › Seção (cada parte volta para lá). */
function Caminho({ partes }: { partes: { rotulo: string; onClick: () => void }[] }) {
  return (
    <nav aria-label="Caminho" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      {partes.map((p, i) => (
        <span key={p.rotulo} className="inline-flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
          <button type="button" onClick={p.onClick} className={cn("rounded font-medium hover:text-foreground hover:underline", foco)}>{p.rotulo}</button>
        </span>
      ))}
    </nav>
  );
}

/** Quem escreveu: fotos lado a lado e "Por Ana Júlia" (ou "Por Ana Júlia e mais 1"), com o número de artigos. */
function Autoras({ lista }: { lista: ArtigoAjuda[] }) {
  const autoras = [...new Set(lista.map((x) => x.autora))];
  return (
    <span className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="flex -space-x-1.5">{autoras.slice(0, 3).map((a) => <Avatar key={a} autora={a} tamanho="p" />)}</span>
      <span>Por {autoras[0]}{autoras.length > 1 && ` e mais ${autoras.length - 1}`} · {lista.length} {lista.length === 1 ? "artigo" : "artigos"}</span>
    </span>
  );
}

function ItemDaLista({ x, onAbrir }: { x: ArtigoAjuda; onAbrir: (id: string) => void }) {
  return (
    <li>
      <button type="button" onClick={() => onAbrir(x.id)} className={cn("block w-full rounded-lg px-3 py-2.5 text-left hover:bg-secondary/70", foco)}>
        <span className="block text-sm font-medium text-foreground">{x.titulo}</span>
        <span className="block text-xs text-muted-foreground line-clamp-2">{x.resumo}</span>
      </button>
    </li>
  );
}

function Artigo({ artigo, relacionados, onAba, onAbrirTela }: { artigo: ArtigoAjuda; relacionados: ArtigoAjuda[]; onAba: (id: string | null) => void; onAbrirTela: (destino: string) => void }) {
  return (
    <article className="max-w-3xl space-y-5">
      <Caminho partes={[{ rotulo: "Central de ajuda", onClick: () => onAba(null) }, { rotulo: secao(artigo.secao).titulo, onClick: () => onAba(artigo.secao) }]} />
      <header className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">{artigo.titulo}</h2>
        <div className="flex items-center gap-2.5">
          <Avatar autora={artigo.autora} tamanho="g" />
          <p className="text-sm text-muted-foreground">
            <span className="block font-medium text-foreground">Escrito por {artigo.autora}</span>
            Atualizado em {dataLonga(artigo.atualizadoEm)}
            {artigo.publico === "dono" && <span className="ml-2 rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium">Só você vê</span>}
          </p>
        </div>
      </header>
      {artigo.tela && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-secondary/40 px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span><span className="font-semibold">Onde fica:</span> {ondeFica(artigo.tela)}</span>
          </p>
          <button type="button" onClick={() => onAbrirTela(artigo.tela!)} className={cn("rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-semibold text-primary-ink shadow-sm hover:bg-secondary", foco)}>
            Abrir esta tela
          </button>
        </div>
      )}
      {artigo.imagem && <Print nome={artigo.imagem} titulo={artigo.titulo} />}
      <div className="space-y-3 text-[15px] leading-relaxed text-foreground">
        {artigo.paragrafos.map((p, i) => <p key={i}>{p}</p>)}
      </div>
      {relacionados.length > 0 && (
        <section className="border-t border-border pt-4">
          <h3 className="px-3 pb-1 text-sm font-semibold text-foreground">Artigos relacionados</h3>
          <ul>{relacionados.map((x) => <ItemDaLista key={x.id} x={x} onAbrir={onAba} />)}</ul>
        </section>
      )}
    </article>
  );
}

/** Campo de busca da Central de ajuda (na página inicial, em cada assunto e em cada artigo). */
function CampoDeBusca({ consulta, onConsulta }: { consulta: string; onConsulta: (v: string) => void }) {
  return (
    <label className="flex max-w-3xl items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-ring">
      <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
      <input
        type="search"
        value={consulta}
        onChange={(e) => onConsulta(e.target.value)}
        placeholder="Buscar artigos: churn, senha, alerta…"
        aria-label="Buscar na ajuda"
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}

/** Central de ajuda: cartões por seção, com busca em todas as páginas. `aba` é a seção ou o artigo aberto (#ajuda/<seção ou artigo>).
 *  O campo de busca fica sempre na mesma posição da árvore, para não perder o foco quando o conteúdo abaixo dele troca. */
export function AjudaTab({ aba, onAba, onAbrirTela }: { aba: string | null; onAba: (id: string | null) => void; onAbrirTela: (destino: string) => void }) {
  const dono = ehDono();
  const artigos = artigosPara(dono);
  const secoes = secoesPara(dono);
  const [consulta, setConsulta] = useState("");
  const daSecao = (id: SecaoAjuda) => artigos.filter((x) => x.secao === id);
  /** Abrir um artigo ou seção limpa a busca. */
  const ir = (id: string | null) => { setConsulta(""); onAba(id); };
  const buscando = consulta.trim() !== "";
  const aberto = aba ? artigos.find((x) => x.id === aba) : undefined;
  const secaoAberta = aberto ? undefined : secoes.find((s) => s.id === aba);
  /** Página inicial (com ou sem busca): título no topo. Dentro de um assunto ou artigo, a busca leva o caminho de volta. */
  const inicio = !aberto && !secaoAberta;

  let conteudo;
  if (buscando) {
    const achados = buscarAjuda(artigos, consulta);
    conteudo = (
      <div className="max-w-3xl space-y-4">
        {!inicio && <Caminho partes={[{ rotulo: "Central de ajuda", onClick: () => ir(null) }]} />}
        {achados.length ? (
          <>
            <p className="text-sm text-muted-foreground">{achados.length} {achados.length === 1 ? "artigo encontrado" : "artigos encontrados"}</p>
            <ul className="rounded-xl border border-border bg-card p-1 shadow-sm">{achados.map((x) => <ItemDaLista key={x.id} x={x} onAbrir={ir} />)}</ul>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Nada encontrado para "{consulta}". Tente outra palavra.</p>
        )}
      </div>
    );
  } else if (aberto) {
    conteudo = <Artigo artigo={aberto} relacionados={daSecao(aberto.secao).filter((x) => x.id !== aberto.id).slice(0, 5)} onAba={ir} onAbrirTela={onAbrirTela} />;
  } else if (secaoAberta) {
    const lista = daSecao(secaoAberta.id);
    conteudo = (
      <div className="max-w-3xl space-y-4">
        <Caminho partes={[{ rotulo: "Central de ajuda", onClick: () => ir(null) }]} />
        <SectionTitle level="page" hint={secaoAberta.descricao}>{secaoAberta.titulo}</SectionTitle>
        <Autoras lista={lista} />
        <ul className="rounded-xl border border-border bg-card p-1 shadow-sm">{lista.map((x) => <ItemDaLista key={x.id} x={x} onAbrir={ir} />)}</ul>
      </div>
    );
  } else {
    conteudo = (
      <ul className="grid gap-3 lg:grid-cols-2">
        {secoes.map((s) => {
          const lista = daSecao(s.id);
          if (!lista.length) return null;
          const Icone = ICONE_DA_SECAO[s.id];
          return (
            <li key={s.id}>
              <button type="button" onClick={() => ir(s.id)} className={cn("flex h-full w-full items-start gap-4 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-foreground/20 hover:bg-secondary/40", foco)}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icone className="h-5 w-5" aria-hidden /></span>
                <span className="min-w-0 flex-1 space-y-1.5">
                  <span className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
                    {s.titulo}
                    {s.publico === "dono" && <span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-muted-foreground">Só você vê</span>}
                  </span>
                  <span className="block text-sm text-muted-foreground">{s.descricao}</span>
                  <Autoras lista={lista} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-5">
      {inicio && <SectionTitle level="page" hint="Como usar cada tela, o que significa cada número e as dúvidas mais comuns.">Central de ajuda</SectionTitle>}
      <CampoDeBusca consulta={consulta} onConsulta={setConsulta} />
      {conteudo}
    </div>
  );
}

/** Novidades mostradas de cada vez (o botão "Ver mais" traz mais esta quantidade). */
const POR_VEZ = 10;
const ROTULO_DO_TIPO = { novo: "Novo", melhoria: "Melhoria" } as const;
const nomeDoMes = (aaaaMm: string) => { const t = new Date(`${aaaaMm}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); return t[0].toUpperCase() + t.slice(1); };

function CartaoNovidade({ n, nova, onAbrirTela }: { n: Novidade; nova: boolean; onAbrirTela: (destino: string) => void }) {
  return (
    <li className={cn("rounded-xl border bg-card p-4 shadow-sm", nova ? "border-primary/40" : "border-border")}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <Avatar autora={n.autora} tamanho="p" />
        <span className="font-medium text-foreground/80">{n.autora}</span>
        <span>· {dataLonga(n.data)}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", n.tipo === "novo" ? "bg-primary/10 text-primary-ink" : "bg-secondary text-foreground/70")}>{ROTULO_DO_TIPO[n.tipo]}</span>
        {n.publico === "dono" && <span className="rounded-md bg-secondary px-1.5 py-0.5 font-medium">Só você vê</span>}
        {nova && <span className="ml-auto inline-flex items-center gap-1 font-medium text-primary-ink"><span className="h-2 w-2 rounded-full bg-primary" aria-hidden />Não lida</span>}
      </div>
      <h4 className="mt-2 text-base font-semibold text-foreground">{n.titulo}</h4>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{n.texto}</p>
      {(n.artigo || n.tela) && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {n.artigo && <button type="button" onClick={() => onAbrirTela(`ajuda/${n.artigo}`)} className={cn("rounded text-sm font-semibold text-primary-ink hover:underline", foco)}>Saiba mais</button>}
          {n.tela && <button type="button" onClick={() => onAbrirTela(n.tela!)} className={cn("rounded text-sm font-semibold text-primary-ink hover:underline", foco)}>Ver na tela</button>}
        </div>
      )}
    </li>
  );
}

/** Novidades: da mais nova para a mais antiga, agrupadas por mês, 10 de cada vez ("Ver mais"); com busca, todos os resultados. As não vistas ficam marcadas enquanto a tela está aberta, e o número do menu some. */
export function NovidadesTab({ onAbrirTela }: { onAbrirTela: (destino: string) => void }) {
  const [lista] = useState(() => novidadesPara(ehDono()));
  const [novas] = useState(() => { const v = new Set(lerVistas()); return new Set(lista.filter((n) => !v.has(n.id)).map((n) => n.id)); });
  const [consulta, setConsulta] = useState("");
  // 10 de cada vez; as não lidas aparecem sempre, mesmo que passem de 10.
  const [quantas, setQuantas] = useState(() => Math.max(POR_VEZ, ...lista.map((n, i) => (novas.has(n.id) ? i + 1 : 0))));
  useEffect(() => { marcarVistas(lista.map((n) => n.id)); }, [lista]);
  const buscando = consulta.trim() !== "";
  const achadas = buscarNovidades(lista, consulta);
  const mostradas = buscando ? achadas : achadas.slice(0, quantas);
  const restantes = achadas.length - mostradas.length;
  const meses = [...new Set(mostradas.map((n) => n.data.slice(0, 7)))];
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SectionTitle level="page" hint="O que mudou no Atlas, do mais novo para o mais antigo.">Novidades</SectionTitle>
      <label className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-ring">
        <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Buscar nas novidades: alerta, metas, celular…"
          aria-label="Buscar nas novidades"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>
      {!achadas.length && <p className="text-sm text-muted-foreground">Nenhuma novidade com "{consulta}". Tente outra palavra.</p>}
      {meses.map((m) => (
        <section key={m} className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{nomeDoMes(m)}</h3>
          <ul className="space-y-3">{mostradas.filter((n) => n.data.startsWith(m)).map((n) => <CartaoNovidade key={n.id} n={n} nova={novas.has(n.id)} onAbrirTela={onAbrirTela} />)}</ul>
        </section>
      ))}
      {restantes > 0 && (
        <button type="button" onClick={() => setQuantas((q) => q + POR_VEZ)} className={cn("w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-primary-ink shadow-sm hover:bg-secondary", foco)}>
          Ver mais novidades ({restantes} {restantes === 1 ? "restante" : "restantes"})
        </button>
      )}
    </div>
  );
}
