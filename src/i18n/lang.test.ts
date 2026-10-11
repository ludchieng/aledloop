import { describe, expect, it } from 'vitest';
import { formatDuration, formatEstimate, formatNumber, unitName } from '../model/time';
import { en } from './en';
import { fr } from './fr';
import { guessLang } from './lang';

describe('langue', () => {
  it('suit le navigateur : le français si on le parle, l’anglais sinon', () => {
    expect(guessLang(['fr-FR', 'en'])).toBe('fr');
    expect(guessLang(['fr-CA'])).toBe('fr');
    expect(guessLang(['de-DE', 'fr'])).toBe('fr');
    expect(guessLang(['en-GB', 'fr'])).toBe('en');
    expect(guessLang(['de', 'es'])).toBe('en');
    expect(guessLang([])).toBe('en');
  });

  it('écrit nombres et durées à la façon de chaque langue', () => {
    expect(formatNumber(2.5, 2, 'fr')).toBe('2,5');
    expect(formatNumber(2.5, 2, 'en')).toBe('2.5');
    expect(formatEstimate(0.316, 'en')).toBe('0.32');
    expect(formatDuration(3, 'year', 'fr')).toBe('3 ans');
    expect(formatDuration(3, 'year', 'en')).toBe('3 years');
    // Le pluriel : dès 2 en français, sauf pour 1 en anglais.
    expect(formatDuration(1.5, 'day', 'fr')).toBe('1,5 jour');
    expect(formatDuration(1.5, 'day', 'en')).toBe('1.5 days');
    expect(unitName('month', 1, 'en')).toBe('month');
    expect(unitName('month', 1, 'fr')).toBe('mois');
  });

  it('a les mêmes textes dans les deux langues', () => {
    // TypeScript vérifie déjà les clés ; ceci attrape une valeur oubliée (copiée sans être traduite).
    const leaves = (o: object, path = ''): [string, unknown][] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? leaves(v, `${path}${k}.`) : [[path + k, v]]));
    const english = new Map(leaves(en));
    const identical = new Set(['inspector.stocks']); // « Accumulations » : le même mot en anglais
    const same = leaves(fr).filter(([k, v]) => typeof v === 'string' && v === english.get(k) && v.length > 12 && !identical.has(k));
    expect(same.map(([k]) => k)).toEqual([]);
  });
});
