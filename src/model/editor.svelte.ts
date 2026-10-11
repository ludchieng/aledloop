import { COLOR_KEYS } from '../theme';
import { findLoops } from './loops';
import {
  DEFAULT_BEND,
  defaultCausal,
  emptyDoc,
  newId,
  NODE_RADIUS,
  type CausalProps,
  type Doc,
  type StoryStep,
  type SysEdge,
  type SysNode,
  type TimeUnit,
} from './types';

export type Tool = 'select' | 'pen' | 'eraser';
/** edit : édition ; sim : simulation libre ; present : récit pas à pas (avec simulation). */
export type Mode = 'edit' | 'sim' | 'present';
export type Selection = { kind: 'node' | 'edge' | 'loop'; id: string } | null;

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

  /** Simulation en cours (libre ou pendant une présentation). */
  get simulating() {
    return this.mode !== 'edit';
  }

  changed() {
    // Une boucle sélectionnée peut disparaître (lien inversé, supprimé…).
    if (this.selection?.kind === 'loop') this.validateSelection();
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
      causal: defaultCausal(),
    };
    this.doc.nodes.push(node);
    return node;
  }

  private insertEdge(from: string, to: string): SysEdge {
    const edge: SysEdge = { id: newId('e'), from, to, polarity: 1, weight: 1, delay: 0, bend: DEFAULT_BEND };
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

  updateCausal(id: string, patch: Partial<CausalProps>, key?: string) {
    const node = this.node(id);
    if (!node) return;
    this.checkpoint(key);
    node.causal = { ...node.causal, ...patch };
    this.changed();
  }

  /** Unité de temps du document : elle renomme les durées sans changer les calculs. */
  setTimeUnit(unit: TimeUnit) {
    if (this.doc.timeUnit === unit) return;
    this.checkpoint();
    this.doc.timeUnit = unit;
    this.changed();
  }

  /** Durée de simulation (en unités de temps). */
  setHorizon(horizon: number) {
    if (this.doc.horizon === horizon || horizon <= 0) return;
    this.checkpoint('horizon');
    this.doc.horizon = horizon;
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
    this.doc.edges = this.doc.edges.filter((e) => {
      const keep = !edges.has(e.id) && !nodes.has(e.from) && !nodes.has(e.to);
      if (!keep) edges.add(e.id);
      return keep;
    });
    // Le récit ne doit pas garder de références vers des éléments disparus.
    for (const step of this.doc.story.steps) {
      step.focus = step.focus.filter((id) => !nodes.has(id) && !edges.has(id));
      if (step.pulse && nodes.has(step.pulse.node)) step.pulse = null;
    }
    this.validateSelection();
    this.changed();
  }

  // --- Récit -------------------------------------------------------------------

  step(id: string): StoryStep | undefined {
    return this.doc.story.steps.find((s) => s.id === id);
  }

  /** Ajoute une étape après `afterId` (ou à la fin). */
  addStep(afterId?: string): StoryStep {
    this.checkpoint();
    const step: StoryStep = { id: newId('s'), text: '', focus: [], pulse: null };
    const steps = this.doc.story.steps;
    const i = afterId ? steps.findIndex((s) => s.id === afterId) : -1;
    steps.splice(i < 0 ? steps.length : i + 1, 0, step);
    this.changed();
    return step;
  }

  updateStep(id: string, patch: Partial<Omit<StoryStep, 'id'>>, key?: string) {
    const step = this.step(id);
    if (!step) return;
    this.checkpoint(key);
    Object.assign(step, patch);
    this.changed();
  }

  removeStep(id: string) {
    if (!this.step(id)) return;
    this.checkpoint();
    this.doc.story.steps = this.doc.story.steps.filter((s) => s.id !== id);
    this.changed();
  }

  moveStep(id: string, by: -1 | 1) {
    const steps = this.doc.story.steps;
    const i = steps.findIndex((s) => s.id === id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= steps.length) return;
    this.checkpoint();
    [steps[i], steps[j]] = [steps[j], steps[i]];
    this.changed();
  }

  setReveal(reveal: boolean) {
    this.checkpoint();
    this.doc.story.reveal = reveal;
    this.changed();
  }

  /**
   * Ajoute ou retire des éléments de la mise en avant d'une étape.
   * Si tous y sont déjà, on les retire ; sinon on les ajoute tous.
   * Ajouter un lien ajoute aussi ses deux extrémités.
   */
  toggleFocus(stepId: string, ids: string[]) {
    const step = this.step(stepId);
    if (!step || ids.length === 0) return;
    this.checkpoint();
    const focus = new Set(step.focus);
    if (ids.every((id) => focus.has(id))) {
      for (const id of ids) focus.delete(id);
      // Un lien mis en avant ramènerait ses extrémités : on retire aussi les liens des nœuds retirés.
      for (const e of this.doc.edges) if (ids.includes(e.from) || ids.includes(e.to)) focus.delete(e.id);
    } else {
      for (const id of ids) {
        focus.add(id);
        const e = this.edge(id);
        if (e) {
          focus.add(e.from);
          focus.add(e.to);
        }
      }
    }
    step.focus = [...focus];
    this.changed();
  }

  deleteSelection() {
    const sel = this.selection;
    if (!sel) return;
    if (sel.kind === 'node') this.remove([sel.id]);
    else if (sel.kind === 'edge') this.remove([], [sel.id]);
  }

  private validateSelection() {
    const sel = this.selection;
    if (!sel) return;
    const exists =
      sel.kind === 'node' ? this.node(sel.id)
      : sel.kind === 'edge' ? this.edge(sel.id)
      : findLoops(this.doc).some((l) => l.key === sel.id);
    if (!exists) this.selection = null;
  }
}

export const editor = new Editor();
