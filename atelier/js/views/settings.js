// Settings: profile & style preferences, account/sync, preview, data.
import { store } from '../store.js';
import { STYLES, OCCASIONS } from '../constants.js';
import { NAMED_COLORS } from '../color.js';
import { icon } from '../icons.js';
import { esc, debounce } from '../util.js';
import { chip, bindChips, toast, confirmDialog, swatch } from '../ui.js';
import { geocode, currentPosition } from '../weather.js';
import { loadWeather } from '../context.js';
import { sync, onSync, getConfig, saveConfig, parseConfig, initSync, signIn, signUp, signOut, resetPassword } from '../sync.js';
import { demoItems } from '../demo.js';
import { setHash } from '../router.js';

const TABS = [
  ['profile', 'Profile & style', 'user'],
  ['account', 'Account & sync', 'cloudSync'],
  ['preview', 'Preview on me', 'eye'],
  ['data', 'Data', 'download'],
  ['about', 'About', 'info'],
];

let installEvt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });

export default {
  render(el, params) {
    let tab = TABS.some((t) => t[0] === params.tab) ? params.tab : 'profile';
    const draw = () => {
      el.innerHTML = `
        <header class="page-head"><div><div class="eyebrow">Preferences</div><h1 class="display">Settings</h1></div></header>
        <div class="settings-layout">
          <nav class="settings-tabs" role="tablist">${TABS.map(([id, label, ic]) => `<button role="tab" class="${tab === id ? 'on' : ''}" data-tab="${id}" aria-selected="${tab === id}">${icon(ic, 18)} ${label}</button>`).join('')}</nav>
          <div class="settings-body card" data-body></div>
        </div>`;
      const body = el.querySelector('[data-body]');
      ({ profile, account, preview, data, about })[tab](body);
    };

    function profile(b) {
      const s = store.settings;
      b.innerHTML = `
        <label class="field"><span>Name</span><input data-k="name" value="${esc(s.name)}" placeholder="Your name"></label>
        <div class="field loc"><span>${icon('pin', 15)} Location for weather</span>
          <div class="row gap-s"><input data-city placeholder="${esc(s.location?.name || 'Search a city')}" autocomplete="off"><button class="btn soft" data-geo>${icon('pin', 16)} Use my location</button></div>
          <div class="suggest" data-suggest></div>
          ${s.location ? `<small class="muted">Current: ${esc(s.location.name)} <button class="link" data-clearloc>remove</button></small>` : ''}</div>
        <div class="grid2">
          <label class="field"><span>Temperature</span><select data-k="units"><option value="C">Celsius</option><option value="F">Fahrenheit</option></select></label>
          <label class="field"><span>Appearance</span><select data-k="theme"><option value="system">Match system</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
        </div>
        <div class="field"><span>Preferred styles (first = default)</span><div class="chips">${STYLES.map((x) => chip(x.label, { value: x.id, name: 'styles', active: s.styles.includes(x.id) })).join('')}</div></div>
        <div class="grid2">
          <label class="field"><span>Weekday occasion</span><select data-k="occasionWeekday">${OCCASIONS.map((o) => `<option value="${o.id}">${o.label}</option>`).join('')}</select></label>
          <label class="field"><span>Weekend occasion</span><select data-k="occasionWeekend">${OCCASIONS.map((o) => `<option value="${o.id}">${o.label}</option>`).join('')}</select></label>
        </div>
        <div class="field"><span>Colours I love</span><div class="chips">${NAMED_COLORS.map((c) => chip(`${swatch(c.hex, 12)} ${c.name}`, { value: c.name, name: 'fav', active: s.favColors.includes(c.name) })).join('')}</div></div>
        <div class="field"><span>Colours I avoid</span><div class="chips">${NAMED_COLORS.map((c) => chip(`${swatch(c.hex, 12)} ${c.name}`, { value: c.name, name: 'avoid', active: s.avoidColors.includes(c.name) })).join('')}</div></div>
        <div class="toggles">
          <label class="switch-row"><input type="checkbox" data-b="accessories" ${s.accessories ? 'checked' : ''}><span class="switch"></span><span>Add accessories to outfits</span></label>
          <label class="switch-row"><input type="checkbox" data-b="layering" ${s.layering ? 'checked' : ''}><span class="switch"></span><span>Allow layering (T-shirt under hoodie)</span></label>
          <label class="switch-row"><input type="checkbox" data-b="noRepeat" ${s.noRepeat ? 'checked' : ''}><span class="switch"></span><span>No repetition in weekly plans by default</span></label>
          <label class="switch-row"><input type="checkbox" data-b="smartRecognition" ${s.smartRecognition ? 'checked' : ''}><span class="switch"></span><span>Smart visual recognition for uploads <small class="muted">(downloads a ~15 MB model once)</small></span></label>
        </div>`;
      b.querySelectorAll('select[data-k]').forEach((x) => { x.value = s[x.dataset.k]; x.onchange = () => store.setSettings({ [x.dataset.k]: x.value }); });
      b.querySelector('input[data-k=name]').oninput = debounce((e) => store.setSettings({ name: e.target.value.trim() }), 400);
      b.querySelectorAll('[data-b]').forEach((x) => (x.onchange = () => store.setSettings({ [x.dataset.b]: x.checked })));
      bindChips(b, 'styles', { multi: true, onChange: (v) => store.setSettings({ styles: v.length ? v : ['casual'] }) });
      bindChips(b, 'fav', { multi: true, onChange: (v) => store.setSettings({ favColors: v }) });
      bindChips(b, 'avoid', { multi: true, onChange: (v) => store.setSettings({ avoidColors: v }) });
      const sug = b.querySelector('[data-suggest]');
      const setLoc = async (loc) => { await store.setSettings({ location: loc }); loadWeather(true); toast(`Weather location set to ${loc.name}`); draw(); };
      b.querySelector('[data-city]').oninput = debounce(async (e) => {
        const q = e.target.value.trim();
        if (q.length < 2) return (sug.innerHTML = '');
        try {
          const r = await geocode(q);
          sug.innerHTML = r.map((x, i) => `<button data-i="${i}">${icon('pin', 14)} ${esc(x.name)}</button>`).join('') || '<small class="muted">No matches</small>';
          sug.onclick = (ev) => { const btn = ev.target.closest('[data-i]'); if (btn) setLoc(r[+btn.dataset.i]); };
        } catch { sug.innerHTML = '<small class="muted">City search needs an internet connection.</small>'; }
      }, 350);
      b.querySelector('[data-geo]').onclick = async () => { try { setLoc(await currentPosition()); } catch (e) { toast(e.message); } };
      b.querySelector('[data-clearloc]')?.addEventListener('click', () => store.setSettings({ location: null }).then(draw));
    }

    function account(b) {
      const cfg = getConfig();
      if (!cfg) {
        b.innerHTML = `
          <h3>${icon('cloudSync', 20)} Sync the app and the website</h3>
          <p class="muted">Right now your wardrobe lives only on this device. Connect a free Firebase project once and sign in with the same e-mail on the Android app and the website — every item, outfit, plan and setting stays in sync in real time.</p>
          <ol class="steps">
            <li>Create a project at <a href="https://console.firebase.google.com" target="_blank" rel="noopener">console.firebase.google.com</a> and add a <b>Web app</b>.</li>
            <li>Enable <b>Authentication → Email/Password</b> and create a <b>Firestore database</b>.</li>
            <li>Publish the security rules from <code>atelier/firestore.rules</code>.</li>
            <li>Paste the <code>firebaseConfig</code> snippet below (or bake it into <code>js/config.js</code> before building the APK).</li>
          </ol>
          <label class="field"><span>Firebase config</span><textarea rows="7" data-cfg placeholder='{ "apiKey": "…", "authDomain": "…", "projectId": "…", "appId": "…" }'></textarea></label>
          <button class="btn primary" data-savecfg>${icon('check', 16)} Connect</button>`;
        b.querySelector('[data-savecfg]').onclick = async () => {
          try {
            saveConfig(parseConfig(b.querySelector('[data-cfg]').value));
            await initSync();
            toast(sync.status === 'error' ? sync.error : 'Connected — now create an account or sign in');
            draw();
          }
          catch (e) { toast(e.message); }
        };
        return;
      }
      if (sync.user) {
        b.innerHTML = `
          <div class="acct"><span class="avatar">${esc(sync.user.email[0].toUpperCase())}</span><div><b>${esc(sync.user.email)}</b>
          <div class="muted small">${sync.status === 'synced' ? `${icon('cloudSync', 14)} Synced${sync.lastSync ? ' · ' + new Date(sync.lastSync).toLocaleTimeString() : ''}` : sync.status === 'error' ? `${icon('info', 14)} ${esc(sync.error)}` : 'Syncing…'}</div></div></div>
          <p class="muted">Sign in with this e-mail on the Android app or the website to see the same wardrobe everywhere. Changes sync instantly and work offline.</p>
          <div class="row gap-s wrap"><button class="btn ghost" data-signout>${icon('logout', 16)} Sign out</button><button class="btn ghost danger-text" data-rmcfg>Disconnect sync</button></div>`;
        b.querySelector('[data-signout]').onclick = async () => { await signOut(); toast('Signed out — your data stays on this device'); draw(); };
      } else {
        b.innerHTML = `
          <h3>Sign in to sync</h3>
          <p class="muted">Use the same account on your phone and computer. Items already on this device are uploaded after you sign in.</p>
          ${sync.status === 'error' ? `<p class="error">${esc(sync.error)}</p>` : ''}
          <form class="auth" novalidate>
            <label class="field"><span>E-mail</span><input type="email" name="email" autocomplete="email" required></label>
            <label class="field"><span>Password</span><input type="password" name="pw" autocomplete="current-password" minlength="6" required></label>
            <div class="row gap-s wrap"><button class="btn primary" data-mode="in">Sign in</button><button class="btn ghost" data-mode="up">Create account</button><button type="button" class="link" data-reset>Forgot password?</button></div>
          </form>
          <p class="small"><button class="link danger-text" data-rmcfg>Disconnect Firebase project</button></p>`;
        const f = b.querySelector('form');
        f.addEventListener('click', async (e) => {
          const m = e.target.closest('[data-mode]')?.dataset.mode;
          if (!m) return;
          e.preventDefault();
          const email = f.email.value.trim(), pw = f.pw.value;
          if (!email || pw.length < 6) return toast('Enter your e-mail and a password of 6+ characters');
          try { await (m === 'in' ? signIn : signUp)(email, pw); toast(m === 'in' ? 'Signed in — syncing' : 'Account created — syncing'); }
          catch (err) { toast(err.message); }
        });
        b.querySelector('[data-reset]').onclick = async () => {
          const email = f.email.value.trim();
          if (!email) return toast('Enter your e-mail first');
          try { await resetPassword(email); toast('Password reset e-mail sent'); } catch (err) { toast(err.message); }
        };
      }
      b.querySelector('[data-rmcfg]')?.addEventListener('click', async () => {
        if (!(await confirmDialog('Disconnect sync on this device? Your local data is kept.', { ok: 'Disconnect' }))) return;
        try { await signOut(); } catch {}
        saveConfig(null);
        location.reload();
      });
    }

    function preview(b) {
      const s = store.settings;
      b.innerHTML = `
        <label class="switch-row"><input type="checkbox" data-tryon ${s.tryOn ? 'checked' : ''}><span class="switch"></span><span><b>Enable Preview on me</b><br><small class="muted">Show outfits on your own photo. Turn off to hide the feature everywhere.</small></span></label>
        <div class="field"><span>Your photo</span>
          <div class="row gap-s">${store.getMeta('photo') ? `<img class="thumb-sm" src="${store.getMeta('photo')}" alt=""><button class="btn ghost danger-text" data-rmphoto>${icon('trash', 16)} Delete photo</button>` : '<span class="muted small">No photo yet — add one from Preview on me.</span>'}</div>
          <small class="muted">Stored only on this device. It is never uploaded or synced.</small></div>
        <h3>AI try-on service (optional)</h3>
        <p class="muted small">For photorealistic results, point Atelier at a virtual try-on endpoint. It receives <code>{ person, garments[] }</code> as data URLs and returns <code>{ image }</code>. A ready-made Cloudflare Worker using IDM-VTON on Replicate is in <code>atelier/server/tryon-worker.js</code>.</p>
        <label class="field"><span>Endpoint URL</span><input data-ep type="url" placeholder="https://your-worker.workers.dev/tryon" value="${esc(store.getMeta('tryonEndpoint') || '')}"></label>
        <label class="field"><span>Access key (optional)</span><input data-key type="password" value="${esc(store.getMeta('tryonKey') || '')}"></label>
        <button class="btn primary" data-saveep>${icon('check', 16)} Save</button>`;
      b.querySelector('[data-tryon]').onchange = (e) => store.setSettings({ tryOn: e.target.checked });
      b.querySelector('[data-rmphoto]')?.addEventListener('click', async () => { await store.setMeta('photo', null); toast('Photo deleted'); draw(); });
      b.querySelector('[data-saveep]').onclick = async () => {
        await store.setMeta('tryonEndpoint', b.querySelector('[data-ep]').value.trim() || null);
        await store.setMeta('tryonKey', b.querySelector('[data-key]').value.trim() || null);
        toast('Saved');
      };
    }

    function data(b) {
      const demo = store.all('items').filter((i) => i.demo).length;
      b.innerHTML = `
        <h3>Backup</h3>
        <p class="muted small">Download everything (wardrobe with photos, outfits, plans, trips, settings) as one file, or restore from a backup.</p>
        <div class="row gap-s wrap"><button class="btn soft" data-export>${icon('download', 16)} Export backup</button>
          <label class="btn soft">${icon('upload', 16)} Import backup<input type="file" accept="application/json,.json" hidden data-import></label></div>
        <h3>Sample wardrobe</h3>
        <p class="muted small">${demo ? `${demo} sample pieces are in your wardrobe.` : 'Load 34 illustrated pieces to explore every feature.'}</p>
        <div class="row gap-s wrap">${demo ? `<button class="btn soft" data-rmdemo>${icon('trash', 16)} Remove sample pieces</button>` : `<button class="btn soft" data-demo>${icon('sparkles', 16)} Load sample wardrobe</button>`}</div>
        <h3 class="danger-text">Danger zone</h3>
        <button class="btn ghost danger-text" data-wipe>${icon('trash', 16)} Delete all data on this device</button>`;
      b.querySelector('[data-export]').onclick = () => {
        const blob = new Blob([JSON.stringify(store.exportJSON())], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `atelier-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      };
      b.querySelector('[data-import]').onchange = async (e) => {
        try { await store.importJSON(JSON.parse(await e.target.files[0].text())); toast('Backup restored'); draw(); }
        catch (err) { toast(err.message || 'Could not read that file'); }
      };
      b.querySelector('[data-demo]')?.addEventListener('click', async () => { await store.putMany('items', demoItems()); toast('Sample wardrobe loaded'); draw(); });
      b.querySelector('[data-rmdemo]')?.addEventListener('click', async () => {
        await store.removeMany('items', store.all('items').filter((i) => i.demo).map((i) => i.id));
        toast('Sample pieces removed'); draw();
      });
      b.querySelector('[data-wipe]').onclick = async () => {
        if (!(await confirmDialog('This permanently deletes your wardrobe, outfits and plans from this device. Synced cloud data is not affected.', { ok: 'Delete everything', danger: true }))) return;
        await store.wipe();
        location.reload();
      };
    }

    function about(b) {
      b.innerHTML = `
        <div class="about-brand"><span class="brand-mark lg">A</span><div><h3>Atelier</h3><p class="muted small">Your personal AI stylist · v1.0</p></div></div>
        <p class="muted">Outfits are generated on your device by a styling engine that scores colour harmony, style, occasion, proportions and weather. Weather data by <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a>.</p>
        <h3>Get the app</h3>
        <p class="muted small">Atelier works in any browser and installs like an app. The Android APK is built from the same code — see the project README.</p>
        ${installEvt ? `<button class="btn primary" data-install>${icon('download', 16)} Install Atelier</button>` : '<p class="muted small">On mobile, use your browser menu → “Add to Home screen”.</p>'}`;
      b.querySelector('[data-install]')?.addEventListener('click', async () => { installEvt.prompt(); installEvt = null; });
    }

    draw();
    el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]');
      if (t) { tab = t.dataset.tab; setHash('settings', { tab }); draw(); }
    });
    const off = onSync(() => tab === 'account' && draw());
    return off;
  },
};
