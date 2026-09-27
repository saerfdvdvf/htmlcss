// Preview on me: place an outfit on the user's own photo.
// Quick mode composites garment cut-outs over the untouched photo (with optional pose-based auto-fit);
// AI mode sends photo + garments to a configurable virtual try-on endpoint.
import { store, outfitItemIds } from '../store.js';
import { CAT } from '../constants.js';
import { icon } from '../icons.js';
import { esc, todayISO } from '../util.js';
import { openSheet, outfitCard, toast, empty, confirmDialog } from '../ui.js';
import { compress, fileToDataURL, loadImage } from '../analyzer.js';
import { navigate, setHash } from '../router.js';

const Z = { trousers: 1, sneakers: 2, tshirt: 3, hoodie: 4, accessory: 5 };
const ACC_POS = {
  cap: { x: 0.5, y: 0.02, w: 0.2 }, beanie: { x: 0.5, y: 0.02, w: 0.2 }, sunglasses: { x: 0.5, y: 0.085, w: 0.13 },
  chain: { x: 0.5, y: 0.19, w: 0.14 }, scarf: { x: 0.5, y: 0.15, w: 0.26 }, watch: { x: 0.29, y: 0.5, w: 0.06 },
  bracelet: { x: 0.71, y: 0.5, w: 0.06 }, ring: { x: 0.7, y: 0.53, w: 0.04 }, belt: { x: 0.5, y: 0.46, w: 0.28 }, bag: { x: 0.74, y: 0.44, w: 0.2 },
};
const defaultPos = (it, layered) => {
  switch (it.category) {
    case 'hoodie': return { x: 0.5, y: 0.15, w: 0.5 };
    case 'tshirt': return { x: 0.5, y: layered ? 0.17 : 0.16, w: 0.46 };
    case 'trousers': return { x: 0.5, y: 0.44, w: 0.3 };
    case 'sneakers': return { x: 0.5, y: 0.87, w: 0.3 };
    default: return ACC_POS[it.subtype] || { x: 0.7, y: 0.4, w: 0.12 };
  }
};

let poseP = null;
const loadScript = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
function loadPose() {
  if (poseP) return poseP;
  poseP = (async () => {
    if (!globalThis.tf) await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
    if (!globalThis.poseDetection) await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js');
    return globalThis.poseDetection.createDetector(globalThis.poseDetection.SupportedModels.MoveNet, { modelType: globalThis.poseDetection.movenet.modelType.SINGLEPOSE_THUNDER });
  })().catch((e) => { poseP = null; throw e; });
  return poseP;
}

