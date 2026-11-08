// 07_space.js (Kart Party Deluxe)
import * as THREE from 'three';
import { COL, TAU, UP, V3, camera, canvasTex, makeCanvas, pick, rand, randi } from './01_core.js';
import { GB, HSV_GLSL, M4, TIME_U, captureEnv, stdMat } from './02_gfx.js';
import { F_AGRAV, F_GAP, F_LOOP, Track, _tv } from './04_track.js';
import { FX } from './05_fx.js';
import { rockGeo } from './06_beach.js';

// ============================================================================
// WORLD 2 — RAINBOW ROAD (space)
// ============================================================================
const RAINBOW_DEF = (() => {
  const pts = [
    [40, 100, 0, 18], [100, 100, 0, 18], [160, 102, -2, 18], [205, 106, -20, 19], [232, 110, -58, 20], [234, 113, -106, 20], [207, 116, -146, 20], [160, 118, -165, 18],
    [120, 113, -170, 17], [84, 118, -172, 17], [72, 116.8, -172.6, 17], [30, 108, -175, 17], [-8, 112, -176, 17], [-40, 108, -178, 17], [-65, 108, -180, 16],
    [-82, 108, -180, 16],
  ];
  // vertical loop: radius 17, shifted 20m to the right (-z) while heading west
  const R = 17, E = [-95, 108, -180];
  for (let k = 0; k <= 8; k++) { const ph = k / 8 * TAU; pts.push([E[0] - R * Math.sin(ph), E[1] + R * (1 - Math.cos(ph)), E[2] - 20 * k / 8, 16]); }
  pts.push([-108, 108, -200, 16], [-125, 107.5, -200, 17]);
  // descending helix: 450 degrees around (-160,-155), r=45
  for (let k = 0; k <= 10; k++) { const th = k * 45 * Math.PI / 180; pts.push([-160 - 45 * Math.sin(th), 106 - 26 * k / 10, -155 - 45 * Math.cos(th), 20]); }
  pts.push([-206, 79, -110, 18], [-204, 78.5, -60, 18], [-192, 78.5, -15, 19], [-165, 79, 18, 19], [-125, 80, 32, 18], [-85, 84, 30, 17], [-50, 90, 18, 17], [-22, 97, 4, 18], [5, 99.5, 0.5, 18]);
  return pts;
})();
export const RAINBOW = {
  id: 'rainbow', name: 'RAINBOW ROAD', ds: 1.0, width: 18, bankFactor: 15, maxBank: 28, curbCurv: 99,
  pts: RAINBOW_DEF,
  defaults: { shL: 0, shR: 0, wallL: true, wallR: true, barL: 'neon', barR: 'neon', surfL: 'none', surfR: 'none', curb: false, tfollow: false },
  secs: [
    { a: 3.0, b: 7.3, bank: -8 },
    { a: 7.3, b: 14.6, wallL: false, wallR: false, barL: null, barR: null },
    { a: 8.75, b: 9.0, wallL: false, wallR: false, barL: null, barR: null, launch: true, trick: true, nosafe: true },
    { a: 9.0, b: 9.96, wallL: false, wallR: false, barL: null, barR: null, gap: true, nosafe: true },
    { a: 9.96, b: 10.3, wallL: false, wallR: false, barL: null, barR: null, nosafe: true },
    { a: 14.6, b: 26.0, agrav: true },
    { a: 15.3, b: 24.7, agrav: true, loop: true },
    { a: 38.6, b: 42.4, agrav: true, bank: -62 },
    { a: 42.4, b: 45.4, wallL: false, wallR: false, barL: null, barR: null },
  ],
  boosts: [{ c: 8.2, star: true }, { c: 8.4, star: true }, { c: 8.6, star: true }, { c: 37.9, star: true }, { c: 38.15, star: true }, { c: 1.2, star: true, d: 4 }],
  items: [2.2, 7.7, 14.0, 26.3, 37.4, 43.6],
  coins: [[0.4, 1.0, 3], [5.2, 5.8, -3], [11.2, 12.0, 0], [16.2, 23.8, 0], [28, 30, 2], [32, 34, -2], [40, 41.5, -2], [44, 44.8, 0]],
  music: 'rainbow', start: 0,
};

