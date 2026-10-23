/*
 * app.js — arranque, navegación y herramientas que comparten todos los módulos.
 *   MV.F   → formato Chile (fechas dd-mm-aaaa, pesos $12.990, zona America/Santiago)
 *   MV.UI  → piezas de interfaz (ventanas, avisos, confirmaciones, pestañas internas)
 *   MV.G   → gráficos simples hechos a mano con SVG (sin librerías)
 */
(function () {
  'use strict';

  const ZONA = 'America/Santiago';
  const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  /* =================== Formato y fechas =================== */

  const fmtFecha = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' });
  const fmtHora = new Intl.DateTimeFormat('es-CL', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const fmtNumero = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });

  // Las fechas se guardan como texto 'aaaa-mm-dd' (ordenable) y se muestran como dd-mm-aaaa.
  const F = {
    DIAS, DIAS_CORTOS, MESES, MESES_CORTOS,
    hoy() { return fmtFecha.format(new Date()); },
    isoDeMarca(ms) { return fmtFecha.format(new Date(ms)); },
    horaDeMarca(ms) { return fmtHora.format(new Date(ms)); },
    ahoraMinutos() {
      const [h, m] = fmtHora.format(new Date()).split(':').map(Number);
      return h * 60 + m;
    },
    horaActual() { return Number(fmtHora.format(new Date()).split(':')[0]); },
    aFecha(iso) { const [a, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d)); },
    deFecha(f) { return f.toISOString().slice(0, 10); },
    sumarDias(iso, n) { const f = F.aFecha(iso); f.setUTCDate(f.getUTCDate() + n); return F.deFecha(f); },
    diferencia(desde, hasta) { return Math.round((F.aFecha(hasta) - F.aFecha(desde)) / 86400000); },
    // 1 = lunes … 7 = domingo
    diaSemana(iso) { const d = F.aFecha(iso).getUTCDay(); return d === 0 ? 7 : d; },
    inicioSemana(iso) { return F.sumarDias(iso, 1 - F.diaSemana(iso)); },
    mostrar(iso) { if (!iso) return ''; const [a, m, d] = iso.split('-'); return d + '-' + m + '-' + a; },
    larga(iso) {
      const f = F.aFecha(iso);
      return DIAS[F.diaSemana(iso) - 1] + ' ' + f.getUTCDate() + ' de ' + MESES[f.getUTCMonth()];
    },
    corta(iso) {
      const f = F.aFecha(iso);
      return DIAS_CORTOS[F.diaSemana(iso) - 1] + ' ' + f.getUTCDate() + ' ' + MESES_CORTOS[f.getUTCMonth()];
    },
    relativa(iso) {
      const d = F.diferencia(F.hoy(), iso);
      if (d === 0) return 'Hoy';
      if (d === 1) return 'Mañana';
      if (d === -1) return 'Ayer';
      if (d > 1 && d < 7) return DIAS[F.diaSemana(iso) - 1].replace(/^./, (c) => c.toUpperCase());
      return F.mostrar(iso);
    },
    mes(iso) { return iso.slice(0, 7); },
    nombreMes(clave) { const [a, m] = clave.split('-').map(Number); return MESES[m - 1] + ' ' + a; },
    nombreMesCorto(clave) { const m = Number(clave.split('-')[1]); return MESES_CORTOS[m - 1]; },
    sumarMeses(clave, n) {
      let [a, m] = clave.split('-').map(Number);
      m += n;
      while (m > 12) { m -= 12; a++; }
      while (m < 1) { m += 12; a--; }
      return a + '-' + String(m).padStart(2, '0');
    },
    diasDelMes(a, m) { return new Date(Date.UTC(a, m, 0)).getUTCDate(); },
    // Fecha con día ajustado: el día 31 en febrero queda en el 28/29
    fechaEnMes(clave, dia) {
      const [a, m] = clave.split('-').map(Number);
      const d = Math.min(dia, F.diasDelMes(a, m));
      return clave + '-' + String(d).padStart(2, '0');
    },
    minutos(hhmm) { if (!hhmm) return 0; const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; },
    hhmm(min) { return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'); },
    duracion(seg) {
      const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60);
      return h ? h + ' h ' + m + ' min' : m + ' min';
    },
    reloj(seg) { seg = Math.max(0, Math.round(seg)); return Math.floor(seg / 60) + ':' + String(seg % 60).padStart(2, '0'); },

    /* Dinero: pesos chilenos sin decimales */
    numero(n) { return fmtNumero.format(Math.round(n || 0)); },
    dinero(n) { n = Math.round(n || 0); return (n < 0 ? '−$' : '$') + fmtNumero.format(Math.abs(n)); },
    leerMonto(texto) { const s = String(texto || '').replace(/\D/g, ''); return s ? Number(s) : 0; },
    kg(n) { return String(Math.round(n * 10) / 10).replace('.', ',') + ' kg'; },
    plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }
  };

  /* =================== Interfaz =================== */

  // h('div', {class: 'x', onclick: fn}, 'texto', otroElemento)  → crea elementos de forma segura
  function h(etiqueta, props, ...hijos) {
    const el = document.createElement(etiqueta);
    let valor;
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v === undefined || v === null || v === false) continue;
        if (k === 'value') valor = v;
        else if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k in el && k !== 'list' && typeof v !== 'string') el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    agregar(el, hijos);
    if (valor !== undefined) el.value = valor; // después de los hijos, para que <select> encuentre su opción
    return el;
  }
  function agregar(el, hijos) {
    for (const hijo of hijos.flat(Infinity)) {
      if (hijo === null || hijo === undefined || hijo === false) continue;
      el.appendChild(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
    }
  }

  // Íconos SVG simples (trazos)
  const ICONOS = {
    mas: '<path d="M12 5v14M5 12h14"/>',
    menos: '<path d="M5 12h14"/>',
    engranaje: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    puntos: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    atras: '<path d="M15 5l-7 7 7 7"/>',
    adelante: '<path d="M9 5l7 7-7 7"/>',
    cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    pin: '<path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7"/>',
    buscar: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    camara: '<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    imagen: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-8 8.5"/>',
    pdf: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
    basura: '<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13"/>',
    lapiz: '<path d="M4 20l1-5L16 4l4 4L9 19z"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    reloj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    enlace: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    descargar: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
    subir: '<path d="M12 16V5M7 9.5l5-5 5 5M5 20h14"/>',
    // Íconos de cada módulo (van en blanco sobre un cuadrado de color, como en Ajustes del iPhone)
    'm-panel': '<rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8 2.5v4M16 2.5v4M8 14l2.5 2.5L16 12"/>',
    'm-finanzas': '<rect x="2.5" y="6" width="19" height="13" rx="2.5"/><path d="M2.5 10.5h19M16.5 15h2"/>',
    'm-entrenador': '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
    'm-cerebro': '<path d="M9 3.5a3 3 0 0 0-3 3 3 3 0 0 0-2.5 4.5A3.2 3.2 0 0 0 5 17a3 3 0 0 0 4 3.3V3.5zM15 3.5a3 3 0 0 1 3 3 3 3 0 0 1 2.5 4.5A3.2 3.2 0 0 1 19 17a3 3 0 0 1-4 3.3V3.5z"/>'
  };
  function icono(nombre, clase) {
    const span = document.createElement('span');
    span.className = 'icono ' + (clase || '');
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = '<svg viewBox="0 0 24 24">' + (ICONOS[nombre] || '') + '</svg>';
    return span;
  }

  const capa = () => document.getElementById('capa-modal');
  const pilaModales = [];

  /**
   * Ventana tipo iOS. Devuelve { cerrar, cuerpo }.
   * estilo: undefined (hoja que sube desde abajo), 'alerta' (cuadro al centro) o 'acciones' (menú de opciones).
   * Si el formulario termina en [Cancelar][Guardar], esos botones pasan a la barra de arriba, como en iPhone.
   */
  function modal(opciones) {
    const { titulo, contenido, alCerrar, ancho, estilo } = opciones;
    const c = capa();
    const cuerpo = h('div', { class: 'hoja-cuerpo' }, contenido);
    const izq = h('div', { class: 'hc-lado' });
    const der = h('div', { class: 'hc-lado hc-der' });
    const cabeza = estilo ? null : h('div', { class: 'hoja-cabeza' }, izq, h('h2', null, titulo || ''), der);
    const hoja = h('div', {
      class: 'hoja' + (ancho ? ' hoja-completa' : '') + (estilo ? ' estilo-' + estilo : ''),
      role: estilo === 'alerta' ? 'alertdialog' : 'dialog', 'aria-modal': 'true', 'aria-label': titulo || 'Ventana'
    }, estilo ? null : h('div', { class: 'hoja-asa' }), cabeza, cuerpo);
    const fondo = h('div', { class: 'hoja-fondo' + (estilo ? ' fondo-' + estilo : ''), onclick: (e) => { if (e.target === fondo && estilo !== 'alerta') cerrar(); } }, hoja);

    if (cabeza) {
      const form = cuerpo.querySelector(':scope > form');
      const fila = form && form.querySelector(':scope > .fila-botones:last-child');
      const botones = fila ? [...fila.children] : [];
      if (botones.length === 2 && botones[0].classList.contains('btn-secundario') && botones[1].type === 'submit') {
        izq.appendChild(h('button', { type: 'button', class: 'btn-nav', onclick: () => cerrar() }, botones[0].textContent));
        der.appendChild(h('button', { type: 'button', class: 'btn-nav fuerte', onclick: () => form.requestSubmit() }, botones[1].textContent));
        fila.classList.add('solo-lector'); // sigue ahí para que Enter funcione, pero no se ve
      } else if (form) {
        izq.appendChild(h('button', { type: 'button', class: 'btn-nav', onclick: () => cerrar() }, 'Cancelar'));
      } else {
        der.appendChild(h('button', { type: 'button', class: 'btn-nav fuerte', onclick: () => cerrar() }, 'Listo'));
      }
    }
    c.appendChild(fondo);
    c.hidden = false;
    document.body.classList.add('con-modal');
    requestAnimationFrame(() => fondo.classList.add('abierta'));
    let cerrada = false;
    const registro = { cerrar, fondo };
    pilaModales.push(registro);
    function cerrar(valor) {
      if (cerrada) return;
      cerrada = true;
      const i = pilaModales.indexOf(registro);
      if (i >= 0) pilaModales.splice(i, 1);
      fondo.classList.remove('abierta');
      setTimeout(() => {
        fondo.remove();
        if (!c.children.length) { c.hidden = true; document.body.classList.remove('con-modal'); }
      }, 200);
      if (alCerrar) alCerrar(valor);
    }
    // Enfocar el primer campo, salvo en pantallas táctiles (para no abrir el teclado de golpe)
    setTimeout(() => {
      const campo = hoja.querySelector('[autofocus]');
      if (campo) campo.focus();
    }, 220);
    return { cerrar, cuerpo, hoja };
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pilaModales.length) pilaModales[pilaModales.length - 1].cerrar();
  });

  function confirmar(mensaje, opciones) {
    opciones = opciones || {};
    return new Promise((resolver) => {
      let respuesta = false;
      const m = modal({
        estilo: 'alerta',
        titulo: opciones.titulo || '¿Seguro?',
        contenido: [
          h('div', { class: 'alerta-texto' }, h('strong', null, opciones.titulo || '¿Seguro?'), h('p', null, mensaje)),
          h('div', { class: 'alerta-botones' },
            h('button', { type: 'button', onclick: () => m.cerrar() }, opciones.textoNo || 'Cancelar'),
            h('button', { type: 'button', class: opciones.peligro ? 'peligro' : 'fuerte', onclick: () => { respuesta = true; m.cerrar(); } }, opciones.textoSi || 'Sí')
          )
        ],
        alCerrar: () => resolver(respuesta)
      });
    });
  }

  /** Pregunta un texto corto. Devuelve el texto o null. */
  function preguntar(titulo, opciones) {
    opciones = opciones || {};
    return new Promise((resolver) => {
      let respuesta = null;
      const campo = h('input', { class: 'campo', type: opciones.tipo || 'text', value: opciones.valor || '', placeholder: opciones.placeholder || '', autofocus: true, inputmode: opciones.inputmode });
      const enviar = (e) => {
        e.preventDefault();
        const v = campo.value.trim();
        if (!v) { campo.focus(); return; }
        respuesta = v;
        m.cerrar();
      };
      const m = modal({
        titulo,
        contenido: h('form', { onsubmit: enviar },
          opciones.ayuda ? h('p', { class: 'ayuda' }, opciones.ayuda) : null,
          campo,
          h('div', { class: 'fila-botones' },
            h('button', { type: 'button', class: 'btn btn-secundario', onclick: () => m.cerrar() }, 'Cancelar'),
            h('button', { type: 'submit', class: 'btn' }, opciones.textoSi || 'Guardar')
          )
        ),
        alCerrar: () => resolver(respuesta)
      });
    });
  }

  /** Menú de acciones estilo iOS: [{texto, peligro, fn}] */
  function acciones(titulo, lista) {
    const m = modal({
      estilo: 'acciones',
      titulo,
      contenido: [
        h('div', { class: 'as-grupo' },
          titulo ? h('p', { class: 'as-titulo' }, titulo) : null,
          lista.map((a) => h('button', {
            type: 'button',
            class: 'as-accion' + (a.peligro ? ' peligro' : ''),
            onclick: () => { m.cerrar(); setTimeout(a.fn, 210); }
          }, a.texto))),
        h('button', { type: 'button', class: 'as-accion as-cancelar', onclick: () => m.cerrar() }, 'Cancelar')
      ]
    });
    return m;
  }

  /**
   * Deslizar una fila hacia la izquierda para mostrar botones (como en Mail o Recordatorios).
   * lista: [{texto, icono, clase: 'rojo'|'gris'|'verde'|'acento', fn}]. Devuelve el elemento a insertar.
   */
  let deslizAbierto = null;
  function deslizable(fila, lista) {
    const botones = h('div', { class: 'desliz-acciones' }, lista.map((a) => h('button', {
      type: 'button', class: 'desliz-btn ' + (a.clase || 'gris'), tabindex: '-1',
      onclick: (e) => { e.stopPropagation(); cerrarFila(); a.fn(); }
    }, a.icono ? icono(a.icono) : null, h('span', null, a.texto))));
    const envoltura = h('div', { class: 'desliz' }, botones, fila);
    fila.classList.add('desliz-frente');
    let x0 = 0, y0 = 0, dx = 0, base = 0, activo = false, decidido = false, puntero = null, movido = false;
    const ancho = () => botones.offsetWidth;
    const mover = (v, animar) => {
      fila.style.transition = animar ? 'transform .28s cubic-bezier(.2,.8,.3,1)' : 'none';
      fila.style.transform = v ? 'translateX(' + v + 'px)' : '';
      if (v) envoltura.classList.add('deslizando');
      else setTimeout(() => { if (!base) envoltura.classList.remove('deslizando'); }, animar ? 300 : 0);
    };
    function cerrarFila() { base = 0; mover(0, true); if (deslizAbierto === cerrarFila) deslizAbierto = null; }
    fila.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      x0 = e.clientX; y0 = e.clientY; dx = 0; activo = true; decidido = false; movido = false; puntero = e.pointerId;
    });
    fila.addEventListener('pointermove', (e) => {
      if (!activo || e.pointerId !== puntero) return;
      const mx = e.clientX - x0, my = e.clientY - y0;
      if (!decidido) {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        decidido = true;
        if (Math.abs(my) > Math.abs(mx)) { activo = false; return; } // es scroll vertical
        try { fila.setPointerCapture(puntero); } catch (err) { /* nada */ }
        if (deslizAbierto && deslizAbierto !== cerrarFila) deslizAbierto();
      }
      movido = true;
      dx = mx;
      mover(Math.min(0, Math.max(-ancho() - 40, base + dx)));
    });
    const soltar = () => {
      if (!activo) return;
      activo = false;
      if (!movido) return;
      if (base + dx < -ancho() / 2) { base = -ancho(); mover(base, true); deslizAbierto = cerrarFila; }
      else cerrarFila();
      setTimeout(() => { movido = false; }, 60);
    };
    fila.addEventListener('pointerup', soltar);
    fila.addEventListener('pointercancel', soltar);
    // Un toque con la fila abierta solo la cierra
    fila.addEventListener('click', (e) => {
      if (movido || base) { e.stopPropagation(); e.preventDefault(); if (!movido) cerrarFila(); }
    }, true);
    return envoltura;
  }

  /** Aviso breve abajo. opciones.deshacer = función opcional */
  function aviso(texto, opciones) {
    opciones = opciones || {};
    const zona = document.getElementById('avisos');
    const el = h('div', { class: 'aviso' + (opciones.tipo ? ' aviso-' + opciones.tipo : '') }, h('span', null, texto));
    if (opciones.deshacer) {
      el.appendChild(h('button', { type: 'button', class: 'aviso-btn', onclick: () => { opciones.deshacer(); quitar(); } }, 'Deshacer'));
    }
    zona.appendChild(el);
    requestAnimationFrame(() => el.classList.add('visible'));
    const t = setTimeout(quitar, opciones.duracion || 3500);
    function quitar() {
      clearTimeout(t);
      el.classList.remove('visible');
      setTimeout(() => el.remove(), 250);
    }
  }

  /** Mantener apretado: llama fn tras 500 ms sin mover el dedo. */
  function pulsacionLarga(el, fn) {
    let t = null, x = 0, y = 0, disparada = false;
    const cancelar = () => { clearTimeout(t); t = null; el.classList.remove('apretando'); };
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      disparada = false;
      x = e.clientX; y = e.clientY;
      el.classList.add('apretando');
      t = setTimeout(() => {
        disparada = true;
        el.classList.remove('apretando');
        if (navigator.vibrate) navigator.vibrate(15);
        fn(e);
      }, 500);
    });
    el.addEventListener('pointermove', (e) => { if (t && (Math.abs(e.clientX - x) > 10 || Math.abs(e.clientY - y) > 10)) cancelar(); });
    el.addEventListener('pointerup', cancelar);
    el.addEventListener('pointercancel', cancelar);
    el.addEventListener('pointerleave', cancelar);
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!disparada) { cancelar(); fn(e); } });
    // Evita que el clic que sigue a la pulsación larga active otra cosa
    el.addEventListener('click', (e) => { if (disparada) { e.stopPropagation(); e.preventDefault(); disparada = false; } }, true);
  }

  /** Pestañas internas de un módulo. */
  function subpestanas(opciones, activa, alElegir) {
    return h('div', { class: 'subpestanas', role: 'tablist' },
      opciones.map((o) => h('button', {
        type: 'button',
        role: 'tab',
        class: 'subpestana' + (o.id === activa ? ' activa' : ''),
        'aria-selected': o.id === activa ? 'true' : 'false',
        onclick: () => alElegir(o.id)
      }, o.texto))
    );
  }

  /** Grupo de "chips" para elegir una opción. */
  function chips(opciones, activa, alElegir, clase) {
    const cont = h('div', { class: 'chips ' + (clase || '') });
    opciones.forEach((o) => {
      const b = h('button', {
        type: 'button',
        class: 'chip' + (o.id === activa ? ' activo' : ''),
        style: o.color ? { '--chip-color': o.color } : null,
        onclick: () => {
          cont.querySelectorAll('.chip').forEach((x) => x.classList.remove('activo'));
          b.classList.add('activo');
          alElegir(o.id);
        }
      }, o.texto);
      cont.appendChild(b);
    });
    return cont;
  }

  function vacio(emoji, titulo, texto, boton) {
    return h('div', { class: 'vacio' },
      h('div', { class: 'vacio-emoji', 'aria-hidden': 'true' }, emoji),
      h('p', { class: 'vacio-titulo' }, titulo),
      texto ? h('p', { class: 'vacio-texto' }, texto) : null,
      boton ? h('button', { type: 'button', class: 'btn', onclick: boton.fn }, boton.texto) : null
    );
  }

  function cabecera(titulo, extra) {
    return h('header', { class: 'cabecera' }, h('h1', null, titulo), extra || null);
  }

  /** Campo con etiqueta */
  function campo(etiqueta, control, ayuda) {
    return h('label', { class: 'grupo' }, h('span', { class: 'etiqueta' }, etiqueta), control, ayuda ? h('span', { class: 'ayuda' }, ayuda) : null);
  }

  /** Campo de dinero que se formatea solo mientras escribes: 12990 → 12.990 */
  function campoDinero(valor, props) {
    const input = h('input', Object.assign({ class: 'campo campo-dinero', type: 'text', inputmode: 'numeric', autocomplete: 'off', placeholder: '0' }, props || {}));
    if (valor) input.value = F.numero(valor);
    input.addEventListener('input', () => {
      const n = F.leerMonto(input.value);
      input.value = n ? F.numero(n) : '';
    });
    const envoltura = h('div', { class: 'envoltura-dinero' }, h('span', { class: 'signo-peso' }, '$'), input);
    envoltura.leer = () => F.leerMonto(input.value);
    envoltura.input = input;
    return envoltura;
  }

  function barra(porcentaje, estado) {
    const p = Math.max(0, Math.min(100, porcentaje));
    return h('div', { class: 'barra ' + (estado || ''), role: 'progressbar', 'aria-valuenow': Math.round(porcentaje), 'aria-valuemin': 0, 'aria-valuemax': 100 },
      h('div', { class: 'barra-relleno', style: { width: p + '%' } }));
  }

  const UI = { h, icono, modal, confirmar, preguntar, acciones, deslizable, aviso, pulsacionLarga, subpestanas, chips, vacio, cabecera, campo, campoDinero, barra };

  /* =================== Gráficos SVG =================== */

  const NS = 'http://www.w3.org/2000/svg';
  function s(etiqueta, attrs, ...hijos) {
    const el = document.createElementNS(NS, etiqueta);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    hijos.flat().forEach((c) => { if (c != null) el.appendChild(c instanceof Node ? c : document.createTextNode(String(c))); });
    return el;
  }

  const G = {
    /** Barras horizontales: [{etiqueta, valor, color}] */
    barrasH(items, formato) {
      formato = formato || F.dinero;
      const max = Math.max(1, ...items.map((i) => i.valor));
      return h('div', { class: 'grafico-barrash' },
        items.map((i) => h('div', { class: 'gb-fila' },
          h('div', { class: 'gb-cabeza' }, h('span', null, i.etiqueta), h('strong', null, formato(i.valor))),
          h('div', { class: 'gb-pista' }, h('div', { class: 'gb-barra', style: { width: (i.valor / max * 100) + '%', background: i.color || 'var(--primario)' } }))
        ))
      );
    },

    /** Columnas dobles por mes: [{etiqueta, a, b}] con leyenda */
    columnas(items, nombres) {
      const W = 320, H = 170, base = 140, alto = 120;
      const max = Math.max(1, ...items.flatMap((i) => [i.a, i.b]));
      const ancho = W / items.length;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'grafico-svg', role: 'img', 'aria-label': 'Ingresos y gastos de los últimos meses' });
      svg.appendChild(s('line', { x1: 0, y1: base, x2: W, y2: base, class: 'eje' }));
      items.forEach((i, n) => {
        const x = n * ancho + ancho / 2;
        const bw = Math.min(16, ancho / 3);
        const ha = i.a / max * alto, hb = i.b / max * alto;
        svg.appendChild(s('rect', { x: x - bw - 1, y: base - ha, width: bw, height: Math.max(ha, 0.5), rx: 3, class: 'col-a' }, s('title', null, nombres[0] + ': ' + F.dinero(i.a))));
        svg.appendChild(s('rect', { x: x + 1, y: base - hb, width: bw, height: Math.max(hb, 0.5), rx: 3, class: 'col-b' }, s('title', null, nombres[1] + ': ' + F.dinero(i.b))));
        svg.appendChild(s('text', { x, y: base + 18, 'text-anchor': 'middle', class: 'etiqueta-eje' }, i.etiqueta));
      });
      return h('div', null,
        svg,
        h('div', { class: 'leyenda' },
          h('span', null, h('i', { class: 'punto col-a' }), nombres[0]),
          h('span', null, h('i', { class: 'punto col-b' }), nombres[1]))
      );
    },

    /** Línea: [{etiqueta, valor}] */
    linea(puntos, formato) {
      formato = formato || ((v) => v);
      const W = 320, H = 180, izq = 34, der = 12, arr = 16, abj = 30;
      const valores = puntos.map((p) => p.valor);
      let min = Math.min(...valores), max = Math.max(...valores);
      if (min === max) { min = min - 5; max = max + 5; }
      const margen = (max - min) * 0.15;
      min = Math.max(0, min - margen); max = max + margen;
      const x = (n) => izq + (puntos.length === 1 ? (W - izq - der) / 2 : n * (W - izq - der) / (puntos.length - 1));
      const y = (v) => arr + (1 - (v - min) / (max - min)) * (H - arr - abj);
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'grafico-svg', role: 'img', 'aria-label': 'Progreso en el tiempo' });
      [min, (min + max) / 2, max].forEach((v) => {
        svg.appendChild(s('line', { x1: izq, x2: W - der, y1: y(v), y2: y(v), class: 'guia' }));
        svg.appendChild(s('text', { x: izq - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'etiqueta-eje' }, Math.round(v)));
      });
      const d = puntos.map((p, n) => (n ? 'L' : 'M') + x(n).toFixed(1) + ' ' + y(p.valor).toFixed(1)).join(' ');
      svg.appendChild(s('path', { d, class: 'trazo' }));
      const cada = Math.ceil(puntos.length / 6);
      puntos.forEach((p, n) => {
        svg.appendChild(s('circle', { cx: x(n), cy: y(p.valor), r: 4, class: 'nodo' }, s('title', null, p.etiqueta + ': ' + formato(p.valor))));
        if (n % cada === 0 || n === puntos.length - 1) {
          svg.appendChild(s('text', { x: x(n), y: H - 10, 'text-anchor': 'middle', class: 'etiqueta-eje' }, p.etiqueta));
        }
      });
      return svg;
    }
  };

  /* =================== Navegación =================== */

  const modulos = {};
  let rutaActual = null;
  let cargando = 0;

  function registrar(modulo) { modulos[modulo.id] = modulo; }

  function leerRuta() {
    const partes = (location.hash || '#/inicio').replace(/^#\/?/, '').split('/');
    return { modulo: partes[0] || 'inicio', sub: partes[1] || null, extra: partes.slice(2) };
  }

  function ir(ruta, reemplazar) {
    const destino = '#/' + ruta;
    if (location.hash === destino) { mostrar(); return; }
    if (reemplazar) { history.replaceState(null, '', destino); mostrar(); }
    else location.hash = destino;
  }

  async function mostrar() {
    const ruta = leerRuta();
    const modulo = modulos[ruta.modulo] || modulos.inicio;
    const vista = document.getElementById('vista');
    const mismoModulo = rutaActual && rutaActual.modulo === modulo.id;
    rutaActual = Object.assign({}, ruta, { modulo: modulo.id });

    document.querySelectorAll('.pestana').forEach((p) => {
      const activa = p.dataset.ruta === (modulo.pestana || modulo.id);
      p.classList.toggle('activa', activa);
      if (activa) p.setAttribute('aria-current', 'page'); else p.removeAttribute('aria-current');
    });
    document.title = modulo.id === 'inicio' ? 'Mi Vida' : modulo.titulo + ' · Mi Vida';

    const turno = ++cargando;
    const nueva = h('div', { class: 'pantalla' + (mismoModulo ? '' : ' entrando') });
    try {
      await modulo.render(nueva, ruta);
    } catch (e) {
      console.error(e);
      nueva.replaceChildren(vacio('😵', 'Algo falló al abrir esta pantalla', e.message));
    }
    if (turno !== cargando) return; // llegó otra navegación mientras cargaba
    const scroll = mismoModulo ? window.scrollY : 0;
    vista.replaceChildren(nueva);
    window.scrollTo(0, scroll);
    prepararBarraNav(modulo, nueva);
    // Que la pestaña interna activa quede a la vista si no caben todas
    const activa = nueva.querySelector('.subpestana.activa');
    if (activa) {
      const barra = activa.parentElement;
      barra.scrollLeft = activa.offsetLeft - (barra.clientWidth - activa.offsetWidth) / 2;
    }
  }

  /** Vuelve a dibujar la pantalla actual (después de guardar algo) */
  function refrescar() { return mostrar(); }

  /* =================== Barra de navegación (título grande que se achica) =================== */

  let tituloGrande = null;
  function prepararBarraNav(modulo, pantalla) {
    const barra = document.getElementById('barra-nav');
    tituloGrande = pantalla.querySelector('.cabecera h1, .inicio-saludo');
    barra.querySelector('.bn-titulo').textContent = modulo.id === 'inicio' ? 'Mi Vida' : (tituloGrande ? tituloGrande.textContent : modulo.titulo);
    const izq = barra.querySelector('.bn-izq');
    izq.replaceChildren();
    if (modulo.volver) {
      izq.appendChild(h('a', { href: '#/' + modulo.volver.ruta, class: 'bn-volver' }, icono('atras'), modulo.volver.texto));
    }
    revisarBarraNav();
  }
  function revisarBarraNav() {
    const barra = document.getElementById('barra-nav');
    const limite = barra.getBoundingClientRect().bottom;
    const compacta = !!(tituloGrande && tituloGrande.isConnected && tituloGrande.getBoundingClientRect().bottom < limite + 4);
    document.body.classList.toggle('nav-compacta', compacta);
    document.body.classList.toggle('nav-con-scroll', window.scrollY > 4);
  }
  let pendienteNav = false;
  window.addEventListener('scroll', () => {
    if (pendienteNav) return;
    pendienteNav = true;
    requestAnimationFrame(() => { pendienteNav = false; revisarBarraNav(); });
  }, { passive: true });

  /* =================== Tema =================== */

  function aplicarTema(tema) {
    const raiz = document.documentElement;
    if (tema === 'claro' || tema === 'oscuro') raiz.dataset.tema = tema;
    else delete raiz.dataset.tema;
    const oscuro = tema === 'oscuro' || (tema !== 'claro' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', oscuro ? '#000000' : '#F2F2F7'));
  }

  /** Color principal de la app (azul, cobre, verde…) */
  function aplicarAcento(acento) {
    if (acento && acento !== 'azul') document.documentElement.dataset.acento = acento;
    else delete document.documentElement.dataset.acento;
  }

  /* =================== Service worker y versión nueva =================== */

  function registrarServiceWorker() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    let recargando = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (recargando) return;
      recargando = true;
      location.reload();
    });
    navigator.serviceWorker.register('service-worker.js').then((reg) => {
      const ofrecer = (sw) => {
        const aviso = document.getElementById('aviso-version');
        aviso.hidden = false;
        document.getElementById('btn-actualizar').onclick = () => {
          aviso.hidden = true;
          sw.postMessage({ tipo: 'ACTIVAR' });
        };
      };
      if (reg.waiting && navigator.serviceWorker.controller) ofrecer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nuevo = reg.installing;
        if (!nuevo) return;
        nuevo.addEventListener('statechange', () => {
          if (nuevo.state === 'installed' && navigator.serviceWorker.controller) ofrecer(nuevo);
        });
      });
      // Revisar si hay versión nueva al volver a la app
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch((e) => console.warn('No se pudo activar el modo sin internet:', e));
  }

  /* =================== Arranque =================== */

  async function arrancar() {
    aplicarTema(Datos.temaGuardado());
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => aplicarTema(Datos.temaGuardado()));
    try {
      if (!(await Datos.ajuste('primerUso'))) await Datos.guardarAjuste('primerUso', Date.now());
    } catch (e) {
      document.getElementById('vista').replaceChildren(vacio('⚠️', 'No se pueden guardar datos en este navegador', e.message));
      return;
    }
    window.addEventListener('hashchange', mostrar);
    if (!location.hash) history.replaceState(null, '', '#/inicio');
    await mostrar();
    registrarServiceWorker();
    Datos.pedirPersistencia();
  }

  window.MV = { F, UI, G, registrar, ir, refrescar, ruta: () => rutaActual, aplicarTema, aplicarAcento, modulos };
  aplicarTema(Datos.temaGuardado()); // cuanto antes, para que no parpadee el color
  aplicarAcento(Datos.acentoGuardado());
  document.addEventListener('DOMContentLoaded', arrancar);
})();
