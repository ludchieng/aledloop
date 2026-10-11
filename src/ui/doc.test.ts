import { describe, expect, it } from 'vitest';
import english from '../../docs/how-it-works.md?raw';
import markdown from '../../docs/moteur.md?raw';
import { renderMarkdown } from './doc';
import { findSection, SECTIONS } from './help';

describe('documentation dans l’application', () => {
  const html = renderMarkdown(markdown);

  it('se rend en HTML, tableaux compris', () => {
    expect(html).toContain('<h1>Comment ça marche</h1>');
    expect(html).toContain('<table>');
  });

  it('ne garde pas de lien vers le code source (sans objet dans l’application)', () => {
    expect(renderMarkdown('Voir [le moteur](../src/sim/causal.ts).')).toBe('<p>Voir le moteur.</p>\n');
  });

  const headingsOf = (page: string) =>
    [...renderMarkdown(page).matchAll(/<h[23][^>]*>(.*?)<\/h[23]>/g)].map((m) => ({ textContent: m[1].replace(/<[^>]+>/g, '') }));
  const numbers = (page: string) => headingsOf(page).map((h) => h.textContent.match(/^[\d.]+/)?.[0] ?? '');

  it('contient toutes les sections vers lesquelles l’interface renvoie', () => {
    const headings = headingsOf(markdown);
    for (const section of Object.values(SECTIONS)) expect(findSection(headings, section), section).not.toBeNull();
    expect(findSection(headings, '6')?.textContent).toMatch(/^6\. Les boucles/);
    expect(findSection(headings, '6.2')?.textContent).toMatch(/^6\.2 Avec un retard/);
  });

  it('existe en anglais, avec exactement les mêmes sections (les liens « Pourquoi ? » y mènent aussi)', () => {
    expect(numbers(english)).toEqual(numbers(markdown));
    const headings = headingsOf(english);
    for (const section of Object.values(SECTIONS)) expect(findSection(headings, section), section).not.toBeNull();
    expect(findSection(headings, '6')?.textContent).toMatch(/^6\. Loops/);
    expect(findSection(headings, '6.2')?.textContent).toMatch(/^6\.2 With a delay/);
  });
});
