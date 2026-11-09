import { useEffect, useRef } from "react";

// Céu da tela de login: campo de estrelas desenhado uma vez num canvas (milhares de estrelas de tamanhos, brilhos e cores
// diferentes, mais densas numa faixa diagonal que lembra a Via Láctea, com poeira difusa e poucas estrelas grandes com halo).
// Sobre ele, um punhado de estrelas piscando de leve. Posições sorteadas com semente: o céu é o mesmo a cada visita.

function sorteio(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Cores das estrelas como no céu de verdade: maioria branca, muitas azuladas, algumas amareladas e poucas alaranjadas.
const CORES: [number, number, number][] = [[255, 250, 245], [255, 250, 245], [255, 250, 245], [255, 250, 245], [255, 250, 245], [255, 250, 245], [190, 212, 255], [190, 212, 255], [190, 212, 255], [255, 236, 190], [255, 210, 160]];

function desenhar(canvas: HTMLCanvasElement, w: number, h: number, dpr: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const r = sorteio(20261110);
  const gauss = () => { let s = 0; for (let i = 0; i < 4; i++) s += r(); return (s - 2) / 0.58; }; // ~N(0,1)

  // Faixa da Via Láctea: eixo diagonal subindo para a direita.
  const diag = Math.hypot(w, h);
  const ang = -0.52;
  const cx = w * 0.46, cy = h * 0.52;
  const ux = Math.cos(ang), uy = Math.sin(ang);
  const sigma = diag * 0.13;
  const naFaixa = () => {
    const t = (r() - 0.5) * diag * 1.25;
    const d = gauss() * sigma;
    return [cx + ux * t - uy * d, cy + uy * t + ux * d] as const;
  };
  const cor = () => CORES[Math.floor(r() * CORES.length)];
  const rgba = (c: readonly number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  // 1) Névoa da faixa: nuvens grandes e muito suaves, quentes, somadas (aditivo).
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 110; i++) {
    const [x, y] = naFaixa();
    const raio = diag * (0.04 + r() * 0.09);
    const g = ctx.createRadialGradient(x, y, 0, x, y, raio);
    const c = r() < 0.62 ? [160, 192, 255] : [255, 228, 200];
    g.addColorStop(0, rgba(c, 0.045 + r() * 0.045));
    g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - raio, y - raio, raio * 2, raio * 2);
  }
  // 2) Faixas de poeira escura dentro da névoa, para dar textura e não parecer um borrão liso.
  ctx.globalCompositeOperation = "source-over";
  for (let i = 0; i < 90; i++) {
    const [x, y] = naFaixa();
    const raio = diag * (0.012 + r() * 0.04);
    const g = ctx.createRadialGradient(x, y, 0, x, y, raio);
    g.addColorStop(0, `rgba(2,5,20,${0.2 + r() * 0.18})`);
    g.addColorStop(1, "rgba(2,5,20,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - raio, y - raio, raio * 2, raio * 2);
  }

  // 3) Estrelas.
  ctx.globalCompositeOperation = "lighter";
  const ponto = (x: number, y: number, raio: number, a: number) => {
    ctx.fillStyle = rgba(cor(), a);
    ctx.beginPath();
    ctx.arc(x, y, raio, 0, Math.PI * 2);
    ctx.fill();
  };
  const escala = Math.min(1.25, Math.max(0.8, diag / 1400)); // telas maiores têm estrelas um pouco maiores
  // poeira estelar da faixa (milhares de pontos mínimos)
  for (let i = 0; i < 5600; i++) { const [x, y] = naFaixa(); ponto(x, y, (0.42 + r() * 0.3) * escala, 0.3 + r() * 0.5); }
  // fundo
  for (let i = 0; i < 2200; i++) ponto(r() * w, r() * h, (0.48 + r() * 0.42) * escala, 0.35 + r() * 0.55);
  // faixa, estrelas finas
  for (let i = 0; i < 2000; i++) { const [x, y] = naFaixa(); ponto(x, y, (0.6 + r() * 0.55) * escala, 0.5 + r() * 0.45); }
  // médias, em todo o céu
  for (let i = 0; i < 460; i++) ponto(r() * w, r() * h, (0.95 + r() * 0.7) * escala, 0.7 + r() * 0.3);
  // brilhantes: ponto firme + halo pequeno
  for (let i = 0; i < 38; i++) {
    const x = r() * w, y = r() * h, c = cor();
    const raio = (1.2 + r() * 0.9) * escala;
    const halo = raio * (4 + r() * 3);
    const g = ctx.createRadialGradient(x, y, 0, x, y, halo);
    g.addColorStop(0, rgba(c, 0.5));
    g.addColorStop(0.3, rgba(c, 0.12));
    g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - halo, y - halo, halo * 2, halo * 2);
    ponto(x, y, raio, 0.95);
  }
  // poucas estrelas grandes, com halo e um leve cruzado de luz
  for (let i = 0; i < 5; i++) {
    const x = w * (0.08 + r() * 0.84), y = h * (0.06 + r() * 0.88), c = cor();
    const halo = (20 + r() * 14) * escala;
    const g = ctx.createRadialGradient(x, y, 0, x, y, halo);
    g.addColorStop(0, rgba(c, 0.75));
    g.addColorStop(0.18, rgba(c, 0.25));
    g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - halo, y - halo, halo * 2, halo * 2);
    ctx.strokeStyle = rgba(c, 0.28);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x - halo * 1.3, y); ctx.lineTo(x + halo * 1.3, y);
    ctx.moveTo(x, y - halo * 1.3); ctx.lineTo(x, y + halo * 1.3);
    ctx.stroke();
    ponto(x, y, 2 * escala, 1);
  }
  ctx.globalCompositeOperation = "source-over";
}

// Estrelas que piscam (só opacidade, devagar); com "reduzir movimento" ficam paradas pelo CSS.
const PISCANDO = (() => {
  const r = sorteio(77);
  return Array.from({ length: 46 }, () => ({ x: r() * 100, y: r() * 100, t: 0.7 + r() * 0.9, d: r() * 5, s: 2.2 + r() * 3 }));
})();

export function Ceu({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const pai = canvas?.parentElement;
    if (!canvas || !pai) return;
    let espera = 0;
    const pintar = () => {
      const { width, height } = pai.getBoundingClientRect();
      if (width > 0 && height > 0) desenhar(canvas, width, height, Math.min(window.devicePixelRatio || 1, 2));
    };
    pintar();
    const obs = new ResizeObserver(() => { window.clearTimeout(espera); espera = window.setTimeout(pintar, 120); });
    obs.observe(pai);
    return () => { window.clearTimeout(espera); obs.disconnect(); };
  }, []);

  return (
    <div aria-hidden className={className}>
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        {PISCANDO.map((e, i) => (
          <circle key={i} className="ceu-estrela" cx={`${e.x}%`} cy={`${e.y}%`} r={e.t} fill="#fff" style={{ animationDelay: `${e.d}s`, animationDuration: `${e.s}s` }} />
        ))}
      </svg>
    </div>
  );
}
