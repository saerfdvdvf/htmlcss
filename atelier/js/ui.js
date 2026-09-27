// Shared UI building blocks.
import { icon } from './icons.js';
import { esc, todayISO, fmtDate, uid } from './util.js';
import { CAT, CATEGORIES, STYLE, OCCASION, subLabel } from './constants.js';
import { store, outfitItemIds } from './store.js';
import { inkOn, colorLabel } from './color.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const html = (strings, ...vals) => strings.reduce((a, s, i) => a + s + (i < vals.length ? vals[i] ?? '' : ''), '');

// ---------- Toasts ----------
export function toast(msg, { action, onAction, timeout = 3800 } = {}) {
  const host = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button class="toast-btn">${esc(action)}</button>` : ''}`;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  const close = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 250); };
  el.querySelector('.toast-btn')?.addEventListener('click', () => { onAction?.(); close(); });
  setTimeout(close, timeout);
}

// ---------- Sheets / modals ----------
let sheetStack = [];
export function openSheet({ title = '', body = '', onMount, wide = false, className = '' } = {}) {
  const root = document.createElement('div');
  root.className = `sheet-root ${className}`;
  root.innerHTML = `
    <div class="sheet-backdrop"></div>
    <section class="sheet ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-grab"></div>
      <header class="sheet-head"><h3>${esc(title)}</h3><button class="icon-btn sheet-x" aria-label="Cerrar">${icon('x')}</button></header>
      <div class="sheet-body">${body}</div>
    </section>`;
  document.body.appendChild(root);
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => root.classList.add('open'));
  let closed = false;
  const close = (v) => {
    if (closed) return;
    closed = true;
    root.classList.remove('open');
    sheetStack = sheetStack.filter((s) => s !== close);
    if (!sheetStack.length) document.body.classList.remove('no-scroll');
    setTimeout(() => root.remove(), 260);
    root._resolve?.(v);
  };
  sheetStack.push(close);
  root.querySelector('.sheet-backdrop').onclick = () => close();
  root.querySelector('.sheet-x').onclick = () => close();
  const promise = new Promise((res) => (root._resolve = res));
  onMount?.(root.querySelector('.sheet-body'), close, root);
  return { close, el: root, result: promise };
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheetStack.length) sheetStack[sheetStack.length - 1](); });
export const closeAllSheets = () => [...sheetStack].reverse().forEach((c) => c());
// Botón «atrás» de Android: cierra la hoja abierta o vuelve a la pantalla anterior.
export function handleBack() {
  if (sheetStack.length) { sheetStack[sheetStack.length - 1](); return true; }
  const route = location.hash.replace(/^#\/?/, '').split('?')[0] || 'home';
  if (route !== 'home') { history.length > 1 ? history.back() : (location.hash = '#/home'); return true; }
  return false;
}

// Dentro de la app de Android existe el puente nativo AtelierAndroid.
export const inAndroidApp = () => typeof window !== 'undefined' && !!window.AtelierAndroid;

// Guarda un archivo (Blob o data URL): en la app de Android va a Descargas/Imágenes; en el navegador, descarga normal.
export async function saveFile(name, mime, data) {
  if (inAndroidApp()) {
    let dataUrl = data;
    if (data instanceof Blob) {
      dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(data);
      });
    }
    return window.AtelierAndroid.saveFile(name, mime, String(dataUrl).split(',')[1] || '');
  }
  const href = data instanceof Blob ? URL.createObjectURL(data) : data;
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (data instanceof Blob) setTimeout(() => URL.revokeObjectURL(href), 1000);
  return true;
}

export function confirmDialog(message, { ok = 'Confirmar', danger = false } = {}) {
  return openSheet({
    title: '¿Seguro?',
    body: `<p class="muted">${esc(message)}</p><div class="row end gap"><button class="btn ghost" data-v="0">Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" data-v="1">${esc(ok)}</button></div>`,
    onMount: (b, close) => b.querySelectorAll('[data-v]').forEach((x) => (x.onclick = () => close(x.dataset.v === '1'))),
  }).result.then(Boolean);
}

// ---------- Small atoms ----------
export const swatch = (hex, size = 14, title = '') =>
  `<span class="sw" style="--c:${esc(hex)};width:${size}px;height:${size}px" title="${esc(title)}"></span>`;
export const chip = (label, { value = label, active = false, name = '', cls = '' } = {}) =>
  `<button type="button" class="chip ${active ? 'on' : ''} ${cls}" data-name="${esc(name)}" data-value="${esc(value)}" aria-pressed="${active}">${label}</button>`;
export function bindChips(root, name, { multi = false, onChange } = {}) {
  root.querySelectorAll(`.chip[data-name="${name}"]`).forEach((c) =>
    c.addEventListener('click', () => {
      if (!multi) root.querySelectorAll(`.chip[data-name="${name}"]`).forEach((o) => o !== c && (o.classList.remove('on'), o.setAttribute('aria-pressed', 'false')));
      const on = multi ? !c.classList.contains('on') : true;
      c.classList.toggle('on', on);
      c.setAttribute('aria-pressed', on);
      onChange?.(chipValues(root, name, multi));
    }),
  );
}
export function chipValues(root, name, multi = false) {
  const v = [...root.querySelectorAll(`.chip[data-name="${name}"].on`)].map((c) => c.dataset.value);
  return multi ? v : v[0] ?? null;
}
export const empty = (ic, title, text = '', action = '') =>
  `<div class="empty">${icon(ic, 36)}<h3>${esc(title)}</h3>${text ? `<p>${text}</p>` : ''}${action}</div>`;

