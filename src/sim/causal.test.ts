import { describe, expect, it } from 'vitest';
import { defaultCausal, emptyStory, type CausalProps, type Doc, type Polarity } from '../model/types';
import { CausalSim, DT, HISTORY_POINTS, INSTANT_LOOP_TAU, PUSH, RELEASE_TIME } from './causal';

type N = [id: string, causal?: Partial<CausalProps>];
type E = [from: string, to: string, polarity?: Polarity, weight?: number, delay?: number];

function model(nodes: N[], edges: E[]): Doc {
  return {
    version: 2,
    timeUnit: 'year', horizon: 20,
    nodes: nodes.map(([id, causal], i) => ({
      id,
      x: i * 100,
      y: 0,
      r: 40,
      label: id,
      color: 'sage' as const,
      causal: { ...defaultCausal(), ...causal },
    })),
    edges: edges.map(([from, to, polarity = 1, weight = 1, delay = 0]) => ({ id: from + to, from, to, polarity, weight, delay, bend: 0 })),
    story: emptyStory(),
  };
}

const stock = { kind: 'stock' } as const;

/** Thermostat : la température (accumulation) commande le chauffage (variable), qui la réchauffe. Gain de boucle G = 0,5. */
const thermostat = (delay: number) =>
  model(
    [['temp', stock], ['chauffage']],
    [
      ['temp', 'chauffage', -1],
      ['chauffage', 'temp', 1, 0.5, delay],
    ],
  );

/** Trajectoire échantillonnée toutes les `every` unités de temps. */
function trace(sim: CausalSim, id: string, duration: number, every = 0.5): number[] {
  const out: number[] = [];
  for (let t = 0; t < duration - 1e-9; t += every) {
    sim.step(every);
    out.push(sim.level(id));
  }
  return out;
}

describe('CausalSim : équilibre et natures', () => {
  it('au départ, rien ne bouge', () => {
    const sim = new CausalSim(thermostat(2));
    sim.step(20);
    expect(sim.level('temp')).toBe(0.5);
    expect(sim.level('chauffage')).toBe(0.5);
    expect(sim.time).toBeCloseTo(20);
  });

  it('une variable suit ses causes immédiatement, polarité et force comprises', () => {
    const sim = new CausalSim(model([['a'], ['b'], ['c']], [['a', 'b', -1, 2], ['b', 'c', -1]]));
    sim.push('a', 1);
    expect(sim.level('a')).toBeCloseTo(0.5 + PUSH);
    expect(sim.level('b')).toBeCloseTo(0.5 - 2 * PUSH);
    expect(sim.level('c')).toBeCloseTo(0.5 + 2 * PUSH);
  });

  it('▲ sur une variable est durable ; sur une accumulation, c’est un apport ponctuel', () => {
    const sim = new CausalSim(model([['levier'], ['reservoir', stock]], [['levier', 'reservoir', 1, 0.5]]));
    sim.push('levier', 1);
    sim.step(1);
    expect(sim.level('levier')).toBeCloseTo(0.5 + PUSH);
    // L'accumulation monte de force × écart par unité de temps : 0,5 × 0,2 = 0,1.
    expect(sim.level('reservoir')).toBeCloseTo(0.6, 3);
    sim.push('reservoir', -1);
    expect(sim.level('reservoir')).toBeCloseTo(0.4, 3);
  });

  it('le résultat ne dépend pas de la cadence d’affichage', () => {
    const a = new CausalSim(thermostat(2));
    const b = new CausalSim(thermostat(2));
    a.push('temp', 1);
    b.push('temp', 1);
    a.step(7);
    for (let i = 0; i < 7 / 0.016; i++) b.step(0.016);
    b.step(7 - Math.floor(7 / 0.016) * 0.016);
    expect(b.level('temp')).toBeCloseTo(a.level('temp'), 2);
  });

  it('reset remet les niveaux de départ et l’horloge à zéro', () => {
    const sim = new CausalSim(thermostat(2));
    sim.push('temp', 1);
    sim.step(3);
    sim.reset();
    expect(sim.level('temp')).toBe(0.5);
    expect(sim.time).toBe(0);
    sim.step(5);
    expect(sim.level('temp')).toBe(0.5);
  });
});

