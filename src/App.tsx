import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Login } from "@/components/Login";
import { Abertura } from "@/components/Abertura";
import Index from "@/pages/Index";
import { AUTH_REQUIRED_EVENT, precisaDeLogin, vigiarSessao } from "@/lib/auth";

type Estado = "verificando" | "login" | "pronto";

export default function App() {
  const [estado, setEstado] = useState<Estado>("verificando");

  useEffect(() => {
    precisaDeLogin().then((precisa) => setEstado(precisa ? "login" : "pronto"));
    const pedir = () => setEstado("login"); // token vencido ou senha trocada
    window.addEventListener(AUTH_REQUIRED_EVENT, pedir);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, pedir);
  }, []);

  // Logado: sem mexer no Atlas por 12 horas (4 para quem vê só algumas unidades), ou 7 dias depois de entrar, e ele volta para a tela de login.
  useEffect(() => (estado === "pronto" ? vigiarSessao() : undefined), [estado]);

  if (estado === "verificando") return <Abertura />;
  if (estado === "login") return <Login onEntrou={() => setEstado("pronto")} />;
  return (
    <>
      <Index />
      <Toaster />
    </>
  );
}
