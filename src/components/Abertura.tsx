import { getToken } from "@/lib/auth";

// Tela de abertura enquanto o app confere se a pessoa já entrou ou carrega os dados. Repete a do index.html (mostrada antes do JavaScript
// carregar), para não piscar entre uma e outra. Quem já tem sessão guardada vê a versão clara, que combina com o painel; quem não tem vê a
// azul, que é a do login. Com `mensagem`, mostra também a barra de progresso e a frase.
const sessaoGuardada = () => { try { return Boolean(getToken()); } catch { return false; } };

export function Abertura({ mensagem }: { mensagem?: string }) {
  const claro = sessaoGuardada();
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={mensagem ?? "Carregando o World Gym Atlas"}
      className={
        claro
          ? "fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[radial-gradient(120%_90%_at_50%_0%,#FFFFFF_0%,#FAFAFB_60%,#F3F4F6_100%)] text-[#14181F]"
          : "fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[radial-gradient(130%_90%_at_30%_115%,#21398A_0%,#152A6A_26%,#0C1A4C_52%,#061030_76%,#030819_100%)] text-white"
      }
    >
      <style>{`
        @keyframes atlas-barra { 0% { transform: translateX(-110%); } 100% { transform: translateX(260%); } }
        @keyframes atlas-respira { 0%, 100% { transform: scale(1); opacity: .95; } 50% { transform: scale(1.04); opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .atlas-anim { animation: none !important; } }
      `}</style>
      <div
        aria-hidden
        className={`atlas-anim h-[140px] w-[140px] ${claro ? "bg-primary" : "bg-white"}`}
        style={{
          WebkitMask: `url(${import.meta.env.BASE_URL}globo-wg.png) center/contain no-repeat`,
          mask: `url(${import.meta.env.BASE_URL}globo-wg.png) center/contain no-repeat`,
          ...(mensagem ? { animation: "atlas-respira 2.6s ease-in-out infinite" } : { opacity: 0.95 }),
        }}
      />
      <p className="text-center font-['Cinzel'] uppercase leading-none">
        <span className={`block text-[13px] font-medium tracking-[0.42em] ${claro ? "text-[#6B7078]" : "text-white/80"}`}>World Gym</span>
        <span className="mt-2 block text-[34px] font-bold tracking-[0.12em]">Atlas</span>
      </p>
      {mensagem && (
        <div className="mt-2 flex w-64 flex-col items-center gap-3">
          <div aria-hidden className={`h-[3px] w-full overflow-hidden rounded-full ${claro ? "bg-black/10" : "bg-white/15"}`}>
            <div
              className={`atlas-anim h-full w-2/5 rounded-full bg-gradient-to-r from-transparent ${claro ? "via-primary" : "via-white"} to-transparent`}
              style={{ animation: "atlas-barra 1.5s ease-in-out infinite" }}
            />
          </div>
          <p className={`whitespace-nowrap text-xs tracking-[0.18em] ${claro ? "text-[#6B7078]" : "text-white/70"}`}>{mensagem}</p>
        </div>
      )}
    </div>
  );
}
