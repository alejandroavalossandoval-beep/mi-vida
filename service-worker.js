/*
 * service-worker.js — permite que la app funcione sin internet.
 * Guarda una copia de los archivos de la app en el celular.
 * IMPORTANTE: cada vez que se suban cambios, sube el número de VERSION
 * para que el celular detecte la versión nueva y muestre el aviso "Actualizar".
 */
const VERSION = 'v1.1.0';
const CACHE = 'mi-vida-' + VERSION;

const ARCHIVOS = [
  './',
  './index.html',
  './manifest.json',
  './css/estilos.css',
  './js/datos.js',
  './js/app.js',
  './js/modulos/inicio.js',
  './js/modulos/panel.js',
  './js/modulos/finanzas.js',
  './js/modulos/entrenador.js',
  './js/modulos/cerebro.js',
  './js/modulos/ajustes.js',
  './iconos/icono-192.png',
  './iconos/icono-512.png',
  './iconos/icono-maskable-512.png',
  './iconos/apple-touch-icon.png'
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ARCHIVOS.map((u) => new Request(u, { cache: 'reload' }))))
  );
  // No activamos de inmediato: esperamos a que el usuario apriete "Actualizar"
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(nombres.filter((n) => n.startsWith('mi-vida-') && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (evento) => {
  if (evento.data && evento.data.tipo === 'ACTIVAR') self.skipWaiting();
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return; // lo externo (ej. Google) no se guarda

  // Primero la copia guardada (rápido y sin internet); si no está, se pide a internet
  evento.respondWith(
    caches.match(pedido, { ignoreSearch: true }).then((guardado) => {
      if (guardado) return guardado;
      return fetch(pedido).then((respuesta) => {
        if (respuesta.ok && respuesta.type === 'basic') {
          const copia = respuesta.clone();
          caches.open(CACHE).then((cache) => cache.put(pedido, copia));
        }
        return respuesta;
      }).catch(() => {
        if (pedido.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
