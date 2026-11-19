import { useState, type FormEvent } from "react";
import { Globo } from "@/components/Globo";
import { Ceu } from "@/components/Ceu";
import { Abertura, seguirComAbeturaAzul } from "@/components/Abertura";
import { entrar, loginComEmail, pedirRedefinicaoDeSenha, redefinirSenhaComLink } from "@/lib/auth";
import { motivoLocal } from "@/components/TrocarSenha";

const ENTRANDO_MIN_MS = 1500;

// Visual dos campos e botões, o mesmo nas três telas (entrar, esqueci a senha, nova senha).
const CAMPO = "login-campo flex items-stretch overflow-hidden rounded-[14px] border-[1.5px] border-[#DCDFE3] bg-[#F7F8F9] transition-[border-color,box-shadow,background-color] duration-150 focus-within:border-[#C41230] focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(196,18,48,0.13)]";
const ENTRADA = "min-w-0 flex-1 border-0 bg-transparent px-[1.1rem] py-4 text-[1.05rem] text-black outline-none";
const BOTAO = "mt-5 rounded-[14px] bg-[linear-gradient(#D0183A,#B10F2B)] p-[1.05rem] font-['Montserrat'] text-base font-bold text-white shadow-[0_10px_24px_-12px_rgba(196,18,48,0.75),inset_0_1px_0_rgba(255,255,255,0.18)] transition-[filter,opacity] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C41230] disabled:opacity-60";
const TITULO = "mb-2 text-balance font-['Montserrat'] text-[clamp(1.75rem,2.4vw,2.1rem)] font-extrabold leading-[1.2] tracking-[-0.025em] text-black";
const LINK = "text-[0.88rem] font-semibold text-[#6B7078] underline-offset-2 hover:text-[#C41230] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C41230]";

type Modo = "entrar" | "esqueci" | "redefinir";

