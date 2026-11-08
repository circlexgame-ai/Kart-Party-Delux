# Architecture technique

Kart Party Deluxe est un jeu Three.js (r170) en modules ES, sans dépendance de build à l'exécution.
Tous les meshes, textures et sons sont générés par le code.

## Couches de modules

Les fichiers `js/NN_nom.js` sont numérotés par couche. **Un module n'importe que des modules de numéro inférieur ou égal.**
Les références vers le haut passent par `late` (`00_registry.js`) : `late.Game`, `late.UI`, `late.Audio_`, `late.Diag`
sont renseignés quand les modules concernés se chargent, et lus à l'exécution seulement.
ESLint applique cette règle (`import/no-restricted-paths`) et interdit les cycles (`import/no-cycle`).

| Couche | Rôle |
| --- | --- |
| 01_core | maths, bruit, `Prefs` (réglages mémorisés), entrées (clavier lissé, manette), renderer, post-traitement (`Post`), `fatal` (écran d'erreur) |
| 02_gfx | géométries fusionnées (`GB`), matériaux, textures, ciel, nuages, environnement |
| 03_audio | synthèse Web Audio (moteurs, effets, musique) |
| 04_track | pistes : spline, échantillons (`T.n`, `T.ds`), flags de surface, murs, tunnels, boucles |
| 05_fx | particules (`FX`, tuiles `TILE`) |
| 06_beach, 07_space | construction des deux mondes (Sunshine Shores, Rainbow Road) |
| 08_chars | personnages, karts (`KartVisual`), nuage de sauvetage |
| 09_kart | `Kart`, `stepKart` (physique à pas fixe), collisions, sauvetage |
| 10_items | objets (carapaces, bananes, éclair, étoile…) |
| 11_ai | IA : poursuite de trajectoire, drift, objets, anti-blocage, rubber-banding |
| 12_ui | HUD, menus, minicarte |
| 13_game | `Game` (états), chargement des mondes, caméra, boucle principale, entrées globales |
| 14_diag | compteur F3, qualité, résolution dynamique, tests automatiques |

## Boucle principale (`13_game.js`, `frame`)

1. `Input.update()` puis `handleInput()` (menus, pause).
2. `updateRace(dt)` : décompte, entrées du joueur ou de l'IA, **physique à pas fixe** (`PHYS.DT = 1/120`, jusqu'à 12 pas par image),
   visuels des karts (interpolation `prevPos`/`pos` avec `Game.alpha`), HUD, audio, paramètres de post-traitement.
3. `updateCamera(dt)` puis `post.render(scene, camera, time)`.
4. `Diag.frame(rawDt, cpuMs)` : compteur et résolution dynamique.

États de `Game.state` : `boot`, `title`, `select`, `loading`, `intro`, `countdown`, `race`, `finished`, `results`, et `diag`
(réservé aux tests, la boucle ne simule ni ne rend rien dans cet état).
Si une erreur est levée, `fatal()` pose `Game.crashed = true` : la boucle s'arrête et l'écran d'erreur propose de recharger,
revenir au menu ou reprendre.

## Physique (`09_kart.js`)

