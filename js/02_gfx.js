// 02_gfx.js (Kart Party Deluxe)
import * as THREE from 'three';
import { COL, MAX_ANISO, R, TAU, V3, canvasTex, clamp, hash2, makeCanvas, mulberry32, rand, randi, rng, setRng, tfbm } from './01_core.js';

// ============================================================================
// GFX — geometry builder, material patches, procedural textures, sky & clouds
// ============================================================================
export const TIME_U = { value: 0 };          // global shader time
export const SUN_DIR = new THREE.Vector3(0.45, 0.75, 0.35).normalize();

// ---------- geometry builder: merges primitives with baked vertex colors ----------
const _gm = new THREE.Matrix4(), _gq = new THREE.Quaternion(), _ge = new THREE.Euler(), _gs = new THREE.Vector3(), _gp = new THREE.Vector3();
export function M4(px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _ge.set(rx, ry, rz); _gq.setFromEuler(_ge); _gp.set(px, py, pz); _gs.set(sx, sy, sz);
  return new THREE.Matrix4().compose(_gp, _gq, _gs);
}
export function mergeGeos(list) {
  let nv = 0, ni = 0;
  for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = new Float32Array(nv * 2), C = new Float32Array(nv * 3);
  const I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let vo = 0, io = 0;
  for (const g of list) {
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, c = g.attributes.color, cnt = p.count;
    P.set(p.array.subarray ? p.array.subarray(0, cnt * 3) : p.array, vo * 3);
    if (n) N.set(n.array.subarray(0, cnt * 3), vo * 3);
    if (uv) U.set(uv.array.subarray(0, cnt * 2), vo * 2);
    if (c) C.set(c.array.subarray(0, cnt * 3), vo * 3); else C.fill(1, vo * 3, (vo + cnt) * 3);
    if (g.index) { const ia = g.index.array; for (let i = 0; i < ia.length; i++) I[io++] = ia[i] + vo; }
    else for (let i = 0; i < cnt; i++) I[io++] = i + vo;
    vo += cnt;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(U, 2)); out.setAttribute('color', new THREE.BufferAttribute(C, 3));
  out.setIndex(new THREE.BufferAttribute(I, 1)); out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
}
// average normals on coincident vertices (removes UV seams on deformed spheres)
function fixSeams(g) {
  const p = g.attributes.position, n = g.attributes.normal, map = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = Math.round(p.getX(i) * 1e4) + ',' + Math.round(p.getY(i) * 1e4) + ',' + Math.round(p.getZ(i) * 1e4);
    let e = map.get(k); if (!e) { e = [0, 0, 0, []]; map.set(k, e); }
    e[0] += n.getX(i); e[1] += n.getY(i); e[2] += n.getZ(i); e[3].push(i);
  }
  for (const e of map.values()) { const l = Math.hypot(e[0], e[1], e[2]) || 1; for (const i of e[3]) n.setXYZ(i, e[0] / l, e[1] / l, e[2] / l); }
  n.needsUpdate = true; return g;
}
// superellipsoid: rounded-box / pill shapes with smooth normals
export function superEllipsoid(sx, sy, sz, e = 0.35, ws = 24, hs = 16) {
  const g = new THREE.SphereGeometry(1, ws, hs); const p = g.attributes.position;
  const f = (v) => Math.sign(v) * Math.pow(Math.abs(v), e);
  for (let i = 0; i < p.count; i++) p.setXYZ(i, f(p.getX(i)) * sx, f(p.getY(i)) * sy, f(p.getZ(i)) * sz);
  g.computeVertexNormals(); fixSeams(g); return g;
}
export class GB {
  constructor() { this.parts = []; }
  add(geo, color, m, uvFix) {
    const g = geo.index ? geo.clone() : geo.clone();
    if (m) g.applyMatrix4(m);
    const cnt = g.attributes.position.count, c = new THREE.Color(color), arr = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(cnt * 2), 2));
    if (uvFix) { const uv = g.attributes.uv; for (let i = 0; i < cnt; i++) uv.setXY(i, uvFix[0], uvFix[1]); }
    this.parts.push(g); return this;
  }
  sphere(r, color, px, py, pz, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0, seg = 20) { return this.add(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.7 | 0)), color, M4(px, py, pz, rx, ry, rz, sx, sy, sz)); }
  capsule(r, len, color, px, py, pz, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) { return this.add(new THREE.CapsuleGeometry(r, len, 6, 14), color, M4(px, py, pz, rx, ry, rz, sx, sy, sz)); }
  cyl(rt, rb, h, color, px, py, pz, rx = 0, ry = 0, rz = 0, seg = 20, sx = 1, sy = 1, sz = 1) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), color, M4(px, py, pz, rx, ry, rz, sx, sy, sz)); }
  cone(r, h, color, px, py, pz, rx = 0, ry = 0, rz = 0, seg = 16) { return this.add(new THREE.ConeGeometry(r, h, seg), color, M4(px, py, pz, rx, ry, rz)); }
  torus(r, t, color, px, py, pz, rx = 0, ry = 0, rz = 0, arc = TAU, sx = 1, sy = 1, sz = 1) { return this.add(new THREE.TorusGeometry(r, t, 12, 28, arc), color, M4(px, py, pz, rx, ry, rz, sx, sy, sz)); }
  sup(sx, sy, sz, e, color, px, py, pz, rx = 0, ry = 0, rz = 0) { return this.add(superEllipsoid(sx, sy, sz, e), color, M4(px, py, pz, rx, ry, rz)); }
  lathe(pts, color, px, py, pz, rx = 0, ry = 0, rz = 0, seg = 24, sx = 1, sy = 1, sz = 1) { return this.add(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg), color, M4(px, py, pz, rx, ry, rz, sx, sy, sz)); }
  build() { const g = mergeGeos(this.parts); for (const p of this.parts) p.dispose(); this.parts = []; return g; }
}

