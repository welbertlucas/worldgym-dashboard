import { useEffect, useMemo, useState } from "react";
import { ChartCard, ChartEmpty, HeadlineStat } from "@/components/ChartCard";
import { horarioDePico } from "@/components/clientes/MapaCalorEntradas";
import { calorDaEscolha, carregarCampanhas, type FotoCampanhas } from "@/data/campanhas";

const DIAS = [
  { sem: 1, nome: "Seg" }, { sem: 2, nome: "Ter" }, { sem: 3, nome: "Qua" }, { sem: 4, nome: "Qui" },
  { sem: 5, nome: "Sex" }, { sem: 6, nome: "Sáb" }, { sem: 0, nome: "Dom" },
];
const NOME_LONGO = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const SEMANAS = 4; // 28 dias = 4 de cada dia da semana
const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const dec = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const data = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

/** Quando chegam os contatos do Meta (leads e conversas): média por dia da semana e hora nas últimas 4 semanas. */
export function ContatosPorHorario({ unit }: { unit: string | null }) {
  const [foto, setFoto] = useState<FotoCampanhas | null | undefined>(undefined);
  const [cel, setCel] = useState<number | null>(null);
  useEffect(() => { let vivo = true; carregarCampanhas().then((f) => vivo && setFoto(f)); return () => { vivo = false; }; }, []);
  const calor = useMemo(() => calorDaEscolha(foto?.calor, unit), [foto, unit]);
  const titulo = "Quando chegam os contatos";
  const subtitle = <>{unit ?? "Rede"} • {foto?.calor ? `${data(foto.calor.de)} a ${data(foto.calor.ate)} (4 semanas)` : "últimas 4 semanas"}</>;
  if (foto === undefined) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>Carregando…</ChartEmpty></ChartCard>;
  if (!foto?.calor) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>Os horários aparecem depois da próxima leitura diária do Meta.</ChartEmpty></ChartCard>;
  const total = calor ? calor.reduce((s, n) => s + n, 0) : 0;
  if (!calor || total === 0) return <ChartCard title={titulo} subtitle={subtitle}><ChartEmpty>Nenhum contato do Meta nas últimas 4 semanas{unit ? ` para ${unit}` : ""}.</ChartEmpty></ChartCard>;

  const media = calor.map((n) => n / SEMANAS);
  const maior = Math.max(...media, 0.0001);
  const pico = horarioDePico(media);
  const porDia = DIAS.map((d) => ({ ...d, n: calor.slice(d.sem * 24, d.sem * 24 + 24).reduce((s, x) => s + x, 0) }));
  const melhorDia = [...porDia].sort((a, b) => b.n - a.n)[0];
  const horas = Array.from({ length: 24 }, (_, h) => h);

  return (
    <ChartCard
      title={titulo}
      subtitle={subtitle}
      headline={
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <HeadlineStat label="Contatos em 4 semanas" value={int(total)} swatch={<span className="h-2 w-2 rounded-full bg-foreground" />} />
          <HeadlineStat label="Média por dia" value={dec(total / 28)} swatch={<span className="h-2 w-2 rounded-full bg-foreground/50" />} />
          {pico && <HeadlineStat label="Horário de pico" value={`${DIAS.find((d) => d.sem === pico.sem)?.nome} ${pico.hora}h`} swatch={<span className="h-2 w-2 rounded-full bg-primary" />} />}
          <HeadlineStat label="Dia com mais contatos" value={NOME_LONGO[melhorDia.sem].replace(/^./, (c) => c.toUpperCase())} swatch={<span className="h-2 w-2 rounded-full bg-primary/60" />} />
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-[2px] text-[11px]" aria-label="Média de contatos do Meta por dia da semana e hora">
          <thead>
            <tr>
              <th className="w-10" />
              {horas.map((h) => <th key={h} scope="col" className="font-normal text-muted-foreground tabular-nums">{h}h</th>)}
            </tr>
          </thead>
          <tbody>
            {DIAS.map((d) => (
              <tr key={d.sem}>
                <th scope="row" className="pr-1 text-left font-medium text-muted-foreground">{d.nome}</th>
                {horas.map((h) => {
                  const k = d.sem * 24 + h;
                  const v = media[k];
                  const topo = pico && pico.sem === d.sem && pico.hora === h;
                  return (
                    <td
                      key={h}
                      onMouseEnter={() => setCel(k)}
                      onMouseLeave={() => setCel(null)}
                      onClick={() => setCel(k)}
                      className={topo || cel === k ? "h-7 cursor-default rounded-[4px] ring-2 ring-primary ring-inset" : "h-7 cursor-default rounded-[4px]"}
                      style={{ background: v > 0 ? `hsl(217 91% 55% / ${0.08 + (v / maior) * 0.82})` : "hsl(var(--secondary))" }}
                    >
                      <span className="sr-only">{dec(v)}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 min-h-[1.25rem] text-sm text-foreground" aria-live="polite">
        {cel !== null
          ? <><span className="font-semibold capitalize">{NOME_LONGO[Math.floor(cel / 24)]}</span>, {cel % 24}h às {cel % 24 + 1}h: <span className="font-semibold tabular-nums">{dec(media[cel])}</span> contatos em média</>
          : <span className="text-muted-foreground">Passe o mouse ou toque num quadrado para ver a média daquela hora.</span>}
      </p>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground" aria-hidden>
        <span>menos</span>
        <span className="h-2 w-24 rounded-full" style={{ background: "linear-gradient(to right, hsl(217 91% 55% / 0.08), hsl(217 91% 55% / 0.9))" }} />
        <span>mais contatos</span>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Leads e conversas iniciadas pelos anúncios do Meta, pelo horário em que o Meta registrou o contato (fuso da conta de anúncio). Cada quadrado é a média de contatos naquela hora num dia daquele tipo, nas últimas 4 semanas completas. Use para ter alguém respondendo o WhatsApp e o Direct nos horários mais fortes.
      </p>
    </ChartCard>
  );
}
