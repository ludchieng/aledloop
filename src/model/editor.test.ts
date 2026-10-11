import { describe, expect, it } from 'vitest';
import { Editor } from './editor.svelte';
import { emptyDoc } from './types';

describe('Editor', () => {
  it('crée, relie et annule pas à pas', () => {
    const ed = new Editor();
    const a = ed.createNode(0, 0);
    const b = ed.createNode(200, 0);
    ed.connect(a.id, b.id);
    expect(ed.doc.edges).toHaveLength(1);
    ed.undo();
    expect(ed.doc.edges).toHaveLength(0);
    expect(ed.doc.nodes).toHaveLength(2);
    ed.redo();
    expect(ed.doc.edges).toHaveLength(1);
  });

  it('ouvrir un autre document repart d’un historique vide (load, lui, reste annulable)', () => {
    const ed = new Editor();
    ed.createNode(0, 0);
    ed.load(emptyDoc());
    expect(ed.canUndo).toBe(true);
    ed.undo();
    expect(ed.doc.nodes).toHaveLength(1);
    ed.open(emptyDoc());
    expect(ed.canUndo).toBe(false);
    expect(ed.canRedo).toBe(false);
    ed.undo();
    expect(ed.doc.nodes).toHaveLength(0);
  });

  it('ne duplique pas un lien existant', () => {
    const ed = new Editor();
    const a = ed.createNode(0, 0);
    const b = ed.createNode(200, 0);
    ed.connect(a.id, b.id);
    ed.connect(a.id, b.id);
    expect(ed.doc.edges).toHaveLength(1);
    expect(ed.connect(a.id, a.id)).toBeNull();
  });

  it('fusionne les modifications rapprochées de même clé', () => {
    const ed = new Editor();
    const a = ed.createNode(0, 0);
    for (const label of ['L', 'La', 'Lap']) ed.updateNode(a.id, { label }, 'label:' + a.id);
    expect(ed.node(a.id)?.label).toBe('Lap');
    ed.undo();
    expect(ed.node(a.id)?.label).toBe('');
  });

  it('supprimer un nœud supprime ses liens, en une étape', () => {
    const ed = new Editor();
    const a = ed.createNode(0, 0);
    const b = ed.createLinkedNode(200, 0, { from: a.id });
    expect(ed.doc.edges).toHaveLength(1);
    ed.selection = { kind: 'node', id: b.id };
    ed.deleteSelection();
    expect(ed.doc.nodes).toHaveLength(1);
    expect(ed.doc.edges).toHaveLength(0);
    expect(ed.selection).toBeNull();
    ed.undo();
    expect(ed.doc.nodes).toHaveLength(2);
    expect(ed.doc.edges).toHaveLength(1);
  });

  it('refuse d’inverser un lien si l’inverse existe déjà', () => {
    const ed = new Editor();
    const a = ed.createNode(0, 0);
    const b = ed.createNode(200, 0);
    const ab = ed.connect(a.id, b.id)!;
    expect(ed.reverseEdge(ab.id)).toBe(true);
    expect(ed.doc.edges[0]).toMatchObject({ from: b.id, to: a.id });
    ed.connect(a.id, b.id);
    expect(ed.reverseEdge(ab.id)).toBe(false);
  });
});
