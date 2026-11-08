// Tests unitaires sans navigateur : sauvegarde versionnée + bus d'événements.
import assert from 'node:assert/strict';
import { createSave, migrate, SAVE_VERSION, SAVE_KEY } from '../js/00_save.js';
import { Bus } from '../js/00_bus.js';

const mem = (init = {}) => { const m = { ...init }; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, _m: m }; };

// 1. stockage vide -> sauvegarde neuve à la version courante
let s = createSave(mem()); assert.equal(s.data.v, SAVE_VERSION); assert.deepEqual(s.data.bests, {});
// 2. migration depuis l'ancien format kp_prefs
s = createSave(mem({ kp_prefs: JSON.stringify({ weight: 1, steerSens: 1.2 }) })); assert.equal(s.data.prefs.weight, 1); assert.equal(s.data.v, SAVE_VERSION);
// 3. sauvegarde v0 sans enveloppe -> complétée
assert.deepEqual(Object.keys(migrate({ v: 0 })).sort(), ['bests', 'binds', 'prefs', 'seen', 'stats', 'v']);
// 4. JSON corrompu -> copie de secours + départ à neuf
const bad = mem({ [SAVE_KEY]: '{oups' }); s = createSave(bad); assert.equal(bad._m[SAVE_KEY + '_corrupt'], '{oups'); assert.equal(s.data.v, SAVE_VERSION);
// 5. records : premier temps, meilleur, moins bon, valeurs invalides, persistance
const st = mem(); s = createSave(st);
assert.equal(s.recordBest('beach', 95.5, 'Ana'), true); assert.equal(s.recordBest('beach', 99), false);
assert.equal(s.recordBest('beach', 90.25), true); assert.equal(s.recordBest('beach', NaN), false); assert.equal(s.recordBest('beach', -3), false);
assert.equal(createSave(st).best('beach').time, 90.25);
// 6. une sauvegarde plus récente que le code n'est pas rétrogradée
assert.equal(migrate({ v: SAVE_VERSION + 5, prefs: {} }).v, SAVE_VERSION + 5);
// 7. bus : ordre, désinscription, isolation des erreurs
const log = []; const off = Bus.on('t', (x) => log.push('a' + x)); Bus.on('t', () => { throw new Error('boom'); }); Bus.on('t', (x) => log.push('c' + x));
const err = console.error; console.error = () => {}; Bus.emit('t', 1); off(); Bus.emit('t', 2); console.error = err;
assert.deepEqual(log, ['a1', 'c1', 'c2']);
console.log('unit OK');

// ---- flux de gameplay seedé, indépendant du cosmétique
{
  const { setSeed, grand, grandi } = await import('../js/00_rng.js');
  const draw = () => Array.from({ length: 6 }, () => grand());
  setSeed(42); const a = draw(); Math.random(); Math.random(); setSeed(42); const b = draw(); setSeed(43); const c = draw();
  assert.deepEqual(a, b); assert.notDeepEqual(a, c);
  setSeed(7); for (let i = 0; i < 500; i++) { const v = grandi(0, 5); assert.ok(v >= 0 && v <= 5 && Number.isInteger(v)); }
}
// ---- table d'objets : cohérence
{
  const { ITEM_TABLE, ITEMS } = await import('../js/00_itemtable.js');
  assert.equal(ITEM_TABLE.length, 8);
  ITEM_TABLE.forEach((r, p) => { assert.equal(r.length, ITEMS.length); assert.equal(r.reduce((x, y) => x + y, 0), 100, 'ligne ' + (p + 1)); });
  for (const col of [5, 6]) for (let p = 1; p < 8; p++) assert.ok(ITEM_TABLE[p][col] >= ITEM_TABLE[p - 1][col], 'étoile/éclair croissants vers le dernier');
  assert.equal(ITEM_TABLE[0][6] + ITEM_TABLE[0][7] + ITEM_TABLE[0][5], 0, 'rien de décisif en 1re place');
}
console.log('unit rng+items OK');

