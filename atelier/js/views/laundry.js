// Laundry / availability board.
import { store } from '../store.js';
import { STATUSES, CAT } from '../constants.js';
import { icon } from '../icons.js';
import { esc } from '../util.js';
import { empty, toast, swatch } from '../ui.js';

const ICON = { available: 'check', laundry: 'laundry', unavailable: 'x' };
const HELP = {
  available: 'Ready to wear — used when generating outfits.',
  laundry: 'In the wash — skipped until you mark them clean.',
  unavailable: 'Lent out, at the tailor or packed away — skipped.',
};

export default {
  render(el) {
    let tab = 'laundry';
    const draw = () => {
      const items = store.all('items');
      const by = Object.fromEntries(STATUSES.map((s) => [s.id, items.filter((i) => (i.status || 'available') === s.id)]));
      const list = by[tab];
      el.innerHTML = `
        <header class="page-head">
          <div><div class="eyebrow">Availability</div><h1 class="display">Laundry</h1><p class="muted">Items in the laundry or unavailable never appear in generated outfits.</p></div>
          ${by.laundry.length ? `<button class="btn primary" data-all-clean>${icon('check', 18)} Laundry done — all clean</button>` : ''}
        </header>
        <div class="seg three" role="tablist">${STATUSES.map((s) => `<button role="tab" class="${tab === s.id ? 'on' : ''}" data-tab="${s.id}" aria-selected="${tab === s.id}">${icon(ICON[s.id], 16)} ${s.label.replace('In the laundry', 'Laundry')} <span class="count">${by[s.id].length}</span></button>`).join('')}</div>
        <p class="muted small">${HELP[tab]}</p>
        <div class="laundry-list">${list.map((i) => `
          <div class="l-row" data-id="${esc(i.id)}">
            <img src="${esc(i.image)}" alt="">
            <div class="l-text"><b>${esc(i.name)}</b><span class="muted small">${swatch(i.colors?.[0]?.hex || '#888', 9)} ${esc(CAT[i.category].label)}</span></div>
            <div class="l-actions">${STATUSES.filter((s) => s.id !== tab).map((s) => `<button class="btn soft sm" data-set="${s.id}">${icon(ICON[s.id], 14)} <span>${s.id === 'available' ? 'Available' : s.id === 'laundry' ? 'To laundry' : 'Unavailable'}</span></button>`).join('')}</div>
          </div>`).join('') || empty(ICON[tab], tab === 'laundry' ? 'Laundry basket is empty' : tab === 'available' ? 'Nothing available' : 'Nothing unavailable', tab === 'laundry' ? 'After wearing an outfit, send its pieces here in one tap.' : '')}</div>`;
    };
    draw();
    el.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-tab]');
      if (t) { tab = t.dataset.tab; return draw(); }
      if (e.target.closest('[data-all-clean]')) {
        const l = store.all('items').filter((i) => i.status === 'laundry');
        await store.putMany('items', l.map((i) => ({ ...i, status: 'available' })));
        return toast(`${l.length} item${l.length > 1 ? 's' : ''} back in rotation`);
      }
      const s = e.target.closest('[data-set]');
      if (s) {
        const id = s.closest('[data-id]').dataset.id;
        await store.patch('items', id, { status: s.dataset.set });
      }
    });
    return store.on((c) => c.has('items') && draw());
  },
};
