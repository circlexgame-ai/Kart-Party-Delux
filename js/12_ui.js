// 12_ui.js (Kart Party Deluxe)
import { late } from './00_registry.js';
import * as THREE from 'three';
import { Save } from './00_save.js';
import { ACH, has } from './00_ach.js';
import { $, Input, Prefs, TAU, V3, clamp, keyLabel, makeCanvas, rand, randi, resetPrefs, savePrefs, setOL } from './01_core.js';
import { Audio_ } from './03_audio.js';
import { BEACH_DEF, buildBeachWorld } from './06_beach.js';
import { RAINBOW, buildRainbowWorld } from './07_space.js';
import { CHARS, DERIVED_STATS, effStats } from './08_chars.js';
import { ICONS, ITEMS, Items } from './10_items.js';

// ============================================================================
// UI — menus, HUD, minimap, item slot, results, pause
// ============================================================================
export const VERSION = '0.7.0';
const fmtT = (t) => { const m = Math.floor(t / 60); return m + ':' + (t - m * 60).toFixed(2).padStart(5, '0'); };
// Réglages qui ne vivent pas dans Prefs (qualité et résolution : 14_diag, plein écran : le navigateur).
const QO = ['low', 'medium', 'high', 'ultra'];
const SP = {
  quality: [() => QO.indexOf(late.Diag.qualityName), (v) => late.Diag.setQuality(QO[v], true)],
  dynres: [() => +late.Diag.dynRes, (v) => late.Diag.setDynRes(!!v)],
  fullscreen: [() => +!!document.fullscreenElement, (v) => { try { const r = v ? document.documentElement.requestFullscreen() : document.fullscreenElement && document.exitFullscreen(); if (r && r.catch) r.catch(() => { }); } catch (e) { /* refusé par le navigateur */ } }],
};
const getP = (k) => (SP[k] ? SP[k][0]() : Prefs[k]);
const setP = (k, v) => (SP[k] ? SP[k][1](v) : (Prefs[k] = v));
const PCT = new Set(['padDead', 'volMaster', 'volMusic', 'volSfx', 'speedFx', 'hudAlpha']);
export const SUFFIX = ['th', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th'];
const PLACE_GRAD = [null, ['#fffbd0', '#ffd21a', '#ff8a00'], ['#ffffff', '#cfe6ff', '#6aa8ff'], ['#ffe8d0', '#ffb070', '#d0601a'], ['#ffffff', '#bff0ff', '#3ab0ff'], ['#ffffff', '#bff0ff', '#3ab0ff'], ['#ffffff', '#d8d8ff', '#8a7aff'], ['#ffffff', '#d8d8ff', '#8a7aff'], ['#ffffff', '#ffd0e8', '#ff5aa8']];
export const TRACKS = [{ id: 'beach', def: () => BEACH_DEF, name: 'Sunshine Shores', build: () => buildBeachWorld(), bg: ['#6fd8ff', '#2f8cff'], land: '#58c84a', road: '#f4d99a' }, { id: 'rainbow', def: () => RAINBOW, name: 'Rainbow Road', build: () => buildRainbowWorld(), bg: ['#3a1a7a', '#0a0420'], land: null, road: 'rainbow' }];
export const UI = {
  portraits: [], last: {}, itemShow: null, rollIcon: 0, rollTick: 0, mm: null, sel: { track: 0, char: 0, step: 0 }, pauseSel: 0, tuneOpen: false, tuneRow: 0, keysOpen: false, keyRow: 0, keySlot: 0, aboutOpen: false,
  init() {
    // track cards
    const tc = $('trackCards');
    TRACKS.forEach((t, i) => {
      const card = document.createElement('div'); card.className = 'tcard'; const cv = makeCanvas(320, 150); this.drawThumb(cv, t); card.appendChild(cv);
      const nm = document.createElement('div'); nm.className = 'nm bub'; nm.textContent = t.name; card.appendChild(nm);
      const bt = document.createElement('div'); bt.className = 'bt'; card.appendChild(bt);
      card.onclick = () => { this.sel.track = i; this.refreshSelect(); Audio_.play('menu'); }; tc.appendChild(card);
    });
    const rg = $('racerGrid');
    CHARS.forEach((c, i) => { const d = document.createElement('div'); d.className = 'rtile'; d.style.background = `radial-gradient(circle at 50% 35%, #fff, ${c.css})`; const img = document.createElement('img'); img.src = this.portraits[i] || ''; d.appendChild(img); d.onclick = () => { this.sel.char = i; this.refreshSelect(); Audio_.play('menu'); }; rg.appendChild(d); });
    $('goBtn').onclick = () => this.confirmSel();
    $('trackBack').onclick = () => this.goStep(0);
    this.MODES.forEach((m, i) => {
      const d = document.createElement('div'); d.className = 'mcard'; d.innerHTML = `<b>${m.n}</b><span>${m.d}</span>`;
      d.onclick = () => { Prefs.mode = i; savePrefs(); Audio_.play('menu'); this.goStep(1); }; $('modeCards').appendChild(d);
    });
    this.sel.track = clamp(Math.round(Prefs.lastTrack), 0, TRACKS.length - 1);
    late.Game.trackIdx = this.sel.track;   // la dernière piste jouée est présélectionnée
    this.initTune(); this.initKeys();
    $('title').onclick = () => { if (late.Game.state === 'title') late.Game.toSelect(); };
    document.querySelectorAll('#pause .btn').forEach((b, i) => { b.onclick = () => late.Game.pauseAction(b.dataset.a); b.onmouseenter = () => { this.pauseSel = i; this.refreshPause(); }; });
    $('resAgain').onclick = () => late.Game.resultsAgain(); $('resOther').onclick = () => late.Game.otherTrack(); $('resMenu').onclick = () => late.Game.quitToMenu();
    $('intro').onclick = () => late.Game.skipIntro();
    const cc = $('coinCv').getContext('2d'); cc.drawImage(ICONS.coin, 0, 0, 96, 96);
    this.mmCtx = $('minimap').getContext('2d'); this.itemCtx = $('itemCv').getContext('2d');
    this.applyPrefs(); this.refreshControlsText(); this.refreshTitle(); this.refreshSelect();
  },
  drawThumb(cv, t) {
    const g = cv.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, cv.height); gr.addColorStop(0, t.bg[0]); gr.addColorStop(1, t.bg[1]); g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height);
    if (t.id === 'rainbow') for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,255,${rand(0.3, 1)})`; g.fillRect(rand(0, cv.width), rand(0, cv.height), rand(1, 2.5), rand(1, 2.5)); }
    else { g.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 5; i++) { const x = rand(0, 320), y = rand(10, 50); g.beginPath(); g.ellipse(x, y, 30, 10, 0, 0, TAU); g.ellipse(x + 18, y - 6, 20, 10, 0, 0, TAU); g.fill(); } }
    const def = t.def(); const curve = new THREE.CatmullRomCurve3(def.pts.map(p => V3(p[0], p[1], p[2])), true, 'centripetal'); const pts = curve.getSpacedPoints(300);
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    const sc = Math.min(260 / (x1 - x0), 110 / (z1 - z0)); const ox = 160 - (x0 + x1) / 2 * sc, oz = 78 - (z0 + z1) / 2 * sc;
    const path = () => { g.beginPath(); pts.forEach((p, i) => { const x = ox + p.x * sc, y = oz + p.z * sc; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); };
    g.lineJoin = 'round'; path(); g.lineWidth = 16; g.strokeStyle = 'rgba(20,16,70,0.6)'; g.stroke(); path(); g.lineWidth = 10; g.strokeStyle = '#fff'; g.stroke();
    if (t.road === 'rainbow') { const lg = g.createLinearGradient(0, 0, 320, 0); ['#ff4a4a', '#ffb21a', '#fff04a', '#4aff6a', '#4ab8ff', '#b04aff'].forEach((c, i) => lg.addColorStop(i / 5, c)); path(); g.lineWidth = 6; g.strokeStyle = lg; g.stroke(); }
    else { path(); g.lineWidth = 6; g.strokeStyle = '#8a8aa0'; g.stroke(); }
  },
  // ------------------------------------------------ choix du mode puis de la piste
  MODES: [
    { n: 'RACE', d: '8 racers, items, one race' }, { n: 'CUP · 4 RACES', d: 'Points over 4 races' },
    { n: 'TIME TRIAL', d: 'Solo, no items, beat your ghost' }, { n: 'ITEM-FREE RACE', d: '8 racers, pure driving' }, { n: 'CRAZY ITEMS', d: 'Every item, from any place' },
  ],
  goStep(s) { this.sel.step = s; Audio_.play(s ? 'ok' : 'back'); this.refreshSelect(); },
  stepMode(dir) { Prefs.mode = (Prefs.mode + dir + this.MODES.length) % this.MODES.length; savePrefs(); Audio_.play('menu'); this.refreshSelect(); },
  confirmSel() { if (this.sel.step === 0) this.goStep(1); else late.Game.startFromMenu(); },
  applyMode() { Prefs.cup = Prefs.mode === 1 ? 1 : 0; Prefs.trial = Prefs.mode === 2 ? 1 : 0; Prefs.noItems = Prefs.mode === 3 ? 1 : 0; Prefs.crazy = Prefs.mode === 4 ? 1 : 0; },
  refreshSelect() {
    document.querySelectorAll('.mcard').forEach((c, i) => c.classList.toggle('sel', i === Prefs.mode));
    $('modePanel').style.display = this.sel.step === 0 ? '' : 'none'; $('trackPanel').style.display = this.sel.step === 1 ? '' : 'none';
    $('goBtn').textContent = this.sel.step === 0 ? 'NEXT: CHOOSE COURSE ▶' : 'START RACE ▶';
    $('ccInfo').textContent = `${Prefs.laps} LAP${Prefs.laps > 1 ? 'S' : ''} · ${Prefs.mode === 2 ? '1 RACER' : '8 RACERS'}`;
    document.querySelectorAll('.tcard').forEach((c, i) => { c.classList.toggle('sel', i === this.sel.track); const b = Save.best(TRACKS[i].id); c.querySelector('.bt').textContent = b ? 'BEST ' + fmtT(b.time) : 'NO RECORD'; });
    document.querySelectorAll('.rtile').forEach((c, i) => c.classList.toggle('sel', i === this.sel.char));
    const c = CHARS[this.sel.char]; $('racerName').textContent = c.name; $('racerName').style.color = c.css;
    const st = effStats(c.stats, Prefs.weight), dv = DERIVED_STATS(st);   // notes réelles, personnalisation du poids comprise
    [['stSpd', 0], ['stAcc', 1], ['stWgt', 2], ['stHan', 3]].forEach(([id, k]) => $(id).style.width = (clamp(st[k], 0, 5) / 5 * 100) + '%');
    $('stDrift').style.width = (dv.drift / 5 * 100) + '%'; $('stGrip').style.width = (dv.grip / 5 * 100) + '%'; $('stOff').style.width = (dv.off / 5 * 100) + '%';
    late.Game.menuChar = this.sel.char;
  },
  // ------------------------------------------------ réglages (80) : panneau partagé entre le menu de sélection et la pause
  TUNE_ROWS: ['weight', 'steerSens', 'steerSmooth', 'padDead', 'difficulty', 'laps', 'ghost', 'volMaster', 'volMusic', 'volSfx', 'fov', 'camDist', 'quality', 'dynres', 'speedFx', 'hudAlpha', 'bigText', 'reduceFx', 'fullscreen', 'controls', 'about', 'reset'],   // même ordre que le HTML
  TUNE_STEP: { steerSens: 0.05, steerSmooth: 0.05, padDead: 0.01, fov: 1, volMaster: 0.05, volMusic: 0.05, volSfx: 0.05, camDist: 0.05, speedFx: 0.1, hudAlpha: 0.05 },
  initTune() {
    $('ui').appendChild($('tunePanel'));
    const rows = [...document.querySelectorAll('#tunePanel .trow')];
    rows.forEach((r, i) => {
      const k = r.dataset.k; r.onmouseenter = () => { this.tuneRow = i; this.refreshTune(); };
      const inp = r.querySelector('input'); if (inp) inp.oninput = () => { setP(k, parseFloat(inp.value)); this.afterTune(true); };
      r.querySelectorAll('.chips span').forEach(c => c.onclick = () => { setP(k, parseInt(c.dataset.v, 10)); this.afterTune(); });
    });
    $('tuneReset').onclick = () => { this.tuneRow = this.TUNE_ROWS.indexOf('reset'); this.tuneAct(); };
    $('tuneKeys').onclick = () => this.toggleKeys(true);
    $('tuneAbout').onclick = () => this.toggleAbout(true);
    $('tuneBtn').onclick = () => this.toggleTune();
    document.addEventListener('fullscreenchange', () => this.refreshTune());
    this.refreshTune();
  },
  toggleFullscreen() { setP('fullscreen', +!document.fullscreenElement); },
  toggleTune(on = !this.tuneOpen) { this.tuneOpen = on; $('tunePanel').classList.toggle('show', on); Audio_.play('menu'); this.refreshTune(); },
  afterTune(quiet) { savePrefs(); this.applyPrefs(); if (!quiet) Audio_.play('menu'); this.refreshTune(); this.refreshSelect(); },
  tuneAdjust(dir) {
    const k = this.TUNE_ROWS[this.tuneRow], row = document.querySelector(`#tunePanel [data-k="${k}"]`), chips = [...row.querySelectorAll('.chips span')], inp = row.querySelector('input');
    if (chips.length) { const vs = chips.map(c => +c.dataset.v); setP(k, vs[clamp(vs.indexOf(getP(k)) + dir, 0, vs.length - 1)]); }
    else if (inp) setP(k, clamp(Math.round((Prefs[k] + dir * this.TUNE_STEP[k]) * 100) / 100, +inp.min, +inp.max));
    else return;
    this.afterTune();
  },
  tuneAct() {   // Entrée sur une ligne « bouton »
    const k = this.TUNE_ROWS[this.tuneRow];
    if (k === 'reset') { resetPrefs(); this.afterTune(); } else if (k === 'controls') this.toggleKeys(true); else if (k === 'about') this.toggleAbout(true);
  },
  refreshTune() {
    document.querySelectorAll('#tunePanel .trow').forEach((r, i) => {
      const k = r.dataset.k, foc = this.tuneOpen && i === this.tuneRow; r.classList.toggle('focus', foc); if (foc) r.scrollIntoView({ block: 'nearest' });
      const inp = r.querySelector('input'); if (inp) { const v = Prefs[k]; inp.value = v; r.querySelector('b').textContent = PCT.has(k) ? Math.round(v * 100) + '%' : k === 'fov' ? (v > 0 ? '+' : '') + Math.round(v) + '°' : k === 'camDist' ? '×' + v.toFixed(2) : v.toFixed(2); }
      const cs = r.querySelectorAll('.chips span'); if (cs.length) { const v = getP(k); cs.forEach(c => c.classList.toggle('on', parseInt(c.dataset.v, 10) === v)); }
    });
  },
  // Effets de bord des réglages : mixeur (78), gros texte (140), opacité du HUD (132).
  applyPrefs() { Audio_.setVol(Prefs.volMaster, Prefs.volMusic, Prefs.volSfx); document.body.classList.toggle('big', !!Prefs.bigText); $('hud').style.opacity = Prefs.hudAlpha; },
  // ------------------------------------------------ remappage des touches (81)
  KEY_ACTS: [['accel', 'GAS'], ['brake', 'BRAKE · REVERSE'], ['left', 'STEER LEFT'], ['right', 'STEER RIGHT'], ['drift', 'HOP · DRIFT'], ['item', 'USE ITEM']],
  initKeys() {
    $('ui').appendChild($('keysPanel')); $('ui').appendChild($('aboutPanel'));
    this.KEY_ACTS.forEach(([, label], r) => {
      const row = document.createElement('div'); row.className = 'trow'; row.innerHTML = `<i>${label}</i><span class="kslot"></span><span class="kslot"></span>`;
      row.onmouseenter = () => { if (!Input.capturing) { this.keyRow = r; this.refreshKeys(); } };
      row.querySelectorAll('.kslot').forEach((sl, s) => { sl.onclick = () => { this.keyRow = r; this.keySlot = s; this.refreshKeys(); this.beginCapture(); }; });
      $('keyRows').appendChild(row);
    });
    $('keysReset').onclick = () => { Input.resetBinds(); Audio_.play('back'); this.refreshKeys(); this.refreshControlsText(); };
    $('titleInfo').onclick = (e) => { e.stopPropagation(); this.toggleAbout(true); };
  },
  toggleKeys(on = !this.keysOpen) {
    this.keysOpen = on; if (!on) { Input.cancelCapture(); $('keysPanel').classList.remove('cap'); }
    $('keysPanel').classList.toggle('show', on); Audio_.play(on ? 'menu' : 'back'); this.refreshKeys();
  },
  refreshKeys() {
    [...$('keyRows').children].forEach((row, r) => {
      row.classList.toggle('focus', this.keysOpen && r === this.keyRow);
      [...row.querySelectorAll('.kslot')].forEach((sl, s) => { sl.textContent = keyLabel(Input.slots(this.KEY_ACTS[r][0])[s]); sl.classList.toggle('focus', this.keysOpen && r === this.keyRow && s === this.keySlot); });
    });
    document.querySelector('#keysPanel [data-kr="reset"]').classList.toggle('focus', this.keysOpen && this.keyRow === this.KEY_ACTS.length);
  },
  beginCapture() {
    const a = this.KEY_ACTS[this.keyRow][0], slot = this.keySlot, p = $('keysPanel'), hint = $('keyPrompt').querySelector('span');
    hint.textContent = 'ESC to cancel'; p.classList.add('cap'); Audio_.play('menu');
    const wait = () => Input.capture((code) => {
      if (code === 'Escape') { p.classList.remove('cap'); Audio_.play('back'); return; }
      if (!Input.bind(a, slot, code)) { hint.textContent = 'RESERVED KEY — try another · ESC to cancel'; wait(); return; }
      p.classList.remove('cap'); Audio_.play('ok'); this.refreshKeys(); this.refreshControlsText();
    });
    wait();
  },
  keysNav(n) {   // n = nombre de lignes (actions + « reset »)
    if (Input.edge('up')) this.keyRow = (this.keyRow + n - 1) % n; if (Input.edge('down')) this.keyRow = (this.keyRow + 1) % n;
    if (Input.edge('mleft')) this.keySlot = 0; if (Input.edge('mright')) this.keySlot = 1;
    this.refreshKeys();
  },
  // textes d'aide qui montrent les touches réelles (titre, bandeau de course)
  refreshControlsText() {
    const L = (a) => Input.slots(a).map(keyLabel).join(' / ');
    $('titleControls').innerHTML = `<span><b>${L('accel')}</b> Gas</span><span><b>${L('brake')}</b> Brake · Reverse</span><span><b>${L('left')}</b> Left</span><span><b>${L('right')}</b> Right</span><span><b>${L('drift')}</b> Hop · Drift · Trick</span><span><b>${L('item')}</b> Item</span><span><b>ESC</b> Pause</span>`;
    $('hudHint').textContent = `${L('drift')} + steer to drift · release for mini-turbo · ${L('item')} use item (hold brake: drop it behind) · ESC pause`;
  },
  // ------------------------------------------------ à propos : nouveautés (151), succès (101), crédits (155)
  toggleAbout(on = !this.aboutOpen) {
    this.aboutOpen = on; $('aboutPanel').classList.toggle('show', on); Audio_.play(on ? 'menu' : 'back');
    if (!on) return;
    const got = ACH.filter(a => has(Save, a.id)).length;
    $('aboutBody').innerHTML = `<h5>NEW IN ${VERSION}</h5><ul><li>Full settings: audio mixer, quality, camera distance, speed lines, HUD opacity, big text, reduced motion, fullscreen</li><li>Key remapping, saved between sessions</li><li>Banana shield: 3 bananas orbit your kart and are lost on the first hit (hold brake + item to drop one behind instead)</li><li>New CRAZY ITEMS mode, incoming-item alert, perfect-lap bonus, achievements, finish fireworks</li><li>Keys: F fullscreen · H hide HUD · P screenshot · C camera</li></ul>`
      + `<h5>ACHIEVEMENTS ${got}/${ACH.length}</h5><ul>${ACH.map(a => `<li>${has(Save, a.id) ? '★' : '☆'} <b>${a.n}</b> — ${a.d}</li>`).join('')}</ul>`
      + `<h5>CREDITS</h5><p>Kart Party Deluxe. Every mesh, texture and sound is generated by code.<br>3D engine: Three.js r170, MIT License, © three.js authors (see vendor/three.LICENSE).</p>`;
    Save.data.seen = VERSION; Save.flush(); this.refreshTitle();
  },
  // titre (142) : meilleur temps de la dernière piste, et pastille « nouveautés » tant que la version n'a pas été vue
  refreshTitle() {
    const t = TRACKS[clamp(Math.round(Prefs.lastTrack), 0, TRACKS.length - 1)], b = Save.best(t.id);
    $('titleInfo').textContent = `${t.name} · ${b ? 'BEST ' + fmtT(b.time) : 'no record yet'} · ${Save.data.seen === VERSION ? 'N: about' : '★ NEW in ' + VERSION + ' — press N'}`;
  },
  setIncoming(ch) { if (this.last.inc === ch) return; this.last.inc = ch; const e = $('incoming'); e.style.display = ch ? 'block' : 'none'; if (ch) setOL(e, ch); },
  // jauge de charge du drift (3 paliers = 3 couleurs de mini-turbo) et niveau de chaîne
  setDrift(k, stages) {
    const box = $('driftBox'), show = k.drift !== 0 || (k.chainLvl > 0 && k.chainT > 1.5);
    if (this.last.driftShow !== show) { this.last.driftShow = show; box.classList.toggle('show', show); }
    if (this.last.driftStage !== k.stage) { this.last.driftStage = k.stage; box.classList.remove('s1', 's2', 's3'); if (k.stage) box.classList.add('s' + k.stage); }
    const w = k.drift ? Math.round(clamp(k.charge / stages[2], 0, 1) * 100) : 0; if (this.last.driftW !== w) { this.last.driftW = w; $('driftBar').style.width = w + '%'; }
    const t = k.chainLvl > 0 ? 'CHAIN x' + (k.chainLvl + 1) : ''; if (this.last.chain !== t) { this.last.chain = t; setOL('chainTxt', t); }
  },
  setSlip(f, on) {
    const box = $('slipBox'), show = f > 0.05 || on; if (this.last.slipShow !== show) { this.last.slipShow = show; box.classList.toggle('show', show); }
    if (this.last.slipOn !== on) { this.last.slipOn = on; box.classList.toggle('on', on); }
    const w = Math.round(clamp(f, 0, 1) * 100); if (this.last.slipW !== w) { this.last.slipW = w; $('slipBar').style.width = w + '%'; }
  },
  PAUSE_ACTIONS: ['resume', 'restart', 'settings', 'quit'],
  refreshPause() { document.querySelectorAll('#pause .btn').forEach((b, i) => b.classList.toggle('sel', i === this.pauseSel)); },
  // ------------------------------------------------ HUD
  hud(on) { $('hud').classList.toggle('show', on); },
  setPlace(p) {
    if (this.last.place === p) return; const up = this.last.place && p < this.last.place; this.last.place = p;
    const n = $('posN'), s = $('posS'), gcol = PLACE_GRAD[p];
    setOL(n, String(p)); setOL(s, SUFFIX[p]);
    for (const e of [n, s]) { e.style.setProperty('--g1', gcol[0]); e.style.setProperty('--g2', gcol[1]); e.style.setProperty('--g3', gcol[2]); }
    const box = $('posBox'); box.classList.remove('bump'); void box.offsetWidth; box.classList.add('bump');
    if (up) Audio_.play('menu', { vol: 0.6 });
  },
  setLap(l) { const n = late.Game.laps || 3; l = clamp(l, 1, n); const key = l + '/' + n; if (this.last.lap === key) return; this.last.lap = key; setOL('lapBox', `LAP ${l}/${n}`); },
  setTime(t) { const s = Math.max(0, t); const txt = `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${String(Math.floor((s * 100) % 100)).padStart(2, '0')}`; if (this.last.time !== txt) { this.last.time = txt; $('timeBox').textContent = txt; } },
  setCoins(c) { if (this.last.coins === c) return; this.last.coins = c; setOL('coinN', String(c)); $('coinBox').classList.toggle('max', c >= 10); },
  itemPop() { const b = $('itemBox'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); },
  drawItem(k, dt) {
    const g = this.itemCtx; let key;
    if (k.rollT > 0) { this.rollTick -= dt; if (this.rollTick <= 0) { this.rollTick = 0.065 + (1.7 - k.rollT) * 0.03; this.rollIcon = (this.rollIcon + 1 + randi(0, 2)) % ITEMS.length; Audio_.play('roulette'); } key = 'roll:' + this.rollIcon; }
    else key = k.item ? k.item + ':' + k.itemCount : 'none';
    if (key === this.itemShow) return; this.itemShow = key;
    g.clearRect(0, 0, 224, 224);
    const it = k.rollT > 0 ? ITEMS[this.rollIcon] : k.item;
    if (!it) return;
    let icon = ICONS[it]; if (it === 'triple' && k.rollT <= 0 && k.itemCount < 3) icon = k.itemCount === 2 ? ICONS.triple : ICONS.mushroom;
    g.save(); if (k.rollT > 0) { g.globalAlpha = 0.9; } g.drawImage(icon, 12, 12, 200, 200); g.restore();
    if (it === 'triple' && k.rollT <= 0 && k.itemCount > 1) { g.font = '900 54px Arial Black, sans-serif'; g.lineWidth = 12; g.strokeStyle = '#1a1446'; g.fillStyle = '#fff'; g.textAlign = 'right'; g.strokeText('×' + k.itemCount, 214, 210); g.fillText('×' + k.itemCount, 214, 210); }
  },
  buildMinimap(W) {
    const T = W.track; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < T.n; i++) { x0 = Math.min(x0, T.px[i]); x1 = Math.max(x1, T.px[i]); z0 = Math.min(z0, T.pz[i]); z1 = Math.max(z1, T.pz[i]); }
    const S = 460, m = 34, sc = Math.min((S - 2 * m) / (x1 - x0), (S - 2 * m) / (z1 - z0));
    this.mm = { sc, ox: S / 2 - (x0 + x1) / 2 * sc, oz: S / 2 - (z0 + z1) / 2 * sc, T, theme: W.theme };
    const path = new Path2D(); for (let i = 0; i <= T.n; i += 3) { const j = T.wrap(i); const x = this.mm.ox + T.px[j] * sc, y = this.mm.oz + T.pz[j] * sc; i ? path.lineTo(x, y) : path.moveTo(x, y); } path.closePath();
    this.mm.path = path;
    const g = makeCanvas(S, S), c = g.getContext('2d'); c.lineJoin = 'round'; c.lineCap = 'round';
    c.lineWidth = 30; c.strokeStyle = 'rgba(20,16,70,0.55)'; c.stroke(path); c.lineWidth = 20; c.strokeStyle = '#ffffff'; c.stroke(path);
    if (W.theme === 'space') { const lg = c.createLinearGradient(0, 0, S, S); ['#ff4a4a', '#ffb21a', '#fff04a', '#4aff6a', '#4ab8ff', '#b04aff'].forEach((col, i) => lg.addColorStop(i / 5, col)); c.lineWidth = 11; c.strokeStyle = lg; c.stroke(path); }
    else { c.lineWidth = 11; c.strokeStyle = '#9a9ab8'; c.stroke(path); }
    // start line
    const sx = this.mm.ox + T.px[0] * sc, sy = this.mm.oz + T.pz[0] * sc; c.save(); c.translate(sx, sy); c.rotate(Math.atan2(T.tz[0], T.tx[0])); c.fillStyle = '#fff'; c.fillRect(-3, -15, 6, 30); c.fillStyle = '#111'; for (let k = 0; k < 5; k++) c.fillRect(-3 + (k % 2) * 3, -15 + k * 6, 3, 6); c.restore();
    this.mm.bg = g;
  },
  drawMinimap(karts, player) {
    const g = this.mmCtx, m = this.mm; if (!m) return; g.clearRect(0, 0, 460, 460); g.drawImage(m.bg, 0, 0);
    for (const p of Items.proj) { const x = m.ox + p.pos.x * m.sc, y = m.oz + p.pos.z * m.sc; g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fillStyle = p.type === 'red' ? '#ff3a3a' : p.type === 'green' ? '#3ad83a' : p.type === 'blue' ? '#3a9aff' : '#ffd83a'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke(); }
    const list = [...karts].sort((a, b) => (a === player) - (b === player) || b.place - a.place);
    for (const k of list) {
      const x = m.ox + k.pos.x * m.sc, y = m.oz + k.pos.z * m.sc, me = k === player, r = me ? 13 : 9;
      g.beginPath(); g.arc(x, y, r + 3, 0, TAU); g.fillStyle = me ? '#fff' : '#1a1446'; g.fill();
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = k.def.css; g.fill();
      if (me) { const a = Math.atan2(k.fwd.z, k.fwd.x); g.beginPath(); g.moveTo(x + Math.cos(a) * 24, y + Math.sin(a) * 24); g.lineTo(x + Math.cos(a + 2.5) * 13, y + Math.sin(a + 2.5) * 13); g.lineTo(x + Math.cos(a - 2.5) * 13, y + Math.sin(a - 2.5) * 13); g.closePath(); g.fillStyle = '#fff'; g.fill(); }
      if (k.starT > 0) { g.beginPath(); g.arc(x, y, r + 7, 0, TAU); g.strokeStyle = `hsl(${(performance.now() / 3) % 360},100%,60%)`; g.lineWidth = 4; g.stroke(); }
    }
  },
  // classement en direct : écart au joueur en secondes (▲ devant, ▼ derrière), rafraîchi 4 fois par seconde
  standings(ks, p, dt) {
    this.stT = (this.stT || 0) - dt; if (this.stT > 0) return; this.stT = 0.25;
    const spd = Math.max(12, p.vel.length());
    $('standings').innerHTML = [...ks].sort((a, b) => a.place - b.place).map((k) => {
      const g = (k.progress - p.progress) / spd, tag = k === p ? '' : k.finished ? 'FIN' : (g > 0 ? '▲' : '▼') + Math.abs(g).toFixed(1);
      return `<div class="srow${k === p ? ' me' : ''}"><b>${k.place}</b><i style="background:${k.def.css}"></i><span>${k.name}</span><em>${tag}</em></div>`;
    }).join('');
  },
  resStats(k) {
    const f = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${String(Math.floor((t * 100) % 100)).padStart(2, '0')}`, r = k.rs;
    $('resStats').textContent = k.finished ? `BEST LAP ${r.bestLap ? f(r.bestLap) : '-'} · TRICKS ${r.tricks} · COLLISIONS ${r.hits} · DRAFT ${r.draft.toFixed(1)}s` : '';
  },
  count(txt) { const e = $('count'); setOL(e, txt); e.classList.remove('go'); void e.offsetWidth; e.classList.add('go'); const gold = txt === 'GO!'; e.style.setProperty('--g1', gold ? '#fffbd0' : '#fff'); e.style.setProperty('--g2', gold ? '#7dff5a' : '#fff6b0'); e.style.setProperty('--g3', gold ? '#18b84a' : '#ffb21a'); },
  banner(txt, cols = ['#fff', '#fff6b0', '#ffb21a']) { const e = $('banner'); setOL(e, txt); e.style.setProperty('--g1', cols[0]); e.style.setProperty('--g2', cols[1]); e.style.setProperty('--g3', cols[2]); e.classList.remove('go'); void e.offsetWidth; e.classList.add('go'); },
  results(rows, playerIdx) {
    const box = $('resRows'); box.innerHTML = '';
    rows.forEach((r, i) => {
      const d = document.createElement('div'); d.className = 'rrow' + (r.k.isPlayer ? ' me' : ''); d.style.animationDelay = (0.15 + i * 0.12) + 's';
      const t = r.time; const ts = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${String(Math.floor((t * 100) % 100)).padStart(2, '0')}`;
      d.innerHTML = `<span class="p bub">${i + 1}</span><img src="${this.portraits[CHARS.indexOf(r.k.def)] || ''}" style="background:${r.k.def.css}"><span class="nm bub">${r.k.name}</span><span class="tm">${ts}</span>`;
      box.appendChild(d);
    });
  },
};
late.UI = UI;