// ---- tournoi
{
  const { newCup, addRace, cupStandings, cupDone, CUP_RACES } = await import('../js/00_cup.js');
  const c = newCup(1, 2); assert.deepEqual(c.tracks, [1, 0, 1, 0]); assert.equal(cupDone(c), false);
  const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  addRace(c, names); addRace(c, ['B', 'A', ...names.slice(2)]);
  const s = cupStandings(c); assert.equal(s[0].pts, 18); assert.deepEqual(s.slice(0, 2).map((x) => x.name), ['B', 'A']);   // égalité 18-18 : B a fini 1er la dernière course
  assert.equal(s[7].name, 'H'); assert.equal(s[7].pts, 2);
  c.race = CUP_RACES; assert.equal(cupDone(c), true);
}
// ---- fantôme : validation des données
{
  const { validGhost } = await import('../js/00_ghostdata.js');
  { assert.equal(validGhost({ s: new Array(14).fill(1) }), true); assert.equal(validGhost({ s: [1, 2, 3] }), false); assert.equal(validGhost(null), false); assert.equal(validGhost({ s: new Array(14).fill(NaN) }), false); }
}
console.log('unit cup OK');

// ---- touches remappables
{
  const { createBinds, REMAP, DEFAULT_SLOTS, isReserved } = await import('../js/00_binds.js');
  let b = createBinds({});
  assert.deepEqual(b.export(), {}); assert.deepEqual(b.slots.accel, DEFAULT_SLOTS.accel);
  assert.equal(b.set('accel', 0, 'KeyZ'), true); assert.deepEqual(b.export(), { accel: ['KeyZ', 'ArrowUp'] });
  // conflit : la touche déjà prise est échangée, jamais dupliquée
  assert.equal(b.set('brake', 0, 'KeyZ'), true); assert.equal(b.slots.accel[0], 'KeyS'); assert.equal(b.slots.brake[0], 'KeyZ');
  const all = REMAP.flatMap((a) => b.slots[a]); assert.equal(new Set(all).size, all.length);
  // touches fixes refusées, rien ne change
  for (const c of ['Escape', 'Enter', 'KeyT', 'KeyF', 'F5']) { assert.ok(isReserved(c)); assert.equal(b.set('item', 0, c), false); }
  assert.equal(b.slots.item[0], DEFAULT_SLOTS.item[0]);
  // aller-retour par la sauvegarde ; doublons ou valeurs invalides -> défauts
  assert.deepEqual(createBinds(b.export()).slots, b.slots);
  assert.deepEqual(createBinds({ accel: ['KeyQ', 'KeyQ'], brake: ['KeyQ', 'KeyB'] }).export(), {});
  assert.deepEqual(createBinds({ accel: ['Escape', 'KeyB'], left: 'x', drift: [1, 2] }).export(), {});
  b.reset(); assert.deepEqual(b.export(), {});
}
// ---- succès
{
  const { award, has, ACH } = await import('../js/00_ach.js');
  const sv = createSave(mem());
  assert.equal(award(sv, 'win'), true); assert.equal(award(sv, 'win'), false); assert.equal(award(sv, 'inconnu'), false); assert.ok(has(sv, 'win')); assert.ok(!has(sv, 'first'));
  assert.ok(ACH.every((a) => a.id && a.n && a.d));
}
// ---- migration v1 -> v2 : touches et version vue ajoutées, rien d'autre ne bouge
{
  const m = migrate({ v: 1, prefs: { weight: 1 }, bests: { beach: { time: 80 } }, stats: { races: 3 } });
  assert.equal(m.v, SAVE_VERSION); assert.deepEqual(m.binds, {}); assert.equal(m.seen, ''); assert.equal(m.prefs.weight, 1); assert.equal(m.stats.races, 3);
}
console.log('unit binds+ach OK');
