import type { CausalProps, Doc } from '../model/types';

/**
 * Moteur causal continu, dans l'esprit de la dynamique des systèmes (Insight Maker, Vensim, Stella).
 *
 * Chaque élément a un niveau dans [0, 1]. Son niveau de départ est un ÉQUILIBRE : tant que personne
 * n'y touche, rien ne bouge. Ce qui circule sur un lien, c'est un ÉCART : celui de la cause par
 * rapport à son départ, multiplié par la polarité et la force du lien.
 *
 * - Variable : suit ses causes immédiatement. Niveau = départ + somme des écarts reçus (+ réglage ▲ ▼).
 * - Accumulation (stock) : intègre ce qu'elle reçoit. Un écart reçu de 0,1 la fait monter de 0,1
 *   par unité de temps. C'est elle qui donne son rythme à une boucle.
 * - Retard : l'écart met environ `delay` unités de temps à traverser le lien, étalé comme dans un
 *   retard d'ordre 3 (le DELAY3 de Vensim) : trois petits réservoirs en cascade.
 *
 * Conséquences, celles des manuels : une boucle équilibrante avec une accumulation revient à
 * l'équilibre ; un retard long devant son temps de réaction la fait osciller ; une boucle
 * renforçante s'emballe (et s'infléchit en S si elle sature).
 *
 * Intégration : Euler à pas fixe DT, quelle que soit la cadence d'affichage (résultats reproductibles).
 */

/** Variation provoquée par un appui sur ▲ ou ▼. */
export const PUSH = 0.2;
/** Pas d'intégration, en unités de temps. */
export const DT = 0.01;
/** Durée d'un largage, en unités de temps : l'accumulation se vide pendant ce temps. */
export const RELEASE_TIME = 0.5;
/**
 * Une boucle faite uniquement de variables, sans retard, n'a pas de rythme propre (en dynamique des
 * systèmes, c'est une « boucle algébrique », refusée par Vensim). Pour qu'elle reste calculable,
 * ses variables suivent leur cible avec cette constante de temps. L'interface le signale.
 */
export const INSTANT_LOOP_TAU = 1;
/**
 * Historique : une fenêtre glissante (la durée de simulation du document), découpée en HISTORY_POINTS
 * intervalles. Au-delà, les plus anciens points sont oubliés. Plafond de HISTORY_CAP points si on agrandit la fenêtre.
 */
export const HISTORY_POINTS = 400;
export const HISTORY_CAP = 4000;

export interface Hit {
  /** Temps écoulé depuis l'événement, en unités de temps. */
  age: number;
  delta: number;
  /** Événement marquant : bascule ou largage (animation plus forte). */
  event?: 'tip' | 'release';
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const RELEASE_STEPS = Math.round(RELEASE_TIME / DT);

export class CausalSim {
  /** Temps écoulé depuis le départ, en unités de temps du document. */
  time = 0;
  hits = new Map<string, Hit>();
  /** Nœuds ayant basculé (irréversible jusqu'à la réinitialisation). */
  tipped = new Set<string>();
  /** Historique des niveaux sur la fenêtre : un point toutes les `historyDt` unités de temps, à partir de `historyStart`. */
  history = new Map<string, number[]>();
  historyDt: number;
  /** Temps du plus ancien point gardé. */
  historyStart = 0;
  /** Durée d'historique gardée. */
  historyWindow: number;
  private historyCap = HISTORY_POINTS + 1;

  private ids: string[];
  private index = new Map<string, number>();
  private props: CausalProps[];
  private x: Float64Array;
  /** Réglage ▲ ▼ d'une variable : un décalage durable (qui s'estompe si elle revient à l'équilibre). */
  private offset: Float64Array;
  /** Largage en cours : débit de vidange, et pas restants. */
  private releaseRate: Float64Array;
  private releaseSteps: Int32Array;
  /** Prêt à franchir le seuil : le niveau est passé en dessous depuis la dernière fois. */
  private armed: boolean[];
  /** Variables prises dans une boucle sans accumulation ni retard. */
  private smoothed: boolean[];
  /** Variables ordinaires, dans un ordre où chaque cause est calculée avant ses effets. */
  private order: number[] = [];
  private incoming: number[][];
  private inflow: Float64Array;

