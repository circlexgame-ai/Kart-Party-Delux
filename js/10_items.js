// 10_items.js (Kart Party Deluxe)
import { late } from './00_registry.js';
import * as THREE from 'three';
import { ITEMS, ITEM_TABLE } from './00_itemtable.js';
import { COL, Prefs, TAU, UP, V3, camera, clamp, grand, makeCanvas, rand } from './01_core.js';
import { GB, HSV_GLSL, M4, TEX, TIME_U, stdMat, superEllipsoid } from './02_gfx.js';
import { Audio_ } from './03_audio.js';
import { F_AGRAV, F_GAP, F_WALL_L, F_WALL_R } from './04_track.js';
import { FX, TILE } from './05_fx.js';
import { BOOST_COL, RaceCtl, World } from './09_kart.js';

// ============================================================================
// ITEMS — item boxes, coins, roulette, projectiles (shells, bananas), star, lightning
// ============================================================================
export { ITEMS };
// ---------------------------------------------------------------- 2D icons (HUD)
export const ICONS = {};
function drawIcons() {
  const S = 224;
  const mk = (fn) => { const c = makeCanvas(S, S), g = c.getContext('2d'); g.translate(S / 2, S / 2); g.lineJoin = 'round'; g.lineCap = 'round'; fn(g); return c; };
  const out = (g, w = 12, col = '#1a1446') => { g.lineWidth = w; g.strokeStyle = col; g.stroke(); };
  const shroom = (g, s = 1, x = 0, y = 0) => {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.beginPath(); g.ellipse(0, 34, 42, 42, 0, 0, TAU); g.fillStyle = '#fff3dc'; g.fill(); out(g, 10);
    for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * 15, 30, 7, 13, 0, 0, TAU); g.fillStyle = '#1a1446'; g.fill(); }
    g.beginPath(); g.moveTo(-80, 18); g.bezierCurveTo(-86, -70, 86, -70, 80, 18); g.quadraticCurveTo(0, 30, -80, 18); g.closePath();
    const gr = g.createLinearGradient(0, -70, 0, 20); gr.addColorStop(0, '#ff5a5a'); gr.addColorStop(1, '#d4141e'); g.fillStyle = gr; g.fill(); out(g, 10);
    g.fillStyle = '#fff'; for (const [sx, sy, r] of [[0, -30, 20], [-52, -4, 15], [52, -4, 15]]) { g.beginPath(); g.ellipse(sx, sy, r, r * 0.9, 0, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.ellipse(-30, -38, 18, 8, -0.5, 0, TAU); g.fill();
    g.restore();
  };
  const shell = (g, col, dark, s = 1) => {
    g.save(); g.scale(s, s);
    g.beginPath(); g.ellipse(0, 26, 80, 30, 0, 0, TAU); g.fillStyle = '#fff'; g.fill(); out(g, 10);
    g.beginPath(); g.ellipse(0, 6, 72, 64, 0, Math.PI, TAU); g.lineTo(72, 14); g.quadraticCurveTo(0, 30, -72, 14); g.closePath();
    const gr = g.createLinearGradient(0, -60, 0, 20); gr.addColorStop(0, col); gr.addColorStop(1, dark); g.fillStyle = gr; g.fill(); out(g, 10);
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 6; g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.lineTo(Math.cos(a) * 24, -16 + Math.sin(a) * 18); } g.closePath(); g.stroke();
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * 24, -16 + Math.sin(a) * 18); g.lineTo(Math.cos(a) * 60, -8 + Math.sin(a) * 38); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(-30, -36, 16, 8, -0.5, 0, TAU); g.fill();
    g.restore();
  };
  ICONS.mushroom = mk(g => shroom(g));
  ICONS.triple = mk(g => { shroom(g, 0.55, -44, 28); shroom(g, 0.55, 44, 28); shroom(g, 0.55, 0, -34); });
  ICONS.green = mk(g => shell(g, '#5ae05a', '#18a02a'));
  ICONS.red = mk(g => shell(g, '#ff5a5a', '#c8101e'));
  ICONS.blue = mk(g => {
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 50, -10); g.bezierCurveTo(s * 110, -60, s * 120, -10, s * 100, 10); g.bezierCurveTo(s * 90, 0, s * 70, 10, s * 50, 10); g.closePath(); g.fillStyle = '#fff'; g.fill(); out(g, 8); }
    shell(g, '#5ab4ff', '#1a5ad8');
    g.fillStyle = '#fff'; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 26 - 9, -40 + Math.abs(i) * 12); g.lineTo(i * 26, -70 + Math.abs(i) * 14); g.lineTo(i * 26 + 9, -40 + Math.abs(i) * 12); g.fill(); out(g, 5); }
  });
  ICONS.banana = mk(g => {
    g.rotate(-0.35); g.beginPath(); g.moveTo(-70, -30); g.bezierCurveTo(-60, 60, 50, 70, 80, -10); g.bezierCurveTo(40, 30, -30, 20, -52, -40); g.closePath();
    const gr = g.createLinearGradient(-60, -40, 60, 60); gr.addColorStop(0, '#fff27a'); gr.addColorStop(1, '#ffc21a'); g.fillStyle = gr; g.fill(); out(g, 10);
    g.beginPath(); g.moveTo(-70, -30); g.lineTo(-78, -52); g.lineTo(-56, -44); g.closePath(); g.fillStyle = '#6a4a1a'; g.fill(); out(g, 6);
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.ellipse(-20, 34, 26, 7, 0.4, 0, TAU); g.fill();
  });
  ICONS.star = mk(g => {
    g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 40 : 92; g.lineTo(Math.cos(a) * r, Math.sin(a) * r + 6); } g.closePath();
    const gr = g.createRadialGradient(-10, -10, 10, 0, 0, 100); gr.addColorStop(0, '#fffbd0'); gr.addColorStop(0.5, '#ffd21a'); gr.addColorStop(1, '#ff9a00'); g.fillStyle = gr; g.fill(); out(g, 10);
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 16, 2, 7, 15, 0, 0, TAU); g.fillStyle = '#1a1446'; g.fill(); }
  });
  ICONS.lightning = mk(g => {
    g.beginPath(); g.moveTo(20, -96); g.lineTo(-50, 10); g.lineTo(-6, 10); g.lineTo(-30, 96); g.lineTo(56, -18); g.lineTo(10, -18); g.lineTo(40, -96); g.closePath();
    const gr = g.createLinearGradient(0, -96, 0, 96); gr.addColorStop(0, '#fffbd0'); gr.addColorStop(1, '#ffc21a'); g.fillStyle = gr; g.fill(); out(g, 10);
  });
  ICONS.coin = (() => { const c = makeCanvas(96, 96), g = c.getContext('2d'); g.drawImage(TEX.coin.image, 0, 0, 96, 96); return c; })();
}

