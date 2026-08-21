(function () {
  // ============================================================
  // 🔧 CONFIGURACIÓN
  // Las fechas de la ventana de inscripción completa ya NO se
  // tocan acá — se leen automáticamente de inscripcion.md en
  // GitHub (líneas "FECHA_APERTURA_INSCRIPCION_COMPLETA" y
  // "FECHA_CIERRE_INSCRIPCION_COMPLETA"). Para cambiarlas, editá
  // esas líneas en el repo, no este archivo.
  // ============================================================
  var REPO = "algebraparatodos/ccn";
  var BRANCH = "main";
  var INSCRIPCION_URL =
    "https://raw.githubusercontent.com/" + REPO + "/" + BRANCH + "/chatbot/inscripcion.md";

  // Fallback por si GitHub no responde (caído, sin internet, etc.):
  // se usan estas fechas para no dejar la landing sin botón.
  // Conviene mantenerlas razonablemente actualizadas cada tanto,
  // aunque en el uso normal nunca debería hacer falta.
  var FALLBACK_APERTURA = "2027-03-01";
  var FALLBACK_CIERRE = "2027-03-15";

  // ============================================================
  // 📦 CONTENIDO POR PRODUCTO Y POR FASE
  // Cada key (ej "ciclo-formativo") corresponde a un data-ccn-cta
  // en el HTML de la landing. Podés agregar más productos acá.
  // ============================================================
  var CONTENT = {
    "ciclo-formativo": {
      preinscripcion: {
        title: "Reserva tu lugar abonando un pequeño adelanto",
        subtitle: "y de regalo tendrás un 10% de descuento en el precio final del curso",
        buttons: [
          { label: "Reservar por ARS 30.000", href: "https://mpago.la/213UJQJ" },
          { label: "Reservar por 20 €", href: "https://www.ceramicaconnati.com/offers/euJT7PeX/checkout" }
        ],
        footer: "Los cupos son limitados. Pagando esta reserva garantizás tu lugar."
      },
      inscripcion: {
        title: "Inscribite al ciclo formativo",
        subtitle: "Empezamos el 15 de marzo — asegurá tu lugar",
        buttons: [
          { label: "Comprar por ARS 220.000", href: "https://mpago.li/1wCbQry" },
          { label: "Comprar por 180 €", href: "https://www.ceramicaconnati.com/offers/dYhdMVGu/checkout" },
          { label: "Comprar por 210 USD", href: "https://www.ceramicaconnati.com/offers/neUP55cr/checkout" }
        ],
        footer: "Cupos limitados. Confirmá tu lugar ahora."
      }
    }
    // Para agregar otro producto (ej "pack-abc"), sumá otra key acá
    // con su propio objeto { preinscripcion: {...}, inscripcion: {...} }
  };

  var COLOR = "#4b507a";

  function renderCTA(container, data) {
    var html = '<div style="padding: 20px; text-align: center;">';
    html += '<h3 style="color:' + COLOR + '; font-size: 36px; margin-bottom: 10px; text-align: center !important;">' + data.title + '</h3>';

    if (data.subtitle) {
      html += '<p style="color:' + COLOR + '; font-size: 18px; font-weight: 500; margin-bottom: 30px; text-align: center !important;">' + data.subtitle + '</p>';
    }

    data.buttons.forEach(function (btn, i) {
      var mb = i < data.buttons.length - 1 ? "16px" : "0";
      html += '<a href="' + btn.href + '" target="_blank" rel="noopener noreferrer" ' +
        'style="display:block; background:transparent; color:' + COLOR + '; text-decoration:none; ' +
        'padding:16px 24px; border-radius:0; font-weight:600; font-size:16px; line-height:1.2; ' +
        'width:90%; max-width:500px; margin:0 auto ' + mb + '; text-align:center !important; ' +
        'border:2px solid ' + COLOR + ';"> ' + btn.label + ' </a>';
    });

    if (data.footer) {
      html += '<p style="color:' + COLOR + '; font-size: 14px; font-weight: 400; margin-top: 20px; text-align: center !important;">' + data.footer + '</p>';
    }

    html += '</div>';
    container.innerHTML = html;
  }

  // ============================================================
  // VENTANA DE INSCRIPCIÓN: leerla de inscripcion.md
  // ============================================================
  function getTodayInBA() {
    // Misma zona horaria que usa el Worker para decidir la fase,
    // para que ambos lados nunca queden desincronizados justo
    // en el borde de la ventana.
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    var y, m, d;
    parts.forEach(function (p) {
      if (p.type === "year") y = p.value;
      if (p.type === "month") m = p.value;
      if (p.type === "day") d = p.value;
    });
    return y + "-" + m + "-" + d; // YYYY-MM-DD, comparable como string
  }

  function fetchVentana() {
    // cache: "no-store" + parámetro random para saltear tanto el
    // caché del navegador como el de raw.githubusercontent.com (~5min).
    var url = INSCRIPCION_URL + "?nocache=" + Date.now();
    return fetch(url, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("No se pudo leer inscripcion.md");
        return res.text();
      })
      .then(function (text) {
        var apertura = text.match(/FECHA_APERTURA_INSCRIPCION_COMPLETA:\s*(\d{4}-\d{2}-\d{2})/);
        var cierre = text.match(/FECHA_CIERRE_INSCRIPCION_COMPLETA:\s*(\d{4}-\d{2}-\d{2})/);
        if (!apertura || !cierre) {
          throw new Error("No se encontraron las fechas de ventana en inscripcion.md");
        }
        return { apertura: apertura[1], cierre: cierre[1] };
      })
      .catch(function (err) {
        console.warn("CCN cta-reserva: usando fechas de respaldo.", err);
        return { apertura: FALLBACK_APERTURA, cierre: FALLBACK_CIERRE };
      });
  }

  function init(ventana) {
    var hoy = getTodayInBA();
    // Inscripción completa SOLO dentro de la ventana (ambas fechas
    // inclusive). Cualquier otro día del año —ya sea antes de que
    // abra o después de que cierre— es fase de reserva.
    var dentroDeVentana = hoy >= ventana.apertura && hoy <= ventana.cierre;
    var phase = dentroDeVentana ? "inscripcion" : "preinscripcion";

    var containers = document.querySelectorAll('[data-ccn-cta]');
    containers.forEach(function (el) {
      var key = el.getAttribute('data-ccn-cta');
      var product = CONTENT[key];
      if (!product) return;
      var data = product[phase];
      if (!data) return;
      renderCTA(el, data);
    });
  }

  function start() {
    fetchVentana().then(init);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
