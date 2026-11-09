import { useState, type FormEvent } from "react";
import { Globo } from "@/components/Globo";
import { entrar, loginComEmail } from "@/lib/auth";

// Estrelas fixas (posições sorteadas uma vez, com semente, para não mudarem a cada visita).
const ESTRELAS = (() => {
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 140 }, () => ({ x: r() * 100, y: r() * 100, t: r() * 1.3 + 0.3, d: r() * 4 }));
})();

export function Login({ onEntrou }: { onEntrou: () => void }) {
  const comEmail = loginComEmail(); // só depois que o dono cria os acessos; antes vale a senha única
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
    const r = await entrar(senha, email);
    setEnviando(false);
    if (r.ok) onEntrou();
    else setErro(r.erro);
  };

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[minmax(0,1.2fr)_minmax(380px,1fr)]">
      {/* Céu: noite avermelhada, com o horizonte aceso no vermelho da marca. O globo do logo da World Gym ocupa o centro. */}
      <section className="relative isolate flex min-h-[46vh] flex-col overflow-hidden bg-[#360812] p-[clamp(1.75rem,4vw,3.25rem)] text-white">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(130%_90%_at_30%_115%,#E62A2A_0%,#B8151F_24%,#82101E_48%,#550C18_74%,#360812_100%)]" />
        <svg aria-hidden className="absolute inset-0 -z-10 h-full w-full" preserveAspectRatio="none">
          {ESTRELAS.map((e, i) => (
            <circle key={i} className="ceu-estrela" cx={`${e.x}%`} cy={`${e.y}%`} r={e.t} fill="#fff" style={{ animationDelay: `${e.d}s` }} />
          ))}
        </svg>
        <h1 className="font-['Cinzel'] uppercase leading-none">
          <span className="mb-2 block text-[clamp(0.85rem,1.15vw,1rem)] font-medium tracking-[0.42em] text-white/80">World Gym</span>
          <span className="block text-[clamp(2.1rem,3.2vw,2.9rem)] font-bold tracking-[0.12em]">Atlas</span>
        </h1>
        <div className="flex flex-1 items-center justify-center py-10">
          <Globo className="w-[min(82%,640px)]" />
        </div>
      </section>

      {/* Painel de entrada no mesmo padrão do gerador de escalas da World Gym. */}
      <section className="flex flex-col items-center justify-center px-[clamp(1.5rem,5vw,4.5rem)] py-10">
        <form onSubmit={enviar} className="my-auto flex w-full max-w-[380px] flex-col">
          <h2 className="mb-2 text-balance font-['Montserrat'] text-[clamp(1.75rem,2.4vw,2.1rem)] font-extrabold leading-[1.2] tracking-[-0.025em] text-black">
            Entrar no Atlas
          </h2>
          <p className="mb-8 leading-normal text-[#6B7078]">{comEmail ? "Entre com o seu e-mail e a senha de acesso." : "Digite a senha de acesso para ver os resultados da rede."}</p>

          {comEmail && (
            <label className="mb-4 flex flex-col gap-2">
              <span className="text-[0.88rem] font-semibold text-black">E-mail</span>
              <span className="flex items-stretch rounded-[14px] border-[1.5px] border-[#DCDFE3] bg-[#F7F8F9] transition-[border-color,box-shadow,background-color] duration-150 focus-within:border-[#C41230] focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(196,18,48,0.13)]">
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
            <span className="flex items-stretch rounded-[14px] border-[1.5px] border-[#DCDFE3] bg-[#F7F8F9] transition-[border-color,box-shadow,background-color] duration-150 focus-within:border-[#C41230] focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(196,18,48,0.13)]">
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

          <button
            type="submit"
            disabled={!senha || enviando}
            className="mt-5 rounded-[14px] bg-[linear-gradient(#D0183A,#B10F2B)] p-[1.05rem] font-['Montserrat'] text-base font-bold text-white shadow-[0_10px_24px_-12px_rgba(196,18,48,0.75),inset_0_1px_0_rgba(255,255,255,0.18)] transition-[filter,opacity] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C41230] disabled:opacity-60"
          >
            {enviando ? "Entrando..." : "Entrar"}
          </button>
        </form>
        <p className="mt-10 text-center text-[11.4px] text-[#8A8F96]">Desenvolvido por Flag Holding LTDA - WG Master Franchise Brasil</p>
      </section>
    </main>
  );
}
