// 00_save.js (Kart Party Deluxe)
// Sauvegarde versionnée : une seule clé localStorage, un numéro de version, des migrations automatiques.
// Pour changer le format : incrémenter SAVE_VERSION et AJOUTER une fonction à MIGRATIONS (jamais modifier une ancienne).
export const SAVE_KEY = 'kp_save';
export const SAVE_VERSION = 2;
const LEGACY_PREFS_KEY = 'kp_prefs';   // format d'avant la v0.5.0 : réglages seuls, sans enveloppe

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

// MIGRATIONS[i] transforme une sauvegarde de version i en version i+1.
const MIGRATIONS = [
  (d) => ({ ...d, prefs: isObj(d.prefs) ? d.prefs : {}, bests: isObj(d.bests) ? d.bests : {}, stats: isObj(d.stats) ? d.stats : {} }),
  (d) => ({ ...d, binds: isObj(d.binds) ? d.binds : {}, seen: typeof d.seen === 'string' ? d.seen : '' }),   // v2 : touches remappées, dernière version vue (écran Nouveautés)
];

export function migrate(input) {
  let d = isObj(input) ? input : { v: 0 };
  if (!Number.isInteger(d.v) || d.v < 0) d = { ...d, v: 0 };
  while (d.v < SAVE_VERSION) { const from = d.v; d = { ...MIGRATIONS[from](d), v: from + 1 }; }
  return d;   // une sauvegarde plus récente que ce code est conservée telle quelle
}

export function createSave(storage = globalThis.localStorage) {
  const get = (k) => { try { return storage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { storage.setItem(k, v); return true; } catch (e) { return false; } };
  let raw = get(SAVE_KEY), d = null;
  if (raw != null) {
    try { d = JSON.parse(raw); } catch (e) { set(SAVE_KEY + '_corrupt', raw); d = null; }   // copie de secours, repart à neuf
  } else {
    try { const old = JSON.parse(get(LEGACY_PREFS_KEY) || 'null'); if (isObj(old)) d = { v: 0, prefs: old }; } catch (e) { d = null; }
  }
  const Save = {
    data: migrate(d),
    flush() { return set(SAVE_KEY, JSON.stringify(Save.data)); },
    best(trackId) { const b = Save.data.bests[trackId]; return b && Number.isFinite(b.time) ? b : null; },
    // Retourne true si c'est un nouveau record (ou le premier temps) pour cette piste.
    recordBest(trackId, time, who = '') {
      if (!Number.isFinite(time) || time <= 0) return false;
      const b = Save.best(trackId); if (b && b.time <= time) return false;
      Save.data.bests[trackId] = { time, who, at: Date.now() }; Save.flush(); return true;
    },
    bump(stat, n = 1) { Save.data.stats[stat] = (Save.data.stats[stat] || 0) + n; Save.flush(); },
  };
  return Save;
}
export const Save = createSave();
