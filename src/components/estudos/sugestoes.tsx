// Recomendação de localização nos estudos: posições melhores perto de um ponto estudado ou, para uma unidade em operação, onde abrir
// outra unidade na região. A nota é o "público alcançável" (moradores ponderados pela distância, descontado o que outras World Gym
// dividem). O texto sempre diz o que a recomendação não enxerga: imóvel disponível, aluguel, visibilidade, acesso e fluxo.
import { useEffect, useState } from "react";
import { MapPinned } from "lucide-react";
import { API_BASE, authFetch } from "@/lib/auth";
import type { Leaflet } from "@/components/estudos/mapaComum";
import { pino } from "@/components/estudos/mapaComum";
import { Linha, Nota, Secao } from "@/components/estudos/blocos";
import { Button } from "@/components/ui/button";
import { MINUTOS_PADRAO, moradoresNaArea, potencialNaArea, vereditoComFatia, PARECER_ROTULO, type Censo, type Sugestao, type Veredito } from "@/lib/estudoPonto";
import { buscarDeslocamento } from "@/components/estudos/deslocamento";

export const COR_SUGESTAO = "#5b6577";
export type TipoSugestao = "ponto" | "nova";
/** Concorrência em volta de uma posição sugerida: academias a até RAIO_ACADEMIAS_KM e moradores na área de 10 min de carro. */
export interface Concorrencia { academias: number; moradores: number | null; porAcademia: number | null; /** Gasto com esportes na área de 10 min. */ potencial?: number | null }
/** Parecer de uma posição sugerida, com as mesmas regras do estudo de ponto (payback pelo tamanho padrão do modelo e fatia do potencial). */
export interface ParecerSugestao { veredito: Veredito; fatia: number | null }
export interface ResultadoSugestoes { referencia: { publico: number }; sugestoes: (Sugestao & { concorrencia?: Concorrencia | null; parecer?: ParecerSugestao | null })[]; testadas: number; saturadas?: number; naoAprovam?: number }

/**
 * Regras da expansão (decisão do dono, 23/11/2026): posição a mais de 5 km de qualquer World Gym, dividindo no máximo 10% do público com cada
 * uma, e fora de região saturada. Saturada = menos de MIN_MORADORES_POR_ACADEMIA moradores (área de 10 min) por academia a até 1,5 km,
 * a mesma conta dos estudos de ponto antigos da rede (os reprovados por saturação ficaram abaixo de ~1.950).
 */
export const REGRAS_NOVA_UNIDADE = { longeDeUnidadesKm: 5, maxCanibalizacao: 0.1 };
export const MIN_MORADORES_POR_ACADEMIA = 1950;
export const RAIO_ACADEMIAS_KM = 1.5;

