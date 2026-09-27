// Tiny hash router: #/route?key=value
const views = new Map();
let current = null;
let cleanup = null;
let outlet = null;
const listeners = new Set();

export const register = (name, view) => views.set(name, view);
export const onRoute = (fn) => (listeners.add(fn), () => listeners.delete(fn));

export function parse(hash = location.hash) {
  const [path, qs = ''] = hash.replace(/^#\/?/, '').split('?');
  const params = Object.fromEntries(new URLSearchParams(qs));
  return { name: path || 'home', params };
}

export function navigate(name, params = {}, { replace = false } = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString();
  const hash = `#/${name}${qs ? '?' + qs : ''}`;
  if (replace) { history.replaceState(null, '', hash); render(); }
  else if (location.hash === hash) render();
  else location.hash = hash;
}

export function render() {
  const { name, params } = parse();
  const view = views.get(name) || views.get('home');
  cleanup?.();
  cleanup = null;
  current = { name: views.has(name) ? name : 'home', params, view };
  // Fresh element per view so listeners never leak between routes.
  const fresh = outlet.cloneNode(false);
  outlet.replaceWith(fresh);
  outlet = fresh;
  outlet.className = `view view-${current.name}`;
  const r = view.render(outlet, params);
  if (typeof r === 'function') cleanup = r;
  listeners.forEach((fn) => fn(current));
  window.scrollTo({ top: 0 });
  outlet.focus({ preventScroll: true });
}

export function startRouter(el) {
  outlet = el;
  addEventListener('hashchange', render);
  render();
}
export const currentRoute = () => current;

// Update the URL without re-rendering (e.g. to consume one-shot params like ?add=1).
export function setHash(name, params = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString();
  history.replaceState(null, '', `#/${name}${qs ? '?' + qs : ''}`);
}
