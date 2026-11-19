import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Login } from "@/components/Login";
import { Abertura } from "@/components/Abertura";
import { TrocarSenha } from "@/components/TrocarSenha";
import Index from "@/pages/Index";
import { AUTH_REQUIRED_EVENT, precisaDeLogin, precisaTrocarSenha, sair, tokenDeRedefinicaoNaUrl, vigiarSessao } from "@/lib/auth";

type Estado = "verificando" | "login" | "trocar" | "pronto";
/** Quem entrou com a senha provisória passa primeiro pela escolha da própria senha. */
const depoisDoLogin = (): Estado => (precisaTrocarSenha() ? "trocar" : "pronto");

export default function App() {
  const [estado, setEstado] = useState<Estado>("verificando");
  // Link "esqueci minha senha" do e-mail: lido uma vez e tirado do endereço; leva direto à escolha da nova senha, mesmo com o Atlas já aberto.
  const [tokenRedefinir] = useState<string | null>(() => tokenDeRedefinicaoNaUrl());

  useEffect(() => {
    precisaDeLogin().then((precisa) => setEstado(precisa || tokenRedefinir ? "login" : depoisDoLogin()));
    const pedir = () => setEstado("login"); // token vencido ou senha trocada
    window.addEventListener(AUTH_REQUIRED_EVENT, pedir);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, pedir);
  }, []);

  // Logado: sem mexer no Atlas por 12 horas (4 para quem vê só algumas unidades), ou 7 dias depois de entrar, e ele volta para a tela de login.
  useEffect(() => (estado === "pronto" ? vigiarSessao() : undefined), [estado]);

  if (estado === "verificando") return <Abertura />;
  if (estado === "login") return <Login tokenRedefinir={tokenRedefinir} onEntrou={() => setEstado(depoisDoLogin())} />;
  if (estado === "trocar") return <TrocarSenha obrigatoria onFeito={() => setEstado("pronto")} onSair={sair} />;
  return (
    <>
      <Index />
      <Toaster />
    </>
  );
}