// ---------------------------------------------------------------- 3D item models
function shellGeo(col, dark, spiny) {
  const gb = new GB();
  gb.add(new THREE.SphereGeometry(0.46, 24, 12, 0, TAU, 0, Math.PI / 2), col, M4(0, 0.1, 0, 0, 0, 0, 1, 0.8, 1));
  gb.torus(0.44, 0.07, 0xffffff, 0, 0.1, 0, Math.PI / 2); gb.add(new THREE.SphereGeometry(0.44, 20, 10, 0, TAU, Math.PI / 2, Math.PI / 2), 0xfff6e0, M4(0, 0.1, 0, 0, 0, 0, 1, 0.3, 1));
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; gb.sphere(0.1, 0xffffff, Math.cos(a) * 0.28, 0.36, Math.sin(a) * 0.28, 1, 0.4, 1); }
  gb.sphere(0.13, 0xffffff, 0, 0.47, 0, 1, 0.35, 1);
  if (spiny) { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; gb.cone(0.06, 0.2, 0xffffff, Math.cos(a) * 0.26, 0.45, Math.sin(a) * 0.26, Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6, 8); } gb.cone(0.07, 0.24, 0xffffff, 0, 0.6, 0);
    for (const s of [-1, 1]) gb.add(superEllipsoid(0.34, 0.05, 0.2, 0.5), 0xffffff, M4(s * 0.55, 0.35, 0, 0, 0, s * 0.5)); }
  return gb.build();
}
function bananaGeo() {
  const gb = new GB();
  for (let i = 0; i <= 6; i++) { const t = i / 6, a = -0.9 + t * 1.8, r = 0.13 + Math.sin(t * Math.PI) * 0.1; gb.sphere(r, 0xffd83a, Math.sin(a) * 0.45, 0.3 + Math.cos(a) * 0.3 - 0.25, 0, 1, 1, 1, 0, 0, -a); }
  gb.cyl(0.05, 0.04, 0.12, 0x6a4a1a, Math.sin(-0.95) * 0.5, 0.3 + Math.cos(-0.95) * 0.34 - 0.25, 0, 0, 0, 0.9, 6);
  return gb.build();
}

