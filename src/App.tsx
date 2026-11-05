import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Login } from "@/components/Login";
import Index from "@/pages/Index";
import { AUTH_REQUIRED_EVENT, precisaDeLogin } from "@/lib/auth";

type Estado = "verificando" | "login" | "pronto";

export default function App() {
  const [estado, setEstado] = useState<Estado>("verificando");

  useEffect(() => {
    precisaDeLogin().then((precisa) => setEstado(precisa ? "login" : "pronto"));
    const pedir = () => setEstado("login"); // token vencido ou senha trocada
    window.addEventListener(AUTH_REQUIRED_EVENT, pedir);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, pedir);
  }, []);

  if (estado === "verificando") return null;
  if (estado === "login") return <Login onEntrou={() => setEstado("pronto")} />;
  return (
    <>
      <Index />
      <Toaster />
    </>
  );
}
