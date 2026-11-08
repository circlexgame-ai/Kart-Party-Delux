// 13_game.js (Kart Party Deluxe)
import { Bus } from './00_bus.js';
import { CUP_RACES, addRace, cupDone, cupStandings, newCup } from './00_cup.js';
import { Save } from './00_save.js';
import { ACH, award } from './00_ach.js';
import { late } from './00_registry.js';
import * as THREE from 'three';
import { $, COL, Input, NOISE_TEX, Prefs, R, TAU, V3, camera, canvasTex, clamp, damp, fatal, makeCanvas, grand, grandi, post, rand, randi, savePrefs, setOL, setSeed, showScreen, smooth } from './01_core.js';
import { GB, SUN_DIR, TEX, TIME_U, buildTextures, captureEnv, makeClouds, makeSkyDome, stdMat } from './02_gfx.js';
import { Audio_ } from './03_audio.js';
import { F_AGRAV, F_GAP, F_TUNNEL, SURF, boostPadMat } from './04_track.js';
import { FX, Skids, TILE } from './05_fx.js';
import { CHARS, DRIFT_COLS, buildCloudy } from './08_chars.js';
import { BOOST_COL, Cloudies, Kart, PHYS, RaceCtl, RescueLog, World, _pm, collideKarts, setWorld, startRescue, stepKart, updateSlipstream } from './09_kart.js';
import { Items } from './10_items.js';
import { AI, PERSONAS } from './11_ai.js';
import { Ghost } from './12_ghost.js';
import { InputRec } from './00_inputrec.js';
import { Tuto } from './12_tuto.js';
import { initTouch } from './12_touch.js';
import { SUFFIX, TRACKS, UI } from './12_ui.js';

// ============================================================================
// GAME — boot, menu stage, world loading, race flow, camera, main loop
// ============================================================================
const _gv = [0, 1, 2, 3, 4, 5, 6, 7].map(() => new THREE.Vector3());
const _gq2 = new THREE.Quaternion();
const Game = {
  state: 'boot', paused: false, trackIdx: 0, menuChar: 0, karts: [], racers: [], trial: false, laps: 3, player: null, raceTime: 0, acc: 0, alpha: 0,
  stateT: 0, shakeAmt: 0, flashAmt: 0, camUp: V3(0, 1, 0), camFwd: V3(0, 0, -1), camPos: V3(), camLook: V3(), camFov: 70, camBlend: 1,
  cd: null, camMode: 0, fw: 0, fwT: 0, shotReq: false, lastPlace: 0, finT: 0, results: null, msgT: 0, hintT: 0,
  // ------------------------------------------------------------- helpers used by other modules
  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a * (Prefs.reduceFx ? 0.15 : 1)); },   // 159 : mouvement réduit
  flash(a) { this.flashAmt = Math.max(this.flashAmt, a * (Prefs.reduceFx ? 0.25 : 1)); },
  message(t, dur = 2) { const e = $('msg'); e.textContent = t; e.style.opacity = 1; this.msgT = dur; },
};
late.Game = Game;

// ------------------------------------------------------------------ menu stage
const Stage = {
  build() {
    const scene = new THREE.Scene(); this.scene = scene;
    scene.add(makeSkyDome({ top: 0x2a6cff, mid: 0x6cbcff, hor: 0xd8f0ff, low: 0x6aa8ff, sun: 0xfff0d8 }));
    scene.add(makeClouds(26, { rMin: 70, rMax: 260, yMin: -55, yMax: -18, seed: 5, shade: 0xc8b8f0, scale: 0.45 })); scene.add(makeClouds(22, { rMin: 380, rMax: 900, yMin: -40, yMax: 120, seed: 8, shade: 0xc8b8f0, scale: 1.2 }));
    const hemi = new THREE.HemisphereLight(0xe0f0ff, 0xffc8e8, 1.2); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff4e8, 2.6); sun.position.set(6, 12, 8); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera; sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sun.shadow.bias = -0.0005; scene.add(sun);
    // stage disk
    const cv = makeCanvas(512, 512), g = cv.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 512, 512);
    for (let r = 0; r < 16; r++) for (let a = 0; a < 32; a++) { if ((r + a) % 2) continue; g.fillStyle = r > 12 ? '#1a1446' : '#ffd21a'; g.beginPath(); g.arc(256, 256, 256 - r * 4, a / 32 * TAU, (a + 1) / 32 * TAU); g.arc(256, 256, 252 - r * 4, (a + 1) / 32 * TAU, a / 32 * TAU, true); g.fill(); }
    const rg = g.createRadialGradient(256, 256, 0, 256, 256, 190); rg.addColorStop(0, '#ff8ac8'); rg.addColorStop(1, '#ff4fa8'); g.fillStyle = rg; g.beginPath(); g.arc(256, 256, 190, 0, TAU); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 10; g.beginPath(); g.arc(256, 256, 186, 0, TAU); g.stroke();
    const disk = new THREE.Group(); scene.add(disk); this.disk = disk;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 0.6, 64), [stdMat({ color: 0xffd21a, roughness: 0.3, metalness: 0.2 }, { rim: 0.4 }), stdMat({ map: canvasTex(cv), roughness: 0.35 }, { rim: 0.1 }), stdMat({ color: 0xffffff })]);
    top.position.y = -0.3; top.receiveShadow = true; disk.add(top);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(9, 0.32, 12, 80), stdMat({ color: 0xffffff, roughness: 0.2, metalness: 0.3 }, { rim: 0.5 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0; disk.add(rim);
    const under = new GB(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, r = rand(2.2, 3.2); under.sphere(r, 0xffffff, Math.cos(a) * 7.8, -r * 0.75 - 0.5, Math.sin(a) * 7.8); } under.sphere(6, 0xffffff, 0, -6.8, 0, 1.3, 1, 1.3);
    disk.add(new THREE.Mesh(under.build(), stdMat({ vertexColors: true, roughness: 0.8 }, { rim: 0.6, rimColor: 0xd8e8ff })));
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 0.5, 48), stdMat({ color: 0xffffff, roughness: 0.25, metalness: 0.1 }, { rim: 0.4 })); ped.position.y = 0.25; ped.receiveShadow = true; ped.castShadow = true; scene.add(ped); this.ped = ped;
    const cap = captureEnv(scene, V3(0, 3, 0), [], 128); scene.environment = cap.env; scene.environmentIntensity = 0.55;
    this.slots = [];
  },
  enter(mode) {
    this.mode = mode; this.t = 0;
    Game.karts.forEach((k, i) => { this.scene.add(k.vis.root); k.vis.root.visible = true; if (k.vis.blob.parent) k.vis.blob.parent.remove(k.vis.blob); k.vis.setStar(0); k.vis.setFlash(0); k.vis.shrink = 1; k.vis.a.emote = null; k.vis.a.spin = 0; k.vis.a.tumble = 0; k.vis.a.trickT = -1; });
    this.ped.visible = mode === 'select';
  },
  update(dt) {
    this.t += dt; const t = this.t;
    this.disk.rotation.y = t * 0.12;
    Game.karts.forEach((k, i) => {
      const v = k.vis, r = v.root;
      if (this.mode === 'title') { const a = i / 8 * TAU + t * 0.12; r.position.set(Math.cos(a) * 6, 0, Math.sin(a) * 6); r.rotation.set(0, -a - Math.PI / 2 + 0.5, 0); r.visible = true; }
      else { r.visible = i === Game.menuChar; if (r.visible) { r.position.set(0, 0.5, 0); r.rotation.set(0, t * 0.7 + 0.6, 0); } }
      v.update(dt, { steer: Math.sin(t * 1.3 + i) * 0.5, speed: 0, drift: 0, stage: 0, boost: 0, air: false, spinT: 0, tumbleT: 0, look: null, hover: 0 });
      if (Math.random() < dt * 0.25) v.emote('celebrate', 1.2);
    });
    if (this.mode === 'title') { const a = t * 0.08; camera.position.set(Math.cos(a) * 17, 7.5 + Math.sin(t * 0.3) * 1, Math.sin(a) * 17); camera.up.set(0, 1, 0); camera.lookAt(0, 1.2, 0); camera.fov = 45; }
    else { camera.position.set(-2.2, 2.2, 5.6); camera.up.set(0, 1, 0); camera.lookAt(-0.8, 1.2, 0); camera.fov = 40; }
    if (window.KP && KP.camOverride) { const o = KP.camOverride; camera.position.set(...o.pos); camera.lookAt(...o.look); camera.fov = o.fov || 35; if (o.rot != null) Game.karts[Game.menuChar].vis.root.rotation.y = o.rot; }
    camera.updateProjectionMatrix();
  },
};

