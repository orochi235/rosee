import type { Rubber } from '../contact/table.js';
import type { Cutter } from '../cutter/cutter.js';
import type { Job } from '../job/job.js';
import type { Chuck } from '../machine/chuck.js';
import type { Engine } from '../machine/engine.js';
import type { Rosette } from '../rosette/rosette.js';
import type { Surface } from '../surface/surface.js';

/** A pumping rosette and its rubber. `gain` is the lever ratio from the
 *  pumping rubber's travel to the headstock's travel along the spindle. */
export interface Pump {
  rosette: Rosette;
  rubber: Rubber;
  gain: number;
}

/** Everything that decides the cut, as plain data. Lengths in mm, angles in
 *  degrees. `pivotDistance` is how far below the spindle axis the headstock
 *  rocks. */
export interface Settings {
  /** The machine: a rose engine, or a straight-line engine. */
  engine: Engine;
  rosette: Rosette;
  rubber: Rubber;
  pivotDistance: number;
  pump: Pump | null;
  /** The chuck holding the work, or null for work on the faceplate. */
  chuck: Chuck | null;
  /** The stock's surface the cutter works on. */
  surface: Surface;
  cutter: Cutter;
  job: Job;
  samplesPerTurn: number;
}
