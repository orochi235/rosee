import { lerpTurn, TAU, turnSample, wrapAngle } from '../angle';
import { radiusAt, type Rosette, type Wave } from '../rosette/rosette';

/** The rubber's profile in the rosette's plane. A round rubber of radius 0 is
 *  a knife edge. A flat rubber is a face square to its line of approach. */
export type Rubber = { shape: 'round'; radius: number } | { shape: 'flat'; width: number };

/** How far from the rosette's center the rubber's reference point sits when
 *  touching, for each direction around the rosette. The reference point is
 *  the center of a round rubber and the face of a flat one. Directions are
 *  rosette-local, `samples` evenly spaced from 0. */
export interface ContactTable {
  reach: Float64Array;
  /** Rosette-local angle of the outline point the rubber touches, in
   *  [0, 2π). Where a big rubber bridges a valley it is on a neighboring
   *  peak, not in the rubber's direction. */
  touch: Float64Array;
  rosette: Rosette;
  rubber: Rubber;
  mean: number;
  min: number;
  max: number;
}

export const CONTACT_SAMPLES = 4096;

/** Longest outline segment, mm, so steep walls are not sampled sparsely. */
const MAX_SEGMENT = 0.05;
/** Farthest an outline segment may stray from the curve, mm. */
const SAGITTA = 1e-5;

/** Angles (in [0, 2π)) where a simple wave's lobes peak; compound waves have
 *  none known in advance. */
function peakAngles(w: Wave): number[] {
  if (w.kind === 'compound' || w.lobes <= 0) return [];
  const out: number[] = [];
  for (let k = 0; k < w.lobes; k++) out.push((k / w.lobes) * TAU);
  return out;
}

interface Outline {
  x: Float64Array;
  y: Float64Array;
  angle: Float64Array;
  rmin: number;
}

const polar = (a: number, r: number): [number, number] => [r * Math.cos(a), r * Math.sin(a)];

/** The outline as a closed polygon, its vertices in increasing angle. Every
 *  table direction is a vertex, so a circle comes out exact. */
function outline(rosette: Rosette, directions: number): Outline {
  const base = [...Array.from({ length: directions }, (_, k) => (k / directions) * TAU), ...peakAngles(rosette.wave)].sort(
    (p, q) => p - q,
  );
  const angles: number[] = [];
  for (const a of base) if (angles.length === 0 || a - angles[angles.length - 1] > 1e-12) angles.push(a);
  const radii = angles.map((a) => radiusAt(rosette, a));
  const xs: number[] = [];
  const ys: number[] = [];
  const as: number[] = [];
  const push = (a: number, r: number): void => {
    const [x, y] = polar(a, r);
    xs.push(x);
    ys.push(y);
    as.push(a);
  };
  /** Pushes the outline from a0 up to (not including) a1, bisecting until
   *  the chord sits within SAGITTA of the curve. */
  const refine = (a0: number, r0: number, a1: number, r1: number, depth: number): void => {
    const am = (a0 + a1) / 2;
    const rm = radiusAt(rosette, am);
    const [x0, y0] = polar(a0, r0);
    const [x1, y1] = polar(a1, r1);
    const [xm, ym] = polar(am, rm);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const off = Math.abs((x1 - x0) * (ym - y0) - (y1 - y0) * (xm - x0)) / len;
    if (depth < 24 && (off > SAGITTA || len > MAX_SEGMENT)) {
      refine(a0, r0, am, rm, depth + 1);
      refine(am, rm, a1, r1, depth + 1);
    } else push(a0, r0);
  };
  for (let i = 0; i < angles.length; i++) {
    const a1 = i + 1 < angles.length ? angles[i + 1] : TAU;
    refine(angles[i], radii[i], a1, radii[(i + 1) % angles.length], 0);
  }
  let rmin = Infinity;
  for (let i = 0; i < xs.length; i++) rmin = Math.min(rmin, Math.hypot(xs[i], ys[i]));
  return { x: Float64Array.from(xs), y: Float64Array.from(ys), angle: Float64Array.from(as), rmin };
}

