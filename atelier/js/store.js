// Estado local: caché en memoria respaldada por IndexedDB, con eventos de cambio. Sin cuentas ni nube.
import * as db from './db.js';
import { uid } from './util.js';

const COLLS = ['items', 'outfits', 'plans', 'wears', 'trips'];
const HISTORY_LIMIT = 400;

export const DEFAULT_SETTINGS = {
  id: 'settings',
  name: '',
  styles: ['casual'],
  favColors: [],
  avoidColors: [],
  occasionWeekday: 'everyday',
  occasionWeekend: 'going-out',
  location: null, // { name, lat, lon }
  units: 'C',
  theme: 'system',
  tryOn: true,
  noRepeat: true,
  accessories: true,
  layering: true,
  smartRecognition: true,
  onboarded: false,
  updatedAt: 0,
};

const state = Object.fromEntries(COLLS.map((c) => [c, new Map()]));
let settings = { ...DEFAULT_SETTINGS };
const meta = new Map();
const listeners = new Set();
let pending = new Set();
let flushQueued = false;

function emit(coll) {
  pending.add(coll);
  if (flushQueued) return;
  flushQueued = true;
  queueMicrotask(() => {
    const colls = pending;
    pending = new Set();
    flushQueued = false;
    for (const fn of listeners) try { fn(colls); } catch (e) { console.error(e); }
  });
}

async function init() {
  await Promise.all(
    COLLS.map(async (c) => {
      for (const d of await db.getAll(c)) state[c].set(d.id, d);
    }),
  );
  for (const m of await db.getAll('meta')) {
    if (m.id === 'settings') settings = { ...DEFAULT_SETTINGS, ...m };
    else meta.set(m.id, m.value);
  }
}

export const store = {
  ready: init(),

  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  emit,

  all(coll) { return [...state[coll].values()].filter((d) => !d.deleted); },
  raw(coll) { return [...state[coll].values()]; },
  get(coll, id) { const d = state[coll].get(id); return d && !d.deleted ? d : null; },

  async put(coll, doc) {
    const d = { ...doc, id: doc.id || uid(), updatedAt: Date.now() };
    if (!d.createdAt) d.createdAt = d.updatedAt;
    state[coll].set(d.id, d);
    emit(coll);
    await db.put(coll, d);
    if (coll === 'outfits') trimHistory();
    return d;
  },
  async putMany(coll, docs) {
    const now = Date.now();
    const out = docs.map((doc, i) => ({ ...doc, id: doc.id || uid(), createdAt: doc.createdAt || now, updatedAt: now + i * 0.001 }));
    out.forEach((d) => state[coll].set(d.id, d));
    emit(coll);
    await db.putMany(coll, out);
    return out;
  },
  async patch(coll, id, patch) {
    const cur = state[coll].get(id);
    if (!cur) return null;
    return store.put(coll, { ...cur, ...patch });
  },
  async remove(coll, id) {
    const tomb = { id, deleted: true, updatedAt: Date.now() };
    state[coll].set(id, tomb);
    emit(coll);
    await db.put(coll, tomb);
  },
  async removeMany(coll, ids) {
    const now = Date.now();
    const tombs = ids.map((id) => ({ id, deleted: true, updatedAt: now }));
    tombs.forEach((t) => state[coll].set(t.id, t));
    emit(coll);
    await db.putMany(coll, tombs);
  },

  get settings() { return settings; },
  async setSettings(patch) {
    settings = { ...settings, ...patch, id: 'settings', updatedAt: Date.now() };
    emit('settings');
    await db.put('meta', settings);
    return settings;
  },

  // Valores del dispositivo: foto de Pruébatelo, estado de la interfaz…
  getMeta(key, fallback = null) { return meta.has(key) ? meta.get(key) : fallback; },
  async setMeta(key, value) {
    meta.set(key, value);
    emit('meta');
    await db.put('meta', { id: key, value });
  },

  async wipe() {
    for (const c of COLLS) { state[c].clear(); await db.clear(c); }
    settings = { ...DEFAULT_SETTINGS };
    meta.clear();
    await db.clear('meta');
    emit('items'); emit('settings');
  },

  exportJSON() {
    const out = { app: 'atelier', version: 1, exportedAt: new Date().toISOString(), settings };
    for (const c of COLLS) out[c] = store.all(c);
    return out;
  },
  async importJSON(data) {
    if (data?.app !== 'atelier') throw new Error('Este archivo no es una copia de seguridad de Atelier.');
    for (const c of COLLS) if (Array.isArray(data[c])) await store.putMany(c, data[c]);
    if (data.settings) await store.setSettings({ ...data.settings });
  },
};

// Keep the generated-outfit history bounded; never drop favourites or planned outfits.
function trimHistory() {
  const outfits = store.all('outfits');
  if (outfits.length <= HISTORY_LIMIT) return;
  const planned = new Set(store.all('plans').map((p) => p.outfitId));
  for (const t of store.all('trips')) for (const d of t.days || []) planned.add(d.outfitId);
  const removable = outfits
    .filter((o) => !o.favorite && !planned.has(o.id))
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, outfits.length - HISTORY_LIMIT);
  if (removable.length) store.removeMany('outfits', removable.map((o) => o.id));
}

// ---------- Derived helpers ----------
export function wearCounts() {
  const m = new Map();
  for (const w of store.all('wears')) for (const id of w.itemIds || []) m.set(id, (m.get(id) || 0) + 1);
  return m;
}
export function lastWorn() {
  const m = new Map();
  for (const w of store.all('wears'))
    for (const id of w.itemIds || []) if (!m.has(id) || m.get(id) < w.date) m.set(id, w.date);
  return m;
}
export const outfitItemIds = (ids) =>
  [ids.hoodie, ids.tshirt, ids.trousers, ids.sneakers, ...(ids.accessory || [])].filter(Boolean);