  private edgeIndex = new Map<string, number>();
  private from: Int32Array;
  private to: Int32Array;
  private gain: Float64Array;
  private delay: Float64Array;
  /** Trois réservoirs par lien retardé. */
  private stages: Float64Array;

  private pending = 0;
  private nextSample = 0;

  constructor(doc: Doc) {
    this.historyWindow = doc.horizon;
    this.historyDt = Math.max(DT, doc.horizon / HISTORY_POINTS);
    const n = doc.nodes.length;
    const m = doc.edges.length;
    this.ids = doc.nodes.map((node) => node.id);
    this.ids.forEach((id, i) => this.index.set(id, i));
    this.props = doc.nodes.map((node) => node.causal);
    this.x = new Float64Array(n);
    this.offset = new Float64Array(n);
    this.releaseRate = new Float64Array(n);
    this.releaseSteps = new Int32Array(n);
    this.armed = new Array<boolean>(n).fill(false);
    this.inflow = new Float64Array(n);
    this.incoming = doc.nodes.map(() => []);

    this.from = new Int32Array(m);
    this.to = new Int32Array(m);
    this.gain = new Float64Array(m);
    this.delay = new Float64Array(m);
    this.stages = new Float64Array(m * 3);
    doc.edges.forEach((e, k) => {
      this.edgeIndex.set(e.id, k);
      this.from[k] = this.index.get(e.from)!;
      this.to[k] = this.index.get(e.to)!;
      this.gain[k] = e.polarity * e.weight;
      this.delay[k] = e.delay;
      this.incoming[this.to[k]].push(k);
    });

    this.smoothed = this.findInstantLoops();
    this.order = this.computeOrder();
    this.reset();
  }

  reset() {
    this.time = 0;
    this.pending = 0;
    this.props.forEach((p, i) => {
      this.x[i] = p.init;
      this.armed[i] = p.init < p.threshold;
    });
    this.offset.fill(0);
    this.releaseRate.fill(0);
    this.releaseSteps.fill(0);
    this.stages.fill(0);
    this.hits.clear();
    this.tipped.clear();
    this.computeVariables();
    this.history.clear();
    this.ids.forEach((id, i) => this.history.set(id, [this.x[i]]));
    this.historyStart = 0;
    this.nextSample = this.historyDt;
  }

  level(id: string): number {
    const i = this.index.get(id);
    return i === undefined ? 0.5 : this.x[i];
  }

  /** Appui sur ▲ (1) ou ▼ (−1) : une accumulation reçoit un apport ponctuel, une variable est décalée durablement. */
  push(id: string, delta: 1 | -1) {
    const i = this.index.get(id);
    if (i === undefined) return;
    this.hits.set(id, { age: 0, delta });
    // Basculé : bloqué au maximum, plus rien ne le fait redescendre.
    if (this.tipped.has(id)) return;
    if (this.props[i].kind === 'stock') this.x[i] = clamp01(this.x[i] + PUSH * delta);
    else this.offset[i] = Math.min(1, Math.max(-1, this.offset[i] + PUSH * delta));
    this.computeVariables();
    this.checkThresholds();
    this.computeVariables();
  }

  /**
   * Valeur transportée par un lien à la fraction `t` de son parcours (0 : départ, 1 : arrivée).
   * Sans retard, elle est la même partout ; avec retard, on interpole entre les trois réservoirs.
   */
  edgeSignal(edgeId: string, t: number): number {
    const k = this.edgeIndex.get(edgeId);
    if (k === undefined) return 0;
    const start = this.gain[k] * this.emitted(this.from[k]);
    if (this.delay[k] === 0) return start;
    const u = Math.min(1, Math.max(0, t)) * 3;
    const i = Math.min(2, Math.floor(u));
    const a = i === 0 ? start : this.stages[k * 3 + i - 1];
    const b = this.stages[k * 3 + i];
    return a + (b - a) * (u - i);
  }

  /** Avance la simulation de `dt` unités de temps. */
  step(dt: number) {
    this.pending += dt;
    // Nombre de pas compté d'un coup : soustraire DT en boucle accumule des erreurs d'arrondi.
    const steps = Math.floor(this.pending / DT + 1e-6);
    this.pending -= steps * DT;
    for (let s = 0; s < steps; s++) this.integrate();
  }