// ---------- material patch: rim light, star shimmer, hit flash ----------
export const HSV_GLSL = `vec3 kpHsv(vec3 c){ vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0); vec3 p = abs(fract(c.xxx + K.xyz)*6.0 - K.www); return c.z*mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y); }`;
function patchMat(mat, { rim = 0.45, rimColor = 0xffffff, rimPow = 2.6 } = {}) {
  const u = { uRim: { value: rim }, uRimCol: { value: new THREE.Color(rimColor) }, uRimPow: { value: rimPow }, uStar: { value: 0 }, uFlash: { value: 0 }, uTime: TIME_U };
  mat.userData.u = u;
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vKW;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        #ifdef USE_INSTANCING
          vKW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vKW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        uniform float uRim, uRimPow, uStar, uFlash, uTime; uniform vec3 uRimCol; varying vec3 vKW; ${HSV_GLSL}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { vec3 vdir = normalize(vViewPosition); float fr = 1.0 - clamp(dot(normal, vdir), 0.0, 1.0);
          totalEmissiveRadiance += uRimCol * pow(fr, uRimPow) * uRim;
          if (uStar > 0.0) { vec3 rb = kpHsv(vec3(fract(uTime*1.9 + vKW.y*0.7 + vKW.x*0.13 + vKW.z*0.11), 0.8, 1.0)); totalEmissiveRadiance += rb * uStar * (0.45 + 1.4*pow(fr, 1.4)); }
          totalEmissiveRadiance += vec3(uFlash); }`);
  };
  mat.customProgramCacheKey = () => 'kprim';
  return mat;
}
export function stdMat(opts, rim) { return patchMat(new THREE.MeshStandardMaterial(opts), rim); }
export function physMat(opts, rim) { return patchMat(new THREE.MeshPhysicalMaterial(opts), rim); }

// ---------- procedural canvas textures ----------
export const TEX = {};
export function buildTextures() {
  // tire tread (hub area top-right stays white for vertex-colored hubs)
  {
    const cv = makeCanvas(256, 128), g = cv.getContext('2d');
    g.fillStyle = '#26262c'; g.fillRect(0, 0, 256, 128);
    g.strokeStyle = '#131317'; g.lineWidth = 7; g.lineCap = 'round';
    for (let i = -1; i < 9; i++) { const x = i * 32; g.beginPath(); g.moveTo(x, 28); g.lineTo(x + 16, 64); g.lineTo(x, 100); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, 22, 256, 3); g.fillRect(0, 103, 256, 3);
    g.fillStyle = '#fff'; g.fillRect(236, 0, 20, 20);
    TEX.tread = canvasTex(cv, { repeat: false });
  }
  // asphalt (warm, speckled)
  {
    const S = 512, cv = makeCanvas(S, S), g = cv.getContext('2d'), img = g.createImageData(S, S), d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const n = tfbm(x / 64, y / 64, 8, 4), s = hash2(x, y), i = (y * S + x) * 4;
      let v = 0.78 + (n - 0.5) * 0.22 + (s > 0.985 ? 0.18 : s < 0.02 ? -0.12 : (s - 0.5) * 0.06);
      d[i] = 126 * v + 8; d[i + 1] = 121 * v + 6; d[i + 2] = 121 * v + 6; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    TEX.asphalt = canvasTex(cv, { repeat: true, aniso: MAX_ANISO });
  }
  // curb stripes (red / white)
  {
    const cv = makeCanvas(32, 128), g = cv.getContext('2d');
    g.fillStyle = '#f7f7f7'; g.fillRect(0, 0, 32, 128); g.fillStyle = '#e8202a'; g.fillRect(0, 0, 32, 64);
    g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, 62, 32, 4); g.fillRect(0, 126, 32, 2);
    TEX.curb = canvasTex(cv, { repeat: true, aniso: MAX_ANISO });
  }
  // grass / sand detail (grayscale-ish multiplier)
  {
    const S = 512, cv = makeCanvas(S, S), g = cv.getContext('2d'), img = g.createImageData(S, S), d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const n = tfbm(x / 32, y / 32, 16, 4), s = hash2(x * 3, y * 7), i = (y * S + x) * 4;
      const blade = s > 0.9 ? 0.1 : 0;
      const v = 0.86 + (n - 0.5) * 0.25 + blade - (s < 0.05 ? 0.08 : 0);
      d[i] = 255 * clamp(v, 0, 1); d[i + 1] = 255 * clamp(v + 0.03, 0, 1); d[i + 2] = 255 * clamp(v - 0.02, 0, 1); d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    TEX.detail = canvasTex(cv, { repeat: true, aniso: MAX_ANISO });
  }
  // checker
  {
    const cv = makeCanvas(128, 32), g = cv.getContext('2d');
    for (let y = 0; y < 2; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 16, y * 16, 16, 16); }
    TEX.checker = canvasTex(cv, { repeat: true }); TEX.checker.magFilter = THREE.NearestFilter;
  }
  // particle atlas 4x2 of 128px cells
  {
    const C = 128, cv = makeCanvas(C * 4, C * 2), g = cv.getContext('2d');
    const cell = (i, fn) => { g.save(); g.translate((i % 4) * C, Math.floor(i / 4) * C); fn(g); g.restore(); };
    cell(0, g => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 62); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.7)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, C, C); });
    cell(1, g => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 62); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.12, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, C, C); });
    cell(2, g => { g.translate(64, 64); g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 22 : 56; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.shadowColor = '#fff'; g.shadowBlur = 10; g.fill(); });
    cell(3, g => { for (let i = 0; i < 14; i++) { const a = rand(0, TAU), d = rand(0, 26), x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d, r = rand(16, 30); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, C, C); } });
    cell(4, g => { g.fillStyle = '#fff'; g.fillRect(40, 30, 48, 68); });
    cell(5, g => { g.strokeStyle = '#fff'; g.lineWidth = 10; g.shadowColor = '#fff'; g.shadowBlur = 12; g.beginPath(); g.arc(64, 64, 46, 0, TAU); g.stroke(); });
    cell(6, g => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(64, 14); g.lineTo(112, 108); g.lineTo(18, 96); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.moveTo(64, 14); g.lineTo(64, 60); g.lineTo(18, 96); g.fill(); });
    cell(7, g => { const r = g.createRadialGradient(64, 76, 0, 64, 64, 60); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.5, 'rgba(255,255,255,0.6)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.beginPath(); g.ellipse(64, 64, 40, 60, 0, 0, TAU); g.fill(); });
    TEX.atlas = canvasTex(cv, { srgb: false });
  }
  // item "?" glyph
  {
    const cv = makeCanvas(128, 128), g = cv.getContext('2d');
    g.font = '900 108px Arial Black, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 14; g.strokeStyle = '#3b2a8a'; g.strokeText('?', 64, 70); g.fillStyle = '#fff'; g.fillText('?', 64, 70);
    TEX.qmark = canvasTex(cv);
  }
  // coin face
  {
    const cv = makeCanvas(128, 128), g = cv.getContext('2d');
    const r = g.createRadialGradient(50, 44, 4, 64, 64, 64); r.addColorStop(0, '#fff6b0'); r.addColorStop(0.5, '#ffcc22'); r.addColorStop(1, '#d88a00');
    g.fillStyle = r; g.beginPath(); g.arc(64, 64, 63, 0, TAU); g.fill();
    g.strokeStyle = '#b86e00'; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 50, 0, TAU); g.stroke();
    g.fillStyle = '#e39600'; g.beginPath(); g.roundRect ? g.roundRect(54, 30, 20, 68, 10) : g.rect(54, 30, 20, 68); g.fill();
    g.fillStyle = '#fff3a0'; g.beginPath(); g.roundRect ? g.roundRect(55, 31, 9, 64, 6) : g.rect(55, 31, 9, 64); g.fill();
    TEX.coin = canvasTex(cv);
  }
}

// ---------- sky dome (beach) ----------
export function makeSkyDome(o) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sunDir: { value: SUN_DIR.clone() }, top: { value: COL(o.top) }, mid: { value: COL(o.mid) }, hor: { value: COL(o.hor) }, low: { value: COL(o.low) }, sunCol: { value: COL(o.sun) }, uTime: TIME_U },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position = vec4(p.xy, p.w*0.99999, p.w); }`,
    fragmentShader: `uniform vec3 sunDir, top, mid, hor, low, sunCol; uniform float uTime; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float y = d.y;
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.22, y)); c = mix(c, top, smoothstep(0.18, 0.85, y));
        c = mix(c, low, smoothstep(0.0, -0.25, y));
        float s = max(dot(d, sunDir), 0.0);
        c += sunCol*(pow(s, 1400.0)*60.0 + pow(s, 60.0)*0.9 + pow(s, 8.0)*0.22);
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(2400, 48, 24), mat);
  m.frustumCulled = false; m.renderOrder = -10; m.userData.follow = true;
  return m;
}
// ---------- puffy clouds (instanced spheres, stylised lighting) ----------
export function makeClouds(n, { rMin = 500, rMax = 1500, yMin = 140, yMax = 320, seed = 7, lit = 0xffffff, shade = 0x9fb3e6, center = V3(), scale = 1 } = {}) {
  const r0 = rng; setRng(mulberry32(seed));
  const mats = [];
  for (let c = 0; c < n; c++) {
    const a = rand(0, TAU), d = rand(rMin, rMax), cx = center.x + Math.cos(a) * d, cz = center.z + Math.sin(a) * d, cy = rand(yMin, yMax);
    const S = rand(14, 34) * scale, puffs = randi(6, 11), rot = rand(0, TAU);
    for (let i = 0; i < puffs; i++) {
      const t = (i / (puffs - 1)) * 2 - 1; const lx = t * S * 1.6 + rand(-3, 3), lz = rand(-S * 0.4, S * 0.4);
      const rr = S * (0.55 + 0.45 * (1 - Math.abs(t))) * rand(0.75, 1.05);
      const ly = Math.max(0, rr * 0.35 - S * 0.1) + rand(0, S * 0.25);
      const x = cx + lx * Math.cos(rot) - lz * Math.sin(rot), z = cz + lx * Math.sin(rot) + lz * Math.cos(rot);
      mats.push(M4(x, cy + ly, z, 0, rand(0, 3), 0, rr, rr * 0.82, rr));
    }
  }
  setRng(r0);
  const geo = new THREE.IcosahedronGeometry(1, 3);
  const mat = new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: SUN_DIR.clone() }, lit: { value: COL(lit) }, shade: { value: COL(shade) }, fogCol: { value: COL(0xcfeaff) } },
    vertexShader: `varying vec3 vN; varying vec3 vW; varying float vBase;
      void main(){ vec4 w = modelMatrix * instanceMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix*instanceMatrix)*normal);
        vBase = (modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).y; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 sunDir, lit, shade, fogCol; varying vec3 vN; varying vec3 vW; varying float vBase;
      void main(){ vec3 n = normalize(vN); float l = dot(n, sunDir)*0.5+0.5;
        vec3 c = mix(shade, lit, smoothstep(0.25, 0.75, l));
        c *= mix(0.86, 1.0, smoothstep(-0.6, 0.4, n.y));
        vec3 v = normalize(cameraPosition - vW); float fr = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 3.0);
        c += lit*fr*0.25;
        c *= 0.97;
        float fd = smoothstep(900.0, 2300.0, length(vW - cameraPosition));
        c = mix(c, fogCol, fd*0.55);
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const im = new THREE.InstancedMesh(geo, mat, mats.length);
  mats.forEach((m, i) => im.setMatrixAt(i, m));
  im.frustumCulled = false;
  return im;
}

// ---------- environment capture (reflections for glossy karts & water) ----------
export function captureEnv(scene, pos, hide = [], size = 256) {
  const cubeRT = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const cc = new THREE.CubeCamera(1, 3000, cubeRT); cc.position.copy(pos); scene.add(cc);
  const vis = hide.map(o => o.visible); hide.forEach(o => o.visible = false);
  const followers = []; scene.traverse(o => { if (o.userData.follow) { followers.push([o, o.position.clone()]); o.position.copy(pos); } });
  cc.update(R, scene);
  followers.forEach(([o, p]) => o.position.copy(p));
  hide.forEach((o, i) => o.visible = vis[i]); scene.remove(cc);
  const pm = new THREE.PMREMGenerator(R); const env = pm.fromCubemap(cubeRT.texture).texture; pm.dispose();
  return { cube: cubeRT, env };
}


