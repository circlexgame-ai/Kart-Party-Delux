// 09_kart.js (Kart Party Deluxe)
import { late } from './00_registry.js';
import { Bus } from './00_bus.js';
import * as THREE from 'three';
import { COL, V3, camera, clamp, damp, grand, rand, smooth } from './01_core.js';
import { Audio_ } from './03_audio.js';
import { F_AGRAV, F_GAP, F_LAUNCH, F_NOSAFE, F_TRICK, F_WALL_L, F_WALL_R, SURF } from './04_track.js';
import { FX, TILE } from './05_fx.js';
import { DRIFT_COLS, KartVisual, STAT_PHYS, buildCloudy, cloudyLine, effStats } from './08_chars.js';

// ============================================================================
// KART — fixed-step arcade physics, drifting, tricks, walls, collisions, rescue
// ============================================================================
export const PHYS = {
  DT: 1 / 120, G_GROUND: 26, G_AIR: 17, G_HOP: 36,
  BASE_MAX: 30.5, ACCEL: 19.5, BRAKE: 34, REV_ACC: 20, REV_MAX: 12, REV_DELAY: 0.2, COAST: 3.2, BOOST_ACC: 48,
  TURN: 2.0, DRIFT_BASE: 0.5, DRIFT_ADJ: 0.45, GRIP: 15, GRIP_DRIFT: 5.5, GRIP_OFF: 9, OFF_GRASS: 0.52, OFF_SAND: 0.6,
  STAGES: [1.0, 2.15, 3.35], MT_DUR: [0.55, 1.0, 1.55], MT_MUL: [1.24, 1.3, 1.37],
  CHAIN_MAX: 3, CHAIN_GAP: 2.5, REV_HOLD: 0.35, TRICK_WIN: 2.0, TRICK_COOL: 0.5, TRICK_MAX: 3,
  SLIP_RANGE: 17, SLIP_MIN: 3, SLIP_WIDTH: 2.4, SLIP_TIME: 1.0, SLIP_BONUS: 1.07,   // aspiration derrière un kart
};
// Surfaces : adhérence latérale (grip), vitesse max conservée (max), reprise (acc), poussière émise.
// Le grip des pistes est modulé par World.roadGrip (Rainbow Road est plus glissante) et par les notes du personnage.
export const SURFX = {
  [SURF.road]: { grip: 1, max: 1, acc: 1, dust: null },
  [SURF.grass]: { grip: 0.7, max: PHYS.OFF_GRASS, acc: 0.72, dust: COL(0x9cc46a), dustSize: 0.55 },
  [SURF.sand]: { grip: 0.82, max: PHYS.OFF_SAND, acc: 0.58, dust: COL(0xf0dcaa), dustSize: 0.7 },
  [SURF.mud]: { grip: 0.55, max: 0.42, acc: 0.5, dust: COL(0x6b4a2c), dustSize: 0.6 },
  [SURF.ice]: { grip: 0.26, max: 1, acc: 0.65, dust: COL(0xdff6ff), dustSize: 0.35 },
};
export const BOOST_COL = { shroom: COL(0xff6a1a), pad: COL(0xffb21a), trick: COL(0xff8a2a), start: COL(0xff7a1a) };
const _pv = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(() => new THREE.Vector3());
export const _pq = new THREE.Quaternion(), _pm = new THREE.Matrix4(), _kt = new THREE.Vector3(), _kt2 = new THREE.Vector3();
export let World = null;      // current world (set by game)
export const Stats = { subSteps: 0, blockRescues: 0 };   // compteurs lus par le compteur de performance (F3) et les tests
export let RaceCtl = { canDrive: false, time: 0 };

