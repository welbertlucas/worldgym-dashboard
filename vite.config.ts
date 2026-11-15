import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Política de conteúdo: o navegador só roda script do próprio Atlas e só fala com o próprio Atlas e a API.
// Estilo inline fica liberado (o React usa style=""); imagens vêm de qualquer https (criativos do Meta e fotos do Instagram).
const POLITICA = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://worldgym-dashboard-sigma.vercel.app",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export default defineConfig({
  // GitHub Pages serve em /worldgym-dashboard/; na Vercel (VERCEL=1 no build) o site fica na raiz.
  base: process.env.VERCEL ? "/" : "/worldgym-dashboard/",
  plugins: [
    react(),
    // Só no build: no desenvolvimento o Vite injeta script inline (recarga a quente) e a política o bloquearia.
    { name: "politica-de-conteudo", apply: "build", transformIndexHtml: () => [{ tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: POLITICA }, injectTo: "head-prepend" as const }] },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
