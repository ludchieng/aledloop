import type { ColorKey } from '../theme';

/** Que se passe-t-il quand le niveau atteint le seuil ? */
export type ThresholdMode =
  /** Rien de spécial. */
  | 'none'
  /** Bascule irréversible : l'élément se bloque au maximum, les baisses n'ont plus d'effet. */
  | 'tip'
  /** Largage (accumulations seulement) : se remplit sans rien transmettre, puis se vide d'un coup au seuil. */
  | 'release';

/**
 * Nature d'un élément, la distinction centrale de la dynamique des systèmes :
 * - variable : suit ses causes immédiatement (naissances, chauffage, peur…) ;
 * - stock (« accumulation ») : se remplit ou se vide au fil du temps (population, température, argent…).
 */
export type NodeKind = 'variable' | 'stock';

/** Réglages propres au mode causal. Ignorés par le futur moteur stocks-flux. */
export interface CausalProps {
  kind: NodeKind;
  /** Niveau de départ, dans [0, 1]. C'est un équilibre : sans intervention, rien ne bouge. */
  init: number;
  thresholdMode: ThresholdMode;
  /** Seuil, dans [0, 1]. */
  threshold: number;
  /** Retour à l'équilibre : constante de temps, en unités de temps du document (0 : jamais). */
  relax: number;
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

/** Bornes de la force d'un lien. */
export const MIN_WEIGHT = 0.01;
export const MAX_WEIGHT = 3;
/** Bornes d'un retard ou d'un retour à l'équilibre non nul, en unités de temps. */
export const MIN_DURATION = 0.1;
export const MAX_DURATION = 1000;

/** Unités de temps proposées. Elles ne changent pas les calculs, seulement le sens des nombres. */
export const TIME_UNITS = ['second', 'minute', 'hour', 'day', 'week', 'month', 'year'] as const;
export type TimeUnit = (typeof TIME_UNITS)[number];

export interface SysEdge {
  id: string;
  from: string;
  to: string;
  polarity: Polarity;
  /** Force du lien, dans [MIN_WEIGHT, MAX_WEIGHT] : multiplie l'écart transmis. */
  weight: number;
  /** Retard, en unités de temps du document (0 : effet immédiat). */
  delay: number;
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
  /** Action jouée à l'arrivée sur l'étape : augmenter ou diminuer un nœud, comme ▲ ▼. */
  pulse: { node: string; delta: 1 | -1 } | null;
}

export interface Story {
  steps: StoryStep[];
  /** Construire le diagramme au fil du récit : un élément n'apparaît qu'une fois mis en avant. */
  reveal: boolean;
}

export interface Doc {
  version: 2;
  /** Unité de temps commune aux retards, aux retours à l'équilibre et à l'horloge de la simulation. */
  timeUnit: TimeUnit;
  /** Durée de simulation, en unités de temps : l'axe des courbes, et la fin du calcul « d'un coup ». */
  horizon: number;
  nodes: SysNode[];
  edges: SysEdge[];
  story: Story;
}

export const NODE_RADIUS = 48;
export const MIN_RADIUS = 24;
export const MAX_RADIUS = 140;
export const DEFAULT_BEND = 28;
export const DEFAULT_HORIZON = 20;

export function defaultCausal(): CausalProps {
  return { kind: 'variable', init: 0.5, thresholdMode: 'none', threshold: 0.8, relax: 0, saturate: false };
}

export function emptyStory(): Story {
  return { steps: [], reveal: false };
}

export function emptyDoc(): Doc {
  return { version: 2, timeUnit: 'year', horizon: DEFAULT_HORIZON, nodes: [], edges: [], story: emptyStory() };
}

let counter = 0;
export function newId(prefix: string): string {
  counter = (counter + 1) % 1296;
  return prefix + Date.now().toString(36) + counter.toString(36).padStart(2, '0') + Math.random().toString(36).slice(2, 5);
}
