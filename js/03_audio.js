// 03_audio.js (Kart Party Deluxe)
import { late } from './00_registry.js';
import * as THREE from 'three';
import { camera, clamp, rand } from './01_core.js';

// ============================================================================
// AUDIO — everything synthesized with Web Audio (sfx, engines, music sequencer)
// ============================================================================
export const Audio_ = (() => {
  let ctx = null, master, comp, sfxBus, musBus, engBus, verb, verbSend, noiseBuf;
  const A = { ready: false };
  function init() {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = 0.85;
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    musBus = ctx.createGain(); musBus.gain.value = 0.42; musBus.connect(master);
    engBus = ctx.createGain(); engBus.gain.value = 0.55; engBus.connect(master);
    // reverb
    verb = ctx.createConvolver(); const len = ctx.sampleRate * 1.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    verb.buffer = ir; verbSend = ctx.createGain(); verbSend.gain.value = 0.22; verbSend.connect(verb); verb.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    A.ready = true; A.ctx = ctx; applyVol();
    buildLoops();
  }
  // Mixeur (78) : facteurs 0..1 sur les gains d'origine. Appliqué à la création du contexte et à chaque changement.
  A.vol = { master: 1, music: 1, sfx: 1 };
  function applyVol() { if (!ctx) return; master.gain.value = 0.85 * A.vol.master; musBus.gain.value = 0.42 * A.vol.music; sfxBus.gain.value = 0.9 * A.vol.sfx; engBus.gain.value = 0.55 * A.vol.sfx; }
  A.setVol = (master_, music, sfx) => { A.vol = { master: master_, music, sfx }; applyVol(); };
  A.unlock = () => { if (!ctx) init(); if (ctx && ctx.state === 'suspended' && !A.paused) ctx.resume(); };
  A.pause = on => { A.paused = on; if (!ctx) return; if (on) ctx.suspend(); else ctx.resume(); };
  const now = () => ctx.currentTime;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function nn(s) { const m = /^([A-G])(b|#)?(-?\d)$/.exec(s); if (!m) return null; return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); }
  // spatial helper
  const _al = new THREE.Vector3();
  function spatial(pos, range = 70) {
    if (!pos) return { vol: 1, pan: 0 };
    _al.copy(pos).sub(camera.position); const d = _al.length();
    const vol = clamp(1 - d / range, 0, 1) ** 1.6;
    _al.applyQuaternion(_cq.copy(camera.quaternion).invert());
    return { vol, pan: clamp(_al.x / (Math.abs(_al.z) + 8), -0.9, 0.9) };
  }
  const _cq = new THREE.Quaternion();
  function out(vol, pan, bus = sfxBus, rev = 0) {
    const g = ctx.createGain(); g.gain.value = vol;
    let node = g;
    if (pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
    node.connect(bus); if (rev) { const s = ctx.createGain(); s.gain.value = rev; node.connect(s); s.connect(verbSend); }
    return g;
  }
  function env(g, t, a, peak, d, sus = 0) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus || 0.0001), t + a + d); }
  function tone(f, dur, o = {}) {
    const t = (o.t || now()), osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.slide || dur));
    if (o.detune) osc.detune.value = o.detune;
    env(g, t, o.a || 0.005, 1, dur);
    let last = g;
    if (o.lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; fl.Q.value = o.q || 0.7; g.connect(fl); last = fl; }
    osc.connect(g); last.connect(o.dest || out(o.vol ?? 0.3, o.pan || 0, o.bus || sfxBus, o.rev || 0));
    osc.start(t); osc.stop(t + (o.a || 0.005) + dur + 0.05);
    return osc;
  }
  function noise(dur, o = {}) {
    const t = (o.t || now()), src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.ft || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t); f.Q.value = o.q || 1;
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + (o.slide || dur));
    const g = ctx.createGain(); env(g, t, o.a || 0.004, 1, dur);
    src.connect(f); f.connect(g); g.connect(o.dest || out(o.vol ?? 0.3, o.pan || 0, o.bus || sfxBus, o.rev || 0));
    src.start(t, Math.random() * 1.5); src.stop(t + (o.a || 0.004) + dur + 0.05);
  }
  // ---------------------------------------------------------------- SFX table
  const SFX = {
    coin(v, p) { const d = out(0.22 * v, p, sfxBus, 0.2); tone(988, 0.07, { type: 'square', dest: d }); tone(1319, 0.32, { type: 'square', dest: d, t: now() + 0.07 }); },
    coinlose(v, p) { const d = out(0.15 * v, p); for (let i = 0; i < 3; i++) tone(1319 - i * 200, 0.08, { type: 'square', dest: d, t: now() + i * 0.07 }); },
    itembox(v, p) { const d = out(0.2 * v, p, sfxBus, 0.35); for (let i = 0; i < 7; i++) tone(rand(2200, 5200), rand(0.05, 0.18), { dest: d, t: now() + rand(0, 0.12) }); noise(0.25, { ft: 'highpass', f: 5000, vol: 0.15 * v, pan: p }); },
    roulette(v, p) { tone(1400 + Math.random() * 200, 0.025, { type: 'square', vol: 0.06 * v, pan: p }); },
    itemget(v, p) { const d = out(0.18 * v, p, sfxBus, 0.3);[1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.12, { type: 'triangle', dest: d, t: now() + i * 0.055 })); },
    boost(v, p) { noise(0.7, { f: 300, to: 2600, q: 1.2, vol: 0.5 * v, pan: p, slide: 0.5 }); tone(95, 0.35, { to: 40, vol: 0.5 * v, pan: p }); tone(220, 0.5, { type: 'sawtooth', to: 700, lp: 1800, vol: 0.12 * v, pan: p }); },
    mini(v, p, s = 1) { noise(0.35 + s * 0.12, { f: 500 + s * 200, to: 3000 + s * 500, q: 1.4, vol: 0.4 * v, pan: p }); tone(180 + s * 60, 0.3, { type: 'sawtooth', to: 600 + s * 250, lp: 2200, vol: 0.12 * v, pan: p }); tone(80, 0.2, { to: 45, vol: 0.35 * v, pan: p }); },
    charge(v, p, s = 1) { const d = out(0.12 * v, p, sfxBus, 0.25); const base = [0, 880, 1175, 1568][s];[1, 1.26, 1.5].forEach((m, i) => tone(base * m, 0.16, { type: 'triangle', dest: d, t: now() + i * 0.045 })); noise(0.12, { ft: 'highpass', f: 6000, vol: 0.08 * v, pan: p }); },
    hop(v, p) { tone(260, 0.1, { to: 520, vol: 0.12 * v, pan: p, type: 'triangle' }); },
    land(v, p) { noise(0.14, { ft: 'lowpass', f: 380, vol: 0.45 * v, pan: p }); tone(90, 0.1, { to: 50, vol: 0.25 * v, pan: p }); },
    wall(v, p) { tone(140, 0.14, { type: 'square', to: 70, lp: 900, vol: 0.28 * v, pan: p }); noise(0.1, { f: 900, q: 0.8, vol: 0.3 * v, pan: p }); },
    bump(v, p) { tone(220, 0.1, { type: 'square', to: 130, lp: 1400, vol: 0.22 * v, pan: p }); noise(0.07, { f: 1500, vol: 0.2 * v, pan: p }); },
    throw(v, p) { noise(0.22, { f: 1800, to: 600, q: 2, vol: 0.25 * v, pan: p }); tone(900, 0.15, { type: 'square', to: 300, lp: 2500, vol: 0.08 * v, pan: p }); },
    hit(v, p) { noise(0.18, { ft: 'lowpass', f: 1400, vol: 0.5 * v, pan: p }); tone(1300, 0.6, { to: 260, slide: 0.55, vol: 0.2 * v, pan: p, type: 'triangle' }); tone(180, 0.2, { type: 'square', to: 80, lp: 700, vol: 0.2 * v, pan: p }); },
    banana(v, p) { tone(420, 0.14, { to: 190, vol: 0.2 * v, pan: p }); },
    slip(v, p) { tone(700, 0.45, { to: 1400, slide: 0.2, type: 'sine', vol: 0.18 * v, pan: p }); tone(1400, 0.4, { to: 500, t: now() + 0.2, vol: 0.15 * v, pan: p }); },
    star(v, p) { const d = out(0.14 * v, p, sfxBus, 0.35); for (let i = 0; i < 12; i++) tone(mtof(84 + [0, 4, 7, 12, 16, 19][i % 6]), 0.1, { type: 'square', dest: d, t: now() + i * 0.05, lp: 5000 }); },
    lightning(v) { noise(0.9, { ft: 'lowpass', f: 6000, to: 200, vol: 0.6 * v }); tone(1800, 0.6, { type: 'sawtooth', to: 60, lp: 3000, vol: 0.2 * v }); tone(55, 1.2, { to: 30, vol: 0.5 * v }); },
    shrink(v, p) { tone(900, 0.4, { to: 250, vol: 0.14 * v, pan: p, type: 'triangle' }); },
    explode(v, p) { noise(1.4, { ft: 'lowpass', f: 2200, to: 90, q: 0.9, vol: 0.9 * v, pan: p, slide: 1.2 }); tone(70, 0.9, { to: 28, vol: 0.8 * v, pan: p }); },
    beep(v) { tone(523, 0.28, { type: 'square', lp: 2500, vol: 0.22 * v, rev: 0.3 }); },
    go(v) { tone(1047, 0.8, { type: 'square', lp: 3500, vol: 0.24 * v, rev: 0.4 }); tone(1568, 0.8, { type: 'square', lp: 3500, vol: 0.12 * v }); },
    lap(v) { const d = out(0.18 * v, 0, sfxBus, 0.35);[72, 76, 79, 84].forEach((m, i) => tone(mtof(m), 0.16, { type: 'square', lp: 3500, dest: d, t: now() + i * 0.08 })); },
    finallap(v) { const d = out(0.2 * v, 0, sfxBus, 0.4);[[67, 0], [72, .1], [76, .2], [79, .3], [84, .45], [79, .6], [84, .72]].forEach(([m, t]) => { tone(mtof(m), 0.16, { type: 'square', lp: 3000, dest: d, t: now() + t }); tone(mtof(m - 12), 0.16, { type: 'sawtooth', lp: 1500, dest: d, t: now() + t }); }); },
    finish(v) { const d = out(0.22 * v, 0, sfxBus, 0.45);[[72, 0, .12], [72, .14, .12], [72, .28, .12], [76, .42, .5], [74, .95, .14], [76, 1.1, .14], [79, 1.25, .9]].forEach(([m, t, l]) => { tone(mtof(m), l, { type: 'square', lp: 3200, dest: d, t: now() + t }); tone(mtof(m - 5), l, { type: 'triangle', dest: d, t: now() + t }); }); },
    lose(v) { const d = out(0.2 * v, 0, sfxBus, 0.3);[[67, 0], [66, .35], [65, .7]].forEach(([m, t]) => tone(mtof(m - 12), 0.32, { type: 'sawtooth', lp: 900, dest: d, t: now() + t })); tone(mtof(52), 1.0, { type: 'sawtooth', lp: 700, to: mtof(50), dest: d, t: now() + 1.05 }); },
    cheer(v) { for (let i = 0; i < 4; i++) noise(2.4, { f: 900 + i * 500, q: 0.6, vol: 0.12 * v, a: 0.25 + i * 0.1 }); for (let i = 0; i < 14; i++) noise(0.18, { f: rand(700, 2400), q: 6, vol: 0.06 * v, t: now() + rand(0, 1.8), pan: rand(-0.8, 0.8) }); for (let i = 0; i < 6; i++) tone(rand(900, 1600), 0.3, { to: rand(1400, 2200), vol: 0.04 * v, t: now() + rand(0, 1.5), pan: rand(-0.7, 0.7) }); },
    menu(v) { tone(880, 0.05, { type: 'square', lp: 3000, vol: 0.08 * v }); },
    ok(v) { tone(988, 0.07, { type: 'square', lp: 3000, vol: 0.1 * v }); tone(1480, 0.14, { type: 'square', lp: 3000, vol: 0.1 * v, t: now() + 0.07 }); },
    back(v) { tone(660, 0.1, { type: 'square', to: 440, lp: 2500, vol: 0.08 * v }); },
    trick(v, p, n = 0) { const m = 1 + 0.18 * n; tone(420 * m, 0.25, { to: 1250 * m, slide: 0.2, type: 'triangle', vol: 0.18 * v, pan: p }); const d = out(0.1 * v, p, sfxBus, 0.3);[2093, 2637, 3136].forEach((f, i) => tone(f, 0.1, { dest: d, t: now() + 0.15 + i * 0.05 })); },
    splash(v, p) { noise(0.6, { ft: 'lowpass', f: 2500, to: 300, vol: 0.5 * v, pan: p }); for (let i = 0; i < 5; i++) tone(rand(400, 900), 0.06, { to: rand(900, 1500), vol: 0.08 * v, t: now() + 0.1 + i * 0.07, pan: p }); },
    rescue(v, p) { tone(600, 0.25, { to: 900, type: 'triangle', vol: 0.1 * v, pan: p }); tone(900, 0.25, { to: 1350, type: 'triangle', vol: 0.08 * v, t: now() + 0.25, pan: p }); },
    pop(v, p) { tone(500, 0.08, { to: 1200, vol: 0.14 * v, pan: p }); },
    dirt(v, p) { noise(0.06, { ft: 'lowpass', f: 700, vol: 0.05 * v, pan: p }); },
    revbeep(v, p) { tone(980, 0.11, { type: 'square', lp: 2400, vol: 0.05 * v, pan: p }); },
    draft(v, p) { noise(0.35, { f: 600, to: 3200, q: 1.2, vol: 0.14 * v, pan: p }); },
    boing(v, p) { tone(180, 0.35, { to: 420, type: 'sine', vol: 0.2 * v, pan: p, slide: 0.12 }); },
  };
  A.play = (name, o = {}) => {
    if (!A.ready || ctx.state !== 'running') return;
    const f = SFX[name]; if (!f) return;
    let v = o.vol ?? 1, p = o.pan || 0;
    if (o.pos) { const s = spatial(o.pos, o.range || 70); v *= s.vol; p = s.pan; if (v < 0.02) return; }
    try { f(v, p, o.stage); } catch (e) { }
  };
  // ---------------------------------------------------------------- loops (engines, drift squeal, siren, wind)
  const loops = { eng: [], squeal: null, wind: null, siren: null };
  function mkEngine(player) {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator(); o1.type = 'sawtooth'; o2.type = 'square'; o3.type = 'triangle';
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2.5;
    const g = ctx.createGain(); g.gain.value = 0; const pan = ctx.createStereoPanner();
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 22; lg.gain.value = 6; lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
    const m2 = ctx.createGain(); m2.gain.value = 0.6; const m3 = ctx.createGain(); m3.gain.value = 0.5;
    o1.connect(f); o2.connect(m2); m2.connect(f); o3.connect(m3); m3.connect(f); f.connect(g); g.connect(pan); pan.connect(engBus);
    [o1, o2, o3, lfo].forEach(o => o.start());
    return { o1, o2, o3, f, g, pan, player };
  }
  function buildLoops() {
    loops.eng = [mkEngine(true), mkEngine(false), mkEngine(false), mkEngine(false)];
    // drift squeal: detuned saws through narrow band + tremolo
    {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(); o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.value = 1150; o2.frequency.value = 1190;
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 3;
      const ng = ctx.createGain(); ng.gain.value = 0.5; src.connect(ng); ng.connect(bp);
      const og = ctx.createGain(); og.gain.value = 0.18; o.connect(og); o2.connect(og); og.connect(bp);
      const trem = ctx.createGain(); trem.gain.value = 0.7; const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 13; lg.gain.value = 0.3; lfo.connect(lg); lg.connect(trem.gain);
      const g = ctx.createGain(); g.gain.value = 0; bp.connect(trem); trem.connect(g); g.connect(sfxBus);
      [o, o2, src, lfo].forEach(x => x.start());
      loops.squeal = { g, o, o2, bp };
    }
    // wind / speed rush
    {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.5;
      const g = ctx.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(sfxBus); src.start();
      loops.wind = { g, f };
    }
    // blue shell siren
    {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 800;
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 3; lg.gain.value = 260; lfo.connect(lg); lg.connect(o.frequency);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400;
      const g = ctx.createGain(); g.gain.value = 0; o.connect(f); f.connect(g); g.connect(sfxBus); o.start(); lfo.start();
      loops.siren = { g };
    }
  }
  const set = (p, v, t = 0.05) => p.setTargetAtTime(v, ctx.currentTime, t);
  // engines: list = [{rpm, load, pos, player}] (player first)
  A.engines = (list) => {
    if (!A.ready || ctx.state !== 'running') return;
    for (let i = 0; i < loops.eng.length; i++) {
      const e = loops.eng[i], k = list[i];
      if (!k) { set(e.g.gain, 0); continue; }
      const base = (k.pitch || 1) * (48 + k.rpm * 150);
      set(e.o1.frequency, base, 0.03); set(e.o2.frequency, base * 0.5, 0.03); set(e.o3.frequency, base * 2.01, 0.03);
      set(e.f.frequency, 380 + 2600 * k.rpm * (0.4 + 0.6 * k.load), 0.05);
      let vol, pan = 0;
      if (k.player) vol = 0.16 + 0.1 * k.load; else { const s = spatial(k.pos, 55); vol = 0.16 * s.vol; pan = s.pan; }
      set(e.g.gain, vol * (k.mute ? 0 : 1), 0.08); set(e.pan.pan, pan, 0.08);
    }
  };
  A.squeal = (amt, pitch = 1) => { if (!A.ready || !loops.squeal) return; set(loops.squeal.g.gain, amt * 0.12, 0.06); set(loops.squeal.o.frequency, 1100 * pitch, 0.1); set(loops.squeal.o2.frequency, 1150 * pitch, 0.1); set(loops.squeal.bp.frequency, 1700 * pitch, 0.1); };
  A.wind = (amt) => { if (!A.ready || !loops.wind) return; set(loops.wind.g.gain, amt * 0.2, 0.2); set(loops.wind.f.frequency, 500 + amt * 1400, 0.2); };
  A.siren = (vol) => { if (!A.ready || !loops.siren) return; set(loops.siren.g.gain, vol * 0.06, 0.1); };
  A.silenceLoops = () => { if (!A.ready) return; A.engines([]); A.squeal(0); A.wind(0); A.siren(0); };

  // ---------------------------------------------------------------- MUSIC SEQUENCER
  // channel: { inst, res (16ths per token), vol, bars: [ 'tok tok ...', ... ] }  tokens: note | a:b:c chord | '.' hold | '-' rest | drum letters
  const INST = {
    steel(t, f, d, v, dest) { const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(); c.frequency.value = f; m.frequency.value = f * 2.0; mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.1, t + 0.25); m.connect(mg); mg.connect(c.frequency); env(g, t, 0.004, v, Math.min(0.9, d + 0.35)); c.connect(g); g.connect(dest); c.start(t); m.start(t); c.stop(t + d + 0.5); m.stop(t + d + 0.5); },
    lead(t, f, d, v, dest) { const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter(); o.type = 'square'; o2.type = 'sawtooth'; o.frequency.value = f; o2.frequency.value = f * 1.004; fl.type = 'lowpass'; fl.frequency.value = Math.min(9000, f * 5); const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5.5; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.012, t + 0.25); vib.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.012); g.gain.setValueAtTime(v * 0.75, t + Math.max(0.03, d - 0.03)); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.08); const og = ctx.createGain(); og.gain.value = 0.5; o2.connect(og); o.connect(fl); og.connect(fl); fl.connect(g); g.connect(dest);[o, o2, vib].forEach(x => { x.start(t); x.stop(t + d + 0.15); }); },
    brass(t, f, d, v, dest) { const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter(); o.type = o2.type = 'sawtooth'; o.frequency.value = f; o2.frequency.value = f * 0.996; fl.type = 'lowpass'; fl.Q.value = 3; fl.frequency.setValueAtTime(f * 1.2, t); fl.frequency.linearRampToValueAtTime(f * 7, t + 0.06); fl.frequency.exponentialRampToValueAtTime(f * 2.5, t + d + 0.05); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.02); g.gain.setValueAtTime(v * 0.8, t + Math.max(0.04, d - 0.04)); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.1); o.connect(fl); o2.connect(fl); fl.connect(g); g.connect(dest);[o, o2].forEach(x => { x.start(t); x.stop(t + d + 0.15); }); },
    bass(t, f, d, v, dest) { const o = ctx.createOscillator(), s = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter(); o.type = 'sawtooth'; s.type = 'sine'; o.frequency.value = f; s.frequency.value = f; fl.type = 'lowpass'; fl.frequency.setValueAtTime(f * 8, t); fl.frequency.exponentialRampToValueAtTime(f * 2, t + 0.15); fl.Q.value = 4; env(g, t, 0.006, v, d + 0.05); const sg = ctx.createGain(); sg.gain.value = 1.1; o.connect(fl); fl.connect(g); s.connect(sg); sg.connect(g); g.connect(dest);[o, s].forEach(x => { x.start(t); x.stop(t + d + 0.1); }); },
    pluck(t, f, d, v, dest) { const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.setValueAtTime(f * 9, t); fl.frequency.exponentialRampToValueAtTime(f * 1.3, t + 0.18); env(g, t, 0.004, v, Math.min(d, 0.3)); o.connect(fl); fl.connect(g); g.connect(dest); o.start(t); o.stop(t + d + 0.1); },
    pad(t, f, d, v, dest) { const g = ctx.createGain(), fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1400; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.25); g.gain.setValueAtTime(v, t + d * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.4); fl.connect(g); g.connect(dest); for (const dt of [-7, 0, 7]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt; o.connect(fl); o.start(t); o.stop(t + d + 0.5); } },
    arp(t, f, d, v, dest) { const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter(); o.type = 'square'; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = 3200; env(g, t, 0.003, v, Math.min(0.12, d)); o.connect(fl); fl.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.2); },
    bell(t, f, d, v, dest) { const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; o2.frequency.value = f * 3.01; env(g, t, 0.003, v, 0.9); const g2 = ctx.createGain(); g2.gain.value = 0.25; o.connect(g); o2.connect(g2); g2.connect(g); g.connect(dest); o.start(t); o2.start(t); o.stop(t + 1); o2.stop(t + 1); },
    marimba(t, f, d, v, dest) { const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; o2.frequency.value = f * 4; env(g, t, 0.002, v, 0.35); const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.3, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.05); o.connect(g); o2.connect(g2); g2.connect(g); g.connect(dest); o.start(t); o2.start(t); o.stop(t + 0.4); o2.stop(t + 0.4); },
  };
  const DRUM = {
    k(t, v, d) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); env(g, t, 0.002, v * 1.1, 0.26); o.connect(g); g.connect(d); o.start(t); o.stop(t + 0.3); },
    s(t, v, d) { noise(0.16, { t, f: 2200, q: 0.7, vol: v * 0.55, dest: d }); const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.08); env(g, t, 0.002, v * 0.4, 0.1); o.connect(g); g.connect(d); o.start(t); o.stop(t + 0.15); },
    c(t, v, d) { for (let i = 0; i < 3; i++) noise(0.03 + (i === 2 ? 0.12 : 0), { t: t + i * 0.012, f: 1400, q: 1.2, vol: v * 0.5, dest: d }); },
    h(t, v, d) { noise(0.035, { t, ft: 'highpass', f: 7500, vol: v * 0.3, dest: d }); },
    o(t, v, d) { noise(0.2, { t, ft: 'highpass', f: 6500, vol: v * 0.28, dest: d }); },
    x(t, v, d) { noise(0.05, { t, f: 5500, q: 2, vol: v * 0.16, dest: d }); },
    t(t, v, d) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(330, t); o.frequency.exponentialRampToValueAtTime(220, t + 0.12); env(g, t, 0.002, v * 0.5, 0.16); o.connect(g); g.connect(d); o.start(t); o.stop(t + 0.2); },
    u(t, v, d) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.12); env(g, t, 0.002, v * 0.5, 0.18); o.connect(g); g.connect(d); o.start(t); o.stop(t + 0.22); },
    r(t, v, d) { noise(0.9, { t, ft: 'highpass', f: 5000, vol: v * 0.2, dest: d, a: 0.01 }); },
  };
  const rep = (s, n) => Array(n).fill(s);
  const SONGS = {
    title: {
      bpm: 128, bars: 8, ch: [
        { inst: 'lead', res: 2, vol: 0.11, bars: ['E5 G5 C6 G5 E5 . G5 .', 'A5 . C6 . E6 . C6 A5', 'F5 A5 C6 A5 F5 . A5 .', 'G5 . B5 . D6 . B5 G5', 'E5 G5 C6 G5 E6 . D6 C6', 'A5 . C6 . E6 . G6 .', 'F6 . E6 D6 C6 . A5 .', 'G5 . B5 D6 C6 . - -'] },
        { inst: 'bass', res: 2, vol: 0.2, bars: ['C2 . C3 . G2 . C3 .', 'A1 . A2 . E2 . A2 .', 'F1 . F2 . C2 . F2 .', 'G1 . G2 . D2 . G2 .', 'C2 . C3 . G2 . C3 .', 'A1 . A2 . E2 . A2 .', 'F1 . F2 . C2 . F2 .', 'G1 . G2 . B1 . C2 .'] },
        { inst: 'pluck', res: 2, vol: 0.06, bars: ['- C4:E4:G4 - C4:E4:G4 - C4:E4:G4 - C4:E4:G4', '- A3:C4:E4 - A3:C4:E4 - A3:C4:E4 - A3:C4:E4', '- F3:A3:C4 - F3:A3:C4 - F3:A3:C4 - F3:A3:C4', '- G3:B3:D4 - G3:B3:D4 - G3:B3:D4 - G3:B3:D4'] },
        { inst: 'marimba', res: 1, vol: 0.07, bars: ['C6 - G5 - E5 - G5 - C6 - G5 - E6 - G5 -', 'A5 - E5 - C5 - E5 - A5 - E5 - C6 - E5 -', 'F5 - C5 - A4 - C5 - F5 - C5 - A5 - C5 -', 'G5 - D5 - B4 - D5 - G5 - D5 - B5 - D5 -'] },
        { drum: true, res: 1, vol: 0.5, bars: ['k - h - s - h k k - h - s - h -', 'k - h - s - h - k - h k s - h h'] },
      ]
    },
    beach: {
      bpm: 138, bars: 8, ch: [
        { inst: 'steel', res: 2, vol: 0.16, bars: ['C6 A5 F5 A5 C6 - D6 C6', 'Bb5 . D6 . F6 - D6 Bb5', 'C6 . E6 G6 . E6 C6 G5', 'A5 . F5 . - - C5 -', 'D6 C6 A5 F5 D6 . C6 A5', 'Bb5 . A5 G5 F5 . D5 F5', 'G5 A5 Bb5 C6 E6 . G6 .', 'F6 . C6 A5 F5 - - -'] },
        { inst: 'bass', res: 2, vol: 0.2, bars: ['F2 . - C3 F2 - C3 -', 'Bb1 . - F2 Bb1 - F2 -', 'C2 . - G2 C2 - G2 -', 'F2 . - C3 F2 - E2 -', 'D2 . - A2 D2 - A2 -', 'Bb1 . - F2 Bb1 - F2 -', 'C2 . - G2 C2 - Bb2 -', 'F2 . - C3 F2 - A2 C3'] },
        { inst: 'pluck', res: 2, vol: 0.05, bars: ['- F4:A4:C5 - F4:A4:C5 - F4:A4:C5 - F4:A4:C5', '- F4:Bb4:D5 - F4:Bb4:D5 - F4:Bb4:D5 - F4:Bb4:D5', '- E4:G4:C5 - E4:G4:C5 - E4:G4:C5 - E4:G4:C5', '- F4:A4:C5 - F4:A4:C5 - F4:A4:C5 - F4:A4:C5', '- D4:F4:A4 - D4:F4:A4 - D4:F4:A4 - D4:F4:A4', '- F4:Bb4:D5 - F4:Bb4:D5 - F4:Bb4:D5 - F4:Bb4:D5', '- E4:G4:Bb4 - E4:G4:Bb4 - E4:G4:Bb4 - E4:G4:Bb4', '- F4:A4:C5 - F4:A4:C5 - F4:A4:C5 - F4:A4:C5'] },
        { inst: 'marimba', res: 1, vol: 0.05, bars: ['- - - - F5 - - A5 - - C6 - - - - -', '- - - - D6 - - F6 - - D6 - - - - -'] },
        { drum: true, res: 1, vol: 0.5, bars: ['k x h x k t h x k x h t k x h x', 'k x h t k x h x k t h x k t u t'] },
        { drum: true, res: 1, vol: 0.35, bars: ['- - - - c - - - - - - - c - - -'] },
      ]
    },
    rainbow: {
      bpm: 148, bars: 8, ch: [
        { inst: 'brass', res: 2, vol: 0.1, bars: ['E5 . A5 . B5 C6 . B5', 'A5 . F5 . C6 . A5 .', 'G5 . E5 G5 C6 . D6 E6', 'D6 . B5 . G5 . - -', 'C6 . A5 C6 F6 . E6 C6', 'D6 . B5 D6 G6 . F6 D6', 'E6 . D6 B5 G5 . B5 D6', 'C6 . B5 . A5 - - -'] },
        { inst: 'arp', res: 1, vol: 0.05, bars: ['A4 C5 E5 A5 E5 C5 A4 C5 E5 A5 C6 A5 E5 C5 E5 A5', 'F4 A4 C5 F5 C5 A4 F4 A4 C5 F5 A5 F5 C5 A4 C5 F5', 'C5 E5 G5 C6 G5 E5 C5 E5 G5 C6 E6 C6 G5 E5 G5 C6', 'G4 B4 D5 G5 D5 B4 G4 B4 D5 G5 B5 G5 D5 B4 D5 G5', 'F4 A4 C5 F5 C5 A4 F4 A4 C5 F5 A5 F5 C5 A4 C5 F5', 'G4 B4 D5 G5 D5 B4 G4 B4 D5 G5 B5 G5 D5 B4 D5 G5', 'E4 G4 B4 E5 B4 G4 E4 G4 B4 E5 G5 E5 B4 G4 B4 E5', 'A4 C5 E5 A5 E5 C5 A4 C5 E5 A5 C6 A5 E5 C5 E5 A5'] },
        { inst: 'bass', res: 2, vol: 0.2, bars: ['A1 A2 A1 A2 A1 A2 A1 A2', 'F1 F2 F1 F2 F1 F2 F1 F2', 'C2 C3 C2 C3 C2 C3 C2 C3', 'G1 G2 G1 G2 G1 G2 G1 G2', 'F1 F2 F1 F2 F1 F2 F1 F2', 'G1 G2 G1 G2 G1 G2 G1 G2', 'E1 E2 E1 E2 E1 E2 E1 E2', 'A1 A2 A1 A2 A1 A2 E2 G2'] },
        { inst: 'pad', res: 16, vol: 0.035, bars: ['A3:C4:E4', 'F3:A3:C4', 'C4:E4:G4', 'G3:B3:D4', 'F3:A3:C4', 'G3:B3:D4', 'E3:G3:B3', 'A3:C4:E4'] },
        { inst: 'bell', res: 4, vol: 0.05, bars: ['E6 - A6 -', 'C7 - - -', 'G6 - E6 -', 'D7 - - -'] },
        { drum: true, res: 1, vol: 0.5, bars: ['k h o h s h o h k h o h s h o h', 'k h o h s h o h k h o h s h o c'] },
      ]
    },
    results: {
      bpm: 116, bars: 4, ch: [
        { inst: 'brass', res: 2, vol: 0.1, bars: ['G5 . B5 D6 G6 . . D6', 'E6 . C6 . G5 . C6 .', 'D6 . F#6 . A6 . F#6 D6', 'G6 . . . D6 . B5 .'] },
        { inst: 'bass', res: 2, vol: 0.2, bars: ['G1 . G2 . D2 . G2 .', 'C2 . C3 . G2 . C3 .', 'D2 . D3 . A2 . D3 .', 'G1 . G2 . D2 . B1 .'] },
        { inst: 'pad', res: 16, vol: 0.04, bars: ['G3:B3:D4', 'C4:E4:G4', 'D4:F#4:A4', 'G3:B3:D4'] },
        { inst: 'marimba', res: 1, vol: 0.06, bars: ['G5 - D5 - B5 - D5 - G5 - D5 - B5 - D5 -', 'E5 - C5 - G5 - C5 - E5 - C5 - G5 - C5 -', 'F#5 - D5 - A5 - D5 - F#5 - D5 - A5 - D5 -', 'G5 - D5 - B5 - D5 - G5 - D5 - B5 - D5 -'] },
        { drum: true, res: 1, vol: 0.45, bars: ['k - h - s - h - k - h k s - h -'] },
      ]
    },
  };
  // compile songs into per-step event lists
  for (const id in SONGS) {
    const S = SONGS[id], total = S.bars * 16; S.total = total; S.steps = Array.from({ length: total }, () => []);
    for (const ch of S.ch) {
      const toks = []; for (let b = 0; b < S.bars; b++) toks.push(...ch.bars[b % ch.bars.length].trim().split(/\s+/));
      for (let i = 0; i < toks.length; i++) {
        const tk = toks[i], st = i * ch.res; if (st >= total || tk === '.' || tk === '-') continue;
        if (ch.drum) { for (const c of tk) if (DRUM[c]) S.steps[st].push({ drum: c, vol: ch.vol }); continue; }
        let len = ch.res; for (let j = i + 1; j < toks.length && toks[j] === '.'; j++) len += ch.res;
        const notes = tk.split(':').map(nn).filter(x => x !== null);
        for (const m of notes) S.steps[st].push({ inst: ch.inst, f: mtof(m), len, vol: ch.vol });
      }
    }
  }
  const mus = { song: null, step: 0, next: 0, tempo: 1, timer: null, star: false, gain: null };
  function tick() {
    if (!mus.song || !ctx || ctx.state !== 'running') return;
    const S = mus.song; const sd = 60 / (S.bpm * mus.tempo) / 4;
    if (mus.next < ctx.currentTime - 0.2) mus.next = ctx.currentTime + 0.05;
    while (mus.next < ctx.currentTime + 0.15) {
      const t = mus.next;
      for (const e of S.steps[mus.step]) {
        if (e.drum) DRUM[e.drum](t, e.vol, mus.gain); else INST[e.inst](t, e.f, e.len * sd * 0.95, e.vol, mus.gain);
      }
      if (mus.star && mus.step % 2 === 0) { const sc = [72, 76, 79, 84, 88, 84, 79, 76]; INST.arp(t, mtof(sc[(mus.step / 2) % 8] + 12), sd, 0.035, mus.gain); if (mus.step % 4 === 0) DRUM.k(t, 0.25, mus.gain); }
      mus.next += sd; mus.step = (mus.step + 1) % S.total;
    }
  }
  A.music = (id, fade = 0.4) => {
    if (!A.ready) { A._pendingMusic = id; return; }
    if (mus.gain) { const g = mus.gain; g.gain.setTargetAtTime(0, ctx.currentTime, fade / 3); setTimeout(() => g.disconnect(), fade * 1000 + 400); }
    mus.song = SONGS[id] || null; mus.step = 0; mus.tempo = 1; mus.star = false;
    if (!mus.song) { mus.gain = null; return; }
    mus.gain = ctx.createGain(); mus.gain.gain.value = 1; mus.gain.connect(musBus);
    const s = ctx.createGain(); s.gain.value = 0.35; mus.gain.connect(s); s.connect(verbSend);
    mus.next = ctx.currentTime + 0.1;
    if (!mus.timer) mus.timer = setInterval(tick, 25);
  };
  A.tempo = m => { mus.tempo = m; };
  A.starMusic = on => { mus.star = on; };
  A.musicVol = v => { if (musBus) musBus.gain.setTargetAtTime(0.42 * A.vol.music * v, ctx.currentTime, 0.2); };
  setInterval(() => { if (A._pendingMusic && A.ready) { const m = A._pendingMusic; A._pendingMusic = null; A.music(m); } }, 200);
  return A;
})();
late.Audio_ = Audio_;


