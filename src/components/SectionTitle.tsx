export function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-4 sm:mb-5">
      <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">{children}</h2>
      {hint && <p className="text-sm text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}
