import type { Selection } from '../model/editor.svelte';
import type { Doc, SysNode } from '../model/types';
import type { LoopySim } from '../sim/loopy';
import type { Theme } from '../theme';
import type { Camera } from './camera';
import { BADGE_RADIUS, edgeGeom, nodeById, quadPoint, quadTangent, type EdgeGeom, type Hit, type Pt } from './geometry';

export const FONT = '"Nunito Variable", Nunito, system-ui, sans-serif';

export interface Overlay {
  selection: Selection;
  /** Élément survolé (souris) ou visé. */
  hover: Hit;
  /** Nœud visé par un tracé en cours (crayon) : futur bout du lien. */
  linkTarget: string | null;
  /** Tracé en cours, en coordonnées monde. */
  trail: { points: Pt[]; kind: 'pen' | 'eraser' } | null;
  /** Éléments touchés par la gomme, effacés au relâchement. */
  erasing: Set<string>;
  /** En simulation : moitié de nœud survolée (▲ en haut, ▼ en bas). */
  pulseHover: { id: string; delta: 1 | -1 } | null;
  sim: LoopySim | null;
}

export interface View {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
  camera: Camera;
  theme: Theme;
}

export function render(view: View, doc: Doc, o: Overlay) {
  const { ctx, width, height, dpr, camera } = view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width * dpr, height * dpr);

  drawGrid(view);

  ctx.setTransform(dpr * camera.zoom, 0, 0, dpr * camera.zoom, dpr * camera.x, dpr * camera.y);

  const byId = nodeById(doc);
  const geoms = new Map<string, EdgeGeom>();
  for (const e of doc.edges) geoms.set(e.id, edgeGeom(byId.get(e.from)!, byId.get(e.to)!, e.bend));

  // Liens
  for (const e of doc.edges) {
    const g = geoms.get(e.id)!;
    const selected = o.selection?.kind === 'edge' && o.selection.id === e.id;
    const hovered = o.hover?.id === e.id && (o.hover.kind === 'edge' || o.hover.kind === 'badge');
    ctx.globalAlpha = o.erasing.has(e.id) ? 0.2 : 1;
    drawEdge(view, g, e.polarity, selected, hovered, o.hover?.kind === 'badge' && o.hover.id === e.id);
  }
  ctx.globalAlpha = 1;

  // Impulsions en vol
  if (o.sim) {
    for (const s of o.sim.signals) {
      const g = geoms.get(s.edge.id);
      const from = byId.get(s.edge.from);
      if (g && from) drawSignal(view, g, s.t, s.delta, from);
    }
  }

  // Nœuds
  for (const n of doc.nodes) {
    const level = o.sim ? o.sim.level(n.id) : n.init;
    const hit = o.sim?.hits.get(n.id);
    ctx.globalAlpha = o.erasing.has(n.id) ? 0.2 : 1;
    drawNode(view, n, level, {
      selected: o.selection?.kind === 'node' && o.selection.id === n.id,
      hovered: (o.hover?.kind === 'node' && o.hover.id === n.id) || o.linkTarget === n.id,
      bounce: hit ? bounce(hit.age) : 0,
      pulse: o.sim ? (o.pulseHover?.id === n.id ? o.pulseHover.delta : 0) : null,
    });
  }
  ctx.globalAlpha = 1;

  if (o.trail) drawTrail(view, o.trail.points, o.trail.kind);
}

/** Petit rebond quand un nœud reçoit une impulsion. */
function bounce(age: number): number {
  if (age > 0.6) return 0;
  return Math.exp(-age * 7) * Math.cos(age * 18) * 0.09;
}

function drawGrid({ ctx, width, height, dpr, camera, theme }: View) {
  let step = 32;
  while (step * camera.zoom < 18) step *= 2;
  const s = step * camera.zoom;
  const ox = ((camera.x % s) + s) % s;
  const oy = ((camera.y % s) + s) % s;
  const r = Math.max(0.8, Math.min(1.6, camera.zoom * 1.3)) * dpr;
  ctx.fillStyle = theme.grid;
  ctx.beginPath();
  for (let x = ox; x < width; x += s) {
    for (let y = oy; y < height; y += s) {
      ctx.moveTo(x * dpr + r, y * dpr);
      ctx.arc(x * dpr, y * dpr, r, 0, Math.PI * 2);
    }
  }
  ctx.fill();
}

