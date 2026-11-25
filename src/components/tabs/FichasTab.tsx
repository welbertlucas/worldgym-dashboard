import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { API_BASE, authFetch } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { reais } from "@/lib/estudoPonto";
import { type FichaSalva, type UnidadeFicha, aluguelPorM2, contratoAVencer, diasParaFimDoContrato, ordenarFichas, pesoDoAluguel, resumoDoAluguel } from "@/lib/fichas";
import { hojeLocal } from "@/lib/obras";

type Estado = { fase: "carregando" } | { fase: "erro"; motivo: "permissao" | "falha" } | { fase: "pronto"; unidades: UnidadeFicha[] };

/** Pede as fichas à API. Só o dono recebe: aluguel é dado comercial, conferido no servidor a cada pedido. */
export async function carregarFichas(): Promise<Estado> {
  try {
    const res = await authFetch(`${API_BASE}/fichas`);
    if (res.status === 403) return { fase: "erro", motivo: "permissao" };
    if (!res.ok) return { fase: "erro", motivo: "falha" };
    return { fase: "pronto", unidades: ((await res.json()) as { unidades: UnidadeFicha[] }).unidades ?? [] };
  } catch {
    return { fase: "erro", motivo: "falha" };
  }
}

const NOME_MODELO = { low: "Low Cost", pro: "Pro" } as const;
const dataBR = (s: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "—");
const mesAno = (s: string | null) => (s ? `${s.slice(5, 7)}/${s.slice(0, 4)}` : "—");
const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })}`;
const m2 = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/m²`;

