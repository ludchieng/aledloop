import { describe, expect, it } from 'vitest';
import { EXAMPLES } from './examples';
import { findLoops } from './loops';
import { defaultCausal, type Doc, type Polarity } from './types';

function graph(nodes: string, edges: [string, string, Polarity?][]): Doc {
  return {
    version: 1,
    nodes: [...nodes].map((id) => ({ id, x: 0, y: 0, r: 40, label: id, color: 'sage', causal: defaultCausal() })),
    edges: edges.map(([from, to, polarity = 1]) => ({ id: from + to, from, to, polarity, weight: 1, delay: 0, bend: 0 })),
  };
}

const describeAll = (doc: Doc) =>
  findLoops(doc)
    .map((l) => l.kind + ':' + l.nodes.join(''))
    .sort();

describe('findLoops', () => {
  it('ne trouve rien dans un graphe sans cycle', () => {
    expect(findLoops(graph('abc', [['a', 'b'], ['b', 'c'], ['a', 'c']]))).toEqual([]);
  });

  it('trouve une boucle à deux nœuds', () => {
    const loops = findLoops(graph('ab', [['a', 'b'], ['b', 'a', -1]]));
    expect(loops).toHaveLength(1);
    expect(loops[0]).toMatchObject({ nodes: ['a', 'b'], edges: ['ab', 'ba'], kind: 'B' });
  });

  it('R si le nombre de liens − est pair, B s’il est impair', () => {
    expect(describeAll(graph('abc', [['a', 'b', -1], ['b', 'c', -1], ['c', 'a']]))).toEqual(['R:abc']);
    expect(describeAll(graph('abc', [['a', 'b', -1], ['b', 'c'], ['c', 'a']]))).toEqual(['B:abc']);
  });

  it('trouve chaque cycle élémentaire une seule fois', () => {
    // Graphe complet orienté sur 3 nœuds : 3 boucles à 2 nœuds et 2 à 3 nœuds (un sens, puis l'autre).
    const doc = graph('abc', [
      ['a', 'b'], ['b', 'a'], ['b', 'c'], ['c', 'b'], ['a', 'c'], ['c', 'a'],
    ]);
    expect(describeAll(doc)).toEqual(['R:ab', 'R:abc', 'R:acb', 'R:ac', 'R:bc'].sort());
  });

  it('a des clés uniques et stables', () => {
    const doc = graph('abcd', [['a', 'b'], ['b', 'c'], ['c', 'a'], ['c', 'd'], ['d', 'a']]);
    const keys = findLoops(doc).map((l) => l.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(findLoops(structuredClone(doc)).map((l) => l.key)).toEqual(keys);
  });

  it('s’arrête au plafond dans un graphe très connecté', () => {
    const ids = 'abcdefgh';
    const edges: [string, string][] = [];
    for (const a of ids) for (const b of ids) if (a !== b) edges.push([a, b]);
    expect(findLoops(graph(ids, edges), 25)).toHaveLength(25);
  });

  it('classe les boucles des exemples comme attendu', () => {
    const byId = Object.fromEntries(EXAMPLES.map((e) => [e.id, findLoops(e.build()).map((l) => l.kind).sort().join('')]));
    expect(byId).toEqual({ proies: 'BR', albedo: 'R', banque: 'R', thermostat: 'B', seisme: '' });
  });
});
