import { TAU } from '../../angle';
import type { Vec2 } from '../../machine/pose';
import type { ProfilePoint } from '../profile';
import type { Rosette } from '../rosette';

/** A closed loop's signed area, positive when it runs anticlockwise. */
export function loopArea(loop: readonly Vec2[]): number {
  let a = 0;
  for (let k = 0; k < loop.length; k++) {
    const [x0, y0] = loop[k];
    const [x1, y1] = loop[(k + 1) % loop.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

/** The loop enclosing the most area: a rosette's outline, rather than its
 *  arbor hole or a mark drawn on it. Throws when there is none. */
export function largestLoop(loops: readonly (readonly Vec2[])[], source: string): Vec2[] {
  let best: readonly Vec2[] | null = null;
  let area = 0;
  for (const loop of loops) {
    const a = Math.abs(loopArea(loop));
    if (loop.length >= 3 && a > area) {
      best = loop;
      area = a;
    }
  }
  if (!best) throw new Error(`${source} has no closed outline in it`);
  return [...best];
}

function centroid(loop: readonly Vec2[]): Vec2 {
  const a = loopArea(loop);
  let cx = 0;
  let cy = 0;
  for (let k = 0; k < loop.length; k++) {
    const [x0, y0] = loop[k];
    const [x1, y1] = loop[(k + 1) % loop.length];
    const c = x0 * y1 - x1 * y0;
    cx += (x0 + x1) * c;
    cy += (y0 + y1) * c;
  }
  return [cx / (6 * a), cy / (6 * a)];
}

/** Directions the outline is sampled in around its center. */
const POLAR = 4096;

/** How far out the outline reaches from `center` in each of POLAR directions:
 *  the farthest crossing, so a wall that folds back on itself reads as the
 *  rubber would feel it. */
function polar(loop: readonly Vec2[], center: Vec2): Float64Array {
  const r = new Float64Array(POLAR).fill(-1);
  const n = loop.length;
  // Each edge only meets the rays between its ends' directions.
  for (let k = 0; k < n; k++) {
    const ax = loop[k][0] - center[0];
    const ay = loop[k][1] - center[1];
    const bx = loop[(k + 1) % n][0] - center[0];
    const by = loop[(k + 1) % n][1] - center[1];
    const a0 = Math.atan2(ay, ax);
    let span = Math.atan2(by, bx) - a0;
    span -= TAU * Math.round(span / TAU);
    const first = Math.ceil((Math.min(a0, a0 + span) / TAU) * POLAR);
    const last = Math.floor((Math.max(a0, a0 + span) / TAU) * POLAR);
    for (let j = first; j <= last; j++) {
      const t = (j / POLAR) * TAU;
      const dx = Math.cos(t);
      const dy = Math.sin(t);
      // The ray center + s·(dx, dy) against the edge a + w·(b − a).
      const ex = bx - ax;
      const ey = by - ay;
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-15) continue;
      const s = (ax * ey - ay * ex) / den;
      const slot = ((j % POLAR) + POLAR) % POLAR;
      if (s > r[slot]) r[slot] = s;
    }
  }
  for (let j = 0; j < POLAR; j++)
    if (r[j] < 0) throw new Error('the outline does not run all the way round its own center, so it cannot be a rosette');
  return r;
}

const at = (d: Float64Array, x: number): number => {
  const n = d.length;
  const i = Math.floor(x);
  const f = x - i;
  return d[((i % n) + n) % n] * (1 - f) + d[(((i + 1) % n) + n) % n] * f;
};

/** `d` folded into `lobes` repeats: each sample the average of itself and
 *  its counterparts in the other lobes. */
function fold(d: Float64Array, lobes: number): Float64Array {
  const out = new Float64Array(d.length);
  for (let j = 0; j < d.length; j++) {
    let sum = 0;
    for (let m = 0; m < lobes; m++) sum += at(d, j + (m * d.length) / lobes);
    out[j] = sum / lobes;
  }
  return out;
}

/** The most lobes `import` looks for, the most a rosette in the lab may have. */
const MAX_LOBES = 96;

/** The largest lobe count the outline repeats at, to within `tolerance` of
 *  its amplitude; 1 when it does not repeat. */
function lobeCount(d: Float64Array, amplitude: number, tolerance: number): number {
  if (amplitude === 0) return 1;
  for (let k = MAX_LOBES; k > 1; k--) {
    const folded = fold(d, k);
    let err = 0;
    for (let j = 0; j < d.length; j++) err += (d[j] - folded[j]) ** 2;
    if (Math.sqrt(err / d.length) <= tolerance * amplitude) return k;
  }
  return 1;
}

export interface OutlineOptions {
  /** Scale the outline so its mean radius is this, mm; by default it keeps
   *  its own size. */
  radius?: number;
  /** The lobe count, instead of finding it. */
  lobes?: number;
  /** How far, as a fraction of the amplitude, the outline may stray from a
   *  repeat of one lobe and still be read as that many lobes. */
  tolerance?: number;
}

/** A rosette read from a closed outline in mm, as a drawn wave: the outline
 *  is sampled round its centroid, its lobe count found by how evenly it
 *  repeats, the lobes averaged into one, and that lobe turned so its peak is
 *  at u = 0. */
export function rosetteFromOutline(loop: readonly Vec2[], o: OutlineOptions = {}): { rosette: Rosette; lobes: number } {
  if (loop.length < 3) throw new Error('an outline needs at least three points');
  const center = centroid(loop);
  const r = polar(loop, center);
  let mean = 0;
  for (const v of r) mean += v / POLAR;
  const scale = o.radius === undefined ? 1 : o.radius / mean;
  const d = r.map((v) => (v - mean) * scale);
  let amplitude = 0;
  for (const v of d) amplitude = Math.max(amplitude, Math.abs(v));
  // An outline whose wave is lost in its own facets is round.
  const round = amplitude < 1e-4 * mean * scale;
  const lobes = o.lobes ?? (round ? 1 : lobeCount(d, amplitude, o.tolerance ?? 0.08));
  const lobe = lobes > 1 ? fold(d, lobes) : d;
  // One lobe, as box-filtered points, so a traced outline's pixel noise averages out.
  const span = POLAR / lobes;
  const count = Math.max(16, Math.min(256, Math.round(512 / lobes)));
  const values = Array.from({ length: count }, (_, j) => {
    let sum = 0;
    const steps = Math.max(1, Math.round(span / count));
    for (let q = 0; q < steps; q++) sum += at(lobe, ((j + (q + 0.5) / steps - 0.5) * span) / count);
    return sum / steps;
  });
  let peak = 0;
  for (let j = 1; j < count; j++) if (values[j] > values[peak]) peak = j;
  const top = Math.max(...values.map(Math.abs));
  const fixed = (v: number) => Math.round(v * 1e4) / 1e4;
  const points: ProfilePoint[] = values.map((_, j) => ({
    u: fixed(j / count),
    p: top > 0 && !round ? fixed(values[(j + peak) % count] / top) : 0,
  }));
  return {
    rosette: { radius: fixed(mean * scale), wave: { kind: 'drawn', lobes, amplitude: round ? 0 : fixed(top), points } },
    lobes,
  };
}
