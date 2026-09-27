// Single outfit view (from favourites, history or calendar).
import { store } from '../store.js';
import { buildCtx } from '../context.js';
import { mountStudio } from '../studio.js';
import { icon } from '../icons.js';
import { fmtDate, todayISO } from '../util.js';
import { empty, confirmDialog, toast } from '../ui.js';
import { navigate } from '../router.js';

export default {
  render(el, params) {
    const o = store.get('outfits', params.id);
    if (!o) {
      el.innerHTML = `<div class="card">${empty('heart', 'Outfit not found', 'It may have been removed from your history.', '<a class="btn primary" href="#/favorites">Back to favourites</a>')}</div>`;
      return;
    }
    const ctx = buildCtx({ style: o.style || 'any', occasion: o.occasion, weather: o.weather ? { ...o.weather } : undefined });
    el.innerHTML = `
      <header class="page-head">
        <div><button class="back" onclick="history.back()">${icon('left', 18)} Back</button>
          <h1 class="display">${o.favorite ? 'Favourite outfit' : 'Outfit'}</h1>
          <p class="muted">Created ${fmtDate(todayISO(new Date(o.createdAt)), { day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
        <button class="btn ghost danger-text" data-del>${icon('trash', 16)} Delete</button>
      </header>
      <div data-studio></div>`;
    mountStudio(el.querySelector('[data-studio]'), o, ctx, { source: 'edit', onChange: (n) => history.replaceState(null, '', `#/outfit?id=${n.id}`) });
    el.querySelector('[data-del]').onclick = async () => {
      if (!(await confirmDialog('Delete this outfit from your history?', { ok: 'Delete', danger: true }))) return;
      const id = new URLSearchParams(location.hash.split('?')[1]).get('id');
      await store.remove('outfits', id);
      toast('Outfit deleted');
      navigate('favorites');
    };
  },
};
