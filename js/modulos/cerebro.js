/* cerebro.js — Segundo cerebro: documentos con fotos/PDF, vencimientos e ideas */
(function () {
  'use strict';
  const { F, UI } = MV;
  const { h } = UI;

  const SECCIONES = [
    { id: 'documentos', texto: 'Documentos' },
    { id: 'vencimientos', texto: 'Vencimientos' },
    { id: 'ideas', texto: 'Ideas' }
  ];
  const TIPOS_BASE = [['Universidad', '🎓'], ['Trabajo', '💼'], ['Vehículo', '🚗'], ['Salud', '🩺'], ['Boletas y garantías', '🧾'], ['Trámites', '🏛️'], ['Personal', '👤']];
  const MAX_LADO = 1600;      // px del lado más largo al comprimir fotos
  const CALIDAD = 0.75;       // calidad JPEG
  const MAX_PDF = 15 * 1024 * 1024;

  const estado = { busqueda: '', tipo: '', etiqueta: '', busquedaIdeas: '', etiquetaIdea: '' };
  let urlsAbiertas = [];

  /* ---------------- Utilidades ---------------- */

  const normalizar = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const leerEtiquetas = (t) => [...new Set((t || '').split(/[,#]/).map((x) => x.trim().toLowerCase()).filter(Boolean))];

  function urlDe(blob) { const u = URL.createObjectURL(blob); urlsAbiertas.push(u); return u; }
  function liberarUrls() { urlsAbiertas.forEach((u) => URL.revokeObjectURL(u)); urlsAbiertas = []; }

  async function tipos() {
    if (!(await Datos.ajuste('semillaCerebro'))) {
      let i = 0;
      for (const [nombre, emoji] of TIPOS_BASE) await Datos.guardar('tiposDoc', { nombre, emoji, orden: i++ });
      await Datos.guardarAjuste('semillaCerebro', true);
    }
    return (await Datos.listar('tiposDoc')).sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99));
  }
  const tipoDe = (lista, id) => lista.find((t) => t.id === id) || { nombre: 'Sin tipo', emoji: '📄' };

  function estadoVence(fecha) {
    const d = F.diferencia(F.hoy(), fecha);
    const clase = d <= 15 ? 'rojo' : d <= 60 ? 'amarillo' : 'verde';
    let texto;
    if (d < 0) texto = 'Venció hace ' + F.plural(-d, 'día', 'días');
    else if (d === 0) texto = 'Vence hoy';
    else if (d === 1) texto = 'Vence mañana';
    else texto = 'Vence en ' + d + ' días';
    return { d, clase, texto };
  }

  /** Reduce una foto para que no ocupe tanto espacio */
  async function comprimir(archivo) {
    let fuente;
    try {
      fuente = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
    } catch (e) {
      fuente = await new Promise((resolver, rechazar) => {
        const img = new Image();
        img.onload = () => resolver(img);
        img.onerror = () => rechazar(new Error('No pude leer la imagen'));
        img.src = URL.createObjectURL(archivo);
      });
    }
    const escala = Math.min(1, MAX_LADO / Math.max(fuente.width, fuente.height));
    const ancho = Math.round(fuente.width * escala), alto = Math.round(fuente.height * escala);
    const lienzo = document.createElement('canvas');
    lienzo.width = ancho; lienzo.height = alto;
    const ctx = lienzo.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, ancho, alto);
    ctx.drawImage(fuente, 0, 0, ancho, alto);
    if (fuente.close) fuente.close();
    const blob = await new Promise((r) => lienzo.toBlob(r, 'image/jpeg', CALIDAD));
    // Si la original ya era más liviana, nos quedamos con ella
    const final = blob && blob.size < archivo.size ? blob : archivo;
    return { blob: final, ancho, alto, original: archivo.size };
  }

  function tamano(bytes) {
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
  }

  /* ---------------- Pantalla ---------------- */

  async function render(cont, ruta) {
    liberarUrls();
    const sub = SECCIONES.some((s) => s.id === ruta.sub) ? ruta.sub : 'documentos';
    cont.appendChild(UI.cabecera('Segundo cerebro'));
    cont.appendChild(UI.subpestanas(SECCIONES, sub, (id) => MV.ir('cerebro/' + id, true)));
    const zona = h('section', { class: 'seccion' });
    cont.appendChild(zona);
    const lista = await tipos();
    if (sub === 'documentos') await renderDocumentos(zona, lista);
    else if (sub === 'vencimientos') await renderVencimientos(zona, lista);
    else await renderIdeas(zona);
  }

  /* ---------------- DOCUMENTOS ---------------- */

  async function renderDocumentos(zona, listaTipos) {
    const docs = await Datos.listar('documentos');
    if (!docs.length) {
      zona.appendChild(UI.vacio('🗂️', 'Tu papeleo, ordenado', 'Guarda aquí el permiso de circulación, boletas con garantía, certificados… con foto y fecha de vencimiento.', { texto: 'Agregar documento', fn: () => editarDocumento(null) }));
      zona.appendChild(h('button', { type: 'button', class: 'fab', 'aria-label': 'Nuevo documento', onclick: () => editarDocumento(null) }, UI.icono('mas'), h('span', null, 'Documento')));
      return;
    }
    const buscador = h('input', { class: 'campo', type: 'search', placeholder: 'Buscar por título, etiqueta o nota', value: estado.busqueda, 'aria-label': 'Buscar documentos' });
    const todasEtiquetas = [...new Set(docs.flatMap((d) => d.etiquetas || []))].sort();
    const selTipo = h('select', { class: 'campo', 'aria-label': 'Filtrar por tipo', value: estado.tipo, onchange: () => { estado.tipo = selTipo.value; pintar(); } },
      h('option', { value: '' }, 'Todos los tipos'), listaTipos.map((t) => h('option', { value: t.id }, t.emoji + ' ' + t.nombre)));
    const selEtiqueta = h('select', { class: 'campo', 'aria-label': 'Filtrar por etiqueta', value: estado.etiqueta, onchange: () => { estado.etiqueta = selEtiqueta.value; pintar(); } },
      h('option', { value: '' }, 'Todas las etiquetas'), todasEtiquetas.map((t) => h('option', { value: t }, '#' + t)));
    if (!todasEtiquetas.includes(estado.etiqueta)) { estado.etiqueta = ''; selEtiqueta.value = ''; }
    buscador.addEventListener('input', () => { estado.busqueda = buscador.value; pintar(); });

    zona.appendChild(h('div', { class: 'buscador' }, UI.icono('buscar'), buscador));
    zona.appendChild(h('div', { class: 'dos-columnas filtros-mov' }, selTipo, selEtiqueta));
    const lista = h('div', { class: 'rejilla-docs' });
    zona.appendChild(lista);
    zona.appendChild(h('button', { type: 'button', class: 'fab', 'aria-label': 'Nuevo documento', onclick: () => editarDocumento(null) }, UI.icono('mas'), h('span', null, 'Documento')));

    async function pintar() {
      const q = normalizar(estado.busqueda);
      const visibles = docs
        .filter((d) => !estado.tipo || d.tipo === estado.tipo)
        .filter((d) => !estado.etiqueta || (d.etiquetas || []).includes(estado.etiqueta))
        .filter((d) => !q || normalizar([d.titulo, (d.etiquetas || []).join(' '), d.notas].join(' ')).includes(q))
        .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || b.creado - a.creado);
      if (!visibles.length) { lista.replaceChildren(UI.vacio('🔍', 'No encontré documentos', 'Prueba con otra palabra o quita los filtros.')); return; }
      lista.replaceChildren(...visibles.map((d) => tarjetaDoc(d, listaTipos)));
    }
    await pintar();
  }

  function tarjetaDoc(d, listaTipos) {
    const t = tipoDe(listaTipos, d.tipo);
    const miniatura = h('div', { class: 'doc-mini' }, h('span', { 'aria-hidden': 'true' }, t.emoji));
    (async () => {
      for (const id of d.archivos || []) {
        const a = await Datos.leer('archivos', id);
        if (a && a.clase === 'imagen') {
          miniatura.replaceChildren(h('img', { src: urlDe(a.blob), alt: '', loading: 'lazy' }));
          return;
        }
      }
    })();
    const v = d.vence ? estadoVence(d.vence) : null;
    const nArch = (d.archivos || []).length;
    return h('button', { type: 'button', class: 'tarjeta-doc', onclick: () => verDocumento(d.id) },
      miniatura,
      h('div', { class: 'doc-info' },
        h('p', { class: 'doc-titulo' }, d.titulo),
        h('p', { class: 'item-meta' }, t.nombre + (d.fecha ? ' · ' + F.mostrar(d.fecha) : '') + (nArch ? ' · 📎' + nArch : '')),
        v ? h('span', { class: 'insignia ' + v.clase }, v.texto) : null)
    );
  }

  async function verDocumento(id) {
    const d = await Datos.leer('documentos', id);
    if (!d) { UI.aviso('Ese documento ya no existe', { tipo: 'error' }); return; }
    const listaTipos = await tipos();
    const t = tipoDe(listaTipos, d.tipo);
    const archivos = (await Promise.all((d.archivos || []).map((a) => Datos.leer('archivos', a)))).filter(Boolean);
    const fotos = archivos.filter((a) => a.clase === 'imagen');
    const pdfs = archivos.filter((a) => a.clase === 'pdf');
    const ideas = (await Datos.listar('ideas')).filter((i) => i.docId === id);
    const v = d.vence ? estadoVence(d.vence) : null;
    const urls = fotos.map((f) => urlDe(f.blob));

    const ventana = UI.modal({
      titulo: d.titulo,
      ancho: true,
      contenido: [
        h('div', { class: 'doc-detalle-meta' },
          h('span', { class: 'insignia' }, t.emoji + ' ' + t.nombre),
          d.fecha ? h('span', { class: 'texto-suave' }, 'Fecha: ' + F.mostrar(d.fecha)) : null,
          v ? h('span', { class: 'insignia ' + v.clase }, v.texto + ' · ' + F.mostrar(d.vence)) : null),
        (d.etiquetas || []).length ? h('div', { class: 'chips' }, d.etiquetas.map((e) => h('span', { class: 'chip chip-etiqueta' }, '#' + e))) : null,
        d.notas ? h('p', { class: 'doc-notas' }, d.notas) : null,
        fotos.length ? h('div', { class: 'galeria' }, urls.map((u, i) => h('button', { type: 'button', class: 'galeria-foto', 'aria-label': 'Ver foto ' + (i + 1) + ' en grande', onclick: () => abrirVisor(urls, i) }, h('img', { src: u, alt: 'Foto ' + (i + 1) + ' de ' + d.titulo })))) : null,
        pdfs.length ? h('div', { class: 'lista' }, pdfs.map((p) => h('button', { type: 'button', class: 'item item-compacto', onclick: () => abrirPdf(p) },
          UI.icono('pdf'), h('div', { class: 'item-cuerpo' }, h('p', { class: 'item-titulo' }, p.nombre || 'Documento.pdf'), h('p', { class: 'item-meta' }, tamano(p.blob.size))), UI.icono('adelante')))) : null,
        !archivos.length ? h('p', { class: 'texto-suave' }, 'Sin fotos ni PDFs adjuntos.') : null,
        ideas.length ? h('div', null, h('h3', { class: 'titulo-grupo' }, '💡 Ideas enlazadas'), ideas.map((i) => h('p', { class: 'idea-mini' }, i.texto))) : null,
        h('div', { class: 'fila-botones' },
          h('button', { type: 'button', class: 'btn btn-peligro-suave', onclick: async () => {
            if (await UI.confirmar('Se borrará "' + d.titulo + '" con sus fotos y PDFs. Esto no se puede deshacer.', { titulo: '¿Borrar documento?', textoSi: 'Borrar', peligro: true })) {
              for (const a of d.archivos || []) await Datos.borrar('archivos', a);
              await Datos.borrar('documentos', d.id);
              for (const i of ideas) await Datos.guardar('ideas', Object.assign({}, i, { docId: null }));
              ventana.cerrar();
              UI.aviso('Documento borrado');
              MV.refrescar();
            }
          } }, 'Borrar'),
          h('button', { type: 'button', class: 'btn', onclick: () => { ventana.cerrar(); setTimeout(() => editarDocumento(d), 210); } }, UI.icono('lapiz'), 'Editar'))
      ]
    });
  }

  function abrirPdf(p) {
    const url = urlDe(p.blob);
    const ventana = window.open(url, '_blank');
    if (!ventana) {
      const a = h('a', { href: url, download: p.nombre || 'documento.pdf' });
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }

  /** Visor de fotos a pantalla completa con zoom (pellizcar o doble toque) */
  function abrirVisor(urls, inicial) {
    let i = inicial, escala = 1, x = 0, y = 0;
    const img = h('img', { class: 'visor-img', alt: '', draggable: 'false' });
    const contador = h('span', { class: 'visor-contador' });
    const aplicar = () => { img.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + escala + ')'; };
    const mostrar = () => { img.src = urls[i]; escala = 1; x = 0; y = 0; aplicar(); contador.textContent = urls.length > 1 ? (i + 1) + ' / ' + urls.length : ''; };
    const cerrar = () => { visor.remove(); document.removeEventListener('keydown', teclas, true); };
    const teclas = (e) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); cerrar(); }
      if (e.key === 'ArrowRight' && i < urls.length - 1) { i++; mostrar(); }
      if (e.key === 'ArrowLeft' && i > 0) { i--; mostrar(); }
    };
    const zona = h('div', { class: 'visor-zona' }, img);
    const visor = h('div', { class: 'visor', role: 'dialog', 'aria-label': 'Foto en grande' },
      zona,
      h('div', { class: 'visor-barra' },
        h('button', { type: 'button', class: 'btn-icono', 'aria-label': 'Anterior', onclick: () => { if (i > 0) { i--; mostrar(); } } }, UI.icono('atras')),
        contador,
        h('button', { type: 'button', class: 'btn-icono', 'aria-label': 'Siguiente', onclick: () => { if (i < urls.length - 1) { i++; mostrar(); } } }, UI.icono('adelante')),
        h('button', { type: 'button', class: 'btn-icono', 'aria-label': 'Cerrar', onclick: cerrar }, UI.icono('cerrar'))),
      h('p', { class: 'visor-ayuda' }, 'Pellizca o toca dos veces para hacer zoom'));

    // Gestos
    const punteros = new Map();
    let distInicial = 0, escalaInicial = 1, ultimoToque = 0, previo = null;
    zona.addEventListener('pointerdown', (e) => {
      zona.setPointerCapture(e.pointerId);
      punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (punteros.size === 2) {
        const [a, b] = [...punteros.values()];
        distInicial = Math.hypot(a.x - b.x, a.y - b.y);
        escalaInicial = escala;
      } else {
        previo = { x: e.clientX, y: e.clientY };
        const ahora = Date.now();
        if (ahora - ultimoToque < 300) { escala = escala > 1 ? 1 : 2.5; x = 0; y = 0; aplicar(); }
        ultimoToque = ahora;
      }
    });
    zona.addEventListener('pointermove', (e) => {
      if (!punteros.has(e.pointerId)) return;
      punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (punteros.size === 2) {
        const [a, b] = [...punteros.values()];
        escala = Math.min(5, Math.max(1, escalaInicial * Math.hypot(a.x - b.x, a.y - b.y) / distInicial));
        if (escala === 1) { x = 0; y = 0; }
        aplicar();
      } else if (escala > 1 && previo) {
        x += e.clientX - previo.x; y += e.clientY - previo.y;
        previo = { x: e.clientX, y: e.clientY };
        aplicar();
      }
    });
    const soltar = (e) => { punteros.delete(e.pointerId); if (punteros.size < 2) previo = null; };
    zona.addEventListener('pointerup', soltar);
    zona.addEventListener('pointercancel', soltar);
    zona.addEventListener('wheel', (e) => { e.preventDefault(); escala = Math.min(5, Math.max(1, escala - e.deltaY / 300)); if (escala === 1) { x = 0; y = 0; } aplicar(); }, { passive: false });

    document.addEventListener('keydown', teclas, true);
    document.body.appendChild(visor);
    mostrar();
  }

  async function editarDocumento(doc) {
    const d = doc ? Object.assign({}, doc) : { titulo: '', tipo: '', fecha: F.hoy(), vence: '', etiquetas: [], notas: '', archivos: [] };
    const listaTipos = await tipos();
    const existentes = (await Promise.all((d.archivos || []).map((a) => Datos.leer('archivos', a)))).filter(Boolean);
    const nuevos = [];          // { clase, blob, nombre, mime }
    const quitar = new Set();   // ids de archivos existentes a borrar

    const titulo = h('input', { class: 'campo', type: 'text', value: d.titulo, placeholder: 'Ej: Permiso de circulación 2026' });
    const selTipo = h('select', { class: 'campo' },
      h('option', { value: '' }, 'Elige un tipo'),
      listaTipos.map((t) => h('option', { value: t.id }, t.emoji + ' ' + t.nombre)),
      h('option', { value: '__nuevo' }, '+ Nuevo tipo…'));
    selTipo.value = d.tipo || '';
    selTipo.addEventListener('change', async () => {
      if (selTipo.value !== '__nuevo') return;
      const nombre = await UI.preguntar('Nuevo tipo de documento', { placeholder: 'Ej: Mascotas' });
      if (nombre) {
        const t = await Datos.guardar('tiposDoc', { nombre, emoji: '📁', orden: listaTipos.length });
        listaTipos.push(t);
        selTipo.insertBefore(h('option', { value: t.id }, t.emoji + ' ' + t.nombre), selTipo.lastElementChild);
        selTipo.value = t.id;
      } else selTipo.value = d.tipo || '';
    });
    const fecha = h('input', { class: 'campo', type: 'date', value: d.fecha || '' });
    const vence = h('input', { class: 'campo', type: 'date', value: d.vence || '' });
    const etiquetas = h('input', { class: 'campo', type: 'text', value: (d.etiquetas || []).join(', '), placeholder: 'Ej: auto, seguro', autocapitalize: 'none' });
    const notas = h('textarea', { class: 'campo', rows: 3, value: d.notas || '', placeholder: 'Número de póliza, dónde está el original, etc.' });

    const adjuntos = h('div', { class: 'adjuntos' });
    function pintarAdjuntos() {
      const items = [];
      existentes.filter((a) => !quitar.has(a.id)).forEach((a) => items.push({ a, quitar: () => { quitar.add(a.id); pintarAdjuntos(); } }));
      nuevos.forEach((a, n) => items.push({ a, quitar: () => { nuevos.splice(n, 1); pintarAdjuntos(); } }));
      adjuntos.replaceChildren(...items.map(({ a, quitar: fn }) => h('div', { class: 'adjunto' },
        a.clase === 'imagen' ? h('img', { src: urlDe(a.blob), alt: '' }) : h('div', { class: 'adjunto-pdf' }, UI.icono('pdf'), h('span', null, a.nombre || 'PDF')),
        h('button', { type: 'button', class: 'adjunto-quitar', 'aria-label': 'Quitar adjunto', onclick: fn }, UI.icono('cerrar')))));
      if (!items.length) adjuntos.appendChild(h('p', { class: 'texto-suave' }, 'Sin adjuntos'));
    }
    pintarAdjuntos();

    const procesando = h('p', { class: 'ayuda', hidden: true }, 'Comprimiendo fotos…');
    async function recibir(lista) {
      procesando.hidden = false;
      let ahorro = 0;
      for (const archivo of lista) {
        try {
          if (archivo.type === 'application/pdf' || /\.pdf$/i.test(archivo.name)) {
            if (archivo.size > MAX_PDF) { UI.aviso('"' + archivo.name + '" pesa más de 15 MB', { tipo: 'error' }); continue; }
            nuevos.push({ clase: 'pdf', blob: archivo, nombre: archivo.name, mime: 'application/pdf' });
          } else if (archivo.type.startsWith('image/')) {
            const c = await comprimir(archivo);
            ahorro += Math.max(0, c.original - c.blob.size);
            nuevos.push({ clase: 'imagen', blob: c.blob, nombre: archivo.name, mime: c.blob.type, ancho: c.ancho, alto: c.alto });
          } else {
            UI.aviso('Solo se pueden adjuntar fotos y PDFs', { tipo: 'error' });
          }
        } catch (e) {
          console.error(e);
          UI.aviso('No pude procesar "' + archivo.name + '"', { tipo: 'error' });
        }
      }
      procesando.hidden = true;
      if (ahorro > 100 * 1024) UI.aviso('Fotos comprimidas: ahorraste ' + tamano(ahorro));
      pintarAdjuntos();
    }
    const entrada = (accept, extra) => {
      const input = h('input', Object.assign({ type: 'file', accept, hidden: true, onchange: () => { recibir([...input.files]); input.value = ''; } }, extra || {}));
      return input;
    };
    const inCamara = entrada('image/*', { capture: 'environment' });
    const inGaleria = entrada('image/*', { multiple: true });
    const inPdf = entrada('application/pdf,.pdf', { multiple: true });

    const ventana = UI.modal({
      titulo: doc ? 'Editar documento' : 'Nuevo documento',
      ancho: true,
      contenido: h('form', { onsubmit: async (e) => {
        e.preventDefault();
        if (!titulo.value.trim()) { titulo.focus(); UI.aviso('Ponle un título', { tipo: 'error' }); return; }
        const boton = e.submitter; if (boton) boton.disabled = true;
        try {
          d.titulo = titulo.value.trim();
          d.tipo = selTipo.value && selTipo.value !== '__nuevo' ? selTipo.value : null;
          d.fecha = fecha.value || null;
          d.vence = vence.value || null;
          d.etiquetas = leerEtiquetas(etiquetas.value);
          d.notas = notas.value.trim();
          const guardado = await Datos.guardar('documentos', d);
          const ids = (d.archivos || []).filter((id) => !quitar.has(id));
          for (const id of quitar) await Datos.borrar('archivos', id);
          for (const a of nuevos) {
            const r = await Datos.guardar('archivos', Object.assign({ docId: guardado.id }, a));
            ids.push(r.id);
          }
          guardado.archivos = ids;
          await Datos.guardar('documentos', guardado);
          ventana.cerrar();
          UI.aviso(doc ? 'Documento actualizado' : 'Documento guardado 🗂️');
          MV.refrescar();
        } catch (err) {
          console.error(err);
          if (boton) boton.disabled = false;
          UI.aviso(err && err.name === 'QuotaExceededError' ? 'El teléfono no tiene espacio suficiente' : 'No se pudo guardar: ' + err.message, { tipo: 'error', duracion: 6000 });
        }
      } },
        UI.campo('Título', titulo),
        UI.campo('Tipo', selTipo),
        h('div', { class: 'dos-columnas' }, UI.campo('Fecha del documento', fecha), UI.campo('Vence (opcional)', vence)),
        UI.campo('Etiquetas', etiquetas, 'Sepáralas con comas'),
        UI.campo('Notas', notas),
        h('div', { class: 'grupo' }, h('span', { class: 'etiqueta' }, 'Fotos y PDFs'), adjuntos, procesando,
          h('div', { class: 'botones-adjuntar' },
            h('button', { type: 'button', class: 'btn btn-secundario', onclick: () => inCamara.click() }, UI.icono('camara'), 'Cámara'),
            h('button', { type: 'button', class: 'btn btn-secundario', onclick: () => inGaleria.click() }, UI.icono('imagen'), 'Galería'),
            h('button', { type: 'button', class: 'btn btn-secundario', onclick: () => inPdf.click() }, UI.icono('pdf'), 'PDF')),
          inCamara, inGaleria, inPdf),
        h('div', { class: 'fila-botones' },
          h('button', { type: 'button', class: 'btn btn-secundario', onclick: () => ventana.cerrar() }, 'Cancelar'),
          h('button', { type: 'submit', class: 'btn' }, 'Guardar'))
      )
    });
  }

  /* ---------------- VENCIMIENTOS ---------------- */

  async function renderVencimientos(zona, listaTipos) {
    const docs = (await Datos.listar('documentos')).filter((d) => d.vence).sort((a, b) => a.vence.localeCompare(b.vence));
    if (!docs.length) {
      zona.appendChild(UI.vacio('⏳', 'Nada por vencer', 'Cuando guardes un documento con fecha de vencimiento (permiso de circulación, revisión técnica, licencia, garantías…) aparecerá aquí.', { texto: 'Agregar documento', fn: () => editarDocumento(null) }));
      return;
    }
    zona.appendChild(h('div', { class: 'leyenda leyenda-vence' },
      h('span', null, h('i', { class: 'punto rojo' }), '15 días o menos'),
      h('span', null, h('i', { class: 'punto amarillo' }), '60 días o menos'),
      h('span', null, h('i', { class: 'punto verde' }), 'Más adelante')));
    const grupos = [
      ['Vencidos', (v) => v.d < 0],
      ['Próximos 15 días', (v) => v.d >= 0 && v.d <= 15],
      ['Próximos 60 días', (v) => v.d > 15 && v.d <= 60],
      ['Más adelante', (v) => v.d > 60]
    ];
    grupos.forEach(([titulo, prueba]) => {
      const items = docs.map((d) => ({ d, v: estadoVence(d.vence) })).filter((x) => prueba(x.v));
      if (!items.length) return;
      zona.appendChild(h('h3', { class: 'titulo-grupo' }, titulo));
      zona.appendChild(h('div', { class: 'lista' }, items.map(({ d, v }) => {
        const t = tipoDe(listaTipos, d.tipo);
        return h('button', { type: 'button', class: 'item item-vence ' + v.clase, onclick: () => verDocumento(d.id) },
          h('div', { class: 'pago-fecha' }, h('strong', null, F.aFecha(d.vence).getUTCDate()), h('span', null, F.nombreMesCorto(F.mes(d.vence)))),
          h('div', { class: 'item-cuerpo' }, h('p', { class: 'item-titulo' }, d.titulo), h('p', { class: 'item-meta' }, t.emoji + ' ' + t.nombre + ' · ' + F.mostrar(d.vence))),
          h('span', { class: 'insignia ' + v.clase }, v.texto));
      })));
    });
  }

  /* ---------------- IDEAS ---------------- */

  async function renderIdeas(zona) {
    const docs = (await Datos.listar('documentos')).sort((a, b) => a.titulo.localeCompare(b.titulo));
    const texto = h('textarea', { class: 'campo campo-nota', rows: 2, placeholder: 'Una idea de negocio, de contenido, de la U…', 'aria-label': 'Nueva idea' });
    const etiquetas = h('input', { class: 'campo', type: 'text', placeholder: 'Etiquetas: negocio, u, contenido', autocapitalize: 'none', 'aria-label': 'Etiquetas' });
    const selDoc = selectorDoc(docs, '');
    zona.appendChild(h('form', { class: 'tarjeta form-rapido', onsubmit: async (e) => {
      e.preventDefault();
      if (!texto.value.trim()) { texto.focus(); return; }
      await Datos.guardar('ideas', { texto: texto.value.trim(), etiquetas: leerEtiquetas(etiquetas.value), docId: selDoc.value || null });
      UI.aviso('Idea guardada 💡');
      MV.refrescar();
    } },
      texto,
      h('div', { class: 'dos-columnas' }, etiquetas, selDoc),
      h('div', { class: 'fila-fin' }, h('button', { type: 'submit', class: 'btn' }, 'Guardar idea'))));

    const ideas = await Datos.listar('ideas');
    if (!ideas.length) {
      zona.appendChild(UI.vacio('💡', 'Tu cajón de ideas está vacío', 'Anota cualquier idea apenas se te ocurra. Después la ordenas con etiquetas.'));
      return;
    }
    const todasEtiquetas = [...new Set(ideas.flatMap((i) => i.etiquetas || []))].sort();
    if (!todasEtiquetas.includes(estado.etiquetaIdea)) estado.etiquetaIdea = '';
    const buscador = h('input', { class: 'campo', type: 'search', placeholder: 'Buscar ideas', value: estado.busquedaIdeas, 'aria-label': 'Buscar ideas' });
    buscador.addEventListener('input', () => { estado.busquedaIdeas = buscador.value; pintar(); });
    zona.appendChild(h('div', { class: 'buscador' }, UI.icono('buscar'), buscador));
    if (todasEtiquetas.length) {
      zona.appendChild(UI.chips([{ id: '', texto: 'Todas' }].concat(todasEtiquetas.map((t) => ({ id: t, texto: '#' + t }))), estado.etiquetaIdea, (v) => { estado.etiquetaIdea = v; pintar(); }, 'chips-filtro'));
    }
    const lista = h('div', { class: 'lista-notas' });
    zona.appendChild(lista);

    function pintar() {
      const q = normalizar(estado.busquedaIdeas);
      const visibles = ideas
        .filter((i) => !estado.etiquetaIdea || (i.etiquetas || []).includes(estado.etiquetaIdea))
        .filter((i) => !q || normalizar(i.texto + ' ' + (i.etiquetas || []).join(' ')).includes(q))
        .sort((a, b) => b.creado - a.creado);
      if (!visibles.length) { lista.replaceChildren(UI.vacio('🔍', 'No hay ideas con ese filtro')); return; }
      lista.replaceChildren(...visibles.map((i) => {
        const doc = docs.find((d) => d.id === i.docId);
        const tarjeta = h('article', { class: 'nota idea' },
          h('p', { class: 'nota-texto' }, i.texto),
          (i.etiquetas || []).length ? h('div', { class: 'chips' }, i.etiquetas.map((e) => h('span', { class: 'chip chip-etiqueta' }, '#' + e))) : null,
          doc ? h('button', { type: 'button', class: 'enlace-doc', onclick: () => verDocumento(doc.id) }, UI.icono('enlace'), doc.titulo) : null,
          h('div', { class: 'nota-pie' },
            h('span', null, F.relativa(F.isoDeMarca(i.creado))),
            h('button', { type: 'button', class: 'btn-icono', 'aria-label': 'Opciones de la idea', onclick: () => menuIdea(i, docs) }, UI.icono('puntos'))));
        UI.pulsacionLarga(tarjeta, () => menuIdea(i, docs));
        return tarjeta;
      }));
    }
    pintar();
  }

  function selectorDoc(docs, valor) {
    const sel = h('select', { class: 'campo', 'aria-label': 'Enlazar con documento' },
      h('option', { value: '' }, docs.length ? '🔗 Enlazar a documento (opcional)' : 'Sin documentos para enlazar'),
      docs.map((d) => h('option', { value: d.id }, d.titulo)));
    sel.value = valor || '';
    return sel;
  }

  function menuIdea(i, docs) {
    UI.acciones('Idea', [
      { texto: 'Editar', icono: 'lapiz', fn: () => {
        const texto = h('textarea', { class: 'campo', rows: 5, value: i.texto, autofocus: true });
        const etiquetas = h('input', { class: 'campo', type: 'text', value: (i.etiquetas || []).join(', '), autocapitalize: 'none' });
        const selDoc = selectorDoc(docs, i.docId);
        const ventana = UI.modal({
          titulo: 'Editar idea',
          contenido: h('form', { onsubmit: async (e) => {
            e.preventDefault();
            if (!texto.value.trim()) return;
            await Datos.guardar('ideas', Object.assign({}, i, { texto: texto.value.trim(), etiquetas: leerEtiquetas(etiquetas.value), docId: selDoc.value || null }));
            ventana.cerrar();
            MV.refrescar();
          } },
            texto, UI.campo('Etiquetas', etiquetas, 'Sepáralas con comas'), UI.campo('Documento enlazado', selDoc),
            h('div', { class: 'fila-botones' },
              h('button', { type: 'button', class: 'btn btn-secundario', onclick: () => ventana.cerrar() }, 'Cancelar'),
              h('button', { type: 'submit', class: 'btn' }, 'Guardar')))
        });
      } },
      { texto: 'Borrar', icono: 'basura', peligro: true, fn: async () => {
        if (await UI.confirmar('Esta idea se borrará.', { titulo: '¿Borrar idea?', textoSi: 'Borrar', peligro: true })) {
          await Datos.borrar('ideas', i.id);
          UI.aviso('Idea borrada', { deshacer: async () => { await Datos.guardar('ideas', i); MV.refrescar(); } });
          MV.refrescar();
        }
      } }
    ]);
  }

  /* ---------------- Resumen para Inicio ---------------- */

  async function resumen() {
    const docs = await Datos.listar('documentos');
    const hoy = F.hoy();
    const conFecha = docs.filter((d) => d.vence).sort((a, b) => a.vence.localeCompare(b.vence));
    const vencidos = conFecha.filter((d) => d.vence < hoy).length;
    const proximo = conFecha.find((d) => d.vence >= hoy);
    const v = proximo ? estadoVence(proximo.vence) : null;
    return h('ul', { class: 'tm-datos' },
      h('li', { class: 'tm-ancho ' + (v && v.clase !== 'verde' ? v.clase : '') }, h('span', null, 'Próximo vencimiento'),
        h('strong', null, proximo ? proximo.titulo + ' · ' + v.texto.replace('Vence ', '').replace(/^en /, 'en ') : 'Nada por vencer')),
      vencidos ? h('li', { class: 'rojo' }, h('span', null, 'Vencidos'), h('strong', null, vencidos)) : null,
      h('li', null, h('span', null, 'Documentos'), h('strong', null, docs.length))
    );
  }

  MV.registrar({ id: 'cerebro', titulo: 'Segundo cerebro', render, resumen });
})();
