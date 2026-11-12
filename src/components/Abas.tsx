/** Uma aba dentro de um menu (submenu): id curto, que vai no endereço (#financeiro/notas), e o rótulo. */
export interface Aba { id: string; rotulo: string }

/** A aba ativa: a pedida no endereço, se existir nesta tela; senão a primeira. */
export const abaAtiva = (abas: Aba[], pedida: string | null) => abas.find((a) => a.id === pedida)?.id ?? abas[0].id;

/**
 * Faixa de abas no topo do conteúdo de um menu, no modelo da Naya: só texto, sublinhado na ativa, igual no computador e
 * no celular (no celular rola para o lado). Os filtros do topo (mês, comparação, unidade) valem para todas as abas.
 */
export function Abas({ tela, titulo, abas, ativa, onChange }: { tela: string; titulo: string; abas: Aba[]; ativa: string; onChange: (id: string) => void }) {
  return (
    <nav aria-label={`Seções de ${titulo}`} className="no-print mb-6 flex items-center gap-1 overflow-x-auto border-b border-border">
      {abas.map((a) => {
        const on = a.id === ativa;
        return (
          <a
            key={a.id}
            href={`#${tela}/${a.id}`}
            onClick={(e) => { e.preventDefault(); onChange(a.id); }}
            aria-current={on ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${on ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"}`}
          >
            {a.rotulo}
          </a>
        );
      })}
    </nav>
  );
}
