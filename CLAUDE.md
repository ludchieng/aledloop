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
| Routage | **History API maison** (`src/ui/router.svelte.ts`), sans bibliothèque. Sur GitHub Pages, le build copie `index.html` en `404.html` et le déploiement passe `--base=/aledloop/` (chemins absolus obligatoires). |
| Tactile / tablette | **Dès le départ.** Pointer Events unifiés (souris, doigt, stylet), `touch-action: none` sur le canvas, pincement à deux doigts pour zoomer/déplacer, zones de clic élargies au doigt. Le développeur n'y connaît rien : explique les choix au passage. |
| Langue de l'interface | **Français et anglais**, au choix (bouton en haut à droite ; par défaut la langue du navigateur : le français si on le parle, l'anglais sinon). Les adresses gardent leurs mots français (`exemples`, `aide`, `recit`). |
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
- Outil Sélection (ex-« Main », touche V comme chez Adobe) : déplacer un nœud, courber un lien en le glissant, déplacer la vue dans le vide.
- Outil Gomme : passer sur les éléments les supprime. Ils s'estompent pendant le tracé et sont effacés au relâchement, en une seule étape d'annulation.
- Liens + / − : pastille au milieu du lien, un tap l'inverse. Boutons ▲▼, impulsions animées, lecture/pause, vitesse.

**Phase 2 : Loopy+** ✅
- **Détection automatique des boucles**, étiquetées R (renforçante) ou B (équilibrante) : un nombre pair de liens − donne R, impair donne B (cycles élémentaires, algorithme de Johnson). Mise en évidence au survol.
- Paramètres de lien : poids et **retard**.
- Paramètres de nœud : seuil, accumulation puis largage, saturation, retour progressif à l'équilibre, **irréversibilité** (verrouillage une fois le seuil franchi).
- Petite courbe d'historique sous chaque nœud.
- **Mode présentation** : récit pas à pas avec mise en évidence des éléments. Le récit (`Doc.story`) est enregistré dans le document et voyage avec le lien de partage. Chaque étape a un texte (`**gras**`), des éléments mis en avant et une impulsion facultative. Option « construire le diagramme au fil du récit ».
- Modèles d'exemple : proies/prédateurs, albédo, panique bancaire… (devenus une bibliothèque de 47 exemples, voir plus bas)

