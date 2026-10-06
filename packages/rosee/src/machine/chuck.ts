import { rad } from '../angle';
import type { Pass } from '../job/job';

/** A chuck between the spindle and the work, in mm and degrees. An eccentric
 *  chuck holds the work `eccentricity` off the spindle axis; an elliptical
 *  one slides it there and back each turn, driven by a ring on the headstock
 *  set `eccentricity` off the axis toward `ring`. Either turns the work by
 *  `wheel` on its dividing wheel. */
export type Chuck =
  | { kind: 'eccentric'; eccentricity: number; wheel: number }
  | { kind: 'elliptical'; eccentricity: number; ring: number; wheel: number };

/** The work's offset along the slide, mm, with the slide pointing
 *  `slideAngle` radians (spindle − index) round the headstock. */
export function slideAt(chuck: Chuck, pass: Pass, slideAngle: number): number {
  const e = chuck.eccentricity + pass.eccentricity;
  return chuck.kind === 'eccentric' ? e : e * Math.cos(slideAngle - rad(chuck.ring));
}

/** The wheel's turn for a pass, radians. */
export const wheelOf = (chuck: Chuck | null, pass: Pass): number => (chuck ? rad(chuck.wheel + pass.wheel) : 0);
