import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { baixarFoto, baixarSelfie } from "@/lib/qualidade";

/** Miniatura de uma foto guardada no servidor (a rota exige login, então a imagem é baixada com a sessão). Clicar abre grande. */
export function FotoGuardada({ id, selfie = false }: { id: string; /** Foto de selfie do check-in (outro endereço, só dono e quem edita). */ selfie?: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  const [aberta, setAberta] = useState(false);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    let vivo = true;
    let url: string | null = null;
    (selfie ? baixarSelfie(id) : baixarFoto(id)).then((u) => { if (!vivo) { if (u) URL.revokeObjectURL(u); return; } url = u; if (u) setSrc(u); else setFalhou(true); });
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); };
  }, [id]);
  useEffect(() => {
    if (!aberta) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberta(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [aberta]);
  if (falhou) return <span className="inline-flex h-16 w-16 items-center justify-center rounded-lg bg-secondary text-[10px] text-muted-foreground">sem foto</span>;
  if (!src) return <span className="inline-block h-16 w-16 animate-pulse rounded-lg bg-secondary" aria-hidden />;
  return (
    <>
      <button type="button" onClick={() => setAberta(true)} className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Ampliar a foto">
        <img src={src} alt="Foto da visita" className="h-16 w-16 rounded-lg object-cover" />
      </button>
      {aberta && (
        <div role="dialog" aria-modal="true" aria-label="Foto da visita" onClick={() => setAberta(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <img src={src} alt="Foto da visita ampliada" className="max-h-full max-w-full rounded-lg" />
          <button type="button" onClick={() => setAberta(false)} aria-label="Fechar" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white text-foreground"><X className="h-4 w-4" aria-hidden /></button>
        </div>
      )}
    </>
  );
}