export class Kart {
  constructor(idx, def, isPlayer) {
    this.idx = idx; this.def = def; this.isPlayer = isPlayer; this.name = def.name;
    this.phys = STAT_PHYS(def.stats); this.vis = new KartVisual(def);
    this.pos = V3(); this.prevPos = V3(); this.vel = V3(); this.fwd = V3(0, 0, -1); this.up = V3(0, 1, 0);
    this.q = new THREE.Quaternion(); this.prevQ = new THREE.Quaternion();
    this.loc = { P: V3(), T: V3(), N: V3(), B: V3() }; this.gN = V3(0, 1, 0);
    this.input = { throttle: 0, brake: 0, steer: 0, drift: false, item: false, back: false };
    this.reset();
  }
  reset() {
    this.grounded = false; this.airT = 0; this.airG = PHYS.G_AIR; this.ti = 0; this.side = 0; this.surf = SURF.road; this.onTerrain = false; this.flags = 0;
    this.drift = 0; this.charge = 0; this.stage = 0; this.hopping = false; this.hopDir = 0; this.hopWin = 0; this.prevDrift = true; this.prevItem = true;
    this.boostT = 0; this.boostMul = 1; this.boostCol = BOOST_COL.shroom; this.boostTot = 1;
    this.spinT = 0; this.tumbleT = 0; this.invulnT = 0; this.starT = 0; this.shrinkT = 0; this.size = 1; this.bShield = 0;
    this.coins = 0; this.item = null; this.itemCount = 0; this.rollT = 0; this.rollItem = null; this.itemCool = 0;
    this.trickWin = 0; this.trickDone = false; this.trickCount = 0; this.trickCool = 0; this.chainLvl = 0; this.chainT = 0; this.ctrT = 0; this.ctrCool = 0; this.skid = null; this.rescue = null; this.safeI = 0; this.safeD = 0;
    this.lapsDone = 0; this.progress = 0; this.prevS = 0; this.finished = false; this.finishTime = 0; this.place = 1;
    this.blockT = 0; this.revT = 0; this.reversing = false; this.rs = { tricks: 0, hits: 0, draft: 0, bestLap: 0, lapT0: 0, dirty: false }; this.slipT = 0; this.slipOn = 0; this.slipFx = 0; this.fxT = 0; this.yawNow = 0; this.landImpulse = 0; this.rubber = 1; this.wrongT = 0; this.vF = 0; this.accelNow = 0; this.padT = 0; this.stuckT = 0; this.lastHitBy = null;
    this.vel.set(0, 0, 0); this.hitFlash = 0; this.lookAng = null; this.lookT = 0; this.startBoostOk = false;
  }
  // Applique la personnalisation du poids (joueur seulement) : -1 léger, 0 équilibré, +1 lourd
  applyWeight(w) { this.phys = STAT_PHYS(effStats(this.def.stats, w)); }
  get speed() { return this.vel.length(); }
  radius() { return 1.0 * this.size; }
  mass() { return this.phys.mass * (this.starT > 0 ? 6 : 1) * (this.size < 0.9 ? 0.4 : 1); }
  place_(i, d) {  // put kart on the track at sample i, lateral d
    const T = World.track; const f = T.frame(i, 0, this.loc);
    this.pos.copy(f.P).addScaledVector(f.B, d); this.prevPos.copy(this.pos);
    this.fwd.copy(f.T); this.up.copy(f.N); this.gN.copy(f.N); this.ti = i; this.grounded = true; this.side = 0;
    this.updateQ(); this.prevQ.copy(this.q); this.safeI = i; this.safeD = d;
    this.prevS = i * T.ds;
  }
  updateQ() { const r = _pv[8].crossVectors(this.fwd, this.up).normalize(); const f = _pv[7].crossVectors(this.up, r).normalize(); _pm.makeBasis(r, this.up, f.negate()); this.q.setFromRotationMatrix(_pm); }
  giveBoost(dur, mul, col) {
    if (this.boostT <= 0) this.boostMul = mul; else this.boostMul = Math.max(this.boostMul, mul);
    this.boostT = Math.max(this.boostT, dur); this.boostTot = Math.max(dur, 0.3); this.boostCol = col;
    const vF = this.vel.dot(this.fwd), target = PHYS.BASE_MAX * this.phys.speed * mul;
    if (vF < target * 0.8) this.vel.addScaledVector(this.fwd, Math.min(12, target * 0.8 - vF));
  }
  hit(type, by) {
    if (this.rescue || this.finishedLock) return false;
    if (type !== 'shrink' && (this.invulnT > 0 || this.starT > 0)) return false;
    // bouclier de bananes (28) : absorbe un coup « spin » (carapaces, banane, chocs) et disparaît ; ni l'explosion bleue ni l'éclair ne sont arrêtés
    if (type === 'spin' && this.bShield > 0) { this.bShield = 0; this.invulnT = 0.5; FX.hitStars(_kt.copy(this.pos).addScaledVector(this.up, 1.4)); Audio_.play('bump', { pos: this.pos, vol: 0.8 }); Bus.emit('banana:block', { kart: this }); return true; }
    if (type === 'shrink') { if (this.starT > 0) return false; this.shrinkT = 7 - this.place * 0.35; this.spinT = Math.max(this.spinT, 0.7); this.item = null; this.itemCount = 0; this.rollT = 0; this.drift = 0; this.stage = 0; this.charge = 0; Audio_.play('shrink', { pos: this.pos }); return true; }
    this.drift = 0; this.charge = 0; this.stage = 0; this.boostT = 0; this.chainLvl = 0; this.chainT = 0; this.rs.dirty = true;
    if (type === 'tumble') { this.tumbleT = 1.7; this.vel.multiplyScalar(0.15); this.vel.addScaledVector(this.up, 9); this.invulnT = 2.4; }
    else { this.spinT = 1.25; this.vel.multiplyScalar(0.35); this.vel.addScaledVector(this.up, 3.2); this.invulnT = 1.7; }
    this.grounded = false; this.airG = PHYS.G_AIR;
    this.loseCoins(3); FX.hitStars(_kt.copy(this.pos).addScaledVector(this.up, 1.4));
    Audio_.play('hit', { pos: this.pos, vol: this.isPlayer ? 1.2 : 0.9 });
    this.vis.emote('upset', 2.2); this.hitFlash = 0.5;
    if (by && by !== this) { by.vis.emote('celebrate', 1.8); }
    if (this.isPlayer) late.Game.shake(0.6);
    return true;
  }
  loseCoins(n) {
    n = Math.min(this.coins, n); if (!n) return; this.coins -= n;
    for (let i = 0; i < n; i++) FX.add.emit(this.pos.x, this.pos.y + 1, this.pos.z, rand(-4, 4), rand(5, 9), rand(-4, 4), { life: 0.9, size: 0.5, color: COL(0xffd21a).multiplyScalar(2), grav: 22, tile: TILE.star, rv: 6 });
    if (this.isPlayer) Audio_.play('coinlose');
  }
  endDrift(give) {
    if (give && this.stage > 0) {
      // mini-turbo en chaîne : enchaîner un nouveau mini-turbo avant la fin du délai augmente le niveau de chaîne (durée et vitesse en plus)
      const s = this.stage - 1; this.chainLvl = this.chainT > 0 ? Math.min(PHYS.CHAIN_MAX, this.chainLvl + 1) : 0;
      const dur = PHYS.MT_DUR[s] * (1 + 0.12 * this.chainLvl); this.chainT = dur + PHYS.CHAIN_GAP;
      this.giveBoost(dur, PHYS.MT_MUL[s] + 0.02 * this.chainLvl, DRIFT_COLS[this.stage]);
      if (this.chainLvl > 0 && this.isPlayer) late.Game.message('CHAIN x' + (this.chainLvl + 1) + '!', 0.9);
      Audio_.play('mini', { pos: this.pos, stage: this.stage, vol: this.isPlayer ? 1 : 0.7 });
      FX.burst(_kt.copy(this.pos).addScaledVector(this.fwd, -1.3).addScaledVector(this.up, 0.6), 14 + s * 6, { color: DRIFT_COLS[this.stage].clone().multiplyScalar(3), sp: 7, life: 0.45, size: 0.25, tile: TILE.spark, stretch: 0.04, drag: 2 });
    }
    this.drift = 0; this.charge = 0; this.stage = 0;
  }
}

