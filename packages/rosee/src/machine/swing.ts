import { turnFraction } from '../angle';
import { type ContactTable, reachAt } from '../contact/table';
import { machineToHeadstock } from './pose';

/** The headstock's swing angle at which the rubber, fixed at
 *  (`rubberX`, 0) in the machine frame, just touches the rosette. The rosette
 *  turns with the spindle and is phased `rosetteAngle` = spindle + phase
 *  radians. Positive swing carries the rosette away from the rubber, so the
 *  gap grows with swing; a bracket is widened from the rosette's throw and
 *  then closed by the Illinois method. */
export function solveSwing(table: ContactTable, rubberX: number, pivotDistance: number, rosetteAngle: number): number {
  const gap = (swing: number): number => contactGap(table, rubberX, pivotDistance, rosetteAngle, swing);
  let d = (table.max - table.min) / pivotDistance + 1e-9;
  while (!(gap(-d) < 0 && gap(d) > 0)) {
    d *= 2;
    if (d > 1) throw new Error('swing solve: no contact within one radian of swing');
  }
  let lo = -d;
  let hi = d;
  let glo = gap(lo);
  let ghi = gap(hi);
  let side = 0;
  let swing = 0;
  for (let i = 0; i < 100; i++) {
    swing = (lo * ghi - hi * glo) / (ghi - glo);
    const g = gap(swing);
    if (Math.abs(g) < 1e-11) break;
    if (g > 0) {
      hi = swing;
      ghi = g;
      if (side === 1) glo /= 2;
      side = 1;
    } else {
      lo = swing;
      glo = g;
      if (side === -1) ghi /= 2;
      side = -1;
    }
  }
  return swing;
}

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

/** Swing and contact angle solved once per rosette angle, evenly spaced over
 *  a turn. The swing depends only on the rosette's angle, not on the cutter
 *  or the work, so every pass reads from one table. */
export interface SwingTable {
  swing: Float64Array;
  contact: Float64Array;
}

export function swingTable(table: ContactTable, rubberX: number, pivotDistance: number): SwingTable {
  const n = table.reach.length;
  const swing = new Float64Array(n);
  const contact = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * 2 * Math.PI;
    const sw = solveSwing(table, rubberX, pivotDistance, a);
    const [hx, hy] = machineToHeadstock([rubberX, 0], pivotDistance, sw);
    swing[k] = sw;
    contact[k] = Math.atan2(hy, hx);
  }
  return { swing, contact };
}

/** Swing and rosette-local contact angle at a rosette angle, interpolated. */
export function swingAt(t: SwingTable, rosetteAngle: number): { swing: number; contact: number } {
  const n = t.swing.length;
  const x = turnFraction(rosetteAngle) * n;
  const i = Math.floor(x);
  const f = x - i;
  const j = (i + 1) % n;
  const k = i % n;
  return {
    swing: t.swing[k] * (1 - f) + t.swing[j] * f,
    contact: t.contact[k] * (1 - f) + t.contact[j] * f - rosetteAngle,
  };
}
