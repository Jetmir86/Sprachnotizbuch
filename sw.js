// Service Worker: macht die App offline nutzbar und nimmt auf Android
// Sprachnachrichten aus dem „Teilen“-Menü (z. B. WhatsApp) entgegen.
const CACHE = 'sprachnotizbuch-v2';
const FILES = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('sprachnotizbuch', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('recordings')) {
        db.createObjectStore('recordings', { keyPath: 'id' }).createIndex('noteId', 'noteId');
      }
      if (!db.objectStoreNames.contains('inbox')) db.createObjectStore('inbox', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function receiveShare(request) {
  const form = await request.formData();
  const files = form.getAll('audio').filter((f) => f && typeof f !== 'string');
  const title = (form.get('title') || '').toString().trim();
  if (files.length) {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const t = db.transaction('inbox', 'readwrite');
      files.forEach((f, i) => t.objectStore('inbox').put({
        id: Date.now().toString(36) + '-' + i, blob: f, name: f.name, title,
      }));
      t.oncomplete = resolve;
      t.onerror = () => reject(t.error);
    });
  }
  return Response.redirect('./?shared=1', 303);
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith(receiveShare(e.request));
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Erst Netz (für Updates), bei fehlender Verbindung aus dem Speicher
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
  );
});
