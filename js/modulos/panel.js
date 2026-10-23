/* panel.js — Panel de vida: tareas, agenda del día y notas rápidas */
(function () {
  'use strict';
  const { F, UI } = MV;
  const { h } = UI;

  const SECCIONES = [
    { id: 'tareas', texto: 'Tareas' },
    { id: 'agenda', texto: 'Agenda' },
    { id: 'notas', texto: 'Notas' }
  ];
  const PRIORIDADES = [
    { id: 'alta', texto: 'Alta', peso: 0 },
    { id: 'media', texto: 'Media', peso: 1 },
    { id: 'baja', texto: 'Baja', peso: 2 }
  ];
  const CATEGORIAS_BASE = ['Universidad', 'Trabajo', 'Carnicería', 'Personal'];
  const COLORES = ['#B5482F', '#2E6B57', '#7A5AA6', '#C98A1B', '#2F6690', '#A23E6B', '#5B7C2E'];

  // Lo que el usuario eligió y queremos recordar mientras la app está abierta
  const estado = { filtro: 'todas', dia: null, busqueda: '' };

  /* ---------------- Datos ---------------- */

  async function categorias() {
    if (!(await Datos.ajuste('semillaTareas'))) {
      for (let i = 0; i < CATEGORIAS_BASE.length; i++) {
        await Datos.guardar('categoriasTareas', { nombre: CATEGORIAS_BASE[i], color: COLORES[i], orden: i });
      }
      await Datos.guardarAjuste('semillaTareas', true);
    }
    return (await Datos.listar('categoriasTareas')).sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99) || a.nombre.localeCompare(b.nombre));
  }

  async function nuevaCategoria() {
    const nombre = await UI.preguntar('Nueva categoría', { placeholder: 'Ej: Deporte' });
    if (!nombre) return null;
    const lista = await Datos.listar('categoriasTareas');
    return Datos.guardar('categoriasTareas', { nombre, color: COLORES[lista.length % COLORES.length], orden: lista.length });
  }

  function pesoPrioridad(p) { const x = PRIORIDADES.find((o) => o.id === p); return x ? x.peso : 3; }

  function ordenarTareas(lista) {
    return lista.sort((a, b) =>
      pesoPrioridad(a.prioridad) - pesoPrioridad(b.prioridad) ||
      (a.fecha || '9999').localeCompare(b.fecha || '9999') ||
      a.creado - b.creado);
  }

  function filtrarTareas(lista, filtro) {
    const hoy = F.hoy();
    const lunes = F.inicioSemana(hoy), domingo = F.sumarDias(lunes, 6);
    switch (filtro) {
      case 'hoy': return lista.filter((t) => !t.hecha && t.fecha === hoy);
      case 'semana': return lista.filter((t) => !t.hecha && t.fecha && t.fecha >= lunes && t.fecha <= domingo);
      case 'atrasadas': return lista.filter((t) => !t.hecha && t.fecha && t.fecha < hoy);
      case 'hechas': return lista.filter((t) => t.hecha).sort((a, b) => (b.hechaEn || 0) - (a.hechaEn || 0));
      default: return lista.filter((t) => !t.hecha);
    }
  }

  /** ¿El evento ocurre en este día? */
  function ocurre(ev, dia) {
    if (dia < ev.fecha) return false;
    if (ev.hasta && dia > ev.hasta) return false;
    if ((ev.excepciones || []).includes(dia)) return false;
    switch (ev.repetir) {
      case 'diario': return true;
      case 'semanal': return F.diaSemana(dia) === F.diaSemana(ev.fecha);
      case 'dias': return (ev.dias || []).includes(F.diaSemana(dia));
      default: return dia === ev.fecha;
    }
  }

  async function eventosDelDia(dia) {
    const todos = await Datos.listar('eventos');
    return todos.filter((e) => ocurre(e, dia)).sort((a, b) => a.inicio.localeCompare(b.inicio));
  }

  /* ---------------- Pantalla principal ---------------- */

  async function render(cont, ruta) {
    const sub = SECCIONES.some((s) => s.id === ruta.sub) ? ruta.sub : 'tareas';
    cont.appendChild(UI.cabecera('Panel de vida'));
    cont.appendChild(UI.subpestanas(SECCIONES, sub, (id) => MV.ir('panel/' + id, true)));
    const zona = h('section', { class: 'seccion' });
    cont.appendChild(zona);
    if (sub === 'tareas') await renderTareas(zona);
    else if (sub === 'agenda') await renderAgenda(zona);
    else await renderNotas(zona);
  }

  /* ---------------- TAREAS ---------------- */

  async function renderTareas(zona) {
    const cats = await categorias();
    const opciones = { fecha: '', prioridad: '', categoria: '' };

    const titulo = h('input', { class: 'campo', type: 'text', placeholder: 'Nueva tarea…', 'aria-label': 'Nueva tarea', enterkeyhint: 'done', autocomplete: 'off' });
    const fecha = h('input', { class: 'campo', type: 'date', onchange: () => { opciones.fecha = fecha.value; } });
    const selectCat = selectorCategoria(cats, '', (v) => { opciones.categoria = v; });
    const chipsPrioridad = () => UI.chips([{ id: '', texto: 'Ninguna' }].concat(PRIORIDADES), '', (v) => { opciones.prioridad = v; }, 'chips-prioridad');
    const grupoPrioridad = h('div', { class: 'grupo' }, h('span', { class: 'etiqueta' }, 'Prioridad'), chipsPrioridad());
    const panelOpciones = h('div', { class: 'opciones-tarea', hidden: true },
      h('div', { class: 'atajos-fecha' },
        ['Hoy', 'Mañana'].map((t, i) => h('button', { type: 'button', class: 'chip', onclick: () => { fecha.value = F.sumarDias(F.hoy(), i); opciones.fecha = fecha.value; } }, t))
      ),
      UI.campo('Fecha límite', fecha),
      grupoPrioridad,
      UI.campo('Categoría', selectCat)
    );
    // Después de agregar, las opciones vuelven a cero para la siguiente tarea
    const limpiarOpciones = () => {
      opciones.fecha = ''; opciones.prioridad = ''; opciones.categoria = '';
      fecha.value = ''; selectCat.value = '';
      grupoPrioridad.lastElementChild.replaceWith(chipsPrioridad());
    };
    const btnOpciones = h('button', { type: 'button', class: 'btn-texto', 'aria-expanded': 'false', onclick: () => {
      panelOpciones.hidden = !panelOpciones.hidden;
      btnOpciones.setAttribute('aria-expanded', String(!panelOpciones.hidden));
      btnOpciones.textContent = panelOpciones.hidden ? '+ Fecha, prioridad, categoría' : '− Ocultar opciones';
    } }, '+ Fecha, prioridad, categoría');

    const form = h('form', { class: 'tarjeta form-rapido', onsubmit: async (e) => {
      e.preventDefault();
      const texto = titulo.value.trim();
      if (!texto) { titulo.focus(); return; }
      await Datos.guardar('tareas', { titulo: texto, fecha: opciones.fecha || null, prioridad: opciones.prioridad || null, categoria: opciones.categoria || null, hecha: false });
      titulo.value = '';
      limpiarOpciones();
      titulo.focus();
      UI.aviso('Tarea agregada');
      await pintarLista();
    } },
      h('div', { class: 'fila-entrada' }, titulo, h('button', { type: 'submit', class: 'btn btn-redondo', 'aria-label': 'Agregar tarea' }, UI.icono('mas'))),
      btnOpciones,
      panelOpciones
    );
    zona.appendChild(form);

    const filtros = h('div', { class: 'chips chips-filtro', role: 'group', 'aria-label': 'Filtros' });
    const lista = h('div', { class: 'lista' });
    zona.append(filtros, lista);

    async function pintarLista() {
      const todas = await Datos.listar('tareas');
      const catsActuales = await categorias();
      const cuenta = (f) => filtrarTareas(todas.slice(), f).length;
      const def = [
        { id: 'hoy', texto: 'Hoy' }, { id: 'semana', texto: 'Esta semana' }, { id: 'atrasadas', texto: 'Atrasadas' },
        { id: 'todas', texto: 'Todas' }, { id: 'hechas', texto: 'Hechas' }
      ];
      filtros.replaceChildren(...def.map((f) => {
        const n = cuenta(f.id);
        return h('button', {
          type: 'button',
          class: 'chip' + (estado.filtro === f.id ? ' activo' : '') + (f.id === 'atrasadas' && n ? ' chip-alerta' : ''),
          'aria-pressed': estado.filtro === f.id ? 'true' : 'false',
          onclick: () => { estado.filtro = f.id; pintarLista(); }
        }, f.texto, n ? h('span', { class: 'contador' }, n) : null);
      }));

      let visibles = filtrarTareas(todas, estado.filtro);
      if (estado.filtro !== 'hechas') visibles = ordenarTareas(visibles);
      if (!visibles.length) {
        const mensajes = {
          hoy: ['☀️', 'Nada pendiente para hoy', 'Agrega una tarea arriba y ponle fecha de hoy.'],
          semana: ['📅', 'Semana despejada', 'Las tareas con fecha de esta semana aparecen aquí.'],
          atrasadas: ['🎉', 'No tienes nada atrasado', 'Así se hace.'],
          hechas: ['✅', 'Aún no completas tareas', 'Toca el círculo de una tarea para marcarla como hecha.'],
          todas: ['📝', 'Tu lista está vacía', 'Escribe tu primera tarea arriba y aprieta Enter.']
        }[estado.filtro];
        lista.replaceChildren(UI.vacio(...mensajes));
        return;
      }
      lista.replaceChildren(...visibles.map((t) => filaTarea(t, catsActuales, pintarLista)));
    }
    await pintarLista();
  }

  function selectorCategoria(cats, valor, alCambiar) {
    const sel = h('select', { class: 'campo' },
      h('option', { value: '' }, 'Sin categoría'),
      cats.map((c) => h('option', { value: c.id }, c.nombre)),
      h('option', { value: '__nueva' }, '+ Nueva categoría…'));
    sel.value = valor || '';
    let anterior = sel.value;
    sel.addEventListener('change', async () => {
      if (sel.value === '__nueva') {
        const c = await nuevaCategoria();
        if (c) {
          sel.insertBefore(h('option', { value: c.id }, c.nombre), sel.lastElementChild);
          sel.value = c.id;
        } else sel.value = anterior;
      }
      anterior = sel.value;
      alCambiar(sel.value);
    });
    return sel;
  }

  function filaTarea(t, cats, refrescar) {
    const hoy = F.hoy();
    const atrasada = !t.hecha && t.fecha && t.fecha < hoy;
    const cat = cats.find((c) => c.id === t.categoria);
    const meta = [];
    if (t.fecha) meta.push(h('span', { class: 'meta-fecha' + (atrasada ? ' rojo' : '') }, (atrasada ? 'Atrasada · ' : '') + F.relativa(t.fecha)));
    if (cat) meta.push(h('span', { class: 'etiqueta-cat', style: { '--cat': cat.color } }, cat.nombre));
    // Prioridad como en Recordatorios: !!! alta, !! media, ! baja
    const marca = t.prioridad ? h('span', { class: 'excl', 'aria-label': 'Prioridad ' + t.prioridad }, { alta: '!!! ', media: '!! ', baja: '! ' }[t.prioridad]) : null;

    const check = h('button', {
      type: 'button',
      class: 'check' + (t.hecha ? ' hecho' : ''),
      'aria-label': t.hecha ? 'Marcar como pendiente' : 'Marcar como hecha',
      onclick: async () => {
        const ahora = !t.hecha;
        fila.classList.add(ahora ? 'saliendo' : 'volviendo');
        await Datos.guardar('tareas', Object.assign({}, t, { hecha: ahora, hechaEn: ahora ? Date.now() : null }));
        if (ahora) UI.aviso('¡Hecha! 💪', { deshacer: async () => { await Datos.guardar('tareas', Object.assign({}, t, { hecha: false, hechaEn: null })); refrescar(); } });
        setTimeout(refrescar, 220);
      }
    }, UI.icono('check'));

    const fila = h('div', { class: 'item item-tarea' + (atrasada ? ' atrasada' : '') + (t.hecha ? ' esta-hecha' : '') },
      check,
      h('div', { class: 'item-cuerpo' },
        h('p', { class: 'item-titulo' }, marca, t.titulo),
        meta.length ? h('div', { class: 'item-meta' }, meta) : null),
      h('button', { type: 'button', class: 'btn-icono btn-info', 'aria-label': 'Opciones de la tarea', onclick: () => menuTarea(t, refrescar) }, UI.icono('puntos'))
    );
    UI.pulsacionLarga(fila, () => menuTarea(t, refrescar));
    return UI.deslizable(fila, [
      { texto: 'Editar', icono: 'lapiz', clase: 'gris', fn: () => editarTarea(t, refrescar) },
      { texto: 'Borrar', icono: 'basura', clase: 'rojo', fn: () => borrarTarea(t, refrescar) }
    ]);
  }

  async function borrarTarea(t, refrescar) {
    if (await UI.confirmar('Se borrará "' + t.titulo + '".', { titulo: '¿Borrar tarea?', textoSi: 'Borrar', peligro: true })) {
      await Datos.borrar('tareas', t.id);
      UI.aviso('Tarea borrada', { deshacer: async () => { await Datos.guardar('tareas', t); refrescar(); } });
      refrescar();
    }
  }

  function menuTarea(t, refrescar) {
    UI.acciones(t.titulo, [
      { texto: 'Editar', fn: () => editarTarea(t, refrescar) },
      { texto: 'Borrar', peligro: true, fn: () => borrarTarea(t, refrescar) }
    ]);
  }

  async function editarTarea(t, refrescar) {
    const cats = await categorias();
    const datos = { prioridad: t.prioridad || '', categoria: t.categoria || '' };
    const titulo = h('input', { class: 'campo', type: 'text', value: t.titulo, autofocus: true });
    const fecha = h('input', { class: 'campo', type: 'date', value: t.fecha || '' });
    const m = UI.modal({
      titulo: 'Editar tarea',
      contenido: h('form', { onsubmit: async (e) => {
        e.preventDefault();
        if (!titulo.value.trim()) { titulo.focus(); return; }
        await Datos.guardar('tareas', Object.assign({}, t, { titulo: titulo.value.trim(), fecha: fecha.value || null, prioridad: datos.prioridad || null, categoria: datos.categoria || null }));
        m.cerrar();
        UI.aviso('Cambios guardados');
        refrescar();
      } },
        UI.campo('Tarea', titulo),
        UI.campo('Fecha límite', fecha),
        h('div', { class: 'grupo' }, h('span', { class: 'etiqueta' }, 'Prioridad'),
          UI.chips([{ id: '', texto: 'Ninguna' }].concat(PRIORIDADES), datos.prioridad, (v) => { datos.prioridad = v; })),
        UI.campo('Categoría', selectorCategoria(cats, datos.categoria, (v) => { datos.categoria = v; })),
        h('div', { class: 'fila-botones' },
          h('button', { type: 'button', class: 'btn btn-secundario', onclick: () => m.cerrar() }, 'Cancelar'),
          h('button', { type: 'submit', class: 'btn' }, 'Guardar'))
      )
    });
  }

  /* ---------------- AGENDA ---------------- */

  const HORA_ALTO = 56; // px por hora en la línea de tiempo

  async function renderAgenda(zona) {
    const hoy = F.hoy();
    if (!estado.dia) estado.dia = hoy;
    const dia = estado.dia;
    const esHoy = dia === hoy;
    const cambiarDia = (n) => { estado.dia = n === 0 ? hoy : F.sumarDias(estado.dia, n); MV.refrescar(); };

    zona.appendChild(h('div', { class: 'navegador-dia' },
      h('button', { type: 'button', class: 'btn-icono', 'aria-label': 'Día anterior', onclick: () => cambiarDia(-1) }, UI.icono('atras')),
      h('div', { class: 'nd-centro' },
        Math.abs(F.diferencia(hoy, dia)) <= 1
          ? [h('strong', null, F.relativa(dia)), h('span', null, F.larga(dia) + ' · ' + F.mostrar(dia))]
          : [h('strong', null, F.larga(dia).replace(/^./, (c) => c.toUpperCase())), h('span', null, F.mostrar(dia))]),
      h('button', { type: 'button', class: 'btn-icono', 'aria-label': 'Día siguiente', onclick: () => cambiarDia(1) }, UI.icono('adelante'))
    ));
    if (!esHoy) zona.appendChild(h('button', { type: 'button', class: 'btn-texto centrado', onclick: () => cambiarDia(0) }, 'Volver a hoy'));

    const eventos = await eventosDelDia(dia);
    if (MV.extensionesAgenda) {
      for (const fn of MV.extensionesAgenda) {
        try { (await fn(dia)).forEach((e) => eventos.push(e)); } catch (e) { console.warn(e); }
      }
      eventos.sort((a, b) => a.inicio.localeCompare(b.inicio));
    }

    if (!eventos.length) {
      zona.appendChild(UI.vacio('🌤️', esHoy ? 'Hoy no tienes nada agendado' : 'Día libre', 'Toca el botón + para agregar una clase, reunión o lo que quieras.'));
    }

    // Rango de horas visible
    let desde = 7, hasta = 23;
    eventos.forEach((e) => {
      desde = Math.min(desde, Math.floor(F.minutos(e.inicio) / 60));
      hasta = Math.max(hasta, Math.ceil(F.minutos(e.fin || e.inicio) / 60));
    });
    if (esHoy) desde = Math.min(desde, F.horaActual());
    hasta = Math.min(24, Math.max(hasta, desde + 1));

    const linea = h('div', { class: 'linea-tiempo', style: { height: (hasta - desde) * HORA_ALTO + 'px' } });
    for (let hr = desde; hr <= hasta; hr++) {
      linea.appendChild(h('div', { class: 'lt-hora', style: { top: (hr - desde) * HORA_ALTO + 'px' } }, h('span', null, String(hr).padStart(2, '0') + ':00')));
    }

    // Columnas para eventos que se topan
    const colocados = [];
    eventos.forEach((e) => {
      const ini = F.minutos(e.inicio);
      const fin = Math.max(F.minutos(e.fin || '') || ini + 60, ini + 15);
      colocados.push({ e, ini, fin, col: 0, cols: 1 });
    });
    colocados.forEach((c, i) => {
      const usadas = colocados.slice(0, i).filter((o) => o.ini < c.fin && c.ini < o.fin).map((o) => o.col);
      while (usadas.includes(c.col)) c.col++;
    });
    colocados.forEach((c) => {
      const grupo = colocados.filter((o) => o.ini < c.fin && c.ini < o.fin);
      c.cols = Math.max(...grupo.map((o) => o.col)) + 1;
    });

    colocados.forEach(({ e, ini, fin, col, cols }) => {
      const top = (ini - desde * 60) / 60 * HORA_ALTO;
      const alto = Math.max((fin - ini) / 60 * HORA_ALTO - 2, 26);
      const bloque = h('button', {
        type: 'button',
        class: 'lt-evento' + (e.externo ? ' externo' : '') + (alto < 44 ? ' compacto' : ''),
        style: { top: top + 'px', height: alto + 'px', left: 'calc(52px + (100% - 56px) * ' + (col / cols) + ')', width: 'calc((100% - 56px) / ' + cols + ' - 4px)' },
        onclick: () => e.externo ? (e.alTocar && e.alTocar()) : menuEvento(e, dia)
      },
        h('strong', null, e.titulo),
        h('span', null, e.inicio + (e.fin ? '–' + e.fin : '') + (e.lugar ? ' · ' + e.lugar : '') + (e.repetir && e.repetir !== 'no' ? ' · 🔁' : ''))
      );
      linea.appendChild(bloque);
    });

    if (esHoy) {
      const ahora = F.ahoraMinutos();
      if (ahora >= desde * 60 && ahora <= hasta * 60) {
        linea.appendChild(h('div', { class: 'lt-ahora', style: { top: (ahora - desde * 60) / 60 * HORA_ALTO + 'px' } }, h('span', null, F.hhmm(ahora))));
      }
    }

    zona.appendChild(h('div', { class: 'tarjeta tarjeta-linea' }, linea));
    zona.appendChild(h('button', { type: 'button', class: 'fab', 'aria-label': 'Nuevo evento', onclick: () => editarEvento(null, dia) }, UI.icono('mas'), h('span', null, 'Nuevo evento')));

    // Llevar la vista a la hora actual o al primer evento
    requestAnimationFrame(() => {
      const destino = esHoy ? linea.querySelector('.lt-ahora') : linea.querySelector('.lt-evento');
      if (destino && destino.getBoundingClientRect().top > window.innerHeight - 120) {
        window.scrollTo({ top: destino.getBoundingClientRect().top + window.scrollY - 200 });
      }
    });
  }

  function menuEvento(e, dia) {
    const repite = e.repetir && e.repetir !== 'no';
    const lista = [{ texto: 'Editar', icono: 'lapiz', fn: () => editarEvento(e, dia) }];
    if (repite) {
      lista.push({ texto: 'Quitar solo este día', icono: 'cerrar', fn: async () => {
        await Datos.guardar('eventos', Object.assign({}, e, { excepciones: (e.excepciones || []).concat(dia) }));
        UI.aviso('Quitado del ' + F.mostrar(dia));
        MV.refrescar();
      } });
    }
    lista.push({ texto: repite ? 'Borrar todas las repeticiones' : 'Borrar', icono: 'basura', peligro: true, fn: async () => {
      if (await UI.confirmar('Se borrará "' + e.titulo + '"' + (repite ? ' en todos los días que se repite.' : '.'), { titulo: '¿Borrar evento?', textoSi: 'Borrar', peligro: true })) {
        await Datos.borrar('eventos', e.id);
        UI.aviso('Evento borrado', { deshacer: async () => { await Datos.guardar('eventos', e); MV.refrescar(); } });
        MV.refrescar();
      }
    } });
    UI.acciones(e.titulo + ' · ' + e.inicio, lista);
  }

  function editarEvento(ev, dia) {
    const e = ev || { titulo: '', fecha: dia, inicio: '', fin: '', lugar: '', repetir: 'no', dias: [] };
    const datos = { repetir: e.repetir || 'no', dias: (e.dias || []).slice() };
    const titulo = h('input', { class: 'campo', type: 'text', value: e.titulo, placeholder: 'Ej: Clase de Microeconomía', autofocus: true });
    const fecha = h('input', { class: 'campo', type: 'date', value: e.fecha, required: true });
    const inicio = h('input', { class: 'campo', type: 'time', value: e.inicio, required: true });
    const fin = h('input', { class: 'campo', type: 'time', value: e.fin });
    const lugar = h('input', { class: 'campo', type: 'text', value: e.lugar || '', placeholder: 'Opcional' });
    inicio.addEventListener('change', () => {
      if (inicio.value && (!fin.value || fin.value <= inicio.value)) fin.value = F.hhmm(Math.min(F.minutos(inicio.value) + 60, 23 * 60 + 59));
    });
    const diasCont = h('div', { class: 'chips chips-dias', hidden: datos.repetir !== 'dias' },
      F.DIAS_CORTOS.map((d, i) => {
        const b = h('button', { type: 'button', class: 'chip' + (datos.dias.includes(i + 1) ? ' activo' : ''), 'aria-pressed': String(datos.dias.includes(i + 1)), onclick: () => {
          const n = i + 1;
          if (datos.dias.includes(n)) datos.dias = datos.dias.filter((x) => x !== n); else datos.dias.push(n);
          b.classList.toggle('activo');
          b.setAttribute('aria-pressed', String(datos.dias.includes(n)));
        } }, d);
        return b;
      }));
    const repetir = h('select', { class: 'campo', value: datos.repetir, onchange: () => {
      datos.repetir = repetir.value;
      diasCont.hidden = datos.repetir !== 'dias';
      if (datos.repetir === 'dias' && !datos.dias.length && fecha.value) {
        datos.dias = [F.diaSemana(fecha.value)];
        diasCont.children[datos.dias[0] - 1].classList.add('activo');
      }
    } },
      h('option', { value: 'no' }, 'No se repite'),
      h('option', { value: 'diario' }, 'Todos los días'),
      h('option', { value: 'dias' }, 'Ciertos días de la semana'),
      h('option', { value: 'semanal' }, 'Cada semana (mismo día)'));

    const m = UI.modal({
      titulo: ev ? 'Editar evento' : 'Nuevo evento',
      contenido: h('form', { onsubmit: async (evt) => {
        evt.preventDefault();
        if (!titulo.value.trim()) { titulo.focus(); return; }
        if (!inicio.value) { inicio.focus(); return; }
        if (fin.value && fin.value <= inicio.value) { UI.aviso('La hora de fin tiene que ser después del inicio', { tipo: 'error' }); return; }
        if (datos.repetir === 'dias' && !datos.dias.length) { UI.aviso('Elige al menos un día', { tipo: 'error' }); return; }
        await Datos.guardar('eventos', Object.assign({}, e, {
          titulo: titulo.value.trim(), fecha: fecha.value || dia, inicio: inicio.value, fin: fin.value || null,
          lugar: lugar.value.trim() || null, repetir: datos.repetir, dias: datos.repetir === 'dias' ? datos.dias.sort() : []
        }));
        m.cerrar();
        UI.aviso(ev ? 'Evento actualizado' : 'Evento agregado');
        MV.refrescar();
      } },
        UI.campo('Qué', titulo),
        UI.campo(datos.repetir === 'no' ? 'Día' : 'Desde el día', fecha),
        h('div', { class: 'dos-columnas' }, UI.campo('Empieza', inicio), UI.campo('Termina', fin)),
        UI.campo('Lugar', lugar),
        UI.campo('Repetir', repetir),
        diasCont,
        h('div', { class: 'fila-botones' },
          h('button', { type: 'button', class: 'btn btn-secundario', onclick: () => m.cerrar() }, 'Cancelar'),
          h('button', { type: 'submit', class: 'btn' }, 'Guardar'))
      )
    });
  }

  /* ---------------- NOTAS ---------------- */

  async function renderNotas(zona) {
    const texto = h('textarea', { class: 'campo campo-nota', rows: 2, placeholder: 'Escribe una nota…', 'aria-label': 'Nueva nota' });
    const autoAlto = () => { texto.style.height = 'auto'; texto.style.height = Math.min(texto.scrollHeight, 260) + 'px'; };
    texto.addEventListener('input', autoAlto);
    const guardarNota = async () => {
      const t = texto.value.trim();
      if (!t) { texto.focus(); return; }
      await Datos.guardar('notas', { texto: t, fijada: false });
      texto.value = '';
      autoAlto();
      UI.aviso('Nota guardada');
      pintar();
    };
    texto.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); guardarNota(); } });
    zona.appendChild(h('form', { class: 'tarjeta form-rapido', onsubmit: (e) => { e.preventDefault(); guardarNota(); } },
      texto,
      h('div', { class: 'fila-fin' }, h('button', { type: 'submit', class: 'btn' }, 'Guardar nota'))
    ));

    const buscador = h('input', { class: 'campo', type: 'search', placeholder: 'Buscar en mis notas', value: estado.busqueda, 'aria-label': 'Buscar notas' });
    buscador.addEventListener('input', () => { estado.busqueda = buscador.value; pintar(); });
    zona.appendChild(h('div', { class: 'buscador' }, UI.icono('buscar'), buscador));

    const lista = h('div', { class: 'lista-notas' });
    zona.appendChild(lista);

    async function pintar() {
      const todas = await Datos.listar('notas');
      const q = normalizar(estado.busqueda);
      const visibles = todas
        .filter((n) => !q || normalizar(n.texto).includes(q))
        .sort((a, b) => (b.fijada ? 1 : 0) - (a.fijada ? 1 : 0) || b.actualizado - a.actualizado);
      if (!todas.length) { lista.replaceChildren(UI.vacio('💡', 'Sin notas todavía', 'Anota una idea, un dato o un recordatorio. Sin título, sin complicaciones.')); return; }
      if (!visibles.length) { lista.replaceChildren(UI.vacio('🔍', 'No encontré notas con "' + estado.busqueda + '"')); return; }
      lista.replaceChildren(...visibles.map((n) => tarjetaNota(n, pintar)));
    }
    await pintar();
  }

  function normalizar(t) { return (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  function tarjetaNota(n, refrescar) {
    const fijar = async () => {
      await Datos.guardar('notas', Object.assign({}, n, { fijada: !n.fijada }));
      UI.aviso(n.fijada ? 'Nota desfijada' : 'Nota fijada arriba 📌');
      refrescar();
    };
    const tarjeta = h('article', { class: 'nota' + (n.fijada ? ' fijada' : '') },
      h('p', { class: 'nota-texto' }, n.texto),
      h('div', { class: 'nota-pie' },
        h('span', null, F.relativa(F.isoDeMarca(n.actualizado)) + ' · ' + F.horaDeMarca(n.actualizado)),
        h('div', { class: 'nota-botones' },
          h('button', { type: 'button', class: 'btn-icono' + (n.fijada ? ' activo' : ''), 'aria-label': n.fijada ? 'Desfijar' : 'Fijar arriba', 'aria-pressed': String(!!n.fijada), onclick: fijar }, UI.icono('pin')),
          h('button', { type: 'button', class: 'btn-icono', 'aria-label': 'Opciones de la nota', onclick: () => menuNota(n, refrescar, fijar) }, UI.icono('puntos'))))
    );
    UI.pulsacionLarga(tarjeta, () => menuNota(n, refrescar, fijar));
    return tarjeta;
  }

  function menuNota(n, refrescar, fijar) {
    UI.acciones('Nota', [
      { texto: 'Editar', icono: 'lapiz', fn: () => editarNota(n, refrescar) },
      { texto: n.fijada ? 'Desfijar' : 'Fijar arriba', icono: 'pin', fn: fijar },
      { texto: 'Borrar', icono: 'basura', peligro: true, fn: async () => {
        if (await UI.confirmar('Esta nota se borrará.', { titulo: '¿Borrar nota?', textoSi: 'Borrar', peligro: true })) {
          await Datos.borrar('notas', n.id);
          UI.aviso('Nota borrada', { deshacer: async () => { await Datos.guardar('notas', n); refrescar(); } });
          refrescar();
        }
      } }
    ]);
  }

  function editarNota(n, refrescar) {
    const texto = h('textarea', { class: 'campo', rows: 6, value: n.texto, autofocus: true });
    const m = UI.modal({
      titulo: 'Editar nota',
      contenido: h('form', { onsubmit: async (e) => {
        e.preventDefault();
        if (!texto.value.trim()) return;
        await Datos.guardar('notas', Object.assign({}, n, { texto: texto.value.trim() }));
        m.cerrar();
        refrescar();
      } },
        texto,
        h('div', { class: 'fila-botones' },
          h('button', { type: 'button', class: 'btn btn-secundario', onclick: () => m.cerrar() }, 'Cancelar'),
          h('button', { type: 'submit', class: 'btn' }, 'Guardar')))
    });
  }

  /* ---------------- Resumen para Inicio ---------------- */

  async function resumen() {
    const hoy = F.hoy();
    const tareas = await Datos.listar('tareas');
    const paraHoy = tareas.filter((t) => !t.hecha && t.fecha === hoy).length;
    const atrasadas = tareas.filter((t) => !t.hecha && t.fecha && t.fecha < hoy).length;

    // Próximo evento: lo que queda de hoy o los próximos 7 días
    let proximo = null;
    const ahora = F.hhmm(F.ahoraMinutos());
    for (let i = 0; i < 8 && !proximo; i++) {
      const dia = F.sumarDias(hoy, i);
      const lista = (await eventosDelDia(dia)).filter((e) => i > 0 || (e.fin || e.inicio) >= ahora);
      if (lista.length) proximo = { e: lista[0], dia };
    }

    const fijadas = (await Datos.listar('notas')).filter((n) => n.fijada).sort((a, b) => b.actualizado - a.actualizado);

    return h('ul', { class: 'tm-datos' },
      h('li', null, h('span', null, 'Tareas de hoy'), h('strong', null, paraHoy)),
      h('li', { class: atrasadas ? 'rojo' : '' }, h('span', null, 'Atrasadas'), h('strong', null, atrasadas)),
      h('li', { class: 'tm-ancho' }, h('span', null, 'Próximo evento'),
        h('strong', null, proximo ? proximo.e.inicio + ' ' + proximo.e.titulo + (proximo.dia !== hoy ? ' · ' + F.relativa(proximo.dia) : '') : 'Nada agendado')),
      fijadas.length ? h('li', { class: 'tm-ancho tm-nota' }, h('span', null, '📌 Nota fijada'), h('strong', null, fijadas[0].texto)) : null
    );
  }

  MV.registrar({ id: 'panel', titulo: 'Panel de vida', render, resumen, eventosDelDia });
})();
