import type { ColorKey } from '../theme';

/** Que se passe-t-il quand le niveau atteint le seuil ? */
export type ThresholdMode =
  /** Rien de spécial. */
  | 'none'
  /** Bascule irréversible : l'élément se bloque au maximum, les baisses n'ont plus d'effet. */
  | 'tip'
  /** Accumulation puis largage : l'élément retient les impulsions, puis relâche tout d'un coup. */
  | 'release';

/** Réglages propres au mode causal (façon Loopy). Ignorés par le futur moteur stocks-flux. */
export interface CausalProps {
  /** Niveau de départ, dans [0, 1]. */
  init: number;
  thresholdMode: ThresholdMode;
  /** Seuil, dans [0, 1]. */
  threshold: number;
  /** Retour à l'équilibre (vers `init`) : 0 non, 1 lent, 2 rapide. */
  relax: 0 | 1 | 2;
  /** Saturation : plus l'élément est plein (ou vide), moins il réagit et moins il transmet. */
  saturate: boolean;
}

export interface SysNode {
  id: string;
  x: number;
  y: number;
  r: number;
  label: string;
  color: ColorKey;
  causal: CausalProps;
}

export type Polarity = 1 | -1;

export const WEIGHTS = [0.5, 1, 2] as const;
export type Weight = (typeof WEIGHTS)[number];

export interface SysEdge {
  id: string;
  from: string;
  to: string;
  polarity: Polarity;
  /** Force du lien : multiplie l'impulsion transmise. */
  weight: Weight;
  /** Retard : 0 normal, 1 lent, 2 très lent. */
  delay: 0 | 1 | 2;
  /** Décalage perpendiculaire du milieu de la courbe (unités monde). */
  bend: number;
}

/** Une étape du récit (mode présentation). */
export interface StoryStep {
  id: string;
  /** Narration. `**gras**` est mis en valeur. */
  text: string;
  /** Éléments mis en avant (nœuds et liens) ; le reste s'estompe. Vide : tout est visible. */
  focus: string[];
  /** Action jouée à l'arrivée sur l'étape : une impulsion sur un nœud. */
  pulse: { node: string; delta: 1 | -1 } | null;
}

export interface Story {
  steps: StoryStep[];
  /** Construire le diagramme au fil du récit : un élément n'apparaît qu'une fois mis en avant. */
  reveal: boolean;
}

export interface Doc {
  version: 1;
  nodes: SysNode[];
  edges: SysEdge[];
  story: Story;
}

export const NODE_RADIUS = 48;
export const MIN_RADIUS = 24;
export const MAX_RADIUS = 140;
export const DEFAULT_BEND = 28;

export function defaultCausal(): CausalProps {
  return { init: 0.5, thresholdMode: 'none', threshold: 0.8, relax: 0, saturate: false };
}

export function emptyStory(): Story {
  return { steps: [], reveal: false };
}

export function emptyDoc(): Doc {
  return { version: 1, nodes: [], edges: [], story: emptyStory() };
}

let counter = 0;
export function newId(prefix: string): string {
  counter = (counter + 1) % 1296;
  return prefix + Date.now().toString(36) + counter.toString(36).padStart(2, '0') + Math.random().toString(36).slice(2, 5);
}
