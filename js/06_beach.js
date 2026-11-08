// 06_beach.js (Kart Party Deluxe)
import * as THREE from 'three';
import { COL, NOISE_TEX, TAU, UP, V3, canvasTex, clamp, fbm, hash2, lerp, makeCanvas, mulberry32, pick, rand, randi, rng, setRng, smooth, vnoise } from './01_core.js';
import { GB, HSV_GLSL, M4, SUN_DIR, TEX, TIME_U, captureEnv, makeClouds, makeSkyDome, mergeGeos, stdMat, superEllipsoid } from './02_gfx.js';
import { F_GAP, F_SKIRT, F_TFOLLOW, F_TUNNEL, SURF, Track, _tv } from './04_track.js';
import { FX, TILE } from './05_fx.js';

// ============================================================================
// WORLD 1 — SUNSHINE SHORES (beach / mushroom kingdom circuit)
// ============================================================================
export const BEACH_DEF = {
  id: 'beach', name: 'SUNSHINE SHORES', ds: 1.0, width: 18, bankFactor: 5.5, maxBank: 13,
  pts: [
    [60, 3, 0, 20], [125, 3, 2, 19], [180, 3.2, 20, 18], [212, 3.0, 58, 18], [222, 2.6, 105, 18], [214, 2.2, 150, 18], [184, 1.7, 182, 19],
    [135, 1.4, 199, 20], [75, 1.4, 206, 20], [18, 1.6, 208, 19],
    [-16, 2.0, 208, 16], [-34, 3.6, 208, 16], [-46, 5.8, 208, 16], [-56, 8.2, 208, 16], [-67, 4.4, 208, 17], [-86, 2.8, 207, 18],
    [-112, 2.3, 203, 18], [-150, 2.6, 188, 18], [-172, 3.6, 155, 18], [-176, 6.0, 112, 17], [-168, 9.5, 70, 16],
    [-152, 12.2, 32, 15], [-136, 13.2, -8, 15], [-120, 13.0, -45, 15], [-98, 12.5, -68, 16], [-62, 11, -80, 17],
    [-34, 9, -70, 17], [-24, 7, -45, 17], [-20, 5.2, -21, 18], [-6, 3.8, -4, 19], [20, 3, 0, 20],
  ],
  defaults: { shL: 6, shR: 6, wallL: true, wallR: true, surfL: 'grass', surfR: 'grass', curb: true, tfollow: true },
  secs: [
    { a: 29.3, b: 1.6, barL: 'bumperB', barR: 'bumperB', shL: 4, shR: 4 },
    { a: 1.6, b: 4.6, barL: 'bumperR', shL: 5 },
    { a: 4.6, b: 6.3, barL: 'bumperR', shL: 5 },
    { a: 6.3, b: 9.85, surfL: 'sand', surfR: 'sand', shL: 14, wallL: false, shR: 6, barR: 'fence' },
    { a: 9.85, b: 12.0, shL: 0.6, shR: 0.6, tfollow: false, skirt: true, barL: 'rail', barR: 'rail', curb: false, barH: 1.0, nosafe: true },
    { a: 11.75, b: 12.0, launch: true, trick: true, nosafe: true, shL: 0.6, shR: 0.6, tfollow: false, skirt: true, barL: 'rail', barR: 'rail', curb: false },
    { a: 12.0, b: 13.9, gap: true, tfollow: false, curb: false, nosafe: true, shL: 0.6, shR: 0.6 },
    { a: 13.9, b: 15.0, tfollow: false, skirt: true, shL: 0.6, shR: 0.6, barL: 'rail', barR: 'rail', curb: false },
    { a: 13.9, b: 14.3, nosafe: true, tfollow: false, skirt: true, shL: 0.6, shR: 0.6, barL: 'rail', barR: 'rail', curb: false },
    { a: 15.0, b: 16.4, surfL: 'sand', surfR: 'sand', shL: 7, shR: 6 },
    { a: 16.4, b: 20.7, barL: 'bumperR', shL: 5 },
    { a: 21.0, b: 23.0, shL: 1.5, shR: 1.5, curb: false, tunnel: true },
    { a: 23.0, b: 23.15, shL: 1.5, shR: 1.5, curb: false },
    { a: 23.15, b: 25.5, barL: 'bumperR', shL: 4 },
    { a: 25.5, b: 27.5, barL: 'bumperB', shL: 4 },
    { a: 27.5, b: 29.3, barR: 'bumperR', shR: 4 },
  ],
  boosts: [{ c: 9.05 }, { c: 9.25 }, { c: 9.45 }, { c: 9.65 }, { c: 23.4, d: -3 }, { c: 23.55, d: -3 }],
  items: [2.7, 7.3, 16.1, 23.9, 27.8],
  coins: [[0.25, 0.8, -4], [4.1, 4.6, 3], [7.8, 8.3, 5], [17.1, 17.6, 0], [19.2, 19.8, 3], [24.4, 25.0, -3], [28.4, 29.0, 3]],
  music: 'beach', start: 0,
};

function beachBase(x, z) {
  let h = 3.2 + (fbm(x * 0.011 + 3.1, z * 0.011 - 1.7, 3) - 0.5) * 4.0;
  { // mesa with the waterfall cliff
    const qx = Math.abs(x + 67) - 45 + 12, qz = Math.abs(z - 121) - 29 + 12;
    const sd = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - 12;
    const m = smooth(5, -3, sd); h = lerp(h, 21 + (fbm(x * 0.05, z * 0.05, 2) - 0.5) * 3, m);
    const rx = -58 + Math.sin(z * 0.08) * 2; if (z > 92 && z < 150) h -= 1.1 * smooth(6, 2.5, Math.abs(x - rx)) * m;
  }
  { // north-west mountain (tunnel)
    const dx = x + 178, dz = z + 2, r = Math.hypot(dx, dz * 0.85), ridge = fbm(x * 0.02 + 11, z * 0.02 - 4, 4);
    h = Math.max(h, 3 + Math.exp(-((r / 62) ** 2)) * (48 + (ridge - 0.5) * 30));
  }
  { const r = Math.hypot(x - 60, z + 262), m = smooth(95, 45, r); h = Math.max(h, 3 + m * (25 + (fbm(x * 0.03, z * 0.03, 2) - 0.5) * 2)); }
  const land = smooth(-300, -245, x) * (1 - smooth(275, 318, x)) * smooth(-338, -300, z);
  h = lerp(-7, h, land);
  const cz = 224 + (fbm(x * 0.008 + 5, 1.3, 2) - 0.5) * 16;
  h = lerp(h, 1.1, smooth(cz - 28, cz - 4, z));
  h = lerp(h, -6.5, smooth(cz - 6, cz + 45, z));
  { const cx = -58 + Math.sin(z * 0.045) * 2.5, d = Math.abs(x - cx), m = smooth(17, 7, d) * smooth(144, 152, z); h = lerp(h, -3.4, m); }
  return h;
}

