import type { Selection } from '../model/editor.svelte';
import type { Loop } from '../model/loops';
import type { Doc, SysEdge, SysNode } from '../model/types';
import { HISTORY_LEN, type LoopySim } from '../sim/loopy';
import type { Theme } from '../theme';
import type { Camera } from './camera';
import {
  BADGE_RADIUS,
  edgeGeom,
  LOOP_RADIUS,
  nodeById,
  quadPoint,
  quadTangent,
  type EdgeGeom,
  type Hit,
  type LoopLabel,
  type Pt,
} from './geometry';

export const FONT = '"Nunito Variable", Nunito, system-ui, sans-serif';
export const TITLE_FONT = '"Fraunces Variable", Fraunces, Georgia, serif';

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
  /** Étiquettes R / B à dessiner (null : masquées). */
  loopLabels: LoopLabel[] | null;
  /** Boucle mise en évidence (survolée ou sélectionnée) : le reste s'estompe. */
  loopFocus: Loop | null;
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

/** Opacité des éléments hors de la boucle mise en évidence. */
const DIMMED = 0.22;
const WIDTHS: Record<number, number> = { 0.5: 2.5, 1: 4, 2: 6.5 };

export function render(view: View, doc: Doc, o: Overlay) {
  const { ctx, width, height, dpr, camera } = view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width * dpr, height * dpr);

  drawGrid(view);

  ctx.setTransform(dpr * camera.zoom, 0, 0, dpr * camera.zoom, dpr * camera.x, dpr * camera.y);

  const byId = nodeById(doc);
  const geoms = new Map<string, EdgeGeom>();
  for (const e of doc.edges) geoms.set(e.id, edgeGeom(byId.get(e.from)!, byId.get(e.to)!, e.bend));
  const focusNodes = new Set(o.loopFocus?.nodes);
  const focusEdges = new Set(o.loopFocus?.edges);
  const alpha = (id: string, inFocus: Set<string>) => (o.erasing.has(id) ? 0.2 : o.loopFocus && !inFocus.has(id) ? DIMMED : 1);

  // Liens
  for (const e of doc.edges) {
    const selected = (o.selection?.kind === 'edge' && o.selection.id === e.id) || focusEdges.has(e.id);
    const hovered = o.hover?.id === e.id && (o.hover.kind === 'edge' || o.hover.kind === 'badge');
    ctx.globalAlpha = alpha(e.id, focusEdges);
    drawEdge(view, geoms.get(e.id)!, e, selected, hovered, o.hover?.kind === 'badge' && o.hover.id === e.id);
  }
  ctx.globalAlpha = 1;

  // Impulsions en vol
  if (o.sim) {
    for (const s of o.sim.signals) {
      const g = geoms.get(s.edge.id);
      const from = byId.get(s.edge.from);
      if (!g || !from || s.t < 0) continue;
      ctx.globalAlpha = alpha(s.edge.id, focusEdges);
      drawSignal(view, g, s.t, s.delta, from);
    }
    ctx.globalAlpha = 1;
  }

  // Nœuds
  for (const n of doc.nodes) {
    const level = o.sim ? o.sim.level(n.id) : n.causal.init;
    const hit = o.sim?.hits.get(n.id);
    ctx.globalAlpha = alpha(n.id, focusNodes);
    drawNode(view, n, level, {
      selected: o.selection?.kind === 'node' && o.selection.id === n.id,
      hovered: (o.hover?.kind === 'node' && o.hover.id === n.id) || o.linkTarget === n.id,
      bounce: hit ? bounce(hit.age) * (hit.event ? 2.2 : 1) : 0,
      pulse: o.sim ? (o.pulseHover?.id === n.id ? o.pulseHover.delta : 0) : null,
      tipped: o.sim?.tipped.has(n.id) ?? false,
    });
    const history = o.sim?.history.get(n.id);
    if (history) drawHistory(view, n, history);
  }
  ctx.globalAlpha = 1;

  // Étiquettes de boucle, par-dessus tout
  if (o.loopLabels) {
    for (const l of o.loopLabels) {
      const focused = o.loopFocus?.key === l.loop.key;
      ctx.globalAlpha = o.loopFocus && !focused ? 0.35 : 1;
      drawLoopLabel(view, l, focused);
    }
    ctx.globalAlpha = 1;
  }

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

