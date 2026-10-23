Ahora construimos el módulo ASESOR FINANCIERO. Todo en pesos chilenos sin decimales (formato $12.990). Usa siempre js/datos.js.

Quiero estas secciones:

1. MOVIMIENTOS
   - Registrar un gasto o ingreso en menos de 5 segundos: monto, categoría y listo. Fecha (por defecto hoy) y nota son opcionales.
   - Categorías de gasto de base: Comida, Transporte, Universidad, Salidas, Ropa, Suscripciones, Celular, Otros. Que yo pueda crear, editar y borrar categorías.
   - Categorías de ingreso: Sueldo, Ventas, Otros.
   - Lista de movimientos del mes, con filtro por categoría y buscador.

2. PRESUPUESTO MENSUAL
   - Poner un límite por categoría para el mes.
   - Barra de avance por categoría: verde (bajo 70%), amarillo (70–100%), rojo (pasado).
   - Cuánto me queda disponible este mes en total.

3. PAGOS QUE SE REPITEN
   - Registrar pagos fijos: nombre, monto, cada cuánto (semanal, mensual, anual) y día de pago.
   - Mostrar los próximos pagos ordenados por fecha, y avisar en grande los que vencen en los próximos 3 días.
   - Botón "Pagado" que lo registre como gasto automáticamente.

4. METAS DE AHORRO
   - Crear una meta: nombre, monto objetivo y, opcional, fecha límite.
   - Ir sumando aportes.
   - Mostrar el % logrado y, si tiene fecha, cuánto tendría que apartar por semana para llegar a tiempo.

5. RESUMEN
   - Del mes actual: ingresos, gastos y saldo.
   - Un gráfico de gastos por categoría y otro de los últimos 6 meses. Hazlos sin librerías si se puede (con canvas o SVG); si no, usa una liviana desde CDN.
   - Una frase automática y simple tipo "Este mes gastaste 20% más en Salidas que el mes pasado". Esto con reglas simples calculadas en el código, no con inteligencia artificial.

En la pantalla de INICIO, reemplaza la tarjeta de Finanzas por: saldo del mes, el próximo pago que vence y la meta de ahorro más cercana a cumplirse.

Explícame también, como estudiante de Ingeniería Comercial, qué conceptos financieros estamos aplicando en cada sección (presupuesto, flujo de caja, etc.), en 1 línea cada uno.

Al terminar: explícame qué hiciste, cómo probarlo paso a paso, y marca el módulo como listo en CLAUDE.md. No hagas commit hasta que te diga "sube los cambios".
