# Kart Party Deluxe

Démo de course de karts en Three.js (r170). Tous les meshes, textures et sons sont générés par le code.

## Lancer

Les modules ES sont bloqués par les navigateurs quand on double-clique `index.html` (protocole `file://`).
Il faut un petit serveur local :

- Windows : double-clic sur `serve.bat`
- Mac / Linux : `./serve.sh`
- Autre : `python -m http.server 8000` dans ce dossier, puis http://localhost:8000

Three.js est inclus dans `vendor/` : aucune connexion internet nécessaire.

## Commandes

W / ↑ accélérer · S / ↓ freiner, reculer · A / ← gauche · D / → droite
Maj ou Espace : saut et drift (trick sur une rampe) · E, X ou Ctrl : objet · Échap : pause
T (écran de sélection) : réglages de conduite

## Structure

```
index.html            page et interface (HTML)
css/style.css         styles
vendor/               Three.js r170 (build minifié) et sa licence
js/main.js            point d'entrée, charge les modules dans l'ordre
js/00_registry.js     références tardives (Game, UI, Audio_), évite les imports circulaires
js/01_core.js         utilitaires, bruit, canvas, entrées, rendu de base
js/02_gfx.js          géométries fusionnées, matériaux, textures, ciel, nuages, environnement
js/03_audio.js        synthèse audio (Web Audio)
js/04_track.js        pistes (spline, flags de surface, murs, tunnels, boucles)
js/05_fx.js           particules et effets
js/06_beach.js        circuit plage / royaume champignon
js/07_space.js        Rainbow Road
js/08_chars.js        personnages, karts, nuage de sauvetage
js/09_kart.js         physique, drift, collisions, sauvetage
js/10_items.js        objets
js/11_ai.js           IA
js/12_ui.js           HUD et menus
js/13_game.js         flux du jeu, caméra, boucle principale
js/14_diag.js         compteur de performance, qualité, résolution dynamique, tests automatiques
```

## Outils de diagnostic et de test (lot 1 : fiabilité)

| Touche | Action |
| --- | --- |
| F3 | compteur de performance (FPS, CPU, physique, draw calls, triangles, mémoire, sauvetages) |
| F4 | change le préréglage de qualité : low, medium, high, ultra (mémorisé) |
| F5 | active ou coupe la résolution dynamique (de 100 % à 60 % selon le framerate) |
| F6 | test IA : 8 karts pilotés par l'IA font une course complète sans rendu, rapport en console |
| F7 | test de chutes : 40 téléportations hors piste, le kart doit être récupéré par le nuage |

Options d'URL : `?q=low|medium|high|ultra`, `?dynres=0`, `?perf=1`.
Depuis la console : `KP.Diag.aiTest(0)`, `KP.Diag.fallTest(1)`, `KP.Diag.runAll()` (0 = Sunshine Shores, 1 = Rainbow Road).

Règles dures ajoutées dans la physique : sous-pas de 0,4 m maximum par pas (anti-tunnelling), sauvetage automatique
après 3 s de blocage pour le joueur et 4 s pour l'IA. Une erreur JavaScript affiche un écran avec le fichier et la ligne,
un rapport copiable et des boutons pour recharger, revenir au menu ou reprendre.

## Physique et conduite (lot 2)

| Amélioration | Comportement |
| --- | --- |
| 9 Rebond à l'atterrissage | rebond proportionnel à la hauteur de chute, plus marqué pour les légers (`phys.bounce`), amorti sur herbe, sable et boue |
| 10 Collisions pondérées | impulsion selon les masses ; le plus léger voit sa dérive cassée au-delà de 6 m/s de vitesse relative, et part en toupie au-delà de 12 m/s si l'écart de masse dépasse 1,5 |
| 11 Statistiques par personnage | les 4 notes pilotent aussi grip, vitesse conservée hors piste et rebond ; deux barres dérivées (GRIP, OFF-ROAD) dans le menu |
| 12 Surfaces différenciées | table `SURFX` (grip, vitesse max, reprise, poussière) pour route, herbe, sable, boue, glace ; Rainbow Road est plus glissante (`World.roadGrip`) ; poussière et son selon la surface |
| 13 Aspiration | jauge qui se remplit à moins de 17 m derrière un kart ; pleine, +7 % de vitesse max tant qu'on reste dans le sillage ; jauge SLIPSTREAM au HUD |
| 14 Marche arrière | le frein arrête d'abord le kart, la marche arrière s'enclenche après 0,2 s, accélère progressivement (12 m/s max), bip de recul |
| 15 Inclinaison du châssis | roulis selon l'accélération latérale (lacet × vitesse) et le poids, tangage au freinage et à l'accélération |
| 16 Gravité variable | `World.gravMul` par piste (Rainbow Road 0,88) et légère variation selon la masse du personnage |
| 17 Personnalisation du poids | léger / équilibré / lourd, appliquée au joueur : le lourd gagne vitesse et masse, perd reprise et maniabilité |
| 18 Réglage fin de la direction | sensibilité, lissage du clavier, zone morte et courbe de la manette ; touche T à l'écran de sélection, réglages mémorisés (`kp_prefs`) |

Test : `KP.Diag.driveTest(0 ou 1)` (marche arrière, poids, aspiration, collisions, table des surfaces) ; inclus dans `npm test`.

## Drift et tricks (lot 3)

| Amélioration | Comportement |
| --- | --- |
| 19 Jauge de charge du drift | jauge au HUD avec les 3 paliers de mini-turbo, colorée selon le palier atteint |
| 20 Mini-turbo en chaîne | un mini-turbo obtenu moins de 2,5 s après la fin du précédent monte le niveau de chaîne (jusqu'à x4) : boost plus long (+12 % par niveau), un peu plus rapide, charge plus rapide |
| 21 Largeur du drift | `phys.driftW` selon le poids : les lourds décrivent un arc large, les légers un arc serré ; barre DRIFT ARC dans le menu |
| 22 Tricks variés | direction à l'appui : roulis gauche ou droit, salto arrière (frein), sinon vrille puis salto avant en alternance |
| 23 Combo de tricks | jusqu'à 3 figures par saut (0,5 s entre deux, il faut relâcher puis réappuyer), boost d'atterrissage allongé à chaque figure, son plus aigu |
| 24 Drift inversé | contre-braquer à fond 0,35 s en plein drift retourne le drift et garde la moitié de la charge (joueur seulement) |
| 25 Traces de dérapage | traces au sol en drift, toupie et gros freinage (route et sable), un seul maillage à tampon circulaire de 4000 segments, teinte selon la piste |

## Développement et livraison

```
npm install                      une fois
npx playwright install chromium  une fois (pour les tests)
npm run serve                    serveur local sur http://localhost:8000
npm run build                    dist/kart-party-deluxe.html : le jeu en un seul fichier, jouable en double-clic
npm run lint                     ESLint, avec règle de couches d'imports et interdiction des cycles
npm test                         test de fumée Playwright (npm run test:full ajoute le test IA complet)
npm run check                    lint + build + test
```

Documentation technique : `docs/ARCHITECTURE.md`.
