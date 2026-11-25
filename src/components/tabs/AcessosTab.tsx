import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Copy, KeyRound, Search, ShieldCheck } from "lucide-react";
import { nomeDaTela, normalizar } from "@/components/nav";
import { formatMonthLong } from "@/data/periods";
import { SectionTitle } from "@/components/SectionTitle";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { AUTH_REQUIRED_EVENT, ehDono, getUsuario, logout, precisaDeLogin, type Papel } from "@/lib/auth";
import {
  atualizarAcesso, criarAcesso, criarDono, listarAcessos, lerAtividade, lerRegistro, redefinirSenha,
  type EmailDeAcesso, type EntradaAtividade, type EntradaRegistro, type UsuarioApi,
} from "@/lib/usuarios";

const NIVEL: Record<Papel, string> = { dono: "Dono", master: "Master", unidades: "Unidades" };
const campo = "h-10 w-full rounded-xl border border-input bg-white px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring";
export { nomeDaTela };

/** Acessos mostrados de cada vez (o botão "Ver mais" traz mais esta quantidade). */
export const ACESSOS_POR_VEZ = 10;
/** Busca na lista de acessos: todas as palavras precisam aparecer no nome, e-mail, nível ou unidades (sem acento). */
export function filtrarAcessos(lista: UsuarioApi[], consulta: string): UsuarioApi[] {
  const termos = normalizar(consulta).split(/\s+/).filter(Boolean);
  if (!termos.length) return lista;
  return lista.filter((u) => { const tudo = normalizar(`${u.nome} ${u.email} ${NIVEL[u.papel]} ${u.unidades.join(" ")}`); return termos.every((t) => tudo.includes(t)); });
}