// ---------------------------------------------------------------- physics step
export function stepKart(k, dt) {
  const T = World.track, P = PHYS, st = k.phys;
  k.prevPos.copy(k.pos); k.prevQ.copy(k.q);
  k.invulnT -= dt; k.bounceT = (k.bounceT || 0) - dt; k.starT -= dt; k.spinT -= dt; k.tumbleT -= dt; k.trickWin -= dt; k.trickCool -= dt; k.ctrCool -= dt; k.hopWin -= dt; k.padT -= dt; k.hitFlash -= dt;
  if (k.chainT > 0) { k.chainT -= dt; if (k.chainT <= 0) k.chainLvl = 0; }
  if (k.boostT > 0) { k.boostT -= dt; if (k.boostT <= 0) k.boostMul = 1; }
  if (k.shrinkT > 0) { k.shrinkT -= dt; if (k.shrinkT <= 0) Audio_.play('pop', { pos: k.pos }); }
  k.size = damp(k.size, k.shrinkT > 0 ? 0.55 : 1, 6, dt);
  if (k.rescue) { updateRescue(k, dt); return; }
  const inp = k.input, ctl = RaceCtl.canDrive && k.spinT <= 0 && k.tumbleT <= 0 && !k.finishedLock;
  let throttle = ctl ? inp.throttle : 0, brake = ctl ? inp.brake : 0, steer = ctl ? inp.steer : 0;
  if (k.finishedLock) { throttle = inp.throttle; brake = inp.brake; steer = inp.steer; }
  const turnIn = -steer;
  const driftHeld = !!inp.drift && (ctl || k.finishedLock), pressed = driftHeld && !k.prevDrift; k.prevDrift = driftHeld;
  const up = k.up, fwd = k.fwd;
  // keep fwd tangent to up
  fwd.addScaledVector(up, -fwd.dot(up)).normalize();
  const right = _pv[0].crossVectors(fwd, up).normalize();
  let vF = k.vel.dot(fwd), vS = k.vel.dot(right);
  const agrav = (k.flags & F_AGRAV) && k.side === 0;
  const gdir = agrav ? _pv[1].copy(k.gN).negate() : _pv[1].set(0, -1, 0);
  const baseMax = P.BASE_MAX * st.speed * (1 + 0.011 * k.coins) * k.rubber * (k.shrinkT > 0 ? 0.72 : 1) * (k.slipOn > 0 ? P.SLIP_BONUS : 1);
  // --- trick input (airborne window after leaving a ramp lip)
  // tricks variés et combo : la direction choisit la figure (roulis gauche/droite, salto arrière au frein, sinon vrille puis salto avant en alternance) ;
  // on peut enchaîner jusqu'à TRICK_MAX figures dans la fenêtre de saut, chacune allonge le boost à l'atterrissage
  if (pressed && !k.grounded && k.trickWin > 0 && k.trickCool <= 0 && k.trickCount < P.TRICK_MAX) {
    const kind = inp.steer < -0.4 ? 4 : inp.steer > 0.4 ? 1 : inp.brake > 0 ? 3 : k.trickCount % 2 === 0 ? 0 : 2;
    k.trickDone = true; k.trickCount++; k.rs.tricks++; k.trickCool = P.TRICK_COOL; k.vis.trick(kind); Audio_.play('trick', { pos: k.pos, vol: k.isPlayer ? 1 : 0.6, stage: k.trickCount - 1 });
    FX.sparkle(_kt2.copy(k.pos).addScaledVector(up, 1.2), COL(0xffffff).multiplyScalar(3), 6 + 3 * k.trickCount, 1.2);
    if (k.isPlayer && k.trickCount > 1) late.Game.message('TRICK COMBO x' + k.trickCount + '!', 0.9);
  }
  let yawRate = 0;
  if (k.grounded) {
    const sx = SURFX[k.surf] || SURFX[SURF.road], offroad = sx.max < 1 && k.starT <= 0, accMul = k.starT > 0 ? 1 : sx.acc;
    let maxF = baseMax; if (offroad && k.boostT <= 0) maxF *= Math.min(1, sx.max * st.off);
    if (k.starT > 0) maxF *= 1.16;
    const maxB = k.boostT > 0 ? baseMax * k.boostMul * (k.starT > 0 ? 1.1 : 1) : maxF;
    const v0 = vF;
    if (k.boostT > 0 && vF < maxB) vF = Math.min(maxB, vF + P.BOOST_ACC * dt);
    else if (throttle > 0 && brake <= 0) {
      if (vF < 0) vF += P.BRAKE * dt;
      else if (vF < maxF) { const t = vF / maxF; vF = Math.min(maxF, vF + P.ACCEL * st.accel * accMul * (1.18 - 0.98 * t) * throttle * dt); }
    }
    // freinage puis marche arrière : le kart s'arrête d'abord, la marche arrière s'enclenche après REV_DELAY (frein tenu) et accélère progressivement
    if (brake > 0 && throttle <= 0) {
      if (vF > 0.5) { vF -= P.BRAKE * brake * dt; k.revT = 0; }
      else { k.revT += dt; if (k.revT < P.REV_DELAY) vF = Math.max(0, vF - 20 * dt); else { const rm = P.REV_MAX * (0.92 + 0.04 * st.accel * 2); vF = Math.max(-rm, vF - P.REV_ACC * (0.55 + 0.45 * Math.min(1, -vF / 4 + 0.35)) * brake * dt); } }
    } else if (brake > 0) vF -= P.BRAKE * brake * dt; else k.revT = 0;
    k.reversing = vF < -1.5;
    if (k.reversing && k.isPlayer) { k.beepT = (k.beepT || 0) - dt; if (k.beepT <= 0) { k.beepT = 0.42; Audio_.play('revbeep'); } }
    if (throttle <= 0 && brake <= 0 && k.boostT <= 0) vF -= Math.sign(vF) * Math.min(Math.abs(vF), (P.COAST + Math.abs(vF) * 0.22) * dt);
    if (vF > maxB) vF = Math.max(maxB, vF - (vF - maxB) * 2.4 * dt - 3 * dt);
    if (k.spinT > 0 || k.tumbleT > 0) vF *= Math.exp(-2.2 * dt);
    k.accelNow = (vF - v0) / dt;
    // hop -> drift
    if (pressed && !k.drift && vF > 4 && ctl) { k.hopping = true; k.hopDir = 0; k.grounded = false; k.airG = P.G_HOP; Audio_.play('hop', { pos: k.pos, vol: k.isPlayer ? 1 : 0.5 }); }
    if (!k.drift && driftHeld && k.hopWin > 0 && turnIn !== 0 && vF > 8) { k.drift = Math.sign(turnIn); k.charge = 0; k.stage = 0; k.hopWin = 0; }
    if (k.drift) {
      if (!driftHeld || vF < 6 || !ctl && !k.finishedLock) k.endDrift(driftHeld ? false : true);
      else {
        k.charge += dt * (0.85 + 0.75 * Math.max(0, turnIn * k.drift)) * (offroad ? 0.4 : 1) * (1 + 0.1 * k.chainLvl);
        const ns = k.charge >= P.STAGES[2] ? 3 : k.charge >= P.STAGES[1] ? 2 : k.charge >= P.STAGES[0] ? 1 : 0;
        if (ns > k.stage) { k.stage = ns; Audio_.play('charge', { pos: k.pos, stage: ns, vol: k.isPlayer ? 1 : 0.4 }); for (const c of k.vis.rearContacts) { const wp = _kt2.copy(c).applyQuaternion(k.q).add(k.pos); FX.burst(wp, 10, { color: DRIFT_COLS[ns].clone().multiplyScalar(3), sp: 5, life: 0.35, size: 0.2, tile: TILE.spark, stretch: 0.05 }); } }
      }
    }
    // drift inversé : contre-braquer à fond 0,35 s en plein drift (avec un peu de charge) retourne le drift, la moitié de la charge est conservée
    if (k.drift && !k.ai && ctl) {
      if (turnIn * k.drift < -0.85 && k.charge > 0.4 && k.ctrCool <= 0) k.ctrT += dt; else k.ctrT = 0;
      if (k.ctrT > P.REV_HOLD) {
        k.drift = -k.drift; k.charge *= 0.5; k.stage = k.charge >= P.STAGES[1] ? 2 : k.charge >= P.STAGES[0] ? 1 : 0; k.ctrT = 0; k.ctrCool = 0.8;
        vS += k.drift * 4; Audio_.play('hop', { pos: k.pos, vol: k.isPlayer ? 1 : 0.5 }); if (k.isPlayer) late.Game.message('REVERSE DRIFT!', 0.8);
        FX.burst(_kt.copy(k.pos).addScaledVector(up, 0.5), 10, { color: COL(0xffffff).multiplyScalar(3), sp: 6, life: 0.3, size: 0.2, tile: TILE.spark, stretch: 0.05 });
      }
    } else k.ctrT = 0;
    // steering (bicycle model: reversing turns the way the front wheels point)
    const sp = Math.abs(vF);
    // largeur du drift : les lourds (driftW élevé) décrivent un arc plus large, les légers un arc plus serré
    if (k.drift) { const tight = turnIn * k.drift; yawRate = k.drift * (P.DRIFT_BASE + P.DRIFT_ADJ * tight) * Math.min(1, sp / 12) * st.turn * (1.12 - 0.12 * st.driftW); }
    else { const f = Math.min(1, sp / 7) * (1 - 0.32 * Math.min(1, sp / P.BASE_MAX)); yawRate = turnIn * P.TURN * st.turn * f * (vF >= 0 ? 1 : -1); }
    if (k.spinT > 0 || k.tumbleT > 0) yawRate = 0;
    k.yawNow = yawRate;
    // lateral grip : par surface, par piste et par personnage (hors drift, géré à part)
    const roadMul = k.surf === SURF.road ? (World.roadGrip || 1) : 1;
    const grip = k.drift ? P.GRIP_DRIFT : (offroad ? P.GRIP_OFF : P.GRIP) * Math.min(1.3, sx.grip * roadMul * st.grip);
    vS *= Math.exp(-(k.spinT > 0 ? 2.5 : grip) * dt);
    if (k.drift) vS += k.drift * 5.5 * dt * Math.min(1, sp / 15) * st.driftW;
    // the heading turns and carries the velocity with it (arcade: speed is kept through corners)
    if (yawRate) { _pq.setFromAxisAngle(up, yawRate * dt); fwd.applyQuaternion(_pq); right.applyQuaternion(_pq); yawRate = 0; if (!k.drift) vF *= 1 - 0.012 * Math.abs(turnIn) * Math.min(1, sp / 20) * dt * 10; }
    k.vel.copy(fwd).multiplyScalar(vF).addScaledVector(right, vS);
    if (!agrav) { const gt = _pv[2].copy(gdir).addScaledVector(k.gN, -gdir.dot(k.gN)); k.vel.addScaledVector(gt, P.G_GROUND * 0.55 * dt); }
    if (k.hopping && !k.grounded) k.vel.addScaledVector(up, 5.0);
    if (k.inWater) { k.vel.multiplyScalar(Math.exp(-2.5 * dt)); }
    k.vF = vF; k.airT = 0;
    // poussière, éclats ou givre selon la surface (joueur et karts proches de la caméra seulement)
    if (sx.dust && Math.abs(vF) > 6 && late.Game.state !== 'diag') {
      k.fxT -= dt;
      if (k.fxT <= 0 && k.pos.distanceToSquared(camera.position) < 6400) {
        k.fxT = k.isPlayer ? 0.05 : 0.09;
        FX.burst(_kt.copy(k.pos).addScaledVector(fwd, -1.2).addScaledVector(up, 0.2), 2, { additive: false, color: sx.dust, sp: 2.6, life: 0.75, size: sx.dustSize, size1: sx.dustSize * 3, drag: 2, tile: TILE.smoke, alpha: 0.5, upMin: 0.3, spread: 0.5 });
        if (k.isPlayer) Audio_.play('dirt', { vol: clamp(Math.abs(vF) / 30, 0.3, 1) });
      }
    }
  } else {
    // airborne
    k.airT += dt;
    if (k.hopping && turnIn !== 0) k.hopDir = Math.sign(turnIn);
    // gravité variable : propre à la piste (World.gravMul) et au personnage (les lourds retombent un peu plus vite)
    const g = k.hopping ? P.G_HOP : k.airG * (World.gravMul || 1) * (0.92 + 0.1 * st.mass);
    k.vel.addScaledVector(gdir, g * dt);
    yawRate = turnIn * (k.hopping ? 0.55 : 0.7) * Math.min(1, Math.abs(k.vF) / 6) * (k.vF >= 0 ? 1 : -1);
    if (k.drift) yawRate = k.drift * P.DRIFT_BASE * 0.8;
    if (k.spinT > 0 || k.tumbleT > 0) yawRate = 0;
    k.yawNow = yawRate; k.reversing = false;
    k.vF = k.vel.dot(fwd); k.accelNow = 0;
    // re-orient up toward gravity-up slowly
    _pv[3].copy(gdir).negate(); k.up.lerp(_pv[3], 1 - Math.exp(-2.2 * dt)).normalize();
  }
  if (yawRate) { _pq.setFromAxisAngle(up, yawRate * dt); fwd.applyQuaternion(_pq); }
  // anti-blocage : le kart veut avancer mais reste collé (mur, décor, autre kart) -> sauvetage
  if (ctl && k.grounded && !k.finishedLock && (inp.throttle > 0 || inp.brake > 0) && Math.abs(vF) < 1.2 && k.boostT <= 0) k.blockT += dt; else k.blockT = Math.max(0, k.blockT - dt * 2);
  if (k.blockT > (k.isPlayer ? 3 : 4)) { k.blockT = 0; Stats.blockRescues++; startRescue(k, 'stuck'); updateRescue(k, dt); return; }
  // integrate : anti-tunnelling, la vitesse est découpée en sous-pas de 0,4 m maximum
  const nSub = clamp(Math.ceil(k.vel.length() * dt / 0.4), 1, 4), sdt = dt / nSub; if (nSub > 1) Stats.subSteps++;
  for (let s = 0; s < nSub; s++) { k.pos.addScaledVector(k.vel, sdt); resolveContact(k, sdt); if (k.rescue) break; }
  const vmax = 62; if (k.vel.lengthSq() > vmax * vmax) k.vel.setLength(vmax);
  k.updateQ();
}

