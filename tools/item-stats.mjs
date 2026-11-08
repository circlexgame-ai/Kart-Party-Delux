// Affiche la table de probabilités des objets et une simulation (npm run item-stats). Utile pour équilibrer à partir de chiffres.
import { ITEMS, ITEM_TABLE } from '../js/00_itemtable.js';
import { setSeed, grand } from '../js/00_rng.js';
const N = 20000; setSeed(1);
console.log('place  ' + ITEMS.map((s) => s.slice(0, 7).padEnd(8)).join(''));
ITEM_TABLE.forEach((row, p) => {
  const c = new Array(8).fill(0);
  for (let i = 0; i < N; i++) { let r = grand(0, 100), j = 0; for (; j < 7; j++) { r -= row[j]; if (r <= 0) break; } c[j]++; }
  console.log(String(p + 1).padEnd(7) + c.map((n) => ((n / N) * 100).toFixed(1).padEnd(8)).join(''));
});
