// Construit dist/kart-party-deluxe.html : un seul fichier (HTML + CSS + JS + Three.js), jouable en double-clic,
// sans serveur local (le script est un bundle classique, pas un module ES).
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const out = await build({
  entryPoints: [path.join(ROOT, 'js/main.js')],
  bundle: true, minify: true, format: 'iife', target: 'es2022', write: false, legalComments: 'none',
  alias: { three: path.join(ROOT, 'vendor/three.module.min.js') },
  logLevel: 'warning',
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = read('css/style.css');

let html = read('index.html');
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '');
html = html.replace(/<link rel="stylesheet" href="css\/style.css">/, () => `<style>\n${css}\n</style>`);
html = html.replace(/<script type="module" src="js\/main.js"><\/script>/, () => `<script>\n${js}\n</script>`);
if (html.includes('importmap') || html.includes('src="js/')) throw new Error('Le HTML contient encore des références externes');

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const target = path.join(ROOT, 'dist/kart-party-deluxe.html');
fs.writeFileSync(target, html);
console.log(`dist/kart-party-deluxe.html : ${(html.length / 1024).toFixed(0)} Ko`);