// ------------------------------------------------------------------ portraits
function renderPortraits() {
  const out = []; const w = R.domElement.width, h = R.domElement.height;
  const S = Stage; S.enter('select');
  camera.fov = 30; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  Game.karts.forEach((k, i) => {
    Game.karts.forEach((o, j) => o.vis.root.visible = j === i);
    const r = k.vis.root; r.position.set(0, 0, 0); r.rotation.set(0, 0.35, 0); k.vis.update(0.016, { steer: 0, speed: 0, drift: 0, stage: 0, boost: 0, air: false, spinT: 0, tumbleT: 0, look: null, hover: 0 });
    r.updateMatrixWorld(true);
    const hidden = k.vis.body.children.filter(c => c !== k.vis.char && c.visible); hidden.forEach(c => c.visible = false);
    const hp = k.vis.headPivot.getWorldPosition(V3()); hp.y += (k.def.id === 'shroomy' ? 0.12 : 0.22) * (k.vis.char.scale.x);
    camera.position.set(hp.x - 0.45, hp.y - 0.02, hp.z - 1.75); camera.up.set(0, 1, 0); camera.lookAt(hp);
    post.params.dof = 0; post.render(S.scene, camera, 0);
    const c = makeCanvas(160, 160), g = c.getContext('2d'); const sq = Math.min(w, h) * 0.6;
    g.drawImage(R.domElement, (w - sq) / 2, (h - sq) / 2, sq, sq, 0, 0, 160, 160);
    out.push(c.toDataURL('image/png'));
    hidden.forEach(c => c.visible = true);
  });
  Game.karts.forEach(o => o.vis.root.visible = true);
  post.params.dof = 0.85;
  return out;
}

// ------------------------------------------------------------------ worlds
function disposeWorld(W) {
  if (!W) return;
  for (const k of Game.karts) { if (k.vis.root.parent) k.vis.root.parent.remove(k.vis.root); if (k.vis.blob.parent) k.vis.blob.parent.remove(k.vis.blob); }
  if (FX.group.parent) FX.group.parent.remove(FX.group);
  if (Game.cdCloud && Game.cdCloud.parent) Game.cdCloud.parent.remove(Game.cdCloud);
  if (Cloudies.group && Cloudies.group.parent) Cloudies.group.parent.remove(Cloudies.group);
  Items.clear();
  const keep = new Set(Object.values(TEX)); keep.add(NOISE_TEX);
  W.scene.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) { for (const key of ['map', 'emissiveMap']) if (m[key] && !keep.has(m[key])) m[key].dispose(); m.dispose(); }
  });
  if (W.envCube) W.envCube.dispose(); if (W.scene.environment) W.scene.environment.dispose();
}
async function loadWorld(idx) {
  showScreen('loading', true); $('loadMsg').textContent = 'building ' + TRACKS[idx].name + '…';
  await new Promise(r => setTimeout(r, 30));
  disposeWorld(World); setWorld(null);
  const t0 = performance.now();
  const W = TRACKS[idx].build(); W.def = TRACKS[idx].def();
  // boost pads
  W.pads = [];
  for (const b of W.def.boosts) {
    const T = W.track, i = T.idxOfC(b.c), d = b.d || 0, w = 5, len = 5;
    W.pads.push({ i0: i, i1: T.wrap(i + len), d, w });
    const g = T.ribbon(i, len, j => [[d - w / 2, 0.07], [d + w / 2, 0.07]], { uAcross: true, vScale: len });
    const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setY(k, (Math.floor(k / 2)) / len);
    const m = new THREE.Mesh(g, b.star ? boostPadMat(0xfff27a, 0xff3aa8, true) : boostPadMat()); m.renderOrder = 4; W.group.add(m);
  }
  Items.build(W);
  FX.clear(); FX.attach(W.scene); Skids.attach(W.scene); Skids.clear(); Cloudies.init(W.scene); Cloudies.hideAll();
  for (const k of Game.karts) { W.scene.add(k.vis.root); W.scene.add(k.vis.blob); k.vis.root.visible = true; }
  Game.cdCloud = Game.cdCloud || buildCloudy(); W.scene.add(Game.cdCloud); Game.cdCloud.visible = false;
  UI.buildMinimap(W);
  setWorld(W); if (late.Diag) late.Diag.onWorld(W);
  camera.near = 0.1; camera.far = 3000; camera.updateProjectionMatrix();
  try { if (R.compileAsync) await R.compileAsync(W.scene, camera); else R.compile(W.scene, camera); } catch (e) { }
  console.log('world built in', Math.round(performance.now() - t0), 'ms');
  showScreen('loading', false);
}

// ------------------------------------------------------------------ race setup
function setupRace() {
  const W = World, T = W.track;
  RaceCtl.canDrive = false; Game.raceTime = 0; Game.acc = 0; Game.finT = 0; Game.results = null;
  Game.seed = setSeed(Game.nextSeed ?? (Date.now() ^ (performance.now() * 1000)) >>> 0); Game.nextSeed = null;   // graine de course : rejouable via Game.nextSeed
  Bus.emit('race:setup', { seed: Game.seed, track: TRACKS[Game.trackIdx].id, difficulty: Prefs.difficulty, trial: !!Prefs.trial });
  Items.clear(); Items.build(W);
  FX.clear(); Skids.clear(); Cloudies.hideAll();
  Audio_.starMusic(false); Audio_.siren(0);
  const player = Game.karts[Game.menuChar]; Game.player = player;
  Game.trial = !!Prefs.trial; Game.racers = Game.trial ? [player] : Game.karts.slice();   // contre-la-montre : seul le joueur est simulé, affiché et classé
  Game.laps = Prefs.laps; { const nb = Game.trial || !!Prefs.noItems; Items.noBoxes = nb; if (Items.boxMesh) Items.boxMesh.visible = Items.qMesh.visible = !nb; document.body.classList.toggle('noitems', nb); }
  document.body.classList.toggle('trial', Game.trial);
  const others = Game.karts.filter(k => k !== player); for (let i = others.length - 1; i > 0; i--) { const j = grandi(0, i); [others[i], others[j]] = [others[j], others[i]]; }
  const order = Game.trial ? [player] : others.slice(); if (!Game.trial) order.splice(5, 0, player);
  order.forEach((k, s) => {
    k.reset(); k.isPlayer = k === player; k.finishedLock = false; k.applyWeight(k.isPlayer ? Prefs.weight : 0);
    const row = Math.floor(s / 2), col = s % 2, back = 7 + row * 7 + col * 3.5, d = Game.trial ? 0 : (col ? 3.6 : -3.6);
    const i = T.wrap(-Math.round(back / T.ds)); k.place_(i, d); k.progress = -back; k.prevS = i * T.ds; k.place = s + 1;
    k.vis.a.emote = null; k.vis.a.emoteT = 0; k.vis.setStar(0); k.vis.setFlash(0); k.vis.shrink = 1;
    k.pitch = 0.85 + CHARS.indexOf(k.def) * 0.05;
    if (!k.isPlayer) { const oi = others.indexOf(k); AI.setup(k, clamp(([0.95, 0.85, 0.78, 0.7, 0.62, 0.52, 0.42][Math.min(6, oi)] ?? 0.6) * [0.85, 1, 1.08, 1.15][Prefs.difficulty], 0.2, 1), PERSONAS[oi % PERSONAS.length]); } else k.ai = null;
    k.vis.root.position.copy(k.pos); k.vis.root.quaternion.copy(k.q);
  });
  Game.karts.forEach(k => { const on = Game.racers.includes(k); k.vis.root.visible = on; if (!on) k.vis.blob.visible = false; });
  Ghost.prepare(W.scene, TRACKS[Game.trackIdx].id, player.def);
  UI.last = {}; UI.itemShow = null; UI.setPlace(player.place); UI.setLap(1); UI.setCoins(0);
  Game.camFwd.copy(player.fwd); Game.camUp.copy(player.up);
}
function orderPlaces() {
  const ks = Game.racers;
  const sorted = [...ks].sort((a, b) => (a.finished && b.finished) ? a.finishTime - b.finishTime : a.finished ? -1 : b.finished ? 1 : b.progress - a.progress);
  sorted.forEach((k, i) => k.place = i + 1);
}