export default {
  render(el, params) {
    const s = store.settings;
    if (!s.tryOn) {
      el.innerHTML = `<header class="page-head"><div><div class="eyebrow">Probador virtual</div><h1 class="display">Pruébatelo</h1></div></header>
        <div class="card">${empty('user', 'La vista previa está desactivada', 'Actívala para ver los outfits sobre tu propia foto. Tu foto se queda en este dispositivo.', `<button class="btn primary" data-enable>${icon('check', 18)} Activar vista previa</button>`)}</div>`;
      el.querySelector('[data-enable]').onclick = () => store.setSettings({ tryOn: true }).then(() => navigate('preview', params, { replace: true }));
      return;
    }
    let photo = store.getMeta('photo');
    let outfitId = params.outfit || store.get('plans', todayISO())?.outfitId || null;
    let layers = [];
    let sel = null;
    let aiResult = null;
    let showOriginal = false;

    const buildLayers = () => {
      const o = outfitId && store.get('outfits', outfitId);
      if (!o) { layers = []; return; }
      const layered = !!(o.items.hoodie && o.items.tshirt);
      layers = outfitItemIds(o.items).map((id) => store.get('items', id)).filter(Boolean).map((it) => ({
        id: it.id, item: it, ...defaultPos(it, layered), rot: 0, opacity: 1, hidden: it.category === 'tshirt' && layered,
        z: Z[it.category],
      }));
    };
    buildLayers();

    const draw = () => {
      const o = outfitId && store.get('outfits', outfitId);
      el.innerHTML = `
        <header class="page-head"><div><div class="eyebrow">Probador virtual</div><h1 class="display">Pruébatelo</h1>
          <p class="muted">Mira cómo te queda un look. Tu foto original nunca se modifica.</p></div>
          ${photo ? `<div class="row gap-s"><label class="btn ghost">${icon('camera', 16)} Nueva foto<input type="file" accept="image/*" hidden data-photo></label><button class="btn ghost danger-text" data-rmphoto aria-label="Eliminar foto">${icon('trash', 16)}</button></div>` : ''}
        </header>
        ${!photo ? `
          <div class="card photo-drop">
            ${icon('user', 40)}
            <h3>Añade una foto tuya de cuerpo entero</h3>
            <p class="muted">De pie, mirando a la cámara, con los brazos un poco separados del cuerpo y buena luz. Solo se guarda en este dispositivo y nunca se sincroniza.</p>
            <div class="row gap center wrap"><label class="btn primary">${icon('camera', 18)} Hacer foto<input type="file" accept="image/*" capture="user" hidden data-photo></label>
            <label class="btn ghost">${icon('upload', 18)} Subir<input type="file" accept="image/*" hidden data-photo></label></div>
          </div>` : `
        <div class="tryon-layout">
          <div class="card tryon-card">
            <div class="tryon-stage ${showOriginal ? 'original' : ''}" data-stage>
              <img class="tryon-photo" src="${esc(aiResult || photo)}" alt="Tu foto" draggable="false">
              ${aiResult ? '' : layers.filter((l) => !l.hidden).sort((a, b) => a.z - b.z).map((l) => `
                <div class="layer ${sel === l.id ? 'sel' : ''}" data-layer="${esc(l.id)}" style="left:${l.x * 100}%;top:${l.y * 100}%;width:${l.w * 100}%;opacity:${l.opacity};transform:translateX(-50%) rotate(${l.rot}deg);z-index:${l.z}">
                  <img src="${esc(l.item.image)}" alt="${esc(l.item.name)}" draggable="false">
                  ${sel === l.id ? '<span class="handle" data-handle></span>' : ''}
                </div>`).join('')}
            </div>
            <div class="row gap-s wrap tryon-tools">
              <button class="btn soft sm" data-hold>${icon('eye', 15)} Mantén para comparar</button>
              <button class="btn soft sm" data-autofit>${icon('wand', 15)} Ajustar al cuerpo</button>
              <button class="btn soft sm" data-reset>${icon('refresh', 15)} Restablecer</button>
              <button class="btn soft sm" data-export>${icon('download', 15)} Guardar imagen</button>
              ${aiResult ? `<button class="btn soft sm" data-clear-ai>${icon('layers', 15)} Volver a la vista rápida</button>` : ''}
            </div>
          </div>
          <aside class="tryon-side">
            <div class="card">
              <div class="section-head"><h3>Outfit</h3><button class="btn ghost sm" data-choose>${icon('refresh', 14)} Elegir</button></div>
              ${o ? `<div class="layer-list">${layers.map((l) => `
                <div class="ll-row ${sel === l.id ? 'sel' : ''}" data-pick="${esc(l.id)}">
                  <img src="${esc(l.item.image)}" alt=""><span>${esc(l.item.name)}<small class="muted"> ${esc(CAT[l.item.category].label)}</small></span>
                  <button class="icon-btn" data-toggle="${esc(l.id)}" aria-label="${l.hidden ? 'Mostrar' : 'Ocultar'}">${icon(l.hidden ? 'plus' : 'eye', 16)}</button>
                </div>`).join('')}</div>` : `<p class="muted">Elige un outfit para probártelo.</p><button class="btn primary block" data-choose>${icon('sparkles', 16)} Elegir outfit</button>`}
            </div>
            ${sel ? (() => { const l = layers.find((x) => x.id === sel); return `<div class="card layer-ctl">
              <h3>${esc(l.item.name)}</h3>
              <label class="field"><span>Tamaño</span><input type="range" min="0.03" max="1.2" step="0.005" value="${l.w}" data-ctl="w"></label>
              <label class="field"><span>Rotación</span><input type="range" min="-30" max="30" step="0.5" value="${l.rot}" data-ctl="rot"></label>
              <label class="field"><span>Opacidad</span><input type="range" min="0.3" max="1" step="0.05" value="${l.opacity}" data-ctl="opacity"></label>
              <div class="row gap-s"><button class="btn soft sm" data-z="1">Traer adelante</button><button class="btn soft sm" data-z="-1">Enviar atrás</button></div>
              <p class="muted small">Arrastra la prenda sobre la foto para moverla; arrastra la esquina para cambiar el tamaño.</p></div>`; })() : ''}
            <div class="card ai-card">
              <h3>${icon('sparkles', 18)} Render fotorrealista</h3>
              ${store.getMeta('tryonEndpoint') ? `<p class="muted small">Envía tu foto y el outfit al servicio de prueba virtual con IA que hayas configurado, que vuelve a dibujar la ropa sobre ti manteniendo tu cara, tu cuerpo y el fondo.</p>
                <button class="btn primary block" data-ai ${o ? '' : 'disabled'}>${icon('wand', 16)} Generar con IA</button>`
              : `<p class="muted small">Conecta un servicio de prueba virtual con IA (por ejemplo, un endpoint de IDM-VTON) en <a href="#/settings?tab=preview">Ajustes → Pruébatelo</a> para obtener resultados fotorrealistas. La vista rápida funciona sin él.</p>`}
            </div>
          </aside>
        </div>`}`;
    };
    draw();

    const setPhoto = async (file) => {
      if (!file) return;
      const src = await compress(await fileToDataURL(file), 1400, 0.88);
      photo = src; aiResult = null;
      await store.setMeta('photo', src);
      buildLayers(); draw();
      autofit(true);
    };

    async function autofit(silent = false) {
      const img = el.querySelector('.tryon-photo');
      if (!img || !layers.length) return;
      try {
        if (!silent) toast('Detectando tu postura…');
        const det = await Promise.race([loadPose(), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 15000))]);
        const im = await loadImage(photo);
        const [pose] = await det.estimatePoses(im);
        const k = Object.fromEntries((pose?.keypoints || []).filter((p) => p.score > 0.3).map((p) => [p.name, p]));
        if (!k.left_shoulder || !k.right_shoulder || !k.left_hip || !k.right_hip) throw new Error('pose');
        const W = im.naturalWidth, H = im.naturalHeight;
        const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        const sh = mid(k.left_shoulder, k.right_shoulder), hp = mid(k.left_hip, k.right_hip);
        const shW = Math.abs(k.left_shoulder.x - k.right_shoulder.x), hpW = Math.abs(k.left_hip.x - k.right_hip.x);
        const ank = k.left_ankle && k.right_ankle ? mid(k.left_ankle, k.right_ankle) : { x: hp.x, y: hp.y + (hp.y - sh.y) * 1.6 };
        for (const l of layers) {
          const aspect = await loadImage(l.item.image).then((i) => i.naturalWidth / i.naturalHeight).catch(() => 1);
          if (l.item.category === 'hoodie' || l.item.category === 'tshirt') {
            const w = shW * (l.item.category === 'hoodie' ? 2.35 : 2.1);
            Object.assign(l, { x: sh.x / W, y: (sh.y - shW * 0.28) / H, w: w / W });
          } else if (l.item.category === 'trousers') {
            const h = (ank.y - hp.y) * 1.12 + hpW * 0.3;
            Object.assign(l, { x: hp.x / W, y: (hp.y - hpW * 0.35) / H, w: (h * aspect) / W });
          } else if (l.item.category === 'sneakers') {
            Object.assign(l, { x: ank.x / W, y: (ank.y - hpW * 0.35) / H, w: (hpW * 1.9) / W });
          } else if (['cap', 'beanie', 'sunglasses'].includes(l.item.subtype) && k.nose) {
            const headW = shW * 0.62;
            if (l.item.subtype === 'sunglasses') Object.assign(l, { x: k.nose.x / W, y: (k.nose.y - headW * 0.28) / H, w: (headW * 0.9) / W });
            else Object.assign(l, { x: k.nose.x / W, y: (k.nose.y - headW * 1.25) / H, w: (headW * 1.3) / W });
          } else if (l.item.subtype === 'watch' && k.left_wrist) {
            Object.assign(l, { x: k.left_wrist.x / W, y: (k.left_wrist.y - shW * 0.08) / H, w: (shW * 0.2) / W });
          } else if (l.item.subtype === 'belt') {
            Object.assign(l, { x: hp.x / W, y: (hp.y - hpW * 0.45) / H, w: (hpW * 1.9) / W });
          }
        }
        draw();
        if (!silent) toast('Ajustado a tu postura: afina arrastrando las prendas');
      } catch {
        if (!silent) toast('La detección automática de postura no está disponible aquí: arrastra las prendas para colocarlas.');
      }
    }

    async function exportImage() {
      const im = await loadImage(aiResult || photo);
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext('2d');
      g.drawImage(im, 0, 0);
      if (!aiResult) for (const l of layers.filter((x) => !x.hidden).sort((a, b) => a.z - b.z)) {
        const li = await loadImage(l.item.image);
        const w = l.w * c.width, h = w * (li.naturalHeight / li.naturalWidth);
        g.save();
        g.globalAlpha = l.opacity;
        g.translate(l.x * c.width, l.y * c.height);
        g.rotate((l.rot * Math.PI) / 180);
        g.drawImage(li, -w / 2, 0, w, h);
        g.restore();
      }
      const url = c.toDataURL('image/jpeg', 0.92);
      const a = document.createElement('a');
      a.href = url; a.download = `atelier-pruebatelo-${todayISO()}.jpg`;
      document.body.appendChild(a); a.click(); a.remove();
    }

    async function aiRender() {
      const o = store.get('outfits', outfitId);
      const endpoint = store.getMeta('tryonEndpoint');
      if (!o || !endpoint) return;
      const btn = el.querySelector('[data-ai]');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner sm"></span> Generando… puede tardar un minuto';
      try {
        // Try-on models expect raster images, so illustrated (SVG) pieces are converted to PNG first.
        const toPng = async (src) => {
          if (!src.startsWith('data:image/svg')) return src;
          const im = await loadImage(src);
          const c = document.createElement('canvas');
          c.width = 768; c.height = Math.round(768 * (im.naturalHeight / im.naturalWidth || 1));
          const g = c.getContext('2d');
          g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
          g.drawImage(im, 0, 0, c.width, c.height);
          return c.toDataURL('image/png');
        };
        const garments = await Promise.all(layers.filter((l) => !l.hidden && l.item.category !== 'accessory')
          .map(async (l) => ({ category: l.item.category, name: l.item.name, image: await toPng(l.item.image) })));
        const r = await fetch(endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...(store.getMeta('tryonKey') ? { Authorization: `Bearer ${store.getMeta('tryonKey')}` } : {}) },
          body: JSON.stringify({ person: photo, garments }),
        });
        if (!r.ok) throw new Error(`El servicio ha respondido ${r.status}`);
        const data = await r.json();
        if (!data.image) throw new Error('No se ha recibido ninguna imagen');
        aiResult = data.image;
        draw();
      } catch (e) {
        toast('Ha fallado el render con IA: ' + e.message);
        draw();
      }
    }

    // Pointer interactions: drag to move, handle to resize.
    let drag = null;
    el.addEventListener('pointerdown', (e) => {
      const layerEl = e.target.closest('[data-layer]');
      const stage = el.querySelector('[data-stage]');
      if (!layerEl || !stage) return;
      const l = layers.find((x) => x.id === layerEl.dataset.layer);
      if (sel !== l.id) { sel = l.id; draw(); }
      const rect = el.querySelector('[data-stage]').getBoundingClientRect();
      drag = { l, rect, sx: e.clientX, sy: e.clientY, x0: l.x, y0: l.y, w0: l.w, resize: !!e.target.closest('[data-handle]') };
      e.preventDefault();
    });
    const onMove = (e) => {
      if (!drag) return;
      const dx = (e.clientX - drag.sx) / drag.rect.width, dy = (e.clientY - drag.sy) / drag.rect.height;
      if (drag.resize) drag.l.w = Math.max(0.03, drag.w0 + dx * 2);
      else { drag.l.x = drag.x0 + dx; drag.l.y = drag.y0 + dy; }
      const node = el.querySelector(`[data-layer="${CSS.escape(drag.l.id)}"]`);
      if (node) { node.style.left = drag.l.x * 100 + '%'; node.style.top = drag.l.y * 100 + '%'; node.style.width = drag.l.w * 100 + '%'; }
    };
    const onUp = () => {
      el.querySelector('[data-stage]')?.classList.remove('original');
      if (drag) { drag = null; draw(); }
    };
    addEventListener('pointermove', onMove);
    addEventListener('pointerup', onUp);

    el.addEventListener('input', (e) => {
      const c = e.target.dataset.ctl;
      if (!c || !sel) return;
      const l = layers.find((x) => x.id === sel);
      l[c] = +e.target.value;
      const node = el.querySelector(`[data-layer="${CSS.escape(l.id)}"]`);
      if (node) Object.assign(node.style, { width: l.w * 100 + '%', opacity: l.opacity, transform: `translateX(-50%) rotate(${l.rot}deg)` });
    });
    el.addEventListener('change', (e) => { if (e.target.matches('[data-photo]')) setPhoto(e.target.files[0]); });
    el.addEventListener('click', async (e) => {
      const t = e.target;
      if (t.closest('[data-rmphoto]')) {
        if (!(await confirmDialog('¿Eliminar tu foto de este dispositivo?', { ok: 'Eliminar', danger: true }))) return;
        photo = null; aiResult = null; await store.setMeta('photo', null); return draw();
      }
      if (t.closest('[data-choose]')) {
        const favs = store.all('outfits').filter((o) => o.favorite);
        const rec = store.all('outfits').sort((a, b) => b.createdAt - a.createdAt).slice(0, 12);
        const id = await openSheet({
          title: 'Elige un outfit', wide: true,
          body: `<h4 class="sub-h">Favoritos</h4><div class="grid outfits-grid sm">${favs.map((o) => outfitCard(o, { showDate: false })).join('') || '<p class="muted small">Aún no tienes favoritos.</p>'}</div>
                 <h4 class="sub-h">Recientes</h4><div class="grid outfits-grid sm">${rec.map((o) => outfitCard(o)).join('')}</div>`,
          onMount: (b, close) => b.addEventListener('click', (ev) => { const c = ev.target.closest('[data-outfit]'); if (c && !ev.target.closest('[data-ofav]')) close(c.dataset.outfit); }),
        }).result;
        if (id) { outfitId = id; aiResult = null; sel = null; setHash('preview', { outfit: id }); buildLayers(); draw(); autofit(true); }
        return;
      }
      const pick = t.closest('[data-pick]');
      if (pick && !t.closest('[data-toggle]')) { sel = pick.dataset.pick; return draw(); }
      const tog = t.closest('[data-toggle]');
      if (tog) { const l = layers.find((x) => x.id === tog.dataset.toggle); l.hidden = !l.hidden; return draw(); }
      const z = t.closest('[data-z]');
      if (z && sel) { const l = layers.find((x) => x.id === sel); l.z += +z.dataset.z * 1.5; return draw(); }
      if (t.closest('[data-autofit]')) return autofit();
      if (t.closest('[data-reset]')) { buildLayers(); sel = null; return draw(); }
      if (t.closest('[data-export]')) return exportImage();
      if (t.closest('[data-ai]')) return aiRender();
      if (t.closest('[data-clear-ai]')) { aiResult = null; return draw(); }
      if (t.closest('[data-stage]') && !t.closest('[data-layer]') && sel) { sel = null; draw(); }
    });
    const hold = (on) => (e) => {
      if (!e.target.closest('[data-hold]')) return;
      el.querySelector('[data-stage]')?.classList.toggle('original', on);
    };
    el.addEventListener('pointerdown', hold(true));
    el.addEventListener('pointerup', hold(false));
    el.addEventListener('pointerleave', hold(false));
    if (photo && outfitId) setTimeout(() => autofit(true), 100);
    return () => { removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); };
  },
};
