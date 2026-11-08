// 04_track.js (Kart Party Deluxe)
import * as THREE from 'three';
import { COL, UP, clamp, lerp, smooth } from './01_core.js';
import { TIME_U, mergeGeos } from './02_gfx.js';

// ============================================================================
// TRACK — spline sampling, frames (bank / loops), racing line, surface queries, meshes
// ============================================================================
export const F_WALL_L = 1, F_WALL_R = 2, F_GAP = 4, F_TUNNEL = 8, F_AGRAV = 16, F_LOOP = 32, F_LAUNCH = 64, F_TRICK = 128,
  F_CURB = 256, F_TFOLLOW = 512, F_BAR_L = 1024, F_BAR_R = 2048, F_NOSAFE = 4096, F_SKIRT = 8192;
export const SURF = { none: 0, grass: 1, sand: 2, road: 3, mud: 4, ice: 5 };   // mud et ice : prêts pour les futures pistes (SURFX dans 09_kart)
export const _tv = [0, 1, 2, 3, 4, 5, 6, 7].map(() => new THREE.Vector3());
const _tq = new THREE.Quaternion();

export class Track {
  constructor(def) {
    this.def = def;
    const pts = def.pts.map(p => new THREE.Vector3(p[0], p[1], p[2]));
    const NP = pts.length; this.NP = NP;
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
    curve.arcLengthDivisions = 12000;
    const L = curve.getLength(); const n = Math.round(L / (def.ds || 1)); this.n = n; this.L = L; this.ds = L / n;
    const A = k => new Float32Array(n);
    this.px = A(); this.py = A(); this.pz = A(); this.tx = A(); this.ty = A(); this.tz = A();
    this.nx = A(); this.ny = A(); this.nz = A(); this.bx = A(); this.by = A(); this.bz = A();
    this.hw = A(); this.shL = A(); this.shR = A(); this.curv = A(); this.bank = A(); this.line = A(); this.c = A(); this.barH = A();
    this.flags = new Uint32Array(n); this.surfL = new Uint8Array(n); this.surfR = new Uint8Array(n);
    this.barStyleL = new Array(n).fill(null); this.barStyleR = new Array(n).fill(null);
    const p = new THREE.Vector3(), t = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const tt = curve.getUtoTmapping(i / n); curve.getPoint(tt, p); curve.getTangent(tt, t).normalize();
      this.px[i] = p.x; this.py[i] = p.y; this.pz[i] = p.z; this.tx[i] = t.x; this.ty[i] = t.y; this.tz[i] = t.z;
      this.c[i] = tt * NP;
    }
    // --- per-sample attributes from control points + sections
    const D = Object.assign({ shL: 5, shR: 5, wallL: true, wallR: true, barL: null, barR: null, surfL: 'grass', surfR: 'grass', curb: true, tfollow: true, bank: 0, barH: 1.0 }, def.defaults || {});
    const wOf = c => { const i0 = Math.floor(c) % NP, i1 = (i0 + 1) % NP, f = smooth(0, 1, c - Math.floor(c)); return lerp(def.pts[i0][3] || def.width || 16, def.pts[i1][3] || def.width || 16, f); };
    const inR = (c, a, b) => a <= b ? (c >= a && c < b) : (c >= a || c < b);
    const extraBank = A();
    for (let i = 0; i < n; i++) {
      const c = this.c[i]; const s = Object.assign({}, D);
      for (const sec of def.secs || []) if (inR(c, sec.a, sec.b)) Object.assign(s, sec);
      this.hw[i] = (s.width || wOf(c)) / 2; this.shL[i] = s.shL; this.shR[i] = s.shR; extraBank[i] = s.bank * Math.PI / 180; this.barH[i] = s.barH;
      let f = 0;
      if (s.wallL) f |= F_WALL_L; if (s.wallR) f |= F_WALL_R; if (s.gap) f |= F_GAP; if (s.tunnel) f |= F_TUNNEL; if (s.agrav) f |= F_AGRAV;
      if (s.loop) f |= F_LOOP; if (s.launch) f |= F_LAUNCH; if (s.trick) f |= F_TRICK; if (s.curb) f |= F_CURB; if (s.tfollow) f |= F_TFOLLOW;
      if (s.barL) f |= F_BAR_L; if (s.barR) f |= F_BAR_R; if (s.nosafe) f |= F_NOSAFE; if (s.skirt) f |= F_SKIRT;
      this.flags[i] = f; this.surfL[i] = SURF[s.surfL] || 0; this.surfR[i] = SURF[s.surfR] || 0;
      this.barStyleL[i] = s.barL; this.barStyleR[i] = s.barR;
    }
    this.smoothArr(this.shL, 6); this.smoothArr(this.shR, 6); this.smoothArr(extraBank, 14); this.smoothArr(this.hw, 4);
    // --- curvature & auto bank
    const bf = def.bankFactor ?? 6, maxB = (def.maxBank ?? 18) * Math.PI / 180;
    for (let i = 0; i < n; i++) {
      const a = this.wrap(i - 3), b = this.wrap(i + 3);
      const cy = this.tz[a] * this.tx[b] - this.tx[a] * this.tz[b];   // (Ta x Tb).y  (left turn positive)
      this.curv[i] = cy / (6 * this.ds);
    }
    this.smoothArr(this.curv, 5);
    this.curbOn = new Uint8Array(n);
    for (let i = 0; i < n; i++) { if (!(this.flags[i] & F_CURB)) continue; let m = 0; for (let k = -14; k <= 14; k++) m = Math.max(m, Math.abs(this.curv[this.wrap(i + k)])); this.curbOn[i] = m > (def.curbCurv || 0.0075) ? 1 : 0; }
    for (let i = 0; i < n; i++) this.bank[i] = (this.flags[i] & F_LOOP) ? 0 : clamp(-this.curv[i] * bf, -maxB, maxB);
    this.smoothArr(this.bank, 18);
    for (let i = 0; i < n; i++) this.bank[i] += extraBank[i];
    // --- frames
    const N = new THREE.Vector3(), T = new THREE.Vector3(), Tp = new THREE.Vector3(), Np = new THREE.Vector3(), N0 = new THREE.Vector3(), B = new THREE.Vector3();
    const baseN = []; let blend = 0;
    for (let i = 0; i < n; i++) {
      T.set(this.tx[i], this.ty[i], this.tz[i]);
      N0.copy(UP).addScaledVector(T, -T.y); if (N0.lengthSq() < 1e-4) N0.copy(Np); N0.normalize();
      const inLoop = this.flags[i] & F_LOOP;
      if (i > 0 && (inLoop || blend > 0)) {
        Tp.set(this.tx[i - 1], this.ty[i - 1], this.tz[i - 1]); _tq.setFromUnitVectors(Tp, T);
        N.copy(Np).applyQuaternion(_tq);
        if (!inLoop) { N.lerp(N0, 1 / blend); blend--; }
        else blend = 40;
      } else N.copy(N0);
      N.addScaledVector(T, -N.dot(T)).normalize();
      baseN.push(N.clone()); Np.copy(N);
    }
    for (let i = 0; i < n; i++) {
      T.set(this.tx[i], this.ty[i], this.tz[i]); N.copy(baseN[i]);
      _tq.setFromAxisAngle(T, this.bank[i]); N.applyQuaternion(_tq);
      B.crossVectors(T, N).normalize(); N.crossVectors(B, T).normalize();
      this.nx[i] = N.x; this.ny[i] = N.y; this.nz[i] = N.z; this.bx[i] = B.x; this.by[i] = B.y; this.bz[i] = B.z;
    }
    this.buildGrid();
    this.computeLine();
    this.boosts = []; this.itemRows = []; this.coinLines = [];
  }
  wrap(i) { const n = this.n; return ((i % n) + n) % n; }
  smoothArr(a, r) { const n = this.n, src = Float32Array.from(a); for (let i = 0; i < n; i++) { let s = 0; for (let k = -r; k <= r; k++) s += src[this.wrap(i + k)]; a[i] = s / (2 * r + 1); } }
  P(i, o) { i = this.wrap(i); return o.set(this.px[i], this.py[i], this.pz[i]); }
  T(i, o) { i = this.wrap(i); return o.set(this.tx[i], this.ty[i], this.tz[i]); }
  N(i, o) { i = this.wrap(i); return o.set(this.nx[i], this.ny[i], this.nz[i]); }
  B(i, o) { i = this.wrap(i); return o.set(this.bx[i], this.by[i], this.bz[i]); }
  // world point at (sample, lateral, height)
  point(i, d, h, o) { i = this.wrap(i); return o.set(this.px[i] + this.bx[i] * d + this.nx[i] * h, this.py[i] + this.by[i] * d + this.ny[i] * h, this.pz[i] + this.bz[i] * d + this.nz[i] * h); }
  edgeL(i) { return -(this.hw[i] + this.shL[i]); }
  edgeR(i) { return this.hw[i] + this.shR[i]; }
  // interpolated frame at sample i + fraction f
  frame(i, f, out) {
    const a = this.wrap(i), b = this.wrap(i + 1), g = 1 - f;
    out.P.set(this.px[a] * g + this.px[b] * f, this.py[a] * g + this.py[b] * f, this.pz[a] * g + this.pz[b] * f);
    out.T.set(this.tx[a] * g + this.tx[b] * f, this.ty[a] * g + this.ty[b] * f, this.tz[a] * g + this.tz[b] * f).normalize();
    out.N.set(this.nx[a] * g + this.nx[b] * f, this.ny[a] * g + this.ny[b] * f, this.nz[a] * g + this.nz[b] * f).normalize();
    out.B.set(this.bx[a] * g + this.bx[b] * f, this.by[a] * g + this.by[b] * f, this.bz[a] * g + this.bz[b] * f).normalize();
    out.hw = this.hw[a] * g + this.hw[b] * f; out.eL = -(out.hw + this.shL[a] * g + this.shL[b] * f); out.eR = out.hw + this.shR[a] * g + this.shR[b] * f;
    out.flags = f < 0.5 ? this.flags[a] : this.flags[b]; out.i = a;
    return out;
  }
  // nearest centerline sample near a hint (local search, 3D distance)
  locate(p, hint, out, win = 14) {
    const n = this.n; let best = -1, bd = Infinity, bf = 0; let center = hint | 0;
    for (let iter = 0; iter < 6; iter++) {
      best = -1; bd = Infinity;
      for (let k = -win; k <= win; k++) {
        const i = this.wrap(center + k), j = this.wrap(i + 1);
        const ax = this.px[i], ay = this.py[i], az = this.pz[i];
        const sx = this.px[j] - ax, sy = this.py[j] - ay, sz = this.pz[j] - az;
        const l2 = sx * sx + sy * sy + sz * sz;
        let f = ((p.x - ax) * sx + (p.y - ay) * sy + (p.z - az) * sz) / l2; f = f < 0 ? 0 : f > 1 ? 1 : f;
        const dx = p.x - ax - sx * f, dy = p.y - ay - sy * f, dz = p.z - az - sz * f;
        const d2 = dx * dx + dy * dy * 1.6 + dz * dz;
        if (d2 < bd) { bd = d2; best = i; bf = f; }
      }
      const off = ((best - center) % n + n + n / 2) % n - n / 2;
      if (Math.abs(off) < win - 1) break;
      center = best;
    }
    const fr = this.frame(best, bf, out);
    _tv[0].copy(p).sub(fr.P);
    out.d = _tv[0].dot(fr.B); out.h = _tv[0].dot(fr.N); out.f = bf; out.i = best; out.s = (best + bf) * this.ds; out.dist2 = bd;
    return out;
  }
  // global nearest (for spawning / lost objects)
  nearestGlobal(p) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < this.n; i += 2) { const dx = p.x - this.px[i], dy = p.y - this.py[i], dz = p.z - this.pz[i]; const d = dx * dx + dy * dy * 2 + dz * dz; if (d < bd) { bd = d; best = i; } }
    return best;
  }
  // spatial hash on XZ for terrain / props
  buildGrid() {
    this.cell = 10; this.grid = new Map();
    for (let i = 0; i < this.n; i++) { const k = Math.floor(this.px[i] / this.cell) * 100003 + Math.floor(this.pz[i] / this.cell); let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(i); }
  }
  idxOfC(c) { c = ((c % this.NP) + this.NP) % this.NP; let lo = 0, hi = this.n - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (this.c[m] < c) lo = m + 1; else hi = m; } return lo; }
  // nearest sample in XZ within radius: returns {i, dist, d(lateral), along}
  nearXZ(x, z, rad = 40, out = {}) {
    const c = this.cell, r = Math.ceil(rad / c), cx = Math.floor(x / c), cz = Math.floor(z / c);
    let best = -1, bd = rad * rad;
    for (let gx = cx - r; gx <= cx + r; gx++) for (let gz = cz - r; gz <= cz + r; gz++) {
      const a = this.grid.get(gx * 100003 + gz); if (!a) continue;
      for (const i of a) { const dx = x - this.px[i], dz = z - this.pz[i], d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
    }
    out.i = best; out.dist = Math.sqrt(bd);
    if (best >= 0) {
      const dx = x - this.px[best], dz = z - this.pz[best];
      const bl = Math.hypot(this.bx[best], this.bz[best]) || 1;
      out.d = (dx * this.bx[best] + dz * this.bz[best]) / bl;
      out.along = dx * this.tx[best] + dz * this.tz[best];
    }
    return out;
  }
  // track surface height (world y) at lateral offset d for sample i
  surfY(i, d) { return this.py[i] + this.by[i] * d / Math.max(0.2, Math.hypot(this.bx[i], this.bz[i])); }
  computeLine() {
    const n = this.n, off = new Float32Array(n), K = 7;
    for (let it = 0; it < 260; it++) {
      for (let i = 0; i < n; i++) {
        const a = this.wrap(i - K), b = this.wrap(i + K);
        const mx = (this.px[a] + this.bx[a] * off[a] + this.px[b] + this.bx[b] * off[b]) / 2;
        const my = (this.py[a] + this.by[a] * off[a] + this.py[b] + this.by[b] * off[b]) / 2;
        const mz = (this.pz[a] + this.bz[a] * off[a] + this.pz[b] + this.bz[b] * off[b]) / 2;
        let d = (mx - this.px[i]) * this.bx[i] + (my - this.py[i]) * this.by[i] + (mz - this.pz[i]) * this.bz[i];
        const fl = this.flags[i];
        let lim = this.hw[i] - 2.6; if (fl & (F_GAP | F_LAUNCH | F_LOOP)) lim = Math.min(lim, 1.5);
        if (fl & F_AGRAV) lim = Math.min(lim, this.hw[i] - 3.5);
        off[i] = clamp(lerp(off[i], d, 0.6), -Math.max(0, lim), Math.max(0, lim));
      }
    }
    const tmp = Float32Array.from(off); for (let i = 0; i < n; i++) { let s = 0; for (let k = -4; k <= 4; k++) s += tmp[this.wrap(i + k)]; this.line[i] = s / 9; }
  }
  // contiguous index runs where pred(i) true -> [[start, lenSamples], ...] (runs may wrap)
  runs(pred) {
    const n = this.n, out = []; let start = -1;
    let first = 0; while (first < n && pred(first)) first++;
    if (first === n) return [[0, n]];
    for (let k = 1; k <= n; k++) {
      const i = (first + k) % n; const on = pred(i);
      if (on && start < 0) start = i;
      if ((!on || k === n) && start >= 0) { const end = on ? i : (i - 1 + n) % n; out.push([start, ((end - start + n) % n) + 1]); start = -1; }
    }
    return out;
  }
  // generic ribbon along the track. prof(i) -> [[d,h],...]  (same count for all samples)
  ribbon(start, len, prof, o = {}) {
    const n = this.n, cols = prof(start).length, closed = len >= n;
    const rows = closed ? n + 1 : len + 1;
    const P = new Float32Array(rows * cols * 3), U = new Float32Array(rows * cols * 2), C = o.color ? new Float32Array(rows * cols * 3) : null;
    const idx = []; const vs = o.vScale || 10;
    for (let r = 0; r < rows; r++) {
      const i = this.wrap(start + r), pr = prof(i);
      for (let c = 0; c < cols; c++) {
        const [d, h] = pr[c]; const k = (r * cols + c);
        P[k * 3] = this.px[i] + this.bx[i] * d + this.nx[i] * h; P[k * 3 + 1] = this.py[i] + this.by[i] * d + this.ny[i] * h; P[k * 3 + 2] = this.pz[i] + this.bz[i] * d + this.nz[i] * h;
        U[k * 2] = o.uAcross ? c / (cols - 1) : d / (o.uScale || 1); U[k * 2 + 1] = (r * this.ds) / vs + (o.v0 || 0) + (closed ? 0 : start * this.ds / vs);
        if (C) { const col = o.color(i, c, r); C[k * 3] = col.r; C[k * 3 + 1] = col.g; C[k * 3 + 2] = col.b; }
      }
    }
    for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
      if (o.flip) idx.push(a, d, b, b, d, e); else idx.push(a, b, d, b, e, d);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    if (C) g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    g.setIndex(rows * cols > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    g.computeVertexNormals();
    return g;
  }
  merge(list) { const g = mergeGeos(list.filter(Boolean)); list.forEach(x => x && x.dispose()); return g; }
  // --------------------------- standard meshes ---------------------------
  roadGeo(lift = 0.03, cols = 5) {
    const gs = this.runs(i => !(this.flags[i] & F_GAP) && !(this.flags[this.wrap(i + 1)] & F_GAP));
    const list = [];
    for (const [s, l] of gs) list.push(this.ribbon(s, l, i => { const w = this.hw[i], a = []; for (let c = 0; c < cols; c++) a.push([-w + 2 * w * c / (cols - 1), lift]); return a; }, { uScale: 14, vScale: 14 }));
    return this.merge(list);
  }
  curbGeo(cw = 1.3) {
    const list = [];
    for (const side of [-1, 1]) {
      const rs = this.runs(i => this.curbOn[i] && !(this.flags[i] & F_GAP) && !(this.flags[this.wrap(i + 1)] & F_GAP));
      for (const [s, l] of rs) {
        list.push(this.ribbon(s, l, i => { const w = this.hw[i] - 0.15; const p = [[w, 0.035], [w + 0.22, 0.13], [w + cw - 0.22, 0.13], [w + cw, 0.03]]; return side < 0 ? p.map(([d, h]) => [-d, h]).reverse() : p; }, { uAcross: true, vScale: 4 }));
      }
    }
    return this.merge(list);
  }
  // visible barrier along edges where barrier style matches
  barrierGeo(style, profile, colorFn) {
    const list = [];
    for (const side of [-1, 1]) {
      const flag = side < 0 ? F_BAR_L : F_BAR_R, st = side < 0 ? this.barStyleL : this.barStyleR;
      const rs = this.runs(i => (this.flags[i] & flag) && st[i] === style);
      for (const [s, l] of rs) {
        list.push(this.ribbon(s, l, i => {
          const e = side < 0 ? this.edgeL(i) : this.edgeR(i); const hs = this.barH[i];
          const pr = profile.map(([d, h]) => [e + side * d, h * hs]);
          return side < 0 ? pr.slice().reverse() : pr;
        }, { uAcross: true, vScale: 4, color: colorFn ? (i, c, r) => colorFn(i, c, r, side) : null }));
      }
    }
    return list.length ? this.merge(list) : null;
  }
  // vertical side skirts from the corridor edge down to bottom(i, side)
  skirtGeo(pred, bottom, edge = 'corridor') {
    const list = [];
    for (const side of [-1, 1]) {
      const rs = this.runs(pred);
      for (const [s, l] of rs) {
        const rows = l + 1, P = new Float32Array(rows * 2 * 3), U = new Float32Array(rows * 2 * 2), idx = [];
        for (let r = 0; r < rows; r++) {
          const i = this.wrap(s + r); const d = edge === 'road' ? side * this.hw[i] : (side < 0 ? this.edgeL(i) : this.edgeR(i));
          const x = this.px[i] + this.bx[i] * d, y = this.py[i] + this.by[i] * d + 0.05, z = this.pz[i] + this.bz[i] * d;
          const yb = bottom(i, side, y);
          P.set([x, y, z, x, yb, z], r * 6); U.set([r * this.ds / 4, 0, r * this.ds / 4, (y - yb) / 4], r * 4);
          if (r < rows - 1) { const a = r * 2; if (side > 0) idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); else idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
        }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.setIndex(idx); g.computeVertexNormals();
        list.push(g);
        // end caps at run boundaries (ramp lip / landing faces)
        if (l < this.n) for (const [ii, dir] of [[s, -1], [this.wrap(s + l - 1), 1]]) {
          if (side > 0) continue;
          const eL = this.edgeL(ii), eR = this.edgeR(ii);
          const a0 = this.point(ii, eL, 0.05, new THREE.Vector3()), a1 = this.point(ii, eR, 0.05, new THREE.Vector3());
          const b0 = a0.clone(); b0.y = bottom(ii, -1, a0.y); const b1 = a1.clone(); b1.y = bottom(ii, 1, a1.y);
          const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute([...a0.toArray(), ...a1.toArray(), ...b0.toArray(), ...b1.toArray()], 3));
          cg.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, (eR - eL) / 4, 0, 0, (a0.y - b0.y) / 4, (eR - eL) / 4, (a1.y - b1.y) / 4], 2));
          cg.setIndex(dir > 0 ? [0, 2, 1, 1, 2, 3] : [0, 1, 2, 1, 3, 2]); cg.computeVertexNormals(); list.push(cg);
        }
      }
    }
    return list.length ? this.merge(list) : null;
  }
  startLineGeo() {
    const g = this.ribbon(0, 3, i => { const w = this.hw[i]; return [[-w, 0.06], [w, 0.06]]; }, { uScale: 1, vScale: 1 });
    const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) / 2, (k >> 1) / 3 * 1.5);
    return g;
  }
}

