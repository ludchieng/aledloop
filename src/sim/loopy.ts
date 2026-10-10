import type { Doc, SysEdge } from '../model/types';

/**
 * Moteur causal façon Loopy : qualitatif et à événements.
 * Chaque nœud a un niveau dans [0, 1]. Une impulsion (+1 ou −1) modifie le niveau d'un nœud,
 * puis part sur chacun de ses liens sortants, multipliée par la polarité du lien (+ ou −).
 * Elle met EDGE_TIME secondes à parcourir un lien, quelle que soit sa longueur.
 */

/** Variation du niveau provoquée par une impulsion. */
export const STEP = 0.25;
/** Durée de parcours d'un lien, en secondes (à vitesse 1). */
export const EDGE_TIME = 0.8;
/** Garde-fou : une boucle renforçante multiplie les impulsions, on plafonne. */
export const MAX_SIGNALS = 120;

export interface Signal {
  edge: SysEdge;
  /** Avancement sur le lien, de 0 (départ) à 1 (arrivée). */
  t: number;
  /** +1 : « augmente », −1 : « diminue ». */
  delta: number;
}

export interface Hit {
  /** Temps écoulé depuis la dernière impulsion reçue, en secondes. */
  age: number;
  delta: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export class LoopySim {
  levels = new Map<string, number>();
  signals: Signal[] = [];
  hits = new Map<string, Hit>();
  /** Nombre d'impulsions perdues à cause du plafond MAX_SIGNALS. */
  dropped = 0;
  private outgoing = new Map<string, SysEdge[]>();

  constructor(private doc: Doc) {
    for (const e of doc.edges) {
      const list = this.outgoing.get(e.from);
      if (list) list.push(e);
      else this.outgoing.set(e.from, [e]);
    }
    this.reset();
  }

  reset() {
    this.levels.clear();
    for (const n of this.doc.nodes) this.levels.set(n.id, n.init);
    this.signals = [];
    this.hits.clear();
    this.dropped = 0;
  }

  level(id: string): number {
    return this.levels.get(id) ?? 0.5;
  }

  /** Impulsion envoyée par l'utilisateur (boutons ▲ ▼). */
  pulse(nodeId: string, delta: 1 | -1) {
    this.receive(nodeId, delta);
  }

  /** Avance la simulation de dt secondes. */
  step(dt: number) {
    for (const hit of this.hits.values()) hit.age += dt;
    const advance = dt / EDGE_TIME;
    const arrived: Signal[] = [];
    this.signals = this.signals.filter((s) => {
      s.t += advance;
      if (s.t < 1) return true;
      arrived.push(s);
      return false;
    });
    for (const s of arrived) this.receive(s.edge.to, s.delta);
  }

  private receive(nodeId: string, delta: number) {
    this.levels.set(nodeId, clamp01(this.level(nodeId) + STEP * delta));
    this.hits.set(nodeId, { age: 0, delta });
    for (const edge of this.outgoing.get(nodeId) ?? []) {
      if (this.signals.length >= MAX_SIGNALS) {
        this.dropped++;
        continue;
      }
      this.signals.push({ edge, t: 0, delta: delta * edge.polarity });
    }
  }
}
