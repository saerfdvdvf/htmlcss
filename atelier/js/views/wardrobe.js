// My Wardrobe: browse, search, filter, sort, favourite, bulk actions and add items.
import { store, wearCounts } from '../store.js';
import { CATEGORIES, CAT, STYLES, SEASONS, STATUSES } from '../constants.js';
import { icon } from '../icons.js';
import { esc, cap } from '../util.js';
import { itemCard, empty, chip, bindChips, chipValues, openSheet, toast, confirmDialog, swatch } from '../ui.js';
import { openItemEditor, itemFromFile, blankItem } from './item-editor.js';
import { NAMED } from '../color.js';
import { setHash } from '../router.js';

const state = { cat: 'all', q: '', sort: 'recent', colors: [], styles: [], seasons: [], status: [], favOnly: false, select: false, selected: new Set() };

export async function addFromFiles(files) {
  files = [...files].filter((f) => f.type.startsWith('image/'));
  if (!files.length) return;
  if (files.length === 1) {
    const sheet = openSheet({ title: 'Analysing photo', body: `<div class="analyzing"><div class="spinner"></div><p>Removing background, detecting category & colours…</p></div>` });
    try {
      const it = await itemFromFile(files[0]);
      sheet.close();
      await openItemEditor(it, { isNew: true });
    } catch (e) { sheet.close(); toast(e.message); }
    return;
  }
  // Bulk: analyse everything, save, then let the user review.
  let done = 0;
  const sheet = openSheet({ title: `Adding ${files.length} items`, body: `<div class="analyzing"><div class="spinner"></div><p data-p>Analysing 1 of ${files.length}…</p><div class="progress"><i data-bar></i></div></div>` });
  const added = [];
  for (const f of files) {
    try { added.push(await itemFromFile(f)); } catch (e) { console.warn(e); }
    done++;
    sheet.el.querySelector('[data-p]').textContent = `Analysing ${Math.min(done + 1, files.length)} of ${files.length}…`;
    sheet.el.querySelector('[data-bar]').style.width = `${(done / files.length) * 100}%`;
  }
  await store.putMany('items', added.map(({ analysis, ...i }) => i));
  sheet.close();
  toast(`${added.length} items added — tap any item to review its details`);
}

export function openAddMenu() {
  openSheet({
    title: 'Add to wardrobe',
    body: `<div class="add-options">
      <label class="add-opt">${icon('camera', 26)}<b>Take a photo</b><small>Lay the item flat on a plain background for best results</small><input type="file" accept="image/*" capture="environment" hidden data-cam></label>
      <label class="add-opt">${icon('upload', 26)}<b>Upload photos</b><small>Select one or many — each is analysed automatically</small><input type="file" accept="image/*" multiple hidden data-up></label>
      <button class="add-opt" data-manual>${icon('wand', 26)}<b>Add without a photo</b><small>Pick category & colour; we draw it for you</small></button>
    </div>
    <p class="muted small center">${icon('info', 14)} Photos are processed on your device.</p>`,
    onMount(b, close) {
      const onFiles = (e) => { close(); addFromFiles(e.target.files); };
      b.querySelector('[data-cam]').onchange = onFiles;
      b.querySelector('[data-up]').onchange = onFiles;
      b.querySelector('[data-manual]').onclick = () => { close(); openItemEditor(blankItem(state.cat !== 'all' ? state.cat : 'tshirt'), { isNew: true }); };
    },
  });
}

function filtered() {
  const wc = wearCounts();
  let items = store.all('items').filter((i) =>
    (state.cat === 'all' || i.category === state.cat) &&
    (!state.favOnly || i.favorite) &&
    (!state.colors.length || i.colors?.some((c) => state.colors.includes(c.name))) &&
    (!state.styles.length || i.styles?.some((s) => state.styles.includes(s))) &&
    (!state.seasons.length || !i.seasons?.length || i.seasons.some((s) => state.seasons.includes(s))) &&
    (!state.status.length || state.status.includes(i.status || 'available')) &&
    (!state.q || `${i.name} ${i.brand} ${i.subtype} ${(i.tags || []).join(' ')} ${(i.colors || []).map((c) => c.name).join(' ')} ${CAT[i.category]?.label}`.toLowerCase().includes(state.q)));
  const by = {
    recent: (a, b) => b.createdAt - a.createdAt,
    name: (a, b) => (a.name || '').localeCompare(b.name || ''),
    most: (a, b) => (wc.get(b.id) || 0) - (wc.get(a.id) || 0),
    least: (a, b) => (wc.get(a.id) || 0) - (wc.get(b.id) || 0),
    color: (a, b) => (a.colors?.[0]?.name || '').localeCompare(b.colors?.[0]?.name || ''),
  }[state.sort];
  return { items: items.sort(by), wc };
}

