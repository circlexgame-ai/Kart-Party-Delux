// 14_diag.js (Kart Party Deluxe)
import { late } from './00_registry.js';
import { R, post, $ } from './01_core.js';
import { SURF } from './04_track.js';
import { Skids } from './05_fx.js';
import { PHYS, RaceCtl, RescueLog, SURFX, Stats, World, stepKart, Cloudies, collideKarts, updateSlipstream } from './09_kart.js';
import { AI } from './11_ai.js';
import { TRACKS } from './12_ui.js';

// ============================================================================
// DIAG — compteur de performance (F3), préréglages de qualité (F4), résolution dynamique,
//        tests automatiques : course IA complète (F6) et chutes hors piste (F7)
// ============================================================================
const QUALITY = {
  low:    { pr: 0.75, samples: 0, shadows: false, dof: 0,    bloom: 0 },
  medium: { pr: 1.0,  samples: 2, shadows: true,  dof: 0,    bloom: 0.22 },
  high:   { pr: 1.5,  samples: 4, shadows: true,  dof: 0.85, bloom: 0.22 },
  ultra:  { pr: 2.0,  samples: 4, shadows: true,  dof: 0.85, bloom: 0.3 },
};
const ORDER = ['low', 'medium', 'high', 'ultra'];
const LS = 'kp.quality', LS_DYN = 'kp.dynres';
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } },
};

