import type { CausalProps, Doc, SysEdge } from '../model/types';

/**
 * Moteur causal façon Loopy : qualitatif et à événements.
 * Chaque nœud a un niveau dans [0, 1]. Une impulsion (+ ou −, d'intensité 1 par défaut) modifie
 * le niveau d'un nœud, puis part sur chacun de ses liens sortants, multipliée par la polarité
 * et la force du lien. Elle met EDGE_TIME secondes (× le retard du lien) à le parcourir.
 *
 * Comportements optionnels d'un nœud (phase 2) :
 * - saturation : près des bords, il réagit moins… et transmet moins ;
 * - retour à l'équilibre : son niveau dérive doucement vers le niveau de départ ;
 * - bascule : une fois le seuil franchi, il se bloque au maximum (irréversible) ;
 * - largage : il retient les impulsions jusqu'au seuil, puis relâche tout d'un coup.
 */

/** Variation du niveau provoquée par une impulsion d'intensité 1. */
export const STEP = 0.25;
/** Durée de parcours d'un lien, en secondes (à vitesse 1). */
export const EDGE_TIME = 0.8;
/** Multiplicateur de durée selon le retard du lien (normal, lent, très lent). */
export const DELAY_FACTORS = [1, 2.5, 5] as const;
/** Garde-fou : une boucle renforçante multiplie les impulsions, on plafonne. */
export const MAX_SIGNALS = 120;
/** En dessous de cette intensité, une impulsion s'éteint. */
export const MIN_SIGNAL = 0.08;
/** Constante de temps du retour à l'équilibre (lent, rapide), en secondes. */
export const RELAX_TIMES = [Infinity, 6, 2] as const;
/** Historique : un point toutes les HISTORY_DT secondes, HISTORY_LEN points. */
export const HISTORY_DT = 0.1;
export const HISTORY_LEN = 120;
/** Écart entre les impulsions d'un largage (en fraction de trajet). */
const RELEASE_SPACING = 0.28;

export interface Signal {
  edge: SysEdge;
  /** Avancement sur le lien, de 0 (départ) à 1 (arrivée). Négatif : pas encore parti. */
  t: number;
  /** Signe et intensité : +1 « augmente », −1 « diminue ». */
  delta: number;
}

export interface Hit {
  /** Temps écoulé depuis le dernier événement, en secondes. */
  age: number;
  delta: number;
  /** Événement marquant : bascule ou largage (animation plus forte). */
  event?: 'tip' | 'release';
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export class LoopySim {
  levels = new Map<string, number>();
  signals: Signal[] = [];
  hits = new Map<string, Hit>();
  /** Nœuds ayant basculé (irréversible jusqu'à la réinitialisation). */
  tipped = new Set<string>();
  /** Historique des niveaux, du plus ancien au plus récent. */
  history = new Map<string, number[]>();
  /** Nombre d'impulsions perdues à cause du plafond MAX_SIGNALS. */
  dropped = 0;
  private outgoing = new Map<string, SysEdge[]>();
  private props = new Map<string, CausalProps>();
  private sampleClock = 0;

  constructor(private doc: Doc) {
    for (const n of doc.nodes) this.props.set(n.id, n.causal);
    for (const e of doc.edges) {
      const list = this.outgoing.get(e.from);
      if (list) list.push(e);
      else this.outgoing.set(e.from, [e]);
    }
    this.reset();
  }

  reset() {
    this.levels.clear();
    this.history.clear();
    for (const n of this.doc.nodes) {
      this.levels.set(n.id, n.causal.init);
      this.history.set(n.id, [n.causal.init]);
    }
    this.signals = [];
    this.hits.clear();
    this.tipped.clear();
    this.dropped = 0;
    this.sampleClock = 0;
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

    // Retour à l'équilibre : décroissance exponentielle vers le niveau de départ.
    for (const [id, p] of this.props) {
      if (p.relax === 0 || this.tipped.has(id)) continue;
      const level = this.level(id);
      this.levels.set(id, level + (p.init - level) * (1 - Math.exp(-dt / RELAX_TIMES[p.relax])));
    }

    const arrived: Signal[] = [];
    this.signals = this.signals.filter((s) => {
      s.t += dt / (EDGE_TIME * DELAY_FACTORS[s.edge.delay]);
      if (s.t < 1) return true;
      arrived.push(s);
      return false;
    });
    for (const s of arrived) this.receive(s.edge.to, s.delta);

    this.sampleClock += dt;
    while (this.sampleClock >= HISTORY_DT) {
      this.sampleClock -= HISTORY_DT;
      for (const [id, values] of this.history) {
        values.push(this.level(id));
        if (values.length > HISTORY_LEN) values.shift();
      }
    }
  }

  private receive(nodeId: string, delta: number) {
    const p = this.props.get(nodeId);
    if (!p) return;
    const level = this.level(nodeId);

    // Basculé : bloqué au maximum. Les hausses passent encore, les baisses sont absorbées.
    if (this.tipped.has(nodeId)) {
      this.hits.set(nodeId, { age: 0, delta });
      if (delta > 0) this.emit(nodeId, delta);
      return;
    }

    let change = STEP * delta;
    if (p.saturate) change *= delta > 0 ? 2 * (1 - level) : 2 * level;
    const next = clamp01(level + change);
    this.levels.set(nodeId, next);
    this.hits.set(nodeId, { age: 0, delta });
    // Sans saturation, on garde la règle de Loopy : l'impulsion repart intacte, même si le niveau est au bord.
    const transmitted = p.saturate ? (next - level) / STEP : delta;

    if (p.thresholdMode === 'release') {
      // On retient tout ; au seuil, on relâche une impulsion par « cran » accumulé.
      if (next >= p.threshold && next > p.init) {
        const count = Math.max(1, Math.round((next - p.init) / STEP));
        this.levels.set(nodeId, p.init);
        this.hits.set(nodeId, { age: 0, delta: 1, event: 'release' });
        for (let i = 0; i < count; i++) this.emit(nodeId, 1, -i * RELEASE_SPACING);
      }
      return;
    }

    this.emit(nodeId, transmitted);

    if (p.thresholdMode === 'tip' && next >= p.threshold) {
      this.tipped.add(nodeId);
      this.levels.set(nodeId, 1);
      this.hits.set(nodeId, { age: 0, delta: 1, event: 'tip' });
      // La bascule elle-même se propage : une impulsion de plus, comme une onde de choc.
      this.emit(nodeId, 1, -RELEASE_SPACING);
    }
  }

  private emit(nodeId: string, delta: number, t = 0) {
    for (const edge of this.outgoing.get(nodeId) ?? []) {
      const d = delta * edge.polarity * edge.weight;
      if (Math.abs(d) < MIN_SIGNAL) continue;
      if (this.signals.length >= MAX_SIGNALS) {
        this.dropped++;
        continue;
      }
      this.signals.push({ edge, t, delta: d });
    }
  }
}
