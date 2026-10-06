import { describe, expect, it } from 'vitest';
import { radiusAt, type Rosette } from '../rosette/rosette';
import { contactTable, reachAt } from './table';

describe('contact table', () => {
  const sine: Rosette = { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 1.5 } };

  it('a knife edge follows the outline exactly', () => {
    const t = contactTable(sine, { shape: 'round', radius: 0 });
    for (const a of [0, 0.2, 1.7, 4]) expect(reachAt(t, a)).toBeCloseTo(radiusAt(sine, a), 4);
  });

  it('a round rubber on a circle sits one rubber radius out', () => {
    const round: Rosette = { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 0 } };
    const t = contactTable(round, { shape: 'round', radius: 2 });
    for (const a of [0, 1, 2]) expect(reachAt(t, a)).toBeCloseTo(32, 4);
  });

  it('a rubber smaller than the valley reaches the floor', () => {
    const sharp: Rosette = { radius: 30, wave: { kind: 'sine', lobes: 24, amplitude: 1.5 } };
    const valley = Math.PI / 24;
    const t = contactTable(sharp, { shape: 'round', radius: 0.2 });
    expect(reachAt(t, valley) - 0.2 - radiusAt(sharp, valley)).toBeLessThan(1e-3);
  });

  it('a rubber larger than the valley bridges it', () => {
    const sharp: Rosette = { radius: 30, wave: { kind: 'sine', lobes: 24, amplitude: 1.5 } };
    const valley = Math.PI / 24;
    const t = contactTable(sharp, { shape: 'round', radius: 3 });
    expect(reachAt(t, valley) - 3 - radiusAt(sharp, valley)).toBeGreaterThan(0.5);
  });

  it('a flat rubber reaches the peaks either side of a valley', () => {
    const sharp: Rosette = { radius: 30, wave: { kind: 'sine', lobes: 24, amplitude: 1.5 } };
    const t = contactTable(sharp, { shape: 'flat', width: 10 });
    expect(t.min).toBeGreaterThan(radiusAt(sharp, Math.PI / 24) + 1);
  });
});
