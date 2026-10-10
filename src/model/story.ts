import type { Doc, StoryStep, SysNode } from './types';

/**
 * Éléments mis en avant à une étape. On y ajoute les extrémités des liens :
 * un lien sans ses deux nœuds n'aurait pas de sens.
 */
export function stepFocus(doc: Doc, step: StoryStep): Set<string> {
  const edges = new Map(doc.edges.map((e) => [e.id, e]));
  const out = new Set<string>();
  for (const id of step.focus) {
    out.add(id);
    const e = edges.get(id);
    if (e) {
      out.add(e.from);
      out.add(e.to);
    }
  }
  return out;
}

/** Éléments déjà apparus à l'étape `index` : mis en avant ou actionnés à une étape précédente ou actuelle. */
export function revealedAt(doc: Doc, index: number): Set<string> {
  const out = new Set<string>();
  for (const step of doc.story.steps.slice(0, index + 1)) {
    for (const id of stepFocus(doc, step)) out.add(id);
    if (step.pulse) out.add(step.pulse.node);
  }
  return out;
}

/** En mode « construire au fil du récit », éléments encore cachés à l'étape `index` (sinon null). */
export function hiddenAt(doc: Doc, index: number): Set<string> | null {
  if (!doc.story.reveal) return null;
  const shown = revealedAt(doc, index);
  const hidden = new Set<string>();
  for (const n of doc.nodes) if (!shown.has(n.id)) hidden.add(n.id);
  for (const e of doc.edges) if (!shown.has(e.id) || !shown.has(e.from) || !shown.has(e.to)) hidden.add(e.id);
  return hidden;
}

/** Nœuds à cadrer à l'étape `index` : ceux mis en avant, sinon tous ceux visibles. */
export function framingNodes(doc: Doc, index: number): SysNode[] {
  const step = doc.story.steps[index];
  if (!step) return doc.nodes;
  const focus = stepFocus(doc, step);
  if (step.pulse) focus.add(step.pulse.node);
  const focused = doc.nodes.filter((n) => focus.has(n.id));
  if (focused.length > 0) return focused;
  const hidden = hiddenAt(doc, index);
  return hidden ? doc.nodes.filter((n) => !hidden.has(n.id)) : doc.nodes;
}

/** Résumé lisible des éléments mis en avant : « Lapins, Renards et 2 liens ». */
export function describeFocus(doc: Doc, step: StoryStep): string {
  const names = doc.nodes.filter((n) => step.focus.includes(n.id)).map((n) => n.label.trim() || 'sans nom');
  const links = doc.edges.filter((e) => step.focus.includes(e.id)).length;
  const parts = [...names];
  if (links > 0) parts.push(links === 1 ? '1 lien' : `${links} liens`);
  if (parts.length === 0) return 'Rien : tout le diagramme est visible.';
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}`;
}

/** Découpe un texte « avec du **gras** » en segments, sans HTML (donc sans risque d'injection). */
export function richText(text: string): { text: string; bold: boolean }[] {
  return text
    .split('**')
    .map((part, i) => ({ text: part, bold: i % 2 === 1 }))
    .filter((s) => s.text.length > 0);
}
