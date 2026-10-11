import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../model/examples';
import type { Doc } from '../model/types';
import { CausalSim } from './causal';

const sim = (id: string) => new CausalSim(EXAMPLES.find((e) => e.id === id)!.build());

/** Avance de `duration` et renvoie la trajectoire de `id`, un point par unité de temps. */
function path(s: CausalSim, id: string, duration: number): number[] {
  const out: number[] = [];
  for (let t = 0; t < duration; t++) {
    s.step(1);
    out.push(s.level(id));
  }
  return out;
}

/** Les exemples racontent une histoire : on vérifie que le moteur la raconte bien. */
describe('exemples', () => {
  it('lapins et renards : des cycles d’une dizaine d’années, qui durent', () => {
    const s = sim('proies');
    s.push('lapins', 1);
    const lapins = path(s, 'lapins', 40);
    const peaks = lapins.filter((v, i) => i > 0 && i < lapins.length - 1 && v > lapins[i - 1] && v >= lapins[i + 1]);
    expect(peaks.length).toBeGreaterThanOrEqual(3);
    expect(Math.min(...lapins.slice(30))).toBeLessThan(0.45);
    expect(Math.max(...lapins)).toBeLessThan(1);
  });

  it('banquise : bascule si on ne fait rien, irréversible ensuite', () => {
    const s = sim('albedo');
    s.push('co2', 1);
    s.step(30);
    expect(s.tipped.has('fonte')).toBe(true);
    s.push('co2', -1);
    s.push('co2', -1);
    s.step(40);
    expect(s.level('temp')).toBeGreaterThan(0.6);
  });

  it('banquise : sauvée si on ramène le CO₂ à temps', () => {
    const s = sim('albedo');
    s.push('co2', 1);
    s.step(10);
    s.push('co2', -1);
    s.step(30);
    const before = s.level('temp');
    s.step(30);
    expect(s.tipped.has('fonte')).toBe(false);
    // Elle redescend… lentement : près d'un point de bascule, le retour est long (« ralentissement critique »).
    expect(s.level('temp')).toBeLessThan(before);
    expect(s.level('temp')).toBeLessThan(0.62);
  });

  it('panique bancaire : la banque se vide, même quand la rumeur s’éteint', () => {
    const s = sim('banque');
    s.push('rumeurs', 1);
    s.step(8);
    expect(s.level('rumeurs')).toBeCloseTo(0.5, 2);
    expect(s.level('reserves')).toBeLessThan(0.05);
  });

  it('thermostat : dépasse un peu, puis se stabilise', () => {
    const s = sim('thermostat');
    s.push('temp', 1);
    const temp = path(s, 'temp', 40);
    expect(Math.min(...temp)).toBeLessThan(0.5);
    expect(temp.at(-1)).toBeCloseTo(0.5, 2);
  });

  it('séisme : la tension s’accumule et se libère régulièrement', () => {
    const s = sim('seisme');
    s.push('plaques', 1);
    let quakes = 0;
    for (let t = 0; t < 14; t += 0.1) {
      s.step(0.1);
      const hit = s.hits.get('tension');
      if (hit?.event === 'release' && hit.age < 0.1 - 1e-9) quakes++;
    }
    expect(quakes).toBe(3);
    expect(s.level('degats')).toBeGreaterThan(0.3);
  });
});

/** Joue des actions [temps, nœud, ±1] et renvoie la trajectoire des nœuds suivis, un point par `dt`. */
function play(id: string, actions: [number, string, 1 | -1][], ids: string[], dt = 1, tweak?: (d: Doc) => void) {
  const doc = EXAMPLES.find((e) => e.id === id)!.build();
  tweak?.(doc);
  const s = new CausalSim(doc);
  const queue = [...actions];
  const out: Record<string, number[]> = Object.fromEntries(ids.map((i) => [i, []]));
  for (let t = 0; t <= doc.horizon + 1e-9; t += dt) {
    while (queue.length && queue[0][0] <= t + 1e-9) {
      const [, node, delta] = queue.shift()!;
      s.push(node, delta);
    }
    for (const i of ids) out[i].push(s.level(i));
    s.step(dt);
  }
  return out;
}
const argmax = (v: number[]) => v.indexOf(Math.max(...v));
const argmin = (v: number[]) => v.indexOf(Math.min(...v));
const weight = (from: string, to: string, w: number) => (d: Doc) => {
  d.edges.find((e) => e.from === from && e.to === to)!.weight = w;
};

