// 08_chars.js (Kart Party Deluxe)
import * as THREE from 'three';
import { COL, NOISE_TEX, TAU, UP, V3, canvasTex, clamp, damp, makeCanvas, rand, randi } from './01_core.js';
import { GB, M4, TEX, TIME_U, physMat, stdMat, superEllipsoid } from './02_gfx.js';

// ============================================================================
// CHARACTERS & KARTS — procedural, smooth, glossy; rig + animation
// ============================================================================
// eye helper: white oval, iris, pupil, highlight (facing -z)
function eye(gb, x, y, z, s = 1, iris = 0x2a64d6, o = {}) {
  const sx = o.sx || 0.85, sy = o.sy || 1.3;
  gb.sphere(0.075 * s, 0xffffff, x, y, z, sx, sy, 0.6);
  if (iris !== null) gb.sphere(0.047 * s, iris, x, y - 0.008 * s, z - 0.036 * s, sx * 1.05, sy * 0.95, 0.5);
  gb.sphere((o.pupil || 0.027) * s, 0x0c0a1c, x, y - 0.008 * s, z - 0.05 * s, sx * 1.05, sy * 0.95, 0.5);
  gb.sphere(0.014 * s, 0xffffff, x - 0.016 * s * Math.sign(x || 1), y + 0.03 * s, z - 0.062 * s);
  gb.sphere(0.008 * s, 0xffffff, x + 0.012 * s * Math.sign(x || 1), y - 0.03 * s, z - 0.06 * s);
}
function capGeo(gb, col, emb, x = 0, y = 0.26, z = 0.02, r = 0.315) {
  gb.add(new THREE.SphereGeometry(r, 26, 14, 0, TAU, 0, Math.PI * 0.52), col, M4(x, y, z, -0.18, 0, 0, 1.03, 0.92, 1.06));
  gb.add(superEllipsoid(0.24, 0.035, 0.16, 0.45), col, M4(x, y + 0.01, z - 0.3, 0.08, 0, 0));
  gb.sphere(0.095, 0xffffff, x, y + 0.13, z - 0.265, 1, 1, 0.35, -0.5); gb.sphere(0.05, emb, x, y + 0.13, z - 0.3, 1, 1, 0.3, -0.5);
}
export const CHARS = [
  { id: 'marco', name: 'Marco', css: '#e52521', w: 'medium', stats: [3, 3, 3, 3], kart: { main: 0xe8202a, acc: 0xffffff, rim: 0xffd21a, dark: 0x2a2a38 },
    build(b) {
      const skin = 0xffc79a, red = 0xe52521, blue = 0x2146d0, brown = 0x3b2314;
      b.body.sphere(0.24, red, 0, 0.26, 0, 1, 1.05, 0.9); b.body.sphere(0.255, blue, 0, 0.13, 0.01, 1.02, 0.75, 0.95);
      for (const s of [-1, 1]) { b.body.capsule(0.045, 0.2, blue, s * 0.1, 0.3, -0.14, 0.3, 0, s * 0.25); b.body.sphere(0.035, 0xffd21a, s * 0.1, 0.25, -0.22); b.body.capsule(0.085, 0.26, blue, s * 0.12, 0.06, -0.24, Math.PI / 2); b.body.sphere(0.1, 0x6b3a1e, s * 0.12, 0.05, -0.45, 1, 0.8, 1.35); }
      const h = b.head; h.sphere(0.3, skin, 0, 0.22, 0, 1, 0.95, 0.95); capGeo(h, red, red);
      h.sphere(0.105, 0xffae80, 0, 0.16, -0.3); for (const s of [-1, 1]) { h.sphere(0.085, brown, s * 0.085, 0.085, -0.27, 1.5, 0.62, 0.8, 0, 0, s * 0.35); h.sphere(0.07, skin, s * 0.3, 0.2, 0.02); h.sphere(0.07, brown, s * 0.25, 0.18, 0.1, 0.8, 1.2, 0.8); h.capsule(0.022, 0.08, brown, s * 0.095, 0.36, -0.255, 0, 0, Math.PI / 2 + s * 0.15); }
      h.sphere(0.2, brown, 0, 0.13, 0.15, 1.35, 0.7, 0.8); h.sphere(0.06, 0xff9a9a, 0.0, 0.03, -0.27, 1.2, 0.5, 0.5);
      for (const s of [-1, 1]) eye(b.eyes, s * 0.09, 0.265, -0.245, 1, 0x2a64d6);
      b.sleeve = red; b.hand = 0xffffff; b.headY = 0.42; b.shoulder = [0.22, 0.34];
    } },
  { id: 'luca', name: 'Luca', css: '#1f9e3a', w: 'medium', stats: [3, 3, 3, 4], kart: { main: 0x22b04a, acc: 0xffffff, rim: 0x2f7bff, dark: 0x2a2a38 },
    build(b) {
      const skin = 0xffc79a, grn = 0x1fa83e, blue = 0x2146d0, brown = 0x3b2314;
      b.body.sphere(0.22, grn, 0, 0.3, 0, 0.95, 1.25, 0.88); b.body.sphere(0.235, blue, 0, 0.13, 0.01, 1.0, 0.8, 0.95);
      for (const s of [-1, 1]) { b.body.capsule(0.042, 0.26, blue, s * 0.09, 0.34, -0.13, 0.25, 0, s * 0.2); b.body.sphere(0.033, 0xffd21a, s * 0.09, 0.27, -0.2); b.body.capsule(0.08, 0.3, blue, s * 0.11, 0.06, -0.25, Math.PI / 2); b.body.sphere(0.095, 0x6b3a1e, s * 0.11, 0.05, -0.47, 1, 0.8, 1.35); }
      const h = b.head; h.sphere(0.285, skin, 0, 0.24, 0, 0.95, 1.02, 0.95); capGeo(h, grn, grn, 0, 0.3, 0.02, 0.3);
      h.sphere(0.1, 0xffae80, 0, 0.17, -0.29, 1, 1.05, 1); for (const s of [-1, 1]) { h.sphere(0.075, brown, s * 0.08, 0.09, -0.26, 1.55, 0.6, 0.8, 0, 0, s * 0.4); h.sphere(0.066, skin, s * 0.285, 0.22, 0.02); h.sphere(0.065, brown, s * 0.24, 0.19, 0.1, 0.8, 1.3, 0.8); h.capsule(0.02, 0.08, brown, s * 0.09, 0.39, -0.245, 0, 0, Math.PI / 2 + s * 0.25); }
      h.sphere(0.19, brown, 0, 0.14, 0.15, 1.3, 0.75, 0.8);
      for (const s of [-1, 1]) eye(b.eyes, s * 0.085, 0.28, -0.24, 1, 0x2a64d6);
      b.sleeve = grn; b.hand = 0xffffff; b.headY = 0.5; b.shoulder = [0.2, 0.4]; b.scale = 1.02;
    } },
  { id: 'rosa', name: 'Princess Rosa', css: '#ff5fb3', w: 'light', stats: [2.5, 3.5, 2, 3.5], kart: { main: 0xff6ab8, acc: 0xffffff, rim: 0xffc21a, dark: 0x3a2a44 },
    build(b) {
      const skin = 0xffd9bd, pink = 0xff7ac3, dpink = 0xe0489a, blond = 0xffd24a, gold = 0xffc21a;
      b.body.lathe([[0, 0.44], [0.13, 0.42], [0.17, 0.32], [0.15, 0.22], [0.26, 0.08], [0.36, -0.06], [0.38, -0.1], [0, -0.1]], pink, 0, 0, 0, 0, 0, 0, 24);
      b.body.torus(0.37, 0.035, dpink, 0, -0.07, 0, Math.PI / 2); b.body.torus(0.165, 0.025, dpink, 0, 0.22, 0, Math.PI / 2);
      b.body.sphere(0.045, 0x3a7ae8, 0, 0.36, -0.14, 1, 1, 0.6); b.body.sphere(0.11, 0xffb3de, -0.18, 0.37, 0); b.body.sphere(0.11, 0xffb3de, 0.18, 0.37, 0);
      const h = b.head; h.sphere(0.27, skin, 0, 0.2, 0, 1, 1.02, 0.95);
      h.sphere(0.32, blond, 0, 0.24, 0.1, 1.05, 1.02, 0.95); h.sphere(0.2, blond, 0, 0.36, -0.12, 1.35, 0.55, 0.8);
      for (const s of [-1, 1]) { h.capsule(0.09, 0.3, blond, s * 0.27, 0.02, 0.05, 0.1, 0, s * 0.12); h.sphere(0.1, blond, s * 0.29, -0.16, 0.06); h.sphere(0.03, 0x3a7ae8, s * 0.26, 0.08, -0.02); h.sphere(0.045, 0xffa6b6, s * 0.14, 0.12, -0.22, 1, 0.6, 0.5); }
      h.cyl(0.13, 0.11, 0.1, gold, 0, 0.52, -0.02, -0.15, 0, 0, 16); for (let k = 0; k < 5; k++) { const a = (k - 2) * 0.55; h.cone(0.035, 0.09, gold, Math.sin(a) * 0.12, 0.61, -0.02 - Math.cos(a) * 0.12 + 0.02, -0.15, 0, 0, 8); h.sphere(0.022, 0xffe8a0, Math.sin(a) * 0.12, 0.665, -Math.cos(a) * 0.12); }
      h.sphere(0.03, 0xe8203a, 0, 0.52, -0.14); h.sphere(0.022, 0x3a7ae8, -0.07, 0.52, -0.12); h.sphere(0.022, 0x3a7ae8, 0.07, 0.52, -0.12);
      h.sphere(0.03, 0xff7a9a, 0, 0.08, -0.255, 1.4, 0.7, 0.6); h.sphere(0.03, 0xffc8a8, 0, 0.16, -0.27);
      for (const s of [-1, 1]) { eye(b.eyes, s * 0.085, 0.23, -0.225, 1.08, 0x3a7ae8); for (let k = 0; k < 3; k++) b.eyes.capsule(0.009, 0.04, 0x1a1030, s * (0.1 + k * 0.022), 0.33 - k * 0.012, -0.26, 0, 0, s * (0.6 + k * 0.35)); }
      b.sleeve = 0xffb3de; b.hand = 0xffffff; b.headY = 0.46; b.shoulder = [0.2, 0.36]; b.scale = 0.96;
    } },
  { id: 'shroomy', name: 'Shroomy', css: '#2f7bff', w: 'light', stats: [2, 4.5, 1, 4.5], kart: { main: 0x2f7bff, acc: 0xffffff, rim: 0xff3a3a, dark: 0x2a2a44 },
    build(b) {
      const skin = 0xffe2c4, blue = 0x2f5ad8, gold = 0xffc21a;
      b.body.sphere(0.2, blue, 0, 0.2, 0, 1, 1, 0.9); b.body.sphere(0.16, 0xfff6ea, 0, 0.19, -0.07, 0.85, 1, 0.8); b.body.torus(0.19, 0.02, gold, 0, 0.19, 0, Math.PI / 2, 0, 0, TAU, 1, 1.05, 1);
      b.body.sphere(0.2, 0xffffff, 0, 0.06, 0.01, 1.05, 0.6, 0.95); for (const s of [-1, 1]) { b.body.capsule(0.07, 0.2, 0xffffff, s * 0.1, 0.03, -0.22, Math.PI / 2); b.body.sphere(0.085, 0x6b3a1e, s * 0.1, 0.03, -0.38, 1, 0.8, 1.35); }
      const h = b.head; h.sphere(0.22, skin, 0, 0.12, 0, 1, 1, 0.95);
      const CY = 0.5, CS = 0.7; h.sphere(0.42, 0xffffff, 0, CY, 0.01, 1, CS, 1); h.add(superEllipsoid(0.37, 0.05, 0.37, 0.6), 0xfff0dc, M4(0, CY - 0.17, 0.01));
      const spots = [[0, CY + 0.28, -0.1, 0.13], [0.34, CY + 0.04, -0.12, 0.12], [-0.34, CY + 0.04, -0.12, 0.12], [0.2, CY + 0.16, 0.27, 0.11], [-0.2, CY + 0.16, 0.27, 0.11], [0, CY + 0.1, 0.39, 0.1]];
      for (const [x, y, z, r] of spots) { const n = V3(x, (y - CY) / CS, z).normalize(); const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, n)); h.add(new THREE.SphereGeometry(r, 14, 8), 0xff3030, M4(x * 1.02, y + 0.005, z * 1.02, e.x, e.y, e.z, 1, 0.25, 1)); }
      h.sphere(0.04, 0xb8203a, 0, 0.03, -0.2, 1.3, 0.8, 0.6);
      for (const s of [-1, 1]) { b.eyes.sphere(0.048, 0x0c0a1c, s * 0.07, 0.14, -0.2, 0.8, 1.65, 0.5); b.eyes.sphere(0.016, 0xffffff, s * 0.07 - 0.01, 0.18, -0.222); h.sphere(0.035, 0xffa6b6, s * 0.14, 0.07, -0.18, 1, 0.6, 0.5); }
      b.sleeve = blue; b.hand = skin; b.headY = 0.36; b.shoulder = [0.18, 0.28]; b.scale = 0.95;
    } },
  { id: 'dino', name: 'Dino', css: '#43c93a', w: 'medium', stats: [3, 3.5, 2.5, 3.5], kart: { main: 0x5ad84a, acc: 0xffffff, rim: 0xff3a3a, dark: 0x2a3a2a },
    build(b) {
      const grn = 0x46cf38, wht = 0xffffff, red = 0xff3a3a, org = 0xff8a1a;
      b.body.sphere(0.22, grn, 0, 0.22, 0.02, 1, 1.05, 0.95); b.body.sphere(0.17, wht, 0, 0.2, -0.08, 0.95, 1, 0.8);
      b.body.add(superEllipsoid(0.2, 0.08, 0.18, 0.5), red, M4(0, 0.28, 0.17, 0.5, 0, 0)); b.body.torus(0.18, 0.03, wht, 0, 0.3, 0.2, 0.5 + Math.PI / 2, 0, 0);
      for (const s of [-1, 1]) { b.body.capsule(0.08, 0.24, grn, s * 0.12, 0.05, -0.23, Math.PI / 2); b.body.sphere(0.12, org, s * 0.12, 0.05, -0.43, 1, 0.85, 1.4); }
      b.body.capsule(0.08, 0.25, grn, 0, 0.12, 0.3, 1.2, 0, 0);
      const h = b.head; h.sphere(0.24, grn, 0, 0.2, 0.03, 1, 1.05, 1);
      h.sphere(0.2, grn, 0, 0.12, -0.25, 1.15, 0.88, 1.3); for (const s of [-1, 1]) { h.sphere(0.03, 0x1a5a1a, s * 0.06, 0.2, -0.47); h.sphere(0.1, wht, s * 0.16, 0.06, -0.14, 0.9, 0.8, 0.9); }
      for (let k = 0; k < 3; k++) h.cone(0.06 - k * 0.01, 0.13, red, 0, 0.4 - k * 0.11, 0.2 + k * 0.05, -0.6 - k * 0.3, 0, 0, 10);
      for (const s of [-1, 1]) eye(b.eyes, s * 0.09, 0.4, -0.08, 1.35, 0x1a1030, { sx: 0.8, sy: 1.25, pupil: 0.034 });
      b.sleeve = grn; b.hand = grn; b.headY = 0.42; b.shoulder = [0.2, 0.32];
    } },
  { id: 'spike', name: 'King Spike', css: '#ff8a1a', w: 'heavy', stats: [4.5, 2, 5, 2], kart: { main: 0x40404e, acc: 0xff7a1a, rim: 0xffc21a, dark: 0x1a1a22, spikes: true },
    build(b) {
      const skin = 0xffbe2e, belly = 0xfff0b0, shell = 0x2f9e3a, wht = 0xfff6e8, red = 0xff4a1a, blk = 0x22222a;
      b.body.sphere(0.32, skin, 0, 0.26, 0, 1.08, 1, 0.95); b.body.sphere(0.27, belly, 0, 0.24, -0.1, 1, 1, 0.75);
      for (let k = 0; k < 3; k++) b.body.torus(0.2 - k * 0.02, 0.018, 0xe8d090, 0, 0.14 + k * 0.1, -0.25 + k * 0.01, Math.PI / 2 - 0.3, 0, 0, TAU, 1.1, 1, 0.5);
      b.body.add(new THREE.SphereGeometry(0.44, 26, 14, 0, TAU, 0, Math.PI * 0.55), shell, M4(0, 0.3, 0.22, Math.PI / 2 - 0.2, 0, 0, 1, 0.75, 1));
      b.body.torus(0.43, 0.05, wht, 0, 0.3, 0.2, -0.2, 0, 0, TAU, 1, 1, 1);
      for (let k = 0; k < 7; k++) { const a = k / 7 * TAU; const n = V3(Math.cos(a) * 0.7, Math.sin(a) * 0.7, 0.7).normalize(); const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, V3(n.x, n.y, n.z).applyAxisAngle(V3(1, 0, 0), -0.2))); b.body.add(new THREE.ConeGeometry(0.07, 0.2, 10), wht, M4(n.x * 0.34, 0.3 + n.y * 0.34, 0.22 + n.z * 0.3, e.x, e.y, e.z)); }
      b.body.add(new THREE.ConeGeometry(0.08, 0.22, 10), wht, M4(0, 0.32, 0.6, Math.PI / 2 - 0.2, 0, 0));
      for (const s of [-1, 1]) { b.body.capsule(0.11, 0.24, skin, s * 0.16, 0.07, -0.26, Math.PI / 2); b.body.sphere(0.13, skin, s * 0.16, 0.06, -0.46, 1, 0.8, 1.3); for (let c = -1; c <= 1; c++) b.body.cone(0.025, 0.07, wht, s * 0.16 + c * 0.06, 0.05, -0.61, -Math.PI / 2, 0, 0, 6); }
      const h = b.head; h.sphere(0.3, skin, 0, 0.22, 0, 1.05, 0.95, 1); h.sphere(0.2, 0xffd26a, 0, 0.1, -0.26, 1.25, 0.8, 1.05);
      for (const s of [-1, 1]) { h.sphere(0.028, 0x5a3a10, s * 0.07, 0.17, -0.45); h.cone(0.03, 0.08, wht, s * 0.1, 0.06, -0.44, 0, 0, 0, 8); h.cone(0.06, 0.2, 0xfff0d0, s * 0.2, 0.5, 0.02, 0, 0, -s * 0.5, 12); h.capsule(0.035, 0.12, red, s * 0.1, 0.4, -0.23, 0.2, 0, Math.PI / 2 - s * 0.45); }
      for (let k = 0; k < 7; k++) h.cone(0.07, 0.28, red, (k - 3) * 0.045, 0.46 + Math.sin(k) * 0.03, 0.1 + (k % 2) * 0.05, -0.9 - (k % 3) * 0.2, 0, (k - 3) * 0.18, 8);
      for (const s of [-1, 1]) eye(b.eyes, s * 0.1, 0.3, -0.24, 1.05, 0xe8202a);
      b.sleeve = skin; b.hand = skin; b.cuff = true; b.headY = 0.56; b.shoulder = [0.3, 0.42]; b.scale = 1.1; b.armR = 0.09;
    } },
  { id: 'bongo', name: 'Bongo', css: '#9a5a2a', w: 'heavy', stats: [4.5, 2, 4.5, 2.5], kart: { main: 0xe06a1a, acc: 0xffd21a, rim: 0xffd21a, dark: 0x3a2a1a },
    build(b) {
      const fur = 0x8a4a1e, tan = 0xf0c48a, red = 0xe8202a;
      b.body.sphere(0.33, fur, 0, 0.26, 0.02, 1.15, 1, 0.95); b.body.sphere(0.24, tan, 0, 0.26, -0.13, 1, 1, 0.7);
      b.body.add(superEllipsoid(0.08, 0.17, 0.03, 0.7), red, M4(0, 0.2, -0.3, -0.25, 0, 0)); b.body.sphere(0.05, red, 0, 0.37, -0.27, 1.3, 1, 0.8); b.body.add(new THREE.BoxGeometry(0.1, 0.02, 0.02), 0xffd21a, M4(0, 0.22, -0.33, -0.25, 0, 0.3));
      for (const s of [-1, 1]) { b.body.capsule(0.1, 0.18, fur, s * 0.15, 0.06, -0.24, Math.PI / 2); b.body.sphere(0.12, tan, s * 0.15, 0.05, -0.42, 1, 0.75, 1.3); }
      const h = b.head; h.sphere(0.27, fur, 0, 0.22, 0.02, 1.05, 1, 1);
      h.sphere(0.19, tan, 0, 0.1, -0.2, 1.3, 0.9, 0.85); h.sphere(0.1, tan, -0.08, 0.26, -0.2, 1, 1.1, 0.7); h.sphere(0.1, tan, 0.08, 0.26, -0.2, 1, 1.1, 0.7);
      h.capsule(0.05, 0.2, fur, 0, 0.35, -0.2, 0, 0, Math.PI / 2); for (const s of [-1, 1]) { h.sphere(0.075, tan, s * 0.27, 0.22, 0.02); h.sphere(0.03, 0x3a1a0a, s * 0.05, 0.15, -0.37); }
      h.sphere(0.16, fur, 0, 0.45, 0.02, 1, 0.6, 1); h.cone(0.07, 0.16, fur, 0, 0.53, -0.02, -0.3, 0, 0.2, 8); h.capsule(0.02, 0.1, 0x6a3610, 0, 0.03, -0.35, 0, 0, Math.PI / 2);
      for (const s of [-1, 1]) eye(b.eyes, s * 0.085, 0.26, -0.26, 0.95, 0x5a3010);
      b.sleeve = fur; b.hand = tan; b.headY = 0.52; b.shoulder = [0.33, 0.38]; b.scale = 1.1; b.armR = 0.1;
    } },
  { id: 'shelly', name: 'Shelly', css: '#3ab83a', w: 'light', stats: [2, 4.5, 1.5, 4], kart: { main: 0x3ab83a, acc: 0xffe14a, rim: 0xffffff, dark: 0x22382a },
    build(b) {
      const skin = 0xffd23a, shell = 0x3ab83a, cream = 0xfff4c0, red = 0xff3a3a;
      b.body.sphere(0.2, skin, 0, 0.2, 0, 1, 1.05, 0.9); b.body.sphere(0.17, cream, 0, 0.2, -0.07, 0.95, 1.05, 0.75);
      b.body.add(new THREE.SphereGeometry(0.3, 24, 12, 0, TAU, 0, Math.PI * 0.55), shell, M4(0, 0.22, 0.14, Math.PI / 2 - 0.15, 0, 0, 1, 0.7, 1.05));
      b.body.torus(0.29, 0.04, 0xffffff, 0, 0.22, 0.12, -0.15, 0, 0);
      for (const s of [-1, 1]) { b.body.capsule(0.07, 0.2, skin, s * 0.1, 0.04, -0.22, Math.PI / 2); b.body.sphere(0.09, red, s * 0.1, 0.04, -0.39, 1, 0.8, 1.4); b.body.sphere(0.04, 0xffffff, s * 0.1, 0.07, -0.47); }
      const h = b.head; h.sphere(0.21, skin, 0, 0.17, -0.02, 1, 1.05, 1.15); h.sphere(0.12, skin, 0, 0.1, -0.2, 1.1, 0.8, 1.1);
      h.sphere(0.03, 0xffa6b6, -0.13, 0.12, -0.16); h.sphere(0.03, 0xffa6b6, 0.13, 0.12, -0.16);
      for (const s of [-1, 1]) eye(b.eyes, s * 0.07, 0.28, -0.14, 1.2, 0x1a1030, { sx: 0.8, sy: 1.5, pupil: 0.034 });
      b.sleeve = skin; b.hand = skin; b.headY = 0.38; b.shoulder = [0.18, 0.3]; b.scale = 0.92;
    } },
];
// Les 4 notes du menu (vitesse, accélération, poids, maniabilité) pilotent toute la physique, y compris les valeurs dérivées :
//   grip : adhérence latérale · off : vitesse conservée hors piste · bounce : rebond à l'atterrissage (les légers rebondissent plus)
export const STAT_PHYS = st => ({
  speed: 0.965 + 0.014 * st[0], accel: 0.86 + 0.07 * st[1], mass: 0.75 + 0.16 * st[2], turn: 0.93 + 0.035 * st[3],
  driftW: 0.8 + 0.08 * st[2], grip: 0.92 + 0.035 * st[3], off: 0.9 + 0.03 * st[2] + 0.015 * st[3], bounce: 1.3 - 0.1 * st[2],
});
// Personnalisation du poids (-1 léger, 0 équilibré, +1 lourd) : un kart lourd gagne en vitesse de pointe et en masse, perd en reprise et en maniabilité.
export const WEIGHT_MODS = [{ id: -1, name: 'LÉGER' }, { id: 0, name: 'ÉQUILIBRÉ' }, { id: 1, name: 'LOURD' }];
export const effStats = (st, w = 0) => [clamp(st[0] + 0.5 * w, 0, 5), clamp(st[1] - 0.6 * w, 0, 5), clamp(st[2] + 1.2 * w, 0, 6), clamp(st[3] - 0.5 * w, 0, 5)];
// Notes affichées dans le menu (0 à 5), dérivées de la physique réelle
export const DERIVED_STATS = st => { const p = STAT_PHYS(st); return { drift: clamp((p.driftW - 0.8) / 0.08, 0, 5), grip: clamp((p.grip - 0.92) / 0.035, 0, 5), off: clamp((p.off - 0.9 - 0.045) / 0.03 + 0.4, 0, 5) }; };