/** Ombre portée douce : les ombres canvas ignorent la transformation, on les met à l'échelle. */
function setShadow({ ctx, dpr, camera, theme }: View, blur: number, offsetY: number) {
  ctx.shadowColor = theme.shadow;
  ctx.shadowBlur = blur * dpr * camera.zoom;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = offsetY * dpr * camera.zoom;
}

function clearShadow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

/** Trace la portion [t0, t1] d'une Bézier quadratique (sous-courbe exacte). */
function subCurve(ctx: CanvasRenderingContext2D, g: EdgeGeom, t0: number, t1: number) {
  const start = quadPoint(g.p0, g.c, g.p1, t0);
  const end = quadPoint(g.p0, g.c, g.p1, t1);
  const k = t1 - t0;
  const cx = start.x + k * ((1 - t0) * (g.c.x - g.p0.x) + t0 * (g.p1.x - g.c.x));
  const cy = start.y + k * ((1 - t0) * (g.c.y - g.p0.y) + t0 * (g.p1.y - g.c.y));
  ctx.moveTo(start.x, start.y);
  ctx.quadraticCurveTo(cx, cy, end.x, end.y);
}

function drawEdge(view: View, g: EdgeGeom, polarity: 1 | -1, selected: boolean, hovered: boolean, badgeHovered: boolean) {
  const { ctx, theme } = view;
  if (g.t1 <= g.t0) return; // nœuds superposés
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (selected || hovered) {
    ctx.strokeStyle = theme.selection;
    ctx.globalAlpha *= selected ? 0.45 : 0.22;
    ctx.lineWidth = 13;
    ctx.beginPath();
    subCurve(ctx, g, g.t0, g.t1);
    ctx.stroke();
    ctx.globalAlpha /= selected ? 0.45 : 0.22;
  }

  const tip = quadPoint(g.p0, g.c, g.p1, g.t1);
  const dir = quadTangent(g.p0, g.c, g.p1, g.t1);
  const len = 15;
  const half = 8;
  // La ligne s'arrête à la base de la flèche, pour une pointe nette.
  const base = { x: tip.x - dir.x * len * 0.8, y: tip.y - dir.y * len * 0.8 };

  ctx.strokeStyle = theme.inkSoft;
  ctx.lineWidth = 4;
  ctx.beginPath();
  const tBase = g.t1 - (g.t1 - g.t0) * Math.min(0.5, (len * 0.8) / Math.max(1, approxLength(g)));
  subCurve(ctx, g, g.t0, tBase);
  ctx.stroke();

  ctx.fillStyle = theme.inkSoft;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(base.x - dir.x * len * 0.2 - dir.y * half, base.y - dir.y * len * 0.2 + dir.x * half);
  ctx.lineTo(base.x - dir.x * len * 0.2 + dir.y * half, base.y - dir.y * len * 0.2 - dir.x * half);
  ctx.closePath();
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fill();

  // Pastille + / −
  const color = polarity === 1 ? theme.positive : theme.negative;
  const r = BADGE_RADIUS * (badgeHovered ? 1.15 : 1);
  setShadow(view, 6, 1.5);
  ctx.fillStyle = view.theme.card;
  ctx.beginPath();
  ctx.arc(g.mid.x, g.mid.y, r, 0, Math.PI * 2);
  ctx.fill();
  clearShadow(ctx);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  drawSign(ctx, g.mid, polarity, r * 0.5, color);
}

function approxLength(g: EdgeGeom): number {
  let len = 0;
  let prev = quadPoint(g.p0, g.c, g.p1, g.t0);
  for (let i = 1; i <= 8; i++) {
    const cur = quadPoint(g.p0, g.c, g.p1, g.t0 + ((g.t1 - g.t0) * i) / 8);
    len += Math.hypot(cur.x - prev.x, cur.y - prev.y);
    prev = cur;
  }
  return len;
}

/** Dessine + ou − en traits (plus net qu'un glyphe, et indépendant de la police). */
function drawSign(ctx: CanvasRenderingContext2D, c: Pt, sign: number, half: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(c.x - half, c.y);
  ctx.lineTo(c.x + half, c.y);
  if (sign > 0) {
    ctx.moveTo(c.x, c.y - half);
    ctx.lineTo(c.x, c.y + half);
  }
  ctx.stroke();
}

