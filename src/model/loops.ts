import { formatDuration, formatEstimate } from './time';
import type { Doc } from './types';

/**
 * Une boucle de rétroaction : un cycle élémentaire du graphe (aucun nœud traversé deux fois).
 * - R (renforçante) : nombre PAIR de liens −. Un changement s'amplifie en faisant le tour.
 * - B (équilibrante, « balancing ») : nombre IMPAIR de liens −. Un changement se corrige.
 */
export interface Loop {
  /** Identifiant stable : les liens du cycle, triés. */
  key: string;
  /** Nœuds dans l'ordre du parcours (le premier n'est pas répété à la fin). */
  nodes: string[];
  /** edges[i] va de nodes[i] à nodes[i + 1] (le dernier revient au premier). */
  edges: string[];
  kind: 'R' | 'B';
  /** Ni accumulation ni retard : la boucle n'a pas de rythme propre (« boucle algébrique »). */
  instant: boolean;
}

/** Au-delà, on s'arrête : le nombre de cycles peut exploser dans un graphe très connecté. */
export const MAX_LOOPS = 60;

/**
 * Énumère les cycles élémentaires avec l'algorithme de Johnson (1975).
 * Pour chaque nœud de départ s, on ne cherche que les cycles dont s est le plus petit
 * indice : chaque cycle est trouvé une seule fois. Les nœuds « bloqués » évitent de
 * réexplorer des chemins dont on sait déjà qu'ils ne reviennent pas à s.
 */
export function findLoops(doc: Doc, max = MAX_LOOPS): Loop[] {
  const n = doc.nodes.length;
  const index = new Map(doc.nodes.map((node, i) => [node.id, i]));
  const out: { to: number; edge: number }[][] = doc.nodes.map(() => []);
  doc.edges.forEach((e, i) => {
    const a = index.get(e.from);
    const b = index.get(e.to);
    if (a !== undefined && b !== undefined && a !== b) out[a].push({ to: b, edge: i });
  });

  const loops: Loop[] = [];
  const blocked = new Array<boolean>(n).fill(false);
  const blockers: Set<number>[] = doc.nodes.map(() => new Set());
  const nodeStack: number[] = [];
  const edgeStack: number[] = [];

  const unblock = (u: number) => {
    blocked[u] = false;
    for (const w of blockers[u]) {
      blockers[u].delete(w);
      if (blocked[w]) unblock(w);
    }
  };

  const record = () => {
    const edges = edgeStack.map((i) => doc.edges[i]);
    const negatives = edges.filter((e) => e.polarity === -1).length;
    loops.push({
      key: edges.map((e) => e.id).sort().join('|'),
      nodes: nodeStack.map((i) => doc.nodes[i].id),
      edges: edges.map((e) => e.id),
      kind: negatives % 2 === 0 ? 'R' : 'B',
      instant: edges.every((e) => e.delay === 0) && nodeStack.every((i) => doc.nodes[i].causal.kind === 'variable'),
    });
  };

  const circuit = (v: number, s: number): boolean => {
    let found = false;
    nodeStack.push(v);
    blocked[v] = true;
    for (const { to: w, edge } of out[v]) {
      if (w < s || loops.length >= max) continue;
      edgeStack.push(edge);
      if (w === s) {
        record();
        found = true;
      } else if (!blocked[w] && circuit(w, s)) {
        found = true;
      }
      edgeStack.pop();
    }
    if (found) unblock(v);
    else for (const { to: w } of out[v]) if (w >= s) blockers[w].add(v);
    nodeStack.pop();
    return found;
  };

  for (let s = 0; s < n && loops.length < max; s++) {
    for (let i = s; i < n; i++) {
      blocked[i] = false;
      blockers[i].clear();
    }
    circuit(s, s);
  }
  // Les petites boucles d'abord : ce sont les plus lisibles.
  return loops.sort((a, b) => a.edges.length - b.edges.length);
}

/** Phrase d'explication, pour l'inspecteur. */
export function describeLoop(loop: Loop): string {
  return loop.kind === 'R'
    ? 'Un changement s’amplifie en faisant le tour : une hausse entraîne encore plus de hausse, une baisse encore plus de baisse. Cercle vertueux… ou vicieux.'
    : 'Un changement se corrige en faisant le tour : le système résiste, revient vers un équilibre, ou oscille autour.';
}

/**
 * Seuils d'une boucle équilibrante à une seule accumulation, de gain G (produit des forces, par
 * unité de temps) et de retard total D (traité comme un retard d'ordre 3). Les racines de
 * s (1 + sD/3)³ + G = 0 donnent : pas d'oscillation tant que G·D ≤ 0,32 ; oscillation qui grandit
 * dès que G·D ≥ 8/3.
 */
export const OSCILLATION_GD = 0.316;
export const INSTABILITY_GD = 8 / 3;

export type LoopVerdict =
  /** Ni accumulation ni retard : pas de rythme propre. */
  | 'instant'
  /** Revient à l'équilibre sans le dépasser. */
  | 'settles'
  /** Dépasse l'équilibre, oscille, puis se stabilise. */
  | 'damped'
  /** Oscille de plus en plus (jusqu'aux bornes). */
  | 'unstable'
  /** Plusieurs accumulations : tend à osciller. */
  | 'oscillates'
  /** L'écart s'amplifie. */
  | 'grows'
  /** L'écart s'éteint à chaque tour (boucle R sans accumulation, liens faibles). */
  | 'fades';

