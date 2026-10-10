import { describe, expect, it } from 'vitest';
import type { Doc } from '../model/types';
import { EDGE_TIME, LoopySim, MAX_SIGNALS, STEP } from './loopy';

function chain(polarity: 1 | -1): Doc {
  return {
    version: 1,
    nodes: ['a', 'b', 'c'].map((id, i) => ({ id, x: i * 100, y: 0, r: 40, label: id, color: 'sage' as const, init: 0.5 })),
    edges: [
      { id: 'ab', from: 'a', to: 'b', polarity, bend: 0 },
      { id: 'bc', from: 'b', to: 'c', polarity, bend: 0 },
    ],
  };
}

describe('LoopySim', () => {
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
      { id: 'ba', from: 'b', to: 'a', polarity: 1, bend: 0 },
      { id: 'ca', from: 'c', to: 'a', polarity: 1, bend: 0 },
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
