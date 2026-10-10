import type { Editor } from '../model/editor.svelte';
import type { LoopySim } from '../sim/loopy';
import type { Camera } from './camera';
import {
  bendThrough,
  classifyStroke,
  dist,
  distToEdge,
  edgeGeom,
  hitTest,
  loopAt,
  nodeAt,
  nodeById,
  type Hit,
  type LoopLabel,
  type Pt,
} from './geometry';
import type { Overlay } from './render';

/**
 * Machine à états des gestes. Les Pointer Events unifient souris, doigt et stylet :
 * un seul code pour tous, avec quelques réglages selon `pointerType` (zones de clic plus larges au doigt).
 */

type Gesture =
  | { kind: 'none' }
  | { kind: 'stroke'; points: Pt[]; startNode: string | null; start: Pt }
  | { kind: 'erase'; last: Pt }
  | { kind: 'dragNode'; id: string; offset: Pt; start: Pt; moved: boolean }
  | { kind: 'bendEdge'; id: string; start: Pt; moved: boolean }
  | { kind: 'tapBadge'; id: string; start: Pt; moved: boolean }
  | { kind: 'tapLoop'; id: string; start: Pt; moved: boolean }
  | { kind: 'pan'; last: Pt; start: Pt; moved: boolean; deselect: boolean }
  | { kind: 'pinch'; mid: Pt; spread: number }
  | { kind: 'ignore' };

export interface Host {
  editor: Editor;
  camera: Camera;
  sim(): LoopySim | null;
  /** Étiquettes R / B visibles (vide si masquées). */
  loopLabels(): LoopLabel[];
  requestRender(): void;
  setCursor(cursor: string): void;
  hint(message: string): void;
}

const DOUBLE_TAP_MS = 350;

export class Interaction implements Omit<Overlay, 'selection' | 'sim' | 'loopLabels' | 'loopFocus'> {
  hover: Hit = null;
  linkTarget: string | null = null;
  trail: Overlay['trail'] = null;
  erasing = new Set<string>();
  pulseHover: Overlay['pulseHover'] = null;
  spaceDown = false;

  private g: Gesture = { kind: 'none' };
  private pointers = new Map<number, Pt>();
  private touch = false;
  private lastTap = { time: 0, p: { x: 0, y: 0 } };

  constructor(private host: Host) {}

  /** Un geste est en cours (doigt ou bouton encore appuyé). */
  get busy() {
    return this.g.kind !== 'none';
  }

  /** Tolérance de clic, en pixels écran : plus large au doigt. */
  private get slop() {
    return this.touch ? 14 : 6;
  }

  private world(p: Pt): Pt {
    return this.host.camera.toWorld(p);
  }

  private movedFrom(start: Pt, p: Pt) {
    return dist(start, p) > (this.touch ? 10 : 4);
  }

  // --- Entrées ----------------------------------------------------------------

