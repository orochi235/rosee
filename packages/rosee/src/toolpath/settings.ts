import type { Rubber } from '../contact/table';
import type { Cutter } from '../cutter/cutter';
import type { Job } from '../job/job';
import type { Chuck } from '../machine/chuck';
import type { Rosette } from '../rosette/rosette';
import type { Surface } from '../surface/surface';

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