// ------------------------------------------------------------------ terrain
function buildBeachTerrain(track) {
  const X0 = -300, Z0 = -340, S = 2.5, NX = 249, NZ = 257;
  const H = new Float32Array(NX * NZ), near = new Int32Array(NX * NZ).fill(-1), nd = new Float32Array(NX * NZ).fill(1e9);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) H[j * NX + i] = beachBase(X0 + i * S, Z0 + j * S);
  // nearest track sample per vertex (rasterized)
  const R = 48, rc = Math.ceil(R / S);
  for (let k = 0; k < track.n; k++) {
    const ci = Math.round((track.px[k] - X0) / S), cj = Math.round((track.pz[k] - Z0) / S);
    for (let j = Math.max(0, cj - rc); j <= Math.min(NZ - 1, cj + rc); j++) for (let i = Math.max(0, ci - rc); i <= Math.min(NX - 1, ci + rc); i++) {
      const dx = X0 + i * S - track.px[k], dz = Z0 + j * S - track.pz[k], d2 = dx * dx + dz * dz, id = j * NX + i;
      if (d2 < nd[id]) { nd[id] = d2; near[id] = k; }
    }
  }
  const surfCol = new Float32Array(NX * NZ);  // 1 = sand hint near track shoulders
  for (let id = 0; id < NX * NZ; id++) {
    const k = near[id]; if (k < 0) continue;
    const x = X0 + (id % NX) * S, z = Z0 + Math.floor(id / NX) * S;
    const bl = Math.hypot(track.bx[k], track.bz[k]) || 1;
    const d = ((x - track.px[k]) * track.bx[k] + (z - track.pz[k]) * track.bz[k]) / bl;
    const along = (x - track.px[k]) * track.tx[k] + (z - track.pz[k]) * track.tz[k];
    const fl = track.flags[k], eL = track.edgeL(k), eR = track.edgeR(k), hw = track.hw[k];
    const out = d < eL ? eL - d : d > eR ? d - eR : 0;
    if (fl & F_TUNNEL) {
      const carved = track.surfY(k, clamp(d, eL, eR)) - (Math.abs(d) < hw - 0.8 ? 0.35 : 0.04);
      H[id] = lerp(carved, Math.max(H[id], track.py[k] + 24), smooth(1.8, 7.5, out));
      continue;
    }
    if (!(fl & F_TFOLLOW)) continue;
    const dd = clamp(d, eL, eR);
    let target = track.surfY(k, dd) - (Math.abs(d) < hw - 0.8 ? 0.35 : 0.04);
    const w = out <= 0.5 ? 1 : smooth(26, 0.5, out) * smooth(8, 3, Math.abs(along));
    H[id] = lerp(H[id], target, w);
    if (out < 3 && ((d < 0 ? track.surfL[k] : track.surfR[k]) === SURF.sand)) surfCol[id] = 1;
  }
  // geometry
  const pos = new Float32Array(NX * NZ * 3), col = new Float32Array(NX * NZ * 3), uv = new Float32Array(NX * NZ * 2);
  const c = new THREE.Color(), grassA = COL(0x52c43c), grassB = COL(0x86dc4a), sand = COL(0xf4d99a), wet = COL(0xd9b877), rock = COL(0xa8927a), rockD = COL(0x8a7563), cliff = COL(0xc7ae8e);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const id = j * NX + i, x = X0 + i * S, z = Z0 + j * S, h = H[id];
    pos.set([x, h, z], id * 3); uv.set([x / 9, z / 9], id * 2);
    const hx = H[j * NX + Math.min(NX - 1, i + 1)] - H[j * NX + Math.max(0, i - 1)], hz = H[Math.min(NZ - 1, j + 1) * NX + i] - H[Math.max(0, j - 1) * NX + i];
    const slope = Math.hypot(hx, hz) / (2 * S);
    const n = fbm(x * 0.03, z * 0.03, 3);
    c.copy(grassA).lerp(grassB, clamp(n * 1.4 - 0.2, 0, 1));
    const stripe = (Math.floor((x + z * 0.3) / 7) & 1) ? 1.0 : 0.93; c.multiplyScalar(stripe);
    const cz = 224 + (fbm(x * 0.008 + 5, 1.3, 2) - 0.5) * 16;
    const sandAmt = Math.max(smooth(cz - 34, cz - 22, z), smooth(2.2, 1.2, h), surfCol[id]);
    c.lerp(h < 0.6 ? wet : sand, clamp(sandAmt, 0, 1));
    if (h < -0.2) c.copy(sand).lerp(wet, 0.5);
    const rk = smooth(0.55, 0.9, slope) + smooth(24, 34, h) * 0.6;
    if (rk > 0) { c.lerp(slope > 1.4 ? cliff : (n > 0.5 ? rock : rockD), clamp(rk, 0, 1)); }
    col.set([c.r, c.g, c.b], id * 3);
  }
  const idx = new Uint32Array((NX - 1) * (NZ - 1) * 6); let o = 0;
  for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) { const a = j * NX + i, b = a + 1, d = a + NX, e = d + 1; idx[o++] = a; idx[o++] = d; idx[o++] = b; idx[o++] = b; idx[o++] = d; idx[o++] = e; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: TEX.detail, roughness: 0.92, metalness: 0 });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = TIME_U; sh.uniforms.nTex = { value: NOISE_TEX };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTW;').replace('#include <project_vertex>', '#include <project_vertex>\nvTW = (modelMatrix*vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vTW; uniform float uTime; uniform sampler2D nTex;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (vTW.y < 0.15) { float dep = clamp(-vTW.y, 0.0, 4.0);
          float a = texture2D(nTex, vTW.xz*0.07 + vec2(uTime*0.03, uTime*0.02)).r, b = texture2D(nTex, vTW.xz*0.09 - vec2(uTime*0.025, -uTime*0.018)).g;
          float cs = pow(1.0 - abs(a + b - 1.0), 7.0);
          totalEmissiveRadiance += vec3(0.7, 0.95, 1.0) * cs * 0.9 * smoothstep(0.0, 0.4, dep) * (1.0 - dep/5.0);
          diffuseColor.rgb *= mix(vec3(1.0), vec3(0.55, 0.85, 0.9), smoothstep(0.0, 3.0, dep)); }`);
  };
  mat.customProgramCacheKey = () => 'terrain';
  const mesh = new THREE.Mesh(g, mat); mesh.receiveShadow = true;
  const T = { X0, Z0, S, NX, NZ, H, mesh };
  T.height = (x, z) => {
    const fx = (x - X0) / S, fz = (z - Z0) / S;
    if (fx < 0 || fz < 0 || fx >= NX - 1 || fz >= NZ - 1) return -7;
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, a = H[j * NX + i], b = H[j * NX + i + 1], cc = H[(j + 1) * NX + i], d = H[(j + 1) * NX + i + 1];
    return u + v <= 1 ? a + (b - a) * u + (cc - a) * v : d + (cc - d) * (1 - u) + (b - d) * (1 - v);
  };
  T.normal = (x, z, out) => { const e = 1.2; return out.set(T.height(x - e, z) - T.height(x + e, z), 2 * e, T.height(x, z - e) - T.height(x, z + e)).normalize(); };
  return T;
}

// ------------------------------------------------------------------ ocean
function buildOcean(terrain, cube) {
  const lines = []; for (let v = -300; v <= 320; v += 2.5) lines.push(v);
  const xs = [...lines], zs = []; for (let v = -340; v <= 300; v += 2.5) zs.push(v);
  let e = 2.5; for (let k = 0; k < 26; k++) { e *= 1.25; xs.unshift(xs[0] - e); xs.push(xs[xs.length - 1] + e); }
  e = 2.5; for (let k = 0; k < 26; k++) { e *= 1.25; zs.unshift(zs[0] - e); zs.push(zs[zs.length - 1] + e); }
  const nx = xs.length, nz = zs.length, P = new Float32Array(nx * nz * 3), D = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const id = j * nx + i; P.set([xs[i], 0, zs[j]], id * 3); D[id] = Math.max(0, -terrain.height(xs[i], zs[j])); }
  const idx = []; for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, d = a + nx, f = d + 1;
    if (D[a] + D[b] + D[d] + D[f] <= 0) continue;
    idx.push(a, d, b, b, d, f);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aDepth', new THREE.BufferAttribute(D, 1)); g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: TIME_U, sunDir: { value: SUN_DIR }, shallow: { value: COL(0x3fe8e0) }, deep: { value: COL(0x0a5fc8) }, foamCol: { value: COL(0xffffff) }, fogCol: { value: COL(0xbfe6ff) }, sunCol: { value: COL(0xfff1d0) }, envMap: { value: cube }, noiseTex: { value: NOISE_TEX } },
    vertexShader: `uniform float uTime; attribute float aDepth; varying vec3 vW; varying float vDepth; varying float vWave;
      float waveH(vec2 p, float t){ return sin(dot(p, vec2(0.08,0.05)) + t*1.1)*0.22 + sin(dot(p, vec2(-0.05,0.11)) + t*1.4)*0.15 + sin(dot(p, vec2(0.17,-0.09)) + t*2.1)*0.07 + sin(dot(p, vec2(-0.21,-0.19)) + t*2.7)*0.04; }
      void main(){ vec3 p = (modelMatrix*vec4(position,1.0)).xyz; float h = waveH(p.xz, uTime)*mix(0.2, 1.0, smoothstep(0.0, 3.0, aDepth));
        p.y += h; vW = p; vDepth = aDepth; vWave = h; gl_Position = projectionMatrix*viewMatrix*vec4(p,1.0); }`,
    fragmentShader: `uniform float uTime; uniform vec3 sunDir, shallow, deep, foamCol, fogCol, sunCol; uniform samplerCube envMap; uniform sampler2D noiseTex;
      varying vec3 vW; varying float vDepth; varying float vWave;
      vec2 wg(vec2 p, float t){ vec2 g = vec2(0.);
        g += cos(dot(p, vec2(0.08,0.05)) + t*1.1)*0.22*vec2(0.08,0.05); g += cos(dot(p, vec2(-0.05,0.11)) + t*1.4)*0.15*vec2(-0.05,0.11);
        g += cos(dot(p, vec2(0.17,-0.09)) + t*2.1)*0.07*vec2(0.17,-0.09); g += cos(dot(p, vec2(-0.21,-0.19)) + t*2.7)*0.04*vec2(-0.21,-0.19); return g; }
      void main(){
        float dmp = mix(0.2, 1.0, smoothstep(0.0, 3.0, vDepth));
        vec2 g = wg(vW.xz, uTime)*dmp*3.0;
        vec2 r = (texture2D(noiseTex, vW.xz*0.035 + vec2(uTime*0.02, uTime*0.013)).rg - 0.5) + (texture2D(noiseTex, vW.xz*0.061 - vec2(uTime*0.017, -uTime*0.021)).gb - 0.5)*0.7;
        vec3 n = normalize(vec3(-g.x - r.x*0.5, 1.0, -g.y - r.y*0.5));
        vec3 v = normalize(cameraPosition - vW); float dist = length(cameraPosition - vW);
        float fres = 0.02 + 0.98*pow(1.0 - max(dot(n, v), 0.0), 5.0);
        vec3 R = reflect(-v, n); R.y = abs(R.y);
        vec3 refl = textureCube(envMap, R).rgb;
        float dep = max(vDepth + vWave, 0.0);
        vec3 body = mix(shallow, deep, smoothstep(0.4, 8.0, dep));
        body += vec3(0.0, 0.18, 0.14)*smoothstep(0.08, 0.3, vWave)*smoothstep(1.0, 4.0, dep);
        vec3 col = mix(body, refl, clamp(fres*1.15, 0.0, 1.0));
        float sp = max(dot(reflect(-sunDir, n), v), 0.0);
        col += sunCol*(pow(sp, 700.0)*30.0 + pow(sp, 70.0)*0.4);
        float gl = texture2D(noiseTex, vW.xz*0.8 + uTime*0.06).a*texture2D(noiseTex, vW.xz*0.63 - uTime*0.05).a;
        col += sunCol*smoothstep(0.5, 0.72, gl)*pow(sp, 4.0)*9.0*smoothstep(300.0, 15.0, dist);
        float fn = texture2D(noiseTex, vW.xz*0.12 + vec2(uTime*0.03, 0.0)).r;
        float shore = smoothstep(1.3, 0.0, dep);
        float bands = 0.5 + 0.5*sin(dep*8.0 - uTime*2.4 + fn*6.0);
        float foam = shore*(0.5 + 0.5*bands)*smoothstep(0.2, 0.5, fn + shore*0.45);
        foam += smoothstep(0.24, 0.34, vWave)*smoothstep(0.45, 0.65, fn)*0.8*smoothstep(1.0, 4.0, dep);
        foam = clamp(foam, 0.0, 1.0);
        col = mix(col, foamCol*1.15, foam);
        float alpha = mix(0.42, 0.95, smoothstep(0.0, 2.4, dep)); alpha = max(max(alpha, foam), fres);
        float fg = smoothstep(380.0, 2300.0, dist); col = mix(col, fogCol, fg); alpha = mix(alpha, 1.0, fg);
        gl_FragColor = vec4(col, alpha);
      }`,
  });
  const m = new THREE.Mesh(g, mat); m.renderOrder = 5; m.frustumCulled = false;
  return m;
}

// ------------------------------------------------------------------ flowing water (waterfall / river)
function flowMat(speed = 1.4, stretch = 1.2) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: TIME_U, nTex: { value: NOISE_TEX } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime; uniform sampler2D nTex; varying vec2 vUv;
      void main(){
        float a = texture2D(nTex, vec2(vUv.x*2.3, vUv.y*${stretch.toFixed(2)} - uTime*${speed.toFixed(2)})).r;
        float b = texture2D(nTex, vec2(vUv.x*5.1 + 0.37, vUv.y*${(stretch * 2).toFixed(2)} - uTime*${(speed * 1.6).toFixed(2)})).g;
        float s = smoothstep(0.38, 0.78, a*0.6 + b*0.6);
        vec3 col = mix(vec3(0.35, 0.72, 0.98), vec3(1.25, 1.3, 1.35), s);
        col += smoothstep(0.82, 1.0, vUv.y)*0.5;
        float edge = smoothstep(0.0, 0.14, vUv.x)*smoothstep(1.0, 0.86, vUv.x);
        gl_FragColor = vec4(col, (0.6 + 0.4*s)*edge);
      }`,
  });
}

