// 01_core.js (Kart Party Deluxe)
import { late } from './00_registry.js';
import { Save } from './00_save.js';
import { REMAP, createBinds } from './00_binds.js';
import { mulberry32 } from './00_rng.js';
export { grand, grandi, mulberry32, setSeed, getSeed } from './00_rng.js';
import * as THREE from 'three';

// ============================================================================
// CORE — math helpers, noise, input, renderer, post-processing
// ============================================================================
export const TAU = Math.PI * 2;
export const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
export const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
export let rng = mulberry32(20260926);
export const rand = (a = 0, b = 1) => a + (b - a) * rng();
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = arr => arr[Math.floor(rng() * arr.length)];
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const COL = c => new THREE.Color(c);
export const UP = new THREE.Vector3(0, 1, 0);

// ---- value noise (CPU) ----
export function hash2(x, y) { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, oct = 4) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); n += a; a *= 0.5; f *= 2.03; } return s / n; }
// tileable noise for textures
function tnoise(x, y, p) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const m = k => ((k % p) + p) % p;
  const a = hash2(m(xi), m(yi)), b = hash2(m(xi + 1), m(yi)), c = hash2(m(xi), m(yi + 1)), d = hash2(m(xi + 1), m(yi + 1));
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function tfbm(x, y, p, oct = 4) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * tnoise(x * f, y * f, p * f); n += a; a *= 0.5; f *= 2; } return s / n; }

// ---- canvas helpers ----
export function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function canvasTex(cv, { repeat = false, srgb = true, aniso = 8, mips = true } = {}) {
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso; t.generateMipmaps = mips;
  if (!mips) t.minFilter = THREE.LinearFilter;
  return t;
}
// shared tileable noise texture (RGBA = 4 independent octave sets) for shaders
export const NOISE_TEX = (() => {
  const S = 256, data = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    data[i] = tfbm(x / 32, y / 32, 8, 4) * 255;
    data[i + 1] = tfbm(x / 16 + 17, y / 16 + 3, 16, 3) * 255;
    data[i + 2] = tfbm(x / 64 + 5, y / 64 + 9, 4, 5) * 255;
    data[i + 3] = tnoise(x / 4, y / 4, 64) * 255;
  }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true;
  return t;
})();

// ============================================================================
// PREFS — réglages de conduite mémorisés (localStorage, tolérant aux erreurs)
// ============================================================================
const PREF_DEF = { steerSens: 1, steerSmooth: 0.5, padDead: 0.18, padCurve: 1.4, weight: 0, difficulty: 1, ghost: 1, cup: 0, trial: 0, noItems: 0, mode: 0, laps: 3, fov: 0, volMaster: 1, volMusic: 1, volSfx: 1, camDist: 1, speedFx: 1, hudAlpha: 1, bigText: 0, reduceFx: 0, crazy: 0, lastTrack: 0 };
const RANGE = { volMaster: [0, 1], volMusic: [0, 1], volSfx: [0, 1], camDist: [0.8, 1.4], speedFx: [0, 1], hudAlpha: [0.3, 1], bigText: [0, 1], reduceFx: [0, 1], crazy: [0, 1], lastTrack: [0, 9] };
export const Prefs = Object.assign({}, PREF_DEF);
{ const j = Save.data.prefs; for (const k in PREF_DEF) if (typeof j[k] === 'number' && isFinite(j[k])) Prefs[k] = j[k]; Prefs.difficulty = clamp(Math.round(Prefs.difficulty), 0, 3); Prefs.mode = clamp(Math.round(Prefs.mode), 0, 4); Prefs.fov = clamp(Math.round(Prefs.fov), -10, 15); if (![1, 3, 5, 10].includes(Prefs.laps)) Prefs.laps = 3; for (const k in RANGE) Prefs[k] = clamp(Prefs[k], RANGE[k][0], RANGE[k][1]); }
export function savePrefs() { Save.data.prefs = { ...Prefs }; Save.flush(); }
export function resetPrefs() { Object.assign(Prefs, PREF_DEF); savePrefs(); }

