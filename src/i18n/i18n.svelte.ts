import { formatDuration, formatEstimate, formatNumber, unitName } from '../model/time';
import type { TimeUnit } from '../model/types';
import { en } from './en';
import { fr, type Messages } from './fr';
import { guessLang, type Lang } from './lang';

const KEY = 'aledloop:lang';
const MESSAGES: Record<Lang, Messages> = { fr, en };

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'fr' || saved === 'en') return saved;
  } catch {
    // stockage indisponible
  }
  return guessLang(typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]));
}

/**
 * Langue de l'interface : celle choisie, sinon celle du navigateur (le français si on le parle,
 * l'anglais sinon). Dans un composant : `const t = $derived(i18n.t)`, puis `{t.topbar.examples}`.
 * Les formats ci-dessous lisent `lang` : utilisés dans un gabarit, ils suivent le changement de langue.
 */
class I18n {
  lang = $state<Lang>(initialLang());

  get t(): Messages {
    return MESSAGES[this.lang];
  }

  set(lang: Lang) {
    this.lang = lang;
    try {
      localStorage.setItem(KEY, lang);
    } catch {
      // stockage indisponible
    }
  }

  toggle() {
    this.set(this.lang === 'fr' ? 'en' : 'fr');
  }

  duration(value: number, unit: TimeUnit, estimate = false) {
    return formatDuration(value, unit, this.lang, estimate);
  }

  number(value: number, digits = 2) {
    return formatNumber(value, digits, this.lang);
  }

  estimate(value: number) {
    return formatEstimate(value, this.lang);
  }

  unit(unit: TimeUnit, value = 2) {
    return unitName(unit, value, this.lang);
  }
}

export const i18n = new I18n();
