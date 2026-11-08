// 00_rng.js (Kart Party Deluxe)
// Deux flux aléatoires bien séparés :
//  - rand / randi / pick (01_core) : décor et effets visuels, jamais rejoués.
//  - grand / grandi (ici) : GAMEPLAY (objets, IA, départ). Réinitialisé par setSeed() à chaque course.
// Le cosmétique appelle rand() à la cadence du rendu : il ne doit jamais toucher ce flux-ci.
export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let seed = 20260926, grng = mulberry32(seed);
export function setSeed(s) { seed = s >>> 0; grng = mulberry32(seed); return seed; }
export const getSeed = () => seed;
export const grand = (a = 0, b = 1) => a + (b - a) * grng();
export const grandi = (a, b) => Math.floor(grand(a, b + 1));
