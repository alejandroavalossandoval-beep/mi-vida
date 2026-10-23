# Instrucciones para Claude Code — Proyecto "Mi Vida"

## Quién es el usuario
- Se llama **Alejandro**. Vive en Santiago, Chile. Estudia Ingeniería Comercial en primer año.
- Ya tiene **Git y Claude Code instalados** y ha hecho varios proyectos desde la terminal. No es programador de profesión: explica en español simple, sin jerga innecesaria, y cuando uses un término técnico nuevo, explícalo en una línea. No le expliques lo básico de la terminal.
- Habla siempre en **español de Chile**, cercano y claro.

## Qué estamos construyendo
Una **PWA (app web instalable)** llamada **"Mi Vida"**, pensada primero para celular, con 4 módulos en pestañas inferiores:
1. **Panel de vida** — tareas, agenda del día, notas rápidas.
2. **Asesor financiero** — ingresos, gastos, presupuesto, pagos recurrentes, metas de ahorro.
3. **Entrenador** — rutinas, registro de sesiones, progreso, menú semanal.
4. **Segundo cerebro** — documentos y papeleo con fotos, etiquetas y vencimientos.

Los prompts paso a paso están en `prompts/`. Se ejecutan **en orden**, uno a la vez.

## Reglas técnicas (no cambiar sin preguntar)
- **HTML, CSS y JavaScript puro.** Sin frameworks, sin Node, sin paso de compilación. Tiene que funcionar abriendo `index.html` y publicándose tal cual en **GitHub Pages**.
- Librerías externas solo si son imprescindibles y desde CDN (por ejemplo `cdn.jsdelivr.net`). Prefiere hacerlo sin librerías.
- Estructura:
  - `index.html` (una sola página)
  - `css/estilos.css`
  - `js/app.js` (navegación y arranque), `js/datos.js` (guardar y leer datos), un archivo por módulo en `js/modulos/`
  - `manifest.json`, `service-worker.js`, `iconos/`
- **Datos:** se guardan en el dispositivo. Usa **IndexedDB** a través de un único módulo `js/datos.js`. Ningún módulo toca el almacenamiento directo: todos pasan por `datos.js`.
- **Diseño mobile-first:** botones grandes (mínimo 44 px), texto legible, modo oscuro automático, funciona con una mano. Pestañas abajo.
- **Formato Chile:** dinero en pesos chilenos sin decimales (`$12.990`), fechas `dd-mm-aaaa`, semana que empieza el lunes, zona horaria `America/Santiago`.
- La app debe **funcionar sin internet** una vez instalada (service worker).

## Seguridad y privacidad — OBLIGATORIO
- El repositorio de GitHub es **público**. **Nunca** escribas en el código: datos personales reales, contraseñas, claves de API, tokens, RUT, números de cuenta ni correos.
- Los datos del usuario **solo viven en su dispositivo**. No los mandes a ningún servidor.
- Si alguna función necesitara una clave secreta, **detente y explícale a Alejandro** por qué y qué opciones hay, antes de hacer nada.
- Nunca subas archivos con datos (respaldos `.json`, fotos de documentos). Mantén un `.gitignore` que los excluya.

## Forma de trabajar
1. Antes de empezar un prompt, di en 2–3 líneas **qué vas a hacer**.
2. Trabaja en pasos chicos. Después de cada parte importante, **pruébala** (abre la app o revisa que no haya errores en la consola).
3. Al terminar, explica:
   - **Qué hiciste** (en simple, máximo 5 puntos).
   - **Cómo probarlo** paso a paso, como para alguien que nunca lo ha hecho.
   - **Qué viene** en el siguiente prompt.
4. **No hagas commit ni push por tu cuenta.** Cuando Alejandro diga "sube los cambios", haz:
   `git add -A`, un commit con mensaje claro **en español** que describa lo hecho, y `git push`. Después dile en cuánto rato se verá en el celular (1–2 minutos en GitHub Pages).
5. Si algo falla y no sabes por qué, dilo. No inventes.
6. No borres datos ni archivos importantes sin preguntar.

## Estado del proyecto
(Actualiza esta sección al terminar cada prompt: qué está listo y qué falta.)
- [x] 01 Base de la app
- [x] 02 GitHub y publicación
- [x] 03 Panel de vida
- [x] 04 Asesor financiero
- [x] 05 Entrenador
- [x] 06 Segundo cerebro
- [x] 07 Respaldo y pulido
- [ ] 08 Google Calendar y Gmail (opcional) — pendiente: requiere que Alejandro cree el ID de cliente en Google Cloud Console

**Publicación**
- Repositorio: `alejandroavalossandoval-beep/mi-vida` (público)
- App: https://alejandroavalossandoval-beep.github.io/mi-vida/

**Notas técnicas**
- Al subir cambios, subir también el número `VERSION` en `service-worker.js` (ej. v1.0.0 → v1.0.1). Así el celular muestra el aviso "Hay una versión nueva — Actualizar".
- Si se agrega un archivo nuevo de JS/CSS, sumarlo a la lista `ARCHIVOS` de `service-worker.js` para que funcione sin internet.
- Herramientas compartidas en `js/app.js`: `MV.F` (formato Chile), `MV.UI` (ventanas, avisos, chips), `MV.G` (gráficos SVG). Cada módulo se registra con `MV.registrar({ id, titulo, render, resumen })`.
- El Panel acepta eventos externos en la agenda vía `MV.extensionesAgenda` (pensado para el paso 08).