// ------------------------------------------------------------------ flow
Game.toTitle = function () {
  this.state = 'title'; this.paused = false; showScreen('pause', false); showScreen('results', false); showScreen('select', false); showScreen('intro', false); UI.hud(false);
  Stage.enter('title'); showScreen('title', true); Audio_.music('title'); Audio_.silenceLoops(); UI.refreshTitle();
};
Game.toSelect = function () { this.state = 'select'; showScreen('title', false); showScreen('select', true); Stage.enter('select'); UI.sel.char = this.menuChar; UI.sel.track = this.trackIdx; UI.sel.step = 0; UI.refreshSelect(); Audio_.play('ok'); };
Game.startFromMenu = async function () {
  if (this.state !== 'select') return;
  this.state = 'loading'; this.trackIdx = UI.sel.track; this.menuChar = UI.sel.char; Audio_.play('ok');
  UI.applyMode(); this.cup = Prefs.cup && !Prefs.trial ? newCup(this.trackIdx, TRACKS.length) : null;
  showScreen('select', false);
  try { await loadWorld(this.trackIdx); } catch (e) { fatal(e); return; }
  setupRace(); this.beginIntro();
};
Game.beginIntro = function () {
  this.state = 'intro'; this.stateT = 0; showScreen('intro', true); const nm = $('introName'); setOL(nm, TRACKS[this.trackIdx].name.toUpperCase());
  document.getElementById('introInfo').textContent = `150cc · ${Prefs.laps} LAP${Prefs.laps > 1 ? 'S' : ''}`;
  const W = World; this.introPos = new THREE.CatmullRomCurve3(W.intro.map(p => p[0]), false, 'centripetal'); this.introLook = new THREE.CatmullRomCurve3(W.intro.map(p => p[1]), false, 'centripetal');
  Audio_.music(W.music); UI.hud(false);
};
Game.skipIntro = function () { if (this.state === 'intro') this.beginCountdown(); };
Game.beginCountdown = function () {
  this.state = 'countdown'; this.stateT = 0; showScreen('intro', false); UI.hud(true); $('hudHint').style.opacity = 1; this.hintT = 12;
  this.camBlend = 0; this.camFrom = { pos: camera.position.clone(), q: camera.quaternion.clone() };
  this.cd = { step: 0, pressT: -1, burn: false };
  const c = this.cdCloud; c.visible = true; c.userData.tl.visible = true; c.userData.flag.visible = false; c.userData.line.visible = c.userData.hook.visible = false;
  c.userData.lamps.forEach(l => l.material.color.set(0x331111));
};
Game.restart = function () { if (!World) return; this.paused = false; Audio_.pause(false); showScreen('pause', false); showScreen('results', false); setupRace(); Audio_.music(World.music); this.beginCountdown(); };
Game.gotoTrack = async function (idx) { this.paused = false; showScreen('results', false); showScreen('pause', false); this.trackIdx = idx; UI.sel.track = idx; this.state = 'loading'; UI.hud(false); try { await loadWorld(idx); } catch (e) { fatal(e); return; } setupRace(); this.beginIntro(); };
Game.otherTrack = function () { this.cup = null; return this.gotoTrack((this.trackIdx + 1) % TRACKS.length); };
// Bouton « course suivante » des résultats : enchaîne le tournoi (piste suivante), ou recommence une course simple.
Game.resultsAgain = function () {
  const c = this.cup; if (!c) return this.restart();
  if (cupDone(c)) { this.cup = newCup(this.trackIdx, TRACKS.length); return this.restart(); }
  c.race++; const next = c.tracks[c.race - 1];
  return next === this.trackIdx ? this.restart() : this.gotoTrack(next);
};
Game.quitToMenu = function () { this.cup = null; this.paused = false; Audio_.pause(false); showScreen('pause', false); showScreen('results', false); disposeWorld(World); setWorld(null); this.toTitle(); };
Game.setPause = function (on) { this.paused = on; showScreen('pause', on); Audio_.pause(on); if (on) { UI.pauseSel = 0; UI.refreshPause(); } Input.clear(); };
Game.pauseAction = function (a) { if (a === 'settings') { UI.toggleTune(true); return; } Audio_.pause(false); if (a === 'resume') this.setPause(false); else if (a === 'restart') this.restart(); else if (a === 'quit') this.quitToMenu(); };

