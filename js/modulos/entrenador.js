/* entrenador.js — rutinas, modo entrenamiento, progreso y menú semanal */
(function () {
  'use strict';
  const { F, UI, G } = MV;
  const { h } = UI;

  const SECCIONES = [
    { id: 'hoy', texto: 'Hoy' },
    { id: 'rutinas', texto: 'Rutinas' },
    { id: 'progreso', texto: 'Progreso' },
    { id: 'menu', texto: 'Menú' }
  ];

  const BIBLIOTECA = {
    'Piernas': ['Sentadilla', 'Prensa de piernas', 'Peso muerto rumano', 'Zancadas', 'Extensión de cuádriceps', 'Curl femoral', 'Elevación de talones', 'Hip thrust'],
    'Pecho': ['Press banca', 'Press inclinado con mancuernas', 'Aperturas con mancuernas', 'Fondos', 'Flexiones de brazos'],
    'Espalda': ['Dominadas', 'Jalón al pecho', 'Remo con barra', 'Remo con mancuerna', 'Peso muerto'],
    'Hombros': ['Press militar', 'Elevaciones laterales', 'Face pull', 'Press Arnold'],
    'Brazos': ['Curl de bíceps', 'Curl martillo', 'Extensión de tríceps en polea', 'Press francés'],
    'Core': ['Plancha (segundos)', 'Crunch abdominal', 'Elevación de piernas', 'Rueda abdominal']
  };
  const COMIDAS = [['desayuno', 'Desayuno'], ['almuerzo', 'Almuerzo'], ['once', 'Once'], ['cena', 'Cena']];
  const PASO_PESO = 2.5;

  const estado = { semana: null, ejercicioGrafico: null };
  let reloj = null; // intervalo del cronómetro
  let colaMenu = Promise.resolve();

  /* ---------------- Datos ---------------- */

  async function rutinas() { return (await Datos.listar('rutinas')).sort((a, b) => a.nombre.localeCompare(b.nombre)); }
  async function sesiones() { return (await Datos.listar('sesiones')).sort((a, b) => b.inicio - a.inicio); }
  const enCurso = () => Datos.ajuste('sesionEnCurso', null);
  const guardarEnCurso = (s) => Datos.guardarAjuste('sesionEnCurso', s);

  function racha(lista) {
    const semanas = new Set(lista.map((s) => F.inicioSemana(s.fecha)));
    let semana = F.inicioSemana(F.hoy());
    if (!semanas.has(semana)) semana = F.sumarDias(semana, -7); // la semana actual aún no termina
    let n = 0;
    while (semanas.has(semana)) { n++; semana = F.sumarDias(semana, -7); }
    return n;
  }

  function serieCompleta(ej) {
    return ej.series.length >= ej.objetivoSeries && ej.series.every((s) => s.reps >= ej.objetivoReps);
  }

  /** Reglas fijas: 2 sesiones completas → subir 2,5 kg; 2 incompletas → mantener o bajar */
  async function sugerencias() {
    const lista = await sesiones();
    const vistas = await Datos.ajuste('sugerenciasVistas', []);
    const salida = [];
    for (const r of await rutinas()) {
      r.ejercicios.forEach((ej, i) => {
        const ultimas = lista.filter((s) => s.rutinaId === r.id).map((s) => ({ s, e: s.ejercicios.find((x) => x.nombre === ej.nombre) })).filter((x) => x.e && x.e.series.length).slice(0, 2);
        if (ultimas.length < 2) return;
        const clave = r.id + '|' + ej.nombre + '|' + ultimas[0].s.id;
        if (vistas.includes(clave)) return;
        const completas = ultimas.map((x) => serieCompleta(x.e));
        if (completas.every(Boolean) && ej.peso > 0) salida.push({ tipo: 'subir', rutina: r, indice: i, ej, clave, nuevo: ej.peso + PASO_PESO });
        else if (!completas.some(Boolean)) salida.push({ tipo: 'bajar', rutina: r, indice: i, ej, clave, nuevo: Math.max(0, ej.peso - PASO_PESO) });
      });
    }
    return salida;
  }

  /* ---------------- Pantalla ---------------- */

  async function render(cont, ruta) {
    if (reloj) { clearInterval(reloj); reloj = null; }
    const sub = SECCIONES.some((s) => s.id === ruta.sub) ? ruta.sub : 'hoy';
    cont.appendChild(UI.cabecera('Entrenador'));
    cont.appendChild(UI.subpestanas(SECCIONES, sub, (id) => MV.ir('entrenador/' + id, true)));
    const zona = h('section', { class: 'seccion' });
    cont.appendChild(zona);
    if (sub === 'hoy') await renderHoy(zona);
    else if (sub === 'rutinas') await renderRutinas(zona);
    else if (sub === 'progreso') await renderProgreso(zona);
    else await renderMenu(zona);
  }

  /* ---------------- HOY ---------------- */

  async function renderHoy(zona) {
    const sesion = await enCurso();
    if (sesion) return renderEntrenamiento(zona, sesion);

    const hoy = F.hoy();
    const todas = await rutinas();
    const tocan = todas.filter((r) => (r.dias || []).includes(F.diaSemana(hoy)));
    const yaHoy = (await sesiones()).filter((s) => s.fecha === hoy);

    if (yaHoy.length) {
      zona.appendChild(h('div', { class: 'tarjeta tarjeta-destacada ok' },
        h('p', { class: 'cifra-media' }, '✅ Ya entrenaste hoy'),
        h('p', { class: 'texto-suave' }, yaHoy.map((s) => s.rutinaNombre + ' · ' + F.duracion(s.duracion)).join(' · '))));
    }

    if (!todas.length) {
      zona.appendChild(UI.vacio('🏋️', 'Aún no tienes rutinas', 'Crea tu primera rutina, por ejemplo "Día A – Piernas", y asígnale días de la semana.', { texto: 'Crear rutina', fn: () => editarRutina(null) }));
      return;
    }

    if (tocan.length) {
      zona.appendChild(h('h3', { class: 'titulo-grupo' }, 'Hoy toca'));
      tocan.forEach((r) => zona.appendChild(tarjetaRutinaHoy(r, true)));
    } else {
      zona.appendChild(h('div', { class: 'tarjeta tarjeta-destacada' },
        h('p', { class: 'cifra-media' }, '😌 Hoy descansas'),
        h('p', { class: 'texto-suave' }, 'Ninguna rutina está asignada al ' + F.DIAS[F.diaSemana(hoy) - 1] + '. Descansar también es entrenar.')));
    }
    const otras = todas.filter((r) => !tocan.includes(r));
    if (otras.length) {
      zona.appendChild(h('h3', { class: 'titulo-grupo' }, tocan.length ? 'Otras rutinas' : '¿Quieres entrenar igual?'));
      otras.forEach((r) => zona.appendChild(tarjetaRutinaHoy(r, false)));
    }
  }

  function tarjetaRutinaHoy(r, destacada) {
    return h('article', { class: 'tarjeta rutina-hoy' + (destacada ? ' destacada' : '') },
      h('h3', null, r.nombre),
      h('p', { class: 'texto-suave' }, r.ejercicios.length ? r.ejercicios.map((e) => e.nombre).join(' · ') : 'Sin ejercicios'),
      r.ejercicios.length ? h('button', { type: 'button', class: 'btn ' + (destacada ? 'btn-ancho' : 'btn-secundario btn-ancho'), onclick: () => empezar(r) }, UI.icono('play'), destacada ? 'Empezar entrenamiento' : 'Entrenar esta') : null
    );
  }

  async function empezar(r) {
    const sesion = {
      rutinaId: r.id, rutinaNombre: r.nombre, inicio: Date.now(), indice: 0, descansoHasta: null,
      ejercicios: r.ejercicios.map((e) => ({ nombre: e.nombre, objetivoSeries: e.series, objetivoReps: e.reps, descanso: e.descanso, peso: e.peso, reps: e.reps, series: [] }))
    };
    await guardarEnCurso(sesion);
    if (MV.ruta().sub !== 'hoy') MV.ir('entrenador/hoy'); else MV.refrescar();
  }

  function renderEntrenamiento(zona, s) {
    const ej = s.ejercicios[s.indice];
    const total = s.ejercicios.length;
    const listos = s.ejercicios.every((e) => e.series.length >= e.objetivoSeries);
    const guardar = async () => { await guardarEnCurso(s); };

    const tiempo = h('strong', { class: 'cronometro' }, F.reloj((Date.now() - s.inicio) / 1000));
    zona.appendChild(h('div', { class: 'barra-entreno' },
      h('div', null, h('span', { class: 'texto-suave' }, s.rutinaNombre), tiempo),
      h('button', { type: 'button', class: 'btn btn-chico btn-secundario', onclick: () => terminar(s) }, 'Terminar')));

    // Puntos de avance por ejercicio
    zona.appendChild(h('div', { class: 'avance-ejercicios' }, s.ejercicios.map((e, i) => h('button', {
      type: 'button',
      class: 'ae-punto' + (i === s.indice ? ' actual' : '') + (e.series.length >= e.objetivoSeries ? ' hecho' : ''),
      'aria-label': 'Ir a ' + e.nombre,
      onclick: async () => { s.indice = i; await guardar(); MV.refrescar(); }
    }))));

    const numSerie = Math.min(ej.series.length + 1, Math.max(ej.objetivoSeries, ej.series.length + 1));
    const tarjeta = h('div', { class: 'tarjeta tarjeta-entreno' },
      h('p', { class: 'texto-suave' }, 'Ejercicio ' + (s.indice + 1) + ' de ' + total),
      h('h2', { class: 'te-nombre' }, ej.nombre),
      h('p', { class: 'te-objetivo' }, 'Objetivo: ' + ej.objetivoSeries + ' × ' + ej.objetivoReps + (ej.peso ? ' · ' + F.kg(ej.peso) : '')),
      h('p', { class: 'te-serie' }, ej.series.length >= ej.objetivoSeries ? '✅ Series completas (puedes hacer una extra)' : 'Serie ' + numSerie + ' de ' + ej.objetivoSeries),
      contador('Peso', ej.peso, PASO_PESO, (v) => F.kg(v), async (v) => { ej.peso = v; await guardar(); }),
      contador('Repeticiones', ej.reps, 1, (v) => String(v), async (v) => { ej.reps = v; await guardar(); }),
      h('button', { type: 'button', class: 'btn btn-ancho btn-gigante', onclick: async () => {
        ej.series.push({ peso: ej.peso, reps: ej.reps });
        const termino = ej.series.length === ej.objetivoSeries;
        const siguiente = termino ? s.ejercicios.findIndex((e, i) => i > s.indice && e.series.length < e.objetivoSeries) : -1;
        const quedaAlgo = s.ejercicios.some((e) => e.series.length < e.objetivoSeries);
        if (quedaAlgo && ej.descanso > 0) s.descansoHasta = Date.now() + ej.descanso * 1000;
        if (termino && siguiente >= 0) s.indice = siguiente;
        prepararSonido();
        await guardar();
        MV.refrescar();
      } }, UI.icono('check'), 'Serie lista'),
      ej.series.length ? h('div', { class: 'series-hechas' }, ej.series.map((x, i) => h('button', {
        type: 'button', class: 'chip' + (x.reps >= ej.objetivoReps ? ' activo' : ' chip-alerta'),
        'aria-label': 'Serie ' + (i + 1) + ': ' + x.reps + ' repeticiones con ' + F.kg(x.peso) + '. Tocar para borrar',
        onclick: async () => {
          if (await UI.confirmar('¿Borrar la serie ' + (i + 1) + ' (' + x.reps + ' × ' + F.kg(x.peso) + ')?', { textoSi: 'Borrar', peligro: true })) {
            ej.series.splice(i, 1); await guardar(); MV.refrescar();
          }
        }
      }, (i + 1) + ': ' + x.reps + ' × ' + F.kg(x.peso)))) : null
    );
    zona.appendChild(tarjeta);

    zona.appendChild(h('div', { class: 'fila-botones' },
      h('button', { type: 'button', class: 'btn btn-secundario', disabled: s.indice === 0, onclick: async () => { s.indice--; await guardar(); MV.refrescar(); } }, UI.icono('atras'), 'Anterior'),
      h('button', { type: 'button', class: 'btn btn-secundario', disabled: s.indice === total - 1, onclick: async () => { s.indice++; await guardar(); MV.refrescar(); } }, 'Siguiente', UI.icono('adelante'))));

    if (listos) {
      zona.appendChild(h('div', { class: 'tarjeta tarjeta-destacada ok' },
        h('p', { class: 'cifra-media' }, '🎉 ¡Terminaste la rutina!'),
        h('button', { type: 'button', class: 'btn btn-ancho', onclick: () => guardarSesion(s) }, 'Guardar sesión')));
    }

    // Temporizador de descanso
    let panelDescanso = null;
    if (s.descansoHasta && s.descansoHasta > Date.now()) {
      const cuenta = h('strong', { class: 'descanso-cifra' }, F.reloj((s.descansoHasta - Date.now()) / 1000));
      panelDescanso = h('div', { class: 'panel-descanso', role: 'timer', 'aria-live': 'off' },
        h('span', null, 'Descanso'),
        cuenta,
        h('div', { class: 'fila-botones' },
          h('button', { type: 'button', class: 'btn btn-secundario', onclick: async () => { s.descansoHasta += 15000; await guardar(); } }, '+15 s'),
          h('button', { type: 'button', class: 'btn', onclick: async () => { s.descansoHasta = null; await guardar(); panelDescanso.remove(); } }, 'Saltar')));
      panelDescanso.cuenta = cuenta;
      zona.appendChild(panelDescanso);
    }

    reloj = setInterval(async () => {
      if (!tiempo.isConnected) { clearInterval(reloj); reloj = null; return; }
      tiempo.textContent = F.reloj((Date.now() - s.inicio) / 1000);
      if (panelDescanso && panelDescanso.isConnected && s.descansoHasta) {
        const resta = (s.descansoHasta - Date.now()) / 1000;
        panelDescanso.cuenta.textContent = F.reloj(resta);
        if (resta <= 0) {
          s.descansoHasta = null;
          panelDescanso.remove();
          avisarFinDescanso();
          await guardar();
        }
      }
    }, 250);
  }

  function contador(etiqueta, valor, paso, formato, alCambiar) {
    let v = valor;
    const cifra = h('strong', { class: 'contador-valor', 'aria-live': 'polite' }, formato(v));
    const cambiar = (d) => { v = Math.max(0, Math.round((v + d) * 10) / 10); cifra.textContent = formato(v); alCambiar(v); };
    return h('div', { class: 'contador-grande' },
      h('span', { class: 'etiqueta' }, etiqueta),
      h('div', { class: 'cg-fila' },
        h('button', { type: 'button', class: 'btn-contador', 'aria-label': 'Menos ' + etiqueta.toLowerCase(), onclick: () => cambiar(-paso) }, UI.icono('menos')),
        cifra,
        h('button', { type: 'button', class: 'btn-contador', 'aria-label': 'Más ' + etiqueta.toLowerCase(), onclick: () => cambiar(paso) }, UI.icono('mas'))));
  }

  let audio = null;
  function prepararSonido() {
    try { if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch (e) { audio = null; }
  }
  function avisarFinDescanso() {
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
    try {
      if (audio) {
        [0, 0.25].forEach((t) => {
          const o = audio.createOscillator(), g = audio.createGain();
          o.frequency.value = 880; g.gain.value = 0.15;
          o.connect(g); g.connect(audio.destination);
          o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.15);
        });
      }
    } catch (e) { /* sin sonido */ }
    UI.aviso('⏱️ ¡Se acabó el descanso! A la siguiente serie');
  }

  async function terminar(s) {
    const haySeries = s.ejercicios.some((e) => e.series.length);
    if (!haySeries) {
      if (await UI.confirmar('No anotaste ninguna serie. ¿Salir sin guardar?', { titulo: 'Terminar', textoSi: 'Salir', peligro: true })) {
        await guardarEnCurso(null);
        MV.refrescar();
      }
      return;
    }
    const m = UI.modal({
      titulo: 'Terminar entrenamiento',
      contenido: [
        h('p', { class: 'texto-modal' }, 'Llevas ' + F.duracion((Date.now() - s.inicio) / 1000) + '. ¿Qué hacemos con esta sesión?'),
        h('div', { class: 'lista-acciones' },
          h('button', { type: 'button', class: 'accion', onclick: () => { m.cerrar(); guardarSesion(s); } }, UI.icono('check'), 'Guardar sesión'),
          h('button', { type: 'button', class: 'accion peligro', onclick: async () => {
            m.cerrar();
            if (await UI.confirmar('Se perderán las series anotadas.', { titulo: '¿Descartar?', textoSi: 'Descartar', peligro: true })) { await guardarEnCurso(null); MV.refrescar(); }
          } }, UI.icono('basura'), 'Descartar'),
          h('button', { type: 'button', class: 'accion', onclick: () => m.cerrar() }, UI.icono('play'), 'Seguir entrenando'))
      ]
    });
  }

  async function guardarSesion(s) {
    const fin = Date.now();
    await Datos.guardar('sesiones', {
      fecha: F.isoDeMarca(s.inicio), rutinaId: s.rutinaId, rutinaNombre: s.rutinaNombre,
      inicio: s.inicio, fin, duracion: Math.round((fin - s.inicio) / 1000),
      ejercicios: s.ejercicios.filter((e) => e.series.length).map((e) => ({ nombre: e.nombre, objetivoSeries: e.objetivoSeries, objetivoReps: e.objetivoReps, series: e.series }))
    });
    await guardarEnCurso(null);
    UI.aviso('💪 Sesión guardada: ' + F.duracion((fin - s.inicio) / 1000));
    MV.ir('entrenador/progreso');
  }

  /* ---------------- RUTINAS ---------------- */

  async function renderRutinas(zona) {
    const lista = await rutinas();
    if (!lista.length) {
      zona.appendChild(UI.vacio('📋', 'Crea tu primera rutina', 'Ponle nombre, elige ejercicios de la biblioteca y asígnale días.', { texto: 'Crear rutina', fn: () => editarRutina(null) }));
      return;
    }
    zona.appendChild(h('div', { class: 'lista-tarjetas' }, lista.map((r) => h('button', { type: 'button', class: 'tarjeta tarjeta-rutina', onclick: () => editarRutina(r) },
      h('div', { class: 'tr-cabeza' }, h('h3', null, r.nombre), UI.icono('lapiz')),
      h('div', { class: 'dias-mini' }, F.DIAS_CORTOS.map((d, i) => h('span', { class: (r.dias || []).includes(i + 1) ? 'activo' : '' }, d[0]))),
      h('ul', { class: 'tr-ejercicios' }, r.ejercicios.map((e) => h('li', null, h('span', null, e.nombre), h('span', { class: 'texto-suave' }, e.series + '×' + e.reps + (e.peso ? ' · ' + F.kg(e.peso) : '')))))
    ))));
    zona.appendChild(h('button', { type: 'button', class: 'fab', 'aria-label': 'Nueva rutina', onclick: () => editarRutina(null) }, UI.icono('mas'), h('span', null, 'Nueva rutina')));
  }

  function editarRutina(rutina) {
    const r = rutina ? JSON.parse(JSON.stringify(rutina)) : { nombre: '', dias: [], ejercicios: [] };
    const nombre = h('input', { class: 'campo', type: 'text', value: r.nombre, placeholder: 'Ej: Día A – Piernas' });
    const dias = h('div', { class: 'chips chips-dias' }, F.DIAS_CORTOS.map((d, i) => {
      const b = h('button', { type: 'button', class: 'chip' + (r.dias.includes(i + 1) ? ' activo' : ''), 'aria-pressed': String(r.dias.includes(i + 1)), onclick: () => {
        if (r.dias.includes(i + 1)) r.dias = r.dias.filter((x) => x !== i + 1); else r.dias.push(i + 1);
        b.classList.toggle('activo');
        b.setAttribute('aria-pressed', String(r.dias.includes(i + 1)));
      } }, d);
      return b;
    }));
    const listaEj = h('div', { class: 'lista-ejercicios' });

    function numero(valor, etiqueta, paso, alCambiar) {
      // step 'any': cualquier número es válido (si no, el navegador bloquea el guardado sin avisar)
      const input = h('input', { class: 'campo campo-num', type: 'number', inputmode: paso < 1 ? 'decimal' : 'numeric', min: 0, step: 'any', value: String(valor) });
      input.addEventListener('input', () => alCambiar(Number(String(input.value).replace(',', '.')) || 0));
      return h('label', { class: 'mini-campo' }, h('span', null, etiqueta), input);
    }

    function pintar() {
      if (!r.ejercicios.length) { listaEj.replaceChildren(h('p', { class: 'texto-suave centrado' }, 'Agrega ejercicios desde la biblioteca 👇')); return; }
      listaEj.replaceChildren(...r.ejercicios.map((e, i) => h('div', { class: 'ejercicio-editor' },
        h('div', { class: 'ee-cabeza' },
          h('strong', null, (i + 1) + '. ' + e.nombre),
          h('div', null,
            i > 0 ? h('button', { type: 'button', class: 'btn-icono', 'aria-label': 'Subir', onclick: () => { r.ejercicios.splice(i - 1, 0, r.ejercicios.splice(i, 1)[0]); pintar(); } }, '↑') : null,
            h('button', { type: 'button', class: 'btn-icono', 'aria-label': 'Quitar ' + e.nombre, onclick: () => { r.ejercicios.splice(i, 1); pintar(); } }, UI.icono('basura')))),
        h('div', { class: 'ee-campos' },
          numero(e.series, 'Series', 1, (v) => { e.series = Math.max(1, Math.round(v)); }),
          numero(e.reps, 'Reps', 1, (v) => { e.reps = Math.max(1, Math.round(v)); }),
          numero(e.peso, 'Kg', 0.5, (v) => { e.peso = v; }),
          numero(e.descanso, 'Descanso (s)', 15, (v) => { e.descanso = Math.round(v); }))
      )));
    }
    pintar();

    const ventana = UI.modal({
      titulo: rutina ? 'Editar rutina' : 'Nueva rutina',
      ancho: true,
      contenido: h('form', { onsubmit: async (ev) => {
        ev.preventDefault();
        if (!nombre.value.trim()) { nombre.focus(); UI.aviso('Ponle nombre a la rutina', { tipo: 'error' }); return; }
        if (!r.ejercicios.length) { UI.aviso('Agrega al menos un ejercicio', { tipo: 'error' }); return; }
        r.nombre = nombre.value.trim();
        r.dias.sort();
        await Datos.guardar('rutinas', r);
        ventana.cerrar();
        UI.aviso(rutina ? 'Rutina actualizada' : 'Rutina creada 💪');
        MV.refrescar();
      } },
        UI.campo('Nombre', nombre),
        h('div', { class: 'grupo' }, h('span', { class: 'etiqueta' }, 'Qué días'), dias),
        h('div', { class: 'grupo' }, h('span', { class: 'etiqueta' }, 'Ejercicios'), listaEj),
        h('button', { type: 'button', class: 'btn btn-secundario btn-ancho', onclick: () => elegirEjercicio((n) => {
          r.ejercicios.push({ nombre: n, series: 3, reps: 10, peso: 0, descanso: 90 });
          pintar();
        }) }, UI.icono('mas'), 'Agregar ejercicio'),
        h('div', { class: 'fila-botones' },
          rutina ? h('button', { type: 'button', class: 'btn btn-peligro-suave', onclick: async () => {
            if (await UI.confirmar('Se borrará la rutina "' + rutina.nombre + '". Tus sesiones pasadas se mantienen.', { titulo: '¿Borrar rutina?', textoSi: 'Borrar', peligro: true })) {
              await Datos.borrar('rutinas', rutina.id);
              ventana.cerrar();
              UI.aviso('Rutina borrada', { deshacer: async () => { await Datos.guardar('rutinas', rutina); MV.refrescar(); } });
              MV.refrescar();
            }
          } }, 'Borrar') : null,
          h('button', { type: 'submit', class: 'btn' }, 'Guardar rutina'))
      )
    });
  }

  async function elegirEjercicio(alElegir) {
    const propios = await Datos.listar('ejercicios');
    const buscador = h('input', { class: 'campo', type: 'search', placeholder: 'Buscar ejercicio', 'aria-label': 'Buscar ejercicio' });
    const lista = h('div', { class: 'biblioteca' });
    const ventana = UI.modal({ titulo: 'Biblioteca de ejercicios', ancho: true, contenido: [
      h('div', { class: 'buscador' }, UI.icono('buscar'), buscador),
      h('button', { type: 'button', class: 'btn btn-secundario btn-ancho', onclick: async () => {
        const nombre = await UI.preguntar('Ejercicio propio', { placeholder: 'Ej: Sentadilla búlgara' });
        if (!nombre) return;
        await Datos.guardar('ejercicios', { nombre });
        ventana.cerrar();
        alElegir(nombre);
      } }, '+ Crear ejercicio propio'),
      lista
    ] });
    const grupos = Object.assign(propios.length ? { 'Mis ejercicios': propios.map((p) => p.nombre) } : {}, BIBLIOTECA);
    function pintar() {
      const q = buscador.value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      lista.replaceChildren(...Object.entries(grupos).map(([grupo, nombres]) => {
        const visibles = nombres.filter((n) => n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q));
        if (!visibles.length) return null;
        return h('div', null, h('h3', { class: 'titulo-grupo' }, grupo), h('div', { class: 'chips chips-ej' }, visibles.map((n) => {
          const propio = grupo === 'Mis ejercicios' && propios.find((p) => p.nombre === n);
          const b = h('button', { type: 'button', class: 'chip', onclick: () => { ventana.cerrar(); alElegir(n); } }, n);
          if (propio) UI.pulsacionLarga(b, async () => {
            if (await UI.confirmar('¿Quitar "' + n + '" de tus ejercicios propios?', { textoSi: 'Quitar', peligro: true })) {
              await Datos.borrar('ejercicios', propio.id);
              ventana.cerrar();
            }
          });
          return b;
        })));
      }).filter(Boolean));
    }
    buscador.addEventListener('input', pintar);
    pintar();
  }

  /* ---------------- PROGRESO ---------------- */

  async function renderProgreso(zona) {
    const lista = await sesiones();
    const hoy = F.hoy();
    const mes = lista.filter((s) => F.mes(s.fecha) === F.mes(hoy)).length;
    const r = racha(lista);

    zona.appendChild(h('div', { class: 'cifras-mes' },
      h('div', { class: 'cifra' }, h('span', null, 'Racha'), h('strong', null, (r ? '🔥 ' : '') + F.plural(r, 'semana', 'semanas'))),
      h('div', { class: 'cifra' }, h('span', null, 'Este mes'), h('strong', null, F.plural(mes, 'sesión', 'sesiones'))),
      h('div', { class: 'cifra' }, h('span', null, 'Total'), h('strong', null, lista.length))));

    if (!lista.length) {
      zona.appendChild(UI.vacio('📈', 'Tu progreso aparecerá aquí', 'Termina tu primer entrenamiento y empezarás a ver gráficos, rachas y sugerencias.', { texto: 'Ir a entrenar', fn: () => MV.ir('entrenador/hoy') }));
      return;
    }

    // Sugerencias automáticas
    const sug = await sugerencias();
    if (sug.length) {
      zona.appendChild(h('h3', { class: 'titulo-grupo' }, 'Sugerencias'));
      sug.forEach((x) => {
        const decidir = async (aplicar) => {
          if (aplicar) {
            const rutina = await Datos.leer('rutinas', x.rutina.id);
            const ej = rutina && rutina.ejercicios.find((e) => e.nombre === x.ej.nombre);
            if (ej) { ej.peso = x.nuevo; await Datos.guardar('rutinas', rutina); }
            UI.aviso(x.ej.nombre + ': ahora ' + F.kg(x.nuevo));
          }
          const vistas = await Datos.ajuste('sugerenciasVistas', []);
          await Datos.guardarAjuste('sugerenciasVistas', vistas.concat(x.clave).slice(-200));
          MV.refrescar();
        };
        zona.appendChild(h('div', { class: 'tarjeta sugerencia ' + x.tipo },
          h('p', null, x.tipo === 'subir'
            ? '📈 En ' + x.ej.nombre + ' completaste todas las repeticiones en tus 2 últimas sesiones. ¿Subimos de ' + F.kg(x.ej.peso) + ' a ' + F.kg(x.nuevo) + '?'
            : '🤔 En ' + x.ej.nombre + ' no completaste las repeticiones 2 veces seguidas. Puedes mantener ' + F.kg(x.ej.peso) + ' o bajar a ' + F.kg(x.nuevo) + '.'),
          h('div', { class: 'fila-botones' },
            h('button', { type: 'button', class: 'btn btn-secundario', onclick: () => decidir(false) }, x.tipo === 'subir' ? 'Ahora no' : 'Mantener'),
            h('button', { type: 'button', class: 'btn', onclick: () => decidir(true) }, (x.tipo === 'subir' ? 'Subir a ' : 'Bajar a ') + F.kg(x.nuevo)))));
      });
    }

    // Gráfico por ejercicio
    const nombres = [...new Set(lista.flatMap((s) => s.ejercicios.map((e) => e.nombre)))].sort();
    if (!estado.ejercicioGrafico || !nombres.includes(estado.ejercicioGrafico)) estado.ejercicioGrafico = nombres[0];
    const zonaGrafico = h('div');
    const selector = h('select', { class: 'campo', 'aria-label': 'Ejercicio', value: estado.ejercicioGrafico, onchange: () => { estado.ejercicioGrafico = selector.value; pintarGrafico(); } },
      nombres.map((n) => h('option', { value: n }, n)));
    function pintarGrafico() {
      const puntos = lista.slice().reverse()
        .map((s) => ({ s, e: s.ejercicios.find((e) => e.nombre === estado.ejercicioGrafico) }))
        .filter((x) => x.e && x.e.series.length)
        .map((x) => ({ etiqueta: F.mostrar(x.s.fecha).slice(0, 5), valor: Math.max(...x.e.series.map((y) => y.peso)) }));
      if (puntos.length < 2) {
        zonaGrafico.replaceChildren(h('p', { class: 'texto-suave centrado' }, puntos.length ? 'Con una sesión más ya verás la línea de progreso (hoy: ' + F.kg(puntos[0].valor) + ').' : 'Sin datos'));
        return;
      }
      const primero = puntos[0].valor, ultimo = puntos[puntos.length - 1].valor;
      zonaGrafico.replaceChildren(
        G.linea(puntos, F.kg),
        h('p', { class: 'texto-suave centrado' }, ultimo > primero ? 'Subiste ' + F.kg(ultimo - primero) + ' desde tu primera sesión 💪' : ultimo === primero ? 'Mismo peso que al principio' : 'Bajaste ' + F.kg(primero - ultimo)));
    }
    pintarGrafico();
    zona.appendChild(h('div', { class: 'tarjeta' }, h('h3', null, 'Peso máximo por sesión'), selector, zonaGrafico));

    // Historial
    zona.appendChild(h('h3', { class: 'titulo-grupo' }, 'Historial'));
    zona.appendChild(h('div', { class: 'lista' }, lista.slice(0, 50).map((s) => {
      const series = s.ejercicios.reduce((n, e) => n + e.series.length, 0);
      return h('button', { type: 'button', class: 'item', onclick: () => verSesion(s) },
        h('div', { class: 'pago-fecha' }, h('strong', null, F.aFecha(s.fecha).getUTCDate()), h('span', null, F.nombreMesCorto(F.mes(s.fecha)))),
        h('div', { class: 'item-cuerpo' }, h('p', { class: 'item-titulo' }, s.rutinaNombre), h('p', { class: 'item-meta' }, F.duracion(s.duracion) + ' · ' + F.plural(series, 'serie', 'series'))),
        UI.icono('adelante'));
    })));
  }

  function verSesion(s) {
    const ventana = UI.modal({
      titulo: s.rutinaNombre + ' · ' + F.mostrar(s.fecha),
      contenido: [
        h('p', { class: 'texto-suave' }, F.horaDeMarca(s.inicio) + ' a ' + F.horaDeMarca(s.fin) + ' · ' + F.duracion(s.duracion)),
        s.ejercicios.map((e) => h('div', { class: 'detalle-ejercicio' },
          h('strong', null, e.nombre + (serieCompleta(e) ? ' ✅' : '')),
          h('div', { class: 'chips' }, e.series.map((x) => h('span', { class: 'chip' + (x.reps >= e.objetivoReps ? ' activo' : '') }, x.reps + ' × ' + F.kg(x.peso)))))),
        h('div', { class: 'fila-botones' }, h('button', { type: 'button', class: 'btn btn-peligro-suave', onclick: async () => {
          if (await UI.confirmar('Se borrará esta sesión del historial.', { titulo: '¿Borrar sesión?', textoSi: 'Borrar', peligro: true })) {
            await Datos.borrar('sesiones', s.id);
            ventana.cerrar();
            UI.aviso('Sesión borrada', { deshacer: async () => { await Datos.guardar('sesiones', s); MV.refrescar(); } });
            MV.refrescar();
          }
        } }, 'Borrar sesión'))
      ]
    });
  }

  /* ---------------- MENÚ SEMANAL ---------------- */

  function separarIngredientes(texto) {
    return (texto || '').split(/,|;|\n|\+|\s+y\s+|\s+con\s+/i).map((t) => t.trim().replace(/\.$/, '')).filter((t) => t.length > 1);
  }

  async function renderMenu(zona) {
    if (!estado.semana) estado.semana = F.inicioSemana(F.hoy());
    const lunes = estado.semana;
    const hoy = F.hoy();
    zona.appendChild(h('div', { class: 'navegador-dia' },
      h('button', { type: 'button', class: 'btn-icono', 'aria-label': 'Semana anterior', onclick: () => { estado.semana = F.sumarDias(lunes, -7); MV.refrescar(); } }, UI.icono('atras')),
      h('div', { class: 'nd-centro' }, h('strong', null, lunes === F.inicioSemana(hoy) ? 'Esta semana' : 'Semana del ' + F.mostrar(lunes).slice(0, 5)),
        h('span', null, F.mostrar(lunes) + ' al ' + F.mostrar(F.sumarDias(lunes, 6)))),
      h('button', { type: 'button', class: 'btn-icono', 'aria-label': 'Semana siguiente', onclick: () => { estado.semana = F.sumarDias(lunes, 7); MV.refrescar(); } }, UI.icono('adelante'))));

    const registros = await Datos.listar('menu');
    const delDia = (iso) => registros.find((r) => r.id === iso) || { id: iso };

    const dias = h('div', { class: 'menu-dias' });
    for (let i = 0; i < 7; i++) {
      const iso = F.sumarDias(lunes, i);
      const reg = delDia(iso);
      const esHoy = iso === hoy;
      const det = h('details', { class: 'tarjeta menu-dia' + (esHoy ? ' hoy' : ''), open: esHoy || undefined },
        h('summary', null, h('strong', null, F.DIAS[i].replace(/^./, (c) => c.toUpperCase())), h('span', { class: 'texto-suave' }, ' ' + F.mostrar(iso).slice(0, 5) + (esHoy ? ' · hoy' : '')),
          h('span', { class: 'menu-resumen texto-suave' }, COMIDAS.filter(([k]) => reg[k]).length ? COMIDAS.filter(([k]) => reg[k]).length + '/4' : '')),
        COMIDAS.map(([clave, nombre]) => {
          const area = h('textarea', { class: 'campo campo-comida', rows: 1, placeholder: '—', value: reg[clave] || '', 'aria-label': nombre + ' del ' + F.DIAS[i] });
          let t = null;
          // En fila: si dos comidas se guardan a la vez, una no borra a la otra
          const guardar = () => {
            colaMenu = colaMenu.then(async () => {
              const actual = (await Datos.leer('menu', iso)) || { id: iso };
              if ((actual[clave] || '') === area.value.trim()) return;
              actual[clave] = area.value.trim();
              await Datos.guardar('menu', actual);
            }).catch((e) => console.error(e));
            return colaMenu;
          };
          area.addEventListener('input', () => { clearTimeout(t); t = setTimeout(guardar, 600); });
          area.addEventListener('blur', () => { clearTimeout(t); guardar(); });
          return h('label', { class: 'fila-comida' }, h('span', null, nombre), area);
        }));
      dias.appendChild(det);
    }
    zona.appendChild(dias);

    // Lista de compras
    const compras = (await Datos.listar('compras')).filter((c) => c.semana === lunes).sort((a, b) => (a.hecho ? 1 : 0) - (b.hecho ? 1 : 0) || a.creado - b.creado);
    const lista = h('div', { class: 'lista-compras' });
    const nuevo = h('input', { class: 'campo', type: 'text', placeholder: 'Agregar algo a la lista…', 'aria-label': 'Agregar a la lista de compras' });

    function pintarCompras() {
      if (!compras.length) { lista.replaceChildren(h('p', { class: 'texto-suave centrado' }, 'La lista está vacía. Arma la lista desde el menú o agrega cosas a mano.')); return; }
      lista.replaceChildren(...compras.map((c) => h('label', { class: 'item-compra' + (c.hecho ? ' hecho' : '') },
        h('input', { type: 'checkbox', checked: c.hecho, onchange: async (e) => { c.hecho = e.target.checked; await Datos.guardar('compras', c); e.target.closest('.item-compra').classList.toggle('hecho', c.hecho); } }),
        h('span', null, c.texto))));
    }
    pintarCompras();

    zona.appendChild(h('div', { class: 'tarjeta' },
      h('div', { class: 'tr-cabeza' }, h('h3', null, '🛒 Lista de compras'), h('span', { class: 'texto-suave' }, compras.filter((c) => !c.hecho).length + ' pendientes')),
      h('p', { class: 'ayuda' }, 'Tip: separa con comas lo que lleva cada comida (ej: "arroz, pollo, ensalada") y la lista se arma sola.'),
      h('button', { type: 'button', class: 'btn btn-secundario btn-ancho', onclick: async () => {
        const regs = (await Datos.listar('menu')).filter((r) => r.id >= lunes && r.id <= F.sumarDias(lunes, 6));
        const existentes = new Set(compras.map((c) => c.texto.toLowerCase()));
        let n = 0;
        for (const r of regs) {
          for (const [k] of COMIDAS) {
            for (const item of separarIngredientes(r[k])) {
              const texto = item.charAt(0).toUpperCase() + item.slice(1);
              if (existentes.has(texto.toLowerCase())) continue;
              existentes.add(texto.toLowerCase());
              await Datos.guardar('compras', { semana: lunes, texto, hecho: false, origen: 'menu' });
              n++;
            }
          }
        }
        UI.aviso(n ? 'Agregué ' + F.plural(n, 'cosa', 'cosas') + ' a la lista' : 'No encontré nada nuevo en el menú de esta semana');
        MV.refrescar();
      } }, '✨ Armar lista desde el menú'),
      h('form', { class: 'fila-entrada', onsubmit: async (e) => {
        e.preventDefault();
        const t = nuevo.value.trim();
        if (!t) return;
        compras.push(await Datos.guardar('compras', { semana: lunes, texto: t, hecho: false, origen: 'manual' }));
        nuevo.value = '';
        pintarCompras();
      } }, nuevo, h('button', { type: 'submit', class: 'btn btn-redondo', 'aria-label': 'Agregar' }, UI.icono('mas'))),
      lista,
      h('button', { type: 'button', class: 'btn-texto', onclick: async () => {
        const marcados = compras.filter((c) => c.hecho);
        if (!marcados.length) { UI.aviso('No hay nada marcado'); return; }
        for (const c of marcados) await Datos.borrar('compras', c.id);
        UI.aviso('Borré ' + F.plural(marcados.length, 'cosa marcada', 'cosas marcadas'));
        MV.refrescar();
      } }, 'Borrar lo marcado')
    ));
  }

  /* ---------------- Resumen para Inicio ---------------- */

  async function resumen() {
    const hoy = F.hoy();
    const s = await enCurso();
    const tocan = (await rutinas()).filter((r) => (r.dias || []).includes(F.diaSemana(hoy)));
    const lista = await sesiones();
    const yaHoy = lista.some((x) => x.fecha === hoy);
    const r = racha(lista);
    let texto;
    if (s) texto = '▶️ Entrenando: ' + s.rutinaNombre;
    else if (yaHoy) texto = '✅ Ya entrenaste hoy';
    else if (tocan.length) texto = tocan.map((x) => x.nombre).join(' · ');
    else texto = '😌 Hoy descansas';
    return h('ul', { class: 'tm-datos' },
      h('li', { class: 'tm-ancho' }, h('span', null, 'Hoy toca'), h('strong', null, texto)),
      h('li', { class: 'tm-ancho' }, h('span', null, 'Racha'), h('strong', null, (r ? '🔥 ' : '') + F.plural(r, 'semana seguida', 'semanas seguidas')))
    );
  }

  MV.registrar({ id: 'entrenador', titulo: 'Entrenador', render, resumen });
})();
