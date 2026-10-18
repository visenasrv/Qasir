/* QASIR — Service Worker: app shell cache-first → aplikasi terbuka instan & tetap jalan offline.
   Naikkan VERSION setiap kali Anda mengubah file frontend agar perangkat mengambil versi baru. */
const VERSION = 'qasir-v1.3.4';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css?v=1.3.4',
  'js/config.js?v=1.3.4', 'js/icons.js?v=1.3.4', 'js/core.js?v=1.3.4', 'js/export.js?v=1.3.4', 'js/hpp.js?v=1.3.4', 'js/barcode.js?v=1.3.4',
  'js/printer.js?v=1.3.4', 'js/p-kasir.js?v=1.3.4', 'js/p-ops.js?v=1.3.4', 'js/p-owner.js?v=1.3.4', 'js/p-promo.js?v=1.3.4', 'js/p-online.js?v=1.3.4', 'js/app.js?v=1.3.4',
  'toko.html', 'css/toko.css?v=1.3.4', 'js/toko.js?v=1.3.4', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'
];
const RUNTIME = VERSION + '-rt';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== RUNTIME).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                                   // POST ke GAS tidak pernah di-cache
  const url = new URL(req.url);
  if (/script\.google(usercontent)?\.com$/.test(url.hostname)) return; // API selalu langsung ke server
  // Navigasi halaman → index.html dari cache (SPA)
  if (req.mode === 'navigate') {
    // toko.html (toko online pelanggan) & index.html (aplikasi kasir) disajikan masing-masing
    const page = /\/toko\.html$/.test(url.pathname) ? 'toko.html' : 'index.html';
    e.respondWith(caches.open(VERSION).then((c) => c.match(page).then((hit) => {
      const net = fetch(req).then((res) => { if (res.ok) c.put(page, res.clone()); return res; }).catch(() => hit);
      return hit || net;                                        // instan dari cache, diperbarui di latar
    })));
    return;
  }
  // File aplikasi (domain sendiri) → cache-first
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(VERSION).then((c) => c.put(req, cp)); } return res; })));
    return;
  }
  // Font, library CDN, foto produk → stale-while-revalidate
  if (/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|drive\.google\.com|googleusercontent\.com/.test(url.hostname)) {
    e.respondWith(caches.open(RUNTIME).then((c) => c.match(req).then((hit) => {
      if (hit && hit.type === 'opaque' && req.mode === 'cors') hit = null;   // fetch CORS (ekspor gambar) butuh respons non-opaque
      const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
  }
});