interface NodeState {
  selected: boolean;
  hovered: boolean;
  bounce: number;
  /** null hors simulation ; sinon moitié survolée (1 : ▲, −1 : ▼, 0 : aucune). */
  pulse: number | null;
}

function drawNode(view: View, n: SysNode, level: number, s: NodeState) {
  const { ctx, theme } = view;
  const sw = theme.swatches[n.color];
  const r = n.r * (1 + s.bounce);

  if (s.selected || s.hovered) {
    ctx.fillStyle = theme.selection;
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * (s.selected ? 0.4 : 0.2);
    ctx.beginPath();
    ctx.arc(n.x, n.y, r + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = a;
  }

  // Galet : ombre portée, remplissage pastel
  setShadow(view, 16, 5);
  ctx.fillStyle = sw.fill;
  ctx.beginPath();
  ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
  ctx.fill();
  clearShadow(ctx);

  // Niveau : le galet se remplit par le bas
  if (level > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = sw.level;
    const top = n.y + r - 2 * r * level;
    ctx.fillRect(n.x - r, top, 2 * r, 2 * r * level + 1);
    ctx.restore();
  }

  // Reflet en haut à gauche
  const grad = ctx.createRadialGradient(n.x - r * 0.38, n.y - r * 0.45, r * 0.05, n.x - r * 0.3, n.y - r * 0.35, r * 0.95);
  grad.addColorStop(0, theme.highlight);
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = sw.stroke;
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Boutons ▲ ▼ en simulation : moitié haute / moitié basse du galet
  if (s.pulse !== null) {
    drawChevron(ctx, n.x, n.y - r * 0.62, r * 0.2, -1, sw.stroke, s.pulse === 1 ? 1 : 0.45);
    drawChevron(ctx, n.x, n.y + r * 0.62, r * 0.2, 1, sw.stroke, s.pulse === -1 ? 1 : 0.45);
  }

  if (n.label) drawLabel(ctx, n, r, sw.fill, theme.ink);
}

function drawChevron(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, dir: number, color: string, alpha: number) {
  const a = ctx.globalAlpha;
  ctx.globalAlpha = a * alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2.5, size * 0.35);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - size, y - (dir * size) / 2);
  ctx.lineTo(x, y + (dir * size) / 2);
  ctx.lineTo(x + size, y - (dir * size) / 2);
  ctx.stroke();
  ctx.globalAlpha = a;
}

function drawLabel(ctx: CanvasRenderingContext2D, n: SysNode, r: number, halo: string, ink: string) {
  let size = Math.max(13, Math.min(24, r * 0.36));
  ctx.font = `700 ${size}px ${FONT}`;
  const maxWidth = r * 1.75;
  const width = ctx.measureText(n.label).width;
  if (width > maxWidth) {
    size = Math.max(10, (size * maxWidth) / width);
    ctx.font = `700 ${size}px ${FONT}`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = halo;
  ctx.lineWidth = 4;
  ctx.strokeText(n.label, n.x, n.y);
  ctx.fillStyle = ink;
  ctx.fillText(n.label, n.x, n.y);
}

function drawSignal(view: View, g: EdgeGeom, t: number, delta: number, from: SysNode) {
  const { ctx, theme } = view;
  const p = quadPoint(g.p0, g.c, g.p1, g.t0 + (g.t1 - g.t0) * t);
  const sw = theme.swatches[from.color];
  const grow = Math.min(1, t * 6);
  const r = 10 * grow;
  setShadow(view, 6, 2);
  ctx.fillStyle = sw.level;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
  clearShadow(ctx);
  ctx.strokeStyle = sw.stroke;
  ctx.lineWidth = 2;
  ctx.stroke();
  drawChevron(ctx, p.x, p.y, r * 0.45, delta > 0 ? -1 : 1, theme.ink, 0.85);
}

function drawTrail({ ctx, camera, theme }: View, points: Pt[], kind: 'pen' | 'eraser') {
  if (points.length < 2) return;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = kind === 'pen' ? theme.ink : theme.selection;
  ctx.globalAlpha = kind === 'pen' ? 0.55 : 0.3;
  ctx.lineWidth = (kind === 'pen' ? 3 : 18) / camera.zoom;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