  // --- Calcul ------------------------------------------------------------------------

  /** Écart transmis par un nœud : celui de son niveau, sauf pour un largage (son débit de vidange). */
  private emitted(j: number): number {
    const p = this.props[j];
    if (p.kind === 'stock' && p.thresholdMode === 'release') return this.releaseRate[j];
    return this.x[j] - p.init;
  }

  private arriving(k: number): number {
    return this.delay[k] > 0 ? this.stages[k * 3 + 2] : this.gain[k] * this.emitted(this.from[k]);
  }

  private sumIncoming(i: number): number {
    let sum = 0;
    for (const k of this.incoming[i]) sum += this.arriving(k);
    return sum;
  }

  /** Niveau d'une variable pour un écart total `d` : borné, ou freiné en douceur si elle sature. */
  private shape(p: CausalProps, d: number): number {
    if (!p.saturate) return clamp01(p.init + d);
    if (d >= 0) return p.init + (1 - p.init) * Math.tanh(d / Math.max(1e-6, 1 - p.init));
    return p.init - p.init * Math.tanh(-d / Math.max(1e-6, p.init));
  }

  private computeVariables() {
    for (const i of this.order) {
      this.x[i] = this.tipped.has(this.ids[i]) ? 1 : this.shape(this.props[i], this.offset[i] + this.sumIncoming(i));
    }
  }

  private integrate() {
    const n = this.ids.length;
    this.computeVariables();
    for (let i = 0; i < n; i++) this.inflow[i] = this.sumIncoming(i);

    // Retards : chaque réservoir se vide dans le suivant, avec une constante de temps delay / 3.
    for (let k = 0; k < this.delay.length; k++) {
      if (this.delay[k] === 0) continue;
      // Facteur exact d'un premier ordre sur un pas (au lieu d'Euler) : stable même pour un retard très court.
      const rate = 1 - Math.exp((-3 / this.delay[k]) * DT);
      const s = k * 3;
      const input = this.gain[k] * this.emitted(this.from[k]);
      const d0 = (input - this.stages[s]) * rate;
      const d1 = (this.stages[s] - this.stages[s + 1]) * rate;
      const d2 = (this.stages[s + 1] - this.stages[s + 2]) * rate;
      this.stages[s] += d0;
      this.stages[s + 1] += d1;
      this.stages[s + 2] += d2;
    }

    for (let i = 0; i < n; i++) {
      const p = this.props[i];
      if (this.tipped.has(this.ids[i])) continue;
      const x = this.x[i];
      if (p.kind === 'stock') {
        let net = this.inflow[i];
        if (p.saturate) net *= net > 0 ? Math.min(1, (1 - x) / Math.max(1e-6, 1 - p.init)) : Math.min(1, x / Math.max(1e-6, p.init));
        // Constante de temps bornée : sous quelques pas, Euler deviendrait instable.
        if (p.relax > 0) net -= (x - p.init) / Math.max(p.relax, 10 * DT);
        net -= this.releaseRate[i];
        this.x[i] = clamp01(x + net * DT);
      } else {
        if (p.relax > 0) this.offset[i] -= (this.offset[i] / Math.max(p.relax, 10 * DT)) * DT;
        if (this.smoothed[i]) this.x[i] = x + (this.shape(p, this.offset[i] + this.inflow[i]) - x) * (DT / INSTANT_LOOP_TAU);
      }
      if (this.releaseSteps[i] > 0 && --this.releaseSteps[i] === 0) this.releaseRate[i] = 0;
    }

    this.time += DT;
    for (const hit of this.hits.values()) hit.age += DT;
    this.computeVariables();
    this.checkThresholds();
    if (this.time >= this.nextSample - 1e-9) this.sample();
  }

