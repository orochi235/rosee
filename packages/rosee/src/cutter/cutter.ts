import { rad } from '../angle';

/** A V graver: included angle in degrees, and the width of the flat ground
 *  on its tip in mm (0 for a sharp point). */
export interface Cutter {
  vAngle: number;
  tipFlat: number;
}

/** Width of the groove the cutter leaves at a cut depth, in mm. */
export const grooveWidth = (c: Cutter, depth: number): number => c.tipFlat + 2 * depth * Math.tan(rad(c.vAngle) / 2);
