// App shell: navigation, theme, onboarding, sync + service worker bootstrap.
import { store } from './store.js';
import { register, startRouter, onRoute, navigate } from './router.js';
import { icon } from './icons.js';
import { openSheet, chip, bindChips, chipValues, toast, $, closeAllSheets } from './ui.js';
import { STYLES } from './constants.js';
import { demoItems } from './demo.js';
import { initSync, onSync, sync } from './sync.js';
import { loadWeather } from './context.js';
import { esc } from './util.js';

import home from './views/home.js';
import wardrobe from './views/wardrobe.js';
import create from './views/create.js';
import outfit from './views/outfit.js';
import planner from './views/planner.js';
import calendar from './views/calendar.js';
import favorites from './views/favorites.js';
import stats from './views/stats.js';
import laundry from './views/laundry.js';
import travel from './views/travel.js';
import shopping from './views/shopping.js';
import preview from './views/preview.js';
import settings from './views/settings.js';

export const NAV = [
  { id: 'home', label: 'Inicio', short: 'Inicio', icon: 'home' },
  { id: 'wardrobe', label: 'Mi armario', short: 'Armario', icon: 'hanger' },
  { id: 'create', label: 'Crear outfit', icon: 'sparkles' },
  { id: 'planner', label: 'Planificador semanal', short: 'Semana', icon: 'week' },
  { id: 'calendar', label: 'Calendario', icon: 'calendar' },
  { id: 'favorites', label: 'Favoritos', icon: 'heart' },
  { id: 'stats', label: 'Estadísticas', icon: 'chart' },
  { id: 'laundry', label: 'Lavandería', icon: 'laundry' },
  { id: 'travel', label: 'Viajes', icon: 'plane' },
  { id: 'shopping', label: 'Compras', icon: 'bag' },
  { id: 'preview', label: 'Pruébatelo', icon: 'user' },
  { id: 'settings', label: 'Ajustes', icon: 'settings' },
];
const MOBILE = ['home', 'wardrobe', 'create', 'planner'];

const views = { home, wardrobe, create, outfit, planner, calendar, favorites, stats, laundry, travel, shopping, preview, settings };
for (const [k, v] of Object.entries(views)) register(k, v);

function applyTheme() {
  const t = store.settings.theme;
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0f0e0d' : '#f6f3ee');
}

function shell() {
  const side = $('#sidenav');
  side.innerHTML = `
    <a class="brand" href="#/home" aria-label="Inicio de Atelier"><span class="brand-mark">A</span><span class="brand-word">Atelier</span></a>
    <nav>${NAV.filter((n) => n.id !== 'preview' || store.settings.tryOn).map((n) => `<a href="#/${n.id}" data-nav="${n.id}">${icon(n.icon, 19)}<span>${n.label}</span></a>`).join('')}</nav>
    <div class="side-foot" id="syncBadge"></div>`;
  const bottom = $('#bottomnav');
  bottom.innerHTML = MOBILE.map((id) => {
    const n = NAV.find((x) => x.id === id);
    return id === 'create'
      ? `<a href="#/create" data-nav="create" class="bn-create" aria-label="Crear outfit"><span>${icon('sparkles', 24)}</span></a>`
      : `<a href="#/${id}" data-nav="${id}">${icon(n.icon, 22)}<span>${n.short || n.label}</span></a>`;
  }).join('') + `<button id="moreBtn" data-nav="more">${icon('grid', 22)}<span>Más</span></button>`;
  // Put the create FAB in the middle.
  const createEl = bottom.querySelector('.bn-create');
  bottom.insertBefore(createEl, bottom.children[2]);
  $('#moreBtn').onclick = openMore;
  syncBadge();
}

