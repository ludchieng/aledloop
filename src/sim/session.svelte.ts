import { editor } from '../model/editor.svelte';
import { LoopySim } from './loopy';

export const SPEEDS = [0.25, 0.5, 1, 2, 4] as const;

/** Session de simulation : relie le moteur pur à l'interface (lecture/pause, vitesse). */
class SimSession {
  engine: LoopySim | null = null;
  playing = $state(true);
  speed = $state(1);

  start() {
    editor.selection = null;
    this.engine = new LoopySim(editor.doc);
    this.playing = true;
    editor.mode = 'sim';
  }

  stop() {
    this.engine = null;
    editor.mode = 'edit';
    editor.changed();
  }

  reset() {
    this.engine?.reset();
  }

  /** Appelé à chaque image par le canvas. */
  tick(dt: number) {
    if (this.engine && this.playing) this.engine.step(Math.min(dt, 0.1) * this.speed);
  }
}

export const sim = new SimSession();
