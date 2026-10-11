import type { Lang } from '../i18n/lang';
import { formatDuration, formatEstimate } from './time';
import type { Doc } from './types';

/**
 * Une boucle de rétroaction : un cycle élémentaire du graphe (aucun nœud traversé deux fois).
 * - R (renforçante) : nombre PAIR de liens −. Un changement s'amplifie en faisant le tour.
 * - B (équilibrante, « balancing ») : nombre IMPAIR de liens −. Un changement se corrige.
 */
export interface Loop {
  /** Identifiant stable : les liens du cycle, triés. */
  key: string;
  /** Nœuds dans l'ordre du parcours (le premier n'est pas répété à la fin). */
  nodes: string[];
  /** edges[i] va de nodes[i] à nodes[i + 1] (le dernier revient au premier). */
  edges: string[];
  kind: 'R' | 'B';
  /** Ni accumulation ni retard : la boucle n'a pas de rythme propre (« boucle algébrique »). */
  instant: boolean;
}

/** Au-delà, on s'arrête : le nombre de cycles peut exploser dans un graphe très connecté. */
export const MAX_LOOPS = 60;

/**
 * Énumère les cycles élémentaires avec l'algorithme de Johnson (1975).
 * Pour chaque nœud de départ s, on ne cherche que les cycles dont s est le plus petit
 * indice : chaque cycle est trouvé une seule fois. Les nœuds « bloqués » évitent de
 * réexplorer des chemins dont on sait déjà qu'ils ne reviennent pas à s.
 */
export function findLoops(doc: Doc, max = MAX_LOOPS): Loop[] {
  const n = doc.nodes.length;
  const index = new Map(doc.nodes.map((node, i) => [node.id, i]));
  const out: { to: number; edge: number }[][] = doc.nodes.map(() => []);
  doc.edges.forEach((e, i) => {
    const a = index.get(e.from);
    const b = index.get(e.to);
    if (a !== undefined && b !== undefined && a !== b) out[a].push({ to: b, edge: i });
  });

  const loops: Loop[] = [];
  const blocked = new Array<boolean>(n).fill(false);
  const blockers: Set<number>[] = doc.nodes.map(() => new Set());
  const nodeStack: number[] = [];
  const edgeStack: number[] = [];

  const unblock = (u: number) => {
    blocked[u] = false;
    for (const w of blockers[u]) {
      blockers[u].delete(w);
      if (blocked[w]) unblock(w);
    }
  };

  const record = () => {
    const edges = edgeStack.map((i) => doc.edges[i]);
    const negatives = edges.filter((e) => e.polarity === -1).length;
    loops.push({
      key: edges.map((e) => e.id).sort().join('|'),
      nodes: nodeStack.map((i) => doc.nodes[i].id),
      edges: edges.map((e) => e.id),
      kind: negatives % 2 === 0 ? 'R' : 'B',
      instant: edges.every((e) => e.delay === 0) && nodeStack.every((i) => doc.nodes[i].causal.kind === 'variable'),
    });
  };

  const circuit = (v: number, s: number): boolean => {
    let found = false;
    nodeStack.push(v);
    blocked[v] = true;
    for (const { to: w, edge } of out[v]) {
      if (w < s || loops.length >= max) continue;
      edgeStack.push(edge);
      if (w === s) {
        record();
        found = true;
      } else if (!blocked[w] && circuit(w, s)) {
        found = true;
      }
      edgeStack.pop();
    }
    if (found) unblock(v);
    else for (const { to: w } of out[v]) if (w >= s) blockers[w].add(v);
    nodeStack.pop();
    return found;
  };

  for (let s = 0; s < n && loops.length < max; s++) {
    for (let i = s; i < n; i++) {
      blocked[i] = false;
      blockers[i].clear();
    }
    circuit(s, s);
  }
  // Les petites boucles d'abord : ce sont les plus lisibles.
  return loops.sort((a, b) => a.edges.length - b.edges.length);
}

/** Phrase d'explication, pour l'inspecteur. */
export function describeLoop(loop: Loop, lang: Lang = 'fr'): string {
  return loop.kind === 'R' ? TEXT[lang].reinforcing : TEXT[lang].balancing;
}

/**
 * Seuils d'une boucle équilibrante à une seule accumulation, de gain G (produit des forces, par
 * unité de temps) et de retard total D (traité comme un retard d'ordre 3). Les racines de
 * s (1 + sD/3)³ + G = 0 donnent : pas d'oscillation tant que G·D ≤ 0,32 ; oscillation qui grandit
 * dès que G·D ≥ 8/3.
 */
export const OSCILLATION_GD = 0.316;
export const INSTABILITY_GD = 8 / 3;

export type LoopVerdict =
  /** Ni accumulation ni retard : pas de rythme propre. */
  | 'instant'
  /** Revient à l'équilibre sans le dépasser. */
  | 'settles'
  /** Dépasse l'équilibre, oscille, puis se stabilise. */
  | 'damped'
  /** Oscille de plus en plus (jusqu'aux bornes). */
  | 'unstable'
  /** Plusieurs accumulations : tend à osciller. */
  | 'oscillates'
  /** L'écart s'amplifie. */
  | 'grows'
  /** L'écart s'éteint à chaque tour (boucle R sans accumulation, liens faibles). */
  | 'fades';

