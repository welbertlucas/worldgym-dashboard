import { CHAVE_STREET_VIEW, urlStreetView } from "@/components/estudos/mapaComum";

/** Boneco do Street View (formato do Google), preenchido na cor do texto: preto no botão, branco quando ligado. */
export function IconeBoneco() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="4.3" r="2.7" />
      <path d="M8.6 8h6.8A1.9 1.9 0 0 1 17.3 9.9v5.2a1.1 1.1 0 0 1-1.1 1.1h-1.3V21a1.3 1.3 0 0 1-1.3 1.3h-3.2A1.3 1.3 0 0 1 9.1 21v-4.8H7.8a1.1 1.1 0 0 1-1.1-1.1V9.9A1.9 1.9 0 0 1 8.6 8Z" />
    </svg>
  );
}

/** Street View dentro da tela (Maps Embed API, grátis). Sem a chave configurada, oferece abrir no Google Maps. */
export function StreetView({ ponto, fechar }: { ponto: [number, number]; fechar: () => void }) {
  return (
    <div className="absolute inset-y-3 right-3 z-[600] flex w-[min(46%,560px)] flex-col overflow-hidden rounded-xl bg-white shadow-2xl max-md:inset-x-3 max-md:bottom-3 max-md:top-auto max-md:h-[60%] max-md:w-auto" role="dialog" aria-label="Ver a rua">
      <div className="flex items-center justify-between border-b px-3 py-2 text-sm">
        <span className="font-medium">Ver a rua</span>
        <button type="button" onClick={fechar} className="rounded-lg px-2.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">Fechar</button>
      </div>
      {CHAVE_STREET_VIEW ? (
        <iframe title="Street View do ponto" src={urlStreetView(ponto)} className="h-full w-full flex-1 border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
          <p>O Street View dentro do Atlas aparece quando a chave do Google estiver configurada.</p>
          <a href={urlStreetView(ponto)} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-foreground px-3 py-2 font-medium text-background">Abrir no Google Maps</a>
        </div>
      )}
    </div>
  );
}