/** First index whose angle is at least `a`, or the length if none. */
function lowerBound(angles: Float64Array, a: number): number {
  let lo = 0;
  let hi = angles.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (angles[mid] < a) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Builds the table by testing each direction against the outline's
 *  segments. A round rubber stops where its center leaves the far end of a
 *  segment's capsule (the points within ρ of it); a flat one where its face
 *  meets the farthest point of a segment inside its width. */
export function contactTable(rosette: Rosette, rubber: Rubber, samples = CONTACT_SAMPLES): ContactTable {
  const reach = new Float64Array(samples);
  const touch = new Float64Array(samples);
  const round = rubber.shape === 'round';
  const half = round ? rubber.radius : rubber.width / 2;
  if (half === 0) {
    for (let k = 0; k < samples; k++) {
      touch[k] = (k / samples) * TAU;
      reach[k] = radiusAt(rosette, touch[k]);
    }
    return summarize(rosette, rubber, reach, touch);
  }
  const { x: xs, y: ys, angle: angles, rmin } = outline(rosette, samples);
  const v = xs.length;
  const window = half >= rmin ? Infinity : Math.asin(half / rmin) + 1e-9;
  const h2 = half * half;
  for (let k = 0; k < samples; k++) {
    const dir = (k / samples) * TAU;
    const c = Math.cos(dir);
    const s = Math.sin(dir);
    let first = 0;
    let count = v;
    if (window < Math.PI) {
      first = lowerBound(angles, wrapAngle(dir - window)) - 1;
      count = lowerBound(angles, wrapAngle(dir + window)) - first;
      if (count <= 0) count += v;
    }
    let best = -Infinity;
    let bestAlong = 0;
    let bestAcross = 0;
    const consider = (d: number, along: number, across: number): void => {
      if (d > best) {
        best = d;
        bestAlong = along;
        bestAcross = across;
      }
    };
    let i = (first + v) % v;
    let a1 = xs[i] * c + ys[i] * s;
    let b1 = ys[i] * c - xs[i] * s;
    for (let n = 0; n < count; n++) {
      const j = (i + 1) % v;
      const a2 = xs[j] * c + ys[j] * s;
      const b2 = ys[j] * c - xs[j] * s;
      const da = a2 - a1;
      const db = b2 - b1;
      if (round) {
        if (Math.abs(b1) <= half) consider(a1 + Math.sqrt(h2 - b1 * b1), a1, b1);
        const len = Math.hypot(da, db);
        if (len > 0) {
          const ta = da / len;
          const tb = db / len;
          if (tb !== 0) {
            for (const side of [-half, half]) {
              const d = a1 - (side + b1 * ta) / tb;
              const foot = (d - a1) * ta - b1 * tb;
              if (foot >= 0 && foot <= len) consider(d, a1 + foot * ta, b1 + foot * tb);
            }
          }
        }
      } else {
        let t0 = 0;
        let t1 = 1;
        if (db === 0) {
          if (Math.abs(b1) > half) t1 = -1;
        } else {
          const ta = (-half - b1) / db;
          const tb = (half - b1) / db;
          t0 = Math.max(0, Math.min(ta, tb));
          t1 = Math.min(1, Math.max(ta, tb));
        }
        if (t0 <= t1) {
          consider(a1 + t0 * da, a1 + t0 * da, b1 + t0 * db);
          consider(a1 + t1 * da, a1 + t1 * da, b1 + t1 * db);
        }
      }
      i = j;
      a1 = a2;
      b1 = b2;
    }
    if (round && Math.abs(b1) <= half) consider(a1 + Math.sqrt(h2 - b1 * b1), a1, b1);
    reach[k] = best;
    touch[k] = wrapAngle(dir + Math.atan2(bestAcross, bestAlong));
  }
  return summarize(rosette, rubber, reach, touch);
}

function summarize(rosette: Rosette, rubber: Rubber, reach: Float64Array, touch: Float64Array): ContactTable {
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const d of reach) {
    sum += d;
    min = Math.min(min, d);
    max = Math.max(max, d);
  }
  return { reach, touch, rosette, rubber, mean: sum / reach.length, min, max };
}

/** Reach at rosette-local angle `a` (radians), linearly interpolated. */
export const reachAt = (t: ContactTable, a: number): number => lerpTurn(t.reach, a);

/** How far the outline may stray from the rubber halfway between two
 *  samples' touch points, as a share of the distance between them, for the
 *  contact to have swept between them rather than jumped. */
const SWEEP_SLACK = 0.01;

/** Rosette-local angle of the touching point for a rubber in direction `a`.
 *  Between two samples whose contact swept along the outline it blends their
 *  touch angles the short way round; where the outline halfway between them
 *  falls away from the rubber, the contact jumped across a bridged valley,
 *  and the nearer sample is taken. */
export function touchAt(t: ContactTable, a: number): number {
  const n = t.touch.length;
  const { i, f } = turnSample(n, a);
  const j = (i + 1) % n;
  const t0 = t.touch[i];
  let d = t.touch[j] - t0;
  d -= TAU * Math.round(d / TAU);
  const blend = wrapAngle(t0 + d * f);
  const { rosette, rubber } = t;
  // A knife edge touches where it points; the test below would only see reach's interpolation error.
  if (rubber.shape === 'round' && rubber.radius === 0) return blend;
  const [x0, y0] = polar(t0, radiusAt(rosette, t0));
  const [x1, y1] = polar(t0 + d, radiusAt(rosette, t0 + d));
  const [x, y] = polar(t0 + d / 2, radiusAt(rosette, t0 + d / 2));
  const dir = ((i + 0.5) / n) * TAU;
  const reach = (t.reach[i] + t.reach[j]) / 2;
  const c = Math.cos(dir);
  const s = Math.sin(dir);
  const off =
    rubber.shape === 'round'
      ? Math.abs(Math.hypot(x - reach * c, y - reach * s) - rubber.radius)
      : Math.abs(x * c + y * s - reach);
  if (off <= SWEEP_SLACK * Math.hypot(x1 - x0, y1 - y0)) return blend;
  return wrapAngle(f < 0.5 ? t0 : t0 + d);
}
