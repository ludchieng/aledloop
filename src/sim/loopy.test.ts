import { describe, expect, it } from 'vitest';
import { defaultCausal, type CausalProps, type Doc, type SysEdge } from '../model/types';
import { DELAY_FACTORS, EDGE_TIME, HISTORY_DT, LoopySim, MAX_SIGNALS, STEP } from './loopy';

function chain(polarity: 1 | -1, causal: Partial<CausalProps> = {}, edge: Partial<SysEdge> = {}): Doc {
  return {
    version: 1,
    nodes: ['a', 'b', 'c'].map((id, i) => ({
      id,
      x: i * 100,
      y: 0,
      r: 40,
      label: id,
      color: 'sage' as const,
      causal: { ...defaultCausal(), ...(id === 'b' ? causal : {}) },
    })),
    edges: [
      { id: 'ab', from: 'a', to: 'b', polarity, weight: 1, delay: 0, bend: 0, ...edge },
      { id: 'bc', from: 'b', to: 'c', polarity, weight: 1, delay: 0, bend: 0 },
    ],
  };
}

/** Avance par petits pas, comme le ferait l'animation. */
function run(sim: LoopySim, seconds: number) {
  for (let t = 0; t < seconds; t += 0.02) sim.step(0.02);
}

describe('LoopySim — parité Loopy', () => {
  it('une impulsion modifie le nœud puis voyage le long des liens', () => {
    const sim = new LoopySim(chain(1));
    sim.pulse('a', 1);
    expect(sim.level('a')).toBe(0.5 + STEP);
    expect(sim.signals).toHaveLength(1);
    sim.step(EDGE_TIME / 2);
    expect(sim.level('b')).toBe(0.5);
    sim.step(EDGE_TIME / 2 + 0.01);
    expect(sim.level('b')).toBe(0.5 + STEP);
    sim.step(EDGE_TIME + 0.01);
    expect(sim.level('c')).toBe(0.5 + STEP);
    expect(sim.signals).toHaveLength(0);
  });

  it('un lien − inverse le sens, deux liens − se compensent', () => {
    const sim = new LoopySim(chain(-1));
    sim.pulse('a', 1);
    sim.step(EDGE_TIME + 0.01);
    expect(sim.level('b')).toBe(0.5 - STEP);
    sim.step(EDGE_TIME + 0.01);
    expect(sim.level('c')).toBe(0.5 + STEP);
  });

  it('borne les niveaux dans [0, 1]', () => {
    const sim = new LoopySim(chain(1));
    for (let i = 0; i < 10; i++) sim.pulse('a', -1);
    expect(sim.level('a')).toBe(0);
  });

  it('plafonne le nombre d’impulsions dans une boucle renforçante', () => {
    const doc = chain(1);
    doc.edges.push(
      { id: 'ba', from: 'b', to: 'a', polarity: 1, weight: 1, delay: 0, bend: 0 },
      { id: 'ca', from: 'c', to: 'a', polarity: 1, weight: 1, delay: 0, bend: 0 },
    );
    const sim = new LoopySim(doc);
    sim.pulse('a', 1);
    for (let i = 0; i < 100; i++) sim.step(EDGE_TIME);
    expect(sim.signals.length).toBeLessThanOrEqual(MAX_SIGNALS);
    expect(sim.dropped).toBeGreaterThan(0);
  });

  it('reset remet les niveaux de départ', () => {
    const sim = new LoopySim(chain(1));
    sim.pulse('a', 1);
    sim.reset();
    expect(sim.level('a')).toBe(0.5);
    expect(sim.signals).toHaveLength(0);
  });
});

describe('LoopySim — liens', () => {
  it('un retard allonge le trajet', () => {
    const sim = new LoopySim(chain(1, {}, { delay: 1 }));
    sim.pulse('a', 1);
    sim.step(EDGE_TIME * 1.5);
    expect(sim.level('b')).toBe(0.5);
    sim.step(EDGE_TIME * (DELAY_FACTORS[1] - 1.5) + 0.01);
    expect(sim.level('b')).toBe(0.5 + STEP);
  });

  it('la force multiplie l’impulsion', () => {
    const sim = new LoopySim(chain(1, {}, { weight: 0.5 }));
    sim.pulse('a', 1);
    sim.step(EDGE_TIME + 0.01);
    expect(sim.level('b')).toBe(0.5 + STEP / 2);
  });
});

describe('LoopySim — comportements', () => {
  it('saturation : réagit moins près du bord, et transmet moins', () => {
    const sim = new LoopySim(chain(1, { saturate: true, init: 0.9 }));
    sim.pulse('b', 1);
    // 2 × (1 − 0,9) = 0,2 de la variation normale
    expect(sim.level('b')).toBeCloseTo(0.9 + STEP * 0.2);
    expect(sim.signals[0].delta).toBeCloseTo(0.2);
  });

  it('retour à l’équilibre : le niveau revient vers le départ', () => {
    const sim = new LoopySim(chain(1, { relax: 2 }));
    sim.pulse('b', 1);
    run(sim, 6);
    expect(sim.level('b')).toBeCloseTo(0.5, 1);
    expect(sim.level('a')).toBe(0.5);
  });

  it('bascule : bloqué au maximum, les baisses n’ont plus d’effet', () => {
    const sim = new LoopySim(chain(1, { thresholdMode: 'tip', threshold: 0.7 }));
    sim.pulse('b', 1);
    expect(sim.tipped.has('b')).toBe(true);
    expect(sim.level('b')).toBe(1);
    // L'impulsion normale + l'onde de choc de la bascule
    expect(sim.signals.filter((s) => s.edge.id === 'bc')).toHaveLength(2);
    sim.pulse('b', -1);
    sim.pulse('b', -1);
    expect(sim.level('b')).toBe(1);
    sim.reset();
    expect(sim.tipped.size).toBe(0);
  });

  it('largage : retient tout, puis relâche d’un coup au seuil', () => {
    const sim = new LoopySim(chain(1, { thresholdMode: 'release', threshold: 0.95 }));
    sim.pulse('b', 1);
    expect(sim.signals).toHaveLength(0);
    expect(sim.level('b')).toBe(0.75);
    sim.pulse('b', 1);
    // 0,5 → 1 : deux crans accumulés, deux impulsions relâchées, et le niveau retombe.
    expect(sim.level('b')).toBe(0.5);
    expect(sim.signals).toHaveLength(2);
    run(sim, EDGE_TIME * 2);
    expect(sim.level('c')).toBe(1);
  });

  it('garde un historique des niveaux', () => {
    const sim = new LoopySim(chain(1));
    sim.pulse('a', 1);
    run(sim, HISTORY_DT * 10);
    const h = sim.history.get('a')!;
    expect(h.length).toBeGreaterThanOrEqual(10);
    expect(h[0]).toBe(0.5);
    expect(h[h.length - 1]).toBe(0.75);
  });
});
