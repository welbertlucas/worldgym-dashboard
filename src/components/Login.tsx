import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { entrar } from "@/lib/auth";
import logo from "@/assets/wg-logo.png";

export function Login({ onEntrou }: { onEntrou: () => void }) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!senha || enviando) return;
    setEnviando(true);
    setErro("");
    const r = await entrar(senha);
    setEnviando(false);
    if (r.ok) onEntrou();
    else setErro(r.erro);
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-background">
      <form onSubmit={enviar} className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <img src={logo} alt="World Gym" className="h-10 w-auto" />
        <div>
          <h1 className="text-lg font-semibold text-foreground">Dashboard de Resultados</h1>
          <p className="text-sm text-muted-foreground">Acesso restrito. Digite a senha para continuar.</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="senha" className="text-sm font-medium text-foreground">Senha</label>
          <input
            id="senha"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            aria-invalid={!!erro}
            aria-describedby={erro ? "senha-erro" : undefined}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {erro && <p id="senha-erro" role="alert" className="text-sm text-destructive">{erro}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={!senha || enviando}>{enviando ? "Entrando..." : "Entrar"}</Button>
      </form>
    </main>
  );
}
