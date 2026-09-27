// Create Outfit: what → style → optional filters → result studio.
import { store } from '../store.js';
import { STYLES, OCCASIONS, WEATHER_BANDS, SEASONS, CAT, SEASON_LABEL, BAND_LABEL } from '../constants.js';
import { generateOutfit } from '../engine.js';
import { buildCtx, weatherFor, defaultOccasion } from '../context.js';
import { mountStudio } from '../studio.js';
import { icon } from '../icons.js';
import { esc, todayISO } from '../util.js';
import { chip, bindChips, pickItem, saveGenerated, empty, swatch } from '../ui.js';
import { NAMED, colorLabel } from '../color.js';
import { navigate, setHash } from '../router.js';

const MODES = [
  { id: 'create', icon: 'sparkles', title: 'Crear un outfit', text: 'Elige estilo y ocasión; nosotros hacemos el resto.' },
  { id: 'weekly', icon: 'week', title: 'Crear outfits para la semana', text: 'Siete días planificados, con opción de no repetir.' },
  { id: 'surprise', icon: 'shuffle', title: 'Sorpréndeme', text: 'Un look al azar en el que quizá no habías pensado.' },
  { id: 'item', icon: 'hanger', title: 'Usar una prenda concreta', text: 'Crea el mejor outfit alrededor de una prenda.' },
  { id: 'preview', icon: 'user', title: 'Probarme un outfit', text: 'Mira cómo te queda un look sobre tu propia foto.' },
];
const STYLE_ICON = { casual: 'hanger', 'smart-casual': 'star', formal: 'tag', streetwear: 'layers', sporty: 'thermo', any: 'shuffle' };

const fresh = () => ({
  step: 'mode', mode: 'create', style: null, item: null,
  occasion: null, weather: 'auto', season: null, include: [], avoid: [],
  accessories: store.settings.accessories, layering: store.settings.layering, leastWorn: false, favOnly: false,
});
let S = null;

