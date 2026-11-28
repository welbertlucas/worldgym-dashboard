import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { recarregarAposDeploy } from "./lib/recarregarAposDeploy";

// Aba aberta antes de um deploy: recarrega sozinha quando pede um arquivo da versão anterior (ex.: o gerador de PDF).
recarregarAposDeploy();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
