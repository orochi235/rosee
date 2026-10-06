export const TAU = Math.PI * 2;

export const rad = (deg: number): number => (deg * Math.PI) / 180;
export const deg = (r: number): number => (r * 180) / Math.PI;

/** Fraction of a turn in [0, 1). */
export const turnFraction = (a: number): number => (((a / TAU) % 1) + 1) % 1;

/** An angle wrapped to [0, 2π). */
export const wrapAngle = (a: number): number => turnFraction(a) * TAU;

/** Where angle `a` falls among `n` samples spaced evenly over a turn from
 *  0: the sample at or before it, and the fraction of the way to the next. */
export function turnSample(n: number, a: number): { i: number; f: number } {
  const x = turnFraction(a) * n;
  const i = Math.min(Math.floor(x), n - 1);
  return { i, f: x - i };
}

/** Linear interpolation at angle `a` in `values`, sampled evenly over a turn
 *  from 0. */
export function lerpTurn(values: ArrayLike<number>, a: number): number {
  const n = values.length;
  const { i, f } = turnSample(n, a);
  return values[i] + (values[(i + 1) % n] - values[i]) * f;
}
