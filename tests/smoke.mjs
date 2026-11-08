// Test de fumée Playwright : charge le jeu, passe les menus, lance une course, vérifie qu'aucune erreur n'apparaît.
//   npm test              rapide (menus + démarrage de course + test de chutes sur les 2 pistes)
//   npm test -- --full    ajoute le test IA complet (course de 8 karts sur chaque piste)
//   npm test -- --dist    teste dist/kart-party-deluxe.html (après npm run build) au lieu des sources
// Première utilisation : `npx playwright install chromium`. CHROMIUM_PATH permet d'utiliser un autre binaire.
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startServer } from '../tools/serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const full = process.argv.includes('--full'), dist = process.argv.includes('--dist');
const failures = [], notes = [];
const check = (ok, label, extra) => { (ok ? notes : failures).push((ok ? 'OK    ' : 'ECHEC ') + label + (extra ? ' : ' + extra : '')); };
const wait = ms => new Promise(r => setTimeout(r, ms));

if (dist && !fs.existsSync(path.join(ROOT, 'dist/kart-party-deluxe.html'))) { console.error('dist/ introuvable : lancer npm run build'); process.exit(2); }
const srv = await startServer(0, dist ? path.join(ROOT, 'dist') : ROOT);
const port = srv.address().port;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const url = `http://localhost:${port}/${dist ? 'kart-party-deluxe.html' : ''}?q=low&dynres=0`;
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.KP && window.KP.ready, null, { timeout: 120000 });
  check(true, 'le jeu démarre');
  check(await page.evaluate(() => KP.Game.state) === 'title', 'écran titre affiché');

  await page.keyboard.press('Enter'); await wait(300);
  check(await page.evaluate(() => KP.Game.state) === 'select', 'écran de sélection (Entrée)');
  // réglages (80) et remappage (81) : T ouvre le panneau, Entrée sur « KEY BINDINGS », Entrée sur une action, puis la touche
  await page.keyboard.press('KeyT'); await wait(200);
  check(await page.evaluate(() => KP.UI.tuneOpen), 'réglages ouverts (T)');
  await page.evaluate(() => { KP.UI.tuneRow = KP.UI.TUNE_ROWS.indexOf('controls'); KP.UI.refreshTune(); });
  await page.keyboard.press('Enter'); await wait(200);
  check(await page.evaluate(() => KP.UI.keysOpen), 'écran de remappage ouvert');
  await page.keyboard.press('Enter'); await wait(200);
  check(await page.evaluate(() => KP.Input.capturing), 'attente d\'une touche');
  await page.keyboard.press('KeyJ'); await wait(200);
  check(await page.evaluate(() => KP.Input.slots('accel')[0]) === 'KeyJ' && await page.evaluate(() => !KP.Input.capturing), 'GAS remappé sur J');
  await page.keyboard.down('KeyJ'); await wait(200);
  check(await page.evaluate(() => KP.Input.get('accel')), 'la touche remappée accélère');
  await page.keyboard.up('KeyJ'); await wait(100);
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('kp_save')).binds.accel[0]) === 'KeyJ', 'remappage sauvegardé');
  await page.keyboard.press('Escape'); await wait(150); await page.keyboard.press('Escape'); await wait(150);
  check(await page.evaluate(() => !KP.UI.keysOpen && !KP.UI.tuneOpen), 'Échap ferme remappage puis réglages');
  await page.evaluate(() => KP.Input.resetBinds());
  check(await page.evaluate(() => KP.Input.slots('accel')[0]) === 'KeyW', 'touches remises par défaut');
  await page.keyboard.press('Enter'); await wait(300);       // choix du mode -> choix de la piste
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => ['intro', 'countdown', 'race'].includes(KP.Game.state), null, { timeout: 120000 });
  check(true, 'course chargée', await page.evaluate(() => KP.Game.state));
  await page.keyboard.press('Enter');                       // saute l'intro
  await page.keyboard.down('KeyW');      // gaz maintenus pendant le décompte (départ canon possible)
  await page.waitForFunction(() => KP.Game.state === 'race', null, { timeout: 180000 });
  let moved = 0;
  try { await page.waitForFunction(() => KP.Game.player.vel.length() > 3, null, { timeout: 120000 }); } catch (e) { /* mesuré ci-dessous */ }
  moved = await page.evaluate(() => KP.Game.player.vel.length());
  await page.keyboard.up('KeyW');
  check(moved > 3, 'le kart du joueur accélère', moved.toFixed(1) + ' m/s');
  check(await page.evaluate(() => !KP.Game.crashed), 'pas d\'écran d\'erreur pendant la course');
  // bouclier de bananes (28) : l'objet crée 3 bananes en orbite, le premier coup les fait disparaître
  await page.evaluate(() => { const p = KP.Game.player; p.item = 'banana'; p.itemCount = 1; p.rollT = 0; p.itemCool = 0; p.invulnT = 0; });
  await page.keyboard.down('KeyE'); await wait(150); await page.keyboard.up('KeyE'); await wait(200);
  check(await page.evaluate(() => KP.Game.player.bShield === 3 && KP.Items.shields.length === 1 && KP.Items.group.children.length > 0), 'banane : bouclier de 3 bananes en orbite');
  await page.evaluate(() => { KP.Game.player.hit('spin', null); }); await wait(300);
  check(await page.evaluate(() => KP.Game.player.bShield === 0 && KP.Items.shields.length === 0 && KP.Game.player.spinT <= 0), 'banane : le premier coup est absorbé et le bouclier est perdu');

  // direction clavier : montée progressive (lissage réglable) et sensibilité
  await page.evaluate(() => { KP.Prefs.steerSmooth = 1; KP.Prefs.steerSens = 1; });
  await page.keyboard.down('KeyD');
  const sFirst = await page.evaluate(() => new Promise(res => { const f = () => { const v = KP.Input.steer(); if (v > 0.01) res(v); else requestAnimationFrame(f); }; f(); }));
  await page.waitForFunction(() => KP.Input.steer() > 0.99, null, { timeout: 20000 });
  await page.evaluate(() => { KP.Prefs.steerSens = 0.5; });
  const sHalf = await page.evaluate(() => KP.Input.steer());
  await page.keyboard.up('KeyD');
  await page.evaluate(() => { KP.Prefs.steerSmooth = 0.5; KP.Prefs.steerSens = 1; });
  check(sFirst < 0.95, 'direction clavier progressive', sFirst.toFixed(2));
  check(Math.abs(sHalf - 0.5) < 0.01, 'sensibilité de direction', sHalf.toFixed(2));

  for (let i = 0; i < 2; i++) {
    const r = await page.evaluate(idx => KP.Diag.fallTest(idx), i);
    check(r.ok, `test de chutes, piste ${i}`, r.ok ? r.cas + ' cas' : JSON.stringify(r.echecs.slice(0, 2)));
  }
  for (let i = 0; i < 2; i++) {
    const r = await page.evaluate(idx => KP.Diag.driveTest(idx), i);
    check(r.ok, `test de conduite, piste ${i}`, r.ok ? r.cas + ' cas' : JSON.stringify(r.echecs.slice(0, 3)));
  }
  {   // contre-la-montre : un seul kart simulé, pas de boîtes d'objets, la course se termine et donne un temps
    const r = await page.evaluate(async () => {
      await KP.loadWorld(0); KP.Prefs.trial = 1; KP.setupRace();
      const G = KP.Game, p = G.player, dt = KP.PHYS.DT;
      const out = { n: G.racers.length, hidden: G.karts.filter(k => k !== p).every(k => !k.vis.root.visible), boxes: KP.Items.boxMesh.visible === false };
      KP.AI.setup(p, 0.85); KP.RaceCtl.canDrive = true; G.state = 'race';
      let steps = 0; while (!p.finished && steps < 120 * 600) { KP.AI.think(p, G.racers, dt, null); KP.physStep(dt); steps++; }
      out.finished = p.finished; out.place = p.place; out.time = +p.finishTime.toFixed(1);
      KP.Prefs.trial = 0; KP.setupRace(); return out;
    });
    check(r.n === 1 && r.hidden && r.boxes, 'contre-la-montre : seul le joueur en piste, sans boîtes d\'objets', JSON.stringify(r));
    check(r.finished && r.place === 1 && r.time > 20, 'contre-la-montre : arrivée et temps valide', r.time + ' s');
  }
  if (full) for (let i = 0; i < 2; i++) {
    const r = await page.evaluate(idx => KP.Diag.aiTest(idx), i);
    check(r.ok, `test IA, piste ${i}`, r.ok ? r.tempsSimule + ' s simulées' : r.problemes.join(' | '));
  }
  check(errors.length === 0, 'aucune erreur JavaScript ni console.error', errors.slice(0, 3).join(' | '));
} catch (e) { failures.push('ECHEC exception du test : ' + String(e.stack).split('\n').slice(0, 4).join(' <- ')); }
await browser.close(); srv.close();
console.log([...notes, ...failures].join('\n'));
console.log(failures.length ? `\n${failures.length} échec(s)` : '\nTout est vert');
process.exit(failures.length ? 1 : 0);