  down(e: PointerEvent, p: Pt) {
    this.touch = e.pointerType !== 'mouse';
    this.pointers.set(e.pointerId, p);

    if (this.pointers.size === 2) {
      this.abort();
      const [a, b] = [...this.pointers.values()];
      this.g = { kind: 'pinch', mid: midpoint(a, b), spread: Math.max(dist(a, b), 1) };
      return;
    }
    if (this.pointers.size > 2) return;

    if (e.button === 1 || (e.button === 0 && this.spaceDown)) {
      this.startPan(p, false);
      return;
    }
    if (e.button !== 0) {
      this.g = { kind: 'ignore' };
      return;
    }

    const { editor } = this.host;
    const w = this.world(p);
    const pad = this.slop / this.host.camera.zoom;

    const loop = editor.tool !== 'eraser' || editor.mode === 'sim' ? loopAt(this.host.loopLabels(), w, pad) : null;
    if (loop) {
      this.g = { kind: 'tapLoop', id: loop.loop.key, start: p, moved: false };
      return;
    }

    if (editor.mode === 'sim') {
      const node = nodeAt(editor.doc, w, pad / 2);
      const sim = this.host.sim();
      if (node && sim) {
        sim.pulse(node.id, w.y < node.y ? 1 : -1);
        this.g = { kind: 'ignore' };
      } else {
        this.startPan(p, true);
      }
      this.host.requestRender();
      return;
    }

    const hit = hitTest(editor.doc, w, pad);
    switch (editor.tool) {
      case 'pen': {
        if (hit?.kind === 'badge') {
          this.g = { kind: 'tapBadge', id: hit.id, start: p, moved: false };
          break;
        }
        const node = nodeAt(editor.doc, w, pad / 2);
        this.g = { kind: 'stroke', points: [w], startNode: node?.id ?? null, start: p };
        this.trail = { points: [w], kind: 'pen' };
        break;
      }
      case 'hand': {
        if (hit?.kind === 'badge') {
          this.g = { kind: 'tapBadge', id: hit.id, start: p, moved: false };
        } else if (hit?.kind === 'node') {
          const n = editor.node(hit.id)!;
          this.g = { kind: 'dragNode', id: n.id, offset: { x: n.x - w.x, y: n.y - w.y }, start: p, moved: false };
        } else if (hit?.kind === 'edge') {
          this.g = { kind: 'bendEdge', id: hit.id, start: p, moved: false };
        } else {
          this.startPan(p, true);
        }
        break;
      }
      case 'eraser': {
        this.g = { kind: 'erase', last: w };
        this.trail = { points: [w], kind: 'eraser' };
        this.eraseAlong(w, w);
        break;
      }
    }
    this.updateCursor();
    this.host.requestRender();
  }

  move(e: PointerEvent, p: Pt) {
    const prev = this.pointers.get(e.pointerId);
    if (prev) this.pointers.set(e.pointerId, p);
    const { editor, camera } = this.host;
    const g = this.g;

    switch (g.kind) {
      case 'none':
        if (e.pointerType === 'mouse') this.updateHover(p);
        return;
      case 'ignore':
        return;
      case 'pinch': {
        if (this.pointers.size < 2) return;
        const [a, b] = [...this.pointers.values()];
        const mid = midpoint(a, b);
        const spread = Math.max(dist(a, b), 1);
        camera.panBy(mid.x - g.mid.x, mid.y - g.mid.y);
        camera.zoomAt(mid, spread / g.spread);
        g.mid = mid;
        g.spread = spread;
        break;
      }
      case 'pan':
        camera.panBy(p.x - g.last.x, p.y - g.last.y);
        g.last = p;
        g.moved ||= this.movedFrom(g.start, p);
        break;
      case 'stroke': {
        const w = this.world(p);
        const last = g.points[g.points.length - 1];
        if (dist(last, w) * camera.zoom > 1.5) g.points.push(w);
        const target = nodeAt(editor.doc, w, this.slop / camera.zoom / 2);
        this.linkTarget = target && target.id !== g.startNode ? target.id : null;
        break;
      }
      case 'erase': {
        const w = this.world(p);
        this.eraseAlong(g.last, w);
        this.trail?.points.push(w);
        g.last = w;
        break;
      }
      case 'dragNode': {
        if (!g.moved && !this.movedFrom(g.start, p)) return;
        const node = editor.node(g.id);
        if (!node) return;
        if (!g.moved) {
          g.moved = true;
          editor.checkpoint();
          editor.selection = { kind: 'node', id: g.id };
        }
        const w = this.world(p);
        node.x = w.x + g.offset.x;
        node.y = w.y + g.offset.y;
        editor.changed();
        break;
      }
      case 'bendEdge': {
        if (!g.moved && !this.movedFrom(g.start, p)) return;
        const edge = editor.edge(g.id);
        const a = edge && editor.node(edge.from);
        const b = edge && editor.node(edge.to);
        if (!edge || !a || !b) return;
        if (!g.moved) {
          g.moved = true;
          editor.checkpoint();
          editor.selection = { kind: 'edge', id: g.id };
        }
        edge.bend = bendThrough(a, b, this.world(p));
        editor.changed();
        break;
      }
      case 'tapBadge':
      case 'tapLoop':
        g.moved ||= this.movedFrom(g.start, p);
        break;
    }
    this.host.requestRender();
  }

