// ── ManyChat ──────────────────────────────────────────────
//
// Dos etiquetas que en Kajabi iban con `defer`. Acá se crean a mano y
// quedan asíncronas: no hay nada que dependa del orden entre ellas ni
// de cuándo terminan, así que da igual.

(function () {
  CCN.cargarScript("https://widget.manychat.com/1328201_60b5d.js")
    .catch(function (err) { console.warn("CCN: ManyChat no cargó.", err); });

  CCN.cargarScript("https://mccdn.me/assets/js/widget.js")
    .catch(function (err) { console.warn("CCN: el widget de ManyChat no cargó.", err); });
})();