const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Gestão de acessos: o dono e o Master que ele liberou ("Pode gerenciar acessos"). O servidor confere as mesmas regras. */
export function AcessosTab() {
  const [dados, setDados] = useState<{ usuarios: UsuarioApi[]; unidades: string[]; legado: boolean } | null>(null);
  const [registro, setRegistro] = useState<EntradaRegistro[]>([]);
  const [atividade, setAtividade] = useState<EntradaAtividade[]>([]);
  const [detalhe, setDetalhe] = useState<UsuarioApi | null>(null);
  const [erro, setErro] = useState("");
  const [senhaNova, setSenhaNova] = useState<{ nome: string; senha: string; email?: EmailDeAcesso } | null>(null);
  const [editando, setEditando] = useState<UsuarioApi | null>(null);
  /** Acesso usado como modelo: o formulário abre com o mesmo nível, unidades e menus, e só nome e e-mail ficam em branco. */
  const [modelo, setModelo] = useState<UsuarioApi | null>(null);
  const [consulta, setConsulta] = useState("");
  const [quantos, setQuantos] = useState(ACESSOS_POR_VEZ);
  const [ordem, setOrdem] = useState<"nome" | "recentes" | "antigos">("nome");

  const carregar = useCallback(async () => {
    const [a, r, at] = await Promise.all([listarAcessos(), lerRegistro(), ehDono() ? lerAtividade() : Promise.resolve(null)]);
    if (!a.ok) return setErro(a.erro);
    setErro("");
    setDados(a.dados);
    if (r.ok) setRegistro(r.dados.registro);
    if (at?.ok) setAtividade(at.dados.atividade);
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const ultimoAcesso = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of registro) if (e.ok && !m.has(e.email)) m.set(e.email, e.em); // registro vem do mais novo para o mais velho
    return m;
  }, [registro]);


  if (erro) return <div><SectionTitle level="page">Acessos</SectionTitle><Notice>{erro}</Notice></div>;
  if (!dados) return <div><SectionTitle level="page">Acessos</SectionTitle><p className="text-sm text-muted-foreground">Carregando...</p></div>;
  if (dados.legado) return <PrimeiroDono />;

  // 10 de cada vez ("Ver mais"); com busca, todos os encontrados.
  const filtrados = filtrarAcessos(dados.usuarios, consulta);
  // "Último acesso": do mais recente para o mais antigo (quem nunca entrou fica no fim); "Mais antigos" inverte, com quem nunca entrou primeiro.
  const quandoFoi = (u: UsuarioApi) => { const e = ultimoAcesso.get(u.email); return e ? Date.parse(e) : null; };
  const achados = ordem === "nome" ? filtrados : [...filtrados].sort((a, b) => {
    const x = quandoFoi(a), y = quandoFoi(b);
    if (x === y) return 0;
    if (x === null) return ordem === "recentes" ? 1 : -1;
    if (y === null) return ordem === "recentes" ? -1 : 1;
    return ordem === "recentes" ? y - x : x - y;
  });
  const mostrados = consulta.trim() ? achados : achados.slice(0, quantos);
  const restantes = achados.length - mostrados.length;
  const mostrarSenha = (nome: string, senha: string, email?: EmailDeAcesso) => setSenhaNova({ nome, senha, email });
  const souDono = ehDono();
  const meuEmail = getUsuario()?.email ?? "";
  /** Por que esta linha não pode ser alterada por quem está vendo (null = pode). Espelha conferirAtor do servidor. */
  const bloqueio = (u: UsuarioApi): string | null => {
    if (u.papel === "dono") return souDono ? "Você" : "Dono";
    if (u.email === meuEmail) return "Você";
    if (!souDono && u.gerenciaAcessos) return "Só o dono altera";
    return null;
  };

  return (
    <div className="space-y-8">
      <SectionTitle level="page" hint={souDono ? "Quem pode entrar no Atlas, com que nível e em quais unidades. Só você e quem você liberar para gerenciar acessos veem esta tela." : "Quem pode entrar no Atlas, com que nível e em quais unidades. O dono liberou você para criar e alterar acessos."}>Acessos</SectionTitle>

      {senhaNova && (
        <div role="status" className="card-surface border-primary/40 p-5 space-y-3">
          {senhaNova.email?.enviado ? (
            <p className="text-sm text-foreground">Enviamos a senha provisória de <b>{senhaNova.nome}</b> para <b>{senhaNova.email.para}</b>. Se não chegar em alguns minutos, confira se o e-mail está certo e peça para olhar o spam. A senha aparece só agora, caso precise mandar por outro canal.</p>
          ) : (
            <p className="text-sm text-foreground">
              Senha provisória de <b>{senhaNova.nome}</b>. Ela aparece só agora: copie e envie para a pessoa por um canal seguro.
              {senhaNova.email && <span className="block mt-1 text-destructive">O e-mail para {senhaNova.email.para} não saiu{senhaNova.email.erro ? ` (${senhaNova.email.erro})` : ""}.</span>}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <code className="rounded-lg bg-secondary px-3 py-2 text-base font-semibold tracking-wider select-all">{senhaNova.senha}</code>
            <Button variant="outline" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(senhaNova.senha); toast({ title: "Senha copiada" }); } catch { toast({ title: "Não consegui copiar", description: "Selecione a senha e copie à mão.", variant: "destructive" }); } }}>
              <Copy className="w-4 h-4" aria-hidden /> Copiar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSenhaNova(null)}>{senhaNova.email?.enviado ? "Fechar" : "Já enviei"}</Button>
          </div>
        </div>
      )}

      <section aria-labelledby="ac-lista" className="card-surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <h3 id="ac-lista" className="text-base font-semibold text-foreground">Acessos criados <span className="font-normal text-muted-foreground">({dados.usuarios.length})</span></h3>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">Ordenar por
            <select value={ordem} onChange={(e) => { setOrdem(e.target.value as typeof ordem); setQuantos(ACESSOS_POR_VEZ); }} aria-label="Ordenar acessos" className="h-9 rounded-xl border border-input bg-white px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="nome">Nome</option>
              <option value="recentes">Último acesso (mais recente)</option>
              <option value="antigos">Último acesso (mais antigo)</option>
            </select>
          </label>
          <label className="flex w-full max-w-xs items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-ring">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
            <input type="search" value={consulta} onChange={(e) => setConsulta(e.target.value)} placeholder="Buscar por nome, e-mail ou unidade" aria-label="Buscar acessos" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm mt-3">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="px-5 py-2 font-medium">Nome</th><th className="px-3 py-2 font-medium">Nível</th><th className="px-3 py-2 font-medium">Unidades</th><th className="px-3 py-2 font-medium">Último acesso</th><th className="px-3 py-2 font-medium">Resumo diário</th><th className="px-5 py-2 font-medium text-right">Ações</th></tr>
            </thead>
            <tbody>
              {mostrados.map((u) => (
                <tr key={u.id} className="border-t border-border align-top">
                  <td className="px-5 py-3"><div className="font-medium text-foreground"><button type="button" onClick={() => setDetalhe(u)} className="text-left underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded" title="Ver último acesso e histórico">{u.nome}</button>{!u.ativo && <span className="ml-2 rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-muted-foreground">Desativado</span>}</div><div className="text-xs text-muted-foreground">{u.email}</div></td>
                  <td className="px-3 py-3">{NIVEL[u.papel]}{u.gerenciaAcessos && <span className="block text-xs text-muted-foreground">Gerencia acessos</span>}{u.geraRelatorios && <span className="block text-xs text-muted-foreground">Gera relatórios</span>}{u.papel === "unidades" && u.verRoyalties && <span className="block text-xs text-muted-foreground">Vê royalties</span>}{u.papel === "unidades" && u.verJuridico && <span className="block text-xs text-muted-foreground">Vê jurídico</span>}{u.papel !== "dono" && u.verQualidade && <span className="block text-xs text-muted-foreground">Edita qualidade</span>}{u.papel === "unidades" && u.preencheChecklist && <span className="block text-xs text-muted-foreground">Preenche checklist</span>}{u.verEstudos && <span className="block text-xs text-muted-foreground">Faz estudos de ponto</span>}{u.verObras && <span className="block text-xs text-muted-foreground">Vê unidades em obra</span>}</td>
                  <td className="px-3 py-3 text-muted-foreground" title={u.unidades.join(", ")}>{u.papel === "unidades" ? `${u.unidades.length} ${u.unidades.length === 1 ? "unidade" : "unidades"}` : "Todas"}</td>
                  <td className="px-3 py-3 text-muted-foreground tabular-nums">{ultimoAcesso.has(u.email) ? quando(ultimoAcesso.get(u.email)!) : "Nunca entrou"}</td>
                  <td className="px-3 py-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground" title={u.ativo ? undefined : "Acesso desativado não recebe o resumo"}>
                      <input
                        type="checkbox"
                        checked={u.resumo !== false && u.ativo}
                        disabled={!u.ativo || (!souDono && (u.papel === "dono" || (u.gerenciaAcessos && u.email !== meuEmail)))}
                        aria-label={`${u.nome} recebe o resumo diário por e-mail`}
                        onChange={async (e) => {
                          const r = await atualizarAcesso(u.id, { resumo: e.target.checked });
                          if (r.ok) { toast({ title: e.target.checked ? `${u.nome} volta a receber o resumo` : `${u.nome} não recebe mais o resumo` }); void carregar(); }
                          else toast({ title: "Não consegui atualizar", description: r.erro, variant: "destructive" });
                        }}
                        className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))] disabled:opacity-40"
                      />
                      {u.resumo !== false && u.ativo ? "Recebe" : "Não recebe"}
                    </label>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {bloqueio(u) ? <span className="text-xs text-muted-foreground">{bloqueio(u)}</span> : (
                      <span className="flex flex-wrap justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setModelo(null); setEditando(u); }}>Editar</Button>
                        {souDono && u.papel !== "dono" && <Button variant="outline" size="sm" onClick={() => { setEditando(null); setModelo(u); document.getElementById("ac-form")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><Copy className="w-3.5 h-3.5" aria-hidden /> Replicar</Button>}
                        <Button variant="outline" size="sm" onClick={async () => {
                          if (!window.confirm(`Gerar uma nova senha para ${u.nome}? A senha atual deixa de valer e a nova vai para ${u.email}.`)) return;
                          const r = await redefinirSenha(u.id);
                          if (r.ok) mostrarSenha(u.nome, r.dados.senhaProvisoria, r.dados.email); else toast({ title: "Não consegui redefinir", description: r.erro, variant: "destructive" });
                        }}><KeyRound className="w-3.5 h-3.5" aria-hidden /> Nova senha</Button>
                        <Button variant="ghost" size="sm" onClick={async () => {
                          if (u.ativo && !window.confirm(`Desativar o acesso de ${u.nome}? A pessoa perde o acesso em até 1 minuto.`)) return;
                          const r = await atualizarAcesso(u.id, { ativo: !u.ativo });
                          if (r.ok) void carregar(); else toast({ title: "Não consegui atualizar", description: r.erro, variant: "destructive" });
                        }}>{u.ativo ? "Desativar" : "Reativar"}</Button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!achados.length && <p className="px-5 pb-5 text-sm text-muted-foreground">Nenhum acesso com "{consulta}".</p>}
        {restantes > 0 && (
          <div className="border-t border-border px-5 py-3">
            <Button variant="outline" size="sm" className="w-full" onClick={() => setQuantos((q) => q + ACESSOS_POR_VEZ)}>
              Ver mais acessos ({restantes} {restantes === 1 ? "restante" : "restantes"})
            </Button>
          </div>
        )}
      </section>

      <section aria-labelledby="ac-form" className="card-surface p-5">
        <h3 id="ac-form" className="text-base font-semibold text-foreground">{editando ? `Editar ${editando.nome}` : modelo ? `Novo acesso, igual ao de ${modelo.nome}` : "Novo acesso"}</h3>
        {modelo && !editando && <p className="mt-1 text-sm text-muted-foreground">Nível, unidades e menus vieram de {modelo.nome}. Altere o que quiser antes de criar e preencha o nome e o e-mail da pessoa nova.</p>}
        <FormularioAcesso
          key={editando?.id ?? (modelo ? `copia-${modelo.id}` : "novo")}
          unidades={dados.unidades}
          inicial={editando}
          semente={editando ? null : modelo}
          podeLiberar={souDono}
          onCancelar={editando ? () => setEditando(null) : modelo ? () => setModelo(null) : undefined}
          onSalvar={async (v) => {
            if (editando) {
              const r = await atualizarAcesso(editando.id, v);
              if (!r.ok) return r.erro;
              toast({ title: "Acesso atualizado" });
              setEditando(null);
            } else {
              const r = await criarAcesso(v);
              if (!r.ok) return r.erro;
              mostrarSenha(r.dados.usuario.nome, r.dados.senhaProvisoria, r.dados.email);
              setModelo(null);
            }
            void carregar();
            return null;
          }}
        />
      </section>

      {detalhe && (
        <DetalheDoAcesso
          usuario={detalhe}
          entradas={registro.filter((e) => e.email === detalhe.email)}
          atividade={souDono ? atividade.filter((e) => e.usuarioId === detalhe.id) : null}
          onFechar={() => setDetalhe(null)}
        />
      )}
    </div>
  );
}

function FormularioAcesso({ unidades, inicial, semente = null, podeLiberar, onSalvar, onCancelar }: {
  unidades: string[];
  inicial: UsuarioApi | null;
  /** Acesso replicado: preenche tudo, menos nome e e-mail, e o formulário continua sendo de criação. */
  semente?: UsuarioApi | null;
  /** Só o dono vê a opção "Pode gerenciar acessos". */
  podeLiberar: boolean;
  onSalvar: (v: { nome: string; email: string; papel: Papel; unidades: string[]; resumo: boolean; gerenciaAcessos?: boolean; geraRelatorios?: boolean; verRoyalties?: boolean; verJuridico?: boolean; verQualidade?: boolean; preencheChecklist?: boolean; verEstudos?: boolean; verObras?: boolean; verEscalas?: boolean }) => Promise<string | null>;
  onCancelar?: () => void;
}) {
  const base = inicial ?? semente;
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [email, setEmail] = useState(inicial?.email ?? "");
  const [papel, setPapel] = useState<Papel>(base?.papel ?? "master");
  const [marcadas, setMarcadas] = useState<string[]>(base?.unidades ?? []);
  const [resumo, setResumo] = useState(base?.resumo !== false);
  const [gerencia, setGerencia] = useState(base?.gerenciaAcessos === true);
  const [relatorios, setRelatorios] = useState(base?.geraRelatorios === true);
  const [royalties, setRoyalties] = useState(base?.papel === "unidades" && base?.verRoyalties === true);
  const [juridico, setJuridico] = useState(base?.verJuridico === true);
  const [qualidade, setQualidade] = useState(base?.verQualidade === true);
  const [preenche, setPreenche] = useState(base?.papel === "unidades" && base?.preencheChecklist === true);
  const [estudos, setEstudos] = useState(base?.verEstudos === true);
  const [obras, setObras] = useState(base?.verObras === true);
  const [escalas, setEscalas] = useState(base?.papel === "unidades" && base?.verEscalas === true);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const alternar = (u: string) => setMarcadas((m) => (m.includes(u) ? m.filter((x) => x !== u) : [...m, u]));
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    const r = await onSalvar({ nome, email, papel, unidades: papel === "unidades" ? marcadas : [], resumo, ...(podeLiberar ? { gerenciaAcessos: papel === "master" && gerencia, geraRelatorios: relatorios, verRoyalties: papel === "unidades" && royalties, verJuridico: juridico, verQualidade: qualidade, preencheChecklist: papel === "unidades" && preenche, verEstudos: estudos, verObras: obras, verEscalas: papel === "unidades" && escalas } : {}) });
    setEnviando(false);
    if (r) return setErro(r);
    if (!inicial) { setNome(""); setEmail(""); setMarcadas([]); setPapel("master"); setResumo(true); setGerencia(false); setRelatorios(false); setJuridico(false); setQualidade(false); setPreenche(false); setEstudos(false); setObras(false); }
  };

  return (
    <form onSubmit={enviar} className="mt-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="space-y-1.5 text-sm font-medium text-foreground">Nome<input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={80} autoComplete="off" /></label>
        <label className="space-y-1.5 text-sm font-medium text-foreground">E-mail<input className={campo} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" /></label>
        <label className="space-y-1.5 text-sm font-medium text-foreground">Nível
          <Select value={papel} onChange={(e) => setPapel(e.target.value as Papel)}>
            <option value="master">Master</option>
            <option value="unidades">Unidades</option>
          </Select>
        </label>
      </div>
      <p className="text-xs text-muted-foreground">{papel === "master" ? `Master vê todos os dados da rede, mas não atualiza da planilha${podeLiberar ? " e só cria acessos se você liberar abaixo." : " nem cria acessos."}` : "Unidades vê só as unidades escolhidas abaixo; as outras aparecem apenas no benchmark, com o nome escondido."}</p>
      {papel === "unidades" && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">Unidades que a pessoa enxerga <span className="font-normal text-muted-foreground">({marcadas.length} de {unidades.length})</span></legend>
          <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {unidades.map((u) => (
              <label key={u} className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={marcadas.includes(u)} onChange={() => alternar(u)} className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
                {u}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={resumo} onChange={(e) => setResumo(e.target.checked)} className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
        Recebe o resumo diário por e-mail (às 6h47, com os números de ontem {papel === "unidades" ? "das unidades marcadas" : "da rede"})
      </label>
      {podeLiberar && papel === "master" && (
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input type="checkbox" checked={gerencia} onChange={(e) => setGerencia(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
          <span>Pode gerenciar acessos <span className="block text-xs text-muted-foreground">Cria, edita e desativa acessos e gera senhas novas. Não mexe na sua conta, não cria outro dono e não passa esta permissão adiante.</span></span>
        </label>
      )}
      {podeLiberar && papel === "unidades" && (
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input type="checkbox" checked={relatorios} onChange={(e) => setRelatorios(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
          <span>Pode gerar relatórios <span className="block text-xs text-muted-foreground">Mostra o menu Relatórios, onde a pessoa monta e baixa a apresentação (.pptx) dos dados que ela já enxerga. Cada download fica no registro de atividades. Todo Master já vê esse menu.</span></span>
        </label>
      )}
      {podeLiberar && papel === "unidades" && (
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input type="checkbox" checked={royalties} onChange={(e) => setRoyalties(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
          <span>Pode ver royalties <span className="block text-xs text-muted-foreground">Mostra o menu Royalties, com os recebimentos da marca de toda a rede. Dono e Master já veem; quem tem acesso só a unidades precisa desta liberação.</span></span>
        </label>
      )}
      {podeLiberar && papel === "unidades" && (
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input type="checkbox" checked={juridico} onChange={(e) => setJuridico(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
          <span>Pode ver jurídico <span className="block text-xs text-muted-foreground">Mostra o menu Jurídico, com os processos judiciais e extrajudiciais da rede. Dono e Master já veem (só consulta); quem tem acesso a unidades precisa desta liberação.</span></span>
        </label>
      )}
      {podeLiberar && (
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input type="checkbox" checked={qualidade} onChange={(e) => setQualidade(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
          <span>Pode editar a qualidade <span className="block text-xs text-muted-foreground">Deixa a pessoa criar checklists e registrar visitas às unidades (com check-in, fotos e assinatura). Dono e Master já veem o menu Qualidade e aplicam os checklists (Nova visita); só quem tem esta liberação edita. Quem tem acesso a unidades também passa a ver tudo com esta liberação.</span></span>
        </label>
      )}
      {podeLiberar && papel === "unidades" && (
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input type="checkbox" checked={preenche} onChange={(e) => setPreenche(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
          <span>Pode preencher o checklist da unidade <span className="block text-xs text-muted-foreground">Mostra o menu Qualidade só com o checklist de abertura da própria unidade, para preencher pelo celular com fotos. A pessoa não vê as visitas, as notas nem as outras unidades.</span></span>
        </label>
      )}
      {podeLiberar && (
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input type="checkbox" checked={estudos} onChange={(e) => setEstudos(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
          <span>Pode fazer estudos de ponto <span className="block text-xs text-muted-foreground">Cria e decide estudos de pontos novos. Sem esta liberação, quem tem acesso a unidades vê só o estudo da própria unidade, e o Master consulta tudo sem editar.</span></span>
        </label>
      )}
      {podeLiberar && papel === "unidades" && (
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input type="checkbox" checked={escalas} onChange={(e) => setEscalas(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
          <span>Pode usar o Gerador de Escalas <span className="block text-xs text-muted-foreground">Mostra o menu Gerador de Escalas, só com as unidades marcadas acima. O Master e o dono sempre usam.</span></span>
        </label>
      )}
      {podeLiberar && (
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input type="checkbox" checked={obras} onChange={(e) => setObras(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
          <span>Pode ver unidades em obra <span className="block text-xs text-muted-foreground">Mostra o menu Unidades em obra, que ainda está "Em breve". Só o dono vê sem esta liberação.</span></span>
        </label>
      )}
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={enviando}><ShieldCheck className="w-4 h-4" aria-hidden />{enviando ? "Salvando..." : inicial ? "Salvar alterações" : "Criar acesso"}</Button>
        {onCancelar && <Button type="button" variant="ghost" onClick={onCancelar}>Cancelar</Button>}
      </div>
      {!inicial && <p className="text-xs text-muted-foreground">O sistema gera uma senha provisória, manda para o e-mail da pessoa e mostra uma vez aqui. Se ela esquecer, dá para gerar outra em "Nova senha" (sai um e-mail novo).</p>}
    </form>
  );
}

/** Transição: enquanto só existe a senha única de antes, o dono cria a própria conta (e-mail + senha). */
function PrimeiroDono() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (senha !== confirma) return setErro("As duas senhas não são iguais.");
    setEnviando(true);
    setErro("");
    const r = await criarDono({ nome, email, senha });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    toast({ title: "Conta criada", description: "Entre agora com o seu e-mail e a senha nova." });
    logout();
    await precisaDeLogin(); // passa a pedir e-mail na tela de entrada
    window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
  };

  return (
    <div className="max-w-xl space-y-5">
      <SectionTitle level="page" hint="O Atlas ainda usa uma senha única para todos. Crie a sua conta de dono para poder dar acessos separados.">Acessos</SectionTitle>
      <form onSubmit={enviar} className="card-surface p-5 space-y-4">
        <h3 className="text-base font-semibold text-foreground">Crie a sua conta de dono</h3>
        <label className="block space-y-1.5 text-sm font-medium text-foreground">Nome<input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} required autoComplete="name" /></label>
        <label className="block space-y-1.5 text-sm font-medium text-foreground">E-mail<input className={campo} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" /></label>
        <label className="block space-y-1.5 text-sm font-medium text-foreground">Senha (mínimo 10 caracteres)<input className={campo} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={10} autoComplete="new-password" /></label>
        <label className="block space-y-1.5 text-sm font-medium text-foreground">Repita a senha<input className={campo} type="password" value={confirma} onChange={(e) => setConfirma(e.target.value)} required minLength={10} autoComplete="new-password" /></label>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <Notice>Depois de criar, a senha única de antes deixa de valer e todo mundo precisa entrar com e-mail e senha. Você entra primeiro, com a conta nova.</Notice>
        <Button type="submit" disabled={enviando}>{enviando ? "Criando..." : "Criar conta de dono"}</Button>
      </form>
    </div>
  );
}

/** Quando a pessoa entrou e o que fez: as entradas (e senhas erradas) e, só para o dono, as telas abertas e exportações. */
export function DetalheDoAcesso({ usuario, entradas, atividade, onFechar }: { usuario: UsuarioApi; entradas: EntradaRegistro[]; atividade: EntradaAtividade[] | null; onFechar: () => void }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onFechar]);
  const ultima = entradas.find((e) => e.ok);
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6" onClick={onFechar}>
      <div role="dialog" aria-modal="true" aria-labelledby="ac-det" onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-background p-5 shadow-xl sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="ac-det" className="text-lg font-semibold text-foreground">{usuario.nome}</h3>
            <p className="text-sm text-muted-foreground">{usuario.email} · {NIVEL[usuario.papel]}{usuario.papel === "unidades" ? ` · ${usuario.unidades.join(", ")}` : ""}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onFechar}>Fechar</Button>
        </div>
        <p className="mt-4 text-sm text-foreground">
          Último acesso: <b>{ultima ? quando(ultima.em) : "nunca entrou"}</b>
        </p>

        <h4 className="mt-5 text-sm font-semibold text-foreground">Entradas recentes</h4>
        <p className="text-xs text-muted-foreground">Cada vez que a pessoa digitou a senha, as senhas erradas e os pedidos de nova senha por e-mail. Guardamos 90 dias.</p>
        {entradas.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nenhuma entrada registrada.</p> : (
          <ul className="mt-2 divide-y divide-border text-sm">
            {entradas.slice(0, 15).map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-1.5">
                <span className={e.ok || e.evento ? "text-foreground" : "font-medium text-destructive"}>
                  {e.evento === "redefinicao-pedida" ? "Pediu link para nova senha" : e.evento === "senha-redefinida" ? "Criou nova senha pelo link" : e.ok ? "Entrou" : "Senha errada"}
                </span>
                <span className="text-muted-foreground tabular-nums">{quando(e.em)}</span>
              </li>
            ))}
          </ul>
        )}

        {atividade && (
          <>
            <h4 className="mt-5 text-sm font-semibold text-foreground">Telas abertas e exportações</h4>
            <p className="text-xs text-muted-foreground">Com a unidade e o mês que a pessoa estava vendo, nos últimos 7 dias. Só você, como dono, vê esta parte. Quando você usa "ver como", não entra aqui.</p>
            {atividade.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nenhuma atividade registrada nos últimos 7 dias.</p> : (
              <ul className="mt-2 divide-y divide-border text-sm">
                {atividade.slice(0, 40).map((e, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-1.5">
                    <span className="text-foreground">
                      <span className="text-muted-foreground">{e.evento === "exportar" ? "Exportou " : "Abriu "}</span>
                      <span className={e.evento === "exportar" ? "font-medium" : ""}>{nomeDaTela(e.tela)}</span>
                      {e.mes && <span className="text-muted-foreground"> · {e.unidade ?? "Rede"} · {formatMonthLong(e.mes)}</span>}
                    </span>
                    <span className="text-muted-foreground tabular-nums">{quando(e.em)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