function openMore() {
  openSheet({
    title: 'Atelier',
    body: `<div class="more-grid">${NAV.filter((n) => !MOBILE.includes(n.id) && (n.id !== 'preview' || store.settings.tryOn))
      .map((n) => `<a href="#/${n.id}" class="more-tile">${icon(n.icon, 24)}<span>${n.label}</span></a>`).join('')}</div>`,
    onMount: (b, close) => b.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => close())),
  });
}

function syncBadge() {
  const el = $('#syncBadge');
  if (!el) return;
  const map = {
    off: ['cloud', 'Solo en este dispositivo', 'Activa la sincronización en Ajustes'],
    'signed-out': ['user', 'Sin iniciar sesión', 'Inicia sesión para sincronizar'],
    connecting: ['refresh', 'Sincronizando…', ''],
    synced: ['cloudSync', 'Sincronizado', sync.user?.email || ''],
    error: ['info', 'Problema de sincronización', sync.error || ''],
  };
  const [ic, label, sub] = map[sync.status] || map.off;
  el.innerHTML = `<a href="#/settings?tab=account" class="sync-pill ${sync.status}">${icon(ic, 16)}<span><b>${label}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></a>`;
}

function highlight(route) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === route.name || (route.name === 'outfit' && a.dataset.nav === 'favorites');
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const n = NAV.find((x) => x.id === route.name);
  document.title = n && n.id !== 'home' ? `${n.label} · Atelier` : 'Atelier · tu estilista con IA';
  $('#topTitle').textContent = n ? n.label : route.name === 'outfit' ? 'Outfit' : 'Atelier';
}

function onboarding() {
  if (store.settings.onboarded || store.all('items').length) return;
  openSheet({
    title: 'Te damos la bienvenida a Atelier',
    className: 'onboard',
    body: `
      <p class="lede">Tu estilista personal con IA. Sube tu ropa y Atelier crea outfits completos y con los colores bien combinados para cada día, cada semana y cada viaje.</p>
      <label class="field"><span>¿Cómo te llamamos?</span><input id="obName" placeholder="Tu nombre" autocomplete="given-name"></label>
      <div class="field"><span>Tus estilos favoritos</span><div class="chips">${STYLES.map((s) => chip(s.label, { value: s.id, name: 'obStyle', active: s.id === 'casual' })).join('')}</div></div>
      <div class="ob-choices">
        <button class="ob-choice" data-start="demo">${icon('sparkles', 22)}<b>Explorar con un armario de ejemplo</b><small>34 prendas para probar todas las funciones ya. Puedes quitarlas cuando quieras.</small></button>
        <button class="ob-choice" data-start="empty">${icon('camera', 22)}<b>Empezar con mi propia ropa</b><small>Fotografía o sube tus prendas: Atelier detecta la categoría y los colores.</small></button>
      </div>`,
    onMount(b, close) {
      bindChips(b, 'obStyle', { multi: true });
      b.querySelectorAll('[data-start]').forEach((btn) => (btn.onclick = async () => {
        const styles = chipValues(b, 'obStyle', true);
        await store.setSettings({ onboarded: true, name: b.querySelector('#obName').value.trim(), styles: styles.length ? styles : ['casual'] });
        if (btn.dataset.start === 'demo') {
          await store.putMany('items', demoItems());
          toast('Armario de ejemplo cargado');
        }
        close();
        navigate(btn.dataset.start === 'demo' ? 'home' : 'wardrobe', btn.dataset.start === 'demo' ? {} : { add: 1 });
      }));
    },
  });
}

async function boot() {
  await store.ready;
  applyTheme();
  shell();
  onRoute(highlight);
  addEventListener('hashchange', closeAllSheets);
  startRouter($('#main'));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  store.on((colls) => {
    if (colls.has('settings')) { applyTheme(); shell(); highlight({ name: location.hash.replace(/^#\/?/, '').split('?')[0] || 'home' }); }
  });
  onSync(syncBadge);
  initSync();
  loadWeather();
  onboarding();
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !location.hostname.match(/^(localhost|127\.)/)) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  document.body.classList.add('ready');
}
boot();
