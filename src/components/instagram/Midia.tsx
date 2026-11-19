import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { imagemInstagram } from "@/data/instagram";
import { cn } from "@/lib/utils";

/** Imagem guardada de um post/story; só busca quando aparece na tela. Sem imagem guardada, o começo da legenda (se houver) ou um quadro neutro com ícone. */
export function Miniatura({ id, temMidia, className, alt, legenda }: { id: string; temMidia?: boolean | null; className?: string; alt: string; legenda?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!temMidia || !ref.current) return;
    let vivo = true;
    const ver = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      ver.disconnect();
      imagemInstagram(id).then((u) => vivo && setSrc(u));
    }, { rootMargin: "200px" });
    ver.observe(ref.current);
    return () => { vivo = false; ver.disconnect(); };
  }, [id, temMidia]);
  return (
    <div ref={ref} className={cn("overflow-hidden bg-secondary", className)}>
      {src ? <img src={src} alt={alt} className="h-full w-full object-cover" />
        : !temMidia && legenda?.trim() ? (
          <span className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center text-muted-foreground">
            <ImageIcon className="h-5 w-5 shrink-0 opacity-50" aria-hidden />
            <span className="text-[11px] leading-snug" style={{ display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{legenda.trim()}</span>
          </span>
        ) : <span className="flex h-full w-full items-center justify-center text-muted-foreground/50"><ImageIcon className="h-6 w-6" aria-hidden /></span>}
    </div>
  );
}

/** Foto de perfil da conta; se o endereço do Meta venceu ou não existe, a inicial da unidade num círculo cinza. */
export function Avatar({ foto, nome, className }: { foto: string | null; nome: string; className?: string }) {
  const [falhou, setFalhou] = useState(false);
  const inicial = (nome.replace(/^@/, "").match(/[A-Za-zÀ-ú]/)?.[0] ?? "?").toUpperCase();
  return (
    <span className={cn("relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary font-display text-base font-semibold text-muted-foreground ring-1 ring-border", className)} aria-hidden>
      {foto && !falhou ? <img src={foto} alt="" referrerPolicy="no-referrer" onError={() => setFalhou(true)} className="h-full w-full object-cover" /> : inicial}
    </span>
  );
}
