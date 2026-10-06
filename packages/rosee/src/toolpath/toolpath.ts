import { rad, TAU } from '../angle';
import { contactTable, reachAt } from '../contact/table';
import { expandJob, type Pass } from '../job/job';
import { headstockToWork, machineToHeadstock } from '../machine/pose';
import { swingAt, swingTable } from '../machine/swing';
import type { Settings } from './settings';

/** One pass, sampled `samples + 1` times over a full turn (the last sample
 *  repeats the first). Sample i is at spindle angle i / samples · 2π. */
export interface PassPath {
  pass: Pass;
  /** Cutter tip in work coordinates, mm: x, y, z per sample. z is negative
   *  into the stock. */
  xyz: Float32Array;
  /** Headstock swing, radians. */
  swing: Float32Array;
  /** Headstock travel toward the cutter from pumping, mm. */
  pump: Float32Array;
  /** Rosette-local angle at which the rubber touches, radians. */
  contact: Float32Array;
}

export interface Toolpaths {
  samples: number;
  /** Where the rubber sits on the machine's x axis, mm. */
  rubberX: number;
  passes: PassPath[];
}

export function computeToolpaths(s: Settings): Toolpaths {
  const table = contactTable(s.rosette, s.rubber);
  const pumpTable = s.pump ? contactTable(s.pump.rosette, s.pump.rubber) : null;
  const rubberX = table.mean;
  const swings = swingTable(table, rubberX, s.pivotDistance);
  const n = s.samplesPerTurn;
  const passes = expandJob(s.job).map((pass): PassPath => {
    const xyz = new Float32Array((n + 1) * 3);
    const swing = new Float32Array(n + 1);
    const pump = new Float32Array(n + 1);
    const contact = new Float32Array(n + 1);
    const index = rad(pass.index);
    for (let i = 0; i <= n; i++) {
      const spindle = (i / n) * TAU;
      const rosetteAngle = spindle + rad(pass.phase);
      const { swing: sw, contact: touch } = swingAt(swings, rosetteAngle);
      const tip = machineToHeadstock([pass.radius, 0], s.pivotDistance, sw);
      const [x, y] = headstockToWork(tip, spindle, index);
      const travel =
        s.pump && pumpTable
          ? s.pump.gain * (reachAt(pumpTable, -(spindle + rad(pass.pumpPhase))) - pumpTable.mean)
          : 0;
      xyz[i * 3] = x;
      xyz[i * 3 + 1] = y;
      xyz[i * 3 + 2] = -(pass.depth + travel);
      swing[i] = sw;
      pump[i] = travel;
      contact[i] = touch;
    }
    return { pass, xyz, swing, pump, contact };
  });
  return { samples: n, rubberX, passes };
}
