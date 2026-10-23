/* inicio.js — pantalla de bienvenida: anillos del día y un widget por módulo */
(function () {
  'use strict';
  const { F, UI } = MV;
  const { h } = UI;

  const WIDGETS = [
    { id: 'panel', titulo: 'Panel de vida', icono: 'm-panel', clase: 'mod-panel' },
    { id: 'finanzas', titulo: 'Finanzas', icono: 'm-finanzas', clase: 'mod-finanzas' },
    { id: 'entrenador', titulo: 'Entrenador', icono: 'm-entrenador', clase: 'mod-entrenador' },
    { id: 'cerebro', titulo: 'Segundo cerebro', icono: 'm-cerebro', clase: 'mod-cerebro' }
  ];

  function saludo() {
    const hora = F.horaActual();
    if (hora >= 5 && hora < 12) return 'Buenos días';
    if (hora >= 12 && hora < 20) return 'Buenas tardes';
    return 'Buenas noches';
  }

  async function avisoRespaldo() {
    const ultimo = await Datos.ajuste('ultimoRespaldo');
    const desde = ultimo || await Datos.ajuste('primerUso', Date.now());
    const dias = Math.floor((Date.now() - desde) / 86400000);
    if (dias <= 14) return null;
    // Solo avisar si hay algo que respaldar
    let hayDatos = false;
    for (const c of ['tareas', 'notas', 'eventos', 'movimientos', 'rutinas', 'documentos', 'ideas', 'metas']) {
      if ((await Datos.listar(c)).length) { hayDatos = true; break; }
    }
    if (!hayDatos) return null;
    return h('a', { href: '#/ajustes', class: 'aviso-suave' },
      h('span', { class: 'cuadro-icono', 'aria-hidden': 'true' }, UI.icono('descargar')),
      h('span', null, h('strong', null, 'Haz un respaldo'), h('br'), ultimo ? 'Llevas ' + dias + ' días sin respaldar tus datos.' : 'Aún no respaldas tus datos.'),
      UI.icono('adelante', 'flecha-fila'));
  }

  /* ---------- Anillos del día (como la app Actividad) ---------- */

  async function datosAnillos() {
    const hoy = F.hoy();

    // Tareas: hechas hoy vs. lo que había para hoy (incluye atrasadas)
    const tareas = await Datos.listar('tareas');
    const hechasHoy = tareas.filter((t) => t.hecha && t.hechaEn && F.isoDeMarca(t.hechaEn) === hoy).length;
    const pendientes = tareas.filter((t) => !t.hecha && t.fecha && t.fecha <= hoy).length;
    const totalTareas = hechasHoy + pendientes;

    // Presupuesto: gastado en categorías con límite vs. el límite total
    const limites = await Datos.listar('presupuestos');
    const totalLimite = limites.reduce((s, l) => s + l.monto, 0);
    const ids = new Set(limites.map((l) => l.id));
    const gastado = (await Datos.listar('movimientos'))
      .filter((m) => m.tipo === 'gasto' && F.mes(m.fecha) === F.mes(hoy) && ids.has(m.categoria))
      .reduce((s, m) => s + m.monto, 0);

    // Entrenos: sesiones de esta semana vs. días con rutina asignada
    const lunes = F.inicioSemana(hoy);
    const sesiones = (await Datos.listar('sesiones')).filter((s) => s.fecha >= lunes).length;
    const dias = new Set((await Datos.listar('rutinas')).flatMap((r) => r.dias || [])).size;

    return [
      { clase: 'anillo-tareas', nombre: 'Tareas', p: totalTareas ? hechasHoy / totalTareas : 0,
        valor: totalTareas ? hechasHoy + ' de ' + totalTareas : 'Nada para hoy' },
      { clase: 'anillo-finanzas', nombre: 'Presupuesto', p: totalLimite ? gastado / totalLimite : 0, alerta: totalLimite && gastado > totalLimite,
        valor: totalLimite ? F.dinero(gastado) + ' de ' + F.dinero(totalLimite) : 'Sin límites' },
      { clase: 'anillo-entreno', nombre: 'Entrenos', p: dias ? sesiones / dias : 0,
        valor: dias ? sesiones + ' de ' + dias + ' esta semana' : sesiones ? F.plural(sesiones, 'sesión', 'sesiones') : 'Sin rutinas' }
    ];
  }

  function dibujarAnillos(lista) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.setAttribute('class', 'anillos');
    svg.setAttribute('aria-hidden', 'true');
    [52, 38, 24].forEach((r, i) => {
      const a = lista[i];
      const largo = 2 * Math.PI * r;
      const pista = document.createElementNS(NS, 'circle');
      const arco = document.createElementNS(NS, 'circle');
      [pista, arco].forEach((c) => { c.setAttribute('cx', 60); c.setAttribute('cy', 60); c.setAttribute('r', r); });
      pista.setAttribute('class', 'anillo-pista ' + a.clase);
      arco.setAttribute('class', 'anillo-arco ' + a.clase);
      arco.setAttribute('stroke-dasharray', largo);
      arco.setAttribute('stroke-dashoffset', largo); // parte vacío y se anima
      if (a.p <= 0) arco.style.opacity = '0';         // sin avance: ni siquiera el puntito redondo
      svg.append(pista, arco);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        arco.setAttribute('stroke-dashoffset', largo * (1 - Math.min(1, a.p)));
      }));
    });
    return svg;
  }

  async function render(cont) {
    const nombre = await Datos.ajuste('nombre', '');
    const hoy = F.hoy();

    cont.appendChild(h('header', { class: 'inicio-cabeza' },
      h('div', null,
        h('p', { class: 'inicio-fecha' }, F.larga(hoy)),
        h('h1', { class: 'inicio-saludo' }, saludo() + (nombre ? ', ' + nombre : '')),
        !nombre ? h('a', { href: '#/ajustes', class: 'enlace-suave' }, '¿Cómo te llamas? Dímelo en Ajustes') : null
      ),
      h('a', { href: '#/ajustes', class: 'btn-ajustes', 'aria-label': 'Ajustes' }, UI.icono('engranaje'))
    ));

    const aviso = await avisoRespaldo();
    if (aviso) cont.appendChild(aviso);

    // Anillos
    const anillos = await datosAnillos();
    cont.appendChild(h('section', { class: 'tarjeta tarjeta-anillos', 'aria-label': 'Resumen del día' },
      dibujarAnillos(anillos),
      h('ul', { class: 'leyenda-anillos' }, anillos.map((a) => h('li', { class: a.clase + (a.alerta ? ' alerta' : '') },
        h('span', { class: 'la-nombre' }, a.nombre),
        h('strong', null, a.valor))))
    ));

    // Widgets
    const rejilla = h('div', { class: 'rejilla-inicio' });
    cont.appendChild(rejilla);
    for (const w of WIDGETS) {
      const modulo = MV.modulos[w.id];
      let contenido;
      try {
        contenido = modulo && modulo.resumen ? await modulo.resumen() : h('p', { class: 'texto-suave' }, 'Próximamente');
      } catch (e) {
        console.error(e);
        contenido = h('p', { class: 'texto-suave' }, 'No se pudo cargar el resumen');
      }
      rejilla.appendChild(h('a', { href: '#/' + w.id, class: 'tarjeta-modulo ' + w.clase },
        h('div', { class: 'tm-cabeza' },
          h('span', { class: 'cuadro-icono', 'aria-hidden': 'true' }, UI.icono(w.icono)),
          h('h2', null, w.titulo),
          UI.icono('adelante', 'tm-flecha')
        ),
        h('div', { class: 'tm-cuerpo' }, contenido)
      ));
    }
  }

  MV.registrar({ id: 'inicio', titulo: 'Inicio', render });
})();
