// Cálculo pesado que não precisa estar pronto no primeiro desenho da tela (ex.: "Posições melhores por perto", ~1 s com o Censo):
// roda logo depois que a tela aparece, para abrir o estudo não travar. Enquanto isso devolve null (a seção mostra "calculando").
import { useEffect, useState } from "react";

export function useCalculoAdiado<V>(calcular: () => V | null, deps: unknown[]): V | null {
  const [valor, setValor] = useState<V | null>(null);
  useEffect(() => {
    let vivo = true;
    setValor(null);
    // espera o navegador desenhar a tela (dois quadros) antes de calcular
    const id = requestAnimationFrame(() => setTimeout(() => { if (vivo) setValor(calcular()); }, 0));
    return () => { vivo = false; cancelAnimationFrame(id); };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return valor;
}