function resolveContact(k, dt) {
  const T = World.track, L = T.locate(k.pos, k.ti, k.loc); k.ti = L.i; const fl = L.flags; k.flags = fl;
  const r = 0.95 * k.size;
  // ---- walls (two-sided: they block entering and leaving)
  if (k.side === 0) {
    if (L.d > L.eR - r) { if (fl & F_WALL_R) wallHit(k, L, 1, L.d - (L.eR - r)); else if (L.d > L.eR) k.side = 1; }
    else if (L.d < L.eL + r) { if (fl & F_WALL_L) wallHit(k, L, -1, (L.eL + r) - L.d); else if (L.d < L.eL) k.side = -1; }
  } else if (k.side === 1) {
    if (L.d < L.eR + r && L.d > L.eL) { if (fl & F_WALL_R) wallHit(k, L, -1, (L.eR + r) - L.d); else if (L.d < L.eR) k.side = 0; }
  } else {
    if (L.d > L.eL - r && L.d < L.eR) { if (fl & F_WALL_L) wallHit(k, L, 1, L.d - (L.eL - r)); else if (L.d > L.eL) k.side = 0; }
  }
  // ---- static prop colliders
  if (World.colliders.length && k.side !== 0) for (const c of World.colliders) {
    const dx = k.pos.x - c.x, dz = k.pos.z - c.z, rr = c.r + r * 0.8; if (dx * dx + dz * dz > rr * rr || k.pos.y < c.y0 || k.pos.y > c.y1 + 50) continue;
    const d = Math.hypot(dx, dz) || 1, nx = dx / d, nz = dz / d; k.pos.x = c.x + nx * rr; k.pos.z = c.z + nz * rr;
    const vn = k.vel.x * nx + k.vel.z * nz; if (vn < 0) { k.vel.x -= nx * vn * 1.4; k.vel.z -= nz * vn * 1.4; if (vn < -5) { Audio_.play('wall', { pos: k.pos }); if (k.isPlayer) late.Game.shake(0.3); } }
  }
  // ---- ground
  let hasGround = false, gH = 0; const gN = _pv[4];
  k.onTerrain = false;
  if (k.side === 0 && !(fl & F_GAP)) { hasGround = true; gN.copy(L.N); gH = L.h; k.surf = Math.abs(L.d) <= L.hw + 0.2 ? SURF.road : (L.d < 0 ? T.surfL[L.i] : T.surfR[L.i]) || SURF.road; }
  else if (World.terrain && k.side !== 0) {
    const th = World.terrain.height(k.pos.x, k.pos.z); World.terrain.normal(k.pos.x, k.pos.z, gN);
    hasGround = true; gH = (k.pos.y - th) * gN.y; k.surf = SURF.sand; k.onTerrain = true;
  }
  if (hasGround && gH < -0.9 && !k.grounded) {
    if (k.prevNoGround && k.side === 0) {       // flew into the face of a platform: bounce back, keep falling
      const tp = _pv[5].copy(k.pos).sub(k.prevPos); k.pos.copy(k.prevPos); const vt = k.vel.dot(L.T); k.vel.addScaledVector(L.T, -vt * 1.35);
      if (Math.abs(vt) > 3) { Audio_.play('wall', { pos: k.pos }); if (k.isPlayer) late.Game.shake(0.4); }
    }
    hasGround = false;
  }
  k.prevNoGround = !hasGround;
  if (hasGround) {
    if (k.grounded) {
      const launch = (fl & F_LAUNCH) && k.vel.dot(L.T) > 6;
      if (gH < 0.5 && !(launch && gH > 0.03)) { k.pos.addScaledVector(gN, -gH); k.gN.lerp(gN, 1 - Math.exp(-25 * dt)).normalize(); }
      else { k.grounded = false; k.airG = PHYS.G_AIR; k.hopping = false; if (fl & F_TRICK) { k.trickWin = PHYS.TRICK_WIN; k.trickDone = false; k.trickCount = 0; k.trickCool = 0; } }
    } else if (gH <= 0.02) {
      // landing
      const vN = k.vel.dot(gN); k.pos.addScaledVector(gN, -gH);
      k.gN.copy(gN);
      if (vN < 0) {
        k.vel.addScaledVector(gN, -vN);
        // rebond : plus marqué pour les légers (phys.bounce), amorti sur herbe, sable, boue (le kart "s'enfonce")
        const bz = k.phys.bounce * ((k.surf === SURF.road || k.surf === SURF.ice) ? 1 : 0.3);
        k.landImpulse = Math.min(3.5, -vN * 0.22) * (0.75 + 0.25 * bz);
        if (-vN > 10 && !k.hopping && k.bounceT <= 0 && bz > 0.5) { k.vel.addScaledVector(gN, Math.min(2.8 * bz, -vN * 0.14 * bz)); k.grounded = false; k.bounceT = 0.6; }
        else k.grounded = true;
        if (!k.grounded) k.airT = 0.9;
        if (k.airT > 0.3) { Audio_.play('land', { pos: k.pos, vol: k.isPlayer ? 1 : 0.6 }); FX.burst(k.pos, 10, { additive: false, color: World.theme === 'space' ? COL(0xd0b8ff) : COL(0xf2e6c8), sp: 4, life: 0.6, size: 0.6, size1: 1.6, drag: 3, tile: TILE.smoke, alpha: 0.6, upMin: 0.1 }); }
      } else k.grounded = true;
      if (k.grounded) {
        if (k.hopping) { k.hopping = false; k.hopWin = 0.22; if (k.input.drift && k.hopDir !== 0 && k.vel.length() > 8 && !k.drift) { k.drift = k.hopDir; k.charge = 0; k.stage = 0; } }
        if (k.trickDone) { const n = k.trickCount; k.trickDone = false; k.trickCount = 0; k.giveBoost(0.9 + 0.35 * (n - 1), 1.3 + 0.03 * (n - 1), BOOST_COL.trick); Audio_.play('boost', { pos: k.pos, vol: k.isPlayer ? 0.8 : 0.4 }); }
        k.trickWin = 0;
      }
    }
  } else if (k.grounded) { k.grounded = false; k.airG = PHYS.G_AIR; k.hopping = false; if (fl & F_TRICK) { k.trickWin = PHYS.TRICK_WIN; k.trickDone = false; k.trickCount = 0; k.trickCool = 0; } }
  // up vector follows the surface
  if (k.grounded) { k.up.lerp(k.gN, 1 - Math.exp(-18 * dt)).normalize(); }
  // ---- safe point / boost pads / water / falling
  if (k.grounded && k.side === 0 && !(fl & (F_GAP | F_NOSAFE | F_LAUNCH)) && Math.abs(L.d) < L.hw) { k.safeI = L.i; k.safeD = clamp(L.d, -L.hw * 0.5, L.hw * 0.5); }
  if (k.grounded && k.side === 0 && k.padT <= 0) for (const p of World.pads) {
    if (!inIdxRange(L.i, p.i0, p.i1, T.n)) continue; if (L.d < p.d - p.w / 2 - 0.5 || L.d > p.d + p.w / 2 + 0.5) continue;
    k.giveBoost(1.05, 1.42, BOOST_COL.pad); k.padT = 0.25; Audio_.play('boost', { pos: k.pos, vol: k.isPlayer ? 1 : 0.5 }); if (k.isPlayer) late.Game.shake(0.15); break;
  }
  if (World.waterY != null) {
    const wy = World.waterY;
    if (!k.inWater && k.pos.y < wy + 0.1 && (!hasGround || k.onTerrain)) { k.inWater = true; FX.splash(_pv[6].set(k.pos.x, wy + 0.1, k.pos.z)); Audio_.play('splash', { pos: k.pos }); }
    if (k.pos.y > wy + 0.5) k.inWater = false;
    if (k.pos.y < wy - 0.8) startRescue(k, 'water');
  }
  if (!k.rescue && !k.grounded && (k.airT > 3.2 || L.h < -16 || k.pos.lengthSq() > 1300 * 1300)) startRescue(k, k.airT > 3.2 ? 'air' : L.h < -16 ? 'below' : 'far');
  if (!k.rescue && k.onTerrain && k.pos.lengthSq() > 700 * 700) startRescue(k);
}
function inIdxRange(i, a, b, n) { return a <= b ? i >= a && i <= b : i >= a || i <= b; }
function wallHit(k, L, s, pen) {
  // s: +1 push toward -B (right wall), -1 push toward +B
  k.pos.addScaledVector(L.B, -s * pen);
  const vB = k.vel.dot(L.B);
  if (vB * s > 0) {
    k.vel.addScaledVector(L.B, -vB * 1.32);
    const hard = clamp(Math.abs(vB) / 18, 0, 1); k.vel.multiplyScalar(1 - 0.22 * hard);
    const fb = k.fwd.dot(L.B);
    if (fb * s > 0 && Math.abs(fb) < 0.93) k.fwd.addScaledVector(L.B, -fb * 0.65).normalize();   // scrape: turn the nose along the wall
    else k.fwd.addScaledVector(L.B, -s * 0.12 * hard).normalize();
    if (Math.abs(vB) > 3.5) {
      const cp = _pv[6].copy(k.pos).addScaledVector(L.B, s * 0.9).addScaledVector(k.up, 0.5);
      FX.burst(cp, 12, { color: COL(0xffd88a).multiplyScalar(4), sp: 8, life: 0.35, size: 0.12, tile: TILE.spark, stretch: 0.05, grav: 12 });
      Audio_.play('wall', { pos: k.pos, vol: 0.6 + hard });
      if (k.isPlayer) late.Game.shake(0.25 + hard * 0.4);
      if (hard > 0.6 && k.drift) k.endDrift(false);
    }
  }
}

