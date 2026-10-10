import { editor } from '../model/editor.svelte';
import { sim } from '../sim/session.svelte';

/** Délai entre l'arrivée sur une étape et son impulsion : le temps que la vue se pose. */
const PULSE_DELAY_MS = 900;

/** État du panneau « Récit » (édition). */
class StoryUi {
  open = $state(false);
  /** Étape sélectionnée dans le panneau : sa mise en avant est prévisualisée sur le canevas. */
  active = $state<string | null>(null);
  /** On choisit les éléments de l'étape active en les touchant sur le canevas. */
  picking = $state(false);

  toggle() {
    this.open = !this.open;
    if (!this.open) this.picking = false;
  }
}

export const storyUi = new StoryUi();

/** Lecture du récit, étape par étape. */
class Presenter {
  index = $state(0);
  private timer: ReturnType<typeof setTimeout> | undefined;

  get count() {
    return editor.doc.story.steps.length;
  }

  /** Lance la présentation. Renvoie false s'il n'y a pas d'étape. */
  start(at = 0): boolean {
    if (this.count === 0) return false;
    storyUi.picking = false;
    sim.start('present');
    this.go(at);
    return true;
  }

  go(i: number) {
    this.index = Math.max(0, Math.min(this.count - 1, i));
    clearTimeout(this.timer);
    const pulse = editor.doc.story.steps[this.index]?.pulse;
    if (pulse) this.timer = setTimeout(() => sim.engine?.pulse(pulse.node, pulse.delta), PULSE_DELAY_MS);
  }

  next() {
    if (this.index < this.count - 1) this.go(this.index + 1);
  }

  prev() {
    if (this.index > 0) this.go(this.index - 1);
  }

  stop() {
    clearTimeout(this.timer);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    sim.stop();
  }
}

export const presenter = new Presenter();
