Ahora quiero subir el proyecto a GitHub y publicarlo gratis para usarlo desde mi celular. Nunca he usado Git ni GitHub, así que llévame de la mano.

Antes de hacer nada, explícame en simple:
- Qué es Git (en 3 líneas).
- Qué es GitHub (en 3 líneas).
- Qué es GitHub Pages y por qué es gratis.
- Que el código va a quedar público, pero mis datos NO, porque viven en mi celular.

Después haz esto, paso a paso, esperando mi confirmación cuando yo tenga que hacer algo:

1. Revisa si tengo Git instalado (`git --version`). Si no, dime cómo instalarlo.

2. Configura mi nombre y correo de Git, pero PREGÚNTAME cuáles quiero usar. No los inventes.

3. Revisa si tengo GitHub CLI (`gh --version`). Si no está, instálalo con:
   winget install --id GitHub.cli
   (Si winget falla, dime cómo descargarlo desde la página.)

4. Ayúdame a iniciar sesión en GitHub con `gh auth login`. Explícame cada opción que me va a preguntar y cuál elegir. Si no tengo cuenta, dime cómo crearla primero.

5. Inicia el repositorio Git en esta carpeta, revisa que el .gitignore esté bien, y haz el primer commit con un mensaje en español.

6. Crea el repositorio en GitHub llamado "mi-vida" (público, porque GitHub Pages gratis lo necesita) y sube todo.

7. Activa GitHub Pages desde la rama principal, carpeta raíz. Usa `gh` si se puede; si no, dime exactamente dónde hacer clic en la web.

8. Dame el link final de mi app (tipo https://MIUSUARIO.github.io/mi-vida/) y revisa que funcione.

9. Explícame cómo instalarla en el celular:
   - Android (Chrome): menú ⋮ → "Agregar a pantalla principal" / "Instalar app".
   - iPhone (Safari): botón Compartir → "Agregar a inicio".

10. Explícame la rutina que voy a usar de ahora en adelante: cuando te diga "sube los cambios", qué haces tú y cuánto tarda en verse en el celular.

Al terminar, marca "02 GitHub y publicación" como listo en CLAUDE.md, y anota ahí el link de la app y el nombre del repositorio (esos dos datos no son privados).
