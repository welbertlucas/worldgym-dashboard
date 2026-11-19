import { Clapperboard, GalleryHorizontal, Image as ImageIcon, Video } from "lucide-react";

/** Ícone de cada tipo de post (o mesmo nas barras, nos destaques e nos filtros do feed). */
export const ICONE_TIPO: Record<string, typeof ImageIcon> = { REELS: Clapperboard, CAROUSEL_ALBUM: GalleryHorizontal, IMAGE: ImageIcon, VIDEO: Video };
