// 00_cup.js (Kart Party Deluxe) — logique pure du tournoi (4 courses, points par place). Testée dans tests/unit.mjs.
export const CUP_RACES = 4;
export const CUP_POINTS = [10, 8, 6, 5, 4, 3, 2, 1];

// Les pistes alternent à partir de celle choisie : A B A B pour deux pistes.
export function newCup(firstTrack, trackCount) {
  return { race: 1, tracks: Array.from({ length: CUP_RACES }, (_, i) => (firstTrack + i) % trackCount), pts: {}, last: {} };
}
export const cupDone = (c) => c.race >= CUP_RACES;

// names : noms des pilotes dans l'ordre d'arrivée de la course qui vient de se terminer.
export function addRace(c, names) {
  names.forEach((n, i) => { c.pts[n] = (c.pts[n] || 0) + (CUP_POINTS[i] || 0); c.last[n] = i + 1; });
}
// Classement : points décroissants ; à égalité, la meilleure place sur la dernière course.
export function cupStandings(c) {
  return Object.keys(c.pts).map((name) => ({ name, pts: c.pts[name], last: c.last[name] || 99 })).sort((a, b) => b.pts - a.pts || a.last - b.last);
}
