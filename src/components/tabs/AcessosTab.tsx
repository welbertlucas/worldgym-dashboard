import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Copy, KeyRound, ShieldCheck } from "lucide-react";
import { SectionTitle } from "@/components/SectionTitle";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { AUTH_REQUIRED_EVENT, ehDono, getUsuario, logout, precisaDeLogin, type Papel } from "@/lib/auth";
import {
  atualizarAcesso, criarAcesso, criarDono, listarAcessos, lerRegistro, redefinirSenha,
  type EmailDeAcesso, type EntradaRegistro, type UsuarioApi,
} from "@/lib/usuarios";

const NIVEL: Record<Papel, string> = { dono: "Dono", master: "Master", unidades: "Unidades" };
const campo = "h-10 w-full rounded-xl border border-input bg-white px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring";
const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Gestão de acessos: o dono e o Master que ele liberou ("Pode gerenciar acessos"). O servidor confere as mesmas regras. */
export function AcessosTab() {
  const [dados, setDados] = useState<{ usuarios: UsuarioApi[]; unidades: string[]; legado: boolean } | null>(null);
  const [registro, setRegistro] = useState<EntradaRegistro[]>([]);
  const [erro, setErro] = useState("");
  const [senhaNova, setSenhaNova] = useState<{ nome: string; senha: string; email?: EmailDeAcesso } | null>(null);
  const [editando, setEditando] = useState<UsuarioApi | null>(null);

  const carregar = useCallback(async () => {
    const [a, r] = await Promise.all([listarAcessos(), lerRegistro()]);
    if (!a.ok) return setErro(a.erro);
    setErro("");
    setDados(a.dados);
    if (r.ok) setRegistro(r.dados.registro);
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
        <h3 id="ac-lista" className="px-5 pt-5 text-base font-semibold text-foreground">Acessos criados</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm mt-3">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="px-5 py-2 font-medium">Nome</th><th className="px-3 py-2 font-medium">Nível</th><th className="px-3 py-2 font-medium">Unidades</th><th className="px-3 py-2 font-medium">Último acesso</th><th className="px-3 py-2 font-medium">Resumo diário</th><th className="px-5 py-2 font-medium text-right">Ações</th></tr>
            </thead>
            <tbody>
              {dados.usuarios.map((u) => (
                <tr key={u.id} className="border-t border-border align-top">
                  <td className="px-5 py-3"><div className="font-medium text-foreground">{u.nome}{!u.ativo && <span className="ml-2 rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-muted-foreground">Desativado</span>}</div><div className="text-xs text-muted-foreground">{u.email}</div></td>
                  <td className="px-3 py-3">{NIVEL[u.papel]}{u.gerenciaAcessos && <span className="block text-xs text-muted-foreground">Gerencia acessos</span>}</td>
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
                        <Button variant="outline" size="sm" onClick={() => setEditando(u)}>Editar</Button>
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
      </section>

      <section aria-labelledby="ac-form" className="card-surface p-5">
        <h3 id="ac-form" className="text-base font-semibold text-foreground">{editando ? `Editar ${editando.nome}` : "Novo acesso"}</h3>
        <FormularioAcesso
          key={editando?.id ?? "novo"}
          unidades={dados.unidades}
          inicial={editando}
          podeLiberar={souDono}
          onCancelar={editando ? () => setEditando(null) : undefined}
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
            }
            void carregar();
            return null;
          }}
        />
      </section>

      <section aria-labelledby="ac-reg" className="card-surface p-5">
        <h3 id="ac-reg" className="text-base font-semibold text-foreground">Entradas recentes</h3>
        <p className="text-sm text-muted-foreground mt-1">Cada vez que alguém digita a senha (o login cai depois de 12 horas sem uso; quem usa todo dia não precisa entrar de novo). Mostra também senhas erradas de e-mails cadastrados.</p>
        {registro.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Ninguém entrou ainda.</p> : (
          <ul className="mt-4 divide-y divide-border text-sm">
            {registro.slice(0, 50).map((e, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-foreground">{e.nome ?? e.email}{e.nome && <span className="text-muted-foreground"> · {e.email}</span>}</span>
                <span className="flex items-center gap-3 text-muted-foreground tabular-nums">
                  <span className={e.ok ? "" : "font-medium text-destructive"}>{e.ok ? "Entrou" : "Senha errada"}</span>
                  {quando(e.em)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FormularioAcesso({ unidades, inicial, podeLiberar, onSalvar, onCancelar }: {
  unidades: string[];
  inicial: UsuarioApi | null;
  /** Só o dono vê a opção "Pode gerenciar acessos". */
  podeLiberar: boolean;
  onSalvar: (v: { nome: string; email: string; papel: Papel; unidades: string[]; resumo: boolean; gerenciaAcessos?: boolean }) => Promise<string | null>;
  onCancelar?: () => void;
}) {
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [email, setEmail] = useState(inicial?.email ?? "");
  const [papel, setPapel] = useState<Papel>(inicial?.papel ?? "master");
  const [marcadas, setMarcadas] = useState<string[]>(inicial?.unidades ?? []);
  const [resumo, setResumo] = useState(inicial?.resumo !== false);
  const [gerencia, setGerencia] = useState(inicial?.gerenciaAcessos === true);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const alternar = (u: string) => setMarcadas((m) => (m.includes(u) ? m.filter((x) => x !== u) : [...m, u]));
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    const r = await onSalvar({ nome, email, papel, unidades: papel === "unidades" ? marcadas : [], resumo, ...(podeLiberar ? { gerenciaAcessos: papel === "master" && gerencia } : {}) });
    setEnviando(false);
    if (r) return setErro(r);
    if (!inicial) { setNome(""); setEmail(""); setMarcadas([]); setPapel("master"); setResumo(true); setGerencia(false); }
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
