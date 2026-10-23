/*
 * datos.js — el ÚNICO lugar que toca el almacenamiento del dispositivo.
 * Usa IndexedDB (una base de datos que vive dentro del navegador).
 * Ningún otro archivo debe usar indexedDB ni localStorage directamente.
 */
(function () {
  'use strict';

  const NOMBRE_BD = 'mi-vida';
  const VERSION_BD = 1;

  // Cada "colección" es como una tabla. Se crean todas de una vez.
  const COLECCIONES = [
    'ajustes',
    // Panel de vida
    'tareas', 'categoriasTareas', 'eventos', 'notas',
    // Finanzas
    'movimientos', 'categoriasFin', 'presupuestos', 'pagos', 'metas',
    // Entrenador
    'rutinas', 'ejercicios', 'sesiones', 'menu', 'compras',
    // Segundo cerebro
    'documentos', 'tiposDoc', 'archivos', 'ideas',
    // Pruebas
    'pruebas'
  ];

  let promesaBD = null;

  function abrir() {
    if (promesaBD) return promesaBD;
    promesaBD = new Promise((resolver, rechazar) => {
      if (!('indexedDB' in window)) {
        rechazar(new Error('Este navegador no permite guardar datos (IndexedDB).'));
        return;
      }
      const pedido = indexedDB.open(NOMBRE_BD, VERSION_BD);
      pedido.onupgradeneeded = () => {
        const bd = pedido.result;
        COLECCIONES.forEach((nombre) => {
          if (!bd.objectStoreNames.contains(nombre)) {
            bd.createObjectStore(nombre, { keyPath: 'id' });
          }
        });
      };
      pedido.onsuccess = () => {
        const bd = pedido.result;
        bd.onversionchange = () => bd.close();
        resolver(bd);
      };
      pedido.onerror = () => rechazar(pedido.error);
      pedido.onblocked = () => rechazar(new Error('La base de datos está bloqueada por otra pestaña abierta.'));
    });
    return promesaBD;
  }

  function comprobar(coleccion) {
    if (!COLECCIONES.includes(coleccion)) {
      throw new Error('Colección desconocida: ' + coleccion);
    }
  }

  async function operacion(coleccion, modo, fn) {
    comprobar(coleccion);
    const bd = await abrir();
    return new Promise((resolver, rechazar) => {
      const tx = bd.transaction(coleccion, modo);
      const almacen = tx.objectStore(coleccion);
      let resultado;
      const pedido = fn(almacen);
      if (pedido) pedido.onsuccess = () => { resultado = pedido.result; };
      tx.oncomplete = () => resolver(resultado);
      tx.onerror = () => rechazar(tx.error);
      tx.onabort = () => rechazar(tx.error || new Error('Operación cancelada'));
    });
  }

  function nuevoId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  /** Guarda (crea o reemplaza) un registro. Devuelve el registro con su id. */
  async function guardar(coleccion, registro) {
    const copia = Object.assign({}, registro);
    if (!copia.id) copia.id = nuevoId();
    if (!copia.creado) copia.creado = Date.now();
    copia.actualizado = Date.now();
    await operacion(coleccion, 'readwrite', (a) => a.put(copia));
    avisarCambio(coleccion);
    return copia;
  }

  /** Lee un registro por su id. Devuelve undefined si no existe. */
  function leer(coleccion, id) {
    return operacion(coleccion, 'readonly', (a) => a.get(id));
  }

  /** Lista todos los registros de una colección. */
  async function listar(coleccion) {
    const lista = await operacion(coleccion, 'readonly', (a) => a.getAll());
    return lista || [];
  }

  /** Borra un registro por su id. */
  async function borrar(coleccion, id) {
    await operacion(coleccion, 'readwrite', (a) => a.delete(id));
    avisarCambio(coleccion);
  }

  /** Vacía una colección completa. */
  async function vaciar(coleccion) {
    await operacion(coleccion, 'readwrite', (a) => a.clear());
    avisarCambio(coleccion);
  }

  /* ---------- Ajustes (pares clave → valor) ---------- */

  async function ajuste(clave, porDefecto) {
    const r = await leer('ajustes', clave);
    return r === undefined ? porDefecto : r.valor;
  }

  async function guardarAjuste(clave, valor) {
    await operacion('ajustes', 'readwrite', (a) => a.put({ id: clave, valor: valor }));
    avisarCambio('ajustes');
  }

  /* ---------- Tema (lectura instantánea para evitar parpadeo) ---------- */

  function temaGuardado() {
    try { return localStorage.getItem('mv-tema') || 'auto'; } catch (e) { return 'auto'; }
  }

  function guardarTema(tema) {
    try { localStorage.setItem('mv-tema', tema); } catch (e) { /* sin acceso, no pasa nada */ }
    return guardarAjuste('tema', tema);
  }

  function acentoGuardado() {
    try { return localStorage.getItem('mv-acento') || 'azul'; } catch (e) { return 'azul'; }
  }

  function guardarAcento(acento) {
    try { localStorage.setItem('mv-acento', acento); } catch (e) { /* sin acceso, no pasa nada */ }
    return guardarAjuste('acento', acento);
  }

  /* ---------- Respaldo completo ---------- */

  function blobADataURL(blob) {
    return new Promise((resolver, rechazar) => {
      const lector = new FileReader();
      lector.onload = () => resolver(lector.result);
      lector.onerror = () => rechazar(lector.error);
      lector.readAsDataURL(blob);
    });
  }

  async function dataURLABlob(dataURL) {
    const respuesta = await fetch(dataURL);
    return respuesta.blob();
  }

  // Convierte los Blob (fotos, PDFs) a texto para poder meterlos en un .json
  async function serializar(valor) {
    if (valor instanceof Blob) {
      return { __blob: true, tipo: valor.type, datos: await blobADataURL(valor) };
    }
    if (Array.isArray(valor)) return Promise.all(valor.map(serializar));
    if (valor && typeof valor === 'object') {
      const salida = {};
      for (const k of Object.keys(valor)) salida[k] = await serializar(valor[k]);
      return salida;
    }
    return valor;
  }

  async function deserializar(valor) {
    if (valor && typeof valor === 'object' && valor.__blob) {
      return dataURLABlob(valor.datos);
    }
    if (Array.isArray(valor)) return Promise.all(valor.map(deserializar));
    if (valor && typeof valor === 'object') {
      const salida = {};
      for (const k of Object.keys(valor)) salida[k] = await deserializar(valor[k]);
      return salida;
    }
    return valor;
  }

  /** Junta TODOS los datos (incluidas fotos) en un objeto listo para guardar como .json */
  async function exportarTodo() {
    const datos = {};
    for (const c of COLECCIONES) {
      if (c === 'pruebas') continue;
      datos[c] = await serializar(await listar(c));
    }
    return { app: 'mi-vida', version: 1, fecha: new Date().toISOString(), datos: datos };
  }

  /**
   * Restaura un respaldo.
   * modo 'reemplazar': borra todo lo actual y deja solo lo del respaldo.
   * modo 'combinar': agrega lo del respaldo; si un registro ya existe, gana el del respaldo.
   */
  async function importarTodo(respaldo, modo) {
    if (!respaldo || respaldo.app !== 'mi-vida' || !respaldo.datos) {
      throw new Error('Este archivo no parece un respaldo de Mi Vida.');
    }
    const bd = await abrir();
    const nombres = Object.keys(respaldo.datos).filter((c) => COLECCIONES.includes(c));
    // Primero convertimos todo (puede tardar con muchas fotos), después escribimos de una vez.
    const listo = {};
    for (const c of nombres) listo[c] = await deserializar(respaldo.datos[c] || []);
    const afectadas = modo === 'reemplazar' ? COLECCIONES.filter((c) => c !== 'pruebas') : nombres;
    await new Promise((resolver, rechazar) => {
      const tx = bd.transaction(afectadas, 'readwrite');
      afectadas.forEach((c) => {
        const almacen = tx.objectStore(c);
        if (modo === 'reemplazar') almacen.clear();
        (listo[c] || []).forEach((r) => { if (r && r.id !== undefined) almacen.put(r); });
      });
      tx.oncomplete = resolver;
      tx.onerror = () => rechazar(tx.error);
      tx.onabort = () => rechazar(tx.error || new Error('Restauración cancelada'));
    });
    afectadas.forEach(avisarCambio);
  }

  /** Borra absolutamente todo. */
  async function borrarTodo() {
    const bd = await abrir();
    await new Promise((resolver, rechazar) => {
      const tx = bd.transaction(COLECCIONES, 'readwrite');
      COLECCIONES.forEach((c) => tx.objectStore(c).clear());
      tx.oncomplete = resolver;
      tx.onerror = () => rechazar(tx.error);
    });
    try { localStorage.removeItem('mv-tema'); localStorage.removeItem('mv-acento'); } catch (e) { /* nada */ }
    COLECCIONES.forEach(avisarCambio);
  }

  /** Pide al navegador que no borre los datos si falta espacio. */
  async function pedirPersistencia() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        if (await navigator.storage.persisted()) return true;
        return await navigator.storage.persist();
      }
    } catch (e) { /* no soportado */ }
    return false;
  }

  async function espacioUsado() {
    try {
      if (navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate();
    } catch (e) { /* no soportado */ }
    return null;
  }

  /* ---------- Avisos de cambio (para refrescar pantallas) ---------- */

  const oyentes = new Set();
  function alCambiar(fn) { oyentes.add(fn); return () => oyentes.delete(fn); }
  function avisarCambio(coleccion) { oyentes.forEach((fn) => { try { fn(coleccion); } catch (e) { console.error(e); } }); }

  /* ---------- Prueba rápida ---------- */

  async function probar() {
    const pasos = [];
    const r = await guardar('pruebas', { texto: 'Hola desde datos.js' });
    pasos.push('Guardé un registro con id ' + r.id.slice(0, 8) + '…');
    const leido = await leer('pruebas', r.id);
    pasos.push('Lo leí de vuelta: "' + leido.texto + '"');
    const lista = await listar('pruebas');
    pasos.push('Hay ' + lista.length + ' registro(s) de prueba');
    await borrar('pruebas', r.id);
    const despues = await leer('pruebas', r.id);
    pasos.push(despues === undefined ? 'Lo borré correctamente' : 'No se pudo borrar');
    return pasos;
  }

  window.Datos = {
    COLECCIONES, nuevoId,
    guardar, leer, listar, borrar, vaciar,
    ajuste, guardarAjuste, temaGuardado, guardarTema, acentoGuardado, guardarAcento,
    exportarTodo, importarTodo, borrarTodo,
    pedirPersistencia, espacioUsado, alCambiar, probar
  };
})();
