import { CHAVE_STREET_VIEW, urlStreetView } from "@/components/estudos/mapaComum";
import { Button, buttonVariants } from "@/components/ui/button";

/** Boneco do Street View (formato do Google), preenchido na cor do texto: preto no botão, branco quando ligado. */
export function IconeBoneco() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="4.3" r="2.7" />
      <path d="M8.6 8h6.8A1.9 1.9 0 0 1 17.3 9.9v5.2a1.1 1.1 0 0 1-1.1 1.1h-1.3V21a1.3 1.3 0 0 1-1.3 1.3h-3.2A1.3 1.3 0 0 1 9.1 21v-4.8H7.8a1.1 1.1 0 0 1-1.1-1.1V9.9A1.9 1.9 0 0 1 8.6 8Z" />
    </svg>
  );
}

/**
 * Street View dentro da tela (Maps Embed API, grátis), como no Google: o mapa sai e a rua ocupa o lugar dele, com o botão de fechar no canto.
 * Sem a chave configurada, oferece abrir no Google Maps. O quadro só carrega porque a política de conteúdo (vite.config.ts) libera
 * `frame-src https://www.google.com`.
 */
export function StreetView({ ponto, fechar }: { ponto: [number, number]; fechar: () => void }) {
  return (
    <div className="absolute inset-0 z-[700] bg-white" role="dialog" aria-label="Ver a rua">
      {CHAVE_STREET_VIEW ? (
        <iframe title="Street View do ponto" src={urlStreetView(ponto)} className="absolute inset-0 h-full w-full border-0" referrerPolicy="no-referrer-when-downgrade" allow="fullscreen" allowFullScreen />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
          <p>O Street View dentro do Atlas aparece quando a chave do Google estiver configurada.</p>
          <a href={urlStreetView(ponto)} target="_blank" rel="noopener noreferrer" className={buttonVariants()}>Abrir no Google Maps</a>
        </div>
      )}
      <Button size="sm" variant="secondary" onClick={fechar} className="absolute left-1/2 top-3 z-10 -translate-x-1/2 bg-white shadow-lg" aria-label="Fechar o Street View">Fechar</Button>
    </div>
  );
}
