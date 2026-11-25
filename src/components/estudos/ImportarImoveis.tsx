// Importar imóveis candidatos por planilha (CSV), como o "Meus dados" do Mapfry: lê o arquivo, busca a posição de cada endereço (Google ou Mapbox,
// pelo servidor), deixa o dono conferir e descartar o que caiu no lugar errado e cria um estudo por imóvel, já com o parecer na lista.
import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";
import { API_BASE, authFetch } from "@/lib/auth";
import { MAX_IMOVEIS_POR_IMPORTACAO, lerCsv, lerImoveis, tirarRepetidos, type ImovelImportado } from "@/lib/importarImoveis";
import { enderecoCurto } from "@/components/estudos/sugestoes";
import { reais, type DadosEstudos, type Modelo, type Ponto } from "@/lib/estudoPonto";

type Linha = ImovelImportado & { achado: string | null; usar: boolean; repetido: boolean };
type Etapa = "arquivo" | "conferir" | "buscando" | "revisar";
const COLUNAS = [["endereco", "Endereço"], ["nome", "Nome ou código"], ["m2", "m²"], ["aluguel", "Aluguel"], ["lat", "Latitude"], ["lng", "Longitude"], ["link", "Link"], ["obs", "Observações"], ["modelo", "Modelo"]] as const;

