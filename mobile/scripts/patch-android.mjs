// Adds the Android permissions the web app uses (camera for photographing clothes,
// location for weather) to the generated Capacitor project.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const manifest = join(dirname(fileURLToPath(import.meta.url)), '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
let xml = readFileSync(manifest, 'utf8');
const perms = [
  'android.permission.CAMERA',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
];
for (const p of perms) {
  if (!xml.includes(p)) xml = xml.replace('</manifest>', `    <uses-permission android:name="${p}" />\n</manifest>`);
}
if (!xml.includes('android.hardware.camera')) {
  xml = xml.replace('</manifest>', '    <uses-feature android:name="android.hardware.camera" android:required="false" />\n</manifest>');
}
writeFileSync(manifest, xml);
console.log('AndroidManifest patched:', perms.join(', '));
