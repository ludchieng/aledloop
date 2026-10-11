import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXAMPLES } from './examples';
import { decodeDoc, draftKeys, encodeDoc, loadDraft, MAX_DRAFTS, parseDoc, removeDraft, saveDraft } from './persist';
import { DEFAULT_HORIZON, defaultCausal, emptyDoc, MAX_DURATION, MAX_WEIGHT, MIN_DURATION, MIN_WEIGHT } from './types';

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
      version: 2,
      timeUnit: 'day',
      nodes: [
        { id: 'a', causal: { kind: 'stock', init: 0.2, thresholdMode: 'release', threshold: 0.9, relax: 2.5, saturate: true } },
        { id: 'b', causal: { kind: 'nuage', thresholdMode: 'boum', relax: -7, saturate: 'oui' } },
        { id: 'c', causal: { kind: 'variable', thresholdMode: 'release' } },
      ],
      edges: [
        { id: 'e', from: 'a', to: 'b', weight: 1.5, delay: 2.5 },
        { id: 'f', from: 'b', to: 'a', weight: 30, delay: -1 },
        { id: 'g', from: 'b', to: 'c', weight: 0, delay: 99999 },
        { id: 'h', from: 'c', to: 'a', delay: 0.04 },
      ],
    });
    expect(doc.timeUnit).toBe('day');
    expect(doc.nodes[0].causal).toEqual({ kind: 'stock', init: 0.2, thresholdMode: 'release', threshold: 0.9, relax: 2.5, saturate: true });
    expect(doc.nodes[1].causal).toEqual(defaultCausal());
    // Un largage n'a de sens que pour une accumulation.
    expect(doc.nodes[2].causal.thresholdMode).toBe('none');
    expect(doc.edges.map((e) => [e.weight, e.delay])).toEqual([
      [1.5, 2.5],
      [MAX_WEIGHT, 0],
      [MIN_WEIGHT, MAX_DURATION],
      [1, MIN_DURATION], // une durée non nulle ne descend pas sous le minimum
    ]);
    expect(parseDoc({ version: 2, timeUnit: 'siècle', nodes: [], edges: [] })).toMatchObject({ timeUnit: 'year', horizon: DEFAULT_HORIZON });
    expect(parseDoc({ version: 2, horizon: 45.5, nodes: [], edges: [] }).horizon).toBe(45.5);
    expect(parseDoc({ version: 2, horizon: -3, nodes: [], edges: [] }).horizon).toBe(1);
  });

  it('migre la version 1 (moteur à impulsions) : crans de retard en durées, largage en accumulation', () => {
    const doc = parseDoc({
      version: 1,
      nodes: [
        { id: 'a', causal: { init: 0.2, thresholdMode: 'release', threshold: 0.9, relax: 1 } },
        { id: 'b', causal: { thresholdMode: 'tip', relax: 2 } },
      ],
      edges: [
        { id: 'e', from: 'a', to: 'b', weight: 2, delay: 1 },
        { id: 'f', from: 'b', to: 'a', weight: 0.5, delay: 2 },
      ],
    });
    expect(doc.version).toBe(2);
    expect(doc.timeUnit).toBe('year');
    expect(doc.nodes.map((n) => [n.causal.kind, n.causal.thresholdMode, n.causal.relax])).toEqual([
      ['stock', 'release', 5],
      ['variable', 'tip', 2],
    ]);
    expect(doc.edges.map((e) => [e.weight, e.delay])).toEqual([
      [2, 2],
      [0.5, 5],
    ]);
  });

  it('accepte tous les exemples', () => {
    for (const ex of EXAMPLES) {
      const doc = ex.build();
      expect(parseDoc(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
    }
  });
});

describe('brouillons', () => {
  /** Un localStorage en mémoire : les tests tournent sous Node, sans navigateur. */
  function memoryStorage() {
    const data = new Map<string, string>();
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, String(v)),
      removeItem: (k: string) => void data.delete(k),
      get size() {
        return data.size;
      },
    };
  }

  afterEach(() => vi.unstubAllGlobals());

  it('gardent les modifications d’un diagramme sous sa clé, et les oublient sur demande', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const doc = EXAMPLES.find((e) => e.id === 'albedo')!.build();
    doc.nodes[0].label = 'Modifié';
    saveDraft('ex:albedo', doc);
    expect(loadDraft('ex:albedo')?.nodes[0].label).toBe('Modifié');
    expect(loadDraft('ex:proies')).toBeNull();
    expect(draftKeys()).toEqual(['ex:albedo']);
    removeDraft('ex:albedo');
    expect(loadDraft('ex:albedo')).toBeNull();
    expect(draftKeys()).toEqual([]);
  });

  it('ne gardent que les plus récents', () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    for (let i = 0; i < MAX_DRAFTS + 5; i++) saveDraft(`m:${i}`, emptyDoc());
    saveDraft('m:3', emptyDoc()); // réutilisé : redevient le plus récent
    const keys = draftKeys();
    expect(keys).toHaveLength(MAX_DRAFTS);
    expect(keys[0]).toBe('m:3');
    expect(keys).not.toContain('m:4');
    expect(loadDraft('m:4')).toBeNull();
    expect(storage.size).toBe(MAX_DRAFTS + 1); // les brouillons et leur index
  });

  it('ne plantent pas sans stockage (mode privé…)', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => saveDraft('ex:albedo', emptyDoc())).not.toThrow();
    expect(loadDraft('ex:albedo')).toBeNull();
    expect(draftKeys()).toEqual([]);
    expect(() => removeDraft('ex:albedo')).not.toThrow();
  });
});

describe('partage par URL', () => {
  it('encode puis décode à l’identique (coordonnées arrondies)', async () => {
    const doc = EXAMPLES.find((e) => e.id === 'albedo')!.build();
    doc.nodes[0].x = 12.6;
    const code = await encodeDoc(doc);
    expect(code).toMatch(/^[\w-]+$/);
    const back = await decodeDoc(code);
    expect(back.nodes[0].x).toBe(13);
    expect(back.nodes[0].label).toBe('CO₂');
    expect(back.edges).toEqual(doc.edges);
    expect(back.timeUnit).toBe(doc.timeUnit);
    expect(back.nodes.map((n) => n.causal)).toEqual(doc.nodes.map((n) => n.causal));
  });
});
