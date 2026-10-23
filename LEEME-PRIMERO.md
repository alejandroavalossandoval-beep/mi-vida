# Mi Vida — tu sistema personal en el celular

Este proyecto construye **una sola app para tu celular** con 4 módulos:

| Módulo | Qué hace |
|---|---|
| 🗓️ **Panel de vida** | Tareas, agenda del día y notas rápidas en un solo lugar |
| 💰 **Asesor financiero** | Ingresos, gastos, presupuesto mensual, pagos que vencen y metas de ahorro (en pesos chilenos) |
| 🏋️ **Entrenador** | Rutinas, registro de cada sesión, progreso y menú semanal |
| 🧠 **Segundo cerebro** | Tu papeleo: documentos, fotos, fechas de vencimiento y búsqueda |

Es una **app web instalable (PWA)**: vive en internet gratis (GitHub Pages), la abres desde el celular y la agregas a la pantalla de inicio. Se ve y se usa como una app normal.

> **¿Por qué una app y no cuatro?** Un solo ícono en el celular, un solo lugar donde están tus datos y un solo proyecto que mantener. Los 4 módulos son pestañas abajo.

---

## Cómo funciona esto

Tú **no escribes código**. Le pegas prompts a **Claude Code** (Claude dentro de tu terminal) y él crea los archivos en esta carpeta. Los prompts ya están escritos y en orden, en la carpeta `prompts/`.

```
mi-vida/
├── LEEME-PRIMERO.md        ← esta guía
├── CLAUDE.md               ← reglas que Claude Code lee solo, cada vez que abres la terminal aquí
├── ABRIR-CLAUDE-AQUI.bat   ← doble clic: abre la terminal en esta carpeta y arranca Claude
└── prompts/
    ├── 01-base-de-la-app.md
    ├── 02-subir-a-github-y-publicar.md
    ├── 03-panel-de-vida.md
    ├── 04-asesor-financiero.md
    ├── 05-entrenador.md
    ├── 06-segundo-cerebro.md
    ├── 07-respaldo-y-pulido.md
    └── 08-avanzado-google-calendar-y-gmail.md
```

---

## PASO 0 — Lo que necesitas antes de empezar

| Qué | Para qué | ¿Gratis? |
|---|---|---|
| **Claude Pro** (o superior) | Claude Code funciona con tu cuenta de Claude de pago | No, es la suscripción |
| **Git for Windows** | Guardar versiones y subir a GitHub | Sí |
| **Cuenta de GitHub** | Guardar el proyecto y publicarlo gratis | Sí |
| **Un celular con Chrome o Safari** | Usar la app | — |

---

## PASO 1 — Descomprimir la carpeta

1. Descarga el `.zip` que te mandé.
2. Clic derecho → **Extraer todo** → elige `Documentos`.
3. Te queda `Documentos\mi-vida`.

---

## PASO 2 — Instalar Git for Windows

1. Entra a **git-scm.com/downloads/win** y descarga el instalador.
2. Ábrelo y aprieta **Next** en todas las pantallas sin cambiar nada.

---

## PASO 3 — Instalar Claude Code

1. Aprieta **Win + X** y elige **Terminal** o **Windows PowerShell**.
2. Fíjate que la línea empiece con `PS C:\Users\...` (eso confirma que estás en PowerShell).
3. Copia esto, pégalo con clic derecho y aprieta **Enter**:

```powershell
irm https://claude.ai/install.ps1 | iex
```

4. Espera. No muestra avance, solo al final dice **"Claude Code successfully installed!"**.
5. **Cierra esa ventana.**

> **Si después dice `'claude' is not recognized`**, abre PowerShell y pega esto:
> ```powershell
> $currentPath = [Environment]::GetEnvironmentVariable('PATH', 'User')
> [Environment]::SetEnvironmentVariable('PATH', "$currentPath;$env:USERPROFILE\.local\bin", 'User')
> ```
> Cierra la ventana y vuelve a intentar.

---

## PASO 4 — Abrir Claude en la carpeta del proyecto

1. Entra a `Documentos\mi-vida`.
2. Doble clic en **`ABRIR-CLAUDE-AQUI.bat`**.
3. La primera vez se abre el navegador para que **inicies sesión con tu cuenta de Claude**.
4. Si te pregunta si confías en la carpeta, elige **Yes**.

Ya estás dentro. Ves un cuadro donde escribes, igual que en el chat.

### Lo básico de Claude Code

| Acción | Cómo |
|---|---|
| Mandar un mensaje | Escribes y **Enter** |
| Pegar texto | **Clic derecho** o **Ctrl + V** |
| Aprobar que cree o cambie archivos | **Enter** sobre "Yes" |
| Detenerlo si se va por otro lado | **Esc** |
| Ver comandos | `/help` |
| Salir | escribe `exit` |

---

## PASO 5 — Construir, prompt por prompt

Abre cada archivo de `prompts/` con el Bloc de notas, **copia todo** y pégalo en Claude Code. **Uno a la vez y en orden.** No pases al siguiente hasta terminar el anterior.

| # | Prompt | Qué obtienes al final | Tiempo aprox. |
|---|---|---|---|
| 01 | Base de la app | La app vacía con sus 4 pestañas, abriéndose en tu PC | 20–40 min |
| 02 | Subir a GitHub y publicar | **La app ya en tu celular** con su ícono | 30–60 min |
| 03 | Panel de vida | Tareas, agenda y notas funcionando | 30–60 min |
| 04 | Asesor financiero | Gastos, presupuesto, pagos y ahorro | 45–90 min |
| 05 | Entrenador | Rutinas, sesiones y progreso | 45–90 min |
| 06 | Segundo cerebro | Documentos con fotos y vencimientos | 45–90 min |
| 07 | Respaldo y pulido | Copia de seguridad de tus datos y detalles finales | 30–60 min |
| 08 | Avanzado (opcional) | Tu Google Calendar y Gmail dentro del panel | 1–2 h |

> **Por qué GitHub va en el paso 02 y no al final:** así desde el primer día ves la app en tu celular, y cada módulo nuevo aparece solo en el teléfono cuando lo subes. Mucho más motivante.

### Después de cada prompt

1. **Prueba** lo que hizo: abre la app y usa la función nueva.
2. Si algo falla, **descríbeselo con tus palabras**: "cuando aprieto guardar no pasa nada". No necesitas saber por qué falla.
3. Cuando funcione, escríbele: **`sube los cambios`**. Se guarda en GitHub y se actualiza en tu celular en 1 o 2 minutos.

---

## Tus datos: dónde quedan

- **Tus datos (gastos, tareas, documentos) se guardan dentro de tu celular**, no en GitHub ni en internet. Nadie más los ve.
- **El código sí queda público en GitHub** (es gratis así). Por eso nunca se escriben datos personales, claves ni contraseñas dentro del código. Las reglas de `CLAUDE.md` ya se lo prohíben a Claude.
- Como los datos viven en el celular, si lo pierdes o borras el navegador, se pierden. Por eso el prompt **07** agrega un botón de **respaldo** para guardar una copia.

---

## Si te pierdes

Escríbele a Claude Code tal cual: **"no entiendo qué hiciste, explícamelo simple"** o **"¿en qué paso vamos?"**. Para eso está.
