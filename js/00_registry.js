// Références tardives. Game, UI et Audio_ sont créés dans des modules chargés plus tard ;
// les modules bas niveau les appellent à l'exécution via ce registre, ce qui évite les imports circulaires.
export const late = {};
