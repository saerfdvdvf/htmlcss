// Optional cloud account + realtime sync (Firebase Auth + Firestore).
// The website and the Android app share the same code, so signing in with the same
// e-mail on both keeps the wardrobe, outfits, plans and settings in sync.
import { store, SYNCED } from './store.js';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
const LS_KEY = 'atelier.firebase';

const listeners = new Set();
export const sync = { status: 'off', user: null, error: null, lastSync: null };
function set(patch) {
  Object.assign(sync, patch);
  listeners.forEach((fn) => fn(sync));
}
export const onSync = (fn) => (listeners.add(fn), () => listeners.delete(fn));

export function getConfig() {
  try {
    const local = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (local?.apiKey) return local;
  } catch {}
  const built = globalThis.ATELIER_CONFIG?.firebase;
  return built?.apiKey ? built : null;
}
export function saveConfig(cfg) {
  if (cfg) localStorage.setItem(LS_KEY, JSON.stringify(cfg));
  else localStorage.removeItem(LS_KEY);
}
// Accepts either raw JSON or the JS snippet Firebase shows (const firebaseConfig = {...}).
export function parseConfig(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Paste the firebaseConfig object.');
  const json = m[0].replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":').replace(/'/g, '"').replace(/,\s*}/g, '}');
  const cfg = JSON.parse(json);
  if (!cfg.apiKey || !cfg.projectId) throw new Error('The config needs at least apiKey and projectId.');
  return cfg;
}

let fb = null;
let unsubs = [];
let authWatched = false;

async function load() {
  if (fb) return fb;
  const cfg = getConfig();
  if (!cfg) return null;
  const [appM, authM, fsM] = await Promise.all([
    import(FB + 'firebase-app.js'),
    import(FB + 'firebase-auth.js'),
    import(FB + 'firebase-firestore.js'),
  ]);
  const app = appM.initializeApp(cfg);
  const auth = authM.getAuth(app);
  try { await authM.setPersistence(auth, authM.browserLocalPersistence); } catch {}
  const db = fsM.getFirestore(app);
  fb = { app, auth, db, A: authM, F: fsM };
  return fb;
}

export async function initSync() {
  if (!getConfig()) return set({ status: 'off' });
  set({ status: 'connecting' });
  try {
    const f = await load();
    if (authWatched) return;
    authWatched = true;
    f.A.onAuthStateChanged(f.auth, (user) => {
      stop();
      if (user) start(user);
      else set({ status: 'signed-out', user: null });
    });
  } catch (e) {
    console.warn('Sync unavailable', e);
    set({ status: 'error', error: navigator.onLine === false ? 'You are offline.' : 'Could not reach the sync service.' });
  }
}

const friendly = (e) => {
  const c = e?.code || '';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'E-mail or password is incorrect.';
  if (c.includes('email-already-in-use')) return 'That e-mail already has an account — sign in instead.';
  if (c.includes('weak-password')) return 'Use a password with at least 6 characters.';
  if (c.includes('invalid-email')) return 'That e-mail address looks invalid.';
  if (c.includes('network')) return 'Network error — check your connection.';
  if (c.includes('operation-not-allowed')) return 'Enable Email/Password sign-in in your Firebase console.';
  return e?.message || 'Something went wrong.';
};

export async function signUp(email, password) {
  const f = await load();
  try { await f.A.createUserWithEmailAndPassword(f.auth, email, password); } catch (e) { throw new Error(friendly(e)); }
}
export async function signIn(email, password) {
  const f = await load();
  try { await f.A.signInWithEmailAndPassword(f.auth, email, password); } catch (e) { throw new Error(friendly(e)); }
}
export async function resetPassword(email) {
  const f = await load();
  try { await f.A.sendPasswordResetEmail(f.auth, email); } catch (e) { throw new Error(friendly(e)); }
}
export async function signOut() {
  const f = await load();
  stop();
  await f.A.signOut(f.auth);
}

function stop() {
  unsubs.forEach((u) => u());
  unsubs = [];
  store.setSyncer(null);
}

const clean = (doc) => {
  const d = JSON.parse(JSON.stringify(doc));
  // Firestore documents are limited to 1 MiB.
  if (JSON.stringify(d).length > 950_000 && d.image) d.image = null;
  return d;
};

async function start(user) {
  const { db, F } = fb;
  set({ status: 'connecting', user: { uid: user.uid, email: user.email }, error: null });
  const ref = (coll) => F.collection(db, 'users', user.uid, coll);
  try {
    for (const coll of SYNCED) {
      const snap = await F.getDocs(ref(coll));
      const remote = new Map(snap.docs.map((d) => [d.id, d.data()]));
      await store.applyRemote(coll, [...remote.values()]);
      // Upload anything that is newer locally (first sign-in on a device uploads its wardrobe).
      const local = coll === 'settings' ? [store.settings] : store.raw(coll);
      const push = local.filter((d) => d.updatedAt && (!remote.has(d.id) || remote.get(d.id).updatedAt < d.updatedAt));
      for (let i = 0; i < push.length; i += 400) {
        const b = F.writeBatch(db);
        for (const d of push.slice(i, i + 400)) b.set(F.doc(db, 'users', user.uid, coll, d.id), clean(d));
        await b.commit();
      }
      unsubs.push(
        F.onSnapshot(ref(coll), (s) => {
          const docs = s.docChanges().filter((c) => c.type !== 'removed').map((c) => c.doc.data());
          if (docs.length) store.applyRemote(coll, docs);
          set({ status: 'synced', lastSync: Date.now() });
        }, (err) => set({ status: 'error', error: friendly(err) })),
      );
    }
    store.setSyncer((coll, d) => {
      F.setDoc(F.doc(db, 'users', user.uid, coll, d.id), clean(d))
        .then(() => set({ status: 'synced', lastSync: Date.now() }))
        .catch((err) => set({ status: 'error', error: friendly(err) }));
    });
    set({ status: 'synced', lastSync: Date.now() });
  } catch (e) {
    console.error(e);
    set({ status: 'error', error: friendly(e) });
  }
}
