// 11_ai.js (Kart Party Deluxe)
import * as THREE from 'three';
import { clamp, damp, grand } from './01_core.js';
import { F_GAP, F_LAUNCH, F_LOOP, F_WALL_L, F_WALL_R, SURF } from './04_track.js';
import { PHYS, RaceCtl, World, startRescue } from './09_kart.js';
import { Items } from './10_items.js';

// ============================================================================
// AI — racing line pursuit, drifting with sparks, items, dodging, rubber-banding, unsticking
// ============================================================================
const _av = [0, 1, 2, 3, 4].map(() => new THREE.Vector3());
// Personnalités : aggr = rapidité à tirer, risk = goût des tricks, tidy = soin à éviter les obstacles.
export const PERSONAS = [
  { name: 'agressif', aggr: 0.9, risk: 0.8, tidy: 0.7 },
  { name: 'prudent', aggr: 0.3, risk: 0.2, tidy: 1.25 },
  { name: 'show-off', aggr: 0.5, risk: 1, tidy: 0.9 },
  { name: 'équilibré', aggr: 0.55, risk: 0.5, tidy: 1 },
];
export const AI = {
  setup(k, skill, persona = PERSONAS[3]) { k.ai = { skill, aggr: persona.aggr, risk: persona.risk, tidy: persona.tidy, persona: persona.name, lane: grand(-1.6, 1.6), laneT: grand(2, 5), driftCool: grand(0, 1), stuckT: 0, revT: 0, itemT: 0, hop: 0, holdDrift: false, fight: 0, dodge: 0, dodgeT: 0, wantStage: skill > 0.6 ? 2 : 1 }; },
  turnAhead(T, i, n) { // signed heading change (left +) over n samples
    const a = T.wrap(i), b = T.wrap(i + n);
    const ax = T.tx[a], az = T.tz[a], bx = T.tx[b], bz = T.tz[b];
    const cr = az * bx - ax * bz, dt = ax * bx + az * bz; return Math.atan2(cr, dt);
  },
  think(k, karts, dt, player) {
    const T = World.track, a = k.ai, inp = k.input; if (!a) return;
    inp.item = false;
    if (k.rescue) { inp.throttle = 0; inp.drift = false; return; }
    const up = k.up, fwd = k.fwd, right = _av[0].crossVectors(fwd, up).normalize();
    const vF = k.vel.dot(fwd);
    // lane wander
    a.laneT -= dt; if (a.laneT < 0) { a.laneT = grand(2.5, 6); a.lane = grand(-1.8, 1.8) * (1 - a.skill * 0.4); }
    // dodge obstacles / karts ahead
    a.dodgeT -= dt; if (a.dodgeT <= 0) a.dodge = damp(a.dodge, 0, 2, dt);
    for (const p of Items.proj) {
      if (p.type !== 'banana' && p.type !== 'green') continue;
      const rel = _av[1].copy(p.pos).sub(k.pos); const z = rel.dot(fwd), x = rel.dot(right);
      if (z > 3 && z < 22 && Math.abs(x) < 2.2) { a.dodge = (x > 0 ? -3 : 3) * a.tidy; a.dodgeT = 0.6; }
    }
    for (const o of karts) { if (o === k) continue; const rel = _av[1].copy(o.pos).sub(k.pos); const z = rel.dot(fwd), x = rel.dot(right); if (z > 1.5 && z < 9 && Math.abs(x) < 1.9 && o.vel.dot(fwd) < vF - 2) { a.dodge = x > 0 ? -2.6 : 2.6; a.dodgeT = 0.4; } }
    // pursuit target
    const look = 7 + Math.max(0, vF) * 0.5;
    const j = T.wrap(k.ti + Math.round(look / T.ds));
    const hw = T.hw[j], fl = T.flags[j];
    let lat = T.line[j] * 0.92 + a.lane * (1 - Math.abs(T.line[j]) / Math.max(1, hw)) + a.dodge;
    const lim = (fl & (F_GAP | F_LAUNCH | F_LOOP)) ? 1.8 : hw - ((fl & (F_WALL_L | F_WALL_R)) === (F_WALL_L | F_WALL_R) ? 1.6 : 3.2); lat = clamp(lat, -lim, lim);
    if (k.finishedLock) lat = T.line[j] * 0.5;
    const tgt = T.point(j, lat, 0, _av[2]);
    const to = tgt.sub(k.pos); const lx = to.dot(right), lz = to.dot(fwd);
    let ang = Math.atan2(lx, Math.max(0.1, lz)); if (lz < 0) ang = lx > 0 ? 1.6 : -1.6;
    let steer = clamp(ang * 2.6, -1, 1), throttle = 1, brake = 0;
    if (Math.abs(ang) > 0.95 && vF > 16) { throttle = 0; brake = 0.4; }
    // outside the corridor: head back
    if (k.side !== 0) { const back = T.point(k.ti, 0, 0, _av[3]).sub(k.pos); steer = clamp(Math.atan2(back.dot(right), Math.max(0.1, back.dot(fwd))) * 3, -1, 1); }
    // drifting
    a.driftCool -= dt;
    const turn = this.turnAhead(T, k.ti + 6, 42), turnNear = this.turnAhead(T, k.ti + 2, 18);
    let drift = false;
    if (!k.drift && a.hop <= 0 && a.driftCool <= 0 && k.grounded && vF > 17 && Math.abs(turn) > 0.55 && !(fl & (F_GAP | F_LAUNCH | F_LOOP)) && !k.finishedLock && k.spinT <= 0) {
      a.hop = 0.3; a.hopDir = Math.sign(turn); a.driftCool = 1.2;
    }
    if (a.hop > 0) { a.hop -= dt; drift = a.hop < 0.28; steer = -a.hopDir * 0.9; if (a.hop <= 0 && !k.drift) a.driftCool = 0.8; }
    if (k.drift) {
      drift = true;
      if (ang * k.drift * -1 > 0.45) a.fight += dt; else a.fight = 0;      // the needed steer fights the drift direction
      const ending = Math.abs(turnNear) < 0.12 && Math.abs(turn) < 0.3;
      if ((ending && k.stage >= 1) || a.fight > 0.3 || (k.stage >= a.wantStage && Math.abs(turnNear) < 0.2) || k.charge > 4.2) { drift = false; a.driftCool = 0.7; }
    }
    // tricks off ramp lips
    if (!k.grounded && k.trickWin > PHYS.TRICK_WIN - 0.4 && k.trickCount === 0) { if (a.trickPress == null) a.trickPress = grand() < 0.35 + a.skill * 0.6 + (a.risk - 0.5) * 0.3; if (a.trickPress) drift = true; }
    else if (k.grounded) a.trickPress = null;
    // stuck handling
    if (RaceCtl.canDrive && k.spinT <= 0 && k.tumbleT <= 0 && Math.abs(vF) < 2 && !k.finishedLock) a.stuckT += dt; else a.stuckT = Math.max(0, a.stuckT - dt * 2);
    if (a.stuckT > 1.3 && a.revT <= 0) { a.revT = 0.9; }
    if (a.revT > 0) { a.revT -= dt; throttle = 0; brake = 1; steer = -steer; drift = false; if (a.revT <= 0) a.stuckT = 0.4; }
    if (a.stuckT > 6) { startRescue(k); a.stuckT = 0; }
    inp.throttle = throttle; inp.brake = brake; inp.steer = steer; inp.drift = drift; inp.back = false;
    // items
    if (k.item && k.rollT <= 0 && !k.finishedLock) {
      a.itemT += dt; let use = false, back = false;
      const it = k.item;
      const ahead = karts.find(o => o !== k && !o.rescue && (() => { const r = _av[4].copy(o.pos).sub(k.pos); const z = r.dot(fwd); return z > 4 && z < 32 && Math.abs(r.dot(right)) < z * 0.2; })());
      const behind = karts.find(o => o !== k && !o.rescue && (() => { const r = _av[4].copy(o.pos).sub(k.pos); const z = r.dot(fwd); return z < -2 && z > -18 && Math.abs(r.dot(right)) < 4; })());
      if (it === 'mushroom' || it === 'triple') use = (Math.abs(turn) < 0.25 && vF > 12 && a.itemT > 0.8) || (k.surf !== SURF.road && k.grounded && a.itemT > 0.3) || a.itemT > 8;
      else if (it === 'green') { if (ahead && a.itemT > 1.4 - a.aggr) use = true; else if (behind && a.itemT > 1) { use = true; back = true; } else if (a.itemT > 8) use = true; }
      else if (it === 'red') { if (k.place > 1 && a.itemT > (0.8 + (1 - a.skill) * 1.5) * (1.5 - a.aggr)) use = true; else if (k.place === 1 && behind && a.itemT > 1) { use = true; back = true; } else if (a.itemT > 9) use = true; }
      else if (it === 'banana') { if (behind && a.itemT > 0.6) { use = true; back = true; } else if (a.itemT > 2.5) use = true; }   // 28 : bouclier par défaut, banane lâchée seulement derrière un poursuivant
      else if (it === 'star' || it === 'blue') use = a.itemT > 0.7 + grand(0, 0.02) * 40;
      else if (it === 'lightning') use = a.itemT > 1.2;
      if (use && k.spinT <= 0) { inp.item = true; inp.back = back; a.itemT = it === 'triple' && k.itemCount > 1 ? -0.8 : 0; }
    } else a.itemT = 0;
    // rubber band against the player
    if (player && !k.finishedLock) {
      const diff = k.progress - player.progress;
      let rb = diff > 0 ? 1 - clamp(diff / 320, 0, 0.075) : 1 + clamp(-diff / 260, 0, 0.07);
      k.rubber = rb * (0.975 + a.skill * 0.035);
    } else if (k.finishedLock) k.rubber = 0.8;
  },
};