export interface LoopAnalysis {
  verdict: LoopVerdict;
  /** Nombre d'accumulations sur la boucle. */
  stocks: number;
  /** Somme des retards, en unités de temps. */
  delay: number;
  /** Produit des forces. */
  gain: number;
  /** Explication, avec du `**gras**`. */
  text: string;
}

/**
 * Les phrases de l'analyse, dans chaque langue. Durées et nombres arrivent déjà écrits : `tau` temps de
 * réaction, `D` retard total, `osc` et `runaway` les retards au-delà desquels la boucle oscille, puis s'emballe.
 */
interface LoopTexts {
  reinforcing: string;
  balancing: string;
  instant: string;
  limits(osc: string, runaway: string): string;
  settles(tau: string, D: string | null, limits: string): string;
  damped(tau: string, D: string, limits: string): string;
  unstable(tau: string, D: string, limits: string): string;
  delayDamped(D: string): string;
  delayUnstable(D: string): string;
  oscillates(stocks: number, delayed: boolean): string;
  fades(gain: string, D: string): string;
  holds(gain: string, D: string, grows: boolean): string;
  leaks(amplification: string): string;
  doubles(time: string): string;
  delayedGrowth(D: string): string;
}

const TEXT: Record<Lang, LoopTexts> = {
  fr: {
    reinforcing:
      'Un changement s’amplifie en faisant le tour : une hausse entraîne encore plus de hausse, une baisse encore plus de baisse. Cercle vertueux… ou vicieux.',
    balancing: 'Un changement se corrige en faisant le tour : le système résiste, revient vers un équilibre, ou oscille autour.',
    instant:
      'Ni accumulation ni retard sur cette boucle : rien ne lui donne de **rythme propre**, alors aledloop la ralentit artificiellement. Fais d’un de ses éléments une **accumulation**.',
    limits: (osc, runaway) => `Avec ces forces, elle se met à osciller au-delà d’un retard d’environ ${osc}, et s’emballe au-delà de ${runaway}.`,
    settles: (tau, D, limits) =>
      `Temps de réaction : environ ${tau}. ${D ? `Le retard (${D}) est court en comparaison : elle` : 'Sans retard, elle'} revient à l’équilibre **en douceur**. ${limits}`,
    damped: (tau, D, limits) =>
      `Temps de réaction : environ ${tau}, pour un retard de ${D}. Elle corrige un peu tard : elle **dépasse l’équilibre et oscille** avant de se stabiliser. ${limits}`,
    unstable: (tau, D, limits) =>
      `Temps de réaction : environ ${tau}, pour un retard de ${D}. Le retard est trop long : elle corrige toujours à contretemps et **oscille de plus en plus**. ${limits}`,
    delayDamped: (D) => `Sans accumulation, c’est le retard (${D}) qui rythme la boucle : elle **oscille en s’amortissant**.`,
    delayUnstable: (D) => `Sans accumulation, c’est le retard (${D}) qui rythme la boucle, et ses liens sont si forts qu’elle **oscille de plus en plus**.`,
    oscillates: (stocks, delayed) =>
      `${stocks} accumulations se renvoient la balle : la boucle tend à **osciller**, comme proies et prédateurs. Un retour à l’équilibre sur l’une d’elles amortit les oscillations${delayed ? ', un retard les amplifie' : ''}.`,
    fades: (gain, D) => `Sans accumulation, l’écart est multiplié par ${gain} à chaque tour (tous les ${D}) : il **s’éteint** peu à peu.`,
    holds: (gain, D, grows) =>
      `Sans accumulation, l’écart est multiplié par ${gain} à chaque tour (tous les ${D}) : il **${grows ? 's’amplifie' : 'se maintient'}**.`,
    leaks: (amplification) =>
      `Ses accumulations ont toutes une fuite (retour à l’équilibre) qui la freine, et ici **le frein l’emporte** : un écart est amplifié environ ×${amplification}, sans s’emballer. Plus ce chiffre est grand, plus on est près du point où elle s’emballerait.`,
    doubles: (time) => `Sans frein, l’écart **double** environ tous les ${time}.`,
    delayedGrowth: (D) => `L’écart **s’amplifie** à chaque tour. Le retard (${D}) ralentit l’emballement sans l’empêcher.`,
  },
  en: {
    reinforcing:
      'A change grows as it goes around: a rise brings an even bigger rise, a fall an even bigger fall. A virtuous circle… or a vicious one.',
    balancing: 'A change corrects itself as it goes around: the system pushes back, returns to a balance, or swings around it.',
    instant:
      'No accumulation and no delay on this loop: nothing gives it a **rhythm of its own**, so aledloop slows it down artificially. Turn one of its elements into an **accumulation**.',
    limits: (osc, runaway) => `With these strengths, it starts to oscillate beyond a delay of about ${osc}, and runs away beyond ${runaway}.`,
    settles: (tau, D, limits) =>
      `Reaction time: about ${tau}. ${D ? `The delay (${D}) is short in comparison: it` : 'With no delay, it'} returns to balance **smoothly**. ${limits}`,
    damped: (tau, D, limits) =>
      `Reaction time: about ${tau}, with a delay of ${D}. It corrects a little late: it **overshoots and oscillates** before settling down. ${limits}`,
    unstable: (tau, D, limits) =>
      `Reaction time: about ${tau}, with a delay of ${D}. The delay is too long: it always corrects at the wrong moment and **oscillates more and more**. ${limits}`,
    delayDamped: (D) => `With no accumulation, the delay (${D}) sets the loop’s rhythm: it **oscillates and dies down**.`,
    delayUnstable: (D) => `With no accumulation, the delay (${D}) sets the loop’s rhythm, and its links are so strong that it **oscillates more and more**.`,
    oscillates: (stocks, delayed) =>
      `${stocks} accumulations bounce the change back and forth: the loop tends to **oscillate**, like predators and prey. A return to balance on one of them dampens the oscillations${delayed ? '; a delay amplifies them' : ''}.`,
    fades: (gain, D) => `With no accumulation, the gap is multiplied by ${gain} on each lap (every ${D}): it **fades away** little by little.`,
    holds: (gain, D, grows) => `With no accumulation, the gap is multiplied by ${gain} on each lap (every ${D}): it **${grows ? 'grows' : 'holds steady'}**.`,
    leaks: (amplification) =>
      `All its accumulations leak (they return to balance), which acts as a brake, and here **the brake wins**: a gap is amplified about ×${amplification}, without running away. The bigger this number, the closer the loop is to running away.`,
    doubles: (time) => `With no brake, the gap **doubles** about every ${time}.`,
    delayedGrowth: (D) => `The gap **grows** on each lap. The delay (${D}) slows the runaway down without stopping it.`,
  },
};

