Hola Claude. Vamos a empezar el proyecto "Mi Vida". Lee primero CLAUDE.md completo y respeta todas sus reglas.

En este paso solo construimos la BASE de la app, sin las funciones de cada módulo todavía.

Quiero que hagas esto:

1. La estructura de carpetas y archivos que dice CLAUDE.md.

2. Una pantalla de INICIO que muestre:
   - Un saludo según la hora ("Buenos días, Alejandro" / "Buenas tardes" / "Buenas noches").
   - La fecha de hoy en formato chileno.
   - 4 tarjetas grandes, una por módulo, que lleven a cada uno. Por ahora cada tarjeta dice "Próximamente".

3. Una barra de pestañas fija abajo con 5 opciones e íconos: Inicio, Panel, Finanzas, Entrenador, Cerebro. Que se marque la pestaña activa.

4. Cada módulo con una pantalla vacía que diga su nombre y "En construcción".

5. El archivo js/datos.js con funciones simples para guardar, leer, listar y borrar registros usando IndexedDB, para que todos los módulos lo usen después. Agrega una prueba rápida que yo pueda ver funcionando.

6. Que sea una PWA instalable:
   - manifest.json con nombre "Mi Vida", colores y orientación vertical.
   - Íconos en 192x192 y 512x512 (genéralos tú, algo simple y bonito con las iniciales "MV").
   - service-worker.js para que funcione sin internet.

7. Diseño: moderno, limpio, mobile-first, modo oscuro automático. Elige una paleta con personalidad (nada genérico) y explícame por qué la elegiste.

8. Un archivo .gitignore que excluya respaldos .json de datos, fotos y archivos del sistema.

Al terminar:
- Explícame en simple qué hiciste.
- Dime cómo abrir la app en mi computador para verla (paso a paso).
- Explícame qué es una PWA en 3 líneas.
- Marca "01 Base de la app" como lista en CLAUDE.md.

No hagas commit todavía, eso es en el siguiente paso.