  /** Seuils : bascule et largage se déclenchent quand le niveau FRANCHIT le seuil en montant. */
  private checkThresholds() {
    this.props.forEach((p, i) => {
      if (p.thresholdMode === 'none') return;
      const id = this.ids[i];
      if (this.tipped.has(id)) return;
      const x = this.x[i];
      if (x < p.threshold) {
        this.armed[i] = true;
        return;
      }
      if (!this.armed[i]) return;
      if (p.thresholdMode === 'tip') {
        this.armed[i] = false;
        this.tipped.add(id);
        this.x[i] = 1;
        this.hits.set(id, { age: 0, delta: 1, event: 'tip' });
      } else if (p.kind === 'stock' && this.releaseSteps[i] === 0 && x - p.init > 0.01) {
        // Largage : tout ce qui a été accumulé au-dessus du départ part pendant RELEASE_TIME.
        this.armed[i] = false;
        this.releaseRate[i] = (x - p.init) / RELEASE_TIME;
        this.releaseSteps[i] = RELEASE_STEPS;
        this.hits.set(id, { age: 0, delta: 1, event: 'release' });
      }
    });
  }

  private sample() {
    this.ids.forEach((id, i) => this.history.get(id)!.push(this.x[i]));
    this.trimHistory();
  }

  /** File d'attente : au-delà de la fenêtre, les points les plus anciens sont oubliés. */
  private trimHistory() {
    const length = this.ids.length ? this.history.get(this.ids[0])!.length : 0;
    const extra = length - this.historyCap;
    if (extra > 0) {
      for (const values of this.history.values()) values.splice(0, extra);
      this.historyStart += extra * this.historyDt;
    }
    this.nextSample = this.historyStart + Math.min(length, this.historyCap) * this.historyDt;
  }

  /**
   * Durée d'historique gardée (la fenêtre des courbes). L'espacement des points ne change pas :
   * agrandir la fenêtre garde plus de points (jusqu'à HISTORY_CAP), la réduire oublie les plus anciens.
   */
  setHistoryWindow(span: number) {
    this.historyWindow = span;
    this.historyCap = Math.min(HISTORY_CAP, Math.ceil(span / this.historyDt - 1e-9) + 1);
    this.trimHistory();
  }

  // --- Structure du graphe ---------------------------------------------------------------

  /** Liens « instantanés » entre variables : sans retard, l'effet suit la cause dans le même pas de temps. */
  private instantEdges(): number[][] {
    const out: number[][] = this.ids.map(() => []);
    for (let k = 0; k < this.from.length; k++) {
      const a = this.from[k];
      const b = this.to[k];
      if (this.delay[k] === 0 && this.props[a].kind === 'variable' && this.props[b].kind === 'variable') out[a].push(b);
    }
    return out;
  }

  /** Variables appartenant à un cycle de liens instantanés (composantes fortement connexes de Tarjan). */
  private findInstantLoops(): boolean[] {
    const out = this.instantEdges();
    const n = this.ids.length;
    const result = new Array<boolean>(n).fill(false);
    const index = new Array<number>(n).fill(-1);
    const low = new Array<number>(n).fill(0);
    const onStack = new Array<boolean>(n).fill(false);
    const stack: number[] = [];
    let counter = 0;
    const visit = (v: number) => {
      index[v] = low[v] = counter++;
      stack.push(v);
      onStack[v] = true;
      for (const w of out[v]) {
        if (index[w] < 0) {
          visit(w);
          low[v] = Math.min(low[v], low[w]);
        } else if (onStack[w]) {
          low[v] = Math.min(low[v], index[w]);
        }
      }
      if (low[v] !== index[v]) return;
      const component: number[] = [];
      let w: number;
      do {
        w = stack.pop()!;
        onStack[w] = false;
        component.push(w);
      } while (w !== v);
      if (component.length > 1) for (const c of component) result[c] = true;
    };
    for (let v = 0; v < n; v++) if (index[v] < 0) visit(v);
    return result;
  }

  /** Ordre topologique (Kahn) des variables ordinaires : chaque cause avant ses effets. */
  private computeOrder(): number[] {
    const out = this.instantEdges();
    const plain = (i: number) => this.props[i].kind === 'variable' && !this.smoothed[i];
    const indegree = this.ids.map(() => 0);
    out.forEach((targets, a) => {
      if (plain(a)) for (const b of targets) if (plain(b)) indegree[b]++;
    });
    const queue = this.ids.map((_, i) => i).filter((i) => plain(i) && indegree[i] === 0);
    const order: number[] = [];
    while (queue.length) {
      const a = queue.shift()!;
      order.push(a);
      for (const b of out[a]) if (plain(b) && --indegree[b] === 0) queue.push(b);
    }
    return order;
  }
}
