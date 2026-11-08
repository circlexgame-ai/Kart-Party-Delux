// 05_fx.js (Kart Party Deluxe)
import * as THREE from 'three';
import { COL, TAU, UP, lerp, pick, rand } from './01_core.js';
import { TEX } from './02_gfx.js';

// ============================================================================
// FX — instanced particle pools + effect emitters
// ============================================================================
export const TILE = { soft: 0, spark: 1, star: 2, smoke: 3, square: 4, ring: 5, shard: 6, flame: 7 };
class Particles {
  constructor(max, additive) {
    this.max = max; this.count = 0;
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.setAttribute('position', base.attributes.position);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3); this.aVel = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); this.aSz = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.aTile = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    for (const a of [this.aPos, this.aVel, this.aCol, this.aSz, this.aTile]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.aPos); g.setAttribute('iVel', this.aVel); g.setAttribute('iCol', this.aCol); g.setAttribute('iSz', this.aSz); g.setAttribute('iTile', this.aTile);
    g.instanceCount = 0;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { atlas: { value: TEX.atlas } },
      vertexShader: `attribute vec3 iPos; attribute vec3 iVel; attribute vec4 iCol; attribute vec3 iSz; attribute float iTile;
        varying vec2 vUv; varying vec4 vCol;
        void main(){
          vec4 mv = viewMatrix * vec4(iPos, 1.0); vec2 q = position.xy; float size = iSz.x;
          vec2 off;
          if (iSz.z > 0.0) { vec3 vv = (viewMatrix * vec4(iVel, 0.0)).xyz; vec2 d = vv.xy; float l = length(d); d = l > 1e-4 ? d/l : vec2(0.,1.);
            off = vec2(-d.y, d.x)*q.x*size + d*q.y*(size + l*iSz.z); }
          else { float c = cos(iSz.y), s = sin(iSz.y); off = vec2(c*q.x - s*q.y, s*q.x + c*q.y)*size; }
          mv.xy += off; gl_Position = projectionMatrix * mv;
          vec2 p = position.xy + 0.5; float tx = mod(iTile, 4.0), ty = floor(iTile/4.0);
          vUv = vec2((tx + p.x)/4.0, 1.0 - (ty + 1.0 - p.y)/2.0); vCol = iCol;
        }`,
      fragmentShader: `uniform sampler2D atlas; varying vec2 vUv; varying vec4 vCol;
        void main(){ vec4 t = texture2D(atlas, vUv); float a = vCol.a*t.a; if (a < 0.003) discard; gl_FragColor = vec4(vCol.rgb*t.rgb, a); }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = additive ? 20 : 19;
    this.g = g;
    const F = k => new Float32Array(max * k);
    this.p = F(3); this.v = F(3); this.life = F(1); this.max_ = F(1); this.s0 = F(1); this.s1 = F(1); this.c = F(4); this.grav = F(1); this.drag = F(1);
    this.rot = F(1); this.rv = F(1); this.tile = F(1); this.str = F(1); this.fade = F(1);
  }
  emit(x, y, z, vx, vy, vz, o) {
    let i = this.count; if (i >= this.max) { i = (Math.random() * this.max) | 0; } else this.count++;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z; this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.life[i] = 0; this.max_[i] = o.life || 1; this.s0[i] = o.size ?? 0.5; this.s1[i] = o.size1 ?? this.s0[i];
    const c = o.color; this.c[i * 4] = c.r; this.c[i * 4 + 1] = c.g; this.c[i * 4 + 2] = c.b; this.c[i * 4 + 3] = o.alpha ?? 1;
    this.grav[i] = o.grav || 0; this.drag[i] = o.drag || 0; this.rot[i] = o.rot ?? Math.random() * TAU; this.rv[i] = o.rv || 0;
    this.tile[i] = o.tile || 0; this.str[i] = o.stretch || 0; this.fade[i] = o.fade ?? 1;
  }
  update(dt) {
    const n = this.count, P = this.aPos.array, V = this.aVel.array, C = this.aCol.array, S = this.aSz.array, Tt = this.aTile.array;
    let w = 0;
    for (let i = 0; i < n; i++) {
      this.life[i] += dt; const t = this.life[i] / this.max_[i];
      if (t >= 1) continue;
      const i3 = i * 3, dr = Math.exp(-this.drag[i] * dt);
      this.v[i3] *= dr; this.v[i3 + 1] = this.v[i3 + 1] * dr - this.grav[i] * dt; this.v[i3 + 2] *= dr;
      this.p[i3] += this.v[i3] * dt; this.p[i3 + 1] += this.v[i3 + 1] * dt; this.p[i3 + 2] += this.v[i3 + 2] * dt;
      this.rot[i] += this.rv[i] * dt;
      if (w !== i) this.copy(i, w);
      const w3 = w * 3, w4 = w * 4;
      P[w3] = this.p[w3]; P[w3 + 1] = this.p[w3 + 1]; P[w3 + 2] = this.p[w3 + 2];
      V[w3] = this.v[w3]; V[w3 + 1] = this.v[w3 + 1]; V[w3 + 2] = this.v[w3 + 2];
      const fa = this.fade[w] ? (t < 0.1 ? t / 0.1 : 1) * (1 - t) : (1 - t * t);
      C[w4] = this.c[w4]; C[w4 + 1] = this.c[w4 + 1]; C[w4 + 2] = this.c[w4 + 2]; C[w4 + 3] = this.c[w4 + 3] * fa;
      S[w3] = lerp(this.s0[w], this.s1[w], t); S[w3 + 1] = this.rot[w]; S[w3 + 2] = this.str[w];
      Tt[w] = this.tile[w];
      w++;
    }
    this.count = w; this.g.instanceCount = w;
    if (w) { for (const a of [this.aPos, this.aVel, this.aCol, this.aSz, this.aTile]) { a.needsUpdate = true; a.clearUpdateRanges && a.clearUpdateRanges(); } }
  }
  copy(a, b) {
    for (let k = 0; k < 3; k++) { this.p[b * 3 + k] = this.p[a * 3 + k]; this.v[b * 3 + k] = this.v[a * 3 + k]; }
    for (let k = 0; k < 4; k++) this.c[b * 4 + k] = this.c[a * 4 + k];
    this.life[b] = this.life[a]; this.max_[b] = this.max_[a]; this.s0[b] = this.s0[a]; this.s1[b] = this.s1[a]; this.grav[b] = this.grav[a]; this.drag[b] = this.drag[a];
    this.rot[b] = this.rot[a]; this.rv[b] = this.rv[a]; this.tile[b] = this.tile[a]; this.str[b] = this.str[a]; this.fade[b] = this.fade[a];
  }
  clear() { this.count = 0; this.g.instanceCount = 0; }
}

export const FX = {
  add: null, alpha: null, rings: [], group: null,
  init() {
    this.add = new Particles(4000, true); this.alpha = new Particles(2500, false);
    this.group = new THREE.Group(); this.group.add(this.add.mesh, this.alpha.mesh);
    // shockwave rings
    const rg = new THREE.RingGeometry(0.8, 1, 48);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false; m.userData.t = 1; this.group.add(m); this.rings.push(m);
    }
  },
  attach(scene) { scene.add(this.group); },
  clear() { this.add.clear(); this.alpha.clear(); this.rings.forEach(r => { r.visible = false; }); },
  update(dt) {
    this.add.update(dt); this.alpha.update(dt);
    for (const r of this.rings) if (r.visible) {
      r.userData.t += dt / r.userData.dur; const t = r.userData.t;
      if (t >= 1) { r.visible = false; continue; }
      const s = lerp(r.userData.s0, r.userData.s1, 1 - (1 - t) * (1 - t)); r.scale.setScalar(s); r.material.opacity = (1 - t) * r.userData.a;
    }
  },
  ring(pos, normal, color, s0, s1, dur = 0.6, a = 1) {
    const r = this.rings.find(x => !x.visible) || this.rings[0];
    r.visible = true; r.position.copy(pos); r.lookAt(_fxv.copy(pos).add(normal)); r.material.color.set(color); r.userData = { t: 0, s0, s1, dur, a };
  },
  // generic burst
  burst(p, n, o) {
    const sys = o.additive === false ? this.alpha : this.add;
    for (let i = 0; i < n; i++) {
      const sp = rand(o.spMin ?? 2, o.sp ?? 8); _fxv.set(rand(-1, 1), rand(o.upMin ?? -0.2, 1), rand(-1, 1)).normalize().multiplyScalar(sp);
      if (o.dir) _fxv.addScaledVector(o.dir, 1);
      const col = Array.isArray(o.color) ? pick(o.color) : o.color;
      sys.emit(p.x + rand(-1, 1) * (o.spread || 0), p.y + rand(-1, 1) * (o.spread || 0), p.z + rand(-1, 1) * (o.spread || 0), _fxv.x, _fxv.y, _fxv.z,
        { life: rand(o.lifeMin ?? (o.life || 1) * 0.6, o.life || 1), size: (o.size || 0.4) * rand(0.7, 1.3), size1: o.size1 !== undefined ? o.size1 * rand(0.7, 1.3) : undefined, color: col, grav: o.grav || 0, drag: o.drag || 0, tile: o.tile || 0, stretch: o.stretch || 0, rv: o.rv ? rand(-o.rv, o.rv) : 0, alpha: o.alpha ?? 1, fade: o.fade });
    }
  },
  confetti(p, n = 160) {
    const cols = [0xff3d7f, 0xffd21a, 0x3dd6ff, 0x7dff5a, 0xb46bff, 0xff8a1c, 0xffffff].map(c => COL(c));
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), sp = rand(4, 16);
      this.alpha.emit(p.x + rand(-2, 2), p.y + rand(0, 2), p.z + rand(-2, 2), Math.cos(a) * sp * 0.6, rand(6, 18), Math.sin(a) * sp * 0.6,
        { life: rand(2.5, 4.5), size: rand(0.18, 0.32), color: pick(cols), grav: 7, drag: 1.6, tile: TILE.square, rv: rand(-12, 12), fade: 0 });
    }
  },
  explosion(p, big = 1) {
    this.burst(p, 40 * big, { color: [COL(0xffd060).multiplyScalar(4), COL(0xff7a20).multiplyScalar(3), COL(0xffffff).multiplyScalar(4)], sp: 18 * big, life: 0.7, size: 1.3 * big, size1: 3.5 * big, drag: 3, tile: TILE.soft, upMin: -0.1 });
    this.burst(p, 50, { color: [COL(0xffe38a).multiplyScalar(5), COL(0xffa040).multiplyScalar(5)], sp: 28, life: 0.8, size: 0.18, drag: 1.5, grav: 12, tile: TILE.spark, stretch: 0.05 });
    this.burst(p, 26 * big, { additive: false, color: [COL(0x6a6470), COL(0x8a8490), COL(0x4d4852)], sp: 7, life: 1.9, size: 2.2, size1: 5.5, drag: 1.5, grav: -1.5, tile: TILE.smoke, alpha: 0.75, upMin: 0.1 });
    this.ring(p, UP, 0xfff0c0, 1, 16 * big, 0.55, 1.2);
  },
  splash(p) {
    this.burst(p, 70, { additive: false, color: [COL(0xffffff), COL(0xd8f6ff), COL(0x9fe3ff)], sp: 9, spMin: 3, life: 1.1, size: 0.35, size1: 0.1, grav: 16, drag: 0.6, tile: TILE.soft, upMin: 0.55, alpha: 0.95 });
    this.burst(p, 18, { additive: false, color: COL(0xffffff), sp: 3, life: 1.3, size: 1.2, size1: 3.5, grav: 0, drag: 2, tile: TILE.smoke, alpha: 0.7, upMin: 0.2 });
    this.ring(p, UP, 0xffffff, 0.5, 6, 0.8, 0.8);
  },
  shatter(p, n = 26) {
    const cols = [0xff5a8a, 0xffd23a, 0x5ae0ff, 0x8aff6a, 0xc07aff, 0xffffff].map(c => COL(c).multiplyScalar(2.2));
    this.burst(p, n, { color: cols, sp: 11, spMin: 4, life: 0.9, size: 0.45, size1: 0.1, grav: 14, drag: 0.8, tile: TILE.shard, rv: 14, upMin: 0.1 });
    this.burst(p, 16, { color: COL(0xffffff).multiplyScalar(3), sp: 6, life: 0.5, size: 0.5, size1: 0, tile: TILE.star, rv: 5 });
  },
  hitStars(p) { this.burst(p, 14, { color: [COL(0xffe14a).multiplyScalar(3), COL(0xffffff).multiplyScalar(3)], sp: 7, spMin: 4, life: 0.8, size: 0.7, size1: 0.2, tile: TILE.star, rv: 8, grav: 6, upMin: 0.4 }); },
  sparkle(p, col, n = 1, spread = 1) { for (let i = 0; i < n; i++) this.add.emit(p.x + rand(-spread, spread), p.y + rand(-spread, spread), p.z + rand(-spread, spread), 0, rand(0.2, 0.8), 0, { life: rand(0.5, 1.1), size: rand(0.25, 0.6), size1: 0, color: col, tile: TILE.star, rv: rand(-3, 3) }); },
};
const _fxv = new THREE.Vector3();



// ============================================================================
// SKIDS — traces de dérapage : un seul maillage dynamique, tampon circulaire de quadrilatères au sol
// ============================================================================
export const Skids = {
  N: 4000, i: 0, mesh: null, pos: null, col: null, dirty: false,
  init() {
    const n = this.N, g = new THREE.BufferGeometry(), idx = new Uint16Array(n * 6);
    this.pos = new Float32Array(n * 12); this.col = new Float32Array(n * 16);
    for (let q = 0; q < n; q++) { const v = q * 4; idx.set([v, v + 1, v + 2, v, v + 2, v + 3], q * 6); }
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = 4;
  },
  attach(scene) { scene.add(this.mesh); },
  clear() { this.pos.fill(0); this.col.fill(0); this.i = 0; this.dirty = true; this.flush(); },
  // segment a -> b posé sur le plan de normale n, largeur w, opacité a0 -> a1, couleur rgb
  seg(a, b, n, w, a0, a1, r, g, bl) {
    const q = this.i; this.i = (this.i + 1) % this.N;
    let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    let sx = dy * n.z - dz * n.y, sy = dz * n.x - dx * n.z, sz = dx * n.y - dy * n.x; const l = Math.hypot(sx, sy, sz) || 1; sx *= w / 2 / l; sy *= w / 2 / l; sz *= w / 2 / l;
    const o = n, h = 0.05, P = this.pos, C = this.col, p = q * 12, c = q * 16;
    P[p] = a.x - sx + o.x * h; P[p + 1] = a.y - sy + o.y * h; P[p + 2] = a.z - sz + o.z * h;
    P[p + 3] = a.x + sx + o.x * h; P[p + 4] = a.y + sy + o.y * h; P[p + 5] = a.z + sz + o.z * h;
    P[p + 6] = b.x + sx + o.x * h; P[p + 7] = b.y + sy + o.y * h; P[p + 8] = b.z + sz + o.z * h;
    P[p + 9] = b.x - sx + o.x * h; P[p + 10] = b.y - sy + o.y * h; P[p + 11] = b.z - sz + o.z * h;
    for (let v = 0; v < 4; v++) { const al = v < 2 ? a0 : a1; C[c + v * 4] = r; C[c + v * 4 + 1] = g; C[c + v * 4 + 2] = bl; C[c + v * 4 + 3] = al; }
    this.dirty = true;
  },
  flush() { if (!this.dirty) return; this.dirty = false; const g = this.mesh.geometry; g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; },
};