export const imgOf = (item) => item?.image || '';
export const statusBadge = (s) =>
  s && s !== 'available' ? `<span class="badge ${s}">${s === 'laundry' ? 'Lavando' : 'No disponible'}</span>` : '';

export function itemCard(item, { selectable = false, selected = false, compact = false, meta = '' } = {}) {
  const c = item.colors?.[0];
  return `
  <article class="item-card ${compact ? 'compact' : ''} ${selected ? 'selected' : ''} ${item.status && item.status !== 'available' ? 'dim' : ''}" data-id="${esc(item.id)}" tabindex="0">
    <div class="item-img"><img src="${esc(imgOf(item))}" alt="" loading="lazy" decoding="async">${statusBadge(item.status)}
      ${selectable ? `<span class="sel-mark">${icon('check', 16)}</span>` : `<button class="fav-btn ${item.favorite ? 'on' : ''}" data-fav="${esc(item.id)}" aria-label="Favorito">${icon('heart', 16)}</button>`}
    </div>
    <div class="item-meta">
      <div class="item-name">${esc(item.name || CAT[item.category]?.label)}</div>
      <div class="item-sub">${c ? swatch(c.hex, 10, colorLabel(c.name)) : ''}<span>${esc(meta || [colorLabel(c?.name), item.brand].filter(Boolean).join(' · '))}</span></div>
    </div>
  </article>`;
}

// ---------- Score ----------
export function scoreRing(total, size = 64, label = true) {
  const r = 15.5, circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, total || 0));
  const tone = pct >= 85 ? 'good' : pct >= 68 ? 'ok' : 'low';
  return `<div class="score-ring ${tone}" style="width:${size}px;height:${size}px" role="img" aria-label="Puntuación del outfit: ${pct} sobre 100">
    <svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="${r}" class="track"/><circle cx="18" cy="18" r="${r}" class="val" stroke-dasharray="${((pct / 100) * circ).toFixed(1)} ${circ.toFixed(1)}"/></svg>
    <span>${pct}${label ? '' : ''}</span></div>`;
}
export function scoreBars(score) {
  const labels = { color: 'Armonía de color', style: 'Estilo', occasion: 'Ocasión', proportion: 'Proporciones', weather: 'Clima y temporada' };
  return `<div class="bars">${Object.entries(score.breakdown || {})
    .filter(([, v]) => v != null)
    .map(([k, v]) => `<div class="bar-row" title="${labels[k]}: ${Math.round(v)}/100"><span>${labels[k]}</span><div class="bar"><i style="width:${Math.round(v)}%"></i></div><b>${Math.round(v)}</b></div>`)
    .join('')}</div>`;
}

// ---------- Outfit board (flat-lay) ----------
export function outfitBoard(ids, { locks = {}, interactive = false, size = '' } = {}) {
  const get = (id) => (id ? store.get('items', id) : null);
  const piece = (slot, it, extraCls = '') => {
    if (!it) return '';
    const locked = slot === 'accessory' ? (locks.accessory || []).includes(it.id) : locks[slot];
    return `<figure class="piece p-${slot} ${extraCls} ${locked ? 'locked' : ''}" data-slot="${slot}" data-id="${esc(it.id)}">
      <img src="${esc(imgOf(it))}" alt="${esc(it.name || '')}" decoding="async">
      ${interactive ? `<button class="lock-btn" data-lock="${slot}" data-id="${esc(it.id)}" aria-pressed="${!!locked}" aria-label="${locked ? 'Desbloquear' : 'Bloquear'} ${esc(it.name || slot)}">${icon(locked ? 'lock' : 'unlock', 15)}</button>` : ''}
    </figure>`;
  };
  const h = get(ids.hoodie), t = get(ids.tshirt);
  const acc = (ids.accessory || []).map(get).filter(Boolean);
  const layered = h && t;
  return `<div class="board ${size} ${layered ? 'layered' : ''} ${acc.length ? 'has-acc' : ''}">
    <div class="board-main">
      <div class="tops">${piece('hoodie', h)}${piece('tshirt', t, layered ? 'under' : '')}</div>
      ${piece('trousers', get(ids.trousers))}
      ${piece('sneakers', get(ids.sneakers))}
    </div>
    ${acc.length ? `<div class="board-acc">${acc.map((a) => piece('accessory', a)).join('')}</div>` : ''}
  </div>`;
}