async function contarAcademias(c: [number, number]): Promise<number> {
  const r = await authFetch(`${API_BASE}/estudos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "contar-academias", c, raioKm: RAIO_ACADEMIAS_KM }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Não consegui contar as academias agora.");
  return Number(j.academias ?? 0);
}

/**
 * Confere a concorrência das posições candidatas, na ordem, até achar `max` fora de região saturada. Posição sem resposta (Google ou Mapbox
 * fora do ar) fica, sem o número. Devolve null enquanto confere.
 */
export function useSugestoesSemSaturacao(res: ResultadoSugestoes | null, censo: Censo | null | undefined, max = 3,
  /** Para o parecer de cada posição: vendas previstas e veredito pelo tamanho padrão do modelo, e a faixa da fatia da rede (null enquanto calcula). */
  avaliacao?: { provavel: number; veredito: Veredito; faixa: { comum: number; maxima: number } | null } | null): ResultadoSugestoes | null {
  const [saida, setSaida] = useState<ResultadoSugestoes | null>(null);
  const chave = res?.sugestoes.map((s) => s.c.join(",")).join(";") ?? "";
  useEffect(() => {
    setSaida(null);
    if (!res || !censo) return;
    let vivo = true;
    (async () => {
      const ficam: ResultadoSugestoes["sugestoes"] = [];
      let saturadas = 0, naoAprovam = 0;
      for (const s of res.sugestoes) {
        if (ficam.length >= max) break;
        let concorrencia: Concorrencia | null = null;
        try {
          const [academias, d] = await Promise.all([contarAcademias(s.c), buscarDeslocamento(s.c, "carro").catch(() => null)]);
          const area = d?.contornos[String(MINUTOS_PADRAO)];
          const moradores = area ? moradoresNaArea(censo, area) : null;
          concorrencia = { academias, moradores, porAcademia: moradores != null && academias > 0 ? moradores / academias : null, potencial: area ? potencialNaArea(censo, area)?.total ?? null : null };
        } catch { /* sem resposta: a posição fica sem o número */ }
        if (concorrencia?.porAcademia != null && concorrencia.porAcademia < MIN_MORADORES_POR_ACADEMIA) { saturadas++; continue; }
        // o mesmo parecer de um estudo de ponto: posição que o Atlas não aprovaria não é recomendada (pedido do dono, 23/11/2026)
        let parecer: ParecerSugestao | null = null;
        if (avaliacao) {
          const fatia = concorrencia?.potencial ? avaliacao.provavel / concorrencia.potencial : null;
          const v = vereditoComFatia(avaliacao.veredito, fatia, avaliacao.faixa) as Veredito;
          if (v === "reprovado") { naoAprovam++; continue; }
          parecer = { veredito: v, fatia };
        }
        ficam.push({ ...s, concorrencia, parecer });
      }
      if (vivo) setSaida({ ...res, sugestoes: ficam, saturadas, naoAprovam });
    })();
    return () => { vivo = false; };
  }, [chave, censo, avaliacao?.provavel, avaliacao?.veredito, avaliacao?.faixa?.comum, avaliacao?.faixa?.maxima]); // eslint-disable-line react-hooks/exhaustive-deps
  return saida;
}

/** "Parecer: Aprova com condicionantes · precisaria de 30% do potencial de consumo" (ou null sem o dado). */
export function textoParecerSugestao(p: ParecerSugestao | null | undefined) {
  if (!p) return null;
  return `Parecer: ${PARECER_ROTULO[p.veredito]}${p.fatia != null ? ` · precisaria de ${Math.round(p.fatia * 100)}% do potencial de consumo da área` : ""}`;
}

/** "9 academias a até 1,5 km · 6.200 moradores por academia" (ou null sem o dado). */
export function textoConcorrencia(c: Concorrencia | null | undefined) {
  if (!c) return null;
  const por = c.porAcademia != null ? ` · ${Math.round(c.porAcademia).toLocaleString("pt-BR")} moradores por academia` : c.academias === 0 ? " · nenhuma academia por perto" : "";
  return `${c.academias} ${c.academias === 1 ? "academia" : "academias"} a até ${RAIO_ACADEMIAS_KM.toLocaleString("pt-BR")} km${por}`;
}

const pct = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(Math.round(x * 100))}%`;
const km1 = (x: number) => `${x.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
const reaisRenda = (r: number | null) => (r == null ? "—" : `R$ ${(Math.round(r / 10) * 10).toLocaleString("pt-BR")}`);

/** Pinos cinza numerados das posições sugeridas. */
export function desenharSugestoes(L: Leaflet, grupo: import("leaflet").LayerGroup, res: ResultadoSugestoes | null) {
  res?.sugestoes.forEach((s, i) => L.marker(s.c, { zIndexOffset: 1500, icon: pino(L, COR_SUGESTAO, 30, String(i + 1)) })
    .bindTooltip(`Posição sugerida ${i + 1}: ${pct(s.ganho)} de público alcançável`).addTo(grupo));
}

export const LIMITES_SUGESTAO = "A recomendação usa o que o Atlas mede: moradores do Censo, distância até o ponto, divisão do público com outras World Gym e, na nova unidade, quantas academias há por perto (Google). Ela não enxerga imóvel disponível, aluguel, visibilidade da fachada, acesso, estacionamento nem fluxo de pessoas: serve para orientar onde procurar imóveis, não substitui a visita.";

/** Texto da recomendação (para a tela e para o PDF). */
export function textoSugestoes(res: ResultadoSugestoes, tipo: TipoSugestao, nome: string) {
  if (!res.sugestoes.length) {
    return tipo === "ponto"
      ? `Testamos ${res.testadas} posições num raio de 3 km e nenhuma alcança 10% mais público que ${nome}: o ponto já está entre os melhores da região pelo que o Atlas mede.`
      : `Testamos ${res.testadas} posições num raio de 10 km, a mais de 5 km de qualquer World Gym. Nenhuma alcança ao menos 70% do público da World Gym ${nome} sem dividir mais de 10% do público com uma unidade existente${res.saturadas ? ` e fora de região saturada de academias (${res.saturadas} ${res.saturadas === 1 ? "posição descartada" : "posições descartadas"} por ter menos de ${MIN_MORADORES_POR_ACADEMIA.toLocaleString("pt-BR")} moradores por academia)` : ""}${res.naoAprovam ? `; ${res.naoAprovam} ${res.naoAprovam === 1 ? "posição foi descartada porque o parecer seria" : "posições foram descartadas porque o parecer seria"} "Não aprova" (a venda prevista passaria do que a rede tira do mercado de esportes da região)` : ""}: pelo que o Atlas mede, a região não comporta outra unidade hoje.`;
  }
  const s = res.sugestoes[0];
  return tipo === "ponto"
    ? `Testamos ${res.testadas} posições num raio de 3 km. A melhor fica a ${km1(s.distanciaKm)} de ${nome} e alcança ${pct(s.ganho)} de público, por estar mais perto de onde mora mais gente e mais longe das outras World Gym. Vale procurar imóveis nessas regiões antes de fechar o ponto.${s.renda != null && s.renda > 6000 ? " Atenção: é uma região de renda alta, onde o Low Cost da rede costuma vender menos; ela combina mais com o modelo Pro." : ""}`
    : `Testamos ${res.testadas} posições num raio de 10 km, a mais de 5 km de qualquer World Gym, dividindo no máximo 10% do público com cada unidade, com pelo menos 70% do público da própria unidade e fora de região saturada (pelo menos ${MIN_MORADORES_POR_ACADEMIA.toLocaleString("pt-BR")} moradores por academia${res.saturadas ? `; ${res.saturadas} ${res.saturadas === 1 ? "posição foi descartada" : "posições foram descartadas"} por isso` : ""}) e com parecer de estudo de ponto que não seja "Não aprova"${res.naoAprovam ? ` (${res.naoAprovam} descartada${res.naoAprovam === 1 ? "" : "s"} por isso)` : ""}. A região mais promissora fica a ${km1(s.distanciaKm)} da World Gym ${nome}, com público alcançável ${pct(s.ganho)} em relação ao da própria unidade. É um ponto de partida para o comitê de expansão buscar imóveis e fazer o estudo completo.`;
}

/** Linhas da tabela (posição, distância, público, renda, divisão com a rede). */
export const linhasSugestoes = (res: ResultadoSugestoes) => res.sugestoes.map((s, i) => [
  String(i + 1), km1(s.distanciaKm), pct(s.ganho), reaisRenda(s.renda),
  s.divideCom.length ? s.divideCom.map((d) => `${d.nome.replace("World Gym ", "")} ${Math.round(d.parte * 100)}%`).join(", ") : "nenhuma",
]);

/** Seção da tela com a recomendação e, nos pontos novos, o botão para estudar a posição sugerida. */
export function SecaoSugestoes({ res, tipo, nome, aoEstudar, aoVerNoMapa }: { res: ResultadoSugestoes | null; tipo: TipoSugestao; nome: string; aoEstudar?: (s: Sugestao, i: number, endereco?: string | null) => void; aoVerNoMapa?: () => void }) {
  const ends = useEnderecos(res);
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
              <p className="mt-1.5 text-[12px] text-foreground">{ends[i] ?? "Buscando o endereço…"}</p>
              <div className="mt-2">
                <Linha rotulo="Distância" valor={km1(s.distanciaKm)} />
                <Linha rotulo="Renda média" valor={reaisRenda(s.renda)} />
                {s.renda != null && s.renda > 6000 && <p className="mt-1 text-[11px] text-warning">Renda alta: na rede, o Low Cost vende menos em áreas de renda muito alta. Combina mais com o Pro.</p>}
                <Linha rotulo="Divide com a rede" valor={s.divideCom.length ? s.divideCom.map((d) => `${Math.round(d.parte * 100)}%`).join(" + ") : "nada"} />
              </div>
              {aoEstudar && <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => aoEstudar(s, i, ends[i])}>Estudar esta posição</Button>}
            </div>
          ))}
        </div>
      )}
      {aoVerNoMapa && res.sugestoes.length > 0 && <Button size="sm" variant="outline" className="mt-3" onClick={aoVerNoMapa}>Ver no mapa</Button>}
      <p className="mt-3 text-[11px] text-muted-foreground">{LIMITES_SUGESTAO} Pinos cinza numerados no mapa.</p>
    </Secao>
  );
}

const cacheEnderecos = new Map<string, Promise<string | null>>();
/** Endereço aproximado de uma posição (pelo servidor; guardado na memória da página). */
export function enderecoDaPosicao(c: [number, number]): Promise<string | null> {
  const k = `${c[0].toFixed(5)},${c[1].toFixed(5)}`;
  if (!cacheEnderecos.has(k)) cacheEnderecos.set(k, authFetch(`${API_BASE}/estudos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "endereco-posicao", c }) })
    .then(async (r) => (r.ok ? ((await r.json()).endereco as string | null) ?? null : null)).catch(() => null));
  return cacheEnderecos.get(k)!;
}
/** Endereços das posições sugeridas, na ordem delas (null enquanto carrega ou quando não acha). */
export function useEnderecos(res: ResultadoSugestoes | null): (string | null)[] {
  const [ends, setEnds] = useState<(string | null)[]>([]);
  const chave = res?.sugestoes.map((s) => s.c.join(",")).join(";") ?? "";
  useEffect(() => {
    setEnds([]);
    if (!res?.sugestoes.length) return;
    let vivo = true;
    Promise.all(res.sugestoes.map((s) => enderecoDaPosicao(s.c))).then((e) => vivo && setEnds(e));
    return () => { vivo = false; };
  }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps
  return ends;
}

/** Endereço curto para usar como região do estudo (sem CEP nem "Brasil"). */
export const enderecoCurto = (e: string | null | undefined) => (e ? e.replace(/,\s*\d{5}(-\d{3})?/, "").replace(/,\s*Brasil$/, "").trim() : "");