export function ImportarImoveis({ dados, pontos, criar, fechar }: { dados: DadosEstudos; pontos: Ponto[]; criar: (novos: Ponto[]) => void; fechar: () => void }) {
  const [etapa, setEtapa] = useState<Etapa>("arquivo");
  const [leitura, setLeitura] = useState<ReturnType<typeof lerImoveis> | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [modeloPadrao, setModeloPadrao] = useState<Modelo>("low");
  const [erro, setErro] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const padrao = (m: Modelo) => dados.premissas?.modelos[m].padraoM2 ?? 1000;

  const abrirArquivo = async (f: File | undefined) => {
    if (!f) return;
    setErro(null);
    if (f.size > 1_000_000) { setErro("O arquivo é grande demais para uma importação (até 1 MB)."); return; }
    const l = lerImoveis(lerCsv(await f.text()));
    setNomeArquivo(f.name); setLeitura(l);
    if (!l.imoveis.length) { setErro(l.avisos[0] ?? "Não achei nenhum imóvel no arquivo."); return; }
    setEtapa("conferir");
  };

  const buscar = async () => {
    if (!leitura) return;
    setEtapa("buscando"); setErro(null);
    const base: Linha[] = leitura.imoveis.map((i) => ({ ...i, achado: null, usar: !!i.c, repetido: false }));
    try {
      const pedir = base.map((l, i) => ({ i, q: l.endereco })).filter((x) => !base[x.i].c);
      if (pedir.length) {
        // uma região de referência melhora a busca de endereço curto: a das unidades da rede
        const r = await authFetch(`${API_BASE}/estudos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "geocodificar-lote", itens: pedir }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "Não consegui buscar os endereços agora.");
        for (const { i, lugar } of j.resultados as { i: number; lugar: { endereco: string; c: [number, number] } | null }[]) {
          if (lugar) { base[i].c = lugar.c; base[i].achado = lugar.endereco; base[i].usar = true; }
        }
      }
      const comPos = base.map((l, i) => ({ l, i })).filter((x) => x.l.c);
      const { repetidos } = tirarRepetidos(comPos.map((x) => ({ c: x.l.c! })), pontos.map((p) => p.c));
      for (const k of repetidos) { const l = base[comPos[k].i]; l.repetido = true; l.usar = false; }
      setLinhas(base); setEtapa("revisar");
    } catch (e) { setErro(e instanceof Error ? e.message : "Não consegui buscar os endereços agora."); setEtapa("conferir"); }
  };

  const confirmar = () => {
    const agora = new Date().toISOString();
    const novos: Ponto[] = linhas.filter((l) => l.usar && l.c).map((l, k) => {
      const modelo = l.modelo ?? modeloPadrao;
      const endereco = l.achado ? enderecoCurto(l.achado) : l.endereco;
      const origem = { ...(l.aluguel ? { aluguel: Math.round(l.aluguel) } : {}), ...(l.link ? { link: l.link } : {}), ...(l.obs ? { obs: l.obs } : {}) };
      return {
        id: `p${(Date.now() + k).toString(36)}`, nome: l.nome.slice(0, 60) || `Imóvel ${k + 1}`,
        ...(endereco ? { regiao: endereco.slice(0, 60), endereco: endereco.slice(0, 160) } : {}),
        criadoEm: agora, atualizadoEm: agora, decisao: { status: "analise" as const, em: agora }, c: l.c!, modelo, m2: l.m2 ?? padrao(modelo),
        imovel: { fachada: false, estacionamento: false, polo: false, aPe: false }, ...(Object.keys(origem).length ? { origem } : {}),
      };
    });
    if (novos.length) criar(novos);
    fechar();
  };

  const marcados = linhas.filter((l) => l.usar).length;
  const semPosicao = linhas.filter((l) => !l.c).length;
  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Importar imóveis">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div><h3 className="font-display text-xl font-medium">Importar imóveis</h3><p className="text-sm text-muted-foreground">Planilha em CSV com um imóvel por linha. Cada um vira um estudo com o parecer na lista.</p></div>
          <Button variant="ghost" onClick={fechar}>Fechar</Button>
        </div>

        {erro && <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}

        {etapa === "arquivo" && <div className="mt-4 space-y-3 text-sm">
          <p>Cabeçalho na primeira linha. Reconheço estas colunas (pelo nome, em qualquer ordem): <strong>endereço</strong> (ou latitude e longitude), nome ou código, m², aluguel, link, observações e modelo (low ou pro). Até {MAX_IMOVEIS_POR_IMPORTACAO} imóveis por vez.</p>
          <input ref={entrada} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => abrirArquivo(e.target.files?.[0])} />
          <Button onClick={() => entrada.current?.click()}>Escolher arquivo CSV</Button>
          <p className="text-xs text-muted-foreground">No Google Planilhas ou no Excel: Arquivo, Fazer download (ou Salvar como), CSV.</p>
        </div>}

        {etapa === "conferir" && leitura && <div className="mt-4 space-y-3 text-sm">
          <p><strong>{nomeArquivo}</strong>: {leitura.imoveis.length} {leitura.imoveis.length === 1 ? "imóvel" : "imóveis"}{leitura.truncado ? ` (só os primeiros ${MAX_IMOVEIS_POR_IMPORTACAO}; o resto fica para a próxima importação)` : ""}.</p>
          <div className="flex flex-wrap gap-1.5">{COLUNAS.map(([c, rotulo]) => <span key={c} className={`rounded-full px-2 py-0.5 text-xs ${leitura.colunas[c] >= 0 ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{rotulo}{leitura.colunas[c] >= 0 ? "" : ": não achei"}</span>)}</div>
          {leitura.avisos.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">{leitura.avisos.slice(0, 8).map((a) => <li key={a}>{a}</li>)}{leitura.avisos.length > 8 && <li>e mais {leitura.avisos.length - 8} avisos</li>}</ul>}
          <label className="flex items-center gap-2">Modelo dos imóveis sem a coluna de modelo:
            <select className="rounded-md border border-border bg-background px-2 py-1" value={modeloPadrao} onChange={(e) => setModeloPadrao(e.target.value as Modelo)}><option value="low">Low Cost</option><option value="pro">Pro</option></select>
          </label>
          <p className="rounded-md bg-muted px-3 py-2 text-xs">Para achar a posição, os {leitura.imoveis.filter((i) => !i.c).length} endereços sem coordenadas são enviados ao serviço de mapas (Google ou Mapbox), sem nome de pessoa nem outros dados. Você confere o resultado antes de criar os estudos.</p>
          <div className="flex gap-2"><Button onClick={buscar}>Buscar posições</Button><Button variant="outline" onClick={() => { setEtapa("arquivo"); setLeitura(null); }}>Trocar arquivo</Button></div>
        </div>}

        {etapa === "buscando" && <p className="mt-6 text-sm text-muted-foreground">Buscando a posição dos endereços…</p>}

        {etapa === "revisar" && <div className="mt-4 space-y-3 text-sm">
          <p>{marcados} de {linhas.length} {linhas.length === 1 ? "imóvel marcado" : "imóveis marcados"} para virar estudo{semPosicao ? `; ${semPosicao} sem posição (desmarcados)` : ""}. Desmarque o que caiu no lugar errado.</p>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted text-muted-foreground"><tr><th className="p-2" /><th className="p-2">Imóvel</th><th className="p-2">Endereço da planilha</th><th className="p-2">Onde o mapa achou</th><th className="p-2 text-right">m²</th><th className="p-2 text-right">Aluguel</th></tr></thead>
              <tbody>{linhas.map((l, i) => (
                <tr key={l.linha} className="border-t border-border align-top">
                  <td className="p-2"><input type="checkbox" checked={l.usar} disabled={!l.c} aria-label={`Usar ${l.nome}`} onChange={(e) => setLinhas((ls) => ls.map((x, k) => (k === i ? { ...x, usar: e.target.checked } : x)))} /></td>
                  <td className="p-2 font-medium">{l.nome}</td>
                  <td className="p-2">{l.endereco || "coordenadas da planilha"}</td>
                  <td className="p-2">{!l.c ? <span className="text-destructive">não achei</span> : l.repetido ? <span className="text-warning">já existe um estudo a menos de 30 m</span> : l.achado ? enderecoCurto(l.achado) : "coordenadas da planilha"}</td>
                  <td className="p-2 text-right">{l.m2 ?? `${padrao(l.modelo ?? modeloPadrao)} (padrão)`}</td>
                  <td className="p-2 text-right">{l.aluguel ? reais(l.aluguel) : "—"}</td>
                </tr>))}</tbody>
            </table>
          </div>
          <div className="flex gap-2"><Button onClick={confirmar} disabled={!marcados}>Criar {marcados} {marcados === 1 ? "estudo" : "estudos"}</Button><Button variant="outline" onClick={() => setEtapa("conferir")}>Voltar</Button></div>
        </div>}
      </div>
    </div>
  );
}
