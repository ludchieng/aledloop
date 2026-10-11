import type { ThemeName } from '../theme';

const KEY = 'aledloop:theme';
const LOOPS_KEY = 'aledloop:loops';
const CHART_KEY = 'aledloop:chart';
const STOP_KEY = 'aledloop:stop-at-end';

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

function initialShowChart(): boolean {
  try {
    return localStorage.getItem(CHART_KEY) !== 'off';
  } catch {
    return true;
  }
}

function initialStopAtEnd(): boolean {
  try {
    return localStorage.getItem(STOP_KEY) === 'on';
  } catch {
    return false;
  }
}

class Prefs {
  theme = $state<ThemeName>(initialTheme());
  /** Afficher les étiquettes de boucle R / B sur le diagramme. */
  showLoops = $state(initialShowLoops());
  /** Afficher le panneau des courbes pendant la simulation. */
  showChart = $state(initialShowChart());

  /**
   * S'arrêter au bout de la durée de simulation (en gardant tout depuis le début), au lieu de faire
   * défiler les courbes. Désactivé par défaut : une simulation qui se fige semble avoir planté.
   */
  stopAtEnd = $state(initialStopAtEnd());

  setStopAtEnd(on: boolean) {
    this.stopAtEnd = on;
    try {
      localStorage.setItem(STOP_KEY, on ? 'on' : 'off');
    } catch {
      // tant pis
    }
  }

  toggleChart() {
    this.showChart = !this.showChart;
    try {
      localStorage.setItem(CHART_KEY, this.showChart ? 'on' : 'off');
    } catch {
      // tant pis
    }
  }

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
