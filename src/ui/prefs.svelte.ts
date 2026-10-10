import type { ThemeName } from '../theme';

const KEY = 'aledloop:theme';

function initialTheme(): ThemeName {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'papier' || saved === 'veillee') return saved;
  } catch {
    // stockage indisponible
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'veillee' : 'papier';
}

class Prefs {
  theme = $state<ThemeName>(initialTheme());

  toggleTheme() {
    this.theme = this.theme === 'papier' ? 'veillee' : 'papier';
    try {
      localStorage.setItem(KEY, this.theme);
    } catch {
      // tant pis
    }
  }
}

export const prefs = new Prefs();