// ---------- boost pads (shared shader) ----------
export function boostPadMat(color1 = 0xffe14a, color2 = 0xff6a00, star = false) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: { uTime: TIME_U, c1: { value: COL(color1) }, c2: { value: COL(color2) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime; uniform vec3 c1, c2; varying vec2 vUv;
      float sdStar(vec2 p, float r, float rf){ const vec2 k1 = vec2(0.809016994375, -0.587785252292); const vec2 k2 = vec2(-k1.x,k1.y);
        p.x = abs(p.x); p -= 2.0*max(dot(k1,p),0.0)*k1; p -= 2.0*max(dot(k2,p),0.0)*k2; p.x = abs(p.x); p.y -= r;
        vec2 ba = rf*vec2(-k1.y,k1.x) - vec2(0,1); float h = clamp( dot(p,ba)/dot(ba,ba), 0.0, r ); return length(p-ba*h) * sign(p.y*ba.x-p.x*ba.y); }
      void main(){
        vec2 uv = vUv; vec2 c = uv - 0.5;
        float frame = max(abs(c.x), abs(c.y));
        float border = smoothstep(0.5, 0.47, frame) - smoothstep(0.44, 0.41, frame);
        float ph = fract(uv.y*2.0 - uTime*2.2);
        float shape;
        ${star ? `vec2 q = vec2(c.x*1.1, fract(uv.y*2.0 - uTime*1.6) - 0.5); shape = smoothstep(0.02, -0.02, sdStar(q, 0.3, 0.45));`
        : `float chev = abs(c.x)*1.2 + fract(uv.y*2.0 - uTime*2.2); shape = smoothstep(0.62, 0.66, chev) - smoothstep(0.88, 0.92, chev);`}
        vec3 base = mix(c2*0.35, c2*0.9, uv.y);
        vec3 col = base + c1*shape*2.4 + vec3(1.0)*border*1.6;
        float glow = 0.75 + 0.25*sin(uTime*8.0);
        gl_FragColor = vec4(col*glow*1.3, 0.92*smoothstep(0.5, 0.46, frame));
      }`,
  });
}