export function FichasConteudo({ unidades, abrir, hoje = hojeLocal() }: { unidades: UnidadeFicha[]; abrir: (u: UnidadeFicha) => void; hoje?: string }) {
  const r = resumoDoAluguel(unidades);
  return (
    <div className="space-y-4">
      <div className="card-surface px-4 py-3">
        <p className="text-sm"><span className="font-display text-2xl tabular-nums">{r.levantadas}</span> <span className="text-muted-foreground">de {r.total} unidades com o aluguel levantado</span></p>
        {r.porModelo.length > 0
          ? <ul className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-muted-foreground">{r.porModelo.map((x) => <li key={x.modelo}><b className="text-foreground">{NOME_MODELO[x.modelo]}</b>: mediana {m2(x.mediana)} (de {m2(x.minimo)} a {m2(x.maximo)}, {x.n} {x.n === 1 ? "unidade" : "unidades"})</li>)}</ul>
          : <p className="mt-1 text-[12px] text-muted-foreground">Quando houver aluguel levantado, a mediana por m² de cada modelo aparece aqui. É o número que corrige o aluguel real no payback dos Estudos de ponto.</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {ordenarFichas(unidades).map((u) => {
          const a = u.ficha?.aluguel ?? null, pm = aluguelPorM2(u), pv = pesoDoAluguel(u), dias = diasParaFimDoContrato(u, hoje), vence = contratoAVencer(u, hoje);
          return (
            <button key={u.nome} type="button" onClick={() => abrir(u)}
              className="card-surface flex flex-col gap-1.5 px-4 py-3 text-left transition hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-[14px] font-semibold">{u.nome}</p>
                {a === null && <span className="whitespace-nowrap rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">Sem aluguel</span>}
              </div>
              <p className="text-[12px] text-muted-foreground">{NOME_MODELO[u.modelo]}{u.m2 ? ` · ${u.m2.toLocaleString("pt-BR")} m²` : " · m² não informado"} · aberta em {mesAno(u.abertura)}</p>
              {a !== null ? (
                <div className="text-[12px] text-muted-foreground">
                  <p><span className="text-[15px] font-semibold tabular-nums text-foreground">{brl(a)}</span> por mês{pm !== null && <span> · {m2(pm)}</span>}</p>
                  {pv !== null && <p>{Math.round(pv * 100)}% das vendas mensais</p>}
                </div>
              ) : <p className="text-[12px] text-muted-foreground">Clique para informar o aluguel mensal.</p>}
              {u.ficha?.contratoAte && (
                <p className={cn("text-[12px]", vence ? "font-medium text-destructive" : "text-muted-foreground")}>
                  Contrato até {dataBR(u.ficha.contratoAte)}{dias !== null && vence ? (dias < 0 ? " · vencido" : ` · vence em ${dias} ${dias === 1 ? "dia" : "dias"}`) : ""}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const campo = "h-9 w-full rounded-md border border-border bg-background px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring";

function FichaDialog({ u, salvar, fechar }: { u: UnidadeFicha; salvar: (nome: string, f: FichaSalva) => Promise<void>; fechar: () => void }) {
  const [aluguel, setAluguel] = useState(u.ficha?.aluguel != null ? String(u.ficha.aluguel) : "");
  const [contratoAte, setContratoAte] = useState(u.ficha?.contratoAte ?? "");
  const [obs, setObs] = useState(u.ficha?.obs ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const previa = aluguel && u.m2 ? Number(aluguel.replace(",", ".")) / u.m2 : null;
  const guardar = async () => {
    setErro(null); setOcupado(true);
    try { await salvar(u.nome, { aluguel: aluguel.trim() === "" ? null : Number(aluguel.replace(",", ".")), contratoAte: contratoAte || null, obs }); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não consegui salvar agora."); setOcupado(false); }
  };
  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={`Ficha de ${u.nome}`}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div><h3 className="font-display text-xl font-medium">{u.nome}</h3><p className="text-sm text-muted-foreground">{NOME_MODELO[u.modelo]}{u.m2 ? ` · ${u.m2.toLocaleString("pt-BR")} m²` : ""} · aberta em {mesAno(u.abertura)}{u.vendas ? ` · vendas de ${reais(u.vendas)} por mês` : ""}</p></div>
          <Button variant="ghost" onClick={fechar}>Fechar</Button>
        </div>
        {erro && <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
        <div className="mt-4 space-y-3">
          <label className="block text-[12px] text-muted-foreground">Aluguel mensal (R$)
            <input value={aluguel} onChange={(e) => setAluguel(e.target.value)} inputMode="decimal" className={campo} placeholder="Ex.: 18500" />
            {previa !== null && Number.isFinite(previa) && <span className="mt-1 block text-[12px]">Dá {m2(previa)} pelo m² das premissas{u.vendas && Number(aluguel.replace(",", ".")) ? `; ${Math.round((Number(aluguel.replace(",", ".")) / u.vendas) * 100)}% das vendas mensais` : ""}.</span>}
          </label>
          <label className="block text-[12px] text-muted-foreground">Contrato de locação vai até<input type="date" value={contratoAte} onChange={(e) => setContratoAte(e.target.value)} className={campo} /></label>
          <label className="block text-[12px] text-muted-foreground">Observações (reajuste, carência, quem é o locador)
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} maxLength={600} rows={3} className={cn(campo, "h-auto py-2")} /></label>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">Fica guardado só no Atlas, com acesso do dono. O m², o modelo e a abertura vêm das premissas dos Estudos de ponto.</p>
        <div className="mt-4"><Button onClick={guardar} disabled={ocupado}>{ocupado ? "Salvando…" : "Salvar"}</Button></div>
      </div>
    </div>
  );
}

export function FichasTab() {
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [aberta, setAberta] = useState<UnidadeFicha | null>(null);
  useEffect(() => { let vivo = true; carregarFichas().then((e) => { if (vivo) setEstado(e); }); return () => { vivo = false; }; }, []);
  const salvar = async (nome: string, ficha: FichaSalva) => {
    const res = await authFetch(`${API_BASE}/fichas`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "salvar", unidade: nome, ficha }) });
    if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Não consegui salvar agora.");
    setAberta(null);
    setEstado(await carregarFichas());
  };
  if (estado.fase === "carregando") return <p className="text-sm text-muted-foreground">Carregando as fichas das unidades…</p>;
  if (estado.fase === "erro") return <p className="rounded-xl border bg-white p-6 text-sm text-muted-foreground">{estado.motivo === "permissao" ? "Só o dono vê as fichas das unidades." : "Não consegui carregar as fichas agora. Tente de novo em instantes."}</p>;
  return (
    <>
      <FichasConteudo unidades={estado.unidades} abrir={setAberta} />
      {aberta && <FichaDialog key={aberta.nome} u={aberta} salvar={salvar} fechar={() => setAberta(null)} />}
    </>
  );
}