  up(e: PointerEvent, p: Pt) {
    if (!this.pointers.delete(e.pointerId)) return;
    const { editor } = this.host;
    const g = this.g;

    if (g.kind === 'pinch') {
      // Un doigt se lève : on continue à déplacer la vue avec celui qui reste.
      const rest = [...this.pointers.values()][0];
      if (rest) this.startPan(rest, false);
      else this.g = { kind: 'none' };
      return;
    }
    if (this.pointers.size > 0) return;

    switch (g.kind) {
      case 'stroke':
        this.finishStroke(g.points, g.startNode, p);
        break;
      case 'erase':
        if (this.erasing.size > 0) {
          const nodes = editor.doc.nodes.filter((n) => this.erasing.has(n.id)).map((n) => n.id);
          const edges = editor.doc.edges.filter((ed) => this.erasing.has(ed.id)).map((ed) => ed.id);
          editor.remove(nodes, edges);
        }
        break;
      case 'dragNode':
        if (!g.moved) editor.selection = { kind: 'node', id: g.id };
        break;
      case 'bendEdge':
        if (!g.moved) editor.selection = { kind: 'edge', id: g.id };
        break;
      case 'tapBadge':
        if (!g.moved) {
          editor.togglePolarity(g.id);
          editor.selection = { kind: 'edge', id: g.id };
        }
        break;
      case 'tapLoop':
        if (!g.moved) {
          const same = editor.selection?.kind === 'loop' && editor.selection.id === g.id;
          editor.selection = same ? null : { kind: 'loop', id: g.id };
        }
        break;
      case 'pan':
        if (!g.moved && g.deselect) editor.selection = null;
        break;
    }
    this.reset();
    if (e.pointerType === 'mouse') this.updateHover(p);
    this.host.requestRender();
  }

