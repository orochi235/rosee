import { lerpTurn, TAU } from '../angle';
import { type ContactTable, reachAt, touchAt } from '../contact/table';
import { machineToHeadstock } from './pose';

/** Points the gap is sampled at across the bracket, looking for roots. */
const SCAN = 128;

/** The swing at which the rubber sits `d` from the spindle axis in the
 *  headstock frame, on the side where that distance grows with swing. */
function swingAtDistance(rubberX: number, pivotDistance: number, d: number): number {
  // |rubber|² = X² + 2XP·sin φ + 2P²(1 − cos φ)
  const a = 2 * rubberX * pivotDistance;
  const b = 2 * pivotDistance * pivotDistance;
  const s = (d * d - rubberX * rubberX - b) / Math.hypot(a, b);
  return Math.atan2(b, a) + Math.asin(Math.max(-1, Math.min(1, s)));
}

/** The headstock's swing with the rubber, fixed at (`rubberX`, 0) in the
 *  machine frame, touching the rosette phased to `rosetteAngle` = spindle +
 *  phase radians. The spring pushes the rosette onto the rubber from the far
 *  side, so where the wall is steeper than the headstock's arc and several
 *  swings touch, it rests at the largest: past that one the gap stays open.
 *  `steep` says there were several. */
export function solveContact(
  table: ContactTable,
  rubberX: number,
  pivotDistance: number,
  rosetteAngle: number,
): { swing: number; steep: boolean } {
  const gap = (swing: number): number => contactGap(table, rubberX, pivotDistance, rosetteAngle, swing);
  const lo = swingAtDistance(rubberX, pivotDistance, table.min);
  const hi = swingAtDistance(rubberX, pivotDistance, table.max);
  const at = (i: number): number => lo + ((hi - lo) * i) / SCAN;
  const g = new Float64Array(SCAN + 1);
  let crossings = 0;
  for (let i = 0; i <= SCAN; i++) {
    g[i] = gap(at(i));
    if (i > 0 && g[i] <= 0 !== g[i - 1] <= 0) crossings++;
  }
  const steep = crossings > 1;
  let i = SCAN;
  while (i >= 0 && g[i] > 0) i--;
  if (i < 0) return { swing: lo, steep };
  if (i === SCAN || g[i] === 0) return { swing: at(i), steep };
  return { swing: illinois(gap, at(i), g[i], at(i + 1), g[i + 1]), steep };
}

/** Root of `f` between `lo` (f < 0) and `hi` (f > 0). */
function illinois(f: (x: number) => number, lo: number, flo: number, hi: number, fhi: number): number {
  let side = 0;
  let x = lo;
  for (let i = 0; i < 100; i++) {
    x = (lo * fhi - hi * flo) / (fhi - flo);
    const fx = f(x);
    if (Math.abs(fx) < 1e-11) break;
    if (fx > 0) {
      hi = x;
      fhi = fx;
      if (side === 1) flo /= 2;
      side = 1;
    } else {
      lo = x;
      flo = fx;
      if (side === -1) fhi /= 2;
      side = -1;
    }
  }
  return x;
}

/** The headstock's swing with the rubber touching; see `solveContact`. */
export const solveSwing = (table: ContactTable, rubberX: number, pivotDistance: number, rosetteAngle: number): number =>
  solveContact(table, rubberX, pivotDistance, rosetteAngle).swing;

/** Contact residual at a swing: zero when the rubber just touches. */
export function contactGap(
  table: ContactTable,
  rubberX: number,
  pivotDistance: number,
  rosetteAngle: number,
  swing: number,
): number {
  const [hx, hy] = machineToHeadstock([rubberX, 0], pivotDistance, swing);
  return Math.hypot(hx, hy) - reachAt(table, Math.atan2(hy, hx) - rosetteAngle);
}

/** Swing, contact point and steepness solved once per rosette angle, evenly
 *  spaced over a turn. The swing depends only on the rosette's angle, not on
 *  the cutter or the work, so every pass reads from one table. */
export interface SwingTable {
  swing: Float64Array;
  /** Rosette-local angle of the outline point the rubber touches, [0, 2π). */
  contact: Float64Array;
  /** 1 where several swings touch: a real machine jumps there. */
  steep: Uint8Array;
}

export function swingTable(table: ContactTable, rubberX: number, pivotDistance: number): SwingTable {
  const n = table.reach.length;
  const swing = new Float64Array(n);
  const contact = new Float64Array(n);
  const steep = new Uint8Array(n);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU;
    const s = solveContact(table, rubberX, pivotDistance, a);
    const [hx, hy] = machineToHeadstock([rubberX, 0], pivotDistance, s.swing);
    swing[k] = s.swing;
    contact[k] = touchAt(table, Math.atan2(hy, hx) - a);
    steep[k] = s.steep ? 1 : 0;
  }
  return { swing, contact, steep };
}

/** Swing and contact point at a rosette angle, interpolated; steep if either
 *  neighboring sample is. */
export function swingAt(t: SwingTable, rosetteAngle: number): { swing: number; contact: number; steep: boolean } {
  return {
    swing: lerpTurn(t.swing, rosetteAngle),
    contact: lerpTurn(t.contact, rosetteAngle, true),
    steep: lerpTurn(t.steep, rosetteAngle) > 0,
  };
}