// ------------------------------------------------------------------ physics & race
function physStep(dt) {
  const ks = Game.racers;
  const chk = (tag) => { for (const k of ks) { const v = k.vel.length(); if (v > 56 && !k._fast) { k._fast = true; RescueLog.push({ fast: tag, name: k.name, v: +v.toFixed(1), c: +World.track.c[k.ti].toFixed(2), boost: +k.boostT.toFixed(2), mul: k.boostMul, star: k.starT > 0, size: +k.size.toFixed(2), grounded: k.grounded, rub: +k.rubber.toFixed(3), coins: k.coins, t: +Game.raceTime.toFixed(1) }); } if (v < 50) k._fast = false; } };
  updateSlipstream(ks, dt);
  for (const k of ks) stepKart(k, dt);
  chk('step');
  collideKarts(ks);
  chk('collide');
  Items.step(dt, ks);
  chk('items');
  const T = World.track, L = T.n * T.ds;
  for (const k of ks) {
    const s = (k.loc.i + (k.loc.f || 0)) * T.ds; let ds = s - k.prevS; if (ds > L / 2) ds -= L; if (ds < -L / 2) ds += L;
    if (!k.rescue) k.progress += ds; k.prevS = s;
    const laps = Math.floor(k.progress / L);
    if (laps > k.lapsDone && !k.finished) {
      k.lapsDone = laps;
      { const lt = Game.raceTime - k.rs.lapT0; k.rs.lapT0 = Game.raceTime; if (!k.rs.bestLap || lt < k.rs.bestLap) k.rs.bestLap = lt; Bus.emit('race:lap', { kart: k, lap: laps, time: lt }); }
      if (k.lapsDone >= Game.laps) finishKart(k);
      else if (k.isPlayer) { if (k.lapsDone === Game.laps - 1) { UI.banner('FINAL LAP!', ['#fff', '#ffd0e0', '#ff3a7a']); Audio_.play('finallap'); Audio_.tempo(1.14); } else { UI.banner('LAP ' + (k.lapsDone + 1), ['#fff', '#d0f4ff', '#3ab0ff']); Audio_.play('lap'); } }
    }
    const vt = k.vel.dot(k.loc.T); if (RaceCtl.canDrive && k.grounded && vt < -3 && !k.rescue) k.wrongT += dt; else k.wrongT = Math.max(0, k.wrongT - dt * 3);
  }
  orderPlaces();
  if (RaceCtl.canDrive && Game.state === 'race') Game.raceTime += dt;
}
function finishKart(k) {
  k.finished = true; k.finishTime = Game.raceTime; k.finishedLock = true; orderPlaces();
  Bus.emit('race:finish', { kart: k, time: k.finishTime, place: k.place, track: TRACKS[Game.trackIdx].id });
  if (!k.ai) AI.setup(k, 0.7);
  k.vis.emote(k.place <= 3 ? 'celebrate' : 'upset', 6);
  if (k.isPlayer) {
    Game.state = 'finished'; Game.finT = 0; UI.banner('FINISH!', ['#fffbd0', '#ffd21a', '#ff7a00']);
    Audio_.play('finish'); if (k.place <= 3) setTimeout(() => Audio_.play('cheer'), 600); else setTimeout(() => Audio_.play('lose'), 900);
    Audio_.starMusic(false); Audio_.music(null); FX.confetti(_gv[0].copy(k.pos).addScaledVector(k.up, 3), 220);
    const c = Game.cdCloud; c.visible = true; c.userData.tl.visible = false; c.userData.flag.visible = true; Game.flagT = 0;
  }
}
function showResults() {
  Game.state = 'results'; Game.stateT = 0; UI.hud(false);
  const T = World.track, L = T.n * T.ds * Game.laps;
  const rows = Game.racers.map(k => ({ k, time: k.finished ? k.finishTime : Game.raceTime + Math.max(0, (L - k.progress)) / 27 + grand(0, 0.5) }));
  rows.sort((a, b) => a.time - b.time); rows.forEach((r, i) => { r.k.resPlace = i + 1; });
  Game.results = rows; Game.winner = rows[0].k; UI.results(rows); UI.resStats(Game.player);
  { const c = Game.cup, el = $('resCup'), again = $('resAgain');
    if (c) { addRace(c, rows.map((r) => r.k.name)); const st = cupStandings(c), you = st.findIndex((x) => x.name === Game.player.name) + 1;
      el.textContent = cupDone(c) ? `CUP COMPLETE · WINNER ${st[0].name} (${st[0].pts} pts) · YOU ${you}${SUFFIX[you]}` : `CUP RACE ${c.race}/${CUP_RACES} · LEADER ${st[0].name} ${st[0].pts} pts · YOU ${st.find((x) => x.name === Game.player.name).pts} pts`;
      again.textContent = cupDone(c) ? 'NEW CUP' : 'NEXT RACE'; } else { el.textContent = ''; again.textContent = 'RACE AGAIN'; } }
  { const b = $('resBest'), id = TRACKS[Game.trackIdx].id, best = Save.best(id), fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${String(Math.floor((t * 100) % 100)).padStart(2, '0')}`;
    b.className = Game.newRecord ? 'rec' : ''; b.textContent = best ? (Game.newRecord ? 'NEW RECORD  ' : 'BEST  ') + fmt(best.time) : ''; }
  showScreen('results', true); Audio_.music('results');
  setOL('resTitle', Game.trial ? 'TIME TRIAL' : Game.player.resPlace === 1 ? 'YOU WIN!' : `${Game.player.resPlace}${SUFFIX[Game.player.resPlace]} PLACE!`);
  for (const r of rows) if (r.k.resPlace <= 3) r.k.vis.emote('celebrate', 30);
}

// ------------------------------------------------------------------ camera
function updateCamera(dt) {
  const st = Game.state, p = Game.player;
  if (st === 'intro') {
    Game.stateT += dt; const u = clamp(Game.stateT / 9.5, 0, 1), e = u * u * (3 - 2 * u);
    Game.introPos.getPoint(e, camera.position); camera.up.set(0, 1, 0); camera.lookAt(Game.introLook.getPoint(e, _gv[0]));
    camera.fov = 62; camera.updateProjectionMatrix();
    if (u >= 1) Game.beginCountdown();
    return;
  }
  if (!p) return;
  const r = p.vis.root, rp = r.position;
  if (st === 'finished' || st === 'results') {
    const tgt = st === 'results' ? Game.winner : p; const tp = tgt.vis.root.position;
    Game.orbitA = (Game.orbitA || 0) + dt * (st === 'results' ? 0.35 : 0.6);
    const u = tgt.up, f = tgt.fwd, rgt = _gv[1].crossVectors(f, u).normalize();
    const a = Game.orbitA, rad = st === 'results' ? 6.5 : 5.5;
    const want = _gv[2].copy(tp).addScaledVector(f, Math.cos(a) * rad).addScaledVector(rgt, Math.sin(a) * rad).addScaledVector(u, 2.2);
    camera.position.lerp(want, 1 - Math.exp(-4 * dt)); Game.camUp.lerp(u, 1 - Math.exp(-3 * dt)).normalize(); camera.up.copy(Game.camUp);
    camera.lookAt(_gv[3].copy(tp).addScaledVector(u, 1.0)); camera.fov = damp(camera.fov, 55, 3, dt); camera.updateProjectionMatrix();
    return;
  }
  // chase camera
  const sp = p.vel.dot(p.fwd), sn = clamp(Math.abs(sp) / 32, 0, 1.4), bo = p.boostT > 0 ? 1 : 0;
  Game.camFwd.lerp(p.fwd, 1 - Math.exp(-(p.rescue ? 3 : 7) * dt)).normalize();
  Game.camUp.lerp(p.up, 1 - Math.exp(-5 * dt)).normalize();
  const F = Game.camFwd, U = Game.camUp;
  const cm = CAM_MODES[Game.camMode], dist = (4.65 + sn * 0.8 + (Game.boostVis || 0) * 0.9) * Prefs.camDist * cm[1], hgt = (1.85 + sn * 0.15) * cm[2];
  const want = _gv[1].copy(rp).addScaledVector(F, -dist).addScaledVector(U, hgt);
  if (camera.position.distanceTo(want) > 40) camera.position.copy(want);
  camera.position.lerp(want, 1 - Math.exp(-11 * dt));
  // keep the camera out of the ground / water
  const nearTunnel = (() => { const T = World.track; for (let q = -30; q <= 6; q += 3) if (T.flags[T.wrap(p.ti + q)] & F_TUNNEL) return true; return false; })();
  if (World.terrain && !nearTunnel && p.side !== 0) { const th = World.terrain.height(camera.position.x, camera.position.z); if (camera.position.y < th + 0.9) camera.position.y = th + 0.9; }
  else if (World.terrain && !nearTunnel) { const L = World.track.locate(camera.position, p.ti, Game.camLoc || (Game.camLoc = { P: V3(), T: V3(), N: V3(), B: V3() })); if (L.h < 0.8) camera.position.addScaledVector(L.N, 0.8 - L.h); }
  if (World.waterY != null && camera.position.y < World.waterY + 0.7) camera.position.y = World.waterY + 0.7;
  const look = _gv[2].copy(rp).addScaledVector(U, 1.1).addScaledVector(F, 3.0);
  // blend from intro pose
  if (Game.camBlend < 1) {
    Game.camBlend = Math.min(1, Game.camBlend + dt / 1.1); const e = smooth(0, 1, Game.camBlend);
    const pos = _gv[3].copy(Game.camFrom.pos).lerp(camera.position, e); camera.position.copy(pos);
  }
  camera.up.copy(U); camera.lookAt(look);
  if (Game.camBlend < 1) { _gq2.copy(Game.camFrom.q); camera.quaternion.slerp(_gq2, 1 - smooth(0, 1, Game.camBlend)); }
  // shake
  if (Game.shakeAmt > 0.001) { const s = Game.shakeAmt * 0.35; camera.position.add(_gv[4].set(rand(-s, s), rand(-s, s), rand(-s, s))); Game.shakeAmt *= Math.exp(-6 * dt); }
  Game.boostVis = damp(Game.boostVis || 0, bo, bo ? 8 : 2.5, dt);
  camera.fov = damp(camera.fov, 68 + Prefs.fov + sn * 7 + Game.boostVis * 9, 5, dt); camera.updateProjectionMatrix();
}

// ------------------------------------------------------------------ per-frame visuals for karts
function updateKartVisuals(dt) {
  const a = Game.alpha, ks = Game.racers, T = World.track;
  const heat = [];
  for (const k of ks) {
    const v = k.vis, r = v.root;
    r.position.lerpVectors(k.prevPos, k.pos, a); r.quaternion.slerpQuaternions(k.prevQ, k.q, a);
    // look back at a racer close behind
    k.lookT -= dt;
    if (k.lookT <= 0) {
      k.lookT = rand(0.7, 1.6); k.lookAng = null;
      if (Math.random() < 0.55) for (const o of ks) { if (o === k) continue; const rel = _gv[0].copy(o.pos).sub(k.pos); const lf = rel.dot(k.fwd), lx = rel.dot(_gv[1].crossVectors(k.fwd, k.up)); if (lf < -1.5 && rel.length() < 12) { const th = Math.atan2(-lx, lf); k.lookAng = Math.sign(th || 1) * Math.min(Math.abs(th), 1.9); break; } }
    }
    const boostAmt = k.boostT > 0 ? clamp(k.boostT / 0.35, 0.35, 1) : 0;
    v.shrink = k.size;
    v.update(dt, { steer: k.spinT > 0 ? 0 : k.input.steer, speed: k.vel.dot(k.fwd), drift: k.drift, stage: k.stage, boost: boostAmt, boostCol: k.boostCol, air: !k.grounded, spinT: k.spinT, tumbleT: k.tumbleT, look: k.lookAng, hover: (k.flags & F_AGRAV) && k.side === 0 && !k.rescue, landImpulse: k.landImpulse, accel: k.accelNow, lat: k.yawNow * k.vF });
    k.landImpulse = 0;
    const star = k.starT > 0 ? (k.starT < 1.2 ? (Math.sin(k.starT * 30) > 0 ? 1 : 0.2) : 1) : 0; v.setStar(star);
    v.setFlash(k.hitFlash > 0 ? (Math.sin(k.hitFlash * 40) > 0 ? 0.6 : 0) : 0);
    r.visible = !(k.invulnT > 0 && k.spinT <= 0 && k.tumbleT <= 0 && !k.rescue && Math.sin(k.invulnT * 30) > 0.6 && k.invulnT < 1.4);
    // blob shadow
    const L = k.loc; const hh = Math.max(0, (k.grounded ? 0 : L.h || 0)); const onFloor = k.side === 0 && !(L.flags & F_GAP);
    v.blob.visible = onFloor && hh < 8 && !k.rescue;
    if (v.blob.visible) { v.blob.position.copy(r.position).addScaledVector(L.N, -hh + 0.05); v.blob.quaternion.setFromRotationMatrix(_pm.makeBasis(_gv[2].crossVectors(k.fwd, L.N).normalize(), _gv[3].copy(k.fwd).negate().addScaledVector(L.N, k.fwd.dot(L.N)).normalize(), L.N)); v.blob.material.opacity = 0.9 * (1 - hh / 8); v.blob.scale.setScalar(k.size * (1 + hh * 0.05)); }
    // effects
    const nearCam = r.position.distanceToSquared(camera.position) < 120 * 120;
    if (!nearCam) { k.skid = null; continue; }
    // traces de dérapage : drift, toupie ou gros freinage sur route ou sable ; la couleur dépend de la piste et de la surface
    {
      const road = k.surf === SURF.road, sand = k.surf === SURF.sand, brk = k.input.brake > 0 && k.vF > 12 && k.input.throttle <= 0;
      const marking = k.grounded && !k.rescue && (road || sand) && (k.drift || k.spinT > 0 || brk) && k.vel.lengthSq() > 16;
      if (!k.skid) k.skid = [{ p: V3(), ok: false, a: 0 }, { p: V3(), ok: false, a: 0 }];
      const space = World.theme === 'space', al = (sand ? 0.4 : 0.55) * (k.drift && k.stage ? 1 : 0.85), cr = sand ? 0.42 : space ? 0.25 : 0.04, cg = sand ? 0.34 : space ? 0.12 : 0.04, cb = sand ? 0.22 : space ? 0.5 : 0.06;
      v.rearContacts.forEach((c, wi) => {
        const sk = k.skid[wi]; const wp = _gv[4].copy(c).applyQuaternion(r.quaternion).add(r.position);
        if (!marking) { sk.ok = false; sk.a = 0; return; }
        if (sk.ok && sk.p.distanceToSquared(wp) < 9) {
          if (sk.p.distanceToSquared(wp) > 0.12) { Skids.seg(sk.p, wp, k.up, 0.34, sk.a, al, cr, cg, cb); sk.p.copy(wp); sk.a = al; }
        } else { sk.p.copy(wp); sk.ok = true; sk.a = 0; }
      });
    }
    if (k.drift && k.grounded) {
      const col = k.stage ? DRIFT_COLS[k.stage] : COL(0xfff0c0);
      const rate = k.stage ? 150 : 40;
      for (const c of v.rearContacts) {
        if (Math.random() > rate * dt) continue;
        const wp = _gv[4].copy(c).applyQuaternion(r.quaternion).add(r.position);
        const vv = _gv[5].copy(k.fwd).multiplyScalar(-rand(3, 7)).addScaledVector(k.up, rand(2, 5)).addScaledVector(_gv[6].crossVectors(k.fwd, k.up), rand(-3, 3)).add(_gv[7].copy(k.vel).multiplyScalar(0.8));
        FX.add.emit(wp.x, wp.y, wp.z, vv.x, vv.y, vv.z, { life: rand(0.2, 0.45), size: k.stage ? rand(0.12, 0.22) : 0.08, color: col.clone().multiplyScalar(k.stage ? 5 : 2.5), grav: 16, tile: TILE.spark, stretch: 0.06 });
      }
      if (k.stage >= 2 && Math.random() < dt * 20) FX.sparkle(_gv[4].copy(v.rearContacts[Math.random() < 0.5 ? 0 : 1]).applyQuaternion(r.quaternion).add(r.position), DRIFT_COLS[k.stage].clone().multiplyScalar(3), 1, 0.3);
    }
    if (k.boostT > 0) {
      for (const e of v.exhausts) {
        const wp = _gv[4].copy(e).applyQuaternion(r.quaternion).add(r.position);
        if (Math.random() < dt * 50) { const vv = _gv[5].copy(k.fwd).multiplyScalar(-rand(4, 9)).addScaledVector(k.up, rand(0.5, 2)).add(_gv[6].copy(k.vel).multiplyScalar(0.9)); FX.add.emit(wp.x, wp.y, wp.z, vv.x, vv.y, vv.z, { life: rand(0.15, 0.3), size: 0.35, size1: 0.05, color: k.boostCol.clone().multiplyScalar(3), tile: TILE.flame }); }
        if (heat.length < 8) { _gv[6].copy(wp).addScaledVector(k.fwd, -0.9).project(camera); if (_gv[6].z < 1 && Math.abs(_gv[6].x) < 1.1 && Math.abs(_gv[6].y) < 1.1) { const d = wp.distanceTo(camera.position); heat.push({ x: _gv[6].x * 0.5 + 0.5, y: _gv[6].y * 0.5 + 0.5, r: clamp(0.9 / d, 0.02, 0.14), s: boostAmt * 0.9 }); } }
      }
    }
    if (k.starT > 0 && Math.random() < dt * 40) { const c = COL(0xffffff).setHSL(Math.random(), 1, 0.6).multiplyScalar(3); FX.add.emit(r.position.x + rand(-0.8, 0.8), r.position.y + rand(0.2, 1.6), r.position.z + rand(-0.8, 0.8), -k.vel.x * 0.1, rand(0.5, 1.5), -k.vel.z * 0.1, { life: 0.6, size: 0.5, size1: 0.05, color: c, tile: TILE.star, rv: 5 }); }
    const sp = Math.abs(k.vel.dot(k.fwd));
    if (k.grounded && sp > 7 && (k.surf === SURF.grass || k.surf === SURF.sand) && Math.random() < dt * 30) {
      const sand = k.surf === SURF.sand; const wp = _gv[4].copy(v.rearContacts[Math.random() < 0.5 ? 0 : 1]).applyQuaternion(r.quaternion).add(r.position);
      FX.alpha.emit(wp.x, wp.y + 0.1, wp.z, -k.fwd.x * 2 + rand(-1, 1), rand(1, 3), -k.fwd.z * 2 + rand(-1, 1), { life: rand(0.5, 0.9), size: 0.4, size1: 1.4, color: sand ? COL(0xf4dca0) : COL(0x9ad86a), tile: TILE.smoke, alpha: 0.7, drag: 2, grav: 2 });
      if (!sand && Math.random() < 0.5) FX.alpha.emit(wp.x, wp.y + 0.1, wp.z, rand(-2, 2), rand(2, 4), rand(-2, 2), { life: 0.6, size: 0.12, color: COL(0x4cc43a), tile: TILE.square, grav: 12, rv: 8 });
    }
    if (k.inWater && sp > 3 && Math.random() < dt * 40) FX.alpha.emit(r.position.x, (World.waterY || 0) + 0.1, r.position.z, rand(-3, 3), rand(2, 5), rand(-3, 3), { life: 0.7, size: 0.3, size1: 0.1, color: COL(0xffffff), tile: TILE.soft, grav: 14 });
    if (k.spinT > 0 && Math.random() < dt * 20) FX.sparkle(_gv[4].copy(r.position).addScaledVector(k.up, 1.8), COL(0xffe14a).multiplyScalar(3), 1, 0.4);
  }
  post.setHeat(heat);
}

// Caméras (250) : [nom, facteur de distance, facteur de hauteur]. La distance se règle en plus dans les réglages (249).
const FW_COLS = [0xff3d7f, 0xffd21a, 0x3dd6ff, 0x7dff5a, 0xb46bff];
const CAM_MODES = [['CHASE', 1, 1], ['WIDE', 1.7, 1.6], ['AERIAL', 2.4, 4.2]];

// ------------------------------------------------------------------ main update
function updateRace(dt) {
  const st = Game.state, p = Game.player, ks = Game.racers;
  // countdown
  if (st === 'countdown') {
    Game.stateT += dt; const t = Game.stateT, cd = Game.cd, c = Game.cdCloud;
    const U = p.up, F = p.fwd, Rt = _gv[0].crossVectors(F, U).normalize();
    const hover = _gv[1].copy(p.pos).addScaledVector(F, 10).addScaledVector(U, 4.4 + Math.max(0, 1 - t * 1.4) * 8).addScaledVector(Rt, 3.2);
    if (t > 4.1) hover.addScaledVector(U, (t - 4.1) * 20);
    c.position.copy(hover); c.lookAt(camera.position); c.rotateY(Math.PI); c.scale.setScalar(1.55); c.userData.tl.position.set(-1.25, -1.7, -0.2);
    const lamps = c.userData.lamps, marks = [0.9, 1.9, 2.9, 3.9];
    if (cd.step < 4 && t >= marks[cd.step]) {
      if (cd.step < 3) { lamps[cd.step].material.color.set(COL(0xff2020).multiplyScalar(4)); UI.count(String(3 - cd.step)); Audio_.play('beep'); }
      else { lamps.forEach(l => l.material.color.set(COL(0x20ff40).multiplyScalar(4))); UI.count('GO!'); Audio_.play('go'); RaceCtl.canDrive = true; Game.state = 'race';
        if (cd.pressT >= 2.2 && cd.pressT <= 3.55 && Input.get('accel')) { p.giveBoost(1.3, 1.38, BOOST_COL.start); Audio_.play('boost'); }
        else if (cd.burn) { p.spinT = 0.8; Audio_.play('bump'); }
        for (const k of ks) if (!k.isPlayer && grand() < 0.3 + 0.05 * Prefs.difficulty) k.giveBoost(grand(0.8, 1.2), 1.34, BOOST_COL.start);
      }
      cd.step++;
    }
    if (Input.get('accel')) { if (cd.pressT < 0) cd.pressT = t; if (cd.pressT < 1.4 && t > 3.3) cd.burn = true; } else cd.pressT = -1;
  } else if (Game.cdCloud && Game.cdCloud.visible && st === 'race') {
    Game.stateT += dt; const c = Game.cdCloud; c.position.addScaledVector(p.up, dt * 18); if (Game.stateT > 5.5) c.visible = false;
  }
  if (st === 'finished' && Game.cdCloud.visible) {
    Game.flagT += dt; const c = Game.cdCloud; const U = p.up, F = p.fwd;
    c.position.copy(p.vis.root.position).addScaledVector(F, 6).addScaledVector(U, 4 + Math.sin(Game.flagT * 3) * 0.3); c.lookAt(camera.position); c.rotateY(Math.PI);
    c.userData.flag.rotation.z = Math.sin(Game.flagT * 9) * 0.5;
    if (Game.flagT > 4.5) c.visible = false;
  }
  // feux d'artifice à l'arrivée (211) : seulement sur le podium
  if (Game.fw > 0) { Game.fw -= dt; Game.fwT -= dt; if (Game.fwT <= 0) { Game.fwT = 0.3; const c = FW_COLS[randi(0, FW_COLS.length - 1)]; FX.burst(_gv[5].copy(p.pos).addScaledVector(p.up, rand(9, 16)).addScaledVector(p.fwd, rand(4, 16)).addScaledVector(_gv[6].crossVectors(p.fwd, p.up), rand(-9, 9)), 44, { color: [COL(c).multiplyScalar(3), COL(0xffffff).multiplyScalar(3)], sp: 13, spMin: 6, life: 1.3, size: 0.55, drag: 1.5, grav: 6, tile: TILE.star, upMin: -1 }); } }
  // inputs
  for (const k of ks) if (k.ai && (!k.isPlayer || k.finishedLock)) AI.think(k, ks, dt, p);
  if (Game.autoPlayer && !p.finishedLock) { if (!p.ai) AI.setup(p, 0.8); AI.think(p, ks, dt, null); p.rubber = 1; }
  else if (!p.finishedLock) {
    const i = p.input; i.throttle = Input.get('accel') ? 1 : 0; i.brake = Input.get('brake') ? 1 : 0; i.steer = Input.steer(); i.drift = Input.get('drift'); i.item = Input.get('item'); i.back = Input.get('brake');
    if (st === 'race') InputRec.sample(Game.raceTime, i);
  }
  // fixed-timestep physics
  Game.acc += dt; let n = 0; const tPhys = performance.now();
  while (Game.acc >= PHYS.DT && n < 12) { physStep(PHYS.DT); Game.acc -= PHYS.DT; n++; }
  if (n >= 12) Game.acc = 0;
  if (late.Diag) late.Diag.physMs += (performance.now() - tPhys - late.Diag.physMs) * 0.1;
  Game.alpha = Game.acc / PHYS.DT;
  // finish flow
  if (st === 'finished') { Game.finT += dt; if (Game.finT > 1.2 && Game.finT < 3.2 && Math.random() < dt * 3) FX.confetti(_gv[0].copy(p.pos).addScaledVector(p.up, 4).addScaledVector(p.fwd, 4), 60); if (Game.finT > 5.2) showResults(); }
  if (st === 'results') { Game.stateT += dt; const w = Game.winner; if (Math.random() < dt * 1.5) { const fp = _gv[0].copy(w.pos).addScaledVector(w.up, rand(10, 16)).add(_gv[1].set(rand(-10, 10), 0, rand(-10, 10))); FX.burst(fp, 40, { color: COL(0xffffff).setHSL(Math.random(), 1, 0.6).multiplyScalar(4), sp: 9, life: 1.2, size: 0.3, grav: 4, drag: 1.2, tile: TILE.spark, stretch: 0.03 }); Audio_.play('pop', { vol: 0.3 }); } }
  // visuals
  updateKartVisuals(dt);
  Items.animate(dt, TIME_U.value); Cloudies.update(dt); FX.update(dt); Skids.flush();
  if (World.update) World.update(TIME_U.value, dt);
  if (World.ambient) World.ambient(dt, camera.position);
  if (st === 'race') Ghost.sample(p, Game.raceTime);
  Ghost.update(Game.raceTime, st === 'race' || st === 'countdown');
  // HUD
  if (st === 'race' || st === 'countdown') {
    if (st === 'race') Tuto.update(dt, p); else if (st === 'countdown') Tuto.show('');
    UI.standings(Game.racers, p, dt); UI.setPlace(p.place); UI.setLap(p.lapsDone + 1); UI.setTime(Game.raceTime); UI.setCoins(p.coins); UI.setSlip(p.slipT / PHYS.SLIP_TIME, p.slipOn > 0); UI.setDrift(p, PHYS.STAGES); UI.drawItem(p, dt); UI.drawMinimap(ks, p);
    $('wrongWay').style.display = p.wrongT > 1.5 ? 'block' : 'none';
    if (p.starT <= 0 && Game.starOn) { Game.starOn = false; Audio_.starMusic(false); } if (p.starT > 0) Game.starOn = true;
    Game.hintT -= dt; if (Game.hintT < 0) $('hudHint').style.opacity = 0;
  }
  if (Game.msgT > 0) { Game.msgT -= dt; if (Game.msgT <= 0) $('msg').style.opacity = 0; }
  // audio
  const eng = []; const sn = x => clamp(Math.abs(x) / 32, 0, 1.3);
  const gearRpm = (k) => { const s = sn(k.vel.dot(k.fwd)); const g = Math.min(3, Math.floor(s * 3.2)); return clamp(0.3 + (s * 3.2 - g) * 0.5 + g * 0.07 + (k.boostT > 0 ? 0.25 : 0), 0, 1.3); };
  const prpm = st === 'countdown' ? (p.input.throttle ? 0.75 + Math.sin(TIME_U.value * 25) * 0.08 : 0.25) : gearRpm(p);
  eng.push({ rpm: prpm, load: p.input.throttle, player: true, pitch: 1, pos: p.pos });
  const others = ks.filter(k => k !== p).sort((a, b) => a.pos.distanceToSquared(camera.position) - b.pos.distanceToSquared(camera.position)).slice(0, 3);
  for (const k of others) eng.push({ rpm: gearRpm(k), load: 1, pos: k.pos, pitch: k.pitch || 1 });
  Audio_.engines(eng);
  Audio_.squeal(p.drift && p.grounded ? 1 : (p.grounded && Math.abs(p.input.steer) > 0.8 && sn(p.vF) > 0.8 ? 0.25 : 0), 1 + p.stage * 0.08);
  Audio_.wind(clamp(sn(p.vF) * 0.8 + (p.boostT > 0 ? 0.3 : 0), 0, 1));
  // post effects
  const pp = post.params; const bv = Game.boostVis || 0;
  pp.radial = st === 'race' ? bv * 0.85 + clamp(sn(p.vF) - 0.8, 0, 0.5) * 0.3 : 0; pp.speedLines = st === 'race' ? bv * 0.9 * Prefs.speedFx : 0; pp.chroma = 0.3 + bv * 1.6; pp.radial *= Prefs.speedFx; pp.vignette = 0.35 * (0.4 + 0.6 * Prefs.speedFx);
  pp.flash = Game.flashAmt; Game.flashAmt *= Math.exp(-4 * dt);
  pp.dof = late.Diag ? late.Diag.q.dof : 0.85; pp.dofStart = World.theme === 'space' ? 220 : 150; pp.dofEnd = World.theme === 'space' ? 900 : 520;
  // sun follows player for crisp shadows
  if (World.sun) { const sd = World.sunDir || SUN_DIR; World.sun.target.position.copy(p.vis.root.position); World.sun.position.copy(p.vis.root.position).addScaledVector(sd, 150); World.sun.target.updateMatrixWorld(); }
  for (const s of [World.sky, World.stars]) if (s) s.position.copy(camera.position);
}

// ------------------------------------------------------------------ global input
// Panneau de réglages ouvert : les flèches pilotent le panneau (menu de sélection ET pause). Retourne true si l'entrée est consommée.
function tuneInput() {
  if (!UI.tuneOpen) return false;
  if (Input.edge('back') || Input.edge('pause')) UI.toggleTune(false);
  if (Input.edge('up')) { UI.tuneRow = (UI.tuneRow + UI.TUNE_ROWS.length - 1) % UI.TUNE_ROWS.length; UI.refreshTune(); Audio_.play('menu'); }
  if (Input.edge('down')) { UI.tuneRow = (UI.tuneRow + 1) % UI.TUNE_ROWS.length; UI.refreshTune(); Audio_.play('menu'); }
  if (Input.edge('mleft')) UI.tuneAdjust(-1);
  if (Input.edge('mright')) UI.tuneAdjust(1);
  if (Input.edge('confirm')) UI.tuneAct();
  return true;
}
// Écrans par-dessus tout le reste : à propos, puis remappage, puis réglages. Retourne true si l'entrée est consommée.
function modalInput() {
  if (UI.aboutOpen) { if (Input.edge('back') || Input.edge('confirm') || Input.edge('pause')) UI.toggleAbout(false); return true; }
  if (UI.keysOpen) {
    if (Input.capturing) return true;   // la touche saisie ne doit rien déclencher
    const n = UI.KEY_ACTS.length + 1;
    if (Input.edge('back') || Input.edge('pause')) UI.toggleKeys(false);
    else { UI.keysNav(n); if (Input.edge('confirm')) { if (UI.keyRow === n - 1) { Input.resetBinds(); UI.refreshKeys(); UI.refreshControlsText(); Audio_.play('back'); } else UI.beginCapture(); } }
    return true;
  }
  return false;
}
// Touches fixes : plein écran (154), HUD minimal (248), capture (157), caméra (250).
function hotkeys() {
  if (Input.edge('fs')) UI.toggleFullscreen();
  if (!['intro', 'countdown', 'race', 'finished', 'results'].includes(Game.state)) return;
  if (Input.edge('hide')) $('hud').classList.toggle('min');
  if (Input.edge('shot')) Game.shotReq = true;
  if (Input.edge('cam')) { Game.camMode = (Game.camMode + 1) % CAM_MODES.length; Game.message('CAMERA: ' + CAM_MODES[Game.camMode][0], 1.2); }
}
function handleInput() {
  const st = Game.state;
  if (modalInput()) return;
  hotkeys();
  if (Game.paused) {
    if (Input.edge('tune')) { UI.toggleTune(); return; }
    if (tuneInput()) return;
    const n = UI.PAUSE_ACTIONS.length;
    if (Input.edge('up')) { UI.pauseSel = (UI.pauseSel + n - 1) % n; UI.refreshPause(); Audio_.play('menu'); }
    if (Input.edge('down')) { UI.pauseSel = (UI.pauseSel + 1) % n; UI.refreshPause(); Audio_.play('menu'); }
    if (Input.edge('confirm')) Game.pauseAction(UI.PAUSE_ACTIONS[UI.pauseSel]);
    else if (Input.edge('pause')) Game.setPause(false);
    return;
  }
  if (st === 'title') { if (Input.edge('news')) UI.toggleAbout(true); else if (Input.edge('confirm')) Game.toSelect(); return; }
  if (st === 'select') {
    if (Input.edge('tune')) { UI.toggleTune(); return; }
    if (tuneInput()) return;
    if (Input.edge('mleft')) { UI.sel.char = (UI.sel.char + 7) % 8; UI.refreshSelect(); Audio_.play('menu'); }
    if (Input.edge('mright')) { UI.sel.char = (UI.sel.char + 1) % 8; UI.refreshSelect(); Audio_.play('menu'); }
    if (Input.edge('up') || Input.edge('down')) { if (UI.sel.step === 0) UI.stepMode(Input.edge('down') ? 1 : -1); else { UI.sel.track = (UI.sel.track + 1) % 2; UI.refreshSelect(); Audio_.play('menu'); } }
    if (Input.edge('confirm')) UI.confirmSel();
    if (Input.edge('back')) { if (UI.sel.step === 1) UI.goStep(0); else { Audio_.play('back'); Game.toTitle(); } }
    return;
  }
  if (['intro', 'countdown', 'race', 'finished', 'results'].includes(st)) {
    if (Input.edge('pause')) { Game.setPause(true); Audio_.play('back'); return; }
    if (st === 'intro' && (Input.edge('confirm'))) Game.skipIntro();
    if (st === 'results' && Game.stateT > 1 && Input.edge('confirm')) Game.resultsAgain();
  }
}

// ------------------------------------------------------------------ loop
let _last = performance.now(), _fpsT = 0, _fpsN = 0;
const Loop = { fps: 0, frameMs: 0 };
function frame(now) {
  requestAnimationFrame(frame);
  const t0 = performance.now();
  const rawDt = (now - _last) / 1000; _last = now; const dt = clamp(rawDt, 0, 0.1);
  if (Game.crashed) return;      // écran d'erreur affiché : on n'enchaîne pas les erreurs
  try {
    Input.update(); handleInput();
    if (!Game.paused) {
      TIME_U.value += dt;
      if (Game.state === 'title' || Game.state === 'select') { Stage.update(dt); post.params.dof = 0; post.params.radial = 0; post.params.speedLines = 0; post.params.chroma = 0.25; post.setHeat([]); post.render(Stage.scene, camera, TIME_U.value); }
      else if (World && Game.player && ['intro', 'countdown', 'race', 'finished', 'results'].includes(Game.state)) { updateRace(dt); updateCamera(dt); post.render(World.scene, camera, TIME_U.value); }
    } else if (World && Game.state !== 'title') post.render(World.scene, camera, TIME_U.value);
    if (Game.shotReq) {   // 157 : capture PNG du canvas, juste après le rendu (sans HUD)
      Game.shotReq = false;
      R.domElement.toBlob((b) => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `kart-party-${TRACKS[Game.trackIdx].id}-${Date.now()}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, 'image/png');
      Game.message('SCREENSHOT SAVED', 1.2);
    }
  } catch (e) { fatal(e); throw e; }
  _fpsN++; _fpsT += dt; if (_fpsT > 0.5) { Loop.fps = Math.round(_fpsN / _fpsT); _fpsN = 0; _fpsT = 0; }
  Loop.frameMs = performance.now() - t0;
  if (late.Diag) late.Diag.frame(rawDt, Loop.frameMs);
}