/**
 * Estime le comportement d'une boucle prise isolément, à partir des forces et des retards.
 * Ignore saturations, seuils et retours à l'équilibre : c'est un ordre de grandeur, pour comprendre.
 */
export function analyzeLoop(doc: Doc, loop: Loop, lang: Lang = 'fr'): LoopAnalysis {
  const text = TEXT[lang];
  const nodes = new Map(doc.nodes.map((n) => [n.id, n]));
  const edges = new Map(doc.edges.map((e) => [e.id, e]));
  const stocks = loop.nodes.filter((id) => nodes.get(id)?.causal.kind === 'stock').length;
  const delay = loop.edges.reduce((sum, id) => sum + (edges.get(id)?.delay ?? 0), 0);
  const gain = loop.edges.reduce((prod, id) => prod * (edges.get(id)?.weight ?? 1), 1);
  const unit = doc.timeUnit;
  const D = formatDuration(delay, unit, lang);
  const est = (v: number) => formatDuration(v, unit, lang, true);
  const x = (v: number) => formatEstimate(v, lang);
  const result = (verdict: LoopVerdict, text: string): LoopAnalysis => ({ verdict, stocks, delay, gain, text });

  if (loop.instant) return result('instant', text.instant);

  if (loop.kind === 'B') {
    if (stocks === 1) {
      const tau = est(1 / gain);
      const gd = gain * delay;
      const limits = text.limits(est(OSCILLATION_GD / gain), est(INSTABILITY_GD / gain));
      if (gd <= OSCILLATION_GD) return result('settles', text.settles(tau, delay > 0 ? D : null, limits));
      if (gd < INSTABILITY_GD) return result('damped', text.damped(tau, D, limits));
      return result('unstable', text.unstable(tau, D, limits));
    }
    if (stocks === 0) {
      // Seul le retard rythme la boucle : (1 + sD/3)³ + G = 0 est instable dès que G ≥ 8.
      return gain < 8 ? result('damped', text.delayDamped(D)) : result('unstable', text.delayUnstable(D));
    }
    return result('oscillates', text.oscillates(stocks, delay > 0));
  }

  if (stocks === 0) {
    if (gain < 1) return result('fades', text.fades(x(gain), D));
    return result('grows', text.holds(x(gain), D, gain > 1));
  }
  // Si chaque accumulation fuit (retour à l'équilibre, constante τ), la boucle ne s'emballe que si son
  // gain « en régime établi » G × Π τ dépasse 1 ; sinon elle amplifie un écart de 1 / (1 − G × Π τ).
  const leaks = loop.nodes.map((id) => nodes.get(id)!.causal).filter((c) => c.kind === 'stock').map((c) => c.relax);
  if (leaks.every((tau) => tau > 0)) {
    const steady = gain * leaks.reduce((prod, tau) => prod * tau, 1);
    if (steady < 1) return result('fades', text.leaks(x(1 / (1 - steady))));
  }
  if (delay === 0) {
    // k accumulations en chaîne, gain G : l'écart croît comme e^(G^(1/k) t).
    return result('grows', text.doubles(est(Math.LN2 / gain ** (1 / stocks))));
  }
  return result('grows', text.delayedGrowth(D));
}