  cancel(e: PointerEvent) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) {
      this.abort();
      this.host.requestRender();
    }
  }

  leave() {
    if (this.g.kind === 'none' && (this.hover || this.pulseHover)) {
      this.hover = null;
      this.pulseHover = null;
      this.host.requestRender();
    }
  }

  wheel(e: WheelEvent, p: Pt) {
    const { camera } = this.host;
    // deltaMode 1 = lignes (certaines souris), 0 = pixels.
    const unit = e.deltaMode === 1 ? 16 : 1;
    const dx = e.deltaX * unit;
    const dy = e.deltaY * unit;
    if (e.ctrlKey || e.metaKey) {
      // Ctrl + molette, ou pincement sur trackpad (le navigateur l'envoie comme Ctrl + molette).
      camera.zoomAt(p, Math.exp(-Math.max(-60, Math.min(60, dy)) * 0.01));
    } else if (e.shiftKey && dx === 0) {
      camera.panBy(-dy, 0);
    } else {
      camera.panBy(-dx, -dy);
    }
    this.host.requestRender();
  }

  /** Abandonne le geste en cours (ex. un deuxième doigt se pose). */
  abort() {
    this.reset();
  }

  private reset() {
    this.g = { kind: 'none' };
    this.trail = null;
    this.linkTarget = null;
    this.erasing.clear();
    this.updateCursor();
  }

  private startPan(p: Pt, deselect: boolean) {
    this.g = { kind: 'pan', last: p, start: p, moved: false, deselect };
    this.updateCursor();
  }

  // --- Crayon ------------------------------------------------------------------

  private finishStroke(points: Pt[], startNode: string | null, endScreen: Pt) {
    const { editor, camera } = this.host;
    const scale = 1 / camera.zoom;
    const shape = classifyStroke(points, scale);
    const end = points[points.length - 1];
    const pad = this.slop * scale;

    if (shape.shape === 'tap') {
      const hit = hitTest(editor.doc, points[0], pad);
      if (hit && hit.kind !== 'badge') {
        editor.selection = { kind: hit.kind, id: hit.id };
        return;
      }
      const now = performance.now();
      if (now - this.lastTap.time < DOUBLE_TAP_MS && dist(this.lastTap.p, endScreen) < 30) {
        editor.createNode(points[0].x, points[0].y);
        this.lastTap.time = 0;
      } else {
        editor.selection = null;
        this.lastTap = { time: now, p: endScreen };
      }
      return;
    }

    const endNode = nodeAt(editor.doc, end, pad / 2);
    if (startNode) {
      const from = editor.node(startNode)!;
      if (endNode && endNode.id !== startNode) editor.connect(startNode, endNode.id);
      else if (!endNode && dist(end, from) > from.r + 40 * scale) editor.createLinkedNode(end.x, end.y, { from: startNode });
      else editor.selection = { kind: 'node', id: startNode };
    } else if (shape.shape === 'closed') {
      editor.createNode(shape.center.x, shape.center.y, shape.r);
    } else if (endNode) {
      editor.createLinkedNode(points[0].x, points[0].y, { to: endNode.id });
    } else {
      this.host.hint('Dessine un cercle pour créer un élément, ou trace un trait d’un élément à un autre pour les relier.');
    }
  }

  // --- Gomme -------------------------------------------------------------------

  private eraseAlong(a: Pt, b: Pt) {
    const { editor, camera } = this.host;
    const step = 4 / camera.zoom;
    const n = Math.max(1, Math.ceil(dist(a, b) / step));
    const pad = this.slop / camera.zoom;
    const byId = nodeById(editor.doc);
    for (let i = 0; i <= n; i++) {
      const p = { x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n };
      for (const node of editor.doc.nodes) {
        if (dist(node, p) <= node.r + pad / 2) this.erasing.add(node.id);
      }
      for (const e of editor.doc.edges) {
        if (this.erasing.has(e.id)) continue;
        const g = edgeGeom(byId.get(e.from)!, byId.get(e.to)!, e.bend);
        if (distToEdge(g, p) <= 4 + pad) this.erasing.add(e.id);
      }
    }
  }

  // --- Survol (souris) -----------------------------------------------------------

  private updateHover(p: Pt) {
    const { editor, camera } = this.host;
    const w = this.world(p);
    let hover: Hit = null;
    let pulse: Overlay['pulseHover'] = null;
    const loop = loopAt(this.host.loopLabels(), w, 2 / camera.zoom);
    if (loop) {
      hover = { kind: 'loop', id: loop.loop.key };
    } else if (editor.mode === 'sim') {
      const node = nodeAt(editor.doc, w);
      if (node) pulse = { id: node.id, delta: w.y < node.y ? 1 : -1 };
    } else {
      hover = hitTest(editor.doc, w, this.slop / camera.zoom);
    }
    const changed =
      hover?.kind !== this.hover?.kind || hover?.id !== this.hover?.id ||
      pulse?.id !== this.pulseHover?.id || pulse?.delta !== this.pulseHover?.delta;
    this.hover = hover;
    this.pulseHover = pulse;
    this.updateCursor();
    if (changed) this.host.requestRender();
  }

  updateCursor() {
    const { editor } = this.host;
    const g = this.g;
    let cursor = 'default';
    if (g.kind === 'pan' || g.kind === 'dragNode' || g.kind === 'bendEdge') cursor = 'grabbing';
    else if (this.spaceDown) cursor = 'grab';
    else if (editor.mode === 'sim') cursor = this.pulseHover || this.hover ? 'pointer' : 'grab';
    else if (this.hover?.kind === 'badge' || this.hover?.kind === 'loop') cursor = 'pointer';
    else if (editor.tool === 'pen') cursor = 'crosshair';
    else if (editor.tool === 'hand') cursor = 'grab';
    else if (editor.tool === 'eraser') cursor = 'cell';
    this.host.setCursor(cursor);
  }
}

function midpoint(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