describe('exemples : premiers pas', () => {
  it('régulateur de vitesse : la côte ne fait perdre qu’un peu de vitesse, la consigne est suivie', () => {
    const { vitesse } = play('regulateur', [[0, 'cote', 1], [15, 'consigne', 1]], ['vitesse']);
    expect(vitesse[14]).toBeGreaterThan(0.42);
    expect(vitesse[14]).toBeLessThan(0.5);
    expect(vitesse[30]).toBeCloseTo(vitesse[14] + 0.2, 1);
  });

  it('dette : double en 7 ans environ ; rembourser tôt la fait fondre, tard non', () => {
    const seule = play('dette', [[0, 'dette', 1]], ['dette']).dette;
    expect(seule[7] - 0.2).toBeGreaterThan(0.38);
    expect(play('dette', [[0, 'dette', 1], [5, 'remboursements', 1]], ['dette']).dette[30]).toBeLessThan(0.2);
    expect(play('dette', [[0, 'dette', 1], [15, 'remboursements', 1]], ['dette']).dette[30]).toBeGreaterThan(0.95);
  });

  it('innovation : une courbe en S', () => {
    const u = play('innovation', [[0, 'pub', 1]], ['utilisateurs']).utilisateurs;
    expect(u[15]).toBeGreaterThan(0.9);
    const speed = u.slice(1).map((v, i) => v - u[i]);
    const peak = argmax(speed);
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(12);
  });

  it('course aux armements : l’escalade, que la diplomatie peut arrêter si elle vient tôt', () => {
    const seule = play('armement', [[0, 'armesA', 1]], ['armesA', 'armesB']);
    expect(seule.armesB[30]).toBeGreaterThan(0.6);
    expect(seule.armesA[30]).toBeGreaterThan(seule.armesA[15]);
    expect(play('armement', [[0, 'armesA', 1], [2, 'diplomatie', 1]], ['armesA']).armesA[30]).toBeLessThan(0.3);
  });
});

