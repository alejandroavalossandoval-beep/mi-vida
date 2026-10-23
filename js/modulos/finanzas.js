/* finanzas.js — Asesor financiero: movimientos, presupuesto, pagos fijos, metas y resumen */
(function () {
  'use strict';
  const { F, UI, G } = MV;
  const { h } = UI;

  const SECCIONES = [
    { id: 'movimientos', texto: 'Movimientos' },
    { id: 'presupuesto', texto: 'Presupuesto' },
    { id: 'pagos', texto: 'Pagos fijos' },
    { id: 'metas', texto: 'Metas' },
    { id: 'resumen', texto: 'Resumen' }
  ];
  const BASE_GASTO = [['Comida', '🍔'], ['Transporte', '🚌'], ['Universidad', '🎓'], ['Salidas', '🎉'], ['Ropa', '👕'], ['Suscripciones', '📺'], ['Celular', '📱'], ['Otros', '📦']];
  const BASE_INGRESO = [['Sueldo', '💼'], ['Ventas', '🏷️'], ['Otros', '💵']];
  const COLORES = ['#B5482F', '#2E6B57', '#7A5AA6', '#C98A1B', '#2F6690', '#A23E6B', '#5B7C2E', '#8A6E5A', '#3F8C8C', '#9C4F96'];
  const FRECUENCIAS = { semanal: 'Semanal', mensual: 'Mensual', anual: 'Anual' };

  const estado = { mes: null, tipo: 'gasto', filtroCat: '', busqueda: '', mesResumen: null };

  /* ---------------- Datos ---------------- */

  async function categorias() {
    if (!(await Datos.ajuste('semillaFinanzas'))) {
      let i = 0;
      for (const [nombre, emoji] of BASE_GASTO) await Datos.guardar('categoriasFin', { nombre, emoji, tipo: 'gasto', color: COLORES[i % COLORES.length], orden: i++ });
      for (const [nombre, emoji] of BASE_INGRESO) await Datos.guardar('categoriasFin', { nombre, emoji, tipo: 'ingreso', color: COLORES[i % COLORES.length], orden: i++ });
      await Datos.guardarAjuste('semillaFinanzas', true);
    }
    return (await Datos.listar('categoriasFin')).sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99));
  }

  const SIN_CAT = { nombre: 'Sin categoría', emoji: '❔', color: '#8A8090' };
  function buscarCat(cats, id) { return cats.find((c) => c.id === id) || SIN_CAT; }

  async function movimientosDelMes(clave) {
    return (await Datos.listar('movimientos')).filter((m) => F.mes(m.fecha) === clave);
  }

  function totales(movs) {
    let ingresos = 0, gastos = 0;
    movs.forEach((m) => { if (m.tipo === 'ingreso') ingresos += m.monto; else gastos += m.monto; });
    return { ingresos, gastos, saldo: ingresos - gastos };
  }

  function gastosPorCategoria(movs) {
    const mapa = {};
    movs.filter((m) => m.tipo === 'gasto').forEach((m) => { mapa[m.categoria || ''] = (mapa[m.categoria || ''] || 0) + m.monto; });
    return mapa;
  }

  /** Siguiente fecha (≥ desde) en que toca un pago fijo */
  function siguienteFecha(pago, desde) {
    if (pago.frecuencia === 'semanal') {
      return F.sumarDias(desde, (pago.dia - F.diaSemana(desde) + 7) % 7);
    }
    if (pago.frecuencia === 'anual') {
      let anio = Number(desde.slice(0, 4));
      let f = F.fechaEnMes(anio + '-' + String(pago.mes).padStart(2, '0'), pago.dia);
      if (f < desde) f = F.fechaEnMes((anio + 1) + '-' + String(pago.mes).padStart(2, '0'), pago.dia);
      return f;
    }
    let clave = F.mes(desde);
    let f = F.fechaEnMes(clave, pago.dia);
    if (f < desde) f = F.fechaEnMes(F.sumarMeses(clave, 1), pago.dia);
    return f;
  }

  /** El próximo pago pendiente (puede estar atrasado) */
  function vencimiento(pago) {
    const desde = pago.pagadoHasta ? F.sumarDias(pago.pagadoHasta, 1) : (pago.desde || F.hoy());
    return siguienteFecha(pago, desde);
  }

  function totalMeta(meta) { return (meta.aportes || []).reduce((s, a) => s + a.monto, 0); }

  /* ---------------- Pantalla ---------------- */

  async function render(cont, ruta) {
    const sub = SECCIONES.some((s) => s.id === ruta.sub) ? ruta.sub : 'movimientos';
    cont.appendChild(UI.cabecera('Asesor financiero'));
    cont.appendChild(UI.subpestanas(SECCIONES, sub, (id) => MV.ir('finanzas/' + id, true)));
    const zona = h('section', { class: 'seccion' });
    cont.appendChild(zona);
    const cats = await categorias();
    if (sub === 'movimientos') await renderMovimientos(zona, cats);
    else if (sub === 'presupuesto') await renderPresupuesto(zona, cats);
    else if (sub === 'pagos') await renderPagos(zona, cats);
    else if (sub === 'metas') await renderMetas(zona);
    else await renderResumen(zona, cats);
  }

  /* ---------------- MOVIMIENTOS ---------------- */

  async function renderMovimientos(zona, cats) {
    if (!estado.mes) estado.mes = F.mes(F.hoy());
    const nuevo = { categoria: null, fecha: F.hoy() };

    const monto = UI.campoDinero(0, { 'aria-label': 'Monto', class: 'campo campo-dinero campo-grande' });
    const zonaCats = h('div', { class: 'rejilla-cats' });
    const fecha = h('input', { class: 'campo', type: 'date', value: nuevo.fecha });
    const nota = h('input', { class: 'campo', type: 'text', placeholder: 'Ej: almuerzo con amigos', maxlength: 120 });
    const extras = h('div', { hidden: true }, h('div', { class: 'dos-columnas' }, UI.campo('Fecha', fecha), UI.campo('Nota', nota)));
    const btnExtras = h('button', { type: 'button', class: 'btn-texto', onclick: () => {
      extras.hidden = !extras.hidden;
      btnExtras.textContent = extras.hidden ? '+ Fecha y nota' : '− Ocultar';
    } }, '+ Fecha y nota');

    function pintarCats() {
      const lista = cats.filter((c) => c.tipo === estado.tipo);
      zonaCats.replaceChildren(...lista.map((c) => h('button', {
        type: 'button',
        class: 'cat-btn' + (nuevo.categoria === c.id ? ' activo' : ''),
        style: { '--cat': c.color },
        'aria-pressed': String(nuevo.categoria === c.id),
        onclick: () => { nuevo.categoria = c.id; pintarCats(); }
      }, h('span', { class: 'cat-emoji', 'aria-hidden': 'true' }, c.emoji || '🏷️'), h('span', null, c.nombre))));
    }

    const selectorTipo = h('div', { class: 'selector-tipo', role: 'group' });
    function pintarTipo() {
      selectorTipo.replaceChildren(
        ...[['gasto', 'Gasto'], ['ingreso', 'Ingreso']].map(([id, t]) => h('button', {
          type: 'button', class: 'st-op st-' + id + (estado.tipo === id ? ' activo' : ''), 'aria-pressed': String(estado.tipo === id),
          onclick: () => { estado.tipo = id; nuevo.categoria = null; pintarTipo(); pintarCats(); }
        }, t)));
    }
    pintarTipo();
    pintarCats();

    zona.appendChild(h('form', { class: 'tarjeta form-movimiento', onsubmit: async (e) => {
      e.preventDefault();
      const valor = monto.leer();
      if (!valor) { monto.input.focus(); UI.aviso('Escribe el monto', { tipo: 'error' }); return; }
      if (!nuevo.categoria) { UI.aviso('Elige una categoría', { tipo: 'error' }); return; }
      const guardado = await Datos.guardar('movimientos', { tipo: estado.tipo, monto: valor, categoria: nuevo.categoria, fecha: fecha.value || F.hoy(), nota: nota.value.trim() || null });
      UI.aviso((estado.tipo === 'gasto' ? 'Gasto' : 'Ingreso') + ' de ' + F.dinero(valor) + ' guardado', { deshacer: async () => { await Datos.borrar('movimientos', guardado.id); MV.refrescar(); } });
      estado.mes = F.mes(guardado.fecha);
      MV.refrescar();
    } },
      selectorTipo,
      monto,
      zonaCats,
      btnExtras,
      extras,
      h('button', { type: 'submit', class: 'btn btn-ancho' }, 'Guardar')
    ));

    // Lista del mes
    const todos = await movimientosDelMes(estado.mes);
    const t = totales(todos);
    zona.appendChild(h('div', { class: 'navegador-dia' },
      h('button', { type: 'button', class: 'btn-icono', 'aria-label': 'Mes anterior', onclick: () => { estado.mes = F.sumarMeses(estado.mes, -1); MV.refrescar(); } }, UI.icono('atras')),
      h('div', { class: 'nd-centro' }, h('strong', null, F.nombreMes(estado.mes).replace(/^./, (c) => c.toUpperCase())),
        h('span', null, 'Entró ' + F.dinero(t.ingresos) + ' · Salió ' + F.dinero(t.gastos))),
      h('button', { type: 'button', class: 'btn-icono', 'aria-label': 'Mes siguiente', onclick: () => { estado.mes = F.sumarMeses(estado.mes, 1); MV.refrescar(); } }, UI.icono('adelante'))
    ));

    const filtro = h('select', { class: 'campo', 'aria-label': 'Filtrar por categoría', value: estado.filtroCat, onchange: () => { estado.filtroCat = filtro.value; pintar(); } },
      h('option', { value: '' }, 'Todas las categorías'),
      h('optgroup', { label: 'Gastos' }, cats.filter((c) => c.tipo === 'gasto').map((c) => h('option', { value: c.id }, c.emoji + ' ' + c.nombre))),
      h('optgroup', { label: 'Ingresos' }, cats.filter((c) => c.tipo === 'ingreso').map((c) => h('option', { value: c.id }, c.emoji + ' ' + c.nombre))));
    filtro.value = estado.filtroCat;
    const buscador = h('input', { class: 'campo', type: 'search', placeholder: 'Buscar', value: estado.busqueda, 'aria-label': 'Buscar movimientos' });
    buscador.addEventListener('input', () => { estado.busqueda = buscador.value; pintar(); });
    zona.appendChild(h('div', { class: 'dos-columnas filtros-mov' }, filtro, h('div', { class: 'buscador' }, UI.icono('buscar'), buscador)));
    zona.appendChild(h('button', { type: 'button', class: 'btn-texto', onclick: () => gestionarCategorias() }, '⚙️ Editar categorías'));

    const lista = h('div', { class: 'lista-grupos' });
    zona.appendChild(lista);

    function pintar() {
      const q = estado.busqueda.toLowerCase().trim();
      const visibles = todos
        .filter((m) => !estado.filtroCat || m.categoria === estado.filtroCat)
        .filter((m) => {
          if (!q) return true;
          const c = buscarCat(cats, m.categoria);
          return (m.nota || '').toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q) || String(m.monto).includes(q.replace(/\D/g, '') || '¬');
        })
        .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado - a.creado);
      if (!todos.length) { lista.replaceChildren(UI.vacio('🪙', 'Sin movimientos en ' + F.nombreMes(estado.mes), 'Registra tu primer gasto o ingreso arriba: monto, categoría y listo.')); return; }
      if (!visibles.length) { lista.replaceChildren(UI.vacio('🔍', 'No hay movimientos con ese filtro')); return; }
      const grupos = [];
      visibles.forEach((m) => {
        let g = grupos[grupos.length - 1];
        if (!g || g.fecha !== m.fecha) { g = { fecha: m.fecha, items: [] }; grupos.push(g); }
        g.items.push(m);
      });
      lista.replaceChildren(...grupos.map((g) => h('div', { class: 'grupo-dia' },
        h('h3', { class: 'titulo-grupo' }, F.relativa(g.fecha) + (F.relativa(g.fecha) !== F.mostrar(g.fecha) ? ' · ' + F.mostrar(g.fecha) : '')),
        h('div', { class: 'lista' }, g.items.map((m) => filaMovimiento(m, cats))))));
    }
    pintar();
  }

  function filaMovimiento(m, cats) {
    const c = buscarCat(cats, m.categoria);
    const fila = h('div', { class: 'item item-mov' },
      h('span', { class: 'mov-emoji', style: { '--cat': c.color }, 'aria-hidden': 'true' }, c.emoji || '🏷️'),
      h('div', { class: 'item-cuerpo' },
        h('p', { class: 'item-titulo' }, c.nombre),
        m.nota ? h('p', { class: 'item-meta' }, m.nota) : null),
      h('strong', { class: 'mov-monto ' + m.tipo }, (m.tipo === 'gasto' ? '−' : '+') + F.dinero(m.monto)),
      h('button', { type: 'button', class: 'btn-icono', 'aria-label': 'Opciones', onclick: () => menuMovimiento(m, cats) }, UI.icono('puntos'))
    );
    UI.pulsacionLarga(fila, () => menuMovimiento(m, cats));
    return UI.deslizable(fila, [
      { texto: 'Editar', icono: 'lapiz', clase: 'gris', fn: () => editarMovimiento(m, cats) },
      { texto: 'Borrar', icono: 'basura', clase: 'rojo', fn: () => borrarMovimiento(m) }
    ]);
  }

  async function borrarMovimiento(m) {
    if (await UI.confirmar('Se borrará este movimiento de ' + F.dinero(m.monto) + '.', { titulo: '¿Borrar?', textoSi: 'Borrar', peligro: true })) {
      await Datos.borrar('movimientos', m.id);
      UI.aviso('Movimiento borrado', { deshacer: async () => { await Datos.guardar('movimientos', m); MV.refrescar(); } });
      MV.refrescar();
    }
  }

  function menuMovimiento(m, cats) {
    UI.acciones(buscarCat(cats, m.categoria).nombre + ' · ' + F.dinero(m.monto), [
      { texto: 'Editar', fn: () => editarMovimiento(m, cats) },
      { texto: 'Borrar', peligro: true, fn: () => borrarMovimiento(m) }
    ]);
  }

  function editarMovimiento(m, cats) {
    const datos = { tipo: m.tipo };
    const monto = UI.campoDinero(m.monto);
    const selCat = h('select', { class: 'campo' });
    const pintarSel = () => {
      selCat.replaceChildren(...cats.filter((c) => c.tipo === datos.tipo).map((c) => h('option', { value: c.id }, c.emoji + ' ' + c.nombre)));
      if (cats.some((c) => c.id === m.categoria && c.tipo === datos.tipo)) selCat.value = m.categoria;
    };
    pintarSel();
    const fecha = h('input', { class: 'campo', type: 'date', value: m.fecha });
    const nota = h('input', { class: 'campo', type: 'text', value: m.nota || '' });
    const ventana = UI.modal({
      titulo: 'Editar movimiento',
      contenido: h('form', { onsubmit: async (e) => {
        e.preventDefault();
        if (!monto.leer()) { UI.aviso('Escribe el monto', { tipo: 'error' }); return; }
        await Datos.guardar('movimientos', Object.assign({}, m, { tipo: datos.tipo, monto: monto.leer(), categoria: selCat.value, fecha: fecha.value || m.fecha, nota: nota.value.trim() || null }));
        ventana.cerrar();
        UI.aviso('Cambios guardados');
        MV.refrescar();
      } },
        h('div', { class: 'grupo' }, UI.chips([{ id: 'gasto', texto: 'Gasto' }, { id: 'ingreso', texto: 'Ingreso' }], datos.tipo, (v) => { datos.tipo = v; pintarSel(); })),
        UI.campo('Monto', monto),
        UI.campo('Categoría', selCat),
        h('div', { class: 'dos-columnas' }, UI.campo('Fecha', fecha), UI.campo('Nota', nota)),
        h('div', { class: 'fila-botones' },
          h('button', { type: 'button', class: 'btn btn-secundario', onclick: () => ventana.cerrar() }, 'Cancelar'),
          h('button', { type: 'submit', class: 'btn' }, 'Guardar')))
    });
  }

  async function gestionarCategorias() {
    const cuerpo = h('div');
    const ventana = UI.modal({ titulo: 'Categorías', contenido: cuerpo, alCerrar: () => MV.refrescar() });
    async function pintar() {
      const cats = await categorias();
      cuerpo.replaceChildren(...['gasto', 'ingreso'].map((tipo) => h('div', { class: 'bloque-cats' },
        h('h3', { class: 'titulo-grupo' }, tipo === 'gasto' ? 'De gasto' : 'De ingreso'),
        h('div', { class: 'lista' }, cats.filter((c) => c.tipo === tipo).map((c) => h('div', { class: 'item item-compacto' },
          h('span', { class: 'mov-emoji', style: { '--cat': c.color } }, c.emoji || '🏷️'),
          h('div', { class: 'item-cuerpo' }, h('p', { class: 'item-titulo' }, c.nombre)),
          h('button', { type: 'button', class: 'btn-icono', 'aria-label': 'Renombrar ' + c.nombre, onclick: async () => {
            const nombre = await UI.preguntar('Renombrar categoría', { valor: c.nombre });
            if (nombre) { await Datos.guardar('categoriasFin', Object.assign({}, c, { nombre })); pintar(); }
          } }, UI.icono('lapiz')),
          h('button', { type: 'button', class: 'btn-icono', 'aria-label': 'Borrar ' + c.nombre, onclick: async () => {
            if (await UI.confirmar('Los movimientos de "' + c.nombre + '" no se borran: quedarán como "Sin categoría".', { titulo: '¿Borrar categoría?', textoSi: 'Borrar', peligro: true })) {
              await Datos.borrar('categoriasFin', c.id);
              await Datos.borrar('presupuestos', c.id);
              pintar();
            }
          } }, UI.icono('basura'))))),
        h('button', { type: 'button', class: 'btn btn-secundario btn-ancho', onclick: async () => {
          const nombre = await UI.preguntar('Nueva categoría de ' + tipo, { placeholder: 'Nombre', ayuda: 'Puedes empezar con un emoji, por ejemplo: 🐶 Mascota' });
          if (!nombre) return;
          const partes = nombre.match(/^(\p{Extended_Pictographic}️?)\s*(.*)$/u);
          const lista = await categorias();
          await Datos.guardar('categoriasFin', {
            nombre: partes ? (partes[2] || nombre) : nombre, emoji: partes ? partes[1] : '🏷️', tipo,
            color: COLORES[lista.length % COLORES.length], orden: lista.length
          });
          pintar();
        } }, '+ Agregar categoría')
      )));
    }
    await pintar();
    return ventana;
  }

  /* ---------------- PRESUPUESTO ---------------- */

  function estadoBarra(p) { return p > 100 ? 'peligro' : p >= 70 ? 'aviso' : 'ok'; }

  async function renderPresupuesto(zona, cats) {
    const mes = F.mes(F.hoy());
    const movs = await movimientosDelMes(mes);
    const porCat = gastosPorCategoria(movs);
    const limites = await Datos.listar('presupuestos');
    const limite = (id) => (limites.find((l) => l.id === id) || {}).monto || 0;
    const gastoCats = cats.filter((c) => c.tipo === 'gasto');
    const totalLimite = gastoCats.reduce((s, c) => s + limite(c.id), 0);
    // Solo se compara contra el presupuesto lo gastado en categorías que tienen límite
    const totalGasto = gastoCats.filter((c) => limite(c.id)).reduce((s, c) => s + (porCat[c.id] || 0), 0);
    const fueraDelPresupuesto = totales(movs).gastos - totalGasto;
    const disponible = totalLimite - totalGasto;

    const p = totalLimite ? totalGasto / totalLimite * 100 : 0;
    zona.appendChild(h('div', { class: 'tarjeta tarjeta-destacada' },
      h('p', { class: 'etiqueta' }, 'Disponible en ' + F.nombreMes(mes)),
      h('p', { class: 'cifra-grande ' + (disponible < 0 ? 'rojo' : '') }, totalLimite ? F.dinero(disponible) : '—'),
      totalLimite ? UI.barra(p, estadoBarra(p)) : null,
      h('p', { class: 'texto-suave' }, totalLimite
        ? 'Gastaste ' + F.dinero(totalGasto) + ' de un presupuesto de ' + F.dinero(totalLimite) + ' (' + Math.round(p) + '%)'
        : 'Ponle un límite a cada categoría para saber cuánto te queda.'),
      totalLimite && fueraDelPresupuesto > 0 ? h('p', { class: 'texto-suave' }, 'Además gastaste ' + F.dinero(fueraDelPresupuesto) + ' en categorías sin límite.') : null
    ));

    const conLimite = gastoCats.filter((c) => limite(c.id));
    const sinLimite = gastoCats.filter((c) => !limite(c.id));
    if (conLimite.length) {
      zona.appendChild(h('h3', { class: 'titulo-grupo' }, 'Límites del mes'));
      zona.appendChild(h('div', { class: 'lista' }, conLimite.map((c) => {
        const g = porCat[c.id] || 0, l = limite(c.id), pc = g / l * 100;
        return h('button', { type: 'button', class: 'item item-presupuesto', onclick: () => editarLimite(c, l) },
          h('div', { class: 'ip-cabeza' },
            h('span', null, (c.emoji || '') + ' ' + c.nombre),
            h('span', { class: pc > 100 ? 'rojo' : '' }, F.dinero(g) + ' / ' + F.dinero(l))),
          UI.barra(pc, estadoBarra(pc)),
          h('span', { class: 'ip-pie' }, pc > 100 ? 'Te pasaste por ' + F.dinero(g - l) : 'Quedan ' + F.dinero(l - g)));
      })));
    }
    zona.appendChild(h('h3', { class: 'titulo-grupo' }, conLimite.length ? 'Sin límite' : 'Elige una categoría para ponerle límite'));
    zona.appendChild(h('div', { class: 'lista' }, sinLimite.map((c) => h('button', { type: 'button', class: 'item item-compacto', onclick: () => editarLimite(c, 0) },
      h('span', { class: 'mov-emoji', style: { '--cat': c.color } }, c.emoji || '🏷️'),
      h('div', { class: 'item-cuerpo' }, h('p', { class: 'item-titulo' }, c.nombre), porCat[c.id] ? h('p', { class: 'item-meta' }, 'Llevas ' + F.dinero(porCat[c.id])) : null),
      h('span', { class: 'btn-texto' }, 'Poner límite')))));
  }

  function editarLimite(cat, actual) {
    const monto = UI.campoDinero(actual, { autofocus: true });
    const ventana = UI.modal({
      titulo: 'Límite para ' + cat.nombre,
      contenido: h('form', { onsubmit: async (e) => {
        e.preventDefault();
        const v = monto.leer();
        if (v) await Datos.guardar('presupuestos', { id: cat.id, monto: v });
        else await Datos.borrar('presupuestos', cat.id);
        ventana.cerrar();
        UI.aviso(v ? 'Límite guardado' : 'Límite quitado');
        MV.refrescar();
      } },
        h('p', { class: 'ayuda' }, 'Cuánto quieres gastar como máximo cada mes en esta categoría. Déjalo en blanco para quitar el límite.'),
        monto,
        h('div', { class: 'fila-botones' },
          h('button', { type: 'button', class: 'btn btn-secundario', onclick: () => ventana.cerrar() }, 'Cancelar'),
          h('button', { type: 'submit', class: 'btn' }, 'Guardar')))
    });
  }

  /* ---------------- PAGOS FIJOS ---------------- */

  function descripcionFrecuencia(p) {
    if (p.frecuencia === 'semanal') return 'Cada ' + F.DIAS[p.dia - 1];
    if (p.frecuencia === 'anual') return 'Cada año, el ' + p.dia + ' de ' + F.MESES[p.mes - 1];
    return 'Cada mes, el día ' + p.dia;
  }

  async function renderPagos(zona, cats) {
    const hoy = F.hoy();
    const pagos = (await Datos.listar('pagos')).map((p) => ({ p, vence: vencimiento(p) })).sort((a, b) => a.vence.localeCompare(b.vence));
    const urgentes = pagos.filter((x) => F.diferencia(hoy, x.vence) <= 3);

    if (urgentes.length) {
      zona.appendChild(h('div', { class: 'alerta-grande' },
        h('p', { class: 'ag-titulo' }, '⏰ ' + (urgentes.length === 1 ? 'Tienes un pago por vencer' : 'Tienes ' + urgentes.length + ' pagos por vencer')),
        urgentes.map((x) => h('div', { class: 'ag-fila' },
          h('div', null, h('strong', null, x.p.nombre), h('span', null, textoVence(x.vence))),
          h('button', { type: 'button', class: 'btn btn-chico', onclick: () => marcarPagado(x.p, x.vence, cats) }, 'Pagado')))
      ));
    }

    if (!pagos.length) {
      zona.appendChild(UI.vacio('🔁', 'No tienes pagos fijos', 'Agrega lo que pagas siempre: plan del celular, Spotify, arriendo, pase escolar…', { texto: 'Agregar pago fijo', fn: () => editarPago(null, cats) }));
      return;
    }
    const totalMensual = pagos.reduce((s, x) => s + (x.p.frecuencia === 'mensual' ? x.p.monto : x.p.frecuencia === 'semanal' ? x.p.monto * 52 / 12 : x.p.monto / 12), 0);
    zona.appendChild(h('p', { class: 'texto-suave centrado' }, 'Tus pagos fijos equivalen a unos ' + F.dinero(totalMensual) + ' al mes'));
    zona.appendChild(h('h3', { class: 'titulo-grupo' }, 'Próximos pagos'));
    zona.appendChild(h('div', { class: 'lista' }, pagos.map((x) => {
      const dias = F.diferencia(hoy, x.vence);
      const fila = h('div', { class: 'item item-pago' + (dias < 0 ? ' atrasada' : dias <= 3 ? ' pronto' : '') },
        h('div', { class: 'pago-fecha' }, h('strong', null, F.aFecha(x.vence).getUTCDate()), h('span', null, F.nombreMesCorto(F.mes(x.vence)))),
        h('div', { class: 'item-cuerpo' },
          h('p', { class: 'item-titulo' }, x.p.nombre),
          h('p', { class: 'item-meta' }, textoVence(x.vence) + ' · ' + descripcionFrecuencia(x.p))),
        h('div', { class: 'pago-lado' },
          h('strong', null, F.dinero(x.p.monto)),
          h('button', { type: 'button', class: 'btn btn-chico btn-secundario', onclick: () => marcarPagado(x.p, x.vence, cats) }, 'Pagado')),
        h('button', { type: 'button', class: 'btn-icono btn-info', 'aria-label': 'Opciones', onclick: () => menuPago(x.p, cats) }, UI.icono('puntos')));
      UI.pulsacionLarga(fila, () => menuPago(x.p, cats));
      return UI.deslizable(fila, [
        { texto: 'Editar', icono: 'lapiz', clase: 'gris', fn: () => editarPago(x.p, cats) },
        { texto: 'Pagado', icono: 'check', clase: 'verde', fn: () => marcarPagado(x.p, x.vence, cats) }
      ]);
    })));
    zona.appendChild(h('button', { type: 'button', class: 'fab', 'aria-label': 'Nuevo pago fijo', onclick: () => editarPago(null, cats) }, UI.icono('mas'), h('span', null, 'Nuevo pago')));
  }

  function textoVence(fecha) {
    const d = F.diferencia(F.hoy(), fecha);
    if (d < 0) return 'Atrasado ' + F.plural(-d, 'día', 'días');
    if (d === 0) return 'Vence hoy';
    if (d === 1) return 'Vence mañana';
    return 'Vence en ' + d + ' días (' + F.mostrar(fecha) + ')';
  }

  async function marcarPagado(pago, fecha, cats) {
    let cat = pago.categoria;
    if (!cat || !cats.some((c) => c.id === cat)) {
      const otros = cats.find((c) => c.tipo === 'gasto' && c.nombre === 'Otros') || cats.find((c) => c.tipo === 'gasto');
      cat = otros ? otros.id : null;
    }
    const mov = await Datos.guardar('movimientos', { tipo: 'gasto', monto: pago.monto, categoria: cat, fecha: F.hoy(), nota: pago.nombre, pagoId: pago.id });
    await Datos.guardar('pagos', Object.assign({}, pago, { pagadoHasta: fecha }));
    UI.aviso(pago.nombre + ' pagado y anotado como gasto', { deshacer: async () => {
      await Datos.borrar('movimientos', mov.id);
      await Datos.guardar('pagos', pago);
      MV.refrescar();
    } });
    MV.refrescar();
  }

  function menuPago(p, cats) {
    UI.acciones(p.nombre, [
      { texto: 'Editar', fn: () => editarPago(p, cats) },
      { texto: 'Borrar', peligro: true, fn: async () => {
        if (await UI.confirmar('Se borrará el pago fijo "' + p.nombre + '". Los gastos ya registrados se mantienen.', { titulo: '¿Borrar pago fijo?', textoSi: 'Borrar', peligro: true })) {
          await Datos.borrar('pagos', p.id);
          UI.aviso('Pago fijo borrado', { deshacer: async () => { await Datos.guardar('pagos', p); MV.refrescar(); } });
          MV.refrescar();
        }
      } }
    ]);
  }

  function editarPago(pago, cats) {
    const p = pago || { nombre: '', monto: 0, frecuencia: 'mensual', dia: Number(F.hoy().slice(8)), mes: Number(F.hoy().slice(5, 7)), categoria: '' };
    const nombre = h('input', { class: 'campo', type: 'text', value: p.nombre, placeholder: 'Ej: Plan celular', autofocus: true });
    const monto = UI.campoDinero(p.monto);
    const frecuencia = h('select', { class: 'campo', value: p.frecuencia, onchange: () => pintarDia() },
      Object.entries(FRECUENCIAS).map(([id, t]) => h('option', { value: id }, t)));
    const zonaDia = h('div');
    let dia, mes;
    function pintarDia() {
      const f = frecuencia.value;
      if (f === 'semanal') {
        dia = h('select', { class: 'campo', value: String(p.frecuencia === 'semanal' ? p.dia : 1) }, F.DIAS.map((d, i) => h('option', { value: String(i + 1) }, d)));
        zonaDia.replaceChildren(UI.campo('Qué día', dia));
      } else if (f === 'anual') {
        dia = h('input', { class: 'campo', type: 'number', min: 1, max: 31, inputmode: 'numeric', value: String(p.dia) });
        mes = h('select', { class: 'campo', value: String(p.mes || 1) }, F.MESES.map((m, i) => h('option', { value: String(i + 1) }, m)));
        zonaDia.replaceChildren(h('div', { class: 'dos-columnas' }, UI.campo('Día', dia), UI.campo('Mes', mes)));
      } else {
        dia = h('input', { class: 'campo', type: 'number', min: 1, max: 31, inputmode: 'numeric', value: String(p.frecuencia === 'mensual' ? p.dia : 1) });
        zonaDia.replaceChildren(UI.campo('Día del mes', dia, 'Si el mes es más corto, se cobra el último día.'));
      }
    }
    pintarDia();
    const cat = h('select', { class: 'campo', value: p.categoria || '' },
      h('option', { value: '' }, 'Otros'),
      cats.filter((c) => c.tipo === 'gasto').map((c) => h('option', { value: c.id }, c.emoji + ' ' + c.nombre)));

    const ventana = UI.modal({
      titulo: pago ? 'Editar pago fijo' : 'Nuevo pago fijo',
      contenido: h('form', { onsubmit: async (e) => {
        e.preventDefault();
        const d = Number(dia.value);
        if (!nombre.value.trim()) { nombre.focus(); return; }
        if (!monto.leer()) { UI.aviso('Escribe el monto', { tipo: 'error' }); return; }
        if (frecuencia.value !== 'semanal' && (!d || d < 1 || d > 31)) { UI.aviso('El día tiene que estar entre 1 y 31', { tipo: 'error' }); return; }
        const cambioFecha = !pago || pago.frecuencia !== frecuencia.value || pago.dia !== d || (frecuencia.value === 'anual' && pago.mes !== Number(mes.value));
        await Datos.guardar('pagos', Object.assign({}, p, {
          nombre: nombre.value.trim(), monto: monto.leer(), frecuencia: frecuencia.value, dia: d,
          mes: frecuencia.value === 'anual' ? Number(mes.value) : null, categoria: cat.value || null,
          // Si cambia la fecha, se parte de hoy para no arrastrar atrasos que no existen
          desde: cambioFecha ? F.hoy() : p.desde, pagadoHasta: cambioFecha ? null : p.pagadoHasta
        }));
        ventana.cerrar();
        UI.aviso(pago ? 'Pago actualizado' : 'Pago fijo agregado');
        MV.refrescar();
      } },
        UI.campo('Nombre', nombre),
        UI.campo('Monto', monto),
        UI.campo('Cada cuánto', frecuencia),
        zonaDia,
        UI.campo('Anotar como gasto en', cat),
        h('div', { class: 'fila-botones' },
          h('button', { type: 'button', class: 'btn btn-secundario', onclick: () => ventana.cerrar() }, 'Cancelar'),
          h('button', { type: 'submit', class: 'btn' }, 'Guardar')))
    });
  }

  /* ---------------- METAS ---------------- */

  function calculoMeta(meta) {
    const ahorrado = totalMeta(meta);
    const falta = Math.max(0, meta.objetivo - ahorrado);
    const pct = meta.objetivo ? ahorrado / meta.objetivo * 100 : 0;
    let porSemana = null, dias = null;
    if (meta.fechaLimite && falta > 0) {
      dias = F.diferencia(F.hoy(), meta.fechaLimite);
      if (dias >= 0) porSemana = falta / Math.max(1, Math.ceil(dias / 7));
    }
    return { ahorrado, falta, pct, porSemana, dias };
  }

  async function renderMetas(zona) {
    const metas = await Datos.listar('metas');
    if (!metas.length) {
      zona.appendChild(UI.vacio('🎯', 'Aún no tienes metas de ahorro', 'Un notebook, un viaje, un fondo de emergencia… ponle nombre y monto.', { texto: 'Crear meta', fn: () => editarMeta(null) }));
      return;
    }
    metas.sort((a, b) => calculoMeta(b).pct - calculoMeta(a).pct);
    zona.appendChild(h('div', { class: 'lista-tarjetas' }, metas.map((meta) => {
      const c = calculoMeta(meta);
      const lograda = c.falta === 0;
      const tarjeta = h('article', { class: 'tarjeta meta' + (lograda ? ' lograda' : '') },
        h('div', { class: 'meta-cabeza' },
          h('h3', null, (lograda ? '🏆 ' : '') + meta.nombre),
          h('button', { type: 'button', class: 'btn-icono', 'aria-label': 'Opciones de la meta', onclick: () => menuMeta(meta) }, UI.icono('puntos'))),
        h('p', { class: 'meta-cifras' }, h('strong', null, F.dinero(c.ahorrado)), ' de ' + F.dinero(meta.objetivo), h('span', { class: 'meta-pct' }, Math.floor(c.pct) + '%')),
        UI.barra(c.pct, lograda ? 'ok' : 'meta'),
        h('p', { class: 'texto-suave' },
          lograda ? '¡Meta cumplida!' :
            c.porSemana !== null ? 'Para llegar al ' + F.mostrar(meta.fechaLimite) + ' aparta ' + F.dinero(Math.ceil(c.porSemana)) + ' por semana (faltan ' + F.dinero(c.falta) + ')' :
              meta.fechaLimite ? 'La fecha límite ya pasó. Faltan ' + F.dinero(c.falta) + '.' :
                'Faltan ' + F.dinero(c.falta)),
        !lograda ? h('button', { type: 'button', class: 'btn btn-ancho', onclick: () => aportar(meta) }, '+ Aportar') : null
      );
      return tarjeta;
    })));
    zona.appendChild(h('button', { type: 'button', class: 'fab', 'aria-label': 'Nueva meta', onclick: () => editarMeta(null) }, UI.icono('mas'), h('span', null, 'Nueva meta')));
  }

  function aportar(meta) {
    const monto = UI.campoDinero(0, { autofocus: true });
    const ventana = UI.modal({
      titulo: 'Aportar a ' + meta.nombre,
      contenido: h('form', { onsubmit: async (e) => {
        e.preventDefault();
        const v = monto.leer();
        if (!v) { UI.aviso('Escribe el monto', { tipo: 'error' }); return; }
        const nueva = Object.assign({}, meta, { aportes: (meta.aportes || []).concat({ fecha: F.hoy(), monto: v }) });
        await Datos.guardar('metas', nueva);
        ventana.cerrar();
        UI.aviso(calculoMeta(nueva).falta === 0 ? '🏆 ¡Cumpliste tu meta!' : 'Aporte de ' + F.dinero(v) + ' guardado');
        MV.refrescar();
      } },
        monto,
        h('div', { class: 'fila-botones' },
          h('button', { type: 'button', class: 'btn btn-secundario', onclick: () => ventana.cerrar() }, 'Cancelar'),
          h('button', { type: 'submit', class: 'btn' }, 'Aportar')))
    });
  }

  function menuMeta(meta) {
    UI.acciones(meta.nombre, [
      { texto: 'Ver aportes', icono: 'reloj', fn: () => verAportes(meta) },
      { texto: 'Editar', icono: 'lapiz', fn: () => editarMeta(meta) },
      { texto: 'Borrar', icono: 'basura', peligro: true, fn: async () => {
        if (await UI.confirmar('Se borrará la meta "' + meta.nombre + '" y sus aportes.', { titulo: '¿Borrar meta?', textoSi: 'Borrar', peligro: true })) {
          await Datos.borrar('metas', meta.id);
          UI.aviso('Meta borrada', { deshacer: async () => { await Datos.guardar('metas', meta); MV.refrescar(); } });
          MV.refrescar();
        }
      } }
    ]);
  }

  function verAportes(meta) {
    const lista = (meta.aportes || []).map((a, i) => ({ a, i })).reverse();
    const ventana = UI.modal({
      titulo: 'Aportes · ' + meta.nombre,
      contenido: lista.length ? h('div', { class: 'lista' }, lista.map(({ a, i }) => h('div', { class: 'item item-compacto' },
        h('div', { class: 'item-cuerpo' }, h('p', { class: 'item-titulo' }, F.dinero(a.monto)), h('p', { class: 'item-meta' }, F.mostrar(a.fecha))),
        h('button', { type: 'button', class: 'btn-icono', 'aria-label': 'Borrar aporte', onclick: async () => {
          if (!(await UI.confirmar('Se quitará el aporte de ' + F.dinero(a.monto) + '.', { textoSi: 'Quitar', peligro: true }))) return;
          const aportes = meta.aportes.slice();
          aportes.splice(i, 1);
          await Datos.guardar('metas', Object.assign({}, meta, { aportes }));
          ventana.cerrar();
          MV.refrescar();
        } }, UI.icono('basura'))))) : UI.vacio('🪙', 'Aún no hay aportes')
    });
  }

  function editarMeta(meta) {
    const m = meta || { nombre: '', objetivo: 0, fechaLimite: '' };
    const nombre = h('input', { class: 'campo', type: 'text', value: m.nombre, placeholder: 'Ej: Notebook nuevo', autofocus: true });
    const objetivo = UI.campoDinero(m.objetivo);
    const fecha = h('input', { class: 'campo', type: 'date', value: m.fechaLimite || '' });
    const ventana = UI.modal({
      titulo: meta ? 'Editar meta' : 'Nueva meta de ahorro',
      contenido: h('form', { onsubmit: async (e) => {
        e.preventDefault();
        if (!nombre.value.trim()) { nombre.focus(); return; }
        if (!objetivo.leer()) { UI.aviso('Escribe cuánto quieres juntar', { tipo: 'error' }); return; }
        await Datos.guardar('metas', Object.assign({ aportes: [] }, m, { nombre: nombre.value.trim(), objetivo: objetivo.leer(), fechaLimite: fecha.value || null }));
        ventana.cerrar();
        UI.aviso(meta ? 'Meta actualizada' : 'Meta creada 🎯');
        MV.refrescar();
      } },
        UI.campo('Para qué', nombre),
        UI.campo('Cuánto quieres juntar', objetivo),
        UI.campo('Fecha límite (opcional)', fecha),
        h('div', { class: 'fila-botones' },
          h('button', { type: 'button', class: 'btn btn-secundario', onclick: () => ventana.cerrar() }, 'Cancelar'),
          h('button', { type: 'submit', class: 'btn' }, 'Guardar')))
    });
  }

  /* ---------------- RESUMEN ---------------- */

  async function frases(mes, cats, movs) {
    const salida = [];
    const enCurso = mes === F.mes(F.hoy());
    const anterior = await movimientosDelMes(F.sumarMeses(mes, -1));
    const ahora = gastosPorCategoria(movs), antes = gastosPorCategoria(anterior);
    const t = totales(movs);

    // 1. Mayor cambio respecto al mes pasado
    let mejor = null;
    Object.keys(ahora).forEach((id) => {
      if (!antes[id] || !id) return;
      const pct = (ahora[id] - antes[id]) / antes[id] * 100;
      if (Math.abs(ahora[id] - antes[id]) < 1000 || Math.abs(pct) < 10) return;
      if (!mejor || Math.abs(pct) > Math.abs(mejor.pct)) mejor = { id, pct };
    });
    if (mejor) {
      const nombre = buscarCat(cats, mejor.id).nombre;
      salida.push((enCurso ? 'Este mes llevas gastado ' : 'Este mes gastaste ') + Math.round(Math.abs(mejor.pct)) + '% ' + (mejor.pct > 0 ? 'más' : 'menos') + ' en ' + nombre + ' que ' + (enCurso ? 'en todo el mes pasado.' : 'el mes anterior.'));
    }

    // 2. Pasado del presupuesto
    const limites = await Datos.listar('presupuestos');
    const pasados = limites.filter((l) => (ahora[l.id] || 0) > l.monto).map((l) => ({ c: buscarCat(cats, l.id), exceso: ahora[l.id] - l.monto }));
    if (pasados.length) {
      const p = pasados.sort((a, b) => b.exceso - a.exceso)[0];
      salida.push('Te pasaste del presupuesto de ' + p.c.nombre + ' por ' + F.dinero(p.exceso) + '.');
    }

    // 3. Ahorro del mes
    if (t.ingresos > 0) {
      if (t.saldo >= 0) salida.push('Te queda el ' + Math.round(t.saldo / t.ingresos * 100) + '% de lo que entró este mes (' + F.dinero(t.saldo) + ').');
      else salida.push('Ojo: has gastado ' + F.dinero(-t.saldo) + ' más de lo que entró este mes.');
    }

    // 4. Mayor gasto
    const ids = Object.keys(ahora).sort((a, b) => ahora[b] - ahora[a]);
    if (ids.length && t.gastos) {
      salida.push('Tu mayor gasto es ' + buscarCat(cats, ids[0]).nombre + ': ' + Math.round(ahora[ids[0]] / t.gastos * 100) + '% de todo lo que gastaste.');
    }
    return salida.slice(0, 3);
  }

  async function renderResumen(zona, cats) {
    if (!estado.mesResumen) estado.mesResumen = F.mes(F.hoy());
    const mes = estado.mesResumen;
    const movs = await movimientosDelMes(mes);
    const t = totales(movs);

    zona.appendChild(h('div', { class: 'navegador-dia' },
      h('button', { type: 'button', class: 'btn-icono', 'aria-label': 'Mes anterior', onclick: () => { estado.mesResumen = F.sumarMeses(mes, -1); MV.refrescar(); } }, UI.icono('atras')),
      h('div', { class: 'nd-centro' }, h('strong', null, F.nombreMes(mes).replace(/^./, (c) => c.toUpperCase()))),
      h('button', { type: 'button', class: 'btn-icono', 'aria-label': 'Mes siguiente', onclick: () => { estado.mesResumen = F.sumarMeses(mes, 1); MV.refrescar(); } }, UI.icono('adelante'))
    ));

    zona.appendChild(h('div', { class: 'cifras-mes' },
      h('div', { class: 'cifra ingreso' }, h('span', null, 'Ingresos'), h('strong', null, F.dinero(t.ingresos))),
      h('div', { class: 'cifra gasto' }, h('span', null, 'Gastos'), h('strong', null, F.dinero(t.gastos))),
      h('div', { class: 'cifra saldo ' + (t.saldo < 0 ? 'rojo' : '') }, h('span', null, 'Saldo'), h('strong', null, F.dinero(t.saldo)))
    ));

    if (!movs.length) {
      zona.appendChild(UI.vacio('📊', 'Sin datos este mes', 'Cuando registres gastos e ingresos, aquí verás tus gráficos.', { texto: 'Registrar un movimiento', fn: () => MV.ir('finanzas/movimientos') }));
      return;
    }

    const lista = await frases(mes, cats, movs);
    if (lista.length) zona.appendChild(h('div', { class: 'tarjeta frases' }, h('h3', null, '💡 Lo que veo'), h('ul', null, lista.map((f) => h('li', null, f)))));

    const porCat = gastosPorCategoria(movs);
    const items = Object.keys(porCat).sort((a, b) => porCat[b] - porCat[a]).map((id) => {
      const c = buscarCat(cats, id);
      return { etiqueta: (c.emoji || '') + ' ' + c.nombre, valor: porCat[id], color: c.color };
    });
    if (items.length) zona.appendChild(h('div', { class: 'tarjeta' }, h('h3', null, 'Gastos por categoría'), G.barrasH(items)));

    const meses = [];
    const todos = await Datos.listar('movimientos');
    for (let i = 5; i >= 0; i--) {
      const clave = F.sumarMeses(mes, -i);
      const tm = totales(todos.filter((m) => F.mes(m.fecha) === clave));
      meses.push({ etiqueta: F.nombreMesCorto(clave), a: tm.ingresos, b: tm.gastos });
    }
    zona.appendChild(h('div', { class: 'tarjeta' }, h('h3', null, 'Últimos 6 meses'), G.columnas(meses, ['Ingresos', 'Gastos'])));
  }

  /* ---------------- Resumen para Inicio ---------------- */

  async function resumen() {
    const hoy = F.hoy();
    const t = totales(await movimientosDelMes(F.mes(hoy)));
    const pagos = (await Datos.listar('pagos')).map((p) => ({ p, vence: vencimiento(p) })).sort((a, b) => a.vence.localeCompare(b.vence));
    const metas = (await Datos.listar('metas')).map((m) => ({ m, c: calculoMeta(m) })).filter((x) => x.c.falta > 0).sort((a, b) => b.c.pct - a.c.pct);
    return h('ul', { class: 'tm-datos' },
      h('li', { class: 'tm-ancho' + (t.saldo < 0 ? ' rojo' : '') }, h('span', null, 'Saldo de ' + F.MESES[Number(hoy.slice(5, 7)) - 1]), h('strong', { class: 'tm-cifra' }, F.dinero(t.saldo))),
      h('li', { class: 'tm-ancho' + (pagos.length && F.diferencia(hoy, pagos[0].vence) <= 3 ? ' rojo' : '') }, h('span', null, 'Próximo pago'),
        h('strong', null, pagos.length ? pagos[0].p.nombre + ' · ' + F.dinero(pagos[0].p.monto) + ' · ' + F.relativa(pagos[0].vence) : 'Sin pagos fijos')),
      h('li', { class: 'tm-ancho' }, h('span', null, 'Meta más cercana'),
        h('strong', null, metas.length ? metas[0].m.nombre + ' · ' + Math.floor(metas[0].c.pct) + '%' : 'Sin metas activas'))
    );
  }

  MV.registrar({ id: 'finanzas', titulo: 'Asesor financiero', render, resumen });
})();
