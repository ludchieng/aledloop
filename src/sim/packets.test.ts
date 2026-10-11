import { describe, expect, it } from 'vitest';
import { PACKET_STEP, PacketTracker } from './packets';

describe('PacketTracker', () => {
  it('un changement brusque fait partir une perle, qui arrive puis disparaît', () => {
    const tr = new PacketTracker();
    tr.update('e', 0, 0.1);
    tr.update('e', 0.2, 0.1);
    expect(tr.get('e')).toEqual([{ t: 0, value: 0.2 }]);
    for (let i = 0; i < 9; i++) tr.update('e', 0.2, 0.1);
    expect(tr.get('e')[0].t).toBeCloseTo(0.9);
    tr.update('e', 0.2, 0.1);
    expect(tr.get('e')).toEqual([]);
  });

  it('un écart qui reste le même ne fait rien circuler', () => {
    const tr = new PacketTracker();
    for (let i = 0; i < 20; i++) tr.update('e', 0.3, 0.1);
    expect(tr.get('e')).toEqual([]);
  });

  it('un changement lent fait partir une perle à chaque cran', () => {
    const tr = new PacketTracker();
    let emitted = 0;
    for (let i = 0; i <= 100; i++) {
      tr.update('e', -i * 0.002, 0.001);
      emitted = tr.get('e').length;
    }
    // −0,2 en tout, par crans de 0,05 : 4 perles, toutes vers le bas.
    expect(emitted).toBe(Math.round(0.2 / PACKET_STEP));
    expect(tr.get('e').every((p) => p.value < 0)).toBe(true);
  });

  it('une perle arrivée laisse une empreinte qui s’efface', () => {
    const tr = new PacketTracker();
    tr.update('e', 0, 0.5);
    tr.update('e', -0.2, 0.5);
    expect(tr.imprint('e')).toBeNull();
    tr.update('e', -0.2, 0.5);
    tr.update('e', -0.2, 0.5); // arrivée
    expect(tr.imprint('e')).toMatchObject({ value: -0.2, strength: 1 });
    tr.tick(1.2);
    expect(tr.imprint('e')!.strength).toBeGreaterThan(0);
    expect(tr.imprint('e')!.strength).toBeLessThan(1);
    tr.tick(1);
    expect(tr.imprint('e')).toBeNull();
  });

  it('clear oublie tout, sans perle parasite au redémarrage', () => {
    const tr = new PacketTracker();
    tr.update('e', 0, 0.1);
    tr.update('e', 0.2, 0.1);
    tr.clear();
    tr.update('e', 0.5, 0.1);
    expect(tr.get('e')).toEqual([]);
  });
});