const NOISE3_GLSL = `
  float h3(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(h3(i+vec3(0,0,0)),h3(i+vec3(1,0,0)),f.x), mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x), mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y), f.z); }
  float fbm3(vec3 p){ float s = 0.0, a = 0.5; for (int i=0;i<5;i++){ s += a*n3(p); p = p*2.03 + vec3(1.7,9.2,3.1); a *= 0.5; } return s; }`;

function makeSpaceSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uTime: TIME_U },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position = vec4(p.xy, p.w*0.99999, p.w); }`,
    fragmentShader: `uniform float uTime; varying vec3 vDir; ${NOISE3_GLSL}
      float stars(vec3 d, float sc, float th){ vec3 p = d*sc; vec3 id = floor(p); float h = h3(id*1.37 + 11.0); if (h < th) return 0.0;
        vec3 c = id + 0.5 + (vec3(h3(id+1.1), h3(id+2.3), h3(id+3.7)) - 0.5)*0.6; float r = length(p - c);
        float tw = 0.6 + 0.4*sin(uTime*(2.0 + h*5.0) + h*40.0); return smoothstep(0.16, 0.0, r)*tw*(0.5 + (h - th)/(1.0 - th)*2.5); }
      void main(){
        vec3 d = normalize(vDir);
        vec3 col = mix(vec3(0.004, 0.002, 0.014), vec3(0.012, 0.005, 0.03), d.y*0.5 + 0.5);
        float n1 = fbm3(d*2.1 + vec3(0.0, 0.0, uTime*0.004));
        float n2 = fbm3(d*3.3 + vec3(7.0, 3.0, -uTime*0.003));
        float n3v = fbm3(d*5.2 + vec3(13.0));
        col += vec3(0.9, 0.12, 0.7)*pow(smoothstep(0.35, 0.85, n1), 2.2)*0.9;
        col += vec3(0.08, 0.4, 1.0)*pow(smoothstep(0.4, 0.85, n2), 2.4)*0.85;
        col += vec3(1.0, 0.42, 0.1)*pow(smoothstep(0.45, 0.9, n3v), 2.5)*0.8*smoothstep(0.3, 0.7, n1);
        vec3 bn = normalize(vec3(0.3, 1.0, 0.45));
        float band = exp(-pow(dot(d, bn)*5.5, 2.0));
        col += vec3(0.5, 0.4, 0.9)*band*pow(fbm3(d*9.0), 2.0)*0.55;
        col += vec3(1.0, 0.95, 0.9)*(stars(d, 180.0, 0.93)*0.9 + stars(d, 420.0, 0.965)*0.7 + stars(d, 90.0, 0.985)*2.0)*(1.0 + band*2.0);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(2400, 64, 32), mat); m.frustumCulled = false; m.renderOrder = -10; m.userData.follow = true;
  return m;
}
function planetMesh(r, kind, o = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: TIME_U, lightDir: { value: V3(0.6, 0.5, 0.6).normalize() }, c1: { value: COL(o.c1 || 0xffffff) }, c2: { value: COL(o.c2 || 0x888888) }, c3: { value: COL(o.c3 || 0x333333) }, atm: { value: COL(o.atm || 0x66aaff) } },
    vertexShader: `varying vec3 vN; varying vec3 vP; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix)*normal); vP = position; vW = (modelMatrix*vec4(position,1.0)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vW,1.0); }`,
    fragmentShader: `uniform float uTime; uniform vec3 lightDir, c1, c2, c3, atm; varying vec3 vN; varying vec3 vP; varying vec3 vW; ${NOISE3_GLSL}
      void main(){
        vec3 p = normalize(vP); vec3 col;
        ${kind === 'gas' ? `float lat = p.y*6.0 + fbm3(p*3.0 + vec3(uTime*0.01, 0.0, 0.0))*1.6; float b = 0.5 + 0.5*sin(lat*3.0); col = mix(c1, c2, b); col = mix(col, c3, smoothstep(0.55, 0.8, fbm3(p*6.0 + 3.0)));
          float spot = smoothstep(0.18, 0.1, length(vec2(atan(p.z, p.x) - 0.6, p.y + 0.25)*vec2(1.0, 2.2))); col = mix(col, vec3(0.9, 0.35, 0.2), spot*0.8);`
        : kind === 'earth' ? `float rot = uTime*0.01; vec3 q = vec3(p.x*cos(rot) - p.z*sin(rot), p.y, p.x*sin(rot) + p.z*cos(rot)); float land = fbm3(q*2.6);
          col = mix(c2, c1, smoothstep(0.5, 0.53, land)); col = mix(col, vec3(1.0), smoothstep(0.82, 0.92, abs(p.y)));
          float cl = fbm3(q*4.0 + vec3(uTime*0.015)); col = mix(col, vec3(1.0), smoothstep(0.55, 0.75, cl)*0.85);`
        : `float cr = fbm3(p*5.0); col = mix(c2, c1, cr); float k = fbm3(p*11.0); col *= 0.75 + 0.35*smoothstep(0.35, 0.65, k); col = mix(col, c3, smoothstep(0.6, 0.62, fbm3(p*7.0 + 5.0))*0.5);`}
        vec3 n = normalize(vN); float l = max(dot(n, lightDir), 0.0);
        vec3 v = normalize(cameraPosition - vW); float fr = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec3 c = col*(0.08 + 1.25*l) + atm*fr*(0.35 + 1.4*l);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 32), mat); return m;
}
function ringMesh(r0, r1) {
  const g = new THREE.RingGeometry(r0, r1, 128, 1);
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: {},
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vP; float hh(float x){ return fract(sin(x*91.7)*43758.5); }
      void main(){ float r = length(vP.xy); float t = (r - ${r0.toFixed(1)})/${(r1 - r0).toFixed(1)}; float b = 0.5 + 0.5*sin(t*80.0 + sin(t*13.0)*3.0);
        float gaps = smoothstep(0.02, 0.05, abs(t - 0.62)); vec3 c = mix(vec3(0.95, 0.8, 0.6), vec3(0.8, 0.55, 0.9), t)*1.2;
        gl_FragColor = vec4(c, (0.25 + 0.5*b)*gaps*smoothstep(0.0, 0.08, t)*smoothstep(1.0, 0.85, t)); }` });
  return new THREE.Mesh(g, mat);
}
function starShape(r0, r1) { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? r1 : r0; if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } s.closePath(); return s; }