describe('CausalSim : boucles', () => {
  it('boucle équilibrante sans retard : revient à l’équilibre en douceur, sans le dépasser', () => {
    const sim = new CausalSim(thermostat(0));
    sim.push('temp', 1);
    const path = trace(sim, 'temp', 20);
    expect(Math.min(...path)).toBeGreaterThanOrEqual(0.5);
    // Temps de réaction 1 / G = 2 : après 5 constantes de temps, il ne reste presque rien.
    expect(path.at(-1)).toBeCloseTo(0.5, 3);
  });

  it('retard du même ordre que le temps de réaction : oscillation amortie', () => {
    const sim = new CausalSim(thermostat(2));
    sim.push('temp', 1);
    const path = trace(sim, 'temp', 60);
    expect(Math.min(...path)).toBeLessThan(0.47); // dépasse l'équilibre par en dessous
    expect(Math.abs(path.at(-1)! - 0.5)).toBeLessThan(0.01); // puis se stabilise
  });

  it('retard trop long : l’oscillation grandit', () => {
    const sim = new CausalSim(thermostat(6));
    sim.push('temp', 1);
    const path = trace(sim, 'temp', 60);
    const early = Math.max(...path.slice(0, 30).map((v) => Math.abs(v - 0.5)));
    const late = Math.max(...path.slice(80).map((v) => Math.abs(v - 0.5)));
    expect(late).toBeGreaterThan(early);
  });

  it('boucle renforçante : l’écart double tous les ln 2 / G', () => {
    // Départ bas, pour avoir de la marge avant le plafond.
    const sim = new CausalSim(model([['pop', { kind: 'stock', init: 0.1 }], ['naissances', { init: 0.1 }]], [['pop', 'naissances'], ['naissances', 'pop', 1, 0.5]]));
    sim.push('pop', 1);
    sim.step(Math.LN2 / 0.5);
    expect((sim.level('pop') - 0.1) / PUSH).toBeCloseTo(2, 1);
  });

  it('boucle renforçante qui sature : courbe en S, sans toucher le plafond', () => {
    const sim = new CausalSim(model([['pop', { kind: 'stock', init: 0.1, saturate: true }], ['naissances', { init: 0.1 }]], [['pop', 'naissances'], ['naissances', 'pop']]));
    sim.push('pop', 1);
    const path = trace(sim, 'pop', 12);
    expect(path.at(-1)!).toBeGreaterThan(0.95);
    expect(path.at(-1)!).toBeLessThan(1);
    // Croissance qui accélère, puis ralentit.
    const speeds = path.slice(1).map((v, i) => v - path[i]);
    const peak = speeds.indexOf(Math.max(...speeds));
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThan(speeds.length - 1);
  });

  it('boucle sans accumulation ni retard : reste calculable, sans clignoter', () => {
    const sim = new CausalSim(model([['a'], ['b']], [['a', 'b', -1], ['b', 'a']]));
    sim.push('a', 1);
    const path = trace(sim, 'a', 12 * INSTANT_LOOP_TAU, 0.1);
    // Pas d'aller-retour d'un pas sur l'autre : au plus quelques changements de sens.
    let turns = 0;
    for (let i = 2; i < path.length; i++) if ((path[i] - path[i - 1]) * (path[i - 1] - path[i - 2]) < 0) turns++;
    expect(turns).toBeLessThanOrEqual(4);
    // Point fixe : a = 0,5 + 0,2 + (b − 0,5) et b = 0,5 − (a − 0,5), donc a = 0,6 et b = 0,4.
    expect(sim.level('a')).toBeCloseTo(0.6, 3);
    expect(sim.level('b')).toBeCloseTo(0.4, 3);
  });
});

describe('CausalSim : retards', () => {
  const delayed = (delay: number) => model([['levier'], ['cible']], [['levier', 'cible', 1, 1, delay]]);

  it('l’effet arrive progressivement, en environ `delay` unités de temps (retard d’ordre 3)', () => {
    const sim = new CausalSim(delayed(4));
    sim.push('levier', 1);
    sim.step(0.4);
    expect(sim.level('cible') - 0.5).toBeLessThan(0.01 * PUSH);
    sim.step(3.6);
    // Réponse d'un retard d'ordre 3 à un échelon, au bout du temps de retard : 1 − e⁻³ (1 + 3 + 4,5) ≈ 58 %.
    expect((sim.level('cible') - 0.5) / PUSH).toBeCloseTo(0.58, 1);
    sim.step(12);
    expect(sim.level('cible')).toBeCloseTo(0.5 + PUSH, 2);
  });

  it('un retard très court reste stable (plus court que le pas de calcul)', () => {
    const sim = new CausalSim(thermostat(0.001));
    sim.push('temp', 1);
    sim.step(20);
    expect(sim.level('temp')).toBeCloseTo(0.5, 2);
  });

  it('la valeur transportée le long du lien est interpolée entre les réservoirs', () => {
    const sim = new CausalSim(delayed(4));
    sim.push('levier', 1);
    sim.step(2);
    const along = [0, 0.33, 0.66, 1].map((t) => sim.edgeSignal('levierchibe', t));
    expect(along).toEqual([0, 0, 0, 0]); // lien inconnu
    const values = [0, 0.33, 0.66, 1].map((t) => sim.edgeSignal('leviercible', t));
    expect(values[0]).toBeCloseTo(PUSH);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeLessThan(values[i - 1]);
  });
});

