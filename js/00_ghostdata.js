// 00_ghostdata.js (Kart Party Deluxe) — validation pure des données de fantôme (testable sans navigateur).
export const GHOST_W = 7;   // x y z + quaternion
export function validGhost(g) { return !!g && Array.isArray(g.s) && g.s.length >= 2 * GHOST_W && g.s.length % GHOST_W === 0 && g.s.every(Number.isFinite); }