// ------------------------------------------------------------------ props
function palmGeo() {
  const gb = new GB(); const segs = 9, H = 10;
  let x = 0, y = 0, tilt = 0;
  for (let k = 0; k < segs; k++) {
    const r0 = lerp(0.46, 0.26, k / segs), r1 = lerp(0.46, 0.26, (k + 1) / segs), h = H / segs;
    gb.cyl(r1, r0, h * 1.02, k % 2 ? 0x8f5e2e : 0xa87236, x, y + h / 2, 0, 0, 0, -tilt, 10);
    gb.torus(r0 * 0.98, 0.07, 0x6f4a24, x, y + 0.06, 0, Math.PI / 2, 0, 0);
    x += Math.sin(tilt) * h; y += Math.cos(tilt) * h; tilt += 0.045 + k * 0.012;
  }
  const top = new THREE.Vector3(x, y, 0);
  for (let c = 0; c < 3; c++) gb.sphere(0.32, 0x5a3a1a, top.x + Math.cos(c * 2.1) * 0.35, top.y - 0.35, Math.sin(c * 2.1) * 0.35);
  // fronds
  const leaves = 9;
  for (let l = 0; l < leaves; l++) {
    const ang = l / leaves * TAU + (l % 2) * 0.2, len = rand(4.6, 5.8), droop = rand(0.9, 1.3);
    const P = [], I = [], C = []; const n = 10;
    const c0 = COL(0x1f8a35), c1 = COL(0x8be24c);
    for (let i = 0; i <= n; i++) {
      const t = i / n, dist = t * len, yy = Math.sin(t * Math.PI * 0.9) * 1.1 - t * t * droop * 2.6, w = Math.sin(Math.min(1, t * 1.2) * Math.PI) * 0.75 + 0.05;
      const cx = Math.cos(ang), cz = Math.sin(ang), sx = -cz, sz = cx;
      const bx = top.x + cx * dist, by = top.y + yy, bz = top.z + cz * dist;
      P.push(bx + sx * w, by - w * 0.28, bz + sz * w, bx, by + 0.05, bz, bx - sx * w, by - w * 0.28, bz - sz * w);
      const cc = c0.clone().lerp(c1, t); for (let q = 0; q < 3; q++) C.push(cc.r, cc.g, cc.b);
      if (i < n) { const a = i * 3; I.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeVertexNormals();
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(P.length / 3 * 2), 2));
    gb.parts.push(g);
  }
  return gb.build();
}
function swayPatch(mat, amp = 0.05) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = TIME_U;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', `#include <begin_vertex>
      { float ph = instanceMatrix[3].x*0.13 + instanceMatrix[3].z*0.07; float k = max(0.0, transformed.y - 1.0);
        transformed.x += sin(uTime*1.3 + ph)*k*k*${amp.toFixed(3)}; transformed.z += cos(uTime*1.1 + ph*1.3)*k*k*${(amp * 0.7).toFixed(3)}; }`);
  };
  mat.customProgramCacheKey = () => 'sway' + amp;
  return mat;
}
function mushroomGeos() {
  const stem = new GB(), cap = new GB();
  stem.lathe([[0, 0], [1.05, 0], [0.92, 0.12], [0.72, 0.5], [0.66, 0.9], [0.72, 1.0], [0, 1.0]], 0xfff4dc, 0, 0, 0, 0, 0, 0, 20);
  cap.lathe([[0, 1.62], [0.7, 1.58], [1.35, 1.42], [1.85, 1.18], [2.15, 0.92], [2.18, 0.82], [2.02, 0.78], [1.4, 0.88], [0.6, 0.98], [0, 1.0]], 0xffffff, 0, 0, 0, 0, 0, 0, 28);
  const spots = [[0, 1.6, 0, 0.55]]; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; spots.push([Math.cos(a) * 1.35, 1.36, Math.sin(a) * 1.35, 0.42]); }
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.9; spots.push([Math.cos(a) * 1.95, 1.0, Math.sin(a) * 1.95, 0.3]); }
  for (const [x, y, z, r] of spots) { const n = new THREE.Vector3(x, y - 0.3, z).normalize(); const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, n)); stem.add(new THREE.SphereGeometry(r, 14, 8), 0xffffff, M4(x, y + 0.02, z, e.x, e.y, e.z, 1, 0.22, 1)); }
  // cute eyes on the stem
  for (const s of [-1, 1]) { stem.sphere(0.13, 0x1a1446, s * 0.24, 0.62, 0.66, 0.8, 1.4, 0.5); stem.sphere(0.04, 0xffffff, s * 0.24 + 0.03, 0.69, 0.72); }
  return { stem: stem.build(), cap: cap.build() };
}
function bushGeo() {
  const gb = new GB();
  gb.sphere(1.0, 0x3fb83a, 0, 0.75, 0, 1.2, 0.95, 1.0); gb.sphere(0.8, 0x4cc944, -0.95, 0.6, 0.1); gb.sphere(0.8, 0x4cc944, 0.95, 0.6, 0.1); gb.sphere(0.6, 0x5fd650, 0, 1.45, 0.1);
  for (const s of [-1, 1]) { gb.sphere(0.2, 0xffffff, s * 0.3, 0.95, 0.9, 0.8, 1.3, 0.6); gb.sphere(0.1, 0x14103a, s * 0.3, 0.93, 1.0, 0.8, 1.3, 0.6); gb.sphere(0.035, 0xffffff, s * 0.3 + 0.03, 1.0, 1.05); }
  return gb.build();
}
export function rockGeo(seed) {
  const g = new THREE.IcosahedronGeometry(1, 3); const p = g.attributes.position; const r0 = rng; setRng(mulberry32(seed));
  const o = [rand(0, 50), rand(0, 50)];
  for (let i = 0; i < p.count; i++) { const v = _tv[0].fromBufferAttribute(p, i); const n = fbm(v.x * 1.7 + o[0], v.z * 1.7 + v.y * 1.3 + o[1], 3); v.multiplyScalar(0.75 + n * 0.55); v.y *= 0.75; p.setXYZ(i, v.x, v.y, v.z); }
  setRng(r0); g.computeVertexNormals();
  const c = new Float32Array(p.count * 3), a = COL(0xb2a08a), b = COL(0x8c7a68), m = COL(0x5dbb45);
  const nrm = g.attributes.normal;
  for (let i = 0; i < p.count; i++) { const col = a.clone().lerp(b, hash2(i, seed) * 0.6); if (nrm.getY(i) > 0.75) col.lerp(m, 0.8); c.set([col.r, col.g, col.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}
function flowerGeo() {
  const gb = new GB();
  gb.cyl(0.03, 0.03, 0.5, 0x3a9a30, 0, 0.25, 0);
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; gb.sphere(0.13, 0xffffff, Math.cos(a) * 0.14, 0.52, Math.sin(a) * 0.14, 1, 0.35, 1); }
  gb.sphere(0.08, 0xffd21a, 0, 0.56, 0);
  return gb.build();
}
function tuftGeo() {
  const gb = new GB(); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; gb.cone(0.07, 0.6, i % 2 ? 0x4fc23a : 0x6ad84a, Math.cos(a) * 0.08, 0.3, Math.sin(a) * 0.08, Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25, 5); }
  return gb.build();
}
function castleGeo() {
  const gb = new GB(), cream = 0xfff1d6, stone = 0xd6c8ae, red = 0xe8343c, gold = 0xffc23a, blue = 0x3a62d8;
  gb.cyl(46, 50, 5, stone, 0, 2.5, 0, 0, 0, 0, 40);
  gb.add(superEllipsoid(24, 14, 15, 0.12), cream, M4(0, 19, 0));
  gb.add(superEllipsoid(25, 1.2, 16, 0.2), stone, M4(0, 33, 0));
  for (let i = -5; i <= 5; i++) { gb.add(new THREE.BoxGeometry(2.2, 2.4, 2.2), cream, M4(i * 4.3, 35, 15.2)); gb.add(new THREE.BoxGeometry(2.2, 2.4, 2.2), cream, M4(i * 4.3, 35, -15.2)); }
  for (const [x, z] of [[-24, 15], [24, 15], [-24, -15], [24, -15]]) {
    gb.cyl(5, 5.6, 32, cream, x, 16, z, 0, 0, 0, 24); gb.cyl(6, 6, 1.4, stone, x, 32.5, z, 0, 0, 0, 24);
    gb.cone(6.6, 12, red, x, 39.4, z, 0, 0, 0, 24); gb.sphere(1, gold, x, 46, z);
  }
  gb.cyl(8, 9, 30, cream, 0, 44, -2, 0, 0, 0, 28); gb.cyl(9.2, 9.2, 1.5, stone, 0, 59.5, -2, 0, 0, 0, 28);
  gb.cone(10.2, 18, red, 0, 69, -2, 0, 0, 0, 28); gb.sphere(1.5, gold, 0, 79, -2); gb.cyl(0.25, 0.25, 8, 0x888888, 0, 83, -2);
  gb.cyl(4, 4.2, 12, cream, -14, 40, -6, 0, 0, 0, 20); gb.cone(4.8, 9, red, -14, 50.5, -6, 0, 0, 0, 20);
  gb.cyl(4, 4.2, 12, cream, 14, 40, -6, 0, 0, 0, 20); gb.cone(4.8, 9, red, 14, 50.5, -6, 0, 0, 0, 20);
  // door + bridge
  gb.add(superEllipsoid(5, 7, 1.2, 0.3), 0x7a4a2a, M4(0, 9, 15.3)); gb.add(new THREE.BoxGeometry(9, 0.8, 18), 0x9a6a3a, M4(0, 5.2, 24));
  return gb.build();
}
function castleWindows() {
  const gb = new GB();
  for (let i = -3; i <= 3; i++) if (i) gb.add(superEllipsoid(1.3, 2.2, 0.3, 0.3), 0xffffff, M4(i * 6, 22, 15.1));
  for (const [x, z] of [[-24, 15], [24, 15]]) for (const y of [14, 24]) gb.add(superEllipsoid(1.1, 1.9, 0.3, 0.3), 0xffffff, M4(x, y, z + 5.2));
  gb.add(new THREE.CircleGeometry(4.5, 32), 0xffffff, M4(0, 44, 7.05));
  return gb.build();
}
function lighthouseGeo() {
  const gb = new GB();
  gb.add(rockGeo(9), 0xffffff, M4(0, 1, 0, 0, 0, 0, 16, 8, 14));
  for (let k = 0; k < 6; k++) gb.cyl(lerp(3.2, 2.2, (k + 1) / 6), lerp(3.2, 2.2, k / 6), 4, k % 2 ? 0xffffff : 0xe8303a, 0, 6 + k * 4 + 2, 0, 0, 0, 0, 20);
  gb.cyl(2.8, 2.8, 0.6, 0x333a48, 0, 30.3, 0); gb.cone(2.6, 3.2, 0xe8303a, 0, 35.2, 0); gb.torus(2.7, 0.12, 0x333a48, 0, 31.5, 0, Math.PI / 2);
  return gb.build();
}
function boatGeo() {
  const gb = new GB();
  gb.add(superEllipsoid(1.5, 0.8, 4.2, 0.4), 0xffffff, M4(0, 0.3, 0)); gb.add(superEllipsoid(1.55, 0.25, 4.25, 0.4), 0x1f6fd8, M4(0, 0.05, 0));
  gb.cyl(0.08, 0.1, 8, 0x8a6a4a, 0, 4.6, 0.4);
  const s = new THREE.BufferGeometry(); s.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.2, 0.6, 0, 8.4, 0.5, 0, 1.2, 3.6], 3)); s.computeVertexNormals();
  gb.add(s, 0xfff6e8); const s2 = new THREE.BufferGeometry(); s2.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.2, 0.2, 0, 7.4, 0.3, 0, 1.2, -2.6], 3)); s2.computeVertexNormals(); gb.add(s2, 0xff5a7a);
  return gb.build();
}
function balloonGeo() {
  const gb = new GB(); const cols = [0xff4d6d, 0xffd23a, 0x3fd0ff, 0x7dff5a, 0xb46bff, 0xff8a1c];
  for (let s = 0; s < 12; s++) {
    const g = new THREE.LatheGeometry([[0, -5.5], [1.6, -4.8], [4.2, -2], [5.2, 1], [4.8, 3.6], [3, 5.5], [0, 6.2]].map(p => new THREE.Vector2(p[0], p[1])), 3, s / 12 * TAU, TAU / 12);
    gb.add(g, cols[s % cols.length], M4(0, 12, 0));
  }
  gb.add(new THREE.BoxGeometry(2, 1.4, 2), 0x9a6a3a, M4(0, 3.6, 0));
  for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) gb.cyl(0.04, 0.04, 3.4, 0x5a4a3a, x, 5.9, z);
  return gb.build();
}
function birdGeo() {
  const P = [0, 0, 0.3, -1.2, 0.25, -0.1, 0, 0, -0.4, 0, 0, 0.3, 1.2, 0.25, -0.1, 0, 0, -0.4, 0, 0.05, 0.3, 0, 0.05, -0.4, 0, -0.12, 0];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals(); return g;
}
function startGate(track, group) {
  const f = track.frame(0, 0, { P: V3(), T: V3(), N: V3(), B: V3() });
  const gate = new THREE.Group(); const w = track.hw[0] + 2.2;
  const gb = new GB();
  for (const s of [-1, 1]) {
    for (let k = 0; k < 5; k++) gb.cyl(0.75, 0.75, 1.9, k % 2 ? 0xffffff : 0xff3d6a, s * w, 1 + k * 1.9, 0, 0, 0, 0, 18);
    gb.sphere(1.1, 0xffd21a, s * w, 10.6, 0);
    for (let b = 0; b < 5; b++) { const a = b / 5 * TAU; gb.sphere(0.9, [0xff4d6d, 0x3fd0ff, 0x7dff5a, 0xffd23a, 0xb46bff][b], s * w + Math.cos(a) * 1.3, 11.6 + Math.sin(a * 2) * 0.4, Math.sin(a) * 1.3); }
  }
  gb.add(superEllipsoid(w + 0.2, 1.2, 0.5, 0.2), 0xffffff, M4(0, 9.4, 0));
  const gm = new THREE.Mesh(gb.build(), stdMat({ vertexColors: true, roughness: 0.35 }, { rim: 0.3 })); gm.castShadow = true; gate.add(gm);
  const cv = makeCanvas(1024, 128), g = cv.getContext('2d');
  for (let x = 0; x < 64; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 16, y * 16, 16, 16); g.fillRect(x * 16, 96 + y * 16, 16, 16); }
  const gr = g.createLinearGradient(0, 32, 0, 96); gr.addColorStop(0, '#ff4d8a'); gr.addColorStop(1, '#ff2a5a'); g.fillStyle = gr; g.fillRect(0, 32, 1024, 64);
  g.font = '900 54px Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 10; g.strokeStyle = '#3a0a2a'; g.strokeText('★ KART PARTY ★ START ★', 512, 66); g.fillStyle = '#fff'; g.fillText('★ KART PARTY ★ START ★', 512, 66);
  const ban = new THREE.Mesh(new THREE.PlaneGeometry(2 * w, 2.3), new THREE.MeshStandardMaterial({ map: canvasTex(cv), roughness: 0.6, side: THREE.FrontSide, emissive: 0xffffff, emissiveIntensity: 0.25, emissiveMap: null }));
  ban.position.set(0, 9.4, -0.55); ban.rotation.y = Math.PI; gate.add(ban);
  const ban2 = ban.clone(); ban2.position.z = 0.55; ban2.rotation.set(0, 0, 0); gate.add(ban2);
  gate.position.copy(f.P); gate.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.B, UP, f.T.clone().negate()));
  group.add(gate);
}

// ------------------------------------------------------------------ BUILD WORLD
export function buildBeachWorld() {
  const track = new Track(BEACH_DEF);
  const scene = new THREE.Scene(); const group = new THREE.Group(); scene.add(group);
  scene.fog = new THREE.Fog(0xcdeeff, 420, 2600);
  scene.background = COL(0x8fd2ff);
  const W = { id: 'beach', name: BEACH_DEF.name, track, scene, group, theme: 'beach', gravMul: 1, roadGrip: 1, waterY: 0, music: 'beach', colliders: [], animated: [] };
  // sky + clouds
  const sky = makeSkyDome({ top: 0x2f8cff, mid: 0x7cc4ff, hor: 0xd8f2ff, low: 0xbfe6ff, sun: 0xfff0c8 }); scene.add(sky); W.sky = sky;
  const clouds = makeClouds(46, { rMin: 450, rMax: 1500, yMin: 110, yMax: 300, seed: 11, center: V3(20, 0, 20) }); scene.add(clouds); W.clouds = clouds;
  // lights
  const hemi = new THREE.HemisphereLight(0xd6ecff, 0x7cc06a, 1.15); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.9); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 400;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; scene.add(sun); scene.add(sun.target); W.sun = sun;
  // terrain
  const terrain = buildBeachTerrain(track); group.add(terrain.mesh); W.terrain = terrain;
  W.groundAt = (x, z) => terrain.height(x, z); W.groundN = (x, z, o) => terrain.normal(x, z, o);
  // road
  const road = new THREE.Mesh(track.roadGeo(0.03), stdMat({ map: TEX.asphalt, roughness: 0.82, metalness: 0.0, color: 0xfff0e2, envMapIntensity: 0.6 }, { rim: 0.0 }));
  road.receiveShadow = true; group.add(road);
  // subtle edge lines
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -1 });
  const lines = new THREE.Mesh(track.merge([...track.runs(i => !(track.flags[i] & F_GAP) && !(track.flags[track.wrap(i + 1)] & F_GAP)).flatMap(([s, l]) => [
    track.ribbon(s, l, i => [[-track.hw[i] + 0.35, 0.045], [-track.hw[i] + 0.65, 0.045]]), track.ribbon(s, l, i => [[track.hw[i] - 0.65, 0.045], [track.hw[i] - 0.35, 0.045]])])]), lineMat);
  lines.receiveShadow = true; group.add(lines);
  const curbGeo = track.curbGeo(); if (curbGeo.attributes.position.count) { const curb = new THREE.Mesh(curbGeo, stdMat({ map: TEX.curb, roughness: 0.45 }, { rim: 0.1 })); curb.receiveShadow = true; group.add(curb); }
  const sl = new THREE.Mesh(track.startLineGeo(), new THREE.MeshStandardMaterial({ map: TEX.checker, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 })); sl.receiveShadow = true; group.add(sl);
  // barriers
  const bumpProf = [[0, 0], [0, 0.5], [0.08, 0.74], [0.3, 0.86], [0.52, 0.74], [0.62, 0.5], [0.62, -0.4]];
  const mkStripe = (a, b) => { const cv = makeCanvas(16, 128), g = cv.getContext('2d'); g.fillStyle = a; g.fillRect(0, 0, 16, 64); g.fillStyle = b; g.fillRect(0, 64, 16, 64); return canvasTex(cv, { repeat: true }); };
  for (const [style, tex] of [['bumperR', mkStripe('#ff3344', '#ffffff')], ['bumperB', mkStripe('#2f7bff', '#ffffff')]]) {
    const g = track.barrierGeo(style, bumpProf); if (!g) continue;
    const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) * 4 / 6);
    const m = new THREE.Mesh(g, stdMat({ map: tex, roughness: 0.3, metalness: 0.05 }, { rim: 0.35 })); m.castShadow = true; m.receiveShadow = true; group.add(m);
  }
  const woodCv = makeCanvas(128, 128), wg = woodCv.getContext('2d');
  for (let y = 0; y < 128; y += 16) { wg.fillStyle = `hsl(28,${48 + (y % 32 ? 4 : 0)}%,${46 + hash2(y, 1) * 10}%)`; wg.fillRect(0, y, 128, 16); wg.fillStyle = 'rgba(60,30,10,0.35)'; wg.fillRect(0, y + 14, 128, 2); for (let k = 0; k < 6; k++) { wg.fillStyle = 'rgba(80,40,10,0.15)'; wg.fillRect(hash2(y, k) * 128, y + 3 + k * 1.7, 30, 1); } }
  const woodTex = canvasTex(woodCv, { repeat: true });
  const woodMat = stdMat({ map: woodTex, roughness: 0.7, side: THREE.DoubleSide }, { rim: 0.15 });
  { // fence + ramp rails
    const g = track.barrierGeo('fence', [[0.1, 0.55], [0.1, 0.72], [0.22, 0.72], [0.22, 0.55]]); const g2 = track.barrierGeo('fence', [[0.1, 1.0], [0.1, 1.17], [0.22, 1.17], [0.22, 1.0]]);
    const g3 = track.barrierGeo('rail', [[0, -0.1], [0, 1.0], [0.3, 1.1], [0.35, 1.0], [0.35, -0.1]]);
    for (const gg of [g, g2, g3]) if (gg) { const m = new THREE.Mesh(gg, woodMat); m.castShadow = true; m.receiveShadow = true; group.add(m); }
    const posts = []; for (let i = 0; i < track.n; i += 3) for (const side of [-1, 1]) {
      const st = side < 0 ? track.barStyleL[i] : track.barStyleR[i]; if (st !== 'fence') continue;
      const e = side < 0 ? track.edgeL(i) - 0.16 : track.edgeR(i) + 0.16; posts.push(track.point(i, e, 0, V3()));
    }
    if (posts.length) { const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.14, 1.4, 8), woodMat, posts.length); posts.forEach((p, k) => im.setMatrixAt(k, M4(p.x, p.y + 0.55, p.z))); im.castShadow = true; group.add(im); }
  }
  // ramp / landing skirts (wooden) + support pillars
  {
    const sk = track.skirtGeo(i => (track.flags[i] & F_SKIRT) > 0, (i, side, y) => Math.min(y - 0.5, terrain.height(track.px[i] + track.bx[i] * (side < 0 ? track.edgeL(i) : track.edgeR(i)), track.pz[i] + track.bz[i] * (side < 0 ? track.edgeL(i) : track.edgeR(i))) - 0.5));
    if (sk) { const m = new THREE.Mesh(sk, woodMat); m.castShadow = true; m.receiveShadow = true; group.add(m); }
    const pil = []; for (let i = 0; i < track.n; i += 5) if (track.flags[i] & F_SKIRT) for (const side of [-1, 1]) {
      const p = track.point(i, (side < 0 ? track.edgeL(i) : track.edgeR(i)) - side * 0.5, 0, V3()); const b = Math.min(p.y - 0.5, terrain.height(p.x, p.z)) - 1.5; pil.push([p.x, (p.y + b) / 2, p.z, p.y - b]);
    }
    if (pil.length) { const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.4, 1, 10), woodMat, pil.length); pil.forEach(([x, y, z, h], k) => im.setMatrixAt(k, M4(x, y, z, 0, 0, 0, 1, h, 1))); im.castShadow = true; group.add(im); }
  }
  // tunnel
  {
    const inT = i => { for (let k = -4; k <= 4; k++) if (track.flags[track.wrap(i + k)] & F_TUNNEL) return true; return false; };
    const rs = track.runs(inT); const list = [];
    for (const [s, l] of rs) list.push(track.ribbon(s, l, i => { const eL = track.edgeL(i) - 0.4, eR = track.edgeR(i) + 0.4, cx = (eL + eR) / 2, rx = (eR - eL) / 2, a = [[eL, -0.6], [eL, 3.2]]; for (let k = 1; k < 12; k++) { const t = Math.PI - k / 12 * Math.PI; a.push([cx + Math.cos(t) * rx, 3.2 + Math.sin(t) * 5.6]); } a.push([eR, 3.2], [eR, -0.6]); return a; }, { uAcross: true, vScale: 6, flip: true }));
    const stCv = makeCanvas(256, 256), sg = stCv.getContext('2d'); sg.fillStyle = '#8a7a6a'; sg.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 5; x++) { const ox = (y % 2) * 26; sg.fillStyle = `hsl(30,${12 + hash2(x, y) * 10}%,${46 + hash2(y, x) * 16}%)`; sg.beginPath(); sg.roundRect ? sg.roundRect(x * 52 + ox - 24, y * 32 + 2, 48, 28, 6) : sg.rect(x * 52 + ox - 24, y * 32 + 2, 48, 28); sg.fill(); }
    const stoneTex = canvasTex(stCv, { repeat: true });
    if (list.length) { const tm = new THREE.Mesh(track.merge(list), stdMat({ map: stoneTex, roughness: 0.85, side: THREE.DoubleSide, color: 0xd8ccbb }, { rim: 0.05 })); tm.castShadow = true; tm.receiveShadow = true; group.add(tm); W.tunnel = tm; }
    // rock ridge capping the tunnel (sits above the arch so the portals stay open)
    { const capG = []; for (const [s0, l] of rs) for (let r = 0; r < l; r += 6) { const i = track.wrap(s0 + r); const rr = rand(9, 12); capG.push({ i, rr, seed: r }); }
      const gb = new GB(); const base = rockGeo(21), base2 = rockGeo(22);
      for (const c of capG) { const f = track.frame(c.i, 0, { P: V3(), T: V3(), N: V3(), B: V3() }); const m = new THREE.Matrix4().makeBasis(f.B, UP, f.T.clone().negate()); m.scale(V3(c.rr * 1.35, c.rr * 0.72, c.rr * 0.9)); m.setPosition(f.P.x, f.P.y + 9.2 + c.rr * 0.66, f.P.z); gb.parts.push((c.seed % 12 ? base : base2).clone().applyMatrix4(m)); }
      if (gb.parts.length) { const cm = new THREE.Mesh(mergeGeos(gb.parts), stdMat({ vertexColors: true, roughness: 0.9 }, { rim: 0.1 })); cm.castShadow = true; cm.receiveShadow = true; group.add(cm); } }
    // portals + lamps
    const lamps = [];
    for (const [s, l] of rs) {
      for (const ii of [s, track.wrap(s + l - 1)]) {
        const f = track.frame(ii, 0, { P: V3(), T: V3(), N: V3(), B: V3() }); const rx = (track.edgeR(ii) - track.edgeL(ii)) / 2 + 1.2;
        const gb = new GB(); gb.add(new THREE.TorusGeometry(rx, 1.3, 10, 24, Math.PI), 0xcfc0a8, M4(0, 3.2, 0, 0, 0, 0, 1, 5.6 / rx * 1.05, 1));
        gb.add(new THREE.BoxGeometry(2.6, 4.4, 2.6), 0xcfc0a8, M4(-rx, 1.2, 0)); gb.add(new THREE.BoxGeometry(2.6, 4.4, 2.6), 0xcfc0a8, M4(rx, 1.2, 0));
        gb.add(superEllipsoid(1.4, 1.6, 1.5, 0.3), 0xffd23a, M4(0, 9.3, 0));
        const pm = new THREE.Mesh(gb.build(), stdMat({ vertexColors: true, roughness: 0.8 }, { rim: 0.1 })); pm.castShadow = true;
        pm.position.copy(f.P); pm.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.B, f.N, f.T.clone().negate())); group.add(pm);
      }
      for (let r = 0; r < l; r += 7) { const i = track.wrap(s + r); for (const sd of [-1, 1]) lamps.push(track.point(i, sd * (track.hw[i] + 0.2), 6.4, V3())); }
    }
    if (lamps.length) { const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ color: COL(0xffd890).multiplyScalar(4) }), lamps.length); lamps.forEach((p, k) => im.setMatrixAt(k, M4(p.x, p.y, p.z))); group.add(im); }
  }
  startGate(track, group);
  // ---------------- props ----------------
  const avoid = (x, z, m) => { const q = track.nearXZ(x, z, 60); if (q.i < 0) return false; const e = q.d < 0 ? -track.edgeL(q.i) : track.edgeR(q.i); return Math.abs(q.d) < e + m; };
  const addCol = (x, z, r, y0 = -5, y1 = 30) => W.colliders.push({ x, z, r, y0, y1 });
  const place = (n, fn, tries = 40) => { const out = []; for (let k = 0; k < n * tries && out.length < n; k++) { const r = fn(); if (r) out.push(r); } return out; };
  setRng(mulberry32(99));
  // palms
  const palmPts = [];
  for (let k = 0; k < 400 && palmPts.length < 70; k++) {
    let x, z; const zone = k % 4;
    if (zone === 0) { x = rand(-150, 230); z = rand(150, 196); } else if (zone === 1) { x = rand(-280, 280); z = rand(185, 222); } else if (zone === 2) { x = rand(-40, 200); z = rand(20, 150); } else { x = rand(-80, -36); z = rand(155, 215); }
    const h = terrain.height(x, z); if (h < 0.8 || h > 12) continue; if (avoid(x, z, 3.5)) continue;
    if (palmPts.some(p => Math.hypot(p[0] - x, p[2] - z) < 7)) continue;
    palmPts.push([x, h - 0.2, z, rand(0.8, 1.25), rand(0, TAU)]);
  }
  { const im = new THREE.InstancedMesh(palmGeo(), swayPatch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, side: THREE.DoubleSide }), 0.012), palmPts.length);
    palmPts.forEach(([x, y, z, s, r], k) => { im.setMatrixAt(k, M4(x, y, z, 0, r, 0, s)); addCol(x, z, 0.7 * s); }); im.castShadow = true; im.receiveShadow = true; group.add(im); }
  // giant mushrooms
  const mushPts = [];
  for (let k = 0; k < 600 && mushPts.length < 44; k++) {
    let x, z; const zone = k % 3;
    if (zone === 0) { x = rand(-10, 195); z = rand(25, 170); } else if (zone === 1) { x = rand(-110, 10); z = rand(-110, -10); } else { x = rand(-250, 250); z = rand(-200, 180); }
    const h = terrain.height(x, z); if (h < 1.5 || h > 30) continue;
    const s = rand(3, 9); if (avoid(x, z, 2.4 * s + 3)) continue;
    if (mushPts.some(p => Math.hypot(p[0] - x, p[2] - z) < (p[3] + s) * 2.4)) continue;
    mushPts.push([x, h - 0.3, z, s, rand(0, TAU), randi(0, 4)]);
  }
  { const mg = mushroomGeos(); const cols = [0xff3a4a, 0x4ad84a, 0xffa21a, 0x3aa8ff, 0xc86aff].map(c => COL(c));
    const stem = new THREE.InstancedMesh(mg.stem, stdMat({ vertexColors: true, roughness: 0.55 }, { rim: 0.25 }), mushPts.length);
    const cap = new THREE.InstancedMesh(mg.cap, stdMat({ vertexColors: true, roughness: 0.3, metalness: 0.0 }, { rim: 0.4 }), mushPts.length);
    mushPts.forEach(([x, y, z, s, r, c], k) => { const m = M4(x, y, z, 0, r, 0, s); stem.setMatrixAt(k, m); cap.setMatrixAt(k, m); cap.setColorAt(k, cols[c]); addCol(x, z, 0.9 * s); });
    for (const m of [stem, cap]) { m.castShadow = true; m.receiveShadow = true; group.add(m); } }
  // bushes with eyes (face the road)
  { const pts = []; for (let i = 0; i < track.n; i += 17) { if (track.flags[i] & (F_GAP | F_TUNNEL | F_SKIRT)) continue; const side = (i / 17) % 2 ? 1 : -1; const e = side < 0 ? track.edgeL(i) - rand(2, 6) : track.edgeR(i) + rand(2, 6); const p = track.point(i, e, 0, V3()); const h = terrain.height(p.x, p.z); if (h < 1 || Math.abs(h - p.y) > 2.5 || avoid(p.x, p.z, 1.2)) continue; const ang = Math.atan2(track.px[i] - p.x, track.pz[i] - p.z); pts.push([p.x, h - 0.1, p.z, ang, rand(1.1, 1.8)]); }
    const im = new THREE.InstancedMesh(bushGeo(), stdMat({ vertexColors: true, roughness: 0.6 }, { rim: 0.35 }), pts.length); pts.forEach(([x, y, z, a, s], k) => { im.setMatrixAt(k, M4(x, y, z, 0, a, 0, s)); addCol(x, z, 1.4 * s); }); im.castShadow = true; im.receiveShadow = true; group.add(im); }
  // rocks
  { const pts = place(70, () => { const x = rand(-260, 280), z = rand(-300, 240), h = terrain.height(x, z); if (h < -1 || avoid(x, z, 6)) return null; const hx = terrain.height(x + 3, z) - terrain.height(x - 3, z), hz = terrain.height(x, z + 3) - terrain.height(x, z - 3); if (Math.hypot(hx, hz) < 1.2 && hash2(x | 0, z | 0) > 0.25) return null; return [x, h, z, rand(1.5, 6)]; });
    for (let v = 0; v < 2; v++) { const sub = pts.filter((_, k) => k % 2 === v); const im = new THREE.InstancedMesh(rockGeo(v * 7 + 3), stdMat({ vertexColors: true, roughness: 0.9 }, { rim: 0.1 }), sub.length); sub.forEach(([x, y, z, s], k) => { im.setMatrixAt(k, M4(x, y, z, rand(0, 1), rand(0, TAU), 0, s, s * 0.8, s)); addCol(x, z, s * 0.9); }); im.castShadow = true; im.receiveShadow = true; group.add(im); } }
  // flowers + tufts
  { const fl = [], tu = [];
    for (let k = 0; k < 9000 && (fl.length < 700 || tu.length < 1600); k++) { const x = rand(-260, 280), z = rand(-300, 200), h = terrain.height(x, z); if (h < 1.8 || h > 26) continue; if (avoid(x, z, 1)) continue; const n = vnoise(x * 0.05, z * 0.05); if (n < 0.45) continue; (hash2(k, 3) > 0.62 ? fl : tu).push([x, h, z]); }
    const fcols = [0xffffff, 0xff7ab8, 0xffe14a, 0xff5a5a, 0x9ad0ff, 0xd09aff].map(c => COL(c));
    const fm = new THREE.InstancedMesh(flowerGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), Math.min(fl.length, 700)); for (let k = 0; k < fm.count; k++) { const [x, y, z] = fl[k]; fm.setMatrixAt(k, M4(x, y, z, 0, rand(0, 6), 0, rand(1.1, 1.8))); fm.setColorAt(k, pick(fcols)); } group.add(fm);
    const tm = new THREE.InstancedMesh(tuftGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), Math.min(tu.length, 1600)); for (let k = 0; k < tm.count; k++) { const [x, y, z] = tu[k]; tm.setMatrixAt(k, M4(x, y, z, 0, rand(0, 6), 0, rand(1, 2))); } group.add(tm); }
  // castle
  { const cy = terrain.height(60, -262) - 1; const cm = new THREE.Mesh(castleGeo(), stdMat({ vertexColors: true, roughness: 0.55 }, { rim: 0.2 })); cm.position.set(60, cy, -262); cm.rotation.y = -0.2; cm.castShadow = false; cm.receiveShadow = true; group.add(cm);
    const win = new THREE.Mesh(castleWindows(), new THREE.MeshBasicMaterial({ color: COL(0xffd27a).multiplyScalar(2.2), vertexColors: true })); win.position.copy(cm.position); win.rotation.copy(cm.rotation); group.add(win);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.5, 12, 4), new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: { uTime: TIME_U }, vertexShader: `uniform float uTime; varying vec2 vUv; void main(){ vUv=uv; vec3 p = position; float k = (p.x+3.0)/6.0; p.z += sin(p.x*1.4 - uTime*6.0)*0.5*k; p.y += sin(p.x*0.9 - uTime*4.0)*0.2*k; gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0); }`, fragmentShader: `varying vec2 vUv; void main(){ vec3 c = mix(vec3(1.0,0.22,0.35), vec3(1.0,0.85,0.2), step(0.5, fract(vUv.x*2.0 + vUv.y))); gl_FragColor = vec4(c*1.2,1.0); }` }));
    flag.position.set(60 + 3, cy + 84, -264); group.add(flag); }
  // lighthouse, boats, balloons, birds
  { const lh = new THREE.Mesh(lighthouseGeo(), stdMat({ vertexColors: true, roughness: 0.5 }, { rim: 0.2 })); lh.position.set(240, -2, 300); group.add(lh);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), new THREE.MeshBasicMaterial({ color: COL(0xfff0a0).multiplyScalar(6) })); lamp.position.set(240, 30.5, 300); group.add(lamp);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(6, 60, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff4c0, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.geometry.translate(0, -30, 0); beam.geometry.rotateX(Math.PI / 2); const bp = new THREE.Group(); bp.position.copy(lamp.position); bp.add(beam); group.add(bp);
    W.animated.push(t => { bp.rotation.y = t * 0.8; });
    const bm = new THREE.InstancedMesh(boatGeo(), stdMat({ vertexColors: true, roughness: 0.4, side: THREE.DoubleSide }, { rim: 0.3 }), 6); const boats = [];
    for (let k = 0; k < 6; k++) boats.push({ x: rand(-400, 450), z: rand(290, 620), r: rand(0, TAU), ph: rand(0, 6) });
    W.animated.push(t => { boats.forEach((b, k) => { bm.setMatrixAt(k, M4(b.x + Math.sin(t * 0.05 + b.ph) * 20, Math.sin(t * 1.3 + b.ph) * 0.3, b.z, Math.sin(t * 1.1 + b.ph) * 0.06, b.r, Math.cos(t * 1.4 + b.ph) * 0.08, 1.6)); }); bm.instanceMatrix.needsUpdate = true; });
    group.add(bm);
    const balG = balloonGeo(); const bals = [];
    for (let k = 0; k < 5; k++) { const m = new THREE.Mesh(balG, stdMat({ vertexColors: true, roughness: 0.45 }, { rim: 0.4 })); const a = k / 5 * TAU + 0.4; m.userData = { x: 40 + Math.cos(a) * rand(180, 320), z: 20 + Math.sin(a) * rand(180, 300), y: rand(55, 95), ph: rand(0, 6) }; group.add(m); bals.push(m); }
    W.animated.push(t => bals.forEach(m => { const u = m.userData; m.position.set(u.x + Math.sin(t * 0.04 + u.ph) * 30, u.y + Math.sin(t * 0.3 + u.ph) * 3, u.z + Math.cos(t * 0.05 + u.ph) * 30); m.rotation.y = t * 0.05; }));
    const birdMat = new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: { uTime: TIME_U }, vertexShader: `uniform float uTime; varying float vS; void main(){ vec3 p = position; float ph = instanceMatrix[3].x*0.3; p.y += abs(p.x)*sin(uTime*9.0 + ph)*0.7; vS = abs(p.x); gl_Position = projectionMatrix*viewMatrix*modelMatrix*instanceMatrix*vec4(p,1.0); }`, fragmentShader: `varying float vS; void main(){ gl_FragColor = vec4(mix(vec3(1.0), vec3(0.35,0.4,0.5), smoothstep(0.8,1.2,vS)), 1.0); }` });
    const birds = new THREE.InstancedMesh(birdGeo(), birdMat, 14); birds.frustumCulled = false; const bd = [];
    for (let k = 0; k < 14; k++) bd.push({ cx: rand(-150, 200), cz: rand(-100, 260), r: rand(25, 60), y: rand(28, 55), sp: rand(0.25, 0.45) * (k % 2 ? 1 : -1), ph: rand(0, 6) });
    W.animated.push(t => { bd.forEach((b, k) => { const a = t * b.sp + b.ph; birds.setMatrixAt(k, M4(b.cx + Math.cos(a) * b.r, b.y + Math.sin(t + b.ph) * 2, b.cz + Math.sin(a) * b.r, 0, -a + (b.sp > 0 ? 0 : Math.PI), Math.sin(t * 0.7 + b.ph) * 0.3, 1.6)); }); birds.instanceMatrix.needsUpdate = true; });
    group.add(birds); }
  // waterfall + river + rainbow arc
  {
    const zTop = 146.5, yTop = 20.3, H = 23.5, wdt = 11;
    const P = [], U = [], I = []; const rows = 24, cols = 8;
    for (let r = 0; r <= rows; r++) { const v = r / rows; for (let c = 0; c <= cols; c++) { const u = c / cols; const x = -58 + (u - 0.5) * wdt * (1 + v * 0.35); P.push(x, yTop - v * H, zTop + 4.2 * Math.sqrt(v) + 0.3); U.push(u, v * 3.2); } }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const a = r * (cols + 1) + c; I.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I);
    const wf = new THREE.Mesh(g, flowMat(1.6, 1.0)); wf.renderOrder = 6; group.add(wf);
    const rp = [], ru = [], ri = []; const rrows = 30;
    for (let r = 0; r <= rrows; r++) { const z = lerp(96, zTop + 0.3, r / rrows), cx = -58 + Math.sin(z * 0.08) * 2, y = lerp(20.9, yTop, smooth(0.8, 1, r / rrows)); rp.push(cx - 4, y, z, cx + 4, y, z); ru.push(0, r * 0.5, 1, r * 0.5); if (r < rrows) { const a = r * 2; ri.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); rg.setAttribute('uv', new THREE.Float32BufferAttribute(ru, 2)); rg.setIndex(ri);
    const river = new THREE.Mesh(rg, flowMat(0.5, 0.6)); river.renderOrder = 6; group.add(river);
    const arc = new THREE.Mesh(new THREE.TorusGeometry(16, 1.6, 8, 48, Math.PI), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uTime: TIME_U },
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform float uTime; varying vec3 vP; ${HSV_GLSL} void main(){ float r = length(vP.xy); float t = clamp((r - 14.4)/3.2, 0.0, 1.0); vec3 c = kpHsv(vec3(t*0.8, 0.8, 1.0)); float a = sin(t*3.14159)*0.22*(0.8 + 0.2*sin(uTime*1.5)); gl_FragColor = vec4(c*a, a); }` }));
    arc.position.set(-58, 3, 158); arc.rotation.y = 0.15; group.add(arc);
    W.animated.push((t, dt) => {
      if (Math.random() < dt * 30) FX.alpha.emit(-58 + rand(-6, 6), rand(0, 1.5), rand(151, 155), rand(-1.5, 1.5), rand(1.5, 4), rand(0.5, 2.5), { life: rand(1.6, 2.6), size: rand(1.5, 2.5), size1: rand(5, 8), color: COL(0xffffff), tile: TILE.smoke, alpha: 0.55, drag: 0.6 });
      if (Math.random() < dt * 25) FX.alpha.emit(-58 + rand(-5, 5), 0.3, rand(151, 154), rand(-3, 3), rand(3, 7), rand(0, 3), { life: 0.9, size: 0.3, size1: 0.08, color: COL(0xe8f8ff), tile: TILE.soft, grav: 14 });
    });
  }
  // ocean (after env capture uses the cube)
  const envPos = V3(30, 34, 120);
  const cap = captureEnv(scene, envPos, [], 256);
  scene.environment = cap.env; W.envCube = cap.cube;
  const ocean = buildOcean(terrain, cap.cube.texture); group.add(ocean); W.ocean = ocean;
  // sparkles in the air near camera
  W.ambient = (dt, cam) => { if (Math.random() < dt * 6) FX.sparkle(_tv[5].set(cam.x + rand(-25, 25), cam.y + rand(-2, 10), cam.z + rand(-25, 25)), COL(0xfff6c0).multiplyScalar(2), 1, 0); };
  W.fallY = -0.9; W.waterSplashY = 0;
  W.intro = [
    [V3(150, 70, 430), V3(10, 10, 80)], [V3(80, 20, 262), V3(-30, 6, 208)], [V3(-10, 16, 232), V3(-58, 14, 160)],
    [V3(-70, 34, 150), V3(-150, 20, 60)], [V3(-120, 40, -110), V3(40, 30, -250)], [V3(-50, 18, -40), V3(40, 6, 0)], [V3(10, 6, 3), V3(60, 4, 0)],
  ];
  W.minimapBg = '#3fd0ff';
  W.update = (t, dt) => { for (const f of W.animated) f(t, dt); };
  return W;
}


