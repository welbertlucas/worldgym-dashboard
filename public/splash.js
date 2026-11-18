// Endereço antigo (GitHub Pages): manda para o domínio do Atlas, mantendo a tela (#menu/aba) e o resto do link. O GitHub Pages não
// redireciona no servidor, então isto roda antes de qualquer outra coisa. Na Vercel e no computador do desenvolvedor não faz nada.
if (location.hostname === "welbertlucas.github.io") location.replace("https://atlas.worldgymacademia.com.br/" + location.search + location.hash);

// Antes de o app carregar: quem já tem sessão guardada neste navegador, e ainda dentro do prazo, vê a abertura clara (combina com o painel);
// quem não tem, ou cujo login já venceu, vê a azul, que é a do login. Arquivo à parte porque a política de conteúdo não aceita script dentro do HTML.
try {
  var t = localStorage.getItem("wg-dashboard-token");
  if (t) {
    var p = t.split("."), e = p[0] === "v2" ? JSON.parse(atob(p[1].replace(/-/g, "+").replace(/_/g, "/"))).e : p[0];
    if (Number(e) > Date.now()) document.documentElement.setAttribute("data-claro", "1");
  }
} catch (err) { /* sem armazenamento ou token ilegível: fica a azul */ }