export function Login({ onEntrou, tokenRedefinir = null }: { onEntrou: () => void; tokenRedefinir?: string | null }) {
  const comEmail = loginComEmail(); // só depois que o dono cria os acessos; antes vale a senha única
  const [modo, setModo] = useState<Modo>(tokenRedefinir ? "redefinir" : "entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!senha || (comEmail && !email.trim()) || enviando) return;
    setEnviando(true);
    setErro("");
    const inicio = Date.now();
    const r = await entrar(senha, email);
    if (r.ok) {
      // A tela de carregar fica por pelo menos um instante (não pisca) e segue azul até o painel aparecer.
      seguirComAbeturaAzul(true);
      await new Promise((ok) => setTimeout(ok, Math.max(0, ENTRANDO_MIN_MS - (Date.now() - inicio))));
      onEntrou();
      return;
    }
    setEnviando(false);
    setErro(r.erro);
  };

  return (
    <>
    {enviando && <Abertura azul mensagem="Entrando no Atlas" />}
    <main className="grid min-h-screen bg-white lg:grid-cols-[minmax(0,1fr)_28rem]">
      {/* Céu: noite azul-marinho, como o céu de verdade. O globo do logo da World Gym ocupa o centro. */}
      <section className="relative isolate flex min-h-[46vh] flex-col overflow-hidden bg-[#050B22] p-[clamp(1.75rem,4vw,3.25rem)] text-white">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(130%_90%_at_30%_115%,#21398A_0%,#152A6A_26%,#0C1A4C_52%,#061030_76%,#030819_100%)]" />
        <Ceu className="absolute inset-0 -z-10" />
        <h1 className="relative z-10 font-['Cinzel'] uppercase leading-none">
          <span className="mb-2 block text-[clamp(0.85rem,1.15vw,1rem)] font-medium tracking-[0.42em] text-white/80">World Gym</span>
          <span className="flex items-center gap-3 text-[clamp(2.1rem,3.2vw,2.9rem)] font-bold tracking-[0.12em]">
            Atlas
            <span className="rounded-full border border-white/40 px-2.5 py-0.5 font-['Montserrat'] text-[0.7rem] font-semibold tracking-[0.2em] text-white/85">BETA</span>
          </span>
        </h1>
        <div className="flex flex-1 items-center justify-center py-10 lg:absolute lg:inset-0 lg:py-0">
          <Globo className="w-[min(60%,460px,58vh)]" />
        </div>
      </section>

      {/* Painel de entrada no mesmo padrão do gerador de escalas da World Gym. */}
      <section className="flex flex-col items-center justify-center px-6 py-10 lg:px-8">
        {modo === "esqueci" && <EsqueciSenha emailInicial={email} onVoltar={() => setModo("entrar")} />}
        {modo === "redefinir" && tokenRedefinir && <NovaSenha token={tokenRedefinir} onEntrar={() => setModo("entrar")} onPedirNovo={() => setModo("esqueci")} />}
        {modo === "entrar" && (
        <form onSubmit={enviar} className="my-auto flex w-full max-w-[380px] flex-col">
          <h2 className="mb-2 text-balance font-['Montserrat'] text-[clamp(1.75rem,2.4vw,2.1rem)] font-extrabold leading-[1.2] tracking-[-0.025em] text-black">
            Entrar no Atlas
          </h2>
          <p className="mb-2 leading-normal text-[#6B7078]">{comEmail ? "Entre com o seu e-mail e a senha de acesso." : "Digite a senha de acesso para ver os resultados da rede."}</p>
          <p className="mb-8 text-sm leading-normal text-[#6B7078]">O Atlas está em fase beta: continua evoluindo e pode ter ajustes e pequenas falhas.</p>

          {comEmail && (
            <label className="mb-4 flex flex-col gap-2">
              <span className="text-[0.88rem] font-semibold text-black">E-mail</span>
              <span className="login-campo flex items-stretch overflow-hidden rounded-[14px] border-[1.5px] border-[#DCDFE3] bg-[#F7F8F9] transition-[border-color,box-shadow,background-color] duration-150 focus-within:border-[#C41230] focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(196,18,48,0.13)]">
                <input
                  type="email"
                  autoComplete="username"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="min-w-0 flex-1 border-0 bg-transparent px-[1.1rem] py-4 text-[1.05rem] text-black outline-none"
                />
              </span>
            </label>
          )}
          <label className="flex flex-col gap-2">
            <span className="text-[0.88rem] font-semibold text-black">Senha de acesso</span>
            <span className="login-campo flex items-stretch overflow-hidden rounded-[14px] border-[1.5px] border-[#DCDFE3] bg-[#F7F8F9] transition-[border-color,box-shadow,background-color] duration-150 focus-within:border-[#C41230] focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(196,18,48,0.13)]">
              <input
                type={mostrar ? "text" : "password"}
                autoComplete="current-password"
                autoFocus={!comEmail}
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                aria-invalid={!!erro}
                aria-describedby={erro ? "senha-erro" : undefined}
                className="min-w-0 flex-1 border-0 bg-transparent px-[1.1rem] py-4 text-[1.05rem] text-black outline-none"
              />
              <button
                type="button"
                onClick={() => setMostrar((m) => !m)}
                aria-label={mostrar ? "Esconder senha" : "Mostrar senha"}
                className="rounded-r-[14px] px-[1.1rem] text-[0.82rem] font-semibold text-[#6B7078] hover:text-[#C41230] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[#C41230]"
              >
                {mostrar ? "Esconder" : "Mostrar"}
              </button>
            </span>
          </label>
          {erro && <p id="senha-erro" role="alert" className="mt-2 text-sm text-[#C41230]">{erro}</p>}
          {comEmail && (
            <button type="button" onClick={() => { setErro(""); setModo("esqueci"); }} className={`mt-3 self-start ${LINK}`}>
              Esqueci minha senha
            </button>
          )}

          <button
            type="submit"
            disabled={!senha || enviando}
            className="mt-5 rounded-[14px] bg-[linear-gradient(#D0183A,#B10F2B)] p-[1.05rem] font-['Montserrat'] text-base font-bold text-white shadow-[0_10px_24px_-12px_rgba(196,18,48,0.75),inset_0_1px_0_rgba(255,255,255,0.18)] transition-[filter,opacity] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C41230] disabled:opacity-60"
          >
            {enviando ? "Entrando..." : "Entrar"}
          </button>
        </form>
        )}
        <p className="mt-10 text-center text-[11.4px] text-[#8A8F96]">Desenvolvido por Flag Holding LTDA - WG Master Franchise Brasil</p>
      </section>
    </main>
    </>
  );
}

/** "Esqueci minha senha": pede o e-mail e avisa que o link foi enviado (a resposta é a mesma, tenha o e-mail acesso ou não). */
function EsqueciSenha({ emailInicial, onVoltar }: { emailInicial: string; onVoltar: () => void }) {
  const [email, setEmail] = useState(emailInicial);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || enviando) return;
    setEnviando(true);
    setErro("");
    const r = await pedirRedefinicaoDeSenha(email.trim());
    setEnviando(false);
    if (r.ok) setEnviado(true);
    else setErro(r.erro);
  };

  if (enviado) {
    return (
      <div className="my-auto flex w-full max-w-[380px] flex-col" role="status">
        <h2 className={TITULO}>Confira o seu e-mail</h2>
        <p className="mb-2 leading-normal text-[#6B7078]">
          Se <b className="break-all text-black">{email.trim()}</b> tiver acesso ao Atlas, enviamos um link para criar uma nova senha. Ele vale por 30 minutos e só pode ser usado uma vez.
        </p>
        <p className="mb-6 text-sm leading-normal text-[#6B7078]">Não chegou? Olhe também a caixa de spam. A sua senha atual continua valendo até você criar a nova.</p>
        <button type="button" onClick={onVoltar} className={`self-start ${LINK}`}>Voltar para o login</button>
      </div>
    );
  }
  return (
    <form onSubmit={enviar} className="my-auto flex w-full max-w-[380px] flex-col">
      <h2 className={TITULO}>Esqueci minha senha</h2>
      <p className="mb-8 leading-normal text-[#6B7078]">Digite o e-mail do seu acesso. Enviaremos um link para você criar uma nova senha.</p>
      <label className="flex flex-col gap-2">
        <span className="text-[0.88rem] font-semibold text-black">E-mail</span>
        <span className={CAMPO}>
          <input type="email" autoComplete="username" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!erro} aria-describedby={erro ? "esqueci-erro" : undefined} className={ENTRADA} />
        </span>
      </label>
      {erro && <p id="esqueci-erro" role="alert" className="mt-2 text-sm text-[#C41230]">{erro}</p>}
      <button type="submit" disabled={!email.trim() || enviando} className={BOTAO}>{enviando ? "Enviando..." : "Enviar link"}</button>
      <button type="button" onClick={onVoltar} className={`mt-4 self-start ${LINK}`}>Voltar para o login</button>
    </form>
  );
}

