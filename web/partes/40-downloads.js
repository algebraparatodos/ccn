// ── Traducción de la página de descargas ──────────────────
//
// Kajabi muestra "Files" y "Download All" en inglés y no deja
// traducirlos. Copiado tal cual de lo que estaba pegado en Kajabi.
//
// Sale enseguida si la URL no es /downloads/, así que en el resto del
// sitio no cuesta nada.

(function () {
  if (!window.location.pathname.startsWith('/downloads/')) return;

  var traducciones = {
    'Files': 'Archivos',
    'Download All': 'Descargar todo'
  };

  function traducirNodo(nodo) {
    if (nodo.nodeType === Node.TEXT_NODE) {
      var texto = nodo.nodeValue.trim();
      if (traducciones[texto]) {
        nodo.nodeValue = nodo.nodeValue.replace(texto, traducciones[texto]);
      }
      var match = nodo.nodeValue.match(/^(\d+)\s+files?(\s*[•·]\s*.+)?$/);
      if (match) {
        var cantidad = match[1];
        var resto = match[2] || '';
        nodo.nodeValue = cantidad + ' archivo' + (cantidad === '1' ? '' : 's') + resto;
      }
    } else if (nodo.nodeType === Node.ELEMENT_NODE) {
      nodo.childNodes.forEach(traducirNodo);
    }
  }

  function iniciar() {
    if (!document.body) {
      setTimeout(iniciar, 50);
      return;
    }
    traducirNodo(document.body);
    var observer = new MutationObserver(function () {
      traducirNodo(document.body);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  iniciar();
})();
