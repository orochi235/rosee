import { describe, expect, it } from 'vitest';
import { displacement, radiusAt, type Rosette, type Wave } from './rosette';

describe('rosette', () => {
  const sine: Rosette = { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 1.5 } };

  it('is radius + amplitude at a peak and radius - amplitude at a valley', () => {
    expect(radiusAt(sine, 0)).toBeCloseTo(31.5, 9);
    expect(radiusAt(sine, Math.PI / 12)).toBeCloseTo(28.5, 9);
  });

  it('repeats once per lobe', () => {
    for (const a of [0.1, 0.7, 2.2]) expect(radiusAt(sine, a)).toBeCloseTo(radiusAt(sine, a + (2 * Math.PI) / 12), 9);
  });

  it('compound sums its waves', () => {
    const a: Wave = { kind: 'sine', lobes: 12, amplitude: 1 };
    const b: Wave = { kind: 'petal', lobes: 3, amplitude: 0.5, sharpness: 2 };
    const c: Wave = { kind: 'compound', waves: [a, b] };
    for (const t of [0, 0.4, 1.9]) expect(displacement(c, t)).toBeCloseTo(displacement(a, t) + displacement(b, t), 12);
  });

  it('a zero-amplitude wave is a circle', () => {
    const round: Rosette = { radius: 25, wave: { kind: 'sine', lobes: 7, amplitude: 0 } };
    for (const t of [0, 1, 2, 3]) expect(radiusAt(round, t)).toBe(25);
  });

  it('a drawn wave reads its control points', () => {
    const w: Wave = { kind: 'drawn', lobes: 4, amplitude: 2, points: [{ u: 0, p: 1 }, { u: 0.5, p: -1 }] };
    expect(displacement(w, 0)).toBeCloseTo(2, 12);
    expect(displacement(w, Math.PI / 4)).toBeCloseTo(-2, 12);
  });
});
