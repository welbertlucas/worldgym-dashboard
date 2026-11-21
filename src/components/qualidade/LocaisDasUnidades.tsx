import { useState } from "react";
import { MapPin } from "lucide-react";
import { ChartCard } from "@/components/ChartCard";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import type { LocalUnidade } from "@/data/qualidade";
import { apagarLocalDaUnidade, lerLocalizacao, salvarLocalDaUnidade } from "@/lib/qualidade";

function Linha({ unidade, local, onMudou }: { unidade: string; local?: LocalUnidade; onMudou: () => void }) {
  const [lat, setLat] = useState(local ? String(local.lat) : "");
  const [lng, setLng] = useState(local ? String(local.lng) : "");
  const [raio, setRaio] = useState(String(local?.raio ?? 300));
  const [ocupado, setOcupado] = useState(false);
  const numero = (s: string) => Number(s.replace(",", ".").trim());
  const valido = lat.trim() !== "" && lng.trim() !== "" && Number.isFinite(numero(lat)) && Number.isFinite(numero(lng));
  const usarAqui = async () => {
    setOcupado(true);
    const l = await lerLocalizacao();
    setOcupado(false);
    if (!l) return toast({ title: "Não consegui a sua localização", description: "Permita a localização no navegador ou cole as coordenadas.", variant: "destructive" });
    setLat(String(Math.round(l.lat * 1e6) / 1e6)); setLng(String(Math.round(l.lng * 1e6) / 1e6));
  };
  const salvar = async () => {
    setOcupado(true);
    const r = await salvarLocalDaUnidade(unidade, { lat: numero(lat), lng: numero(lng), raio: Number(raio) || 300 });
    setOcupado(false);
    if (!r.ok) return toast({ title: "Não consegui salvar", description: r.erro, variant: "destructive" });
    toast({ title: `Local de ${unidade} salvo` });
    onMudou();
  };
  const remover = async () => {
    setOcupado(true);
    await apagarLocalDaUnidade(unidade);
    setOcupado(false);
    setLat(""); setLng("");
    onMudou();
  };
  return (
    <li className="grid items-center gap-2 py-2 sm:grid-cols-[10rem_1fr_1fr_5rem_auto]">
      <span className="text-sm font-medium text-foreground">{unidade}{local && <span className="ml-2 text-xs font-normal text-emerald-700">marcado</span>}</span>
      <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Latitude (ex.: -15.78)" aria-label={`Latitude de ${unidade}`} className="h-9 rounded-lg border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="Longitude (ex.: -47.90)" aria-label={`Longitude de ${unidade}`} className="h-9 rounded-lg border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      <input value={raio} onChange={(e) => setRaio(e.target.value)} inputMode="numeric" aria-label={`Raio aceito em metros de ${unidade}`} title="Raio aceito, em metros" className="h-9 rounded-lg border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      <span className="flex flex-wrap gap-1">
        <Button size="sm" variant="outline" disabled={ocupado} onClick={() => void usarAqui()}>Usar onde estou</Button>
        <Button size="sm" disabled={ocupado || !valido} onClick={() => void salvar()}>Salvar</Button>
        {local && <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => void remover()}>Remover</Button>}
      </span>
    </li>
  );
}

/** Só o dono: onde cada unidade fica (latitude, longitude e o raio aceito), para o Atlas dizer se o check-in foi feito na unidade. */
export function LocaisDasUnidades({ unidades, locais, onMudou }: { unidades: string[]; locais: Record<string, LocalUnidade>; onMudou: () => void }) {
  const marcadas = unidades.filter((u) => locais[u]).length;
  return (
    <ChartCard title="Local das unidades" subtitle="Marque onde cada unidade fica para o Atlas comparar com o local dos check-ins. Sem o local marcado, o check-in guarda só a localização e o mapa.">
      <details className="rounded-xl border border-border bg-secondary/30 p-3">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground"><MapPin className="h-4 w-4" aria-hidden />{marcadas} de {unidades.length} unidades com o local marcado</summary>
        <p className="mt-2 text-xs text-muted-foreground">Para marcar, vá até a unidade e use "Usar onde estou", ou cole as coordenadas do Google Maps (clique com o botão direito no ponto). O raio padrão é de 300 metros: o check-in a mais que isso (descontada a precisão do aparelho) fica marcado como fora do local.</p>
        <ul className="mt-2 divide-y divide-border">{unidades.map((u) => <Linha key={`${u}-${locais[u]?.lat ?? ""}`} unidade={u} local={locais[u]} onMudou={onMudou} />)}</ul>
      </details>
    </ChartCard>
  );
}
