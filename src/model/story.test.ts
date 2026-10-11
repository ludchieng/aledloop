import { describe, expect, it } from 'vitest';
import { Editor } from './editor.svelte';
import { EXAMPLES } from './examples';
import { parseDoc } from './persist';
import { describeFocus, framingNodes, hiddenAt, revealedAt, richText, stepFocus } from './story';
import { defaultCausal, type Doc, type StoryStep } from './types';

const step = (focus: string[], pulse: StoryStep['pulse'] = null): StoryStep => ({ id: 's' + focus.join(), text: '', focus, pulse });

function doc(steps: StoryStep[], reveal = true): Doc {
  return {
    version: 2,
    timeUnit: 'year', horizon: 20,
    nodes: ['a', 'b', 'c'].map((id, i) => ({ id, x: i * 100, y: 0, r: 40, label: id.toUpperCase(), color: 'sage', causal: defaultCausal() })),
    edges: [
      { id: 'ab', from: 'a', to: 'b', polarity: 1, weight: 1, delay: 0, bend: 0 },
      { id: 'bc', from: 'b', to: 'c', polarity: -1, weight: 1, delay: 0, bend: 0 },
    ],
    story: { steps, reveal },
  };
}

describe('récit : fonctions pures', () => {
  it('un lien mis en avant entraîne ses deux extrémités', () => {
    const d = doc([step(['bc'])]);
    expect([...stepFocus(d, d.story.steps[0])].sort()).toEqual(['b', 'bc', 'c']);
  });

  it('révèle les éléments au fil des étapes, y compris ceux qu’on actionne', () => {
    const d = doc([step(['a']), step([], { node: 'b', delta: 1 }), step(['bc'])]);
    expect([...revealedAt(d, 0)]).toEqual(['a']);
    expect([...revealedAt(d, 1)].sort()).toEqual(['a', 'b']);
    // Le lien a → b n'a jamais été mis en avant : il reste caché, même si ses extrémités sont visibles.
    expect([...hiddenAt(d, 1)!].sort()).toEqual(['ab', 'bc', 'c']);
    expect([...hiddenAt(d, 2)!]).toEqual(['ab']);
  });

  it('ne cache rien si le récit ne construit pas le diagramme', () => {
    expect(hiddenAt(doc([step(['a'])], false), 0)).toBeNull();
  });

  it('cadre les éléments de l’étape, sinon tout ce qui est visible', () => {
    const d = doc([step(['a']), step([]), step(['bc'])]);
    expect(framingNodes(d, 0).map((n) => n.id)).toEqual(['a']);
    expect(framingNodes(d, 1).map((n) => n.id)).toEqual(['a']);
    expect(framingNodes(d, 2).map((n) => n.id)).toEqual(['b', 'c']);
  });

  it('résume les éléments mis en avant', () => {
    const d = doc([step(['a', 'b', 'ab', 'bc']), step(['c']), step([])]);
    expect(describeFocus(d, d.story.steps[0])).toBe('A, B et 2 liens');
    expect(describeFocus(d, d.story.steps[1])).toBe('C');
    expect(describeFocus(d, d.story.steps[2])).toMatch(/tout le diagramme/);
  });

  it('découpe le **gras** sans HTML', () => {
    expect(richText('Une **boucle** <b>R</b>')).toEqual([
      { text: 'Une ', bold: false },
      { text: 'boucle', bold: true },
      { text: ' <b>R</b>', bold: false },
    ]);
  });
});

describe('récit : édition', () => {
  function editorWith(d: Doc) {
    const ed = new Editor();
    ed.load(d, false);
    return ed;
  }

  it('ajoute, déplace et supprime des étapes, de façon annulable', () => {
    const ed = editorWith(doc([]));
    const s1 = ed.addStep();
    const s2 = ed.addStep();
    const s0 = ed.addStep();
    ed.moveStep(s0.id, -1);
    ed.moveStep(s0.id, -1);
    expect(ed.doc.story.steps.map((s) => s.id)).toEqual([s0.id, s1.id, s2.id]);
    ed.removeStep(s1.id);
    expect(ed.doc.story.steps).toHaveLength(2);
    ed.undo();
    expect(ed.doc.story.steps).toHaveLength(3);
  });

  it('bascule la mise en avant ; un lien ajoute ses extrémités, retirer un nœud retire ses liens', () => {
    const ed = editorWith(doc([step([])]));
    const id = ed.doc.story.steps[0].id;
    ed.toggleFocus(id, ['ab']);
    expect([...ed.doc.story.steps[0].focus].sort()).toEqual(['a', 'ab', 'b']);
    ed.toggleFocus(id, ['a']);
    expect(ed.doc.story.steps[0].focus).toEqual(['b']);
  });

  it('supprimer un élément le retire du récit', () => {
    const ed = editorWith(doc([step(['a', 'b', 'ab'], { node: 'a', delta: 1 })]));
    ed.remove(['a']);
    expect(ed.doc.story.steps[0].focus).toEqual(['b']);
    expect(ed.doc.story.steps[0].pulse).toBeNull();
  });
});

describe('récit : fichiers', () => {
  it('ignore les références vers des éléments inconnus', () => {
    const d = parseDoc({
      nodes: [{ id: 'a' }],
      edges: [],
      story: {
        reveal: true,
        steps: [
          { id: 's1', text: 'Salut', focus: ['a', 'fantome', 'a'], pulse: { node: 'fantome', delta: 1 } },
          { id: 's1', text: 'doublon' },
          { nope: true },
        ],
      },
    });
    expect(d.story).toEqual({ reveal: true, steps: [{ id: 's1', text: 'Salut', focus: ['a'], pulse: null }] });
    expect(parseDoc({ nodes: [], edges: [] }).story).toEqual({ steps: [], reveal: false });
  });

  it('les récits des exemples ne pointent que vers des éléments existants', () => {
    for (const ex of EXAMPLES) {
      const d = ex.build();
      expect(parseDoc(JSON.parse(JSON.stringify(d))).story).toEqual(d.story);
    }
  });
});
