// 12_tuto.js (Kart Party Deluxe) — tutoriel interactif (87) : 4 consignes pendant la première course, chacune validée par le geste attendu.
import { Save } from './00_save.js';
import { Input, keyLabel } from './01_core.js';
const touch = () => matchMedia('(pointer:coarse)').matches || /[?&]touch=1/.test(location.search);
const L = (a) => Input.slots(a).map(keyLabel).join(' ou ');   // touches actuelles (remappage)
const STEPS = [
  { k: () => `Maintiens ${L('accel')} pour accélérer`, b: 'Maintiens GAS pour accélérer', ok: (p) => p.vel.length() > 10 },
  { k: () => `Tourne avec ${L('left')} / ${L('right')}`, b: 'Tourne avec ◀ ▶', ok: (p, s) => s.steerT > 0.6 },
  { k: () => `${L('drift')} + direction : drift !`, b: 'DRIFT + direction : drift !', ok: (p) => p.drift !== 0 },
  { k: () => 'Relâche pour le mini-turbo', b: 'Relâche DRIFT pour le mini-turbo', ok: (p) => p.boostT > 0 },
];
export const Tuto = {
  i: 0, t: 0, steerT: 0, end: 0, active: false, el: null,
  reset() {
    this.active = !(Save.data.stats && Save.data.stats.tuto); this.i = 0; this.t = 0; this.steerT = 0; this.end = 0; this.show('');
  },
  show(txt) {
    if (!this.el) {
      const hud = document.getElementById('hud'); if (!hud) return;
      this.el = document.createElement('div'); this.el.id = 'tuto';
      this.el.style.cssText = 'position:absolute;left:50%;top:22%;transform:translateX(-50%);padding:10px 22px;border-radius:14px;background:rgba(10,20,50,.72);color:#fff;font:700 clamp(16px,2.4vw,26px) system-ui,sans-serif;text-align:center;pointer-events:none;z-index:5';
      hud.appendChild(this.el);
    }
    this.el.style.display = txt ? 'block' : 'none'; this.el.textContent = txt;
  },
  update(dt, p) {
    if (!this.active) return;
    this.t += dt; if (Math.abs(p.input.steer) > 0.5) this.steerT += dt;
    if (this.end) { this.end -= dt; if (this.end <= 0) { this.active = false; this.show(''); } return; }
    const s = STEPS[this.i];
    if (s.ok(p, this)) { this.i++; if (this.i >= STEPS.length) { Save.bump('tuto'); this.show('Bravo ! Bonne course'); this.end = 2.5; return; } }
    if (this.t > 120) { Save.bump('tuto'); this.active = false; this.show(''); return; }   // ne bloque jamais l'écran
    this.show(touch() ? STEPS[this.i].b : STEPS[this.i].k());
  },
};
