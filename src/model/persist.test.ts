import { describe, expect, it } from 'vitest';
import { EXAMPLES } from './examples';
import { decodeDoc, encodeDoc, parseDoc } from './persist';
import { defaultCausal } from './types';

describe('parseDoc', () => {
  it('refuse ce qui n’est pas un modèle', () => {
    expect(() => parseDoc(null)).toThrow();
    expect(() => parseDoc({ nodes: [] })).toThrow();
  });

  it('nettoie : valeurs par défaut, liens orphelins, doublons, boucles sur soi', () => {
    const doc = parseDoc({
      nodes: [{ id: 'a', x: 1, y: 2 }, { id: 'b', color: 'fluo', r: 9999, init: 3 }, { id: 'a' }, { nope: true }],
      edges: [
        { id: 'e1', from: 'a', to: 'b', polarity: -1, bend: 12 },
        { id: 'e2', from: 'a', to: 'b' },
        { id: 'e3', from: 'a', to: 'ghost' },
        { id: 'e4', from: 'b', to: 'b' },
        { id: 'e5', from: 'b', to: 'a', polarity: 7 },
      ],
    });
    expect(doc.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(doc.nodes[0]).toMatchObject({ x: 1, y: 2, r: 48, label: '', causal: defaultCausal() });
    expect(doc.nodes[1]).toMatchObject({ color: 'sand', r: 140, causal: { init: 1 } });
    expect(doc.edges).toEqual([
      { id: 'e1', from: 'a', to: 'b', polarity: -1, weight: 1, delay: 0, bend: 12 },
      { id: 'e5', from: 'b', to: 'a', polarity: 1, weight: 1, delay: 0, bend: 0 },
    ]);
  });

  it('lit les réglages causaux et rejette les valeurs inconnues', () => {
    const doc = parseDoc({
      nodes: [
        { id: 'a', causal: { init: 0.2, thresholdMode: 'tip', threshold: 0.9, relax: 2, saturate: true } },
        { id: 'b', causal: { thresholdMode: 'boum', relax: 7, saturate: 'oui' } },
      ],
      edges: [
        { id: 'e', from: 'a', to: 'b', weight: 2, delay: 1 },
        { id: 'f', from: 'b', to: 'a', weight: 3, delay: 9 },
      ],
    });
    expect(doc.nodes[0].causal).toEqual({ init: 0.2, thresholdMode: 'tip', threshold: 0.9, relax: 2, saturate: true });
    expect(doc.nodes[1].causal).toEqual(defaultCausal());
    expect(doc.edges.map((e) => [e.weight, e.delay])).toEqual([
      [2, 1],
      [1, 0],
    ]);
  });

  it('accepte tous les exemples', () => {
    for (const ex of EXAMPLES) {
      const doc = ex.build();
      expect(parseDoc(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
    }
  });
});

describe('partage par URL', () => {
  it('encode puis décode à l’identique (coordonnées arrondies)', async () => {
    const doc = EXAMPLES[1].build();
    doc.nodes[0].x = 12.6;
    const code = await encodeDoc(doc);
    expect(code).toMatch(/^[\w-]+$/);
    const back = await decodeDoc(code);
    expect(back.nodes[0].x).toBe(13);
    expect(back.nodes[0].label).toBe('CO₂');
    expect(back.edges).toEqual(doc.edges);
  });
});