// ---------------------------------------------------------------- aspiration
// Derrière un autre kart (à moins de 17 m, dans son axe), une jauge se remplit ; pleine, elle donne +7 % de vitesse maximale
// tant que le kart reste dans le sillage (puis encore 0,6 s). Calculé une fois par pas de physique, avant stepKart.
export function updateSlipstream(karts, dt) {
  const P = PHYS;
  for (const k of karts) {
    let inWake = false;
    if (RaceCtl.canDrive && k.grounded && !k.rescue && !k.drift && k.vF > 17 && k.spinT <= 0 && k.tumbleT <= 0) {
      const right = _cv2.crossVectors(k.fwd, k.up).normalize();
      for (const o of karts) {
        if (o === k || o.rescue || o.vF < 12) continue;
        const rel = _cv0.copy(o.pos).sub(k.pos), z = rel.dot(k.fwd); if (z < P.SLIP_MIN || z > P.SLIP_RANGE) continue;
        if (Math.abs(rel.dot(right)) > P.SLIP_WIDTH * (0.6 + 0.4 * z / P.SLIP_RANGE) + 0.6) continue;
        inWake = true; break;
      }
    }
    if (inWake) k.rs.draft += dt;
    k.slipT = clamp(k.slipT + (inWake ? dt : -dt * 1.5), 0, P.SLIP_TIME * 1.3);
    if (k.slipT >= P.SLIP_TIME) { if (k.slipOn <= 0 && k.isPlayer) Audio_.play('draft', { vol: 0.5 }); k.slipOn = 0.6; } else k.slipOn = Math.max(0, k.slipOn - dt);
    if (k.slipT > 0.25 && late.Game.state !== 'diag') {
      k.slipFx -= dt;
      if (k.slipFx <= 0 && (k.isPlayer || k.pos.distanceToSquared(camera.position) < 3600)) {
        k.slipFx = 0.045; const s = grand() < 0.5 ? -1 : 1, right = _cv2.crossVectors(k.fwd, k.up).normalize();
        FX.burst(_kt.copy(k.pos).addScaledVector(k.fwd, 1.4).addScaledVector(right, s * 1.15).addScaledVector(k.up, 0.5), 1, { color: COL(0xffffff).multiplyScalar(k.slipOn > 0 ? 3 : 1.4), sp: 0.4, life: 0.22, size: 0.1, tile: TILE.spark, stretch: 0.16, dir: _cv1.copy(k.fwd).multiplyScalar(-9) });
      }
    }
  }
}