// ============================================================================
// INPUT
// ============================================================================
export const Input = (() => {
  const held = new Set(), tapped = new Set();
  const B = createBinds(Save.data.binds);
  const ACT = {
    accel: ['KeyW', 'ArrowUp', 'k:w'], brake: ['KeyS', 'ArrowDown', 'k:s'],
    left: ['KeyA', 'ArrowLeft', 'k:a'], right: ['KeyD', 'ArrowRight', 'k:d'],
    drift: ['ShiftLeft', 'ShiftRight', 'Space'], item: ['KeyE', 'KeyX', 'ControlLeft', 'ControlRight', 'k:e', 'k:x'],
    tune: ['KeyT', 'k:t'], pause: ['Escape'], confirm: ['Enter', 'NumpadEnter', 'Space'], back: ['Escape', 'Backspace'],
    up: ['ArrowUp', 'KeyW', 'k:w'], down: ['ArrowDown', 'KeyS', 'k:s'], mleft: ['ArrowLeft', 'KeyA', 'k:a'], mright: ['ArrowRight', 'KeyD', 'k:d'],
    fs: ['KeyF'], hide: ['KeyH'], shot: ['KeyP'], cam: ['KeyC'], news: ['KeyN'],   // touches fixes (non remappables)
  };
  const DEF = {}; for (const a of REMAP) DEF[a] = ACT[a].slice();     // listes d'origine (avec les touches alternatives)
  const applyBinds = () => { for (const a of REMAP) ACT[a] = B.isCustom(a) ? B.slots[a].slice() : DEF[a].slice(); };
  applyBinds();
  let cap = null, mute = null;   // saisie d'une touche (remappage) ; mute = touche qui vient d'être saisie, ignorée jusqu'à son relâchement
  const pad = { accel: false, brake: false, left: false, right: false, drift: false, item: false, pause: false, confirm: false, back: false, up: false, down: false, mleft: false, mright: false, steer: 0 };
  const prev = {}; const cur = {}; let kSteer = 0, lastT = 0;
  const block = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab']);
  addEventListener('keydown', e => {
    if (cap || e.code === mute) { e.preventDefault(); if (cap && !e.repeat) { const f = cap; cap = null; mute = e.code; f(e.code); } return; }
    if (block.has(e.code)) e.preventDefault();
    held.add(e.code); tapped.add(e.code); if (e.key && e.key.length === 1) { held.add('k:' + e.key.toLowerCase()); tapped.add('k:' + e.key.toLowerCase()); }
    if (typeof late.Audio_ !== 'undefined') late.Audio_.unlock();
  }, { passive: false });
  addEventListener('keyup', e => { if (e.code === mute) mute = null; held.delete(e.code); if (e.key && e.key.length === 1) held.delete('k:' + e.key.toLowerCase()); });
  addEventListener('blur', () => { held.clear(); mute = null; });
  addEventListener('pointerdown', () => { if (typeof late.Audio_ !== 'undefined') late.Audio_.unlock(); });
  function pollPad() {
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    const g = gps && [...gps].find(x => x && x.connected);
    for (const k in pad) pad[k] = k === 'steer' ? 0 : false;
    if (!g) return;
    const b = i => !!(g.buttons[i] && g.buttons[i].pressed);
    const ax = g.axes[0] || 0, ay = g.axes[1] || 0;
    { const dz = clamp(Prefs.padDead, 0, 0.6), m = Math.abs(ax); pad.steer = m > dz ? Math.sign(ax) * Math.pow((m - dz) / (1 - dz), Prefs.padCurve) : 0; }
    pad.accel = b(0) || b(7); pad.brake = b(1) || b(2) || b(6); pad.drift = b(5); pad.item = b(4) || b(3);
    pad.pause = b(9); pad.confirm = b(0) || b(9); pad.back = b(1);
    pad.up = b(12) || ay < -0.6; pad.down = b(13) || ay > 0.6; pad.mleft = b(14) || ax < -0.6; pad.mright = b(15) || ax > 0.6;
    pad.left = b(14); pad.right = b(15);
  }
  function raw(a) { const l = ACT[a]; for (let i = 0; i < l.length; i++) if (held.has(l[i]) || tapped.has(l[i])) return true; return held.has('t:' + a) || !!pad[a]; }   // 't:' = boutons tactiles
  return {
    held, pad,
    update() {
      pollPad(); for (const a in ACT) { prev[a] = cur[a] || false; cur[a] = raw(a); } tapped.clear();
      // direction au clavier : la valeur monte progressivement vers ±1 (lissage réglable) et revient plus vite au centre
      const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - (lastT || now)) / 1000)); lastT = now;
      const tgt = (cur.right ? 1 : 0) - (cur.left ? 1 : 0), rate = 16 - 13 * clamp(Prefs.steerSmooth, 0, 1);
      const step = (tgt === 0 || Math.sign(tgt) !== Math.sign(kSteer) ? rate * 1.8 : rate) * dt;
      kSteer = Math.abs(tgt - kSteer) <= step ? tgt : kSteer + Math.sign(tgt - kSteer) * step;
    },
    get: a => !!cur[a],
    edge: a => !!cur[a] && !prev[a],
    steer() { return clamp(clamp(kSteer + pad.steer, -1, 1) * Prefs.steerSens, -1, 1); },
    clear() { held.clear(); tapped.clear(); kSteer = 0; for (const a in ACT) { prev[a] = true; cur[a] = false; } },
    // ---- remappage (81)
    slots: (a) => B.slots[a],
    bind(a, i, code) { if (!B.set(a, i, code)) return false; applyBinds(); Save.data.binds = B.export(); Save.flush(); return true; },
    resetBinds() { B.reset(); applyBinds(); Save.data.binds = {}; Save.flush(); },
    capture(fn) { cap = fn; },
    cancelCapture() { cap = null; },
    get capturing() { return !!cap; },
  };
})();

