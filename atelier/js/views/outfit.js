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
      el.innerHTML = `<div class="card">${empty('heart', 'No se ha encontrado el outfit', 'Puede que se haya eliminado de tu historial.', '<a class="btn primary" href="#/favorites">Volver a favoritos</a>')}</div>`;
      return;
    }
    const ctx = buildCtx({ style: o.style || 'any', occasion: o.occasion, weather: o.weather ? { ...o.weather } : undefined });
    el.innerHTML = `
      <header class="page-head">
        <div><button class="back" onclick="history.back()">${icon('left', 18)} Atrás</button>
          <h1 class="display">${o.favorite ? 'Outfit favorito' : 'Outfit'}</h1>
          <p class="muted">Creado el ${fmtDate(todayISO(new Date(o.createdAt)), { day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
        <button class="btn ghost danger-text" data-del>${icon('trash', 16)} Eliminar</button>
      </header>
      <div data-studio></div>`;
    mountStudio(el.querySelector('[data-studio]'), o, ctx, { source: 'edit', onChange: (n) => history.replaceState(null, '', `#/outfit?id=${n.id}`) });
    el.querySelector('[data-del]').onclick = async () => {
      if (!(await confirmDialog('¿Eliminar este outfit de tu historial?', { ok: 'Eliminar', danger: true }))) return;
      const id = new URLSearchParams(location.hash.split('?')[1]).get('id');
      await store.remove('outfits', id);
      toast('Outfit eliminado');
      navigate('favorites');
    };
  },
};