const activeFilters = () => state.colors.length + state.styles.length + state.seasons.length + state.status.length + (state.favOnly ? 1 : 0);

function openFilters(redraw) {
  const colorNames = [...new Set(store.all('items').flatMap((i) => (i.colors || []).map((c) => c.name)))].sort();
  openSheet({
    title: 'Filter wardrobe',
    body: `
      <div class="field"><span>Colour</span><div class="chips">${colorNames.map((n) => chip(`${swatch(NAMED[n]?.hex || '#888', 12)} ${esc(n)}`, { value: n, name: 'fc', active: state.colors.includes(n) })).join('')}</div></div>
      <div class="field"><span>Style</span><div class="chips">${STYLES.map((s) => chip(s.label, { value: s.id, name: 'fs', active: state.styles.includes(s.id) })).join('')}</div></div>
      <div class="field"><span>Season</span><div class="chips">${SEASONS.map((s) => chip(cap(s), { value: s, name: 'fse', active: state.seasons.includes(s) })).join('')}</div></div>
      <div class="field"><span>Availability</span><div class="chips">${STATUSES.map((s) => chip(s.label, { value: s.id, name: 'fst', active: state.status.includes(s.id) })).join('')}</div></div>
      <label class="switch-row"><input type="checkbox" data-fav ${state.favOnly ? 'checked' : ''}><span class="switch"></span><span>Favourites only</span></label>
      <div class="row end gap"><button class="btn ghost" data-reset>Reset</button><button class="btn primary" data-apply>Show results</button></div>`,
    onMount(b, close) {
      ['fc', 'fs', 'fse', 'fst'].forEach((n) => bindChips(b, n, { multi: true }));
      b.querySelector('[data-reset]').onclick = () => { Object.assign(state, { colors: [], styles: [], seasons: [], status: [], favOnly: false }); close(); redraw(); };
      b.querySelector('[data-apply]').onclick = () => {
        state.colors = chipValues(b, 'fc', true); state.styles = chipValues(b, 'fs', true);
        state.seasons = chipValues(b, 'fse', true); state.status = chipValues(b, 'fst', true);
        state.favOnly = b.querySelector('[data-fav]').checked;
        close(); redraw();
      };
    },
  });
}

