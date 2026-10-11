import type { LoopAnalysis } from '../model/loops';

/**
 * Aide « Comment ça marche » : la page docs/moteur.md, affichée dans l'application.
 * Ce module reste léger (pas de marked ni de KaTeX) : l'inspecteur l'importe pour ses liens « Pourquoi ? ».
 */
class Help {
  open = $state(false);
  /** Section à afficher à l'ouverture (« 3 », « 6.2 »…), sinon le début. */
  section = $state<string | null>(null);

  show(section: string | null = null) {
    this.section = section;
    this.open = true;
  }

  close() {
    this.open = false;
  }
}

export const help = new Help();

/** Sections de docs/moteur.md vers lesquelles l'interface renvoie. Un test vérifie qu'elles existent. */
export const SECTIONS = {
  nature: '3',
  time: '4',
  delay: '5',
  firstOrder: '6.1',
  delayedLoop: '6.2',
  reinforcing: '6.3',
  leaks: '6.4',
  oscillator: '6.5',
  instant: '6.6',
  nonLinear: '7',
} as const;

/** La section qui explique le verdict d'une boucle. */
export function loopSection(a: LoopAnalysis): string {
  switch (a.verdict) {
    case 'instant':
      return SECTIONS.instant;
    case 'oscillates':
      return SECTIONS.oscillator;
    case 'grows':
      return SECTIONS.reinforcing;
    case 'fades':
      return a.stocks > 0 ? SECTIONS.leaks : SECTIONS.reinforcing;
    default:
      return a.delay > 0 ? SECTIONS.delayedLoop : SECTIONS.firstOrder;
  }
}

/** Le titre de la section `section` (« 3 », « 6.2 ») parmi des titres « 3. Deux natures… », « 6.2 Ajouter… ». */
export function findSection<T extends { textContent: string | null }>(headings: Iterable<T>, section: string): T | null {
  for (const h of headings) {
    const text = (h.textContent ?? '').trim();
    if (text.startsWith(section + '.') || text.startsWith(section + ' ')) return h;
  }
  return null;
}