/** Escolher a nova senha com o link do e-mail. */
function NovaSenha({ token, onEntrar, onPedirNovo }: { token: string; onEntrar: () => void; onPedirNovo: () => void }) {
  const [nova, setNova] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(false);
  const [erro, setErro] = useState("");

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    const motivo = motivoLocal(nova, confirmar, "");
    if (motivo) { setErro(motivo); return; }
    setEnviando(true);
    setErro("");
    const r = await redefinirSenhaComLink(token, nova);
    setEnviando(false);
    if (r.ok) setFeito(true);
    else setErro(r.erro);
  };

  if (feito) {
    return (
      <div className="my-auto flex w-full max-w-[380px] flex-col" role="status">
        <h2 className={TITULO}>Senha alterada</h2>
        <p className="mb-2 leading-normal text-[#6B7078]">Pronto. Agora entre no Atlas com a sua nova senha.</p>
        <button type="button" onClick={onEntrar} className={BOTAO}>Ir para o login</button>
      </div>
    );
  }
  const linkInvalido = erro.includes("link");
  return (
    <form onSubmit={enviar} className="my-auto flex w-full max-w-[380px] flex-col">
      <h2 className={TITULO}>Criar nova senha</h2>
      <p className="mb-8 leading-normal text-[#6B7078]">Escolha a nova senha do Atlas. Ela precisa ter pelo menos 10 caracteres.</p>
      <label className="mb-4 flex flex-col gap-2">
        <span className="text-[0.88rem] font-semibold text-black">Nova senha</span>
        <span className={CAMPO}>
          <input type={mostrar ? "text" : "password"} autoComplete="new-password" autoFocus required value={nova} onChange={(e) => setNova(e.target.value)} aria-invalid={!!erro} aria-describedby={erro ? "nova-erro" : undefined} className={ENTRADA} />
          <button type="button" onClick={() => setMostrar((m) => !m)} aria-label={mostrar ? "Esconder senha" : "Mostrar senha"} className="rounded-r-[14px] px-[1.1rem] text-[0.82rem] font-semibold text-[#6B7078] hover:text-[#C41230] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[#C41230]">
            {mostrar ? "Esconder" : "Mostrar"}
          </button>
        </span>
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-[0.88rem] font-semibold text-black">Repita a nova senha</span>
        <span className={CAMPO}>
          <input type={mostrar ? "text" : "password"} autoComplete="new-password" required value={confirmar} onChange={(e) => setConfirmar(e.target.value)} className={ENTRADA} />
        </span>
      </label>
      {erro && <p id="nova-erro" role="alert" className="mt-2 text-sm text-[#C41230]">{erro}</p>}
      <button type="submit" disabled={!nova || !confirmar || enviando} className={BOTAO}>{enviando ? "Salvando..." : "Salvar nova senha"}</button>
      {linkInvalido && <button type="button" onClick={onPedirNovo} className={`mt-4 self-start ${LINK}`}>Pedir um novo link</button>}
    </form>
  );
}