`stepKart(k, dt)` : accélération et freinage, hop et drift (stades de mini-turbo), air (gravité, tricks sur rampes),
puis intégration en 1 à 4 **sous-pas** de 0,4 m maximum (anti-tunnelling) avec `resolveContact` à chaque sous-pas :
murs (deux faces, `F_WALL_L/R`), colliders de décor, sol (route ou terrain), plateformes, pads de boost, eau, sauvetage.
`collideKarts` gère kart contre kart (impulsion pondérée par la masse).
Le **sauvetage** (`startRescue`) est déclenché par : eau, plus de 3,2 s en l'air, hauteur sous -16, très loin, ou blocage
(`blockT` : le kart veut avancer mais reste sous 1,2 m/s pendant 3 s pour le joueur, 4 s pour l'IA).
Chaque sauvetage est consigné dans `RescueLog` (cause, position, vitesse) pour le diagnostic.

### Lot 2 : conduite

- `SURFX[surface]` donne grip, vitesse max, reprise et poussière ; `st.grip`, `st.off`, `st.bounce` (issus de `STAT_PHYS`) et `World.roadGrip` modulent le résultat.
  Pour une nouvelle surface : ajouter la valeur dans `SURF` (`04_track.js`) et une ligne dans `SURFX`.
- `World.gravMul` (par piste) multiplie la gravité en l'air ; le saut (`G_HOP`) n'est pas affecté.
- `updateSlipstream(karts, dt)` est appelé avant `stepKart` dans `physStep` ; il alimente `k.slipT` (jauge) et `k.slipOn` (bonus actif).
- `Kart.applyWeight(w)` : personnalisation du poids du joueur (`Prefs.weight`), appliquée dans `setupRace`.
- `Prefs` (`01_core.js`) est sauvegardé dans `localStorage` (`kp_prefs`), l'accès est protégé par try/catch.

### Lot 3 : drift et tricks

- `Kart.endDrift` gère la chaîne (`chainLvl`, `chainT`, constantes `CHAIN_*` de `PHYS`) ; `UI.setDrift` affiche jauge et chaîne.
- Tricks : `k.trickWin` dure `TRICK_WIN` après une rampe `F_TRICK`, `k.trickCount` compte les figures ; `vis.trick(kind)` anime (0 vrille, 1 roulis droit, 2 salto avant, 3 salto arrière, 4 roulis gauche). L'IA ne fait qu'une figure.
- `Skids` (`05_fx.js`) : tampon circulaire ; l'émission se fait dans la boucle visuelle de `13_game.js`, par roue arrière, uniquement près de la caméra.

## Diagnostic et tests

- Touches : F3 compteur, F4 qualité, F5 résolution dynamique, F6 test IA, F7 test de chutes.
- `KP.Diag.aiTest(piste)` : 8 karts pilotés par l'IA font la course complète sans rendu ; échec si un kart n'arrive pas,
  est sauvé pour blocage, ou si une position devient invalide.
- `KP.Diag.fallTest(piste)` : 40 téléportations hors piste ; le kart doit être récupéré et reposé en moins de 10 s.
- `KP.Diag.driveTest(piste)` : marche arrière, poids, aspiration (deux karts IA), collisions pondérées, table des surfaces.
- `npm test` : test de fumée Playwright (menus, départ de course, accélération, direction clavier, tests de chutes et de conduite, aucune erreur console).
  `npm run test:full` ajoute le test IA. `-- --dist` teste le fichier unique.

## Livraison

- `npm run build` produit `dist/kart-party-deluxe.html` : HTML, CSS, JS et Three.js dans un seul fichier, jouable en double-clic.
- `npm run lint` : ESLint (règles de base, couches d'imports, cycles).
- `npm run check` enchaîne lint, build et test de fumée.
- Première utilisation : `npm install` puis `npx playwright install chromium`.

## Ajouter une fonctionnalité

1. Placer le code dans la couche la plus basse qui a besoin de tout ce qu'il utilise.
2. Si une couche basse doit appeler une couche haute, passer par `late`, jamais par un import.
3. Ajouter un cas au test concerné (`Diag.aiTest`, `Diag.fallTest` ou `tests/smoke.mjs`), puis lancer `npm run check`.

## Ajouts v0.5.0

- `00_save.js` : sauvegarde versionnée (clé `kp_save`, `SAVE_VERSION`, tableau `MIGRATIONS`). Contient réglages, meilleurs temps par piste, statistiques. Reprend automatiquement l'ancienne clé `kp_prefs`. Un JSON corrompu est copié dans `kp_save_corrupt`.
- `00_bus.js` : bus d'événements (`Bus.on / off / emit`). Émis par `13_game` : `race:setup {seed, track, difficulty}`, `race:finish {kart, time, place, track}`. Records et statistiques écoutent ces événements.
- Graine de course : `setSeed()` (01_core) est appelée à chaque `setupRace`. Pour rejouer une course : `Game.nextSeed = <graine>` avant de relancer. Les tirages de gameplay (`rand`) sont seedés ; `Math.random` ne reste que pour le cosmétique.
  Limite connue : certains effets visuels appellent aussi `rand()` à la cadence du rendu, donc la rejouabilité à l'identique n'est pas encore garantie. À séparer (flux cosmétique) avant les replays par entrées.
- Difficulté IA (`Prefs.difficulty`, 0 à 3, panneau T du menu) et personnalités des pilotes (`PERSONAS` dans `11_ai.js`).
- `tests/unit.mjs` : tests sans navigateur (sauvegarde, migrations, bus). `npm run test:unit`.

## Ajouts v0.6.0

- `00_rng.js` : `grand/grandi` = flux de GAMEPLAY seedé par course (`setSeed`). `rand/randi/pick` restent pour le décor et les effets : ils ne touchent plus au gameplay, donc la graine suffit à rejouer les tirages d'objets, de départ et d'IA.
- `00_itemtable.js` : table de probabilités des objets. `npm run item-stats` affiche la simulation ; `tests/unit.mjs` vérifie que chaque ligne vaut 100 % et que étoile/éclair augmentent vers le dernier.
- Pause : bouton SETTINGS (panneau T partagé avec le menu de sélection).
- HUD : `#standings` (classement en direct, écart au joueur). Résultats : `#resStats` (meilleur tour, tricks, collisions, aspiration, via `kart.rs`), événement `race:lap`.
- `12_ghost.js` + `00_ghostdata.js` : fantôme du record (positions échantillonnées à 10 Hz, sauvegardé dans `Save.data.ghosts`), option GHOST ON/OFF.
- `00_cup.js` : tournoi de 4 courses (10-8-6-5-4-3-2-1 points), option MODE SINGLE / CUP dans le panneau T.

## Ajouts v0.7.0

- `00_binds.js` : touches remappables (2 emplacements par action, échange en cas de conflit, touches fixes F H P C T N Échap Entrée). `Input.bind/slots/capture/resetBinds` (01_core). Sauvegarde v2 : `binds`, `seen`.
- Panneau de réglages complet (`#tunePanel`, lignes pilotées par `TUNE_ROWS`), écran `#keysPanel`, écran `#aboutPanel` (nouveautés, succès, crédits).
- Bouclier de bananes : `k.bShield` (09_kart `hit`), bananes en orbite dans `Items.shields`. Absorbe un coup « spin » ; sans effet sur la carapace bleue et l'éclair.
- `00_ach.js` : succès. Mode CRAZY ITEMS (`Prefs.crazy`), alerte d'objet entrant, tour parfait, feux d'artifice, captures (P), HUD minimal (H), plein écran (F), caméras (C).
