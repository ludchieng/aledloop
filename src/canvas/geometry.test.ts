import { describe, expect, it } from 'vitest';
import { defaultCausal, type Doc, type SysNode } from '../model/types';
import { bendThrough, classifyStroke, dist, docBounds, edgeGeom, hitTest, quadPoint, type Pt } from './geometry';

const node = (id: string, x: number, y: number, r = 40): SysNode => ({ id, x, y, r, label: id, color: 'sage', causal: defaultCausal() });

function circle(cx: number, cy: number, r: number, n = 40): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => ({
    x: cx + r * Math.cos((i / n) * 2 * Math.PI),
    y: cy + r * Math.sin((i / n) * 2 * Math.PI),
  }));
}

describe('edgeGeom', () => {
  const a = node('a', 0, 0);
  const b = node('b', 200, 0);

  it('fait passer le milieu de la courbe à `bend` de la droite', () => {
    const g = edgeGeom(a, b, 30);
    expect(Math.abs(g.mid.y)).toBeCloseTo(30);
    expect(g.mid.x).toBeCloseTo(100);
  });

  it('courbe un lien retour de l’autre côté', () => {
    expect(Math.sign(edgeGeom(a, b, 30).mid.y)).toBe(-Math.sign(edgeGeom(b, a, 30).mid.y));
  });

  it('coupe la courbe au bord des cercles', () => {
    const g = edgeGeom(a, b, 30);
    expect(dist(quadPoint(g.p0, g.c, g.p1, g.t0), a)).toBeCloseTo(a.r, 1);
    expect(dist(quadPoint(g.p0, g.c, g.p1, g.t1), b)).toBeCloseTo(b.r + 6, 1);
  });

  it('bendThrough est l’inverse de edgeGeom', () => {
    const g = edgeGeom(a, b, -45);
    expect(bendThrough(a, b, g.mid)).toBeCloseTo(-45);
  });
});

describe('hitTest', () => {
  const doc: Doc = {
    version: 1,
    nodes: [node('a', 0, 0), node('b', 300, 0)],
    edges: [{ id: 'e', from: 'a', to: 'b', polarity: 1, weight: 1, delay: 0, bend: 0 }],
  };

  it('trouve un nœud, un lien et sa pastille', () => {
    expect(hitTest(doc, { x: 5, y: 5 }, 4)).toEqual({ kind: 'node', id: 'a' });
    expect(hitTest(doc, { x: 100, y: 2 }, 4)).toEqual({ kind: 'edge', id: 'e' });
    expect(hitTest(doc, { x: 150, y: 0 }, 4)).toEqual({ kind: 'badge', id: 'e' });
    expect(hitTest(doc, { x: 150, y: 80 }, 4)).toBeNull();
  });
});

describe('classifyStroke', () => {
  it('reconnaît un tap', () => {
    expect(classifyStroke([{ x: 0, y: 0 }, { x: 2, y: 1 }]).shape).toBe('tap');
  });

  it('reconnaît un cercle et en tire centre et rayon', () => {
    const s = classifyStroke(circle(100, 50, 60));
    expect(s.shape).toBe('closed');
    if (s.shape !== 'closed') return;
    expect(s.center.x).toBeCloseTo(100, 0);
    expect(s.center.y).toBeCloseTo(50, 0);
    expect(s.r).toBeCloseTo(60, 0);
  });

  it('un trait n’est pas un cercle, même en aller-retour', () => {
    expect(classifyStroke([{ x: 0, y: 0 }, { x: 150, y: 10 }]).shape).toBe('line');
    expect(classifyStroke([{ x: 0, y: 0 }, { x: 150, y: 5 }, { x: 0, y: 10 }]).shape).toBe('line');
  });

  it('tient compte du zoom', () => {
    // 8 unités monde = 80 pixels écran à zoom 10 : ce n'est plus un tap.
    expect(classifyStroke([{ x: 0, y: 0 }, { x: 8, y: 0 }], 0.1).shape).toBe('line');
  });
});

describe('docBounds', () => {
  it('englobe les cercles', () => {
    expect(docBounds({ version: 1, nodes: [node('a', 0, 0, 10), node('b', 100, 50, 20)], edges: [] })).toEqual({
      minX: -10,
      minY: -10,
      maxX: 120,
      maxY: 70,
    });
    expect(docBounds({ version: 1, nodes: [], edges: [] })).toBeNull();
  });
});
