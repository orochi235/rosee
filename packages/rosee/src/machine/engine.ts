import { TAU } from '../angle';

/** The machine cutting the work. A rose engine turns the work with the
 *  rosette on one spindle. A straight-line engine keeps the work from
 *  turning: a carriage on the rocking frame slides it `stroke` mm along the
 *  frame for every turn of the rosette, which is geared to the carriage. */
export type Engine = { kind: 'rose' } | { kind: 'straight'; stroke: number };

export const roseEngine: Engine = { kind: 'rose' };

/** The straight-line engine's carriage at rosette angle `angle` radians: the
 *  work's travel along the frame's y axis, mm, centered on the stroke so the
 *  turn's middle is at 0. */
export const carriageAt = (stroke: number, angle: number): number => stroke * (angle / TAU - 0.5);