// ---------------------------------------------------------------- kart chassis
function kartGeos(k, heavy) {
  const paint = new GB(), chrome = new GB();
  const s = heavy ? 1.06 : 1;
  paint.add(superEllipsoid(0.66 * s, 0.11, 1.08 * s, 0.25), k.dark, M4(0, 0.28, 0.02));
  paint.add(superEllipsoid(0.56 * s, 0.25, 0.9 * s, 0.33), k.main, M4(0, 0.47, 0.08));
  paint.add(superEllipsoid(0.44 * s, 0.19, 0.5 * s, 0.42), k.main, M4(0, 0.43, -0.78 * s));
  paint.add(superEllipsoid(0.3 * s, 0.07, 0.3 * s, 0.5), k.acc, M4(0, 0.6, -0.62 * s, 0.12, 0, 0));
  paint.sphere(0.1, k.acc, 0, 0.62, -0.95 * s, 1, 0.45, 1); paint.sphere(0.06, k.main, 0, 0.66, -0.95 * s, 1, 0.4, 1);
  for (const sd of [-1, 1]) {
    paint.capsule(0.17, 0.95 * s, k.acc, sd * 0.6 * s, 0.38, 0.05, Math.PI / 2);
    paint.add(superEllipsoid(0.21, 0.09, 0.36, 0.4), k.main, M4(sd * 0.7 * s, 0.63, -0.7 * s, 0, 0, -sd * 0.12));
    paint.add(superEllipsoid(0.24, 0.1, 0.42, 0.4), k.main, M4(sd * 0.74 * s, 0.76, 0.7 * s, 0, 0, -sd * 0.12));
    paint.sphere(0.075, 0xfff8e0, sd * 0.24, 0.46, -1.2 * s, 1, 1, 0.6);
  }
  paint.add(superEllipsoid(0.3, 0.33, 0.1, 0.35), k.acc, M4(0, 0.78, 0.5, -0.15, 0, 0));
  paint.add(superEllipsoid(0.28, 0.07, 0.24, 0.4), k.acc, M4(0, 0.56, 0.3));
  paint.add(superEllipsoid(0.44 * s, 0.22, 0.3, 0.3), k.dark, M4(0, 0.55, 0.88 * s));
  paint.add(superEllipsoid(0.56 * s, 0.05, 0.16, 0.4), k.main, M4(0, 1.02, 1.0 * s, -0.1, 0, 0));
  for (const sd of [-1, 1]) paint.add(new THREE.BoxGeometry(0.05, 0.3, 0.12), k.dark, M4(sd * 0.36 * s, 0.86, 0.98 * s));
  if (k.spikes) for (let i = -2; i <= 2; i++) paint.cone(0.06, 0.2, 0xfff6e8, i * 0.2, 0.33, -1.33 * s, -Math.PI / 2, 0, 0, 10);
  // chrome: bumper, exhausts, column, engine bits
  chrome.capsule(0.07, 1.0 * s, 0xffffff, 0, 0.3, -1.22 * s, 0, 0, Math.PI / 2);
  chrome.capsule(0.06, 0.9 * s, 0xffffff, 0, 0.3, 1.14 * s, 0, 0, Math.PI / 2);
  const ex = [];
  for (const sd of [-1, 1]) {
    chrome.cyl(0.085, 0.07, 0.42, 0xffffff, sd * 0.24, 0.66, 1.1 * s, 1.15, 0, 0, 14);
    chrome.torus(0.085, 0.022, 0xffffff, sd * 0.24, 0.75, 1.28 * s, 1.15 - Math.PI / 2, 0, 0);
    ex.push(V3(sd * 0.24, 0.76, 1.3 * s));
    chrome.cyl(0.05, 0.05, 0.25, 0xffffff, sd * 0.15, 0.72, 0.8 * s, 0, 0, 0, 10);
  }
  chrome.cyl(0.03, 0.03, 0.47, 0xffffff, 0, 0.685, -0.41, 0.95, 0, 0, 8);
  return { paint: paint.build(), chrome: chrome.build(), exhausts: ex, scale: s };
}
function wheelGeo(r, w, rimCol) {
  const gb = new GB(); const ri = r * 0.5, b = r * 0.22;
  const prof = [[ri, -w], [r - b, -w], [r - b * 0.3, -w + b * 0.3], [r, -w + b], [r, w - b], [r - b * 0.3, w - b * 0.3], [r - b, w], [ri, w]];
  const g = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 28); g.rotateZ(Math.PI / 2);
  gb.add(g, 0xffffff);
  const hub = new THREE.CylinderGeometry(ri * 1.02, ri * 1.02, w * 1.7, 20); hub.rotateZ(Math.PI / 2); gb.add(hub, rimCol, null, [0.97, 0.97]);
  for (const sd of [-1, 1]) { const cap = new THREE.SphereGeometry(ri * 0.55, 16, 10); cap.scale(0.35, 1, 1); cap.translate(sd * w * 0.86, 0, 0); gb.add(cap, 0xe8e8f0, null, [0.97, 0.97]); for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; const bolt = new THREE.SphereGeometry(ri * 0.12, 8, 6); bolt.translate(sd * w * 0.87, Math.cos(a) * ri * 0.72, Math.sin(a) * ri * 0.72); gb.add(bolt, 0xffffff, null, [0.97, 0.97]); } }
  return gb.build();
}
function steerWheelGeo() {
  const gb = new GB();
  gb.torus(0.17, 0.035, 0x2a2a34, 0, 0, 0, 0, 0, 0); gb.sphere(0.06, 0xff3a3a, 0, 0, 0, 1, 1, 0.5);
  for (let k = 0; k < 3; k++) { const a = k / 3 * TAU + Math.PI / 2; gb.capsule(0.018, 0.13, 0x3a3a44, Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0, 0, 0, a + Math.PI / 2); }
  return gb.build();
}
function flameMat(color) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: TIME_U, col: { value: color }, amt: { value: 0 }, nTex: { value: NOISE_TEX } },
    vertexShader: `varying vec2 vUv; varying vec3 vP; void main(){ vUv = uv; vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime, amt; uniform vec3 col; uniform sampler2D nTex; varying vec2 vUv; varying vec3 vP;
      void main(){ float t = vUv.y; float n = texture2D(nTex, vec2(vUv.x*2.0, t*1.5 - uTime*6.0)).r;
        float core = smoothstep(0.0, 0.25, t)*(1.0 - smoothstep(0.35 + n*0.5, 1.0, t));
        vec3 c = mix(vec3(1.4), col, smoothstep(0.1, 0.55, t));
        float a = core*amt*(0.7 + 0.5*n);
        gl_FragColor = vec4(c*a*2.2, a); }`,
  });
}
let _glowTex = null;
function glowTex() {
  if (_glowTex) return _glowTex;
  const cv = makeCanvas(64, 64), g = cv.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.2, 'rgba(255,255,255,0.8)'); r.addColorStop(0.5, 'rgba(255,255,255,0.2)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); _glowTex = canvasTex(cv, { srgb: false }); return _glowTex;
}
let _blobTex = null;
function blobTex() {
  if (_blobTex) return _blobTex;
  const cv = makeCanvas(64, 64), g = cv.getContext('2d'); const r = g.createRadialGradient(32, 32, 4, 32, 32, 31);
  r.addColorStop(0, 'rgba(0,0,20,0.55)'); r.addColorStop(1, 'rgba(0,0,20,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); _blobTex = canvasTex(cv, { srgb: false }); return _blobTex;
}
export const DRIFT_COLS = [null, COL(0x4ab8ff), COL(0xff9a1a), COL(0xd05aff)];
const _haloY = COL(0xfff0b0);
const _kq = new THREE.Quaternion(), _kv = new THREE.Vector3(), _kv2 = new THREE.Vector3(), _km = new THREE.Matrix4(), _ke = new THREE.Euler();

export class KartVisual {
  constructor(def) {
    this.def = def; const heavy = def.w === 'heavy';
    this.root = new THREE.Group();
    this.body = new THREE.Group(); this.root.add(this.body);
    this.mats = [];
    const P = (m) => { this.mats.push(m); return m; };
    const paintM = P(physMat({ vertexColors: true, roughness: 0.3, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2 }, { rim: 0.35 }));
    const chromeM = P(stdMat({ color: 0xf0f0f8, metalness: 1, roughness: 0.14, envMapIntensity: 1.5 }, { rim: 0.2 }));
    const tireM = P(stdMat({ map: TEX.tread, vertexColors: true, roughness: 0.62, envMapIntensity: 0.6 }, { rim: 0.12 }));
    const charM = P(stdMat({ vertexColors: true, roughness: 0.42, metalness: 0, envMapIntensity: 0.7 }, { rim: 0.45 }));
    const eyeM = P(stdMat({ vertexColors: true, roughness: 0.06, metalness: 0, envMapIntensity: 0.9 }, { rim: 0.05 }));
    const kg = kartGeos(def.kart, heavy); this.exhausts = kg.exhausts; const s = kg.scale;
    const chassis = new THREE.Mesh(kg.paint, paintM), chr = new THREE.Mesh(kg.chrome, chromeM);
    for (const m of [chassis, chr]) { m.castShadow = true; m.receiveShadow = true; this.body.add(m); }
    // wheels: hover(roll) -> steer(yaw) -> spin(pitch)
    this.wheels = [];
    const wf = wheelGeo(0.3 * (heavy ? 1.05 : 1), 0.15, def.kart.rim), wr = wheelGeo(0.37 * (heavy ? 1.08 : 1), 0.2, def.kart.rim);
    const WP = [[-0.72 * s, 0.3, -0.72 * s, 1], [0.72 * s, 0.3, -0.72 * s, 1], [-0.78 * s, 0.37, 0.7 * s, 0], [0.78 * s, 0.37, 0.7 * s, 0]];
    for (const [x, y, z, front] of WP) {
      const hover = new THREE.Group(); hover.position.set(x, y, z); const steer = new THREE.Group(); hover.add(steer);
      const spin = new THREE.Mesh(front ? wf : wr, tireM); spin.castShadow = true; steer.add(spin);
      this.body.add(hover); this.wheels.push({ hover, steer, spin, front, r: front ? 0.3 : 0.37, x, y, z });
    }
    this.wheelR = 0.33;
    // hover rings (anti-gravity)
    this.hoverRings = [];
    const hr = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 8, 20), new THREE.MeshBasicMaterial({ color: COL(0x50e0ff).multiplyScalar(3), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    for (const w of this.wheels) { const r = hr.clone(); r.rotation.x = Math.PI / 2; r.position.set(w.x, 0.08, w.z); r.visible = false; this.body.add(r); this.hoverRings.push(r); }
    // steering wheel
    this.steerWheel = new THREE.Mesh(steerWheelGeo(), charM); this.steerWheelPivot = new THREE.Group();
    this.steerWheelPivot.position.set(0, 0.84, -0.2); this.steerWheelPivot.rotation.x = -0.62; this.steerWheelPivot.add(this.steerWheel); this.body.add(this.steerWheelPivot);
    // character
    const b = { body: new GB(), head: new GB(), eyes: new GB(), scale: 1, armR: 0.068 };
    def.build(b);
    this.char = new THREE.Group(); this.char.position.set(0, 0.5, 0.22); this.char.scale.setScalar(b.scale || 1); this.body.add(this.char);
    const torso = new THREE.Mesh(b.body.build(), charM); torso.castShadow = true; this.char.add(torso);
    this.headPivot = new THREE.Group(); this.headPivot.position.set(0, b.headY, 0); this.char.add(this.headPivot);
    const head = new THREE.Mesh(b.head.build(), charM); head.castShadow = true; this.headPivot.add(head);
    this.eyes = new THREE.Mesh(b.eyes.build(), eyeM); this.headPivot.add(this.eyes);
    this.headY = b.headY;
    // arms: built along +Z from the shoulder pivot
    const armLen = 0.42;
    const ag = new GB(); ag.capsule(b.armR, armLen - 0.12, b.sleeve, 0, 0, armLen / 2 - 0.02, Math.PI / 2); ag.sphere(0.085, b.hand, 0, 0, armLen, 1, 1, 1.15);
    if (b.cuff) { ag.torus(0.1, 0.03, 0x22222a, 0, 0, armLen - 0.1); for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; ag.cone(0.025, 0.08, 0xffffff, Math.cos(a) * 0.12, Math.sin(a) * 0.12, armLen - 0.1, Math.sin(a) * 1.57, 0, -Math.cos(a) * 1.57, 6); } }
    const armGeo = ag.build();
    this.arms = [];
    for (const sd of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(sd * b.shoulder[0], b.shoulder[1], 0); const m = new THREE.Mesh(armGeo, charM); m.castShadow = true; pivot.add(m); this.char.add(pivot);
      this.arms.push({ pivot, sd, len: armLen });
    }
    // flames
    this.flames = [];
    const fg = new THREE.ConeGeometry(0.16, 1.1, 14, 1, true); fg.translate(0, 0.55, 0); fg.rotateX(Math.PI / 2);
    const uvs = fg.attributes.uv; const pp = fg.attributes.position; for (let k = 0; k < uvs.count; k++) uvs.setY(k, clamp(pp.getZ(k) / 1.1, 0, 1));
    this.flameMat = flameMat(COL(0xff7a1a));
    for (const e of this.exhausts) {
      const f = new THREE.Mesh(fg, this.flameMat); f.position.copy(e); f.rotation.x = -0.42; f.visible = false; f.renderOrder = 21; this.body.add(f); this.flames.push(f);
      const f2 = new THREE.Mesh(fg, this.flameMat); f2.scale.set(0.55, 0.55, 0.7); f.add(f2);
    }
    // drift spark halos at rear wheels
    this.halos = [];
    for (const sd of [-1, 1]) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sp.position.set(sd * 0.78 * s, 0.12, 0.95 * s); sp.scale.setScalar(0.9); sp.visible = false; sp.renderOrder = 22; this.body.add(sp); this.halos.push(sp); }
    this.rearContacts = [V3(-0.78 * s, 0.03, 0.8 * s), V3(0.78 * s, 0.03, 0.8 * s)];
    // blob shadow (world space, positioned by game)
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.0), new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.renderOrder = 1;
    // animation state
    this.a = { steer: 0, lean: 0, pitch: 0, bounce: 0, bounceV: 0, driftYaw: 0, spin: 0, look: 0, blinkT: rand(1, 4), blink: 0, emote: null, emoteT: 0, trickT: -1, trickKind: 0, hover: 0, wheelRot: 0, tumble: 0, time: rand(0, 10), celebrateAmt: 0, upsetAmt: 0 };
    this.shrink = 1; this.rollMul = { light: 1.15, medium: 1, heavy: 0.8 }[def.w] || 1;
    this.root.traverse(o => { if (o.isMesh) o.frustumCulled = true; });
  }
  setStar(v) { for (const m of this.mats) m.userData.u.uStar.value = v; }
  setFlash(v) { for (const m of this.mats) m.userData.u.uFlash.value = v; }
  emote(kind, dur = 1.6) { this.a.emote = kind; this.a.emoteT = dur; }
  trick(kind = 0) { this.a.trickT = 0; this.a.trickKind = kind; }   // 0 vrille · 1 roulis droit · 2 salto avant · 3 salto arrière · 4 roulis gauche
  // st: {steer, speed, drift(-1/0/1), stage, boost, boostCol, air, spinT, tumbleT, look(angle or null), hover, dt, grounded}
  update(dt, st) {
    const a = this.a; a.time += dt;
    a.steer = damp(a.steer, st.steer, 14, dt);
    // inclinaison du châssis : le kart se couche dans les virages selon l'accélération latérale (st.lat = lacet × vitesse),
    // plus ou moins selon le poids ; ressort un peu plus lent pour donner de l'inertie
    const lean = clamp((-st.steer * Math.min(1, st.speed / 12) * 0.09 + (st.lat || 0) * 0.0026 + (st.drift ? st.drift * 0.06 : 0)) * this.rollMul, -0.26, 0.26);
    a.lean = damp(a.lean, lean, st.drift ? 9 : 6.5, dt);
    a.driftYaw = damp(a.driftYaw, st.drift ? st.drift * (0.38 + 0.12 * Math.max(0, -st.steer * st.drift)) : 0, st.drift ? 7 : 5, dt);
    // suspension bounce spring
    a.bounceV += (-a.bounce * 220 - a.bounceV * 14) * dt; a.bounce += a.bounceV * dt;
    if (st.landImpulse) { a.bounceV -= st.landImpulse; }
    a.pitch = damp(a.pitch, clamp((st.accel || 0) * 0.0042, -0.085, 0.07) * this.rollMul + (st.air ? -0.08 : 0), 6, dt);   // freinage : le nez plonge · accélération : le nez se cabre
    // spin-out & tumble
    if (st.spinT > 0) a.spin += dt * 16 * Math.min(1, st.spinT * 1.6); else a.spin = damp(a.spin, Math.round(a.spin / TAU) * TAU, 10, dt);
    a.tumble = st.tumbleT > 0 ? a.tumble + dt * 11 : damp(a.tumble, Math.round(a.tumble / TAU) * TAU, 10, dt);
    // trick
    let tx = 0, ty = 0, tz = 0;
    if (a.trickT >= 0) { a.trickT += dt; const p = clamp(a.trickT / 0.55, 0, 1), e = 1 - Math.pow(1 - p, 3); const tk = a.trickKind; if (tk === 0) ty = e * TAU; else if (tk === 1) tz = e * TAU; else if (tk === 4) tz = -e * TAU; else if (tk === 2) tx = -e * TAU; else tx = e * TAU; if (p >= 1) a.trickT = -1; }
    const bodyYaw = a.driftYaw + a.spin + ty;
    this.body.position.set(0, a.bounce * 0.5 + (st.tumbleT > 0 ? 0.4 : 0), 0);
    _ke.set(a.pitch + tx + a.tumble, bodyYaw, a.lean + tz, 'YXZ'); this.body.quaternion.setFromEuler(_ke);
    const squash = 1 + clamp(-a.bounce * 1.2, -0.12, 0.14);
    this.body.scale.set(this.shrink * (2 - squash), this.shrink * squash, this.shrink * (2 - squash) * 0.98 + 0.02 * this.shrink);
    // wheels
    a.wheelRot += st.speed * dt / this.wheelR;
    a.hover = damp(a.hover, st.hover ? 1 : 0, 6, dt);
    for (let i = 0; i < 4; i++) {
      const w = this.wheels[i];
      w.spin.rotation.x = -a.wheelRot * (w.front ? 1.2 : 1);
      w.steer.rotation.y = w.front ? -a.steer * 0.45 : 0;
      w.hover.rotation.z = (w.x < 0 ? -1 : 1) * a.hover * Math.PI / 2 * 0.95;
      w.hover.position.y = w.y - a.hover * 0.08;
      this.hoverRings[i].visible = a.hover > 0.3; if (this.hoverRings[i].visible) this.hoverRings[i].scale.setScalar(0.9 + 0.15 * Math.sin(a.time * 20 + i));
    }
    this.steerWheel.rotation.z = -a.steer * 1.4;
    // character: lean, look back, emotes
    a.blinkT -= dt; if (a.blinkT < 0) { a.blink = 0.14; a.blinkT = rand(1.8, 4.5); } a.blink = Math.max(0, a.blink - dt);
    this.eyes.scale.y = a.blink > 0 ? 0.12 : 1;
    if (a.emoteT > 0) { a.emoteT -= dt; if (a.emoteT <= 0) a.emote = null; }
    a.celebrateAmt = damp(a.celebrateAmt, a.emote === 'celebrate' ? 1 : 0, 8, dt);
    a.upsetAmt = damp(a.upsetAmt, a.emote === 'upset' || st.spinT > 0 || st.tumbleT > 0 ? 1 : 0, 8, dt);
    const lookTarget = st.look != null ? st.look : 0; a.look = damp(a.look, lookTarget, 5, dt);
    const hy = -a.steer * 0.35 * (1 - Math.abs(a.look) / 2) + a.look + Math.sin(a.time * 14) * 0.35 * a.upsetAmt * (st.spinT > 0 ? 0 : 1) + (st.spinT > 0 ? Math.sin(a.time * 9) * 0.4 : 0);
    this.headPivot.rotation.set(-0.08 - a.celebrateAmt * 0.25 + Math.sin(a.time * 3) * 0.03 + (a.upsetAmt * 0.12), hy, -a.steer * 0.12 + Math.sin(a.time * 12) * 0.12 * a.celebrateAmt);
    this.char.rotation.set(0, 0, a.lean * 1.6 - a.steer * 0.06);
    this.char.position.y = 0.5 + Math.abs(Math.sin(a.time * 12)) * 0.08 * a.celebrateAmt + Math.sin(a.time * 2.2) * 0.008;
    // arms: target points in char space
    for (const arm of this.arms) {
      const sd = arm.sd; const sa = a.steer * 0.9;
      // grip point on steering wheel (rotates with wheel)
      const gx = sd * 0.15 * Math.cos(sa), gy = 0.34 - sd * 0.15 * Math.sin(sa) * 0.6, gz = -0.42;
      _kv.set(gx - arm.pivot.position.x, gy - arm.pivot.position.y, gz);
      if (a.celebrateAmt > 0.01) { const w = Math.sin(a.time * 14 + sd) * 0.15; _kv2.set(sd * 0.25 + w, 0.45, -0.05).normalize().multiplyScalar(arm.len); _kv.lerp(_kv2, a.celebrateAmt); }
      if (a.upsetAmt > 0.01 && a.celebrateAmt < 0.5) { _kv2.set(-sd * 0.12, this.headY + 0.1 - arm.pivot.position.y, -0.12); _kv.lerp(_kv2, a.upsetAmt * 0.85); }
      if (a.trickT >= 0) { _kv2.set(sd * 0.4, 0.2, -0.05); _kv.lerp(_kv2, 0.8); }
      _kv.normalize(); arm.pivot.quaternion.setFromUnitVectors(_kv2.set(0, 0, 1), _kv);
    }
    // flames & halos
    const bo = st.boost || 0;
    for (const f of this.flames) { f.visible = bo > 0.02; if (f.visible) { const k = 0.6 + bo * 0.9 + Math.sin(a.time * 40 + f.id) * 0.08; f.scale.set(0.8 + bo * 0.5, 0.8 + bo * 0.5, k); } }
    this.flameMat.uniforms.amt.value = clamp(bo * 1.3, 0, 1.2); if (st.boostCol) this.flameMat.uniforms.col.value.copy(st.boostCol);
    for (const h of this.halos) { h.visible = st.drift !== 0; if (h.visible) { const c = st.stage ? DRIFT_COLS[st.stage] : _haloY; h.material.color.copy(c).multiplyScalar((st.stage ? 3 : 1.4) + Math.random() * 1.5); h.scale.setScalar((st.stage ? 1.0 + st.stage * 0.4 : 0.45) * (0.8 + Math.random() * 0.45)); } }
  }
}

