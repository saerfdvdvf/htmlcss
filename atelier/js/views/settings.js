// Settings: profile & style preferences, account/sync, preview, data.
import { store } from '../store.js';
import { STYLES, OCCASIONS } from '../constants.js';
import { NAMED_COLORS, colorLabel } from '../color.js';
import { icon } from '../icons.js';
import { esc, debounce } from '../util.js';
import { chip, bindChips, toast, confirmDialog, swatch } from '../ui.js';
import { geocode, currentPosition } from '../weather.js';
import { loadWeather } from '../context.js';
import { sync, onSync, getConfig, saveConfig, parseConfig, initSync, signIn, signUp, signOut, resetPassword } from '../sync.js';
import { demoItems } from '../demo.js';
import { setHash } from '../router.js';

const TABS = [
  ['profile', 'Perfil y estilo', 'user'],
  ['account', 'Cuenta y sincronización', 'cloudSync'],
  ['preview', 'Pruébatelo', 'eye'],
  ['data', 'Datos', 'download'],
  ['about', 'Acerca de', 'info'],
];

let installEvt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });

export default {
  render(el, params) {
    let tab = TABS.some((t) => t[0] === params.tab) ? params.tab : 'profile';
    const draw = () => {
      el.innerHTML = `
        <header class="page-head"><div><div class="eyebrow">Preferencias</div><h1 class="display">Ajustes</h1></div></header>
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
        <label class="field"><span>Nombre</span><input data-k="name" value="${esc(s.name)}" placeholder="Tu nombre"></label>
        <div class="field loc"><span>${icon('pin', 15)} Ubicación para el tiempo</span>
          <div class="row gap-s"><input data-city placeholder="${esc(s.location?.name || 'Busca una ciudad')}" autocomplete="off"><button class="btn soft" data-geo>${icon('pin', 16)} Usar mi ubicación</button></div>
          <div class="suggest" data-suggest></div>
          ${s.location ? `<small class="muted">Actual: ${esc(s.location.name)} <button class="link" data-clearloc>quitar</button></small>` : ''}</div>
        <div class="grid2">
          <label class="field"><span>Temperatura</span><select data-k="units"><option value="C">Celsius</option><option value="F">Fahrenheit</option></select></label>
          <label class="field"><span>Apariencia</span><select data-k="theme"><option value="system">Igual que el sistema</option><option value="light">Clara</option><option value="dark">Oscura</option></select></label>
        </div>
        <div class="field"><span>Estilos preferidos (el primero es el predeterminado)</span><div class="chips">${STYLES.map((x) => chip(x.label, { value: x.id, name: 'styles', active: s.styles.includes(x.id) })).join('')}</div></div>
        <div class="grid2">
          <label class="field"><span>Ocasión entre semana</span><select data-k="occasionWeekday">${OCCASIONS.map((o) => `<option value="${o.id}">${o.label}</option>`).join('')}</select></label>
          <label class="field"><span>Ocasión el fin de semana</span><select data-k="occasionWeekend">${OCCASIONS.map((o) => `<option value="${o.id}">${o.label}</option>`).join('')}</select></label>
        </div>
        <div class="field"><span>Colores que me encantan</span><div class="chips">${NAMED_COLORS.map((c) => chip(`${swatch(c.hex, 12)} ${colorLabel(c.name)}`, { value: c.name, name: 'fav', active: s.favColors.includes(c.name) })).join('')}</div></div>
        <div class="field"><span>Colores que evito</span><div class="chips">${NAMED_COLORS.map((c) => chip(`${swatch(c.hex, 12)} ${colorLabel(c.name)}`, { value: c.name, name: 'avoid', active: s.avoidColors.includes(c.name) })).join('')}</div></div>
        <div class="toggles">
          <label class="switch-row"><input type="checkbox" data-b="accessories" ${s.accessories ? 'checked' : ''}><span class="switch"></span><span>Añadir accesorios a los outfits</span></label>
          <label class="switch-row"><input type="checkbox" data-b="layering" ${s.layering ? 'checked' : ''}><span class="switch"></span><span>Permitir capas (camiseta bajo la sudadera)</span></label>
          <label class="switch-row"><input type="checkbox" data-b="noRepeat" ${s.noRepeat ? 'checked' : ''}><span class="switch"></span><span>No repetir prendas en la semana por defecto</span></label>
          <label class="switch-row"><input type="checkbox" data-b="smartRecognition" ${s.smartRecognition ? 'checked' : ''}><span class="switch"></span><span>Reconocimiento visual inteligente al subir fotos <small class="muted">(descarga una vez un modelo de ~15 MB)</small></span></label>
        </div>`;
      b.querySelectorAll('select[data-k]').forEach((x) => { x.value = s[x.dataset.k]; x.onchange = () => store.setSettings({ [x.dataset.k]: x.value }); });
      b.querySelector('input[data-k=name]').oninput = debounce((e) => store.setSettings({ name: e.target.value.trim() }), 400);
      b.querySelectorAll('[data-b]').forEach((x) => (x.onchange = () => store.setSettings({ [x.dataset.b]: x.checked })));
      bindChips(b, 'styles', { multi: true, onChange: (v) => store.setSettings({ styles: v.length ? v : ['casual'] }) });
      bindChips(b, 'fav', { multi: true, onChange: (v) => store.setSettings({ favColors: v }) });
      bindChips(b, 'avoid', { multi: true, onChange: (v) => store.setSettings({ avoidColors: v }) });
      const sug = b.querySelector('[data-suggest]');
      const setLoc = async (loc) => { await store.setSettings({ location: loc }); loadWeather(true); toast(`Ubicación para el tiempo: ${loc.name}`); draw(); };
      b.querySelector('[data-city]').oninput = debounce(async (e) => {
        const q = e.target.value.trim();
        if (q.length < 2) return (sug.innerHTML = '');
        try {
          const r = await geocode(q);
          sug.innerHTML = r.map((x, i) => `<button data-i="${i}">${icon('pin', 14)} ${esc(x.name)}</button>`).join('') || '<small class="muted">Sin resultados</small>';
          sug.onclick = (ev) => { const btn = ev.target.closest('[data-i]'); if (btn) setLoc(r[+btn.dataset.i]); };
        } catch { sug.innerHTML = '<small class="muted">La búsqueda de ciudades necesita conexión a internet.</small>'; }
      }, 350);
      b.querySelector('[data-geo]').onclick = async () => { try { setLoc(await currentPosition()); } catch (e) { toast(e.message); } };
      b.querySelector('[data-clearloc]')?.addEventListener('click', () => store.setSettings({ location: null }).then(draw));
    }

    function account(b) {
      const cfg = getConfig();
      if (!cfg) {
        b.innerHTML = `
          <h3>${icon('cloudSync', 20)} Sincroniza la app y la web</h3>
          <p class="muted">Ahora mismo tu armario solo está en este dispositivo. Conecta una vez un proyecto gratuito de Firebase e inicia sesión con el mismo correo en la app de Android y en la web: prendas, outfits, planes y ajustes se sincronizan en tiempo real.</p>
          <ol class="steps">
            <li>Crea un proyecto en <a href="https://console.firebase.google.com" target="_blank" rel="noopener">console.firebase.google.com</a> y añade una <b>app web</b>.</li>
            <li>Activa <b>Authentication → Correo electrónico/contraseña</b> y crea una <b>base de datos de Firestore</b>.</li>
            <li>Publica las reglas de seguridad de <code>atelier/firestore.rules</code>.</li>
            <li>Pega abajo el fragmento <code>firebaseConfig</code> (o ponlo en <code>js/config.js</code> antes de compilar la APK).</li>
          </ol>
          <label class="field"><span>Configuración de Firebase</span><textarea rows="7" data-cfg placeholder='{ "apiKey": "…", "authDomain": "…", "projectId": "…", "appId": "…" }'></textarea></label>
          <button class="btn primary" data-savecfg>${icon('check', 16)} Conectar</button>`;
        b.querySelector('[data-savecfg]').onclick = async () => {
          try {
            saveConfig(parseConfig(b.querySelector('[data-cfg]').value));
            await initSync();
            toast(sync.status === 'error' ? sync.error : 'Conectado: ahora crea una cuenta o inicia sesión');
            draw();
          }
          catch (e) { toast(e.message); }
        };
        return;
      }
      if (sync.user) {
        b.innerHTML = `
          <div class="acct"><span class="avatar">${esc(sync.user.email[0].toUpperCase())}</span><div><b>${esc(sync.user.email)}</b>
          <div class="muted small">${sync.status === 'synced' ? `${icon('cloudSync', 14)} Sincronizado${sync.lastSync ? ' · ' + new Date(sync.lastSync).toLocaleTimeString('es-ES') : ''}` : sync.status === 'error' ? `${icon('info', 14)} ${esc(sync.error)}` : 'Sincronizando…'}</div></div></div>
          <p class="muted">Inicia sesión con este correo en la app de Android o en la web para ver el mismo armario en todas partes. Los cambios se sincronizan al instante y funcionan sin conexión.</p>
          <div class="row gap-s wrap"><button class="btn ghost" data-signout>${icon('logout', 16)} Cerrar sesión</button><button class="btn ghost danger-text" data-rmcfg>Desconectar sincronización</button></div>`;
        b.querySelector('[data-signout]').onclick = async () => { await signOut(); toast('Sesión cerrada: tus datos se quedan en este dispositivo'); draw(); };
      } else {
        b.innerHTML = `
          <h3>Inicia sesión para sincronizar</h3>
          <p class="muted">Usa la misma cuenta en el móvil y en el ordenador. Lo que ya tengas en este dispositivo se sube al iniciar sesión.</p>
          ${sync.status === 'error' ? `<p class="error">${esc(sync.error)}</p>` : ''}
          <form class="auth" novalidate>
            <label class="field"><span>Correo electrónico</span><input type="email" name="email" autocomplete="email" required></label>
            <label class="field"><span>Contraseña</span><input type="password" name="pw" autocomplete="current-password" minlength="6" required></label>
            <div class="row gap-s wrap"><button class="btn primary" data-mode="in">Iniciar sesión</button><button class="btn ghost" data-mode="up">Crear cuenta</button><button type="button" class="link" data-reset>¿Has olvidado la contraseña?</button></div>
          </form>
          <p class="small"><button class="link danger-text" data-rmcfg>Desconectar el proyecto de Firebase</button></p>`;
        const f = b.querySelector('form');
        f.addEventListener('click', async (e) => {
          const m = e.target.closest('[data-mode]')?.dataset.mode;
          if (!m) return;
          e.preventDefault();
          const email = f.email.value.trim(), pw = f.pw.value;
          if (!email || pw.length < 6) return toast('Escribe tu correo y una contraseña de al menos 6 caracteres');
          try { await (m === 'in' ? signIn : signUp)(email, pw); toast(m === 'in' ? 'Sesión iniciada: sincronizando' : 'Cuenta creada: sincronizando'); }
          catch (err) { toast(err.message); }
        });
        b.querySelector('[data-reset]').onclick = async () => {
          const email = f.email.value.trim();
          if (!email) return toast('Primero escribe tu correo');
          try { await resetPassword(email); toast('Te hemos enviado un correo para restablecer la contraseña'); } catch (err) { toast(err.message); }
        };
      }
      b.querySelector('[data-rmcfg]')?.addEventListener('click', async () => {
        if (!(await confirmDialog('¿Desconectar la sincronización en este dispositivo? Tus datos locales se mantienen.', { ok: 'Desconectar' }))) return;
        try { await signOut(); } catch {}
        saveConfig(null);
        location.reload();
      });
    }

    function preview(b) {
      const s = store.settings;
      b.innerHTML = `
        <label class="switch-row"><input type="checkbox" data-tryon ${s.tryOn ? 'checked' : ''}><span class="switch"></span><span><b>Activar Pruébatelo</b><br><small class="muted">Muestra los outfits sobre tu propia foto. Desactívalo para ocultar la función en toda la app.</small></span></label>
        <div class="field"><span>Tu foto</span>
          <div class="row gap-s">${store.getMeta('photo') ? `<img class="thumb-sm" src="${store.getMeta('photo')}" alt=""><button class="btn ghost danger-text" data-rmphoto>${icon('trash', 16)} Eliminar foto</button>` : '<span class="muted small">Aún no hay foto: añádela desde Pruébatelo.</span>'}</div>
          <small class="muted">Solo se guarda en este dispositivo. Nunca se sube ni se sincroniza.</small></div>
        <h3>Servicio de prueba virtual con IA (opcional)</h3>
        <p class="muted small">Para obtener resultados fotorrealistas, conecta Atelier a un servicio de prueba virtual. Recibe <code>{ person, garments[] }</code> como data URLs y devuelve <code>{ image }</code>. En <code>atelier/server/tryon-worker.js</code> tienes un Cloudflare Worker listo que usa IDM-VTON en Replicate.</p>
        <label class="field"><span>URL del endpoint</span><input data-ep type="url" placeholder="https://your-worker.workers.dev/tryon" value="${esc(store.getMeta('tryonEndpoint') || '')}"></label>
        <label class="field"><span>Clave de acceso (opcional)</span><input data-key type="password" value="${esc(store.getMeta('tryonKey') || '')}"></label>
        <button class="btn primary" data-saveep>${icon('check', 16)} Guardar</button>`;
      b.querySelector('[data-tryon]').onchange = (e) => store.setSettings({ tryOn: e.target.checked });
      b.querySelector('[data-rmphoto]')?.addEventListener('click', async () => { await store.setMeta('photo', null); toast('Foto eliminada'); draw(); });
      b.querySelector('[data-saveep]').onclick = async () => {
        await store.setMeta('tryonEndpoint', b.querySelector('[data-ep]').value.trim() || null);
        await store.setMeta('tryonKey', b.querySelector('[data-key]').value.trim() || null);
        toast('Guardado');
      };
    }

    function data(b) {
      const demo = store.all('items').filter((i) => i.demo).length;
      b.innerHTML = `
        <h3>Copia de seguridad</h3>
        <p class="muted small">Descarga todo (armario con fotos, outfits, planes, viajes y ajustes) en un solo archivo, o restaura una copia de seguridad.</p>
        <div class="row gap-s wrap"><button class="btn soft" data-export>${icon('download', 16)} Exportar copia</button>
          <label class="btn soft">${icon('upload', 16)} Importar copia<input type="file" accept="application/json,.json" hidden data-import></label></div>
        <h3>Armario de ejemplo</h3>
        <p class="muted small">${demo ? `Tienes ${demo} prendas de ejemplo en tu armario.` : 'Carga 34 prendas ilustradas para probar todas las funciones.'}</p>
        <div class="row gap-s wrap">${demo ? `<button class="btn soft" data-rmdemo>${icon('trash', 16)} Quitar prendas de ejemplo</button>` : `<button class="btn soft" data-demo>${icon('sparkles', 16)} Cargar armario de ejemplo</button>`}</div>
        <h3 class="danger-text">Zona de peligro</h3>
        <button class="btn ghost danger-text" data-wipe>${icon('trash', 16)} Borrar todos los datos de este dispositivo</button>`;
      b.querySelector('[data-export]').onclick = () => {
        const blob = new Blob([JSON.stringify(store.exportJSON())], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `atelier-copia-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      };
      b.querySelector('[data-import]').onchange = async (e) => {
        try { await store.importJSON(JSON.parse(await e.target.files[0].text())); toast('Copia de seguridad restaurada'); draw(); }
        catch (err) { toast(err.message || 'No se ha podido leer ese archivo'); }
      };
      b.querySelector('[data-demo]')?.addEventListener('click', async () => { await store.putMany('items', demoItems()); toast('Armario de ejemplo cargado'); draw(); });
      b.querySelector('[data-rmdemo]')?.addEventListener('click', async () => {
        await store.removeMany('items', store.all('items').filter((i) => i.demo).map((i) => i.id));
        toast('Prendas de ejemplo eliminadas'); draw();
      });
      b.querySelector('[data-wipe]').onclick = async () => {
        if (!(await confirmDialog('Esto borra para siempre tu armario, tus outfits y tus planes de este dispositivo. Los datos sincronizados en la nube no se ven afectados.', { ok: 'Borrarlo todo', danger: true }))) return;
        await store.wipe();
        location.reload();
      };
    }

    function about(b) {
      b.innerHTML = `
        <div class="about-brand"><span class="brand-mark lg">A</span><div><h3>Atelier</h3><p class="muted small">Tu estilista personal con IA · v1.0</p></div></div>
        <p class="muted">Los outfits se generan en tu dispositivo con un motor de estilismo que puntúa la armonía de color, el estilo, la ocasión, las proporciones y el tiempo. Datos meteorológicos de <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a>.</p>
        <h3>Consigue la app</h3>
        <p class="muted small">Atelier funciona en cualquier navegador y se instala como una app. La APK de Android se compila con el mismo código: consulta el README del proyecto.</p>
        ${installEvt ? `<button class="btn primary" data-install>${icon('download', 16)} Instalar Atelier</button>` : '<p class="muted small">En el móvil, usa el menú del navegador → «Añadir a pantalla de inicio».</p>'}`;
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