describe('exemples : plusieurs boucles', () => {
  it('steak : la plaque dépasse un peu, et le cœur continue de cuire une fois la plaque éteinte', () => {
    const { plaque, steak } = play('steak', [[0, 'bouton', 1], [10, 'bouton', -1]], ['plaque', 'steak'], 0.5);
    expect(Math.max(...plaque.slice(0, 20))).toBeGreaterThan(plaque[19] + 0.01);
    expect(argmax(steak) * 0.5).toBeGreaterThan(12);
    expect(Math.max(...steak) - steak[20]).toBeGreaterThan(0.08);
  });

  it('magasin : le stock oscille à cause du délai de livraison, puis revient', () => {
    const { stock } = play('magasin', [[0, 'ventes', 1]], ['stock']);
    expect(Math.min(...stock.slice(0, 8))).toBeLessThan(0.35);
    expect(Math.max(...stock.slice(5, 15))).toBeGreaterThan(0.55);
    expect(stock[40]).toBeCloseTo(0.5, 1);
  });

  it('forêt : des incendies à répétition, que le débroussaillage évite', () => {
    const fires = (actions: [number, string, 1 | -1][]) => {
      const doc = EXAMPLES.find((e) => e.id === 'foret')!.build();
      const s = new CausalSim(doc);
      for (const [, n, d] of actions) s.push(n, d);
      let count = 0;
      for (let t = 0; t < doc.horizon; t += 0.1) {
        s.step(0.1);
        const hit = s.hits.get('boisMort');
        if (hit?.event === 'release' && hit.age < 0.1 - 1e-9) count++;
      }
      return count;
    };
    expect(fires([[0, 'secheresse', 1]])).toBeGreaterThanOrEqual(3);
    expect(fires([[0, 'secheresse', 1], [0, 'debroussaillage', 1]])).toBe(0);
  });

  it('antidouleurs : la blessure guérit moins vite quand ils freinent la rééducation', () => {
    const avec = play('antidouleurs', [[0, 'blessure', 1]], ['blessure']).blessure;
    const sans = play('antidouleurs', [[0, 'blessure', 1]], ['blessure'], 1, weight('antidouleurs', 'reeducation', 0.01)).blessure;
    expect(avec[10]).toBeGreaterThan(sans[10] + 0.02);
  });

  it('pêche : la flotte dépasse ce que la mer peut nourrir, puis recule', () => {
    const { bateaux, poissons } = play('peche', [[0, 'demande', 1]], ['bateaux', 'poissons']);
    const peak = argmax(bateaux);
    expect(bateaux[peak]).toBeGreaterThan(0.9);
    expect(Math.min(...bateaux.slice(peak))).toBeLessThan(bateaux[peak] - 0.15);
    expect(Math.min(...poissons)).toBeLessThan(0.5);
  });

  it('épidémie : une cloche, que les gestes barrières aplatissent', () => {
    const libre = play('epidemie', [[0, 'malades', 1]], ['malades', 'sains']);
    const gestes = play('epidemie', [[0, 'malades', 1], [0, 'gestes', 1]], ['malades', 'sains']);
    expect(Math.max(...libre.malades)).toBeGreaterThan(0.3);
    expect(argmax(libre.malades)).toBeGreaterThanOrEqual(4);
    expect(libre.malades[60]).toBeLessThan(0.03);
    expect(Math.max(...gestes.malades)).toBeLessThan(Math.max(...libre.malades) - 0.1);
    expect(gestes.sains[60]).toBeGreaterThan(libre.sains[60] + 0.2);
  });
});

