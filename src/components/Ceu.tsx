import { useEffect, useRef, useState } from "react";

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

const GRANDES = (() => {
  const r = sorteio(4242);
  return Array.from({ length: 5 }, (_, i) => ({ fx: 0.08 + r() * 0.84, fy: 0.06 + r() * 0.88, cor: CORES[[0, 7, 9, 0, 10][i]], d: r() * 3 }));
})();

function ponto2(ctx: CanvasRenderingContext2D, x: number, y: number, raio: number, c: readonly number[]) {
  ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},1)`;
  ctx.beginPath();
  ctx.arc(x, y, raio, 0, Math.PI * 2);
  ctx.fill();
}

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
  // poucas estrelas grandes: o ponto e um leve cruzado de luz (o halo, que pulsa, é desenhado por cima, no SVG)
  for (const g of GRANDES) {
    const x = w * g.fx, y = h * g.fy, c = g.cor, braco = 30 * escala;
    ctx.strokeStyle = rgba(c, 0.3);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x - braco, y); ctx.lineTo(x + braco, y);
    ctx.moveTo(x, y - braco); ctx.lineTo(x, y + braco);
    ctx.stroke();
    ponto2(ctx, x, y, 2 * escala, c);
  }
  ctx.globalCompositeOperation = "source-over";
}

// Estrelas que piscam (só opacidade, devagar); com "reduzir movimento" ficam paradas pelo CSS.
const PISCANDO = (() => {
  const r = sorteio(77);
  return Array.from({ length: 150 }, () => ({ x: r() * 100, y: r() * 100, t: 0.7 + r() * 0.9, d: r() * 6, s: 2 + r() * 3.5 }));
})();

type Cadente = { k: number; x: number; y: number; a: number };

export function Ceu({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [cadente, setCadente] = useState<Cadente | null>(null);

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

  // Estrela cadente: uma risca de luz cruza o céu de vez em quando (a primeira logo no começo, depois a cada 18 a 32 s).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let k = 0;
    const ids: number[] = [];
    const agendar = (ms: number) => {
      ids.push(window.setTimeout(() => {
        setCadente({ k: ++k, x: 8 + Math.random() * 55, y: 4 + Math.random() * 38, a: 16 + Math.random() * 24 });
        ids.push(window.setTimeout(() => setCadente(null), 1500));
        agendar(18000 + Math.random() * 14000);
      }, ms));
    };
    agendar(4500);
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, []);

  return (
    <div aria-hidden className={className}>
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <defs>
          {GRANDES.map((g, i) => (
            <radialGradient key={i} id={`halo-grande-${i}`}>
              <stop offset="0%" stopColor={`rgb(${g.cor.join(",")})`} stopOpacity="0.8" />
              <stop offset="22%" stopColor={`rgb(${g.cor.join(",")})`} stopOpacity="0.25" />
              <stop offset="100%" stopColor={`rgb(${g.cor.join(",")})`} stopOpacity="0" />
            </radialGradient>
          ))}
        </defs>
        {PISCANDO.map((e, i) => (
          <circle key={i} className="ceu-estrela" cx={`${e.x}%`} cy={`${e.y}%`} r={e.t} fill="#fff" style={{ animationDelay: `${e.d}s`, animationDuration: `${e.s}s` }} />
        ))}
        {GRANDES.map((g, i) => (
          <circle key={`g${i}`} className="ceu-pulsa" cx={`${g.fx * 100}%`} cy={`${g.fy * 100}%`} r={30} fill={`url(#halo-grande-${i})`} style={{ animationDelay: `${g.d}s` }} />
        ))}
      </svg>
      {cadente && <div key={cadente.k} className="ceu-cadente" style={{ left: `${cadente.x}%`, top: `${cadente.y}%`, ["--ang" as string]: `${cadente.a}deg` }} />}
    </div>
  );
}