export default {
  render(el, params) {
    if (!S || params.reset) S = fresh();
    if (params.mode === 'surprise') { S = fresh(); S.mode = 'surprise'; S.style = 'any'; S.step = 'result'; setHash('create'); }
    if (params.item && store.get('items', params.item)) { S = fresh(); S.mode = 'item'; S.item = params.item; S.step = 'style'; setHash('create'); }
    if (!S.occasion) S.occasion = defaultOccasion();

    const items = store.all('items');
    if (!items.length) {
      el.innerHTML = `<header class="page-head"><div><div class="eyebrow">Estilista</div><h1 class="display">Crear outfit</h1></div></header>
        <div class="card">${empty('hanger', 'Primero añade ropa', 'Atelier necesita al menos una parte de arriba, un pantalón y unas zapatillas para vestirte.', `<a class="btn primary" href="#/wardrobe?add=1">${icon('camera', 18)} Añadir ropa</a>`)}</div>`;
      return;
    }

    const go = (step) => { S.step = step; draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const steps = ['mode', 'style', 'filters', 'result'];

    function header(title, sub) {
      const idx = steps.indexOf(S.step);
      return `<header class="page-head create-head">
        <div>${idx > 0 ? `<button class="back" data-back>${icon('left', 18)} Atrás</button>` : '<div class="eyebrow">Tu estilista</div>'}
        <h1 class="display">${title}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}</div>
        <ol class="stepper" aria-label="Progreso">${['Qué', 'Estilo', 'Detalles', 'Outfit'].map((s, i) => `<li class="${i < idx ? 'done' : i === idx ? 'now' : ''}">${s}</li>`).join('')}</ol>
      </header>`;
    }

    function selectedItemBanner() {
      const it = S.item && store.get('items', S.item);
      if (!it) return '';
      return `<div class="card anchor-item"><img src="${esc(it.image)}" alt=""><div><div class="eyebrow">Construido alrededor de</div><b>${esc(it.name)}</b><div class="muted small">${esc(CAT[it.category].label)} · se mantiene en todos los resultados</div></div>
        <button class="btn ghost sm" data-change-item>Cambiar</button></div>`;
    }

    function draw() {
      if (S.step === 'mode') {
        el.innerHTML = header('¿Qué quieres hacer?') + `
          <div class="mode-grid">${MODES.map((m) => `
            <button class="mode-card" data-mode="${m.id}">${icon(m.icon, 26)}<b>${m.title}</b><small>${m.text}</small>${icon('right', 18, 'go')}</button>`).join('')}</div>`;
      } else if (S.step === 'style') {
        el.innerHTML = header('Elige tu estilo', S.mode === 'surprise' ? '' : 'Todo lo demás es opcional.') + selectedItemBanner() + `
          <div class="style-grid">${[...STYLES, { id: 'any', label: 'Cualquier estilo', blurb: 'Que decida Atelier' }].map((s) => `
            <button class="style-card ${S.style === s.id ? 'on' : ''}" data-style="${s.id}"><span class="st-ic">${icon(STYLE_ICON[s.id], 22)}</span><b>${s.label}</b><small>${s.blurb}</small></button>`).join('')}</div>`;
      } else if (S.step === 'filters') {
        const w = weatherFor(todayISO());
        const colorNames = [...new Set(items.flatMap((i) => (i.colors || []).slice(0, 1).map((c) => c.name)))].sort();
        el.innerHTML = header('Ajusta los detalles (opcional)', 'Genera directamente o cuéntanos algo más.') + selectedItemBanner() + `
          <div class="filters card">
            <div class="field"><span>${icon('pin', 15)} Ocasión</span><div class="chips">${OCCASIONS.map((o) => chip(o.label, { value: o.id, name: 'occ', active: S.occasion === o.id })).join('')}</div></div>
            <div class="field"><span>${icon('thermo', 15)} Tiempo</span><div class="chips">
              ${chip(`Automático · ${w.temp != null ? Math.round(w.temp) + '° ' : ''}${BAND_LABEL[w.band]}${w.assumed ? ' (estimado)' : ''}`, { value: 'auto', name: 'wx', active: S.weather === 'auto' })}
              ${WEATHER_BANDS.map((b) => chip(`${b.label} <small>${b.range}</small>`, { value: b.id, name: 'wx', active: S.weather === b.id })).join('')}
              ${chip('Ignorar', { value: 'none', name: 'wx', active: S.weather === 'none' })}</div></div>
            <div class="field"><span>Temporada</span><div class="chips">${chip('Actual', { value: '', name: 'season', active: !S.season })}${SEASONS.map((s) => chip(SEASON_LABEL[s], { value: s, name: 'season', active: S.season === s })).join('')}</div></div>
            <div class="field"><span>${icon('palette', 15)} Incluir un color</span><div class="chips">${colorNames.map((n) => chip(`${swatch(NAMED[n]?.hex || '#888', 12)} ${colorLabel(n)}`, { value: n, name: 'inc', active: S.include.includes(n) })).join('')}</div></div>
            <div class="field"><span>Evitar colores</span><div class="chips">${colorNames.map((n) => chip(`${swatch(NAMED[n]?.hex || '#888', 12)} ${colorLabel(n)}`, { value: n, name: 'avoid', active: S.avoid.includes(n) })).join('')}</div></div>
            <div class="toggles">
              <label class="switch-row"><input type="checkbox" data-t="accessories" ${S.accessories ? 'checked' : ''}><span class="switch"></span><span>Añadir accesorios</span></label>
              <label class="switch-row"><input type="checkbox" data-t="layering" ${S.layering ? 'checked' : ''}><span class="switch"></span><span>Permitir capas (camiseta bajo la sudadera)</span></label>
              <label class="switch-row"><input type="checkbox" data-t="leastWorn" ${S.leastWorn ? 'checked' : ''}><span class="switch"></span><span>Priorizar las prendas menos usadas</span></label>
              <label class="switch-row"><input type="checkbox" data-t="favOnly" ${S.favOnly ? 'checked' : ''}><span class="switch"></span><span>Priorizar mis prendas favoritas</span></label>
            </div>
            <p class="muted small">${icon('laundry', 14)} Las prendas lavándose o no disponibles (${items.filter((i) => i.status && i.status !== 'available').length}) se excluyen automáticamente.</p>
          </div>
          <div class="sticky-cta"><button class="btn primary lg block" data-generate>${icon('sparkles', 20)} Generar outfit</button></div>`;
        bindChips(el, 'occ', { onChange: (v) => (S.occasion = v) });
        bindChips(el, 'wx', { onChange: (v) => (S.weather = v) });
        bindChips(el, 'season', { onChange: (v) => (S.season = v || null) });
        bindChips(el, 'inc', { multi: true, onChange: (v) => (S.include = v) });
        bindChips(el, 'avoid', { multi: true, onChange: (v) => (S.avoid = v) });
        el.querySelectorAll('[data-t]').forEach((c) => (c.onchange = () => (S[c.dataset.t] = c.checked)));
      } else if (S.step === 'result') {
        el.innerHTML = header(S.mode === 'surprise' ? '¡Sorpresa!' : 'Tu outfit') + `<div data-studio><div class="skeleton" style="height:480px"></div></div>
          <div class="row gap center result-foot"><button class="btn ghost" data-back>${icon('filter', 16)} Ajustar</button><button class="btn ghost" data-restart>${icon('refresh', 16)} Empezar de nuevo</button></div>`;
        generate();
      }
    }

    function ctxNow() {
      let weather;
      if (S.weather === 'none') weather = null;
      else if (S.weather === 'auto') weather = weatherFor(todayISO());
      else { const b = WEATHER_BANDS.find((x) => x.id === S.weather); weather = { band: b.id, temp: null, season: weatherFor().season }; }
      if (weather && S.season) weather = { ...weather, season: S.season };
      return buildCtx({ style: S.style || 'any', occasion: S.occasion, weather, colorPrefs: { include: S.include, avoid: S.avoid }, preferLeastWorn: S.leastWorn, onlyFavorites: S.favOnly });
    }

    async function generate() {
      const ctx = { ...ctxNow(), accessories: S.accessories, layering: S.layering };
      const surprise = S.mode === 'surprise';
      const res = generateOutfit(store.all('items'), ctx, { mustInclude: S.item, temperature: surprise ? 14 : 3.5 });
      const host = el.querySelector('[data-studio]');
      if (res.error) { host.innerHTML = `<div class="card">${empty('info', 'No se ha podido crear un outfit', esc(res.error))}</div>`; return; }
      const outfit = await saveGenerated(res, { style: ctx.style, occasion: ctx.occasion, weather: ctx.weather, source: surprise ? 'surprise' : S.item ? 'item' : 'create' });
      mountStudio(host, outfit, ctx, { mustInclude: S.item, source: 'create' });
    }

    el.onclick = async (e) => {
      const t = e.target;
      if (t.closest('[data-back]')) return go(steps[Math.max(0, steps.indexOf(S.step) - 1)]);
      if (t.closest('[data-restart]')) { S = fresh(); return draw(); }
      const mode = t.closest('[data-mode]')?.dataset.mode;
      if (mode) {
        if (mode === 'weekly') return navigate('planner');
        if (mode === 'preview') return navigate('preview');
        S.mode = mode;
        S.item = null;
        if (mode === 'surprise') { S.style = 'any'; return go('result'); }
        if (mode === 'item') {
          const it = await pickItem({ title: '¿Alrededor de qué prenda creamos el outfit?' });
          if (!it) return;
          S.item = it.id;
        }
        return go('style');
      }
      if (t.closest('[data-change-item]')) {
        const it = await pickItem({ title: 'Crear alrededor de…' });
        if (it) { S.item = it.id; draw(); }
        return;
      }
      const st = t.closest('[data-style]')?.dataset.style;
      if (st) { S.style = st; return go('filters'); }
      if (t.closest('[data-generate]')) return go('result');
    };
    draw();
  },
};