describe('exemples : systèmes complexes', () => {
  it('limites à la croissance : dépassement, puis déclin', () => {
    const { population } = play('limites', [[0, 'population', 1]], ['population'], 2);
    const peak = argmax(population);
    expect(population[peak]).toBeGreaterThan(0.65);
    expect(peak * 2).toBeGreaterThan(30);
    expect(peak * 2).toBeLessThan(120);
    expect(population.at(-1)!).toBeLessThan(0.35);
  });

  it('BCE : le taux monte après l’inflation, l’activité touche le fond bien plus tard', () => {
    const { inflation, taux, activite } = play('bce', [[0, 'choc', 1]], ['inflation', 'taux', 'activite']);
    expect(Math.max(...taux)).toBeGreaterThan(0.6);
    expect(Math.min(...activite)).toBeLessThan(0.35);
    expect(argmin(activite) - argmax(taux)).toBeGreaterThanOrEqual(12);
    expect(inflation[48]).toBeLessThan(Math.max(...inflation) - 0.05);
  });

  it('spirale prix-salaires : un cran avec une indexation faible, l’emballement avec une indexation forte', () => {
    const faible = play('salaires', [[0, 'petrole', 1]], ['prix']).prix;
    expect(faible[48]).toBeLessThan(0.75);
    expect(faible[48] - faible[36]).toBeLessThan(0.02);
    const forte = play('salaires', [[0, 'petrole', 1]], ['prix'], 1, weight('prix', 'salaires', 1)).prix;
    expect(forte[48]).toBeGreaterThan(0.95);
  });

  it('cycle du pétrole : le prix monte, s’effondre sous son départ, puis remonte', () => {
    const { prix } = play('petrole', [[0, 'demande', 1]], ['prix']);
    const low = argmin(prix);
    expect(prix[low]).toBeLessThan(0.45);
    expect(Math.max(...prix.slice(low))).toBeGreaterThan(0.55);
  });

  it('boucle souverains-banques : le cercle vicieux, que « whatever it takes » inverse', () => {
    const seule = play('doomloop', [[0, 'grece', 1]], ['spread', 'banques']);
    expect(seule.spread[18]).toBeGreaterThan(0.95);
    expect(seule.banques[18]).toBeLessThan(0.1);
    const bce = play('doomloop', [[0, 'grece', 1], [12, 'bce', 1]], ['spread', 'banques']);
    expect(bce.spread[24]).toBeLessThan(0.3);
    expect(bce.banques[36]).toBeGreaterThan(0.5);
  });

  it('dette publique : la charge monte progressivement, puis la boule de neige ; la croissance compense', () => {
    const { charge, dette } = play('dettePublique', [[0, 'taux', 1]], ['charge', 'dette']);
    expect(charge[2] - 0.5).toBeLessThan((charge[15] - 0.5) / 3);
    expect(dette[30]).toBeGreaterThan(0.9);
    expect(play('dettePublique', [[0, 'taux', 1], [0, 'croissance', 1]], ['dette']).dette[30]).toBeLessThan(0.6);
  });

  it('mutuelle : cycle de souscription contenu ; l’antisélection déclenche la spirale ; la prévention allège les cotisations', () => {
    const ids = ['cotisation', 'rentabilite', 'reserves', 'societaires', 'risque'];
    const { cotisation, rentabilite, reserves, societaires } = play('mutuelle', [[0, 'sinistralite', 1]], ids);
    expect(rentabilite[0]).toBeLessThan(0.35);
    expect(Math.min(...reserves)).toBeLessThan(0.55);
    const peak = argmax(cotisation);
    expect(cotisation[peak]).toBeGreaterThan(cotisation[20] + 0.05);
    expect(Math.min(...cotisation.slice(peak))).toBeLessThan(cotisation[20] - 0.02);
    expect(rentabilite[20]).toBeCloseTo(0.5, 1);
    expect(societaires[20]).toBeGreaterThan(0.42);
    const spirale = play('mutuelle', [[0, 'sinistralite', 1]], ids, 1, weight('ecart', 'risque', 0.5));
    expect(spirale.societaires[20]).toBeLessThan(0.15);
    expect(spirale.risque[20]).toBeGreaterThan(0.9);
    expect(spirale.reserves[20]).toBeLessThan(0.35);
    const prevention = play('mutuelle', [[0, 'sinistralite', 1], [0, 'prevention', 1]], ['cotisation']).cotisation;
    expect(prevention[20]).toBeLessThan(cotisation[20] - 0.08);
  });

  it('immobilier : les ventes chutent tout de suite, les prix lentement, puis repartent', () => {
    const { ventes, prix } = play('immobilier', [[0, 'taux', 1]], ['ventes', 'prix'], 0.5);
    expect(ventes[0]).toBeLessThan(0.35);
    expect(prix[2]).toBeGreaterThan(0.42);
    const low = argmin(prix);
    expect(prix[low]).toBeLessThan(0.4);
    expect(prix.at(-1)!).toBeGreaterThan(prix[low] + 0.1);
  });

  it('gaz : le prix explose puis redescend ; l’industrie met bien plus longtemps à revenir', () => {
    const { prixGaz, industrie } = play('gaz', [[0, 'coupure', 1]], ['prixGaz', 'industrie']);
    expect(prixGaz[0]).toBeGreaterThan(0.75);
    expect(prixGaz[24]).toBeLessThan(0.62);
    expect(Math.min(...industrie)).toBeLessThan(0.42);
    expect(industrie[36]).toBeLessThan(0.45);
  });
});

