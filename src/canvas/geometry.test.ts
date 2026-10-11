import { describe, expect, it } from 'vitest';
import { defaultCausal, emptyStory, type Doc, type SysNode } from '../model/types';
import { beadTurn, bendThrough, flipGlow, classifyStroke, dist, docBounds, edgeGeom, hitTest, quadPoint, type Pt } from './geometry';

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
    version: 2,
    timeUnit: 'year', horizon: 20,
    nodes: [node('a', 0, 0), node('b', 300, 0)],
    edges: [{ id: 'e', from: 'a', to: 'b', polarity: 1, weight: 1, delay: 0, bend: 0 }],
    story: emptyStory(),
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

  it('tolère un cercle tracé vite : mal refermé ou un peu ovale', () => {
    // Trois quarts de tour à peine (280°), de grosses irrégularités.
    const arc = Array.from({ length: 14 }, (_, i) => {
      const a = (i / 13) * ((280 * Math.PI) / 180);
      return { x: 200 + 70 * Math.cos(a), y: 100 + 50 * Math.sin(a) };
    });
    expect(classifyStroke(arc).shape).toBe('closed');
    // Un ovale assez aplati (3 pour 1) qui se referme.
    const ovale = Array.from({ length: 20 }, (_, i) => {
      const a = (i / 19) * 2 * Math.PI;
      return { x: 90 * Math.cos(a), y: 30 * Math.sin(a) };
    });
    expect(classifyStroke(ovale).shape).toBe('closed');
  });

  it('un U ou une vague restent des traits', () => {
    const u = Array.from({ length: 12 }, (_, i) => {
      const a = Math.PI + (i / 11) * Math.PI;
      return { x: 100 * Math.cos(a), y: -100 * Math.sin(a) };
    });
    expect(classifyStroke(u).shape).toBe('line');
    const vague = Array.from({ length: 20 }, (_, i) => ({ x: i * 15, y: 40 * Math.sin(i / 2) }));
    expect(classifyStroke(vague).shape).toBe('line');
  });

  it('tient compte du zoom', () => {
    // 8 unités monde = 80 pixels écran à zoom 10 : ce n'est plus un tap.
    expect(classifyStroke([{ x: 0, y: 0 }, { x: 8, y: 0 }], 0.1).shape).toBe('line');
  });
});

describe('docBounds', () => {
  it('englobe les cercles', () => {
    expect(docBounds({ version: 2, timeUnit: 'year', horizon: 20, nodes: [node('a', 0, 0, 10), node('b', 100, 50, 20)], edges: [], story: emptyStory() })).toEqual({
      minX: -10,
      minY: -10,
      maxX: 120,
      maxY: 70,
    });
    expect(docBounds({ version: 2, timeUnit: 'year', horizon: 20, nodes: [], edges: [], story: emptyStory() })).toBeNull();
  });
});

describe('beadTurn', () => {
  const g = edgeGeom(node('a', 0, 0, 40), node('b', 400, 0, 40), 30);
  const atBadge = (0.5 - g.t0) / (g.t1 - g.t0);

  it('lien + : la perle garde toujours le sens de l’effet', () => {
    for (const t of [0.05, atBadge, 0.95]) expect(beadTurn(g, 1, t)).toBe(1);
  });

  it('lien − : sens de la cause avant la pastille, à plat dessus, sens de l’effet après', () => {
    expect(beadTurn(g, -1, 0.1)).toBe(-1);
    expect(beadTurn(g, -1, atBadge)).toBeCloseTo(0);
    expect(beadTurn(g, -1, 0.9)).toBe(1);
    expect(beadTurn(g, -1, atBadge - 0.03)).toBeCloseTo(-0.5);
  });
});

describe('flipGlow', () => {
  const g = edgeGeom(node('a', 0, 0, 40), node('b', 400, 0, 40), 30);
  const atBadge = (0.5 - g.t0) / (g.t1 - g.t0);

  it('s’allume à l’approche, culmine sur la pastille, s’éteint ensuite', () => {
    expect(flipGlow(g, 0.02)).toBe(0);
    expect(flipGlow(g, atBadge - 0.1)).toBeGreaterThan(0);
    expect(flipGlow(g, atBadge)).toBeCloseTo(1);
    expect(flipGlow(g, atBadge + 0.1)).toBeLessThan(1);
    expect(flipGlow(g, 0.98)).toBe(0);
  });
});
