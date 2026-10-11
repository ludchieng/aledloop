import type { Loop } from '../model/loops';
import { MAX_RADIUS, MIN_RADIUS, type Doc, type SysNode } from '../model/types';

export interface Pt {
  x: number;
  y: number;
}

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// --- Courbes de Bézier quadratiques ------------------------------------------

export function quadPoint(p0: Pt, c: Pt, p1: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
    y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
  };
}

export function quadTangent(p0: Pt, c: Pt, p1: Pt, t: number): Pt {
  const x = 2 * (1 - t) * (c.x - p0.x) + 2 * t * (p1.x - c.x);
  const y = 2 * (1 - t) * (c.y - p0.y) + 2 * t * (p1.y - c.y);
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

/** Normale unitaire du segment a → b. Le lien b → a a la normale opposée. */
function normal(a: Pt, b: Pt): Pt {
  const len = dist(a, b) || 1;
  return { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
}

export interface EdgeGeom {
  p0: Pt;
  c: Pt;
  p1: Pt;
  /** Paramètres où la courbe sort du nœud de départ et entre dans le nœud d'arrivée. */
  t0: number;
  t1: number;
  /** Milieu de la courbe (t = 0.5), où se trouve la pastille + / −. */
  mid: Pt;
}

/** Espace entre la pointe de flèche et le bord du nœud d'arrivée. */
export const ARROW_GAP = 6;

/**
 * Forme d'un nœud : demi-largeur, demi-hauteur, arrondi des coins. Une variable est un cercle ;
 * une accumulation, une boîte aux coins arrondis, comme les stocks d'Insight Maker ou de Vensim.
 */
export interface NodeShape {
  hw: number;
  hh: number;
  corner: number;
}

export function nodeShape(n: SysNode, scale = 1): NodeShape {
  const r = n.r * scale;
  return n.causal.kind === 'stock' ? { hw: r * 1.15, hh: r * 0.82, corner: r * 0.32 } : { hw: r, hh: r, corner: r };
}

/** Le point est-il dans le nœud, agrandi de `pad` ? (Distance signée à une boîte arrondie ; un cercle en est un cas particulier.) */
export function insideNode(n: SysNode, p: Pt, pad = 0): boolean {
  const { hw, hh, corner } = nodeShape(n);
  const qx = Math.abs(p.x - n.x) - (hw - corner);
  const qy = Math.abs(p.y - n.y) - (hh - corner);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) <= corner + pad;
}

export function edgeGeom(a: SysNode, b: SysNode, bend: number): EdgeGeom {
  const p0 = { x: a.x, y: a.y };
  const p1 = { x: b.x, y: b.y };
  const n = normal(p0, p1);
  // Le milieu de la courbe vaut (p0 + 2c + p1) / 4 : pour qu'il soit décalé de `bend`, c l'est de 2 × bend.
  const c = { x: (p0.x + p1.x) / 2 + n.x * bend * 2, y: (p0.y + p1.y) / 2 + n.y * bend * 2 };
  const t0 = exitParam(p0, c, p1, a, 0, 0, 0.5);
  const t1 = exitParam(p0, c, p1, b, ARROW_GAP, 1, 0.5);
  return { p0, c, p1, t0, t1, mid: quadPoint(p0, c, p1, 0.5) };
}

/**
 * Cherche par dichotomie le paramètre t (entre `inside` et `outside`) où la courbe sort du
 * nœud (agrandi de `pad`). Suppose que `inside` est dans le nœud.
 */
function exitParam(p0: Pt, c: Pt, p1: Pt, node: SysNode, pad: number, inside: number, outside: number): number {
  if (insideNode(node, quadPoint(p0, c, p1, outside), pad)) return outside;
  let lo = inside;
  let hi = outside;
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    if (insideNode(node, quadPoint(p0, c, p1, m), pad)) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

/** Courbure à donner au lien a → b pour que son milieu passe au plus près de p. */
export function bendThrough(a: Pt, b: Pt, p: Pt): number {
  const n = normal(a, b);
  return (p.x - (a.x + b.x) / 2) * n.x + (p.y - (a.y + b.y) / 2) * n.y;
}

// --- Tests de clic -------------------------------------------------------------

export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function distToEdge(g: EdgeGeom, p: Pt, samples = 24): number {
  let best = Infinity;
  let prev = quadPoint(g.p0, g.c, g.p1, g.t0);
  for (let i = 1; i <= samples; i++) {
    const t = g.t0 + ((g.t1 - g.t0) * i) / samples;
    const cur = quadPoint(g.p0, g.c, g.p1, t);
    best = Math.min(best, distToSegment(p, prev, cur));
    prev = cur;
  }
  return best;
}

/** Nœud sous le point p (le dernier dessiné, donc celui du dessus, en priorité). */
export function nodeAt(doc: Doc, p: Pt, pad = 0): SysNode | null {
  for (let i = doc.nodes.length - 1; i >= 0; i--) {
    const n = doc.nodes[i];
    if (insideNode(n, p, pad)) return n;
  }
  return null;
}

export function nodeById(doc: Doc): Map<string, SysNode> {
  return new Map(doc.nodes.map((n) => [n.id, n]));
}

export const BADGE_RADIUS = 11;

/** Demi-largeur de la zone où une perle se retourne, autour de la pastille (en fraction du trajet). */
const TURN_ZONE = 0.06;

/**
 * Orientation d'une perle à la fraction `t` de son trajet, dans [−1, 1], à multiplier par le sens
 * de l'effet transmis. Sur un lien +, toujours 1. Sur un lien −, la perle montre d'abord le sens
 * du changement de la cause (−1), puis se retourne en passant la pastille (0 pile dessus : un tiret,
 * comme le « − »), et montre ensuite le sens de l'effet (1). C'est le « − » qui inverse.
 */
/** Demi-largeur de la zone où une perle rougeoie autour de la pastille − (en fraction du trajet). */
const GLOW_ZONE = 0.2;

/**
 * Éclat rouge d'une perle à la fraction `t` de son trajet sur un lien −, dans [0, 1] : il naît à
 * l'approche de la pastille, culmine pile dessus (là où la perle se retourne), puis s'efface en douceur.
 */
export function flipGlow(g: EdgeGeom, t: number): number {
  const atBadge = (0.5 - g.t0) / (g.t1 - g.t0);
  const k = Math.max(0, 1 - Math.abs(t - atBadge) / GLOW_ZONE);
  return k * k * (3 - 2 * k);
}

export function beadTurn(g: EdgeGeom, polarity: number, t: number): number {
  if (polarity > 0) return 1;
  const atBadge = (0.5 - g.t0) / (g.t1 - g.t0);
  return Math.max(-1, Math.min(1, (t - atBadge) / TURN_ZONE));
}

export type Hit =
  | { kind: 'badge'; id: string }
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | { kind: 'loop'; id: string }
  | null;

/** Élément sous le point p. Priorité : pastille d'un lien, puis nœud, puis lien. `pad` en unités monde. */
export function hitTest(doc: Doc, p: Pt, pad: number): Hit {
  const byId = nodeById(doc);
  const geoms = doc.edges.map((e) => {
    const a = byId.get(e.from)!;
    const b = byId.get(e.to)!;
    return { e, g: edgeGeom(a, b, e.bend) };
  });
  for (const { e, g } of geoms) {
    if (dist(g.mid, p) <= BADGE_RADIUS + pad) return { kind: 'badge', id: e.id };
  }
  const node = nodeAt(doc, p, pad / 2);
  if (node) return { kind: 'node', id: node.id };
  let best: { id: string; d: number } | null = null;
  for (const { e, g } of geoms) {
    const d = distToEdge(g, p);
    if (d <= 4 + pad && (!best || d < best.d)) best = { id: e.id, d };
  }
  return best ? { kind: 'edge', id: best.id } : null;
}

// --- Reconnaissance de tracé -------------------------------------------------------

export function boundingBox(points: Pt[]): Box {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

export function pathLength(points: Pt[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += dist(points[i - 1], points[i]);
  return len;
}

/** Angle total parcouru par le tracé autour de `center`, en radians (signé : sens horaire ou non). */
export function sweptAngle(points: Pt[], center: Pt): number {
  let total = 0;
  let prev = Math.atan2(points[0].y - center.y, points[0].x - center.x);
  for (let i = 1; i < points.length; i++) {
    const a = Math.atan2(points[i].y - center.y, points[i].x - center.x);
    let d = a - prev;
    if (d > Math.PI) d -= 2 * Math.PI;
    else if (d < -Math.PI) d += 2 * Math.PI;
    total += d;
    prev = a;
  }
  return total;
}

export type Stroke = { shape: 'tap' } | { shape: 'line' } | { shape: 'closed'; center: Pt; r: number };

/**
 * Classe un tracé (en coordonnées monde). `scale` = taille d'un pixel écran en unités monde,
 * pour que les seuils ne dépendent pas du zoom.
 */
export function classifyStroke(points: Pt[], scale = 1): Stroke {
  if (points.length < 2 || pathLength(points) < 10 * scale) return { shape: 'tap' };
  const box = boundingBox(points);
  const w = box.maxX - box.minX;
  const h = box.maxY - box.minY;
  const big = Math.max(w, h);
  const small = Math.min(w, h);
  const gap = dist(points[0], points[points.length - 1]);
  // Tolérant aux cercles dessinés vite : il suffit de tourner d'environ trois quarts de tour autour
  // du centre (même mal refermé), ou de revenir près du point de départ. Un ovale assez rond passe.
  const center = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
  const turned = Math.abs(sweptAngle(points, center));
  const roundish = big > 30 * scale && small > 0.3 * big;
  const closed = roundish && (turned > 1.4 * Math.PI || (gap < 0.4 * big && pathLength(points) > 2.2 * big));
  if (!closed) return { shape: 'line' };
  return {
    shape: 'closed',
    center: { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 },
    r: clamp((w + h) / 4, MIN_RADIUS, MAX_RADIUS),
  };
}

export function nodesBounds(nodes: SysNode[]): Box | null {
  if (nodes.length === 0) return null;
  const shapes = nodes.map((n) => ({ n, s: nodeShape(n) }));
  return {
    minX: Math.min(...shapes.map(({ n, s }) => n.x - s.hw)),
    minY: Math.min(...shapes.map(({ n, s }) => n.y - s.hh)),
    maxX: Math.max(...shapes.map(({ n, s }) => n.x + s.hw)),
    maxY: Math.max(...shapes.map(({ n, s }) => n.y + s.hh)),
  };
}

export function docBounds(doc: Doc): Box | null {
  return nodesBounds(doc.nodes);
}

// --- Étiquettes de boucle (R / B) ------------------------------------------------

export const LOOP_RADIUS = 17;

export interface LoopLabel {
  loop: Loop;
  x: number;
  y: number;
  /** Sens de parcours à l'écran, pour dessiner la flèche circulaire dans le bon sens. */
  clockwise: boolean;
}

/**
 * Place une étiquette au centre de chaque boucle : moyenne des centres des nœuds et des milieux
 * des liens (ces derniers comptent pour les boucles à deux nœuds, dont les liens sont courbés).
 * Les étiquettes qui se chevauchent sont ensuite écartées.
 */
export function loopLabels(doc: Doc, loops: Loop[]): LoopLabel[] {
  const byId = nodeById(doc);
  const edges = new Map(doc.edges.map((e) => [e.id, e]));
  const labels: LoopLabel[] = [];
  for (const loop of loops) {
    const pts: Pt[] = [];
    for (const id of loop.edges) {
      const e = edges.get(id)!;
      const a = byId.get(e.from)!;
      pts.push(a, edgeGeom(a, byId.get(e.to)!, e.bend).mid);
    }
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      area += a.x * b.y - b.x * a.y;
    }
    labels.push({
      loop,
      x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
      y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
      // Repère écran : y vers le bas, donc une aire positive correspond au sens horaire.
      clockwise: area > 0,
    });
  }
  const min = LOOP_RADIUS * 2 + 6;
  for (let iter = 0; iter < 8; iter++) {
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i];
        const b = labels[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= min) continue;
        if (d < 0.01) {
          dx = 0;
          dy = 1;
          d = 1;
        }
        const push = (min - Math.min(d, min)) / 2;
        a.x -= (dx / d) * push;
        a.y -= (dy / d) * push;
        b.x += (dx / d) * push;
        b.y += (dy / d) * push;
      }
    }
  }
  return labels;
}

export function loopAt(labels: LoopLabel[], p: Pt, pad: number): LoopLabel | null {
  for (const l of labels) if (dist(l, p) <= LOOP_RADIUS + pad) return l;
  return null;
}
