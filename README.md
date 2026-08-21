# ccn — lo que la web de Cerámica con Nati carga desde GitHub

**Este repo es público a propósito, y tiene que seguir siéndolo.**

`ceramicaconnati.com` no aloja estos archivos: los baja de acá cada vez que
alguien abre la web. Ni jsDelivr ni `raw.githubusercontent.com` sirven
repos privados, así que el día que este repo se cierre, la web se queda sin
chatbot y sin botón de reserva — **sin ningún error visible**.

## Qué hay y quién lo usa

| Archivo | Quién lo carga |
|---|---|
| `chatbot/ccn-chatbot.js` | La web, vía `cdn.jsdelivr.net/gh/algebraparatodos/ccn@main/`. Es la burbuja de Clay. |
| `cta-reserva.js` | La web, por el mismo camino. Decide qué botón de inscripción mostrar según la fecha. |
| `chatbot/inscripcion.md` | **Dos** consumidores: `cta-reserva.js` desde el navegador, y el Worker de Clay desde el servidor. |

## Cómo lo carga la web, y por qué importa

**El Site Details entero de Kajabi está guardado acá, en
`web/site-details.html`.** No sólo el trozo del chatbot: el bloque completo,
tal cual está pegado en la web —tipografías, gestor de cookies, pixel de
Meta, ManyChat, el arreglo de anclas y la traducción de la página de
descargas—.

Vive en el repo por dos motivos. Uno, si sólo existiera dentro del editor de
Kajabi nadie sabría qué había el día que se borre. Y dos, para poder ver en
un `git diff` qué cambió exactamente antes de pegarlo: es la única forma de
tocar ese bloque sin cruzar los dedos.

**Es una copia, no la fuente**: lo que manda es lo que está pegado en Kajabi.
Si se edita allá, hay que traerlo acá.

**Baja el widget por `raw.githubusercontent.com` con `?nocache=`, no por
jsDelivr**, y eso no es un capricho. El 21/08/2026 se arregló un fallo que
dejaba a Clay invisible, se empujó el arreglo, y **la web siguió rota**:
jsDelivr cachea la rama hasta 12 horas y el archivo se sirve además con una
caché de navegador de 7 días. Purgar a mano no lo destrabó. Bajándolo de
GitHub sin caché, un arreglo se ve en la visita siguiente.

Si GitHub falla, el bloque cae solo a jsDelivr: más lento en enterarse de
un cambio, pero no se cae nunca.

Es el mismo camino que ya usaba la web de Mateo, en `algebraparatodos.com`.

### El widget no puede dar por supuesto dónde lo pegan

La etiqueta vive en el `<head>`. Todo lo que toque `document.body` va detrás
de una espera al DOM: si no, corre antes de que el `<body>` exista y falla
sobre `null`. Y falla en silencio de la peor manera, porque los estilos se
inyectan en el `<head>` unas líneas antes y sí funcionan, así que todo
parece haber ido bien. Fue exactamente el fallo del 21/08/2026.

## Por qué acá no está el conocimiento del bot

Estuvo, y se movió. Los `.md` con precios, preguntas frecuentes, contacto y
tono viven en el repo **privado** `chatbots-conocimiento`, y el Worker los
lee con un token de sólo lectura.

`inscripcion.md` es la única excepción y se quedó a propósito: lo necesita
también el navegador, que no puede llevar un token encima. Son fechas de
inscripción, no dato sensible, y tenerlo en un solo lugar evita dos copias
que se desincronicen.

## Para cambiar las fechas de inscripción

Editar las líneas `FECHA_APERTURA_INSCRIPCION_COMPLETA` y
`FECHA_CIERRE_INSCRIPCION_COMPLETA` de `chatbot/inscripcion.md` y hacer
push. No hay que tocar `cta-reserva.js`: las lee de acá.

## Sobre el historial

El historial de este repo arranca el 21/08/2026. No es que no haya pasado:
se creó limpio a propósito, porque el anterior conservaba en sus versiones
viejas los archivos de conocimiento que después se hicieron privados. El
repo original quedó respaldado fuera de GitHub.
