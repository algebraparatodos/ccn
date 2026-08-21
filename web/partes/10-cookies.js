// ── Gestor de cookies (FreePrivacyPolicy) ─────────────────
//
// Antes eran dos etiquetas pegadas en Kajabi: una que bajaba la
// librería y otra que la arrancaba en DOMContentLoaded. Al traerlo
// acá hay que tener cuidado con el orden, porque el <script> ya no es
// una etiqueta del HTML sino uno creado a mano, y esos son asíncronos:
// si se llamara a cookieconsent.run() sin esperar, la variable global
// todavía no existiría y el aviso de cookies no aparecería nunca.
// Sin error visible, que es lo peor que puede pasar con esto.
//
// Por eso se espera a las DOS cosas: a que la librería esté cargada y
// a que el DOM esté listo.

(function () {
  var LIBRERIA = "https://www.freeprivacypolicy.com/public/cookie-consent/4.2.0/cookie-consent.js";

  var domListo = new Promise(function (resolve) { CCN.alListo(resolve); });

  Promise.all([CCN.cargarScript(LIBRERIA), domListo])
    .then(function () {
      if (typeof cookieconsent === "undefined") {
        console.warn("CCN: la librería de cookies cargó pero no dejó su variable global.");
        return;
      }
      cookieconsent.run({
        notice_banner_type: "headline",
        consent_type: "express",
        palette: "light",
        language: "es",
        page_load_consent_levels: ["strictly-necessary"],
        website_name: "https://ceramicaconnati.com/",
        website_privacy_policy_url: "https://ceramicaconnati.com/terminos-y-condiciones"
      });
    })
    .catch(function (err) {
      console.warn("CCN: no se pudo arrancar el aviso de cookies.", err);
    });
})();