export const Diag = {
  qualityName: 'high', q: QUALITY.high, scale: 1, dynRes: true,
  perfOn: false, fps: 0, frameMs: 0, physMs: 0, _acc: 0, _n: 0, _slow: 0, _fast: 0, _cool: 0, _txt: 0,
  testing: false, lastReport: null,

  // ---------------------------------------------------------------- qualité
  setQuality(name, silent) {
    if (!QUALITY[name]) name = 'high';
    this.qualityName = name; this.q = QUALITY[name]; store.set(LS, name);
    post.samples = this.q.samples; post.params.bloom = this.q.bloom;
    this.applyResolution(true);
    this.onWorld(World);
    if (!silent && late.Game) late.Game.message('Qualité : ' + name.toUpperCase() + (this.dynRes ? ' (résolution dynamique)' : ''), 1.6);
  },
  cycleQuality() { this.setQuality(ORDER[(ORDER.indexOf(this.qualityName) + 1) % ORDER.length]); },
  onWorld(W) { if (W && W.sun) W.sun.castShadow = this.q.shadows; },
  applyResolution(force) {
    const base = Math.min(devicePixelRatio || 1, this.q.pr), pr = Math.max(0.4, base * this.scale);
    if (!force && Math.abs(R.getPixelRatio() - pr) < 0.01) return;
    R.setPixelRatio(pr); post.resize(true);
  },

  // ---------------------------------------------------------------- résolution dynamique
  // dt réel entre deux images. Sous 45 fps pendant 1 s on baisse de 10 %, au-dessus de 57 fps pendant 4 s on remonte.
  dynamic(dt) {
    if (!this.dynRes || late.Game.state !== 'race' || late.Game.paused || dt > 0.25) { this._slow = this._fast = 0; return; }
    this._cool -= dt;
    if (dt > 1 / 45) { this._slow += dt; this._fast = 0; } else if (dt < 1 / 57) { this._fast += dt; this._slow = Math.max(0, this._slow - dt); } else { this._slow = this._fast = 0; }
    if (this._cool > 0) return;
    if (this._slow > 1 && this.scale > 0.6) { this.scale = Math.max(0.6, +(this.scale - 0.1).toFixed(2)); this._slow = 0; this._cool = 1.5; this.applyResolution(); }
    else if (this._fast > 4 && this.scale < 1) { this.scale = Math.min(1, +(this.scale + 0.1).toFixed(2)); this._fast = 0; this._cool = 1.5; this.applyResolution(); }
  },
  setDynRes(on) { this.dynRes = !!on; store.set(LS_DYN, on ? '1' : '0'); if (!on) { this.scale = 1; this.applyResolution(); } },

  // ---------------------------------------------------------------- compteur F3
  togglePerf(on) {
    this.perfOn = on == null ? !this.perfOn : !!on;
    let el = $('perf'); if (!el) { el = document.createElement('div'); el.id = 'perf'; $('ui').appendChild(el); }
    el.style.display = this.perfOn ? 'block' : 'none';
  },
  frame(rawDt, cpuMs) {
    this._acc += rawDt; this._n++; this.frameMs += (cpuMs - this.frameMs) * 0.1;
    this.dynamic(rawDt);
    if (this._acc < 0.5) return;
    this.fps = Math.round(this._n / this._acc); this._acc = 0; this._n = 0;
    if (!this.perfOn) return;
    const i = R.info, G = late.Game, c = R.domElement;
    const heap = performance.memory ? ((performance.memory.usedJSHeapSize / 1048576) | 0) + ' Mo' : 'n/d';
    $('perf').textContent = [
      `FPS ${this.fps}   CPU ${this.frameMs.toFixed(1)} ms   physique ${this.physMs.toFixed(1)} ms`,
      `rendu ${c.width}x${c.height}  qualité ${this.qualityName}  échelle ${this.scale.toFixed(2)}${this.dynRes ? ' (auto)' : ''}  MSAA ${post.samples}`,
      `draw calls ${i.render.calls}  triangles ${i.render.triangles}`,
      `géométries ${i.memory.geometries}  textures ${i.memory.textures}  mémoire JS ${heap}`,
      `état ${G.state}  sauvetages ${RescueLog.filter(x => x.why).length}  sous-pas ${Stats.subSteps}  anti-blocage ${Stats.blockRescues}`,
      `F3 compteur · F4 qualité · F5 résolution auto · F6 test IA · F7 test chutes`,
    ].join('\n');
  },

  // ---------------------------------------------------------------- harnais de test
  async _prepare(idx) {
    const KPg = window.KP, G = late.Game;
    if (!KPg || !KPg.ready) throw new Error('Jeu pas encore initialisé');
    if (this.testing) throw new Error('Un test est déjà en cours');
    this.testing = true; G.paused = false; G.trackIdx = idx; G.state = 'loading'; late.UI.hud(false);
    await KPg.loadWorld(idx); KPg.setupRace(); G.state = 'diag'; RaceCtl.canDrive = true;
  },
  async _finish() { this.testing = false; const G = late.Game; G.quitToMenu(); },

  // Test IA : 8 karts pilotés par l'IA (joueur compris) font la course entière sans rendu.
  // Échec si un kart ne termine pas, se fait sauver pour cause de blocage, ou si une position devient NaN.
  async aiTest(idx = late.Game.trackIdx, { maxSeconds = 420 } = {}) {
    const t0 = performance.now(); await this._prepare(idx);
    const G = late.Game, KPg = window.KP, ks = G.karts, p = G.player, DT = PHYS.DT, tick = 1 / 60;
    const log0 = RescueLog.length, blocks0 = Stats.blockRescues;
    for (const k of ks) { if (!p.ai) AI.setup(p, 0.8); k.max = 0; k.rescues = 0; }
    let simT = 0, acc = 0, bad = null, yieldN = 0;
    while (simT < maxSeconds && !bad && !ks.every(k => k.finished)) {
      for (const k of ks) if (k.ai) AI.think(k, ks, tick, null);
      acc += tick; G.raceTime = simT; RaceCtl.canDrive = true;
      while (acc >= DT) { KPg.physStep(DT); acc -= DT; }
      G.state = 'diag'; simT += tick;
      for (const k of ks) { const v = k.vel.length(); if (v > k.max) k.max = v; if (!Number.isFinite(v) || !Number.isFinite(k.pos.x + k.pos.y + k.pos.z)) bad = bad || `${k.name}: position ou vitesse invalide à t=${simT.toFixed(1)}s`; }
      if (++yieldN % 300 === 0) await new Promise(r => setTimeout(r));
    }
    const events = RescueLog.slice(log0).filter(e => e.why);
    for (const e of events) { const k = ks.find(x => x.name === e.name); if (k) k.rescues++; }
    const rows = ks.map(k => ({ kart: k.name + (k === p ? ' (joueur)' : ''), arrivé: k.finished, temps: k.finished ? +k.finishTime.toFixed(1) : null, sauvetages: k.rescues, vmax: +k.max.toFixed(1) }));
    const stuck = events.filter(e => e.why === 'stuck').length;
    const problems = [];
    if (bad) problems.push(bad);
    const dnf = rows.filter(r => !r.arrivé).map(r => r.kart); if (dnf.length) problems.push('non arrivés : ' + dnf.join(', '));
    if (stuck) problems.push(stuck + ' sauvetage(s) pour blocage');
    const rep = { piste: TRACKS[idx].name, ok: problems.length === 0, problemes: problems, tempsSimule: +simT.toFixed(1), dureeReelle: Math.round(performance.now() - t0) + ' ms', sauvetagesParCause: events.reduce((o, e) => (o[e.why] = (o[e.why] || 0) + 1, o), {}), anti_blocage: Stats.blockRescues - blocks0, karts: rows };
    this.lastReport = rep; console.log('[Test IA]', rep.ok ? 'OK' : 'ECHEC', rep); console.table(rows);
    await this._finish(); return rep;
  },

  // Test de chute : on téléporte le kart sous la piste, très loin sur le côté, ou en l'air au-dessus du vide ;
  // (le côté est marqué "hors piste" comme si le kart avait sauté par-dessus le muret) ; il doit être récupéré par le nuage et reposé sur la route (ou sur le terrain praticable) en moins de 10 s.
  async fallTest(idx = late.Game.trackIdx) {
    const t0 = performance.now(); await this._prepare(idx);
    const G = late.Game, W = World, T = W.track, k = G.player, DT = PHYS.DT, results = [];
    RaceCtl.canDrive = false;      // aucun input : seule la physique et le sauvetage jouent
    const modes = [['sous la piste', (L) => { k.pos.y -= 40; }], ['loin sur le côté', (L) => { k.pos.addScaledVector(L.B, T.hw[L.i] + 60); k.side = 1; }], ['haut dans le vide', (L) => { k.pos.addScaledVector(L.B, T.hw[L.i] + 25); k.pos.y += 15; k.side = 1; }], ['très loin', (L) => { k.pos.addScaledVector(L.B, 900); k.side = 1; }]];
    const CASES = 10;
    for (let n = 0; n < CASES; n++) for (const [label, apply] of modes) {
      const i = Math.floor(n * T.n / CASES);
      for (const o of G.karts) if (o !== k) { o.reset(); o.pos.set(0, -500, 0); o.rescue = null; }
      k.reset(); k.place_(i, 0); apply({ B: k.loc.B.clone(), i });
      k.prevPos.copy(k.pos); k.grounded = false; k.vel.set(0, 0, 0);
      const log0 = RescueLog.length; let t = 0, ok = false, rescued = false, why = '', finite = true;
      while (t < 10) {
        stepKart(k, DT); t += DT; if (k.rescue) rescued = true;
        if (!Number.isFinite(k.pos.x + k.pos.y + k.pos.z)) { finite = false; break; }
        if (rescued && !k.rescue && k.grounded && k.side === 0 && Math.abs(k.loc.d) <= T.hw[k.ti] + 0.5) { ok = true; break; }
        if (!rescued && k.grounded && k.onTerrain && k.pos.lengthSq() < 700 * 700 && t > 3) { ok = true; why = 'terrain praticable'; break; }
      }
      const ev = RescueLog.slice(log0).find(e => e.why); if (ev && !why) why = ev.why;
      results.push({ piste: TRACKS[idx].name, cas: label, repère: +T.c[i].toFixed(2), ok: ok && finite, temps: +t.toFixed(2), cause: why || (rescued ? '?' : 'aucune'), fin: ok ? undefined : { y: +k.pos.y.toFixed(1), grounded: k.grounded, side: k.side, airT: +k.airT.toFixed(2), h: +(k.loc.h || 0).toFixed(1), d: +(k.loc.d || 0).toFixed(1), terrain: k.onTerrain, rescue: !!k.rescue } });
      Cloudies.hideAll(); k.rescue = null;
    }
    const fails = results.filter(r => !r.ok);
    const rep = { piste: TRACKS[idx].name, ok: fails.length === 0, cas: results.length, echecs: fails, duree: Math.round(performance.now() - t0) + ' ms' };
    this.lastReport = rep; console.log('[Test chutes]', rep.ok ? 'OK' : 'ECHEC', rep); console.table(results);
    await this._finish(); return rep;
  },
  // Test de conduite (lot 2) : marche arrière, poids, aspiration, collisions pondérées, table des surfaces. Sans rendu.
  async driveTest(idx = late.Game.trackIdx) {
    const t0 = performance.now(); await this._prepare(idx);
    const G = late.Game, T = World.track, DT = PHYS.DT, ks = G.karts, a = ks[0], b = ks[1], out = [];
    const check = (nom, ok, info) => out.push({ nom, ok: !!ok, info });
    const park = () => { for (const o of ks) { o.reset(); o.pos.set(0, -500, 0); o.rescue = null; } };
    const run = (secs, fn) => { for (let t = 0; t < secs; t += DT) { if (fn) fn(t); updateSlipstream(ks, DT); for (const o of ks) stepKart(o, DT); collideKarts(ks); } };
    const start = T.wrap(-Math.round(60 / T.ds));      // ligne droite de départ
    // 1) marche arrière : le frein seul arrête le kart, puis la marche arrière s'enclenche après REV_DELAY
    park(); a.reset(); a.place_(start, 0); a.vel.copy(a.fwd).multiplyScalar(8); a.input.brake = 1; a.input.throttle = 0;
    let vStop = null, vRev = 0; run(3, t => { const vF = a.vel.dot(a.fwd); if (vStop === null && vF < 0.6) vStop = t; if (vStop !== null && t > vStop + 0.08 && t < vStop + 0.12) vRev = Math.min(vRev, vF); });
    const vEnd = a.vel.dot(a.fwd);
    check('freinage puis marche arrière', vStop !== null && vEnd < -4 && vRev > -1, `arrêt à ${vStop && vStop.toFixed(2)} s, v finale ${vEnd.toFixed(1)}, v juste après l'arrêt ${vRev.toFixed(2)}`);
    check('vitesse de marche arrière plafonnée', vEnd >= -(PHYS.REV_MAX * 1.05), vEnd.toFixed(1) + ' m/s');
    // 2) poids : lourd plus rapide en pointe, léger plus nerveux (accélération)
    const top = w => { park(); a.reset(); a.applyWeight(w); a.place_(start, 0); a.input.throttle = 1; a.input.brake = 0; a.input.steer = 0; let v10 = 0; run(2.2, () => {}); v10 = a.vel.dot(a.fwd); return v10; };
    const vL = top(-1), vH = top(1); a.applyWeight(0);
    check('poids : le léger accélère plus fort sur 2 s', vL > vH, `léger ${vL.toFixed(1)} · lourd ${vH.toFixed(1)} m/s`);
    check('poids : le lourd a une masse plus grande', (() => { a.applyWeight(1); const m1 = a.phys.mass; a.applyWeight(-1); const m0 = a.phys.mass; a.applyWeight(0); return m1 > m0; })());
    // 3) aspiration : deux karts de même gabarit pilotés par l'IA, l'un 10 m derrière l'autre ; le suiveur doit remplir sa jauge puis rattraper
    park(); for (const k of [a, b]) { k.reset(); k.phys = a.phys; }
    a.place_(start, 0); b.place_(T.wrap(start + Math.round(10 / T.ds)), 0);
    for (const k of [a, b]) { AI.setup(k, 0.9); k.ai.lane = 0; k.ai.laneT = 99; k.vel.copy(k.fwd).multiplyScalar(24); k.vF = 24; }
    const gap = () => _g.copy(b.pos).sub(a.pos).length(); const _g = a.pos.clone();
    const gap0 = gap(); let wake = 0; run(3.5, () => { AI.think(a, [a, b], DT, null); AI.think(b, [a, b], DT, null); if (a.slipOn > 0) wake++; });
    check('aspiration : la jauge se remplit et s\'active derrière un kart', wake > 0, `actif ${wake} pas, écart ${gap0.toFixed(1)} -> ${gap().toFixed(1)} m`);
    check('aspiration : le suiveur rattrape', gap() < gap0 - 0.8, `écart ${gap0.toFixed(1)} -> ${gap().toFixed(1)} m`);
    // 4) collisions pondérées : le léger encaisse plus ; à grande vitesse relative, il part en toupie
    const crash = v => { park(); for (const k of [a, b]) k.reset(); a.phys = { ...a.phys, mass: 1.5 }; b.phys = { ...b.phys, mass: 0.9 };
      a.place_(start, 0); b.place_(start, 0); b.pos.copy(a.pos).addScaledVector(a.fwd, 1.6); a.vel.copy(a.fwd).multiplyScalar(v); b.vel.copy(a.fwd).multiplyScalar(-v); a.vF = v; b.vF = -v;
      const ua = a.vel.clone(), ub = b.vel.clone(); collideKarts([a, b]); return { dA: a.vel.distanceTo(ua), dB: b.vel.distanceTo(ub), spin: b.spinT > 0 }; };
    const soft = crash(5), hard = crash(8);
    check('collision pondérée : le léger encaisse plus', soft.dB > soft.dA * 1.3 && !soft.spin, `Δv lourd ${soft.dA.toFixed(2)} · Δv léger ${soft.dB.toFixed(2)}`);
    check('collision violente : le léger part en toupie', hard.spin);
    // 6) mini-turbo en chaîne : deux mini-turbos rapprochés montent le niveau de chaîne et allongent le boost ; il retombe à 0 après le délai
    park(); a.reset(); a.place_(start, 0);
    a.stage = 1; a.endDrift(true); const d0 = a.boostT, l0 = a.chainLvl; a.boostT = 0; a.stage = 1; a.endDrift(true); const d1 = a.boostT, l1 = a.chainLvl;
    check('chaîne : le 2e mini-turbo monte le niveau et dure plus', l0 === 0 && l1 === 1 && d1 > d0 * 1.1, `niveau ${l0}->${l1}, durée ${d0.toFixed(2)}->${d1.toFixed(2)} s`);
    a.boostT = 0; a.vel.set(0, 0, 0); run(PHYS.CHAIN_GAP + 1.5, () => {});
    check('chaîne : retombe à 0 après le délai', a.chainLvl === 0, 'niveau ' + a.chainLvl);
    // 7) drift inversé : contre-braquer à fond en plein drift retourne le drift et conserve la moitié de la charge
    park(); a.reset(); a.ai = null; a.place_(start, 0); a.vel.copy(a.fwd).multiplyScalar(22); a.drift = 1; a.charge = 1.6; a.stage = 1; a.prevDrift = true;
    a.input.throttle = 1; a.input.brake = 0; a.input.steer = 1; a.input.drift = true; run(0.7, () => { a.input.steer = 1; a.input.drift = true; });
    check('drift inversé : le sens du drift est retourné', a.drift === -1, 'drift ' + a.drift + ', charge ' + a.charge.toFixed(2));
    a.input.drift = false; a.input.steer = 0;
    // 8) tricks variés et combo : deux tricks espacés dans un même saut, boost d'atterrissage plus long
    park(); a.reset(); a.place_(start, 0); a.pos.addScaledVector(a.up, 3); a.vel.copy(a.fwd).multiplyScalar(18).addScaledVector(a.up, 16); a.grounded = false; a.trickWin = PHYS.TRICK_WIN; a.trickCount = 0; a.trickCool = 0; a.prevDrift = false;
    a.input.throttle = 1; a.input.brake = 0; a.input.steer = 0; const kinds = []; const tv = a.vis.trick; a.vis.trick = kk => { kinds.push(kk); tv.call(a.vis, kk); };
    let landed = false, maxN = 0; run(3, t => { a.input.drift = (t > 0.05 && t < 0.15) || (t > 0.75 && t < 0.85); a.input.steer = t > 0.7 ? 1 : 0; maxN = Math.max(maxN, a.trickCount); if (!landed && a.grounded && t > 0.5) landed = true; });
    a.vis.trick = tv;
    check('tricks : deux figures différentes enchaînées', maxN >= 2 && kinds.length >= 2 && kinds[0] !== kinds[1], 'figures ' + kinds.join(','));
    check('combo : boost d\'atterrissage allongé', landed && a.boostMul >= 1.3 + 0.03 - 1e-6, `mul ${a.boostMul.toFixed(2)}`);
    // 9) largeur du drift et traces de dérapage
    a.applyWeight(1); const wH = a.phys.driftW; a.applyWeight(-1); const wL = a.phys.driftW; a.applyWeight(0);
    check('largeur du drift : le lourd décrit un arc plus large', wH > wL, `lourd ${wH.toFixed(2)} · léger ${wL.toFixed(2)}`);
    const i0 = Skids.i; Skids.seg(a.pos, a.pos.clone().addScaledVector(a.fwd, 1), a.up, 0.3, 0, 0.5, 0, 0, 0);
    check('traces : un segment est écrit dans le tampon', Skids.i === (i0 + 1) % Skids.N && Skids.col[(i0 * 16) + 15] === 0.5);
    // 10) bouclier de bananes : absorbe le premier coup « spin » puis disparaît ; la bleue (tumble) le traverse
    park(); a.reset(); a.place_(start, 0); a.bShield = 3;
    const h1 = a.hit('spin', b), shieldGone = a.bShield === 0; a.invulnT = 0; const h2 = a.hit('spin', b);
    check('bouclier de bananes : le 1er coup est absorbé, le 2e passe', h1 && shieldGone && a.spinT > 0 && h2, `absorbé ${h1}, bouclier ${a.bShield}`);
    a.reset(); a.bShield = 3; a.hit('tumble', b);
    check('bouclier de bananes : l\'explosion bleue le traverse', a.tumbleT > 0 && a.bShield === 3);
    // 5) table des surfaces : glace < boue < herbe < sable < route pour le grip ; hors-piste plus lent que la route
    check('surfaces : grips ordonnés', SURFX[SURF.ice].grip < SURFX[SURF.mud].grip && SURFX[SURF.mud].grip < SURFX[SURF.grass].grip && SURFX[SURF.grass].grip < SURFX[SURF.sand].grip && SURFX[SURF.sand].grip < SURFX[SURF.road].grip);
    check('surfaces : herbe, sable et boue ralentissent', [SURF.grass, SURF.sand, SURF.mud].every(x => SURFX[x].max < 1));
    const fails = out.filter(r => !r.ok), rep = { piste: TRACKS[idx].name, ok: fails.length === 0, cas: out.length, echecs: fails, duree: Math.round(performance.now() - t0) + ' ms' };
    this.lastReport = rep; console.log('[Test conduite]', rep.ok ? 'OK' : 'ECHEC', rep); console.table(out);
    await this._finish(); return rep;
  },
  async runAll() { const out = []; for (let i = 0; i < TRACKS.length; i++) { out.push(await this.aiTest(i)); out.push(await this.fallTest(i)); out.push(await this.driveTest(i)); } return out; },
};
late.Diag = Diag;