function drawEdge(view: View, g: EdgeGeom, e: SysEdge, selected: boolean, hovered: boolean, badgeHovered: boolean) {
  const { ctx, theme } = view;
  if (g.t1 <= g.t0) return; // nœuds superposés
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const width = WIDTHS[e.weight] ?? 4;

  if (selected || hovered) {
    const a = ctx.globalAlpha;
    ctx.strokeStyle = theme.selection;
    ctx.globalAlpha = a * (selected ? 0.45 : 0.22);
    ctx.lineWidth = width + 9;
    ctx.beginPath();
    subCurve(ctx, g, g.t0, g.t1);
    ctx.stroke();
    ctx.globalAlpha = a;
  }

  const tip = quadPoint(g.p0, g.c, g.p1, g.t1);
  const dir = quadTangent(g.p0, g.c, g.p1, g.t1);
  const len = 13 + width / 2;
  const half = 6 + width / 2;
  // La ligne s'arrête à la base de la flèche, pour une pointe nette.
  const base = { x: tip.x - dir.x * len * 0.8, y: tip.y - dir.y * len * 0.8 };

  ctx.strokeStyle = theme.inkSoft;
  ctx.lineWidth = width;
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

  // Retard : deux traits en travers du lien (la notation classique des diagrammes causaux).
  if (e.delay > 0) drawDelayMark(ctx, g, 0.72, width, theme.inkSoft);
  if (e.delay > 1) drawDelayMark(ctx, g, 0.3, width, theme.inkSoft);

  // Pastille + / −
  const color = e.polarity === 1 ? theme.positive : theme.negative;
  const r = BADGE_RADIUS * (badgeHovered ? 1.15 : 1);
  setShadow(view, 6, 1.5);
  ctx.fillStyle = theme.card;
  ctx.beginPath();
  ctx.arc(g.mid.x, g.mid.y, r, 0, Math.PI * 2);
  ctx.fill();
  clearShadow(ctx);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  drawSign(ctx, g.mid, e.polarity, r * 0.5, color);
}

