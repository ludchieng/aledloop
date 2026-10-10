import type { ColorKey } from '../theme';
import type { Doc, Polarity } from './types';

export interface Example {
  id: string;
  title: string;
  description: string;
  build(): Doc;
}

type N = [id: string, label: string, color: ColorKey, x: number, y: number, r?: number];
type E = [from: string, to: string, polarity: Polarity, bend?: number];

/** Écriture compacte d'un exemple. Les liens courbés (bend ≠ 0) d'un cycle horaire bombent vers l'extérieur si bend < 0. */
function doc(nodes: N[], edges: E[]): Doc {
  return {
    version: 1,
    nodes: nodes.map(([id, label, color, x, y, r = 56]) => ({ id, label, color, x, y, r, init: 0.5 })),
    edges: edges.map(([from, to, polarity, bend = 40], i) => ({ id: `e${i}`, from, to, polarity, bend })),
  };
}

export const EXAMPLES: Example[] = [
  {
    id: 'proies',
    title: 'Lapins et renards',
    description: 'Plus de lapins nourrit plus de renards… qui mangent les lapins. Une boucle qui oscille.',
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
          ['lapins', 'renards', 1],
          ['renards', 'lapins', -1],
        ],
      ),
  },
  {
    id: 'albedo',
    title: 'Banquise et albédo',
    description: 'La glace renvoie la lumière du soleil. Quand elle fond, la mer sombre absorbe plus de chaleur…',
    build: () =>
      doc(
        [
          ['co2', 'CO₂', 'plum', -330, -190, 46],
          ['temp', 'Température', 'terracotta', 0, -150, 64],
          ['fonte', 'Fonte des glaces', 'slate', 210, 110, 64],
          ['albedo', 'Albédo', 'sand', -210, 110, 58],
        ],
        [
          ['co2', 'temp', 1, 20],
          ['temp', 'fonte', 1, -40],
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
          ['peur', 'Peur', 'plum', 0, -150, 58],
          ['retraits', 'Retraits', 'ochre', 210, 110, 58],
          ['reserves', 'Réserves', 'slate', -210, 110, 62],
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
          ['chauffage', 'temp', 1, 50],
        ],
      ),
  },
];
