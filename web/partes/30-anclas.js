// ── Fix de anclas + header sticky (v5) ────────────────────
//
// Copiado tal cual de lo que estaba pegado en Kajabi. No se le tocó la
// lógica a propósito: es un bloque delicado, ya afinado contra el
// header de este tema, y este cambio es una mudanza, no una mejora.
//
// Lo que hace: cuando se hace clic en un enlace con # , calcula cuánto
// mide el header pegajoso y baja hasta el destino dejando ese aire.
// Si el # no corresponde a ningún elemento real, no toca nada: son los
// "hashes virtuales" con los que Kajabi abre sus popups.

(function () {

  function isMobile() {
    return window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  }

  function getStickyHeaderHeight() {
    var candidates = Array.from(document.querySelectorAll(
      'header, .header, .header__content, .header__content--desktop, .header__content--mobile, .announcement, .topbar, .nav, .navbar'
    ));

    var topBar = candidates
      .map(function (el) {
        var cs = getComputedStyle(el);
        var r = el.getBoundingClientRect();
        return { el: el, cs: cs, r: r };
      })
      .filter(function (x) {
        var pos = x.cs.position;
        var isStickyOrFixed = (pos === 'fixed' || pos === 'sticky');
        return isStickyOrFixed && x.r.top <= 1 && x.r.height > 30;
      })
      .sort(function (a, b) { return b.r.height - a.r.height; })[0];

    return topBar ? Math.round(topBar.r.height) : 0;
  }

  function findTargetFromHash(hash) {
    if (!hash || hash.length < 2) return null;
    var id = decodeURIComponent(hash.slice(1));

    var t = document.getElementById(id);
    if (t) return t;

    try { return document.querySelector('[name="' + CSS.escape(id) + '"]'); }
    catch (e) { return document.querySelector('[name="' + id.replace(/"/g, '\\"') + '"]'); }
  }

  function doScroll(hash) {
    var target = findTargetFromHash(hash);
    if (!target) return;

    var headerH = getStickyHeaderHeight();

    // 👇 ACÁ ajustás aire:
    var extra = isMobile() ? 2 : 12;

    var y = target.getBoundingClientRect().top + window.pageYOffset - headerH - extra;

    window.scrollTo({ top: y, behavior: 'smooth' });
  }

  function scrollWithRetries(hash) {
    doScroll(hash);
    setTimeout(function(){ doScroll(hash); }, 80);
    setTimeout(function(){ doScroll(hash); }, 220);
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href*="#"]');
    if (!a) return;

    var href = a.getAttribute('href') || '';
    var idx = href.indexOf('#');
    if (idx === -1) return;

    var hash = href.slice(idx);
    if (!hash || hash === '#') return;

    // ✅ Si NO existe un elemento con ese id/name, NO es un ancla real:
    //    lo dejamos pasar para que Kajabi abra popups (#cta-popup, etc.)
    var target = findTargetFromHash(hash);
    if (!target) return;

    // 🔥 clave: evitar que otros handlers hagan scroll luego
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();

    if (window.location.hash !== hash) history.pushState(null, '', hash);
    scrollWithRetries(hash);
  }, true);

  window.addEventListener('load', function () {
    if (!window.location.hash) return;

    // ✅ si no existe target, no scrolleamos (popups / hashes “virtuales”)
    var t = findTargetFromHash(window.location.hash);
    if (!t) return;

    scrollWithRetries(window.location.hash);
  });

  window.addEventListener('hashchange', function () {
    if (!window.location.hash) return;

    var t = findTargetFromHash(window.location.hash);
    if (!t) return;

    scrollWithRetries(window.location.hash);
  });

})();
