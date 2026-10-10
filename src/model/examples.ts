import type { ColorKey } from '../theme';
import { defaultCausal, emptyStory, type CausalProps, type Doc, type Polarity, type Story, type SysEdge } from './types';

export interface Example {
  id: string;
  title: string;
  description: string;
  build(): Doc;
}

type N = [id: string, label: string, color: ColorKey, x: number, y: number, r?: number, causal?: Partial<CausalProps>];
type E = [from: string, to: string, polarity: Polarity, bend?: number, extra?: Partial<Pick<SysEdge, 'weight' | 'delay'>>];
/** Étape : texte, éléments mis en avant (ids des nœuds, ou e0, e1… pour les liens dans l'ordre), impulsion. */
type S = [text: string, focus: string[], pulse?: [node: string, delta: 1 | -1]];

function story(reveal: boolean, steps: S[]): Story {
  return {
    reveal,
    steps: steps.map(([text, focus, pulse], i) => ({
      id: `s${i}`,
      text,
      focus,
      pulse: pulse ? { node: pulse[0], delta: pulse[1] } : null,
    })),
  };
}

/** Écriture compacte d'un exemple. Dans un cycle parcouru dans le sens horaire, bend < 0 fait bomber les liens vers l'extérieur. */
function doc(nodes: N[], edges: E[], st: Story = emptyStory()): Doc {
  return {
    version: 1,
    nodes: nodes.map(([id, label, color, x, y, r = 56, causal]) => ({
      id,
      label,
      color,
      x,
      y,
      r,
      causal: { ...defaultCausal(), ...causal },
    })),
    edges: edges.map(([from, to, polarity, bend = 40, extra], i) => ({
      id: `e${i}`,
      from,
      to,
      polarity,
      weight: 1,
      delay: 0,
      bend,
      ...extra,
    })),
    story: st,
  };
}

export const EXAMPLES: Example[] = [
  {
    id: 'proies',
    title: 'Lapins et renards',
    description: 'Plus de lapins nourrit plus de renards… qui mangent les lapins. Avec un temps de retard : ça oscille.',
    build: () =>
      doc(
        [
          ['naissances', 'Naissances', 'ochre', -300, 0, 50],
          ['lapins', 'Lapins', 'sage', 0, 0, 62],
          ['renards', 'Renards', 'terracotta', 300, 0, 62],
        ],
        [
          ['naissances', 'lapins', 1],
          ['lapins', 'naissances', 1],
          ['lapins', 'renards', 1, 40, { delay: 1 }],
          ['renards', 'lapins', -1],
        ],
        story(false, [
          [
            'Des **lapins** qui se reproduisent : plus de lapins, plus de naissances… donc encore plus de lapins. C’est une **boucle renforçante**.',
            ['naissances', 'lapins', 'e0', 'e1'],
            ['lapins', 1],
          ],
          [
            'Mais les **renards** mangent les lapins. Plus de lapins nourrit plus de renards (avec du retard)… qui font baisser les lapins : une **boucle équilibrante**.',
            ['lapins', 'renards', 'e2', 'e3'],
            ['renards', 1],
          ],
          ['Les deux boucles se disputent le contrôle. À toi de jouer : touche le **haut** ou le **bas** des galets.', []],
        ]),
      ),
  },
  {
    id: 'albedo',
    title: 'Banquise et albédo',
    description: 'La glace renvoie la lumière du soleil. Quand elle fond, la mer sombre absorbe plus de chaleur… jusqu’au point de bascule.',
    build: () =>
      doc(
        [
          ['co2', 'CO₂', 'plum', -330, -190, 46],
          ['temp', 'Température', 'terracotta', 0, -150, 64, { relax: 1 }],
          ['fonte', 'Fonte des glaces', 'slate', 210, 110, 64, { init: 0.3, thresholdMode: 'tip', threshold: 0.85 }],
          ['albedo', 'Albédo', 'sand', -210, 110, 58, { init: 0.7 }],
        ],
        [
          ['co2', 'temp', 1, 20],
          ['temp', 'fonte', 1, -40, { delay: 1 }],
          ['fonte', 'albedo', -1, -40],
          ['albedo', 'temp', -1, -40],
        ],
        story(true, [
          ['Voici la **température** moyenne de la planète.', ['temp']],
          ['Nos émissions de **CO₂** la font monter : c’est l’effet de serre.', ['co2', 'e0'], ['co2', 1]],
          [
            'Plus il fait chaud, plus la **banquise fond**… avec un temps de retard (les deux petits traits sur le lien).',
            ['fonte', 'e1'],
          ],
          [
            'Or la glace est blanche : elle renvoie la lumière du soleil, c’est l’**albédo**. Moins de glace, moins d’albédo.',
            ['albedo', 'e2'],
          ],
          [
            'Et moins de lumière renvoyée, c’est plus de chaleur absorbée. La boucle est bouclée : une **boucle renforçante**, le réchauffement s’entretient tout seul.',
            ['temp', 'fonte', 'albedo', 'e1', 'e2', 'e3'],
            ['temp', 1],
          ],
          [
            'Les pointillés rouges marquent un **point de bascule** : au-delà, la fonte devient irréversible. À toi : réchauffe avec le CO₂… et essaie de revenir en arrière.',
            [],
          ],
        ]),
      ),
  },
  {
    id: 'banque',
    title: 'Panique bancaire',
    description: 'La peur pousse à retirer son argent, ce qui vide la banque… et nourrit la peur.',
    build: () =>
      doc(
        [
          ['rumeurs', 'Rumeurs', 'sand', -330, -190, 46],
          ['peur', 'Peur', 'plum', 0, -150, 58, { saturate: true }],
          ['retraits', 'Retraits', 'ochre', 210, 110, 58],
          ['reserves', 'Réserves', 'slate', -210, 110, 62, { init: 0.8 }],
        ],
        [
          ['rumeurs', 'peur', 1, 20],
          ['peur', 'retraits', 1, -40],
          ['retraits', 'reserves', -1, -40],
          ['reserves', 'peur', -1, -40],
        ],
      ),
  },
  {
    id: 'thermostat',
    title: 'Thermostat',
    description: 'Le chauffage réchauffe la pièce, et une pièce chaude coupe le chauffage : une boucle qui se stabilise.',
    build: () =>
      doc(
        [
          ['temp', 'Température', 'terracotta', -170, 0, 64],
          ['chauffage', 'Chauffage', 'ochre', 170, 0, 58],
        ],
        [
          ['temp', 'chauffage', -1, 50],
          ['chauffage', 'temp', 1, 50, { delay: 1 }],
        ],
      ),
  },
  {
    id: 'seisme',
    title: 'Tremblement de terre',
    description: 'Les plaques bougent un peu, la tension s’accumule sans bruit… puis se libère d’un coup.',
    build: () =>
      doc(
        [
          ['plaques', 'Plaques', 'sand', -380, 0, 54],
          ['tension', 'Tension', 'ochre', -120, 0, 62, { init: 0.1, thresholdMode: 'release', threshold: 0.9 }],
          ['seisme', 'Séisme', 'terracotta', 140, 0, 58, { init: 0, relax: 2 }],
          ['degats', 'Dégâts', 'plum', 380, 0, 54, { init: 0 }],
        ],
        [
          ['plaques', 'tension', 1, 0],
          ['tension', 'seisme', 1, 0],
          ['seisme', 'degats', 1, 0, { weight: 0.5 }],
        ],
      ),
  },
];
