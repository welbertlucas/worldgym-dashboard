import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { trocarMinhaSenha } from "@/lib/auth";

/** Regras mostradas à pessoa (o servidor confere as mesmas e mais algumas). */
export function motivoLocal(nova: string, confirmar: string, atual: string): string | null {
  if (nova.length < 10) return "A senha nova precisa ter pelo menos 10 caracteres.";
  if (nova === atual) return "A senha nova precisa ser diferente da atual.";
  if (nova !== confirmar) return "As duas senhas novas não são iguais.";
  return null;
}

/**
 * Escolher a própria senha. `obrigatoria`: primeiro acesso (senha provisória), sem como fechar nem pular, só sair.
 * Sem ela, é a troca voluntária, em janela sobre o painel, com "Cancelar".
 */
export function TrocarSenha({ obrigatoria = false, onFeito, onCancelar, onSair }: { obrigatoria?: boolean; onFeito: () => void; onCancelar?: () => void; onSair?: () => void }) {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (salvando) return;
    const motivo = !atual ? "Digite a senha atual." : motivoLocal(nova, confirmar, atual);
    if (motivo) { setErro(motivo); return; }
    setSalvando(true);
    setErro("");
    const r = await trocarMinhaSenha(atual, nova);
    setSalvando(false);
    if (r.ok) onFeito(); else setErro(r.erro);
  };

  const campo = (rotulo: string, valor: string, set: (v: string) => void, auto: string, dica?: string) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-[0.88rem] font-semibold text-black">{rotulo}</span>
      <input
        type={mostrar ? "text" : "password"}
        value={valor}
        onChange={(e) => set(e.target.value)}
        autoComplete={auto}
        aria-invalid={!!erro}
        className="h-11 w-full rounded-lg border border-[#D5D8DD] bg-white px-3.5 text-[0.95rem] text-black outline-none focus:border-[#C41230] focus:ring-2 focus:ring-[#C41230]/20"
      />
      {dica && <span className="text-xs text-[#6B7078]">{dica}</span>}
    </label>
  );

  const corpo = (
    <form onSubmit={enviar} className="flex w-full max-w-[400px] flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl sm:p-8">
      <div>
        <h2 className="font-['Montserrat'] text-[1.5rem] font-extrabold leading-tight tracking-[-0.02em] text-black">
          {obrigatoria ? "Escolha a sua senha" : "Trocar senha"}
        </h2>
        <p className="mt-2 text-sm leading-normal text-[#6B7078]">
          {obrigatoria
            ? "Você entrou com uma senha provisória. Para continuar, crie uma senha só sua. A provisória deixa de valer depois disso."
            : "Informe a senha atual e escolha uma nova."}
        </p>
      </div>
      {campo(obrigatoria ? "Senha provisória (a que você recebeu)" : "Senha atual", atual, setAtual, "current-password")}
      {campo("Senha nova", nova, setNova, "new-password", "Pelo menos 10 caracteres. Não use o seu e-mail nem sequências fáceis.")}
      {campo("Repita a senha nova", confirmar, setConfirmar, "new-password")}
      <button type="button" onClick={() => setMostrar((v) => !v)} className="flex items-center gap-2 self-start text-xs font-medium text-[#6B7078] hover:text-black">
        {mostrar ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        {mostrar ? "Esconder as senhas" : "Mostrar as senhas"}
      </button>
      {erro && <p role="alert" className="text-sm text-[#C41230]">{erro}</p>}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button type="submit" disabled={salvando} className="h-11 rounded-lg bg-[#C41230] px-5 text-sm font-semibold text-white hover:bg-[#A50F28] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41230]/40 disabled:opacity-60">
          {salvando ? "Salvando…" : "Salvar senha"}
        </button>
        {obrigatoria
          ? onSair && <button type="button" onClick={onSair} className="text-sm font-medium text-[#6B7078] hover:text-black">Sair</button>
          : onCancelar && <button type="button" onClick={onCancelar} className="text-sm font-medium text-[#6B7078] hover:text-black">Cancelar</button>}
      </div>
    </form>
  );

  return obrigatoria ? (
    <main className="flex min-h-screen items-center justify-center bg-[#F3F4F6] px-4 py-10">{corpo}</main>
  ) : (
    <div role="dialog" aria-modal="true" aria-label="Trocar senha" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-4 py-10" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancelar?.(); }}>
      {corpo}
    </div>
  );
}
