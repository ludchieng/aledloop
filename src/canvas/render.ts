import type { Lang } from '../i18n/lang';
import type { Selection } from '../model/editor.svelte';
import { formatDuration } from '../model/time';
import type { Doc, SysEdge, SysNode, TimeUnit } from '../model/types';
import type { CausalSim } from '../sim/causal';
import type { PacketTracker } from '../sim/packets';
import type { Theme } from '../theme';
import type { Camera } from './camera';
import {
  BADGE_RADIUS,
  beadTurn,
  edgeGeom,
  flipGlow,
  LOOP_RADIUS,
  nodeById,
  nodeShape,
  type NodeShape,
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
  /** Dernier tracé du crayon, qui s'estompe après le relâchement (opacité dans [0, 1]). */
  ghost: { points: Pt[]; alpha: number } | null;
  /** Tracé en cours, en coordonnées monde. */
  trail: { points: Pt[]; kind: 'pen' | 'eraser' } | null;
  /** Éléments touchés par la gomme, effacés au relâchement. */
  erasing: Set<string>;
  /** En simulation : moitié de nœud survolée (▲ en haut, ▼ en bas). */
  pulseHover: { id: string; delta: 1 | -1 } | null;
  /** Étiquettes R / B à dessiner (null : masquées). */
  loopLabels: LoopLabel[] | null;
  /** Éléments mis en avant (boucle survolée, étape du récit…) : le reste s'estompe. */
  focus: Set<string> | null;
  /** Boucle mise en évidence : ses liens ont un halo, son étiquette aussi. */
  focusLoop: string | null;
  /** Éléments pas encore apparus (récit construit pas à pas) : non dessinés. */
  hidden: Set<string> | null;
  /** Éléments en train d'apparaître : opacité dans [0, 1]. */
  fade: Map<string, number> | null;
  sim: CausalSim | null;
  /** Avancement des perles animées sur chaque lien (simulation). */
  phases: Map<string, number> | null;
  /** Perles par paquets des liens qui mènent à une variable (simulation). */
  packets: PacketTracker | null;
}

export interface View {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
  camera: Camera;
  theme: Theme;
  /** Langue des étiquettes de retard (« 3 ans », « 3 years »). */
  lang: Lang;
}

/** Opacité des éléments hors de la boucle mise en évidence. */
const DIMMED = 0.22;
/** Épaisseur d'un lien selon sa force. */
const edgeWidth = (weight: number) => 1.5 + 2.5 * weight ** 0.75;
/** Perles visibles en même temps sur un lien. */
const BEADS = 3;