describe('CausalSim : comportements', () => {
  it('retour à l’équilibre d’une accumulation : décroissance exponentielle', () => {
    const sim = new CausalSim(model([['a', { kind: 'stock', relax: 2 }]], []));
    sim.push('a', 1);
    sim.step(2);
    expect(sim.level('a') - 0.5).toBeCloseTo(PUSH * Math.exp(-1), 2);
  });

  it('retour à l’équilibre d’une variable : son réglage ▲ ▼ s’estompe', () => {
    const sim = new CausalSim(model([['a', { relax: 1 }]], []));
    sim.push('a', -1);
    sim.step(3);
    expect(sim.level('a') - 0.5).toBeCloseTo(-PUSH * Math.exp(-3), 2);
  });

  it('bascule : au seuil, bloqué au maximum ; les baisses n’ont plus d’effet', () => {
    const sim = new CausalSim(model([['levier'], ['glace', { kind: 'stock', thresholdMode: 'tip', threshold: 0.7 }], ['aval']], [['levier', 'glace'], ['glace', 'aval']]));
    sim.push('levier', 1);
    sim.step(0.9);
    expect(sim.tipped.has('glace')).toBe(false);
    sim.step(0.2);
    expect(sim.tipped.has('glace')).toBe(true);
    expect(sim.level('glace')).toBe(1);
    expect(sim.level('aval')).toBe(1);
    sim.push('levier', -1);
    sim.push('levier', -1);
    sim.push('glace', -1);
    sim.step(5);
    expect(sim.level('glace')).toBe(1);
    sim.reset();
    expect(sim.tipped.size).toBe(0);
  });

  it('largage : retient tout, puis transmet d’un coup ce qui a été accumulé', () => {
    const sim = new CausalSim(
      model(
        [['plaques'], ['tension', { kind: 'stock', init: 0.1, thresholdMode: 'release', threshold: 0.9 }], ['degats', { kind: 'stock', init: 0 }]],
        [['plaques', 'tension'], ['tension', 'degats', 1, 0.5]],
      ),
    );
    sim.push('plaques', 1); // la tension monte de 0,2 par unité de temps
    sim.step(3.9);
    expect(sim.level('tension')).toBeCloseTo(0.88, 2);
    expect(sim.level('degats')).toBe(0); // rien ne passe tant que ça s'accumule
    sim.step(0.2 + RELEASE_TIME);
    // 0,8 accumulé, force 0,5 : les dégâts reçoivent 0,4 au total ; la tension est retombée.
    expect(sim.level('degats')).toBeCloseTo(0.4, 1);
    expect(sim.level('tension')).toBeLessThan(0.3);
    expect(sim.hits.get('tension')?.event).toBe('release');
  });

  it('historique : une fenêtre glissante de la durée de simulation', () => {
    const doc = thermostat(0); // durée 20
    const sim = new CausalSim(doc);
    expect(sim.historyDt).toBeCloseTo(20 / HISTORY_POINTS);
    sim.push('temp', 1);
    sim.step(sim.historyDt * 10 + DT);
    const h = sim.history.get('temp')!;
    expect(h).toHaveLength(11);
    expect(h[0]).toBe(0.5);
    expect(h[1]).toBeGreaterThan(0.5);
    // Trois fois la durée : on ne garde que la fenêtre des 20 dernières unités, les premiers points sont oubliés.
    sim.step(60);
    const kept = sim.history.get('temp')!;
    expect(kept).toHaveLength(HISTORY_POINTS + 1);
    expect(sim.historyStart).toBeCloseTo(sim.time - 20, 1);
    // Le point i correspond au temps historyStart + i × historyDt : le dernier est le présent.
    expect(sim.historyStart + (kept.length - 1) * sim.historyDt).toBeCloseTo(sim.time, 1);
  });

  it('historique : la fenêtre se règle en cours de route', () => {
    const sim = new CausalSim(thermostat(0));
    sim.step(30);
    sim.setHistoryWindow(5);
    expect(sim.historyStart).toBeCloseTo(sim.time - 5, 1);
    // Agrandie, elle se remplit à nouveau peu à peu (les points oubliés ne reviennent pas).
    sim.setHistoryWindow(40);
    sim.step(30);
    expect(sim.historyStart).toBeCloseTo(25, 1);
    sim.step(20);
    expect(sim.historyStart).toBeCloseTo(sim.time - 40, 1);
  });
});
