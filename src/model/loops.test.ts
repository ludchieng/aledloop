import { describe, expect, it } from 'vitest';
import { EXAMPLES } from './examples';
import { analyzeLoop, findLoops } from './loops';
import { defaultCausal, emptyStory, type Doc, type Polarity } from './types';

function graph(nodes: string, edges: [string, string, Polarity?][]): Doc {
  return {
    version: 2,
    timeUnit: 'year', horizon: 20,
    nodes: [...nodes].map((id) => ({ id, x: 0, y: 0, r: 40, label: id, color: 'sage', causal: defaultCausal() })),
    edges: edges.map(([from, to, polarity = 1]) => ({ id: from + to, from, to, polarity, weight: 1, delay: 0, bend: 0 })),
    story: emptyStory(),
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
    const kinds = (id: string) => findLoops(EXAMPLES.find((e) => e.id === id)!.build()).map((l) => l.kind).sort().join('');
    expect(['proies', 'albedo', 'banque', 'thermostat', 'seisme', 'regulateur', 'dette', 'armement'].map(kinds)).toEqual(['BR', 'R', 'R', 'B', '', 'B', 'R', 'R']);
    // Aucun exemple ne contient de boucle sans rythme propre.
    for (const ex of EXAMPLES) expect(findLoops(ex.build()).filter((l) => l.instant), ex.id).toEqual([]);
  });
});

describe('analyzeLoop', () => {
  /** Thermostat : accumulation « t », variable « c », gain de boucle G = force du lien c → t. */
  function thermostat(weight: number, delay: number, kind: 'stock' | 'variable' = 'stock'): Doc {
    const doc = graph('tc', [['t', 'c', -1], ['c', 't']]);
    doc.nodes[0].causal.kind = kind;
    doc.edges[1].weight = weight;
    doc.edges[1].delay = delay;
    return doc;
  }
  const analyze = (doc: Doc) => analyzeLoop(doc, findLoops(doc)[0]);

  it('repère une boucle sans accumulation ni retard', () => {
    const doc = thermostat(1, 0, 'variable');
    expect(findLoops(doc)[0].instant).toBe(true);
    expect(analyze(doc).verdict).toBe('instant');
    // Un retard suffit à lui donner un rythme.
    expect(findLoops(thermostat(1, 2, 'variable'))[0].instant).toBe(false);
  });

  it('boucle équilibrante à une accumulation : le verdict dépend de G × retard', () => {
    expect(analyze(thermostat(0.5, 0)).verdict).toBe('settles');
    expect(analyze(thermostat(0.5, 0.5)).verdict).toBe('settles');
    expect(analyze(thermostat(0.5, 2)).verdict).toBe('damped');
    expect(analyze(thermostat(0.5, 6)).verdict).toBe('unstable');
  });

  it('donne le temps de réaction et les retards critiques, dans l’unité du document', () => {
    const doc = thermostat(0.5, 2);
    doc.timeUnit = 'minute';
    const { text, gain, delay, stocks } = analyze(doc);
    expect([gain, delay, stocks]).toEqual([0.5, 2, 1]);
    expect(text).toContain('environ 2 minutes'); // 1 / G
    expect(text).toContain('0,63 minute'); // 0,316 / G
    expect(text).toContain('5,3 minutes'); // (8/3) / G
  });

  it('boucles renforçantes : temps de doublement, ou extinction si les liens sont faibles', () => {
    const r = graph('ab', [['a', 'b'], ['b', 'a']]);
    r.nodes[0].causal.kind = 'stock';
    r.edges[1].weight = 0.5;
    expect(analyze(r)).toMatchObject({ verdict: 'grows' });
    expect(analyze(r).text).toContain('1,4 an');
    r.nodes[0].causal.kind = 'variable';
    r.edges[0].delay = 1;
    expect(analyze(r).verdict).toBe('fades');
  });

  it('boucle renforçante dont les accumulations fuient : freinée, mais amplificatrice', () => {
    const r = graph('ab', [['a', 'b'], ['b', 'a']]);
    r.nodes[0].causal = { ...r.nodes[0].causal, kind: 'stock', relax: 4 };
    r.edges[0].weight = 0.2;
    // G × τ = 0,2 × 4 = 0,8 < 1 : amplifié ×5, sans s'emballer.
    expect(analyze(r).verdict).toBe('fades');
    expect(analyze(r).text).toContain('×5');
    r.edges[0].weight = 0.5;
    expect(analyze(r).verdict).toBe('grows');
  });

  it('deux accumulations dans une boucle équilibrante : oscillations', () => {
    const doc = thermostat(1, 0);
    doc.nodes[1].causal.kind = 'stock';
    expect(analyze(doc).verdict).toBe('oscillates');
  });
});
