import { doc, STOCK, type Example } from './exampleKit';
import { MORE_EXAMPLES } from './examplesMore';

export { LEVELS, TOPICS, type Example, type Level, type Topic } from './exampleKit';

const BASE_EXAMPLES: Example[] = [
  // --- Niveau 1 : premiers pas ---------------------------------------------------------

  {
    id: 'thermostat',
    title: 'Thermostat',
    description: 'Le chauffage réchauffe la pièce, et une pièce chaude coupe le chauffage : la boucle la plus simple qui soit.',
    level: 1,
    topic: 'quotidien',
    shows: 'Retour au calme',
    build: () =>
      doc({
        unit: 'minute',
        horizon: 40,
        nodes: [
          ['temp', 'Température', 'terracotta', -170, 0, 64, STOCK],
          ['chauffage', 'Chauffage', 'ochre', 170, 0, 58],
        ],
        edges: [
          ['temp', 'chauffage', -1, 50],
          ['chauffage', 'temp', 1, 50, { weight: 0.2, delay: 3 }],
        ],
        story: [
          ['Voici une **pièce** et son **chauffage**. Le thermostat compare la température à celle qu’on a choisie.', ['temp', 'chauffage']],
          [
            'Il fait soudain **trop chaud**. Le chauffage **baisse** (le lien −), et la température, une **accumulation**, redescend petit à petit.',
            ['temp', 'chauffage', 'temp>chauffage', 'chauffage>temp'],
            ['temp', 1],
          ],
          ['C’est une **boucle équilibrante** : elle ramène la température vers son niveau de départ. Regarde les courbes.', []],
          [
            'Le radiateur met **3 minutes** à chauffer (les deux petits traits). Dans l’éditeur, allonge ce retard : au-delà d’une dizaine de minutes, la température se met à **osciller** de plus en plus.',
            ['chauffage>temp'],
          ],
        ],
      }),
  },
  {
    id: 'regulateur',
    title: 'Régulateur de vitesse',
    description: 'Sur l’autoroute, le régulateur accélère quand la voiture ralentit, et lâche quand elle va trop vite.',
    level: 1,
    topic: 'quotidien',
    shows: 'Régulation',
    build: () =>
      doc({
        unit: 'second',
        horizon: 30,
        nodes: [
          ['consigne', 'Vitesse choisie', 'sage', -380, -140, 50],
          ['moteur', 'Accélérateur', 'ochre', 0, -140, 56],
          ['vitesse', 'Vitesse', 'slate', 0, 140, 64, STOCK],
          ['cote', 'Côte', 'sand', 380, 140, 48],
        ],
        edges: [
          ['consigne', 'moteur', 1, 0, { weight: 2 }],
          ['moteur', 'vitesse', 1, 50, { weight: 0.5, delay: 0.3 }],
          ['vitesse', 'moteur', -1, 50, { weight: 2 }],
          ['cote', 'vitesse', -1, 0, { weight: 0.3 }],
        ],
        story: [
          ['Sur l’autoroute, le **régulateur de vitesse** tient la voiture à la **vitesse choisie**.', ['consigne', 'vitesse']],
          [
            'Il compare la vitesse réelle à la vitesse choisie, et appuie plus ou moins sur l’**accélérateur** : trop lent, il accélère ; trop vite, il lâche.',
            ['moteur', 'vitesse', 'moteur>vitesse', 'vitesse>moteur'],
          ],
          ['Une **côte** arrive ! Elle freine la voiture…', ['cote', 'vitesse', 'cote>vitesse'], ['cote', 1]],
          [
            '… alors le régulateur accélère pour compenser. La voiture ne perd qu’un peu de vitesse : c’est une **boucle équilibrante**.',
            ['moteur', 'vitesse', 'moteur>vitesse', 'vitesse>moteur'],
          ],
          ['À toi : change la **vitesse choisie** avec ▲ ▼, et regarde la voiture suivre, en douceur.', []],
        ],
      }),
  },
  {
    id: 'dette',
    title: 'Dette et intérêts',
    description: 'Une dette produit des intérêts, qui grossissent la dette : la boule de neige. Rembourser tôt change tout.',
    level: 1,
    topic: 'economie',
    shows: 'Boule de neige',
    build: () =>
      doc({
        unit: 'year',
        horizon: 30,
        nodes: [
          ['remboursements', 'Remboursements', 'sage', -360, 0, 52],
          ['dette', 'Dette', 'plum', 0, 0, 64, { kind: 'stock', init: 0.2 }],
          ['interets', 'Intérêts', 'terracotta', 340, 0, 54, { init: 0.2 }],
        ],
        edges: [
          ['remboursements', 'dette', -1, 0, { weight: 0.2 }],
          ['dette', 'interets', 1, 50],
          ['interets', 'dette', 1, 50, { weight: 0.1 }],
        ],
        story: [
          ['On **emprunte** : la dette monte d’un coup.', ['dette'], ['dette', 1]],
          [
            'Chaque année, la dette produit des **intérêts**… qui s’ajoutent à la dette. Plus de dette, plus d’intérêts : une **boucle renforçante**.',
            ['dette', 'interets', 'dette>interets', 'interets>dette'],
          ],
          ['Sans rembourser, la dette **double** environ tous les 7 ans. Touche l’étiquette **R** pour le vérifier.', []],
          [
            'Touche le haut des **remboursements**. Tôt, ça suffit à faire fondre la dette. Trop tard, les intérêts vont plus vite que toi : recommence (↺) pour comparer.',
            ['remboursements', 'dette', 'remboursements>dette'],
          ],
        ],
      }),
  },
  {
    id: 'innovation',
    title: 'Adoption d’une innovation',
    description: 'La publicité attire les premiers clients, puis le bouche-à-oreille prend le relais… jusqu’à ce que tout le monde soit équipé.',
    level: 1,
    topic: 'societe',
    shows: 'Courbe en S',
    build: () =>
      doc({
        unit: 'month',
        horizon: 36,
        nodes: [
          ['pub', 'Publicité', 'ochre', -360, 0, 50],
          ['utilisateurs', 'Utilisateurs', 'sage', 0, 0, 64, { kind: 'stock', init: 0.05, saturate: true }],
          ['bouche', 'Bouche-à-oreille', 'plum', 340, 0, 56, { init: 0.05 }],
        ],
        edges: [
          ['pub', 'utilisateurs', 1, 0, { weight: 0.2 }],
          ['utilisateurs', 'bouche', 1, 50],
          ['bouche', 'utilisateurs', 1, 50, { weight: 0.3 }],
        ],
        story: [
          ['Un nouveau téléphone sort. Au début, presque personne ne l’a.', ['utilisateurs']],
          ['La **publicité** attire les premiers acheteurs.', ['pub', 'utilisateurs', 'pub>utilisateurs'], ['pub', 1]],
          [
            'Chaque utilisateur en parle autour de lui : le **bouche-à-oreille** amène de nouveaux clients, qui en parlent à leur tour. Une **boucle renforçante** : ça s’accélère !',
            ['utilisateurs', 'bouche', 'utilisateurs>bouche', 'bouche>utilisateurs'],
          ],
          [
            'Mais il n’y a pas une infinité de clients : plus le marché est rempli, plus c’est dur d’en trouver de nouveaux (la **saturation**). La courbe dessine un **S**.',
            [],
          ],
        ],
      }),
  },
  {
    id: 'armement',
    title: 'Course aux armements',
    description: 'Chaque pays s’arme pour se protéger de l’autre… qui s’arme à son tour. Personne ne veut la guerre, et pourtant tout s’emballe.',
    level: 1,
    topic: 'geopolitique',
    shows: 'Escalade',
    build: () =>
      doc({
        unit: 'year',
        horizon: 30,
        nodes: [
          ['armesA', 'Armes de A', 'terracotta', -280, 0, 60, { kind: 'stock', init: 0.3, relax: 4 }],
          ['peurB', 'Inquiétude de B', 'plum', 0, -190, 52, { init: 0.3 }],
          ['armesB', 'Armes de B', 'slate', 280, 0, 60, { kind: 'stock', init: 0.3, relax: 4 }],
          ['peurA', 'Inquiétude de A', 'plum', 0, 190, 52, { init: 0.3 }],
          ['diplomatie', 'Diplomatie', 'sage', -700, 0, 52],
        ],
        edges: [
          ['armesA', 'peurB', 1, -40],
          ['peurB', 'armesB', 1, -40, { weight: 0.3 }],
          ['armesB', 'peurA', 1, -40],
          ['peurA', 'armesA', 1, -40, { weight: 0.3 }],
          ['diplomatie', 'peurB', -1, 0, { weight: 0.5 }],
          ['diplomatie', 'peurA', -1, 0, { weight: 0.5 }],
        ],
        story: [
          ['Deux pays voisins, **A** et **B**, se méfient l’un de l’autre.', ['armesA', 'armesB']],
          ['A achète quelques armes, pour se rassurer.', ['armesA', 'peurB', 'armesA>peurB'], ['armesA', 1]],
          ['B s’**inquiète**, et s’arme à son tour pour se protéger…', ['peurB', 'armesB', 'peurB>armesB']],
          [
            '… ce qui inquiète A, qui s’arme encore plus. Personne ne veut attaquer, et pourtant c’est l’**escalade** : une **boucle renforçante**.',
            ['armesA', 'peurB', 'armesB', 'peurA', 'armesA>peurB', 'peurB>armesB', 'armesB>peurA', 'peurA>armesA'],
          ],
          ['La **diplomatie** calme les inquiétudes des deux côtés. Essaie-la tôt, puis recommence (↺) et essaie-la tard.', ['diplomatie']],
        ],
      }),
  },

  // --- Niveau 2 : plusieurs boucles ------------------------------------------------------

  {
    id: 'steak',
    title: 'Cuisson d’un steak',
    description: 'La plaque chauffe la poêle, qui chauffe le steak. Et quand on éteint, le cœur du steak continue de cuire…',
    level: 2,
    topic: 'quotidien',
    shows: 'Inertie',
    build: () =>
      doc({
        unit: 'minute',
        horizon: 20,
        nodes: [
          ['bouton', 'Bouton de la plaque', 'sand', -440, -130, 50, { init: 0 }],
          ['resistance', 'Résistance', 'ochre', -180, -130, 54, { init: 0 }],
          ['plaque', 'Plaque', 'terracotta', -180, 130, 60, { kind: 'stock', init: 0.1, relax: 3 }],
          ['poele', 'Poêle', 'slate', 90, 130, 58, { kind: 'stock', init: 0.1, relax: 5 }],
          ['steak', 'Cœur du steak', 'plum', 360, 130, 60, { kind: 'stock', init: 0.1, relax: 12 }],
        ],
        edges: [
          ['bouton', 'resistance', 1, 0, { weight: 2 }],
          ['resistance', 'plaque', 1, 50],
          ['plaque', 'resistance', -1, 50, { weight: 1.5, delay: 0.5 }],
          ['plaque', 'poele', 1, 0, { weight: 0.4 }],
          ['poele', 'steak', 1, 0, { weight: 0.2 }],
        ],
        story: [
          [
            'Une poêle sur une plaque électrique, un steak dedans. On **allume** la plaque.',
            ['bouton', 'resistance', 'plaque', 'bouton>resistance', 'resistance>plaque'],
            ['bouton', 1],
          ],
          [
            'La **plaque** chauffe la première. Son thermostat coupe la résistance quand elle est trop chaude, et la rallume quand elle refroidit : une **boucle équilibrante**, avec un petit retard. La plaque dépasse un peu, puis se stabilise.',
            ['plaque', 'resistance', 'resistance>plaque', 'plaque>resistance'],
          ],
          [
            'La chaleur passe ensuite à la **poêle**, puis au **cœur du steak**. Chacun est une **accumulation** : chacun chauffe plus lentement, et plus tard, que le précédent. Regarde les courbes : trois S décalés.',
            ['plaque', 'poele', 'steak', 'plaque>poele', 'poele>steak'],
          ],
          [
            'Maintenant **éteins** la plaque (le bas du bouton)… et regarde le cœur du steak : il **continue de cuire** un moment ! La poêle encore chaude lui donne sa chaleur : c’est l’**inertie**.',
            ['bouton', 'poele', 'steak'],
          ],
        ],
      }),
  },
  {
    id: 'proies',
    title: 'Lapins et renards',
    description: 'Plus de lapins nourrit plus de renards… qui mangent les lapins. Deux populations qui s’accumulent : ça oscille, sur une dizaine d’années.',
    level: 2,
    topic: 'nature',
    shows: 'Cycles',
    build: () =>
      doc({
        unit: 'year',
        horizon: 40,
        nodes: [
          ['naissances', 'Naissances', 'ochre', -300, 0, 50],
          ['lapins', 'Lapins', 'sage', 0, 0, 62, STOCK],
          ['renards', 'Renards', 'terracotta', 300, 0, 62, { kind: 'stock', relax: 3 }],
        ],
        edges: [
          ['naissances', 'lapins', 1, 40, { weight: 0.3 }],
          ['lapins', 'naissances', 1],
          ['lapins', 'renards', 1, 40, { weight: 0.5 }],
          ['renards', 'lapins', -1],
        ],
        story: [
          [
            'Des **lapins** qui se reproduisent : plus de lapins, plus de naissances… donc encore plus de lapins. C’est une **boucle renforçante**.',
            ['naissances', 'lapins', 'naissances>lapins', 'lapins>naissances'],
            ['lapins', 1],
          ],
          [
            'Mais les **renards** mangent les lapins. Plus de lapins nourrit plus de renards… qui font baisser les lapins : une **boucle équilibrante**.',
            ['lapins', 'renards', 'lapins>renards', 'renards>lapins'],
          ],
          [
            'Lapins et renards sont des **accumulations** (les boîtes) : une population ne change pas d’un coup, elle se remplit et se vide au fil des années. Les renards ont toujours un temps de retard sur les lapins… d’où les **cycles**.',
            ['lapins', 'renards'],
          ],
          ['Les deux boucles se disputent le contrôle. À toi de jouer : touche le **haut** ou le **bas** des galets, et regarde les courbes.', []],
        ],
      }),
  },
  {
    id: 'magasin',
    title: 'Le stock d’un magasin',
    description: 'Les ventes augmentent, le gérant commande, mais les livraisons prennent 3 semaines… et le rayon finit par déborder.',
    level: 2,
    topic: 'economie',
    shows: 'Oscillations',
    build: () =>
      doc({
        unit: 'week',
        horizon: 40,
        nodes: [
          ['ventes', 'Ventes', 'terracotta', -360, 0, 52],
          ['commandes', 'Commandes', 'ochre', 60, -160, 56],
          ['stock', 'Stock en rayon', 'slate', 60, 160, 62, STOCK],
        ],
        edges: [
          ['ventes', 'stock', -1, 0, { weight: 0.5 }],
          ['ventes', 'commandes', 1, 0, { weight: 0.5 }],
          ['stock', 'commandes', -1, 50, { weight: 0.5 }],
          ['commandes', 'stock', 1, 50, { delay: 3 }],
        ],
        story: [
          [
            'Un magasin de chaussures. Chaque semaine, il **vend**, et il **commande** pour remplir son **rayon**.',
            ['ventes', 'commandes', 'stock'],
          ],
          ['Les livraisons mettent **3 semaines** à arriver : regarde les deux petits traits sur la flèche.', ['commandes', 'stock', 'commandes>stock']],
          ['Soudain, les **ventes** augmentent.', ['ventes', 'ventes>stock', 'ventes>commandes'], ['ventes', 1]],
          [
            'Le rayon se vide. Le gérant commande plus… mais rien n’arrive avant 3 semaines, alors il commande encore plus. Quand tout arrive, le rayon **déborde** ! Puis il commande trop peu… Le stock **oscille**, juste à cause du retard.',
            ['stock', 'commandes', 'stock>commandes', 'commandes>stock'],
          ],
          ['Dans l’éditeur, essaie un délai de livraison d’une semaine, puis de 8 semaines.', ['commandes>stock']],
        ],
      }),
  },
  {
    id: 'banque',
    title: 'Panique bancaire',
    description: 'La peur pousse à retirer son argent, ce qui vide la banque… et nourrit la peur. Même quand la rumeur s’éteint.',
    level: 2,
    topic: 'economie',
    shows: 'Emballement',
    build: () =>
      doc({
        unit: 'day',
        horizon: 10,
        nodes: [
          ['rumeurs', 'Rumeurs', 'sand', -330, -190, 46, { relax: 1 }],
          ['peur', 'Peur', 'plum', 0, -150, 58, { saturate: true }],
          ['retraits', 'Retraits', 'ochre', 210, 110, 58],
          ['reserves', 'Réserves', 'slate', -210, 110, 62, { kind: 'stock', init: 0.8 }],
        ],
        edges: [
          ['rumeurs', 'peur', 1, 20],
          ['peur', 'retraits', 1, -40],
          ['retraits', 'reserves', -1, -40, { weight: 0.5 }],
          ['reserves', 'peur', -1, -40],
        ],
        story: [
          ['Une banque garde l’argent de ses clients dans ses **réserves**.', ['reserves']],
          ['Une **rumeur** court : la banque irait mal…', ['rumeurs', 'peur', 'rumeurs>peur'], ['rumeurs', 1]],
          [
            'La **peur** pousse les clients à **retirer** leur argent. Les réserves baissent… ce qui fait encore plus peur. **Boucle renforçante** : c’est la panique.',
            ['peur', 'retraits', 'reserves', 'peur>retraits', 'retraits>reserves', 'reserves>peur'],
          ],
          ['Regarde la rumeur : elle s’éteint toute seule en un jour ou deux. La panique, elle, continue : la boucle s’entretient toute seule.', ['rumeurs']],
          [
            'Recommence (↺) et, dès le début, **remets de l’argent** dans les réserves (▲). À temps, ça calme la peur : c’est le rôle de la banque centrale, « prêteur en dernier ressort ».',
            ['reserves'],
          ],
        ],
      }),
  },
  {
    id: 'seisme',
    title: 'Tremblement de terre',
    description: 'Les plaques bougent, la tension s’accumule sans bruit… puis se libère d’un coup. Et ça recommence.',
    level: 2,
    topic: 'nature',
    shows: 'Accumulation et largage',
    build: () =>
      doc({
        unit: 'year',
        horizon: 20,
        nodes: [
          ['plaques', 'Plaques', 'sand', -380, 0, 54],
          ['tension', 'Tension', 'ochre', -120, 0, 62, { kind: 'stock', init: 0.1, thresholdMode: 'release', threshold: 0.9 }],
          ['seisme', 'Séisme', 'terracotta', 140, 0, 58, { init: 0 }],
          ['degats', 'Dégâts', 'plum', 380, 0, 54, { kind: 'stock', init: 0 }],
        ],
        edges: [
          ['plaques', 'tension', 1, 0],
          ['tension', 'seisme', 1, 0],
          ['seisme', 'degats', 1, 0, { weight: 0.25 }],
        ],
        story: [
          ['Sous nos pieds, les **plaques** de la croûte terrestre glissent très lentement.', ['plaques'], ['plaques', 1]],
          ['Mais elles frottent et se coincent : la **tension** s’accumule dans la roche, sans bruit. En surface, rien ne se passe…', ['plaques', 'tension', 'plaques>tension']],
          ['… jusqu’au **seuil** : la roche cède d’un coup, et toute la tension accumulée est libérée. C’est le **séisme**.', ['tension', 'seisme', 'tension>seisme']],
          ['Chaque séisme ajoute des **dégâts**. Et la tension recommence à s’accumuler : les séismes reviennent, régulièrement.', ['seisme', 'degats', 'seisme>degats']],
        ],
      }),
  },
  {
    id: 'foret',
    title: 'Forêt et incendies',
    description: 'Avec la sécheresse, le bois mort s’accumule… jusqu’à l’incendie. La forêt repousse, le bois mort revient, le feu aussi.',
    level: 2,
    topic: 'nature',
    shows: 'Feux à répétition',
    build: () =>
      doc({
        unit: 'year',
        horizon: 60,
        nodes: [
          ['secheresse', 'Sécheresse', 'sand', -460, -150, 48],
          ['debroussaillage', 'Débroussaillage', 'sage', -460, 190, 50],
          ['boisMort', 'Bois mort', 'ochre', -170, 30, 60, { kind: 'stock', init: 0.1, thresholdMode: 'release', threshold: 0.7 }],
          ['incendie', 'Incendies', 'terracotta', 150, -140, 56, { init: 0 }],
          ['foret', 'Forêt', 'sage', 160, 200, 64, { kind: 'stock', init: 0.7, relax: 8 }],
        ],
        edges: [
          ['secheresse', 'boisMort', 1, 0, { weight: 0.5 }],
          ['debroussaillage', 'boisMort', -1, 0, { weight: 0.5 }],
          ['boisMort', 'incendie', 1, -40],
          ['incendie', 'foret', -1, -40, { weight: 0.5 }],
          ['foret', 'boisMort', 1, -40, { weight: 0.3 }],
        ],
        story: [
          ['Une **forêt**, avec du **bois mort** au sol : branches, feuilles sèches.', ['foret', 'boisMort']],
          ['Avec la **sécheresse**, le bois mort s’accumule plus vite… en silence.', ['secheresse', 'boisMort', 'secheresse>boisMort'], ['secheresse', 1]],
          [
            'Au-delà d’un seuil, il suffit d’une étincelle : **incendie**. Tout le bois mort brûle d’un coup, et la forêt recule.',
            ['boisMort', 'incendie', 'foret', 'boisMort>incendie', 'incendie>foret'],
          ],
          [
            'La forêt repousse peu à peu, le bois mort se ré-accumule… et le feu revient. Essaie le **débroussaillage** : il retire du bois mort avant qu’il ne s’accumule.',
            ['debroussaillage', 'boisMort', 'debroussaillage>boisMort'],
          ],
        ],
      }),
  },
  {
    id: 'antidouleurs',
    title: 'Antidouleurs et rééducation',
    description: 'La solution rapide soulage tout de suite… mais elle fait négliger la vraie solution, plus lente. Le piège du « transfert de charge ».',
    level: 2,
    topic: 'sante',
    shows: 'Effet pervers',
    build: () =>
      doc({
        unit: 'week',
        horizon: 30,
        nodes: [
          ['blessure', 'Blessure', 'terracotta', -330, 80, 60, { kind: 'stock', init: 0.1 }],
          ['douleur', 'Douleur', 'plum', 0, -70, 58, { init: 0.1 }],
          ['antidouleurs', 'Antidouleurs', 'slate', 340, -70, 54, { init: 0.1 }],
          ['reeducation', 'Rééducation', 'sage', 0, 250, 56, { init: 0.1 }],
        ],
        edges: [
          ['blessure', 'douleur', 1, -40],
          ['douleur', 'antidouleurs', 1, 40, { delay: 0.2 }],
          ['antidouleurs', 'douleur', -1, 40, { weight: 0.8 }],
          ['douleur', 'reeducation', 1, -40, { delay: 2 }],
          ['reeducation', 'blessure', -1, -40, { weight: 0.3 }],
          ['antidouleurs', 'reeducation', -1, 30, { weight: 0.6 }],
        ],
        story: [
          ['Après une chute, une **blessure** au genou. La **douleur** monte.', ['blessure', 'douleur', 'blessure>douleur'], ['blessure', 1]],
          [
            'Solution rapide : les **antidouleurs**. Ils calment la douleur presque tout de suite (une boucle équilibrante rapide).',
            ['douleur', 'antidouleurs', 'douleur>antidouleurs', 'antidouleurs>douleur'],
          ],
          [
            'Solution de fond : la **rééducation**. Elle soigne vraiment la blessure, mais lentement… et on n’y va que si ça fait mal (une boucle équilibrante lente).',
            ['douleur', 'reeducation', 'blessure', 'douleur>reeducation', 'reeducation>blessure'],
          ],
          [
            'Le piège : quand les antidouleurs masquent la douleur, on fait moins sa rééducation. La blessure guérit **moins vite**. C’est le « **transfert de charge** » : la solution rapide affaiblit la vraie solution.',
            ['antidouleurs', 'reeducation', 'antidouleurs>reeducation'],
          ],
          ['Dans l’éditeur, mets la flèche Antidouleurs → Rééducation à sa force minimale, puis compare la courbe de la blessure.', ['antidouleurs>reeducation']],
        ],
      }),
  },
  {
    id: 'peche',
    title: 'Pêche et surexploitation',
    description: 'La pêche rapporte, on construit des bateaux, on pêche plus… jusqu’à ce que les poissons manquent. Mais la flotte, elle, est déjà là.',
    level: 2,
    topic: 'nature',
    shows: 'Dépassement',
    build: () =>
      doc({
        unit: 'year',
        horizon: 50,
        nodes: [
          ['poissons', 'Poissons', 'slate', -330, 0, 64, { kind: 'stock', init: 0.7, relax: 10 }],
          ['captures', 'Captures', 'ochre', 0, 0, 56],
          ['bateaux', 'Bateaux', 'sand', 300, -170, 58, { kind: 'stock', init: 0.3, relax: 12 }],
          ['profits', 'Profits', 'sage', 300, 170, 54],
          ['demande', 'Demande de poisson', 'plum', 580, 170, 48],
          ['quotas', 'Quotas', 'terracotta', 0, -250, 46],
        ],
        edges: [
          ['poissons', 'captures', 1, 40],
          ['captures', 'poissons', -1, 40, { weight: 0.3 }],
          ['bateaux', 'captures', 1, -30, { weight: 0.5 }],
          ['captures', 'profits', 1, -30],
          ['profits', 'bateaux', 1, -70, { weight: 0.6, delay: 5 }],
          ['bateaux', 'profits', -1, -70, { weight: 0.4 }],
          ['demande', 'profits', 1, 0],
          ['quotas', 'captures', -1, 0],
        ],
        story: [
          ['Une mer pleine de **poissons**, quelques **bateaux** de pêche.', ['poissons', 'bateaux']],
          ['La **demande** de poisson augmente : la pêche rapporte gros.', ['demande', 'profits', 'demande>profits'], ['demande', 1]],
          [
            'Avec les **profits**, on construit de nouveaux bateaux (il faut 5 ans). Plus de bateaux, plus de captures, plus de profits : une **boucle renforçante**.',
            ['bateaux', 'captures', 'profits', 'bateaux>captures', 'captures>profits', 'profits>bateaux'],
          ],
          [
            'Mais on pêche plus vite que les poissons ne se reproduisent. Quand ils se font rares, les captures baissent… alors que les bateaux, eux, coûtent toujours. Les profits fondent, mais trop tard : la flotte est déjà construite, bien trop grande. Elle **dépasse** ce que la mer peut nourrir.',
            ['poissons', 'captures', 'bateaux', 'poissons>captures', 'captures>poissons', 'bateaux>profits'],
          ],
          ['Recommence (↺) et essaie des **quotas** dès le début, puis seulement après l’effondrement.', ['quotas', 'quotas>captures']],
        ],
      }),
  },
  {
    id: 'epidemie',
    title: 'Épidémie',
    description: 'Chaque malade en contamine d’autres… jusqu’à ce qu’il n’y ait plus grand monde à contaminer. Et les gestes barrières aplatissent la courbe.',
    level: 2,
    topic: 'sante',
    shows: 'Courbe en cloche',
    build: () =>
      doc({
        unit: 'day',
        horizon: 60,
        nodes: [
          ['sains', 'Personnes saines', 'sage', -440, 60, 62, { kind: 'stock', init: 1 }],
          ['contagions', 'Contagions', 'terracotta', -160, -120, 54, { init: 0 }],
          ['malades', 'Malades', 'plum', 110, 60, 62, { kind: 'stock', init: 0 }],
          ['guerisons', 'Guérisons', 'ochre', 360, -120, 52, { init: 0 }],
          ['gueris', 'Guéris', 'slate', 600, 60, 58, { kind: 'stock', init: 0 }],
          ['gestes', 'Gestes barrières', 'sand', -160, -360, 48],
        ],
        edges: [
          ['sains', 'contagions', 1, 30, { weight: 0.8 }],
          ['contagions', 'sains', -1, 30, { weight: 0.3 }],
          ['malades', 'contagions', 1, 30],
          ['contagions', 'malades', 1, 30, { weight: 0.3 }],
          ['malades', 'guerisons', 1, 30, { weight: 0.07 }],
          ['guerisons', 'malades', -1, 30],
          ['guerisons', 'gueris', 1, 0],
          ['gestes', 'contagions', -1, 0, { weight: 0.5 }],
        ],
        story: [
          ['Une ville en bonne santé. Arrivent les premiers **malades**.', ['malades', 'sains'], ['malades', 1]],
          [
            'Chaque malade en contamine d’autres : plus de malades, plus de **contagions**, encore plus de malades. **Boucle renforçante** : l’épidémie démarre.',
            ['malades', 'contagions', 'malades>contagions', 'contagions>malades'],
          ],
          [
            'Mais il reste de moins en moins de **personnes saines** à contaminer, et les malades **guérissent** : l’épidémie ralentit, puis s’éteint. La courbe des malades fait une **cloche**.',
            ['sains', 'contagions', 'guerisons', 'gueris', 'contagions>sains', 'sains>contagions', 'malades>guerisons', 'guerisons>malades'],
          ],
          ['Recommence (↺) et active les **gestes barrières** dès le début : la cloche est plus basse et plus étalée. C’est « **aplatir la courbe** ».', ['gestes', 'gestes>contagions']],
        ],
      }),
  },
  {
    id: 'albedo',
    title: 'Banquise et albédo',
    description: 'La glace renvoie la lumière du soleil. Quand elle fond, la mer sombre absorbe plus de chaleur… jusqu’au point de bascule.',
    level: 2,
    topic: 'climat',
    shows: 'Point de bascule',
    build: () =>
      doc({
        unit: 'year',
        horizon: 60,
        reveal: true,
        nodes: [
          ['co2', 'CO₂', 'plum', -330, -190, 46, { init: 0.3 }],
          ['temp', 'Température', 'terracotta', 0, -150, 64, { kind: 'stock', relax: 4 }],
          ['fonte', 'Fonte des glaces', 'slate', 210, 110, 64, { kind: 'stock', init: 0.3, relax: 3, thresholdMode: 'tip', threshold: 0.65 }],
          ['albedo', 'Albédo', 'sand', -210, 110, 58, { init: 0.7 }],
        ],
        edges: [
          ['co2', 'temp', 1, 20, { weight: 0.2 }],
          ['temp', 'fonte', 1, -40, { weight: 0.5, delay: 3 }],
          ['fonte', 'albedo', -1, -40],
          ['albedo', 'temp', -1, -40, { weight: 0.15 }],
        ],
        story: [
          [
            'Voici la **température** moyenne de la planète. C’est une **accumulation** : elle se réchauffe tant qu’elle reçoit plus d’énergie qu’elle n’en perd, puis se stabilise.',
            ['temp'],
          ],
          ['Nos émissions de **CO₂** la font monter : c’est l’effet de serre.', ['co2', 'co2>temp'], ['co2', 1]],
          [
            'Plus il fait chaud, plus la **banquise fond**… avec un temps de retard d’environ 3 ans (les deux petits traits sur le lien). Si le froid revient, elle se reforme peu à peu.',
            ['fonte', 'temp>fonte'],
          ],
          ['Or la glace est blanche : elle renvoie la lumière du soleil, c’est l’**albédo**. Moins de glace, moins d’albédo.', ['albedo', 'fonte>albedo']],
          [
            'Et moins de lumière renvoyée, c’est plus de chaleur absorbée. La boucle est bouclée : une **boucle renforçante**, le réchauffement s’entretient tout seul.',
            ['temp', 'fonte', 'albedo', 'temp>fonte', 'fonte>albedo', 'albedo>temp'],
          ],
          [
            'Les pointillés rouges marquent un **point de bascule** : au-delà, la fonte devient irréversible. À toi : ramène le CO₂ à son niveau de départ avant qu’il ne soit trop tard… ou essaie de revenir en arrière après.',
            [],
          ],
        ],
      }),
  },

  // --- Niveau 3 : systèmes complexes ---------------------------------------------------
  {
    id: 'limites',
    title: 'Limites à la croissance',
    description: 'Le modèle du rapport Meadows (1972), en tout petit : une population qui croît, des ressources qui s’épuisent, de la pollution. Dépassement, puis déclin.',
    level: 3,
    topic: 'societe',
    shows: 'Dépassement et déclin',
    build: () =>
      doc({
        unit: 'year',
        horizon: 200,
        nodes: [
          ['naissances', 'Naissances', 'ochre', -540, -140, 50, { init: 0.3 }],
          ['population', 'Population', 'sage', -260, -140, 64, { kind: 'stock', init: 0.3, saturate: true, relax: 60 }],
          ['extraction', 'Extraction', 'sand', 40, -290, 52, { init: 0 }],
          ['ressources', 'Ressources', 'sand', 340, -290, 64, { kind: 'stock', init: 0.9 }],
          ['production', 'Production', 'slate', 320, -20, 58],
          ['niveau', 'Niveau de vie', 'ochre', 40, 80, 56],
          ['pollution', 'Pollution', 'plum', 340, 250, 58, { kind: 'stock', init: 0.1, relax: 30 }],
          ['mortalite', 'Mortalité', 'terracotta', -220, 190, 54, { init: 0.3 }],
        ],
        edges: [
          ['population', 'naissances', 1, 40],
          ['naissances', 'population', 1, 40, { weight: 0.06 }],
          ['population', 'extraction', 1, 0],
          ['extraction', 'ressources', -1, 0, { weight: 0.01 }],
          ['ressources', 'production', 1, 0, { weight: 0.3 }],
          ['population', 'production', 1, 0],
          ['production', 'niveau', 1, 0],
          ['population', 'niveau', -1, 0],
          ['niveau', 'mortalite', -1, 0],
          ['mortalite', 'population', -1, 0, { weight: 0.1 }],
          ['extraction', 'pollution', 1, 0, { weight: 0.012, delay: 20 }],
          ['pollution', 'mortalite', 1, 0, { weight: 0.25 }],
        ],
        story: [
          [
            'Le modèle du rapport Meadows (*Les limites à la croissance*, 1972), en tout petit : une **population**, sa **production**, des **ressources** qui ne se renouvellent pas, et de la **pollution**.',
            [],
          ],
          [
            'La population fait des enfants, qui font des enfants : une **boucle renforçante**, la croissance exponentielle.',
            ['population', 'naissances', 'population>naissances', 'naissances>population'],
            ['population', 1],
          ],
          [
            'Plus de monde, plus de **production**… mais aussi plus d’**extraction** : les ressources s’épuisent, et la production finit par ne plus suivre la population. Le **niveau de vie** baisse.',
            ['population', 'extraction', 'ressources', 'production', 'niveau', 'population>extraction', 'extraction>ressources', 'ressources>production', 'production>niveau', 'population>niveau'],
          ],
          [
            'Un niveau de vie plus bas, et une **pollution** qui arrive avec des décennies de retard, augmentent la **mortalité**. La population **dépasse** ce que le système peut supporter, puis décline.',
            ['niveau', 'pollution', 'mortalite', 'population', 'niveau>mortalite', 'extraction>pollution', 'pollution>mortalite', 'mortalite>population'],
          ],
          [
            'Ce n’est pas une prévision, c’est un **mécanisme** : croissance exponentielle, limites, retards. Le vrai modèle, World3, compte des centaines d’équations : il viendra plus tard dans aledloop.',
            [],
          ],
        ],
      }),
  },
  {
    id: 'bce',
    title: 'La BCE monte ses taux',
    description: 'Comment une hausse du taux directeur freine l’inflation : par l’euro, vite, et par le crédit, lentement. Et le risque d’en faire trop.',
    level: 3,
    topic: 'economie',
    shows: 'Délais de transmission',
    build: () =>
      doc({
        unit: 'month',
        horizon: 60,
        nodes: [
          ['choc', 'Choc sur les prix', 'sand', -660, 40, 48],
          ['inflation', 'Inflation', 'terracotta', -380, 40, 64, { kind: 'stock', relax: 12 }],
          ['taux', 'Taux directeur', 'slate', -120, -250, 58],
          ['euro', 'Euro', 'sage', 190, -320, 48],
          ['importes', 'Prix importés', 'ochre', 60, -90, 52],
          ['credit', 'Taux des crédits', 'slate', 430, -160, 54],
          ['emprunts', 'Nouveaux crédits', 'sand', 520, 100, 54],
          ['invest', 'Investissement et immobilier', 'ochre', 320, 310, 60],
          ['activite', 'Activité', 'sage', -40, 310, 64, { kind: 'stock', relax: 12 }],
        ],
        edges: [
          ['choc', 'inflation', 1, 0, { weight: 0.1 }],
          ['inflation', 'taux', 1, -30, { weight: 1.5, delay: 3 }],
          ['taux', 'euro', 1, -20],
          ['euro', 'importes', -1, -20],
          ['importes', 'inflation', 1, 20, { weight: 0.05 }],
          ['taux', 'credit', 1, -30, { delay: 2 }],
          ['credit', 'emprunts', -1, -30],
          ['emprunts', 'invest', 1, -30, { delay: 6 }],
          ['invest', 'activite', 1, -30, { weight: 0.15 }],
          ['activite', 'inflation', 1, -30, { weight: 0.08, delay: 6 }],
        ],
        story: [
          [
            'Comment la **BCE** combat l’inflation. Tout part d’un **choc sur les prix** : l’énergie flambe, l’**inflation** grimpe.',
            ['choc', 'inflation', 'choc>inflation'],
            ['choc', 1],
          ],
          [
            'La BCE réagit en montant son **taux directeur**… après quelques mois : elle attend de voir les chiffres.',
            ['inflation', 'taux', 'inflation>taux'],
          ],
          [
            'Premier canal, rapide : l’**euro** s’apprécie, les **prix importés** baissent, l’inflation recule un peu.',
            ['taux', 'euro', 'importes', 'inflation', 'taux>euro', 'euro>importes', 'importes>inflation'],
          ],
          [
            'Deuxième canal, lent : les banques remontent le **taux des crédits**, on emprunte moins, l’**investissement** et l’**immobilier** ralentissent… puis toute l’**activité**.',
            ['taux', 'credit', 'emprunts', 'invest', 'activite', 'taux>credit', 'credit>emprunts', 'emprunts>invest', 'invest>activite'],
          ],
          [
            'Moins d’activité, moins d’inflation… un à deux ans plus tard. Ce sont les fameux « délais longs et variables » de la politique monétaire.',
            ['activite', 'inflation', 'activite>inflation'],
          ],
          [
            'Le risque : l’effet arrive si tard que la BCE peut serrer **trop longtemps**, et provoquer une récession. Touche l’étiquette **B** de la grande boucle : « Son rythme » le montre. (Mécanisme illustratif, pas une prévision.)',
            [],
          ],
        ],
      }),
  },
  {
    id: 'salaires',
    title: 'Choc pétrolier et spirale prix-salaires',
    description: 'Le pétrole flambe, les prix suivent, les salaires rattrapent… et relancent les prix. Années 1970 contre 2022 : tout dépend de l’indexation.',
    level: 3,
    topic: 'economie',
    shows: 'Spirale',
    build: () =>
      doc({
        unit: 'month',
        horizon: 48,
        nodes: [
          ['petrole', 'Prix du pétrole', 'plum', -640, -60, 50],
          ['couts', 'Coûts des entreprises', 'ochre', -340, -60, 58],
          ['prix', 'Prix', 'terracotta', -30, -200, 64, STOCK],
          ['salaires', 'Salaires', 'sage', -30, 170, 60],
          ['pouvoir', 'Pouvoir d’achat', 'slate', 300, 30, 56],
          ['demande', 'Demande', 'sand', 300, -290, 54],
        ],
        edges: [
          ['petrole', 'couts', 1, 0, { weight: 0.5 }],
          ['couts', 'prix', 1, -40, { weight: 0.3 }],
          ['prix', 'salaires', 1, -40, { weight: 0.3, delay: 12 }],
          ['salaires', 'couts', 1, -40, { weight: 0.5 }],
          ['prix', 'pouvoir', -1, 40],
          ['pouvoir', 'demande', 1, 40],
          ['demande', 'prix', 1, 40, { weight: 0.3 }],
          ['salaires', 'pouvoir', 1, 0],
        ],
        story: [
          [
            'Le **prix du pétrole** flambe (1973, 1979, 2022…). Les **coûts** des entreprises montent, et elles augmentent leurs **prix**.',
            ['petrole', 'couts', 'prix', 'petrole>couts', 'couts>prix'],
            ['petrole', 1],
          ],
          [
            'Les prix montent : le **pouvoir d’achat** baisse. Les salariés demandent des hausses de **salaires**… obtenues environ un an plus tard (le retard sur la flèche).',
            ['prix', 'pouvoir', 'salaires', 'prix>pouvoir', 'prix>salaires'],
          ],
          [
            'Mais des salaires plus élevés, ce sont des coûts plus élevés, donc des prix encore plus hauts : la **spirale prix-salaires**, une **boucle renforçante**.',
            ['prix', 'salaires', 'couts', 'prix>salaires', 'salaires>couts', 'couts>prix'],
          ],
          [
            'En face, une **boucle équilibrante** freine : moins de pouvoir d’achat, moins de **demande**, ce qui modère les prix.',
            ['prix', 'pouvoir', 'demande', 'prix>pouvoir', 'pouvoir>demande', 'demande>prix'],
          ],
          [
            'Qui gagne ? Ça dépend de la force du lien Prix → Salaires : l’**indexation**. Ici, les salaires rattrapent un tiers de l’inflation, comme en 2022 : les prix montent d’un cran, puis se calment. Dans les années 1970, avec l’échelle mobile des salaires, c’était presque tout : monte cette force au maximum dans l’éditeur, et regarde la spirale.',
            ['prix>salaires'],
          ],
        ],
      }),
  },
  {
    id: 'petrole',
    title: 'Le cycle du pétrole',
    description: 'Prix hauts, on investit ; cinq ans plus tard, trop de pétrole, les prix s’effondrent ; on arrête d’investir… et le manque revient.',
    level: 3,
    topic: 'geopolitique',
    shows: 'Cycle d’investissement',
    build: () =>
      doc({
        unit: 'year',
        horizon: 40,
        nodes: [
          ['demande', 'Demande mondiale', 'plum', -560, -120, 52],
          ['prix', 'Prix du pétrole', 'terracotta', -230, -120, 64],
          ['invest', 'Investissement', 'ochre', 170, -200, 58],
          ['capacite', 'Capacité de production', 'slate', 170, 150, 64, { kind: 'stock', relax: 15 }],
          ['opep', 'Quotas de l’OPEP', 'sand', -230, 230, 50],
        ],
        edges: [
          ['demande', 'prix', 1, 40],
          ['prix', 'demande', -1, 40, { weight: 0.15, delay: 2 }],
          ['prix', 'invest', 1, -40, { delay: 1 }],
          ['invest', 'capacite', 1, -40, { weight: 0.45, delay: 5 }],
          ['capacite', 'prix', -1, -40],
          ['opep', 'prix', 1, 0],
        ],
        story: [
          ['La **demande** mondiale de pétrole augmente : le **prix** monte.', ['demande', 'prix', 'demande>prix'], ['demande', 1]],
          ['Prix élevé : les compagnies **investissent** dans de nouveaux gisements…', ['prix', 'invest', 'prix>invest']],
          [
            '… mais un champ pétrolier met **5 ans** à produire. Pendant ce temps, le prix reste haut, et on investit encore.',
            ['invest', 'capacite', 'invest>capacite'],
          ],
          [
            'Quand tout arrive, la **capacité** déborde : le prix s’effondre, les investissements s’arrêtent… et quelques années plus tard, on manque de pétrole. Le **cycle** recommence.',
            ['prix', 'invest', 'capacite', 'prix>invest', 'invest>capacite', 'capacite>prix'],
          ],
          [
            'Le pétrole de **schiste** américain se met en production en moins d’un an. Dans l’éditeur, raccourcis le retard Investissement → Capacité à 1 an : le cycle se calme. L’**OPEP**, elle, joue sur les quotas pour soutenir les prix.',
            ['invest>capacite', 'opep'],
          ],
        ],
      }),
  },
  {
    id: 'doomloop',
    title: 'Boucle souverains-banques',
    description: 'Zone euro, 2011 : la dette de l’État fragilise les banques, qui fragilisent l’État. Jusqu’au « whatever it takes » de Mario Draghi.',
    level: 3,
    topic: 'economie',
    shows: 'Cercle vicieux',
    build: () =>
      doc({
        unit: 'month',
        horizon: 36,
        nodes: [
          ['grece', 'Crise grecque', 'sand', -620, -230, 48],
          ['spread', 'Spread italien', 'terracotta', -280, -120, 64, { kind: 'stock', relax: 6 }],
          ['obligations', 'Obligations des banques', 'ochre', 60, -260, 56],
          ['banques', 'Solidité des banques', 'slate', 320, -40, 64, { kind: 'stock', relax: 12 }],
          ['sauvetage', 'Risque de sauvetage par l’État', 'plum', 40, 140, 56],
          ['credit', 'Crédit aux entreprises', 'sage', 420, 270, 54],
          ['croissance', 'Croissance', 'sage', -80, 350, 54],
          ['bce', '« Whatever it takes »', 'slate', -620, 80, 54],
        ],
        edges: [
          ['grece', 'spread', 1, 0, { weight: 0.3 }],
          ['spread', 'obligations', -1, -40],
          ['obligations', 'banques', 1, -40, { weight: 0.15 }],
          ['banques', 'sauvetage', -1, -40],
          ['sauvetage', 'spread', 1, -40, { weight: 0.15 }],
          ['banques', 'credit', 1, -20],
          ['credit', 'croissance', 1, -20],
          ['croissance', 'spread', -1, -20, { weight: 0.2 }],
          ['bce', 'spread', -1, 0, { weight: 2 }],
        ],
        story: [
          [
            '2010 : la **crise grecque** inquiète les marchés. Le **spread** italien (le surcoût que paie l’Italie pour emprunter, comparé à l’Allemagne) se tend.',
            ['grece', 'spread', 'grece>spread'],
            ['grece', 1],
          ],
          [
            'Les banques italiennes détiennent beaucoup de dette italienne. Quand le spread monte, ces **obligations** perdent de la valeur : les **banques** s’affaiblissent.',
            ['spread', 'obligations', 'banques', 'spread>obligations', 'obligations>banques'],
          ],
          [
            'Des banques fragiles, c’est un **sauvetage** possible par l’État… donc plus de dette publique : le spread monte encore. C’est la **boucle souverains-banques**.',
            ['banques', 'sauvetage', 'spread', 'banques>sauvetage', 'sauvetage>spread'],
          ],
          [
            'Et des banques fragiles prêtent moins : moins de **crédit**, moins de **croissance**, des finances publiques plus fragiles. Une deuxième **boucle renforçante**.',
            ['banques', 'credit', 'croissance', 'spread', 'banques>credit', 'credit>croissance', 'croissance>spread'],
          ],
          [
            'Juillet 2012 : Mario Draghi promet que la BCE fera « **tout ce qu’il faudra** ». Touche le haut de ce galet : le spread se détend, et les deux boucles repartent dans l’autre sens.',
            ['bce', 'spread', 'bce>spread'],
          ],
        ],
      }),
  },
  {
    id: 'dettePublique',
    title: 'Dette publique et boule de neige',
    description: 'Quand les taux montent, la charge de la dette ne grimpe que lentement… puis la boule de neige s’installe. Sauf si la croissance suit.',
    level: 3,
    topic: 'economie',
    shows: 'Boule de neige',
    build: () =>
      doc({
        unit: 'year',
        horizon: 30,
        nodes: [
          ['taux', 'Taux d’intérêt', 'slate', -520, -190, 52],
          ['charge', 'Charge d’intérêts', 'terracotta', -200, -190, 58],
          ['deficit', 'Déficit', 'ochre', 140, -30, 58],
          ['dette', 'Dette publique', 'plum', -200, 130, 64, STOCK],
          ['recettes', 'Recettes fiscales', 'sage', 460, -170, 54],
          ['croissance', 'Croissance', 'sage', 460, 210, 54],
        ],
        edges: [
          ['taux', 'charge', 1, 0, { delay: 7 }],
          ['dette', 'charge', 1, -40, { weight: 0.3 }],
          ['charge', 'deficit', 1, -40],
          ['deficit', 'dette', 1, -40, { weight: 0.1 }],
          ['croissance', 'recettes', 1, 0],
          ['recettes', 'deficit', -1, 0],
          ['croissance', 'dette', -1, 30, { weight: 0.1 }],
        ],
        story: [
          ['Un État a une **dette publique**. Chaque année, il paie des **intérêts** dessus.', ['dette', 'charge', 'dette>charge']],
          [
            'Les **taux** remontent. Mais la charge d’intérêts ne grimpe que **progressivement** : l’État a emprunté pour 8 ans en moyenne, et seuls les nouveaux emprunts coûtent plus cher (le retard de 7 ans sur la flèche).',
            ['taux', 'charge', 'taux>charge'],
            ['taux', 1],
          ],
          [
            'Plus d’intérêts, plus de **déficit**, plus de dette… donc encore plus d’intérêts : l’**effet boule de neige**, une boucle renforçante.',
            ['charge', 'deficit', 'dette', 'charge>deficit', 'deficit>dette', 'dette>charge'],
          ],
          [
            'La **croissance** joue contre : elle remplit les caisses (**recettes fiscales**) et allège le poids de la dette. Toute la question : qui va le plus vite, les taux ou la croissance ? Touche le haut de Croissance pour voir.',
            ['croissance', 'recettes', 'deficit', 'croissance>recettes', 'recettes>deficit', 'croissance>dette'],
          ],
        ],
      }),
  },
  {
    id: 'mutuelle',
    title: 'Une mutuelle d’assurance',
    description: 'Les sinistres augmentent : la mutuelle perd de l’argent, relève ses cotisations avec retard… et voit partir ses meilleurs sociétaires. Cycle de souscription, réserves et antisélection.',
    level: 3,
    topic: 'economie',
    shows: 'Antisélection',
    build: () =>
      doc({
        unit: 'year',
        horizon: 20,
        nodes: [
          ['sinistralite', 'Sinistralité', 'sand', -620, -260, 56],
          ['prevention', 'Prévention', 'sage', -900, -260, 50],
          ['cout', 'Coût moyen d’un sociétaire', 'terracotta', -320, -260, 60],
          ['marge', 'Marge', 'ochre', -20, -260, 56],
          ['cotisation', 'Cotisation', 'ochre', -20, 60, 64, STOCK],
          ['rentabilite', 'Rentabilité', 'plum', 280, -260, 58],
          ['reserves', 'Réserves', 'plum', 280, 60, 64, { kind: 'stock', init: 0.6 }],
          ['concurrents', 'Prix des concurrents', 'slate', -620, 320, 54],
          ['ecart', 'Écart avec la concurrence', 'slate', -320, 320, 56],
          ['societaires', 'Sociétaires', 'sage', 580, 320, 64, { kind: 'stock', relax: 6 }],
          ['risque', 'Profil de risque', 'terracotta', -320, 40, 60, { kind: 'stock', relax: 5 }],
        ],
        edges: [
          ['prevention', 'sinistralite', -1, 0, { weight: 0.5, delay: 2 }],
          ['sinistralite', 'cout', 1, 0],
          ['risque', 'cout', 1, 0],
          ['cout', 'marge', -1, 0],
          ['cotisation', 'marge', 1, 30],
          ['marge', 'cotisation', -1, 30, { weight: 0.8, delay: 1.5 }],
          ['marge', 'rentabilite', 1, 0],
          ['societaires', 'rentabilite', 1, 0, { weight: 0.3 }],
          ['rentabilite', 'reserves', 1, 0, { weight: 0.3 }],
          ['reserves', 'cotisation', -1, 0, { weight: 0.15 }],
          ['sinistralite', 'concurrents', 1, 0, { delay: 1.5 }],
          ['cotisation', 'ecart', 1, 0],
          ['concurrents', 'ecart', -1, 0],
          ['ecart', 'societaires', -1, 0, { weight: 0.3 }],
          ['ecart', 'risque', 1, 0, { weight: 0.1 }],
        ],
        story: [
          [
            'Une **mutuelle** n’a pas d’actionnaires : ce sont ses **sociétaires** qui la possèdent. Chacun paie une **cotisation**, et la mutuelle rembourse les sinistres. Ce qui reste fait sa **rentabilité**, mise de côté dans ses **réserves**.',
            ['societaires', 'cotisation', 'rentabilite', 'reserves', 'rentabilite>reserves'],
          ],
          [
            'Ce que coûte un sociétaire en moyenne dépend de deux choses : la **sinistralité** (combien de sinistres, et à quel prix) et le **profil de risque** des personnes assurées.',
            ['sinistralite', 'risque', 'cout', 'sinistralite>cout', 'risque>cout'],
          ],
          [
            'La **marge**, c’est la cotisation moins ce coût moyen. Avec beaucoup de sociétaires, une petite marge fait une bonne rentabilité.',
            ['cout', 'cotisation', 'marge', 'rentabilite', 'societaires', 'cout>marge', 'cotisation>marge', 'marge>rentabilite', 'societaires>rentabilite'],
          ],
          [
            'Les sinistres augmentent durablement : soins plus chers, catastrophes climatiques plus fréquentes, réparations plus coûteuses.',
            ['sinistralite', 'cout', 'sinistralite>cout'],
            ['sinistralite', 1],
          ],
          [
            'Le coût grimpe tout de suite, la marge devient négative : la **rentabilité** plonge et les **réserves** fondent. Pourtant la cotisation ne bouge pas encore.',
            ['cout', 'marge', 'rentabilite', 'reserves', 'marge>rentabilite', 'rentabilite>reserves'],
          ],
          [
            'Il faut un an et demi pour constater les chiffres et refaire les tarifs (le retard). Puis les actuaires relèvent la **cotisation** pour retrouver une marge : une **boucle équilibrante**.',
            ['marge', 'cotisation', 'marge>cotisation', 'cotisation>marge'],
          ],
          [
            'À cause du retard, ils corrigent un peu tard, dépassent la cible, puis redescendent : c’est le **cycle de souscription**, que tous les assureurs connaissent. Regarde la courbe de la cotisation.',
            ['cotisation', 'marge'],
          ],
          [
            'Les **réserves** servent d’amortisseur. Confortables, elles permettent d’augmenter moins vite. Entamées, elles obligent à augmenter davantage : le régulateur exige une solidité minimale.',
            ['reserves', 'cotisation', 'reserves>cotisation', 'rentabilite>reserves'],
          ],
          [
            'Les **concurrents** subissent la même sinistralité, mais ils réagissent à leur propre rythme. Si la mutuelle augmente avant eux, l’**écart** se creuse, et des **sociétaires** partent.',
            ['sinistralite', 'concurrents', 'ecart', 'societaires', 'sinistralite>concurrents', 'cotisation>ecart', 'concurrents>ecart', 'ecart>societaires'],
          ],
          [
            'Et pas n’importe lesquels : ceux qui partent sont surtout ceux qui coûtent peu (jeunes, en bonne santé, sans sinistre), car ils trouvent facilement moins cher ailleurs. Le **profil de risque** se dégrade : c’est l’**antisélection**.',
            ['ecart', 'risque', 'ecart>risque'],
          ],
          [
            'Un profil plus risqué coûte plus cher, donc il faut encore augmenter… ce qui fait partir d’autres bons risques. Une **boucle renforçante** : la spirale de l’antisélection, la hantise des assureurs.',
            ['cotisation', 'ecart', 'risque', 'cout', 'marge', 'cotisation>ecart', 'ecart>risque', 'risque>cout', 'cout>marge', 'marge>cotisation'],
          ],
          [
            'Ici, elle reste contenue : les concurrents finissent par augmenter aussi, l’écart se referme, les départs cessent et de nouveaux sociétaires arrivent. Regarde les courbes.',
            ['ecart', 'societaires', 'risque', 'reserves'],
          ],
          [
            'Expérience : recommence (↺) après avoir monté la force du lien Écart → Profil de risque à 0,5 (des sociétaires très mobiles, qui comparent en ligne). La spirale l’emporte : la mutuelle perd ses sociétaires et ses réserves.',
            ['ecart>risque'],
          ],
          [
            'Le levier de long terme, c’est la **prévention** (dépistage, conseils, travaux contre les inondations) : elle fait baisser la sinistralité, avec deux ans de retard. Recommence en l’activant dès le début.',
            ['prevention', 'sinistralite', 'prevention>sinistralite'],
          ],
        ],
      }),
  },
  {
    id: 'immobilier',
    title: 'Immobilier et taux',
    description: 'Les taux montent : les ventes chutent tout de suite, les prix baissent lentement, et les chantiers manqueront dans trois ans.',
    level: 3,
    topic: 'economie',
    shows: 'Cycle immobilier',
    build: () =>
      doc({
        unit: 'year',
        horizon: 15,
        nodes: [
          ['taux', 'Taux des crédits', 'slate', -620, -60, 50],
          ['capacite', 'Capacité d’emprunt', 'sage', -360, -60, 56],
          ['demande', 'Demande de logements', 'ochre', -90, -60, 60],
          ['ventes', 'Ventes', 'sand', -90, -300, 50],
          ['prix', 'Prix des logements', 'terracotta', 230, -60, 64, STOCK],
          ['anticipations', 'Anticipation de hausse', 'plum', 230, -310, 52],
          ['construction', 'Mises en chantier', 'ochre', 500, 160, 54],
          ['parc', 'Logements disponibles', 'slate', 140, 230, 60, { kind: 'stock', relax: 20 }],
        ],
        edges: [
          ['taux', 'capacite', -1, 0],
          ['capacite', 'demande', 1, 0],
          ['demande', 'ventes', 1, 0],
          ['demande', 'prix', 1, 40, { weight: 0.15 }],
          ['prix', 'demande', -1, 40, { weight: 0.3 }],
          ['prix', 'anticipations', 1, 30, { delay: 0.5 }],
          ['anticipations', 'demande', 1, 30, { weight: 0.2 }],
          ['prix', 'construction', 1, -30, { delay: 0.5 }],
          ['construction', 'parc', 1, -30, { weight: 0.3, delay: 2 }],
          ['parc', 'prix', -1, -30, { weight: 0.3 }],
        ],
        story: [
          ['Les **taux des crédits** remontent, comme en 2022-2023.', ['taux', 'capacite', 'taux>capacite'], ['taux', 1]],
          [
            'Les ménages peuvent emprunter moins : la **demande** chute, et les **ventes** s’effondrent tout de suite.',
            ['capacite', 'demande', 'ventes', 'capacite>demande', 'demande>ventes'],
          ],
          [
            'Les **prix**, eux, baissent lentement : les vendeurs attendent avant de baisser. Et quand les prix baissent, personne ne se presse d’acheter : les **anticipations** jouent dans le même sens (une boucle renforçante).',
            ['prix', 'anticipations', 'demande', 'demande>prix', 'prix>anticipations', 'anticipations>demande'],
          ],
          [
            'Les promoteurs lancent moins de **chantiers**… et dans deux ou trois ans, il manquera des **logements** : les prix repartiront. Les retards fabriquent un **cycle**.',
            ['prix', 'construction', 'parc', 'prix>construction', 'construction>parc', 'parc>prix'],
          ],
        ],
      }),
  },
  {
    id: 'gaz',
    title: 'Le gaz russe et l’industrie européenne',
    description: '2022 : le gaz russe est coupé, les prix explosent. Le GNL et les économies d’énergie les ramènent, mais l’industrie met longtemps à revenir.',
    level: 3,
    topic: 'geopolitique',
    shows: 'Choc et adaptation',
    build: () =>
      doc({
        unit: 'month',
        horizon: 36,
        nodes: [
          ['coupure', 'Gaz russe coupé', 'plum', -620, -120, 50, { init: 0 }],
          ['prixGaz', 'Prix du gaz', 'terracotta', -290, -40, 64],
          ['gnl', 'Importations de GNL', 'slate', 70, -290, 58, { kind: 'stock', relax: 24 }],
          ['sobriete', 'Économies d’énergie', 'sage', 130, 50, 56],
          ['electricite', 'Prix de l’électricité', 'ochre', -290, 270, 56],
          ['industrie', 'Industrie énergivore', 'sand', 60, 300, 60, { kind: 'stock', relax: 12 }],
        ],
        edges: [
          ['coupure', 'prixGaz', 1, 0, { weight: 1.5 }],
          ['prixGaz', 'gnl', 1, 40, { weight: 0.08, delay: 6 }],
          ['gnl', 'prixGaz', -1, 40],
          ['prixGaz', 'sobriete', 1, 40, { delay: 2 }],
          ['sobriete', 'prixGaz', -1, 40, { weight: 0.5 }],
          ['prixGaz', 'electricite', 1, 0],
          ['electricite', 'industrie', -1, 0, { weight: 0.08 }],
        ],
        story: [
          ['Avant 2022, l’Europe importait une grande partie de son gaz de Russie, par gazoduc.', ['coupure', 'prixGaz']],
          [
            'Le gaz russe est **coupé** : le **prix du gaz** explose, et avec lui le **prix de l’électricité**.',
            ['coupure', 'prixGaz', 'electricite', 'coupure>prixGaz', 'prixGaz>electricite'],
            ['coupure', 1],
          ],
          [
            'L’**industrie** qui consomme beaucoup d’énergie (chimie, acier, engrais) réduit sa production.',
            ['electricite', 'industrie', 'electricite>industrie'],
          ],
          [
            'Deux **boucles équilibrantes** se mettent en marche, avec retard : les **importations de GNL** par bateau (il faut des terminaux et des contrats) et les **économies d’énergie**. Le prix redescend en un an environ…',
            ['prixGaz', 'gnl', 'sobriete', 'prixGaz>gnl', 'gnl>prixGaz', 'prixGaz>sobriete', 'sobriete>prixGaz'],
          ],
          ['… mais l’industrie, elle, met bien plus longtemps à revenir. (Mécanisme illustratif, pas une prévision.)', ['industrie']],
        ],
      }),
  },
];

/** Toute la bibliothèque : les premiers exemples, puis les suivants (industrie, nature, société, histoire, ingénierie…). */
export const EXAMPLES: Example[] = [...BASE_EXAMPLES, ...MORE_EXAMPLES];