// Nom affiché d'une touche : la disposition réelle du clavier si le navigateur la donne (AZERTY…), sinon le code.
const KEY_NAMES = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'SPACE', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL', AltLeft: 'L-ALT', AltRight: 'R-ALT', CapsLock: 'CAPS' };
let _layout = null; try { navigator.keyboard.getLayoutMap().then(m => { _layout = m; }).catch(() => { }); } catch (e) { /* API absente (Firefox, Safari, http) : on retombe sur le code */ }
export function keyLabel(code) { return KEY_NAMES[code] || (_layout && _layout.get(code) && _layout.get(code).toUpperCase()) || code.replace(/^Key|^Digit/, '').replace(/^Numpad/, 'NUM '); }

// ============================================================================
// RENDERER + POST
// ============================================================================
const canvas = document.getElementById('c');
export const R = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
R.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
R.toneMapping = THREE.NoToneMapping;
R.outputColorSpace = THREE.LinearSRGBColorSpace;
R.setSize(innerWidth, innerHeight, false);
export const MAX_ANISO = R.capabilities.getMaxAnisotropy();

const FS_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const fsGeo = (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2)); return g; })();

class Post {
  constructor() {
    this.quad = new THREE.Mesh(fsGeo); this.quad.frustumCulled = false;
    this.qscene = new THREE.Scene(); this.qscene.add(this.quad); this.qcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const mk = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: FS_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    const DOWN = `uniform sampler2D tSrc; uniform vec2 texel; uniform float thr; uniform float knee; varying vec2 vUv;
      vec3 s(vec2 o){ return texture2D(tSrc, vUv + o*texel).rgb; }
      void main(){
        vec3 a=s(vec2(-2.,2.)),b=s(vec2(0.,2.)),c=s(vec2(2.,2.)),d=s(vec2(-2.,0.)),e=s(vec2(0.)),f=s(vec2(2.,0.)),g=s(vec2(-2.,-2.)),h=s(vec2(0.,-2.)),i=s(vec2(2.,-2.));
        vec3 j=s(vec2(-1.,1.)),k=s(vec2(1.,1.)),l=s(vec2(-1.,-1.)),m=s(vec2(1.,-1.));
        vec3 col = e*0.125 + (a+c+g+i)*0.03125 + (b+d+f+h)*0.0625 + (j+k+l+m)*0.125;
        if (thr > 0.0) {
          col = min(col, vec3(24.0));
          float br = max(col.r, max(col.g, col.b));
          float sq = clamp(br - thr + knee, 0.0, 2.0*knee); sq = sq*sq/(4.0*knee + 1e-4);
          col *= max(sq, br - thr) / max(br, 1e-4);
        }
        gl_FragColor = vec4(col, 1.0);
      }`;
    const UP = `uniform sampler2D tSrc; uniform sampler2D tAdd; uniform vec2 texel; uniform float scatter; varying vec2 vUv;
      vec3 s(vec2 o){ return texture2D(tSrc, vUv + o*texel).rgb; }
      void main(){
        vec3 up = (s(vec2(-1.,1.)) + s(vec2(1.,1.)) + s(vec2(-1.,-1.)) + s(vec2(1.,-1.)))*0.0625
                + (s(vec2(0.,1.)) + s(vec2(0.,-1.)) + s(vec2(-1.,0.)) + s(vec2(1.,0.)))*0.125 + s(vec2(0.))*0.25;
        gl_FragColor = vec4(texture2D(tAdd, vUv).rgb + up*scatter, 1.0);
      }`;
    this.downMat = mk(DOWN, { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, thr: { value: 0 }, knee: { value: 0.5 } });
    this.upMat = mk(UP, { tSrc: { value: null }, tAdd: { value: null }, texel: { value: new THREE.Vector2() }, scatter: { value: 1.0 } });
    this.heat = []; for (let i = 0; i < 8; i++) this.heat.push(new THREE.Vector4());
    this.comp = mk(`
      uniform sampler2D tScene, tBloom, tBlur, tDepth;
      uniform vec2 res; uniform float time, bloomStr, exposure, radial, speedLines, vignette, chroma, dofStr, dofStart, dofEnd, camNear, camFar, sat, contrast, flash, heatN;
      uniform vec3 tint; uniform vec4 heat[8];
      varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x), f.y); }
      vec3 RRTAndODTFit(vec3 v){ vec3 a = v*(v+0.0245786)-0.000090537; vec3 b = v*(0.983729*v+0.4329510)+0.238081; return a/b; }
      vec3 aces(vec3 c){
        const mat3 I = mat3(vec3(0.59719,0.07600,0.02840), vec3(0.35458,0.90834,0.13383), vec3(0.04823,0.01566,0.83777));
        const mat3 O = mat3(vec3(1.60475,-0.10208,-0.00327), vec3(-0.53108,1.10813,-0.07276), vec3(-0.07367,-0.00605,1.07602));
        c = I*(c/0.6); c = RRTAndODTFit(c); c = O*c; return clamp(c, 0., 1.);
      }
      vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(max(c,vec3(0.)), vec3(1./2.4))-0.055, step(vec3(0.0031308), c)); }
      void main(){
        vec2 uv = vUv; float aspect = res.x/res.y;
        vec2 off = vec2(0.);
        for (int i=0;i<8;i++){ if (float(i) >= heatN) break; vec4 h = heat[i]; vec2 d = (uv - h.xy)*vec2(aspect,1.); float r = length(d);
          float w = smoothstep(h.z, 0.0, r)*h.w;
          off += w*vec2(n2(uv*vec2(46.,28.)+vec2(0.,time*9.))-.5, n2(uv*vec2(38.,34.)-vec2(time*7.,time*3.))-.5); }
        uv += off*0.028;
        vec2 cd = uv - 0.5; float rr = length(cd*vec2(aspect,1.));
        vec3 col;
        float ca = chroma*0.007*rr*rr;
        if (radial > 0.002) {
          vec3 acc = vec3(0.);
          for (int i=0;i<10;i++){ float t = float(i)/9.; float s = 1. - t*radial*0.075;
            acc.r += texture2D(tScene, 0.5 + cd*s*(1.+ca)).r; acc.g += texture2D(tScene, 0.5 + cd*s).g; acc.b += texture2D(tScene, 0.5 + cd*s*(1.-ca)).b; }
          col = acc/10.;
        } else {
          col = vec3(texture2D(tScene, 0.5 + cd*(1.+ca)).r, texture2D(tScene, uv).g, texture2D(tScene, 0.5 + cd*(1.-ca)).b);
        }
        if (dofStr > 0.0) {
          float d = texture2D(tDepth, vUv).x; float ndc = d*2.-1.;
          float z = 2.*camNear*camFar/(camFar+camNear - ndc*(camFar-camNear));
          float f = smoothstep(dofStart, dofEnd, z)*dofStr;
          col = mix(col, texture2D(tBlur, uv).rgb, f);
        }
        col += texture2D(tBloom, uv).rgb*bloomStr;
        if (speedLines > 0.01) {
          float a = atan(cd.y, cd.x*aspect)*(34.0/3.14159265);
          float cell = floor(a); float fr = fract(a);
          float ln = smoothstep(0.34, 0.5, fr)*smoothstep(0.66, 0.5, fr);
          float h1 = hash(vec2(cell, 3.1));
          float act = step(0.62, hash(vec2(cell, floor(time*11. + h1*5.))));
          float rad = smoothstep(0.30 + h1*0.2, 0.95, rr);
          col = mix(col, vec3(1.0,1.0,1.0)*1.4, clamp(ln*act*rad*speedLines*0.75, 0., 1.));
        }
        col *= tint;
        col *= 1.0 - vignette*smoothstep(0.42, 1.25, rr);
        col *= exposure;
        float l = dot(col, vec3(0.2126,0.7152,0.0722));
        col = max(mix(vec3(l), col, sat), 0.);
        col = aces(col);
        col = clamp((col - 0.5)*contrast + 0.5, 0., 1.);
        col = mix(col, vec3(1.), flash);
        col = toSRGB(col);
        col += (hash(vUv*res + fract(time)*37.) - 0.5)/255.;
        gl_FragColor = vec4(col, 1.0);
      }`, {
      tScene: { value: null }, tBloom: { value: null }, tBlur: { value: null }, tDepth: { value: null },
      res: { value: new THREE.Vector2(1, 1) }, time: { value: 0 }, bloomStr: { value: 0.9 }, exposure: { value: 1.0 }, radial: { value: 0 }, speedLines: { value: 0 },
      vignette: { value: 0.35 }, chroma: { value: 0.3 }, dofStr: { value: 0.0 }, dofStart: { value: 160 }, dofEnd: { value: 420 }, camNear: { value: 0.1 }, camFar: { value: 3000 },
      sat: { value: 1.12 }, contrast: { value: 1.04 }, flash: { value: 0 }, heatN: { value: 0 }, heat: { value: this.heat }, tint: { value: new THREE.Vector3(1, 1, 1) },
    });
    this.params = { bloom: 0.22, threshold: 1.25, exposure: 1.0, radial: 0, speedLines: 0, vignette: 0.35, chroma: 0.3, dof: 0.85, dofStart: 140, dofEnd: 480, sat: 1.12, contrast: 1.04, flash: 0, scatter: 0.8 };
    this.rts = []; this.w = 0; this.h = 0; this.samples = 4;
    this.setSize(innerWidth, innerHeight);
  }
  setSize(cw, ch) {
    const pr = R.getPixelRatio(); const w = Math.max(2, Math.floor(cw * pr)), h = Math.max(2, Math.floor(ch * pr));
    if (w === this.w && h === this.h) return; this.w = w; this.h = h;
    for (const rt of this.rts) rt.dispose(); this.rts = [];
    const opts = { type: THREE.HalfFloatType, depthBuffer: false };
    const dt = new THREE.DepthTexture(w, h); dt.type = THREE.UnsignedIntType;
    this.scene = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: this.samples, depthTexture: dt });
    this.rts.push(this.scene);
    this.down = []; this.up = [];
    let bw = w, bh = h;
    for (let i = 0; i < 6; i++) { bw = Math.max(2, bw >> 1); bh = Math.max(2, bh >> 1); const rt = new THREE.WebGLRenderTarget(bw, bh, opts); rt.texture.minFilter = rt.texture.magFilter = THREE.LinearFilter; this.down.push(rt); this.rts.push(rt); }
    for (let i = 0; i < 5; i++) { const d = this.down[i]; const rt = new THREE.WebGLRenderTarget(d.width, d.height, opts); this.up.push(rt); this.rts.push(rt); }
    this.blur1 = new THREE.WebGLRenderTarget(this.down[0].width, this.down[0].height, opts);
    this.blur2 = new THREE.WebGLRenderTarget(this.down[1].width, this.down[1].height, opts);
    this.rts.push(this.blur1, this.blur2);
    this.comp.uniforms.res.value.set(w, h);
  }
  resize(force) { if (force) { this.w = 0; this.h = 0; } this.setSize(innerWidth, innerHeight); }
  pass(mat, target) { this.quad.material = mat; R.setRenderTarget(target); R.render(this.qscene, this.qcam); }
  render(scene, cam, time) {
    const p = this.params, dm = this.downMat, um = this.upMat;
    R.setRenderTarget(this.scene); R.clear(); R.render(scene, cam);
    // bloom chain (sautée quand le bloom est à 0)
    let src = this.scene.texture, sw = this.w, sh = this.h;
    if (p.bloom > 0) for (let i = 0; i < 6; i++) {
      dm.uniforms.tSrc.value = src; dm.uniforms.texel.value.set(1 / sw, 1 / sh); dm.uniforms.thr.value = i === 0 ? p.threshold : 0;
      this.pass(dm, this.down[i]); src = this.down[i].texture; sw = this.down[i].width; sh = this.down[i].height;
    }
    let prev = this.down[5];
    if (p.bloom > 0) for (let i = 4; i >= 0; i--) {
      um.uniforms.tSrc.value = prev.texture; um.uniforms.tAdd.value = this.down[i].texture; um.uniforms.texel.value.set(1 / prev.width, 1 / prev.height); um.uniforms.scatter.value = p.scatter;
      this.pass(um, this.up[i]); prev = this.up[i];
    }
    // dof blur source
    if (p.dof > 0) {
      dm.uniforms.thr.value = 0; dm.uniforms.tSrc.value = this.scene.texture; dm.uniforms.texel.value.set(1 / this.w, 1 / this.h); this.pass(dm, this.blur1);
      dm.uniforms.tSrc.value = this.blur1.texture; dm.uniforms.texel.value.set(1 / this.blur1.width, 1 / this.blur1.height); this.pass(dm, this.blur2);
    }
    const u = this.comp.uniforms;
    u.tScene.value = this.scene.texture; u.tBloom.value = this.up[0].texture; u.tBlur.value = this.blur2.texture; u.tDepth.value = this.scene.depthTexture;
    u.time.value = time; u.bloomStr.value = p.bloom; u.exposure.value = p.exposure; u.radial.value = p.radial; u.speedLines.value = p.speedLines;
    u.vignette.value = p.vignette; u.chroma.value = p.chroma; u.dofStr.value = p.dof; u.dofStart.value = p.dofStart; u.dofEnd.value = p.dofEnd;
    u.camNear.value = cam.near; u.camFar.value = cam.far; u.sat.value = p.sat; u.contrast.value = p.contrast; u.flash.value = p.flash;
    this.pass(this.comp, null);
  }
  setHeat(list) { // list of {x,y,r,s} in uv space
    const n = Math.min(8, list.length);
    for (let i = 0; i < n; i++) this.heat[i].set(list[i].x, list[i].y, list[i].r, list[i].s);
    this.comp.uniforms.heatN.value = n;
  }
}
export const post = new Post();
export const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 3000);
function onResize() {
  R.setSize(innerWidth, innerHeight, false); post.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', onResize);

// ---- DOM helpers ----
export const $ = id => document.getElementById(id);
export function setOL(el, text) { if (typeof el === 'string') el = $(el); if (el.textContent !== text) { el.textContent = text; el.setAttribute('data-t', text); } }
export function showScreen(id, on) { const e = $(id); if (e) e.classList.toggle('show', !!on); }
// ---- écran d'erreur lisible ------------------------------------------------
// Affiche un rapport court (message, fichier:ligne, contexte de jeu) avec des boutons d'action.
// Le jeu est mis en pause logicielle (Game.crashed) pour ne pas répéter l'erreur à chaque image.
let _crashCount = 0, _crashShown = false;
function crashLocation(stack) {
  const m = /(js\/[\w.]+\.js):(\d+)(?::(\d+))?/.exec(stack || '');
  return m ? `${m[1]} ligne ${m[2]}` : 'inconnu';
}
function crashReport(err) {
  const G = late.Game, D = late.Diag, W = typeof KP !== 'undefined' ? KP.World : null;
  const lines = [
    'Kart Party Deluxe — rapport d\'erreur',
    'Erreur : ' + (err.message || err),
    'Emplacement : ' + crashLocation(err.stack),
    'Etat du jeu : ' + (G ? G.state : '?') + ' | piste : ' + (W && W.def ? (W.theme || W.def.name || G.trackIdx) : '?') + ' | temps de course : ' + (G && G.raceTime ? G.raceTime.toFixed(1) + ' s' : '-'),
    'Qualité : ' + (D ? D.qualityName : '?') + ' | échelle de résolution : ' + (D ? D.scale.toFixed(2) : '?'),
    'Navigateur : ' + navigator.userAgent,
    '', String(err.stack || err.message || err),
  ];
  return lines.join('\n');
}
export function fatal(e) {
  const err = e instanceof Error ? e : new Error(String(e && e.message || e));
  console.error(e);
  _crashCount++;
  if (late.Game) late.Game.crashed = true;
  const box = $('errBox'); if (!box) return;
  if (_crashShown) { const n = box.querySelector('.ecount'); if (n) n.textContent = _crashCount > 1 ? `(+${_crashCount - 1} autre(s) erreur(s) depuis)` : ''; return; }
  _crashShown = true;
  const report = crashReport(err);
  box.textContent = '';
  const mk = (tag, cls, txt) => { const x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; };
  box.append(mk('div', 'etitle', 'Oups, le jeu a rencontré une erreur'));
  box.append(mk('div', 'emsg', String(err.message || err)));
  box.append(mk('div', 'eloc', 'Emplacement : ' + crashLocation(err.stack)));
  box.append(mk('div', 'ecount', ''));
  const row = mk('div', 'ebtns');
  const btn = (label, fn) => { const b = mk('button', '', label); b.addEventListener('click', fn); row.append(b); return b; };
  btn('Recharger la page', () => location.reload());
  btn('Retour au menu', () => { hideCrash(); try { late.Game.quitToMenu(); } catch (x) { location.reload(); } });
  btn('Essayer de reprendre', () => hideCrash());
  const cp = btn('Copier le rapport', () => { (navigator.clipboard ? navigator.clipboard.writeText(report) : Promise.reject()).then(() => { cp.textContent = 'Copié ✓'; }, () => { cp.textContent = 'Copie impossible'; }); });
  box.append(row);
  const det = mk('details'); det.append(mk('summary', '', 'Détails techniques')); det.append(mk('pre', '', report)); box.append(det);
  box.style.display = 'block';
}
function hideCrash() { const box = $('errBox'); if (box) { box.style.display = 'none'; box.textContent = ''; } _crashShown = false; _crashCount = 0; if (late.Game) late.Game.crashed = false; if (late.Game) late.Game.paused = false; }
addEventListener('error', e => fatal(e.error || new Error(e.message || 'Erreur inconnue')));
addEventListener('unhandledrejection', e => fatal(e.reason || new Error('Promesse rejetée')));


// Les autres modules ne peuvent pas réassigner un binding importé : ils passent par ce setter.
export function setRng(v) { rng = v; }
