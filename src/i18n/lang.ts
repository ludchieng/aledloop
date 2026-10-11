/**
 * Langues de l'interface. Ce module est pur (ni DOM ni Svelte) : le modèle l'importe pour écrire
 * ses phrases (durées, analyse des boucles) dans la langue demandée.
 */
export type Lang = 'fr' | 'en';

export const LANGS: readonly Lang[] = ['fr', 'en'];

/** Locale des nombres : « 2,5 » en français, « 2.5 » en anglais. */
export const LOCALES: Record<Lang, string> = { fr: 'fr-FR', en: 'en-US' };

/** La langue du navigateur si on la parle, sinon l'anglais. */
export function guessLang(preferred: readonly string[]): Lang {
  for (const tag of preferred) {
    const lang = tag.toLowerCase().slice(0, 2);
    if (lang === 'fr' || lang === 'en') return lang;
  }
  return 'en';
}
