// Recomendação de localização nos estudos: posições melhores perto de um ponto estudado ou, para uma unidade em operação, onde abrir
// outra unidade na região. A nota é o "público alcançável" (moradores ponderados pela distância, descontado o que outras World Gym
// dividem). O texto sempre diz o que a recomendação não enxerga: imóvel disponível, aluguel, visibilidade, acesso e fluxo.
import { MapPinned } from "lucide-react";
import type { Leaflet } from "@/components/estudos/mapaComum";
import { pino } from "@/components/estudos/mapaComum";
import { Linha, Nota, Secao } from "@/components/estudos/blocos";
import { Button } from "@/components/ui/button";
import type { Sugestao } from "@/lib/estudoPonto";

export const COR_SUGESTAO = "#5b6577";
export type TipoSugestao = "ponto" | "nova";
export interface ResultadoSugestoes { referencia: { publico: number }; sugestoes: Sugestao[]; testadas: number }

const pct = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(Math.round(x * 100))}%`;
const km1 = (x: number) => `${x.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
const reaisRenda = (r: number | null) => (r == null ? "—" : `R$ ${(Math.round(r / 10) * 10).toLocaleString("pt-BR")}`);

/** Pinos cinza numerados das posições sugeridas. */
export function desenharSugestoes(L: Leaflet, grupo: import("leaflet").LayerGroup, res: ResultadoSugestoes | null) {
  res?.sugestoes.forEach((s, i) => L.marker(s.c, { zIndexOffset: 1500, icon: pino(L, COR_SUGESTAO, 30, String(i + 1)) })
    .bindTooltip(`Posição sugerida ${i + 1}: ${pct(s.ganho)} de público alcançável`).addTo(grupo));
}

export const LIMITES_SUGESTAO = "A recomendação usa só o que o Atlas mede: moradores do Censo, distância até o ponto e divisão do público com outras World Gym. Ela não enxerga imóvel disponível, aluguel, visibilidade da fachada, acesso, estacionamento, concorrência ao lado nem fluxo de pessoas: serve para orientar onde procurar imóveis, não substitui a visita.";

/** Texto da recomendação (para a tela e para o PDF). */
export function textoSugestoes(res: ResultadoSugestoes, tipo: TipoSugestao, nome: string) {
  if (!res.sugestoes.length) {
    return tipo === "ponto"
      ? `Testamos ${res.testadas} posições num raio de 3 km e nenhuma alcança 10% mais público que ${nome}: o ponto já está entre os melhores da região pelo que o Atlas mede.`
      : `Testamos ${res.testadas} posições num raio de 10 km, a pelo menos 3 km de qualquer World Gym. Nenhuma alcança ao menos 70% do público da World Gym ${nome} sem tirar mais de 20% do público de uma unidade existente: pelo que o Atlas mede, a região não comporta outra unidade hoje.`;
  }
  const s = res.sugestoes[0];
  return tipo === "ponto"
    ? `Testamos ${res.testadas} posições num raio de 3 km. A melhor fica a ${km1(s.distanciaKm)} de ${nome} e alcança ${pct(s.ganho)} de público, por estar mais perto de onde mora mais gente e mais longe das outras World Gym. Vale procurar imóveis nessas regiões antes de fechar o ponto.${s.renda != null && s.renda > 6000 ? " Atenção: é uma região de renda alta, onde o Low Cost da rede costuma vender menos; ela combina mais com o modelo Pro." : ""}`
    : `Testamos ${res.testadas} posições num raio de 10 km, a pelo menos 3 km de qualquer World Gym, sem tirar mais de 20% do público de nenhuma unidade e com pelo menos 70% do público da própria unidade. A região mais promissora fica a ${km1(s.distanciaKm)} da World Gym ${nome}, com público alcançável ${pct(s.ganho)} em relação ao da própria unidade. É um ponto de partida para o comitê de expansão buscar imóveis e fazer o estudo completo.`;
}

/** Linhas da tabela (posição, distância, público, renda, divisão com a rede). */
export const linhasSugestoes = (res: ResultadoSugestoes) => res.sugestoes.map((s, i) => [
  String(i + 1), km1(s.distanciaKm), pct(s.ganho), reaisRenda(s.renda),
  s.divideCom.length ? s.divideCom.map((d) => `${d.nome.replace("World Gym ", "")} ${Math.round(d.parte * 100)}%`).join(", ") : "nenhuma",
]);

/** Seção da tela com a recomendação e, nos pontos novos, o botão para estudar a posição sugerida. */
export function SecaoSugestoes({ res, tipo, nome, aoEstudar, aoVerNoMapa }: { res: ResultadoSugestoes | null; tipo: TipoSugestao; nome: string; aoEstudar?: (s: Sugestao, i: number) => void; aoVerNoMapa?: () => void }) {
  if (!res) return null;
  return (
    <Secao icone={MapPinned} titulo={tipo === "ponto" ? "Posições melhores por perto" : "Onde abrir outra unidade na região"} className="lg:col-span-2">
      <Nota>{textoSugestoes(res, tipo, nome)}</Nota>
      {res.sugestoes.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {res.sugestoes.map((s, i) => (
            <div key={i} className="rounded-xl border p-3">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 flex-none place-items-center rounded-full text-xs font-semibold text-white" style={{ background: COR_SUGESTAO }}>{i + 1}</span>
                <span className="text-sm font-semibold">{pct(s.ganho)} de público</span>
              </div>
              <div className="mt-2">
                <Linha rotulo="Distância" valor={km1(s.distanciaKm)} />
                <Linha rotulo="Renda média" valor={reaisRenda(s.renda)} />
                {s.renda != null && s.renda > 6000 && <p className="mt-1 text-[11px] text-warning">Renda alta: na rede, o Low Cost vende menos em áreas de renda muito alta. Combina mais com o Pro.</p>}
                <Linha rotulo="Divide com a rede" valor={s.divideCom.length ? s.divideCom.map((d) => `${Math.round(d.parte * 100)}%`).join(" + ") : "nada"} />
              </div>
              {aoEstudar && <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => aoEstudar(s, i)}>Estudar esta posição</Button>}
            </div>
          ))}
        </div>
      )}
      {aoVerNoMapa && res.sugestoes.length > 0 && <Button size="sm" variant="outline" className="mt-3" onClick={aoVerNoMapa}>Ver no mapa</Button>}
      <p className="mt-3 text-[11px] text-muted-foreground">{LIMITES_SUGESTAO} Pinos cinza numerados no mapa.</p>
    </Secao>
  );
}
