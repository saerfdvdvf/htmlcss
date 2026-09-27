// Genera Unreal-Outfits.html: la app completa en un único archivo que se abre con doble clic,
// sin servidor, sin instalación y sin cuenta. Los datos se guardan en el navegador.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const { outputFiles } = await build({
  entryPoints: [join(root, 'js/main.js')],
  bundle: true,
  format: 'iife',
  minify: true,
  target: 'es2020',
  write: false,
  legalComments: 'none',
});
const js = outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = read('css/app.css');
const icon = 'data:image/svg+xml;base64,' + Buffer.from(read('assets/icon.svg')).toString('base64');

let html = read('index.html');
const swap = (from, to) => {
  if (!html.includes(from)) throw new Error('No encontrado en index.html: ' + from);
  html = html.replace(from, () => to);
};
swap('<link rel="manifest" href="manifest.webmanifest">\n', '');
swap('<link rel="icon" href="assets/icon.svg" type="image/svg+xml">', `<link rel="icon" href="${icon}" type="image/svg+xml">`);
swap('  <link rel="apple-touch-icon" href="assets/icon-192.png">\n', '');
swap('<link rel="stylesheet" href="css/app.css">', `<style>\n${css}\n</style>`);
swap('<script type="module" src="js/main.js"></script>', `<script>\n${js}\n</script>`);

const out = join(root, 'Unreal-Outfits.html');
writeFileSync(out, html);
console.log(`Unreal-Outfits.html generado (${(html.length / 1024).toFixed(0)} KB)`);
