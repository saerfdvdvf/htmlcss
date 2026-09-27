// Laundry / availability board.
import { store } from '../store.js';
import { STATUSES, CAT } from '../constants.js';
import { icon } from '../icons.js';
import { esc } from '../util.js';
import { empty, toast, swatch } from '../ui.js';

const ICON = { available: 'check', laundry: 'laundry', unavailable: 'x' };
const HELP = {
  available: 'Listas para ponerse: se usan al generar outfits.',
  laundry: 'Lavándose: no se usan hasta que las marques como limpias.',
  unavailable: 'Prestadas, en el arreglo o guardadas: no se usan.',
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
          <div><div class="eyebrow">Disponibilidad</div><h1 class="display">Lavandería</h1><p class="muted">Las prendas que se están lavando o no están disponibles nunca aparecen en los outfits generados.</p></div>
          ${by.laundry.length ? `<button class="btn primary" data-all-clean>${icon('check', 18)} Colada terminada: todo limpio</button>` : ''}
        </header>
        <div class="seg three" role="tablist">${STATUSES.map((s) => `<button role="tab" class="${tab === s.id ? 'on' : ''}" data-tab="${s.id}" aria-selected="${tab === s.id}">${icon(ICON[s.id], 16)} ${s.id === 'laundry' ? 'Lavando' : s.label} <span class="count">${by[s.id].length}</span></button>`).join('')}</div>
        <p class="muted small">${HELP[tab]}</p>
        <div class="laundry-list">${list.map((i) => `
          <div class="l-row" data-id="${esc(i.id)}">
            <img src="${esc(i.image)}" alt="">
            <div class="l-text"><b>${esc(i.name)}</b><span class="muted small">${swatch(i.colors?.[0]?.hex || '#888', 9)} ${esc(CAT[i.category].label)}</span></div>
            <div class="l-actions">${STATUSES.filter((s) => s.id !== tab).map((s) => `<button class="btn soft sm" data-set="${s.id}">${icon(ICON[s.id], 14)} <span>${s.id === 'available' ? 'Disponible' : s.id === 'laundry' ? 'A lavar' : 'No disponible'}</span></button>`).join('')}</div>
          </div>`).join('') || empty(ICON[tab], tab === 'laundry' ? 'El cesto de la ropa está vacío' : tab === 'available' ? 'No hay nada disponible' : 'No hay nada no disponible', tab === 'laundry' ? 'Después de ponerte un outfit, manda sus prendas aquí con un toque.' : '')}</div>`;
    };
    draw();
    el.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-tab]');
      if (t) { tab = t.dataset.tab; return draw(); }
      if (e.target.closest('[data-all-clean]')) {
        const l = store.all('items').filter((i) => i.status === 'laundry');
        await store.putMany('items', l.map((i) => ({ ...i, status: 'available' })));
        return toast(l.length > 1 ? `${l.length} prendas vuelven a estar disponibles` : '1 prenda vuelve a estar disponible');
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
