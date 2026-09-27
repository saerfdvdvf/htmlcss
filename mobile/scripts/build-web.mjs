// Copy the web app (../atelier) into www/ for Capacitor, leaving out tests and server code.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, '..', 'atelier');
const out = join(root, 'www');
const SKIP = ['tests', 'server', 'tools', 'node_modules', 'package.json', 'package-lock.json', 'README.md', 'Atelier.html'];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(src, out, {
  recursive: true,
  filter: (p) => !SKIP.includes(relative(src, p).split(sep)[0]),
});
console.log('Web app copied to', out);