export interface LoopAnalysis {
  verdict: LoopVerdict;
  /** Nombre d'accumulations sur la boucle. */
  stocks: number;
  /** Somme des retards, en unités de temps. */
  delay: number;
  /** Produit des forces. */
  gain: number;
  /** Explication, avec du `**gras**`. */
  text: string;
}

/**
 * Estime le comportement d'une boucle prise isolément, à partir des forces et des retards.
 * Ignore saturations, seuils et retours à l'équilibre : c'est un ordre de grandeur, pour comprendre.
 */
export function analyzeLoop(doc: Doc, loop: Loop): LoopAnalysis {
  const nodes = new Map(doc.nodes.map((n) => [n.id, n]));
  const edges = new Map(doc.edges.map((e) => [e.id, e]));
  const stocks = loop.nodes.filter((id) => nodes.get(id)?.causal.kind === 'stock').length;
  const delay = loop.edges.reduce((sum, id) => sum + (edges.get(id)?.delay ?? 0), 0);
  const gain = loop.edges.reduce((prod, id) => prod * (edges.get(id)?.weight ?? 1), 1);
  const unit = doc.timeUnit;
  const D = formatDuration(delay, unit);
  const est = (v: number) => formatDuration(v, unit, true);
  const result = (verdict: LoopVerdict, text: string): LoopAnalysis => ({ verdict, stocks, delay, gain, text });

  if (loop.instant) {
    return result(
      'instant',
      'Ni accumulation ni retard sur cette boucle : rien ne lui donne de **rythme propre**, alors aledloop la ralentit artificiellement. Fais d’un de ses éléments une **accumulation**.',
    );
  }

  if (loop.kind === 'B') {
    if (stocks === 1) {
      const tau = 1 / gain;
      const gd = gain * delay;
      const limits = `Avec ces forces, elle se met à osciller au-delà d’un retard d’environ ${est(OSCILLATION_GD / gain)}, et s’emballe au-delà de ${est(INSTABILITY_GD / gain)}.`;
      if (gd <= OSCILLATION_GD) {
        const why = delay > 0 ? `Le retard (${D}) est court en comparaison : elle` : 'Sans retard, elle';
        return result('settles', `Temps de réaction : environ ${est(tau)}. ${why} revient à l’équilibre **en douceur**. ${limits}`);
      }
      if (gd < INSTABILITY_GD) {
        return result(
          'damped',
          `Temps de réaction : environ ${est(tau)}, pour un retard de ${D}. Elle corrige un peu tard : elle **dépasse l’équilibre et oscille** avant de se stabiliser. ${limits}`,
        );
      }
      return result(
        'unstable',
        `Temps de réaction : environ ${est(tau)}, pour un retard de ${D}. Le retard est trop long : elle corrige toujours à contretemps et **oscille de plus en plus**. ${limits}`,
      );
    }
    if (stocks === 0) {
      // Seul le retard rythme la boucle : (1 + sD/3)³ + G = 0 est instable dès que G ≥ 8.
      return gain < 8
        ? result('damped', `Sans accumulation, c’est le retard (${D}) qui rythme la boucle : elle **oscille en s’amortissant**.`)
        : result('unstable', `Sans accumulation, c’est le retard (${D}) qui rythme la boucle, et ses liens sont si forts qu’elle **oscille de plus en plus**.`);
    }
    return result(
      'oscillates',
      `${stocks} accumulations se renvoient la balle : la boucle tend à **osciller**, comme proies et prédateurs. Un retour à l’équilibre sur l’une d’elles amortit les oscillations${delay > 0 ? ', un retard les amplifie' : ''}.`,
    );
  }

  if (stocks === 0) {
    if (gain < 1) return result('fades', `Sans accumulation, l’écart est multiplié par ${formatEstimate(gain)} à chaque tour (tous les ${D}) : il **s’éteint** peu à peu.`);
    return result('grows', `Sans accumulation, l’écart est multiplié par ${formatEstimate(gain)} à chaque tour (tous les ${D}) : il **${gain > 1 ? 's’amplifie' : 'se maintient'}**.`);
  }
  // Si chaque accumulation fuit (retour à l'équilibre, constante τ), la boucle ne s'emballe que si son
  // gain « en régime établi » G × Π τ dépasse 1 ; sinon elle amplifie un écart de 1 / (1 − G × Π τ).
  const leaks = loop.nodes.map((id) => nodes.get(id)!.causal).filter((c) => c.kind === 'stock').map((c) => c.relax);
  if (leaks.every((tau) => tau > 0)) {
    const steady = gain * leaks.reduce((prod, tau) => prod * tau, 1);
    if (steady < 1) {
      return result(
        'fades',
        `Ses accumulations ont toutes une fuite (retour à l’équilibre) qui la freine, et ici **le frein l’emporte** : un écart est amplifié environ ×${formatEstimate(1 / (1 - steady))}, sans s’emballer. Plus ce chiffre est grand, plus on est près du point où elle s’emballerait.`,
      );
    }
  }
  if (delay === 0) {
    // k accumulations en chaîne, gain G : l'écart croît comme e^(G^(1/k) t).
    const doubling = Math.LN2 / gain ** (1 / stocks);
    return result('grows', `Sans frein, l’écart **double** environ tous les ${est(doubling)}.`);
  }
  return result('grows', `L’écart **s’amplifie** à chaque tour. Le retard (${D}) ralentit l’emballement sans l’empêcher.`);
}
