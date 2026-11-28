/**
 * Depois de um deploy, os arquivos do site mudam de nome (o hash no nome). Uma aba aberta antes dele, ao carregar uma parte que
 * ainda não tinha usado (o gerador de PDF, o de PowerPoint...), pede o arquivo antigo e recebe "Failed to fetch dynamically
 * imported module". O Vite avisa com o evento `vite:preloadError`: aqui a página recarrega sozinha, uma vez, e passa a usar a versão nova.
 * Se o arquivo continuar faltando logo depois de recarregar (falha de rede, arquivo de fato quebrado), não recarrega de novo:
 * o erro aparece normalmente, sem a página ficar recarregando sem parar.
 */
export const CHAVE_RECARGA = "atlas:recarga-por-versao";
/** Intervalo mínimo entre duas recargas automáticas. */
export const INTERVALO_RECARGA_MS = 60_000;

type Armazenamento = Pick<Storage, "getItem" | "setItem">;

/** Decide se recarrega (e anota quando recarregou). Devolve true quando a página deve recarregar. */
export function deveRecarregar(armazenamento: Armazenamento | null, agora = Date.now()): boolean {
  try {
    const ultima = Number(armazenamento?.getItem(CHAVE_RECARGA) ?? 0);
    if (ultima && agora - ultima < INTERVALO_RECARGA_MS) return false;
    armazenamento?.setItem(CHAVE_RECARGA, String(agora));
  } catch {
    // Sem sessionStorage (janela privada, bloqueio do navegador): recarrega uma vez mesmo assim.
  }
  return true;
}

/** Liga o tratamento no navegador. Chamada uma vez, no início do site. */
export function recarregarAposDeploy(janela: Window = window): void {
  janela.addEventListener("vite:preloadError", (evento) => {
    let armazenamento: Storage | null = null;
    try { armazenamento = janela.sessionStorage; } catch { armazenamento = null; }
    if (!deveRecarregar(armazenamento)) return; // deixa o erro seguir para a tela
    evento.preventDefault(); // não mostra o erro: a página vai recarregar
    janela.location.reload();
  });
}