// ---------------------------------------------------------------- kart vs kart
const _cv0 = new THREE.Vector3(), _cv1 = new THREE.Vector3(), _cv2 = new THREE.Vector3();
export function collideKarts(karts) {
  for (let i = 0; i < karts.length; i++) for (let j = i + 1; j < karts.length; j++) {
    const a = karts[i], b = karts[j]; if (a.rescue || b.rescue) continue;
    const d = _cv0.copy(b.pos).sub(a.pos); d.addScaledVector(a.up, -d.dot(a.up));
    const minD = a.radius() + b.radius(); const d2 = d.lengthSq(); if (d2 >= minD * minD || d2 < 1e-6) continue;
    if (Math.abs(_cv1.copy(b.pos).sub(a.pos).dot(a.up)) > 1.6) continue;
    const dist = Math.sqrt(d2), n = d.multiplyScalar(1 / dist), pen = minD - dist, ma = a.mass(), mb = b.mass();
    a.pos.addScaledVector(n, -pen * mb / (ma + mb)); b.pos.addScaledVector(n, pen * ma / (ma + mb));
    const rv = _cv1.copy(b.vel).sub(a.vel).dot(n);
    if (rv < 0) {
      const jj = -(1 + 0.45) * rv / (1 / ma + 1 / mb); a.vel.addScaledVector(n, -Math.min(14, jj / ma)); b.vel.addScaledVector(n, Math.min(14, jj / mb));
      if (-rv > 2) { a.rs.hits++; b.rs.hits++; a.rs.dirty = b.rs.dirty = true; }
      if (-rv > 2 && (a.isPlayer || b.isPlayer)) { Audio_.play('bump', { vol: clamp(-rv / 10, 0.3, 1) }); late.Game.shake(clamp(-rv / 30, 0.1, 0.4)); }
      // pondération : le plus léger encaisse. Gros choc : sa dérive casse ; très gros écart de masse : il part en toupie.
      const lt = ma < mb ? a : b, hv = lt === a ? b : a, ratio = Math.max(ma, mb) / Math.min(ma, mb);
      if (-rv > 6 && ratio > 1.15 && lt.drift) lt.endDrift(false);
      if (-rv > 12 && ratio > 1.5 && lt.invulnT <= 0 && lt.starT <= 0) lt.hit('spin', hv);
      if (-rv > 4) FX.burst(_cv2.copy(a.pos).addScaledVector(n, a.radius()).addScaledVector(a.up, 0.5), 8, { color: COL(0xfff0b0).multiplyScalar(3), sp: 6, life: 0.3, size: 0.1, tile: TILE.spark, stretch: 0.05 });
    }
    if (a.starT > 0 && b.starT <= 0) b.hit('spin', a); else if (b.starT > 0 && a.starT <= 0) a.hit('spin', b);
    else if (a.size < 0.8 && b.size > 0.95) a.hit('spin', b); else if (b.size < 0.8 && a.size > 0.95) b.hit('spin', a);
    for (const k of [a, b]) { const L = World.track.locate(k.pos, k.ti, k.loc); if (k.side === 0) { const r = 0.95 * k.size; if (L.d > L.eR - r && (L.flags & F_WALL_R)) k.pos.addScaledVector(L.B, -(L.d - (L.eR - r))); if (L.d < L.eL + r && (L.flags & F_WALL_L)) k.pos.addScaledVector(L.B, (L.eL + r) - L.d); } }
  }
}

