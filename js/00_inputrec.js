// 00_inputrec.js (Kart Party Deluxe) — enregistrement des entrées du joueur (116), base des replays et des fantômes par entrées.
// N'écrit qu'aux changements : [temps, gaz, frein, direction, drift, objet]. Avec la graine de course, c'est de quoi rejouer.
export const InputRec = {
  ev: [], last: null, seed: 0, track: '',
  reset(seed, track) { this.ev = []; this.last = null; this.seed = seed; this.track = track; },
  sample(t, i) {
    const s = [i.throttle ? 1 : 0, i.brake ? 1 : 0, Math.round(i.steer * 100) / 100, i.drift ? 1 : 0, i.item ? 1 : 0], l = this.last;
    if (l && s.every((v, j) => v === l[j])) return;
    this.last = s; this.ev.push([Math.round(t * 1000) / 1000, ...s]);
  },
  at(t) { let r = null; for (const e of this.ev) { if (e[0] > t) break; r = e; } return r ? r.slice(1) : [0, 0, 0, 0, 0]; },
  export() { return { seed: this.seed, track: this.track, ev: this.ev.slice() }; },
};
