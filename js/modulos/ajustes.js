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
    UI.aviso('Listo, la app quedó como nueva');
    MV.ir('inicio');
  }

  async function render(cont) {
    const nombre = await Datos.ajuste('nombre', '');
    const tema = Datos.temaGuardado();
    const ultimo = await Datos.ajuste('ultimoRespaldo');
    const espacio = await Datos.espacioUsado();

    cont.appendChild(h('header', { class: 'cabecera' },
      h('a', { href: '#/inicio', class: 'btn-icono', 'aria-label': 'Volver a inicio' }, UI.icono('atras')),
      h('h1', null, 'Ajustes')));

    // Nombre
    const campoNombre = h('input', { class: 'campo', type: 'text', value: nombre, placeholder: 'Tu nombre', autocomplete: 'given-name', maxlength: 30 });
    cont.appendChild(h('section', { class: 'tarjeta' },
      h('h2', null, '👋 Tu nombre'),
      h('p', { class: 'ayuda' }, 'Se usa para saludarte. Queda guardado solo en este dispositivo.'),
      h('form', { class: 'fila-entrada', onsubmit: async (e) => {
        e.preventDefault();
        await Datos.guardarAjuste('nombre', campoNombre.value.trim());
        campoNombre.blur();
        UI.aviso(campoNombre.value.trim() ? '¡Hola, ' + campoNombre.value.trim() + '!' : 'Nombre borrado');
      } }, campoNombre, h('button', { type: 'submit', class: 'btn' }, 'Guardar'))));

    // Tema
    cont.appendChild(h('section', { class: 'tarjeta' },
      h('h2', null, '🎨 Tema'),
      UI.chips([{ id: 'auto', texto: 'Automático' }, { id: 'claro', texto: 'Claro' }, { id: 'oscuro', texto: 'Oscuro' }], tema, async (v) => {
        await Datos.guardarTema(v);
        MV.aplicarTema(v);
      }, 'chips-ancho'),
      h('p', { class: 'ayuda' }, 'Automático usa el mismo modo que tu celular.')));

    // Respaldo
    const dias = ultimo ? Math.floor((Date.now() - ultimo) / 86400000) : null;
    const btnDescargar = h('button', { type: 'button', class: 'btn btn-ancho', onclick: () => descargar(btnDescargar) }, UI.icono('descargar'), 'Descargar respaldo');
    const puedeCompartir = !!(navigator.canShare && navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] }));
    const btnCompartir = puedeCompartir ? h('button', { type: 'button', class: 'btn btn-secundario btn-ancho', onclick: () => compartir(btnCompartir) }, '📤 Guardar en Drive / compartir') : null;
    cont.appendChild(h('section', { class: 'tarjeta' },
      h('h2', null, '💾 Respaldo'),
      h('p', { class: 'ayuda' }, ultimo ? 'Último respaldo: ' + F.mostrar(F.isoDeMarca(ultimo)) + (dias ? ' (hace ' + F.plural(dias, 'día', 'días') + ')' : ' (hoy)') : 'Aún no haces ningún respaldo.'),
      h('p', { class: 'ayuda' }, 'Tus datos viven solo en este celular. El respaldo es un archivo .json con todo (incluidas las fotos). Guárdalo en tu Google Drive, nunca en GitHub.'),
      btnDescargar,
      btnCompartir,
      h('button', { type: 'button', class: 'btn btn-secundario btn-ancho', onclick: elegirRestauracion }, UI.icono('subir'), 'Restaurar respaldo')));

    // Almacenamiento y prueba
    const resultadoPrueba = h('ol', { class: 'resultado-prueba' });
    cont.appendChild(h('section', { class: 'tarjeta' },
      h('h2', null, '📦 Almacenamiento'),
      espacio ? h('p', { class: 'ayuda' }, 'Usando ' + tamano(espacio.usage || 0) + ' de espacio en este dispositivo.') : null,
      h('button', { type: 'button', class: 'btn btn-secundario btn-ancho', onclick: async () => {
        resultadoPrueba.replaceChildren(h('li', null, 'Probando…'));
        try {
          const pasos = await Datos.probar();
          resultadoPrueba.replaceChildren(...pasos.map((p) => h('li', null, '✅ ' + p)));
        } catch (e) {
          resultadoPrueba.replaceChildren(h('li', { class: 'rojo' }, '❌ ' + e.message));
        }
      } }, '🧪 Probar que se guardan los datos'),
      resultadoPrueba));

    // Zona peligrosa
    cont.appendChild(h('section', { class: 'tarjeta zona-peligro' },
      h('h2', null, '⚠️ Borrar todo'),
      h('p', { class: 'ayuda' }, 'Deja la app como recién instalada. Pide confirmación dos veces.'),
      h('button', { type: 'button', class: 'btn btn-peligro btn-ancho', onclick: borrarTodo }, UI.icono('basura'), 'Borrar todos los datos')));

    cont.appendChild(h('p', { class: 'texto-suave centrado pie-ajustes' }, 'Mi Vida · tus datos nunca salen de este dispositivo'));
  }

  MV.registrar({ id: 'ajustes', titulo: 'Ajustes', pestana: 'inicio', render });
})();
