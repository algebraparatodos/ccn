# ccn — lo que la web de Cerámica con Nati carga desde GitHub

**Este repo es público a propósito, y tiene que seguir siéndolo.**
`chatbot/inscripcion.md` lo lee el navegador directamente, sin pasar por
ningún servidor, y ni jsDelivr ni `raw.githubusercontent.com` sirven repos
privados. El día que este repo se cierre, el botón de inscripción de la
landing se queda con las fechas del *fallback* — **sin ningún error
visible**.

## Desde el 21/08/2026 casi nada se pega en Kajabi

Antes, el campo "Site Details" de Kajabi tenía **trescientas líneas**
pegadas a mano: tipografías, gestor de cookies, píxel de Meta, ManyChat, el
arreglo de anclas, la traducción de la página de descargas y el chatbot.
Cambiar una coma significaba entrar a Kajabi, editar dentro de un cuadro de
texto, y cruzar los dedos: sin historial, sin poder ver qué cambió, y sin
manera de volver atrás.

Ahora **en Kajabi quedan tres cosas** —los dos `<meta>` de verificación, el
píxel de Meta, y dos etiquetas que apuntan al Worker— y todo lo demás vive
acá y se cambia con un `git push`.

```
<link rel="stylesheet" href="https://ccn-chatbot.agaparatodos.workers.dev/estilos.css">
<script src="https://ccn-chatbot.agaparatodos.workers.dev/web.js" defer></script>
```

El bloque exacto que está pegado en Kajabi se guarda en
`web/site-details.html`. **Ahora sí es la fuente**, no una copia: como ya
casi no cambia, lo que hay ahí es lo que hay allá.

## Qué hay y quién lo usa

| Archivo | Quién lo carga |
|---|---|
| `web/estilos.css` | El Worker, y lo sirve como `/estilos.css`. Tipografías, escalas de móvil y resets del tema. |
| `web/partes/00-base.js` | El Worker. Ayudas comunes que usan las demás partes. |
| `web/partes/10-cookies.js` | El Worker. El aviso de cookies. |
| `web/partes/20-manychat.js` | El Worker. Los dos scripts de ManyChat. |
| `web/partes/30-anclas.js` | El Worker. El scroll con aire para el header pegajoso. |
| `web/partes/40-downloads.js` | El Worker. Traduce "Files" y "Download All" en `/downloads/`. |
| `chatbot/ccn-chatbot.js` | El Worker, como última parte del paquete. Es la burbuja de Clay. |
| `cta-reserva.js` | **La web, directo por jsDelivr.** No está en el Site Details: está pegado en un bloque de código de la landing. |
| `chatbot/inscripcion.md` | **Dos** consumidores: `cta-reserva.js` desde el navegador, y el Worker de Clay desde el servidor. |
| `web/site-details.html` | Nadie lo carga. Es lo que está pegado en Kajabi, guardado acá para tener historial. |

`cta-reserva.js` quedó como estaba a propósito: vive en otra parte de
Kajabi, no en el Site Details, y mudarlo sin saber exactamente en qué página
está pegado era arriesgar el botón de inscripción para no ganar nada.

## Por qué pasa por el Worker y no directo por GitHub

Tres motivos concretos, ninguno estético:

1. **El tipo de contenido.** `raw.githubusercontent.com` sirve todo como
   texto plano, y un navegador rechaza un CSS que no venga declarado como
   `text/css`. Sin el Worker, las tipografías no se podían cargar con un
   `<link>`.
2. **La caché.** jsDelivr se queda hasta 12 horas con la rama vieja y encima
   manda una caché de navegador de 7 días. El 21/08/2026 eso dejó a Clay
   roto en la web durante horas **después** de que el arreglo ya estuviera
   subido, y purgar a mano no lo destrabó. El Worker manda las cabeceras que
   queremos: **un cambio se ve dentro del minuto**.
3. **Los repos privados.** Ni jsDelivr ni raw sirven repos privados, y poner
   un token de GitHub en el navegador sería regalarlo — queda a la vista de
   cualquiera que abra el inspector. Con el Worker en el medio, el token se
   queda del lado del servidor.

Ese tercer punto es el que deja el camino abierto: en el Worker cada parte
declara de qué repo sale, y una que salga de un repo privado se baja con el
mismo token de sólo lectura que ya usa la base de conocimiento. **Hoy todas
son públicas**, porque nada de lo que corre en el navegador es sensible: el
navegador lo enseña igual, esté el repo abierto o cerrado. Lo único que
esconde un repo privado es el historial.

## Cuánto tarda en verse un cambio

Hasta un minuto. El Worker cachea 60 segundos y le pide al navegador que
haga lo mismo. Es a propósito: sin eso, cada visita a la web sería un pedido
a GitHub.

Si hay que ver un cambio **ya**, se recarga con Ctrl+F5 después de ese
minuto.

## Si GitHub se cae

El Worker guarda una "última copia buena" con caché de un año. Si GitHub no
responde o devuelve un error, sirve esa en vez de dejar el sitio sin estilos
y sin chatbot. Una copia de ayer es mejor que una página rota.

## Al tocar cualquier parte, comprobar la sintaxis

Las partes se pegan una detrás de otra en un solo archivo. La contra de eso
es real: **un error de sintaxis en una parte tumba a todas**, incluido el
chatbot. Antes de hacer push:

```
node --check web/partes/10-cookies.js
```

## Cuidado con los `<script>` creados a mano

Una etiqueta `<script src>` escrita en el HTML se puede sincronizar; uno
creado con JavaScript es **asíncrono siempre**, y `defer` no le hace nada.
Por eso `10-cookies.js` espera a que la librería haya cargado antes de
llamar a `cookieconsent.run()`: sin esa espera, la variable global todavía
no existe y el aviso de cookies no aparece nunca, sin error visible.

Para eso está `CCN.cargarScript()` en `00-base.js`, que devuelve una promesa.

## El widget no puede dar por supuesto dónde lo pegan

Todo lo que toque `document.body` va detrás de una espera al DOM. Con
`defer` el `<body>` ya existe, pero la etiqueta se pega a mano en Kajabi y
nada garantiza que el `defer` sobreviva a la próxima edición. Fue
exactamente el fallo del 21/08/2026, y falla de la peor manera: los estilos
se inyectan en el `<head>` unas líneas antes y sí funcionan, así que todo
parece haber ido bien.

## Para cambiar las fechas de inscripción

Editar las líneas `FECHA_APERTURA_INSCRIPCION_COMPLETA` y
`FECHA_CIERRE_INSCRIPCION_COMPLETA` de `chatbot/inscripcion.md` y hacer
push. No hay que tocar `cta-reserva.js`: las lee de ahí.

## Por qué acá no está el conocimiento del bot

Estuvo, y se movió. Los `.md` con precios, preguntas frecuentes, contacto y
tono viven en el repo **privado** `chatbots-conocimiento`, y el Worker los
lee con un token de sólo lectura.

`inscripcion.md` es la única excepción y se quedó a propósito: lo necesita
también el navegador, que no puede llevar un token encima. Son fechas de
inscripción, no dato sensible, y tenerlo en un solo lugar evita dos copias
que se desincronicen.

## Sobre el historial

El historial de este repo arranca el 21/08/2026. No es que no haya pasado:
se creó limpio a propósito, porque el anterior conservaba en sus versiones
viejas los archivos de conocimiento que después se hicieron privados. El
repo original quedó respaldado fuera de GitHub.
