// Antes de o app carregar: quem já tem sessão guardada neste navegador, e ainda dentro do prazo, vê a abertura clara (combina com o painel);
// quem não tem, ou cujo login já venceu, vê a azul, que é a do login. Arquivo à parte porque a política de conteúdo não aceita script dentro do HTML.
try {
  var t = localStorage.getItem("wg-dashboard-token");
  if (t) {
    var p = t.split("."), e = p[0] === "v2" ? JSON.parse(atob(p[1].replace(/-/g, "+").replace(/_/g, "/"))).e : p[0];
    if (Number(e) > Date.now()) document.documentElement.setAttribute("data-claro", "1");
  }
} catch (err) { /* sem armazenamento ou token ilegível: fica a azul */ }
