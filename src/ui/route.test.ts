import { describe, expect, it } from 'vitest';
import { docKey, formatRoute, HOME, parseRoute, sameDoc, type Route } from './route';

describe('adresses', () => {
  const routes: [string, Route][] = [
    ['', HOME],
    ['#m=abc_-1', { page: 'doc', doc: { kind: 'shared', data: 'abc_-1' }, story: false }],
    ['recit', { page: 'doc', doc: { kind: 'local' }, story: true }],
    ['recit#m=xyz', { page: 'doc', doc: { kind: 'shared', data: 'xyz' }, story: true }],
    ['exemples', { page: 'gallery' }],
    ['exemples/albedo', { page: 'doc', doc: { kind: 'example', id: 'albedo' }, story: false }],
    ['exemples/albedo/recit', { page: 'doc', doc: { kind: 'example', id: 'albedo' }, story: true }],
    ['aide', { page: 'help', section: null }],
    ['aide#6.2', { page: 'help', section: '6.2' }],
  ];

  it('se lisent et s’écrivent à l’identique', () => {
    for (const [href, route] of routes) {
      expect(parseRoute(href), href).toEqual(route);
      expect(formatRoute(route), href).toBe(href);
    }
  });

  it('tolèrent une barre finale, une requête, un hash sans objet', () => {
    expect(parseRoute('exemples/')).toEqual({ page: 'gallery' });
    expect(parseRoute('exemples/albedo/?utm=x')).toEqual(parseRoute('exemples/albedo'));
    expect(parseRoute('exemples/albedo#m=abc')).toEqual(parseRoute('exemples/albedo'));
    expect(parseRoute('#autre')).toEqual(HOME);
  });

  it('mènent à mon diagramme quand elles sont inconnues', () => {
    for (const href of ['nimporte', 'exemples/a/b', 'aide/6.2', 'exemples/recit', 'aide/recit', 'index.html']) {
      expect(parseRoute(href), href).toEqual(HOME);
    }
  });

  it('décodent les caractères encodés', () => {
    expect(parseRoute('exemples/caf%C3%A9')).toEqual({ page: 'doc', doc: { kind: 'example', id: 'café' }, story: false });
    expect(formatRoute({ page: 'doc', doc: { kind: 'example', id: 'café' }, story: false })).toBe('exemples/caf%C3%A9');
    expect(parseRoute('exemples/%E0%A4%A')).toEqual({ page: 'doc', doc: { kind: 'example', id: '%E0%A4%A' }, story: false });
  });
});

describe('identité d’un diagramme', () => {
  it('distingue les diagrammes, et non les façons de les montrer', () => {
    const a = { kind: 'example', id: 'albedo' } as const;
    expect(sameDoc(a, { kind: 'example', id: 'albedo' })).toBe(true);
    expect(sameDoc(a, { kind: 'example', id: 'proies' })).toBe(false);
    expect(sameDoc({ kind: 'shared', data: 'x' }, { kind: 'shared', data: 'y' })).toBe(false);
    expect(sameDoc({ kind: 'local' }, { kind: 'local' })).toBe(true);
    expect(sameDoc({ kind: 'local' }, a)).toBe(false);
  });

  it('donne une clé courte et stable, même pour un long diagramme partagé', () => {
    const data = 'q'.repeat(5000);
    const key = docKey({ kind: 'shared', data });
    expect(key).toMatch(/^m:[0-9a-z]{1,11}$/);
    expect(docKey({ kind: 'shared', data })).toBe(key);
    expect(docKey({ kind: 'shared', data: data + 'r' })).not.toBe(key);
    expect(docKey({ kind: 'example', id: 'albedo' })).toBe('ex:albedo');
    expect(docKey({ kind: 'local' })).toBe('local');
  });
});