**Phase 2 bis : moteur causal continu, façon dynamique des systèmes** ✅
Le moteur à impulsions façon Loopy a été **remplacé** : une boucle équilibrante n'y convergeait jamais (une impulsion fait le tour indéfiniment en changeant de signe), et les retards « lent / très lent » n'avaient pas d'unité, donc pas de sens. Désormais (`src/sim/causal.ts`) :
- Le niveau de départ de chaque nœud est un **équilibre** : sans intervention, rien ne bouge. Un lien transmet un **écart** (niveau de la cause − son départ) × polarité × force.
- Chaque nœud est une **variable** (suit ses causes immédiatement) ou une **accumulation** (`kind: 'stock'`, intègre ce qu'elle reçoit, dessinée en **boîte aux coins arrondis** avec un double contour, comme les stocks d'Insight Maker ; les variables sont rondes. `nodeShape` / `insideNode` dans `geometry.ts` gèrent les deux formes : bord d'arrivée des flèches, clic, gomme, cadrage). C'est la distinction centrale de la dynamique des systèmes et elle prépare la phase 3.
- Le document a une **unité de temps** (`Doc.timeUnit` : seconde… année). Retards et retours à l'équilibre sont des **durées** dans cette unité. Retard = retard d'ordre 3 (DELAY3 de Vensim). Retour à l'équilibre = fuite d'une accumulation, ou estompage du réglage ▲▼ d'une variable.
- ▲▼ : apport ponctuel (± 0,2) sur une accumulation, décalage durable sur une variable.
- Bascule : au seuil franchi en montant, bloqué à 1, irréversible. Largage (accumulations seulement) : ne transmet rien, puis au seuil se vide en `RELEASE_TIME` et transmet son débit de vidange (tout ce qui avait été accumulé).
- Saturation : freinage doux près des bords (tanh pour une variable, débit atténué pour une accumulation) ; une boucle renforçante dessine une courbe en S.
- Boucle sans accumulation ni retard (« boucle algébrique ») : ses variables sont lissées (τ = `INSTANT_LOOP_TAU`), signalées par une étiquette en pointillés et un avertissement au lancement.
- Euler à pas fixe `DT = 0,01` : résultats indépendants de la cadence d'affichage. Vitesse ×1 = 1 unité de temps par seconde. Horloge affichée en simulation.
- `analyzeLoop` (`src/model/loops.ts`) explique le rythme d'une boucle dans l'inspecteur : pour une boucle B à une accumulation, temps de réaction 1/G et seuils de retard (oscillation dès G·D ≈ 0,32, emballement dès G·D = 8/3, racines de s(1 + sD/3)³ + G = 0) ; pour une boucle R, temps de doublement, ou amplification 1/(1 − G·Πτ) si ses accumulations fuient.
- Format `version: 2`. `parseDoc` migre la version 1 : crans de retard 1, 2 → 2, 5 ans ; retour à l'équilibre 1, 2 → 5, 2 ans ; un nœud « largage » devient une accumulation.
- **Courbes et calcul d'un coup** (façon Insight Maker) : `Doc.horizon` = durée de simulation. Panneau de courbes uPlot (`src/ui/ChartPanel.svelte`) : toutes les séries sur l'axe du temps, pastilles pour masquer ou lire les valeurs sous le curseur. **Pas d'arrêt par défaut** (une simulation qui se fige semble avoir planté) : la durée est une **fenêtre glissante**, l'historique du moteur est une file de `HISTORY_POINTS` points (`historyStart`, `setHistoryWindow`) et les courbes défilent. Option « Arrêt à la fin » (`prefs.stopAtEnd`, désactivée par défaut) : arrêt au bout de la durée, avec un toast. Bouton ⏭ (`sim.runAhead()`) : avance d'une durée d'un coup (ou jusqu'à la fin avec l'option).
- **Démarrage d'une simulation libre** : elle tourne pendant `WARMUP` (5 %) de la durée, puis se met en attente (`sim.waiting`, message et toast) jusqu'au premier ▲ ▼ (`sim.push`), à ▶ ou à ⏭. Un système au repos ne déroule donc plus seul jusqu'au bout.
- **Barres** : en haut à gauche, le logiciel et le projet (logo, Exemples, puis Nouveau, Ouvrir, Enregistrer, Partager) ; en haut à droite, l'application (Aide, thème). En bas, « Récit » à côté de « Présenter » (on écrit le récit, puis on le présente), puis « Simuler ».
- **Perles** : vers une **accumulation**, en continu (un débit) ; vers une **variable**, **par paquets**, seulement quand la cause change d'un cran (`src/sim/packets.ts`, convention d'affichage, le moteur reste continu). Deux causes qui se compensent ne font donc rien circuler. À l'arrivée sur une variable, **empreinte** : un gros chevron près de la pointe pendant 1,6 s, et le chevron ▲ ou ▼ du galet s'allume (`PacketTracker.imprint`).
- **Crayon** : un cercle est reconnu dès qu'on fait environ trois quarts de tour autour du centre (`sweptAngle`), même mal refermé ou un peu ovale. La traînée suit le crayon pendant le tracé, puis s'estompe en 0,7 s.
- **Lien − lisible en simulation** : les perles montrent le sens de la cause avant la pastille, se retournent dessus (`beadTurn`) en s'entourant d'un halo rouge (`flipGlow`).
- **Aide « Comment ça marche »** : [`docs/moteur.md`](docs/moteur.md), écrite pour tout le monde (enfants compris) : ce qu'on voit, ce qu'on peut essayer, des images du quotidien, **pas de formules**. Affichée dans l'application (bouton « Aide », `src/ui/HelpPanel.svelte`, rendu marked chargé à la demande). Version anglaise : [`docs/how-it-works.md`](docs/how-it-works.md), avec **exactement les mêmes numéros de section**. L'inspecteur y renvoie par des liens « Pourquoi ? » vers une section précise (`SECTIONS` dans `src/ui/help.ts`). **Si on renumérote la doc, renuméroter les deux pages et mettre à jour `SECTIONS`** : `src/ui/doc.test.ts` vérifie que chaque section existe et que les deux pages ont les mêmes numéros. Les détails mathématiques restent dans cette section de CLAUDE.md.
- **Bibliothèque d'exemples** (`src/ui/GalleryPanel.svelte`) : une grille de cartes rangées par niveau (premiers pas, plusieurs boucles, systèmes complexes) et filtrables par thème, avec une miniature du vrai diagramme (`src/canvas/thumbnail.ts`), « Ouvrir » ou « Raconter ». 47 exemples, chacun avec son récit : la première série dans `src/model/examples.ts`, la deuxième (industrie, écosystèmes, société, psychologie, macroéconomie, histoire, ingénierie) dans `src/model/examplesMore.ts`, les outils communs (`doc()`, niveaux, thèmes) dans `src/model/exampleKit.ts`. **Traduction anglaise** dans `src/model/examples.en.ts` (titre, description, comportement, étiquettes par identifiant de nœud, étapes du récit dans l'ordre), appliquée par `buildExample(ex, lang)` et `exampleText(ex, lang)` : `src/model/examples.en.test.ts` exige que chaque exemple y soit traduit, étiquettes et étapes comprises. Un exemple intact suit le changement de langue (`router.relocalize`, traduit sur place : une simulation continue) ; un exemple modifié reste tel qu'on l'a écrit. Certains récits sont longs (réacteur 18 étapes, 2008 et crise de l'euro 17, crise de 1929 15, bulle de l'IA 13, cartes graphiques 12) : la barre de présentation resserre ses points au-delà de 10 étapes, et le cadrage mesure la vraie hauteur de la carte de narration ; dans un récit, un lien se désigne par « cause>effet ». Chaque exemple est **testé sur son comportement** (`src/sim/examples.test.ts`) : ce que dit son récit doit être vrai dans le moteur. Les exemples d'économie, de géopolitique et d'histoire sont des **mécanismes illustratifs**, pas des prévisions. Une boucle renforçante entre accumulations doit garder un gain < 1 si l'on veut qu'une action (baisser la charge, réduire les engrais) puisse encore la ramener : au-delà, l'équilibre de départ est lui-même instable. Limite connue : le moteur additionne les effets, donc une épidémie, une pêcherie ou les limites à la croissance ne sont qu'approchées (réglages trouvés par recherche systématique) ; les vraies équations viendront avec la phase 3.
- **Routage** : chaque page a son adresse et les boutons précédent / suivant naviguent dans l'application. Adresses (après `/aledloop/`, `src/ui/route.ts`, pur et testé) : rien = **mon diagramme** (localStorage) ; `#m=…` = un diagramme dans l'adresse (lien partagé, mais aussi fichier ouvert par « Ouvrir ») ; `exemples` = bibliothèque ; `exemples/<id>` = un exemple ; suffixe `recit` = présentation du récit (`exemples/albedo/recit`, `recit#m=…`) ; `aide`, `aide#6.2`. Le diagramme partagé reste dans le hash : jamais envoyé au serveur, donc pas de « 414 URI Too Long », et les anciens liens marchent.
  - **Modifier ne change pas l'adresse.** Chaque diagramme a sa clé (`docKey`) : mon diagramme est gardé pour toujours, un exemple ou un partage modifié garde un **brouillon** (`saveDraft`, les `MAX_DRAFTS` plus récents), retrouvé au retour arrière, au rechargement ou depuis la bibliothèque (pastille « Modifié », toast « Revenir à l'original »). Un exemple intact se partage par son adresse courte. Ouvrir un autre diagramme vide l'historique d'annulation (`editor.open`) : Ctrl+Z ne doit pas mélanger deux diagrammes à une même adresse.
  - Bibliothèque et aide recouvrent la page en cours (`under` dans `history.state`, qui survit au rechargement). **Fermer** (✕, Échap, fin du récit) fait un `history.back()` quand on vient de cette page (`back`), sinon un `replaceState` : le bouton précédent ne rouvre pas ce qu'on vient de fermer. Le titre de l'onglet suit la page (visible dans l'historique).
- Force d'un lien entre 0,01 et 3, curseur **logarithmique** dans l'inspecteur (les taux mensuels ou annuels de l'économie sont petits).

**Phase 3 : stocks-flux** ← *prochaine étape (prévoir une séance de cadrage)*
Stocks, flux, variables, liens d'information, éditeur d'équations, intégrateur Euler/RK4, panneau de courbes, curseurs de paramètres en direct.

**Phase 4 : World3**
- Tables de correspondance (fonctions définies par une courbe), `SMOOTH`, `DELAY3`.
- Import **XMILE** (format standard ouvert du domaine), éventuellement Vensim `.mdl`.
- Charger World3 (sources : PyWorld3, fichier Vensim World3-03) et ses scénarios.
- À regarder : SDEverywhere (Climate Interactive, compile des modèles Vensim en JS, utilisé par En-ROADS), et le moteur open source d'Insight Maker.

## Conception prévue pour la phase 0

- `src/theme.ts` : palette partagée entre le CSS et le canvas (`ColorKey`).
- `src/model/types.ts` : `Doc { version, nodes, edges }` (aujourd'hui `version: 2`, avec `timeUnit` et `story`).
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
  - à la Figma : `V` Sélection, `P` Crayon, `E` Gomme (les anciens `M`, `C`, `G` marchent aussi) ; infobulle au survol des outils ;
  - `Ctrl+Z` annuler, `Ctrl+Maj+Z` / `Ctrl+Y` rétablir ;
  - en simulation, comme un lecteur vidéo : `Espace` lecture/pause, `>` / `<` (ou `+` / `−`) vitesse ; le bouton Présenter y est aussi ;
  - `Suppr` supprimer, `Échap` désélectionner ;
  - espace maintenu pour déplacer la vue.
- Molette : déplace la vue. `Ctrl` + molette (et pincement sur trackpad) : zoom. C'est la convention de Figma et Excalidraw.

## Conventions

- Svelte 5 runes uniquement. Fichiers à état réactif hors composants : `*.svelte.ts`.
- Le moteur de simulation et le modèle ne dépendent jamais du DOM ni de Svelte.
- Interface en français et en anglais, code et identifiants en anglais, commentaires en français.
- **Aucun texte affiché en dur.** Tout passe par `src/i18n/` : `fr.ts` est la référence, `en.ts` doit avoir les mêmes clés (TypeScript le vérifie, `lang.test.ts` attrape un texte copié sans être traduit). Dans un composant : `const t = $derived(i18n.t)`, puis `{t.topbar.examples}` ; `**gras**` se rend avec `<Rich text={…} />` ; nombres et durées avec `i18n.number`, `i18n.duration`, `i18n.unit` (« 2,5 ans », « 2.5 years »). Le modèle ne dépend pas de Svelte : ses fonctions qui écrivent du texte (`formatDuration`, `analyzeLoop`, `describeFocus`…) prennent la langue (`Lang`, `src/i18n/lang.ts`) en paramètre.
- Le README est en anglais (vitrine du dépôt GitHub).
- Vérifier avant de dire « fini » : `npm run check`, `npm test`, `npm run build`.
