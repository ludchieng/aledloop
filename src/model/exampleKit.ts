/**
 * Outils pour écrire les exemples de la bibliothèque : niveaux, thèmes, et `doc()`, une écriture
 * compacte d'un diagramme et de son récit. Les exemples eux-mêmes sont dans examples.ts et examplesMore.ts.
 */
import type { ColorKey } from '../theme';
import { defaultCausal, type CausalProps, type Doc, type Polarity, type SysEdge, type TimeUnit } from './types';

/** Niveau de difficulté, pour ranger la bibliothèque. */
export type Level = 1 | 2 | 3;
export type Topic = 'quotidien' | 'nature' | 'climat' | 'sante' | 'societe' | 'economie' | 'geopolitique' | 'industrie' | 'technique' | 'histoire';

export const LEVELS: Record<Level, { title: string; subtitle: string }> = {
  1: { title: 'Premiers pas', subtitle: 'Une seule boucle, pour voir la rétroaction à l’œuvre.' },
  2: { title: 'Plusieurs boucles', subtitle: 'Des boucles qui se combinent, des retards, des seuils.' },
  3: {
    title: 'Systèmes complexes',
    subtitle: 'Économie, énergie, géopolitique : des mécanismes illustratifs, pas des prévisions.',
  },
};

export const TOPICS: Record<Topic, string> = {
  quotidien: 'Au quotidien',
  nature: 'Nature',
  climat: 'Climat',
  sante: 'Santé',
  societe: 'Société',
  economie: 'Économie',
  geopolitique: 'Énergie et géopolitique',
  industrie: 'Industrie et ressources',
  technique: 'Ingénierie',
  histoire: 'Histoire',
};

export interface Example {
  id: string;
  title: string;
  description: string;
  level: Level;
  topic: Topic;
  /** Le comportement que l'exemple met en scène (« Courbe en S », « Cycles »…). */
  shows: string;
  build(): Doc;
}

export type N = [id: string, label: string, color: ColorKey, x: number, y: number, r?: number, causal?: Partial<CausalProps>];
export type E = [from: string, to: string, polarity: Polarity, bend?: number, extra?: Partial<Pick<SysEdge, 'weight' | 'delay'>>];
/**
 * Étape du récit : texte, éléments mis en avant, action. Un lien se désigne par « cause>effet »,
 * un nœud par son identifiant.
 */
export type S = [text: string, focus: string[], pulse?: [node: string, delta: 1 | -1]];

interface Spec {
  unit: TimeUnit;
  horizon: number;
  nodes: N[];
  edges: E[];
  story?: S[];
  /** Construire le diagramme au fil du récit. */
  reveal?: boolean;
}

export const STOCK = { kind: 'stock' } as const;

/** Écriture compacte d'un exemple. Dans un cycle parcouru dans le sens horaire, bend < 0 fait bomber les liens vers l'extérieur. */
export function doc({ unit, horizon, nodes, edges, story = [], reveal = false }: Spec): Doc {
  const ids = new Map<string, string>();
  const built = edges.map(([from, to, polarity, bend = 40, extra], i) => {
    ids.set(`${from}>${to}`, `e${i}`);
    return { id: `e${i}`, from, to, polarity, weight: 1, delay: 0, bend, ...extra };
  });
  const nodeIds = new Set(nodes.map((n) => n[0]));
  const ref = (key: string) => {
    const id = key.includes('>') ? ids.get(key) : nodeIds.has(key) ? key : undefined;
    if (!id) throw new Error(`Récit : élément inconnu « ${key} »`);
    return id;
  };
  return {
    version: 2,
    timeUnit: unit,
    horizon,
    nodes: nodes.map(([id, label, color, x, y, r = 56, causal]) => ({
      id,
      label,
      color,
      x,
      y,
      r,
      causal: { ...defaultCausal(), ...causal },
    })),
    edges: built,
    story: {
      reveal,
      steps: story.map(([text, focus, pulse], i) => ({
        id: `s${i}`,
        text,
        focus: focus.map(ref),
        pulse: pulse ? { node: ref(pulse[0]), delta: pulse[1] } : null,
      })),
    },
  };
}
