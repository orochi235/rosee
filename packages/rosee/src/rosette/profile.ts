/** One lobe's shape: `u` is the position within the lobe in [0, 1), with the
 *  lobe's peak at u = 0. Returns a value in [-1, 1]: 1 at the peak, -1 at the
 *  valley floor. */
export type LobeProfile = (u: number) => number;

/** Distance from the nearest peak, in [0, 0.5]. */
const fromPeak = (u: number): number => Math.min(u, 1 - u);

export const sineLobe: LobeProfile = (u) => Math.cos(2 * Math.PI * u);

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
 *  periodic Catmull-Rom spline, so the lobe repeats without a seam. */
export const drawnLobe = (points: readonly ProfilePoint[]): LobeProfile => {
  const pts = [...points].sort((a, b) => a.u - b.u);
  const n = pts.length;
  if (n === 0) return () => 0;
  if (n === 1) return () => pts[0].p;
  const at = (i: number): ProfilePoint => {
    const k = ((i % n) + n) % n;
    const wraps = Math.floor(i / n);
    return { u: pts[k].u + wraps, p: pts[k].p };
  };
  return (u) => {
    let i = pts.findIndex((q) => q.u > u) - 1;
    if (i === -2) i = n - 1;
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const uu = u < p1.u ? u + 1 : u;
    const t = (uu - p1.u) / (p2.u - p1.u);
    const m1 = ((p2.p - p0.p) / (p2.u - p0.u)) * (p2.u - p1.u);
    const m2 = ((p3.p - p1.p) / (p3.u - p1.u)) * (p2.u - p1.u);
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * p1.p + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2.p + (t3 - t2) * m2;
  };
};
