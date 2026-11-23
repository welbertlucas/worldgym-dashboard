import { CHAVE_STREET_VIEW, urlStreetView } from "@/components/estudos/mapaComum";

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
