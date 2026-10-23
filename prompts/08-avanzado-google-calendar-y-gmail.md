Este es el paso AVANZADO y opcional: quiero ver mi Google Calendar y mis correos importantes de Gmail dentro del Panel de vida.

Antes de programar nada, explícame en simple:
- Qué es OAuth y por qué Google me va a pedir permiso.
- Qué tengo que crear en Google Cloud Console (proyecto, pantalla de consentimiento, ID de cliente) y por qué.
- Qué parte es pública (el "Client ID" puede estar en el código) y qué NO debe estar nunca en el código (el "Client Secret" y los tokens). Para una app sin servidor como la nuestra NO se usa Client Secret.
- Qué permisos voy a dar: solo LECTURA de calendario y solo LECTURA de Gmail.
- Los límites: al ser una app en "modo de prueba" de Google, la sesión puede pedirme volver a entrar seguido, y solo funciona para mi cuenta agregada como usuario de prueba.

Luego guíame paso a paso en Google Cloud Console. Yo hago los clics; tú me dices exactamente dónde. Usa como "origen autorizado" el link de GitHub Pages que está anotado en CLAUDE.md.

Después programa:
1. Un botón "Conectar Google" en Ajustes, usando Google Identity Services (inicio de sesión en el navegador, sin servidor).
2. En el Panel de vida, sección Agenda: mostrar mis eventos de Google Calendar del día junto a los eventos propios de la app, con un color distinto.
3. Una tarjeta "Correos importantes": los últimos 5 correos no leídos de la bandeja principal, solo remitente, asunto y hora. Al tocarlo, que abra Gmail.
4. Botón "Desconectar Google" que borre el token del dispositivo.
5. Si no hay internet o no estoy conectado, que el resto de la app funcione igual.

Reglas:
- Nunca guardes tokens en el código ni en GitHub. Solo en memoria o en el dispositivo.
- Si en algún momento esto requiere un servidor o una clave secreta, detente y explícame las opciones antes de seguir.

Al terminar: explícame qué hiciste, cómo probarlo, y marca el paso 08 como listo en CLAUDE.md.
