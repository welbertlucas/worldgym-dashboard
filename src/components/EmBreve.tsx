import { ChartCard } from "@/components/ChartCard";

/** Selo pequeno "Em breve" para telas que ainda vão ser feitas. */
export function SeloEmBreve() {
  return <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Em breve</span>;
}

/** Tela reservada: o título, o selo "Em breve" e uma linha dizendo o que vem. */
export function EmBreve({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <ChartCard title={titulo} subtitle={descricao} legend={<SeloEmBreve />}>
      <p className="rounded-xl bg-secondary/40 px-4 py-6 text-sm text-muted-foreground">Esta tela ainda está em construção.</p>
    </ChartCard>
  );
}
