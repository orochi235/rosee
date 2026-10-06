import { describe, expect, it } from 'vitest';
import { TAU } from '../angle';
import { radiusAt, type Rosette } from '../rosette/rosette';
import { CONTACT_SAMPLES, contactTable, reachAt } from './table';

/** Reach against the outline sampled 64× denser than the table, then
 *  resampled 1024× finer around each near-best local maximum: a plain dense
 *  vertex scan under-reads steep walls by several µm. `half` is a round
 *  rubber's radius or half a flat one. */
function denseReach(ros: Rosette, shape: 'round' | 'flat', half: number, a: number): number {
  const dense = CONTACT_SAMPLES * 64;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const at = (t: number): number => {
    const r = radiusAt(ros, t);
    const along = r * Math.cos(t) * c + r * Math.sin(t) * s;
    const across = r * Math.sin(t) * c - r * Math.cos(t) * s;
    if (Math.abs(across) > half) return -Infinity;
    return shape === 'round' ? along + Math.sqrt(half * half - across * across) : along;
  };
  const window = Math.ceil((Math.asin(Math.min(1, half / 26)) / TAU) * dense) + 4;
  const k0 = Math.round((a / TAU) * dense);
  const vals: number[] = [];
  for (let j = k0 - window; j <= k0 + window; j++) vals.push(at((j / dense) * TAU));
  const coarse = Math.max(...vals);
  let best = coarse;
  vals.forEach((v, i) => {
    if (v < coarse - 1e-2 || vals[i - 1] > v || vals[i + 1] > v) return;
    const j = k0 - window + i;
    for (let q = -2048; q <= 2048; q++) best = Math.max(best, at(((j + q / 1024) / dense) * TAU));
  });
  return best;
}

/** Worst error over the table's own directions across the first lobe. */
function worstError(ros: Rosette, shape: 'round' | 'flat', half: number, lobes: number): number {
  const t = contactTable(ros, shape === 'round' ? { shape, radius: half } : { shape, width: 2 * half });
  const span = Math.ceil(CONTACT_SAMPLES / lobes);
  let worst = 0;
  for (let k = 0; k <= span; k++) {
    const a = (k / CONTACT_SAMPLES) * TAU;
    worst = Math.max(worst, Math.abs(t.reach[k] - denseReach(ros, shape, half, a)));
  }
  return worst;
}

describe('contact table', () => {
  const sine: Rosette = { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 1.5 } };
  const sharp: Rosette = { radius: 30, wave: { kind: 'sine', lobes: 24, amplitude: 1.5 } };
  const petal: Rosette = { radius: 30, wave: { kind: 'petal', lobes: 24, amplitude: 3, sharpness: 6 } };

  it('a knife edge follows the outline exactly', () => {
    const t = contactTable(sine, { shape: 'round', radius: 0 });
    for (const a of [0, 0.2, 1.7, 4]) expect(reachAt(t, a)).toBeCloseTo(radiusAt(sine, a), 4);
  });

  it('a round rubber on a circle sits one rubber radius out', () => {
    const round: Rosette = { radius: 30, wave: { kind: 'sine', lobes: 12, amplitude: 0 } };
    const t = contactTable(round, { shape: 'round', radius: 2 });
    for (const a of [0, 1, 2, 0.0001]) expect(reachAt(t, a)).toBeCloseTo(32, 9);
  });

  it('a rubber smaller than the valley reaches the floor', () => {
    const valley = Math.PI / 24;
    const t = contactTable(sharp, { shape: 'round', radius: 0.2 });
    expect(reachAt(t, valley) - 0.2).toBeCloseTo(radiusAt(sharp, valley), 3);
  });

  it('a rubber larger than the valley bridges it, touching a neighboring peak', () => {
    const valley = Math.PI / 24;
    const t = contactTable(sharp, { shape: 'round', radius: 3 });
    expect(reachAt(t, valley) - 3 - radiusAt(sharp, valley)).toBeGreaterThan(0.5);
    const k = Math.round((valley / TAU) * CONTACT_SAMPLES);
    const fromPeak = Math.min(Math.abs(t.touch[k]), Math.abs(t.touch[k] - (2 * Math.PI) / 24));
    expect(Math.abs(t.touch[k] - valley)).toBeGreaterThan(Math.PI / 48);
    expect(fromPeak).toBeLessThan(Math.PI / 48);
  });

  it('records a knife edge touching where it points', () => {
    const t = contactTable(sine, { shape: 'round', radius: 0 });
    for (const k of [0, 5, 1000, CONTACT_SAMPLES - 1]) expect(t.touch[k]).toBeCloseTo((k / CONTACT_SAMPLES) * TAU, 12);
  });

  it('matches a dense outline on gentle and steep profiles', () => {
    const flat: Rosette = { radius: 30, wave: { kind: 'flat', lobes: 24, amplitude: 3, flat: 0.9 } };
    for (const rho of [0.05, 1]) {
      expect(worstError(sine, 'round', rho, 12)).toBeLessThan(1e-4);
      expect(worstError(petal, 'round', rho, 24)).toBeLessThan(2e-3);
      expect(worstError(flat, 'round', rho, 24)).toBeLessThan(2e-3);
    }
    expect(worstError(sine, 'flat', 5, 12)).toBeLessThan(2e-3);
  });

  it('a flat rubber rests on the two peaks either side of a valley', () => {
    const t = contactTable(petal, { shape: 'flat', width: 10 });
    for (const k of [80, 85, 90]) {
      const a = (k / CONTACT_SAMPLES) * TAU;
      expect(t.reach[k]).toBeCloseTo(33 * Math.max(Math.cos(a), Math.cos(a - TAU / 24)), 9);
    }
  });

  it('a flat rubber reaches the peaks either side of a valley', () => {
    const t = contactTable(sharp, { shape: 'flat', width: 10 });
    expect(t.min).toBeGreaterThan(radiusAt(sharp, Math.PI / 24) + 1);
  });
});
