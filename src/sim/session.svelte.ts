import { editor } from '../model/editor.svelte';
import { prefs } from '../ui/prefs.svelte';
import { CausalSim } from './causal';
import { PacketTracker } from './packets';

/** Vitesses proposées, en unités de temps du modèle par seconde réelle. */
export const SPEEDS = [0.25, 0.5, 1, 2, 4, 8] as const;
/** Durée de parcours d'une perle sur un lien sans retard, en secondes réelles. */
const BEAD_SECONDS = 1.2;
/**
 * Au lancement d'une simulation libre, on fait tourner ce morceau de la durée, puis on attend un
 * premier geste (▲ ▼) : sinon la simulation déroulerait toute seule un système au repos.
 */
export const WARMUP = 0.05;
/** Au-delà, une perle paraîtrait immobile. */
const BEAD_MAX_SECONDS = 20;

/** Session de simulation : relie le moteur pur à l'interface (lecture/pause, vitesse, horloge). */
class SimSession {
  engine: CausalSim | null = null;
  playing = $state(true);
  speed = $state(1);
  /** Temps du modèle, arrondi au dixième, pour l'horloge affichée. */
  time = $state(0);
  /** La durée de simulation vient d'être atteinte : la lecture s'est mise en pause. */
  ended = $state(false);
  /** En attente du premier geste : la lecture s'est mise en pause après le démarrage. */
  waiting = $state(false);
  /** Un premier geste a eu lieu (▲ ▼, lecture ou calcul demandés) : on n'attend plus. */
  private touched = false;
  /** Une fois la fin atteinte (ou calculée d'un coup), la lecture ne s'arrête plus d'elle-même. */
  private finished = false;
  /**
   * Avancement des perles animées de chaque lien, dans [0, 1[. Sur un lien retardé, une perle met
   * le temps du retard à le parcourir : sa lenteur montre le retard.
   */
  phases = new Map<string, number>();
  /** Perles « par paquets » des liens qui mènent à une variable : elles ne partent que quand la cause change. */
  packets = new PacketTracker();

  start(mode: 'sim' | 'present' = 'sim') {
    editor.selection = null;
    this.engine = new CausalSim(editor.doc);
    this.phases.clear();
    this.packets.clear();
    this.time = 0;
    this.ended = false;
    this.finished = false;
    this.touched = false;
    this.waiting = false;
    this.playing = true;
    editor.mode = mode;
  }

  stop() {
    this.engine = null;
    editor.mode = 'edit';
    editor.changed();
  }

  reset() {
    this.engine?.reset();
    this.packets.clear();
    this.time = 0;
    this.ended = false;
    this.finished = false;
    this.touched = false;
  }

  /** Appui sur ▲ (1) ou ▼ (−1) : dérange un élément, et relance la simulation si elle attendait ce geste. */
  push(id: string, delta: 1 | -1) {
    this.engine?.push(id, delta);
    this.touched = true;
    if (this.waiting) {
      this.waiting = false;
      this.playing = true;
    }
  }

  /**
   * Vitesse suivante (dir = 1) ou précédente (dir = −1). Le bouton boucle (après ×8, ×0,25) ;
   * au clavier, on s'arrête aux extrêmes.
   */
  changeSpeed(dir: 1 | -1, wrap = false) {
    const i = SPEEDS.indexOf(this.speed as (typeof SPEEDS)[number]);
    const j = wrap ? (i + dir + SPEEDS.length) % SPEEDS.length : Math.max(0, Math.min(SPEEDS.length - 1, i + dir));
    this.speed = SPEEDS[j];
  }

  /** Lecture / pause. Reprendre après la fin prolonge la simulation. */
  toggle() {
    this.playing = !this.playing;
    if (this.playing) {
      this.ended = false;
      this.waiting = false;
      this.touched = true;
    }
  }

  /**
   * Calcule d'un coup, comme un « run » d'Insight Maker : toute une durée de simulation de plus
   * (la fenêtre des courbes se remplit d'un trait), ou jusqu'à la fin si on s'arrête à la fin.
   */
  runAhead() {
    const engine = this.engine;
    if (!engine) return;
    this.touched = true;
    this.waiting = false;
    this.syncWindow();
    const horizon = editor.doc.horizon;
    if (prefs.stopAtEnd) {
      engine.step(Math.max(0, horizon - engine.time));
      this.finished = true;
      this.ended = true;
      this.playing = false;
    } else {
      engine.step(horizon);
    }
    this.syncTime();
  }

  /** Avec « arrêt à la fin », il n'y a plus rien à calculer d'un coup une fois au bout. */
  get canRunAhead() {
    return !(prefs.stopAtEnd && this.time >= editor.doc.horizon);
  }

  /** La fenêtre des courbes suit la durée de simulation, même si on la change en cours de route. */
  private syncWindow() {
    if (this.engine && this.engine.historyWindow !== editor.doc.horizon) this.engine.setHistoryWindow(editor.doc.horizon);
  }

  private syncTime() {
    const shown = Math.floor((this.engine?.time ?? 0) * 10 + 1e-6) / 10;
    if (shown !== this.time) this.time = shown;
  }

  /** Appelé à chaque image par le canvas, avec le temps réel écoulé en secondes. */
  tick(dt: number) {
    if (!this.engine || !this.playing) return;
    this.syncWindow();
    const real = Math.min(dt, 0.1);
    this.engine.step(real * this.speed);
    this.packets.tick(real);
    for (const e of editor.doc.edges) {
      const travel = e.delay > 0 ? Math.min(BEAD_MAX_SECONDS, Math.max(BEAD_SECONDS, e.delay / this.speed)) : BEAD_SECONDS;
      this.phases.set(e.id, ((this.phases.get(e.id) ?? 0) + real / travel) % 1);
      if (editor.node(e.to)?.causal.kind !== 'stock') this.packets.update(e.id, this.engine.edgeSignal(e.id, 0), real / travel);
    }
    this.syncTime();
    // Démarrage : un court moment de simulation, puis on attend que quelqu'un dérange le système.
    if (!this.touched && editor.mode === 'sim' && this.engine.time >= WARMUP * editor.doc.horizon) {
      this.playing = false;
      this.waiting = true;
      return;
    }
    // Par défaut, rien ne s'arrête : les courbes défilent. Avec « arrêt à la fin », on s'arrête une fois
    // au bout de la durée (jamais pendant un récit, qui a son propre rythme).
    if (prefs.stopAtEnd && !this.finished && editor.mode === 'sim' && this.engine.time >= editor.doc.horizon) {
      this.finished = true;
      this.ended = true;
      this.playing = false;
    }
  }
}

export const sim = new SimSession();
