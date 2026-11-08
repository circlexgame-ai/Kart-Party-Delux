// 00_binds.js (Kart Party Deluxe) — touches remappables (81). Module pur, testé dans tests/unit.mjs.
// Chaque action a 2 emplacements. Une touche déjà prise par une autre action est ÉCHANGÉE, jamais dupliquée.
export const REMAP = ['accel', 'brake', 'left', 'right', 'drift', 'item'];
export const DEFAULT_SLOTS = {
  accel: ['KeyW', 'ArrowUp'], brake: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'], drift: ['ShiftLeft', 'Space'], item: ['KeyE', 'KeyX'],
};
// Touches fixes du jeu : refusées au remappage (Échap annule la saisie).
const FIXED = new Set(['Escape', 'Enter', 'NumpadEnter', 'Backspace', 'Tab', 'KeyT', 'KeyF', 'KeyH', 'KeyP', 'KeyC', 'KeyN']);
export const isReserved = (code) => FIXED.has(code) || /^F\d{1,2}$/.test(code);

export function createBinds(saved) {
  const slots = {}, custom = new Set();
  const ok = (s) => Array.isArray(s) && s.length === 2 && s.every((c) => typeof c === 'string' && c && !isReserved(c));
  for (const a of REMAP) { const s = saved && saved[a]; if (ok(s)) { slots[a] = [...s]; custom.add(a); } else slots[a] = [...DEFAULT_SLOTS[a]]; }
  const all = REMAP.flatMap((a) => slots[a]);
  if (new Set(all).size !== all.length) { for (const a of REMAP) slots[a] = [...DEFAULT_SLOTS[a]]; custom.clear(); }   // sauvegarde incohérente : retour aux défauts
  return {
    slots,
    isCustom: (a) => custom.has(a),
    // Assigne `code` à l'emplacement i de l'action a. Retourne false si la touche est réservée.
    set(a, i, code) {
      if (isReserved(code) || !REMAP.includes(a)) return false;
      const old = slots[a][i];
      for (const b of REMAP) for (let j = 0; j < 2; j++) if (slots[b][j] === code && !(b === a && j === i)) { slots[b][j] = old; custom.add(b); }
      slots[a][i] = code; custom.add(a); return true;
    },
    reset() { for (const a of REMAP) slots[a] = [...DEFAULT_SLOTS[a]]; custom.clear(); },
    // Uniquement les actions modifiées : ce qui part dans la sauvegarde.
    export() { const o = {}; for (const a of custom) o[a] = [...slots[a]]; return o; },
  };
}
