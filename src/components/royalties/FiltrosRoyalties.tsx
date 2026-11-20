import { CalendarRange } from "lucide-react";
import { Chip } from "@/components/DateFilter";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { type ContextoRoyalties, type FiltroRoyalties, filtroInicial, saldoDe, brl0 } from "@/data/royalties";

const botao = (ativo: boolean) =>
  cn("rounded-lg px-3 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", ativo ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground");

/** Filtros do topo: período (de, até e atalhos por ano), modalidade, só devedoras e unidade. Tudo muda na hora, sem pedir nada ao servidor. */
export function FiltrosRoyalties({ c, f, onChange }: { c: ContextoRoyalties; f: FiltroRoyalties; onChange: (f: FiltroRoyalties) => void }) {
  const anos = [...new Set(c.keys.map((k) => k.slice(0, 4)))];
  const todo = f.de === 0 && f.ate === c.keys.length - 1;
  const anoAtivo = (a: string) => {
    const ks = c.keys.filter((k) => k.startsWith(a));
    return c.keys[f.de] === ks[0] && c.keys[f.ate] === ks[ks.length - 1];
  };
  const rotulo = (k: string) => c.rotulo[k] + (c.parcial.has(k) ? "*" : "");
  const opcoes = c.keys.map((k, i) => <option key={k} value={i}>{rotulo(k)}</option>).reverse();
  const mudou = JSON.stringify(f) !== JSON.stringify(filtroInicial(c));
  const unidades = c.m.unidades.map((u) => u.nome).filter((u) => (f.tipo === "all" || c.tipoDe[u] === f.tipo) && (!f.soDevedoras || saldoDe(c, u) > 0.005));

  return (
    <div className="card-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div role="group" aria-label="Período" className="flex flex-wrap items-center gap-2">
          <Chip id="royalties-de" rotulo="De" valor={rotulo(c.keys[f.de])} ativo icone={<CalendarRange className="h-4 w-4" />} value={String(f.de)}
            onChange={(v) => { const de = Number(v); onChange({ ...f, de, ate: Math.max(de, f.ate) }); }}>{opcoes}</Chip>
          <Chip id="royalties-ate" rotulo="Até" valor={rotulo(c.keys[f.ate])} ativo icone={<CalendarRange className="h-4 w-4" />} value={String(f.ate)}
            onChange={(v) => { const ate = Number(v); onChange({ ...f, ate, de: Math.min(f.de, ate) }); }}
            aoLimpar={todo ? undefined : () => onChange({ ...f, de: 0, ate: c.keys.length - 1 })} rotuloLimpar="Voltar a todo o período">{opcoes}</Chip>
        </div>
        <div role="group" aria-label="Atalhos de período" className="flex flex-wrap rounded-xl border border-border bg-white p-0.5">
          <button type="button" aria-pressed={todo} className={botao(todo)} onClick={() => onChange({ ...f, de: 0, ate: c.keys.length - 1 })}>Todos</button>
          {anos.map((a) => {
            const ks = c.keys.filter((k) => k.startsWith(a));
            return <button key={a} type="button" aria-pressed={anoAtivo(a)} className={botao(anoAtivo(a))} onClick={() => onChange({ ...f, de: c.keys.indexOf(ks[0]), ate: c.keys.indexOf(ks[ks.length - 1]) })}>{a}</button>;
          })}
        </div>
        <div role="group" aria-label="Modalidade" className="flex rounded-xl border border-border bg-white p-0.5">
          {([["all", "Todas"], ["fixa", "Taxa fixa"], ["royalties", "Royalties"]] as const).map(([v, r]) => (
            <button key={v} type="button" aria-pressed={f.tipo === v} className={botao(f.tipo === v)} onClick={() => onChange({ ...f, tipo: v, unidades: v === "all" ? f.unidades : f.unidades.filter((u) => c.tipoDe[u] === v) })}>{r}</button>
          ))}
        </div>
        <div role="group" aria-label="Quais unidades" className="flex rounded-xl border border-border bg-white p-0.5">
          <button type="button" aria-pressed={!f.soDevedoras} className={botao(!f.soDevedoras)} onClick={() => onChange({ ...f, soDevedoras: false })}>Todas</button>
          <button type="button" aria-pressed={f.soDevedoras} className={botao(f.soDevedoras)} onClick={() => onChange({ ...f, soDevedoras: true, unidades: f.unidades.filter((u) => saldoDe(c, u) > 0.005) })}>Só devedoras</button>
        </div>
        <label className="text-xs text-muted-foreground">
          Unidade
          <Select aria-label="Unidade" className="mt-1 h-9 w-56" value={f.unidades[0] ?? ""} onChange={(e) => onChange({ ...f, unidades: e.target.value ? [e.target.value] : [] })}>
            <option value="">Todas as unidades</option>
            {unidades.map((u) => <option key={u} value={u}>{u}{saldoDe(c, u) > 0.005 ? ` · deve ${brl0(saldoDe(c, u))}` : ""}</option>)}
          </Select>
        </label>
        {mudou && <button type="button" onClick={() => onChange(filtroInicial(c))} className="pb-2 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">Limpar filtros</button>}
      </div>
    </div>
  );
}