export default {
  render(el, params) {
    el.innerHTML = `
      <header class="page-head">
        <div><div class="eyebrow">Digital wardrobe</div><h1 class="display">My Wardrobe</h1><p class="muted" data-count></p></div>
        <div class="row gap-s">
          <button class="btn ghost" data-select>${icon('check', 18)} Select</button>
          <button class="btn primary" data-add>${icon('plus', 18)} Add item</button>
        </div>
      </header>
      <div class="toolbar sticky">
        <div class="search"><span>${icon('search', 18)}</span><input type="search" placeholder="Search name, brand, colour, tag…" value="${esc(state.q)}" aria-label="Search wardrobe"></div>
        <button class="btn ghost filter-btn" data-filter>${icon('filter', 18)} Filters <span class="count-badge" data-fcount></span></button>
        <select data-sort aria-label="Sort">
          <option value="recent">Newest</option><option value="name">Name</option><option value="color">Colour</option>
          <option value="most">Most worn</option><option value="least">Least worn</option>
        </select>
      </div>
      <div class="chips scroll cat-tabs" data-cats></div>
      <div class="bulk-bar" data-bulk hidden>
        <span data-selcount>0 selected</span>
        <button class="btn soft sm" data-bulk-act="available">Available</button>
        <button class="btn soft sm" data-bulk-act="laundry">Laundry</button>
        <button class="btn soft sm" data-bulk-act="unavailable">Unavailable</button>
        <button class="btn soft sm danger-text" data-bulk-act="delete">${icon('trash', 14)} Delete</button>
        <button class="btn ghost sm" data-bulk-act="done">Done</button>
      </div>
      <div class="grid items-grid" data-grid></div>`;
    el.querySelector('[data-sort]').value = state.sort;

    const draw = () => {
      const counts = Object.fromEntries(CATEGORIES.map((c) => [c.id, store.all('items').filter((i) => i.category === c.id).length]));
      el.querySelector('[data-cats]').innerHTML =
        chip(`All <small>${store.all('items').length}</small>`, { value: 'all', name: 'cat', active: state.cat === 'all' }) +
        CATEGORIES.map((c) => chip(`${c.plural} <small>${counts[c.id]}</small>`, { value: c.id, name: 'cat', active: state.cat === c.id })).join('');
      bindChips(el, 'cat', { onChange: (v) => { state.cat = v; draw(); } });
      const { items, wc } = filtered();
      el.querySelector('[data-count]').textContent = `${store.all('items').length} pieces${items.length !== store.all('items').length ? ` · ${items.length} shown` : ''}`;
      const n = activeFilters();
      el.querySelector('[data-fcount]').textContent = n || '';
      el.querySelector('[data-bulk]').hidden = !state.select;
      el.querySelector('[data-selcount]').textContent = `${state.selected.size} selected`;
      el.querySelector('[data-grid]').innerHTML = items.length
        ? items.map((i) => itemCard(i, { selectable: state.select, selected: state.selected.has(i.id), meta: state.sort === 'most' || state.sort === 'least' ? `Worn ${wc.get(i.id) || 0}×` : '' })).join('')
        : store.all('items').length
          ? empty('search', 'No matches', 'Try a different search or clear the filters.')
          : empty('hanger', 'Start your digital wardrobe', 'Add hoodies, T-shirts, trousers, sneakers and accessories. Atelier detects the category and colours for you.', `<button class="btn primary" data-add>${icon('camera', 18)} Add your first item</button>`);
    };
    draw();

    el.addEventListener('click', async (e) => {
      if (e.target.closest('[data-add]')) return openAddMenu();
      if (e.target.closest('[data-filter]')) return openFilters(draw);
      if (e.target.closest('[data-select]')) { state.select = !state.select; state.selected.clear(); return draw(); }
      const fav = e.target.closest('[data-fav]');
      if (fav) {
        e.stopPropagation();
        const it = store.get('items', fav.dataset.fav);
        return store.patch('items', it.id, { favorite: !it.favorite });
      }
      const bulk = e.target.closest('[data-bulk-act]')?.dataset.bulkAct;
      if (bulk) {
        const ids = [...state.selected];
        if (bulk === 'done') { state.select = false; state.selected.clear(); return draw(); }
        if (!ids.length) return toast('Select some items first');
        if (bulk === 'delete') {
          if (!(await confirmDialog(`Delete ${ids.length} item${ids.length > 1 ? 's' : ''}?`, { ok: 'Delete', danger: true }))) return;
          await store.removeMany('items', ids);
        } else await store.putMany('items', ids.map((id) => ({ ...store.get('items', id), status: bulk })));
        state.selected.clear();
        return toast('Updated');
      }
      const card = e.target.closest('.item-card');
      if (card) {
        if (state.select) {
          state.selected.has(card.dataset.id) ? state.selected.delete(card.dataset.id) : state.selected.add(card.dataset.id);
          return draw();
        }
        openItemEditor(store.get('items', card.dataset.id));
      }
    });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList.contains('item-card')) e.target.click(); });
    el.querySelector('input[type=search]').addEventListener('input', (e) => { state.q = e.target.value.toLowerCase().trim(); draw(); });
    el.querySelector('[data-sort]').onchange = (e) => { state.sort = e.target.value; draw(); };

    // Drag & drop photos anywhere on the page (desktop).
    const onDrop = (e) => { e.preventDefault(); if (e.dataTransfer?.files?.length) addFromFiles(e.dataTransfer.files); };
    const onOver = (e) => e.preventDefault();
    el.addEventListener('drop', onDrop);
    el.addEventListener('dragover', onOver);

    if (params.add) { setHash('wardrobe'); setTimeout(openAddMenu, 50); }
    if (params.cat && CAT[params.cat]) { state.cat = params.cat; draw(); }
    return store.on((c) => c.has('items') && draw());
  },
};
