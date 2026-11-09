// Tela de abertura enquanto o app confere se a pessoa já entrou. É a mesma do index.html
// (mostrada antes do JavaScript carregar), para não piscar branco entre uma e outra.
export function Abertura() {
  return (
    <div
      role="status"
      aria-label="Carregando o World Gym Atlas"
      className="fixed inset-0 flex flex-col items-center justify-center gap-6 bg-[radial-gradient(130%_90%_at_30%_115%,#21398A_0%,#152A6A_26%,#0C1A4C_52%,#061030_76%,#030819_100%)] text-white"
    >
      <img src={`${import.meta.env.BASE_URL}globo-wg.png`} alt="" className="h-[140px] w-[140px] opacity-95" />
      <p className="text-center font-['Cinzel'] uppercase leading-none">
        <span className="block text-[13px] font-medium tracking-[0.42em] text-white/80">World Gym</span>
        <span className="mt-2 block text-[34px] font-bold tracking-[0.12em]">Atlas</span>
      </p>
    </div>
  );
}