export function render(view: View, doc: Doc, o: Overlay) {
  const { ctx, width, height, dpr, camera } = view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width * dpr, height * dpr);

  drawGrid(view);

  ctx.setTransform(dpr * camera.zoom, 0, 0, dpr * camera.zoom, dpr * camera.x, dpr * camera.y);

  const byId = nodeById(doc);
  const geoms = new Map<string, EdgeGeom>();
  for (const e of doc.edges) geoms.set(e.id, edgeGeom(byId.get(e.from)!, byId.get(e.to)!, e.bend));
  const hidden = o.hidden;
  const isHidden = (id: string) => !!hidden?.has(id);
  const loopEdges = new Set(o.focusLoop ? o.focusLoop.split('|') : []);
  const alpha = (id: string) =>
    (o.erasing.has(id) ? 0.2 : o.focus && !o.focus.has(id) ? DIMMED : 1) * (o.fade?.get(id) ?? 1);

  // Liens
  for (const e of doc.edges) {
    if (isHidden(e.id) || isHidden(e.from) || isHidden(e.to)) continue;
    const selected = (o.selection?.kind === 'edge' && o.selection.id === e.id) || loopEdges.has(e.id);
    const hovered = o.hover?.id === e.id && (o.hover.kind === 'edge' || o.hover.kind === 'badge');
    ctx.globalAlpha = alpha(e.id);
    drawEdge(view, geoms.get(e.id)!, e, doc.timeUnit, selected, hovered, o.hover?.kind === 'badge' && o.hover.id === e.id);
  }
  ctx.globalAlpha = 1;

  const imprints: { g: EdgeGeom; alpha: number; value: number; age: number }[] = [];
  // Ce qui circule sur les liens : des perles dont la taille suit l'écart transmis.
  // Sur un lien −, elles se retournent en passant la pastille : on voit le « − » inverser le sens.
  if (o.sim) {
    for (const e of doc.edges) {
      if (isHidden(e.id) || isHidden(e.from) || isHidden(e.to)) continue;
      const g = geoms.get(e.id)!;
      if (g.t1 <= g.t0) continue;
      // Vers une accumulation : un débit, des perles en continu. Vers une variable : des paquets,
      // seulement quand la cause change (voir sim/packets.ts).
      const intoStock = byId.get(e.to)!.causal.kind === 'stock';
      const phase = o.phases?.get(e.id) ?? 0;
      const beads = intoStock
        ? Array.from({ length: BEADS }, (_, k) => {
            const t = (phase + k / BEADS) % 1;
            return { t, value: o.sim!.edgeSignal(e.id, t) };
          })
        : (o.packets?.get(e.id) ?? []);
      // Persistance rétinienne : l'empreinte de la dernière perle arrivée, dessinée après les galets.
      const imprint = intoStock ? null : o.packets?.imprint(e.id);
      if (imprint) imprints.push({ g, alpha: alpha(e.id) * imprint.strength, value: imprint.value, age: imprint.age });
      for (const { t, value } of beads) {
        if (Math.abs(value) < 0.004) continue;
        ctx.globalAlpha = alpha(e.id) * Math.min(1, Math.abs(value) / 0.04);
        // Lien − : la perle rougeoie en passant la pastille, là où elle se retourne.
        const glow = e.polarity < 0 ? flipGlow(g, t) : 0;
        drawBead(view, g, t, value, beadTurn(g, e.polarity, t), glow, byId.get(e.from)!);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Impact le plus récent reçu par chaque variable : son chevron ▲ ou ▼ s'allume.
  const impacts = new Map<string, number>();
  if (o.packets) {
    const latest = new Map<string, number>();
    for (const e of doc.edges) {
      const imprint = o.packets.imprint(e.id);
      if (!imprint || isHidden(e.id) || imprint.age >= (latest.get(e.to) ?? Infinity)) continue;
      latest.set(e.to, imprint.age);
      impacts.set(e.to, Math.sign(imprint.value) * imprint.strength);
    }
  }

  // Nœuds
  for (const n of doc.nodes) {
    if (isHidden(n.id)) continue;
    const level = o.sim ? o.sim.level(n.id) : n.causal.init;
    const hit = o.sim?.hits.get(n.id);
    ctx.globalAlpha = alpha(n.id);
    drawNode(view, n, level, {
      selected: o.selection?.kind === 'node' && o.selection.id === n.id,
      hovered: (o.hover?.kind === 'node' && o.hover.id === n.id) || o.linkTarget === n.id,
      bounce: hit ? bounce(hit.age) * (hit.event ? 2.2 : 1) : 0,
      pulse: o.sim ? (o.pulseHover?.id === n.id ? o.pulseHover.delta : 0) : null,
      tipped: o.sim?.tipped.has(n.id) ?? false,
      impact: impacts.get(n.id) ?? 0,
    });
    const history = o.sim?.history.get(n.id);
    if (history) drawHistory(view, n, history, o.sim!, doc.horizon);
  }
  ctx.globalAlpha = 1;

  // Empreintes d'impact, par-dessus les galets et leurs petites courbes : on doit pouvoir les lire.
  for (const im of imprints) {
    ctx.globalAlpha = im.alpha;
    drawImprint(view, im.g, im.value, im.age);
  }
  ctx.globalAlpha = 1;

  // Étiquettes de boucle, par-dessus tout
  if (o.loopLabels) {
    for (const l of o.loopLabels) {
      if (l.loop.edges.some(isHidden)) continue;
      const focused = o.focusLoop === l.loop.key;
      const inFocus = !o.focus || l.loop.edges.every((id) => o.focus!.has(id));
      ctx.globalAlpha = (focused || inFocus ? 1 : 0.35) * Math.min(...l.loop.edges.map((id) => o.fade?.get(id) ?? 1));
      drawLoopLabel(view, l, focused);
    }
    ctx.globalAlpha = 1;
  }

  if (o.ghost) drawTrail(view, o.ghost.points, 'pen', o.ghost.alpha);
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

function drawEdge(view: View, g: EdgeGeom, e: SysEdge, unit: TimeUnit, selected: boolean, hovered: boolean, badgeHovered: boolean) {
  const { ctx, theme } = view;
  if (g.t1 <= g.t0) return; // nœuds superposés
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const width = edgeWidth(e.weight);

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

  // Retard : deux traits en travers du lien (la notation classique des diagrammes causaux), et sa durée.
  if (e.delay > 0) drawDelay(view, g, formatDuration(e.delay, unit, view.lang), width);

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

function drawDelay({ ctx, theme }: View, g: EdgeGeom, label: string, width: number) {
  const t = g.t0 + (g.t1 - g.t0) * 0.72;
  const p = quadPoint(g.p0, g.c, g.p1, t);
  const d = quadTangent(g.p0, g.c, g.p1, t);
  const half = 8 + width;
  ctx.strokeStyle = theme.inkSoft;
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

  // La durée, à l'extérieur de la courbe (côté bosse, vers le point de contrôle) : l'intérieur d'une
  // boucle est réservé à son étiquette R / B. Au-dessus si le lien est droit.
  const nx = -d.y;
  const ny = d.x;
  const toward = nx * (g.c.x - p.x) + ny * (g.c.y - p.y);
  const side = Math.abs(toward) > 1 ? Math.sign(toward) : ny > 0 ? -1 : 1;
  ctx.font = `800 13px ${FONT}`;
  const offset = half + 4 + (Math.abs(nx) * ctx.measureText(label).width) / 2 + Math.abs(ny) * 7;
  const lx = p.x + nx * side * offset;
  const ly = p.y + ny * side * offset;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = theme.paper;
  ctx.lineWidth = 4;
  ctx.strokeText(label, lx, ly);
  ctx.fillStyle = theme.inkSoft;
  ctx.fillText(label, lx, ly);
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
  /** Impact récent d'une perle (variable seulement) : signe = sens, valeur absolue = éclat dans [0, 1]. */
  impact: number;
}

/** Trace le contour d'un nœud (cercle ou boîte arrondie), agrandi de `grow`. */
function nodePath(ctx: CanvasRenderingContext2D, n: SysNode, shape: NodeShape, grow = 0) {
  const { hw, hh, corner } = shape;
  ctx.beginPath();
  if (hw === hh && corner === hw) ctx.arc(n.x, n.y, hw + grow, 0, Math.PI * 2);
  else ctx.roundRect(n.x - hw - grow, n.y - hh - grow, 2 * (hw + grow), 2 * (hh + grow), Math.max(0, corner + grow));
}

function drawNode(view: View, n: SysNode, level: number, s: NodeState) {
  const { ctx, theme } = view;
  const sw = theme.swatches[n.color];
  // Variable : un galet rond. Accumulation : une boîte, comme les stocks d'Insight Maker.
  const shape = nodeShape(n, 1 + s.bounce);
  const { hw, hh } = shape;
  const r = n.r * (1 + s.bounce);

  if (s.selected || s.hovered) {
    ctx.fillStyle = theme.selection;
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * (s.selected ? 0.4 : 0.2);
    nodePath(ctx, n, shape, 8);
    ctx.fill();
    ctx.globalAlpha = a;
  }

  // Galet : ombre portée, remplissage pastel
  setShadow(view, 16, 5);
  ctx.fillStyle = sw.fill;
  nodePath(ctx, n, shape);
  ctx.fill();
  clearShadow(ctx);

  ctx.save();
  nodePath(ctx, n, shape);
  ctx.clip();
  // Niveau : le galet se remplit par le bas
  if (level > 0) {
    ctx.fillStyle = sw.level;
    const top = n.y + hh - 2 * hh * level;
    ctx.fillRect(n.x - hw, top, 2 * hw, 2 * hh * level + 1);
  }
  // Seuil : une graduation en pointillés, comme sur un verre doseur
  const c = n.causal;
  if (c.thresholdMode !== 'none') {
    const y = n.y + hh - 2 * hh * c.threshold;
    ctx.strokeStyle = c.thresholdMode === 'tip' ? theme.negative : theme.swatches.ochre.stroke;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(n.x - hw, y);
    ctx.lineTo(n.x + hw, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();

  // Reflet en haut à gauche
  const grad = ctx.createRadialGradient(n.x - hw * 0.38, n.y - hh * 0.45, r * 0.05, n.x - hw * 0.3, n.y - hh * 0.35, r * 0.95);
  grad.addColorStop(0, theme.highlight);
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  nodePath(ctx, n, shape);
  ctx.fill();

  ctx.strokeStyle = s.tipped ? theme.negative : sw.stroke;
  ctx.lineWidth = s.tipped ? 5 : 3.5;
  ctx.stroke();

  // Accumulation : en plus de la forme de boîte, un double contour, comme le rebord d'un réservoir.
  if (n.causal.kind === 'stock') {
    ctx.lineWidth = 2;
    nodePath(ctx, n, shape, -Math.min(7, r * 0.2));
    ctx.stroke();
  }

  // Boutons ▲ ▼ en simulation : moitié haute / moitié basse du galet. Le chevron s'allume quand
  // une perle vient de pousser la variable dans ce sens.
  if (s.pulse !== null) {
    const up = Math.max(s.pulse === 1 ? 1 : 0.45, s.impact > 0 ? s.impact : 0);
    const down = Math.max(s.pulse === -1 ? 1 : 0.45, s.impact < 0 ? -s.impact : 0);
    const size = Math.min(r, hh) * 0.2;
    drawChevron(ctx, n.x, n.y - hh * 0.62, size * (1 + 0.5 * Math.max(0, s.impact)), -1, s.impact > 0.3 ? theme.ink : sw.stroke, up);
    drawChevron(ctx, n.x, n.y + hh * 0.62, size * (1 + 0.5 * Math.max(0, -s.impact)), 1, s.impact < -0.3 ? theme.ink : sw.stroke, down);
  }

  if (n.label) drawLabel(ctx, n, r, hw, sw.fill, theme.ink);
  if (s.tipped) drawLock(view, n.x + hw * 0.72, n.y - hh * 0.72);
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

function drawLabel(ctx: CanvasRenderingContext2D, n: SysNode, r: number, hw: number, halo: string, ink: string) {
  let size = Math.max(13, Math.min(24, r * 0.36));
  ctx.font = `700 ${size}px ${FONT}`;
  const maxWidth = hw * 1.75;
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

/**
 * Petite courbe sous le galet, sur la fenêtre de la durée de simulation : elle se dessine de gauche
 * à droite, puis défile une fois la durée dépassée (comme le panneau des courbes).
 */
function drawHistory(view: View, n: SysNode, values: number[], sim: CausalSim, span: number) {
  const { ctx, theme } = view;
  const sw = theme.swatches[n.color];
  const { hw, hh } = nodeShape(n);
  const w = Math.max(70, hw * 1.5);
  const h = 24;
  const x0 = n.x - w / 2;
  const y0 = n.y + hh + 12;
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
    const start = Math.max(0, sim.time - span);
    const xOf = (i: number) => x0 + 4 + ((sim.historyStart + i * sim.historyDt - start) / span) * (w - 8);
    ctx.strokeStyle = sw.stroke;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    values.forEach((v, i) => (i === 0 ? ctx.moveTo(Math.max(x0 + 4, xOf(i)), yOf(v)) : ctx.lineTo(xOf(i), yOf(v))));
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

  // Boucle sans accumulation ni retard : un contour en pointillés signale qu'elle n'a pas de rythme propre.
  if (l.loop.instant) {
    ctx.strokeStyle = theme.negative;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3.5]);
    ctx.beginPath();
    ctx.arc(l.x, l.y, R + 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

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

/**
 * Empreinte d'une perle arrivée sur une variable : un gros chevron ▲ ou ▼ dans une pastille, juste
 * avant la pointe de la flèche, qui « tape » à l'arrivée puis s'efface (persistance rétinienne).
 */
function drawImprint(view: View, g: EdgeGeom, value: number, age: number) {
  const { ctx, theme } = view;
  if (g.t1 <= g.t0) return;
  const back = Math.min(0.45, 34 / Math.max(1, approxLength(g)));
  const t = g.t1 - (g.t1 - g.t0) * back;
  const p = quadPoint(g.p0, g.c, g.p1, t);
  const pop = 1 + 0.35 * Math.max(0, 1 - age / 0.25);
  const r = 13 * pop;
  setShadow(view, 6, 1.5);
  ctx.fillStyle = theme.card;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
  clearShadow(ctx);
  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  drawChevron(ctx, p.x, p.y, r * 0.48, value > 0 ? -1 : 1, theme.ink, 1);
}

/** Halo rouge autour d'une perle : un anneau qui s'étend et s'intensifie avec `glow` (dans [0, 1]). */
function drawGlow({ ctx, theme }: View, c: Pt, inner: number, glow: number) {
  const outer = inner + 8 + 22 * glow;
  const gradient = ctx.createRadialGradient(c.x, c.y, inner, c.x, c.y, outer);
  gradient.addColorStop(0, withAlpha(theme.negative, glow));
  gradient.addColorStop(0.45, withAlpha(theme.negative, 0.5 * glow));
  gradient.addColorStop(1, withAlpha(theme.negative, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(c.x, c.y, outer, 0, Math.PI * 2);
  ctx.arc(c.x, c.y, inner, 0, Math.PI * 2, true);
  ctx.fill();
}

/** Couleur #rrggbb avec une opacité. */
function withAlpha(hex: string, a: number): string {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${a})`;
}

/**
 * Une perle sur un lien : ▲ si elle pousse la cible vers le haut, ▼ vers le bas.
 * Sa taille suit l'écart transporté (0,2 = un appui sur ▲ : taille normale).
 * `turn` (dans [−1, 1]) retourne le chevron : sur un lien −, il vaut −1 avant la pastille.
 * `glow` (dans [0, 1]) l'entoure d'un halo rouge et rougit son contour, au passage de la pastille −.
 */
function drawBead(view: View, g: EdgeGeom, t: number, value: number, turn: number, glow: number, from: SysNode) {
  const { ctx, theme } = view;
  const p = quadPoint(g.p0, g.c, g.p1, g.t0 + (g.t1 - g.t0) * t);
  const sw = theme.swatches[from.color];
  // Apparaît au départ, s'efface à l'arrivée : le défilement boucle sans à-coup.
  const grow = Math.min(1, t * 6, (1 - t) * 6);
  const r = 10 * grow * Math.min(1.4, Math.max(0.45, Math.sqrt(Math.abs(value) / 0.2)));
  if (glow > 0.01) drawGlow(view, p, r, glow);
  setShadow(view, 6, 2);
  ctx.fillStyle = sw.level;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
  clearShadow(ctx);
  ctx.strokeStyle = glow > 0.3 ? theme.negative : sw.stroke;
  ctx.lineWidth = 2 + 1.5 * glow;
  ctx.stroke();
  drawChevron(ctx, p.x, p.y, r * 0.45, (value > 0 ? -1 : 1) * turn, theme.ink, 0.85);
}

/** Traînée du crayon (ou de la gomme) : on voit le chemin suivi tant que le bouton est appuyé. */
function drawTrail({ ctx, camera, theme }: View, points: Pt[], kind: 'pen' | 'eraser', fade = 1) {
  if (points.length < 2) return;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = kind === 'pen' ? theme.ink : theme.selection;
  ctx.globalAlpha = (kind === 'pen' ? 0.75 : 0.3) * fade;
  ctx.lineWidth = (kind === 'pen' ? 3.5 : 18) / camera.zoom;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