// ---------------------------------------------------------------- cloud creature (rescues / starts / finish)
export function buildCloudy() {
  const g = new THREE.Group(); const gb = new GB();
  const puffs = [[0, 0, 0, 0.9], [0.75, -0.1, 0.1, 0.65], [-0.75, -0.1, 0.1, 0.65], [0.35, 0.35, 0.3, 0.55], [-0.4, 0.3, 0.3, 0.5], [0, -0.35, 0.2, 0.7], [0.5, -0.3, -0.35, 0.5], [-0.5, -0.3, -0.35, 0.5]];
  for (const [x, y, z, r] of puffs) gb.sphere(r, 0xffffff, x, y, z);
  // face on front (-z)
  for (const s of [-1, 1]) { gb.sphere(0.15, 0xffffff, s * 0.26, 0.2, -0.78, 0.9, 1.25, 0.6); gb.sphere(0.09, 0x1a1446, s * 0.26, 0.18, -0.86, 0.9, 1.2, 0.5); gb.sphere(0.035, 0xffffff, s * 0.23, 0.25, -0.9); gb.sphere(0.09, 0xffa6c6, s * 0.46, -0.05, -0.72, 1.2, 0.7, 0.5); }
  gb.sphere(0.1, 0xd83a5a, 0, -0.12, -0.84, 1.4, 0.7, 0.5);
  // goggles on top
  gb.torus(0.16, 0.04, 0x3a3a4a, -0.2, 0.62, -0.45, -0.6, 0, 0); gb.torus(0.16, 0.04, 0x3a3a4a, 0.2, 0.62, -0.45, -0.6, 0, 0);
  gb.sphere(0.13, 0x9fe8ff, -0.2, 0.62, -0.45, 1, 1, 0.4, -0.6); gb.sphere(0.13, 0x9fe8ff, 0.2, 0.62, -0.45, 1, 1, 0.4, -0.6);
  const body = new THREE.Mesh(gb.build(), stdMat({ vertexColors: true, roughness: 0.55 }, { rim: 0.6, rimColor: 0xcfe8ff })); body.castShadow = true; g.add(body);
  // fishing rod
  const rod = new THREE.Group(); rod.position.set(0.8, 0.1, -0.3); g.add(rod);
  const rg = new GB(); rg.cyl(0.03, 0.05, 2.4, 0x8a5a2a, 0, 1.2, 0); rg.cyl(0.09, 0.09, 0.14, 0x3a3a4a, 0, 0.25, 0, 0, 0, Math.PI / 2, 12);
  const rodM = new THREE.Mesh(rg.build(), stdMat({ vertexColors: true, roughness: 0.5 })); rod.add(rodM); rod.rotation.z = -0.9;
  const tip = new THREE.Object3D(); tip.position.set(0, 2.4, 0); rod.add(tip);
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 4), new THREE.MeshBasicMaterial({ color: 0xffffff })); line.geometry.translate(0, -0.5, 0); g.add(line);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 12, Math.PI * 1.5), stdMat({ color: 0xcccccc, metalness: 1, roughness: 0.2 })); g.add(hook);
  // traffic light
  const tl = new THREE.Group(); const tg = new GB(); tg.add(superEllipsoid(0.34, 1.0, 0.22, 0.25), 0x2a2a34, M4(0, 0, 0)); tg.cyl(0.02, 0.02, 0.8, 0x777777, 0, 1.3, 0);
  tl.add(new THREE.Mesh(tg.build(), stdMat({ vertexColors: true, roughness: 0.4 })));
  const lamps = []; for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshBasicMaterial({ color: 0x331111 })); m.position.set(0, 0.6 - k * 0.6, -0.16); m.scale.z = 0.5; tl.add(m); lamps.push(m); }
  tl.visible = false; g.add(tl);
  // checkered flag
  const flag = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 6), new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 1, roughness: 0.3 })); pole.position.y = 0.9; flag.add(pole);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8, 10, 4), new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: { uTime: TIME_U }, vertexShader: `uniform float uTime; varying vec2 vUv; void main(){ vUv = uv; vec3 p = position; p.z += sin(p.x*4.0 - uTime*12.0)*0.12*(p.x+0.6); gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0); }`, fragmentShader: `varying vec2 vUv; void main(){ float c = mod(floor(vUv.x*6.0) + floor(vUv.y*4.0), 2.0); gl_FragColor = vec4(vec3(c*0.95 + 0.03), 1.0); }` }));
  cloth.position.set(0.6, 1.4, 0); flag.add(cloth); flag.position.set(-0.9, 0, -0.3); flag.visible = false; g.add(flag);
  g.userData = { body, rod, tip, line, hook, tl, lamps, flag };
  g.scale.setScalar(1.3);
  return g;
}
export function cloudyLine(c, target) {
  const u = c.userData; u.tip.updateWorldMatrix(true, false);
  const tp = _kv.setFromMatrixPosition(u.tip.matrixWorld);
  c.worldToLocal(tp); const tt = c.worldToLocal(_kv2.copy(target));
  const L = tp.distanceTo(tt); u.line.position.copy(tp); u.line.scale.set(1, L, 1);
  u.line.quaternion.setFromUnitVectors(V3(0, -1, 0), tt.clone().sub(tp).normalize());
  u.hook.position.copy(tt); u.line.visible = u.hook.visible = true;
}


