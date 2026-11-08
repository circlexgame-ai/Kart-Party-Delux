// 12_ghost.js (Kart Party Deluxe)
// Fantôme du meilleur tour : enregistre la position et l'orientation du joueur 10 fois par seconde,
// garde la course du record dans la sauvegarde, la rejoue en transparence. Basé sur des positions, pas sur des entrées :
// il reste valable même si la physique ou l'aléatoire changent.
import * as THREE from 'three';
import { GHOST_W, validGhost } from './00_ghostdata.js';
import { Save } from './00_save.js';
import { Prefs } from './01_core.js';
import { KartVisual } from './08_chars.js';

const STEP = 0.1, W = GHOST_W;
const _q0 = new THREE.Quaternion(), _q1 = new THREE.Quaternion();
const r2 = (x) => Math.round(x * 100) / 100, r3 = (x) => Math.round(x * 1000) / 1000;

export const Ghost = {
  rec: [], play: null, mesh: null,
  prepare(scene, trackId, def) {
    this.rec = [];
    const g = Save.data.ghosts && Save.data.ghosts[trackId];
    this.play = validGhost(g) ? g : null;
    this.dispose();
    // vrai kart du joueur, rendu en transparence teintée (matériaux de remplacement, géométrie propre au fantôme)
    const vis = new KartVisual(def), m = new THREE.Group(); m.add(vis.root);
    vis.root.traverse((o) => {
      if (o.isSprite || o === vis.blob) { o.visible = false; return; }
      if (!o.isMesh) return;
      o.castShadow = false; o.receiveShadow = false; o.renderOrder = 5;
      const mat = new THREE.MeshBasicMaterial({ vertexColors: !!o.geometry.attributes.color, transparent: true, opacity: 0.45, depthWrite: false });
      // teinte unique bleu glace : on garde la luminosité des couleurs d'origine pour conserver le relief du kart
      mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = vec3(0.42, 0.85, 1.0) * (0.45 + 1.1 * dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)));'); };
      o.material = mat;
    });
    vis.flames.forEach((f) => { f.visible = false; });
    m.visible = false; m.renderOrder = 5; scene.add(m); this.mesh = m;
  },
  dispose() {
    const m = this.mesh; if (!m) return;
    if (m.parent) m.parent.remove(m);
    m.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    this.mesh = null;
  },
  sample(kart, t) {
    if (t < this.rec.length / W * STEP) return;
    const p = kart.pos, q = kart.q;
    this.rec.push(r2(p.x), r2(p.y), r2(p.z), r3(q.x), r3(q.y), r3(q.z), r3(q.w));
  },
  update(t, on) {
    const m = this.mesh, d = this.play; if (!m) return;
    if (!on || !d || !Prefs.ghost) { m.visible = false; return; }
    const s = d.s, n = s.length / W, f = Math.max(0, t) / STEP, i = Math.floor(f);
    if (i >= n - 1) { m.visible = false; return; }
    const a = i * W, b = a + W, u = f - i;
    m.position.set(s[a] + (s[b] - s[a]) * u, s[a + 1] + (s[b + 1] - s[a + 1]) * u, s[a + 2] + (s[b + 2] - s[a + 2]) * u);
    _q0.set(s[a + 3], s[a + 4], s[a + 5], s[a + 6]); _q1.set(s[b + 3], s[b + 4], s[b + 5], s[b + 6]);
    m.quaternion.copy(_q0.slerp(_q1, u)); m.visible = true;
  },
  commit(trackId, time) {
    if (this.rec.length < 2 * W) return;
    (Save.data.ghosts ||= {})[trackId] = { time, s: this.rec.slice() };
    if (!Save.flush()) delete Save.data.ghosts[trackId];   // quota dépassé : pas de fantôme plutôt qu'une sauvegarde incohérente
  },
};
