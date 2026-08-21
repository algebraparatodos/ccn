// ── Base común de todas las partes ────────────────────────
//
// El Worker pega estos archivos uno detrás del otro y sirve el
// resultado como /web.js. Este va primero y deja dos ayudas que usan
// los demás.
//
// La etiqueta en Kajabi lleva `defer`, así que este código corre
// después de que el HTML esté leído y ANTES de que se dispare
// DOMContentLoaded. O sea que un addEventListener('DOMContentLoaded')
// escrito aquí abajo se comporta igual que cuando el código estaba
// pegado en la web. Aun así usamos alListo(), por si algún día la
// etiqueta se pega sin `defer`: en ese caso DOMContentLoaded ya
// habría pasado y el listener no se dispararía nunca, en silencio.

window.CCN = window.CCN || {};

CCN.alListo = function (fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn);
  } else {
    fn();
  }
};

// Carga un <script> externo y avisa cuando terminó.
//
// Ojo con una diferencia real respecto de una etiqueta pegada a mano:
// un <script> creado con JavaScript es asíncrono por naturaleza, así
// que `defer` no le hace nada y no se puede dar por hecho que la
// variable global que trae ya existe. Por eso esto devuelve una
// promesa y quien lo use tiene que esperarla.
CCN.cargarScript = function (src) {
  return new Promise(function (resolve, reject) {
    var s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = function () { resolve(); };
    s.onerror = function () { reject(new Error("No se pudo cargar " + src)); };
    (document.head || document.documentElement).appendChild(s);
  });
};
