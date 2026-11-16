import { useEffect, useState } from "react";
import { getUsuario } from "@/lib/auth";

const agoraTexto = (d: Date) => d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * Marca d'água com o e-mail de quem está logado e a data e hora, só nas páginas impressas ou salvas em PDF (na tela não aparece,
 * a pedido do dono em 15/11/2026). Se um PDF vazar, mostra de qual acesso ele saiu. Não recebe cliques.
 */
export function MarcaDagua({ email = getUsuario()?.email }: { email?: string }) {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60 * 1000);
    return () => clearInterval(t);
  }, []);
  if (!email) return null;
  const texto = `${email} • ${agoraTexto(agora)}`;
  return (
    <div aria-hidden data-marca-dagua className="pointer-events-none fixed inset-0 z-[60] hidden select-none overflow-hidden print:block">
      <div className="absolute -left-1/2 -top-1/2 flex h-[200%] w-[200%] -rotate-[24deg] flex-wrap content-start gap-x-16 gap-y-24">
        {Array.from({ length: 120 }, (_, i) => (
          <span key={i} className="whitespace-nowrap text-[13px] font-medium text-foreground opacity-[0.05]">{texto}</span>
        ))}
      </div>
    </div>
  );
}