export function outfitCard(o, { showDate = true } = {}) {
  const items = outfitItemIds(o.items);
  const missing = items.some((id) => !store.get('items', id));
  return `<article class="outfit-card" data-outfit="${esc(o.id)}" tabindex="0">
    ${outfitBoard(o.items, { size: 'sm' })}
    <div class="oc-foot">
      <div>
        <div class="oc-title">${esc(o.name || (STYLE[o.style]?.label || 'Outfit'))}${o.occasion ? ` · ${esc(OCCASION[o.occasion]?.label || '')}` : ''}</div>
        ${showDate ? `<div class="muted small">${fmtDate(todayISO(new Date(o.createdAt)))}${missing ? ' · faltan prendas' : ''}</div>` : ''}
      </div>
      <div class="row gap-s">${scoreRing(o.score?.total, 34)}<button class="icon-btn fav ${o.favorite ? 'on' : ''}" data-ofav="${esc(o.id)}" aria-label="${o.favorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}">${icon('heart', 18)}</button></div>
    </div>
  </article>`;
}

// ---------- Pickers ----------
export function pickItem({ title = 'Elige una prenda', category = null, filter = () => true, allowNone = false } = {}) {
  let cat = category || 'all';
  let q = '';
  return openSheet({
    title, wide: true,
    body: `<div class="picker">
      <div class="search"><span>${icon('search', 18)}</span><input type="search" placeholder="Busca en tu armario" aria-label="Buscar"></div>
      ${category ? '' : `<div class="chips scroll">${chip('Todo', { value: 'all', name: 'pcat', active: true })}${CATEGORIES.map((c) => chip(c.plural, { value: c.id, name: 'pcat' })).join('')}</div>`}
      <div class="grid items-grid" data-list></div>
      ${allowNone ? '<button class="btn ghost block" data-none>Que elija Unreal Outfits</button>' : ''}
    </div>`,
    onMount(b, close) {
      const list = b.querySelector('[data-list]');
      const draw = () => {
        const items = store.all('items').filter((i) => (cat === 'all' || i.category === cat) && filter(i) &&
          (!q || `${i.name} ${i.brand} ${i.colors?.map((c) => c.name + ' ' + colorLabel(c.name)).join(' ')} ${i.subtype} ${subLabel(i.subtype)}`.toLowerCase().includes(q)));
        list.innerHTML = items.length ? items.map((i) => itemCard(i, { selectable: true, compact: true })).join('') : empty('hanger', 'No hay nada aquí', 'Prueba otra categoría o añade prendas a tu armario.');
      };
      draw();
      b.querySelector('input').oninput = (e) => { q = e.target.value.toLowerCase().trim(); draw(); };
      bindChips(b, 'pcat', { onChange: (v) => { cat = v; draw(); } });
      list.addEventListener('click', (e) => {
        const card = e.target.closest('.item-card');
        if (card) close(store.get('items', card.dataset.id));
      });
      b.querySelector('[data-none]')?.addEventListener('click', () => close('none'));
    },
  }).result;
}

export function pickDate({ title = 'Elige una fecha', value = todayISO() } = {}) {
  return openSheet({
    title,
    body: `<label class="field"><span>Fecha</span><input type="date" value="${value}"></label><div class="row end gap"><button class="btn ghost" data-c>Cancelar</button><button class="btn primary" data-ok>Guardar</button></div>`,
    onMount(b, close) {
      b.querySelector('[data-c]').onclick = () => close(null);
      b.querySelector('[data-ok]').onclick = () => close(b.querySelector('input').value || null);
    },
  }).result;
}

// ---------- Domain actions ----------
export async function saveGenerated(res, { style, occasion, weather, source = 'create', favorite = false, name } = {}) {
  return store.put('outfits', {
    id: uid(), items: res.items, score: res.score, signature: res.signature,
    style: style && style !== 'any' ? style : res.score?.style, occasion: occasion || null,
    weather: weather ? { band: weather.band, temp: weather.temp ?? null, season: weather.season } : null,
    source, favorite, name: name || '',
  });
}

export async function logWear(outfit, date = todayISO()) {
  const itemIds = outfitItemIds(outfit.items);
  const existing = store.all('wears').find((w) => w.date === date && w.outfitId === outfit.id);
  if (existing) return existing;
  const w = await store.put('wears', { id: uid(), date, outfitId: outfit.id, itemIds });
  toast('Registrado como puesto hoy', {
    action: 'Mandar a lavar',
    onAction: async () => {
      for (const id of itemIds) {
        const it = store.get('items', id);
        if (it && it.category !== 'accessory') await store.patch('items', id, { status: 'laundry' });
      }
      toast('Movido a la lista de lavado');
    },
    timeout: 6000,
  });
  return w;
}

export async function toggleOutfitFav(id) {
  const o = store.get('outfits', id);
  if (!o) return;
  await store.patch('outfits', id, { favorite: !o.favorite });
  toast(o.favorite ? 'Quitado de favoritos' : 'Guardado en favoritos');
}

export async function planOutfit(outfit, date) {
  const cur = store.get('plans', date);
  await store.put('plans', { ...(cur || {}), id: date, date, outfitId: outfit.id, worn: false });
  toast(`Planificado para el ${fmtDate(date)}`);
}

export function colorDot(hex) {
  return `<span class="color-dot" style="background:${esc(hex)};color:${inkOn(hex)}"></span>`;
}
