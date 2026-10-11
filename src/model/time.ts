import { MAX_DURATION, MIN_DURATION, type TimeUnit } from './types';

const NAMES: Record<TimeUnit, [one: string, many: string]> = {
  second: ['seconde', 'secondes'],
  minute: ['minute', 'minutes'],
  hour: ['heure', 'heures'],
  day: ['jour', 'jours'],
  week: ['semaine', 'semaines'],
  month: ['mois', 'mois'],
  year: ['an', 'ans'],
};

/** Nom de l'unité, accordé comme en français : pluriel à partir de 2. */
export function unitName(unit: TimeUnit, value = 2): string {
  return NAMES[unit][Math.abs(value) >= 2 ? 1 : 0];
}

/** Nombre à la française, au plus deux décimales : « 2,5 ». */
export function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: digits });
}

/** Ordre de grandeur, deux chiffres significatifs : « 0,32 », « 1,4 », « 270 ». */
export function formatEstimate(value: number): string {
  return value.toLocaleString('fr-FR', { maximumSignificantDigits: 2 });
}

/** « 3 ans », « 1,5 jour ». `estimate` arrondit à deux chiffres significatifs. */
export function formatDuration(value: number, unit: TimeUnit, estimate = false): string {
  const shown = estimate ? Number(value.toPrecision(2)) : Math.round(value * 100) / 100;
  return `${estimate ? formatEstimate(value) : formatNumber(value)} ${unitName(unit, shown)}`;
}

/** Valeurs « rondes » proposées par les boutons − et + d'une durée. */
const LADDER = [0, 0.1, 0.2, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 150, 200, 300, 500, MAX_DURATION];

/** Durée suivante (dir = 1) ou précédente (dir = −1) sur l'échelle des valeurs rondes. */
export function stepDuration(value: number, dir: 1 | -1): number {
  if (dir > 0) return LADDER.find((v) => v > value + 1e-9) ?? value;
  return [...LADDER].reverse().find((v) => v < value - 1e-9) ?? 0;
}

/** Lit une durée tapée par l'utilisateur (« 2,5 », « 3 »). Vide ou invalide : 0. Sinon au moins MIN_DURATION. */
export function parseDuration(text: string): number {
  const v = parseFloat(text.replace(',', '.').trim());
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.min(MAX_DURATION, Math.max(MIN_DURATION, Math.round(v * 100) / 100));
}
