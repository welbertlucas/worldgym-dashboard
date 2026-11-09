import { useEffect, useRef, useState } from "react";

// O globo do logo da World Gym como uma esfera 3D de verdade.
// O desenho do logo (continentes e meridianos, recortado do arquivo oficial) é "enrolado" numa esfera pela placa de vídeo:
// o mapa acompanha a curvatura, gira alguns graus para um lado e para o outro, e a esfera tem luz vinda do alto à esquerda,
// brilho de reflexo no oceano, lado da noite mais escuro e uma borda de atmosfera azulada.
// Sem suporte a WebGL, cai para a versão em camadas de CSS (GloboCss).
const URL_GLOBO = `${import.meta.env.BASE_URL}globo-wg.png`;

// A esfera ocupa 78% do canvas; o resto é o brilho da atmosfera.
const VERT = `attribute vec2 a; varying vec2 vUv; void main(){ vUv = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }`;
const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uYaw;
void main() {
  vec2 q = (vUv * 2.0 - 1.0) / 0.78;
  float d = length(q);
  vec3 L = normalize(vec3(-0.55, 0.5, 0.7));
  float lado = d > 0.0 ? clamp(dot(q / d, normalize(L.xy)) * 0.5 + 0.5, 0.0, 1.0) : 0.5;
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  if (d < 1.0) {
    float z = sqrt(1.0 - d * d);
    vec3 n = vec3(q, z);
    float c = cos(uYaw), s = sin(uYaw);
    vec3 m = vec3(n.x * c + n.z * s, n.y, -n.x * s + n.z * c);
    // O desenho do logo só existe até 95% do raio (depois vem o anel de contorno, que não usamos). Para cobrir a esfera até a
    // borda, a parte de fora (a partir de 70%) é comprimida de leve; o que gira para além da borda usa o espelho do que está na frente.
    float rho = length(m.xy);
    vec2 dir = rho > 0.0001 ? m.xy / rho : vec2(0.0);
    float t = rho < 0.7 ? rho : 0.7 + (rho - 0.7) * 0.8;
    float ink = texture2D(uTex, vec2(dir.x * t * 0.5 + 0.5, 0.5 - dir.y * t * 0.5)).a;
    float diff = max(dot(n, L), 0.0);
    vec3 ocean = vec3(0.74, 0.08, 0.12) * (0.16 + 0.95 * diff);
    vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
    float spec = pow(max(dot(n, H), 0.0), 70.0);
    ocean += vec3(1.0, 0.82, 0.82) * spec * 0.6 * (1.0 - ink);
    vec3 land = vec3(0.97, 0.94, 0.93) * (0.24 + 0.86 * diff) + vec3(0.06, 0.005, 0.01) * (1.0 - diff);
    col = mix(ocean, land, ink);
    col += vec3(0.42, 0.6, 1.0) * pow(1.0 - z, 2.4) * (0.35 + 0.65 * lado) * 0.85;
    float borda = smoothstep(1.0, 0.992, d);
    col *= borda;
    alpha = borda;
  } else {
    float g = exp(-(d - 1.0) * 9.0) * smoothstep(1.28, 1.04, d);
    col = vec3(0.35, 0.55, 1.0) * g * (0.25 + 0.75 * lado) * 0.7;
    alpha = max(col.r, max(col.g, col.b));
  }
  gl_FragColor = vec4(col, alpha);
}`;

function compilar(gl: WebGLRenderingContext, tipo: number, fonte: string) {
  const sh = gl.createShader(tipo)!;
  gl.shaderSource(sh, fonte);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? "shader");
  return sh;
}

function GloboWebgl({ onFalha }: { onFalha: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) { onFalha(); return; }
    let viva = true;
    let quadro = 0;
    let programa: WebGLProgram;
    let textura: WebGLTexture;
    let uYaw: WebGLUniformLocation | null;
    try {
      programa = gl.createProgram()!;
      gl.attachShader(programa, compilar(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(programa, compilar(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(programa);
      if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) throw new Error("link");
    } catch {
      onFalha();
      return;
    }
    gl.useProgram(programa);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(programa, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    uYaw = gl.getUniformLocation(programa, "uYaw");
    gl.uniform1i(gl.getUniformLocation(programa, "uTex"), 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // Textura: começa vazia (só o oceano) e troca pelo desenho do logo quando a imagem chega.
    textura = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, textura);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const parado = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const inicio = performance.now();
    const desenhar = (agora: number) => {
      if (!viva) return;
      // Gira uns 9° para cada lado, devagar (ciclo de 16 s); começa de frente, como no logo.
      const yaw = parado ? 0 : 0.16 * Math.sin(((agora - inicio) / 16000) * 2 * Math.PI);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uYaw, yaw);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!parado && !document.hidden) quadro = requestAnimationFrame(desenhar);
    };
    const dimensionar = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      if (canvas.width !== w || canvas.height !== w) { canvas.width = w; canvas.height = w; gl.viewport(0, 0, w, w); }
      if (parado) desenhar(performance.now());
    };
    dimensionar();
    const obs = new ResizeObserver(dimensionar);
    obs.observe(canvas);
    const aoVoltar = () => { if (!document.hidden && !parado) { cancelAnimationFrame(quadro); quadro = requestAnimationFrame(desenhar); } };
    document.addEventListener("visibilitychange", aoVoltar);

    const img = new Image();
    img.onload = () => {
      if (!viva) return;
      // Potência de 2 para poder usar mipmaps (a esfera reduz o desenho perto da borda).
      const c = document.createElement("canvas");
      c.width = c.height = 1024;
      c.getContext("2d")!.drawImage(img, 0, 0, 1024, 1024);
      gl.bindTexture(gl.TEXTURE_2D, textura);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      if (parado) desenhar(performance.now());
    };
    img.src = URL_GLOBO;
    if (!parado) quadro = requestAnimationFrame(desenhar);
    else desenhar(performance.now());

    return () => {
      viva = false;
      cancelAnimationFrame(quadro);
      obs.disconnect();
      document.removeEventListener("visibilitychange", aoVoltar);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={ref} aria-hidden className="absolute left-1/2 top-1/2 h-[128%] w-[128%] -translate-x-1/2 -translate-y-1/2" />;
}

/** Reserva para quem não tem WebGL: o mesmo globo em camadas de CSS (luz, sombra, reflexo e halo). */
function GloboCss() {
  return (
    <>
      <div aria-hidden className="absolute -inset-[18%] rounded-full bg-[radial-gradient(closest-side,rgba(110,155,255,0.32),rgba(70,110,255,0.09)_60%,transparent)] blur-2xl" />
      <div className="absolute inset-0 overflow-hidden rounded-full bg-[radial-gradient(circle_at_34%_28%,#F2474B_0%,#B8151F_34%,#5C0913_72%,#2A040A_100%)] shadow-[inset_-28px_-36px_70px_rgba(0,0,0,0.55),inset_14px_14px_40px_rgba(255,255,255,0.18),0_0_60px_rgba(110,150,255,0.3),0_30px_90px_-20px_rgba(0,0,0,0.6)]">
        <img src={URL_GLOBO} alt="" draggable={false} className="h-full w-full select-none opacity-95 [mask-image:radial-gradient(circle_at_34%_28%,#000_35%,rgba(0,0,0,0.25)_95%)]" />
        <div aria-hidden className="absolute left-[14%] top-[10%] h-[34%] w-[40%] rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.35),transparent)] blur-md" />
        <div aria-hidden className="absolute inset-0 rounded-full shadow-[inset_0_0_0_1.5px_rgba(190,212,255,0.4)]" />
      </div>
    </>
  );
}

export function Globo({ className }: { className?: string }) {
  const [semWebgl, setSemWebgl] = useState(false);
  return (
    <div className={`relative aspect-square ${className ?? ""}`}>
      <div className="globo-flutua absolute inset-0">{semWebgl ? <GloboCss /> : <GloboWebgl onFalha={() => setSemWebgl(true)} />}</div>
    </div>
  );
}
