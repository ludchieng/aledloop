import type { ColorKey } from '../theme';

export interface SysNode {
  id: string;
  x: number;
  y: number;
  r: number;
  label: string;
  color: ColorKey;
  /** Niveau de départ en simulation causale, dans [0, 1]. */
  init: number;
}

export type Polarity = 1 | -1;

export interface SysEdge {
  id: string;
  from: string;
  to: string;
  polarity: Polarity;
  /** Décalage perpendiculaire du milieu de la courbe (unités monde). */
  bend: number;
}

export interface Doc {
  version: 1;
  nodes: SysNode[];
  edges: SysEdge[];
}

export const NODE_RADIUS = 48;
export const MIN_RADIUS = 24;
export const MAX_RADIUS = 140;
export const DEFAULT_BEND = 28;

export function emptyDoc(): Doc {
  return { version: 1, nodes: [], edges: [] };
}

let counter = 0;
export function newId(prefix: string): string {
  counter = (counter + 1) % 1296;
  return prefix + Date.now().toString(36) + counter.toString(36).padStart(2, '0') + Math.random().toString(36).slice(2, 5);
}