// ------------------------------------------------------------------ boot
async function boot() {
  try {
    $('loadMsg').textContent = 'painting textures…'; await new Promise(r => setTimeout(r, 20));
    buildTextures(); FX.init(); Skids.init(); Items.init();
    $('loadMsg').textContent = 'assembling racers…'; await new Promise(r => setTimeout(r, 20));
    Game.karts = CHARS.map((c, i) => new Kart(i, c, false));
    Stage.build();
    Game.karts.forEach(k => Stage.scene.add(k.vis.root));
    try { if (R.compileAsync) await R.compileAsync(Stage.scene, camera); } catch (e) { }
    UI.portraits = renderPortraits();
    UI.init();
    showScreen('loading', false);
    Game.toTitle();
    window.KP.ready = true;
    requestAnimationFrame(frame);
  } catch (e) { fatal(e); }
}
document.addEventListener('visibilitychange', () => { if (document.hidden && !Game.paused && ['intro', 'countdown', 'race', 'finished', 'results'].includes(Game.state)) Game.setPause(true); });
window.KP = { InputRec, Tuto, Prefs, updateSlipstream, RescueLog, Game, UI, Items, AI, Input, post, R, camera, THREE, Loop, get World() { return World; }, get karts() { return Game.karts; }, ready: false, PHYS, RaceCtl, stepKart, physStep, setupRace, loadWorld, startRescue, Audio_ };
boot();


