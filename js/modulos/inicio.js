/* inicio.js — pantalla de bienvenida con el resumen de cada módulo */
(function () {
  'use strict';
  const { F, UI } = MV;
  const { h } = UI;

  const TARJETAS = [
    { id: 'panel', titulo: 'Panel de vida', emoji: '🗓️', clase: 'mod-panel' },
    { id: 'finanzas', titulo: 'Asesor financiero', emoji: '💰', clase: 'mod-finanzas' },
    { id: 'entrenador', titulo: 'Entrenador', emoji: '🏋️', clase: 'mod-entrenador' },
    { id: 'cerebro', titulo: 'Segundo cerebro', emoji: '🧠', clase: 'mod-cerebro' }
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
      h('span', { 'aria-hidden': 'true' }, '💾'),
      h('span', null, ultimo ? 'Llevas ' + dias + ' días sin respaldar tus datos. ' : 'Aún no respaldas tus datos. ',
        h('strong', null, 'Hacer respaldo'))
    );
  }

  async function render(cont) {
    const nombre = await Datos.ajuste('nombre', '');
    const hoy = F.hoy();

    cont.appendChild(h('header', { class: 'inicio-cabeza' },
      h('div', null,
        h('p', { class: 'inicio-fecha' }, F.larga(hoy).replace(/^./, (c) => c.toUpperCase()) + ' · ' + F.mostrar(hoy)),
        h('h1', { class: 'inicio-saludo' }, saludo() + (nombre ? ', ' + nombre : '')),
        !nombre ? h('a', { href: '#/ajustes', class: 'enlace-suave' }, '¿Cómo te llamas? Dímelo en Ajustes') : null
      ),
      h('a', { href: '#/ajustes', class: 'btn-icono btn-ajustes', 'aria-label': 'Ajustes' }, UI.icono('engranaje'))
    ));

    const aviso = await avisoRespaldo();
    if (aviso) cont.appendChild(aviso);

    const rejilla = h('div', { class: 'rejilla-inicio' });
    cont.appendChild(rejilla);

    for (const t of TARJETAS) {
      const modulo = MV.modulos[t.id];
      let contenido;
      try {
        contenido = modulo && modulo.resumen ? await modulo.resumen() : h('p', { class: 'texto-suave' }, 'Próximamente');
      } catch (e) {
        console.error(e);
        contenido = h('p', { class: 'texto-suave' }, 'No se pudo cargar el resumen');
      }
      rejilla.appendChild(h('a', { href: '#/' + t.id, class: 'tarjeta-modulo ' + t.clase },
        h('div', { class: 'tm-cabeza' },
          h('span', { class: 'tm-emoji', 'aria-hidden': 'true' }, t.emoji),
          h('h2', null, t.titulo),
          UI.icono('adelante', 'tm-flecha')
        ),
        h('div', { class: 'tm-cuerpo' }, contenido)
      ));
    }
  }

  MV.registrar({ id: 'inicio', titulo: 'Inicio', render });
})();