export function buildRainbowWorld() {
  const track = new Track(RAINBOW);
  const scene = new THREE.Scene(); const group = new THREE.Group(); scene.add(group);
  scene.background = COL(0x05010f);
  const W = { id: 'rainbow', name: RAINBOW.name, track, scene, group, theme: 'space', gravMul: 0.88, roadGrip: 0.93, waterY: null, music: 'rainbow', colliders: [], animated: [] };
  const sky = makeSpaceSky(); scene.add(sky); W.sky = sky;
  // star points
  {
    const n = 3500, P = new Float32Array(n * 3), C = new Float32Array(n * 3), S = new Float32Array(n);
    for (let i = 0; i < n; i++) { const v = V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(1300, 2100)); P.set([v.x, v.y, v.z], i * 3); const c = COL(pick([0xffffff, 0xcfe0ff, 0xfff0c8, 0xffc8f0, 0xa8d8ff])).multiplyScalar(rand(1.5, 5)); C.set([c.r, c.g, c.b], i * 3); S[i] = rand(1.5, 5.5); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setAttribute('size', new THREE.BufferAttribute(S, 1));
    const m = new THREE.Points(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: TIME_U },
      vertexShader: `attribute float size; attribute vec3 color; uniform float uTime; varying vec3 vC; void main(){ vC = color*(0.6 + 0.4*sin(uTime*(1.5 + size) + position.x*0.01)); vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = size*1.4; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vC; void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q); float a = smoothstep(0.5, 0.0, d); a += smoothstep(0.06, 0.0, abs(q.x))*smoothstep(0.5,0.0,abs(q.y))*0.5 + smoothstep(0.06, 0.0, abs(q.y))*smoothstep(0.5,0.0,abs(q.x))*0.5; gl_FragColor = vec4(vC*a, a); }` }));
    m.frustumCulled = false; m.userData.follow = true; scene.add(m); W.stars = m;
  }
  // planets
  {
    const gas = planetMesh(260, 'gas', { c1: 0xffd9a0, c2: 0xd9894a, c3: 0xfff2d8, atm: 0xffb070 }); gas.position.set(-760, 60, -980); group.add(gas);
    const ring = ringMesh(330, 560); ring.position.copy(gas.position); ring.rotation.set(-1.25, 0.25, 0.35); group.add(ring);
    const earth = planetMesh(200, 'earth', { c1: 0x46c85a, c2: 0x1e62d8, atm: 0x6ad0ff }); earth.position.set(900, -260, 420); group.add(earth);
    const moon = planetMesh(70, 'moon', { c1: 0xd8c8ff, c2: 0x8a78b8, c3: 0x5a4a88, atm: 0xc8a8ff }); moon.position.set(420, 330, -700); group.add(moon);
    const red = planetMesh(45, 'moon', { c1: 0xff9a6a, c2: 0xb8483a, c3: 0x6a2a2a, atm: 0xff7050 }); red.position.set(-420, -160, 520); group.add(red);
    W.animated.push(t => { gas.rotation.y = t * 0.01; moon.rotation.y = t * 0.02; });
    // distant sun glow
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vUv; void main(){ vec2 q = vUv - 0.5; float d = length(q); float a = exp(-d*9.0)*1.5 + smoothstep(0.035, 0.0, d)*8.0; a += smoothstep(0.012,0.0,abs(q.y))*exp(-abs(q.x)*6.0)*1.5 + smoothstep(0.012,0.0,abs(q.x))*exp(-abs(q.y)*6.0)*1.5; gl_FragColor = vec4(vec3(1.0,0.9,0.75)*a, 1.0); }` }));
    sg.scale.setScalar(900); sg.position.copy(V3(0.6, 0.5, 0.6).normalize().multiplyScalar(1900)); sg.userData.billboard = true; group.add(sg); W.sunGlow = sg;
    // spiral galaxy billboard
    const cv = makeCanvas(512, 512), g = cv.getContext('2d'); g.translate(256, 256);
    for (let i = 0; i < 5000; i++) { const arm = i % 2, t = rand(0, 1), a = t * 9 + arm * Math.PI + rand(-0.35, 0.35), r = t * 230 + rand(-12, 12); const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.45; g.fillStyle = `hsla(${250 + t * 90},90%,${70 + rand(0, 25)}%,${0.25 + (1 - t) * 0.5})`; g.fillRect(x, y, 2, 2); }
    const core = g.createRadialGradient(0, 0, 0, 0, 0, 90); core.addColorStop(0, 'rgba(255,240,220,1)'); core.addColorStop(1, 'rgba(255,200,255,0)'); g.fillStyle = core; g.fillRect(-256, -256, 512, 512);
    const gal = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshBasicMaterial({ map: canvasTex(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: COL(0xffffff).multiplyScalar(1.4) }));
    gal.position.set(800, 520, -1500); gal.lookAt(0, 100, 0); gal.rotateZ(0.5); group.add(gal);
  }
  // lights
  const hemi = new THREE.HemisphereLight(0xa99cff, 0x3a2266, 0.75); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0f8, 2.4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 400; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target); W.sun = sun; W.sunDir = V3(0.6, 0.5, 0.6).normalize();
  // ---------------- the rainbow road ----------------
  const roadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.18, metalness: 0.0, transparent: true, opacity: 0.86 });
  roadMat.defines = { USE_UV: '' };
  roadMat.onBeforeCompile = sh => {
    sh.uniforms.uTime = TIME_U;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nuniform float uTime; ${HSV_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 rb = kpHsv(vec3(fract(vUv.x*0.86 + 0.0), 0.9, 1.0));
        diffuseColor.rgb = rb*0.16;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float along = vUv.y;
          float sh1 = 0.5 + 0.5*sin(along*0.22 - uTime*5.0 + vUv.x*2.5);
          float sh2 = smoothstep(0.92, 1.0, sin(along*0.05 - uTime*2.2));
          vec3 em = rb*(0.55 + 0.75*sh1) + rb*sh2*0.9;
          vec2 gc = vec2(vUv.x*60.0, along*2.4); vec2 id = floor(gc); float h = fract(sin(dot(id, vec2(12.9898,78.233)))*43758.5453);
          float tw = 0.5 + 0.5*sin(uTime*7.0 + h*50.0); em += mix(vec3(1.0), rb, 0.4)*step(0.93, h)*smoothstep(0.3, 0.0, length(fract(gc) - 0.5))*tw*3.0;
          float e = min(vUv.x, 1.0 - vUv.x); em += vec3(1.0, 0.95, 1.0)*smoothstep(0.03, 0.0, e)*3.0;
          float ln = abs(fract(vUv.x*7.0) - 0.5); em *= 0.8 + 0.2*smoothstep(0.0, 0.05, 0.5 - ln);
          totalEmissiveRadiance += em*1.05; }`);
  };
  roadMat.customProgramCacheKey = () => 'rainbowroad';
  const roadGeo = track.ribbon(0, track.n, i => { const w = track.hw[i]; const a = []; for (let c = 0; c < 9; c++) a.push([-w + 2 * w * c / 8, 0.03]); return a; }, { uAcross: true, vScale: 1 });
  // cut the gap out
  { const idx = roadGeo.index.array, keep = []; const cols = 9;
    for (let q = 0; q < idx.length; q += 3) { const r = Math.floor(idx[q] / cols); const i = track.wrap(r); if ((track.flags[i] & F_GAP) || (track.flags[track.wrap(i + 1)] & F_GAP)) continue; keep.push(idx[q], idx[q + 1], idx[q + 2]); }
    roadGeo.setIndex(keep); }
  const road = new THREE.Mesh(roadGeo, roadMat); road.receiveShadow = true; road.renderOrder = 2; group.add(road); W.road = road;
  // glowing underside + edge glow
  const underMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uTime: TIME_U },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv; ${HSV_GLSL} void main(){ vec3 c = kpHsv(vec3(fract(vUv.x*0.86), 0.8, 1.0)); float a = 0.35*(0.6 + 0.4*sin(vUv.y*0.3 - uTime*4.0)); a *= smoothstep(0.0, 0.25, vUv.x)*smoothstep(1.0, 0.75, vUv.x); gl_FragColor = vec4(c*a*1.6, a); }` });
  const under = track.ribbon(0, track.n, i => { const w = track.hw[i] + 1.5; return [[-w, -0.6], [0, -1.1], [w, -0.6]]; }, { uAcross: true, vScale: 1 });
  { const idx = under.index.array, keep = []; for (let q = 0; q < idx.length; q += 3) { const i = track.wrap(Math.floor(idx[q] / 3)); if ((track.flags[i] & F_GAP) || (track.flags[track.wrap(i + 1)] & F_GAP)) continue; keep.push(idx[q], idx[q + 1], idx[q + 2]); } under.setIndex(keep); }
  const um = new THREE.Mesh(under, underMat); um.renderOrder = 3; group.add(um);
  // slab sides (thin glowing edges)
  const sideGeo = track.skirtGeo(i => !(track.flags[i] & F_GAP) && !(track.flags[track.wrap(i + 1)] & F_GAP), (i, s, y) => y - 0.55, 'road');
  if (sideGeo) { const col = new Float32Array(sideGeo.attributes.position.count * 3); const c = new THREE.Color(); for (let k = 0; k < sideGeo.attributes.position.count; k++) { c.setHSL((k * 0.0007) % 1, 1, 0.6).multiplyScalar(2.2); col.set([c.r, c.g, c.b], k * 3); } sideGeo.setAttribute('color', new THREE.BufferAttribute(col, 3)); group.add(new THREE.Mesh(sideGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }))); }
  // antigrav cyan edge strips
  { const rs = track.runs(i => (track.flags[i] & F_AGRAV) > 0); const list = [];
    for (const [s, l] of rs) { list.push(track.ribbon(s, l, i => [[-track.hw[i] + 0.2, 0.06], [-track.hw[i] + 0.9, 0.06]])); list.push(track.ribbon(s, l, i => [[track.hw[i] - 0.9, 0.06], [track.hw[i] - 0.2, 0.06]])); }
    if (list.length) { const m = new THREE.Mesh(track.merge(list), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: TIME_U }, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`, fragmentShader: `uniform float uTime; varying vec2 vUv; void main(){ float p = 0.55 + 0.45*sin(vUv.y*1.2 - uTime*12.0); gl_FragColor = vec4(vec3(0.3,1.6,3.2)*p, 1.0); }` })); m.renderOrder = 4; group.add(m); } }
  // neon rails + posts
  {
    const tube = []; for (let k = 0; k <= 8; k++) { const a = k / 8 * TAU; tube.push([0.35 + Math.cos(a) * 0.17, 0.95 + Math.sin(a) * 0.17]); }
    const g = track.barrierGeo('neon', tube, (i, c, r, side) => { const col = new THREE.Color(); if (track.flags[i] & F_AGRAV) col.setRGB(0.4, 2.2, 3.6); else col.setHSL(((i * track.ds) / 160) % 1, 1, 0.62).multiplyScalar(2.6); return col; });
    if (g) group.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    const posts = []; for (let i = 0; i < track.n; i += 6) for (const side of [-1, 1]) { const st = side < 0 ? track.barStyleL[i] : track.barStyleR[i]; if (st !== 'neon') continue; posts.push([track.point(i, side < 0 ? track.edgeL(i) - 0.35 : track.edgeR(i) + 0.35, 0.5, V3()), track.N(i, V3())]); }
    const pg = new THREE.CylinderGeometry(0.07, 0.07, 1, 6);
    const pm = new THREE.InstancedMesh(pg, new THREE.MeshBasicMaterial({ color: COL(0xffffff).multiplyScalar(1.6) }), posts.length);
    posts.forEach(([p, n], k) => { const q = new THREE.Quaternion().setFromUnitVectors(UP, n); pm.setMatrixAt(k, new THREE.Matrix4().compose(p, q, V3(1, 1, 1))); }); group.add(pm);
    const sg = new THREE.ExtrudeGeometry(starShape(0.42, 0.18), { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 }); sg.center();
    const sm = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ color: COL(0xffe36a).multiplyScalar(3) }), posts.length);
    posts.forEach(([p, n], k) => { const q = new THREE.Quaternion().setFromUnitVectors(UP, n); const pp = p.clone().addScaledVector(n, 1.35); sm.setMatrixAt(k, new THREE.Matrix4().compose(pp, q, V3(1, 1, 1))); }); group.add(sm);
    W.animated.push(t => { sm.rotation.set(0, 0, 0); });
  }
  // neon arches over the track
  {
    const arcs = []; for (let i = 30; i < track.n; i += 70) { if (track.flags[i] & (F_LOOP | F_GAP)) continue; arcs.push(i); }
    const ag = new THREE.TorusGeometry(1, 0.035, 8, 48, Math.PI);
    const am = new THREE.InstancedMesh(ag, new THREE.MeshBasicMaterial({ color: 0xffffff }), arcs.length);
    arcs.forEach((i, k) => { const f = track.frame(i, 0, { P: V3(), T: V3(), N: V3(), B: V3() }); const r = track.hw[i] + 2.5; const m = new THREE.Matrix4().makeBasis(f.B, f.N, f.T.clone().negate()); m.scale(V3(r, r * 0.8, r)); m.setPosition(f.P); am.setMatrixAt(k, m); am.setColorAt(k, COL(0xffffff).setHSL((k * 0.13) % 1, 1, 0.6).multiplyScalar(3)); });
    group.add(am);
  }
  // power star statue + floating star bits + asteroids
  {
    const sg = new THREE.ExtrudeGeometry(starShape(9, 4), { depth: 3.5, bevelEnabled: true, bevelThickness: 1.4, bevelSize: 1.2, bevelSegments: 4, curveSegments: 4 }); sg.center();
    const star = new THREE.Mesh(sg, stdMat({ color: 0xffd21a, emissive: 0xffa800, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.3 }, { rim: 1.2, rimColor: 0xfff6c0 }));
    const eyes = new GB(); for (const s of [-1, 1]) { eyes.sphere(0.9, 0x1a1030, s * 1.8, 1.2, 2.7, 0.7, 1.4, 0.4); eyes.sphere(0.25, 0xffffff, s * 1.8 + 0.2, 1.8, 3.0); }
    star.add(new THREE.Mesh(eyes.build(), new THREE.MeshBasicMaterial({ vertexColors: true })));
    star.position.set(95, 130, -62); group.add(star);
    W.animated.push(t => { star.rotation.y = t * 0.7; star.position.y = 130 + Math.sin(t * 1.3) * 2.5; });
    const bits = []; for (let k = 0; k < 260; k++) { const i = randi(0, track.n - 1); const p = track.point(i, rand(-60, 60), rand(-40, 45), V3()); if (Math.abs(p.clone().sub(track.P(i, V3())).dot(track.B(i, V3()))) < track.hw[i] + 6 && Math.abs(p.y - track.py[i]) < 12) continue; bits.push({ p, r: rand(0, 6), s: rand(0.5, 1.6), sp: rand(0.5, 2) }); }
    const bg = new THREE.ExtrudeGeometry(starShape(1, 0.45), { depth: 0.3, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.1, bevelSegments: 1 }); bg.center();
    const bm = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ color: 0xffffff }), bits.length);
    bits.forEach((b, k) => bm.setColorAt(k, COL(0xffffff).setHSL(rand(0, 1), 1, 0.65).multiplyScalar(2.5)));
    W.animated.push(t => { bits.forEach((b, k) => bm.setMatrixAt(k, M4(b.p.x, b.p.y + Math.sin(t * b.sp + b.r) * 1.2, b.p.z, 0, t * b.sp + b.r, 0.3, b.s))); bm.instanceMatrix.needsUpdate = true; });
    group.add(bm);
    const rocks = []; for (let k = 0; k < 40; k++) { const a = rand(0, TAU), d = rand(350, 900); rocks.push([Math.cos(a) * d, rand(-150, 260), Math.sin(a) * d - 80, rand(6, 22)]); }
    const rg = rockGeo(33); const rc = rg.attributes.color; for (let k = 0; k < rc.count; k++) rc.setXYZ(k, 0.42 + rc.getX(k) * 0.2, 0.36 + rc.getY(k) * 0.1, 0.55 + rc.getZ(k) * 0.2);
    const rm = new THREE.InstancedMesh(rg, stdMat({ vertexColors: true, roughness: 0.8 }, { rim: 0.6, rimColor: 0xb08aff }), rocks.length);
    W.animated.push(t => { rocks.forEach(([x, y, z, s], k) => rm.setMatrixAt(k, M4(x, y + Math.sin(t * 0.2 + k) * 4, z, t * 0.05 + k, t * 0.03 + k * 2, 0, s))); rm.instanceMatrix.needsUpdate = true; });
    group.add(rm);
  }
  // shooting stars
  {
    const n = 6, meshes = [];
    const g = new THREE.PlaneGeometry(1, 1); g.translate(0.5, 0, 0);
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vUv; void main(){ float a = pow(vUv.x, 3.0)*smoothstep(0.5, 0.0, abs(vUv.y - 0.5)); gl_FragColor = vec4(vec3(1.0, 0.9, 1.0)*a*4.0, a); }` });
    for (let k = 0; k < n; k++) { const m = new THREE.Mesh(g, mat); m.visible = false; m.userData = { t: -rand(0, 6) }; group.add(m); meshes.push(m); }
    W.animated.push((t, dt) => {
      for (const m of meshes) {
        const u = m.userData; u.t += dt;
        if (u.t < 0) { m.visible = false; continue; }
        if (!u.from) { const a = rand(0, TAU); u.from = V3(Math.cos(a) * 900, rand(250, 700), Math.sin(a) * 900 - 100); u.dir = V3(rand(-1, 1), rand(-0.6, -0.2), rand(-1, 1)).normalize(); u.len = rand(60, 140); u.dur = rand(0.8, 1.6); }
        const p = u.t / u.dur; if (p > 1) { u.t = -rand(1, 5); u.from = null; m.visible = false; continue; }
        m.visible = true; const pos = u.from.clone().addScaledVector(u.dir, p * 700); m.position.copy(pos);
        m.quaternion.setFromUnitVectors(V3(1, 0, 0), u.dir); m.scale.set(u.len, 3.5 * Math.sin(p * Math.PI) + 0.5, 1);
        m.lookAt(camera.position); m.quaternion.setFromUnitVectors(V3(1, 0, 0), u.dir.clone().negate());
        const toCam = camera.position.clone().sub(pos).normalize(); const side = new THREE.Vector3().crossVectors(u.dir, toCam).normalize(); const nrm = new THREE.Vector3().crossVectors(side, u.dir.clone().negate());
        m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u.dir.clone().negate(), side, nrm));
      }
    });
  }
  // environment capture for glossy reflections (nebula colours on the karts)
  const cap = captureEnv(scene, V3(0, 120, -80), [], 256);
  scene.environment = cap.env; W.envCube = cap.cube;
  W.ambient = (dt, cam) => { if (Math.random() < dt * 10) FX.sparkle(_tv[5].set(cam.x + rand(-30, 30), cam.y + rand(-8, 12), cam.z + rand(-30, 30)), COL(0xffffff).setHSL(rand(0, 1), 1, 0.7).multiplyScalar(2.5), 1, 0); };
  W.fallY = null;
  W.intro = [
    [V3(320, 190, 220), V3(0, 110, -80)], [V3(140, 140, -110), V3(80, 121, -172)], [V3(-40, 130, -150), V3(-95, 125, -190)],
    [V3(-150, 150, -130), V3(-165, 90, -160)], [V3(-250, 100, 40), V3(-150, 80, 30)], [V3(-40, 108, 10), V3(40, 100, 0)], [V3(-6, 103, 2), V3(60, 100, 0)],
  ];
  W.minimapBg = '#8a4dff';
  W.update = (t, dt) => { for (const f of W.animated) f(t, dt); if (W.sunGlow) W.sunGlow.quaternion.copy(camera.quaternion); };
  return W;
}


