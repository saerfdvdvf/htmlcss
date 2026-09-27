// Minimal promise wrapper around IndexedDB (falls back to memory if unavailable).
const DB_NAME = 'atelier';
const VERSION = 1;
export const STORES = ['items', 'outfits', 'plans', 'wears', 'trips', 'meta'];

let dbp = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    if (!('indexedDB' in globalThis)) return resolve(null);
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbp;
}

const mem = Object.fromEntries(STORES.map((s) => [s, new Map()]));
const tx = (db, store, mode, fn) =>
  new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const os = t.objectStore(store);
    const r = fn(os);
    t.oncomplete = () => resolve(r?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });

export async function getAll(store) {
  const db = await open();
  if (!db) return [...mem[store].values()];
  return new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
export async function put(store, value) {
  const db = await open();
  if (!db) return void mem[store].set(value.id, value);
  return tx(db, store, 'readwrite', (os) => os.put(value));
}
export async function putMany(store, values) {
  const db = await open();
  if (!db) return values.forEach((v) => mem[store].set(v.id, v));
  return tx(db, store, 'readwrite', (os) => values.forEach((v) => os.put(v)));
}
export async function del(store, id) {
  const db = await open();
  if (!db) return void mem[store].delete(id);
  return tx(db, store, 'readwrite', (os) => os.delete(id));
}
export async function clear(store) {
  const db = await open();
  if (!db) return mem[store].clear();
  return tx(db, store, 'readwrite', (os) => os.clear());
}