function drawDelayMark(ctx: CanvasRenderingContext2D, g: EdgeGeom, at: number, width: number, color: string) {
  const t = g.t0 + (g.t1 - g.t0) * at;
  const p = quadPoint(g.p0, g.c, g.p1, t);
  const d = quadTangent(g.p0, g.c, g.p1, t);
  const half = 8 + width;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const off of [-3.5, 3.5]) {
    const cx = p.x + d.x * off;
    const cy = p.y + d.y * off;
    ctx.moveTo(cx - d.y * half, cy + d.x * half);
    ctx.lineTo(cx + d.y * half, cy - d.x * half);
  }
  ctx.stroke();
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
  tipped: boolean;
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

  ctx.save();
  ctx.beginPath();
  ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
  ctx.clip();
  // Niveau : le galet se remplit par le bas
  if (level > 0) {
    ctx.fillStyle = sw.level;
    const top = n.y + r - 2 * r * level;
    ctx.fillRect(n.x - r, top, 2 * r, 2 * r * level + 1);
  }
  // Seuil : une graduation en pointillés, comme sur un verre doseur
  const c = n.causal;
  if (c.thresholdMode !== 'none') {
    const y = n.y + r - 2 * r * c.threshold;
    ctx.strokeStyle = c.thresholdMode === 'tip' ? theme.negative : theme.swatches.ochre.stroke;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(n.x - r, y);
    ctx.lineTo(n.x + r, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();

  // Reflet en haut à gauche
  const grad = ctx.createRadialGradient(n.x - r * 0.38, n.y - r * 0.45, r * 0.05, n.x - r * 0.3, n.y - r * 0.35, r * 0.95);
  grad.addColorStop(0, theme.highlight);
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = s.tipped ? theme.negative : sw.stroke;
  ctx.lineWidth = s.tipped ? 5 : 3.5;
  ctx.stroke();

  // Boutons ▲ ▼ en simulation : moitié haute / moitié basse du galet
  if (s.pulse !== null) {
    drawChevron(ctx, n.x, n.y - r * 0.62, r * 0.2, -1, sw.stroke, s.pulse === 1 ? 1 : 0.45);
    drawChevron(ctx, n.x, n.y + r * 0.62, r * 0.2, 1, sw.stroke, s.pulse === -1 ? 1 : 0.45);
  }

  if (n.label) drawLabel(ctx, n, r, sw.fill, theme.ink);
  if (s.tipped) drawLock(view, n.x + r * 0.72, n.y - r * 0.72);
}

/** Petit cadenas : l'élément a basculé, c'est irréversible. */
function drawLock(view: View, x: number, y: number) {
  const { ctx, theme } = view;
  setShadow(view, 5, 1.5);
  ctx.fillStyle = theme.card;
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.fill();
  clearShadow(ctx);
  ctx.strokeStyle = theme.negative;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = theme.negative;
  ctx.beginPath();
  ctx.roundRect(x - 5.5, y - 1.5, 11, 8, 2);
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(x, y - 2, 3.6, Math.PI, 0);
  ctx.stroke();
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

/** Petite courbe des dernières secondes, sous le galet. */
function drawHistory(view: View, n: SysNode, values: number[]) {
  const { ctx, theme } = view;
  const sw = theme.swatches[n.color];
  const w = Math.max(70, n.r * 1.5);
  const h = 24;
  const x0 = n.x - w / 2;
  const y0 = n.y + n.r + 12;
  const pad = 3;
  const yOf = (v: number) => y0 + h - pad - v * (h - 2 * pad);

  setShadow(view, 6, 1.5);
  ctx.fillStyle = theme.card;
  ctx.beginPath();
  ctx.roundRect(x0, y0, w, h, 7);
  ctx.fill();
  clearShadow(ctx);

  // Repère : niveau de départ
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(x0 + 4, yOf(n.causal.init));
  ctx.lineTo(x0 + w - 4, yOf(n.causal.init));
  ctx.stroke();
  ctx.setLineDash([]);

  if (values.length > 1) {
    const dx = (w - 8) / (HISTORY_LEN - 1);
    const start = x0 + w - 4 - (values.length - 1) * dx;
    ctx.strokeStyle = sw.stroke;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    values.forEach((v, i) => (i === 0 ? ctx.moveTo(start, yOf(v)) : ctx.lineTo(start + i * dx, yOf(v))));
    ctx.stroke();
  }
}

function drawLoopLabel(view: View, l: LoopLabel, focused: boolean) {
  const { ctx, theme } = view;
  const color = l.loop.kind === 'R' ? theme.swatches.terracotta.stroke : theme.swatches.slate.stroke;
  const R = LOOP_RADIUS;

  if (focused) {
    const a = ctx.globalAlpha;
    ctx.fillStyle = theme.selection;
    ctx.globalAlpha = a * 0.4;
    ctx.beginPath();
    ctx.arc(l.x, l.y, R + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = a;
  }

  setShadow(view, 8, 2);
  ctx.fillStyle = theme.card;
  ctx.beginPath();
  ctx.arc(l.x, l.y, R, 0, Math.PI * 2);
  ctx.fill();
  clearShadow(ctx);

  // Flèche circulaire dans le sens de parcours de la boucle
  const ar = R - 5;
  const sweep = Math.PI * 1.55;
  const dir = l.clockwise ? 1 : -1;
  const a0 = -Math.PI / 2 + dir * 0.45;
  const a1 = a0 + dir * sweep;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(l.x, l.y, ar, a0, a1, !l.clockwise);
  ctx.stroke();
  const ex = l.x + Math.cos(a1) * ar;
  const ey = l.y + Math.sin(a1) * ar;
  const tx = -Math.sin(a1) * dir;
  const ty = Math.cos(a1) * dir;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(ex + tx * 5, ey + ty * 5);
  ctx.lineTo(ex - tx * 1.5 - ty * 4, ey - ty * 1.5 + tx * 4);
  ctx.lineTo(ex - tx * 1.5 + ty * 4, ey - ty * 1.5 - tx * 4);
  ctx.closePath();
  ctx.fill();

  ctx.font = `700 14px ${TITLE_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(l.loop.kind, l.x, l.y + 1);
}

function drawSignal(view: View, g: EdgeGeom, t: number, delta: number, from: SysNode) {
  const { ctx, theme } = view;
  const p = quadPoint(g.p0, g.c, g.p1, g.t0 + (g.t1 - g.t0) * t);
  const sw = theme.swatches[from.color];
  const grow = Math.min(1, t * 6);
  const r = 10 * grow * Math.min(1.4, Math.max(0.55, Math.sqrt(Math.abs(delta))));
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
