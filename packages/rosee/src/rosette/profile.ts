import { TAU } from '../angle';

/** One lobe's shape: `u` is the position within the lobe in [0, 1), with the
 *  lobe's peak at u = 0. Returns a value in [-1, 1]: 1 at the peak, -1 at the
 *  valley floor. */
export type LobeProfile = (u: number) => number;

/** Distance from the nearest peak, in [0, 0.5]. */
const fromPeak = (u: number): number => Math.min(u, 1 - u);

export const sineLobe: LobeProfile = (u) => Math.cos(TAU * u);

/** Flat top and flat floor, each `flat` of the half-period wide, joined by
 *  cosine ramps. */
export const flatLobe =
  (flat: number): LobeProfile =>
  (u) => {
    const d = fromPeak(u);
    const h = flat / 4;
    if (d <= h) return 1;
    if (d >= 0.5 - h) return -1;
    return Math.cos((Math.PI * (d - h)) / (0.5 - 2 * h));
  };

/** Pointed peaks. `sharpness` 1 is a triangle wave; higher narrows the peak. */
export const petalLobe =
  (sharpness: number): LobeProfile =>
  (u) =>
    2 * Math.pow(1 - 2 * fromPeak(u), sharpness) - 1;

/** Rounded arcs bulging outward, meeting in sharp inward cusps. */
export const scallopLobe: LobeProfile = (u) => {
  const d = 2 * fromPeak(u);
  return 2 * Math.sqrt(1 - d * d) - 1;
};

export interface ProfilePoint {
  u: number;
  p: number;
}

/** A hand-drawn lobe: control points (u in [0, 1), p in [-1, 1]) joined by a
 *  periodic monotone cubic (Fritsch–Carlson), so the lobe repeats without a
 *  seam and never overshoots its points. Of points sharing a `u`, the last
 *  wins. */
export const drawnLobe = (points: readonly ProfilePoint[]): LobeProfile => {
  const pts: ProfilePoint[] = [];
  for (const q of [...points].sort((a, b) => a.u - b.u)) {
    if (pts.length > 0 && pts[pts.length - 1].u === q.u) pts[pts.length - 1] = q;
    else pts.push(q);
  }
  const n = pts.length;
  if (n === 0) return () => 0;
  if (n === 1) return () => pts[0].p;
  const width = pts.map((q, k) => (k + 1 < n ? pts[k + 1].u : pts[0].u + 1) - q.u);
  const slope = pts.map((q, k) => (pts[(k + 1) % n].p - q.p) / width[k]);
  const tangent = slope.map((s, k) => {
    const before = slope[(k + n - 1) % n];
    return before * s > 0 ? (before + s) / 2 : 0;
  });
  for (let k = 0; k < n; k++) {
    const j = (k + 1) % n;
    if (slope[k] === 0) {
      tangent[k] = 0;
      tangent[j] = 0;
      continue;
    }
    const a = tangent[k] / slope[k];
    const b = tangent[j] / slope[k];
    const len = Math.hypot(a, b);
    if (len > 3) {
      tangent[k] = (3 * a * slope[k]) / len;
      tangent[j] = (3 * b * slope[k]) / len;
    }
  }
  return (u) => {
    let k = n - 1;
    while (k >= 0 && pts[k].u > u) k--;
    if (k < 0) {
      k = n - 1;
      u += 1;
    }
    const h = width[k];
    const t = (u - pts[k].u) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    const p1 = pts[(k + 1) % n].p;
    return (
      (2 * t3 - 3 * t2 + 1) * pts[k].p + (t3 - 2 * t2 + t) * h * tangent[k] + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * h * tangent[(k + 1) % n]
    );
  };
};
