import type { ThemeName } from '../theme';

const KEY = 'aledloop:theme';
const LOOPS_KEY = 'aledloop:loops';

function initialTheme(): ThemeName {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'papier' || saved === 'veillee') return saved;
  } catch {
    // stockage indisponible
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'veillee' : 'papier';
}

function initialShowLoops(): boolean {
  try {
    return localStorage.getItem(LOOPS_KEY) !== 'off';
  } catch {
    return true;
  }
}

class Prefs {
  theme = $state<ThemeName>(initialTheme());
  /** Afficher les étiquettes de boucle R / B sur le diagramme. */
  showLoops = $state(initialShowLoops());

  toggleLoops() {
    this.showLoops = !this.showLoops;
    try {
      localStorage.setItem(LOOPS_KEY, this.showLoops ? 'on' : 'off');
    } catch {
      // tant pis
    }
  }

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
