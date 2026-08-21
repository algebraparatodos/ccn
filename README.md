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
