import { describe, expect, it } from 'vitest';
import { buildExample, EXAMPLES, exampleText } from './examples';
import { EXAMPLES_EN } from './examples.en';
import type { Doc } from './types';

describe('traduction anglaise des exemples', () => {
  it('couvre chaque exemple, et rien d’autre', () => {
    expect(Object.keys(EXAMPLES_EN).sort()).toEqual(EXAMPLES.map((ex) => ex.id).sort());
  });

  for (const ex of EXAMPLES) {
    it(`traduit tout « ${ex.id} » : étiquettes, étapes du récit, gras bien fermé`, () => {
      const en = EXAMPLES_EN[ex.id];
      expect(en, 'traduction manquante dans examples.en.ts').toBeDefined();
      const doc = ex.build();
      expect(Object.keys(en.labels).sort(), 'étiquettes').toEqual(doc.nodes.map((n) => n.id).sort());
      expect(en.story.length, 'étapes du récit').toBe(doc.story.steps.length);
      for (const text of [en.title, en.description, en.shows, ...Object.values(en.labels), ...en.story]) {
        expect(text.trim(), 'texte vide').not.toBe('');
        expect(text.split('**').length % 2, `gras mal fermé : ${text}`).toBe(1);
      }
    });
  }

  it('ne change que les textes : même diagramme, même récit', () => {
    const blank = (d: Doc) => ({
      ...d,
      nodes: d.nodes.map((n) => ({ ...n, label: '' })),
      story: { ...d.story, steps: d.story.steps.map((s) => ({ ...s, text: '' })) },
    });
    for (const ex of EXAMPLES) expect(blank(buildExample(ex, 'en')), ex.id).toEqual(blank(ex.build()));
  });

  it('donne le texte de la bibliothèque dans la langue demandée', () => {
    const ex = EXAMPLES.find((e) => e.id === 'proies')!;
    expect(exampleText(ex, 'fr').title).toBe('Lapins et renards');
    expect(exampleText(ex, 'en').title).toBe('Rabbits and foxes');
    expect(buildExample(ex, 'en').nodes.map((n) => n.label)).toEqual(['Births', 'Rabbits', 'Foxes']);
    expect(buildExample(ex, 'fr')).toEqual(ex.build());
  });
});
