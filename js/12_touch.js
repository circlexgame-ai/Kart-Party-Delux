// 12_touch.js (Kart Party Deluxe) — contrôles tactiles (153) : boutons à l'écran qui alimentent Input.held comme un clavier.
// Affichés sur écran tactile (pointer: coarse) ou avec ?touch=1, uniquement pendant la course (ils vivent dans #hud).
import { Input } from './01_core.js';
const BTNS = [   // [libellé, code touche, coin, x, y, taille]  (x, y en px depuis le coin)
  ['◀', 't:left', 'l', 14, 14, 84], ['▶', 't:right', 'l', 112, 14, 84],
  ['GAS', 't:accel', 'r', 14, 14, 104], ['DRIFT', 't:drift', 'r', 128, 14, 72], ['ITEM', 't:item', 'r', 14, 128, 72], ['BRK', 't:brake', 'r', 98, 128, 60],
  ['II', 'Escape', 't', 12, 12, 48],
];
export function initTouch() {
  const hud = document.getElementById('hud');
  if (!hud || !(matchMedia('(pointer:coarse)').matches || /[?&]touch=1/.test(location.search))) return;
  const box = document.createElement('div'); box.id = 'touch'; box.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:6;user-select:none;-webkit-user-select:none;touch-action:none';
  for (const [label, code, corner, x, y, sz] of BTNS) {
    const b = document.createElement('div'); b.textContent = label;
    const pos = corner === 'l' ? `left:${x}px;bottom:${y}px` : corner === 'r' ? `right:${x}px;bottom:${y}px` : `right:${x}px;top:${y}px`;
    b.style.cssText = `position:absolute;${pos};width:${sz}px;height:${sz}px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.22);border:2px solid rgba(255,255,255,.6);color:#fff;font:700 ${sz > 80 ? 22 : 15}px system-ui,sans-serif;pointer-events:auto;touch-action:none`;
    const down = (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignoré */ } Input.held.add(code); b.style.background = 'rgba(255,255,255,.5)'; };
    const up = () => { Input.held.delete(code); b.style.background = 'rgba(255,255,255,.22)'; };
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    box.appendChild(b);
  }
  hud.appendChild(box);
}