describe('exemples : deuxième série', () => {
  it('effet Larsen : le son résonne sans s’emballer ; trop de volume, et il siffle', () => {
    const { son } = play('larsen', [[0, 'voix', 1]], ['son']);
    expect(son[20]).toBeGreaterThan(0.6);
    expect(son[20]).toBeLessThan(0.75);
    expect(play('larsen', [[0, 'voix', 1]], ['son'], 1, weight('ampli', 'son', 1.4)).son[15]).toBeGreaterThan(0.99);
  });

  it('cycle du porc : le prix oscille plusieurs fois', () => {
    const { prix } = play('porc', [[0, 'demande', 1]], ['prix'], 0.25);
    const turns = prix.filter((v, i) => i > 0 && i < prix.length - 1 && (v - prix[i - 1]) * (prix[i + 1] - v) < 0);
    expect(turns.length).toBeGreaterThanOrEqual(4);
    expect(Math.min(...prix)).toBeLessThan(0.42);
  });

  it('trafic induit : les bouchons reviennent à leur niveau de départ, avec plus de voitures', () => {
    const { bouchons, voitures } = play('trafic', [[0, 'routes', 1]], ['bouchons', 'voitures']);
    expect(bouchons[0]).toBeLessThan(0.35);
    expect(bouchons[15]).toBeCloseTo(0.5, 1);
    expect(voitures[15]).toBeGreaterThan(0.65);
  });

  it('rumeur : une flambée, puis la lassitude', () => {
    const { partages } = play('rumeur', [[0, 'buzz', 1]], ['partages'], 0.5);
    const peak = argmax(partages);
    expect(partages[peak]).toBeGreaterThan(0.8);
    expect(peak / 2).toBeLessThan(6);
    expect(partages.at(-1)!).toBeLessThan(0.05);
  });

  it('cycle de l’eau : plus chaud, plus de pluie ; l’eau se conserve', () => {
    const r = play('eau', [[0, 'temperature', 1]], ['ocean', 'vapeur', 'sols', 'pluie']);
    expect(r.pluie[24]).toBeGreaterThan(0.53);
    const total = (i: number) => r.ocean[i] + r.vapeur[i] + r.sols[i];
    expect(total(24)).toBeCloseTo(total(0), 2);
  });

  it('casseroles : un délai de livraison long fait osciller le stock d’acier', () => {
    const delay = (days: number) => (d: Doc) => {
      d.edges.find((e) => e.from === 'reassort' && e.to === 'acier')!.delay = days;
    };
    const court = play('casseroles', [[0, 'commandes', 1]], ['acier'], 1, delay(1)).acier;
    const long = play('casseroles', [[0, 'commandes', 1]], ['acier'], 1, delay(6)).acier;
    expect(Math.min(...long)).toBeLessThan(Math.min(...court) - 0.1);
  });

  it('filière bois : la forêt recule pendant des décennies, puis se reconstitue', () => {
    const { foret } = play('bois', [[0, 'demande', 1]], ['foret']);
    const low = argmin(foret);
    expect(low).toBeGreaterThan(30);
    expect(foret[low]).toBeLessThan(0.4);
    expect(foret[100]).toBeGreaterThan(foret[low] + 0.08);
  });

  it('lac : bascule si on ne fait rien, irréversible ensuite ; sauvé si on réduit tôt', () => {
    const seul = play('lac', [[0, 'engrais', 1]], ['anoxie', 'poissons']);
    expect(seul.anoxie[30]).toBe(1);
    expect(seul.poissons[30]).toBeLessThan(0.05);
    const tot = play('lac', [[0, 'engrais', 1], [3, 'engrais', -1]], ['anoxie', 'poissons']);
    expect(tot.anoxie[30]).toBeLessThan(0.4);
    expect(tot.poissons[30]).toBeGreaterThan(0.5);
    const tard = play('lac', [[0, 'engrais', 1], [20, 'engrais', -1], [20, 'engrais', -1]], ['anoxie', 'nutriments']);
    expect(tard.anoxie[30]).toBe(1);
    expect(tard.nutriments[30]).toBeGreaterThan(0.5);
  });

  it('sols : la fuite en avant épuise le sol ; la jachère le préserve', () => {
    expect(play('sols', [[0, 'besoins', 1]], ['fertilite']).fertilite[30]).toBeLessThan(0.05);
    expect(play('sols', [[0, 'besoins', 1], [0, 'jachere', 1]], ['fertilite']).fertilite[30]).toBeGreaterThan(0.5);
  });

  it('ville : la croissance suit les constructions, les loyers restent plus hauts', () => {
    const { habitants, loyers } = play('ville', [[0, 'emplois', 1]], ['habitants', 'loyers']);
    expect(habitants[20]).toBeGreaterThan(0.8);
    expect(habitants[20]).toBeLessThan(1);
    expect(loyers[20]).toBeGreaterThan(0.55);
  });

  it('anxiété : l’évitement soulage puis entretient la peur ; l’exposition la fait reculer', () => {
    const { anxiete } = play('anxiete', [[0, 'situation', 1]], ['anxiete']);
    expect(anxiete[1]).toBeLessThan(anxiete[0]);
    expect(anxiete[20]).toBeGreaterThan(0.85);
    expect(play('anxiete', [[0, 'situation', 1], [0, 'exposition', 1]], ['peur']).peur[20]).toBeLessThan(0.1);
  });

  it('épuisement : les heures sup soulagent, puis plafonnent et le retard explose ; baisser la charge tôt l’évite', () => {
    const { retard, heures } = play('epuisement', [[0, 'charge', 1]], ['retard', 'heures']);
    expect(Math.min(...retard.slice(4, 15))).toBeLessThan(0.33);
    expect(heures[22]).toBeGreaterThan(0.99);
    expect(retard[30]).toBeGreaterThan(0.7);
    const tot = play('epuisement', [[0, 'charge', 1], [5, 'charge', -1]], ['retard', 'heures']);
    expect(tot.retard[30]).toBeLessThan(0.4);
    expect(tot.heures[30]).toBeLessThan(0.7);
  });

  it('tulipes : la bulle monte, puis éclate sous son prix de départ', () => {
    const { prix } = play('tulipes', [[0, 'engouement', 1], [8, 'inquietude', 1]], ['prix']);
    expect(prix[8]).toBeGreaterThan(0.6);
    expect(prix[16]).toBeLessThan(0.1);
  });

  it('cartes graphiques : la pénurie dure deux ans, puis le surplus', () => {
    const { stock, prix } = play('puces', [[0, 'demande', 1]], ['stock', 'prix']);
    expect(stock[15]).toBeLessThan(0.02);
    expect(prix[15]).toBeGreaterThan(0.98);
    expect(stock[45]).toBeGreaterThan(0.95);
    expect(prix[45]).toBeLessThan(0.3);
  });

  it('voitures : la production s’arrête net, les concessions mettent plus longtemps à revenir', () => {
    const { production, concessions } = play('voitures', [[0, 'livraisons', -1]], ['production', 'concessions'], 0.5);
    expect(production[1]).toBeLessThan(0.35);
    expect(argmin(concessions)).toBeGreaterThan(argmin(production) + 2);
  });

  it('turnover : la spirale des départs ; de meilleures conditions l’évitent', () => {
    expect(play('turnover', [[0, 'activite', 1]], ['effectif']).effectif[36]).toBeLessThan(0.2);
    const bien = play('turnover', [[0, 'activite', 1], [1, 'conditions', 1]], ['effectif', 'reputation']);
    expect(bien.effectif[36]).toBeGreaterThan(0.6);
    expect(bien.reputation[36]).toBeGreaterThan(0.6);
  });

  it('guerre commerciale : l’escalade, que la négociation arrête si elle vient tôt', () => {
    expect(play('commerce', [[0, 'tarifsA', 1]], ['tarifsB']).tarifsB[30]).toBeGreaterThan(0.95);
    expect(play('commerce', [[0, 'tarifsA', 1], [3, 'negociation', 1]], ['tarifsB']).tarifsB[30]).toBeLessThan(0.1);
    expect(play('commerce', [[0, 'tarifsA', 1], [15, 'negociation', 1]], ['tarifsB']).tarifsB[36]).toBeGreaterThan(0.95);
  });

  it('dévaluation : la balance commerciale empire d’abord, puis dépasse son départ (courbe en J)', () => {
    const { balance } = play('change', [[0, 'devaluation', 1]], ['balance']);
    const low = argmin(balance);
    expect(balance[low]).toBeLessThan(0.35);
    expect(Math.max(...balance.slice(low))).toBeGreaterThan(0.7);
  });

  it('multiplicateur : environ ×5, moins quand on épargne', () => {
    const base = play('keynes', [[0, 'depenses', 1]], ['revenus']).revenus;
    expect(base[30]).toBeGreaterThan(0.67);
    const epargne = play('keynes', [[0, 'depenses', 1], [0, 'epargne', 1]], ['revenus']).revenus;
    expect(epargne[30] - 0.5).toBeLessThan((base[30] - 0.5) * 0.6);
  });

  it('1929 : bulle, krach, panique bancaire et dépression ; le New Deal amorce la reprise', () => {
    const krach: [number, string, 1 | -1][] = [[0, 'confiance', 1], [3, 'confiance', -1], [3.5, 'confiance', -1]];
    const seul = play('crise1929', krach, ['bourse', 'panique', 'chomage', 'prix'], 0.5);
    expect(seul.bourse[6]).toBeGreaterThan(0.9);
    expect(seul.panique[24]).toBe(1);
    expect(seul.chomage[20]).toBeGreaterThan(0.95);
    expect(seul.prix[24]).toBeLessThan(0.35);
    const relance = play('crise1929', [...krach, [7, 'relance', 1]], ['chomage'], 0.5).chomage;
    expect(relance[24]).toBeLessThan(0.45);
  });

  it('2008 et crise de l’euro : banques, puis dette et taux ; sans la BCE la déflation, avec elle la reprise', () => {
    const krach: [number, string, 1 | -1][] = [[0, 'prets', -1], [0.5, 'prets', -1]];
    const ids = ['defauts', 'banques', 'dette', 'spread', 'activite', 'inflation'];
    const sans = play('crise2008', krach, ids, 0.5);
    expect(Math.max(...sans.defauts.slice(0, 8))).toBeGreaterThan(0.45);
    expect(Math.min(...sans.banques.slice(0, 8))).toBeLessThan(0.32);
    expect(sans.spread[20]).toBeGreaterThan(0.6);
    expect(sans.activite[20]).toBeLessThan(0.15);
    expect(sans.inflation[20]).toBeLessThan(0.2);
    const avec = play('crise2008', [...krach, [5, 'bce', 1]], ids, 0.5);
    expect(avec.dette[10]).toBeGreaterThan(0.6);
    expect(avec.spread[10]).toBeGreaterThan(0.4);
    expect(avec.spread[16]).toBeLessThan(0.2);
    expect(avec.activite[20]).toBeGreaterThan(0.4);
    expect(avec.inflation[20]).toBeGreaterThan(0.45);
  });

  it('bulle de l’IA : envolée puis éclatement quand les coûts dépassent les revenus ; des usages forts l’évitent', () => {
    const ids = ['valorisations', 'rentabilite', 'usages'];
    const base = play('bulleIA', [[0, 'engouement', 1]], ids, 0.5);
    const peak = argmax(base.valorisations);
    expect(base.valorisations[peak]).toBeGreaterThan(0.65);
    expect(peak / 2).toBeLessThan(5);
    expect(Math.min(...base.valorisations.slice(peak))).toBeLessThan(0.25);
    expect(Math.min(...base.rentabilite)).toBeLessThan(0.25);
    expect(base.valorisations[20]).toBeGreaterThan(0.5);
    const forts = play('bulleIA', [[0, 'engouement', 1]], ['valorisations'], 0.5, weight('datacenters', 'usages', 0.8)).valorisations;
    expect(Math.min(...forts.slice(argmax(forts.slice(0, 10))))).toBeGreaterThan(0.6);
  });

  it('réacteur : stable grâce à l’effet Doppler, même quand le refroidissement faiblit ; fusion avec un coefficient de vide fort', () => {
    const { fissions, temperature } = play('reacteur', [[0, 'barres', -1], [60, 'refroidissement', -1]], ['fissions', 'temperature']);
    expect(fissions[50]).toBeGreaterThan(0.65);
    expect(fissions[120]).toBeLessThan(0.45);
    expect(Math.max(...temperature)).toBeLessThan(0.88);
    const vide = play('reacteur', [[0, 'barres', -1]], ['temperature'], 1, weight('vapeur', 'fissions', 1)).temperature;
    expect(vide[120]).toBe(1);
  });
});
