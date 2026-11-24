// Botão "Buscar o Censo desta cidade" (Estudos de ponto fora da malha do Censo). Pede ao servidor, que aciona a rotina do GitHub; depois, enquanto
// a página está aberta, olha a cada 45 segundos se o Censo já chegou. Fechando a página, o pedido continua: ao reabrir o estudo, ele já está lá.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { pedirCensoDaCidade } from "@/components/estudos/censoMunicipio";

const A_CADA_MS = 45_000, DESISTE_APOS_MS = 25 * 60_000;

export function PedirCenso({ c, aoChegar }: { c: [number, number]; /** Busca o Censo de novo (já deve ter chegado). */ aoChegar: () => void }) {
  const [fase, setFase] = useState<"ocioso" | "enviando" | "aguardando" | "desistiu">("ocioso");
  const [erro, setErro] = useState("");
  const desde = useRef(0);
  const olhar = useRef(aoChegar);
  olhar.current = aoChegar;
  useEffect(() => {
    if (fase !== "aguardando") return;
    const t = setInterval(() => { if (Date.now() - desde.current > DESISTE_APOS_MS) setFase("desistiu"); else olhar.current(); }, A_CADA_MS);
    return () => clearInterval(t);
  }, [fase]);
  const pedir = async () => {
    // estudo de ponto é estratégia comercial: a posição vai ao Mapbox (só para achar o estado) e o pedido segue ao GitHub por um código
    if (!window.confirm("Para buscar o Censo desta cidade, a posição do ponto será enviada ao Mapbox (só para achar o estado). O pedido segue ao GitHub por um código, sem endereço nem nome da cidade, e leva uns 10 a 15 minutos. Continuar?")) return;
    setFase("enviando"); setErro("");
    try {
      const r = await pedirCensoDaCidade(c);
      desde.current = Date.now();
      if (r.estado === "pronto") { olhar.current(); setFase("ocioso"); } else setFase("aguardando");
    } catch (e) { setErro((e as Error).message); setFase("ocioso"); }
  };
  if (fase === "aguardando") return <p className="text-[13px]"><b>Buscando o Censo desta cidade…</b> leva uns 10 a 15 minutos. Pode fechar a página: quando voltar, é só abrir o estudo de novo.</p>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" className="bg-white" onClick={pedir} disabled={fase === "enviando"}>{fase === "enviando" ? "Enviando o pedido…" : "Buscar o Censo desta cidade"}</Button>
      {fase === "desistiu" && <span className="text-[12px] text-muted-foreground">Ainda não chegou: pode ter dado problema na rotina. Tente pedir de novo daqui a pouco.</span>}
      {erro && <span className="text-[12px] text-destructive">{erro}</span>}
    </div>
  );
}
