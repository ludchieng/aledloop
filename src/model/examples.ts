import type { ColorKey } from '../theme';
import { defaultCausal, type CausalProps, type Doc, type Polarity, type SysEdge } from './types';

export interface Example {
  id: string;
  title: string;
  description: string;
  build(): Doc;
}

type N = [id: string, label: string, color: ColorKey, x: number, y: number, r?: number, causal?: Partial<CausalProps>];
type E = [from: string, to: string, polarity: Polarity, bend?: number, extra?: Partial<Pick<SysEdge, 'weight' | 'delay'>>];

/** Écriture compacte d'un exemple. Dans un cycle parcouru dans le sens horaire, bend < 0 fait bomber les liens vers l'extérieur. */
function doc(nodes: N[], edges: E[]): Doc {
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
