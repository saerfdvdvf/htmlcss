// Add / edit a clothing item (with AI-detected suggestions) + item detail stats.
import { store, wearCounts, lastWorn } from '../store.js';
import { CATEGORIES, CAT, STYLES, SEASONS, PATTERNS, FITS, STATUSES } from '../constants.js';
import { guessStyles, guessFit, guessSeasons, itemWarmth, itemFormality, bestPartners } from '../engine.js';
import { garmentDataURL } from '../garments.js';
import { analyzeImage, fileToDataURL } from '../analyzer.js';
import { nameColor, NAMED_COLORS } from '../color.js';
import { icon } from '../icons.js';
import { esc, uid, cap, fmtDate } from '../util.js';
import { openSheet, chip, bindChips, chipValues, toast, confirmDialog, swatch } from '../ui.js';
import { navigate } from '../router.js';

export function blankItem(category = 'tshirt', hex = '#1d2a44') {
  const subtype = CAT[category].subtypes[0];
  const base = { category, subtype };
  return {
    id: uid(), name: '', category, subtype, brand: '',
    image: garmentDataURL(category, hex, subtype), illustrated: true,
    colors: [{ hex, name: nameColor(hex), pct: 100 }],
    styles: guessStyles(category, subtype, 'solid', hex), seasons: guessSeasons(category, subtype),
    fit: guessFit(category, subtype), pattern: 'solid',
    warmth: itemWarmth(base), formality: itemFormality(base),
    tags: [], notes: '', favorite: false, status: 'available',
  };
}

export async function itemFromFile(file) {
  const src = await fileToDataURL(file);
  const a = await analyzeImage(src, { fileName: file.name, smart: store.settings.smartRecognition });
  return {
    id: uid(), name: a.name, category: a.category, subtype: a.subtype, brand: '',
    image: a.image, colors: a.colors, styles: a.styles, seasons: a.seasons, fit: a.fit, pattern: a.pattern,
    warmth: a.warmth, formality: a.formality, tags: [], notes: '', favorite: false, status: 'available',
    analysis: { confidence: a.confidence, source: a.source, bgRemoved: a.bgRemoved },
  };
}

