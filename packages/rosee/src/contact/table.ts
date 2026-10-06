import { TAU, turnFraction } from '../angle';
import { radiusAt, type Rosette } from '../rosette/rosette';

/** The rubber's profile in the rosette's plane. A round rubber of radius 0 is
 *  a knife edge. A flat rubber is a face square to its line of approach. */
export type Rubber = { shape: 'round'; radius: number } | { shape: 'flat'; width: number };

/** How far from the rosette's center the rubber's reference point sits when
 *  touching, for each direction around the rosette. The reference point is
 *  the center of a round rubber and the face of a flat one. Directions are
 *  rosette-local, `samples` evenly spaced from 0. */
export interface ContactTable {
  reach: Float64Array;
  mean: number;
  min: number;
  max: number;
}

export const CONTACT_SAMPLES = 4096;

/** Builds the table by testing every outline point near each direction: a
 *  round rubber centered on the ray touches outline point p at distance
 *  p∥ + √(ρ² − p⊥²), and the rubber stops at the farthest such point. That
 *  is what makes a big rubber bridge a narrow valley. */
export function contactTable(rosette: Rosette, rubber: Rubber, samples = CONTACT_SAMPLES): ContactTable {
  const reach = new Float64Array(samples);
  const half = rubber.shape === 'round' ? rubber.radius : rubber.width / 2;
  if (half === 0) {
    for (let k = 0; k < samples; k++) reach[k] = radiusAt(rosette, (k / samples) * TAU);
  } else {
    const xs = new Float64Array(samples);
    const ys = new Float64Array(samples);
    let rmin = Infinity;
    for (let i = 0; i < samples; i++) {
      const a = (i / samples) * TAU;
      const r = radiusAt(rosette, a);
      rmin = Math.min(rmin, r);
      xs[i] = r * Math.cos(a);
      ys[i] = r * Math.sin(a);
    }
    const window = half >= rmin ? samples / 2 : Math.ceil((Math.asin(half / rmin) / TAU) * samples) + 2;
    for (let k = 0; k < samples; k++) {
      const a = (k / samples) * TAU;
      const c = Math.cos(a);
      const s = Math.sin(a);
      let best = -Infinity;
      for (let j = k - window; j <= k + window; j++) {
        const i = ((j % samples) + samples) % samples;
        const along = xs[i] * c + ys[i] * s;
        const across = ys[i] * c - xs[i] * s;
        if (Math.abs(across) > half) continue;
        const d = rubber.shape === 'round' ? along + Math.sqrt(half * half - across * across) : along;
        if (d > best) best = d;
      }
      reach[k] = best;
    }
  }
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const d of reach) {
    sum += d;
    min = Math.min(min, d);
    max = Math.max(max, d);
  }
  return { reach, mean: sum / samples, min, max };
}

/** Reach at rosette-local angle `a` (radians), linearly interpolated. */
export function reachAt(t: ContactTable, a: number): number {
  const n = t.reach.length;
  const x = turnFraction(a) * n;
  const i = Math.floor(x);
  const f = x - i;
  return t.reach[i % n] * (1 - f) + t.reach[(i + 1) % n] * f;
}
