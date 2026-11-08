// 00_bus.js (Kart Party Deluxe)
// Bus d'événements interne : la course émet, le HUD / les records / les futurs succès écoutent.
// Un écouteur qui plante n'interrompt ni l'émetteur ni les autres écouteurs.
export const Bus = {
  _h: Object.create(null),
  on(evt, fn) { (this._h[evt] ||= []).push(fn); return () => this.off(evt, fn); },
  off(evt, fn) { const a = this._h[evt]; if (a) this._h[evt] = a.filter((f) => f !== fn); },
  emit(evt, data) { for (const f of (this._h[evt] || []).slice()) { try { f(data); } catch (e) { console.error('Bus:', evt, e); } } },
};
