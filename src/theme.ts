// Palette partagée entre le CSS (variables sur :root) et le rendu canvas.

export const COLOR_KEYS = ['terracotta', 'ochre', 'sage', 'slate', 'plum', 'sand'] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];

export const COLOR_NAMES: Record<ColorKey, string> = {
  terracotta: 'Terracotta',
  ochre: 'Ocre',
  sage: 'Sauge',
  slate: 'Ardoise',
  plum: 'Prune',
  sand: 'Sable',
};

export interface Swatch {
  /** Remplissage pastel du galet. */
  fill: string;
  /** Couleur du niveau (remplissage « liquide » en simulation). */
  level: string;
  /** Contour, plus soutenu. */
  stroke: string;
}

export type ThemeName = 'papier' | 'veillee';

export interface Theme {
  paper: string;
  paperDeep: string;
  card: string;
  ink: string;
  inkSoft: string;
  grid: string;
  shadow: string;
  highlight: string;
  selection: string;
  positive: string;
  negative: string;
  swatches: Record<ColorKey, Swatch>;
}

export const THEMES: Record<ThemeName, Theme> = {
  papier: {
    paper: '#f3e9d7',
    paperDeep: '#e6d7bd',
    card: '#fbf5ea',
    ink: '#3d3128',
    inkSoft: '#7a6a5a',
    grid: 'rgba(61, 49, 40, 0.17)',
    shadow: 'rgba(96, 64, 32, 0.22)',
    highlight: 'rgba(255, 252, 244, 0.75)',
    selection: '#d9963f',
    positive: '#6f8d5e',
    negative: '#b9654a',
    swatches: {
      terracotta: { fill: '#f2cdb8', level: '#e3a185', stroke: '#b9654a' },
      ochre: { fill: '#f4e0ab', level: '#e2bb5f', stroke: '#b48a2c' },
      sage: { fill: '#d6e2c6', level: '#a9c08f', stroke: '#6f8d5e' },
      slate: { fill: '#cfdbe5', level: '#94b0c6', stroke: '#587892' },
      plum: { fill: '#e3cfdf', level: '#bf93b4', stroke: '#87587d' },
      sand: { fill: '#ece2cf', level: '#d2bf9b', stroke: '#9c8564' },
    },
  },
  veillee: {
    paper: '#2b231d',
    paperDeep: '#1f1813',
    card: '#3a3028',
    ink: '#f0e3cc',
    inkSoft: '#bfa98e',
    grid: 'rgba(240, 227, 204, 0.11)',
    shadow: 'rgba(0, 0, 0, 0.45)',
    highlight: 'rgba(255, 240, 215, 0.16)',
    selection: '#e8b062',
    positive: '#a6c48d',
    negative: '#e8957a',
    swatches: {
      terracotta: { fill: '#5a372b', level: '#9a5a43', stroke: '#e8a083' },
      ochre: { fill: '#574623', level: '#9c7b34', stroke: '#e8c46e' },
      sage: { fill: '#3b4834', level: '#66805a', stroke: '#b3cc9a' },
      slate: { fill: '#323f4b', level: '#587389', stroke: '#a3bfd6' },
      plum: { fill: '#4a3345', level: '#80587a', stroke: '#d5a8ca' },
      sand: { fill: '#4a4033', level: '#7d6c55', stroke: '#d7c3a0' },
    },
  },
};

/** Variables CSS dérivées du thème, à poser sur :root. */
export function themeCssVars(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {
    '--paper': theme.paper,
    '--paper-deep': theme.paperDeep,
    '--card': theme.card,
    '--ink': theme.ink,
    '--ink-soft': theme.inkSoft,
    '--shadow': theme.shadow,
    '--highlight': theme.highlight,
    '--selection': theme.selection,
    '--positive': theme.positive,
    '--negative': theme.negative,
  };
  for (const key of COLOR_KEYS) {
    const s = theme.swatches[key];
    vars[`--${key}`] = s.fill;
    vars[`--${key}-level`] = s.level;
    vars[`--${key}-stroke`] = s.stroke;
  }
  return vars;
}
