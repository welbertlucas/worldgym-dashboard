import globo from "@/assets/globo-wg.png";

// O globo do logo da World Gym (recortado do arquivo oficial) montado como uma esfera:
// corpo vermelho com luz vindo do alto à esquerda, desenho do logo em branco que some no lado da sombra,
// brilho de reflexo, halo e um anel celeste (o céu que Atlas sustenta) passando por trás e pela frente.
const ANEL = "absolute left-1/2 top-1/2 h-[30%] w-[132%] -translate-x-1/2 -translate-y-1/2 -rotate-[16deg] rounded-[50%] border-[1.5px] border-white/45";

export function Globo({ className }: { className?: string }) {
  return (
    <div className={`globo-sobe relative aspect-square ${className ?? ""}`}>
      <div className="globo-flutua absolute inset-0">
        {/* Halo do céu atrás do globo */}
        <div aria-hidden className="absolute -inset-[18%] rounded-full bg-[radial-gradient(closest-side,rgba(255,90,80,0.45),rgba(255,40,40,0.12)_60%,transparent)] blur-2xl" />
        {/* Metade de trás do anel */}
        <div aria-hidden className={ANEL} />
        {/* Esfera */}
        <div className="absolute inset-0 overflow-hidden rounded-full bg-[radial-gradient(circle_at_34%_28%,#F2474B_0%,#B8151F_34%,#5C0913_72%,#2A040A_100%)] shadow-[inset_-28px_-36px_70px_rgba(0,0,0,0.55),inset_14px_14px_40px_rgba(255,255,255,0.18),0_0_60px_rgba(255,70,60,0.45),0_30px_90px_-20px_rgba(0,0,0,0.6)]">
          <img
            src={globo}
            alt=""
            draggable={false}
            className="h-full w-full select-none opacity-95 [mask-image:radial-gradient(circle_at_34%_28%,#000_35%,rgba(0,0,0,0.25)_95%)]"
          />
          {/* Reflexo de luz */}
          <div aria-hidden className="absolute left-[14%] top-[10%] h-[34%] w-[40%] rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.35),transparent)] blur-md" />
          {/* Borda iluminada da atmosfera */}
          <div aria-hidden className="absolute inset-0 rounded-full shadow-[inset_0_0_0_1.5px_rgba(255,200,190,0.35)]" />
        </div>
        {/* Metade da frente do anel, por cima da esfera */}
        <div aria-hidden className={`${ANEL} [clip-path:inset(50%_0_0_0)]`} />
      </div>
    </div>
  );
}
