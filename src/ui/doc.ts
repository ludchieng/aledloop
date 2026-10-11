import { Marked } from 'marked';

/**
 * Rendu d'une page de documentation Markdown en HTML.
 * Le Markdown vient de nos propres fichiers (docs/*.md), pas de l'utilisateur : pas de risque d'injection.
 * Chargé à la demande (avec marked) à l'ouverture de l'aide.
 */
const marked = new Marked({
  renderer: {
    // Les liens vers le code source (../src/…) n'ont pas de sens dans l'application : on garde le texte.
    link({ href, tokens }) {
      const text = this.parser.parseInline(tokens);
      if (href.startsWith('#') || /^https?:/.test(href)) return `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
      return text;
    },
  },
});

export function renderMarkdown(markdown: string): string {
  return marked.parse(markdown, { async: false });
}
