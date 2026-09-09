(function () {
  "use strict";

  // ============================================================
  // CONFIGURACIÓN
  // ============================================================
  const WORKER_URL = "https://chat.ceramicaconnati.com";

  const EXCLUDE_PATTERNS = ["/products", "/library", "/login", "/coworking"];

  const path = window.location.pathname.toLowerCase();
  const shouldHide = EXCLUDE_PATTERNS.some((p) => path.includes(p));
  if (shouldHide) return;

  // ============================================================
  // EXPIRACIÓN DE SESIÓN E HISTORIAL (24 horas)
  // ============================================================
  // Si pasó más de un día desde el último mensaje, se limpia todo:
  // el historial visual Y el session_id. Generar un session_id nuevo
  // además de borrar el historial es intencional — así el contador
  // de mensajes/límites del lado del servidor (D1) también arranca
  // de cero, no solo lo que se ve en pantalla.
  const ACTIVITY_KEY = "ccn_chat_last_activity";
  const HISTORY_TTL_MS = 24 * 60 * 60 * 1000; // 1 día

  function clearExpiredSessionIfNeeded() {
    try {
      const lastActivity = localStorage.getItem(ACTIVITY_KEY);
      if (lastActivity && Date.now() - Number(lastActivity) > HISTORY_TTL_MS) {
        localStorage.removeItem("ccn_chat_session");
        localStorage.removeItem(HISTORY_KEY_NAME);
        localStorage.removeItem(ACTIVITY_KEY);
        // La persona NO se borra a proposito: la charla vence a las 24
        // horas, pero quien es no cambia. Borrarla haria que a la
        // segunda visita se le pidiera el correo otra vez, que es
        // justo lo que molesta de estos formularios.
      }
    } catch (e) {
      // Si localStorage no está disponible, no hay nada que limpiar.
    }
  }

  function touchActivity() {
    try {
      localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
    } catch (e) {
      // Sin persistencia, no pasa nada grave: simplemente no vence.
    }
  }

  // Nombre de la key de historial declarado antes de usarlo arriba.
  const HISTORY_KEY_NAME = "ccn_chat_history";

  // ============================================================
  // QUIEN ESTA DEL OTRO LADO
  //
  // Desde el 09/09/2026 la burbuja pide el nombre y el correo antes del
  // primer mensaje. El motivo, medido ese dia sobre las charlas reales:
  // Clay llevaba 45 sesiones y 75 mensajes con CERO contactos guardados,
  // y en los tres bots de la casa juntos eran 80 sesiones y 169 mensajes,
  // tambien cero. Pedirlo en mitad de la conversacion depende de que el
  // modelo se acuerde; un formulario captura siempre.
  //
  // Se guarda tambien a quien pulso "prefiero no dejarlo ahora", y por el
  // mismo motivo que a quien si lo dejo: para no volver a preguntarselo
  // cada vez que abre la burbuja. Un formulario que reaparece despues de
  // que alguien lo rechazo es la forma mas rapida de que cierre la
  // ventana.
  const PERSONA_KEY = "ccn_chat_persona";

  function leerPersona() {
    try {
      const crudo = localStorage.getItem(PERSONA_KEY);
      return crudo ? JSON.parse(crudo) : null;
    } catch (e) {
      return null;
    }
  }

  function guardarPersona(persona) {
    try {
      localStorage.setItem(PERSONA_KEY, JSON.stringify(persona));
    } catch (e) {
      // Sin almacenamiento se le vuelve a preguntar en la proxima
      // visita. Molesta, pero no rompe nada.
    }
  }

  // Deliberadamente flojo: esto no valida direcciones, solo descarta lo
  // que es evidente que no lo es. Una comprobacion estricta rechaza
  // direcciones validas y raras, y el precio de equivocarse es perder
  // justo al contacto que veniamos a capturar. El Worker comprueba lo
  // mismo.
  function pareceEmail(valor) {
    const v = String(valor || "").trim();
    return v.length >= 6 && v.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  }
  clearExpiredSessionIfNeeded();

  // ============================================================
  // SESIÓN
  // ============================================================
  function generateId() {
    return (
      (crypto.randomUUID && crypto.randomUUID()) ||
      "sess-" + Date.now() + "-" + Math.random().toString(36).slice(2)
    );
  }

  function getSessionId() {
    // Intentamos localStorage primero (persiste entre visitas).
    try {
      let id = localStorage.getItem("ccn_chat_session");
      if (!id) {
        id = generateId();
        localStorage.setItem("ccn_chat_session", id);
      }
      return id;
    } catch (e) {
      // Si el navegador bloquea localStorage (ej: iframe restringido),
      // usamos un ID que al menos dura mientras la página esté abierta.
      console.warn("CCN chat: localStorage no disponible, usando sesión temporal.");
      return generateId();
    }
  }
  const sessionId = getSessionId();

  // ============================================================
  // HISTORIAL PERSISTENTE (localStorage)
  // ============================================================
  const HISTORY_KEY = HISTORY_KEY_NAME;
  const HISTORY_MAX = 40; // tope para no dejar crecer el localStorage sin límite

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(history) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-HISTORY_MAX)));
      touchActivity();
    } catch (e) {
      // Si localStorage falla (ej: iframe restringido), simplemente
      // no persiste entre páginas, pero la sesión actual sigue andando.
    }
  }

  // Historial de la conversación. Arranca con lo que haya guardado
  // de páginas anteriores, así el hilo sigue aunque la persona navegue.
  let conversationHistory = loadHistory();

  // ============================================================
  // FUENTES
  // ============================================================
  const fontLink = document.createElement("link");
  fontLink.rel = "stylesheet";
  fontLink.href =
    "https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Lora:ital,wght@0,400;0,500;1,400&display=swap";
  document.head.appendChild(fontLink);

  // ============================================================
  // ESTILOS
  // ============================================================
  const style = document.createElement("style");
  style.textContent = `
    #ccn-chat-toggle {
      position: fixed;
      bottom: 24px;
      right: 24px;
      max-width: calc(100vw - 32px);
      padding: 14px 22px;
      border-radius: 999px;
      background: #B8935A;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 18px rgba(46, 42, 34, 0.25);
      z-index: 999998;
      font-family: 'Lora', serif;
      font-size: 15px;
      font-weight: 500;
      color: #FFFDF6;
      transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
    }
    #ccn-chat-toggle:hover {
      transform: scale(1.03);
      box-shadow: 0 8px 22px rgba(46, 42, 34, 0.3);
    }
    #ccn-chat-toggle.hidden {
      opacity: 0;
      pointer-events: none;
      transform: scale(0.9);
    }

    /* Panel flotante: deja margen por los cuatro lados, con esquinas
       redondeadas y sombra suave. Antes iba pegado al borde derecho y a
       ras de pantalla, con esquinas rectas.
       El alto sale de anclar arriba Y abajo a la vez, asi que no se fija
       ningun "height" a mano: si se fijara, pelearia con el anclaje. */
    #ccn-chat-panel {
      position: fixed;
      top: calc(var(--ccn-header-offset, 0px) + 12px);
      right: 16px;
      bottom: 16px;
      left: auto;
      width: 448px;
      max-width: calc(100vw - 24px);
      background: #F7F0DA;
      border-radius: 16px;
      box-shadow: 0 20px 25px -5px rgba(46, 42, 34, 0.22),
                  0 8px 10px -6px rgba(46, 42, 34, 0.18);
      display: none;
      flex-direction: column;
      overflow: hidden;
      z-index: var(--ccn-panel-z, 999999);
      font-family: 'Lora', serif;
      border: 1px solid rgba(184, 147, 90, 0.35);
      transition: width 0.2s ease, left 0.2s ease, right 0.2s ease;
    }
    #ccn-chat-panel.open { display: flex; }
    /* Ampliado: se ensancha manteniendo los margenes, sin ocupar nunca
       la pantalla entera ni taparle la cabecera al sitio. Con left y
       right fijos, width auto y margenes automaticos, el navegador
       reparte el sobrante en partes iguales: queda centrado. */
    #ccn-chat-panel.fullscreen {
      left: 24px;
      right: 24px;
      bottom: 24px;
      width: auto;
      max-width: 1024px;
      margin: 0 auto;
    }

    #ccn-chat-header {
      background: #B8935A;
      color: #FFFDF6;
      padding: 16px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    #ccn-chat-header-title {
      font-family: 'Caveat', cursive;
      font-size: 28px;
      font-weight: 700;
      line-height: 1;
    }
    #ccn-chat-header-sub {
      font-family: 'Lora', serif;
      font-size: 12px;
      opacity: 0.85;
      margin-top: 3px;
    }
    #ccn-chat-header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    #ccn-chat-fullscreen,
    #ccn-chat-close {
      background: none;
      border: none;
      color: #FFFDF6;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 6px;
      border-radius: 6px;
      transition: background 0.15s ease;
    }
    #ccn-chat-fullscreen:hover,
    #ccn-chat-close:hover {
      background: rgba(255, 253, 246, 0.15);
    }
    #ccn-chat-fullscreen svg {
      width: 18px;
      height: 18px;
    }
    #ccn-chat-close {
      font-size: 22px;
      line-height: 1;
    }

    #ccn-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #FFFDF6;
    }
    .ccn-msg {
      max-width: 82%;
      padding: 10px 14px;
      border-radius: 14px;
      font-size: 15px;
      line-height: 1.5;
      white-space: pre-wrap;
    }
    .ccn-msg.bot {
      align-self: flex-start;
      background: #F1E7CB;
      color: #2E2A22;
      border-bottom-left-radius: 4px;
    }
    .ccn-msg.user {
      align-self: flex-end;
      background: #8BA3C7;
      color: #FFFDF6;
      border-bottom-right-radius: 4px;
    }
    .ccn-msg.typing {
      align-self: flex-start;
      background: #F1E7CB;
      color: #6b6252;
      font-style: italic;
      font-size: 13px;
    }
    .ccn-msg a { color: inherit; text-decoration: underline; }

    /* La pantalla de presentacion: lo primero que se ve al abrir. */
    #ccn-chat-presentacion {
      display: none;
      flex-direction: column;
      padding: 22px 20px;
      overflow-y: auto;
      flex: 1;
      background: #FFFDF6;
      color: #2E2A22;
    }
    #ccn-chat-presentacion.visible { display: flex; }
    #ccn-chat-presentacion p.intro {
      margin: 0 0 18px;
      font-size: 15px;
      line-height: 1.55;
    }
    #ccn-chat-presentacion label {
      display: block;
      font-size: 13px;
      color: #6b6252;
      margin-bottom: 12px;
    }
    #ccn-chat-presentacion input {
      display: block;
      width: 100%;
      box-sizing: border-box;
      margin-top: 5px;
      padding: 11px 14px;
      /* 16px como minimo: con menos, Safari en iPhone hace zoom solo al
         tocar el campo y descuadra la pagina entera. */
      font-size: 16px;
      font-family: inherit;
      color: #2E2A22;
      background: #F7F0DA;
      border: 1px solid rgba(184, 147, 90, 0.45);
      border-radius: 12px;
      outline: none;
    }
    #ccn-chat-presentacion input:focus { border-color: #B8935A; }
    #ccn-chat-empezar {
      width: 100%;
      margin-top: 6px;
      padding: 12px 16px;
      font-family: inherit;
      font-size: 15px;
      font-weight: 600;
      color: #FFFDF6;
      background: #B8935A;
      border: none;
      border-radius: 999px;
      cursor: pointer;
    }
    #ccn-chat-empezar[disabled] { opacity: 0.4; cursor: default; }
    #ccn-chat-empezar .girando {
      display: inline-block;
      width: 13px;
      height: 13px;
      margin-right: 7px;
      vertical-align: -2px;
      border: 2px solid rgba(255, 253, 246, 0.35);
      border-top-color: #FFFDF6;
      border-radius: 50%;
      animation: ccn-girar 0.7s linear infinite;
    }
    @keyframes ccn-girar { to { transform: rotate(360deg); } }
    #ccn-chat-presentacion .pista {
      margin: 8px 0 0;
      font-size: 12px;
      color: #6b6252;
      text-align: center;
    }
    #ccn-chat-saltar {
      margin-top: 18px;
      background: none;
      border: none;
      font-family: inherit;
      font-size: 12px;
      color: #6b6252;
      text-decoration: underline;
      cursor: pointer;
    }
    #ccn-chat-presentacion .legal {
      margin: 22px 0 0;
      font-size: 11px;
      line-height: 1.5;
      color: #6b6252;
    }

    #ccn-chat-inputbar {
      display: flex;
      gap: 8px;
      padding: 14px;
      background: #F7F0DA;
      border-top: 1px solid rgba(184, 147, 90, 0.35);
      flex-shrink: 0;
    }
    #ccn-chat-input {
      flex: 1;
      border: 1px solid rgba(46, 42, 34, 0.2);
      border-radius: 20px;
      padding: 10px 16px;
      font-family: 'Lora', serif;
      font-size: 15px;
      outline: none;
      background: #FFFDF6;
      color: #2E2A22;
    }
    #ccn-chat-input:focus { border-color: #B8935A; }
    #ccn-chat-send {
      background: #B8935A;
      border: none;
      color: #FFFDF6;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    #ccn-chat-send:disabled { opacity: 0.5; cursor: default; }
    #ccn-chat-send svg { width: 16px; height: 16px; fill: #FFFDF6; }

    @media (prefers-reduced-motion: reduce) {
      #ccn-chat-toggle, #ccn-chat-panel { transition: none; }
    }

    /* Este bloque va al FINAL a propósito: en CSS, entre reglas con
       la misma especificidad, gana la que aparece después en el
       texto — no importa si está dentro de un @media o no. Poniendo
       este bloque acá abajo nos aseguramos de que estas reglas de
       mobile no queden pisadas por ninguna regla anterior (como el
       display:flex del botón de pantalla completa). */
    @media (max-width: 768px) {
      #ccn-chat-toggle {
        opacity: 0.82;
        right: 16px;
        padding: 10px 14px;
        font-size: 13px;
        max-width: calc(100vw - 32px);
      }
      #ccn-chat-toggle:active {
        opacity: 1;
      }
      /* Se nombra tambien .fullscreen para poder ganarle: esa regla
         tiene mas peso (id + clase) y si no, en un movil que venga de
         una pantalla ancha con el panel ampliado, mandaria ella. */
      #ccn-chat-panel,
      #ccn-chat-panel.fullscreen {
        left: 12px;
        right: 12px;
        bottom: 12px;
        top: calc(var(--ccn-header-offset, 0px) + 12px);
        width: auto;
        max-width: none;
      }
      #ccn-chat-fullscreen {
        display: none;
      }
      #ccn-chat-input {
        /* 16px o más evita el zoom automático de iOS Safari al enfocar */
        font-size: 16px;
      }
    }
  `;
  document.head.appendChild(style);

  // ============================================================
  // HTML
  // ============================================================
  const toggle = document.createElement("button");
  toggle.id = "ccn-chat-toggle";
  toggle.setAttribute("aria-label", "Abrir chat de Cerámica con Nati");
  toggle.textContent = "¿Tenés alguna consulta?";

  const panel = document.createElement("div");
  panel.id = "ccn-chat-panel";
  panel.innerHTML = `
    <div id="ccn-chat-header">
      <div>
        <div id="ccn-chat-header-title">Hola, soy Clay!</div>
        <div id="ccn-chat-header-sub">Preguntame sobre los cursos ✨</div>
      </div>
      <div id="ccn-chat-header-actions">
        <button id="ccn-chat-fullscreen" aria-label="Pantalla completa" title="Pantalla completa">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
            <path d="M16 3h3a2 2 0 0 1 2 2v3"/>
            <path d="M8 21H5a2 2 0 0 1-2-2v-3"/>
            <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
          </svg>
        </button>
        <button id="ccn-chat-close" aria-label="Cerrar chat">×</button>
      </div>
    </div>
    <div id="ccn-chat-presentacion">
      <p class="intro">Antes de empezar, decime cómo te llamás y tu correo. Si veo que no puedo ayudarte, te va a contactar alguien del equipo lo antes posible.</p>
      <label>Nombre
        <input id="ccn-chat-nombre" type="text" autocomplete="given-name" maxlength="120" aria-label="Nombre" placeholder="Cómo te llamás" />
      </label>
      <label>Correo
        <input id="ccn-chat-email" type="email" inputmode="email" autocomplete="email" maxlength="200" aria-label="Correo" placeholder="tu@correo.com" />
      </label>
      <button id="ccn-chat-empezar" type="button" disabled>Empezar a chatear</button>
      <p class="pista" id="ccn-chat-pista">Escribí tu nombre y un correo para empezar.</p>
      <button id="ccn-chat-saltar" type="button">Prefiero no dejarlo ahora</button>
      <p class="legal">Los datos son para que la escuela pueda escribirte.</p>
    </div>
    <div id="ccn-chat-messages"></div>
    <div id="ccn-chat-inputbar">
      <input id="ccn-chat-input" type="text" placeholder="Escribí tu pregunta..." autocomplete="off" />
      <button id="ccn-chat-send" aria-label="Enviar">
        <svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
      </button>
    </div>
  `;

  // La etiqueta <script> de la web vive en el <head> y sin `defer`, asi
  // que cuando este archivo corre el <body> todavia no existe: metidos
  // directamente, estos dos appendChild fallaban sobre null y la burbuja
  // no se dibujaba nunca. El fallo era silencioso de la peor manera,
  // porque los estilos se inyectan unas lineas mas arriba en el <head>,
  // que si existe — o sea que todo parecia haber funcionado.
  // Esperar al DOM cuesta cuatro lineas y ademas hace que el widget
  // funcione este donde este puesta la etiqueta. Es lo mismo que ya
  // hacia cta-reserva.js en este mismo repo.
  function montarEnLaPagina() {
    document.body.appendChild(toggle);
    document.body.appendChild(panel);
  }

  if (document.body) {
    montarEnLaPagina();
  } else {
    document.addEventListener("DOMContentLoaded", montarEnLaPagina);
  }

  const presentacionEl = panel.querySelector("#ccn-chat-presentacion");
  const inputbarEl = panel.querySelector("#ccn-chat-inputbar");
  const nombreEl = panel.querySelector("#ccn-chat-nombre");
  const emailEl = panel.querySelector("#ccn-chat-email");
  const empezarBtn = panel.querySelector("#ccn-chat-empezar");
  const pistaEl = panel.querySelector("#ccn-chat-pista");
  const saltarBtn = panel.querySelector("#ccn-chat-saltar");
  const messagesEl = panel.querySelector("#ccn-chat-messages");
  const inputEl = panel.querySelector("#ccn-chat-input");
  const sendBtn = panel.querySelector("#ccn-chat-send");
  const closeBtn = panel.querySelector("#ccn-chat-close");
  const fullscreenBtn = panel.querySelector("#ccn-chat-fullscreen");

  // Detección de mobile/touch: combinamos ancho de viewport con
  // "pointer: coarse" (dedo en vez de mouse). Esto es más robusto
  // que depender solo del ancho, porque si la página donde vive el
  // widget no tiene bien configurado el <meta name="viewport">, el
  // navegador mobile puede reportar un viewport "de escritorio"
  // más ancho que la pantalla real, y el @media (max-width: 768px)
  // del CSS no dispara aunque estemos en un teléfono de verdad.
  // "pointer: coarse" no depende de esa configuración, así que
  // sirve como red de seguridad adicional.
  const isTouchDevice =
    window.matchMedia("(max-width: 768px)").matches ||
    window.matchMedia("(pointer: coarse)").matches;

  // Ocultamos con estilo inline (no solo con la regla CSS de
  // @media) porque un estilo inline le gana a cualquier regla de
  // hoja de estilos sin importar el caso anterior — así el botón
  // de pantalla completa queda oculto en mobile pase lo que pase
  // con el viewport de la página.
  if (isTouchDevice) {
    fullscreenBtn.style.display = "none";
  }

  let opened = false;

  // ============================================================
  // OFFSET DEL HEADER DEL SITIO
  // Para que el panel no tape el header y la persona pueda seguir
  // navegando con el chat abierto. Misma lógica de detección que
  // ya usa el script de anclas del sitio (header fixed/sticky).
  // ============================================================
  function findStickyHeaderEl() {
    const candidates = Array.from(
      document.querySelectorAll(
        "header, .header, .header__content, .header__content--desktop, .header__content--mobile, .announcement, .topbar, .nav, .navbar"
      )
    );

    return (
      candidates
        .map((el) => {
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return { el, cs, r };
        })
        .filter((x) => {
          // No exigimos position fixed/sticky: alcanza con que ESTÉ
          // visible pegado arriba del todo ahora mismo (r.top cerca
          // de 0 y todavía visible, r.bottom > 0). Esto cubre tanto
          // headers sticky/fixed de siempre, como headers "overlay"
          // que recién se fijan al hacer scroll — apenas carga la
          // página, igual están arriba y hay que dejarles su lugar.
          return x.r.top <= 20 && x.r.bottom > 0 && x.r.height > 30;
        })
        .sort((a, b) => b.r.height - a.r.height)[0] || null
    );
  }

  function updateHeaderOffset() {
    const found = findStickyHeaderEl();
    const h = found ? Math.round(found.r.height) : 0;
    document.documentElement.style.setProperty("--ccn-header-offset", h + "px");

    // Que el menú del header (y sus desplegables, que suelen vivir
    // adentro del propio header) se vean por encima del panel del
    // chat. Muchos temas no le ponen z-index explícito al header
    // (queda en "auto"), así que en vez de intentar calcular algo
    // "por debajo" de un valor que puede no existir, directamente
    // le garantizamos al header un z-index bien alto, y el panel
    // se queda fijo un escalón por debajo.
    if (found) {
      found.el.style.zIndex = "1000000";
    }
    panel.style.zIndex = "500000";
    toggle.style.zIndex = "500000";
  }

  updateHeaderOffset();
  window.addEventListener("resize", updateHeaderOffset);

  // Recalcular con el scroll también (con throttle vía requestAnimationFrame
  // para no recalcular en cada pixel), por si el header cambia de estado
  // (aparece/desaparece, se vuelve sticky) mientras el chat está abierto.
  let scrollTicking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(() => {
        updateHeaderOffset();
        scrollTicking = false;
      });
    },
    { passive: true }
  );

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function linkify(text) {
    const urlRegex = /(https?:\/\/[^\s<]+)/g;
    return text.replace(urlRegex, function (url) {
      // No incluir puntuación final (. , ; : ! ?) como parte del link
      let clean = url;
      let trailing = "";
      const m = clean.match(/[.,;:!?)]+$/);
      if (m) {
        trailing = m[0];
        clean = clean.slice(0, -trailing.length);
      }
      return (
        '<a href="' +
        clean +
        '" target="_blank" rel="noopener noreferrer">' +
        clean +
        "</a>" +
        trailing
      );
    });
  }

  function addMessage(text, who) {
    const div = document.createElement("div");
    div.className = "ccn-msg " + who;
    div.innerHTML = linkify(escapeHTML(text));
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  // Si venimos de otra página con conversación en curso, reconstruimos
  // los mensajes ya mismo (sin esperar a que se abra el panel) y
  // marcamos que ya "abrió" antes, para no repetir el saludo inicial.
  if (conversationHistory.length > 0) {
    opened = true;
    conversationHistory.forEach(function (turn) {
      addMessage(turn.content, turn.role === "user" ? "user" : "bot");
    });
  }

  const SALUDO =
    "¡Hola! 👋 Soy Clay, el asistente de Cerámica con Nati. Preguntame lo que quieras sobre los cursos: contenido, precios, inscripciones...";

  // El estado de la puerta de entrada. `null` mientras no sepamos quién
  // es: ahí se ve el formulario en lugar de la conversación.
  let persona = leerPersona();
  let presentando = false;

  // Quien ya tenia una charla empezada sigue como estaba. El dia que
  // esto se despliega hay gente con una conversacion guardada y sin
  // datos, porque cuando la empezo el formulario no existia:
  // plantarselo encima de lo que estaba hablando seria la peor forma de
  // estrenarlo. Se marca solo en el navegador, sin avisarle al Worker,
  // para que no cuente como "prefirio no dejarlo" y ensucie la medicion
  // de cuanta gente usa la salida.
  if (persona === null && conversationHistory.length > 0) {
    persona = { enCurso: true };
  }

  function mostrarPresentacion(hayQuePresentarse) {
    presentacionEl.classList.toggle("visible", hayQuePresentarse);
    messagesEl.style.display = hayQuePresentarse ? "none" : "";
    inputbarEl.style.display = hayQuePresentarse ? "none" : "";
  }

  function revisarFormulario() {
    const listo = nombreEl.value.trim() !== "" && pareceEmail(emailEl.value);
    // El botón no se puede pulsar hasta que se pueda usar, y la pista
    // dice por qué antes de pulsarlo en vez de explicarlo después.
    empezarBtn.disabled = !listo || presentando;
    pistaEl.style.display = listo ? "none" : "";
    return listo;
  }

  nombreEl.addEventListener("input", revisarFormulario);
  emailEl.addEventListener("input", revisarFormulario);

  emailEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && revisarFormulario()) presentarse();
  });
  nombreEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter") emailEl.focus();
  });

  empezarBtn.addEventListener("click", function () {
    if (revisarFormulario()) presentarse();
  });
  saltarBtn.addEventListener("click", function () {
    presentarse({ saltada: true });
  });

  /**
   * Guarda quién abrió el chat, o que prefirió no decirlo.
   *
   * Pase lo que pase se entra al chat. El Worker ya está escrito para no
   * fallar nunca acá, pero si la red se cae del todo esta persona tiene
   * que poder preguntar igual: un formulario de captación que deja a
   * alguien mirando una burbuja rota cuesta más que el contacto que
   * venía a capturar.
   */
  async function presentarse(saltar) {
    if (presentando) return;
    presentando = true;

    const saltada = !!(saltar && saltar.saltada);
    const datos = saltada
      ? { session_id: sessionId, saltada: true }
      : {
          session_id: sessionId,
          nombre: nombreEl.value.trim(),
          email: emailEl.value.trim(),
        };

    if (!saltada) {
      empezarBtn.disabled = true;
      empezarBtn.innerHTML = '<span class="girando"></span>Un momento...';
    }
    saltarBtn.disabled = true;

    try {
      await fetch(WORKER_URL + "/presentacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
    } catch (e) {
      // Silencio a propósito: el contacto se pierde, la conversación no.
    }

    presentando = false;
    empezarBtn.textContent = "Empezar a chatear";
    saltarBtn.disabled = false;

    persona = saltada ? { saltada: true } : { nombre: datos.nombre, email: datos.email };
    guardarPersona(persona);

    mostrarPresentacion(false);
    if (!opened) {
      opened = true;
      addMessage(SALUDO, "bot");
    }
    if (!isTouchDevice) inputEl.focus();
  }

  function openPanel() {
    updateHeaderOffset();
    panel.classList.add("open");
    toggle.classList.add("hidden");

    // Mientras no sepamos quién es, lo que se ve es el formulario y no
    // la conversación: es el único momento en que se puede pedir el
    // correo antes de que la persona se vaya, que en esta burbuja son
    // dos de cada tres charlas al primer mensaje.
    const hayQuePresentarse = persona === null;
    mostrarPresentacion(hayQuePresentarse);

    if (!hayQuePresentarse && !opened) {
      opened = true;
      addMessage(SALUDO, "bot");
    }

    // En mobile no forzamos el foco: si el teclado se abre solo al
    // tocar el botón, empuja todo el layout y tapa el mensaje de
    // bienvenida. Mejor que el teclado aparezca cuando la persona
    // toque el campo de texto, no antes.
    if (!isTouchDevice) {
      (hayQuePresentarse ? nombreEl : inputEl).focus();
    }
  }

  function closePanel() {
    panel.classList.remove("open");
    panel.classList.remove("fullscreen");
    toggle.classList.remove("hidden");
  }

  toggle.addEventListener("click", () => {
    if (panel.classList.contains("open")) {
      closePanel();
    } else {
      openPanel();
    }
  });
  closeBtn.addEventListener("click", closePanel);
  fullscreenBtn.addEventListener("click", () => {
    panel.classList.toggle("fullscreen");
  });

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;

    addMessage(text, "user");
    inputEl.value = "";
    sendBtn.disabled = true;

    const typingEl = addMessage("Escribiendo...", "typing");

    try {
      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          session_id: sessionId,
          history: conversationHistory,
        }),
      });
      const data = await res.json();
      typingEl.remove();

      if (data.reply) {
        addMessage(data.reply, "bot");
        // Guardamos el intercambio en memoria y en localStorage,
        // para que el hilo siga si la persona navega a otra página.
        conversationHistory.push({ role: "user", content: text });
        conversationHistory.push({ role: "assistant", content: data.reply });
        saveHistory(conversationHistory);
      } else {
        addMessage(
          "Uy, algo no salió bien. Probá de nuevo o escribinos por WhatsApp o email.",
          "bot"
        );
      }
    } catch (err) {
      typingEl.remove();
      addMessage(
        "No pude conectarme en este momento. Probá de nuevo en un rato, o escribinos directo por WhatsApp o email.",
        "bot"
      );
    } finally {
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  sendBtn.addEventListener("click", sendMessage);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });
})();
