import { LOCALES, type Lang } from '../i18n/lang';
import { MAX_DURATION, MIN_DURATION, type TimeUnit } from './types';

const NAMES: Record<Lang, Record<TimeUnit, [one: string, many: string]>> = {
  fr: {
    second: ['seconde', 'secondes'],
    minute: ['minute', 'minutes'],
    hour: ['heure', 'heures'],
    day: ['jour', 'jours'],
    week: ['semaine', 'semaines'],
    month: ['mois', 'mois'],
    year: ['an', 'ans'],
  },
  en: {
    second: ['second', 'seconds'],
    minute: ['minute', 'minutes'],
    hour: ['hour', 'hours'],
    day: ['day', 'days'],
    week: ['week', 'weeks'],
    month: ['month', 'months'],
    year: ['year', 'years'],
  },
};

/** Nom de l'unité, accordé : en français, pluriel à partir de 2 (« 1,5 an ») ; en anglais, sauf pour 1 (« 1.5 years »). */
export function unitName(unit: TimeUnit, value = 2, lang: Lang = 'fr'): string {
  const plural = lang === 'fr' ? Math.abs(value) >= 2 : Math.abs(value) !== 1;
  return NAMES[lang][unit][plural ? 1 : 0];
}

/** Nombre à au plus deux décimales, à la façon de la langue : « 2,5 », « 2.5 ». */
export function formatNumber(value: number, digits = 2, lang: Lang = 'fr'): string {
  return value.toLocaleString(LOCALES[lang], { maximumFractionDigits: digits });
}

/** Ordre de grandeur, deux chiffres significatifs : « 0,32 », « 1,4 », « 270 ». */
export function formatEstimate(value: number, lang: Lang = 'fr'): string {
  return value.toLocaleString(LOCALES[lang], { maximumSignificantDigits: 2 });
}

/** « 3 ans », « 1,5 jour ». `estimate` arrondit à deux chiffres significatifs. */
export function formatDuration(value: number, unit: TimeUnit, lang: Lang = 'fr', estimate = false): string {
  const shown = estimate ? Number(value.toPrecision(2)) : Math.round(value * 100) / 100;
  return `${estimate ? formatEstimate(value, lang) : formatNumber(value, 2, lang)} ${unitName(unit, shown, lang)}`;
}

/** Valeurs « rondes » proposées par les boutons − et + d'une durée. */
const LADDER = [0, 0.1, 0.2, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 150, 200, 300, 500, MAX_DURATION];

/** Durée suivante (dir = 1) ou précédente (dir = −1) sur l'échelle des valeurs rondes. */
export function stepDuration(value: number, dir: 1 | -1): number {
  if (dir > 0) return LADDER.find((v) => v > value + 1e-9) ?? value;
  return [...LADDER].reverse().find((v) => v < value - 1e-9) ?? 0;
}

/** Lit une durée tapée par l'utilisateur (« 2,5 », « 2.5 », « 3 »). Vide ou invalide : 0. Sinon au moins MIN_DURATION. */
export function parseDuration(text: string): number {
  const v = parseFloat(text.replace(',', '.').trim());
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.min(MAX_DURATION, Math.max(MIN_DURATION, Math.round(v * 100) / 100));
}