// ---------------------------------------------------------------- rescue (cloud creature fishes the kart back)
export const Cloudies = {
  pool: [], group: null,
  init(scene) { this.group = new THREE.Group(); scene.add(this.group); for (const c of this.pool) this.group.add(c.obj); },
  get() {
    let c = this.pool.find(x => !x.busy);
    if (!c) { c = { obj: buildCloudy(), busy: false, t: 0, mode: 'idle' }; c.obj.visible = false; this.pool.push(c); if (this.group) this.group.add(c.obj); }
    c.busy = true; c.mode = 'rescue'; c.obj.visible = true; return c;
  },
  release(c, dir) { c.mode = 'leave'; c.t = 0; c.leaveDir = dir.clone(); },
  update(dt) {
    for (const c of this.pool) {
      if (c.mode === 'leave') { c.t += dt; c.obj.position.addScaledVector(c.leaveDir, dt * (8 + c.t * 30)); c.obj.userData.line.visible = c.obj.userData.hook.visible = false; if (c.t > 1.8) { c.mode = 'idle'; c.busy = false; c.obj.visible = false; } }
    }
  },
  hideAll() { for (const c of this.pool) { c.mode = 'idle'; c.busy = false; c.obj.visible = false; } },
};
export const RescueLog = [];
export function startRescue(k, why = '') {
  if (k.rescue) return;
  const T0 = World.track; RescueLog.push({ name: k.name, why, c: +T0.c[k.ti].toFixed(2), safeC: +T0.c[k.safeI].toFixed(2), d: +(k.loc.d || 0).toFixed(1), h: +(k.loc.h || 0).toFixed(1), side: k.side, air: +k.airT.toFixed(2), v: +k.vel.length().toFixed(1), t: +late.Game.raceTime.toFixed(1) });
  const T = World.track; let i = T.wrap(k.safeI - 4);
  const bad = j => { for (let q = -2; q <= 70; q += 2) if (T.flags[T.wrap(j + q)] & (F_GAP | F_LAUNCH)) return true; return (T.flags[j] & F_NOSAFE) > 0; };
  for (let n = 0; n < 300 && bad(i); n++) i = T.wrap(i - 3);
  const d = clamp(k.safeD, -T.hw[i] * 0.5, T.hw[i] * 0.5);
  const to = T.point(i, d, 0, V3());
  k.rescue = { t: 0, from: k.pos.clone(), ti: i, d, to, N: T.N(i, V3()), Tn: T.T(i, V3()), cloud: null, water: !!k.inWater };
  k.endDrift(false); k.boostT = 0; k.hopping = false; k.spinT = 0; k.tumbleT = 0;
  k.vis.emote('upset', 3);
  if (k.isPlayer) late.Game.message('Cloudy to the rescue! Hang on…', 1.8);
}
function updateRescue(k, dt) {
  const R_ = k.rescue; R_.t += dt; const t = R_.t;
  if (!R_.cloud && t > 0.35) { R_.cloud = Cloudies.get(); R_.cloud.obj.position.copy(k.pos).add(_pv[0].set(8, 22, 6)); Audio_.play('rescue', { pos: k.pos }); }
  const c = R_.cloud;
  if (t < 1.05) {
    // keep sinking / falling briefly
    if (R_.water) { k.vel.multiplyScalar(Math.exp(-4 * dt)); k.vel.y = damp(k.vel.y, -0.4, 5, dt); }
    else k.vel.y -= 14 * dt;
    k.pos.addScaledVector(k.vel, dt);
    if (c) { const tgt = _pv[1].copy(k.pos).add(_pv[2].set(0, 5.5, 0)); c.obj.position.lerp(tgt, 1 - Math.exp(-6 * dt)); c.obj.lookAt(camera.position.x, c.obj.position.y, camera.position.z); c.obj.rotateY(Math.PI); if (t > 0.7) cloudyLine(c.obj, _pv[3].copy(k.pos).add(_pv[2].set(0, 1.2, 0))); }
  } else if (t < 2.35) {
    if (!R_.lift) { R_.lift = k.pos.clone(); }
    const p = smooth(1.05, 2.3, t);
    const above = _pv[1].copy(R_.to).addScaledVector(R_.N, 4.2);
    const mid = _pv[2].copy(R_.lift).lerp(above, 0.5); mid.y = Math.max(R_.lift.y, above.y) + 6;
    const a = _pv[3].copy(R_.lift).lerp(mid, p), b = _pv[5].copy(mid).lerp(above, p); k.pos.copy(a.lerp(b, p));
    k.vel.set(0, 0, 0);
    k.fwd.lerp(R_.Tn, 1 - Math.exp(-5 * dt)).normalize(); k.up.lerp(R_.N, 1 - Math.exp(-5 * dt)).normalize();
    if (c) { c.obj.position.copy(k.pos).addScaledVector(R_.N, 4.6 + Math.sin(t * 6) * 0.1).addScaledVector(_pv[6].crossVectors(R_.Tn, R_.N), -1.2); c.obj.lookAt(camera.position.x, c.obj.position.y, camera.position.z); c.obj.rotateY(Math.PI); cloudyLine(c.obj, _pv[3].copy(k.pos).addScaledVector(R_.N, 1.2)); }
    if (R_.water && t < 1.3 && Math.random() < 0.3) FX.burst(k.pos, 3, { additive: false, color: COL(0xdff6ff), sp: 2, life: 0.8, size: 0.3, grav: 10 });
  } else {
    // release
    k.pos.copy(R_.to).addScaledVector(R_.N, 2.0); k.prevPos.copy(k.pos); k.vel.copy(R_.Tn).multiplyScalar(2);
    k.fwd.copy(R_.Tn); k.up.copy(R_.N); k.gN.copy(R_.N); k.ti = R_.ti; k.side = 0; k.grounded = false; k.airG = PHYS.G_AIR; k.airT = 0; k.inWater = false;
    k.invulnT = 1.6; k.prevNoGround = false;
    if (c) Cloudies.release(c, _pv[0].copy(R_.N).add(_pv[1].set(0.3, 0.6, 0.2)).normalize());
    k.rescue = null; Audio_.play('pop', { pos: k.pos });
  }
  k.updateQ();
}


// Les autres modules ne peuvent pas réassigner un binding importé : ils passent par ce setter.
export function setWorld(v) { World = v; }
