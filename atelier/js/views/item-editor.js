// Add / edit a clothing item (with AI-detected suggestions) + item detail stats.
import { store, wearCounts, lastWorn } from '../store.js';
import { CATEGORIES, CAT, STYLES, SEASONS, PATTERNS, FITS, STATUSES, SEASON_LABEL, PATTERN_LABEL, FIT_LABEL, subLabel } from '../constants.js';
import { guessStyles, guessFit, guessSeasons, itemWarmth, itemFormality, bestPartners } from '../engine.js';
import { garmentDataURL } from '../garments.js';
import { analyzeImage, fileToDataURL } from '../analyzer.js';
import { nameColor, NAMED_COLORS, colorLabel } from '../color.js';
import { icon } from '../icons.js';
import { esc, uid, fmtDate } from '../util.js';
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
    title: isNew ? 'Nueva prenda' : 'Editar prenda',
    wide: true,
    className: 'editor-sheet',
    body: `<form class="editor" novalidate>
      <div class="ed-media">
        <div class="ed-img checker"><img alt="" data-img></div>
        <div class="row gap-s wrap center">
          <label class="btn soft sm">${icon('image', 15)} Cambiar foto<input type="file" accept="image/*" hidden data-file></label>
          <button type="button" class="btn soft sm" data-illustrate>${icon('wand', 15)} Usar ilustración</button>
        </div>
        ${draft.analysis ? `<div class="ai-note">${icon('sparkles', 15)} <span>Detectado automáticamente: <b>${esc(CAT[draft.category].label)}</b> (${Math.round(draft.analysis.confidence * 100)} % según ${esc(draft.analysis.source)})${draft.analysis.bgRemoved ? ', fondo eliminado' : ''}. Revisa los datos de abajo.</span></div>` : ''}
        ${!isNew ? `<div class="ed-stats">
          <div><b>${wc}</b><span>veces puesta</span></div>
          <div><b>${lw ? fmtDate(lw, { day: 'numeric', month: 'short' }) : '—'}</b><span>última vez</span></div>
          <div><b>${store.all('outfits').filter((o) => Object.values(o.items).flat().includes(item.id)).length}</b><span>outfits</span></div>
        </div>
        <div class="ed-matches"><div class="eyebrow">Combina mejor con</div><div class="match-row" data-matches></div></div>` : ''}
      </div>
      <div class="ed-fields">
        <label class="field"><span>Nombre</span><input name="iname" placeholder="p. ej. Sudadera azul marino con cremallera"></label>
        <div class="field"><span>Categoría</span><div class="chips" data-cats>${CATEGORIES.map((c) => chip(c.label, { value: c.id, name: 'cat', active: c.id === draft.category })).join('')}</div></div>
        <div class="grid2">
          <label class="field"><span>Tipo</span><select name="subtype"></select></label>
          <label class="field"><span>Marca</span><input name="brand" placeholder="Opcional"></label>
        </div>
        <div class="field"><span>Colores</span><div class="colors-edit" data-colors></div></div>
        <div class="field"><span>Estilos</span><div class="chips">${STYLES.map((s) => chip(s.label, { value: s.id, name: 'styles', active: draft.styles.includes(s.id) })).join('')}</div></div>
        <div class="field"><span>Temporadas</span><div class="chips">${SEASONS.map((s) => chip(SEASON_LABEL[s], { value: s, name: 'seasons', active: draft.seasons.includes(s) })).join('')}</div></div>
        <div class="grid2">
          <label class="field"><span>Corte</span><select name="fit">${FITS.map((f) => `<option value="${f}">${FIT_LABEL[f]}</option>`).join('')}</select></label>
          <label class="field"><span>Estampado</span><select name="pattern">${PATTERNS.map((f) => `<option value="${f}">${PATTERN_LABEL[f]}</option>`).join('')}</select></label>
        </div>
        <div class="grid2">
          <label class="field"><span>Abrigo <output data-out="warmth"></output></span><input type="range" name="warmth" min="0" max="5" step="0.5"></label>
          <label class="field"><span>Formalidad <output data-out="formality"></output></span><input type="range" name="formality" min="1" max="5" step="0.5"></label>
        </div>
        <div class="grid2">
          <label class="field"><span>Talla</span><input name="size" placeholder="Opcional"></label>
          <label class="field"><span>Precio</span><input name="price" type="number" min="0" step="0.01" placeholder="Opcional"></label>
        </div>
        <label class="field"><span>Etiquetas</span><input name="tags" placeholder="separadas por comas, p. ej. vintage, regalo"></label>
        <label class="field"><span>Notas</span><textarea name="notes" rows="2" placeholder="Cuidados, de dónde es…"></textarea></label>
        <div class="field"><span>Disponibilidad</span><div class="chips">${STATUSES.map((s) => chip(s.label, { value: s.id, name: 'status', active: (draft.status || 'available') === s.id })).join('')}</div></div>
        <label class="switch-row"><input type="checkbox" name="favorite"><span class="switch"></span><span>Prenda favorita</span></label>
      </div>
      <footer class="ed-foot">
        ${!isNew ? `<button type="button" class="btn ghost danger-text" data-del>${icon('trash', 16)} Eliminar</button>
                    <button type="button" class="btn ghost" data-outfit>${icon('sparkles', 16)} Crear outfit con ella</button>` : ''}
        <span class="grow"></span>
        ${queue ? `<span class="muted small">${queue}</span>` : ''}
        <button type="submit" class="btn primary">${icon('check', 16)} ${isNew ? 'Añadir al armario' : 'Guardar'}</button>
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
        f.subtype.innerHTML = subs.map((s) => `<option value="${s}">${subLabel(s)}</option>`).join('');
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
          <span class="color-pill">${swatch(c.hex, 18)}<span>${esc(colorLabel(c.name))}${i === 0 ? ' <em>principal</em>' : ''}</span>
            ${i > 0 ? `<button type="button" class="mini" data-main="${i}" title="Hacer color principal">${icon('star', 13)}</button>` : ''}
            ${draft.colors.length > 1 ? `<button type="button" class="mini" data-rm="${i}" aria-label="Quitar color">${icon('x', 13)}</button>` : ''}</span>`).join('') +
          `<label class="color-add" title="Añadir color">${icon('plus', 15)}<input type="color" value="#888888"></label>
           <select class="color-named" aria-label="Añadir un color por nombre"><option value="">Elegir por nombre…</option>${NAMED_COLORS.map((c) => `<option value="${c.hex}">${colorLabel(c.name)}</option>`).join('')}</select>`;
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
          toast('Foto analizada: colores actualizados');
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
        matches.innerHTML = bp.map((p) => `<a href="#/item/${esc(p.item.id)}" data-open="${esc(p.item.id)}" class="match"><img src="${esc(p.item.image)}" alt=""><span>${esc(p.item.name)}</span></a>`).join('') || '<span class="muted small">Añade más prendas para ver combinaciones.</span>';
        matches.addEventListener('click', (e) => {
          const a = e.target.closest('[data-open]');
          if (!a) return;
          e.preventDefault();
          close();
          openItemEditor(store.get('items', a.dataset.open));
        });
      }

      b.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (await confirmDialog(`¿Eliminar «${draft.name || 'esta prenda'}» de tu armario?`, { ok: 'Eliminar', danger: true })) {
          await store.remove('items', draft.id);
          toast('Prenda eliminada');
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
          name: f.iname.value.trim() || `${CAT[draft.category].label} ${colorLabel(draft.colors[0]?.name).toLowerCase()}`.trim(),
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
        toast(isNew ? 'Añadida a tu armario' : 'Guardado');
        close(out);
      });
    },
  }).result;
}
