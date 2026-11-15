// Tela de abertura enquanto o app confere se a pessoa já entrou. É a mesma do index.html
// (mostrada antes do JavaScript carregar), para não piscar branco entre uma e outra.
// Com `mensagem`, vira a tela de "carregando os dados": mesmo fundo, mais uma barra de progresso e a frase.
export function Abertura({ mensagem }: { mensagem?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={mensagem ?? "Carregando o World Gym Atlas"}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[radial-gradient(130%_90%_at_30%_115%,#21398A_0%,#152A6A_26%,#0C1A4C_52%,#061030_76%,#030819_100%)] text-white"
    >
      <style>{`
        @keyframes atlas-barra { 0% { transform: translateX(-110%); } 100% { transform: translateX(260%); } }
        @keyframes atlas-respira { 0%, 100% { transform: scale(1); opacity: .95; } 50% { transform: scale(1.04); opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .atlas-anim { animation: none !important; } }
      `}</style>
      <img src={`${import.meta.env.BASE_URL}globo-wg.png`} alt="" className="atlas-anim h-[140px] w-[140px]" style={mensagem ? { animation: "atlas-respira 2.6s ease-in-out infinite" } : { opacity: 0.95 }} />
      <p className="text-center font-['Cinzel'] uppercase leading-none">
        <span className="block text-[13px] font-medium tracking-[0.42em] text-white/80">World Gym</span>
        <span className="mt-2 block text-[34px] font-bold tracking-[0.12em]">Atlas</span>
      </p>
      {mensagem && (
        <div className="mt-2 flex w-64 flex-col items-center gap-3">
          <div aria-hidden className="h-[3px] w-full overflow-hidden rounded-full bg-white/15">
            <div className="atlas-anim h-full w-2/5 rounded-full bg-gradient-to-r from-transparent via-white to-transparent" style={{ animation: "atlas-barra 1.5s ease-in-out infinite" }} />
          </div>
          <p className="whitespace-nowrap text-xs tracking-[0.18em] text-white/70">{mensagem}</p>
        </div>
      )}
    </div>
  );
}
