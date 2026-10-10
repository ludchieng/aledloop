import { COLOR_KEYS } from '../theme';
import { DEFAULT_BEND, emptyDoc, newId, NODE_RADIUS, type Doc, type SysEdge, type SysNode } from './types';

export type Tool = 'pen' | 'hand' | 'eraser';
export type Mode = 'edit' | 'sim';
export type Selection = { kind: 'node'; id: string } | { kind: 'edge'; id: string } | null;

/** Deux modifications de même clé à moins de MERGE_MS d'écart ne font qu'une étape d'annulation. */
const MERGE_MS = 1000;
const MAX_HISTORY = 200;

/**
 * État de l'éditeur. Le document est en données brutes, muté sur place :
 * seul `rev` est réactif et doit être incrémenté (via `changed()`) après chaque modification.
 */
export class Editor {
  doc: Doc = emptyDoc();
  rev = $state(0);
  tool = $state<Tool>('pen');
  mode = $state<Mode>('edit');
  selection = $state<Selection>(null);
  canUndo = $state(false);
  canRedo = $state(false);
  /** Incrémenté pour demander à l'inspecteur de donner le focus au champ étiquette. */
  focusLabel = $state(0);

  private past: string[] = [];
  private future: string[] = [];
  private lastKey: string | null = null;
  private lastTime = 0;

  changed() {
    this.rev++;
  }

  // --- Annuler / rétablir ---------------------------------------------------

  /** À appeler AVANT de modifier le document. */
  checkpoint(key?: string) {
    const now = Date.now();
    if (key && key === this.lastKey && now - this.lastTime < MERGE_MS) {
      this.lastTime = now;
      return;
    }
    this.past.push(JSON.stringify(this.doc));
    if (this.past.length > MAX_HISTORY) this.past.shift();
    this.future = [];
    this.lastKey = key ?? null;
    this.lastTime = now;
    this.syncHistory();
  }

  undo() {
    const prev = this.past.pop();
    if (prev === undefined) return;
    this.future.push(JSON.stringify(this.doc));
    this.restore(prev);
  }

  redo() {
    const next = this.future.pop();
    if (next === undefined) return;
    this.past.push(JSON.stringify(this.doc));
    this.restore(next);
  }

  private restore(json: string) {
    this.doc = JSON.parse(json);
    this.lastKey = null;
    this.validateSelection();
    this.syncHistory();
    this.changed();
  }

  private syncHistory() {
    this.canUndo = this.past.length > 0;
    this.canRedo = this.future.length > 0;
  }

  // --- Lecture ---------------------------------------------------------------

  node(id: string): SysNode | undefined {
    return this.doc.nodes.find((n) => n.id === id);
  }

  edge(id: string): SysEdge | undefined {
    return this.doc.edges.find((e) => e.id === id);
  }

  edgeBetween(from: string, to: string): SysEdge | undefined {
    return this.doc.edges.find((e) => e.from === from && e.to === to);
  }

  // --- Modifications ---------------------------------------------------------

  /** Remplace le document. Annulable par défaut (ouvrir un fichier, charger un exemple…). */
  load(doc: Doc, undoable = true) {
    if (undoable) this.checkpoint();
    this.doc = doc;
    this.selection = null;
    this.changed();
  }

  private insertNode(x: number, y: number, r = NODE_RADIUS): SysNode {
    const node: SysNode = {
      id: newId('n'),
      x,
      y,
      r,
      label: '',
      color: COLOR_KEYS[this.doc.nodes.length % COLOR_KEYS.length],
      init: 0.5,
    };
    this.doc.nodes.push(node);
    return node;
  }

  private insertEdge(from: string, to: string): SysEdge {
    const edge: SysEdge = { id: newId('e'), from, to, polarity: 1, bend: DEFAULT_BEND };
    this.doc.edges.push(edge);
    return edge;
  }

  createNode(x: number, y: number, r = NODE_RADIUS): SysNode {
    this.checkpoint();
    const node = this.insertNode(x, y, r);
    this.selectAndName(node);
    this.changed();
    return node;
  }

  /** Relie deux nœuds. Si le lien existe déjà, le sélectionne simplement. */
  connect(from: string, to: string): SysEdge | null {
    if (from === to) return null;
    const existing = this.edgeBetween(from, to);
    if (existing) {
      this.selection = { kind: 'edge', id: existing.id };
      return existing;
    }
    this.checkpoint();
    const edge = this.insertEdge(from, to);
    this.selection = { kind: 'edge', id: edge.id };
    this.changed();
    return edge;
  }

  /** Crée un nœud en (x, y) relié depuis `from` (ou vers `to`), en une seule étape d'annulation. */
  createLinkedNode(x: number, y: number, link: { from: string } | { to: string }): SysNode {
    this.checkpoint();
    const node = this.insertNode(x, y);
    if ('from' in link) this.insertEdge(link.from, node.id);
    else this.insertEdge(node.id, link.to);
    this.selectAndName(node);
    this.changed();
    return node;
  }

  private selectAndName(node: SysNode) {
    this.selection = { kind: 'node', id: node.id };
    this.focusLabel++;
  }

  moveNode(id: string, x: number, y: number) {
    const node = this.node(id);
    if (!node) return;
    this.checkpoint('move:' + id);
    node.x = x;
    node.y = y;
    this.changed();
  }

  setBend(id: string, bend: number) {
    const edge = this.edge(id);
    if (!edge) return;
    this.checkpoint('bend:' + id);
    edge.bend = bend;
    this.changed();
  }

  togglePolarity(id: string) {
    const edge = this.edge(id);
    if (!edge) return;
    this.checkpoint();
    edge.polarity = edge.polarity === 1 ? -1 : 1;
    this.changed();
  }

  /** Inverse le sens d'un lien. Refuse si le lien inverse existe déjà. */
  reverseEdge(id: string): boolean {
    const edge = this.edge(id);
    if (!edge || this.edgeBetween(edge.to, edge.from)) return false;
    this.checkpoint();
    [edge.from, edge.to] = [edge.to, edge.from];
    this.changed();
    return true;
  }

  updateNode(id: string, patch: Partial<Omit<SysNode, 'id'>>, key?: string) {
    const node = this.node(id);
    if (!node) return;
    this.checkpoint(key);
    Object.assign(node, patch);
    this.changed();
  }

  updateEdge(id: string, patch: Partial<Omit<SysEdge, 'id' | 'from' | 'to'>>, key?: string) {
    const edge = this.edge(id);
    if (!edge) return;
    this.checkpoint(key);
    Object.assign(edge, patch);
    this.changed();
  }

  /** Supprime des nœuds (et leurs liens) et des liens, en une seule étape d'annulation. */
  remove(nodeIds: Iterable<string>, edgeIds: Iterable<string> = []) {
    const nodes = new Set(nodeIds);
    const edges = new Set(edgeIds);
    if (nodes.size === 0 && edges.size === 0) return;
    this.checkpoint();
    this.doc.nodes = this.doc.nodes.filter((n) => !nodes.has(n.id));
    this.doc.edges = this.doc.edges.filter((e) => !edges.has(e.id) && !nodes.has(e.from) && !nodes.has(e.to));
    this.validateSelection();
    this.changed();
  }

  deleteSelection() {
    const sel = this.selection;
    if (!sel) return;
    if (sel.kind === 'node') this.remove([sel.id]);
    else this.remove([], [sel.id]);
  }

  private validateSelection() {
    const sel = this.selection;
    if (!sel) return;
    const exists = sel.kind === 'node' ? this.node(sel.id) : this.edge(sel.id);
    if (!exists) this.selection = null;
  }
}

export const editor = new Editor();