// ---------------------------------------------------------------- abonnés au bus (records, statistiques)
Bus.on('race:setup', ({ seed, track }) => { Game.fw = 0; $('hud').classList.remove('min'); Prefs.lastTrack = Math.max(0, TRACKS.findIndex((t) => t.id === track)); savePrefs(); Game.newRecord = false; InputRec.reset(seed, track); Tuto.reset(); });
Bus.on('race:finish', ({ kart, time, track }) => {
  if (!kart.isPlayer) return;
  Game.lastRun = { ...InputRec.export(), time };   // entrées de la dernière course (replays à venir)
  Game.newRecord = Save.recordBest(track, time, kart.name);
  if (Game.newRecord) Ghost.commit(track, time);
  Save.bump('races');
});
initTouch();
// pause automatique quand l'onglet ou la fenêtre perd le focus (120)
const autoPause = () => { if ((Game.state === 'race' || Game.state === 'countdown') && !Game.paused) Game.setPause(true); };
addEventListener('blur', autoPause); document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });

// ---------------------------------------------------------------- succès (101), tour parfait (167), feux d'artifice (211)
const toast = (id) => { if (award(Save, id)) Game.message('★ ' + ACH_NAME[id], 3); };
const ACH_NAME = Object.fromEntries(ACH.map((a) => [a.id, a.n.toUpperCase()]));
Bus.on('race:finish', ({ kart, place }) => {
  if (!kart.isPlayer) return;
  toast('first'); if (place === 1) toast('win'); if (Save.data.stats.races >= 10) toast('ten');
  if (place <= 3) { Game.fw = 4; Game.fwT = 0; }
});
Bus.on('race:lap', ({ kart, lap }) => {
  if (!kart.isPlayer) return;
  const clean = !kart.rs.dirty; kart.rs.dirty = false;
  if (!clean) return;
  toast('perfect'); if (lap < Game.laps) { kart.giveBoost(1.2, 1.35, BOOST_COL.shroom); UI.banner('PERFECT LAP!', ['#fff', '#d0ffd8', '#2ad84a']); }
});
Bus.on('banana:block', ({ kart }) => { if (kart.isPlayer) toast('shield'); });