const ITEM_NAMES = { mushroom: 'MUSHROOM', triple: 'TRIPLE MUSHROOM', green: 'GREEN SHELL', red: 'RED SHELL', banana: 'BANANAS', star: 'STAR', lightning: 'LIGHTNING', blue: 'BLUE SHELL' };
export const Items = {
  shields: [],
  boxes: [], coins: [], proj: [], meshes: {}, group: null, blueActive: false, blueCool: 0, lightCool: 0,
  init() { drawIcons(); },
  build(W) {
    this.clear(); const T = W.track; this.group = new THREE.Group(); W.scene.add(this.group);
    // ---- item boxes
    const rows = W.def.items; const pts = [];
    for (const c of rows) { const i = T.idxOfC(c); const hw = T.hw[i]; const n = hw > 9 ? 5 : 4; for (let k = 0; k < n; k++) { const d = (k - (n - 1) / 2) * (hw * 1.5 / n); pts.push({ i, d }); } }
    this.boxes = pts.map(p => { const pos = T.point(p.i, p.d, 1.25, V3()); return { pos, i: p.i, n: T.N(p.i, V3()), t: 0, alive: true, grow: 1, phase: rand(0, 6) }; });
    const bg = superEllipsoid(0.74, 0.74, 0.74, 0.22, 20, 14);
    const n = this.boxes.length;
    const aScale = new THREE.InstancedBufferAttribute(new Float32Array(n).fill(1), 1); const aPhase = new THREE.InstancedBufferAttribute(new Float32Array(this.boxes.map(b => b.phase)), 1);
    bg.setAttribute('aScale', aScale); bg.setAttribute('aPhase', aPhase);
    const boxMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uTime: TIME_U },
      vertexShader: `attribute float aScale; attribute float aPhase; uniform float uTime; varying vec3 vN; varying vec3 vW; varying vec3 vL;
        mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
        mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
        void main(){ mat3 R = rotY(uTime*1.3 + aPhase)*rotX(0.35 + sin(uTime*0.9 + aPhase)*0.15); vec3 p = R*position*aScale; vL = position; vN = normalize(mat3(modelMatrix)*R*normal);
          vec4 w = modelMatrix*instanceMatrix*vec4(p, 1.0); w.y += sin(uTime*2.2 + aPhase)*0.14; vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float uTime; varying vec3 vN; varying vec3 vW; varying vec3 vL; ${HSV_GLSL}
        void main(){ vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vW); float fr = pow(1.0 - abs(dot(n, v)), 2.0);
          float hue = fract(uTime*0.25 + dot(n, vec3(0.35, 0.55, 0.25)) + vW.y*0.08);
          vec3 c = kpHsv(vec3(hue, 0.75, 1.0));
          vec3 al = abs(vL)/0.74; float e = max(min(al.x, al.y), max(min(al.y, al.z), min(al.x, al.z)));
          float edge = smoothstep(0.78, 0.95, e);
          vec3 h = normalize(v + normalize(vec3(0.4, 0.8, 0.3))); float sp = pow(max(dot(n, h), 0.0), 60.0);
          vec3 col = c*(0.35 + 1.2*fr) + vec3(1.0)*edge*1.4 + vec3(1.0)*sp*2.5;
          gl_FragColor = vec4(col, clamp(0.28 + fr*0.6 + edge*0.6 + sp, 0.0, 1.0)); }`,
    });
    this.boxMesh = new THREE.InstancedMesh(bg, boxMat, n); this.boxMesh.renderOrder = 8; this.boxMesh.frustumCulled = false;
    this.boxes.forEach((b, k) => this.boxMesh.setMatrixAt(k, M4(b.pos.x, b.pos.y, b.pos.z)));
    this.group.add(this.boxMesh); this.boxScale = aScale;
    // "?" billboards
    const qg = new THREE.PlaneGeometry(0.95, 0.95); const qs = new THREE.InstancedBufferAttribute(new Float32Array(n).fill(1), 1); qg.setAttribute('aScale', qs);
    const qm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { map: { value: TEX.qmark }, uTime: TIME_U },
      vertexShader: `attribute float aScale; uniform float uTime; varying vec2 vUv; void main(){ vUv = uv; vec4 c = modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.); c.y += sin(uTime*2.2 + instanceMatrix[3].x)*0.0; float s = aScale*(0.95 + 0.08*sin(uTime*5.0 + instanceMatrix[3].z)); c.xy += position.xy*s; gl_Position = projectionMatrix*c; }`,
      fragmentShader: `uniform sampler2D map; varying vec2 vUv; void main(){ vec4 t = texture2D(map, vUv); gl_FragColor = vec4(t.rgb*1.6, t.a); }` });
    this.qMesh = new THREE.InstancedMesh(qg, qm, n); this.qMesh.renderOrder = 9; this.qMesh.frustumCulled = false;
    this.boxes.forEach((b, k) => this.qMesh.setMatrixAt(k, M4(b.pos.x, b.pos.y, b.pos.z))); this.group.add(this.qMesh); this.qScale = qs;
    // ---- coins
    const cps = [];
    for (const [c0, c1, d] of W.def.coins) { let i0 = T.idxOfC(c0), i1 = T.idxOfC(c1); const len = ((i1 - i0) % T.n + T.n) % T.n; const cnt = Math.max(3, Math.round(len / 7)); for (let k = 0; k < cnt; k++) { const i = T.wrap(i0 + Math.round(k * len / Math.max(1, cnt - 1))); cps.push({ pos: T.point(i, clamp(d, -T.hw[i] + 1.5, T.hw[i] - 1.5), 0.9, V3()), n: T.N(i, V3()), alive: true, t: 0, i }); } }
    this.coins = cps;
    const cg = new THREE.CylinderGeometry(0.46, 0.46, 0.12, 28); cg.rotateX(Math.PI / 2);
    const faceM = stdMat({ map: TEX.coin, emissiveMap: TEX.coin, metalness: 0.55, roughness: 0.3, emissive: 0xffffff, emissiveIntensity: 0.55 }, { rim: 0.5, rimColor: 0xfff0a0 });
    const coinMats = [stdMat({ color: 0xffc21a, metalness: 0.6, roughness: 0.25, emissive: 0xd88a00, emissiveIntensity: 0.6 }, { rim: 0.6, rimColor: 0xfff0a0 }), faceM, faceM];
    this.coinMesh = new THREE.InstancedMesh(cg, coinMats, Math.max(1, cps.length)); this.coinMesh.castShadow = true; this.coinMesh.frustumCulled = false; this.group.add(this.coinMesh);
    // ---- projectile meshes (pooled per type)
    const pm = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m; };
    this.geo = { green: shellGeo(0x3fd83f, 0x18a02a), red: shellGeo(0xff3a3a, 0xc8101e), blue: shellGeo(0x3a9aff, 0x1a5ad8, true), banana: bananaGeo() };
    this.pmat = stdMat({ vertexColors: true, roughness: 0.25, metalness: 0.05 }, { rim: 0.5 });
    this.makeMesh = (type) => pm(this.geo[type], this.pmat);
  },
  clear() {
    if (this.group && this.group.parent) this.group.parent.remove(this.group);
    this.proj = []; this.shields = []; this.boxes = []; this.coins = []; this.blueActive = false; this.blueCool = 0; this.lightCool = 0;
  },
  // ---------------------------------------------------------- per-frame visuals
  animate(dt, t) {
    for (let k = 0; k < this.boxes.length; k++) {
      const b = this.boxes[k];
      if (!b.alive) { b.t += dt; if (b.t > 1.5) { b.alive = true; b.grow = 0; } }
      else if (b.grow < 1) b.grow = Math.min(1, b.grow + dt * 2.2);
      const g = b.grow, s = !b.alive ? 0 : 1 + 2.7 * Math.pow(g - 1, 3) + 1.7 * Math.pow(g - 1, 2);
      this.boxScale.array[k] = s; this.qScale.array[k] = s;
    }
    this.boxScale.needsUpdate = true; this.qScale.needsUpdate = true;
    for (let k = 0; k < this.coins.length; k++) {
      const c = this.coins[k]; if (!c.alive) { c.t -= dt; if (c.t <= 0) c.alive = true; }
      const s = c.alive ? 1 : 0; _im.compose(_iv.copy(c.pos).addScaledVector(c.n, Math.sin(t * 3 + k) * 0.12), _iq.setFromAxisAngle(c.n, t * 3 + k * 0.4), _is.set(s, s, s)); this.coinMesh.setMatrixAt(k, _im);
    }
    this.coinMesh.instanceMatrix.needsUpdate = true;
    this.shields = this.shields.filter(sh => {   // bananes en orbite : retirées dès que le bouclier est perdu
      const k = sh.k;
      if (!k.bShield) { for (const m of sh.m) this.group.remove(m); return false; }
      const base = k.vis.root.position, r = _iv.crossVectors(k.fwd, k.up).normalize();
      sh.m.forEach((m, i) => { const a = t * 3.2 + i * TAU / 3; m.position.copy(base).addScaledVector(r, Math.cos(a) * 1.8 * k.size).addScaledVector(k.fwd, Math.sin(a) * 1.8 * k.size).addScaledVector(k.up, 0.8 * k.size); m.scale.setScalar(k.size); m.quaternion.setFromUnitVectors(UP, k.up).multiply(_iq.setFromAxisAngle(UP, a * 2)); });
      return true;
    });
    for (const p of this.proj) if (p.mesh) {
      p.mesh.position.copy(p.pos);
      if (p.type === 'banana') { p.mesh.quaternion.setFromUnitVectors(UP, p.up || UP); }
      else { p.spin = (p.spin || 0) + dt * 14; p.mesh.quaternion.setFromUnitVectors(UP, p.up || UP).multiply(_iq.setFromAxisAngle(UP, p.spin)); }
      if (p.type === 'blue' && Math.random() < 0.6) FX.add.emit(p.pos.x, p.pos.y, p.pos.z, rand(-1, 1), rand(-1, 1), rand(-1, 1), { life: 0.6, size: 0.7, size1: 0.1, color: COL(0x5ab4ff).multiplyScalar(3), tile: TILE.star, rv: 4 });
      if (p.type === 'red' && Math.random() < 0.3) FX.add.emit(p.pos.x, p.pos.y + 0.3, p.pos.z, 0, 0.5, 0, { life: 0.4, size: 0.35, size1: 0, color: COL(0xff5050).multiplyScalar(2.5), tile: TILE.soft });
    }
  },
  // ---------------------------------------------------------- fixed-step logic
  step(dt, karts) {
    this.blueCool -= dt; this.lightCool -= dt;
    for (const k of karts) {
      if (k.rescue) continue;
      // boxes
      if (!this.noBoxes) for (const b of this.boxes) { if (!b.alive) continue; if (_iv.copy(k.pos).addScaledVector(k.up, 0.8).distanceToSquared(b.pos) < 2.6 * 2.6 * k.size) { b.alive = false; b.t = 0; FX.shatter(b.pos); Audio_.play('itembox', { pos: b.pos, vol: k.isPlayer ? 1 : 0.6 }); if (!k.item && k.rollT <= 0 && !k.finishedLock) this.startRoll(k); } }
      // coins
      for (const c of this.coins) { if (!c.alive) continue; if (k.pos.distanceToSquared(c.pos) < 2.2 * 2.2) { c.alive = false; c.t = 10; if (k.coins < 10) k.coins++; FX.sparkle(c.pos, COL(0xffe060).multiplyScalar(3), 5, 0.6); if (k.isPlayer) Audio_.play('coin'); } }
      // roulette
      if (k.rollT > 0) { k.rollT -= dt; if (k.rollT <= 0) { k.item = k.rollItem; k.itemCount = k.item === 'triple' ? 3 : 1; if (k.isPlayer) { Audio_.play('itemget'); late.UI.itemPop(); late.Game.message(ITEM_NAMES[k.item], 1); } } }   // 86 : nom de l'objet obtenu
      // use
      const want = !!k.input.item && RaceCtl.canDrive && !k.finishedLock; const edge = want && !k.prevItem; k.prevItem = want;
      k.itemCool -= dt;
      if (edge && k.item && k.rollT <= 0 && k.itemCool <= 0 && k.spinT <= 0 && k.tumbleT <= 0) this.use(k, karts);
    }
    // projectiles
    for (const p of this.proj) this.stepProj(p, dt, karts);
    this.alert(karts);
    this.proj = this.proj.filter(p => { if (p.dead && p.mesh) p.mesh.parent && p.mesh.parent.remove(p.mesh); return !p.dead; });
  },
  // 138 : flèche rouge quand une carapace rouge te vise (ou quand la bleue arrive et que tu mènes), dans la direction d'où elle vient
  alert(karts) {
    const pl = karts.find(k => k.isPlayer); let ch = '';
    if (pl && !pl.rescue) for (const p of this.proj) {
      if (p.dead || !(p.type === 'red' && p.target === pl) && !(p.type === 'blue' && p.phase === 'home' && pl.place === 1)) continue;
      const rel = _iv.copy(p.pos).sub(pl.pos); if (rel.lengthSq() > 45 * 45) continue;
      const z = rel.dot(pl.fwd), x = rel.dot(_iv2.crossVectors(pl.fwd, pl.up));
      ch = Math.abs(x) > Math.abs(z) ? (x > 0 ? '▶' : '◀') : (z > 0 ? '▲' : '▼'); break;
    }
    late.UI.setIncoming(ch);
  },
  startRoll(k) {
    const row = Prefs.crazy ? ITEMS.map(() => 1) : ITEM_TABLE[clamp(k.place - 1, 0, 7)].slice();   // 174 : mode objets fous, tous équiprobables
    if (this.blueActive || this.blueCool > 0 || k.place === 1) row[7] = 0;
    if (this.lightCool > 0) row[6] = 0;
    if (k.starT > 0) row[5] = 0;
    let tot = row.reduce((a, b) => a + b, 0), r = grand(0, tot), idx = 0; for (; idx < 8; idx++) { r -= row[idx]; if (r <= 0) break; }
    k.rollItem = ITEMS[Math.min(idx, 7)]; k.rollT = k.isPlayer ? 1.7 : grand(1.2, 1.8);
    if (k.rollItem === 'lightning') this.lightCool = 22; if (k.rollItem === 'blue') this.blueCool = 18;
  },
  use(k, karts) {
    const it = k.item; k.itemCount--; if (k.itemCount <= 0) { k.item = null; k.itemCount = 0; }
    k.itemCool = 0.35;
    const back = !!k.input.back;
    switch (it) {
      case 'mushroom': case 'triple':
        k.giveBoost(1.15, 1.46, BOOST_COL.shroom); Audio_.play('boost', { pos: k.pos, vol: k.isPlayer ? 1.1 : 0.6 }); if (k.isPlayer) late.Game.shake(0.2); break;
      case 'green': this.fire(k, 'green', back, karts); break;
      case 'red': this.fire(k, 'red', back, karts); break;
      case 'banana':   // 28 : sans frein, 3 bananes tournent autour du kart ; frein tenu (ou IA derrière un adversaire) : une banane tombe derrière
        if (back) this.fire(k, 'banana', true, karts); else this.giveShield(k);
        break;
      case 'blue': this.fire(k, 'blue', false, karts); break;
      case 'star': k.starT = 7.5; Audio_.play('star', { pos: k.pos, vol: k.isPlayer ? 1 : 0.5 }); if (k.isPlayer) Audio_.starMusic(true); break;
      case 'lightning': {
        Audio_.play('lightning', { vol: 1 }); late.Game.flash(0.85);
        for (const o of karts) if (o !== k && !o.finishedLock) o.hit('shrink', k);
        k.vis.emote('celebrate', 1.6); break;
      }
    }
  },
  giveShield(k) {
    k.bShield = 3; Audio_.play('banana', { pos: k.pos, vol: k.isPlayer ? 1 : 0.6 });
    if (!this.shields.some(s => s.k === k)) this.shields.push({ k, m: [0, 1, 2].map(() => { const m = this.makeMesh('banana'); this.group.add(m); return m; }) });
    if (k.isPlayer) late.Game.message('BANANA SHIELD', 1.2);
  },
  fire(k, type, back, karts) {
    const T = World.track, dir = _iv.copy(k.fwd);
    if (back && type !== 'blue') dir.negate();
    const p = { type, pos: k.pos.clone().addScaledVector(dir, type === 'banana' ? 2.4 : 2.2).addScaledVector(k.up, type === 'banana' ? 0.9 : 0.5), vel: V3(), ti: k.ti, life: 0, owner: k, bounces: 0, up: k.up.clone(), side: 0, grounded: false, dead: false };
    if (type === 'banana') { p.vel.copy(dir).multiplyScalar(back ? 3 : 18).addScaledVector(k.up, back ? 2 : 7).add(_iv2.copy(k.vel).multiplyScalar(back ? 0.2 : 0.8)); if (back) p.pos.copy(k.pos).addScaledVector(k.fwd, -2.3).addScaledVector(k.up, 0.6); }
    else if (type === 'blue') { p.vel.copy(k.up).multiplyScalar(14); p.pos.copy(k.pos).addScaledVector(k.up, 2); p.target = null; p.phase = 'rise'; this.blueActive = true; }
    else {
      const sp = Math.max(46, k.vel.dot(k.fwd) * (back ? -1 : 1) + 22);
      p.vel.copy(dir).multiplyScalar(sp);
      if (type === 'red' && !back) { p.home = true; p.target = karts.find(o => o.place === k.place - 1 && !o.finishedLock) || null; }
    }
    p.mesh = this.makeMesh(type); p.mesh.position.copy(p.pos); this.group.add(p.mesh);
    this.proj.push(p);
    Audio_.play(type === 'banana' ? 'banana' : 'throw', { pos: k.pos, vol: k.isPlayer ? 1 : 0.6 });
  },
  stepProj(p, dt, karts) {
    const T = World.track; p.life += dt;
    if (p.type === 'blue') return this.stepBlue(p, dt, karts);
    const maxLife = p.type === 'banana' ? 90 : p.type === 'red' ? 9 : 8;
    if (p.life > maxLife) { p.dead = true; FX.burst(p.pos, 10, { color: COL(0xffffff).multiplyScalar(2), sp: 4, life: 0.4, size: 0.3, tile: TILE.star }); return; }
    // homing (red)
    if (p.type === 'red' && p.home && p.grounded) {
      let desired = null;
      if (p.target && !p.target.rescue && !p.target.finishedLock) { const tp = _iv.copy(p.target.pos).sub(p.pos); if (tp.length() < 34) desired = tp.normalize(); }
      if (!desired) { const j = T.wrap(p.ti + 14); desired = T.point(j, T.line[j] * 0.5, 0.4, _iv).sub(p.pos).normalize(); }
      desired.addScaledVector(p.up, -desired.dot(p.up)).normalize();
      const sp = Math.max(44, p.vel.length()); const cur = _iv2.copy(p.vel).normalize();
      cur.lerp(desired, 1 - Math.exp(-7 * dt)).normalize(); p.vel.copy(cur).multiplyScalar(sp);
    }
    if (p.grounded || p.type === 'banana' && p.landed) {} // fallthrough
    if (!(p.type === 'banana' && p.landed)) p.pos.addScaledVector(p.vel, dt);
    const L = T.locate(p.pos, p.ti, p.loc || (p.loc = { P: V3(), T: V3(), N: V3(), B: V3() })); p.ti = L.i;
    const fl = L.flags; const inside = L.d >= L.eL && L.d <= L.eR;
    const floor = inside && !(fl & F_GAP) && p.side === 0;
    // walls
    if (p.side === 0) {
      const r = 0.45;
      if (L.d > L.eR - r && (fl & F_WALL_R)) { p.pos.addScaledVector(L.B, -(L.d - (L.eR - r))); const vb = p.vel.dot(L.B); if (vb > 0) { p.vel.addScaledVector(L.B, -2 * vb); p.bounces++; if (p.type !== 'banana') Audio_.play('bump', { pos: p.pos, vol: 0.4 }); } }
      else if (L.d < L.eL + r && (fl & F_WALL_L)) { p.pos.addScaledVector(L.B, (L.eL + r) - L.d); const vb = p.vel.dot(L.B); if (vb < 0) { p.vel.addScaledVector(L.B, -2 * vb); p.bounces++; if (p.type !== 'banana') Audio_.play('bump', { pos: p.pos, vol: 0.4 }); } }
      else if (!inside) p.side = L.d > 0 ? 1 : -1;
    }
    if (p.type === 'green' && p.bounces > 6) p.life = 99;
    if (floor && L.h <= 0.45 + (p.grounded ? 0.6 : 0)) {
      p.pos.addScaledVector(L.N, 0.45 - L.h); const vn = p.vel.dot(L.N); p.vel.addScaledVector(L.N, -vn); p.grounded = true; p.up.copy(L.N);
      if (p.type === 'banana') { p.vel.multiplyScalar(Math.exp(-10 * dt)); if (p.vel.lengthSq() < 0.5) { p.landed = true; p.vel.set(0, 0, 0); } }
      else { const sp = p.type === 'red' ? Math.max(44, p.vel.length()) : p.vel.length(); p.vel.setLength(sp); }
    } else {
      p.grounded = false; const g = (fl & F_AGRAV) && inside ? _iv.copy(L.N).negate() : _iv.set(0, -1, 0); p.vel.addScaledVector(g, 22 * dt);
      if (L.h < -14 || (World.waterY != null && p.pos.y < World.waterY - 0.3) || p.pos.lengthSq() > 1200 * 1200) { if (World.waterY != null && p.pos.y < 0.3) FX.splash(p.pos); p.dead = true; return; }
      if (World.terrain && p.side !== 0) { const th = World.terrain.height(p.pos.x, p.pos.z); if (p.pos.y < th + 0.4) { p.pos.y = th + 0.4; p.vel.y = Math.max(0, p.vel.y); if (p.type === 'banana') { p.landed = true; p.vel.set(0, 0, 0); } } }
    }
    // hits
    for (const k of karts) {
      if (k.rescue || (k === p.owner && p.life < (p.type === 'banana' ? 0.6 : 0.35))) continue;
      const rr = (p.type === 'banana' ? 1.25 : 1.35) * k.size;
      if (k.pos.distanceToSquared(p.pos) < rr * rr + 0.4) {
        const hitOk = k.hit('spin', p.owner);
        if (p.type === 'banana' && hitOk) Audio_.play('slip', { pos: k.pos });
        if (hitOk || k.starT > 0 || k.invulnT > 0) { p.dead = true; FX.burst(p.pos, 16, { color: [COL(0xffffff).multiplyScalar(3), COL(p.type === 'red' ? 0xff5050 : p.type === 'green' ? 0x60ff60 : 0xffe060).multiplyScalar(3)], sp: 7, life: 0.5, size: 0.35, tile: TILE.star, rv: 6 }); return; }
      }
    }
    // projectile vs projectile
    for (const o of this.proj) { if (o === p || o.dead || o.type === 'blue') continue; if (o.pos.distanceToSquared(p.pos) < 1.0) { o.dead = p.dead = true; FX.burst(p.pos, 18, { color: COL(0xffffff).multiplyScalar(3), sp: 7, life: 0.45, size: 0.35, tile: TILE.star }); Audio_.play('bump', { pos: p.pos }); return; } }
  },
  stepBlue(p, dt, karts) {
    const T = World.track;
    const leader = karts.filter(k => !k.finishedLock).sort((a, b) => a.place - b.place)[0];
    if (!leader || p.life > 20) { p.dead = true; this.blueActive = false; Audio_.siren(0); return; }
    Audio_.siren(clamp(1 - camera.position.distanceTo(p.pos) / 120, 0.1, 1));
    if (p.phase === 'rise') { p.pos.addScaledVector(p.vel, dt); if (p.life > 0.4) { p.phase = 'fly'; p.ti = World.track.locate(p.pos, p.ti, p.loc || (p.loc = { P: V3(), T: V3(), N: V3(), B: V3() })).i; p.fi = p.ti; } return; }
    if (p.phase === 'fly') {
      const target = leader.ti; let ahead = ((target - p.fi) % T.n + T.n) % T.n;
      if (ahead > T.n * 0.9) ahead = 0;
      if (ahead < 12) { p.phase = 'home'; p.homeT = 0; }
      else { p.fi += 75 * dt / T.ds; const i = Math.floor(p.fi) % T.n, f = p.fi - Math.floor(p.fi); const fr = T.frame(i, f, p.loc); const tgt = _iv.copy(fr.P).addScaledVector(fr.N, 7); p.pos.lerp(tgt, 1 - Math.exp(-12 * dt)); p.up.copy(fr.N); }
      return;
    }
    // home in and slam
    p.homeT += dt;
    const tgt = _iv.copy(leader.pos).addScaledVector(leader.up, p.homeT < 0.6 ? 7 : 0.5);
    p.pos.lerp(tgt, 1 - Math.exp(-(p.homeT < 0.6 ? 10 : 14) * dt));
    if (p.homeT > 0.6 && p.pos.distanceTo(leader.pos) < 1.6 || p.homeT > 1.6) {
      p.dead = true; this.blueActive = false; Audio_.siren(0);
      FX.explosion(_iv2.copy(leader.pos).addScaledVector(leader.up, 0.8), 1.2);
      Audio_.play('explode', { pos: leader.pos, range: 150 });
      if (camera.position.distanceTo(leader.pos) < 40) late.Game.shake(1.0);
      for (const k of karts) if (k.pos.distanceTo(leader.pos) < 7) k.hit('tumble', p.owner === k ? null : p.owner);
    }
  },
};
const _im = new THREE.Matrix4(), _iv = new THREE.Vector3(), _iv2 = new THREE.Vector3(), _iq = new THREE.Quaternion(), _is = new THREE.Vector3();


