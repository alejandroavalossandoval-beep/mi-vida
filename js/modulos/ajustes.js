/* ajustes.js — nombre, tema, respaldo/restauración y borrar todo */
(function () {
  'use strict';
  const { F, UI } = MV;
  const { h } = UI;

  function nombreArchivo() { return 'mi-vida-respaldo-' + F.mostrar(F.hoy()) + '.json'; }

  async function crearRespaldo() {
    const datos = await Datos.exportarTodo();
    const texto = JSON.stringify(datos);
    return new File([texto], nombreArchivo(), { type: 'application/json' });
  }

  async function marcarRespaldo() {
    await Datos.guardarAjuste('ultimoRespaldo', Date.now());
  }

  async function descargar(boton) {
    boton.disabled = true;
    const texto = boton.textContent;
    boton.textContent = 'Preparando…';
    try {
      const archivo = await crearRespaldo();
      const url = URL.createObjectURL(archivo);
      const a = h('a', { href: url, download: archivo.name });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      await marcarRespaldo();
      UI.aviso('Respaldo descargado: ' + archivo.name + ' (' + tamano(archivo.size) + ')', { duracion: 5000 });
    } catch (e) {
      console.error(e);
      UI.aviso('No se pudo crear el respaldo: ' + e.message, { tipo: 'error' });
    }
    boton.disabled = false;
    boton.textContent = texto;
  }

  async function compartir(boton) {
    boton.disabled = true;
    try {
      const archivo = await crearRespaldo();
      if (!(navigator.canShare && navigator.canShare({ files: [archivo] }))) {
        UI.aviso('Tu navegador no permite compartir archivos. Usa "Descargar respaldo".', { tipo: 'error' });
      } else {
        await navigator.share({ files: [archivo], title: archivo.name });
        await marcarRespaldo();
        UI.aviso('Respaldo listo ✅');
      }
    } catch (e) {
      if (e.name !== 'AbortError') UI.aviso('No se pudo compartir: ' + e.message, { tipo: 'error' });
    }
    boton.disabled = false;
  }

  function tamano(bytes) {
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
  }

  function elegirRestauracion() {
    const input = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    input.addEventListener('change', async () => {
      const archivo = input.files[0];
      input.remove();
      if (!archivo) return;
      let respaldo;
      try {
        respaldo = JSON.parse(await archivo.text());
        if (!respaldo || respaldo.app !== 'mi-vida') throw new Error('formato');
      } catch (e) {
        UI.aviso('Ese archivo no es un respaldo de Mi Vida', { tipo: 'error' });
        return;
      }
      const cuenta = Object.entries(respaldo.datos || {}).filter(([c]) => c !== 'ajustes').reduce((s, [, l]) => s + (l || []).length, 0);
      const fecha = respaldo.fecha ? F.mostrar(F.isoDeMarca(Date.parse(respaldo.fecha))) : '¿?';
      const m = UI.modal({
        titulo: 'Restaurar respaldo',
        contenido: [
          h('p', { class: 'texto-modal' }, 'Respaldo del ' + fecha + ' con ' + F.plural(cuenta, 'registro', 'registros') + '. ¿Qué hacemos con lo que tienes ahora?'),
          h('div', { class: 'lista-acciones' },
            h('button', { type: 'button', class: 'accion', onclick: () => { m.cerrar(); restaurar(respaldo, 'combinar'); } },
              UI.icono('mas'), h('span', null, h('strong', null, 'Combinar'), h('small', null, 'Mantiene lo actual y suma lo del respaldo'))),
            h('button', { type: 'button', class: 'accion peligro', onclick: async () => {
              m.cerrar();
              if (await UI.confirmar('Todo lo que tienes ahora se borrará y quedará solo lo del respaldo.', { titulo: '¿Reemplazar todo?', textoSi: 'Reemplazar', peligro: true })) restaurar(respaldo, 'reemplazar');
            } }, UI.icono('subir'), h('span', null, h('strong', null, 'Reemplazar'), h('small', null, 'Borra lo actual y deja solo el respaldo'))))
        ]
      });
    });
    document.body.appendChild(input);
    input.click();
  }

  async function restaurar(respaldo, modo) {
    UI.aviso('Restaurando… no cierres la app', { duracion: 2000 });
    try {
      await Datos.importarTodo(respaldo, modo);
      const tema = await Datos.ajuste('tema', 'auto');
      await Datos.guardarTema(tema);
      MV.aplicarTema(tema);
      const acento = await Datos.ajuste('acento', 'azul');
      await Datos.guardarAcento(acento);
      MV.aplicarAcento(acento);
      UI.aviso('✅ Datos restaurados', { duracion: 4000 });
      MV.refrescar();
    } catch (e) {
      console.error(e);
      UI.aviso('No se pudo restaurar: ' + e.message, { tipo: 'error', duracion: 6000 });
    }
  }

  async function borrarTodo() {
    const primera = await UI.confirmar('Se borrarán TODAS tus tareas, gastos, rutinas, documentos y fotos de este dispositivo. Te recomiendo descargar un respaldo antes.', { titulo: '¿Borrar todos los datos?', textoSi: 'Sí, quiero borrar', peligro: true });
    if (!primera) return;
    const texto = await UI.preguntar('Confirmación final', { ayuda: 'Para confirmar, escribe BORRAR en mayúsculas.', placeholder: 'BORRAR', textoSi: 'Borrar todo' });
    if (texto !== 'BORRAR') { if (texto !== null) UI.aviso('No escribiste BORRAR, así que no borré nada'); return; }
    await Datos.borrarTodo();
    await Datos.guardarAjuste('primerUso', Date.now());
    MV.aplicarTema('auto');
    MV.aplicarAcento('azul');
    UI.aviso('Listo, la app quedó como nueva');
    MV.ir('inicio');
  }

  const ACENTOS = [
    { id: 'azul', nombre: 'Azul' }, { id: 'cobre', nombre: 'Cobre' }, { id: 'verde', nombre: 'Verde' },
    { id: 'morado', nombre: 'Morado' }, { id: 'rosado', nombre: 'Rosado' }, { id: 'naranjo', nombre: 'Naranjo' },
    { id: 'grafito', nombre: 'Grafito' }
  ];

  // Sección agrupada al estilo Ajustes del iPhone: título arriba, filas en una tarjeta, nota abajo
  function seccion(titulo, filas, pie) {
    return h('section', { class: 'grupo-ajustes' },
      titulo ? h('h2', { class: 'ga-titulo' }, titulo) : null,
      h('div', { class: 'lista' }, filas),
      pie ? h('p', { class: 'ga-pie' }, pie) : null);
  }

  function filaBoton(icono, color, texto, fn, peligro) {
    return h('button', { type: 'button', class: 'item ga-boton' + (peligro ? ' peligro' : ''), onclick: fn },
      h('span', { class: 'cuadro-icono chico', style: { background: color }, 'aria-hidden': 'true' }, UI.icono(icono)),
      h('span', { class: 'item-cuerpo' }, texto),
      peligro ? null : UI.icono('adelante', 'flecha-fila'));
  }

  async function render(cont) {
    const nombre = await Datos.ajuste('nombre', '');
    const tema = Datos.temaGuardado();
    const acento = Datos.acentoGuardado();
    const ultimo = await Datos.ajuste('ultimoRespaldo');
    const espacio = await Datos.espacioUsado();

    cont.appendChild(UI.cabecera('Ajustes'));

    // Perfil
    const campoNombre = h('input', { class: 'campo-fila', type: 'text', value: nombre, placeholder: 'Tu nombre', autocomplete: 'given-name', maxlength: 30, enterkeyhint: 'done', 'aria-label': 'Tu nombre' });
    const guardarNombre = async () => {
      const v = campoNombre.value.trim();
      if (v === (await Datos.ajuste('nombre', ''))) return;
      await Datos.guardarAjuste('nombre', v);
      UI.aviso(v ? '¡Hola, ' + v + '!' : 'Nombre borrado');
    };
    campoNombre.addEventListener('change', guardarNombre);
    campoNombre.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); campoNombre.blur(); } });
    cont.appendChild(seccion('Perfil', [
      h('label', { class: 'item ga-fila' }, h('span', null, 'Nombre'), campoNombre)
    ], 'Se usa para saludarte. Queda guardado solo en este dispositivo.'));

    // Apariencia
    const muestras = h('div', { class: 'muestras', role: 'radiogroup', 'aria-label': 'Color de la app' }, ACENTOS.map((a) => h('button', {
      type: 'button', role: 'radio', class: 'muestra acento-' + a.id + (a.id === acento ? ' activa' : ''),
      'aria-checked': String(a.id === acento), 'aria-label': a.nombre, title: a.nombre,
      onclick: async (e) => {
        muestras.querySelectorAll('.muestra').forEach((m) => { m.classList.remove('activa'); m.setAttribute('aria-checked', 'false'); });
        e.currentTarget.classList.add('activa');
        e.currentTarget.setAttribute('aria-checked', 'true');
        MV.aplicarAcento(a.id);
        await Datos.guardarAcento(a.id);
      }
    })));
    cont.appendChild(seccion('Apariencia', [
      h('div', { class: 'item ga-bloque' },
        UI.subpestanas([{ id: 'auto', texto: 'Automático' }, { id: 'claro', texto: 'Claro' }, { id: 'oscuro', texto: 'Oscuro' }], tema, async (v) => {
          await Datos.guardarTema(v);
          MV.aplicarTema(v);
          MV.refrescar();
        })),
      h('div', { class: 'item ga-bloque' }, h('span', { class: 'etiqueta' }, 'Color de la app'), muestras)
    ], 'Automático usa el mismo modo (claro u oscuro) que tu celular.'));

    // Respaldo
    const dias = ultimo ? Math.floor((Date.now() - ultimo) / 86400000) : null;
    const puedeCompartir = !!(navigator.canShare && navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] }));
    const filaDescargar = filaBoton('descargar', 'var(--sis-azul)', 'Descargar respaldo', () => descargar(filaDescargar.querySelector('.item-cuerpo')));
    const filas = [filaDescargar];
    if (puedeCompartir) {
      const filaCompartir = filaBoton('subir', 'var(--sis-verde)', 'Guardar en Drive o Archivos', () => compartir(filaCompartir));
      filas.push(filaCompartir);
    }
    filas.push(filaBoton('reloj', 'var(--sis-naranjo)', 'Restaurar respaldo', elegirRestauracion));
    cont.appendChild(seccion('Respaldo', filas,
      (ultimo ? 'Último respaldo: ' + F.mostrar(F.isoDeMarca(ultimo)) + (dias ? ' (hace ' + F.plural(dias, 'día', 'días') + ').' : ' (hoy).') : 'Aún no haces ningún respaldo.') +
      ' Tus datos viven solo en este celular. Guarda el archivo en Google Drive o iCloud, nunca en GitHub.'));

    // Almacenamiento
    const resultadoPrueba = h('ol', { class: 'resultado-prueba' });
    cont.appendChild(seccion('Almacenamiento', [
      espacio ? h('div', { class: 'item ga-fila' }, h('span', null, 'Espacio usado'), h('span', { class: 'texto-suave' }, tamano(espacio.usage || 0))) : null,
      filaBoton('check', 'var(--sis-gris)', 'Probar que se guardan los datos', async () => {
        resultadoPrueba.replaceChildren(h('li', null, 'Probando…'));
        try {
          const pasos = await Datos.probar();
          resultadoPrueba.replaceChildren(...pasos.map((p) => h('li', null, '✅ ' + p)));
        } catch (e) {
          resultadoPrueba.replaceChildren(h('li', { class: 'rojo' }, '❌ ' + e.message));
        }
      })
    ]));
    cont.appendChild(resultadoPrueba);

    // Borrar todo
    cont.appendChild(seccion(null, [
      h('button', { type: 'button', class: 'item ga-boton peligro centrado-texto', onclick: borrarTodo }, 'Borrar todos los datos')
    ], 'Deja la app como recién instalada. Pide confirmación dos veces.'));

    cont.appendChild(h('p', { class: 'texto-suave centrado pie-ajustes' }, 'Mi Vida · tus datos nunca salen de este dispositivo'));
  }

  MV.registrar({ id: 'ajustes', titulo: 'Ajustes', pestana: 'inicio', volver: { ruta: 'inicio', texto: 'Inicio' }, render });
})();
