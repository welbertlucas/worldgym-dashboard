// Botão "Buscar o Censo desta cidade" (Estudos de ponto fora da malha do Censo). Pede ao servidor, que aciona a rotina do GitHub; depois, enquanto
// a página está aberta, olha a cada 45 segundos se o Censo já chegou. Fechando a página, o pedido continua: ao reabrir o estudo, ele já está lá.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { pedirCensoDaCidade } from "@/components/estudos/censoMunicipio";

// 45 min: o mesmo prazo em que o servidor não repete o pedido da mesma área (VALIDADE_PEDIDO_MIN); o Censo de cidade grande (ex.: São Paulo) passa dos 15 min
const A_CADA_MS = 45_000, DESISTE_APOS_MS = 45 * 60_000;

// O pedido fica lembrado no navegador (só o horário, pela posição arredondada a ~1 km): saindo e voltando ao estudo, a tela continua mostrando
// "Buscando o Censo…" em vez de oferecer o botão de novo (visto em 26/11/2026). Sem acesso ao armazenamento, vale só enquanto a página está aberta.
const CHAVE = "atlas.censo-pedido";
const chaveDe = (c: [number, number]) => `${c[0].toFixed(2)},${c[1].toFixed(2)}`;
function lerPedidos(): Record<string, number> {
  try { const j = JSON.parse(localStorage.getItem(CHAVE) ?? "{}"); return j && typeof j === "object" ? j : {}; } catch { return {}; }
}
function gravarPedido(c: [number, number], em: number | null) {
  try {
    const agora = Date.now();
    const todos = Object.fromEntries(Object.entries(lerPedidos()).filter(([, v]) => typeof v === "number" && agora - v < DESISTE_APOS_MS));
    if (em == null) delete todos[chaveDe(c)]; else todos[chaveDe(c)] = em;
    localStorage.setItem(CHAVE, JSON.stringify(todos));
  } catch { /* sem armazenamento: fica só na memória da página */ }
}
/** Horário do pedido ainda em andamento para esta posição (feito há menos de 45 min), ou null. */
export function pedidoEmAndamento(c: [number, number], agora = Date.now()): number | null {
  const em = lerPedidos()[chaveDe(c)];
  return typeof em === "number" && agora - em < DESISTE_APOS_MS ? em : null;
}
const hora = (t: number) => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Tempo típico da rotina, do pedido ao Censo gravado: 5 a 12 min nas cidades médias, 22 min numa capital (medido em 24 e 26/11/2026). */
export const ESTIMATIVA_MIN = 20;
/**
 * Andamento do pedido SÓ PELO TEMPO (a tela não vê a rotina do GitHub: o pedido vai por um código, sem ligação com o estudo, porque o
 * repositório é público). A barra para em 95% até o Censo chegar; passando da estimativa, avisa que está demorando.
 */
export function andamentoDoPedido(desde: number, agora: number) {
  const min = Math.max(0, (agora - desde) / 60_000);
  return { min: Math.floor(min), parte: Math.min(0.95, min / ESTIMATIVA_MIN), previsto: desde + ESTIMATIVA_MIN * 60_000, atrasado: min > ESTIMATIVA_MIN };
}

export function PedirCenso({ c, aoChegar }: { c: [number, number]; /** Busca o Censo de novo (já deve ter chegado). */ aoChegar: () => void }) {
  const [fase, setFase] = useState<"ocioso" | "enviando" | "aguardando" | "desistiu">(() => (pedidoEmAndamento(c) ? "aguardando" : "ocioso"));
  const [erro, setErro] = useState("");
  const desde = useRef(pedidoEmAndamento(c) ?? 0);
  const olhar = useRef(aoChegar);
  olhar.current = aoChegar;
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (fase !== "aguardando") return;
    const t = setInterval(() => setAgora(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [fase]);
  useEffect(() => {
    if (fase !== "aguardando") return;
    const t = setInterval(() => { if (Date.now() - desde.current > DESISTE_APOS_MS) { gravarPedido(c, null); setFase("desistiu"); } else olhar.current(); }, A_CADA_MS);
    return () => clearInterval(t);
  }, [fase]); // eslint-disable-line react-hooks/exhaustive-deps
  const pedir = async () => {
    // estudo de ponto é estratégia comercial: a posição vai ao Mapbox (só para achar o estado) e o pedido segue ao GitHub por um código
    if (!window.confirm(`Para buscar o Censo desta cidade, a posição do ponto será enviada ao Mapbox (só para achar o estado). O pedido segue ao GitHub por um código, sem endereço nem nome da cidade, e leva uns ${ESTIMATIVA_MIN} minutos. Continuar?`)) return;
    setFase("enviando"); setErro("");
    try {
      const r = await pedirCensoDaCidade(c);
      if (r.estado === "pronto") { gravarPedido(c, null); olhar.current(); setFase("ocioso"); return; }
      // "em-andamento": o servidor já tinha um pedido desta área (de outra pessoa ou de antes); conta a partir de quando ele começou
      const em = r.desde ?? Date.now();
      desde.current = em; gravarPedido(c, em); setFase("aguardando");
    } catch (e) { setErro((e as Error).message); setFase("ocioso"); }
  };
  if (fase === "aguardando") {
    const a = andamentoDoPedido(desde.current, Math.max(agora, desde.current));
    return (
      <div className="w-full max-w-md space-y-1.5 text-[13px]" role="status">
        <p><b>Buscando o Censo desta cidade</b> · pedido às {hora(desde.current)}</p>
        <div className="h-2 overflow-hidden rounded-full bg-foreground/10" role="progressbar" aria-label="Tempo estimado do pedido do Censo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(a.parte * 100)}>
          <div className={`h-full rounded-full transition-[width] duration-700 ${a.atrasado ? "bg-warning" : "bg-primary"}`} style={{ width: `${Math.max(3, a.parte * 100)}%` }} />
        </div>
        <p className="text-[12px] text-foreground/75">
          {a.atrasado
            ? `${a.min} min até agora: está passando do normal (cidade grande ou outro pedido na fila, um espera o outro).`
            : `${a.min} de cerca de ${ESTIMATIVA_MIN} min · previsto para umas ${hora(a.previsto)}.`}
          {" "}É uma estimativa pelo tempo. Pode fechar a página: o estudo se completa sozinho quando o Censo chegar.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={pedir} disabled={fase === "enviando"}>{fase === "enviando" ? "Enviando o pedido…" : "Buscar o Censo desta cidade"}</Button>
      {fase === "desistiu" && <span className="text-[12px] text-muted-foreground">Ainda não chegou: pode ter dado problema na rotina. Tente pedir de novo daqui a pouco.</span>}
      {erro && <span className="text-[12px] text-destructive">{erro}</span>}
    </div>
  );
}
