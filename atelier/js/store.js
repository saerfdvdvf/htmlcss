// Local-first state: in-memory cache backed by IndexedDB, with change events and a sync hook.
import * as db from './db.js';
import { uid } from './util.js';

export const SYNCED = ['items', 'outfits', 'plans', 'wears', 'trips', 'settings'];
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
let syncer = null;
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
    syncer?.(coll, d);
    if (coll === 'outfits') trimHistory();
    return d;
  },
  async putMany(coll, docs) {
    const now = Date.now();
    const out = docs.map((doc, i) => ({ ...doc, id: doc.id || uid(), createdAt: doc.createdAt || now, updatedAt: now + i * 0.001 }));
    out.forEach((d) => state[coll].set(d.id, d));
    emit(coll);
    await db.putMany(coll, out);
    out.forEach((d) => syncer?.(coll, d));
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
    syncer?.(coll, tomb);
  },
  async removeMany(coll, ids) {
    const now = Date.now();
    const tombs = ids.map((id) => ({ id, deleted: true, updatedAt: now }));
    tombs.forEach((t) => state[coll].set(t.id, t));
    emit(coll);
    await db.putMany(coll, tombs);
    tombs.forEach((t) => syncer?.(coll, t));
  },

  get settings() { return settings; },
  async setSettings(patch) {
    settings = { ...settings, ...patch, id: 'settings', updatedAt: Date.now() };
    emit('settings');
    await db.put('meta', settings);
    syncer?.('settings', settings);
    return settings;
  },

  // Device-local values (never synced): try-on photo, sync config, UI state...
  getMeta(key, fallback = null) { return meta.has(key) ? meta.get(key) : fallback; },
  async setMeta(key, value) {
    meta.set(key, value);
    emit('meta');
    await db.put('meta', { id: key, value });
  },

  setSyncer(fn) { syncer = fn; },

  // Merge documents that came from the cloud (last-write-wins on updatedAt).
  async applyRemote(coll, docs) {
    const changed = [];
    if (coll === 'settings') {
      const d = docs[0];
      if (d && (d.updatedAt || 0) > (settings.updatedAt || 0)) {
        settings = { ...DEFAULT_SETTINGS, ...d, id: 'settings' };
        await db.put('meta', settings);
        emit('settings');
      }
      return;
    }
    for (const d of docs) {
      const cur = state[coll].get(d.id);
      if (!cur || (d.updatedAt || 0) > (cur.updatedAt || 0)) {
        state[coll].set(d.id, d);
        changed.push(d);
      }
    }
    if (changed.length) {
      await db.putMany(coll, changed);
      emit(coll);
    }
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
    if (data?.app !== 'atelier') throw new Error('This file is not an Atelier backup.');
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
