// PAINT ONCE, KEEP FOREVER. Every painted card and texture is stored in the browser's IndexedDB the
// first time it's painted, keyed by name and ART_VERSION. Later launches load the pictures instead of
// painting them again (painting the whole school takes ~30 s; loading it takes ~2).
// Bump ART_VERSION whenever any painter changes, so stale pictures are never shown.
export const ART_VERSION = 'v2-2026-10-08f';

let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((resolve) => {
      try {
        const req = indexedDB.open('homeTime.art', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('cards');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch { resolve(null); }
    });
  }
  return dbp;
}

async function get(key) {
  const d = await db();
  if (!d) return null;
  return new Promise((resolve) => {
    const r = d.transaction('cards').objectStore('cards').get(key);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => resolve(null);
  });
}

async function put(key, blob) {
  const d = await db();
  if (!d) return;
  d.transaction('cards', 'readwrite').objectStore('cards').put(blob, key);
}

// a canvas of w x h: from the cache if we have it, otherwise painted by paint(canvas) and stored
export async function cached(name, w, h, paint) {
  const key = `${ART_VERSION}:${name}`;
  const t0 = performance.now();
  const blob = params.has('nocache') ? null : await get(key);
  const t1 = performance.now();
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  if (blob) {
    try {
      const bmp = await createImageBitmap(blob);
      c.getContext('2d').drawImage(bmp, 0, 0);
      return c;
    } catch { /* fall through and repaint */ }
  }
  paint(c);
  const t2 = performance.now();
  c.toBlob((b) => { if (b) put(key, b); }, 'image/png');
  if (params.has('profile')) console.log(`BOOT card ${name} get ${Math.round(t1 - t0)} paint ${Math.round(t2 - t1)} blob ${Math.round(performance.now() - t2)}`);
  return c;
}

const params = new URLSearchParams(location.search);

// ---- painting off the main thread ----
let pool = null, nextId = 1;
const waiting = new Map();
function workers() {
  if (pool) return pool;
  const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 2));
  pool = Array.from({ length: n }, () => {
    const w = new Worker(new URL('./paintWorker.js', import.meta.url), { type: 'module' });
    w.busy = 0;
    w.onmessage = (e) => { const p = waiting.get(e.data.id); waiting.delete(e.data.id); w.busy--; if (e.data.error) p.reject(new Error(e.data.error)); else p.resolve(e.data); };
    return w;
  });
  return pool;
}
function paintOff(name, args) {
  const ws = workers(), w = ws.reduce((a, b) => (a.busy <= b.busy ? a : b));
  const id = nextId++;
  w.busy++;
  return new Promise((resolve, reject) => { waiting.set(id, { resolve, reject }); w.postMessage({ id, name, args }); });
}

// a card painted by a worker job (paintWorker.js), cached like the rest
export async function cachedJob(key, name, args = {}) {
  const k = `${ART_VERSION}:${key}`;
  const blob = params.has('nocache') ? null : await get(k);
  const src = blob ? await createImageBitmap(blob) : null;
  let bitmap = src;
  if (!bitmap) {
    const t0 = performance.now();
    const r = await paintOff(name, args);
    put(k, r.blob);
    bitmap = r.bitmap;
    if (params.has('profile')) console.log(`BOOT card ${key} worker ${Math.round(performance.now() - t0)}`);
  }
  // a CPU-backed canvas: turning it into a texture is then a plain copy, not a GPU read-back
  const c = document.createElement('canvas');
  c.width = bitmap.width; c.height = bitmap.height;
  c.getContext('2d', { willReadFrequently: true }).drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return c;
}
