// 00_ach.js (Kart Party Deluxe) — succès (101). Stockés comme compteurs : Save.data.stats['ach_<id>'], donc aucun nouveau format de sauvegarde.
export const ACH = [
  { id: 'first', n: 'First finish', d: 'Finish a race' },
  { id: 'win', n: 'Number one', d: 'Win a race' },
  { id: 'ten', n: 'Regular', d: 'Finish 10 races' },
  { id: 'perfect', n: 'Spotless lap', d: 'Complete a lap with no collision' },
  { id: 'shield', n: 'Banana armor', d: 'Block a hit with the banana shield' },
];
export const has = (save, id) => !!save.data.stats['ach_' + id];
// Débloque un succès : true seulement la première fois (et seulement pour un id connu).
export function award(save, id) { if (has(save, id) || !ACH.some((a) => a.id === id)) return false; save.bump('ach_' + id); return true; }
