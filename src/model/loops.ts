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
