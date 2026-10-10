# aledloop

Projet perso, pour s'amuser, sans client ni deadline. Le développeur est dev web, francophone, et pas spécialiste de la dynamique des systèmes : **propose des features**, ne te contente pas d'exécuter.

## Vision

Une application web pour **dessiner, simuler et présenter des systèmes dynamiques** : écologie, climat, économie, sociologie… tout ce qui comporte des boucles de rétroaction.

- Point de départ : réplique de **LOOPY** de Nicky Case (https://ncase.me/loopy/v1.1/, https://github.com/ncase/loopy). On dessine des cercles (éléments) et on les relie par des flèches + / −. En simulation, chaque élément a des boutons ▲▼ qui envoient une impulsion. Elle se propage le long des flèches et augmente ou diminue les éléments ciblés, ce qui fait apparaître les boucles.
- Ensuite on va **plus loin que Loopy** : seuils, retards, accumulation puis largage au-delà d'un seuil, irréversibilité (points de bascule).
- À terme, on vise le **stocks-flux façon Insight Maker**, avec équations et courbes.
- Le « top du top » serait de faire tourner **World3** (modèle du rapport Meadows, *Les limites à la croissance*) avec ses courbes. Ce n'est pas le MVP, mais c'est l'horizon.

## Point conceptuel clé : deux moteurs, un éditeur

Loopy et Insight Maker ne simulent pas la même chose :

- **Diagramme causal (CLD)**, façon Loopy : qualitatif, à événements. Des impulsions voyagent sur les liens et chaque nœud a un niveau abstrait dans [0, 1].
- **Stocks-flux (SFD)**, façon Insight Maker, Vensim ou Stella : des équations différentielles intégrées pas à pas (Euler, puis RK4), avec stocks, flux, variables, tables de correspondance et retards.

D'où l'architecture : **un modèle de données unique (graphe typé) et des moteurs de simulation interchangeables**. Le moteur Loopy vient d'abord, le moteur stocks-flux ensuite, sans réécrire l'éditeur. Un document a un mode (causal ou stocks-flux). Plus tard, on pourra convertir un diagramme causal en squelette stocks-flux.

## Décisions prises

| Sujet | Décision |
|---|---|
| Framework UI | **Svelte 5, runes uniquement** (`$state`, `$derived`, `$effect`, `$props`). Jamais de syntaxe Svelte 4 (`export let`, `$:`, stores `writable` pour l'état local, `on:click`). |
| Langage / build | **TypeScript + Vite** ; tests avec **Vitest** |
| Rendu du graphe | **Canvas 2D maison**, sans SVG ni lib de graphe. Passer à PixiJS/WebGL seulement si un besoin réel apparaît. |
| Moteur(s) de simulation | **TS pur, sans DOM**, testable. Web Worker si besoin. Pas de Rust/WASM : le calcul n'est pas le goulot (World3 ≈ 400 pas × ~250 équations, moins d'1 ms en JS). |
| Équations (phase stocks-flux) | Parser maison (Pratt) qui **compile chaque équation en fonction JS** (`new Function`) pour que le JIT fasse le travail |
| Courbes | uPlot (le plus rapide pour des séries temporelles) |
| Backend | Aucun : tout est côté navigateur. Sauvegarde locale, export/import JSON, **partage par URL** (modèle compressé `deflate-raw` + base64url dans le hash, comme Loopy). |
| Tactile / tablette | **Dès le départ.** Pointer Events unifiés (souris, doigt, stylet), `touch-action: none` sur le canvas, pincement à deux doigts pour zoomer/déplacer, zones de clic élargies au doigt. Le développeur n'y connaît rien : explique les choix au passage. |
| Langue de l'interface | **Français** |
| Esthétique | **« Cosy », pas dessiné à la main.** Propre, chaleureux, effet papier/texturé, on doit avoir l'impression de *toucher* l'application. Voir ci-dessous. |

### Direction artistique « cosy papier »

- Fond crème chaud avec grain papier léger (bruit SVG `feTurbulence` en CSS) et vignettage doux. Grille de points discrète, comme un carnet.
- Palette chaude et désaturée : terracotta, ocre, sauge, bleu ardoise, prune, sable. Remplissages pastel, contours plus soutenus. Encre brun foncé (≈ `#3d3128`), jamais de noir pur.
- Les nœuds ressemblent à des galets : ombre portée douce, léger reflet en haut à gauche, contour arrondi.
- Panneaux comme des cartes de papier : grain, ombres douces et chaudes, coins arrondis. Les boutons d'outil actifs ont l'air **enfoncés** (ombre interne) : c'est le côté tactile.
- Typo : **Nunito** (arrondie) pour l'interface et les étiquettes, **Fraunces** pour le logo et les titres. Auto-hébergées via `@fontsource-variable/*`.
- Barre d'outils flottante en bas au centre, accessible au pouce sur tablette. Inspecteur à droite sur desktop, en panneau du bas sur mobile.

## Feuille de route

**Phase 0 : socle** ✅
Scaffold Vite + Svelte 5 + TS. Canvas avec zoom et déplacement (molette, pincement), nœuds et liens, sélection, déplacement, suppression, annuler/rétablir, sauvegarde automatique (localStorage), export/import JSON, partage par URL, bouton « Recentrer ».

**Phase 1 : parité Loopy** ✅
- Outil Crayon :
  - un tracé fermé dans le vide crée un nœud (centre et rayon tirés de la boîte englobante) ;
  - un tracé d'un nœud vers un autre crée un lien ;
  - un tracé d'un nœud vers le vide crée un nouveau nœud relié ;
  - double-tap dans le vide crée un nœud.
- Outil Main : déplacer un nœud, courber un lien en le glissant, déplacer la vue dans le vide.
- Outil Gomme : passer sur les éléments les supprime. Ils s'estompent pendant le tracé et sont effacés au relâchement, en une seule étape d'annulation.
- Liens + / − : pastille au milieu du lien, un tap l'inverse. Boutons ▲▼, impulsions animées, lecture/pause, vitesse.

**Phase 2 : Loopy+** ← *en cours : tout est fait sauf le mode présentation*
- **Détection automatique des boucles**, étiquetées R (renforçante) ou B (équilibrante) : un nombre pair de liens − donne R, impair donne B (cycles élémentaires, algorithme de Johnson). Mise en évidence au survol.
- Paramètres de lien : poids et **retard**.
- Paramètres de nœud : seuil, accumulation puis largage, saturation, retour progressif à l'équilibre, **irréversibilité** (verrouillage une fois le seuil franchi).
- Petite courbe d'historique sous chaque nœud.
- **Mode présentation** : récit pas à pas avec mise en évidence des éléments. ← *prochaine étape*
- Modèles d'exemple : proies/prédateurs, albédo, panique bancaire…

Sémantique retenue pour le moteur causal (`src/sim/loopy.ts`) :
- Les réglages propres au mode causal sont dans `SysNode.causal` (niveau de départ, seuil, retour à l'équilibre, saturation), pour ne pas polluer le futur modèle stocks-flux. `parseDoc` migre l'ancien `init` à plat.
- Une impulsion a une intensité (signe × force du lien). Sans saturation, elle repart intacte même si le niveau est au bord (règle de Loopy). Avec saturation, elle transmet la variation réelle, donc une boucle renforçante s'éteint en saturant.
- Bascule : au seuil, le nœud se bloque à 1. Il émet une impulsion de plus (l'« onde de choc »), laisse passer les hausses et absorbe les baisses jusqu'à la réinitialisation.
- Largage : le nœud retient tout sans transmettre. Au seuil, il relâche une impulsion par cran accumulé et retombe à son niveau de départ.
- Retard : la durée de trajet est multipliée par 1, 2,5 ou 5. Retour à l'équilibre : décroissance exponentielle (τ = 6 s ou 2 s), silencieuse (n'émet pas d'impulsion).

**Phase 3 : stocks-flux**
Stocks, flux, variables, liens d'information, éditeur d'équations, intégrateur Euler/RK4, panneau de courbes, curseurs de paramètres en direct.

**Phase 4 : World3**
- Tables de correspondance (fonctions définies par une courbe), `SMOOTH`, `DELAY3`.
- Import **XMILE** (format standard ouvert du domaine), éventuellement Vensim `.mdl`.
- Charger World3 (sources : PyWorld3, fichier Vensim World3-03) et ses scénarios.
- À regarder : SDEverywhere (Climate Interactive, compile des modèles Vensim en JS, utilisé par En-ROADS), et le moteur open source d'Insight Maker.

## Conception prévue pour la phase 0

- `src/theme.ts` : palette partagée entre le CSS et le canvas (`ColorKey`).
- `src/model/types.ts` : `Doc { version: 1, nodes, edges }`.
  - `SysNode { id, x, y, r, label, color }`
  - `SysEdge { id, from, to, polarity: 1 | -1, bend }`. `bend` est le décalage perpendiculaire du milieu de la courbe ; les liens sont des Bézier quadratiques. Un lien retour A→B / B→A se courbe naturellement de l'autre côté.
- `src/model/editor.svelte.ts` : singleton `editor`.
  - Le **document est en données brutes mutées sur place**. Un seul signal réactif `rev = $state(0)` est incrémenté à chaque changement. Ça évite les proxys profonds, c'est performant pour le canvas et réutilisable tel quel par le moteur de simulation.
  - `selection` et `tool` sont en `$state`.
  - Annuler/rétablir par instantanés JSON avec `checkpoint(key?)`, qui fusionne les modifications rapprochées de même clé (frappe d'une étiquette, glisser).
  - Côté composants : `$derived.by(() => { editor.rev; return copie })`. Attention, `$derived` compare par référence, donc il faut renvoyer une copie, sinon rien ne se met à jour.
- `src/model/persist.ts` : `parseDoc` (validation et nettoyage, suppression des liens orphelins), localStorage avec try/catch, encodage pour l'URL via `CompressionStream`.
- `src/canvas/` :
  - `camera.ts` : écran = monde × zoom + décalage, zoom autour d'un point.
  - `geometry.ts` : courbes, points d'entrée et de sortie sur le bord des cercles par dichotomie, tests de clic, reconnaissance de tracé (tap, cercle, ligne).
  - `render.ts` : fond transparent (le papier est en CSS), grille de points, liens, nœuds, tracé en cours.
  - `interaction.ts` : machine à états des gestes (tracé, gomme, glisser un nœud, courber un lien, déplacer la vue, pincement).
  - `Canvas.svelte` : prise en compte du `devicePixelRatio`, `ResizeObserver`, rendu à la demande via `requestAnimationFrame`, molette en `passive: false`.
- `src/ui/` : `Toolbar.svelte`, `Inspector.svelte` (étiquette, couleur, taille ; pour un lien : « Quand A augmente, B augmente/diminue » avec les vrais noms, inverser la direction, supprimer), `TopBar.svelte` (Nouveau / Ouvrir / Enregistrer / Partager), toasts.
- Raccourcis :
  - `C` Crayon, `M` Main, `G` Gomme ;
  - `Ctrl+Z` annuler, `Ctrl+Maj+Z` / `Ctrl+Y` rétablir ;
  - `Suppr` supprimer, `Échap` désélectionner ;
  - espace maintenu pour déplacer la vue.
- Molette : déplace la vue. `Ctrl` + molette (et pincement sur trackpad) : zoom. C'est la convention de Figma et Excalidraw.

## Conventions

- Svelte 5 runes uniquement. Fichiers à état réactif hors composants : `*.svelte.ts`.
- Le moteur de simulation et le modèle ne dépendent jamais du DOM ni de Svelte.
- Interface en français, code et identifiants en anglais.
- Vérifier avant de dire « fini » : `npm run check`, `npm test`, `npm run build`.
