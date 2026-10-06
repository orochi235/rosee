export const TAU = Math.PI * 2;

export const rad = (deg: number): number => (deg * Math.PI) / 180;
export const deg = (r: number): number => (r * 180) / Math.PI;

/** Fraction of a turn in [0, 1). */
export const turnFraction = (a: number): number => (((a / TAU) % 1) + 1) % 1;

/** An angle wrapped to [0, 2π). */
export const wrapAngle = (a: number): number => turnFraction(a) * TAU;

/** Neighbors moving more than this many samples' worth of turn apart have
 *  jumped (a contact point crossing from one peak to the next), not swept. */
const JUMP_SAMPLES = 16;

/** Linear interpolation at angle `a` in `values`, sampled evenly over a turn
 *  from 0. With `angular`, the values are themselves angles: they blend the
 *  short way round, a jump between neighbors takes the nearer one instead,
 *  and the result is wrapped to [0, 2π). */
export function lerpTurn(values: ArrayLike<number>, a: number, angular = false): number {
  const n = values.length;
  const x = turnFraction(a) * n;
  const i = Math.min(Math.floor(x), n - 1);
  const f = x - i;
  const v = values[i];
  let d = values[(i + 1) % n] - v;
  if (!angular) return v + d * f;
  d -= TAU * Math.round(d / TAU);
  if (Math.abs(d) > (JUMP_SAMPLES * TAU) / n) return wrapAngle(f < 0.5 ? v : v + d);
  return wrapAngle(v + d * f);
}