export function openItemEditor(item, { isNew = false, queue = null } = {}) {
  let draft = structuredClone(item);
  const wc = wearCounts().get(item.id) || 0;
  const lw = lastWorn().get(item.id);
  return openSheet({
    title: isNew ? 'New item' : 'Edit item',
    wide: true,
    className: 'editor-sheet',
    body: `<form class="editor" novalidate>
      <div class="ed-media">
        <div class="ed-img checker"><img alt="" data-img></div>
        <div class="row gap-s wrap center">
          <label class="btn soft sm">${icon('image', 15)} Replace photo<input type="file" accept="image/*" hidden data-file></label>
          <button type="button" class="btn soft sm" data-illustrate>${icon('wand', 15)} Use illustration</button>
        </div>
        ${draft.analysis ? `<div class="ai-note">${icon('sparkles', 15)} <span>Auto-detected <b>${esc(CAT[draft.category].label)}</b> (${Math.round(draft.analysis.confidence * 100)}% via ${esc(draft.analysis.source)})${draft.analysis.bgRemoved ? ', background removed' : ''}. Check the details below.</span></div>` : ''}
        ${!isNew ? `<div class="ed-stats">
          <div><b>${wc}</b><span>times worn</span></div>
          <div><b>${lw ? fmtDate(lw, { day: 'numeric', month: 'short' }) : '—'}</b><span>last worn</span></div>
          <div><b>${store.all('outfits').filter((o) => Object.values(o.items).flat().includes(item.id)).length}</b><span>outfits</span></div>
        </div>
        <div class="ed-matches"><div class="eyebrow">Pairs best with</div><div class="match-row" data-matches></div></div>` : ''}
      </div>
      <div class="ed-fields">
        <label class="field"><span>Name</span><input name="iname" placeholder="e.g. Navy zip hoodie"></label>
        <div class="field"><span>Category</span><div class="chips" data-cats>${CATEGORIES.map((c) => chip(c.label, { value: c.id, name: 'cat', active: c.id === draft.category })).join('')}</div></div>
        <div class="grid2">
          <label class="field"><span>Type</span><select name="subtype"></select></label>
          <label class="field"><span>Brand</span><input name="brand" placeholder="Optional"></label>
        </div>
        <div class="field"><span>Colours</span><div class="colors-edit" data-colors></div></div>
        <div class="field"><span>Styles</span><div class="chips">${STYLES.map((s) => chip(s.label, { value: s.id, name: 'styles', active: draft.styles.includes(s.id) })).join('')}</div></div>
        <div class="field"><span>Seasons</span><div class="chips">${SEASONS.map((s) => chip(cap(s), { value: s, name: 'seasons', active: draft.seasons.includes(s) })).join('')}</div></div>
        <div class="grid2">
          <label class="field"><span>Fit</span><select name="fit">${FITS.map((f) => `<option value="${f}">${cap(f)}</option>`).join('')}</select></label>
          <label class="field"><span>Pattern</span><select name="pattern">${PATTERNS.map((f) => `<option value="${f}">${cap(f)}</option>`).join('')}</select></label>
        </div>
        <div class="grid2">
          <label class="field"><span>Warmth <output data-out="warmth"></output></span><input type="range" name="warmth" min="0" max="5" step="0.5"></label>
          <label class="field"><span>Formality <output data-out="formality"></output></span><input type="range" name="formality" min="1" max="5" step="0.5"></label>
        </div>
        <div class="grid2">
          <label class="field"><span>Size</span><input name="size" placeholder="Optional"></label>
          <label class="field"><span>Price</span><input name="price" type="number" min="0" step="0.01" placeholder="Optional"></label>
        </div>
        <label class="field"><span>Tags</span><input name="tags" placeholder="comma separated, e.g. vintage, gift"></label>
        <label class="field"><span>Notes</span><textarea name="notes" rows="2" placeholder="Care notes, where it's from…"></textarea></label>
        <div class="field"><span>Availability</span><div class="chips">${STATUSES.map((s) => chip(s.label, { value: s.id, name: 'status', active: (draft.status || 'available') === s.id })).join('')}</div></div>
        <label class="switch-row"><input type="checkbox" name="favorite"><span class="switch"></span><span>Favourite piece</span></label>
      </div>
      <footer class="ed-foot">
        ${!isNew ? `<button type="button" class="btn ghost danger-text" data-del>${icon('trash', 16)} Delete</button>
                    <button type="button" class="btn ghost" data-outfit>${icon('sparkles', 16)} Outfit with this</button>` : ''}
        <span class="grow"></span>
        ${queue ? `<span class="muted small">${queue}</span>` : ''}
        <button type="submit" class="btn primary">${icon('check', 16)} ${isNew ? 'Add to wardrobe' : 'Save'}</button>
      </footer>
    </form>`,
    onMount(b, close) {
      const f = b.querySelector('form');
      const img = b.querySelector('[data-img]');
      const setImg = () => (img.src = draft.image);
      setImg();
      f.iname.value = draft.name || '';
      f.brand.value = draft.brand || '';
      f.fit.value = draft.fit || 'regular';
      f.pattern.value = draft.pattern || 'solid';
      f.warmth.value = draft.warmth ?? itemWarmth(draft);
      f.formality.value = draft.formality ?? itemFormality(draft);
      f.size.value = draft.size || '';
      f.price.value = draft.price ?? '';
      f.tags.value = (draft.tags || []).filter((t) => t !== 'demo').join(', ');
      f.notes.value = draft.notes || '';
      f.favorite.checked = !!draft.favorite;
      const outs = () => b.querySelectorAll('[data-out]').forEach((o) => (o.textContent = f[o.dataset.out].value));
      outs();
      f.addEventListener('input', outs);

      const fillSub = () => {
        const subs = CAT[draft.category].subtypes;
        f.subtype.innerHTML = subs.map((s) => `<option value="${s}">${cap(s)}</option>`).join('');
        f.subtype.value = subs.includes(draft.subtype) ? draft.subtype : subs[0];
        draft.subtype = f.subtype.value;
      };
      fillSub();
      bindChips(b, 'cat', {
        onChange: (v) => {
          draft.category = v;
          fillSub();
          const hex = draft.colors[0]?.hex;
          draft.styles = guessStyles(v, draft.subtype, draft.pattern, hex);
          b.querySelectorAll('.chip[data-name=styles]').forEach((c) => c.classList.toggle('on', draft.styles.includes(c.dataset.value)));
          f.warmth.value = itemWarmth({ category: v, subtype: draft.subtype });
          f.formality.value = itemFormality({ category: v, subtype: draft.subtype });
          outs();
          if (draft.illustrated) { draft.image = garmentDataURL(v, hex, draft.subtype); setImg(); }
        },
      });
      f.subtype.onchange = () => {
        draft.subtype = f.subtype.value;
        f.fit.value = guessFit(draft.category, draft.subtype);
        f.warmth.value = itemWarmth({ category: draft.category, subtype: draft.subtype });
        f.formality.value = itemFormality({ category: draft.category, subtype: draft.subtype });
        outs();
        if (draft.illustrated) { draft.image = garmentDataURL(draft.category, draft.colors[0]?.hex, draft.subtype); setImg(); }
      };
      bindChips(b, 'styles', { multi: true });
      bindChips(b, 'seasons', { multi: true });
      bindChips(b, 'status');

      const colorsEl = b.querySelector('[data-colors]');
      const drawColors = () => {
        colorsEl.innerHTML = draft.colors.map((c, i) => `
          <span class="color-pill">${swatch(c.hex, 18)}<span>${esc(c.name)}${i === 0 ? ' <em>main</em>' : ''}</span>
            ${i > 0 ? `<button type="button" class="mini" data-main="${i}" title="Make main colour">${icon('star', 13)}</button>` : ''}
            ${draft.colors.length > 1 ? `<button type="button" class="mini" data-rm="${i}" aria-label="Remove colour">${icon('x', 13)}</button>` : ''}</span>`).join('') +
          `<label class="color-add" title="Add colour">${icon('plus', 15)}<input type="color" value="#888888"></label>
           <select class="color-named" aria-label="Add a named colour"><option value="">Pick by name…</option>${NAMED_COLORS.map((c) => `<option value="${c.hex}">${c.name}</option>`).join('')}</select>`;
      };
      drawColors();
      const addColor = (hex) => {
        draft.colors.push({ hex, name: nameColor(hex), pct: 0 });
        drawColors();
      };
      colorsEl.addEventListener('click', (e) => {
        const rm = e.target.closest('[data-rm]'), mn = e.target.closest('[data-main]');
        if (rm) { draft.colors.splice(+rm.dataset.rm, 1); drawColors(); }
        if (mn) {
          const [c] = draft.colors.splice(+mn.dataset.main, 1);
          draft.colors.unshift(c);
          drawColors();
          if (draft.illustrated) { draft.image = garmentDataURL(draft.category, c.hex, draft.subtype); setImg(); }
        }
      });
      colorsEl.addEventListener('change', (e) => {
        if (e.target.type === 'color') addColor(e.target.value);
        if (e.target.classList.contains('color-named') && e.target.value) {
          if (draft.illustrated && draft.colors.length === 1) {
            draft.colors = [{ hex: e.target.value, name: nameColor(e.target.value), pct: 100 }];
            draft.image = garmentDataURL(draft.category, e.target.value, draft.subtype); setImg(); drawColors();
          } else addColor(e.target.value);
        }
      });

      b.querySelector('[data-file]').onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        img.classList.add('busy');
        try {
          const it = await itemFromFile(file);
          draft = { ...draft, image: it.image, colors: it.colors, illustrated: false, analysis: it.analysis };
          setImg(); drawColors();
          toast('Photo analysed — colours updated');
        } catch (err) { toast(err.message); }
        img.classList.remove('busy');
      };
      b.querySelector('[data-illustrate]').onclick = () => {
        draft.illustrated = true;
        draft.image = garmentDataURL(draft.category, draft.colors[0]?.hex || '#888', draft.subtype);
        setImg();
      };

      const matches = b.querySelector('[data-matches]');
      if (matches) {
        const bp = bestPartners(item, store.all('items'), {}, 4);
        matches.innerHTML = bp.map((p) => `<a href="#/item/${esc(p.item.id)}" data-open="${esc(p.item.id)}" class="match"><img src="${esc(p.item.image)}" alt=""><span>${esc(p.item.name)}</span></a>`).join('') || '<span class="muted small">Add more items to see matches.</span>';
        matches.addEventListener('click', (e) => {
          const a = e.target.closest('[data-open]');
          if (!a) return;
          e.preventDefault();
          close();
          openItemEditor(store.get('items', a.dataset.open));
        });
      }

      b.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (await confirmDialog(`Delete "${draft.name || 'this item'}" from your wardrobe?`, { ok: 'Delete', danger: true })) {
          await store.remove('items', draft.id);
          toast('Item deleted');
          close('deleted');
        }
      });
      b.querySelector('[data-outfit]')?.addEventListener('click', () => { close(); navigate('create', { item: draft.id }); });

      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const styles = chipValues(b, 'styles', true);
        const seasons = chipValues(b, 'seasons', true);
        const out = {
          ...draft,
          name: f.iname.value.trim() || `${draft.colors[0]?.name || ''} ${CAT[draft.category].label.toLowerCase()}`.trim(),
          brand: f.brand.value.trim(),
          category: chipValues(b, 'cat') || draft.category,
          subtype: f.subtype.value,
          styles: styles.length ? styles : guessStyles(draft.category, f.subtype.value, f.pattern.value, draft.colors[0]?.hex),
          seasons,
          fit: f.fit.value, pattern: f.pattern.value,
          warmth: +f.warmth.value, formality: +f.formality.value,
          size: f.size.value.trim(), price: f.price.value === '' ? null : +f.price.value,
          tags: f.tags.value.split(',').map((t) => t.trim()).filter(Boolean),
          notes: f.notes.value.trim(),
          status: chipValues(b, 'status') || 'available',
          favorite: f.favorite.checked,
        };
        delete out.analysis;
        await store.put('items', out);
        toast(isNew ? 'Added to your wardrobe' : 'Saved');
        close(out);
      });
    },
  }).result;
}