// ---- raccourcis clavier (F3 compteur, F4 qualité, F5 résolution auto, F6 test IA, F7 test chutes)
addEventListener('keydown', e => {
  if (e.repeat) return;
  if (e.code === 'F3') { e.preventDefault(); Diag.togglePerf(); }
  else if (e.code === 'F4') { e.preventDefault(); Diag.cycleQuality(); }
  else if (e.code === 'F5' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); Diag.setDynRes(!Diag.dynRes); late.Game.message('Résolution dynamique : ' + (Diag.dynRes ? 'ON' : 'OFF'), 1.6); }
  else if (e.code === 'F6') { e.preventDefault(); late.Game.message('Test IA en cours…', 60); Diag.aiTest().then(r => late.Game.message('Test IA : ' + (r.ok ? 'OK' : 'ECHEC ' + r.problemes.join(' | ')), 6), er => late.Game.message('Test IA impossible : ' + er.message, 6)); }
  else if (e.code === 'F7') { e.preventDefault(); late.Game.message('Test de chutes en cours…', 60); Diag.fallTest().then(r => late.Game.message('Test chutes : ' + (r.ok ? 'OK (' + r.cas + ' cas)' : r.echecs.length + ' échec(s) — voir console'), 6), er => late.Game.message('Test chutes impossible : ' + er.message, 6)); }
});

// ---- initialisation : ?q=low|medium|high|ultra dans l'URL, sinon dernier choix, sinon high ; résolution dynamique ON par défaut
(function init() {
  const qs = new URLSearchParams(location.search), want = qs.get('q') || store.get(LS) || 'high';
  Diag.dynRes = qs.get('dynres') != null ? qs.get('dynres') !== '0' : store.get(LS_DYN) !== '0';
  Diag.setQuality(QUALITY[want] ? want : 'high', true);
  if (qs.get('perf') === '1') Diag.togglePerf(true);
  if (window.KP) window.KP.Diag = Diag; else addEventListener('load', () => { window.KP && (window.KP.Diag = Diag); });
})();
