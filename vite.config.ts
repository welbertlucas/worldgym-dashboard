import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  // GitHub Pages serve em /worldgym-dashboard/; na Vercel (VERCEL=1 no build) o site fica na raiz.
  base: process.env.VERCEL ? "/" : "/worldgym-dashboard/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
