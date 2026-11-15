// Antes de o app carregar: quem já tem sessão guardada neste navegador vê a abertura clara (combina com o painel);
// quem não tem vê a azul, que é a do login. Arquivo à parte porque a política de conteúdo não aceita script dentro do HTML.
try { if (localStorage.getItem("wg-dashboard-token")) document.documentElement.setAttribute("data-claro", "1"); } catch (e) { /* sem armazenamento: fica a azul */ }
