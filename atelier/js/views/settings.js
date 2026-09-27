// Ajustes: perfil y estilo, Pruébatelo, datos (todo se guarda en local, sin cuentas).
import { store } from '../store.js';
import { STYLES, OCCASIONS } from '../constants.js';
import { NAMED_COLORS, colorLabel } from '../color.js';
import { icon } from '../icons.js';
import { esc, debounce } from '../util.js';
import { chip, bindChips, toast, confirmDialog, swatch, saveFile, inAndroidApp } from '../ui.js';
import { geocode, currentPosition } from '../weather.js';
import { loadWeather } from '../context.js';
import { demoItems } from '../demo.js';
import { setHash } from '../router.js';

const TABS = [
  ['profile', 'Perfil y estilo', 'user'],
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
      ({ profile, preview, data, about })[tab](body);
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

    function preview(b) {
      const s = store.settings;
      b.innerHTML = `
        <label class="switch-row"><input type="checkbox" data-tryon ${s.tryOn ? 'checked' : ''}><span class="switch"></span><span><b>Activar Pruébatelo</b><br><small class="muted">Muestra los outfits sobre tu propia foto. Desactívalo para ocultar la función en toda la app.</small></span></label>
        <div class="field"><span>Tu foto</span>
          <div class="row gap-s">${store.getMeta('photo') ? `<img class="thumb-sm" src="${store.getMeta('photo')}" alt=""><button class="btn ghost danger-text" data-rmphoto>${icon('trash', 16)} Eliminar foto</button>` : '<span class="muted small">Aún no hay foto: añádela desde Pruébatelo.</span>'}</div>
          <small class="muted">Solo se guarda en este dispositivo. Nunca se sube ni se sincroniza.</small></div>
        <h3>Servicio de prueba virtual con IA (opcional)</h3>
        <p class="muted small">Para obtener resultados fotorrealistas, conecta Unreal Outfits a un servicio de prueba virtual. Recibe <code>{ person, garments[] }</code> como data URLs y devuelve <code>{ image }</code>. En <code>atelier/server/tryon-worker.js</code> tienes un Cloudflare Worker listo que usa IDM-VTON en Replicate.</p>
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
        <h3>${icon('check', 18)} Todo se guarda en este dispositivo</h3>
        <p class="muted small">Unreal Outfits funciona sin cuenta ni inicio de sesión: tu armario, tus outfits, planes, viajes y ajustes se guardan solo en este navegador o en esta app, y funcionan sin conexión.</p>
        <h3>Copia de seguridad</h3>
        <p class="muted small">Descarga todo (armario con fotos, outfits, planes, viajes y ajustes) en un solo archivo, o restaura una copia. También sirve para pasar tu armario del ordenador al móvil o al revés: exporta en uno e importa en el otro.</p>
        <div class="row gap-s wrap"><button class="btn soft" data-export>${icon('download', 16)} Exportar copia</button>
          <label class="btn soft">${icon('upload', 16)} Importar copia<input type="file" accept="application/json,.json" hidden data-import></label></div>
        <h3>Armario de ejemplo</h3>
        <p class="muted small">${demo ? `Tienes ${demo} prendas de ejemplo en tu armario.` : 'Carga 34 prendas ilustradas para probar todas las funciones.'}</p>
        <div class="row gap-s wrap">${demo ? `<button class="btn soft" data-rmdemo>${icon('trash', 16)} Quitar prendas de ejemplo</button>` : `<button class="btn soft" data-demo>${icon('sparkles', 16)} Cargar armario de ejemplo</button>`}</div>
        <h3 class="danger-text">Zona de peligro</h3>
        <button class="btn ghost danger-text" data-wipe>${icon('trash', 16)} Borrar todos los datos de este dispositivo</button>`;
      b.querySelector('[data-export]').onclick = () => {
        const blob = new Blob([JSON.stringify(store.exportJSON())], { type: 'application/json' });
        saveFile(`unreal-outfits-copia-${new Date().toISOString().slice(0, 10)}.json`, 'application/json', blob);
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
        <div class="about-brand"><span class="brand-mark lg">U</span><div><h3>Unreal Outfits</h3><p class="muted small">by Sawel · tu estilista personal con IA · v1.0</p></div></div>
        <p class="muted">Los outfits se generan en tu dispositivo con un motor de estilismo que puntúa la armonía de color, el estilo, la ocasión, las proporciones y el tiempo. Datos meteorológicos de <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a>.</p>
        <h3>Consigue la app</h3>
        <p class="muted small">Unreal Outfits funciona en cualquier navegador, sin cuenta y sin conexión, y se puede instalar como una app. También existe <code>Unreal-Outfits.html</code>, un único archivo que se abre con doble clic, y la APK de Android se compila con el mismo código: consulta el README del proyecto.</p>
        ${inAndroidApp() ? '<p class="muted small">Estás usando la app de Android. Las copias de seguridad se guardan en Descargas/Unreal Outfits.</p>' : installEvt ? `<button class="btn primary" data-install>${icon('download', 16)} Instalar Unreal Outfits</button>` : '<p class="muted small">En el móvil, usa el menú del navegador → «Añadir a pantalla de inicio».</p>'}`;
      b.querySelector('[data-install]')?.addEventListener('click', async () => { installEvt.prompt(); installEvt = null; });
    }

    draw();
    el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]');
      if (t) { tab = t.dataset.tab; setHash('settings', { tab }); draw(); }
    });
  },
};
