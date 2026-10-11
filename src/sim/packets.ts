/**
 * Perles « par paquets », pour les liens qui mènent à une variable.
 *
 * Une variable suit sa cause : ce qui compte, ce sont les CHANGEMENTS. Une perle part donc quand
 * l'écart transmis a bougé d'un cran (PACKET_STEP), puis fait le trajet ; tant que rien ne change,
 * rien ne circule, même si deux causes poussent en sens opposés. Vers une accumulation, au contraire,
 * ce qui arrive est un débit : ce sont les perles continues du rendu habituel.
 *
 * Convention d'affichage seulement : le moteur, lui, reste continu.
 */

/** Taille d'un cran de changement (en écart transmis) qui fait partir une perle. */
export const PACKET_STEP = 0.05;

/**
 * Persistance rétinienne : une perle arrivée laisse une empreinte (son sens) pendant IMPRINT_SECONDS,
 * pleine pendant IMPRINT_HOLD puis qui s'efface. Le temps est celui de l'écran, figé quand on met en pause.
 */
export const IMPRINT_SECONDS = 1.6;
const IMPRINT_HOLD = 0.7;

export interface Packet {
  /** Avancement sur le lien, de 0 (départ) à 1 (arrivée). */
  t: number;
  /** Changement transporté (signé, polarité et force comprises). */
  value: number;
}

export class PacketTracker {
  private packets = new Map<string, Packet[]>();
  private last = new Map<string, number>();
  private pending = new Map<string, number>();
  private arrivals = new Map<string, { value: number; at: number }>();
  private clock = 0;

  /** Fait passer le temps de l'écran (secondes réelles, lecture en cours). */
  tick(seconds: number) {
    this.clock += seconds;
  }

  /**
   * Fait avancer les perles du lien de `progress` (fraction du trajet) et en émet une si l'écart
   * transmis `signal` a assez changé depuis la dernière perle.
   */
  update(edgeId: string, signal: number, progress: number) {
    const previous = this.last.get(edgeId) ?? signal;
    this.last.set(edgeId, signal);
    let change = (this.pending.get(edgeId) ?? 0) + signal - previous;
    const list = (this.packets.get(edgeId) ?? []).filter((p) => {
      p.t += progress;
      if (p.t < 1 - 1e-9) return true;
      this.arrivals.set(edgeId, { value: p.value, at: this.clock });
      return false;
    });
    if (Math.abs(change) >= PACKET_STEP) {
      list.push({ t: 0, value: change });
      change = 0;
    }
    this.pending.set(edgeId, change);
    this.packets.set(edgeId, list);
  }

  /**
   * Empreinte de la dernière perle arrivée au bout du lien : son changement (signé), et son éclat
   * dans [0, 1] (1 juste après l'arrivée, 0 une fois effacée). null s'il n'y en a plus.
   */
  imprint(edgeId: string): { value: number; strength: number; age: number } | null {
    const a = this.arrivals.get(edgeId);
    if (!a) return null;
    const age = this.clock - a.at;
    if (age >= IMPRINT_SECONDS) return null;
    const strength = age <= IMPRINT_HOLD ? 1 : 1 - (age - IMPRINT_HOLD) / (IMPRINT_SECONDS - IMPRINT_HOLD);
    return { value: a.value, strength, age };
  }

  get(edgeId: string): readonly Packet[] {
    return this.packets.get(edgeId) ?? [];
  }

  /** Oublie tout : les perles en route et les dernières valeurs connues (après une remise à zéro). */
  clear() {
    this.packets.clear();
    this.last.clear();
    this.pending.clear();
    this.arrivals.clear();
  }
}
