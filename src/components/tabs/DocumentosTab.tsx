import { useEffect, useRef, useState } from "react";
import { ChevronRight, Download, Eye, FileText, Folder, FolderPlus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/SectionTitle";
import {
  EXTENSOES, type Arquivo, type DadosDocumentos, type UnidadeDocumentos, apagarDocumento, baixarArquivo, caminhoDaPasta, carregarDocumentos,
  conteudoDaPasta, criarPasta, enviarArquivo, problemaDoArquivo, tamanhoLegivel,
} from "@/lib/documentos";

const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const daParaVer = (a: Arquivo) => a.tipo === "application/pdf" || a.tipo.startsWith("image/");
const campo = "h-9 rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** As unidades da pessoa, com quanto cada uma já guardou. */
export function ListaDeUnidades({ unidades, limite, abrir }: { unidades: UnidadeDocumentos[]; limite: number; abrir: (nome: string) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {unidades.map((u) => (
        <button key={u.nome} type="button" onClick={() => abrir(u.nome)} className="card-surface flex flex-col gap-1.5 px-4 py-3 text-left transition hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex items-center gap-2 text-sm font-semibold"><Folder className="h-4 w-4 text-primary" aria-hidden />{u.nome}</span>
          <span className="text-xs text-muted-foreground">{u.arquivos.length === 0 ? "Nenhum arquivo" : `${u.arquivos.length} ${u.arquivos.length === 1 ? "arquivo" : "arquivos"} · ${tamanhoLegivel(u.usado)} de ${tamanhoLegivel(limite)}`}</span>
        </button>
      ))}
    </div>
  );
}

interface PropsPasta {
  u: UnidadeDocumentos;
  dados: DadosDocumentos;
  pastaId: string | null;
  ocupado: string | null;
  abrirPasta: (id: string | null) => void;
  voltar?: () => void;
  novaPasta: (nome: string) => Promise<boolean>;
  enviar: (arquivos: File[]) => void;
  ver: (a: Arquivo) => void;
  baixar: (a: Arquivo) => void;
  apagar: (id: string, nome: string) => void;
}

/** Uma pasta aberta: caminho, subpastas e arquivos. */
export function PastaAberta({ u, dados, pastaId, ocupado, abrirPasta, voltar, novaPasta, enviar, ver, baixar, apagar }: PropsPasta) {
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const entrada = useRef<HTMLInputElement>(null);
  const caminho = caminhoDaPasta(u.pastas, pastaId);
  const { pastas, arquivos } = conteudoDaPasta(u, pastaId);
  const podeSubpasta = caminho.length < dados.limites.niveis;
  return (
    <div className="space-y-3">
      <nav aria-label="Caminho da pasta" className="flex flex-wrap items-center gap-1 text-sm">
        {voltar && <><button type="button" onClick={voltar} className="text-muted-foreground underline-offset-2 hover:underline">Unidades</button><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /></>}
        <button type="button" onClick={() => abrirPasta(null)} className={caminho.length ? "text-muted-foreground underline-offset-2 hover:underline" : "font-semibold"}>{u.nome}</button>
        {caminho.map((p, i) => (
          <span key={p.id} className="flex items-center gap-1"><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <button type="button" onClick={() => abrirPasta(p.id)} className={i === caminho.length - 1 ? "font-semibold" : "text-muted-foreground underline-offset-2 hover:underline"}>{p.nome}</button></span>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => entrada.current?.click()} disabled={Boolean(ocupado)}><Upload className="mr-1.5 h-4 w-4" aria-hidden />Enviar arquivo</Button>
        <input ref={entrada} type="file" multiple accept={EXTENSOES.join(",")} className="sr-only" aria-label="Escolher arquivos para enviar" tabIndex={-1}
          onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ""; if (f.length) enviar(f); }} />
        {podeSubpasta && !criando && <Button variant="outline" onClick={() => setCriando(true)}><FolderPlus className="mr-1.5 h-4 w-4" aria-hidden />Nova pasta</Button>}
        {criando && (
          <form className="flex items-center gap-2" onSubmit={async (e) => { e.preventDefault(); if (await novaPasta(nome)) { setNome(""); setCriando(false); } }}>
            <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} placeholder="Nome da pasta" aria-label="Nome da pasta" className={campo} />
            <Button type="submit" disabled={!nome.trim()}>Criar</Button>
            <Button type="button" variant="ghost" onClick={() => { setCriando(false); setNome(""); }}>Cancelar</Button>
          </form>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{tamanhoLegivel(u.usado)} de {tamanhoLegivel(dados.limites.unidade)} usados</span>
      </div>
      <p className="text-xs text-muted-foreground">PDF, JPG, PNG, Word ou Excel, até {tamanhoLegivel(dados.limites.arquivo)} cada. Guarde aqui os documentos da unidade; documentos de alunos não entram.</p>
      {ocupado && <p role="status" className="text-sm text-muted-foreground">{ocupado}</p>}

      {pastas.length === 0 && arquivos.length === 0 ? (
        <p className="card-surface px-4 py-8 text-center text-sm text-muted-foreground">Pasta vazia. Envie um arquivo{podeSubpasta ? " ou crie uma pasta (por exemplo, Contrato social)" : ""}.</p>
      ) : (
        <ul className="card-surface divide-y divide-border">
          {pastas.map((p) => (
            <li key={p.id} className="flex items-center gap-2 px-4 py-2.5">
              <button type="button" onClick={() => abrirPasta(p.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
                <Folder className="h-5 w-5 shrink-0 text-primary" aria-hidden /><span className="truncate text-sm font-medium">{p.nome}</span>
              </button>
              {dados.podeApagar && <Button variant="ghost" size="icon" aria-label={`Apagar a pasta ${p.nome}`} onClick={() => apagar(p.id, p.nome)}><Trash2 className="h-4 w-4" aria-hidden /></Button>}
            </li>
          ))}
          {arquivos.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={a.nome}>{a.nome}</p>
                <p className="text-xs text-muted-foreground">{tamanhoLegivel(a.tamanho)} · enviado por {a.enviadoPor} em {dia(a.enviadoEm)}</p>
              </div>
              {daParaVer(a) && <Button variant="ghost" size="icon" aria-label={`Ver ${a.nome}`} onClick={() => ver(a)}><Eye className="h-4 w-4" aria-hidden /></Button>}
              <Button variant="ghost" size="icon" aria-label={`Baixar ${a.nome}`} onClick={() => baixar(a)}><Download className="h-4 w-4" aria-hidden /></Button>
              {dados.podeApagar && <Button variant="ghost" size="icon" aria-label={`Apagar ${a.nome}`} onClick={() => apagar(a.id, a.nome)}><Trash2 className="h-4 w-4" aria-hidden /></Button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DocumentosTab() {
  const [dados, setDados] = useState<DadosDocumentos | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [unidade, setUnidade] = useState<string | null>(null);
  const [pastaId, setPastaId] = useState<string | null>(null);
  const [vendo, setVendo] = useState<{ a: Arquivo; url: string } | null>(null);

  const recarregar = async () => setDados(await carregarDocumentos());
  useEffect(() => { recarregar().catch((e: Error) => setFalha(e.message)); }, []);
  useEffect(() => () => { if (vendo) URL.revokeObjectURL(vendo.url); }, [vendo]);

  /** Faz o pedido mostrando o andamento; em caso de erro, a mensagem fica na tela. */
  const fazer = async (andamento: string, acao: () => Promise<void>) => {
    setErro(null); setOcupado(andamento);
    try { await acao(); return true; }
    catch (e) { setErro(e instanceof Error ? e.message : "Não consegui agora. Tente de novo."); return false; }
    finally { setOcupado(null); }
  };

  const titulo = <SectionTitle level="page">Documentos</SectionTitle>;
  if (falha) return <section className="space-y-4">{titulo}<p className="card-surface p-6 text-sm text-muted-foreground">{falha}</p></section>;
  if (!dados) return <section className="space-y-4">{titulo}<p className="text-sm text-muted-foreground">Carregando os documentos…</p></section>;
  if (dados.unidades.length === 0) return <section className="space-y-4">{titulo}<p className="card-surface p-6 text-sm text-muted-foreground">Nenhuma unidade liberada para você. Fale com o dono do Atlas.</p></section>;

  const so = dados.unidades.length === 1;
  const u = so ? dados.unidades[0] : dados.unidades.find((x) => x.nome === unidade) ?? null;

  const enviar = (u: UnidadeDocumentos, arquivos: File[]) => void fazer("Enviando…", async () => {
    const problemas: string[] = [];
    let usado = u.usado;
    for (const [i, f] of arquivos.entries()) {
      const problema = problemaDoArquivo(f, { ...u, usado }, dados.limites);
      if (problema) { problemas.push(problema); continue; }
      setOcupado(`Enviando ${i + 1} de ${arquivos.length}: ${f.name}`);
      try { await enviarArquivo(u.nome, pastaId, f); usado += f.size; }
      catch (e) { problemas.push(e instanceof Error ? e.message : `Não consegui enviar "${f.name}".`); }
    }
    await recarregar();
    if (problemas.length) throw new Error(problemas.join(" "));
  });
  const ver = (u: UnidadeDocumentos, a: Arquivo) => void fazer("Abrindo…", async () => setVendo({ a, url: URL.createObjectURL(await baixarArquivo(u.nome, a)) }));
  const baixar = (u: UnidadeDocumentos, a: Arquivo) => void fazer("Baixando…", async () => {
    const url = URL.createObjectURL(await baixarArquivo(u.nome, a));
    const link = document.createElement("a");
    link.href = url; link.download = a.nome; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  });
  const apagar = (u: UnidadeDocumentos, id: string, nome: string) => {
    if (!window.confirm(`Apagar "${nome}"? Não dá para desfazer.`)) return;
    void fazer("Apagando…", async () => { await apagarDocumento(u.nome, id); await recarregar(); });
  };

  return (
    <section className="space-y-4">
      {titulo}
      {erro && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
      {!u ? <ListaDeUnidades unidades={dados.unidades} limite={dados.limites.unidade} abrir={(n) => { setUnidade(n); setPastaId(null); setErro(null); }} /> : (
        <PastaAberta key={`${u.nome}/${pastaId}`} u={u} dados={dados} pastaId={pastaId} ocupado={ocupado}
          abrirPasta={(id) => { setPastaId(id); setErro(null); }} voltar={so ? undefined : () => { setUnidade(null); setPastaId(null); setErro(null); }}
          novaPasta={(nome) => fazer("Criando a pasta…", async () => { await criarPasta(u.nome, nome, pastaId); await recarregar(); })}
          enviar={(f) => enviar(u, f)} ver={(a) => ver(u, a)} baixar={(a) => baixar(u, a)} apagar={(id, nome) => apagar(u, id, nome)} />
      )}
      {vendo && u && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 p-3" role="dialog" aria-modal="true" aria-label={vendo.a.nome}>
          <div className="flex h-[92vh] w-full max-w-4xl flex-col rounded-xl border border-border bg-white p-3 shadow-xl">
            <div className="flex items-center gap-2 pb-2">
              <p className="min-w-0 flex-1 truncate text-sm font-semibold">{vendo.a.nome}</p>
              <Button variant="outline" onClick={() => baixar(u, vendo.a)}>Baixar</Button>
              <Button variant="ghost" onClick={() => setVendo(null)}>Fechar</Button>
            </div>
            {vendo.a.tipo.startsWith("image/")
              ? <div className="min-h-0 flex-1 overflow-auto"><img src={vendo.url} alt={vendo.a.nome} className="mx-auto max-w-full" /></div>
              : <iframe src={vendo.url} title={vendo.a.nome} className="min-h-0 w-full flex-1 rounded-md border border-border" />}
          </div>
        </div>
      )}
    </section>
  );
}
